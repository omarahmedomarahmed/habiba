import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ACCESS_STATES,
  accessStateFor,
  capabilitiesFor,
  claimedForAccess,
  homeworkScopeFor,
  isSoleChart,
  maySeeSharedRecord,
} from "../lib/access/state";
import { deliverableNoteQuery } from "../lib/partner/api";
import { unlinkedFrom } from "../lib/partner/platform";
import { companyView, lastCompleteWeek, type LedgerEntry } from "../lib/sponsor/ledger";
import { exportLinkState } from "../lib/data/export";
import { EXPORT_OPEN_WINDOW_MINUTES, EXPORT_TTL_HOURS } from "../lib/db/schema";
import { aiPausedFrom } from "../lib/data/ai-consent";
import { PROCESSORS, SIGNUP_NOTICE_KEYS, TERMS_VERSION } from "../lib/consent/terms";
import { adultConfirmedFrom, adultTicked } from "../lib/consent/adult";
import { ar, en } from "../lib/i18n/messages";

/*
 * DD-2 workstream B1: privacy and consent. Each test fails if its fix is undone.
 */

const source = (path: string) => readFileSync(path, "utf8");

/* ------------------------------------------- 1. the shared record follows the grant -- */

test("B1.1 only a live grant or the clinician's own sole unclaimed file opens the shared record", () => {
  const open = ACCESS_STATES.filter((state) => maySeeSharedRecord(state, true));
  assert.deepEqual([...open].sort(), ["granted", "unclaimed_bare", "unclaimed_documented"]);
  /* A chart another clinician also holds is not anybody's private file. */
  assert.deepEqual(ACCESS_STATES.filter((state) => maySeeSharedRecord(state, false)), ["granted"]);
  assert.equal(maySeeSharedRecord("revoked", true), false);
  assert.equal(maySeeSharedRecord("no_relationship", true), false);
  /* The same line the files and journals follow for a claimed person. */
  for (const state of ["granted", "revoked"] as const) {
    assert.equal(maySeeSharedRecord(state, true), capabilitiesFor(state).patientFiles);
  }
});

test("B1.1 a person with two charts and no grant shows the second clinician nothing", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const charts = ["clinician-a", "clinician-b"];
  assert.equal(isSoleChart(charts), false);
  assert.equal(isSoleChart(["clinician-a", "clinician-a"]), true);
  assert.equal(isSoleChart(["clinician-a"]), true);
  /* No account, never claimed: unclaimed, but shared, so closed. */
  const bare = accessStateFor({ hasPatientRow: true, claimed: false, documented: true, grant: null, now });
  assert.equal(maySeeSharedRecord(bare, isSoleChart(charts)), false);
  /* A self-signup patient (an account, claimed_at still null) counts as claimed: revoked without a grant. */
  const claimed = claimedForAccess({ claimedAt: null, hasAccount: true });
  assert.equal(claimed, true);
  assert.equal(claimedForAccess({ claimedAt: null, hasAccount: false }), false);
  for (const grant of [null, { status: "rejected" as const, expiresAt: null }, { status: "pending" as const, expiresAt: null }]) {
    const state = accessStateFor({ hasPatientRow: true, claimed, documented: true, grant, now });
    assert.equal(state, "revoked");
    assert.equal(maySeeSharedRecord(state, true), false);
  }
  /* Both readers pass the sole-chart answer, and the access decision reads the account. */
  const grants = source("lib/data/grants.ts");
  assert.match(grants, /claimedForAccess\(\{ claimedAt: row\.claimedAt, hasAccount: holders\.hasAccount \}\)/);
  assert.match(source("lib/data/radar.ts"), /claimedForAccess\(\{ claimedAt: r\.claimedAt/);
});

test("B1.1 homework from other clinics follows the grant; without it, only the clinician's own steps", () => {
  const scope = (state: (typeof ACCESS_STATES)[number], soleChart: boolean) =>
    homeworkScopeFor({ state, soleChart, capabilities: capabilitiesFor(state) }, "me");
  assert.equal(scope("granted", false), undefined);
  assert.equal(scope("unclaimed_documented", true), undefined);
  assert.equal(scope("unclaimed_bare", false), "me");
  assert.equal(scope("revoked", true), "me");
  assert.equal(scope("no_relationship", true), "me");
  const page = source("app/(app)/patients/[id]/documents/page.tsx");
  assert.match(page, /listHomework\(personId, homeworkBy\)/);
  assert.match(page, /homeworkTrend\(personId, homeworkBy\)/);
  assert.match(source("lib/data/homework.ts"), /eq\(homeworkItems\.assignedByUserId, assignedBy\)/);
});

test("B1.1 the clinician's profile page reads the profile, timeline and diagnoses only through the gated loaders", () => {
  const page = source("app/(app)/patients/[id]/documents/page.tsx");
  assert.match(page, /sharedProfileForClinician\(actor, id\)/);
  assert.match(page, /diagnosesForClinician\(actor, id\)/);
  assert.doesNotMatch(page, /listOwnDiagnoses|profileFor\(|timelineFor\(/);

  /* No exported reader of the profile or timeline takes a bare person id. */
  const memory = source("lib/data/memory.ts");
  assert.doesNotMatch(memory, /export async function (profileFor|timelineFor)\b/);
  assert.match(memory, /maySeeSharedRecord\(access\.state, access\.soleChart\)/);
  assert.match(source("lib/data/diagnoses.ts"), /maySeeSharedRecord\(access\.state, access\.soleChart\)/);

  /* Only the patient's own screens read the unscoped diagnoses. */
  const callers = ["app/(patient)/patient/profile/page.tsx", "lib/data/export.ts"];
  for (const file of callers) assert.match(source(file), /listOwnDiagnoses/);

  /* The case copilot no longer treats missing capabilities as "no restriction". */
  assert.match(source("lib/ai/case-copilot.ts"), /\n  capabilities: Capabilities;/);
});

/* ---------------------------------------------- 2. the partner sees its own, linked -- */

test("B1.2 a partner's note delivery needs a live link and a session in that partner's own practice", () => {
  const { sql, params } = deliverableNoteQuery("partner-1", "session-1").toSQL();
  assert.match(sql, /"partner_subjects"\."revoked_at" is null/);
  assert.match(sql, /inner join "organizations" on "organizations"\."id" = "sessions"\."organization_id"/);
  assert.match(sql, /"organizations"\."partner_id" = \$\d+/);
  assert.match(sql, /"organizations"\."billing_mode" = \$\d+/);
  assert.match(sql, /"partner_subjects"\."partner_id" = \$\d+/);
  assert.ok(params.filter((p) => p === "partner-1").length >= 2, "both scopes carry the partner id");
  assert.ok(params.includes("partner_billed"));
});

test("B1.2 unlinked is decided by the session's own reference and the person's live link, not by any old row", () => {
  const cut = new Date("2026-09-01T00:00:00Z");
  const old = { externalRef: "P1", personId: "person-1", revokedAt: cut };
  /* The session's own row was cut, and nothing since: unlinked. */
  assert.equal(unlinkedFrom([old], { externalSubjectRef: "P1", personId: "person-1" }), true);
  assert.equal(unlinkedFrom([old], { externalSubjectRef: "P1", personId: null }), true);
  /* The person confirmed a new link later (a new reference): linked again, for old and new sessions alike. */
  const relinked = [old, { externalRef: "P2", personId: "person-1", revokedAt: null }];
  assert.equal(unlinkedFrom(relinked, { externalSubjectRef: "P2", personId: "person-1" }), false);
  assert.equal(unlinkedFrom(relinked, { externalSubjectRef: "P1", personId: "person-1" }), false);
  /* A placeholder with no person never re-opens a cut link. */
  const placeholder = [old, { externalRef: "P3", personId: null, revokedAt: null }];
  assert.equal(unlinkedFrom(placeholder, { externalSubjectRef: "P1", personId: "person-1" }), true);
  /* Never cut: linked. */
  assert.equal(unlinkedFrom([{ ...old, revokedAt: null }], { externalSubjectRef: "P1", personId: "person-1" }), false);
  assert.equal(unlinkedFrom([], { externalSubjectRef: "P9", personId: null }), false);
});

test("B1.2 every partner read by session reference refuses an unlinked person", () => {
  const platform = source("lib/partner/platform.ts");
  const mayAnswer = platform.slice(platform.indexOf("export async function mayAnswer"));
  assert.match(mayAnswer.slice(0, 1500), /subjectUnlinked\(/);
  /* transcript, summary, note and media all pass through mayAnswer */
  for (const route of ["transcript", "summary", "note", "media"]) {
    assert.match(source(`app/api/partner/v1/sessions/[ref]/${route}/route.ts`), /mayAnswer\(/);
  }
  /* memory and copilot through subjectRefusal, which uses the same helper */
  assert.match(source("lib/partner/copilot.ts"), /subjectUnlinked\(input\)/);
});

/* ------------------------------------------ 3. one floor for every company figure -- */

type Entry = LedgerEntry;
const spend = (weekStart: string, personTag: string, over: Partial<Entry> = {}): Entry => ({
  kind: "session",
  weekStart,
  coverageBps: 10_000,
  coveredCents: 1_000,
  personTag,
  ...over,
});
const mondays = (from: string, n: number) =>
  Array.from({ length: n }, (_, i) =>
    new Date(Date.parse(`${from}T00:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10),
  );

test("B1.3 one heavy user is never isolated: no week is shown until floor different people used it", () => {
  const weeks = mondays("2026-06-01", 16);
  /* One person, six sessions every single week. */
  const heavy = weeks.flatMap((week) => Array.from({ length: 6 }, () => spend(week, "heavy")));
  const now = new Date("2026-09-24T12:00:00Z");

  const alone = companyView({ entries: heavy, floor: 5, now });
  assert.equal(alone.weeks.length, 0, "a week was published for one person");
  assert.ok(alone.series.every((week) => week.spendCents === null));
  assert.equal(alone.stats.sessions, null);
  assert.equal(alone.stats.spendCents, null);
  assert.ok(alone.stats.coverageMix.every((bucket) => bucket.sessions === null));

  /* Four others, once each, in week 10: five people, so one period may close. */
  const four = ["a", "b", "c", "d"].map((p) => spend(weeks[9]!, p));
  const all = [...heavy, ...four];
  const withFour = companyView({ entries: all, floor: 5, now });
  assert.ok(withFour.weeks.length >= 1);
  for (const period of withFour.weeks) {
    const tags = new Set(
      all.filter((e) => e.weekStart >= period.from && e.weekStart <= period.to).map((e) => e.personTag),
    );
    assert.ok(tags.size >= 5, `a period with ${tags.size} people was shown`);
  }
  /* Every week after the last published period is held back: null, never zero. */
  const last = withFour.publishedThrough;
  assert.ok(last !== null);
  const after = withFour.series.filter((week) => week.weekStart > last);
  assert.ok(after.length > 0 && after.every((week) => week.spendCents === null));
  /* The chart adds up to whole published periods and nothing else. */
  const charted = withFour.series.reduce((n, w) => n + (w.spendCents ?? 0), 0);
  assert.equal(charted, withFour.weeks.reduce((n, p) => n + p.spendCents, 0));
  assert.equal(withFour.stats.spendCents, charted);
});

test("B1.3 the chart is one run of weeks: a held-back week looks exactly like an empty one", () => {
  const now = new Date("2026-09-24T12:00:00Z"); /* the last complete week began 14 September */
  const five = ["a", "b", "c", "d", "e"].map((p) => spend("2026-08-03", p));
  /* One person in two later weeks, with an empty week between them. */
  const solo = [spend("2026-08-17", "solo"), spend("2026-08-31", "solo")];
  const view = companyView({ entries: [...five, ...solo], floor: 5, now });
  const weeks = view.series.map((w) => w.weekStart);
  assert.deepEqual(weeks, mondays("2026-08-03", 7), "every week from the first published one to the last complete one");
  const byWeek = new Map(view.series.map((w) => [w.weekStart, w.spendCents]));
  /* Used-but-held-back and nobody-at-all read the same. */
  assert.equal(byWeek.get("2026-08-17"), null);
  assert.equal(byWeek.get("2026-08-24"), null);
  assert.equal(byWeek.get("2026-08-31"), null);
  assert.equal(byWeek.get("2026-08-03"), 5_000);
  /* Nothing published: no chart at all, so not even the first week shows. */
  assert.deepEqual(companyView({ entries: solo, floor: 5, now }).series, []);
});

test("B1.3 the current, incomplete week is never read, even with plenty of people in it", () => {
  const now = new Date("2026-09-24T12:00:00Z"); /* a Thursday; the week began 21 September */
  assert.equal(lastCompleteWeek(now), "2026-09-14");
  const thisWeek = ["a", "b", "c", "d", "e", "f"].map((p) => spend("2026-09-21", p));
  const view = companyView({ entries: thisWeek, floor: 5, now });
  assert.equal(view.weeks.length, 0);
  assert.equal(view.series.length, 0, "the current week reached the chart");
  /* The following Monday it is complete, and shown. */
  const later = companyView({ entries: thisWeek, floor: 5, now: new Date("2026-09-28T09:00:00Z") });
  assert.equal(later.weeks.length, 1);
  /* A stored floor under the minimum still reads as five. */
  const four = companyView({ entries: thisWeek.slice(0, 4), floor: 2, now: new Date("2026-09-28T09:00:00Z") });
  assert.equal(four.weeks.length, 0);
});

test("B1.3 the coverage mix counts only published weeks", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  const published = ["a", "b", "c", "d", "e"].map((p) => spend("2026-08-03", p, { coverageBps: 5_000 }));
  /* Held back: five sessions at full cover in a later week, but one person. */
  const held = Array.from({ length: 5 }, () => spend("2026-08-10", "solo", { coverageBps: 10_000 }));
  const view = companyView({ entries: [...published, ...held], floor: 5, now });
  assert.deepEqual(view.stats.coverageMix, [{ coverageBps: 5_000, sessions: 5 }]);
  assert.equal(view.stats.sessions, 5);
});

test("B1.3 every company surface reads the one view", () => {
  const sponsors = source("lib/data/sponsors.ts");
  const balance = sponsors.slice(sponsors.indexOf("export async function potBalance"));
  assert.match(balance.slice(0, 2500), /publishedLedger\(sponsorId, now\)/);
  const weekly = sponsors.slice(sponsors.indexOf("export async function weeklySpend"));
  assert.match(weekly.slice(0, 600), /publishedLedger\(sponsorId, now\)/);
  assert.match(source("lib/data/sponsor-ledger.ts"), /companyView\(\{/);
  assert.match(source("app/(sponsor)/sponsor/ledger/export/route.ts"), /publishedLedger\(/);
  /* No money entry is skipped for a person not yet told: the balance moves for them too. */
  const pot = source("lib/billing/pot.ts");
  const record = pot.slice(pot.indexOf("async function recordMoneyEntry"));
  assert.doesNotMatch(record.slice(0, 1500), /toldAt/);
});

test("B1.3 the public demo names the floor instead of printing {floor}", () => {
  const demo = source("components/demo/portal-demo.tsx");
  assert.doesNotMatch(demo, /t\("sponsor\.(ledgerBody|ledgerHeldBackWhy|fundedHeld)"\)/);
  assert.match(demo, /t\("sponsor\.ledgerBody", \{ floor \}\)/);
  assert.match(source("components/public/audience-demos.tsx"), /privacyFloor\(settings\.sponsor\.activityFloor\)/);
});

/* ------------------------------------------------- 4. a record link opens once -- */

test("B1.4 a record link lives 24 hours, opens once, and its window then closes", () => {
  assert.equal(EXPORT_TTL_HOURS, 24);
  const now = new Date("2026-10-01T12:00:00Z");
  const minutes = (n: number) => new Date(now.getTime() + n * 60_000);
  const live = { revokedAt: null, expiresAt: minutes(60), firstOpenedAt: null };
  assert.equal(exportLinkState(null, now), "dead");
  assert.equal(exportLinkState(live, now), "ready");
  assert.equal(exportLinkState({ ...live, revokedAt: minutes(-1) }, now), "dead");
  assert.equal(exportLinkState({ ...live, expiresAt: minutes(-1) }, now), "dead");
  /* Opened: readable inside the window, spent after it, even before the link would expire. */
  const opened = { ...live, firstOpenedAt: minutes(-(EXPORT_OPEN_WINDOW_MINUTES - 1)) };
  assert.equal(exportLinkState(opened, now), "open");
  const spent = { ...live, firstOpenedAt: minutes(-(EXPORT_OPEN_WINDOW_MINUTES + 1)) };
  assert.equal(exportLinkState(spent, now), "dead");
});

test("B1.4 a GET never spends a link; the button posts, and the JSON needs an open window", () => {
  const page = source("app/records/[token]/route.ts");
  const get = page.slice(page.indexOf("export async function GET"), page.indexOf("export async function POST"));
  assert.match(get, /openExport\(token, \{ start: false \}\)/);
  assert.doesNotMatch(get, /start: true/);
  assert.match(page.slice(page.indexOf("export async function POST")), /openExport\(token, \{ start: true \}\)/);
  assert.match(page, /<form method="post"/);
  assert.match(source("app/records/[token]/data.json/route.ts"), /openExport\(token, \{ start: false \}\)/);
  /* The start is conditional, so two racing opens cannot both get a window. */
  assert.match(source("lib/data/export.ts"), /isNull\(dataExports\.firstOpenedAt\)/);
});

/* ------------------------------------------ 5. the AI pause and the processor list -- */

test("B1.5 the assistant and the meeting bot both ask the AI pause first", () => {
  const assistant = source("lib/ai/assistant.ts");
  const roster = assistant.slice(assistant.indexOf("export async function buildRoster"));
  assert.match(roster.slice(0, 6000), /pausedAmong\(rows\.map\(\(row\) => row\.personId\)\)/);
  assert.match(roster.slice(0, 6000), /rows\.filter\(\(row\) => !\(row\.personId && paused\.has\(row\.personId\)\)\)/);
  const dispatch = source("lib/meetings/dispatch.ts");
  const before = dispatch.slice(0, dispatch.indexOf("await dispatchBot("));
  assert.match(before, /aiPausedForPatient\(source\.patientId\)/);
  assert.match(before, /adultConfirmedForSession\(sessionId\)/);
});

test("B1.5 the AI pause is decided per person, newest answer wins, and a failure pauses", () => {
  assert.equal(aiPausedFrom([]), false);
  const at = (d: string) => new Date(`${d}T00:00:00Z`);
  assert.equal(aiPausedFrom([{ agreedAt: at("2026-01-01"), withdrawnAt: at("2026-02-01") }]), true);
  assert.equal(
    aiPausedFrom([
      { agreedAt: at("2026-01-01"), withdrawnAt: at("2026-02-01") },
      { agreedAt: at("2026-03-01"), withdrawnAt: null },
    ]),
    false,
  );
  assert.match(source("lib/data/ai-consent.ts"), /return new Set\(ids\);/);
});

test("B1.5 Recall.ai, WhatsApp and Paymob are named at signup in both languages and on the compliance page", () => {
  const names = PROCESSORS.map((p) => p.name);
  for (const name of ["Recall.ai", "WhatsApp", "Paymob"]) assert.ok(names.includes(name as never), name);
  const english = SIGNUP_NOTICE_KEYS.map((k) => en[k]).join(" ");
  const arabic = SIGNUP_NOTICE_KEYS.map((k) => ar[k]).join(" ");
  for (const word of ["Recall.ai", "WhatsApp", "Meta", "Paymob"]) {
    assert.ok(english.includes(word), `${word} missing in English`);
    assert.ok(arabic.includes(word), `${word} missing in Arabic`);
  }
  assert.match(source("components/auth/signup-consent.tsx"), /SIGNUP_NOTICE_KEYS\.map/);
  const defaults = source("lib/content/defaults.ts");
  const hipaa = defaults.slice(defaults.indexOf('slug: "hipaa"'), defaults.indexOf('slug: "security"'));
  for (const word of ["Recall.ai", "WhatsApp", "Paymob"]) assert.ok(hipaa.includes(word), `${word} not on /hipaa`);
  assert.notEqual(TERMS_VERSION, "2026-10-01", "the notice changed, so its version moves");
});

/* --------------------------------------------------------- 6. 18 or over, first -- */

test("B1.6 confirming 18 or over later sends the recorder a yes was waiting for, and the room says it waits", () => {
  const adult = source("lib/data/adult.ts");
  const confirm = adult.slice(adult.indexOf("export async function confirmAdultForSession"));
  const body = confirm.slice(0, confirm.indexOf("\n}\n"));
  assert.ok(body.indexOf("if (!session) return false;") < body.indexOf("sendBotOnceAdult(sessionId)"), "only after the confirmation landed");
  const dispatch = source("lib/meetings/dispatch.ts");
  const once = dispatch.slice(dispatch.indexOf("export async function sendBotOnceAdult"));
  assert.match(once.slice(0, 900), /consent !== "granted"\) return;/);
  assert.match(source("components/session/session-room.tsx"), /props\.meetingBot \?[\s\S]{0,200}t\("adultCheck\.botWaits"\)/);
  assert.match(source("app/(room)/sessions/[id]/room/page.tsx"), /meetingBot=\{await .*meetingBotPossible\(row\.session\.id\)\}/);
  assert.match(en["adultCheck.botWaits"], /18/);
  assert.match(ar["adultCheck.botWaits"], /18/);
});

test("B1.6 a box counts only when ticked, and any one confirmation is enough", () => {
  const form = (fields: Record<string, string>) => ({ get: (name: string) => fields[name] ?? null });
  assert.equal(adultTicked(form({})), false);
  assert.equal(adultTicked(form({ adult: "off" })), false);
  assert.equal(adultTicked(form({ adult: "on" })), true);
  const at = new Date("2026-10-01T00:00:00Z");
  assert.equal(adultConfirmedFrom({ session: null, chart: null, account: null }), false);
  assert.equal(adultConfirmedFrom({ session: at, chart: null, account: null }), true);
  assert.equal(adultConfirmedFrom({ session: null, chart: at, account: null }), true);
  assert.equal(adultConfirmedFrom({ session: null, chart: null, account: at }), true);
});

test("B1.6 every door that turns audio into words asks for the confirmation, and the forms require it", () => {
  for (const door of ["app/api/sessions/[id]/transcribe/route.ts", "app/api/meetings/transcript/[sessionId]/route.ts"]) {
    assert.match(source(door), /adultConfirmedForSession\(sessionId\)/, door);
  }
  const actions = source("app/(app)/sessions/actions.ts");
  const start = actions.slice(actions.indexOf("export async function startNewSession"));
  assert.match(start.slice(0, 6000), /if \(!adultTicked\(formData\)\) return \{ error: \(await getI18n\(\)\)\.t\("adultCheck\.refused"\) \}/);
  assert.match(source("app/(app)/patients/actions.ts"), /adultTicked\(formData\)/);
  assert.match(source("components/session/new-session-form.tsx"), /name="adult" required/);
  assert.match(source("components/patients/add-patient.tsx"), /name="adult" required/);
  assert.match(source("components/session/session-room.tsx"), /t\("adultCheck\.roomAsk"/);
  /* Who and when, on the chart and on the session. */
  const schema = source("lib/db/schema.ts");
  assert.equal((schema.match(/adultConfirmedBy: uuid\("adult_confirmed_by"\)/g) ?? []).length, 2);
  for (const key of ["adultCheck.label", "adultCheck.refused", "adultCheck.roomAsk", "adultCheck.roomRefused"] as const) {
    assert.match(en[key], /18/, key);
    assert.match(ar[key], /18/, key);
  }
});
