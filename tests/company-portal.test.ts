import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../scripts/_verify";
import { ledgerPeriods, type LedgerEntry as Entry } from "../lib/sponsor/ledger";

/**
 * Wave 2, the company portal: the dead ends a company met with no way forward.
 * `takeover/FIX-PLAN.md` W2-S03, W2-S04 and the rest of the company list.
 *
 * These read the components rather than render them, because what each one
 * asserts is a SHAPE of the control: whether a tap on a reason ends a benefit
 * straight away, whether there is a way back out of a confirm, whether the
 * portal chrome prints. Comments are stripped by `readSource` (C205), so a
 * paragraph describing a Cancel button does not count as one.
 */

/* ------------------------------------------------------------ W2-S03 -- */

test("W2-S03 a company with no joining code can create its first one", () => {
  const actions = readSource("app/(sponsor)/sponsor/code/actions.ts");
  assert.match(actions, /export async function createCode\(/, "no createCode action");
  assert.match(
    actions.slice(actions.indexOf("export async function createCode")),
    /requireSponsorAdmin\(\)[\s\S]*mintFirstCode\(/,
    "createCode must be admin only and go through mintFirstCode",
  );

  const page = readSource("app/(sponsor)/sponsor/code/page.tsx");
  assert.match(page, /<CreateCode\b/, "the no-code state offers nothing to press");
});

test("W2-S03 the poster prints without the portal around it", () => {
  const desk = readSource("components/portal/desk.tsx");
  for (const tag of ["<aside", "<header", "<footer"]) {
    const at = desk.indexOf(tag);
    assert.ok(at >= 0, `${tag} not found in the desk`);
    const open = desk.slice(at, desk.indexOf(">", at));
    assert.match(open, /print:hidden/, `the desk's ${tag} prints with the poster`);
  }

  const page = readSource("app/(sponsor)/sponsor/code/page.tsx");
  assert.match(page, /print:hidden/, "the page heading prints with the poster");

  const bar = readSource("components/billing/pending-bar.tsx");
  assert.match(bar, /print:hidden/, "the pending payment bar prints with the poster");
});

/* ------------------------------------------------------------ W2-S06 -- */

test("W2-S06 a staff number is set up from a preset, and the preset admits what it says", async () => {
  const gate = (await import("../lib/sponsor/gate").catch(() => null)) as
    | typeof import("../lib/sponsor/gate")
    | null;
  assert.ok(gate, "lib/sponsor/gate.ts does not exist");

  const six = gate.presetPattern({ preset: "digits", length: 6, prefix: "" });
  assert.ok(six, "six digits is not a preset");
  const field = { kind: "id_number" as const, domain: null, pattern: six };
  assert.equal(gate.matchesGate(field, "204511"), true);
  assert.equal(gate.matchesGate(field, "2045110"), false);
  assert.equal(gate.matchesGate(field, "20451a"), false);

  /*
   * A prefix typed in capitals, as it is printed on a staff card. `matchesGate`
   * lowercases what the employee types, so a pattern kept in capitals would
   * refuse every one of them.
   */
  const prefixed = gate.presetPattern({ preset: "prefixed", length: 4, prefix: "EMP" });
  assert.ok(prefixed);
  const pf = { kind: "id_number" as const, domain: null, pattern: prefixed };
  assert.equal(gate.matchesGate(pf, "EMP2045"), true);
  assert.equal(gate.matchesGate(pf, "emp2045"), true);
  assert.equal(gate.matchesGate(pf, "XEMP2045"), false);

  /* A prefix is text, never a pattern: a dot matches a dot and nothing else. */
  const dotted = gate.presetPattern({ preset: "prefixed", length: 2, prefix: "A." });
  assert.ok(dotted);
  assert.equal(gate.matchesGate({ kind: "id_number", domain: null, pattern: dotted }, "ab12"), false);

  assert.equal(gate.presetPattern({ preset: "digits", length: 0, prefix: "" }), null);
  assert.equal(gate.presetPattern({ preset: "digits", length: 99, prefix: "" }), null);
});

test("W2-S06 the settings form has a test box and warns about an unproved domain", () => {
  const form = readSource("components/sponsor/gate-settings.tsx");
  assert.match(form, /matchesGate\(/, "no test box running the real gate");
  assert.match(form, /t\("sponsor\.gateUnproved"\)/, "an unproved domain gate is not warned about");
  assert.doesNotMatch(form, /name="pattern"/, "a raw pattern box is still offered");

  const page = readSource("app/(sponsor)/sponsor/settings/page.tsx");
  assert.match(page, /domainProved\(/, "the page never asks whether the domain is proved");

  const enrol = readSource("lib/data/enrolment.ts");
  assert.match(enrol, /from "@\/lib\/sponsor\/gate"/, "enrolment runs a different gate from the test box");
});

/* ------------------------------------------------------------ W2-S10 -- */

type Ledger = typeof import("../lib/sponsor/ledger");
const ledgerModule = async () =>
  (await import("../lib/sponsor/ledger").catch(() => null)) as Ledger | null;

const entry = (over: Partial<Entry>): Entry => ({
  kind: "session" as const,
  weekStart: "2026-09-07",
  coverageBps: 6000,
  coveredCents: 1200,
  personTag: "p0",
  ...over,
});
const people = (n: number, over: Partial<Entry> = {}) =>
  Array.from({ length: n }, (_, i) => entry({ personTag: `p${i}`, ...over }));

test("W2-S10 entries are published in weekly batches, and DD-2 B1: never the current week", async () => {
  const l = await ledgerModule();
  assert.ok(l, "lib/sponsor/ledger.ts does not exist");
  /* Thursday 24 September 2026: this week began Monday the 21st. */
  const now = new Date("2026-09-24T15:00:00Z");
  assert.equal(l.weekStartOf(now), "2026-09-21");
  assert.equal(l.weekStartOf(new Date("2026-09-27T23:59:00Z")), "2026-09-21", "Sunday is the same week");
  assert.equal(l.lastPublishedWeek("weekly", now), "2026-09-14", "this week is not out until it ends");
  assert.equal(l.lastPublishedWeek("live", now), "2026-09-14", "DD-2 B1: live no longer opens this week");
});

test("F7 periods sort and filter as whole periods, never below the floor", async () => {
  const l = (await ledgerModule())!;
  const { periods } = l.ledgerPeriods(
    [...people(5, { weekStart: "2026-08-03" }), ...people(6, { weekStart: "2026-09-07" })],
    5,
  );
  assert.equal(periods.length, 2);
  const bySessions = l.sortPeriods(periods, l.parseLedgerQuery({ sort: "sessions", dir: "desc" }));
  assert.deepEqual(bySessions.map((p) => p.sessions), [6, 5]);
  const september = l.filterPeriods(periods, l.parseLedgerQuery({ from: "2026-09" }));
  assert.deepEqual(september.map((p) => p.from), ["2026-09-07"]);
  assert.equal(l.parseLedgerQuery({ sort: "price" }).sort, "week", "price is not a sort any more");
  assert.equal(l.parseLedgerQuery({ by: "month" }).by, "month");
});

test("🔴 K6 every company screen reads the pot through the headcount gate", () => {
  for (const file of [
    "app/(sponsor)/sponsor/page.tsx",
    "app/(sponsor)/sponsor/pot/page.tsx",
    "app/(sponsor)/sponsor/ledger/page.tsx",
  ]) {
    const page = readSource(file);
    assert.match(page, /reportablePot\(actor\.sponsorId\)/, `${file} reads the pot without the headcount gate`);
    assert.doesNotMatch(page, /\bpotBalance\(/, `${file} reads the raw balance`);
  }
  const ledger = readSource("app/(sponsor)/sponsor/ledger/page.tsx");
  const csv = readSource("app/(sponsor)/sponsor/ledger/export/route.ts");
  for (const source of [ledger, csv]) {
    assert.match(source, /filterPeriods\(/);
    assert.doesNotMatch(source, /priceCents|employeeCents/, "a per-session figure on a company screen");
  }
  const gate = readSource("lib/data/sponsors.ts");
  const body = gate.slice(gate.indexOf("export async function reportablePot"));
  assert.match(body, /headcount < settings\.sponsor\.activityFloor/);
  assert.match(body, /balanceCents: null, published: null/);
});

test("🔴 B3 / B18 a held-back balance shows what the company put in, never a blank or a zero", () => {
  for (const file of ["app/(sponsor)/sponsor/page.tsx", "app/(sponsor)/sponsor/pot/page.tsx"]) {
    const page = readSource(file);
    assert.match(page, /fmt\(pot\.fundedCents\)/, `${file} hides the company's own money in`);
    assert.doesNotMatch(page, /sponsor\.balanceSuppressed/, `${file} still says there is nothing to report`);
  }
  const pot = readSource("app/(sponsor)/sponsor/pot/page.tsx");
  assert.doesNotMatch(pot, /balanceCents \?\? 0/, "a held-back balance rendered as zero");
  const gate = readSource("lib/data/sponsors.ts");
  const body = gate.slice(gate.indexOf("export async function reportablePot"));
  // The funded figure is the company's own acts only: no session kind in its sum.
  const pots = readSource("lib/billing/pot.ts");
  const funded = pots.slice(pots.indexOf("export async function potFundedCents"));
  assert.match(funded.slice(0, funded.indexOf("\n}\n")), /\["pot_topup", "pot_return"\]/);
  assert.match(body, /underHeadcount: true, fundedCents/);
});

test("B19 a receipt we cannot issue says why and gives a way to ask, scoped to the company", () => {
  const page = readSource("app/(sponsor)/sponsor/pot/[txn]/page.tsx");
  const refusal = page.slice(page.indexOf('"missing" in invoice'));
  assert.match(refusal.slice(0, refusal.indexOf("</Card>")), /<AskForReceipt txn=\{txn\} \/>/);
  const actions = readSource("app/(sponsor)/sponsor/pot/actions.ts");
  const ask = actions.slice(actions.indexOf("export async function askForReceipt"));
  assert.match(ask, /invoiceFor\(actor\.sponsorId, txn\)/, "the ask must be scoped to the signed-in company");
  assert.match(ask, /!\("missing" in invoice\)/, "only a receipt that cannot be issued is asked for");
  assert.match(ask, /kind: "ops\.receiptAsked"/);
});

test("W2-S10 / F7 the reporting floor applies to every aggregate, over people", async () => {
  const l = (await ledgerModule())!;
  const floor = 5;
  const few = [entry({ weekStart: "2026-08-03", personTag: "a" }), entry({ weekStart: "2026-08-10", personTag: "b" })];
  const quiet = l.ledgerAnalytics({ entries: few, floor, balanceCents: 50_000, topUps: [] });
  assert.equal(quiet.sessions, null);
  assert.equal(quiet.spendCents, null);
  assert.ok(quiet.coverageMix.every((b) => b.sessions === null));
  assert.equal(quiet.burnCents, null);
  assert.equal(quiet.runwayMonths, null);

  /* August has two people, September four more: August rolls into September, never dropped. */
  const more = [...few, ...["c", "d", "e", "f"].map((p) => entry({ weekStart: "2026-09-07", personTag: p }))];
  const out = l.ledgerAnalytics({ entries: more, floor, balanceCents: 7200, topUps: [{ amountCents: 10_000 }] });
  assert.equal(out.sessions, 6);
  assert.equal(out.spendCents, 7200);
  assert.deepEqual(out.coverageMix, [{ coverageBps: 6000, sessions: 6 }]);
  assert.equal(out.burnCents, 7200);
  assert.equal(out.runwayMonths, 1);
  assert.deepEqual(out.topUps, { count: 1, totalCents: 10_000 }, "top-ups are the company's own acts");

  /* A coverage bucket under the floor of PEOPLE is suppressed while the total is not. */
  const mixed = l.ledgerAnalytics({
    entries: [...more, entry({ coverageBps: 10000, coveredCents: 2000, personTag: "a" })],
    floor,
    balanceCents: null,
    topUps: [],
  });
  assert.deepEqual(mixed.coverageMix, [
    { coverageBps: 10000, sessions: null },
    { coverageBps: 6000, sessions: 6 },
  ]);
  assert.equal(mixed.runwayMonths, null, "no runway from a suppressed balance");
});

test("W2-S10 / F7 the CSV carries periods, sessions and spend, and every cell is escaped", async () => {
  const l = (await ledgerModule())!;
  const { periods } = l.ledgerPeriods(people(5), 5);
  const rows = l.ledgerCsvRows(periods, ["Period", "Sessions", "Spent"]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1], ["2026-09-07", 5, 60]);

  const route = readSource("app/(sponsor)/sponsor/ledger/export/route.ts");
  assert.match(route, /csvCell/, "the export does not escape its cells");
  assert.match(route, /getSponsorActor\(\)/, "the export is not behind the company's login");
});

test("W2-S10 C244's one exception reads one table and names nobody", () => {
  const reader = readSource("lib/data/sponsor-ledger.ts");
  assert.match(reader, /sponsorMoneyEntries/);
  assert.doesNotMatch(
    reader,
    /\b(sessions|patients|people|users|sessionPayments|ledgerEntries|enrolments|therapist\w*|specialt\w*|firstName|lastName|createdAt|scheduledAt)\b/,
    "the company's money view reaches past its own table",
  );
});

/* ------------------------------------------------------------ W2-S07 -- */

test("W2-S07 the verify-cycle screen and the pause job read the same number", () => {
  /*
   * Both screens print `settings.sponsor.verifyCycleMonths` (six); the job read
   * `sponsors.verify_cycle_months`, a column defaulting to three that nothing
   * writes. So a company was told six months and paused its people at three.
   */
  const job = readSource("lib/data/enrolment-verify.ts");
  const pause = job.slice(job.indexOf("export async function pauseUnverified"));
  assert.doesNotMatch(pause, /sponsors\.verifyCycleMonths/, "the job reads the column");
  assert.match(pause, /settings\.sponsor\.verifyCycleMonths/, "the job does not read the setting");

  for (const page of [
    "app/(sponsor)/sponsor/people/page.tsx",
    "app/(sponsor)/sponsor/settings/page.tsx",
  ]) {
    assert.match(readSource(page), /settings\.sponsor\.verifyCycleMonths/, page);
  }
});

/* ------------------------------------------------------------ W2-S04 -- */

test("W2-S04 ending a benefit takes a reason, then a final confirm, and can be cancelled", () => {
  const roster = readSource("components/sponsor/roster-list.tsx");
  /* A reason button only chooses. The act is its own button. */
  assert.doesNotMatch(
    roster,
    /onClick=\{\(\) => remove\(person\.enrolmentId, reason\)\}/,
    "one tap on a reason still ends the benefit",
  );
  assert.match(roster, /t\("sponsor\.cancel"\)/, "no way back out once the panel is open");
  assert.match(roster, /t\("sponsor\.benefitEnded"/, "nothing says the benefit ended");
});

test("W2-S04 replace code, remove field and revoke key each get Cancel and a success line", () => {
  for (const file of [
    "components/sponsor/code-card.tsx",
    "components/sponsor/gate-settings.tsx",
    "components/sponsor/integrations.tsx",
  ]) {
    const source = readSource(file);
    assert.match(source, /<ConfirmAct\b/, `${file} acts on one tap`);
  }

  const confirm = readSource("components/sponsor/confirm-act.tsx");
  assert.match(confirm, /t\("sponsor\.cancel"\)/, "the confirm has no Cancel");
  assert.match(confirm, /done/, "the confirm never reports success");
});

/* ------------------------------------------ W2-S10 / F7: no small group stands alone -- */

function entryIn(weekStart: string, personTag: string): Entry {
  return { kind: "session", weekStart, coverageBps: 10000, coveredCents: 5000, personTag };
}

test("W2-S10 / F7 a week holding one person is never shown on its own", () => {
  assert.deepEqual(ledgerPeriods([entryIn("2026-08-03", "a")], 5).periods, []);
});

test("W2-S10 / F7 quiet weeks gather into one period, dated by its span, once it holds five people", () => {
  const entries = [
    entryIn("2026-08-03", "a"),
    entryIn("2026-08-10", "b"),
    entryIn("2026-08-10", "c"),
    entryIn("2026-08-17", "d"),
    entryIn("2026-08-17", "e"),
    // The next period has only one so far, and waits.
    entryIn("2026-08-24", "f"),
  ];
  const { periods, heldBack } = ledgerPeriods(entries, 5);
  assert.deepEqual(periods, [{ from: "2026-08-03", to: "2026-08-17", sessions: 5, spendCents: 25_000 }]);
  assert.deepEqual(heldBack, { sessions: 1, spendCents: 5000 });
});

test("W2-S10 / F7 a week that clears the floor by itself keeps its own week", () => {
  const week = ["a", "b", "c", "d", "e"].map((p) => entryIn("2026-08-03", p));
  assert.deepEqual(ledgerPeriods(week, 5).periods, [
    { from: "2026-08-03", to: "2026-08-03", sessions: 5, spendCents: 25_000 },
  ]);
});

/* Board 357: a spent reset link says so on arrival, in the company and partner portals as in the clinic. */
test("the company and partner set-password pages check the link before drawing the form", () => {
  const sponsor = readSource("app/(sponsor)/sponsor/set-password/page.tsx");
  assert.ok(sponsor.indexOf("sponsorPasswordLinkLive(") > -1, "the company page asks whether the link is live");
  assert.ok(
    sponsor.indexOf("sponsorPasswordLinkLive(") < sponsor.indexOf("<SetPasswordForm"),
    "and asks before the form",
  );
  const partner = readSource("app/(partner)/partner/reset/page.tsx");
  assert.ok(
    partner.indexOf("partnerLinkUser(") > -1 &&
      partner.indexOf("partnerLinkUser(") < partner.indexOf("<PartnerChoosePasswordForm"),
  );
  /* One rule for the page and the write: the write goes through the same check. */
  assert.match(readSource("lib/partner/team.ts"), /const user = await partnerLinkUser\(token\);/);
  assert.match(readSource("lib/data/sponsor-users.ts"), /export async function sponsorPasswordLinkLive/);
});
