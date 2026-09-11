/**
 * Sprint 13 acceptance — claim by phone. PLAN.md §3b, 13.8.
 *
 *   npm run verify:sprint13
 *
 * 13.8 asks for something stronger than a passing test: **a mis-claim must be
 * impossible, not unlikely.** So every check here is run by *attempting the
 * thing that must fail* against the real database, and asserting it was
 * refused — a constraint nobody has tried to violate is a constraint nobody has
 * proved.
 *
 * Everything written is tagged `verify13-` and removed in the `finally`.
 */
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  patientAccounts,
  patients,
  people,
  personClaims,
  users,
} from "../lib/db/schema";
import { writesTo } from "./_verify";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? `, ${detail}` : ""}`);
}

function note(text: string) {
  console.log(`  --   ${text}`);
}

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

const PHONE_A = "+201300000131";
const PHONE_B = "+201300000132";

async function main() {
  /*
   * 🔴 C147 — this script WRITES, so it says where and refuses production.
   */
  writesTo();

  const madeAccounts: string[] = [];
  const madePeople: string[] = [];

  try {
    const [therapistA] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .limit(1);

    if (!therapistA) {
      check("13 a clinician exists to hold a record", false);
      return;
    }

    /*
     * A second clinician, so §3b step 8 can be exercised for real: two
     * therapists holding the same number.
     */
    const [therapistB] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .where(sql`${users.id} <> ${therapistA.id}`)
      .limit(1);

    /* ------------------------------------------ 13.1 one number, one account */

    const [personOne] = await db
      .insert(people)
      .values({ firstName: "verify13-one", phone: PHONE_A })
      .returning({ id: people.id });
    if (personOne) madePeople.push(personOne.id);

    const [personTwo] = await db
      .insert(people)
      .values({ firstName: "verify13-two", phone: PHONE_B })
      .returning({ id: people.id });
    if (personTwo) madePeople.push(personTwo.id);

    const [accountOne] = await db
      .insert(patientAccounts)
      .values({
        personId: personOne!.id,
        email: "verify13-one@example.test",
        passwordHash: "x",
        phone: PHONE_A,
        phoneVerifiedAt: new Date(),
      })
      .returning({ id: patientAccounts.id });
    if (accountOne) madeAccounts.push(accountOne.id);

    check("13.1 an account is created with a verified E.164 number", Boolean(accountOne));

    /*
     * 🔴 The invariant, attempted rather than assumed. A second account taking
     * a number that already belongs to a live account is the mis-claim §3b
     * exists to prevent, and the database is what stops it — not a service, not
     * a form.
     */
    const stolen = await refused(
      () =>
        db.insert(patientAccounts).values({
          personId: personTwo!.id,
          email: "verify13-thief@example.test",
          passwordHash: "x",
          phone: PHONE_A,
        }),
      "patient_accounts_phone_unique",
    );
    check("🔴 13.1 a second account cannot take a number that is already claimed", stolen);

    const noPhone = await refused(
      () =>
        db.insert(patientAccounts).values({
          personId: personTwo!.id,
          email: "verify13-nophone@example.test",
          passwordHash: "x",
          phone: null,
        }),
      "patient_accounts_phone_present",
    );
    check("13.1 …and an account cannot exist without one at all", noPhone);

    /* ------------------------------------- 13.5–13.7 the challenge, per record */

    const { openChallenges, answerSeen, answerName, challengePassed } = await import(
      "../lib/data/challenge"
    );

    const [recordA] = await db
      .insert(patients)
      .values({
        organizationId: therapistA.organizationId,
        therapistId: therapistA.id,
        firstName: "verify13-patient",
        personId: personOne!.id,
        phone: PHONE_A,
        source: "therapist",
      })
      .returning({ id: patients.id });

    const [recordB] = therapistB
      ? await db
          .insert(patients)
          .values({
            organizationId: therapistB.organizationId,
            therapistId: therapistB.id,
            firstName: "verify13-patient",
            personId: personOne!.id,
            phone: PHONE_A,
            source: "therapist",
          })
          .returning({ id: patients.id })
      : [undefined];

    const offered = await openChallenges(accountOne!.id);
    check(
      "🔴 13.7 two therapists holding one number produce two separate questions",
      therapistB ? offered.length === 2 : offered.length === 1,
      `${offered.length} challenge(s)`,
    );

    /*
     * 🔴 13.8's sharpest clause: *no screen displays a record's contents before
     * the challenge is passed.* Asserted on the **shape** of what the data
     * layer hands the screen, because a component can only render what it is
     * given. The therapist's name is the whole payload.
     */
    const keys = offered[0] ? Object.keys(offered[0]).sort() : [];
    check(
      "🔴 13.8 a challenge carries the therapist's name and nothing about the record",
      keys.join(",") === "attemptsLeft,claimId,patientId,stage,therapistName",
      keys.join(", "),
    );
    /*
     * 22R — the fixture's patient is named for the fixture, not with a common
     * first name. This asserted on "Yasmin" and went red the day a real
     * therapist called Yasmin existed in the database: `therapistName` is
     * *supposed* to be in this payload, so the check was reading the right
     * field and calling it the wrong thing.
     */
    check(
      "13.8 …and no patient name appears anywhere in it",
      !JSON.stringify(offered).includes("verify13-"),
      JSON.stringify(offered).slice(0, 80),
    );

    /* --------------------------------------------- a "no" is remembered */

    if (recordB) {
      await answerSeen({ accountId: accountOne!.id, patientId: recordB.id, seen: false });
      const after = await openChallenges(accountOne!.id);
      check(
        "🔴 13.6 a record answered 'no' is never offered to that account again",
        after.every((c) => c.patientId !== recordB.id),
        `${after.length} left`,
      );
      check(
        "13.6 …and the challenge for the other therapist is untouched",
        after.some((c) => c.patientId === recordA!.id),
      );
    }

    /* ------------------------------------------ a wrong name reveals nothing */

    await answerSeen({ accountId: accountOne!.id, patientId: recordA!.id, seen: true });

    const wrong = await answerName({
      accountId: accountOne!.id,
      patientId: recordA!.id,
      name: "Yasmine",
    });
    check(
      "🔴 13.8 a near-miss name is refused and does not say how close it was",
      !wrong.ok && !wrong.error.toLowerCase().includes("yasmin"),
      wrong.ok ? "accepted!" : wrong.error,
    );

    const blank = await answerName({ accountId: accountOne!.id, patientId: recordA!.id, name: "" });
    check("13.8 a blank name never matches", !blank.ok);

    /*
     * 🔴 This check caught a real defect while it was being written.
     *
     * `challengePassed` originally asked for `seen_therapist = true` and a
     * status that was not `rejected` — true the moment somebody clicks "yes" to
     * question one. The gate every screen consults would have opened on the
     * easy half of the challenge. The label said "still unpassed" and the
     * assertion said `=== true`, and the contradiction is what exposed it.
     */
    check(
      "🔴 13.8 answering only question one does NOT pass the gate a screen consults",
      (await challengePassed(accountOne!.id, recordA!.id)) === false,
      "yes-to-question-one must not open a record",
    );

    /* ------------------------------------------------ three strikes and it locks */

    const third = await answerName({
      accountId: accountOne!.id,
      patientId: recordA!.id,
      name: "Nope",
    });
    check(
      "🔴 13.8 three wrong names lock the record rather than allowing a fourth guess",
      !third.ok && third.locked === true,
      third.ok ? "accepted!" : third.error,
    );

    const afterLock = await openChallenges(accountOne!.id);
    check(
      "13.8 …and a locked record disappears from the queue rather than looping",
      afterLock.every((c) => c.patientId !== recordA!.id),
      `${afterLock.length} left`,
    );

    /* -------------------------------------------------- the happy path works */

    const [personThree] = await db
      .insert(people)
      .values({ firstName: "Yasmin", phone: "+201300000133" })
      .returning({ id: people.id });
    if (personThree) madePeople.push(personThree.id);

    const [accountThree] = await db
      .insert(patientAccounts)
      .values({
        personId: personThree!.id,
        email: "verify13-three@example.test",
        passwordHash: "x",
        phone: "+201300000133",
        phoneVerifiedAt: new Date(),
        timezone: "Africa/Cairo",
      })
      .returning({ id: patientAccounts.id });
    if (accountThree) madeAccounts.push(accountThree.id);

    const [recordC] = await db
      .insert(patients)
      .values({
        organizationId: therapistA.organizationId,
        therapistId: therapistA.id,
        firstName: "Yasmin",
        personId: personThree!.id,
        phone: "+201300000133",
        source: "therapist",
      })
      .returning({ id: patients.id });

    await answerSeen({ accountId: accountThree!.id, patientId: recordC!.id, seen: true });
    const right = await answerName({
      accountId: accountThree!.id,
      patientId: recordC!.id,
      // Case and spacing differ, as they will on a phone keyboard.
      name: " yasmin ",
      });
    check(
      "13.6 the right name, typed the way a phone types it, passes",
      right.ok && right.stage === "done",
      right.ok ? "" : right.error,
    );

    check(
      "🔴 13.8 …and only now does the gate a screen consults open",
      (await challengePassed(accountThree!.id, recordC!.id)) === true,
    );

    /*
     * 13.10 — claiming is not consenting. The challenge is behind them and the
     * record is still not `verified`: sprint 7's consent question decides that,
     * and it runs next.
     */
    const [claimRow] = await db
      .select({ status: personClaims.status, confirmed: personClaims.nameConfirmedAt })
      .from(personClaims)
      .where(
        and(
          eq(personClaims.patientAccountId, accountThree!.id),
          eq(personClaims.patientId, recordC!.id),
        ),
      )
      .limit(1);
    check(
      "🔴 13.10 passing the challenge does not itself claim the record, consent still runs",
      claimRow?.status === "pending" && claimRow?.confirmed !== null,
      `status=${claimRow?.status}`,
    );

    /* ------------------------------------------------- 13.11 the time zone */

    const [stored] = await db
      .select({ timezone: patientAccounts.timezone })
      .from(patientAccounts)
      .where(eq(patientAccounts.id, accountThree!.id))
      .limit(1);
    check("13.11 the account carries its own zone", stored?.timezone === "Africa/Cairo");

    /*
     * 🔴 13.13 — claiming never overwrites `patients.timezone`.
     *
     * That row records what the browser said the day the booking was made, and
     * one account may hold records from two therapists. Precedence is read at
     * render time; the value is never copied across.
     */
    const [patientRow] = await db
      .select({ timezone: patients.timezone })
      .from(patients)
      .where(eq(patients.id, recordC!.id))
      .limit(1);
    check(
      "🔴 13.13 claiming did not copy the account's zone onto the patient row",
      patientRow?.timezone === null,
      String(patientRow?.timezone),
    );

    note("13.9's email fallback shares this code path. The challenge is channel-agnostic.");
  } finally {
    await db.delete(personClaims).where(
      sql`${personClaims.patientAccountId} IN (SELECT id FROM patient_accounts WHERE email LIKE 'verify13-%')`,
    );
    await db.delete(patients).where(like(patients.firstName, "verify13-%"));
    await db.delete(patients).where(
      sql`${patients.personId} IN (SELECT id FROM people WHERE phone LIKE '+2013000001%')`,
    );
    await db.delete(patientAccounts).where(like(patientAccounts.email, "verify13-%"));
    await db.delete(people).where(sql`${people.phone} LIKE '+2013000001%'`);
  }

  console.log(
    `\n${failures === 0 ? "sprint 13: PASS" : `sprint 13: ${failures} FAILED`} (${checks} checks)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
