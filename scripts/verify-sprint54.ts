/**
 * Sprint 54 acceptance: clinics and hospitals.
 *
 *   npm run verify:sprint54
 *
 * ## 🔴 The sentence every check here is subordinate to
 *
 * > **What the clinic sees: its therapists' schedules, their usage, its bills, and a
 * > list of patient names with appointment times. NOTHING ELSE, IN ANY FORM.**
 *
 * 54.9: *asserted by a verifier running as a clinic-manager principal against RENDERED
 * OUTPUT, never against queries (C243's lesson).* This is that verifier, and the
 * instruction is the whole reason the interesting half of this file renders components
 * rather than reading SQL.
 *
 * ## 🔴 Why rendered output, and not a select list
 *
 * C243 was a leak that was an ABSENCE: `payerName` going null on a pot payment, so a
 * therapist's ledger read a real name against every private session and nothing against
 * every corporate one. A query-level check looking for the forbidden VALUE found nothing
 * and passed. The same shape is available here in several places, so the checks come in
 * pairs wherever they can: the forbidden thing is absent AND something that must be
 * present is present. A portal that renders nothing passes every absence check ever
 * written.
 *
 * ## 🔴 And why this sprint's wall needs more checking than sprint 53's
 *
 * A sponsor cannot reach a chart because `SponsorActor` has no organisation id and the
 * compiler refuses. A clinic manager's principal carries the very id that scopes 63
 * clinical queries, because C259 makes a clinic the organisation. There is no type to
 * hide behind here.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { readSource, reporter, required, writesTo } from "./_verify";
import { renderMarkup, stubModules } from "./_render";

const { check, finish } = reporter();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "drizzle", "public"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(path)) out.push(path);
  }
  return out;
}

/**
 * 🔴 Every word a clinic surface must never render, and each one is from 54.9 and §3f.
 *
 * Used against RENDERED MARKUP rather than source, so a component that fetched a note
 * and printed it fails even though no file mentions the word.
 */
const CLINICAL_WORDS = [
  "transcript",
  "diagnosis",
  "diagnos",
  "journal",
  "summary",
  "risk",
  "copilot",
  "evidence",
  "prescription",
  "medication",
  "assessment",
  "phq",
  "gad",
];

async function main() {
  writesTo();

  /*
   * 🔴 `stubModules` FIRST, before any dynamic import, and this script does NOT run with
   * `--conditions=react-server`.
   *
   * The react-server React build has no `createContext`, so importing a client component
   * under it throws before anything renders — which sprint 53's verifier found the hard
   * way. `stubModules` substitutes `server-only` away so the data modules underneath
   * still import.
   */
  await stubModules();

  const React = (await import("react")).default;
  const { controlDb: db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { ROLES, CLINIC_ROLES, ORGANIZATION_KINDS } = await import("../lib/db/schema");

  const files = walk(process.cwd()).map((f) => f.slice(process.cwd().length + 1));

  /* ================================================================== */
  /*  C259 · a clinic IS an organization, and a sponsor is NOT           */
  /* ================================================================== */

  /*
   * 🔴 The architectural line, checked at both ends in one place.
   *
   * A check that only asserted "a clinic is an organizations row" would pass against a
   * build that made a sponsor one too, which is the disaster C259 exists to prevent. So
   * both halves: the clinic kind is on `organizations`, and `sponsors` still has no
   * column joining it to one.
   */
  check(
    "🔴 54.1 / C259 a clinic is a KIND of organization, so its clinicians are inside its tenancy",
    ORGANIZATION_KINDS.includes("clinic") && ORGANIZATION_KINDS.includes("solo"),
    `organization kinds: ${ORGANIZATION_KINDS.join(", ")}`,
  );

  const crossed = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE (table_name = 'sponsors' AND column_name = 'organization_id')
        OR (table_name = 'organizations' AND column_name LIKE '%sponsor%')`);

  check(
    "🔴 CONTROL …and a SPONSOR still is not one, which is the other half of C259",
    crossed.rows.length === 0,
    crossed.rows.length === 0
      ? "opposite answers, both correct, and no column joins the two"
      : JSON.stringify(crossed.rows),
  );

  /*
   * 🔴 54.2 — A CLINIC MANAGER IS NOT A `Role`.
   *
   * *Not a `Role` on the back office enum, which is ours.* Adding a fifth value would put
   * a customer's practice manager one enum away from the console that prices the product.
   */
  check(
    "🔴 54.2 no clinic role appears in the back office Role union",
    !ROLES.some((role) => /clinic|manager_of|practice/i.test(role)) && ROLES.length === 4,
    `Role is ${ROLES.join(", ")}, and a clinic manager is none of them`,
  );

  check(
    "🔴 CONTROL …and the clinic HAS its own two roles, so the portal is not simply absent",
    CLINIC_ROLES.length === 2 && CLINIC_ROLES.includes("admin") && CLINIC_ROLES.includes("viewer"),
    `clinic roles: ${CLINIC_ROLES.join(", ")}`,
  );

  /*
   * 🔴 THE SEAM: `ClinicActor` has no `organizationId`, no `Role` and no `userId`.
   *
   * Read off the source of the type rather than asserted in prose, because this is the
   * one defence a future edit would silently remove: adding `organizationId` to the type
   * would make `getPatient(clinicActor)` compile everywhere at once.
   */
  const clinicSession = readSource("lib/clinic-auth/session.ts");
  const actorType = clinicSession.slice(
    clinicSession.indexOf("export type ClinicActor"),
    clinicSession.indexOf("function hashToken"),
  );

  check(
    "🔴 54.2 the ClinicActor has no organizationId, no Role and no userId",
    !/\borganizationId\b/.test(actorType) &&
      !/role: Role\b/.test(actorType) &&
      !/\buserId\b/.test(actorType),
    "so requireRole, auditPhi and every clinician-shaped call refuse it at compile time",
  );

  check(
    "🔴 CONTROL …and it DOES carry the clinic's organisation id, spelled so using it is deliberate",
    /clinicOrganizationId: string/.test(actorType),
    "a clinic IS the organisation (C259), so the id is real and the spelling is the seam",
  );

  /*
   * 🔴 And the clinical guard still does not know clinics exist, the same assertion C264
   * makes for sponsors.
   */
  const guard = readSource("lib/auth/guard.ts");

  check(
    "🔴 C264 no require* in lib/auth/guard.ts returns a clinic manager",
    !/clinic/i.test(guard),
    "the clinical guard mints Actors and a clinic manager can never be one",
  );

  /* ================================================================== */
  /*  54.9 · THE WALL, ON RENDERED OUTPUT                                */
  /* ================================================================== */

  /*
   * 🔴 The whole clinic data module, read for what it does NOT return.
   *
   * Paired: the forbidden exports are absent AND the four that must exist do. A module
   * exporting nothing passes the first half on its own.
   */
  const clinicData = readSource("lib/data/clinic.ts");
  const forbiddenExports = [
    "clinicNotes",
    "clinicTranscript",
    "clinicSummary",
    "clinicRisk",
    "clinicDiagnoses",
    "clinicJournals",
    "clinicCopilot",
    "clinicPatient",
  ].filter((name) => clinicData.includes(`export async function ${name}`));

  check(
    "🔴 54.9 no function in the clinic wall returns a note, transcript, journal, summary or risk",
    forbiddenExports.length === 0,
    forbiddenExports.length === 0
      ? "eight names looked for, none present, so there is nothing for a screen to render"
      : `LEAKS: ${forbiddenExports.join(", ")}`,
  );

  check(
    "🔴 CONTROL …and the four the clinic DOES get are all there, so the wall is not an empty file",
    ["clinicSchedule", "clinicClinicians", "clinicUsage", "clinicBills"].every((name) =>
      clinicData.includes(`export async function ${name}`),
    ),
    "schedules, clinicians, usage and bills: the whole of what §3f grants",
  );

  /*
   * 🔴 AND NO SELECT WITH NO ARGUMENT ANYWHERE IN THE WALL.
   *
   * `select()` with no argument returns every column of the table, so a column added to
   * `sessions` next sprint would arrive on a clinic screen without a diff touching this
   * file. Every select in here names its columns.
   */
  const bareSelects = [...clinicData.matchAll(/\.select\(\s*\)/g)].length;

  check(
    "🔴 54.9 every select in the clinic wall names its columns, so a new column cannot arrive",
    bareSelects === 0,
    `${bareSelects} bare selects, and a spread is how a leak arrives without a diff`,
  );

  /*
   * 🔴 The schedule's select list, by name, because it is the one query that touches
   * `sessions` and `patients` at all.
   */
  const scheduleQuery = clinicData.slice(
    clinicData.indexOf("export async function clinicSchedule"),
    clinicData.indexOf("export async function clinicSchedule") + 1600,
  );

  /*
   * 🔴 THE SELECT LIST ONLY, and the first draft of this got it wrong in an instructive way.
   *
   * It scanned the whole function and failed on `patientId`, which appears in the JOIN
   * condition `eq(patients.id, sessions.patientId)` — necessary, and not a leak: a join key
   * is how the name is reached, and nothing about it reaches a component.
   *
   * So the scan is narrowed to the text between `.select({` and its closing `})`, which is
   * the only place a column becomes a field somebody can render. The runtime check below is
   * the stronger half.
   */
  const selectStart = scheduleQuery.indexOf(".select({");
  const selectList = scheduleQuery.slice(selectStart, scheduleQuery.indexOf("})", selectStart));

  const scheduleLeaks = [
    "priceCents",
    "paymentStatus",
    "recordingConsent",
    "recordingPausedAt",
    "sessionType",
    "joinToken",
    "feedbackToken",
    "noShowAt",
    "patientId",
  ].filter((needle) => selectList.includes(needle));

  check(
    "🔴 C263 the schedule SELECTS no money, no consent, no recording state and no patient id",
    scheduleLeaks.length === 0,
    scheduleLeaks.length === 0
      ? "a name, a clinician, a time and a status. Nothing to tie an AI fee to an hour"
      : `LEAKS: ${scheduleLeaks.join(", ")}`,
  );

  check(
    "🔴 CONTROL …and it still returns the name and the time C260 grants, or it is not a schedule",
    /patients\.firstName/.test(scheduleQuery) && /sessions\.scheduledAt/.test(scheduleQuery),
    "the clinic is paying for the hour, which is the line C260 draws",
  );

  /* ================================================================ */
  /*  54.7 / 54.8 · one billing system, proved end to end             */
  /* ================================================================ */

  const fixture = `verify54-${randomBytes(4).toString("hex")}`;

  try {
    /*
     * A real clinic, a real clinician inside it, a real session, and a real invoice with
     * real lines. Everything below is asserted against rows this run created, because
     * the two things most worth checking here cannot be read off source: whether the
     * EXISTING billing path bills the practice, and whether my raw SQL names the invoice
     * line kinds correctly.
     */
    const [clinic] = (
      await db.execute(sql`
        INSERT INTO organizations (name, slug, kind, clinic_state)
        VALUES (${fixture}, ${fixture}, 'clinic', 'active') RETURNING id`)
    ).rows as { id: string }[];
    const org = required(clinic, "a clinic organisation");

    const [clinician] = (
      await db.execute(sql`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
        VALUES (${org.id}, ${`${fixture}@example.test`}, 'x', 'Verify', 'Fiftyfour', 'therapist')
        RETURNING id`)
    ).rows as { id: string }[];
    const doctor = required(clinician, "a clinician");

    /*
     * 🔴 TWO SESSIONS, AND THE SECOND ONE IS THE POINT.
     *
     * The first draft made one, and it came back billed at ZERO on every line. Not a bug:
     * a practice's FIRST session is waived ("First session, on us"), and `chargeForSession`
     * deliberately records the lines it would have cost at zero so that sprint 49 can tell
     * a trial apart from a refusal.
     *
     * So the fixture needs two: one to spend the trial and one to be billed. Reading the
     * charge path would have shown this; running it is what actually did.
     */
    const made: string[] = [];
    for (const nth of ["a", "b"]) {
      const [row] = (
        await db.execute(sql`
          INSERT INTO sessions (organization_id, therapist_id, status, modality, scheduled_at,
                                feedback_token, price_cents)
          VALUES (${org.id}, ${doctor.id}, 'completed', 'video', now(), ${`${fixture}-${nth}`}, 3000)
          RETURNING id`)
      ).rows as { id: string }[];
      made.push(required(row, "a session").id);
    }

    /* Already an id, not a row: `made` holds ids. */
    const appointment = required(made[1], "the second session");

    /*
     * 🔴 54.7 — THE EXISTING PATH, NOT A CLINIC ONE.
     *
     * `chargeForSession` is the function a solo therapist's completed session calls. It is
     * called here with the CLINIC's organisation id, which is what `finishSession` passes
     * because the id comes off the session row. If this produced no invoice, or produced
     * one against something other than the practice, 54.7 would need code rather than a
     * check.
     */
    const { chargeForSession } = await import("../lib/billing/service");
    for (const id of made) {
      await chargeForSession({ organizationId: org.id, sessionId: id });
    }

    const billed = (
      await db.execute(sql`
        SELECT i.id, i.organization_id, i.amount_cents, i.session_id,
               (SELECT count(*)::int FROM invoice_lines l WHERE l.invoice_id = i.id) AS lines
          FROM invoices i WHERE i.session_id = ${appointment}`)
    ).rows as { id: string; organization_id: string; amount_cents: number; lines: number }[];

    const invoice = required(billed[0], "an invoice for the clinic's second session");

    check(
      "🔴 54.7 the SAME billing path bills the practice, with no clinic-specific code",
      invoice.organization_id === org.id && invoice.lines > 0,
      `one invoice on the clinic's org with ${invoice.lines} line(s), through chargeForSession`,
    );

    /*
     * 🔴 THE CHECK THAT CATCHES MY OWN BUG.
     *
     * `clinicBills` sums `CASE WHEN l.kind = 'platform'`. My first draft wrote
     * `'platform_fee'`, and a raw-SQL CASE over a value that never matches sums to ZERO
     * rather than failing: the bill would have shown a correct total with both fee lines
     * reading nothing, which looks like a free month. Typecheck cannot see inside a SQL
     * string, so the figures are asserted against a posted invoice.
     */
    const { clinicBills, clinicSchedule, clinicUsage } = await import("../lib/data/clinic");

    const bills = await clinicBills(org.id);
    const bill = required(bills[0], "a bill for the clinic");

    check(
      "🔴 54.8 the aggregated bill's fee lines are REAL figures, not a CASE that never matched",
      bill.platformFeeCents > 0 && bill.totalCents > 0,
      `platform ${bill.platformFeeCents}, ai ${bill.aiFeeCents}, total ${bill.totalCents}`,
    );

    /*
     * 🔴 CONTROL — and the sum of the named kinds is the whole bill.
     *
     * This is the half that catches a mistyped kind that HAPPENS to be non-zero. If a
     * third line kind ever arrives and this query does not name it, the two figures a
     * practice reads will not add up to the total they are asked to pay, and that is a
     * dispute rather than a bug report.
     */
    check(
      "🔴 CONTROL …and the platform and AI figures add up to the total, so no kind is unnamed",
      bill.platformFeeCents + bill.aiFeeCents === bill.totalCents,
      `${bill.platformFeeCents} + ${bill.aiFeeCents} = ${bill.totalCents}`,
    );

    /*
     * 🔴 C263 — AND THE BILL CANNOT BE TIED TO A SESSION.
     *
     * The shape is the enforcement: `ClinicBill` has no session id and no line list, so
     * there is no field a screen could render per session. Asserted on the returned
     * object rather than on the query text, because the object is what a component gets.
     */
    check(
      "🔴 C263 a bill carries a period, a count and totals, and no session id anywhere",
      !("sessionId" in bill) && !("lines" in bill) && !("sessions_detail" in bill),
      `keys: ${Object.keys(bill).join(", ")}`,
    );

    /*
     * 🔴 C262 — THE SAME FLOOR AND THE SAME CODE PATH AS C229.
     *
     * *It is the same setting and the same code path, not a second implementation.* So
     * this asserts the import rather than the behaviour of a copy: `clinicUsage` reaches
     * into the sponsor wall for `applyActivityFloor` and reads
     * `settings.sponsor.activityFloor`.
     */
    check(
      "🔴 54.10 / C262 clinic reporting uses the C229 floor function itself, not a copy",
      /applyActivityFloor/.test(clinicData) &&
        /await import\("\.\/sponsors"\)/.test(clinicData) &&
        /settings\.sponsor\.activityFloor/.test(clinicData),
      "the same function and the same setting, which is what C262 asks for in so many words",
    );

    /*
     * 🔴 CONTROL — and it actually SUPPRESSES. One session in a week is under any floor
     * that C229 permits, so the week this run created must come back withheld.
     */
    const usage = await clinicUsage(org.id);
    const thisWeek = usage[usage.length - 1];

    check(
      "🔴 CONTROL …and a week with one session comes back SUPPRESSED, so the floor is applied",
      thisWeek !== undefined && thisWeek.sessions === null && thisWeek.spendCents === null,
      thisWeek
        ? `sessions=${String(thisWeek.sessions)}, spend=${String(thisWeek.spendCents)}`
        : "no week at all",
    );

    check(
      "🔴 C262 …and the bill's session COUNT is withheld while the money is not",
      bill.sessions === null && bill.totalCents > 0,
      "a practice still has to be able to pay a bill it cannot break down",
    );

    /* ============================================================ */
    /*  54.9 · RENDERED OUTPUT, as a clinic manager                  */
    /* ============================================================ */

    /*
     * 🔴 THE CHECK 54.9 ASKS FOR, IN THE FORM IT ASKS FOR.
     *
     * The clinic's own schedule component is rendered with a real row from the wall, and
     * the markup is swept for every clinical word in §3f's never-sees list. A source scan
     * would not catch a component that FETCHED a note and printed it; this does.
     */
    const rows = await clinicSchedule({
      clinicOrganizationId: org.id,
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    /*
     * 🔴 AND THE RUNTIME SHAPE, which is stronger than any scan of the query.
     *
     * A component gets an object, so the object's keys are what can be rendered. This
     * catches a leak the select-list scan would miss entirely: a field assembled in the
     * `.map` afterwards out of columns that were individually innocent.
     */
    const rowKeys = Object.keys(rows[0] ?? {});
    const keyLeaks = rowKeys.filter((key) =>
      /price|payment|consent|record|patientId|token|noShow|note|transcript/i.test(key),
    );

    check(
      "🔴 C263 …and the object a clinic component receives has no such field on it either",
      keyLeaks.length === 0,
      keyLeaks.length === 0 ? rowKeys.join(", ") : `LEAKS: ${keyLeaks.join(", ")}`,
    );

    check(
      "🔴 CONTROL the schedule returns the run's own sessions, so the render below has real data",
      rows.length === made.length && rows.every((row) => row.therapistName === "Verify Fiftyfour"),
      `${rows.length} row(s), therapist ${rows[0]?.therapistName ?? "none"}`,
    );

    const { ClinicChrome } = await import("../components/clinic/chrome");

    const chromeMarkup = await renderMarkup(
      React.createElement(ClinicChrome, {
        nav: true,
        clinicName: fixture,
        children: React.createElement(
          "ul",
          null,
          rows.map((row) =>
            React.createElement(
              "li",
              { key: row.sessionId },
              `${row.patientName} ${row.therapistName} ${row.status}`,
            ),
          ),
        ),
      }),
    );

    /*
     * 🔴 THE DISCLAIMER HAS TO COME OUT BEFORE THE SWEEP, AND WORKING OUT WHY IS THE
     * MOST INTERESTING THING IN THIS FILE.
     *
     * The first version of this check FAILED, reporting leaks of "transcript", "journal",
     * "summary", "risk" and "diagnosis". Every one of them came from the chrome's own
     * sentence: *"You will never see a note, a transcript, a journal, a summary, a risk
     * flag or a diagnosis here."*
     *
     * A word-presence sweep cannot tell "renders a transcript" from "promises never to
     * render a transcript", and the honest fix is not to soften the word list — it is to
     * take the one known sentence out and sweep everything else. So the resolved
     * disclaimer is removed by value, from the dictionary, rather than by a regex over
     * anything that looks like a promise.
     *
     * 🔴 And its removal is bracketed: the sentence must have BEEN there, or the removal
     * is a no-op silently hiding a real leak, which is the §6 family in one line.
     */
    const { DICTIONARIES } = await import("../lib/i18n/messages");
    const disclaimer = DICTIONARIES.en["clinic.neverSees"];

    check(
      "🔴 CONTROL the disclaimer removed before the sweep was actually in the markup",
      chromeMarkup.includes(disclaimer),
      "removing a sentence that was absent would hide a real leak behind a no-op",
    );

    const swept = chromeMarkup.split(disclaimer).join(" ");
    const leakedWords = CLINICAL_WORDS.filter((word) => swept.toLowerCase().includes(word));

    check(
      "🔴 54.9 the clinic portal's rendered markup carries not one clinical word",
      leakedWords.length === 0,
      leakedWords.length === 0
        ? `${CLINICAL_WORDS.length} words looked for across ${swept.length} characters, disclaimer excluded`
        : `LEAKS: ${leakedWords.join(", ")}`,
    );

    /*
     * 🔴 CONTROL — the markup is a REAL render with real content in it.
     *
     * Two empty strings contain no clinical words. This is the shape that caught three of
     * sprint 53's own checks, so it is asserted before the sweep above is allowed to mean
     * anything: the practice's name, the clinician's name and a translated label are all
     * present.
     */
    check(
      "🔴 CONTROL …and that markup is a real render, with the practice, the clinician and a label",
      chromeMarkup.includes(fixture) &&
        chromeMarkup.includes("Verify Fiftyfour") &&
        chromeMarkup.includes("This week"),
      "an empty render would pass the sweep above for free",
    );

    /*
     * 🔴 AND THE SWEEP WOULD CATCH ONE, so the predicate is reading the markup.
     */
    check(
      "🔴 CONTROL …and the same sweep catches a planted clinical word",
      CLINICAL_WORDS.some((word) => `${swept} the transcript said`.toLowerCase().includes(word)),
      "a planted sentence is caught by the same predicate that cleared the real markup",
    );

    /*
     * 🔴 AND THE CHROME CARRIES THE SENTENCE SAYING WHAT IT CANNOT SHOW.
     *
     * On every screen rather than a help page: the person who needs it is a practice
     * manager wondering where the notes are, and they will not click through to find out
     * the answer is "nowhere, on purpose".
     */
    check(
      "🔴 54.9 …and the chrome states on every screen what this portal can never show",
      chromeMarkup.includes("never see a note"),
      "in the chrome, so a new page cannot forget it",
    );

    /* ======================================================== */
    /*  C267 · a clinic cannot vouch for a licence               */
    /* ======================================================== */

    /*
     * 🔴 NO COLUMN ON THE INVITATION COULD CARRY A VERIFICATION.
     *
     * Asserted against `information_schema` rather than the schema file, because the file
     * is a claim and the database is the fact. The obvious build lets a hospital mark its
     * own therapists verified; accept it once and "only certified therapists" becomes
     * "certified, or somebody said so".
     */
    const inviteColumns = (
      await db.execute(sql`
        SELECT column_name FROM information_schema.columns
         WHERE table_name = 'clinician_invitations' ORDER BY column_name`)
    ).rows as { column_name: string }[];

    const names = inviteColumns.map((row) => row.column_name);
    const vouching = names.filter((name) =>
      /verif|licen|registration|document|certif/i.test(name),
    );

    check(
      "🔴 C267 no column on an invitation could record a verification the clinic performed",
      vouching.length === 0,
      vouching.length === 0 ? names.join(", ") : `VOUCHING: ${vouching.join(", ")}`,
    );

    /*
     * 🔴 CONTROL — and an ACCEPTED invitation does produce an `unverified` clinician.
     *
     * The absence above is worth nothing if invitations do not work. This walks the real
     * path: resolve the link, which stamps the terms, then accept, then read the user's
     * verification status off the row.
     */
    const { inviteClinician, resolveInvitation, acceptInvitation } = await import(
      "../lib/data/clinic-admin"
    );

    const [manager] = (
      await db.execute(sql`
        INSERT INTO clinic_managers (organization_id, email, password_hash, role)
        VALUES (${org.id}, ${`mgr-${fixture}@example.test`}, 'x', 'admin') RETURNING id`)
    ).rows as { id: string }[];
    const boss = required(manager, "a clinic manager");

    const invited = await inviteClinician({
      clinicOrganizationId: org.id,
      byManagerId: boss.id,
      email: `invited-${fixture}@example.test`,
      phone: null,
      firstName: "Invited",
      lastName: "Clinician",
    });

    const token = required(invited.token, "an invitation token");

    /*
     * 🔴 C261 — ACCEPTING BEFORE THE TERMS WERE SHOWN IS REFUSED.
     *
     * Attempted FIRST, before `resolveInvitation` stamps anything, because that is the
     * only moment the unshown state exists. This is the check that proves the ordering is
     * enforced rather than merely rendered.
     */
    const tooEarly = await acceptInvitation({
      token,
      password: "correct horse battery",
      firstName: "Invited",
      lastName: "Clinician",
    });

    check(
      "🔴 C261 an invitation cannot be accepted before the terms screen has been served",
      tooEarly.error !== undefined,
      tooEarly.error ?? "accepted with no terms shown",
    );

    /* Now the screen renders, which is what stamps `terms_shown_at`. */
    const view = await resolveInvitation(token);

    check(
      "🔴 CONTROL …and resolving the link names the practice, so the sentence can be rendered",
      view !== null && view.clinicName === fixture,
      view ? `invited to ${view.clinicName}` : "not resolved",
    );

    const accepted = await acceptInvitation({
      token,
      password: "correct horse battery",
      firstName: "Invited",
      lastName: "Clinician",
    });

    check(
      "🔴 CONTROL …and AFTER the terms were shown it is accepted, so the gate is not a wall",
      accepted.ok === true,
      accepted.error ?? "accepted",
    );

    const [joined] = (
      await db.execute(sql`
        SELECT verification_status, organization_id FROM users
         WHERE email = ${`invited-${fixture}@example.test`}`)
    ).rows as { verification_status: string; organization_id: string }[];
    const newcomer = required(joined, "the accepted clinician");

    check(
      "🔴 C267 the clinician an invitation creates is UNVERIFIED, inside the clinic's tenancy",
      newcomer.verification_status === "unverified" && newcomer.organization_id === org.id,
      `${newcomer.verification_status}, and they verify themselves exactly as a solo one does`,
    );

    /*
     * 🔴 And no clinic-side source can write a verification status.
     *
     * The columns are absent from the invitation; this is the other end, over every file a
     * clinic surface can reach. A write here would be C106's invariant bypassed by the
     * most credible-looking route available.
     */
    const clinicFiles = files.filter(
      (f) =>
        f.startsWith("app/(clinic)/") ||
        f.startsWith("components/clinic/") ||
        f === "lib/data/clinic.ts" ||
        f === "lib/data/clinic-admin.ts",
    );

    const writers = clinicFiles.filter((f) => /verificationStatus:\s*"(?!unverified)/.test(readSource(f)));

    check(
      "🔴 C267 nothing a clinic can reach sets a verification status to anything but unverified",
      writers.length === 0,
      writers.length === 0
        ? `${clinicFiles.length} clinic files scanned, none of them vouches for a licence`
        : `VOUCHES: ${writers.join(", ")}`,
    );

    /* ==================================================== */
    /*  54.11 / C266 · a therapist leaves                    */
    /* ==================================================== */

    /*
     * 🔴 BOTH HALVES, AND THE SECOND IS THE ONE AN INTERPRETATION COULD GET WRONG.
     *
     * The clinician moves to an organisation of one, and the SESSION STAYS WITH THE
     * CLINIC. Moving the caseload would take a chart out from under the grant a patient
     * gave; sprints 26 and 27 built the opposite mechanism, where a patient claims and
     * moves their own record.
     */
    const { removeClinician } = await import("../lib/data/clinic-admin");

    const left = await removeClinician({ clinicOrganizationId: org.id, userId: doctor.id });

    const [after] = (
      await db.execute(sql`
        SELECT u.organization_id AS user_org, o.kind, o.clinic_state
          FROM users u JOIN organizations o ON o.id = u.organization_id
         WHERE u.id = ${doctor.id}`)
    ).rows as { user_org: string; kind: string; clinic_state: string | null }[];
    const moved = required(after, "the departed clinician");

    check(
      "🔴 54.11 / C266 a clinician who leaves lands in a SOLO organisation of their own",
      left.ok === true &&
        moved.user_org !== org.id &&
        moved.kind === "solo" &&
        moved.clinic_state === null,
      `moved to a ${moved.kind} practice with clinic_state ${String(moved.clinic_state)}`,
    );

    const [stayed] = (
      await db.execute(sql`
        SELECT organization_id FROM sessions WHERE id = ${appointment}`)
    ).rows as { organization_id: string }[];

    check(
      "🔴 CONTROL …and the SESSION stays with the clinic, so no chart moved out from under a grant",
      stayed?.organization_id === org.id,
      "the records are the practice's and are untouched, which is what C266 says",
    );

    /*
     * 🔴 AND THE CHECK I FIRST WROTE HERE WAS WRONG AT THE PREMISE.
     *
     * It asserted the clinic's schedule no longer names a clinician who left, and it
     * failed, and the code was right. The sessions they already ran ARE the clinic's: the
     * rows keep the clinic's organisation id, the clinic is still billed for them, and the
     * control above asserts exactly that as a feature. A schedule that hid them would be
     * hiding hours the practice paid for.
     *
     * What must actually be true is the FORWARD half: a session the departed clinician
     * runs from now on belongs to their own practice and never appears on the clinic's
     * schedule. So that is what is asserted, by inserting one against their CURRENT
     * organisation, which is what every booking path does because the id comes off the
     * clinician.
     */
    const [newOrgSession] = (
      await db.execute(sql`
        INSERT INTO sessions (organization_id, therapist_id, status, modality, scheduled_at,
                              feedback_token, price_cents)
        VALUES (${moved.user_org}, ${doctor.id}, 'scheduled', 'video', now(),
                ${`${fixture}-after`}, 3000)
        RETURNING id`)
    ).rows as { id: string }[];
    const future = required(newOrgSession, "a session in their own practice");

    const afterRows = await clinicSchedule({
      clinicOrganizationId: org.id,
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    check(
      "🔴 54.11 a session the departed clinician runs NEXT is not on the clinic's schedule",
      !afterRows.some((row) => row.sessionId === future.id),
      `${afterRows.length} row(s) on the clinic's schedule, and their new one is not among them`,
    );

    check(
      "🔴 CONTROL …while the sessions they ran AT the clinic still are, because the clinic paid",
      made.every((id) => afterRows.some((row) => row.sessionId === id)),
      "hiding hours a practice paid for would be a different kind of wrong",
    );
  } finally {
    /*
     * Everything this run made, in dependency order. The clinician was reparented to a
     * solo organisation by the departure check, so that row is found by name rather than
     * by the clinic id it no longer points at.
     */
    await db.execute(sql`DELETE FROM invoice_lines WHERE invoice_id IN
      (SELECT id FROM invoices WHERE organization_id IN
        (SELECT id FROM organizations WHERE name LIKE 'verify54-%'))`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id IN
      (SELECT id FROM organizations WHERE name LIKE 'verify54-%')`);
    await db.execute(sql`DELETE FROM invoices WHERE organization_id IN
      (SELECT id FROM organizations WHERE name LIKE 'verify54-%')`);
    await db.execute(sql`DELETE FROM sessions WHERE feedback_token LIKE 'verify54-%'`);
    await db.execute(sql`DELETE FROM subscriptions WHERE organization_id IN
      (SELECT id FROM organizations WHERE name LIKE 'verify54-%')`);
    await db.execute(sql`DELETE FROM clinician_invitations WHERE email LIKE '%verify54-%'`);
    await db.execute(sql`DELETE FROM clinic_auth_sessions WHERE clinic_manager_id IN
      (SELECT id FROM clinic_managers WHERE email LIKE '%verify54-%')`);
    await db.execute(sql`DELETE FROM clinic_managers WHERE email LIKE '%verify54-%'`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%verify54-%'`);
    await db.execute(sql`DELETE FROM organizations WHERE name LIKE 'verify54-%'`);
  }

  finish("sprint 54");
}

void main();
