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

  const months = l.ledgerPeriods(entries, 5, "month");
  assert.deepEqual(months.periods, [{ from: "2026-09", to: "2026-09", sessions: 10, spendCents: 10000 }]);
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
  const { isPublicSensitiveBlob } = await import("../scripts/_private-blobs");
  assert.equal(isPublicSensitiveBlob("https://abc.public.blob.vercel-storage.com/receipt/u/x.png"), true);
  assert.equal(isPublicSensitiveBlob("https://abc.public.blob.vercel-storage.com/headshot/u/x.png"), false);
  assert.equal(isPublicSensitiveBlob("https://abc.private.blob.vercel-storage.com/receipt/u/x.png"), false);
});
