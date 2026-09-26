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

test("475: the sheet's header follows the rung, and the bar opens a sheet already on the page", () => {
  const sheet = readFileSync("components/billing/pay-by-transfer.tsx", "utf8");
  assert.match(sheet, /rung && rung\.index > 0 \?/);
  assert.match(sheet, /onStep=\{onStep\}/);
  const stepper = readFileSync("components/billing/top-up-stepper.tsx", "utf8");
  assert.match(stepper, /onStep\?\.\(chosen, i\)/);
  const bar = readFileSync("components/billing/pending-bar.tsx", "utf8");
  assert.match(bar, /dispatchEvent\(new CustomEvent\(PAY_OPEN_EVENT/);
  const popup = readFileSync("components/billing/payment-popup.tsx", "utf8");
  assert.match(popup, /addEventListener\(PAY_OPEN_EVENT/);
});

test("564: a card says documents were not kept only while none are there", () => {
  const page = readFileSync("app/(admin)/admin/verifications/page.tsx", "utf8");
  assert.match(
    page,
    /documentsCleared=\{\s*row\.documentsClearedAt !== null && !IDENTITY_KINDS\.some\(\(kind\) => URL_OF\[kind\]\(row\) !== null\)/,
  );
  const card = readFileSync("components/admin/verification-review.tsx", "utf8");
  assert.doesNotMatch(card, />\s*Turned down once\. Rejecting again/, "the count is the real one");
});

test("590: a partner's or company's message goes to the professionals' queue, and late is said in words", async () => {
  const { ticketAudience } = await import("../lib/data/ticket-audience");
  assert.equal(ticketAudience("a_partnership", false), "therapist");
  assert.equal(ticketAudience("a_company", false), "therapist");
  assert.equal(ticketAudience("something_else", true), "therapist", "a known partner developer, whatever the topic");
  assert.equal(ticketAudience("billing", false), "patient");
  const support = readFileSync("lib/data/support.ts", "utf8");
  assert.match(support, /audience: input\.audience \?\? ticketAudience\(topic, await professionalSender\(email\)\)/);
  const queue = readFileSync("components/admin/support-queue.tsx", "utf8");
  assert.match(queue, /`Overdue \$\{row\.lateHours\}h/);
});

test("506: with Stripe off, a held balance says how the clinician is paid, not 'No Stripe account'", () => {
  const card = readFileSync("components/admin/held-balances.tsx", "utf8");
  const paid = card.indexOf("avault.paidInstapay");
  const off = card.indexOf("avault.noPayoutMethod");
  const stripe = card.indexOf("No Stripe account</Badge>");
  assert.ok(paid > 0 && off > paid && stripe > off, "the manual method, then Stripe off, and only then the Stripe line");
  const page = readFileSync("app/(admin)/admin/vault/page.tsx", "utf8");
  assert.match(page, /stripeOn=\{features\.billing\}/);
  assert.match(page, /payoutMethod: payoutBy\.get\(/);
});

test("497: a wallet credit on the Needs a decision card is shown without its id", async () => {
  const { WALLET_RESOLUTION, shownResolution } = await import("../lib/billing/transfer-wallet");
  const stored = `${WALLET_RESOLUTION}a5acbfd8-7883-41b2-a6f9-7df38889c173. Refund instead from here if they ask.`;
  const shown = shownResolution(stored)!;
  assert.doesNotMatch(shown, /[0-9a-f]{8}-[0-9a-f]{4}/);
  assert.equal(shown, "Credited to the patient's wallet. Refund instead from here if they ask.");
  assert.equal(shownResolution("Refunded by hand"), "Refunded by hand");
  const page = readFileSync("app/(admin)/admin/transfers/page.tsx", "utf8");
  assert.match(page, /shownResolution\(e\.exceptionResolution\)/);
});

test("484: /admin/transfers asks the database in three rounds, not seven", () => {
  const page = readFileSync("app/(admin)/admin/transfers/page.tsx", "utf8");
  const awaits = page.match(/await (db|Promise\.all|approvalViews)\b/g) ?? [];
  assert.ok(awaits.length <= 3, `${awaits.length} serial database rounds: ${awaits.join(", ")}`);
  assert.doesNotMatch(page, /rows=\{await approvalViews/);
});

test("543/544: staff below the owner see the open operations alerts on every console page", () => {
  const layout = readFileSync("app/(admin)/layout.tsx", "utf8");
  assert.match(layout, /ownsOverview \? Promise\.resolve\(\[\]\) : opsAlertBoard\(\)/);
  assert.match(layout, /<StaffOpsAlerts rows=\{alerts\} t=\{t\} \/>/);
  const card = readFileSync("components/admin/ops-alerts.tsx", "utf8");
  const staff = card.slice(card.indexOf("export function StaffOpsAlerts"));
  assert.match(staff, /row\.status === "open"/, "only what is open, never the owner's reports");
  assert.doesNotMatch(staff.slice(0, staff.indexOf("\n}\n")), /\/admin\/errors/, "no link to a page they cannot open");
  for (const dict of [en, ar]) assert.ok(dict["aops.staffNote"]);
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
