import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  adjustmentEffect,
  counterAccountFor,
  effectSentence,
  ledgerAmountFor,
} from "../lib/billing/adjust-effect";
import { LEDGER_ACCOUNTS } from "../lib/db/schema";
import { ar, en, type MessageKey } from "../lib/i18n/messages";

/**
 * Round 2 console and company fixes (org2 board rows). Each test names the
 * board row it would have caught.
 */

const tEn = (key: MessageKey, values: Record<string, string | number> = {}): string =>
  Object.entries(values).reduce<string>((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), en[key]);

test("593: adding $2 to a clinician's held balance raises it from $64 to $66", () => {
  // The held balance is read as the negative of the ledger's sum.
  const sums = { therapist_payable: -6400 };
  const ledgerCents = ledgerAmountFor("therapist_payable", "up", 200);
  assert.equal(ledgerCents, -200, "a credit on a liability is a negative leg");
  const [held, ours] = adjustmentEffect({ account: "therapist_payable", ledgerCents, sums });
  assert.deepEqual([held.beforeCents, held.afterCents], [6400, 6600]);
  assert.equal(ours.account, "platform_expense", "goodwill we give is our cost");
  assert.equal(ours.afterCents - ours.beforeCents, 200);
});

test("593: taking it off lowers the held balance, and our income carries the other side", () => {
  const ledgerCents = ledgerAmountFor("therapist_payable", "down", 200);
  const [held, ours] = adjustmentEffect({ account: "therapist_payable", ledgerCents, sums: { therapist_payable: -6400 } });
  assert.deepEqual([held.beforeCents, held.afterCents], [6400, 6200]);
  assert.equal(ours.account, "platform_revenue");
  assert.equal(ours.afterCents - ours.beforeCents, 200);
});

test("593: every account moves the way the operator chose, both ways", () => {
  for (const account of LEDGER_ACCOUNTS) {
    for (const direction of ["up", "down"] as const) {
      const ledgerCents = ledgerAmountFor(account, direction, 500);
      const [own, other] = adjustmentEffect({ account, ledgerCents, sums: {} });
      assert.equal(own.afterCents - own.beforeCents, direction === "up" ? 500 : -500, account);
      assert.notEqual(other.account, account, `${account} never balances against itself`);
    }
  }
  assert.equal(counterAccountFor("platform_revenue", 100), "platform_expense");
  assert.equal(counterAccountFor("platform_expense", 100), "platform_revenue");
});

test("593: every account has words in both languages, and the sentence names no code", () => {
  for (const account of LEDGER_ACCOUNTS) {
    const key = `adj.acct.${account}` as MessageKey;
    assert.ok(en[key], `${account} in English`);
    assert.ok(ar[key], `${account} in Arabic`);
  }
  const effect = adjustmentEffect({
    account: "therapist_payable",
    ledgerCents: ledgerAmountFor("therapist_payable", "up", 200),
    sums: { therapist_payable: -6400 },
  });
  const sentence = effectSentence(tEn, effect, { clinician: "Amira Hassan", org: "Amira's practice" });
  assert.match(sentence, /Held for Amira Hassan: \$64\.00 to \$66\.00\. Our costs, Amira's practice: \$0\.00 to \$2\.00\./);
  assert.doesNotMatch(sentence, /therapist_payable|platform_/);
});

test("593: the form posts the direction's sign, previews, and the audit row names the practice", () => {
  const form = readFileSync("components/admin/ledger-adjust.tsx", "utf8");
  assert.match(form, /ledgerAmountFor\(account, direction, magnitude\)/);
  assert.match(form, /amountCents: ledgerCents/);
  assert.match(form, /adjustmentPreview\(/);
  assert.doesNotMatch(form, /Negative is fine/);
  const actions = readFileSync("app/(admin)/admin/actions.ts", "utf8");
  assert.match(actions, /organizationId: entry\.organizationId,\n\s+category: "billing",\n\s+action: "ledger\.adjust"/);
  const card = readFileSync("components/admin/pending-approvals.tsx", "utf8");
  assert.match(card, /adj\.posted/);
  assert.match(card, /setDecided/);
});

test("489: an operator's reason ending in a full stop gets no second one", async () => {
  const { asSentence } = await import("../lib/i18n/sentence");
  assert.equal(asSentence("Please attach the receipt and submit again."), "Please attach the receipt and submit again.");
  assert.equal(asSentence("wrong reference"), "wrong reference.");
  assert.equal(asSentence("هل أرسلته؟"), "هل أرسلته؟");
  for (const dict of [en, ar]) assert.doesNotMatch(dict["pmsg.pay.rejected"], /\{reason\}\./);
  const notices = readFileSync("lib/billing/payment-notices.ts", "utf8");
  assert.match(notices, /reason: asSentence\(/);
});

test("490: a rejected top-up shows on the page, with what was sent, before anything is pressed", () => {
  const popup = readFileSync("components/billing/payment-popup.tsx", "utf8");
  const closed = popup.slice(popup.indexOf("if (!open) {"));
  assert.match(closed, /live\.state === "rejected" \? <RejectedTransfer live=\{live\} \/>/);
  assert.match(closed, /pop\.sendAgain/);
  const entry = readFileSync("lib/billing/manual-entry.ts", "utf8");
  assert.match(entry, /latest\?\.state === "rejected"/, "only a rejection that is still the last word");
  assert.match(entry, /sentLabel: formatMoney\(/);
});
