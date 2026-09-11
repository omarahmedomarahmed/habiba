/**
 * Sprint 37R acceptance: what the second walkthrough found, and what was fixed.
 *
 *   npm run verify:sprint37r
 *
 * ## What this file is for
 *
 * 37R is a walkthrough, and a walkthrough's findings are the one class of
 * defect no verifier in this repository can see: a screen that is wrong while
 * every row beneath it is right. What a verifier *can* do is make sure each
 * one stays fixed, so every finding that was fixed in code gets a check here,
 * proved in both directions where the direction matters (C165) and against a
 * planted offender where a scan could be blind (C84, C158).
 *
 * The design verdicts and the "what was hard" notes are in
 * `docs/walkthrough-2/REPORT.md`. They are judgements, and a judgement does
 * not belong in a gate.
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { lineForNumber } from "../lib/crisis/line";
import { countryFromE164 } from "../lib/phone/e164";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
import { patients, users } from "../lib/db/schema";
import { patientsWithPhone } from "../lib/data/patients";
import { stripComments } from "./_dashes";
import { scanRegionPins } from "./_region-pins";
import { reporter, required, writesTo, readSource } from "./_verify";

const { check, finish } = reporter();
const db = dbFor(DEFAULT_REGION);
const TAG = "verify37r";

/** Bottom-tab roots and the pages a person lands on with no app behind them. */
const NO_BACK_NEEDED = new Set([
  "patient", // the home tab
  "patient/homework", // Steps
  "patient/billing", // Billing
  "patient/account", // You
  "patient/radar", // the radar tab
  "patient/login",
  "patient/signup",
  "patient/forgot-password",
  "patient/invite/[token]", // arrived from WhatsApp; there is nothing behind it
]);

function patientPages(dir = "app/(patient)/patient", prefix = "patient"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...patientPages(`${dir}/${entry.name}`, `${prefix}/${entry.name}`));
    else if (entry.name === "page.tsx") out.push(prefix);
  }
  return out;
}

async function main() {
  writesTo();
  console.log("\nSprint 37R, the second walkthrough\n");

  /* ------------------------------------------- C184 · the crisis number */

  check(
    "🔴 C184 an Egyptian number is offered NO crisis line, not the only one in the table",
    lineForNumber("+201001234567") === null,
    "the sentence that is true everywhere, instead of a number that does not dial",
  );

  check(
    "🔴 C184 …and a United States number still gets 988",
    lineForNumber("+15551234567")?.tel === "988",
    "the guard refuses the wrong country, not everybody",
  );

  const orb = readSource("components/patient/sos-orb.tsx");
  check(
    "🔴 C184 the orb asks for ONE line by number, never the whole table",
    /lineForNumber\(phone\)/.test(orb) && !/Object\.entries\(\s*CRISIS_LINES/.test(orb),
    "Object.entries(CRISIS_LINES) is what printed 988 to Cairo",
  );

  check(
    "🔴 C184 CONTROL, the same scan CATCHES the code that shipped the defect",
    /Object\.entries\(\s*CRISIS_LINES/.test(
      "const lines = Object.entries( CRISIS_LINES ).map(([country, line]) => ({",
    ),
    "a scan that finds nothing proves nothing until it is watched finding something",
  );

  const chrome = readSource("app/(patient)/layout.tsx");
  check(
    "🔴 C185 the layout asks who is reading, so the orb has a number to work from",
    /optionalPatient\(\)/.test(chrome) && /phone=\{actor\?\.phone/.test(chrome),
    "and the nav bar is hidden from somebody who cannot use it",
  );

  /* --------------------------------------------------- C185 · going back */

  const missing = patientPages()
    .filter((page) => !NO_BACK_NEEDED.has(page))
    .filter((page) => !readFileSync(`app/(${page.split("/")[0]})/${page}/page.tsx`, "utf8").includes("PatientBack"));

  check(
    "🔴 C185 every patient page that is not a tab has a way back",
    missing.length === 0,
    missing.join(", ") || `${patientPages().length} patient pages, ${NO_BACK_NEEDED.size} tabs and landings excepted`,
  );

  const back = readSource("components/patient/back.tsx");
  check(
    "C185 …and back means the previous page, with a named fallback for a deep link",
    /router\.back\(\)/.test(back) && /router\.push\(fallback\)/.test(back),
    "half this product's traffic arrives from WhatsApp with no history",
  );

  /* ------------------------------------------ C186 · one person, one record */

  const [reference] = await db
    .select({ organizationId: users.organizationId, id: users.id, role: users.role })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);
  const clinician = required(reference, "therapist whose caseload the fixture can join");
  const actor = {
    userId: clinician.id,
    organizationId: clinician.organizationId,
    role: clinician.role,
  } as never;

  const phone = "+201000000037";
  let plantedId: string | null = null;

  try {
    const [planted] = await db
      .insert(patients)
      .values({
        organizationId: clinician.organizationId,
        therapistId: clinician.id,
        firstName: "Verify",
        lastName: "Duplicate",
        phone,
        source: "therapist",
      })
      .returning({ id: patients.id });
    plantedId = planted!.id;

    const found = await patientsWithPhone(actor, phone);
    check(
      "🔴 C186 a number already on the caseload is FOUND, which is what the refusal needs",
      found.length === 1 && found[0]!.id === plantedId,
      `${found.length} record(s) with that number`,
    );

    const other = await patientsWithPhone(actor, "+201000000999");
    check(
      "🔴 C186 CONTROL, a number nobody holds comes back empty rather than matching anything",
      other.length === 0,
      "the check is about this number, not about there being any patients at all",
    );
  } finally {
    if (plantedId) await db.delete(patients).where(eq(patients.id, plantedId));
  }

  const action = readSource("app/(app)/patients/actions.ts");
  check(
    "🔴 C186 …and the form consults it BEFORE creating, with a deliberate way past",
    action.indexOf("patientsWithPhone") < action.indexOf("await createPatient") &&
      /duplicate.*!== "allow"/s.test(action),
    "two people can share a phone; two charts for one person is the failure",
  );

  /* ------------------------------------------------ the smaller findings */

  check(
    "C187 the therapist's radar control carries its icon, not a bare dot",
    /<Radio\b/.test(readSource("components/radar/orb.tsx").split("aria-expanded={open}")[1] ?? ""),
    "a 12px grey circle with no label is not a control anybody presses",
  );

  check(
    "C188 the admin console shows all sixteen destinations on a laptop",
    /lg:flex-wrap/.test(readSource("app/(admin)/layout.tsx")),
    "five of them were clipped off the right edge at 1440px",
  );

  /* 🔴 C84 again, caught by this very check: the first draft scanned the whole
     file and matched the COMMENT that quotes the old sentence. Comments are
     stripped before any copy scan in this repository for exactly that reason. */
  const invite = stripComments(
    readSource("app/(patient)/patient/invite/[token]/page.tsx"),
  );
  check(
    "C189 the invite landing no longer asks somebody to find the link again",
    !/then open this link again/.test(invite) && /\?invite=\$\{token\}/.test(invite),
    "both buttons already carried the invite",
  );

  const editor = readSource("components/patient/patient-editor.tsx");
  check(
    "C190 the phone country beside a stored number comes from the number",
    /countryFromE164\(initial\.phone\)/.test(editor) && countryFromE164("+201001234567") === "EG",
    "a record holding +20 showed United States beside it",
  );

  /* ------------------------------------------------------ the standing rails */

  const pins = scanRegionPins();
  check(
    "30.1 the pin count did not move in this sprint",
    pins.length === 85,
    `${pins.length} pinned call sites`,
  );

  const unvalidated = await db.execute(sql`
    SELECT count(*)::int AS n FROM pg_constraint WHERE NOT convalidated`);
  check(
    "H1 no unvalidated constraint anywhere in the database",
    (unvalidated.rows[0] as { n: number }).n === 0,
    `${(unvalidated.rows[0] as { n: number }).n} unvalidated`,
  );

  void TAG;
  finish("Sprint 37R");
}

void main();
