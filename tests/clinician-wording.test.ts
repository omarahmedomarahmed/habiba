import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ar, en } from "../lib/i18n/messages";

/**
 * K22: sentences a clinician reads that said something the product does not
 * do. Each check reads the sentence or the code that picks it, and each has a
 * control that the old copy or the old code would fail.
 */

const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("K22 the copilot limit card does not promise a monthly reset or an Unlimited plan", () => {
  for (const key of ["tcop.exhausted", "tcop.exhaustedBody"] as const) {
    assert.doesNotMatch(en[key], /month|Unlimited/i, `${key}: ${en[key]}`);
    assert.doesNotMatch(ar[key], /شهر|غير المحدود/, `${key} (ar): ${ar[key]}`);
  }
  // Control: the allowance really is per session, rolling over (`checkQuota`).
  assert.match(readFileSync("lib/data/copilot.ts", "utf8"), /messagesPerPatientPerSession/);
  assert.doesNotMatch(strip(readFileSync("components/copilot/chat.tsx", "utf8")), /seeUnlimited|href="\/billing"/);
});

test("K22 the 'patient was waiting' email names the radar only for a radar session", () => {
  for (const key of ["tmsg.waiting.bodyBooked", "tmsg.radarOff.abandonedBooked"] as const) {
    assert.doesNotMatch(en[key], /booked you on the Crisis Radar/, key);
    assert.ok(ar[key] && ar[key] !== en[key], `${key} has no Arabic`);
  }
  // Control: the radar wording that was sent for every session still exists for radar ones.
  assert.match(en["tmsg.waiting.body"], /booked you on the Crisis Radar/);
  const sweep = strip(readFileSync("lib/data/feedback.ts", "utf8"));
  assert.match(sweep, /sessionType: sessions\.sessionType/);
  assert.match(sweep, /radar \? "tmsg\.waiting\.body" : "tmsg\.waiting\.bodyBooked"/);
  assert.match(sweep, /radar \? "tmsg\.radarOff\.abandoned" : "tmsg\.radarOff\.abandonedBooked"/);
});

test("K22 risk alerts are written in the clinician's language, never English literals", () => {
  for (const file of ["lib/crisis/alerts.ts", "lib/data/assessments.ts", "lib/data/journals.ts"]) {
    const code = strip(readFileSync(file, "utf8"));
    assert.doesNotMatch(
      code,
      /Risk language detected|may need a call|Pause and assess directly|"A patient"/,
      `${file} still writes an English alert`,
    );
    assert.match(code, /wordsFor\(\{ userId/, `${file} does not pick the reader's language`);
  }
  for (const key of ["talert.riskTitle", "talert.riskBodyLive", "talert.journalTitle", "talert.questionnaireTitle"] as const) {
    assert.ok(ar[key] && ar[key] !== en[key], `${key} has no Arabic`);
  }
});

test("K22 the pay-as-you-go notice quotes the fees from settings, not $1 and $3", () => {
  assert.doesNotMatch(en["tnew.paygNotice"], /\$\d/, en["tnew.paygNotice"]);
  assert.match(en["tnew.paygNotice"], /\{platform\}[\s\S]*\{ai\}/);
  assert.match(ar["tnew.paygNotice"], /\{platform\}[\s\S]*\{ai\}/);
  const page = strip(readFileSync("app/(app)/sessions/new/page.tsx", "utf8"));
  assert.match(page, /platformCents: settings\.session\.platformFeeCents, aiCents: tier\.aiRateCents/);
});

test("C327 the clinician's page names the practice that sees appointments, as the radar card does", () => {
  const page = strip(readFileSync("components/radar/therapist-page.tsx", "utf8"));
  assert.match(page, /profile\.clinicName \?[\s\S]*?radar\.inPractice/, "the page does not say which practice can see");
  // Control: the card already did, from the same field.
  assert.match(strip(readFileSync("components/radar/therapist-card.tsx", "utf8")), /entry\.clinicName \?/);
  assert.doesNotMatch(page, /Turned up to|: "Free"/, "English literals on the clinician's page");
  assert.doesNotMatch(readFileSync("lib/data/clinic-visibility.ts", "utf8"), /export async function clinicAffiliations/);
});

test("the record-system copy claims no filing while nothing calls fileNote", async () => {
  const { execSync } = await import("node:child_process");
  const callers = execSync(
    "grep -rlE 'fileNote\\(|recordLaunch\\(' app lib --include=*.ts --include=*.tsx || true",
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((file) => file && !/^lib\/ehr\/file-note\.ts$|^lib\/data\/ehr\.ts$/.test(file));
  const { INTEGRATIONS } = await import("../lib/integrations/registry");
  const entry = INTEGRATIONS.find((item) => item.slug === "clinic-systems")!;
  if (callers.length === 0) {
    assert.doesNotMatch(`${entry.summary} ${entry.today}`, /works end to end|is filed back|files into the record/i);
    for (const key of ["records.bodySolo", "records.bodyClinic", "records.whatWeHold"] as const) {
      assert.match(en[key], /not built|Once filing is built/, `${key}: ${en[key]}`);
      assert.match(ar[key], /لم يُبنَ|حين يُبنى/, `${key} (ar)`);
    }
  }
});

test("TE56 / EE32 a malformed id from a URL is not found before it reaches a uuid column", async () => {
  const { isUuid } = await import("../lib/uuid");
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid("1b4e28ba-2fa1-11d2-883f-0016d3cca427"), true);
  assert.equal(isUuid(undefined), false);
  for (const [file, fn, arg] of [
    ["lib/data/patients.ts", "getPatient", "patientId"],
    ["lib/data/sessions.ts", "getSession", "sessionId"],
    ["lib/data/radar.ts", "publicProfile", "userId"],
    ["lib/billing/invoice.ts", "invoiceFor", "txnId"],
  ] as const) {
    const source = readFileSync(file, "utf8");
    const body = source.slice(source.indexOf(`export async function ${fn}(`));
    const guard = body.indexOf(`if (!isUuid(${arg})) return null;`);
    const query = body.search(/await (db|controlDb)/);
    assert.ok(guard > 0 && guard < query, `${fn} queries before it checks the id`);
  }
});

test("K22 a clinic seat's region change is refused before the rate is saved", () => {
  const actions = strip(readFileSync("app/(app)/settings/actions.ts", "utf8"));
  const body = actions.slice(actions.indexOf("export async function updatePaymentSettings("));
  const refuse = body.indexOf('t("tpay.regionClinic")');
  const write = body.indexOf(".update(users)");
  assert.ok(refuse > 0 && write > 0, "the refusal or the write is missing");
  assert.ok(refuse < write, "the rate is written before the region is checked");
});
