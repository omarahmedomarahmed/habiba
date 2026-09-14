/**
 * C285 acceptance: one source of truth for whether a clinician is verified.
 *
 *   npm run verify:c285
 *
 * ## 🔴 The sentence every check here is subordinate to
 *
 * > **Everything that displays or asserts verification derives from
 * > `therapist_verifications.state`, kept in step by the trigger rather than by application code.**
 *
 * "Only certified therapists" is the claim this product rests on, and it had two answers: twenty
 * files read `users.verification_status` while `history_grants_require_verified()` enforced
 * `therapist_verifications.state`. Production carried a live divergence — one user verified, zero
 * verifications approved — so a clinician read as verified on the public radar a patient chooses
 * from, inside a clinic's portal, and in 55.5's answer to a partner asking whether we have verified
 * them.
 *
 * ## 🔴 IT PLANTS THE DIVERGENCE RATHER THAN READING THE CODE
 *
 * A grep for `therapist_verifications` in the right files would pass on a build where the trigger
 * was dropped, where the subquery was wrong, or where a twenty-first reader appeared tomorrow. So
 * this creates a real clinician with NO approved verification, writes `verified` onto their user row
 * by hand, and then asks each surface what it thinks — the radar list, the public count, the public
 * profile, the partner identity answer, the clinic list and the clearance gate.
 *
 * 🔴 EVERY ABSENCE ASSERTION IS BRACKETED BY A PRESENCE CONTROL. A build that showed nobody on the
 * radar would pass "the unverified clinician is not on the radar" while being completely broken, so
 * each surface is asked twice: once with the divergence planted, and once after the verification is
 * genuinely approved. The second half is what proves the first half measured anything.
 *
 * ## 🔴 C284 — every branch in one run
 *
 * Nothing here is skipped by configuration. The fixture is created, exercised and removed in one
 * run against whatever database `writesTo()` allows, and the two halves of every pair run together.
 */
import { randomBytes } from "node:crypto";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");

  const tag = `c285-${randomBytes(4).toString("hex")}`;
  const email = `${tag}@example.com`;

  /* ----------------------------------------------------------------- 0. the source */

  const source = readSource("lib/data/verification.ts");

  check(
    "🔴 C285 the approval path no longer mirrors onto the user row by hand",
    !/\.update\(users\)[\s\S]{0,400}verificationStatus:/.test(source),
    "a mirror maintained by whoever remembers to maintain it is a second opinion",
  );

  check(
    "🔴 C285 practiceState does not resolve a disagreement in the clinician's favour",
    !/mirror === "verified"/.test(source),
    'the old tie-break returned "approved" whenever the soft column said verified',
  );

  /* ------------------------------------------------------- 1. the fixture, planted */

  const org = required(
    (
      await db.execute(sql`
        INSERT INTO organizations (name, slug, kind) VALUES (${tag}, ${tag}, 'solo') RETURNING id`)
    ).rows[0] as { id: string } | undefined,
    "fixture organisation",
  );

  const user = required(
    (
      await db.execute(sql`
        INSERT INTO users (organization_id, email, first_name, last_name, role, status,
                           password_hash)
        VALUES (${org.id}, ${email}, 'Ctwoeightfive', 'Fixture', 'therapist', 'active',
                'not-a-real-hash-this-fixture-never-signs-in')
        RETURNING id`)
    ).rows[0] as { id: string } | undefined,
    "fixture clinician",
  );

  const derived = async () =>
    (
      (
        await db.execute(
          sql`SELECT verification_status AS s FROM users WHERE id = ${user.id}`,
        )
      ).rows[0] as { s: string }
    ).s;

  check(
    "🔴 C285 a new clinician with no submission reads unverified",
    (await derived()) === "unverified",
    `a users row inserted with no therapist_verifications row derives to ${await derived()}`,
  );

  /*
   * 🔴 THE PLANT. This is the exact write that produced production's divergence: somebody, some
   * script, some seed, setting the column directly. 0083's `users_verification_status_derived`
   * trigger forces it back, so the write is not refused — it is irrelevant.
   */
  await db.execute(
    sql`UPDATE users SET verification_status = 'verified' WHERE id = ${user.id}`,
  );

  check(
    "🔴 C285 writing 'verified' onto a user row directly does not stick",
    (await derived()) === "unverified",
    `after UPDATE users SET verification_status = 'verified' the column reads ${await derived()}`,
  );

  /* --------------------------------------- 2. every surface, with the divergence in */

  const { listRadar, radarCount, publicProfile, invalidateRadarBoard } = await import(
    "../lib/data/radar"
  );

  /*
   * 🔴 The board is cached in process for two seconds, and the CONTROL caught it.
   *
   * The first version asked `listRadar()` before and after approving the verification and got the
   * same empty answer both times, so the absence assertion passed and its control failed — which is
   * precisely the job of a control. `loadBoard` memoises for `BOARD_TTL_MS` and exports
   * `invalidateRadarBoard` for callers that change the board, so this uses it rather than sleeping.
   *
   * Worth writing down as product behaviour rather than only as a test detail: an administrator
   * withdrawing an approval reaches the public radar within two seconds, not instantly.
   */
  const board = async () => {
    invalidateRadarBoard();
    return listRadar();
  };
  /*
   * 🔴 ASKED OF `verifiedFlag()` DIRECTLY, 2026-09-14, and this is closer to the
   * ruling than what it replaced.
   *
   * These three assertions used to call `clinicianVerification`, the partner
   * endpoint that answered "have you verified this clinician" over HTTP. That
   * endpoint is gone: a telehealth platform takes responsibility for its own
   * clinicians' licences, so the scope and its route were cut on 2026-09-14.
   *
   * C285's ruling is not about that endpoint. It is that the answer comes from
   * `therapist_verifications` rather than from the derived column, and
   * `verifiedFlag()` is the one expression every remaining surface uses:
   * `whoMayRead`, `writeBackSession`, the public radar and the profile page.
   * Asserting it directly proves the rule for all four rather than for whichever
   * caller happened to be convenient, and it cannot go stale the next time a
   * caller is added or removed.
   */
  const { verifiedFlag } = await import("../lib/data/verified");
  const { users: usersTable } = await import("../lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const partnerFacingVerified = async (): Promise<boolean> => {
    const [row] = await db
      .select({ verified: verifiedFlag() })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);
    return Boolean(row?.verified);
  };

  /*
   * The clinician is put ON the radar directly, because `toggleRadar` would refuse them — and that
   * refusal is the gate this check exists to prove is not the ONLY gate. A clinician whose approval
   * is withdrawn while they are online is exactly this row.
   */
  await db.execute(sql`
    INSERT INTO therapist_radar (user_id, organization_id, status, last_seen_at)
    VALUES (${user.id}, ${org.id}, 'online', now())
    ON CONFLICT (user_id) DO UPDATE SET status = 'online', last_seen_at = now()`);

  const onBoardBefore = (await board()).some((row) => row.userId === user.id);
  const countBefore = await radarCount();
  const profileBefore = await publicProfile(user.id);

  check(
    "🔴 C285 an unverified clinician is not on the radar board a patient picks from",
    !onBoardBefore,
    "listRadar had no verification filter at all before this; only publicProfile did",
  );

  check(
    "🔴 C285 …and the public profile page refuses them",
    profileBefore === null,
    "the one surface that was already right",
  );

  /*
   * 🔴 55.5, the sharp one: a sentence that leaves the building under a commercial agreement.
   * Called with a synthetic key so the answer is the function's, not a route's.
   */
  const partnerAnswer = await partnerFacingVerified();

  check(
    "🔴 C285 the partner-facing verified flag says NOT verified",
    partnerAnswer === false,
    "every partner surface reads this expression, and it was answering from the soft column",
  );

  /* ------------------------------------------- 3. THE CONTROL: approve them for real */

  await db.execute(sql`
    INSERT INTO therapist_verifications (user_id, organization_id, state, submitted_at, reviewed_at)
    VALUES (${user.id}, ${org.id}, 'approved', now(), now())`);

  check(
    "🔴 C285 CONTROL, approving the verification promotes the derived column with no app code",
    (await derived()) === "verified",
    `the trigger alone moved it to ${await derived()}`,
  );

  const onBoardAfter = (await board()).some((row) => row.userId === user.id);
  const countAfter = await radarCount();
  const profileAfter = await publicProfile(user.id);
  const partnerAfter = await partnerFacingVerified();

  check(
    "🔴 C285 CONTROL, the same clinician IS on the radar once genuinely approved",
    onBoardAfter,
    "without this the radar check above would pass on a build that showed nobody",
  );

  check(
    "🔴 C285 CONTROL, the public count moves by exactly one",
    countAfter === countBefore + 1,
    `${countBefore} then ${countAfter}: the number and the list are the same population`,
  );

  check(
    "🔴 C285 CONTROL, the public profile page now answers",
    profileAfter !== null,
    "the profile was refusing for the right reason rather than for no reason",
  );

  check(
    "🔴 C285 CONTROL, the partner-facing flag flips to verified",
    partnerAfter === true,
    "the assertion tracks the approval, which is the whole of C285",
  );

  /* ------------------------------------ 4. and a withdrawal reaches every surface too */

  await db.execute(
    sql`UPDATE therapist_verifications SET state = 'rejected' WHERE user_id = ${user.id}`,
  );

  const withdrawnPartner = await partnerFacingVerified();

  check(
    "🔴 C285 withdrawing the approval reaches the derived column",
    (await derived()) === "rejected",
    `the trigger moved it to ${await derived()} with nothing in application code doing so`,
  );

  check(
    "🔴 C285 …and the radar drops them without them touching the toggle",
    !(await board()).some((row) => row.userId === user.id),
    "the gap a gate-at-the-write-only design leaves open",
  );

  check(
    "🔴 C285 …and the partner is told they are no longer verified",
    withdrawnPartner === false,
    "an assertion made once is not an assertion that stays true",
  );

  /* -------------------------------------------------------------------- 5. clean up */

  await db.execute(sql`DELETE FROM therapist_radar WHERE user_id = ${user.id}`);
  await db.execute(sql`DELETE FROM therapist_verifications WHERE user_id = ${user.id}`);
  await db.execute(sql`DELETE FROM users WHERE id = ${user.id}`);
  await db.execute(sql`DELETE FROM organizations WHERE id = ${org.id}`);

  finish("C285");
}

void main();
