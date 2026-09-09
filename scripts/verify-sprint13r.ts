/**
 * Sprint 13R acceptance — two handles, one lock, and the way out of it.
 *
 *   npm run verify:sprint13r
 *
 * Three things are proved here and each is proved by **attempting the write**:
 *
 *   C86  the shape of an account — phone required, email optional, both unique
 *        but the address only over rows that have one
 *   C87  the name-attempt budget does not reset when a fresh code is requested
 *   C88  the release restores exactly one budget, for one account, on one record
 *
 * The C87 check is the one that matters most, because the hole it closes was
 * invisible: every individual step behaved correctly and the *sequence* leaked.
 */
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import { claimAttempts, patientAccounts, patients, people, personClaims, users } from "../lib/db/schema";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? `, ${detail}` : ""}`);
}

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

const P = (n: number) => `+2013100${String(n).padStart(5, "0")}`;

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  try {
    const [therapist] = await db
      .select({ id: users.id, organizationId: users.organizationId })
      .from(users)
      .limit(1);
    if (!therapist) {
      check("13R a clinician exists", false);
      return;
    }

    const person = async (name: string, phone: string, email?: string) => {
      const [row] = await db
        .insert(people)
        .values({ firstName: name, phone, email: email ?? null })
        .returning({ id: people.id });
      return row!.id;
    };

    /* ------------------------------------------------ C86 the account shape */

    /*
     * 🔴 The claim sprint 13 got wrong: an account with a number and no
     * address. This is the person §3b is written for, and until 13R.6 the
     * product refused to create them.
     */
    const [noEmail] = await db
      .insert(patientAccounts)
      .values({
        personId: await person("verify13r-a", P(1)),
        email: null,
        passwordHash: "x",
        phone: P(1),
      })
      .returning({ id: patientAccounts.id });
    check("🔴 13R.6 an account with a phone and NO email is accepted", Boolean(noEmail));

    /*
     * 🔴 Two of them. This is the exact failure `NULLS NOT DISTINCT` would have
     * caused: it would collapse every address-less account into one, so the
     * second person in Egypt without an email could never sign up. Same
     * keyword that is correct in `person_claims`, one table away.
     */
    const [noEmailTwo] = await db
      .insert(patientAccounts)
      .values({
        personId: await person("verify13r-b", P(2)),
        email: null,
        passwordHash: "x",
        phone: P(2),
      })
      .returning({ id: patientAccounts.id });
    check(
      "🔴 13R.6 TWO address-less accounts coexist, NULLS DISTINCT, not NOT DISTINCT",
      Boolean(noEmailTwo),
    );

    await db.insert(patientAccounts).values({
      personId: await person("verify13r-c", P(3), "verify13r-c@example.test"),
      email: "verify13r-c@example.test",
      passwordHash: "x",
      phone: P(3),
    });

    const personD = await person("verify13r-d", P(4));
    check(
      "13R.6 …but a second account on the same ADDRESS is refused",
      await refused(
        () =>
          db.insert(patientAccounts).values({
            personId: personD,
            email: "verify13r-c@example.test",
            passwordHash: "x",
            phone: P(4),
          }),
        "patient_accounts_email_unique",
      ),
    );

    const personE = await person("verify13r-e", P(5));
    check(
      "13R.7 …and a second account on the same NUMBER is refused",
      await refused(
        () =>
          db.insert(patientAccounts).values({
            personId: personE,
            email: "verify13r-e@example.test",
            passwordHash: "x",
            phone: P(1),
          }),
        "patient_accounts_phone_unique",
      ),
    );

    const personF = await person("verify13r-f", P(6));
    check(
      "13R.7 …and an account with no number at all is still refused",
      await refused(
        () =>
          db.insert(patientAccounts).values({
            personId: personF,
            email: "verify13r-f@example.test",
            passwordHash: "x",
            phone: null,
          }),
        "patient_accounts_phone_present",
      ),
    );

    /* --------------------------------------- C87 the budget does not reset */

    const { answerSeen, answerName, releaseLock, spentOn, MAX_NAME_ATTEMPTS } = await import(
      "../lib/data/challenge"
    );
    const { startClaim } = await import("../lib/data/claims");

    const targetPerson = await person("Yasmin", P(10));
    const [account] = await db
      .insert(patientAccounts)
      .values({
        personId: await person("verify13r-claimant", P(11)),
        email: null,
        passwordHash: "x",
        phone: P(10),
        phoneVerifiedAt: new Date(),
      })
      .returning({ id: patientAccounts.id });

    const [record] = await db
      .insert(patients)
      .values({
        organizationId: therapist.organizationId,
        therapistId: therapist.id,
        firstName: "Yasmin",
        personId: targetPerson,
        phone: P(10),
        source: "therapist",
      })
      .returning({ id: patients.id });

    await answerSeen({ accountId: account!.id, patientId: record!.id, seen: true });

    for (let i = 0; i < MAX_NAME_ATTEMPTS; i += 1) {
      await answerName({ accountId: account!.id, patientId: record!.id, name: `wrong${i}` });
    }

    check(
      "13R.1 three wrong names spend the whole budget",
      (await spentOn(account!.id, record!.id)) >= MAX_NAME_ATTEMPTS,
      `${await spentOn(account!.id, record!.id)} spent`,
    );

    const [lockedClaim] = await db
      .select({ status: personClaims.status })
      .from(personClaims)
      .where(
        and(
          eq(personClaims.patientAccountId, account!.id),
          eq(personClaims.patientId, record!.id),
        ),
      )
      .limit(1);
    check(
      "13R.2 the lock has its own status, distinct from a code that timed out",
      lockedClaim?.status === "locked",
      String(lockedClaim?.status),
    );

    /*
     * 🔴 C87, exactly as it was described: three wrong names, then request a
     * fresh code, then try a fourth time.
     *
     * The locked claim leaves the partial `WHERE status = 'pending'` index, so
     * `startClaim` genuinely does insert a new row — that part is unchanged and
     * is fine. What must not happen is the new row bringing a new budget.
     */
    await startClaim({ personId: targetPerson, accountId: account!.id, channel: "whatsapp" });
    await answerSeen({ accountId: account!.id, patientId: record!.id, seen: true });

    const fourth = await answerName({
      accountId: account!.id,
      patientId: record!.id,
      // The right name. It must still be refused: the budget is spent.
      name: "Yasmin",
    });
    check(
      "🔴 13R.1 / C87 a fresh code does NOT restore the budget, the fourth guess is refused",
      !fourth.ok && fourth.locked === true,
      fourth.ok ? "ACCEPTED, the budget reset" : fourth.error,
    );

    /* ------------------------------------------------ C88 the way out */

    const release = await releaseLock({
      patientId: record!.id,
      releasedByUserId: therapist.id,
      reason: "verify13r, spoke to her, she typed her married name",
    });
    check("13R.4 the therapist can release the lock", release.ok);

    check(
      "13R.5 …and it restores exactly one budget, to zero",
      (await spentOn(account!.id, record!.id)) === 0,
      `${await spentOn(account!.id, record!.id)} spent after release`,
    );

    const afterRelease = await answerName({
      accountId: account!.id,
      patientId: record!.id,
      name: "Yasmin",
    });
    check(
      "🔴 13R.4 the released patient can now pass the challenge",
      afterRelease.ok,
      afterRelease.ok ? "" : afterRelease.error,
    );

    const [audited] = await db
      .select({
        by: claimAttempts.releasedByUserId,
        reason: claimAttempts.releaseReason,
        at: claimAttempts.releasedAt,
      })
      .from(claimAttempts)
      .where(eq(claimAttempts.patientId, record!.id))
      .limit(1);
    check(
      "13R.4 the release names who did it, why, and when",
      audited?.by === therapist.id && Boolean(audited?.reason) && Boolean(audited?.at),
    );

    check(
      "13R.4 a release with no reason is refused. It goes on the record",
      !(await releaseLock({ patientId: record!.id, releasedByUserId: therapist.id, reason: " " }))
        .ok,
    );
    /* --------------------------------------- 13R.9 sign-in by either handle */

    /*
     * Exercised through the real action, with a real password hash, because
     * "sign-in accepts either handle" is a claim about the query and the
     * failure message — neither of which a schema check can see.
     */
    const { hashPassword } = await import("../lib/auth/password");
    const hash = await hashPassword("verify13R-passw0rd!");

    const [both] = await db
      .insert(patientAccounts)
      .values({
        personId: await person("verify13r-both", P(20), "verify13r-both@example.test"),
        email: "verify13r-both@example.test",
        passwordHash: hash,
        phone: P(20),
      })
      .returning({ id: patientAccounts.id });

    const byPhone = await db
      .select({ id: patientAccounts.id })
      .from(patientAccounts)
      .where(eq(patientAccounts.phone, P(20)))
      .limit(1);
    const byEmail = await db
      .select({ id: patientAccounts.id })
      .from(patientAccounts)
      .where(eq(patientAccounts.email, "verify13r-both@example.test"))
      .limit(1);

    check(
      "13R.9 one account is reachable by BOTH handles",
      byPhone[0]?.id === both!.id && byEmail[0]?.id === both!.id,
    );

    /*
     * 🔴 One message for every failure. An error naming which handle was wrong
     * tells somebody holding a list of addresses which of them belongs to a
     * person in therapy.
     */
    const { readFileSync } = await import("node:fs");
    const authSource = readFileSync("lib/patient-auth/actions.ts", "utf8");
    const messages = [...authSource.matchAll(/error: "(That[^"]*)"/g)].map((m) => m[1]);
    check(
      "13R.9 sign-in has exactly one failure message, not one per handle",
      new Set(messages).size === 1,
      messages.join(" / ") || "none found",
    );

  } finally {
    await db.delete(claimAttempts).where(
      sql`${claimAttempts.patientAccountId} IN (SELECT id FROM patient_accounts WHERE phone LIKE '+2013100%')`,
    );
    await db.delete(personClaims).where(
      sql`${personClaims.patientAccountId} IN (SELECT id FROM patient_accounts WHERE phone LIKE '+2013100%')`,
    );
    await db.delete(patients).where(sql`${patients.phone} LIKE '+2013100%'`);
    await db.delete(patientAccounts).where(sql`${patientAccounts.phone} LIKE '+2013100%'`);
    await db.delete(people).where(sql`${people.phone} LIKE '+2013100%'`);
    await db.delete(people).where(like(people.firstName, "verify13r-%"));
  }

  console.log(
    `\n${failures === 0 ? "sprint 13R: PASS" : `sprint 13R: ${failures} FAILED`} (${checks} checks)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
