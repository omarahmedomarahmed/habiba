/*
 * 🔴 30.1: the CONTROL PLANE, the second step belongs to signing in, which resolves the region.
 */
import "server-only";

import { and, count, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret, secretsConfigured } from "@/lib/crypto/secretbox";
import { controlDb as db } from "@/lib/db";
import {
  authSessions,
  clinicManagers,
  BACK_OFFICE_ROLES,
  partnerUsers,
  portalRecoveryCodes,
  portalSecondFactors,
  staffEmailCodes,
  staffRecoveryCodes,
  staffSecondFactors,
  users,
} from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { consume, subjectKey } from "@/lib/rate-limit";
import type { Actor } from "./session";
import {
  base32Encode,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUri,
  pendingEnrolmentCurrent,
  verifyTotp,
} from "./totp";
import { mayResetAccountFactor, type FactorResetTarget } from "./factor-reset";

/**
 * 🔴 TASK 40: THE SECOND STEP, THE HALF THAT STORES THINGS.
 *
 * The rule itself (who must, for how long, what a code is) is pure and lives
 * in `lib/auth/totp.ts`. This file holds what touches rows: the authenticator
 * secret, sealed; the recovery codes, hashed; and the time on a session that
 * says the step was passed.
 *
 * DD-2 B2.3: the console's emailed code is gone. A back office member signs
 * in with an authenticator app or a recovery code, and one without an app is
 * enrolled on the second step page before anything else, once six digits
 * emailed to their address prove the inbox (review fix: a password alone
 * never reaches the QR code). An owner resets another member's app from Team.
 *
 * DD-2 B2.4: the same app, optional, for a clinician (a `users` row, so the
 * staff tables), a clinic manager or a partner user (`portal_second_factors`).
 * Once enrolled, it is asked for at every sign-in.
 *
 * 🔴 Nothing here logs a secret, a code or a recovery code.
 */

const ISSUER = "24Therapy";

/** Six digit guesses per person, across every method, per window. */
const VERIFY_LIMIT = 10;
const VERIFY_WINDOW_SECONDS = 15 * 60;

type Who = Pick<Actor, "userId" | "organizationId" | "email" | "role">;

export type StepResult = { ok: true } | { ok: false; error: MessageKey };

/* ------------------------------------------------------------------ */
/*  Whose app: a users row, a clinic manager or a partner user         */
/* ------------------------------------------------------------------ */

export type FactorOwner =
  | { kind: "user"; id: string }
  | { kind: "clinic"; id: string }
  | { kind: "partner"; id: string };

type FactorRow = { sealed: string; confirmedAt: Date | null; lastStep: number | null; updatedAt: Date };

const portalOwner = (owner: Exclude<FactorOwner, { kind: "user" }>) =>
  owner.kind === "clinic"
    ? eq(portalSecondFactors.clinicManagerId, owner.id)
    : eq(portalSecondFactors.partnerUserId, owner.id);

async function readFactor(owner: FactorOwner): Promise<(FactorRow & { portalId?: string }) | null> {
  if (owner.kind === "user") {
    const [row] = await db
      .select({
        sealed: staffSecondFactors.secretSealed,
        confirmedAt: staffSecondFactors.confirmedAt,
        lastStep: staffSecondFactors.lastStep,
        updatedAt: staffSecondFactors.updatedAt,
      })
      .from(staffSecondFactors)
      .where(eq(staffSecondFactors.userId, owner.id))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({
      portalId: portalSecondFactors.id,
      sealed: portalSecondFactors.secretSealed,
      confirmedAt: portalSecondFactors.confirmedAt,
      lastStep: portalSecondFactors.lastStep,
      updatedAt: portalSecondFactors.updatedAt,
    })
    .from(portalSecondFactors)
    .where(portalOwner(owner))
    .limit(1);
  return row ?? null;
}

/** A new pending secret, never over a confirmed one: replacing a working app is a reset. */
async function writePending(owner: FactorOwner, sealed: string): Promise<void> {
  if (owner.kind === "user") {
    await db
      .insert(staffSecondFactors)
      .values({ userId: owner.id, secretSealed: sealed })
      .onConflictDoUpdate({
        target: staffSecondFactors.userId,
        set: { secretSealed: sealed, confirmedAt: null, lastStep: null, updatedAt: new Date() },
        setWhere: isNull(staffSecondFactors.confirmedAt),
      });
    return;
  }
  const existing = await readFactor(owner);
  if (existing?.confirmedAt) return;
  if (existing) {
    await db
      .update(portalSecondFactors)
      .set({ secretSealed: sealed, lastStep: null, updatedAt: new Date() })
      .where(and(portalOwner(owner), isNull(portalSecondFactors.confirmedAt)));
    return;
  }
  await db
    .insert(portalSecondFactors)
    .values({
      secretSealed: sealed,
      clinicManagerId: owner.kind === "clinic" ? owner.id : null,
      partnerUserId: owner.kind === "partner" ? owner.id : null,
    })
    .onConflictDoNothing();
}

/** Turn a pending app on and replace the recovery codes, in one transaction. */
async function confirmFactor(owner: FactorOwner, step: number, codes: string[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (owner.kind === "user") {
      const done = await tx
        .update(staffSecondFactors)
        .set({ confirmedAt: new Date(), lastStep: step, updatedAt: new Date() })
        .where(and(eq(staffSecondFactors.userId, owner.id), isNull(staffSecondFactors.confirmedAt)))
        .returning({ userId: staffSecondFactors.userId });
      if (done.length !== 1) return false;
      await tx.delete(staffRecoveryCodes).where(eq(staffRecoveryCodes.userId, owner.id));
      await tx
        .insert(staffRecoveryCodes)
        .values(codes.map((code) => ({ userId: owner.id, codeHash: hashRecoveryCode(code) })));
      return true;
    }
    const done = await tx
      .update(portalSecondFactors)
      .set({ confirmedAt: new Date(), lastStep: step, updatedAt: new Date() })
      .where(and(portalOwner(owner), isNull(portalSecondFactors.confirmedAt)))
      .returning({ id: portalSecondFactors.id });
    if (done.length !== 1) return false;
    const factorId = done[0]!.id;
    await tx.delete(portalRecoveryCodes).where(eq(portalRecoveryCodes.factorId, factorId));
    await tx
      .insert(portalRecoveryCodes)
      .values(codes.map((code) => ({ factorId, codeHash: hashRecoveryCode(code) })));
    return true;
  });
}

/** `last_step` only moves forward, so one code cannot pass twice even in a race. */
async function advanceStep(owner: FactorOwner, step: number): Promise<boolean> {
  if (owner.kind === "user") {
    const moved = await db
      .update(staffSecondFactors)
      .set({ lastStep: step, updatedAt: new Date() })
      .where(
        and(
          eq(staffSecondFactors.userId, owner.id),
          or(isNull(staffSecondFactors.lastStep), lt(staffSecondFactors.lastStep, step)),
        ),
      )
      .returning({ userId: staffSecondFactors.userId });
    return moved.length === 1;
  }
  const moved = await db
    .update(portalSecondFactors)
    .set({ lastStep: step, updatedAt: new Date() })
    .where(
      and(
        portalOwner(owner),
        isNotNull(portalSecondFactors.confirmedAt),
        or(isNull(portalSecondFactors.lastStep), lt(portalSecondFactors.lastStep, step)),
      ),
    )
    .returning({ id: portalSecondFactors.id });
  return moved.length === 1;
}

/** 🔴 ONE STATEMENT SPENDS IT: `used_at IS NULL` is in the WHERE. */
async function spendRecovery(owner: FactorOwner, typed: string, portalId?: string): Promise<boolean> {
  const hash = hashRecoveryCode(typed);
  if (owner.kind === "user") {
    const spent = await db
      .update(staffRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(staffRecoveryCodes.userId, owner.id),
          eq(staffRecoveryCodes.codeHash, hash),
          isNull(staffRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: staffRecoveryCodes.id });
    return spent.length === 1;
  }
  if (!portalId) return false;
  const spent = await db
    .update(portalRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(portalRecoveryCodes.factorId, portalId),
        eq(portalRecoveryCodes.codeHash, hash),
        isNull(portalRecoveryCodes.usedAt),
      ),
    )
    .returning({ id: portalRecoveryCodes.id });
  return spent.length === 1;
}

async function recoveryLeft(owner: FactorOwner, portalId?: string): Promise<number> {
  if (owner.kind === "user") {
    const [left] = await db
      .select({ n: count() })
      .from(staffRecoveryCodes)
      .where(and(eq(staffRecoveryCodes.userId, owner.id), isNull(staffRecoveryCodes.usedAt)));
    return Number(left?.n ?? 0);
  }
  if (!portalId) return 0;
  const [left] = await db
    .select({ n: count() })
    .from(portalRecoveryCodes)
    .where(and(eq(portalRecoveryCodes.factorId, portalId), isNull(portalRecoveryCodes.usedAt)));
  return Number(left?.n ?? 0);
}

async function withinLimit(owner: FactorOwner): Promise<boolean> {
  /* The staff key is kept for users rows, so a limit in flight is not reset by this change. */
  const key = owner.kind === "user" ? subjectKey("staff-2fa-verify", owner.id) : subjectKey(`${owner.kind}-2fa-verify`, owner.id);
  const verdict = await consume(key, VERIFY_LIMIT, VERIFY_WINDOW_SECONDS);
  return verdict.allowed;
}

/* ------------------------------------------------------------------ */
/*  The generic steps, for any owner                                   */
/* ------------------------------------------------------------------ */

export type SecondFactorStatus = {
  /** A confirmed authenticator. */
  enrolled: boolean;
  confirmedAt: Date | null;
  recoveryLeft: number;
};

export async function factorStatus(owner: FactorOwner): Promise<SecondFactorStatus> {
  const row = await readFactor(owner);
  const confirmedAt = row?.confirmedAt ?? null;
  if (!confirmedAt) return { enrolled: false, confirmedAt: null, recoveryLeft: 0 };
  return { enrolled: true, confirmedAt, recoveryLeft: await recoveryLeft(owner, row?.portalId) };
}

/** Whether this server can seal a secret at all. Asked before offering enrolment. */
export function enrolmentAvailable(): boolean {
  return secretsConfigured();
}

/** Start, or restart, an enrolment. Unconfirmed until the first code from the app matches. */
export async function startFactor(owner: FactorOwner): Promise<StepResult> {
  if (!enrolmentAvailable()) return { ok: false, error: "asec.unavailable" };
  if ((await factorStatus(owner)).enrolled) return { ok: false, error: "asec.already" };
  await writePending(owner, encryptSecret(newTotpSecret().toString("base64")));
  return { ok: true };
}

export type PendingEnrolment = { key: string; uri: string };

/** The pending enrolment's key and QR payload, for the one page that shows it. */
export async function pendingFactor(owner: FactorOwner, account: string): Promise<PendingEnrolment | null> {
  const row = await readFactor(owner);
  if (!row || row.confirmedAt || !pendingEnrolmentCurrent(row.updatedAt)) return null;
  const secret = Buffer.from(decryptSecret(row.sealed), "base64");
  return {
    key: base32Encode(secret).replace(/(.{4})/g, "$1 ").trim(),
    uri: otpauthUri({ secret, account, issuer: ISSUER }),
  };
}

/** The first code from the app turns it on and returns ten recovery codes, once. */
export async function confirmFactorCode(
  owner: FactorOwner,
  typed: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: MessageKey; reason: string }> {
  if (!(await withinLimit(owner))) return { ok: false, error: "tauth.secondTooMany", reason: "rate limited" };
  const row = await readFactor(owner);
  if (!row) return { ok: false, error: "asec.startAgain", reason: "no pending enrolment" };
  if (row.confirmedAt) return { ok: false, error: "asec.already", reason: "already enrolled" };
  /* A pending app nobody confirmed in time is not left for a later visitor to finish. */
  if (!pendingEnrolmentCurrent(row.updatedAt)) return { ok: false, error: "asec.startAgain", reason: "pending expired" };

  const secret = Buffer.from(decryptSecret(row.sealed), "base64");
  const verdict = verifyTotp(secret, typed, Date.now(), null);
  if (!verdict.ok) return { ok: false, error: "tauth.secondWrong", reason: verdict.reason };

  const codes = newRecoveryCodes();
  if (!(await confirmFactor(owner, verdict.step, codes))) {
    return { ok: false, error: "asec.already", reason: "already enrolled" };
  }
  return { ok: true, recoveryCodes: codes };
}

/** Six digits from the app, or a recovery code. */
export async function checkFactor(
  owner: FactorOwner,
  typed: string,
): Promise<{ ok: true; method: "app" | "recovery" } | { ok: false; error: MessageKey; method: string; reason: string }> {
  if (!(await withinLimit(owner))) {
    return { ok: false, error: "tauth.secondTooMany", method: "any", reason: "rate limited" };
  }
  const row = await readFactor(owner);
  if (!row?.confirmedAt) return { ok: false, error: "tauth.secondWrong", method: "app", reason: "not enrolled" };

  if (looksLikeRecoveryCode(typed)) {
    return (await spendRecovery(owner, typed, row.portalId))
      ? { ok: true, method: "recovery" }
      : { ok: false, error: "tauth.secondWrong", method: "recovery", reason: "wrong" };
  }

  let secret: Buffer;
  try {
    secret = Buffer.from(decryptSecret(row.sealed), "base64");
  } catch (error) {
    // The reason, never the value. A key rotated without re-enrolment lands here.
    log.error("second factor could not be opened", { owner: ref(owner.id), reason: safeErrorMessage(error) });
    return { ok: false, error: "tauth.secondWrong", method: "app", reason: "secret unreadable" };
  }
  const verdict = verifyTotp(secret, typed, Date.now(), row.lastStep);
  if (!verdict.ok) return { ok: false, error: "tauth.secondWrong", method: "app", reason: verdict.reason };
  return (await advanceStep(owner, verdict.step))
    ? { ok: true, method: "app" }
    : { ok: false, error: "tauth.secondWrong", method: "app", reason: "replayed" };
}

/** Turn an app off. The person themselves, after a code from it, or an owner's reset. */
export async function removeFactor(owner: FactorOwner): Promise<void> {
  if (owner.kind === "user") {
    await db.transaction(async (tx) => {
      await tx.delete(staffSecondFactors).where(eq(staffSecondFactors.userId, owner.id));
      await tx.delete(staffRecoveryCodes).where(eq(staffRecoveryCodes.userId, owner.id));
    });
    return;
  }
  await db.delete(portalSecondFactors).where(portalOwner(owner));
}

/* ------------------------------------------------------------------ */
/*  The users-table session: back office, and clinicians who enrolled  */
/* ------------------------------------------------------------------ */

export async function secondFactorStatus(userId: string): Promise<SecondFactorStatus> {
  return factorStatus({ kind: "user", id: userId });
}

/** Which members have an app, for the team page. Never the secret. */
export async function enrolledAmong(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .select({ userId: staffSecondFactors.userId })
    .from(staffSecondFactors)
    .where(and(inArray(staffSecondFactors.userId, userIds), isNotNull(staffSecondFactors.confirmedAt)));
  return new Set(rows.map((row) => row.userId));
}

/** Written on the session, and read by every request after it. */
async function markPassed(sessionId: string): Promise<void> {
  await db.update(authSessions).set({ secondFactorAt: new Date() }).where(eq(authSessions.id, sessionId));
}

async function failed(who: Who, method: string, reason: string): Promise<void> {
  await audit({
    actor: who,
    category: "auth",
    action: "second_factor.failed",
    resourceType: "user",
    resourceId: who.userId,
    reason: `${method}: ${reason}`,
  });
}

/**
 * Check what a pending session typed, and on success record the time on it.
 * The app's six digits or a recovery code; nothing else. 🔴 DD-2 B2.3: the
 * emailed code is no longer a way in, so an inbox is never a second factor.
 */
export async function passSecondStep(who: Who, sessionId: string, typed: string): Promise<StepResult> {
  const result = await checkFactor({ kind: "user", id: who.userId }, typed);
  if (!result.ok) {
    await failed(who, result.method, result.reason);
    return { ok: false, error: result.error };
  }
  await markPassed(sessionId);
  await audit({
    actor: who,
    category: "auth",
    action: "second_factor.passed",
    resourceType: "user",
    resourceId: who.userId,
    reason: result.method,
  });
  return { ok: true };
}

/**
 * Review fix: a back office member's first app only after the emailed code
 * proved this session (`lib/auth/enrolment-proof.ts`). A clinician's optional
 * app is gated by their password in the settings action instead.
 */
async function proofMissing(who: Who, sessionId: string): Promise<boolean> {
  if (!(BACK_OFFICE_ROLES as readonly string[]).includes(who.role)) return false;
  const { enrolmentProven } = await import("./enrolment-proof");
  return !(await enrolmentProven(who.userId, sessionId));
}

export async function beginEnrolment(who: Who, sessionId: string): Promise<StepResult> {
  if (await proofMissing(who, sessionId)) return { ok: false, error: "asec.proveFirst" };
  return startFactor({ kind: "user", id: who.userId });
}

export async function pendingEnrolment(who: Who, sessionId: string): Promise<PendingEnrolment | null> {
  if (await proofMissing(who, sessionId)) return null;
  return pendingFactor({ kind: "user", id: who.userId }, who.email);
}

/**
 * The first code from the app turns it on, returns ten recovery codes once,
 * and counts as this session's second step.
 */
export async function confirmEnrolment(
  who: Who,
  sessionId: string,
  typed: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: MessageKey }> {
  if (await proofMissing(who, sessionId)) {
    await failed(who, "enrolment", "not proved by email");
    return { ok: false, error: "asec.proveFirst" };
  }
  const result = await confirmFactorCode({ kind: "user", id: who.userId }, typed);
  if (!result.ok) {
    await failed(who, "enrolment", result.reason);
    return { ok: false, error: result.error };
  }
  await markPassed(sessionId);
  await audit({
    actor: who,
    category: "auth",
    action: "second_factor.enrolled",
    resourceType: "user",
    resourceId: who.userId,
    reason: "authenticator app, 10 recovery codes",
  });
  return result;
}

/**
 * DD-2 B2.4: a clinician turns their own app off, with a code from it, so a
 * stolen session alone cannot remove it. Back office members cannot: theirs is
 * required, and only an owner's reset clears it.
 */
export async function removeOwnFactor(who: Who, typed: string): Promise<StepResult> {
  if ((BACK_OFFICE_ROLES as readonly string[]).includes(who.role)) return { ok: false, error: "asec.already" };
  const check = await checkFactor({ kind: "user", id: who.userId }, typed);
  if (!check.ok) {
    await failed(who, check.method, check.reason);
    return { ok: false, error: check.error };
  }
  await removeFactor({ kind: "user", id: who.userId });
  await audit({
    actor: who,
    category: "auth",
    action: "second_factor.removed",
    resourceType: "user",
    resourceId: who.userId,
    reason: check.method,
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Reset, by an owner, never of themselves                            */
/* ------------------------------------------------------------------ */

/**
 * 🔴 A super_admin clears another back office member's app and recovery
 * codes, and every session of theirs has to pass the step again: from DD-2
 * B2.3 that means enrolling a new app on the second step page.
 *
 * Never their own. An owner who could reset their own second step would need
 * only a password to do it. Another owner resets it, or, for a sole owner, the
 * audited break glass `npm run factor:reset` (scripts/reset-second-factor.ts).
 *
 * The role is asked again here, not only by the action's guard: a second
 * caller of this function tomorrow does not inherit a guard it did not write.
 */
export async function resetSecondFactor(
  actor: Pick<Actor, "userId" | "organizationId" | "role">,
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: MessageKey }> {
  if (actor.role !== "super_admin") return { ok: false, error: "ateam.errNotChangeable" };

  if (targetUserId === actor.userId) {
    await audit({
      actor,
      category: "admin",
      action: "second_factor.reset_refused",
      resourceType: "user",
      resourceId: targetUserId,
      reason: "own second step",
    });
    return { ok: false, error: "ateam.errOwn2fa" };
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.id, targetUserId), inArray(users.role, [...BACK_OFFICE_ROLES]), isNull(users.deletedAt)),
    )
    .limit(1);
  if (!target) return { ok: false, error: "ateam.errNotChangeable" };

  await db.transaction(async (tx) => {
    await tx.delete(staffSecondFactors).where(eq(staffSecondFactors.userId, targetUserId));
    await tx.delete(staffRecoveryCodes).where(eq(staffRecoveryCodes.userId, targetUserId));
    await tx.delete(staffEmailCodes).where(eq(staffEmailCodes.userId, targetUserId));
    /* Every live session of theirs owes the step again, from now. */
    await tx
      .update(authSessions)
      .set({ secondFactorAt: null })
      .where(and(eq(authSessions.userId, targetUserId), isNull(authSessions.revokedAt)));
  });

  /*
   * The success row is written by the caller, `resetMemberSecondFactor` in
   * `app/(admin)/admin/team/actions.ts`, beside every other act on the team.
   */
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  Reset of a clinician's, clinic manager's or partner user's app      */
/* ------------------------------------------------------------------ */

/**
 * Review fix: the optional app's support reset. A super_admin or a manager in
 * the console names the account by its email; the app and its recovery codes
 * are cleared and the next sign-in is a password again, until they enrol a
 * new one. Every attempt is an audit row, found or not.
 */
export async function resetAccountFactor(
  actor: Pick<Actor, "userId" | "organizationId" | "role">,
  target: FactorResetTarget,
  email: string,
): Promise<{ ok: true } | { ok: false; error: MessageKey }> {
  if (!mayResetAccountFactor(actor.role)) return { ok: false, error: "ateam.errNotChangeable" };
  const address = email.trim().toLowerCase();
  if (!address) return { ok: false, error: "asec.resetNotFound" };

  let owner: FactorOwner | null = null;
  if (target === "clinician") {
    const [row] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${address}`, isNull(users.deletedAt)))
      .limit(1);
    /* Never a back office member: theirs is required, and Team resets it. */
    if (row && !(BACK_OFFICE_ROLES as readonly string[]).includes(row.role)) owner = { kind: "user", id: row.id };
  } else if (target === "clinic") {
    const [row] = await db
      .select({ id: clinicManagers.id })
      .from(clinicManagers)
      .where(sql`lower(${clinicManagers.email}) = ${address}`)
      .limit(1);
    if (row) owner = { kind: "clinic", id: row.id };
  } else {
    const [row] = await db
      .select({ id: partnerUsers.id })
      .from(partnerUsers)
      .where(and(sql`lower(${partnerUsers.email}) = ${address}`, isNull(partnerUsers.deletedAt)))
      .limit(1);
    if (row) owner = { kind: "partner", id: row.id };
  }

  const resourceType = target === "clinician" ? "user" : target === "clinic" ? "clinic_manager" : "partner_user";
  if (!owner) {
    await audit({
      actor,
      category: "admin",
      action: "second_factor.reset_refused",
      resourceType,
      reason: `${target}: no such account`,
    });
    return { ok: false, error: "asec.resetNotFound" };
  }

  await removeFactor(owner);
  if (owner.kind === "user") await db.delete(staffEmailCodes).where(eq(staffEmailCodes.userId, owner.id));
  await audit({
    actor,
    category: "admin",
    action: "second_factor.reset",
    resourceType,
    resourceId: owner.id,
    reason: `${target} app reset from the console`,
  });
  return { ok: true };
}
