import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { patientAccounts, patientAuthSessions, people } from "@/lib/db/schema";
import { env } from "@/lib/env";

/**
 * A patient's session. Mirrors `lib/auth/session.ts`, deliberately.
 *
 * ## A different cookie, and why that is the point
 *
 * `24t_patient` rather than `24t_session`. One cookie for both would mean the
 * two `getActor` functions read the same value and each has to decide whether
 * it belongs to them — and the failure mode of getting that wrong is a patient
 * token resolving to a clinician actor. Two names make the question
 * unaskable.
 *
 * A clinician and a patient can also be signed in in the same browser at once,
 * which is not exotic: a therapist testing their own patient-facing view is the
 * first thing anybody does.
 *
 * ## A shorter window
 *
 * Four hours idle rather than two, and seven days absolute rather than twelve
 * hours. The clinician limits exist because a clinical workstation is a HIPAA
 * safeguard problem — an unattended screen with somebody else's chart on it.
 * A patient's own phone showing their own record is a different risk, and
 * logging a person out of their own homework every two hours is how they stop
 * opening it.
 */
/*
 * One definition, shared with the middleware. Two constants with the same
 * string in two files is a rename away from a patient who can sign in and then
 * cannot reach a single page.
 */
export { PATIENT_COOKIE } from "@/lib/routing";
import { PATIENT_COOKIE } from "@/lib/routing";

const IDLE_MS = 4 * 60 * 60 * 1000;
const ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;
const TOUCH_THROTTLE_MS = 60 * 1000;

/**
 * Who the patient is.
 *
 * Deliberately **not** an `Actor`, and deliberately without an
 * `organizationId`. A patient is not a member of an organisation, and giving
 * this the same shape as a clinician's actor is how a patient ends up passed to
 * a function that scopes by org — see C41.
 */
export type PatientActor = {
  accountId: string;
  personId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPatientSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hdrs = await headers();

  await db.insert(patientAuthSessions).values({
    patientAccountId: accountId,
    tokenHash: hashToken(token),
    absoluteExpiresAt: new Date(Date.now() + ABSOLUTE_MS),
    userAgent: hdrs.get("user-agent")?.slice(0, 300) ?? null,
  });

  const store = await cookies();
  store.set(PATIENT_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });

  return token;
}

/**
 * Resolve the cookie to an account, or null.
 *
 * Every condition is in the WHERE clause rather than checked afterwards: a
 * revoked session, an expired one and an idle one all simply fail to match, so
 * there is no branch that can be forgotten. The join to `people` is what makes
 * a patient actor useful at all — the account is a login, the person is who
 * they are.
 */
export async function getPatientActor(): Promise<PatientActor | null> {
  const store = await cookies();
  const token = store.get(PATIENT_COOKIE)?.value;
  if (!token) return null;

  const now = new Date();
  const [row] = await db
    .select({
      sessionId: patientAuthSessions.id,
      lastSeenAt: patientAuthSessions.lastSeenAt,
      accountId: patientAccounts.id,
      personId: patientAccounts.personId,
      email: patientAccounts.email,
      emailVerifiedAt: patientAccounts.emailVerifiedAt,
      firstName: people.firstName,
      lastName: people.lastName,
    })
    .from(patientAuthSessions)
    .innerJoin(patientAccounts, eq(patientAccounts.id, patientAuthSessions.patientAccountId))
    .innerJoin(people, eq(people.id, patientAccounts.personId))
    .where(
      and(
        eq(patientAuthSessions.tokenHash, hashToken(token)),
        isNull(patientAuthSessions.revokedAt),
        isNull(patientAccounts.deletedAt),
        gt(patientAuthSessions.absoluteExpiresAt, now),
        gt(patientAuthSessions.lastSeenAt, new Date(now.getTime() - IDLE_MS)),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Throttled: bumping `last_seen_at` on every request is a write per page view
  // for no benefit.
  if (now.getTime() - row.lastSeenAt.getTime() > TOUCH_THROTTLE_MS) {
    await db
      .update(patientAuthSessions)
      .set({ lastSeenAt: now })
      .where(eq(patientAuthSessions.id, row.sessionId));
  }

  return {
    accountId: row.accountId,
    personId: row.personId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    emailVerified: row.emailVerifiedAt !== null,
  };
}

export async function destroyPatientSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(PATIENT_COOKIE)?.value;
  if (token) {
    await db
      .update(patientAuthSessions)
      .set({ revokedAt: new Date() })
      .where(eq(patientAuthSessions.tokenHash, hashToken(token)));
  }
  store.delete(PATIENT_COOKIE);
}

/** Sign a patient out everywhere — used on password reset. */
export async function revokeAllPatientSessions(accountId: string): Promise<void> {
  await db
    .update(patientAuthSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(patientAuthSessions.patientAccountId, accountId),
        isNull(patientAuthSessions.revokedAt),
      ),
    );
}
