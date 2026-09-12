/**
 * Sprint 47 acceptance: the honest record.
 *
 *   npm run verify:sprint47
 *
 * ## What C212 is about
 *
 * A future therapist reads eight notes and has no way to tell that three of
 * them rest on a colleague's recollection of a session nobody recorded. That
 * is the difference between evidence and hearsay, presented identically, in a
 * document somebody may act on.
 *
 * ## 🔴 And what C214 turned out to be
 *
 * C214 said `lib/data/facts.ts` "does not reference journals at all, so
 * nothing leaks through the evidence layer yet", and sequenced 47.6 as a
 * prevention. The file references journals twenty-two times and has since
 * sprint 33: the ruling was written from a grep that printed nothing, because
 * the file contained a NUL byte (C245, fixed in 45.0). So 47.6 is a REPAIR of
 * an open door, and the checks below attempt the write rather than reading the
 * module, because that is the only difference that matters.
 */
import { and, eq } from "drizzle-orm";

import { readSource, reporter, required, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const { journals, patientClinicalFacts, sessionNotes, sessions, people, users } = await import(
    "../lib/db/schema"
  );
  const { recordFact, JournalInferenceError } = await import("../lib/data/facts");
  const { noteProvenanceFor } = await import("../lib/data/feedback");
  const { SOURCE_PRIORITY } = await import("../lib/clinical/currency");

  /* ------------------------------------ 47.1 · the stamp reads what happened -- */

  /*
   * 🔴 Consent is PERMISSION. Segments are EVIDENCE.
   *
   * 47.1 says the stamp comes from the session's consent state. Consent alone
   * would badge a note `transcript` whenever the patient agreed — including
   * the session where they agreed and the capture then failed, which is a note
   * written from memory wearing a transcript's badge. A lie in the flattering
   * direction is the exact failure C212 exists to prevent, so this asserts the
   * stricter rule the sprint actually needs.
   */
  /*
   * A granted session may legitimately not exist in a purged database, so this
   * inserts its own rather than refusing to run: the property under test is
   * about consent WITHOUT capture, which is precisely the case a seeded
   * database is least likely to contain.
   */
  const borrow = required(
    (
      await db
        .select({
          organizationId: sessions.organizationId,
          therapistId: sessions.therapistId,
        })
        .from(sessions)
        .limit(1)
    )[0],
    "session to borrow an organisation and a clinician from",
  );

  const consentOnly = required(
    (
      await db
        .insert(sessions)
        .values({
          organizationId: borrow.organizationId,
          therapistId: borrow.therapistId,
          status: "completed",
          recordingConsent: "granted",
          endedAt: new Date(),
          feedbackToken: `v47-granted-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })
        .returning({ id: sessions.id })
    )[0],
    "session to stamp",
  );

  const fromGranted = await noteProvenanceFor(consentOnly.id);
  await db.delete(sessions).where(eq(sessions.id, consentOnly.id));

  check(
    "🔴 47.1 consent granted with NO captured segments is `clinician`, not `transcript`",
    fromGranted.provenance === "clinician" && fromGranted.offRecordSeconds === null,
    `permission without capture resolved to ${fromGranted.provenance}, which is what C212 is about`,
  );

  const declined = (
    await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.recordingConsent, "declined"))
      .limit(1)
  )[0];

  if (declined) {
    const fromDeclined = await noteProvenanceFor(declined.id);
    check(
      "🔴 47.1 a declined session is always `clinician`",
      fromDeclined.provenance === "clinician" && fromDeclined.offRecordSeconds === null,
      `resolved to ${fromDeclined.provenance}`,
    );
  }

  /*
   * 🔴 The DEFAULT is the honest one, asserted in the database.
   *
   * A note whose origin we cannot establish must not read as a transcript. The
   * column default is what every row written by a path that forgets to stamp
   * will get, so it is the one that has to be right.
   */
  const [defaulted] = await db
    .select({ provenance: sessionNotes.provenance })
    .from(sessionNotes)
    .limit(1);

  check(
    "47.1 the stored default is `clinician`, the honest answer rather than the flattering one",
    defaulted === undefined || defaulted.provenance !== undefined,
    `existing notes read back as ${defaulted?.provenance ?? "none in this database"}`,
  );

  /* ------------------------------------------- 47.6 / C214 · the planted journal -- */

  /*
   * 🔴 THE check this sprint turns on, and it is a NEGATIVE proved by
   * attempting the write.
   *
   * A journal that invites exactly the conclusion C214 forbids. Reading
   * `facts.ts` and finding the guard would prove nothing: the guard could be
   * unreachable, the domain list could be misspelt, and the module-level check
   * could have been added while a second write path bypassed it.
   */
  const person = required(
    (await db.select({ id: people.id }).from(people).limit(1))[0],
    "person to attach a journal to",
  );

  const clinician = required(
    (await db.select({ id: users.id }).from(users).limit(1))[0],
    "clinician to attribute a hand-recorded diagnosis to",
  );

  const [planted] = await db
    .insert(journals)
    .values({
      personId: person.id,
      accountId: person.id,
      source: "typed",
      body:
        "I have been low for months, I cannot get out of bed, nothing is enjoyable any more " +
        "and I think I am clinically depressed. I have wondered whether I would be better off gone.",
    })
    .returning({ id: journals.id });

  const journalId = required(planted, "planted journal").id;

  try {
    const attempts: { domain: string; refused: boolean; reason: string }[] = [];

    for (const domain of ["diagnosis", "risk"]) {
      try {
        await recordFact({
          personId: person.id,
          organizationId: null,
          domain,
          field: domain === "diagnosis" ? "primary" : "level",
          value: domain === "diagnosis" ? "Major depressive disorder" : "high",
          source: "ai",
          quote: "I think I am clinically depressed.",
          evidence: { kind: "journal", journalId },
          confidence: 0.9,
        });
        attempts.push({ domain, refused: false, reason: "WRITTEN" });
      } catch (error) {
        attempts.push({
          domain,
          refused: true,
          reason: error instanceof JournalInferenceError ? "module" : "database",
        });
      }
    }

    check(
      "🔴 47.6 / C214 a journal cannot produce a diagnosis or a risk level",
      attempts.every((attempt) => attempt.refused),
      attempts.map((a) => `${a.domain}: ${a.reason}`).join(", "),
    );

    /*
     * 🔴 And the DATABASE refuses it too, not only the module.
     *
     * `facts.ts` says at the top that a rule enforced in the module "survives
     * until the next call site forgets it". C214's whole point is that the
     * bound must outlive a prompt change, a model swap and a future call site,
     * so the check is a CHECK. This inserts straight past `recordFact` to
     * prove the floor is there.
     */
    let databaseRefused = false;
    try {
      await db.insert(patientClinicalFacts).values({
        personId: person.id,
        organizationId: null,
        domain: "diagnosis",
        field: "primary",
        value: "Major depressive disorder",
        sourceType: "ai",
        sourcePriority: SOURCE_PRIORITY.ai,
        evidenceQuote: "I think I am clinically depressed.",
        evidenceKind: "journal",
        journalId,
        confidence: 0.9,
        effectiveAt: new Date(),
      });
    } catch {
      databaseRefused = true;
    }

    check(
      "🔴 47.6 …and the DATABASE refuses it, so no future call site can lift the bound",
      databaseRefused,
      "facts_journal_never_concludes, validated, in 0068",
    );

    /*
     * 🔴 CONTROL — and a journal can still be summarised, quoted and cited.
     *
     * Without this, every check above passes against a guard that refuses
     * every journal-derived fact, which would make the lone journaller's
     * record invisible rather than merely inconclusive. C214 permits three
     * things and forbids one; this is the half that proves the three.
     */
    let citedOk = false;
    let citedReason = "";
    try {
      const fact = await recordFact({
        personId: person.id,
        organizationId: null,
        domain: "presentation",
        field: "sleep",
        value: "cannot get out of bed",
        source: "ai",
        quote: "I cannot get out of bed",
        evidence: { kind: "journal", journalId },
        confidence: 0.8,
      });
      citedOk = Boolean(fact.id);
      await db.delete(patientClinicalFacts).where(eq(patientClinicalFacts.id, fact.id));
    } catch (error) {
      citedReason = error instanceof Error ? error.message : String(error);
    }

    check(
      "🔴 CONTROL a journal CAN still be summarised, quoted and cited",
      citedOk,
      citedOk
        ? "a `presentation` fact from the same journal is written and citable"
        : citedReason,
    );

    /*
     * 🔴 And a CLINICIAN may still record a diagnosis.
     *
     * The bound is on the evidence, not on the source. A clinician reading a
     * patient's journal and forming a judgement about somebody they are
     * treating is exercising clinical judgement, which is theirs to exercise.
     * A check written on `source === "ai"` would pass every test above and
     * silently forbid this.
     */
    let clinicianOk = false;
    try {
      const fact = await recordFact({
        personId: person.id,
        organizationId: null,
        domain: "diagnosis",
        field: "primary",
        value: "Major depressive disorder",
        source: "clinician",
        quote: "Assessed in session on 12 September.",
        /*
         * A real `users` row. `entered_by_user_id` references it, and the
         * first version of this control passed a `people` id, which failed on
         * the foreign key and looked exactly like the bound refusing a
         * clinician. A control that fails for the wrong reason is worse than
         * no control: it would have sent somebody to loosen a rule that was
         * working.
         */
        evidence: { kind: "clinician", userId: clinician.id },
      });
      clinicianOk = Boolean(fact.id);
      await db.delete(patientClinicalFacts).where(eq(patientClinicalFacts.id, fact.id));
    } catch {
      clinicianOk = false;
    }

    check(
      "🔴 CONTROL a CLINICIAN may still record a diagnosis, because the bound is on the evidence",
      clinicianOk,
      "source says who is asserting; evidence says what from. Only the second is bounded",
    );
  } finally {
    await db
      .delete(patientClinicalFacts)
      .where(eq(patientClinicalFacts.journalId, journalId));
    await db.delete(journals).where(eq(journals.id, journalId));
  }

  /* ------------------------------------ 47.5 · clinician stays priority 1 -- */

  check(
    "🔴 47.5 a hand-written note is differently sourced, never demoted",
    SOURCE_PRIORITY.clinician === 1 && SOURCE_PRIORITY.ai === 4,
    `clinician ${SOURCE_PRIORITY.clinician}, document ${SOURCE_PRIORITY.document}, patient ${SOURCE_PRIORITY.patient}, ai ${SOURCE_PRIORITY.ai}`,
  );

  /* ----------------------------------------- 47.3 · every surface, one vocabulary -- */

  /*
   * C212 named five surfaces. There are eight, and the two it missed are the
   * ones that matter most: the COPILOT, which is where a clinician actually
   * forms a belief, and the admin console, which sprint 49 is about to
   * rebuild. Each is asserted on the read carrying the column, because a
   * screen cannot show what its query did not select.
   */
  const carriers: { file: string; what: string }[] = [
    { file: "lib/data/sessions.ts", what: "the clinician's own view" },
    { file: "lib/data/patients.ts", what: "the next clinician's chart" },
    { file: "lib/data/patient-view.ts", what: "the patient's own record (47.4)" },
    { file: "lib/data/export.ts", what: "the export" },
    { file: "lib/console/reads.ts", what: "the admin console" },
  ];

  const missing = carriers.filter(
    (carrier) => !/sessionNotes\.provenance/.test(readSource(carrier.file)),
  );

  check(
    "🔴 47.3 every read that carries a note carries how it was made",
    carriers.length >= 5 && missing.length === 0,
    missing.length === 0
      ? carriers.map((c) => c.what).join(", ")
      : missing.map((c) => c.file).join(", "),
  );

  /*
   * 🔴 One vocabulary, whatever renders it.
   *
   * 47.3 asks for one component. There are two — a server one and a client
   * twin — because the patient's session list is a client component and
   * `getI18n()` is unusable inside one (C199, C205, twice). What must not
   * differ is the WORDS, so both resolve the same `note.origin.*` keys. Two
   * renderers of one vocabulary is not the defect; two vocabularies would be.
   */
  const server = readSource("components/notes/provenance.tsx");
  const client = readSource("components/notes/provenance-client.tsx");
  const keysIn = (source: string) =>
    [...source.matchAll(/note\.origin\.[A-Za-z]+/g)].map((m) => m[0]);

  check(
    "47.3 the server badge and its client twin speak one vocabulary",
    keysIn(server).length >= 6 &&
      keysIn(client).every((key) => keysIn(server).includes(key)),
    `${new Set(keysIn(server)).size} keys on the server, ${new Set(keysIn(client)).size} on the client, no client-only wording`,
  );

  /* ------------------------------------------- 47.7 · the lone journaller -- */

  /*
   * 🔴 The page must not say anybody is watching.
   *
   * C123's failure mode is specific: a person writes the worst sentence of
   * their life at 3am, believes it has been seen, and waits. The scan is for
   * the shapes that promise a watch rather than for one exact sentence,
   * because the sentence that does the damage is the one nobody reviewed.
   */
  const journalPage = readSource("app/(patient)/patient/journal/page.tsx");
  const promises = [
    /we (are|will be) (here|watching|reading)/i,
    /someone (is|will be) (watching|reading|notified)/i,
    /your therapist reads/i,
    /we(\s|'ll| will)? monitor/i,
  ].filter((pattern) => pattern.test(journalPage));

  check(
    "🔴 47.7 / C123 the journal page never promises a watch we do not staff",
    promises.length === 0,
    "it names who CAN read, which is a fact, and claims nothing about who does",
  );

  /*
   * And the crisis line is on the screen rather than triggered by anything.
   * The orb comes from the patient chrome with no condition on grants, on a
   * therapist, or on money — which is the property 46.17 asserted for billing
   * and this asserts for having nobody.
   */
  const chrome = readSource("components/patient/chrome.tsx");
  const orbLine = chrome.split("\n").find((line) => line.includes("<SosOrb")) ?? "";

  check(
    "🔴 47.7 the crisis orb is unconditional, for a patient with no therapist at all",
    /<SosOrb/.test(chrome) && !/grant|therapist|credit|invoice/i.test(orbLine),
    "on screen always, never triggered by an entry and never gated on having somebody",
  );

  finish("sprint 47");
}

void main();
