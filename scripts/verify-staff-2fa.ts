/**
 * Task 40: the back office's second step, against the dev database.
 *
 *   npm run verify:staff-2fa
 *
 * ## 🔴 WHAT THIS PROVES, AND THROUGH WHICH CODE
 *
 * An admin page or action runs `requireStaff`, `requireRole`, `requireManager`
 * or `requireElevated`, and every one of those runs `requireUser`, which asks
 * `admission(getSessionState())`. A script has no request and no cookie, so it
 * cannot call the guard itself; what it CAN do is resolve a real session row
 * with `sessionStateForToken` (the function `getSessionState` calls with the
 * cookie's value) and put it through `admission` (the function `requireUser`
 * and `requireRole` decide with). Neither is a copy. The source checks at the
 * end hold the wiring between them and the guards.
 *
 * Then it walks the step itself, with real rows: an emailed code, the twelve
 * hour limit, enrolment with a sealed secret, a replayed code refused, a
 * recovery code spent once, and the reset rule. Fixture people are created on
 * example.com and deleted at the end, whatever happened.
 *
 * Refuses production (`writesTo`).
 */
import { createHash, randomBytes } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import type { Role } from "../lib/db/schema";
import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

/*
 * `lib/crypto/secretbox.ts` reads its key live and fails closed without one,
 * which is right for a server and means a dev machine with no key could not
 * enrol anybody. A throwaway key for this process only, as `verify:w2x` does;
 * nothing sealed with it outlives the fixtures.
 */
process.env.TOKEN_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  // `admission` lives beside the session, not in guard.ts, because guard.ts loads next/navigation.
  const { admission, sessionStateForToken } = await import("../lib/auth/session");
  const sf = await import("../lib/auth/second-factor");
  const totp = await import("../lib/auth/totp");

  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, "24therapy"))
    .limit(1);
  const orgId = required(org, "the platform organisation (slug 24therapy)").id;

  const tag = randomBytes(4).toString("hex");
  const people: string[] = [];

  async function person(role: Role, name: string): Promise<string> {
    const [row] = await db
      .insert(schema.users)
      .values({
        organizationId: orgId,
        email: `verify-2fa-${name}-${tag}@example.com`,
        passwordHash: "unusable",
        firstName: "Verify",
        lastName: name,
        role,
      })
      .returning({ id: schema.users.id });
    people.push(row!.id);
    return row!.id;
  }

  async function signIn(userId: string): Promise<{ token: string; sessionId: string }> {
    const token = randomBytes(32).toString("base64url");
    const [row] = await db
      .insert(schema.authSessions)
      .values({
        userId,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        absoluteExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      })
      .returning({ id: schema.authSessions.id });
    return { token, sessionId: row!.id };
  }

  async function audited(userId: string, action: string): Promise<number> {
    const rows = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.resourceId, userId), eq(schema.auditLog.action, action)));
    return rows.length;
  }

  const ADMIN = [...schema.BACK_OFFICE_ROLES];

  try {
    const staff = await person("staff", "staff");
    const owner = await person("super_admin", "owner");
    const owner2 = await person("super_admin", "owner2");
    const clinician = await person("therapist", "clinician");

    /* ============================================================ */
    /*  🔴 Refused before the second step, admitted after            */
    /* ============================================================ */

    const s1 = await signIn(staff);
    let state = await sessionStateForToken(s1.token);
    check(
      "🔴 a staff session with only a password is PENDING, and an admin page or action is refused",
      state?.pendingSecondFactor === true && admission(state, ADMIN) === "second_step",
      `admission ${admission(state, ADMIN)}`,
    );
    check(
      "🔴 ...and so is the owner's, and a plain requireUser read",
      admission(await sessionStateForToken((await signIn(owner)).token), ["super_admin"]) === "second_step" &&
        admission(state) === "second_step",
    );

    const c1 = await signIn(clinician);
    const clinicianState = await sessionStateForToken(c1.token);
    check(
      "clinicians are unaffected: a password is still the whole of it",
      clinicianState?.pendingSecondFactor === false && admission(clinicianState, ["therapist"]) === "admit",
    );

    /* The email fallback, with a code this script knows. */
    const sent = await sf.emailSecondStepCode(state!.actor, s1.sessionId);
    const issued = await db
      .select({ sessionId: schema.staffEmailCodes.sessionId, hash: schema.staffEmailCodes.codeHash, expires: schema.staffEmailCodes.expiresAt })
      .from(schema.staffEmailCodes)
      .where(eq(schema.staffEmailCodes.userId, staff));
    check(
      "asking for an email code writes one hashed row, bound to this session, for ten minutes",
      issued.length === 1 &&
        issued[0]!.sessionId === s1.sessionId &&
        /^[0-9a-f]{64}$/.test(issued[0]!.hash) &&
        Math.abs(issued[0]!.expires.getTime() - Date.now() - 10 * 60_000) < 60_000,
      `delivered on this machine: ${sent.ok ? "yes" : "no (no mail provider on dev)"}`,
    );

    const known = "314159";
    await db.insert(schema.staffEmailCodes).values({
      userId: staff,
      sessionId: s1.sessionId,
      codeHash: totp.hashEmailCode(known),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    const wrong = await sf.passSecondStep(state!.actor, s1.sessionId, "000000");
    check(
      "a wrong code is refused, and the failure is an audit row",
      !wrong.ok && (await audited(staff, "second_factor.failed")) === 1,
    );

    const right = await sf.passSecondStep(state!.actor, s1.sessionId, known);
    state = await sessionStateForToken(s1.token);
    check(
      "🔴 the right code passes: the time is on the session, and the same admin action is admitted",
      right.ok && state?.secondFactorAt instanceof Date && admission(state, ADMIN) === "admit",
      `admission ${admission(state, ADMIN)}`,
    );

    const s1b = await signIn(staff);
    const again = await sf.passSecondStep(state!.actor, s1b.sessionId, known);
    check("an emailed code works once, and only for the session that asked", !again.ok);

    await db
      .update(schema.authSessions)
      .set({ secondFactorAt: new Date(Date.now() - 12 * 60 * 60 * 1000 - 60_000) })
      .where(eq(schema.authSessions.id, s1.sessionId));
    state = await sessionStateForToken(s1.token);
    check(
      "🔴 twelve hours after the step, it is asked for again",
      state?.pendingSecondFactor === true && admission(state, ADMIN) === "second_step",
    );
    await db.update(schema.authSessions).set({ secondFactorAt: new Date() }).where(eq(schema.authSessions.id, s1.sessionId));

    /* ============================================================ */
    /*  Enrolment, sealed, with ten recovery codes                  */
    /* ============================================================ */

    const who = (await sessionStateForToken(s1.token))!.actor;
    await sf.beginEnrolment(who);
    const pending = required(await sf.pendingEnrolment(who), "a pending enrolment");
    const [stored] = await db
      .select()
      .from(schema.staffSecondFactors)
      .where(eq(schema.staffSecondFactors.userId, staff));
    const plainKey = pending.key.replace(/\s/g, "");
    const secret = totp.base32Decode(plainKey);
    check(
      "🔴 the TOTP secret is stored sealed: neither its base32 nor its base64 is in the row",
      Boolean(stored) &&
        stored!.confirmedAt === null &&
        !stored!.secretSealed.includes(plainKey) &&
        !stored!.secretSealed.includes(secret.toString("base64")) &&
        stored!.secretSealed.startsWith("v1."),
    );
    check("the QR payload is an otpauth URI with SHA1, 6 digits, 30 seconds", /^otpauth:\/\/totp\/.*algorithm=SHA1&digits=6&period=30$/.test(pending.uri));

    const now = Date.now();
    const enrolCode = totp.totpAt(secret, now);
    const enrolled = await sf.confirmEnrolment(who, s1.sessionId, enrolCode);
    const codes = enrolled.ok ? enrolled.recoveryCodes : [];
    const hashes = await db
      .select({ hash: schema.staffRecoveryCodes.codeHash })
      .from(schema.staffRecoveryCodes)
      .where(eq(schema.staffRecoveryCodes.userId, staff));
    check(
      "the first code turns it on and returns ten recovery codes, stored only as hashes",
      enrolled.ok &&
        codes.length === 10 &&
        hashes.length === 10 &&
        hashes.every((row) => !codes.some((code) => row.hash.includes(totp.normaliseRecoveryCode(code)))),
    );
    check("the enrolment is an audit row", (await audited(staff, "second_factor.enrolled")) === 1);

    const fallback = await sf.emailSecondStepCode(who, s1.sessionId);
    check("once an app is enrolled the email fallback is refused", !fallback.ok && fallback.error === "tauth.secondUseApp");

    const s2 = await signIn(staff);
    const replay = await sf.passSecondStep(who, s2.sessionId, enrolCode);
    check("🔴 the enrolment's own code, replayed at the next sign-in, is refused", !replay.ok);

    const nextCode = totp.hotp(secret, totp.stepAt(now) + 1);
    const fresh = await sf.passSecondStep(who, s2.sessionId, nextCode);
    check(
      "the next step's code passes (inside the ±1 window)",
      fresh.ok && admission(await sessionStateForToken(s2.token), ADMIN) === "admit",
    );

    const s3 = await signIn(staff);
    const replay2 = await sf.passSecondStep(who, s3.sessionId, nextCode);
    check("🔴 and that code, replayed on another session, is refused too", !replay2.ok);

    const recovery = await sf.passSecondStep(who, s3.sessionId, codes[0]!);
    const s4 = await signIn(staff);
    const recoveryAgain = await sf.passSecondStep(who, s4.sessionId, codes[0]!);
    check(
      "🔴 a recovery code passes once and is refused the second time",
      recovery.ok && !recoveryAgain.ok && (await sf.secondFactorStatus(staff)).recoveryLeft === 9,
    );

    /* ============================================================ */
    /*  🔴 The reset rule                                           */
    /* ============================================================ */

    const ownerActor = { userId: owner, organizationId: orgId, role: "super_admin" as const };
    const own = await sf.resetSecondFactor(ownerActor, owner);
    check(
      "🔴 a super_admin cannot reset their OWN second step, and the refusal is written down",
      !own.ok && own.error === "ateam.errOwn2fa" && (await audited(owner, "second_factor.reset_refused")) === 1,
    );

    const byStaff = await sf.resetSecondFactor({ userId: staff, organizationId: orgId, role: "staff" }, owner);
    check("staff cannot reset anybody's", !byStaff.ok);

    const onClinician = await sf.resetSecondFactor(ownerActor, clinician);
    check("a clinician has no second step to reset", !onClinician.ok);

    const reset = await sf.resetSecondFactor(ownerActor, staff);
    const after = await sf.secondFactorStatus(staff);
    const leftCodes = await db.select().from(schema.staffRecoveryCodes).where(eq(schema.staffRecoveryCodes.userId, staff));
    check(
      "🔴 a super_admin resets another member: app and codes gone, every live session pending again",
      reset.ok &&
        !after.enrolled &&
        leftCodes.length === 0 &&
        admission(await sessionStateForToken(s2.token), ADMIN) === "second_step",
    );
    /* The success row is the action's, beside every other act on the team (tests/account-links). */
    const teamActions = readSource("app/(admin)/admin/team/actions.ts");
    const resetAction = teamActions.slice(teamActions.indexOf("export async function resetMemberSecondFactor("));
    check(
      "...and the reset action is the owner's and writes the audit row",
      /await requireRole\("super_admin"\)/.test(resetAction.slice(0, resetAction.indexOf("\n}\n"))) &&
        /action: "second_factor\.reset"/.test(resetAction.slice(0, resetAction.indexOf("\n}\n"))),
    );

    const coOwner = await sf.resetSecondFactor({ userId: owner2, organizationId: orgId, role: "super_admin" }, owner);
    check("another owner may reset an owner's (a lost phone is not a role change)", coOwner.ok);

    /* ============================================================ */
    /*  The wiring, read from source                                */
    /* ============================================================ */

    const guard = readSource("lib/auth/guard.ts");
    const body = (name: string) => {
      const from = guard.indexOf(`export async function ${name}(`);
      return guard.slice(from, guard.indexOf("\n}\n", from));
    };
    check(
      "🔴 requireUser sends a pending session to the second step",
      /admission\(state\)/.test(body("requireUser")) && /toSecondStep\(\)/.test(body("requireUser")),
    );
    check(
      "🔴 every admin guard goes through requireUser",
      /requireUser\(\)/.test(body("requireRole")) &&
        /requireRole\(/.test(body("requireStaff")) &&
        /requireRole\(/.test(body("requireManager")) &&
        /requireRole\("super_admin"\)/.test(readSource("lib/console/gate.ts")),
    );
    check("an API caller owing the step gets a 401", /pendingSecondFactor\) throw/.test(body("requireUserApi")));
    check(
      "🔴 getActor itself is null for a pending session, so routes that read with it are closed too",
      /!state\.pendingSecondFactor \? state\.actor : null/.test(readSource("lib/auth/session.ts")),
    );
    check("the admin shell asks requireStaff", /await requireStaff\(\)/.test(readSource("app/(admin)/layout.tsx")));
    check(
      "nothing in the second step logs a code or a secret",
      !/log\.[a-z]+\([^)]*\b(code|secret|sealed|recoveryCodes)\b\s*[,})]/.test(readSource("lib/auth/second-factor.ts")),
    );
  } finally {
    if (people.length > 0) await db.delete(schema.users).where(inArray(schema.users.id, people));
    console.log(`\n  (removed ${people.length} fixture people)`);
  }

  finish("verify:staff-2fa");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
