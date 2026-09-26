import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../scripts/_verify";
import { ar } from "../lib/i18n/messages";
import { splitGrants } from "../lib/consent/grant-rows";

/**
 * Round 3 board (the walkthrough on the redesigned site), patient app. Each
 * test names the board row it would have caught.
 */

/* Words of spoken Egyptian that the rest of the Arabic app, which is formal, never uses. */
const COLLOQUIAL = /(^|[\s"،.])(مش|لسه|بتاع[ةك]?|بتاعتك|مفيش|دلوقتي|عشان|علشان|كده|الجاية|هيدخل|هتدفع|بيتراجع|بتتفتح|نبعته|بقت|ماتخصمش|تمنها)(?=[\s"،.؟]|$)/;

test("board 675/838: the claim page, the join page's pay line and the change page speak formal Arabic", () => {
  for (const key of [
    "pclaim.allYoursTitle",
    "pclaim.allYoursBody",
    "join.privateNoteTransfer",
    "pop.cancelSureBody",
    "w1a.walletCreditBody",
    "pchange.refundWallet",
    "pchange.transferWaiting",
    "pchange.transferWaitingDone",
    "pchange.covered",
    "pchange.coveredDone",
  ] as const) {
    assert.doesNotMatch(ar[key], COLLOQUIAL, `${key}: ${ar[key]}`);
  }
  /* CONTROL: the scan does catch the lines the board quoted. */
  assert.match("سجلاتك بقت بتاعتك بالفعل", COLLOQUIAL);
  assert.match("هتدفع بتحويل بنكي في الصفحة الجاية.", COLLOQUIAL);
});

test("board 676/866: no masculine form for a clinician whose gender the product does not record", () => {
  for (const key of ["consent.askThem", "pask.askThem", "prating.neverJoined", "room.anonymous"] as const) {
    assert.doesNotMatch(ar[key], /اطلب منه|لم يحضر|يرى \{/, `${key}: ${ar[key]}`);
  }
});

test("board 674/731: the benefit page's Ask button and its answer are in the reader's language", () => {
  const form = readSource("components/patient/benefit-form.tsx");
  assert.doesNotMatch(form, /"Ask"/);
  assert.match(form, /t\("benefit\.ask"\)/);
  assert.match(form, /t\(answer\)/);
  assert.match(readSource("lib/data/sponsor-domains.ts"), /message: "benefit\.askAnswer"/);
});

test("board 872: the SOS sheet names the country in the reader's language only", () => {
  const orb = readSource("components/patient/sos-orb.tsx");
  assert.doesNotMatch(orb, /مصر · Egypt/);
  assert.match(orb, /countryLabel\(entry\.country, locale\)/);
});

test("board 870: the language button answers the press before the saved line arrives", () => {
  assert.match(readSource("components/settings/language-save.tsx"), /pending \? t\("common\.saving"\)/);
  assert.match(readSource("components/settings/language-setting.tsx"), /<LanguageSave \/>/);
});

test("board 966: the radar profile's Saved does not wait for the whole page to re-render", () => {
  const actions = readSource("app/(app)/on-call/actions.ts");
  const body = actions.slice(actions.indexOf("export async function saveRadarSetup"), actions.indexOf("export async function toggleRadar"));
  assert.doesNotMatch(body, /revalidatePath/);
  assert.match(body, /savedAt: Date\.now\(\)/);
  assert.match(readSource("components/radar/therapist-console.tsx"), /if \(formState\.savedAt\) router\.refresh\(\)/);
});

test("board 968: the public radar and a clinician's booking page lead with pounds; the rest of the website with dollars", () => {
  assert.match(readSource("app/(public)/radar/page.tsx"), /<MoneyDisplayProvider primary="EGP">/);
  assert.match(readSource("app/(public)/t/[id]/layout.tsx"), /<MoneyDisplayProvider primary="EGP">/);
  assert.match(readSource("app/(public)/layout.tsx"), /primary="USD"/, "marketing pages unchanged");
  assert.doesNotMatch(readSource("components/radar/booking-sheet.tsx"), /: "Free"\}/);
});

test("board 749: who has access now lists live access; ended access once per clinician, apart", () => {
  const now = Date.parse("2026-09-26T08:00:00Z");
  const day = (h: number) => new Date(now + h * 3_600_000);
  const amira = (id: string, extra: object) => ({
    id,
    therapistName: "Amira Demo",
    status: "granted",
    expiresAt: null,
    decidedAt: day(-5),
    revokedAt: null,
    ...extra,
  });
  const { live, ended } = splitGrants(
    [
      amira("live", { expiresAt: day(24) }),
      amira("expired", { expiresAt: day(-1) }),
      amira("stopped1", { status: "revoked", revokedAt: day(-3) }),
      amira("stopped2", { status: "revoked", revokedAt: day(-2) }),
      { ...amira("other", { status: "revoked", revokedAt: day(-4) }), therapistName: "Yassin Demo" },
      { ...amira("other2", { status: "revoked", revokedAt: day(-2) }), therapistName: "Yassin Demo" },
    ],
    now,
  );
  assert.deepEqual(live.map((g) => g.id), ["live"]);
  /* Amira reads it now, so no dead rows of hers; Yassin once, his latest. */
  assert.deepEqual(ended.map((g) => g.id), ["other2"]);
  assert.match(readSource("components/patient/consent-list.tsx"), /splitGrants\(grants/);
});
