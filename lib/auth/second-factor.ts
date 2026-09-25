/*
 * 🔴 30.1: the CONTROL PLANE, the second step belongs to signing in, which resolves the region.
 */
import "server-only";

import { and, count, eq, gt, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret, secretsConfigured } from "@/lib/crypto/secretbox";
import { controlDb as db } from "@/lib/db";
import {
  authSessions,
  BACK_OFFICE_ROLES,
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
  EMAIL_CODE_MINUTES,
  hashEmailCode,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  newEmailCode,
  newRecoveryCodes,
  newTotpSecret,
  otpauthUri,
  verifyTotp,
} from "./totp";

/**
 * 🔴 TASK 40: THE BACK OFFICE'S SECOND STEP, THE HALF THAT STORES THINGS.
 *
 * The rule itself (who must, for how long, what a code is) is pure and lives
 * in `lib/auth/totp.ts`. This file holds the four things that touch rows:
 * the authenticator secret, sealed; the recovery codes, hashed; the emailed
 * codes, hashed and bound to one session; and the time on the session that
 * says the step was passed.
 *
 * 🔴 Nothing here logs a secret, a code or a recovery code. The log lines
 * carry a short user reference and an outcome, and the audit rows carry the
 * outcome and the method. A code in a log drain is a code anybody with the
 * drain can type.
 *
 * Every enrolment, every reset and every failed attempt is an audit row, which
 * is what a regulator or a founder asks for the morning after a payout that
 * nobody remembers approving.
 */

const ISSUER = "24Therapy";

/** Six digit guesses per member, across every method, per window. */
const VERIFY_LIMIT = 10;
const VERIFY_WINDOW_SECONDS = 15 * 60;
/** Emails per member per window: enough for a slow inbox, not enough to flood one. */
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_SECONDS = 10 * 60;

type Who = Pick<Actor, "userId" | "organizationId" | "email" | "role">;

export type StepResult = { ok: true } | { ok: false; error: MessageKey };

/* ------------------------------------------------------------------ */
/*  What is enrolled                                                   */
/* ------------------------------------------------------------------ */

export type SecondFactorStatus = {
  /** A confirmed authenticator. Only this retires the email fallback. */
  enrolled: boolean;
  confirmedAt: Date | null;
  recoveryLeft: number;
};

export async function secondFactorStatus(userId: string): Promise<SecondFactorStatus> {
  const [row] = await db
    .select({ confirmedAt: staffSecondFactors.confirmedAt })
    .from(staffSecondFactors)
    .where(eq(staffSecondFactors.userId, userId))
    .limit(1);

  const confirmedAt = row?.confirmedAt ?? null;
  if (!confirmedAt) return { enrolled: false, confirmedAt: null, recoveryLeft: 0 };

  const [left] = await db
    .select({ n: count() })
    .from(staffRecoveryCodes)
    .where(and(eq(staffRecoveryCodes.userId, userId), isNull(staffRecoveryCodes.usedAt)));
  return { enrolled: true, confirmedAt, recoveryLeft: Number(left?.n ?? 0) };
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

/** Whether this server can seal a secret at all. Asked before offering enrolment. */
export function enrolmentAvailable(): boolean {
  return secretsConfigured();
}

/* ------------------------------------------------------------------ */
/*  Passing the step                                                   */
/* ------------------------------------------------------------------ */

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

async function withinLimit(who: Who): Promise<boolean> {
  const verdict = await consume(
    subjectKey("staff-2fa-verify", who.userId),
    VERIFY_LIMIT,
    VERIFY_WINDOW_SECONDS,
  );
  return verdict.allowed;
}

/**
 * Check what a pending session typed, and on success record the time on it.
 *
 * With an app enrolled: six digits from the app, or a recovery code. Without
 * one: the six digits emailed to this session. Never the email code once an
 * app exists, because the point of enrolling is that the inbox stops being a
 * way in.
 */
export async function passSecondStep(who: Who, sessionId: string, typed: string): Promise<StepResult> {
  if (!(await withinLimit(who))) {
    await failed(who, "any", "rate limited");
    return { ok: false, error: "tauth.secondTooMany" };
  }

  const status = await secondFactorStatus(who.userId);
  let method: "app" | "recovery" | "email";
  let passed = false;
  let reason = "wrong";

  if (status.enrolled && looksLikeRecoveryCode(typed)) {
    method = "recovery";
    /*
     * 🔴 ONE STATEMENT SPENDS IT. `used_at IS NULL` is in the WHERE, so two
     * tabs submitting the same code race to one row and only one gets it back.
     */
    const spent = await db
      .update(staffRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(staffRecoveryCodes.userId, who.userId),
          eq(staffRecoveryCodes.codeHash, hashRecoveryCode(typed)),
          isNull(staffRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: staffRecoveryCodes.id });
    passed = spent.length === 1;
  } else if (status.enrolled) {
    method = "app";
    const verdict = await checkApp(who.userId, typed);
    passed = verdict.ok;
    if (!verdict.ok) reason = verdict.reason;
  } else {
    method = "email";
    const digits = typed.replace(/\D/g, "");
    const spent = await db
      .update(staffEmailCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(staffEmailCodes.userId, who.userId),
          eq(staffEmailCodes.sessionId, sessionId),
          eq(staffEmailCodes.codeHash, hashEmailCode(digits)),
          isNull(staffEmailCodes.usedAt),
          gt(staffEmailCodes.expiresAt, new Date()),
        ),
      )
      .returning({ id: staffEmailCodes.id });
    passed = digits.length === 6 && spent.length === 1;
  }

  if (!passed) {
    await failed(who, method, reason);
    return { ok: false, error: "tauth.secondWrong" };
  }

  await markPassed(sessionId);
  await audit({
    actor: who,
    category: "auth",
    action: "second_factor.passed",
    resourceType: "user",
    resourceId: who.userId,
    reason: method,
  });
  return { ok: true };
}

/**
 * The app's six digits, with the replay rule held by the database.
 *
 * `verifyTotp` refuses a step at or before `last_step`, and the UPDATE below
 * only moves `last_step` forward, so two requests with the same code cannot
 * both pass even if they read the row at the same moment.
 */
async function checkApp(
  userId: string,
  typed: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [row] = await db
    .select({ sealed: staffSecondFactors.secretSealed, lastStep: staffSecondFactors.lastStep })
    .from(staffSecondFactors)
    .where(eq(staffSecondFactors.userId, userId))
    .limit(1);
  if (!row) return { ok: false, reason: "not enrolled" };

  let secret: Buffer;
  try {
    secret = Buffer.from(decryptSecret(row.sealed), "base64");
  } catch (error) {
    // The reason, never the value. A key rotated without re-enrolment lands here.
    log.error("staff second factor could not be opened", { user: ref(userId), reason: safeErrorMessage(error) });
    return { ok: false, reason: "secret unreadable" };
  }

  const verdict = verifyTotp(secret, typed, Date.now(), row.lastStep);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  const moved = await db
    .update(staffSecondFactors)
    .set({ lastStep: verdict.step, updatedAt: new Date() })
    .where(
      and(
        eq(staffSecondFactors.userId, userId),
        or(isNull(staffSecondFactors.lastStep), lt(staffSecondFactors.lastStep, verdict.step)),
      ),
    )
    .returning({ userId: staffSecondFactors.userId });
  return moved.length === 1 ? { ok: true } : { ok: false, reason: "replayed" };
}

/**
 * Email six digits to the member's own address, for this session only.
 *
 * Refused once an app is enrolled. Rate limited per member with the same
 * `consume` every door uses, so a pending session cannot turn somebody's
 * inbox into a stream of codes.
 */
export async function emailSecondStepCode(who: Who, sessionId: string): Promise<StepResult> {
  const status = await secondFactorStatus(who.userId);
  if (status.enrolled) return { ok: false, error: "tauth.secondUseApp" };

  const verdict = await consume(subjectKey("staff-2fa-email", who.userId), EMAIL_LIMIT, EMAIL_WINDOW_SECONDS);
  if (!verdict.allowed) return { ok: false, error: "tauth.secondTooMany" };

  const code = newEmailCode();
  await db.insert(staffEmailCodes).values({
    userId: who.userId,
    sessionId,
    codeHash: hashEmailCode(code),
    expiresAt: new Date(Date.now() + EMAIL_CODE_MINUTES * 60_000),
  });

  const { notify } = await import("@/lib/notify");
  const delivery = await notify(
    { email: who.email, phone: null, prefers: "email", organizationId: who.organizationId },
    {
      kind: "staff.second_factor_code",
      subject: "Your 24Therapy console code",
      body: `${code} is your code to finish signing in to the 24Therapy console. It works once, for ${EMAIL_CODE_MINUTES} minutes. If you did not just sign in, tell the owner today: somebody has your password.`,
    },
  );

  log.info("staff second step code sent", { user: ref(who.userId), delivered: delivery.sent });
  return delivery.sent ? { ok: true } : { ok: false, error: "tauth.secondSendFailed" };
}

/* ------------------------------------------------------------------ */
/*  Enrolment                                                          */
/* ------------------------------------------------------------------ */

export type PendingEnrolment = { key: string; uri: string };

/**
 * Start, or restart, an enrolment. The secret is sealed before it is written
 * and the row stays unconfirmed until the first code from the app matches, so
 * a QR code scanned into the wrong app changes nothing.
 */
export async function beginEnrolment(who: Who): Promise<StepResult> {
  if (!enrolmentAvailable()) return { ok: false, error: "asec.unavailable" };
  const status = await secondFactorStatus(who.userId);
  if (status.enrolled) return { ok: false, error: "asec.already" };

  const sealed = encryptSecret(newTotpSecret().toString("base64"));
  await db
    .insert(staffSecondFactors)
    .values({ userId: who.userId, secretSealed: sealed })
    .onConflictDoUpdate({
      target: staffSecondFactors.userId,
      set: { secretSealed: sealed, confirmedAt: null, lastStep: null, updatedAt: new Date() },
      /* 🔴 Never over a confirmed one. Replacing a working app is a reset, and a reset is the owner's. */
      setWhere: isNull(staffSecondFactors.confirmedAt),
    });
  return { ok: true };
}

/** The pending enrolment's key and QR payload, for the one page that shows it. */
export async function pendingEnrolment(who: Who): Promise<PendingEnrolment | null> {
  const [row] = await db
    .select({ sealed: staffSecondFactors.secretSealed, confirmedAt: staffSecondFactors.confirmedAt })
    .from(staffSecondFactors)
    .where(eq(staffSecondFactors.userId, who.userId))
    .limit(1);
  if (!row || row.confirmedAt) return null;

  const secret = Buffer.from(decryptSecret(row.sealed), "base64");
  return {
    key: base32Encode(secret).replace(/(.{4})/g, "$1 ").trim(),
    uri: otpauthUri({ secret, account: who.email, issuer: ISSUER }),
  };
}

/**
 * The first code from the app turns it on, and returns ten recovery codes,
 * once. Only their hashes are kept, so this is the only moment they exist in
 * a form anybody can read.
 */
export async function confirmEnrolment(
  who: Who,
  sessionId: string,
  typed: string,
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; error: MessageKey }> {
  if (!(await withinLimit(who))) {
    await failed(who, "enrolment", "rate limited");
    return { ok: false, error: "tauth.secondTooMany" };
  }

  const [row] = await db
    .select({ sealed: staffSecondFactors.secretSealed, confirmedAt: staffSecondFactors.confirmedAt })
    .from(staffSecondFactors)
    .where(eq(staffSecondFactors.userId, who.userId))
    .limit(1);
  if (!row) return { ok: false, error: "asec.startAgain" };
  if (row.confirmedAt) return { ok: false, error: "asec.already" };

  const secret = Buffer.from(decryptSecret(row.sealed), "base64");
  const verdict = verifyTotp(secret, typed, Date.now(), null);
  if (!verdict.ok) {
    await failed(who, "enrolment", verdict.reason);
    return { ok: false, error: "tauth.secondWrong" };
  }

  const codes = newRecoveryCodes();
  const confirmed = await db.transaction(async (tx) => {
    const done = await tx
      .update(staffSecondFactors)
      .set({ confirmedAt: new Date(), lastStep: verdict.step, updatedAt: new Date() })
      .where(and(eq(staffSecondFactors.userId, who.userId), isNull(staffSecondFactors.confirmedAt)))
      .returning({ userId: staffSecondFactors.userId });
    if (done.length !== 1) return false;
    await tx.delete(staffRecoveryCodes).where(eq(staffRecoveryCodes.userId, who.userId));
    await tx
      .insert(staffRecoveryCodes)
      .values(codes.map((code) => ({ userId: who.userId, codeHash: hashRecoveryCode(code) })));
    return true;
  });
  if (!confirmed) return { ok: false, error: "asec.already" };

  /* The app is proof of the step as well, so the session is fresh from now. */
  await markPassed(sessionId);
  await audit({
    actor: who,
    category: "auth",
    action: "second_factor.enrolled",
    resourceType: "user",
    resourceId: who.userId,
    reason: "authenticator app, 10 recovery codes",
  });
  return { ok: true, recoveryCodes: codes };
}

/* ------------------------------------------------------------------ */
/*  Reset, by an owner, never of themselves                            */
/* ------------------------------------------------------------------ */

/**
 * 🔴 A super_admin clears another back office member's app and recovery
 * codes, and every session of theirs has to pass the step again, by email,
 * until they enrol a new one.
 *
 * Never their own. An owner who could reset their own second step would need
 * only a password to do it, and a password alone is what this whole change
 * exists to stop being enough. Another owner resets it, or the database does.
 *
 * The role is asked again here, not only by the action's guard, for the same
 * reason `lib/data/payroll.ts` asks: a second caller of this function tomorrow
 * does not inherit a guard it did not write.
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
   * `app/(admin)/admin/team/actions.ts`, beside every other act on the team,
   * which `tests/account-links.test.ts` holds. The refusal above is written
   * here because it is this function's rule that refused.
   */
  return { ok: true };
}
