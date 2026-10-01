import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The independent due diligence: F7 (HR anonymity), F6 (partner launch and
 * partner-vouched consent), F9 (sensitive files on the public store).
 * Pure rules and source shapes; nothing here needs a database.
 */

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const source = (path: string) => strip(readFileSync(path, "utf8"));

/* ================================================================= F7 == */

type Entry = import("../lib/sponsor/ledger").LedgerEntry;
const e = (over: Partial<Entry>): Entry => ({
  kind: "session",
  weekStart: "2026-09-07",
  coverageBps: 6000,
  coveredCents: 1000,
  personTag: "p1",
  ...over,
});

test("🔴 F7 the floor counts DISTINCT PEOPLE: five sessions by one person are never a reported week", async () => {
  const l = await import("../lib/sponsor/ledger");
  const one = [1, 2, 3, 4, 5, 6].map(() => e({ personTag: "same" }));
  const out = l.ledgerPeriods(one, 5);
  assert.deepEqual(out.periods, [], "six sessions by one person were reported");
  assert.deepEqual(out.heldBack, { sessions: 6, spendCents: 6000 });

  const five = ["a", "b", "c", "d", "e"].map((p) => e({ personTag: p }));
  const reported = l.ledgerPeriods(five, 5);
  assert.deepEqual(reported.periods, [{ from: "2026-09-07", to: "2026-09-07", sessions: 5, spendCents: 5000 }]);
  assert.equal(reported.heldBack, null);
});

test("🔴 F7 a short week is merged into the next, never dropped, and untagged rows count as one person", async () => {
  const l = await import("../lib/sponsor/ledger");
  const entries = [
    ...["a", "b", "c"].map((p) => e({ weekStart: "2026-09-07", personTag: p })),
    ...["a", "d", "e"].map((p) => e({ weekStart: "2026-09-14", personTag: p })),
    ...[1, 2, 3, 4].map(() => e({ weekStart: "2026-09-21", personTag: null })),
  ];
  const out = l.ledgerPeriods(entries, 5);
  assert.deepEqual(out.periods, [{ from: "2026-09-07", to: "2026-09-14", sessions: 6, spendCents: 6000 }]);
  assert.deepEqual(out.heldBack, { sessions: 4, spendCents: 4000 }, "four untagged rows are one person, held back");
  assert.equal(l.distinctPeople(entries.slice(6)), 1);

  /* Review fix: the month is the published weeks summed; the held-back week stays held back. */
  const months = l.ledgerPeriods(entries, 5, "month");
  assert.deepEqual(months.periods, [{ from: "2026-09", to: "2026-09", sessions: 6, spendCents: 6000 }]);
  assert.deepEqual(months.heldBack, out.heldBack, "one held-back figure in both views");
});

test("🔴 F7 review fix: a month minus the weeks inside it never isolates a group below the floor", async () => {
  const l = await import("../lib/sponsor/ledger");
  /*
   * The attack: weeks 1 and 2 clear the floor and are shown; week 3 is ONE
   * person, held back. Merged on its own, the month used to clear the floor
   * with week 3 in it, so month minus weeks printed that one person's spend.
   */
  const entries = [
    ...["a", "b", "c", "d", "e"].map((p) => e({ weekStart: "2026-08-03", personTag: p, coveredCents: 1200 })),
    ...["f", "g", "h", "i", "j"].map((p) => e({ weekStart: "2026-08-10", personTag: p, coveredCents: 1100 })),
    e({ weekStart: "2026-08-17", personTag: "lonely", coveredCents: 4321 }),
    ...["k", "l", "m"].map((p) => e({ weekStart: "2026-08-24", personTag: p, coveredCents: 1000 })),
    /* This short run only clears the floor in September: a period across the month end. */
    ...["n", "o"].map((p) => e({ weekStart: "2026-09-07", personTag: p, coveredCents: 1000 })),
    ...["p", "q", "r", "s"].map((p) => e({ weekStart: "2026-09-14", personTag: p, coveredCents: 1000 })),
    e({ weekStart: "2026-09-21", personTag: "late", coveredCents: 777 }),
    /* And one trailing person, held back. */
    e({ weekStart: "2026-09-28", personTag: "tail", coveredCents: 999 }),
  ];
  const weeks = l.ledgerPeriods(entries, 5, "week");
  const months = l.ledgerPeriods(entries, 5, "month");

  assert.deepEqual(
    weeks.periods.map((p) => [p.from, p.to, p.spendCents]),
    [
      ["2026-08-03", "2026-08-03", 6000],
      ["2026-08-10", "2026-08-10", 5500],
      ["2026-08-17", "2026-09-07", 4321 + 3000 + 2000],
      ["2026-09-14", "2026-09-21", 4000 + 777],
    ],
  );
  /* The cross-month period is counted once, in the month it ends, and says where it began. */
  assert.deepEqual(
    months.periods.map((p) => [p.from, p.to, p.spendCents]),
    [
      ["2026-08", "2026-08", 11500],
      ["2026-08", "2026-09", 9321 + 4777],
    ],
  );

  /* Each month is exactly a run of whole published weekly periods, and together they are all of them. */
  let i = 0;
  for (const month of months.periods) {
    let sum = 0;
    while (sum < month.spendCents && i < weeks.periods.length) sum += weeks.periods[i++]!.spendCents;
    assert.equal(sum, month.spendCents, `month ${month.from}..${month.to} is not whole published weeks`);
  }
  assert.equal(i, weeks.periods.length, "every published week is in exactly one month");
  assert.deepEqual(months.heldBack, weeks.heldBack, "one held-back figure in both views");
  assert.deepEqual(weeks.heldBack, { sessions: 1, spendCents: 999 });

  /*
   * THE ATTACK, month minus weeks, over every pair of published figures in
   * both views: no difference is one small group's spend. Under the old
   * build, August cleared the floor on its own (14 people) and August minus
   * its two shown weeks was 4321 + 3000: four people, one of them alone.
   */
  const figures = [...weeks.periods, ...months.periods].map((p) => p.spendCents);
  const small = [4321, 4321 + 3000, 777, 999, 3000, 2000];
  for (const a of figures) {
    for (const b of figures) {
      assert.ok(!small.includes(a - b), `${String(a)} minus ${String(b)} isolates a group below the floor`);
    }
  }

  /* The analytics totals read the same published weeks. */
  const stats = l.ledgerAnalytics({ entries, floor: 5, balanceCents: null, topUps: [] });
  assert.equal(stats.spendCents, weeks.periods.reduce((s, p) => s + p.spendCents, 0));
});

test("🔴 F7 the floor can never be below five, in the settings or at read time", async () => {
  const l = await import("../lib/sponsor/ledger");
  const { parseGroup } = await import("../lib/settings/defs");
  assert.equal(l.SPONSOR_FLOOR_MIN, 5);
  for (const low of [0, 1, 2, 3, 4]) {
    assert.equal(parseGroup("sponsor", { activityFloor: low }).activityFloor, 5, `${low} was kept`);
    assert.equal(l.privacyFloor(low), 5);
  }
  assert.equal(parseGroup("sponsor", { activityFloor: 7 }).activityFloor, 7, "a higher floor is kept");
  // A floor of 2 passed straight to the aggregation is still five.
  const four = ["a", "b", "c", "d"].map((p) => e({ personTag: p }));
  assert.deepEqual(l.ledgerPeriods(four, 2).periods, []);
});

test("🔴 F7 no per-session price or employee share in any company ledger shape", async () => {
  const l = await import("../lib/sponsor/ledger");
  const five = ["a", "b", "c", "d", "e"].map((p) => e({ personTag: p }));
  const [period] = l.ledgerPeriods(five, 5).periods;
  assert.deepEqual(Object.keys(period!).sort(), ["from", "sessions", "spendCents", "to"]);
  const stats = l.ledgerAnalytics({ entries: five, floor: 5, balanceCents: null, topUps: [] });
  assert.ok(!("averagePriceCents" in stats) && !("employeeShareCents" in stats));
  const csv = l.ledgerCsvRows([period!], ["Period", "Sessions", "Spent"]);
  assert.deepEqual(csv[1], ["2026-09-07", 5, 50]);
  assert.ok(csv.every((row) => row.length === 3));

  const reader = source("lib/data/sponsor-ledger.ts");
  assert.doesNotMatch(reader, /priceCents|employeeCents/, "the company view reads a price or a share");
  const shape = reader.slice(reader.indexOf("export type PublishedLedger"), reader.indexOf("};", reader.indexOf("export type PublishedLedger")));
  assert.doesNotMatch(shape, /entries|price|employee/i, "the company view returns entries or a price");
  for (const file of ["app/(sponsor)/sponsor/ledger/page.tsx", "app/(sponsor)/sponsor/ledger/export/route.ts"]) {
    assert.doesNotMatch(source(file), /priceCents|employeeCents|ledgerPrice|ledgerEmployee/, file);
  }
});

test("🔴 F7 the overview and the ledger reconcile, the difference shown as held back", async () => {
  const l = await import("../lib/sponsor/ledger");
  // The report: overview EGP 20,300 / 18 sessions, ledger EGP 15,700 / 14.
  assert.deepEqual(l.reconcile({ sessions: 18, spentCents: 2_030_000 }, { sessions: 14, spendCents: 1_570_000 }), {
    sessions: 4,
    spendCents: 460_000,
  });
  assert.equal(l.reconcile({ sessions: 14, spentCents: 1_570_000 }, { sessions: 14, spendCents: 1_570_000 }), null);
  assert.equal(l.reconcile(null, { sessions: 14, spendCents: 1 }), null);
  assert.match(source("app/(sponsor)/sponsor/ledger/page.tsx"), /sponsor\.ledgerHeldBack/);
});

test("🔴 F7 the people list never says who USED the benefit", () => {
  const sponsors = source("lib/data/sponsors.ts");
  const roster = sponsors.slice(sponsors.indexOf("export async function roster"), sponsors.indexOf("export async function roster") + 1500);
  assert.doesNotMatch(roster, /lastVerifiedAt|pausedAt|lastUsed|sessionCount|count\(/);
  assert.match(roster, /firstName: people\.firstName/, "control: the name is still there");
});

/* ================================================================= F6 == */

test("🔴 F6 a launch is refused without the clinician's own approval, and allowed with it", async () => {
  const { launchRefusal } = await import("../lib/partner/launch");
  const base = { environment: "live" as const, found: true, verified: true };
  const refused = launchRefusal({ ...base, approved: false });
  assert.equal(refused?.status, 403);
  assert.match(refused!.error, /not approved your platform/);
  assert.equal(launchRefusal({ ...base, approved: true }), null);
  assert.equal(launchRefusal({ ...base, environment: "sandbox", approved: true })?.status, 403);
  assert.equal(launchRefusal({ ...base, found: false, approved: false })?.status, 404);

  const launch = source("lib/partner/launch.ts");
  assert.equal((launch.match(/hasApprovedPartner\(/g) ?? []).length, 2, "approval is asked at minting AND redemption");
});

test("🔴 F6 a launched session is fifteen minutes, read only, and only this partner's patients", async () => {
  const s = await import("../lib/partner/launch-scope");
  assert.equal(s.LAUNCH_SESSION_MS, 15 * 60 * 1000);
  const id = "0b9f2f8e-3c1a-4d55-9a8e-2f7c1e5d4a10";
  const v = (path: string, over: Partial<{ isAction: boolean; isApi: boolean; patientInScope: boolean | null }> = {}) =>
    s.scopeVerdict({ path, isAction: false, isApi: false, patientInScope: null, ...over });

  assert.equal(v("/partner-launch"), "admit");
  assert.equal(v(`/patients/${id}`, { patientInScope: true }), "admit");
  assert.equal(v(`/ar/patients/${id}/documents`, { patientInScope: true }), "admit");
  assert.equal(v(`/patients/${id}`, { patientInScope: false }), "refuse", "another partner's or nobody's patient");
  for (const path of ["/dashboard", "/patients", "/settings", "/settings/integrations", "/billing", "/earnings", "/notes"]) {
    assert.equal(v(path), "refuse", path);
  }
  assert.equal(v(`/patients/${id}`, { patientInScope: true, isAction: true }), "refuse", "read only");
  assert.equal(v("/partner-launch", { isApi: true }), "refuse", "no API route");

  const secret = "x".repeat(40);
  const sig = s.scopeSignatureFor("GET", "/partner-launch", secret);
  assert.equal(s.validScopeSignature({ method: "GET", path: "/partner-launch", signature: sig, secret }), true);
  assert.equal(s.validScopeSignature({ method: "POST", path: "/partner-launch", signature: sig, secret }), false);
  assert.equal(s.validScopeSignature({ method: "GET", path: "/settings", signature: sig, secret }), false);
  assert.equal(s.validScopeSignature({ method: "GET", path: "/partner-launch", signature: null, secret }), false);

  const launch = source("lib/partner/launch.ts");
  assert.match(launch, /const LAUNCH_MS = LAUNCH_SESSION_MS;/);
  const session = source("lib/auth/session.ts");
  assert.match(session, /if \(state\?\.actor\.partnerScope\) return null;/, "getActor hands a launched session out");
  const guard = source("lib/auth/guard.ts");
  assert.match(guard, /if \(state!\.actor\.partnerScope\) await holdToLaunchScope/);
  assert.match(guard, /if \(state\.actor\.partnerScope\) throw new AuthorizationError/);
});

test("🔴 F6 a partner's vouched yes never records; the patient's own does; anybody's withdrawal stops it", async () => {
  const c = await import("../lib/partner/consent");
  const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 10, m));
  assert.equal(c.boundaryFromEvents([{ state: "given", answeredAt: at(0), offsetSeconds: 0, source: "partner" }]), null);
  assert.equal(c.boundaryFromEvents([{ state: "given", answeredAt: at(0), offsetSeconds: 0 }]), null, "no source is partner");
  assert.equal(c.boundaryFromEvents([{ state: "given", answeredAt: at(0), offsetSeconds: 60, source: "patient" }]), 60);
  assert.equal(c.boundaryFromEvents([{ state: "given", answeredAt: at(0), offsetSeconds: 0, source: "sandbox" }]), 0);
  assert.equal(
    c.boundaryFromEvents([
      { state: "given", answeredAt: at(0), offsetSeconds: 0, source: "patient" },
      { state: "withdrawn", answeredAt: at(5), offsetSeconds: 300, source: "partner" },
    ]),
    null,
  );
  assert.equal(
    c.boundaryFromEvents([
      { state: "given", answeredAt: at(0), offsetSeconds: 0, source: "patient" },
      { state: "given", answeredAt: at(5), offsetSeconds: 0, source: "partner" },
    ]),
    0,
    "a later partner yes changes nothing",
  );
  assert.equal(c.partnerAnswerSource("live"), "partner");
  assert.equal(c.partnerAnswerSource("sandbox"), "sandbox");

  const route = source("app/api/partner/v1/consent/route.ts");
  assert.match(route, /source: partnerAnswerSource\(guard\.key\.environment\)/);
  assert.match(route, /patient_consent_url/);
});

test("🔴 F6 the patient's consent link names one session and cannot be altered", async () => {
  const p = await import("../lib/partner/patient-consent");
  const token = p.patientConsentToken({
    partnerId: "p-1",
    externalSessionRef: "S-1024",
    externalSubjectRef: "P-77",
    offsetSeconds: 600,
    expiresAt: new Date(Date.now() + 60_000),
  });
  assert.deepEqual(p.readPatientConsentToken(token), {
    partnerId: "p-1",
    externalSessionRef: "S-1024",
    externalSubjectRef: "P-77",
    offsetSeconds: 600,
    boundPerson: null,
  });
  const [body, mac] = token.split(".") as [string, string];
  const forged = Buffer.from(JSON.stringify({ p: "p-1", s: "S-9999", j: "P-77", o: 0, e: 9_999_999_999 })).toString("base64url");
  assert.equal(p.readPatientConsentToken(`${forged}.${mac}`), null);
  assert.equal(p.readPatientConsentToken(`${body}.x${mac.slice(1)}`), null);
  const expired = p.patientConsentToken({
    partnerId: "p-1",
    externalSessionRef: "S",
    externalSubjectRef: "P",
    offsetSeconds: 0,
    expiresAt: new Date(Date.now() - 1000),
  });
  assert.equal(p.readPatientConsentToken(expired), null);
});

test("🔴 F6 review fix: pressing No never links the patient to the partner", async () => {
  const p = await import("../lib/partner/patient-consent");
  const ask = { externalSubjectRef: "P-77", boundPerson: null };
  const session = { externalSubjectRef: "P-77", environment: "live" };
  const empty = { personId: null };

  /* An unlinked subject: a no is recorded (stopping is safe) and links nobody; only a yes links. */
  assert.deepEqual(p.patientAnswerPlan({ state: "withdrawn", personId: "me", ask, session, subject: empty }), {
    kind: "record",
    link: false,
  });
  assert.deepEqual(p.patientAnswerPlan({ state: "given", personId: "me", ask, session, subject: empty }), {
    kind: "record",
    link: true,
  });
  /* Already mine (a claim made elsewhere): a no records and leaves that link exactly as it was. */
  assert.deepEqual(p.patientAnswerPlan({ state: "withdrawn", personId: "me", ask, session, subject: { personId: "me" } }), {
    kind: "record",
    link: false,
  });

  /* And the code writes the link only on that plan, and never removes or revokes one. */
  const code = source("lib/partner/patient-consent.ts");
  const answer = code.slice(code.indexOf("export async function answerAsPatient"));
  const linkAt = answer.indexOf("if (plan.link)");
  const updateAt = answer.indexOf(".update(partnerSubjects)");
  assert.ok(linkAt > 0 && updateAt > linkAt, "the subject is written outside the yes branch");
  assert.equal(answer.split(".update(partnerSubjects)").length, 2, "one write to the subject, the yes");
  assert.doesNotMatch(code, /\.delete\(partnerSubjects\)|revokedAt:/, "a no must not unlink anybody");
  assert.ok(answer.indexOf("patientAnswerPlan(") < linkAt, "the answer is read before anything is written");
});

test("🔴 F6 review fix: a consent link is bound to its session's own patient", async () => {
  const p = await import("../lib/partner/patient-consent");
  const { en, ar } = await import("../lib/i18n/messages");
  const live = (subject: string) => ({ externalSubjectRef: subject, environment: "live" });
  const plan = (over: Partial<Parameters<typeof p.patientAnswerPlan>[0]>) =>
    p.patientAnswerPlan({
      state: "given",
      personId: "person-B",
      ask: { externalSubjectRef: "SUBJ-B", boundPerson: null },
      session: live("SUBJ-B"),
      subject: { personId: "person-B" },
      ...over,
    });

  assert.deepEqual(plan({}), { kind: "record", link: false }, "B answering about B's own session");

  /* THE ATTACK: the partner pairs B's own subject with patient A's session S-A. */
  const refused = { kind: "refuse", error: "not_yours" };
  assert.deepEqual(plan({ session: live("SUBJ-A") }), refused, "B said yes to A's session");
  assert.deepEqual(plan({ session: live("SUBJ-A"), subject: { personId: null } }), refused, "and an empty subject does not help");
  assert.deepEqual(plan({ state: "withdrawn", session: live("SUBJ-A") }), refused);
  /* A's subject in the link, opened by B. */
  assert.deepEqual(
    plan({ ask: { externalSubjectRef: "SUBJ-A", boundPerson: null }, session: live("SUBJ-A"), subject: { personId: "person-A" } }),
    refused,
  );
  /* No session of ours, or a sandbox one: nothing to answer. */
  assert.deepEqual(plan({ session: null }), { kind: "refuse", error: "invalid" });
  assert.deepEqual(plan({ session: { externalSubjectRef: "SUBJ-B", environment: "sandbox" } }), { kind: "refuse", error: "invalid" });

  /* The token carries the patient it was made for, as a keyed digest and never the id. */
  const token = p.patientConsentToken({
    partnerId: "p-1",
    externalSessionRef: "S-A",
    externalSubjectRef: "SUBJ-A",
    offsetSeconds: 0,
    expiresAt: new Date(Date.now() + 60_000),
    personId: "person-A",
  });
  const read = p.readPatientConsentToken(token)!;
  assert.equal(read.boundPerson, p.personDigest("person-A"));
  assert.ok(!Buffer.from(token.split(".")[0]!, "base64url").toString("utf8").includes("person-A"), "the partner reads our id");
  /* Even if the subject were later re-pointed at B, a link made for A answers only to A. */
  assert.deepEqual(plan({ ask: { externalSubjectRef: "SUBJ-B", boundPerson: read.boundPerson } }), refused);
  assert.deepEqual(
    plan({ personId: "person-A", ask: { externalSubjectRef: "SUBJ-B", boundPerson: read.boundPerson }, subject: { personId: "person-A" } }),
    { kind: "record", link: false },
  );

  /* The refusal is said in both languages, and the page and action use it. */
  assert.ok(en["pconsent.notYours"] && ar["pconsent.notYours"] && en["pconsent.notYours"] !== ar["pconsent.notYours"]);
  assert.match(source("app/(patient)/patient/partner-consent/[token]/page.tsx"), /t\("pconsent\.notYours"\)/);
  assert.match(source("app/(patient)/patient/partner-consent/[token]/actions.ts"), /not_yours/);
  assert.match(source("app/api/partner/v1/consent/route.ts"), /personId: await linkedPersonOf\(/);
});

/* ================================================================ F14 == */

test("🔴 F14 review fix: opening the welcome link spends nothing; only the Continue button does", async () => {
  const { existsSync } = await import("node:fs");
  assert.equal(existsSync("app/(auth)/signup/confirm/route.ts"), false, "a GET handler would spend the token for a mail scanner");
  const page = source("app/(auth)/signup/confirm/page.tsx");
  assert.doesNotMatch(page, /consumeSignupLink/, "rendering the page spends the token");
  assert.match(page, /<form action=\{continueSignup\}>/);
  assert.match(page, /type="hidden" name="token"/);
  assert.match(page, /t\("tauth\.confirm\.button"\)/);
  const action = source("app/(auth)/signup/confirm/actions.ts");
  assert.match(action, /^"use server";/);
  assert.match(action, /await consumeSignupLink\(token\)/);
  /* Still single use, in one conditional UPDATE, and still expiring. */
  const link = source("lib/auth/signup-link.ts");
  assert.match(link, /isNull\(authTokens\.usedAt\)/);
  assert.match(link, /gt\(authTokens\.expiresAt, new Date\(\)\)/);
  const { en, ar } = await import("../lib/i18n/messages");
  for (const key of ["tauth.confirm.title", "tauth.confirm.body", "tauth.confirm.button"] as const) {
    assert.ok(en[key] && ar[key], key);
  }
});

test("🔴 F14 review fix: a stranger cannot spend the owner's password resets", async () => {
  const r = await import("../lib/auth/reset-throttle");
  /* A fixed-window limiter like `consume`, on a clock the test moves. */
  let now = 0;
  const rows = new Map<string, { start: number; count: number }>();
  const consume = async (key: string, limit: number, windowSeconds: number) => {
    const row = rows.get(key);
    if (!row || row.start <= now - windowSeconds * 1000) {
      rows.set(key, { start: now, count: 1 });
      return { allowed: 1 <= limit };
    }
    row.count += 1;
    return { allowed: row.count <= limit };
  };
  const keyOf = (scope: string, subject: string) => `${scope}:${subject}`;
  const ask = (network: string, email = "nadia@clinic.example") => r.resetMailVerdict({ email, network, consume, keyOf });

  /* The attacker hammers the owner's address from their own network. */
  const sentToOwner: number[] = [];
  for (let minute = 0; minute < 60; minute++) {
    now = minute * 60_000;
    for (let i = 0; i < 5; i++) if ((await ask("attacker-net")) === "send") sentToOwner.push(now);
  }
  assert.ok(sentToOwner.length <= r.RESET_PER_ADDRESS_NETWORK, "one network buried the inbox");

  /* The owner, on their own network, in the same hour: never quiet, always a working link. */
  for (const minute of [1, 3, 30]) {
    now = minute * 60_000;
    const verdict = await ask("owner-net");
    assert.notEqual(verdict, "quiet", `the owner was locked out at minute ${String(minute)}`);
    if (verdict === "send") sentToOwner.push(now);
    else {
      /* "recent": an email went to this inbox in the last two minutes, and its link (one hour) works. */
      const last = Math.max(...sentToOwner.filter((t) => t <= now));
      assert.ok(now - last <= r.RESET_GAP_SECONDS * 1000, "told to check an inbox with no fresh link");
    }
  }

  /* However many networks, at most one email every two minutes to an address. */
  now = 2 * 60 * 60_000;
  const burst = await Promise.all(Array.from({ length: 50 }, (_, i) => ask(`botnet-${String(i)}`, "omar@clinic.example")));
  assert.equal(burst.filter((v) => v === "send").length, 1);

  /* And older reset links are never cancelled by a later request, which the "recent" answer relies on. */
  const actions = source("lib/auth/actions.ts");
  const reset = actions.slice(actions.indexOf("export async function requestPasswordReset"), actions.indexOf("export async function resetPassword"));
  assert.doesNotMatch(reset, /\.update\(authTokens\)/);
  assert.match(reset, /resetMailVerdict\(\{ email, network, consume, keyOf: subjectKey \}\)/);
  assert.doesNotMatch(reset, /"password-reset:address"/, "the old internet-wide bucket is back");
});

/* ================================================================= F9 == */

test("🔴 F9 a sensitive upload with no private store is refused, never written to the public store", async () => {
  const u = await import("../lib/uploads");
  const { en } = await import("../lib/i18n/messages");
  assert.equal(u.privateStoreConfigured({}), false);
  assert.equal(u.privateStoreConfigured({ BLOB_PRIVATE_READ_WRITE_TOKEN: "t" }), true);

  const saved = { main: process.env.BLOB_READ_WRITE_TOKEN, priv: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN };
  process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_not_real";
  delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  try {
    for (const kind of ["credential", "receipt", "support", "avatar"] as const) {
      const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
      const result = await u.uploadDocument({ kind, userId: "u-1", label: "doc", file });
      assert.equal(result.url, undefined, `${kind} was stored`);
      assert.equal(result.error, en["upload.privateStoreMissing"], kind);
    }
    await assert.rejects(u.putPrivate("person-document/x/y.pdf", Buffer.from("x"), "application/pdf"), u.PrivateStoreMissingError);
  } finally {
    if (saved.main === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = saved.main;
    if (saved.priv !== undefined) process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = saved.priv;
  }

  const uploads = source("lib/uploads.ts");
  const writer = uploads.slice(uploads.indexOf("export async function putPrivate"), uploads.indexOf("export async function fetchStored"));
  assert.doesNotMatch(writer, /access:\s*"public"/, "the private writer still has a public fallback");
  const { ar } = await import("../lib/i18n/messages");
  assert.ok(ar["upload.privateStoreMissing"], "the refusal has Arabic words");
});

test("🔴 F9 the move script finds public sensitive files, leaves headshots, and is a production door with a reason", async () => {
  const m = readFileSync("scripts/migrate-private-blobs.ts", "utf8");
  assert.match(m, /process\.argv\.includes\("--apply"\)/, "dry run by default");
  assert.match(m, /writesTo\(\{ productionIsAllowed: true \}\)/);
  const onProd = readFileSync("scripts/on-production.ts", "utf8");
  assert.match(onProd, /"blobs:migrate-private": \{\s*writes: true,\s*why: "[^"]+"/);
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts["blobs:migrate-private"] ?? "", /scripts\/migrate-private-blobs\.ts/);
  const { isPublicSensitiveBlob } = await import("../scripts/migrate-private-blobs");
  assert.equal(isPublicSensitiveBlob("https://abc.public.blob.vercel-storage.com/receipt/u/x.png"), true);
  assert.equal(isPublicSensitiveBlob("https://abc.public.blob.vercel-storage.com/headshot/u/x.png"), false);
  assert.equal(isPublicSensitiveBlob("https://abc.private.blob.vercel-storage.com/receipt/u/x.png"), false);
});
