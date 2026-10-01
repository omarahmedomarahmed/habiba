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
 * When every out-of-band send to the clinician fails, the next stage is due at
 * once (`escalateNowIfExhausted`). A journal alert with no clinician holding a
 * grant starts at stage 2.
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
 * 🔴 Due diligence: every retry to the clinician failed. The alert used to stop
 * there until its deadline; now it goes to the next stage at once.
 *
 * Review: only while it is still with the clinician (stage 0). Once the clinic
 * has been told, its own deadline stands: pulling it forward skipped the
 * clinic's time and logged the same failure again every tick.
 */
export function outOfBandExhausted(row: DueRow): boolean {
  return (
    !row.acknowledgedAt &&
    !row.outOfBandAt &&
    row.outOfBandAttempts >= MAX_OUT_OF_BAND_ATTEMPTS &&
    row.escalationStage === 0
  );
}

/**
 * The deadline an alert should have once its out-of-band attempts are spent:
 * `now` when its deadline is still ahead (or missing), otherwise null, which
 * means leave it as it is.
 */
export function escalateNowIfExhausted(row: DueRow, now: Date): Date | null {
  if (!outOfBandExhausted(row)) return null;
  if (row.escalateAt && row.escalateAt.getTime() <= now.getTime()) return null;
  return now;
}

/**
 * The soonest moment the tick has crisis work to do, across the alerts still
 * open: an escalation coming due, or now for an out-of-band send that has not
 * left yet (with retries left, or with its retries spent and so due to go to
 * the next stage). Null when there is nothing, which is what lets the
 * database sleep.
 */
export function crisisDueAt(rows: DueRow[], now: Date): Date | null {
  let soonest: number | null = null;
  for (const row of rows) {
    if (row.acknowledgedAt) continue;
    const candidates: number[] = [];
    if (row.escalateAt && row.escalationStage < FINAL_STAGE) candidates.push(row.escalateAt.getTime());
    if (needsOutOfBandRetry(row) || outOfBandExhausted(row)) candidates.push(now.getTime());
    for (const at of candidates) soonest = soonest === null ? at : Math.min(soonest, at);
  }
  return soonest === null ? null : new Date(soonest);
}

/**
 * The platform's on-call: the back office roles told at the last stage. There
 * is no clinical or on-call staff role in the product, so these are also the
 * only people from outside a practice who may acknowledge its alert.
 */
export const ON_CALL_ROLES = ["manager", "super_admin"] as const;

/**
 * 🔴 Due diligence: WHO MAY ACKNOWLEDGE. An acknowledgement stops every
 * escalation, so only people who are told and can act may give one:
 *
 *   - the clinician the alert is for;
 *   - a clinician (role `therapist`) in the same practice, the stage 1 backup;
 *   - the platform on-call (`ON_CALL_ROLES`), the stage 2 backup.
 *
 * Not `staff` (they work queues and are never told). A journal alert with no
 * clinician has no practice, so only the on-call may acknowledge it.
 */
export function mayAcknowledge(
  alert: { therapistId: string | null; organizationId: string | null },
  actor: { userId: string; organizationId: string; role: string },
): boolean {
  if (alert.therapistId && actor.userId === alert.therapistId) return true;
  if (actor.role === "therapist" && alert.organizationId && actor.organizationId === alert.organizationId) return true;
  return (ON_CALL_ROLES as readonly string[]).includes(actor.role);
}
