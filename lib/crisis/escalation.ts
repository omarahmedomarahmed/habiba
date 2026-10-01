import type { RiskLevel } from "@/lib/db/schema";

/**
 * 🔴 F2: A CRISIS ALERT LEAVES THE BUILDING, AND SOMEBODY HAS TO SAY THEY HAVE IT.
 *
 * Due diligence found that a crisis alert was one row in an in-app list. A
 * clinician not looking at the app at 3am learned nothing until they next
 * opened it. Now every alert also goes out of band at once (email, and
 * WhatsApp where a channel and an approved template exist), carries a link to
 * acknowledge it, and if nobody acknowledges it within the configured minutes
 * (`crisis.escalateAfterMinutes`, default 15) it goes to a backup:
 *
 *   stage 0  the responsible clinician only.
 *   stage 1  a clinic: the clinic's other clinicians and its managers. A
 *            clinician on their own skips this stage.
 *   stage 2  the platform: back office managers and super admins. Final.
 *
 * Every rule here is pure so it is tested as arithmetic
 * (`tests/crisis-escalation.test.ts`); the I/O is `lib/crisis/alerts.ts`, and
 * the per-minute tick drives it (`lib/sessions/reminder-marker.ts`, `crisisDueAt`).
 */

/** The default, and the bounds an operator may set it within. */
export const ESCALATE_AFTER_MINUTES_DEFAULT = 15;
export const ESCALATE_AFTER_MINUTES_MIN = 1;
export const ESCALATE_AFTER_MINUTES_MAX = 240;

/** How many times the tick retries an out-of-band send that did not leave. */
export const MAX_OUT_OF_BAND_ATTEMPTS = 5;

/** The last stage. Nothing escalates past the platform. */
export const FINAL_STAGE = 2;

const ORDER: RiskLevel[] = ["none", "low", "moderate", "elevated", "high", "critical"];

/** A stored or typed minutes value, clamped to the bounds, or the default. */
export function escalationMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n)) return ESCALATE_AFTER_MINUTES_DEFAULT;
  return Math.min(ESCALATE_AFTER_MINUTES_MAX, Math.max(ESCALATE_AFTER_MINUTES_MIN, n));
}

/** When an alert raised (or upgraded) at `from` is due to escalate. */
export function escalateAtFor(from: Date, minutes: number): Date {
  return new Date(from.getTime() + escalationMinutes(minutes) * 60_000);
}

/**
 * 🔴 F2 / item 5: WHAT A NEW SIGNAL DOES TO AN ALERT ALREADY RAISED.
 *
 * Inside the ten minute window a repeat used to be dropped whatever it said,
 * so a model's `critical` arriving after the phrase list's `high` was thrown
 * away and nobody was told the risk had gone up. Now:
 *
 *   no recent alert       insert
 *   a higher level        upgrade, and notify again
 *   the same or lower     skip (re-alerting every mention is noise)
 */
export function dedupDecision(recent: RiskLevel | null, incoming: RiskLevel): "insert" | "upgrade" | "skip" {
  if (recent === null) return "insert";
  return ORDER.indexOf(incoming) > ORDER.indexOf(recent) ? "upgrade" : "skip";
}

export type EscalationRow = {
  acknowledgedAt: Date | null;
  escalationStage: number;
  escalateAt: Date | null;
};

export type EscalationStep = {
  audience: "clinic" | "platform";
  nextStage: number;
  /** When the stage after this one is due, or null when this is the last. */
  nextEscalateAt: Date | null;
};

/**
 * 🔴 THE DECISION: is this alert due to go to somebody else now, and to whom?
 *
 * Null when it is acknowledged, not yet due, has no timer (an alert from
 * before 0185) or has reached the platform already. An acknowledgement at any
 * point stops it: that is the whole contract with the person who acknowledged.
 */
export function nextEscalation(
  row: EscalationRow,
  opts: { now: Date; inClinic: boolean; minutes: number },
): EscalationStep | null {
  if (row.acknowledgedAt) return null;
  if (!row.escalateAt) return null;
  if (row.escalateAt.getTime() > opts.now.getTime()) return null;
  if (row.escalationStage >= FINAL_STAGE) return null;

  if (row.escalationStage === 0 && opts.inClinic) {
    return { audience: "clinic", nextStage: 1, nextEscalateAt: escalateAtFor(opts.now, opts.minutes) };
  }
  return { audience: "platform", nextStage: FINAL_STAGE, nextEscalateAt: null };
}

export type DueRow = EscalationRow & {
  outOfBandAt: Date | null;
  outOfBandAttempts: number;
};

/**
 * An out-of-band send that was tried and did not leave, with retries left.
 *
 * At least one attempt, because a row from before 0185 has none and was
 * never meant to be sent: retrying it would email a clinician about an alert
 * from last month. A fresh alert is attempted inline the moment it is raised.
 */
export function needsOutOfBandRetry(row: Pick<DueRow, "acknowledgedAt" | "outOfBandAt" | "outOfBandAttempts">): boolean {
  return (
    !row.acknowledgedAt &&
    !row.outOfBandAt &&
    row.outOfBandAttempts >= 1 &&
    row.outOfBandAttempts < MAX_OUT_OF_BAND_ATTEMPTS
  );
}

/**
 * The soonest moment the tick has crisis work to do, across the alerts still
 * open: an escalation coming due, or now for an out-of-band send that has not
 * left yet and has retries left. Null when there is nothing, which is what
 * lets the database sleep.
 */
export function crisisDueAt(rows: DueRow[], now: Date): Date | null {
  let soonest: number | null = null;
  for (const row of rows) {
    if (row.acknowledgedAt) continue;
    const candidates: number[] = [];
    if (row.escalateAt && row.escalationStage < FINAL_STAGE) candidates.push(row.escalateAt.getTime());
    if (needsOutOfBandRetry(row)) candidates.push(now.getTime());
    for (const at of candidates) soonest = soonest === null ? at : Math.min(soonest, at);
  }
  return soonest === null ? null : new Date(soonest);
}

/**
 * Who may acknowledge an alert: the clinician it is for, a colleague in the
 * same practice (a backup at stage 1), or the back office (a backup at stage 2).
 */
export function mayAcknowledge(
  alert: { therapistId: string; organizationId: string },
  actor: { userId: string; organizationId: string; role: string },
): boolean {
  if (actor.userId === alert.therapistId) return true;
  if (actor.organizationId === alert.organizationId) return true;
  return actor.role === "super_admin" || actor.role === "manager" || actor.role === "staff";
}
