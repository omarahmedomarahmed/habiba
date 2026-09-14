/**
 * Sprint 67 acceptance: the clinic's own records connection.
 *
 *   npm run verify:sprint67
 *
 * ## 🔴 The sentence this sprint exists for
 *
 * > **EHR and FHIR are a clinic setting, on the clinic plan.** `lib/ehr/` already does
 * > SMART-on-FHIR and `/clinic/records` already begins a connection. What is missing
 * > is that it reads like an engineer's screen, has no plan gate, and goes silent the
 * > moment anything fails.
 *
 * So every check below is about one of those three, and the largest of them is the
 * third: a records connection that fails silently is a note that did not reach a
 * hospital chart with nobody knowing, which is a clinical fact rather than an
 * infrastructure detail (67.6).
 */
import { sql } from "drizzle-orm";

import { readSource, reporter, writesTo } from "./_verify";
import { stubModules } from "./_render";
import { connect } from "./db";

const { check, finish } = reporter();

async function main() {
  await stubModules();
  writesTo();

  const panel = readSource("components/ehr/records-panel.tsx");
  const ehr = readSource("lib/data/ehr.ts");
  const fileNote = readSource("lib/ehr/file-note.ts");

  /* ================================================================== */
  /*  67.1 · clinic plan only, and a solo practice is TOLD WHY           */
  /* ================================================================== */

  check(
    "🔴 67.1 a solo practice gets a sentence, not a disabled button",
    /records\.planInstead/.test(panel) && !/disabled=\{!onClinicPlan\}/.test(panel),
    "a disabled control tells somebody they are missing something and nothing else",
  );

  check(
    "🔴 67.1 …and the sentence names what to use instead",
    (() => {
      const en = readSource("lib/i18n/messages.ts");
      return /A full export of every record you hold|a full export of every record you hold/i.test(
        en,
      );
    })(),
    "`lib/data/portability.ts` is the right tool for a practice of one, and the upsell says so",
  );

  check(
    "🔴 67.1 the gate is the ORGANISATION's kind, not a plan tier",
    /export async function isClinicOrganization/.test(ehr) && /kind === "clinic"/.test(ehr),
    "a clinic on a lapsed subscription still has three clinicians whose notes belong in one chart",
  );

  /* ================================================================== */
  /*  67.2 / 67.3 · pick your system, and the steps change per vendor    */
  /* ================================================================== */

  const { VENDORS } = await import("../lib/ehr/vendors");

  check(
    "🔴 67.2 every vendor has a name and its own reason a connection may be blocked",
    Object.values(VENDORS).every(
      (vendor) => vendor.name.length > 0 && vendor.mayBeBlocked.length > 60,
    ),
    Object.values(VENDORS)
      .map((vendor) => vendor.name)
      .join(", "),
  );

  check(
    "🔴 67.3 …and the blocking reason is on the SCREEN rather than in a support reply",
    /mayBeBlocked/.test(panel),
    "a hospital's own approval timeline is the commonest reason this does not work, and it is not ours",
  );

  /* ================================================================== */
  /*  67.4 · connected means a token that WORKS                          */
  /* ================================================================== */

  check(
    "🔴 67.4 the indicator reads a SUCCESSFUL call, never the OAuth exchange",
    /connection\.lastSuccessAt/.test(panel) && /records\.neverAnswered/.test(panel),
    "a hospital rotating a secret leaves connected_at where it is while every filing fails",
  );

  check(
    "🔴 67.4 …and the stamp is written by the thing that actually calls their server",
    /recordConnectionResult/.test(fileNote) &&
      /export async function recordConnectionResult/.test(ehr),
    "a column stamped anywhere else is a column stamped without a call having happened",
  );

  /*
   * 🔴 BOTH DIRECTIONS, IN ONE FUNCTION, and that is the check that matters.
   *
   * Two functions is how a connection ends up green with last week's error beside it:
   * somebody remembers to clear the error on success in one place and not the other.
   */
  check(
    "🔴 67.4 the error is CLEARED on success and set on failure, in one function",
    /lastSuccessAt: new Date\(\), lastError: null/.test(ehr),
    "a stale error beside a working connection sends somebody chasing a fixed problem",
  );

  check(
    "🔴 67.6 a failure stamps the connection too, not only the filing row",
    (() => {
      const refused = fileNote.indexOf('state: "refused"');
      const stamped = fileNote.indexOf("ok: false");
      return refused > 0 && stamped > refused;
    })(),
    "a note that did not reach a hospital chart is a clinical fact, not an infrastructure detail",
  );

  /* ================================================================== */
  /*  67.5 · the writeback log, on the clinic's own page                 */
  /* ================================================================== */

  check(
    "🔴 67.5 the log names WHICH CLINICIAN approved the note",
    /approvedByUserId/.test(ehr) && /filing\.approvedBy/.test(panel),
    "a failed filing means somebody's note is not in the chart, and that person has to be told",
  );

  check(
    "🔴 67.5 …and the status their server returned, which is what an engineer reads first",
    /responseStatus/.test(panel) && /responseStatus: status/.test(fileNote),
    "'422' is the whole answer somebody on a call with an integration team needs",
  );

  check(
    "🔴 67.5 …and a filing whose clinician has LEFT still appears in the log",
    /leftJoin\(users, eq\(users\.id, ehrWritebacks\.approvedByUserId\)\)/.test(ehr),
    "an inner join would take a failed filing away with the person who wrote it",
  );

  /* ================================================================== */
  /*  67.7 · disconnect says what stops                                  */
  /* ================================================================== */

  check(
    "🔴 67.7 the disconnect control names how many clinicians it stops",
    /records\.disconnectCount/.test(panel) && /export async function filersOn/.test(ehr),
    "without the count the button reads as undoing a setting",
  );

  check(
    "🔴 67.7 …and it is a COUNT of distinct clinicians, not of filings",
    /count\(distinct \$\{ehrWritebacks\.approvedByUserId\}\)/.test(ehr),
    "'400 notes' is a number about us; '12 clinicians' is a number about their practice",
  );

  /* ================================================================== */
  /*  67.8 · nothing on this page is clinical                            */
  /* ================================================================== */

  /*
   * 🔴 THE SELECT LIST, READ, rather than the paragraph above it.
   *
   * A delivery log carries a reference and a status. `note_id` points at our own row,
   * which is behind the clinical guard; `fhir_document_reference_id` is THEIR id for
   * the document they now hold. Neither is text a practice manager could read.
   */
  const writebacksBody = (() => {
    const start = ehr.indexOf("export async function writebacksFor");
    if (start === -1) return "";
    const end = ehr.indexOf("\n}\n", start);
    return end === -1 ? "" : ehr.slice(start, end);
  })();

  const CLINICAL = /\b(content|text|body|soap|summary|transcript|diagnosis|assessment|plan)\b/i;

  check(
    "🔴 67.8 the writeback log selects nothing that could hold note content",
    writebacksBody.length > 300 && !CLINICAL.test(writebacksBody),
    writebacksBody.length > 300
      ? "a reference, a state, a status, a clinician and a time"
      : "the body extraction failed",
  );

  check(
    "🔴 67.8 CONTROL the same scan CATCHES a column somebody would add",
    ["content", "noteText", "soap", "summary"].some((column) => CLINICAL.test(column)),
    "content · noteText · soap · summary",
  );

  /*
   * 🔴 AND THE PANEL RENDERS NO CLINICAL WORD EITHER, which the matrix cannot see.
   *
   * 58.6 proves the import graph. This reads the component the clinic portal actually
   * renders, because a leak is an absence as often as it is a value and a component
   * could fetch something the graph permits and print it.
   */
  const CLINICAL_WORDS = [
    "transcript",
    "diagnosis",
    "journal",
    "soap",
    "subjective",
    "assessment",
  ];
  const leaked = CLINICAL_WORDS.filter((word) => panel.toLowerCase().includes(word));

  check(
    "🔴 67.8 the records panel's own source carries no clinical word",
    leaked.length === 0,
    leaked.join(", ") || `${CLINICAL_WORDS.length} words looked for`,
  );

  /* ================================================================== */
  /*  67.9 · Arabic                                                      */
  /* ================================================================== */

  const { DICTIONARIES } = await import("../lib/i18n/messages");

  const NEW_KEYS = [
    "records.planTitle",
    "records.planBody",
    "records.planInstead",
    "records.lastAnswered",
    "records.neverAnswered",
    "records.disconnectCount",
    "records.disconnectNone",
  ] as const;

  for (const locale of ["en", "ar"] as const) {
    const missing = NEW_KEYS.filter(
      (key) => typeof DICTIONARIES[locale][key] !== "string" || !DICTIONARIES[locale][key],
    );
    check(
      `🔴 67.9 every new string on this screen exists in ${locale.toUpperCase()}`,
      missing.length === 0,
      missing.join(", ") || `${NEW_KEYS.length} strings`,
    );
  }

  /* ================================================================== */
  /*  the database, as it actually is                                    */
  /* ================================================================== */

  const { pool, db } = connect();

  try {
    const columns = await db.execute(sql`
      SELECT table_name, column_name FROM information_schema.columns
       WHERE (table_name = 'ehr_connections' AND column_name IN ('last_success_at', 'last_error'))
          OR (table_name = 'ehr_writebacks'
              AND column_name IN ('approved_by_user_id', 'response_status'))`);

    const found = columns.rows.map((row) => {
      const r = row as { table_name: string; column_name: string };
      return `${r.table_name}.${r.column_name}`;
    });

    check(
      "🔴 H1 every column this sprint needs exists in the database",
      found.length === 4,
      found.join(", "),
    );

    /*
     * 🔴 AND `ehr_writebacks` STILL HAS NOWHERE TO PUT NOTE CONTENT.
     *
     * 43.4's rule, asserted against the CATALOGUE rather than the schema file, because
     * a column added by a migration nobody re-read is exactly how this would go wrong.
     */
    const all = await db.execute(sql`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ehr_writebacks'`);

    const names = all.rows.map((row) => (row as { column_name: string }).column_name);
    const clinical = names.filter((name) => CLINICAL.test(name));

    check(
      "🔴 67.8 no column on `ehr_writebacks` could hold note content",
      clinical.length === 0,
      clinical.join(", ") || `${names.length} columns scanned`,
    );
  } finally {
    await pool.end();
  }

  finish("sprint 67");
}

main();
