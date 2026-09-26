import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../scripts/_verify";
import { cancelledPaymentRoute } from "../lib/billing/split-refund";
import { sortForGroup } from "../lib/sessions/order";
import { uncoveredStretches } from "../lib/transcript/gaps";
import { handleDelivery } from "../lib/patient-auth/handle-delivery";
import { transferFieldWords } from "../lib/billing/transfer-words";
import { regulatorNameFor } from "../lib/regulators";
import { parseCountry, storedRegulators } from "../lib/settings/defs";

/**
 * Round 2 board, patient app and therapist portal (fix2/care). Each test names
 * the board row it would have caught.
 */

const transfer = {
  fundingSource: "card",
  capture: "platform",
  stripePaymentIntentId: null,
  gatewayPaid: false,
  hasPerson: true,
  walletEnabled: true,
};

test("board 430: a cancelled session paid by bank transfer goes to the patient's wallet (ruling 18)", () => {
  assert.equal(cancelledPaymentRoute(transfer), "wallet");
});

test("board 430: a card, gateway or pot payment goes back on its own rail", () => {
  assert.equal(cancelledPaymentRoute({ ...transfer, stripePaymentIntentId: "pi_1" }), "rail");
  assert.equal(cancelledPaymentRoute({ ...transfer, gatewayPaid: true }), "rail");
  assert.equal(cancelledPaymentRoute({ ...transfer, fundingSource: "pot" }), "rail");
  assert.equal(cancelledPaymentRoute({ ...transfer, capture: "destination" }), "rail");
});

test("board 430: no wallet to put it in (a guest, or the wallet off) queues a refund instead", () => {
  assert.equal(cancelledPaymentRoute({ ...transfer, hasPerson: false }), "rail");
  assert.equal(cancelledPaymentRoute({ ...transfer, walletEnabled: false }), "rail");
});

test("board 430: both cancellations try the wallet before the refund queue", () => {
  for (const file of ["lib/data/clinician-cancel.ts", "lib/data/booking-change.ts"]) {
    const source = readSource(file);
    const wallet = source.indexOf("refundTransferToWallet(");
    const rail = source.indexOf("refundSessionPayment({");
    assert.ok(wallet > 0 && rail > wallet, `${file} calls refundTransferToWallet before refundSessionPayment`);
  }
  assert.match(readSource("lib/data/clinician-cancel.ts"), /w1a\.walletCreditBody/);
});

test("board 374: the Booked list runs soonest first, the past lists latest first", () => {
  const rows = [
    { id: "mon10", at: new Date("2026-09-28T07:00:00Z") },
    { id: "sun11", at: new Date("2026-09-27T08:00:00Z") },
    { id: "sun10", at: new Date("2026-09-27T07:00:00Z") },
  ];
  assert.deepEqual(sortForGroup("upcoming", rows).map((r) => r.id), ["sun10", "sun11", "mon10"]);
  assert.deepEqual(sortForGroup("today", rows).map((r) => r.id), ["sun10", "sun11", "mon10"]);
  assert.deepEqual(sortForGroup("past_scheduled", [...rows].reverse()).map((r) => r.id), ["mon10", "sun11", "sun10"]);
  assert.match(readSource("components/patient/session-list.tsx"), /sortForGroup\(/);
});

test("board 407: a cancelled booking of theirs renders, never a 404, on the change page", () => {
  const page = readSource("app/(patient)/patient/sessions/[id]/change/page.tsx");
  assert.match(page, /cancelledView\(/);
  assert.ok(page.indexOf("cancelledView(") < page.lastIndexOf("notFound()") + 1_000);
});

test("board 418: a covered session never prints its price as paid", () => {
  assert.match(readSource("components/patient/session-list.tsx"), /session\.covered/);
  assert.match(readSource("app/(patient)/patient/account/page.tsx"), /session\.covered/);
});

test("board 429: the clinician's cancel confirmation reads the payment", () => {
  assert.match(readSource("app/(app)/sessions/[id]/page.tsx"), /<CancelSession sessionId=\{id\} paid=/);
});

test("board 334/344: two tracks stored interleaved are one covered session, not minutes off record", () => {
  /* A two-minute call: the clinician's track and the patient's, stored in arrival order. */
  const chunk = (n: number) => ({ startMs: (n - 1) * 8_000, endMs: n * 8_000 });
  const stored = [chunk(1), chunk(13), chunk(2), chunk(14), chunk(3), chunk(15), chunk(4)];
  const alsoMiddle = [...stored, ...[5, 6, 7, 8, 9, 10, 11, 12].map(chunk)];
  assert.deepEqual(uncoveredStretches(alsoMiddle, 20_000), []);
  /* A real stretch neither track covers still counts, once. */
  const gap = uncoveredStretches([chunk(1), chunk(2), { startMs: 60_000, endMs: 68_000 }, chunk(3)], 20_000);
  assert.deepEqual(gap, [{ fromMs: 24_000, toMs: 60_000, seconds: 36 }]);
});

test("board 276: the claim page's warning comes from where the code went", () => {
  assert.deepEqual(handleDelivery("whatsapp", ["email"]), { channel: "email", channelDown: false });
  assert.deepEqual(handleDelivery("whatsapp", ["whatsapp"]), { channel: "whatsapp", channelDown: false });
  assert.deepEqual(handleDelivery("whatsapp", []), { channel: "whatsapp", channelDown: true });
  assert.match(readSource("lib/patient-auth/handle.ts"), /handleDelivery\(channel, delivery\.channels\)/);
});

test("board 274: a person whose record is already claimed is not told nobody wrote them down", () => {
  const page = readSource("app/(patient)/patient/claim/page.tsx");
  assert.match(page, /alreadyTheirs \?/);
  assert.match(page, /pclaim\.allYoursBody/);
});

test("board 364: an Arabic payment screen never carries the operator's English note", () => {
  const instapay = { label: "InstaPay", hint: "Fastest option", labelAr: "", hintAr: "" };
  assert.deepEqual(transferFieldWords(instapay, "ar"), { label: "InstaPay", hint: "" });
  assert.deepEqual(transferFieldWords({ ...instapay, labelAr: "إنستاباي", hintAr: "الأسرع" }, "ar"), {
    label: "إنستاباي",
    hint: "الأسرع",
  });
  assert.deepEqual(transferFieldWords(instapay, "en"), { label: "InstaPay", hint: "Fastest option" });
  assert.match(readSource("components/billing/pay-by-transfer.tsx"), /transferFieldWords\(raw, locale\)/);
});

test("board 364: the licence body is named in Arabic, or not named at all, on an Arabic page", () => {
  assert.equal(regulatorNameFor("Egyptian Ministry of Health and Population", "ar"), "وزارة الصحة والسكان المصرية");
  assert.equal(regulatorNameFor("Egyptian Medical Syndicate (نقابة الأطباء)", "ar"), "نقابة الأطباء");
  assert.equal(regulatorNameFor("Egyptian Supreme Council for Mental Health", "ar"), null);
  assert.equal(
    regulatorNameFor("Egyptian Supreme Council for Mental Health", "ar", {
      "Egyptian Supreme Council for Mental Health": "المجلس الأعلى للصحة النفسية",
    }),
    "المجلس الأعلى للصحة النفسية",
  );
  assert.equal(regulatorNameFor("Egyptian Supreme Council for Mental Health", "en"), "Egyptian Supreme Council for Mental Health");
});

test("board 364: a regulator line carries its Arabic name after a bar, and keeps it through a save", () => {
  const base = {
    code: "eg",
    name: "Egypt",
    vatBps: 0,
    currency: "egp",
    paymentMethods: [],
    entity: "eg",
    enabled: true,
  };
  const parsed = parseCountry({ ...base, regulators: ["Supreme Council | المجلس الأعلى", "Plain Body"] });
  assert.deepEqual(parsed.regulators, ["Supreme Council", "Plain Body"]);
  assert.deepEqual(parsed.regulatorNamesAr, { "Supreme Council": "المجلس الأعلى" });
  assert.deepEqual(storedRegulators(parsed), ["Supreme Council | المجلس الأعلى", "Plain Body"]);
  /* writeCountrySettings parses what it is handed a second time: nothing is lost. */
  assert.deepEqual(parseCountry({ ...parsed, regulators: parsed.regulators }).regulatorNamesAr, parsed.regulatorNamesAr);
});

test("board 432: only the clinician's cancellation notice carries the clinician's reason", () => {
  const source = readSource("lib/data/notices.ts");
  assert.match(source, /reason: noticeCarriesReason\(row\.messageKey\) \? row\.reason : null/);
  assert.match(source, /new Set<string>\(\["w1a\.cancelledByClinician"\]\)/);
});

test("board 301: the join page promises a card gateway only when the pay page offers a card", () => {
  assert.match(readSource("app/join/[token]/page.tsx"), /cardsLive=\{await \(await import\("@\/lib\/billing\/egypt"\)\)\.railIsReady\(\)\}/);
  assert.match(readSource("components/join/join-flow.tsx"), /cardsLive \? "join\.privateNotePaid" : "join\.privateNoteTransfer"/);
});

test("board 334: a session held in our own room names its source", () => {
  assert.match(readSource("app/(app)/sessions/[id]/page.tsx"), /impliedKind=/);
});
