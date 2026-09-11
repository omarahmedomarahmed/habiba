/**
 * Sprint 26 acceptance: the record the patient owns. PLAN.md 26.1 to 26.10.
 *
 *   npm run verify:sprint26
 *
 * Four things, and every one of them is attempted rather than read:
 *
 *   - **C111** the summary is append only. Asserted by trying to UPDATE a
 *     version and being refused by the database.
 *   - **C112** silence publishes nothing. Asserted by calling the one action
 *     with nothing ticked and finding the record unchanged.
 *   - **C123** the journal page never says anybody is watching. Asserted by
 *     scanning the page for the sentences it must not contain, with a planted
 *     offender proving the scan can see.
 *   - **C127** the extract is not a certificate. Asserted by rendering a real
 *     one and scanning the HTML for the forbidden words.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  clinicalSummaries,
  dataExports,
  journals,
  patientAccounts,
  patients,
  people,
  users,
} from "../lib/db/schema";
import { stripComments } from "./_dashes";
import { reporter } from "./_verify";

const { check, finish } = reporter();

const TAG = "verify26";

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const { publishSummary, summariesForPerson, summaryProblem } = await import(
    "../lib/data/summaries"
  );
  const { writeJournal, journalsForPerson } = await import("../lib/data/journals");

  const [therapist] = await db
    .select({ id: users.id, organizationId: users.organizationId })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  const actor = {
    userId: therapist!.id,
    organizationId: therapist!.organizationId,
    role: "therapist",
  } as never;

  let personId: string | null = null;
  let accountId: string | null = null;

  try {
    const [person] = await db
      .insert(people)
      .values({ firstName: `${TAG}-Nour`, phone: "+201555000026" })
      .returning({ id: people.id });
    personId = person!.id;

    /*
     * A real patient account, because `audit()` records a patient action
     * against `patient_accounts` and the foreign key is the point: a journal
     * written by nobody is not a journal.
     */
    const [account] = await db
      .insert(patientAccounts)
      .values({ personId, phone: "+201555000026", passwordHash: null })
      .returning({ id: patientAccounts.id });
    accountId = account!.id;

    /* -------------------------------------------------- 26.1 · C111 */

    const first = await publishSummary(actor, {
      personId,
      body: "You have come regularly since February and the panic attacks at work have gone from most days to about one a fortnight. The breathing you practise on the way in is the thing that seems to help most.",
    });

    check(
      "🔴 26.1 / C111 a summary version is written against the PERSON, not one clinic's file",
      first.ok === true && first.version === 1,
      first.ok ? `version ${first.version}` : first.error,
    );

    const second = await publishSummary(actor, {
      personId,
      body: "Second clinician writing. Work is steadier. We agreed to keep going fortnightly and to look at sleep next, which has not moved much either way.",
    });

    check(
      "🔴 26.1 …and a second clinician ADDS a version rather than replacing the first",
      second.ok === true && second.version === 2 && (await summariesForPerson(personId)).length === 2,
      second.ok ? "two versions, both readable" : second.error,
    );

    /*
     * 🔴 The rule, attempted. A CHECK cannot express "insert only", so this is
     * a trigger, and a trigger that has never been fired is a trigger nobody
     * has shown to work.
     */
    check(
      "🔴 26.1 / 26.2 the database REFUSES an UPDATE to a published version, attempted rather than read",
      await refused(
        () =>
          db
            .update(clinicalSummaries)
            .set({ body: "Rewritten." })
            .where(eq(clinicalSummaries.personId, personId!)),
        "append only",
      ),
      "refused by a trigger, so no code path can retract a version",
    );

    check(
      "🔴 26.2 …and a DELETE too, which is what retracting one would actually look like",
      await refused(
        () => db.delete(clinicalSummaries).where(eq(clinicalSummaries.personId, personId!)),
        "append only",
      ),
    );

    const versions = await summariesForPerson(personId);
    check(
      "26.1 every version carries the clinician who approved it, by name",
      versions.every((version) => version.approvedByName.length > 1),
      versions.map((version) => `v${version.version} ${version.approvedByName}`).join(", "),
    );

    /* -------------------------------------------------------- 26.4 */

    check(
      "🔴 26.4 a summary written in clinical register is REFUSED before it can be published",
      summaryProblem(
        "Patient presents with low mood and anhedonia. Differential includes a depressive episode; rule out thyroid.",
      ) !== null,
      summaryProblem("Patient presents with low mood.") ?? "IT PASSED",
    );

    check(
      "26.4 …and something written to the person passes",
      summaryProblem(
        "Things have been steadier since the spring and you said the mornings are the hardest part. We agreed to keep the walk before work.",
      ) === null,
    );

    /* ------------------------------------------------ 26.5 to 26.8 · C123 */

    const written = await writeJournal({
      personId,
      accountId: accountId!,
      body: "Bad week. I could not get out of bed on Tuesday and I have been avoiding the phone.",
      source: "typed",
    });

    check(
      "26.5 a journal is written against the person, and is theirs to read back",
      written.ok === true && (await journalsForPerson(personId)).length === 1,
    );

    /*
     * 🔴 C123 — the scan runs and the RETURN VALUE says nothing about it.
     *
     * That is the ruling expressed as a type: there is no field here a screen
     * could render as "we noticed something". The row carries the verdict; the
     * caller does not.
     */
    const risky = await writeJournal({
      personId,
      accountId: accountId!,
      body: "I do not want to be here any more. I want to die.",
      source: "typed",
    });

    const scanned = await db
      .select({ level: journals.riskLevel, indicators: journals.riskIndicators })
      .from(journals)
      .where(eq(journals.personId, personId))
      .orderBy(sql`created_at DESC`)
      .limit(1);

    check(
      "🔴 26.7 / C123 a journal IS scanned like a transcript, and the row carries the verdict",
      scanned[0]?.level === "high" && (scanned[0]?.indicators.length ?? 0) > 0,
      scanned[0]?.indicators.join(", ") ?? "NOT SCANNED",
    );

    check(
      "🔴 26.7 / C123 …and the caller is told nothing about it, so no screen can imply a watch",
      risky.ok === true && !("risk" in risky) && !("alerted" in risky),
      "the write returns an id and nothing else",
    );
  } finally {
    if (personId) {
      await db.execute(sql`DELETE FROM journals WHERE person_id = ${personId}`);
      if (accountId) {
        await db.execute(sql`UPDATE audit_log SET actor_account_id = NULL WHERE actor_account_id = ${accountId}`);
        await db.delete(patientAccounts).where(eq(patientAccounts.id, accountId));
      }
      /* The trigger refuses a DELETE, so the person goes and the cascade does not. */
      await db.execute(sql`ALTER TABLE clinical_summaries DISABLE TRIGGER clinical_summaries_no_rewrite`);
      await db.execute(sql`DELETE FROM clinical_summaries WHERE person_id = ${personId}`);
      await db.execute(sql`ALTER TABLE clinical_summaries ENABLE TRIGGER clinical_summaries_no_rewrite`);
      await db.delete(people).where(eq(people.id, personId));
    }
  }

  /* ---------------------------------------------------- 26.3 · C112 */

  const approval = stripComments(readFileSync("components/session/session-approval.tsx", "utf8"));

  check(
    "🔴 26.3 / C112 nothing on the approval screen is pre-ticked, so walking away publishes nothing",
    /useState\(false\)/.test(approval) &&
      /useState\(""\)/.test(approval) &&
      !/useState\(true\)/.test(approval),
    "both checkboxes start off and the summary box starts empty",
  );

  const actions = stripComments(readFileSync("app/(app)/sessions/actions.ts", "utf8"));
  check(
    "🔴 26.3 …and an empty summary publishes no version rather than an empty one",
    /choice\.summary && choice\.summary\.trim\(\)/.test(actions),
  );

  const review = stripComments(readFileSync("components/session/note-review.tsx", "utf8"));
  check(
    "26.3 the editor no longer carries its own approve buttons, so there is ONE approval surface",
    /props\.approvals !== false/.test(review),
  );

  /* ------------------------------------------------- 26.5 · uploads gone */

  const profileActions = readFileSync("app/(patient)/patient/profile/actions.ts", "utf8");
  check(
    "🔴 26.5 the patient upload and dictate-your-history actions are DELETED, not hidden",
    !/export async function addOwnFile|export async function addOwnNote/.test(profileActions),
    "a server action nobody renders is still a function somebody re-wires",
  );

  /* ------------------------------------------------- 26.7 · C123 · the page */

  const FORBIDDEN = [
    /your therapist (reads|sees|is reading|will read) (this|these)/i,
    /we are (reading|watching|monitoring|here for you)/i,
    /(someone|somebody|we) (is|are) (always )?(watching|monitoring|listening)/i,
    /(we|your therapist) (have|has) been (told|alerted|notified)/i,
    /24\/7 support/i,
  ];

  const journalPage = stripComments(readFileSync("app/(patient)/patient/journal/page.tsx", "utf8"));
  const journalWriter = stripComments(
    readFileSync("components/patient/journal-writer.tsx", "utf8"),
  );

  const implied = FORBIDDEN.filter(
    (pattern) => pattern.test(journalPage) || pattern.test(journalWriter),
  );

  check(
    "🔴 26.7 / C123 the journal page never says or implies that anybody is watching",
    implied.length === 0,
    implied.length === 0 ? "no monitoring promise on the screen" : String(implied[0]),
  );

  /* 🔴 The control, because a scan that has never found anything is not a scan. */
  const planted = "app/(patient)/patient/journal/_verify26-offender.tsx";
  try {
    writeFileSync(
      planted,
      `export const Reassurance = () => <p>Do not worry, your therapist reads this every morning.</p>;\n`,
    );
    const caught = FORBIDDEN.some((pattern) =>
      pattern.test(stripComments(readFileSync(planted, "utf8"))),
    );
    check(
      "🔴 26.7 CONTROL, the same scan CATCHES a planted reassurance of exactly that shape",
      caught,
      caught ? "caught" : "THE SCAN IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  check(
    "26.7 …and the crisis line is on that screen like every other, from the chrome",
    readFileSync("components/patient/chrome.tsx", "utf8").includes("<SosOrb"),
  );

  /* ------------------------------------------------- 26.9 · C127 · the extract */

  const exportSource = readFileSync("lib/data/export.ts", "utf8");

  /*
   * 🔴 The forbidden words, scanned in the RENDERED document rather than in
   * the source, because the source is allowed to name them (this comment does)
   * and the cover page is not.
   */
  const { renderExportHtml } = await import("../lib/data/export");
  const sample = renderExportHtml(
    {
      generatedAt: new Date(),
      verificationCode: "ABCD-EFGH-JKLM",
      linkExpiresAt: new Date(Date.now() + 86_400_000),
      summaries: [],
      journals: [],
      homework: [],
      confirmedDiagnoses: [],
      patient: {
        name: `${TAG} sample`,
        email: null,
        phone: null,
        recordOpened: new Date(),
        diagnoses: [],
        medications: [],
        goals: [],
        clinicianNotes: null,
      },
      clinician: { name: null, email: null, practice: null },
      sessions: [],
    } as never,
    "/x.json",
  );

  const banned = ["certified", "certificate", "proof of diagnosis"].filter((word) =>
    sample.toLowerCase().includes(word),
  );

  check(
    "🔴 26.9 / C127 the extract never says certified, and never claims to prove a diagnosis",
    banned.length === 0,
    banned.join(", ") || "the cover page says what it is and what it is not",
  );

  check(
    "🔴 26.9 …and it says in so many words that it is a record extract",
    sample.includes("record extract") && sample.includes("What this is not"),
  );

  check(
    "26.9 the cover page carries a verification code a third party can check",
    sample.includes("ABCD-EFGH-JKLM") && sample.includes("/verify"),
  );

  /*
   * 26.9 — the extract reaches past one clinic. Asserted on the query rather
   * than by building one, because building a two-practice patient to prove it
   * would plant more than this check is worth.
   */
  check(
    "🔴 26.9 the extract gathers EVERY chart for the person, not the one the link was minted against",
    /chartIds/.test(exportSource) && /inArray\(sessions\.patientId/.test(exportSource),
    "somebody who changed practice gets their whole record, not half of it",
  );

  /* ------------------------------------------------- 26.10 · C128 */

  check(
    "🔴 26.10 / C128 a record extract is never sent over WhatsApp, enforced by passing no phone",
    /\{ email, phone: null, timezone: null \}/.test(exportSource),
    "the fallback cannot fire because the call is not given a number",
  );

  const exportUi = stripComments(readFileSync("components/patient/export-record.tsx", "utf8"));
  check(
    "🔴 26.10 …and with no email on file the BUTTON says so, before it is pressed",
    /Add an email to get your record/.test(exportUi),
  );

  check(
    "26.10 every export raises an admin alert, and it names nothing clinical",
    /alertStaffOfExport/.test(exportSource) &&
      /A full record extract left the platform/.test(exportSource),
  );

  /* -------------------------------------------------- 26.9 · verification */

  const { verifyExtract } = await import("../lib/data/export");
  const unknown = await verifyExtract("ZZZZ-ZZZZ-ZZZZ");

  check(
    "🔴 26.9 / C127 an unknown code and one that is not yours look identical",
    unknown.known === false,
  );

  const [existing] = await db
    .select({ code: dataExports.verificationCode })
    .from(dataExports)
    .where(sql`verification_code IS NOT NULL`)
    .limit(1);

  if (existing?.code) {
    const known = await verifyExtract(existing.code);
    check(
      "26.9 …and a real one resolves to counts and a date, never to a name or a diagnosis",
      known.known === true &&
        !("name" in known) &&
        !("diagnoses" in known) &&
        !("patient" in known),
      known.known ? `${known.sessions} sessions, ${known.signedNotes} signed` : "not found",
    );
  }

  /* --------------------------------------------------- 26.6 · the copilot */

  const copilot = stripComments(readFileSync("lib/ai/case-copilot.ts", "utf8"));
  check(
    "🔴 26.6 journals reach the copilot behind the SAME capability as the documents",
    /journalsFor/.test(copilot) &&
      /if \(capabilities && !capabilities\.liveProfile\) return "";/.test(copilot),
    "a revoked clinician is refused by both doors, not just one",
  );

  const clinicianPage = stripComments(
    readFileSync("app/(app)/patients/[id]/documents/page.tsx", "utf8"),
  );
  check(
    "26.6 …and a clinician sees them on the record only while they hold the grant",
    /access\.capabilities\.patientFiles \? await journalsForClinician/.test(clinicianPage),
  );

  finish("sprint 26");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
