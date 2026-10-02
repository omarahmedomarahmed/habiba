/*
 * 🔴 30.1: the CONTROL PLANE, part of signing in.
 */
import "server-only";

import { and, desc, eq, gt, isNotNull, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb as db } from "@/lib/db";
import { clinicManagers, partnerUsers, staffEmailCodes, users } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { consume, subjectKey } from "@/lib/rate-limit";
import { verifyPassword } from "./password";
import type { FactorOwner, StepResult } from "./second-factor";
import type { Actor } from "./session";
import { ENROL_CODE_MINUTES, enrolProofCurrent, hashEnrolCode, newEnrolCode } from "./totp";

/**
 * Review fix (DD-2): proving the person before an authenticator app is
 * enrolled. Without it, whoever had the password could plant their own app.
 *
 * Back office, first app: six digits emailed to the member's own address,
 * bound to this pending session. The code proves the inbox; it is never a way
 * past the second step itself, which is the app or a recovery code only.
 *
 * Clinicians, clinic managers and partner users (optional app): their password
 * typed again on the settings page.
 */

type Who = Pick<Actor, "userId" | "organizationId" | "email" | "role">;

/** Emails per member per window: enough for a slow inbox, not enough to flood one. */
const SEND_LIMIT = 3;
const SEND_WINDOW_SECONDS = 10 * 60;
/** Guesses at the emailed code per member per window. */
const GUESS_LIMIT = 10;
const GUESS_WINDOW_SECONDS = 15 * 60;

export async function sendEnrolmentCode(who: Who, sessionId: string): Promise<StepResult> {
  const verdict = await consume(subjectKey("staff-enrol-email", who.userId), SEND_LIMIT, SEND_WINDOW_SECONDS);
  if (!verdict.allowed) return { ok: false, error: "tauth.secondTooMany" };

  const code = newEnrolCode();
  await db.insert(staffEmailCodes).values({
    userId: who.userId,
    sessionId,
    codeHash: hashEnrolCode(code),
    expiresAt: new Date(Date.now() + ENROL_CODE_MINUTES * 60_000),
  });

  const { getI18n } = await import("@/lib/i18n/server");
  const { t, locale } = await getI18n();
  const { notify } = await import("@/lib/notify");
  const delivery = await notify(
    { email: who.email, phone: null, prefers: "email", organizationId: who.organizationId, locale },
    {
      kind: "staff.second_factor_code",
      subject: t("tauth.enrolMailSubject"),
      body: t("tauth.enrolMailBody", { code, minutes: ENROL_CODE_MINUTES }),
      variables: [code],
    },
  );
  log.info("staff enrolment code sent", { user: ref(who.userId), delivered: delivery.sent });
  return delivery.sent ? { ok: true } : { ok: false, error: "tauth.enrolSendFailed" };
}

/** Spend the emailed code for this session. One statement: `used_at IS NULL` is in the WHERE. */
export async function proveEnrolmentCode(who: Who, sessionId: string, typed: string): Promise<StepResult> {
  const verdict = await consume(subjectKey("staff-enrol-verify", who.userId), GUESS_LIMIT, GUESS_WINDOW_SECONDS);
  if (!verdict.allowed) return { ok: false, error: "tauth.secondTooMany" };
  const digits = typed.replace(/\D/g, "");
  const spent =
    digits.length === 6
      ? await db
          .update(staffEmailCodes)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(staffEmailCodes.userId, who.userId),
              eq(staffEmailCodes.sessionId, sessionId),
              eq(staffEmailCodes.codeHash, hashEnrolCode(digits)),
              isNull(staffEmailCodes.usedAt),
              gt(staffEmailCodes.expiresAt, new Date()),
            ),
          )
          .returning({ id: staffEmailCodes.id })
      : [];
  await audit({
    actor: who,
    category: "auth",
    action: spent.length === 1 ? "second_factor.enrol_proved" : "second_factor.failed",
    resourceType: "user",
    resourceId: who.userId,
    reason: spent.length === 1 ? "emailed code" : "enrolment email code: wrong",
  });
  return spent.length === 1 ? { ok: true } : { ok: false, error: "tauth.secondWrong" };
}

/** Whether this session spent an emailed code recently enough to see and confirm a new app. */
export async function enrolmentProven(userId: string, sessionId: string): Promise<boolean> {
  const [row] = await db
    .select({ usedAt: staffEmailCodes.usedAt })
    .from(staffEmailCodes)
    .where(
      and(
        eq(staffEmailCodes.userId, userId),
        eq(staffEmailCodes.sessionId, sessionId),
        isNotNull(staffEmailCodes.usedAt),
      ),
    )
    .orderBy(desc(staffEmailCodes.usedAt))
    .limit(1);
  return enrolProofCurrent(row?.usedAt ?? null);
}

/** The optional app: the owner's own password, typed again. Rate limited like a guess. */
export async function passwordConfirmed(owner: FactorOwner, password: string): Promise<boolean> {
  const verdict = await consume(subjectKey(`${owner.kind}-enrol-password`, owner.id), GUESS_LIMIT, GUESS_WINDOW_SECONDS);
  if (!verdict.allowed || !password) return false;
  const stored =
    owner.kind === "user"
      ? (await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, owner.id)).limit(1))[0]?.hash
      : owner.kind === "clinic"
        ? (await db
            .select({ hash: clinicManagers.passwordHash })
            .from(clinicManagers)
            .where(eq(clinicManagers.id, owner.id))
            .limit(1))[0]?.hash
        : (await db
            .select({ hash: partnerUsers.passwordHash })
            .from(partnerUsers)
            .where(eq(partnerUsers.id, owner.id))
            .limit(1))[0]?.hash;
  return Boolean(stored) && (await verifyPassword(password, stored!));
}
