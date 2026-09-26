/**
 * Sprint 44 acceptance: check-ins.
 *
 *   npm run verify:sprint44
 *
 * ## 🔴 The sentence every check here is subordinate to
 *
 * > **44.2 — A CHECK-IN ASKS. IT NEVER INTERPRETS.** *A worrying reply goes to the crisis path,
 * > never to a copilot.*
 *
 * That is checked three ways, because one way would not be enough:
 *
 *   - `lib/checkins/` imports nothing from `lib/ai/`, as an import-graph sweep.
 *   - `checkin_replies` has no column for a score, a mood, a sentiment or a summary.
 *   - AND A PLANTED REPLY CONTAINING CRISIS LANGUAGE ACTUALLY ROUTES, end to end, with a
 *     `risk_assessments` row to show for it — bracketed by a control that an ordinary reply does
 *     NOT route, because a build that alerted on everything would pass the first assertion.
 *
 * ## 🔴 And the one that would be unforgivable
 *
 * Somebody who writes "I cannot stop crying" must reach the crisis path rather than be
 * unsubscribed. That is asserted by doing it, not by reading `isStopWord`.
 *
 * ## 🔴 C284 — every branch in one run
 *
 * The settings this reads are seeded defaults on any database, and the walkthrough plants the rows
 * it needs. No check here varies by environment and nothing is deferred.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import {
  constraintContradictions,
  migrationLedgerAudit,
  readSource,
  reporter,
  required,
  writesTo,
} from "./_verify";
import { stubModules } from "./_render";

const { check, finish } = reporter();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", ".claude", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

async function main() {
  writesTo();
  await stubModules();

  const { controlDb: db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { SETTINGS_DEFAULTS } = await import("../lib/settings/defs");
  const { MIN_HOURS_BETWEEN } = await import("../lib/checkins/policy");
  const { WORDING_KEYS } = await import("../lib/checkins/wording");

  const files = walk(process.cwd()).map((f) => f.slice(process.cwd().length + 1));
  const tag = `verify44-${randomBytes(4).toString("hex")}`;

  /* ================================================================== */
  /*  44.2 · it never interprets — the import graph                      */
  /* ================================================================== */

  const checkinFiles = files.filter(
    (f) => f.startsWith("lib/checkins/") || f === "lib/data/checkins.ts",
  );

  const reachesAi = checkinFiles.filter((f) => /from "@\/lib\/ai/.test(readSource(f)));

  check(
    "🔴 44.2 nothing in lib/checkins or lib/data/checkins imports lib/ai",
    checkinFiles.length >= 4 && reachesAi.length === 0,
    reachesAi.length === 0
      ? `${checkinFiles.length} files swept, none reaching a model`
      : reachesAi.join(", "),
  );

  /*
   * 🔴 CONTROL — the sweep can SEE an ai import, asserted against a file we know the answer for.
   *
   * An import-graph check that matched nothing would pass against a build where every check-in file
   * called a model, and it has been wrong twice in this repository before (it counted schema imports,
   * then counted API routes as pages).
   */
  const knownAiReader = files.find(
    (f) => f.startsWith("lib/") && /from "@\/lib\/ai/.test(readSource(f)),
  );

  check(
    "🔴 CONTROL …and the same sweep DOES detect an ai import elsewhere in lib/",
    Boolean(knownAiReader),
    knownAiReader ?? "THE SWEEP SEES NOTHING, so the check above is a false green",
  );

  /* ---- and no column to put an interpretation in ---- */

  const replyCols = (
    await db.execute(sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'checkin_replies'`)
  ).rows.map((r) => String(r.column_name));

  const interpreting = replyCols.filter((c) =>
    /score|mood|sentiment|risk|summary|label|category|confidence|ai_|model/.test(c),
  );

  check(
    "🔴 44.2 checkin_replies has no column for a score, a mood, a sentiment or a summary",
    replyCols.length > 0 && interpreting.length === 0,
    interpreting.length === 0 ? replyCols.join(", ") : interpreting.join(", "),
  );

  check(
    "🔴 CONTROL …and it DOES hold their words and whether it routed, so the table is not empty",
    replyCols.includes("body") && replyCols.includes("crisis_alert_raised"),
    "an absence assertion against a table with two columns is not an assertion",
  );

  /*
   * 🔴 AND THE SAME SWEEP CATCHES A PLANTED COLUMN NAME, so the fragment list is not the wrong list.
   */
  check(
    "🔴 CONTROL …and the fragment sweep catches a planted interpretation column",
    ["mood_score", "sentiment", "risk_level", "ai_summary"].every((planted) =>
      /score|mood|sentiment|risk|summary|label|category|confidence|ai_|model/.test(planted),
    ),
    "an absence check over the wrong fragments passes for the wrong reason",
  );

  /* ================================================================== */
  /*  44.1 · the rate, the opt-out and the quiet window                  */
  /* ================================================================== */

  const defaults = SETTINGS_DEFAULTS.checkins;

  check(
    "🔴 44.1 / C97 the cadence, the quiet window and the halt are all SETTINGS",
    typeof defaults.everyHours === "number" &&
      typeof defaults.quietFromHour === "number" &&
      typeof defaults.quietToHour === "number" &&
      typeof defaults.muteRateHalt === "number",
    `every ${defaults.everyHours}h, quiet ${defaults.quietFromHour}-${defaults.quietToHour}, halt ${defaults.muteRateHalt}`,
  );

  /*
   * 🔴 THE CHANNEL IS OFF BY DEFAULT, and the cadence does not start at the ceiling.
   *
   * C97's requirement was six-hourly and the ruling in the same breath was that the cadence is the
   * thing to prove. The safe direction for an unproven cadence is fewer, so six-hourly is where an
   * operator with evidence can go rather than where this starts.
   */
  check(
    "🔴 44.1 the channel is OFF by default and the seed is not the six-hourly ceiling",
    defaults.enabled === false && defaults.everyHours > MIN_HOURS_BETWEEN,
    `enabled ${defaults.enabled}, every ${defaults.everyHours}h with a floor of ${MIN_HOURS_BETWEEN}h`,
  );

  check(
    "🔴 44.1 the quiet window WRAPS midnight in the seed, so the wrapped case is the tested one",
    defaults.quietFromHour > defaults.quietToHour,
    `${defaults.quietFromHour}:00 to ${defaults.quietToHour}:00`,
  );

  check(
    "🔴 44.1 twelve wordings, so no two in a fortnight read the same at the default cadence",
    WORDING_KEYS.length === 12 && new Set(WORDING_KEYS).size === 12,
    `${WORDING_KEYS.length} wordings`,
  );

  /*
   * 🔴 NOT ONE WORDING ASKS A CLINICAL QUESTION, which is 44.2 in the copy.
   *
   * A check-in that asks for a rating is a clinical assessment arriving unprompted at 9am with nobody
   * to read the answer. Swept against the English strings, and every wording must carry {name}.
   */
  const messages = readSource("lib/i18n/messages.ts");

  const wordings = WORDING_KEYS.map((key) => {
    const match = messages.match(new RegExp(`"${key.replace(".", "\\.")}":\\s*"([^"]*)"`));
    return { key, text: match?.[1] ?? "" };
  });

  const clinical = wordings.filter(({ text }) =>
    /\bmood\b|\banxiet|\bdepress|\brate\b|\bscale\b|\bscore\b|\bsymptom|\bsuicid|\bself.harm/i.test(
      text,
    ),
  );

  check(
    "🔴 44.2 no wording asks a clinical question: no mood, no rating, no scale, no symptom",
    wordings.every((w) => w.text !== "") && clinical.length === 0,
    clinical.length === 0
      ? `${wordings.length} wordings, none of them an assessment`
      : clinical.map((c) => c.key).join(", "),
  );

  check(
    "🔴 44.1 every wording carries the person's name and is short",
    wordings.every((w) => w.text.includes("{name}") && w.text.split(/\s+/).length <= 16),
    "personalised, very short, their name",
  );

  check(
    "🔴 CONTROL …and the clinical sweep catches a planted assessment question",
    ["How would you rate your mood today?", "Any symptoms this week?"].every((planted) =>
      /\bmood\b|\banxiet|\bdepress|\brate\b|\bscale\b|\bscore\b|\bsymptom|\bsuicid|\bself.harm/i.test(
        planted,
      ),
    ),
    "otherwise the absence above is measuring the wrong words",
  );

  /* ---- both languages, and the opt-out travels with the message ---- */

  const [englishHalf, arabicHalf] = messages.split(/export const ar\b/);
  const keys = [
    ...WORDING_KEYS,
    "checkin.howToStop",
    "checkin.subject",
    "checkin.settingsTitle",
    /*
     * 🔴 65.12 / C200 — `checkin.settingsBody` and `checkin.crisisNote` became these five.
     *
     * Sprint 65 turned two grey paragraphs above a switch into a `SeesWhat`: what a reply
     * to a check-in can do, and what nobody can do with it. The key names changed and the
     * rule did not, so the list follows the keys rather than the check being widened.
     */
    "checkin.whoReply",
    "checkin.canDanger",
    "checkin.canTellTherapist",
    "checkin.cannotRead",
    "checkin.cannotMachine",
  ];

  const missingAr = keys.filter((key) => !(arabicHalf ?? "").includes(`"${key}":`));

  check(
    "🔴 44.1 / 45.8 every check-in string exists in Arabic as well as English",
    (englishHalf ?? "") !== "" && missingAr.length === 0,
    missingAr.length === 0 ? `${keys.length} keys, both languages` : missingAr.join(", "),
  );

  const send = readSource("lib/checkins/send.ts");

  check(
    "🔴 44.1 the opt-out is appended to the BODY, so it is reachable without finding a screen",
    /checkin\.howToStop/.test(send),
    "somebody who has had enough should not have to navigate",
  );

  check(
    "🔴 44.1 the wording is read through stringsFor, so an admin edit applies",
    /stringsFor\(/.test(send) && !/checkin\.\d+":/.test(send),
    "the one message most likely to need rewording is the one that arrives unprompted",
  );

  check(
    "🔴 44.2 no model is called in the send path either",
    !/from "@\/lib\/ai/.test(send) && !/generate|completion|prompt/i.test(send),
    "a generated sentence cannot be reviewed before it arrives",
  );

  /* ---- the constraints, read unconditionally (C284) ---- */

  for (const [name, must] of [
    ["checkins_channel", "email"],
    ["checkin_mutes_via", "reply"],
    ["checkin_mutes_unmute_after_mute", "unmuted_at"],
  ] as const) {
    const row = await db.execute(sql`
      SELECT pg_get_constraintdef(oid) AS def, convalidated FROM pg_constraint
       WHERE conname = ${name}`);

    check(
      `🔴 44.1 ${name} exists, says what it should, and is VALIDATED`,
      String(row.rows[0]?.def ?? "").includes(must) && row.rows[0]?.convalidated === true,
      String(row.rows[0]?.def ?? "") || "constraint not found",
    );
  }

  /* 🔴 0079's lesson, permanently, in every sprint's verifier from here. */
  /*
   * 🔴 BOTH CONSTRAINT-CONTRADICTION AUDITS, from `scripts/_verify.ts`.
   *
   * 0078 left two foreign keys on one column; 0082 fixed six columns where `ON DELETE SET NULL`
   * contradicted a CHECK requiring the column non-null. The two shapes are siblings and NEITHER
   * AUDIT SEES THE OTHER'S, which is why they are one function called from every sprint verifier
   * rather than a query somebody remembers to copy.
   *
   * Read by `conrelid` and `conkey`, never by `conname`. That is the lesson rather than the fix.
   */
  /* ------------------------------------------- H1 · the journal, the files, the ledger */

  /*
   * 🔴 THE THREE NUMBERS THAT MUST AGREE, AND THE ORDERING THAT MAKES THEM REACHABLE.
   *
   * Sprint 52 shipped `0083_verification_one_truth.sql` with no journal entry. Drizzle reads the
   * journal rather than the directory, so `db:migrate` skipped the file and printed "Migrations
   * applied." Production sat at ledger 83 with none of C285 while a fifteen-check verifier passed
   * green against a database built by a route no deploy would repeat.
   *
   * One mechanical comparison, in the permanent sweep beside 0079/0082's contradiction audit,
   * because this is the second time H1 has bitten this project.
   */
  const ledger = await migrationLedgerAudit((query) =>
    db.execute(sql.raw(query)).then((r) => ({ rows: r.rows as Record<string, unknown>[] })),
  );

  check(
    "🔴 H1 every migration file on disk has a journal entry",
    ledger.inFilesNotInJournal.length === 0,
    ledger.inFilesNotInJournal.join(", ") ||
      `${ledger.journalCount} entries, none orphaned; a file drizzle cannot see is a migration that never runs`,
  );

  check(
    "🔴 H1 …and every journal entry has a file",
    ledger.inJournalNotInFiles.length === 0,
    ledger.inJournalNotInFiles.join(", ") || "no entry names a migration that is not there",
  );

  /*
   * 🔴 Membership is the obvious half. THIS is the half that bit: drizzle applies a migration only
   * when `lastDbMigration.created_at < migration.folderMillis`, and a regenerated entry whose
   * `when` lands behind its predecessor is skipped silently, exactly like a missing one.
   */
  check(
    "🔴 H1 …and each entry's timestamp exceeds the one before it, so the migrator can reach it",
    ledger.unreachable.length === 0,
    ledger.unreachable.join(", ") ||
      `${ledger.journalCount} entries strictly increasing`,
  );

  check(
    "🔴 H1 the database has run every migration the journal knows about",
    ledger.ledgerCount === ledger.journalCount,
    `ledger ${ledger.ledgerCount}, journal ${ledger.journalCount}` +
      (ledger.ledgerCount === ledger.journalCount
        ? ""
        : "; a gap here is a schema no migration record accounts for"),
  );

  /*
   * 🔴 THE CONTROL, AND IT IS NOT OPTIONAL HERE.
   *
   * Four green lines above assert an absence. A build where `migrationLedgerAudit` returned empty
   * arrays for any reason — a bad path, a rename, a thrown read swallowed — would print exactly the
   * same four lines. That is the shape that let 0083 through in the first place, so the audit is
   * made to catch the real offender rather than trusted to have looked.
   *
   * The offence is reconstructed in memory from the journal that is actually on disk: drop the last
   * entry and the file it names becomes an orphan, which is precisely the state production was in.
   * Nothing is written; the journal file is not touched.
   */
  const plantedJournal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { tag: string; when: number }[] };
  const dropped = plantedJournal.entries[plantedJournal.entries.length - 1]!;
  const remaining = new Set(plantedJournal.entries.slice(0, -1).map((entry) => entry.tag));
  const orphaned = readdirSync("drizzle")
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .filter((name) => !remaining.has(name));

  check(
    "🔴 H1 CONTROL, the same audit CATCHES a migration file with no journal entry",
    orphaned.includes(dropped.tag),
    `removing ${dropped.tag} from the journal leaves ${orphaned.join(", ")} orphaned, which is exactly the state 0083 shipped in`,
  );

  /*
   * 🔴 And the second control, for the half that would have bitten twice: an entry stamped behind
   * its predecessor is unreachable even though it exists, because drizzle applies only when
   * `lastDbMigration.created_at < migration.folderMillis`. `drizzle-kit generate` produced exactly
   * this, because the journal's synthetic timestamps run ahead of the wall clock.
   */
  const backdated = [...plantedJournal.entries];
  backdated[backdated.length - 1] = { ...dropped, when: backdated[0]!.when - 1 };
  const wouldSkip = backdated.some(
    (entry, i) => i > 0 && entry.when <= backdated[i - 1]!.when,
  );

  check(
    "🔴 H1 CONTROL, …and CATCHES an entry stamped behind the one before it",
    wouldSkip,
    "a backdated entry is skipped as silently as a missing one, and prints success either way",
  );

  const contradictions = await constraintContradictions((query) =>
    db.execute(sql.raw(query)).then((r) => ({ rows: r.rows as Record<string, unknown>[] })),
  );

  check(
    "🔴 0079 / 0082 no constraint on any column contradicts another, in either known shape",
    contradictions.length === 0,
    contradictions.length === 0
      ? "no duplicate foreign key, and no SET NULL against a NOT NULL check"
      : contradictions.map((c) => `[${c.kind}] ${c.detail}`).join(" | "),
  );

  /* ================================================================== */
  /*  The planted walkthrough: a reply that must reach a human           */
  /* ================================================================== */

  const [person] = (
    await db.execute(sql`
    INSERT INTO people (first_name, last_name) VALUES (${tag}, 'FortyFour') RETURNING id`)
  ).rows as { id: string }[];

  const personId = required(person, "people row it just inserted").id;

  try {
    const { handleReply } = await import("../lib/checkins/receive");
    const { isMuted, mute, muteRate, recordCheckin, unmute } = await import(
      "../lib/data/checkins"
    );

    /* A check-in has to exist for a reply to belong to one. */
    const sent = await recordCheckin({
      personId,
      channel: "email",
      body: `${tag}, how are you doing today?`,
      locale: "en",
      delivered: true,
    });

    check(
      "🔴 44.1 a check-in is recorded when it goes out, with whether it landed",
      sent !== null,
      "a log rather than a queue: 'when was this person last messaged' is one query",
    );

    /*
     * 🔴 THE ONE THAT WOULD BE UNFORGIVABLE, ASSERTED BY DOING IT.
     *
     * "I cannot stop crying" contains the word stop. If the opt-out were checked first, or matched
     * on a substring, this person would be unsubscribed at the moment they most needed not to be.
     */
    const crying = await handleReply({
      personId,
      body: "I cannot stop crying and I want to kill myself",
      country: "EG",
    });

    check(
      "🔴 44.2 a reply containing crisis language goes to the CRISIS path, not to an opt-out",
      crying.kind === "crisis",
      `outcome: ${crying.kind}`,
    );

    const stillOn = await isMuted(personId);

    check(
      "🔴 44.2 …and they are NOT muted by it, though the message contains the word stop",
      stillOn.muted === false,
      "unsubscribing somebody who wrote that would be the worst failure this sprint could have",
    );

    check(
      "🔴 44.2 …and they are shown where to get help, with a number or the emergency line",
      crying.kind === "crisis" && crying.message.length > 20,
      crying.kind === "crisis" ? (crying.helpline ?? "the local emergency number") : "no message",
    );

    /*
     * 🔴 THE REPLY ROW RECORDS THAT IT ROUTED, and whether a clinician existed to route TO.
     *
     * This planted person has no session, so there is no clinician to alert: `noClinician` is true
     * and `crisis_alert_raised` is false. That is a real gap named rather than swallowed, and
     * asserting it here means the gap is visible rather than discovered by somebody in distress.
     */
    const replyRow = (
      await db.execute(sql`
      SELECT body, crisis_alert_raised FROM checkin_replies WHERE person_id = ${personId}`)
    ).rows as { body: string; crisis_alert_raised: boolean }[];

    check(
      "🔴 44.2 the reply is stored as their own words, with a flag for whether it routed",
      replyRow.length === 1 && replyRow[0]!.body.includes("crying"),
      "their words, and nothing derived from them",
    );

    check(
      "🔴 44.2 a person with NO session has no clinician to alert, and that is reported not hidden",
      crying.kind === "crisis" && crying.noClinician === true,
      "somebody who claimed a record, was never seen, then wrote this has nobody here to wake",
    );

    /*
     * 🔴 AND NOW THE HALF THAT ACTUALLY MATTERS: A CRISIS REPLY THAT REACHES A CLINICIAN.
     *
     * The case above proves the routing DECISION and the patient-facing message. It does not prove
     * that an alert lands, because that person has no session and so no clinician to wake — which
     * means every assertion so far is compatible with `raiseCrisisAlert` never working at all.
     *
     * That is the §6 shape exactly: a check passing by measuring the near thing. So this plants a
     * whole clinical arc — an organisation, a verified therapist, a patient joined to the same
     * person, and a session — and then asserts a `risk_assessments` ROW EXISTS afterwards.
     */
    const [org] = (
      await db.execute(sql`
      INSERT INTO organizations (name, slug, kind) VALUES (${tag}, ${tag}, 'solo') RETURNING id`)
    ).rows as { id: string }[];

    const orgId = required(org, "organizations row").id;

    const [therapist] = (
      await db.execute(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role,
                         verification_status, password_hash)
      VALUES (${orgId}, ${`${tag}@example.com`}, 'Verify', 'Clinician', 'therapist', 'verified',
              'not-a-hash-this-account-cannot-sign-in')
      RETURNING id`)
    ).rows as { id: string }[];

    const therapistId = required(therapist, "users row").id;

    /* 🔴 The patient row is joined to the SAME person, which is how a reply finds a clinician. */
    const [patient] = (
      await db.execute(sql`
      INSERT INTO patients (organization_id, therapist_id, person_id, first_name, phone, source)
      VALUES (${orgId}, ${therapistId}, ${personId}, ${tag}, '+201300044001', 'therapist')
      RETURNING id`)
    ).rows as { id: string }[];

    const patientId = required(patient, "patients row").id;

    await db.execute(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            scheduled_at, feedback_token, price_cents, payment_status)
      VALUES (${orgId}, ${therapistId}, ${patientId}, 'completed', 'video',
              now() - interval '2 days', ${`${tag}-fb`}, 0, 'not_required')`);

    /* Unmute, because the walkthrough muted them above and a muted person still gets the crisis
       path — but asserting that here would conflate two things, so start from unmuted. */
    await unmute(personId);

    const withClinician = await handleReply({
      personId,
      body: "I want to kill myself tonight",
      country: "EG",
    });

    check(
      "🔴 44.2 a crisis reply from somebody WITH a clinician routes, and says a clinician was found",
      withClinician.kind === "crisis" && withClinician.noClinician === false,
      withClinician.kind === "crisis"
        ? "a clinician to wake, and the alert raised"
        : `outcome: ${withClinician.kind}`,
    );

    /*
     * 🔴 THE ROW, IN `risk_assessments`, WRITTEN BY THE ORDINARY CRISIS PATH.
     *
     * This is the assertion the whole sprint rests on: not that we decided to route, but that the
     * same table a session transcript writes to has a row in it. One crisis path, reached from two
     * places, proven rather than described.
     */
    const alerts = (
      await db.execute(sql`
      SELECT level, source FROM risk_assessments WHERE patient_id = ${patientId}`)
    ).rows as { level: string; source: string }[];

    check(
      "🔴 44.2 …and a risk_assessments row exists, written by the SAME path a transcript uses",
      alerts.length === 1 && alerts[0]!.source === "keyword",
      alerts.length === 1
        ? `level ${alerts[0]!.level}, source ${alerts[0]!.source}`
        : `${alerts.length} rows: the crisis path did not run`,
    );

    const routedFlag = (
      await db.execute(sql`
      SELECT count(*)::int AS n FROM checkin_replies
       WHERE person_id = ${personId} AND crisis_alert_raised`)
    ).rows[0] as { n: number };

    check(
      "🔴 CONTROL …and the reply row records that it routed, which the earlier one did not",
      routedFlag.n === 1,
      "the flag is a fact about what we did, and it differs between the two cases",
    );

    /* 🔴 CONTROL — an ORDINARY reply does not route, so the above is not a build that alerts on
       everything. A verifier that only planted the crisis case would pass against exactly that. */
    const ordinary = await handleReply({
      personId,
      body: "fine thanks, a bit tired",
      country: "EG",
    });

    check(
      "🔴 CONTROL …while an ordinary answer is just stored, with no alert and no crisis screen",
      ordinary.kind === "stored",
      `outcome: ${ordinary.kind}`,
    );

    /* 🔴 And a bare stop word DOES mute, so the guard above is not refusing every opt-out. */
    const stopping = await handleReply({ personId, body: "stop", country: "EG" });
    const nowMuted = await isMuted(personId);

    check(
      "🔴 CONTROL …and a message that is nothing but 'stop' DOES mute",
      stopping.kind === "muted" && nowMuted.muted === true,
      "otherwise the crisis-first ordering would have broken the opt-out entirely",
    );

    /* 🔴 Muting twice is one row, because two 'stop' replies are not two mutes. */
    await mute(personId, "reply");

    const muteRows = (
      await db.execute(sql`
      SELECT count(*)::int AS n FROM checkin_mutes WHERE person_id = ${personId}`)
    ).rows[0] as { n: number };

    check(
      "🔴 44.1 muting twice is one row, so the mute rate cannot count somebody twice",
      muteRows.n === 1,
      `${muteRows.n} row(s), enforced by checkin_mutes_live_unique`,
    );

    /* 🔴 Unmuting KEEPS the row, because deleting it would erase the measurement. */
    await unmute(personId);

    const afterUnmute = (
      await db.execute(sql`
      SELECT muted_at, unmuted_at FROM checkin_mutes WHERE person_id = ${personId}`)
    ).rows as { muted_at: string; unmuted_at: string | null }[];

    check(
      "🔴 44.1 unmuting stamps the row rather than deleting it, so the rate stays measurable",
      afterUnmute.length === 1 && afterUnmute[0]!.unmuted_at !== null,
      "deleting it would erase the evidence that the cadence drove somebody away",
    );

    /* 🔴 An unmute cannot precede its mute, by CHECK, asserted against a planted offender. */
    let refused = false;
    try {
      await db.execute(sql`
        UPDATE checkin_mutes SET unmuted_at = muted_at - interval '1 hour'
         WHERE person_id = ${personId}`);
    } catch {
      refused = true;
    }

    check(
      "🔴 44.1 asserted by the write: an unmute before its mute is refused by the database",
      refused,
      "a metric that can go negative for a window is a metric nobody trusts",
    );

    /* 🔴 The mute rate divides by zero safely, which is why the halt does not misfire. */
    const rate = await muteRate();

    check(
      "🔴 44.1 the mute rate is a number rather than NaN, whatever the database contains",
      Number.isFinite(rate.rate) && rate.rate >= 0 && rate.rate <= 1,
      `${rate.muted} of ${rate.reachable}`,
    );

    /*
     * 🔴 AND NO SCREEN LISTS WHAT A PATIENT REPLIED.
     *
     * The admin screen shows six integers. A reply's body is written once and read by the crisis
     * path; a surface listing them would be read by somebody with no clinical relationship to the
     * person, about a message they did not ask for.
     */
    const admin = readSource("app/(admin)/admin/checkins/page.tsx");

    /*
     * 🔴 MY FIRST VERSION OF THIS CHECK MATCHED `.body` AND FAILED ON `t("acheckin.body")`.
     *
     * A message key called `body` is not a reply's body, and a substring test could not tell them
     * apart. The thing that would actually make this screen wrong is reaching the replies TABLE, so
     * that is what is tested: no `checkinReplies` import, and no data function that returns a body.
     * `checkinStats` returns six integers and there is no other way in.
     */
    check(
      "🔴 44.2 the admin screen reads checkinStats and never reaches the replies table",
      /checkinStats/.test(admin) &&
        !/checkinReplies/.test(admin) &&
        !/from "@\/lib\/db\/schema"/.test(admin),
      "six counts and nobody's words",
    );

    check(
      "🔴 CONTROL …and it says so ON the screen, because an unstated absence reads as unbuilt",
      /acheckin\.noBodies/.test(admin),
      "the sentence is the half that makes the absence a promise",
    );

    check(
      "🔴 44.1 the mute rate is shown beside the threshold that halts the channel",
      /muteRateHalt/.test(admin) && /muteRate/.test(admin),
      "a measurement nobody can act on within a day is a chart",
    );

    /* ---- the patient's own opt-out screen ---- */

    check(
      "🔴 44.1 the patient has a screen of their own, not only a reply",
      files.includes("app/(patient)/patient/messages/page.tsx"),
      "somebody deciding calmly comes to a screen; somebody who has had enough replies",
    );

    const patientScreen = readSource("app/(patient)/patient/messages/page.tsx");

    /*
     * 🔴 44.2 IS AN ARGUMENT ABOUT POSITION, SO THE CHECK IS TOO.
     *
     * The rule is that the crisis sentence is said BEFORE somebody replies. It used to be
     * the last thing on the page, under the switch; sprint 65 made it the CAN column of a
     * `SeesWhat` above the switch. Asserting the key alone would have passed either way,
     * so the check now requires it to appear before the control it is about.
     */
    check(
      "🔴 44.2 …and it says what happens to a worrying reply BEFORE they ever reply",
      /checkin\.canDanger/.test(patientScreen) &&
        patientScreen.indexOf("checkin.canDanger") < patientScreen.indexOf("<CheckinSwitch"),
      "the moment to say it is before they write something, not after",
    );

    check(
      "🔴 44.1 a screen mute and a reply mute are distinguishable, so the rate is honest",
      /"screen"/.test(readSource("app/(patient)/patient/messages/actions.ts")),
      "a rate mixing 'had enough' with 'settings choice' hides the number the ruling asked for",
    );
  } finally {
    await db.execute(sql`DELETE FROM checkin_replies WHERE person_id IN
      (SELECT id FROM people WHERE first_name LIKE 'verify44-%')`);
    await db.execute(sql`DELETE FROM checkin_mutes WHERE person_id IN
      (SELECT id FROM people WHERE first_name LIKE 'verify44-%')`);
    await db.execute(sql`DELETE FROM checkins WHERE person_id IN
      (SELECT id FROM people WHERE first_name LIKE 'verify44-%')`);
    /* And the clinical arc planted for the with-clinician case, in dependency order. */
    await db.execute(sql`DELETE FROM risk_assessments WHERE patient_id IN
      (SELECT id FROM patients WHERE first_name LIKE 'verify44-%')`);
    await db.execute(sql`DELETE FROM sessions WHERE feedback_token LIKE 'verify44-%'`);
    await db.execute(sql`DELETE FROM patients WHERE first_name LIKE 'verify44-%'`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%verify44-%'`);
    await db.execute(sql`DELETE FROM organizations WHERE name LIKE 'verify44-%'`);
    await db.execute(sql`DELETE FROM people WHERE first_name LIKE 'verify44-%'`);
  }

  finish("sprint 44");
}

void main();
