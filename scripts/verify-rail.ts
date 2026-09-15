/**
 * Sprint 73 acceptance: the Egyptian rail.
 *
 *   npm run verify:rail
 *
 * ## 🔴 THE PROPERTY THAT MATTERS IS THAT NOTHING HAPPENS UNTIL A PERSON SAYS SO
 *
 * There is no processor behind this rail. No webhook confirms the money, no
 * chargeback reverses it, and the row in `manual_payments` is the ONLY record
 * that anybody checked anything. Every check below is about that: the action is
 * taken on confirmation and never before, a rejection cannot exist without a
 * reason, and the details cannot be edited while somebody is transferring
 * against them.
 *
 * What it cannot check is whether an operator looked properly. Nothing can.
 */
import { readFileSync } from "node:fs";

import { readSource, reporter } from "./_verify";

const { check, finish } = reporter();

async function main() {
  const sql = readFileSync("drizzle/0102_manual_rail.sql", "utf8");
  const lib = readSource("lib/billing/manual.ts");
  const grants = readSource("lib/billing/manual-grants.ts");

  /* ================================================================== */
  /*  The database holds the rules, not the code paths                   */
  /* ================================================================== */

  /*
   * 🔴 EVERY RULE THAT MATTERS IS A CHECK CONSTRAINT.
   *
   * A rule enforced only in TypeScript is a rule that holds until somebody adds
   * a second write path, and this table is the sole record of money that moved
   * outside any processor. The four below are the ones whose absence would be
   * unrecoverable rather than annoying.
   */
  const CONSTRAINTS = [
    ["one payer, never two", "manual_payments_one_payer"],
    ["a rejection carries its reason", "manual_payments_rejection_has_reason"],
    ["a decision names who made it", "manual_payments_decision_is_attributed"],
    ["nobody pays zero", "manual_payments_amount_positive"],
  ] as const;

  const missing = CONSTRAINTS.filter(([, name]) => !sql.includes(name));
  check(
    "🔴 the rules that cannot be lost are CHECK constraints, not code paths",
    missing.length === 0,
    missing.map(([why]) => why).join(", ") ||
      CONSTRAINTS.map(([why]) => why).join(" · "),
  );

  /*
   * 🔴 AND THE ONE THAT STOPS A DOUBLE PAYMENT IS A UNIQUE INDEX.
   *
   * A patient tapping "I have paid" four times on a slow connection makes four
   * rows without it, an operator confirms two, and a session is paid for twice
   * with no processor to reverse it. Partial, so the history of rejected
   * attempts survives.
   */
  check(
    "🔴 one live payment per thing being paid for, enforced by a partial unique index",
    /CREATE UNIQUE INDEX[\s\S]{0,200}manual_payments_one_live_per_ref[\s\S]{0,300}WHERE state IN \('awaiting_proof', 'submitted'\)/.test(
      sql,
    ),
    "four taps on a slow connection make one row",
  );

  /* ================================================================== */
  /*  Nothing is granted before a person confirms                        */
  /* ================================================================== */

  /*
   * 🔴 THE GRANT IS A CALLBACK, NOT AN IMPORT.
   *
   * `manual.ts` owns the queue and must not be able to reach a money table. A
   * file that both ran the state machine and credited pots is a file where a
   * queue bug can take a pot with it.
   */
  const reaches = ["sponsorPots", "sessions", "invoices"].filter((table) =>
    lib
      .split("\n")
      .filter((l) => /^\s*import\b|from\s+["']/.test(l))
      .join("\n")
      .includes(table),
  );
  check(
    "🔴 the queue module cannot reach a money table at all",
    reaches.length === 0,
    reaches.join(", ") || "it owns rows and states; what a confirmation unlocks belongs elsewhere",
  );

  check(
    "🔴 CONTROL the same scan catches an import it should refuse",
    ['import { sponsorPots } from "@/lib/db/schema";']
      .filter((l) => /from\s+["']/.test(l))
      .some((l) => l.includes("sponsorPots")),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /*
   * 🔴 THE STATE IS IN THE WHERE, NEVER READ FIRST.
   *
   * Read-then-write lets two taps in the same second both pass the read, and the
   * second reopens a payment an operator has already decided.
   */
  check(
    "🔴 every transition names the state it is coming from, in the WHERE",
    /submitProof[\s\S]{0,900}inArray\(manualPayments\.state/.test(lib) &&
      /confirmPayment[\s\S]{0,900}eq\(manualPayments\.state, "submitted"\)/.test(lib) &&
      /rejectPayment[\s\S]{0,900}eq\(manualPayments\.state, "submitted"\)/.test(lib),
    "submit, confirm and reject are all conditional on where the row already was",
  );

  /*
   * 🔴 A SESSION IS UNLOCKED BY THE COLUMN THE JOIN GATE ALREADY READS.
   *
   * Not a second flag. Two columns that both mean "paid" is two columns that can
   * disagree, and the one the join token reads would win silently.
   */
  check(
    "🔴 a confirmed session payment flips the same column the join gate reads",
    /paymentStatus: "paid"/.test(grants) &&
      /eq\(sessions\.paymentStatus, "pending"\)/.test(grants),
    "no second flag, so there is nothing for it to disagree with",
  );

  /*
   * 🔴 THE POT CREDIT IS IDEMPOTENT BY LEDGER, NOT BY BALANCE.
   *
   * A bare `balance = balance + n` run twice credits twice and nothing in the
   * row remembers it happened.
   */
  check(
    "🔴 a pot top-up cannot be applied twice",
    /NOT EXISTS[\s\S]{0,300}manual_payments/.test(grants),
    "the credit is conditional on this payment not already having been applied",
  );

  check(
    "🔴 an unknown payment purpose throws rather than quietly doing nothing",
    /const unreachable: never = payment\.purpose/.test(grants),
    "a silent no-op looks exactly like success to the operator who confirmed it",
  );

  /* ================================================================== */
  /*  What the payer sees                                                */
  /* ================================================================== */

  const ui = readSource("components/billing/pay-by-transfer.tsx");

  /*
   * 🔴 C200 — THE COPY IS ASSERTED THROUGH THE DICTIONARY, NEVER BY GREPPING IT.
   *
   * ⚠️ The first version of these three checks searched `pay-by-transfer.tsx`
   * for the English sentences. Then the component was keyed, for a good reason
   * — it is the screen an Egyptian patient pays on and it has to be in Arabic —
   * and all three went red while the product got better. That is a check written
   * against the fix instead of against the property, which is the §6 family
   * landing on the file whose job is to catch it.
   *
   * So: the component must RENDER the key, and the key must EXIST in both
   * languages. Those two together are the property. The English wording is free
   * to change and the Arabic is free to be better without any of this moving.
   */
  const { DICTIONARIES } = await import("../lib/i18n/messages");
  const en = DICTIONARIES.en as Record<string, string>;
  const ar = DICTIONARIES.ar as Record<string, string>;

  const RENDERED = [
    ["they can close the page", "transfer.closePage"],
    ["unconfigured details say so", "transfer.unsetBody"],
    ["cards are coming", "transfer.cardsSoon"],
    ["what to do after a rejection", "transfer.rejectedBody"],
    ["where the reference goes", "transfer.refLabel"],
    ["where the receipt goes", "transfer.proofLabel"],
    ["what a pot top-up asks for", "transfer.amountLabel"],
    ["the rate a pot top-up converts at", "transfer.rateNote"],
  ] as const;

  /*
   * 🔴 `t("key"` rather than `t("key")`, because some of these take a value.
   * Matching the closing bracket would quietly fail every interpolated string
   * and look like a missing key, which is the wrong cause reported upward.
   */
  const unrendered = RENDERED.filter(([, key]) => !ui.includes(`t("${key}"`));
  check(
    "🔴 the payer's screen renders every string it needs through the dictionary",
    unrendered.length === 0,
    unrendered.map(([why]) => why).join(", ") ||
      RENDERED.map(([why]) => why).join(" · "),
  );

  /*
   * 🔴 AND IN BOTH LANGUAGES. A key present in English and missing in Arabic
   * renders the English to an Arabic reader and nothing says so at runtime.
   */
  const monolingual = RENDERED.filter(([, key]) => !en[key] || !ar[key]);
  check(
    "🔴 …and every one of them exists in Arabic as well as English",
    monolingual.length === 0,
    monolingual.map(([, key]) => key).join(", ") ||
      "the screen an Egyptian patient pays on is not in English",
  );

  check(
    "🔴 CONTROL the same scan catches a key that is only in one language",
    (() => {
      const pretend: Record<string, string> = { "transfer.closePage": "x" };
      return RENDERED.some(([, key]) => !pretend[key]);
    })(),
    "watched finding a missing translation",
  );

  check(
    "🔴 a rejection shows the operator's own words, not a dictionary string",
    /\{live\.reason\}/.test(ui),
    "the reason is the one thing on this screen that must NOT be translated: it is what a person wrote about this payment",
  );

  /* ================================================================== */
  /*  The label, and the lock                                            */
  /* ================================================================== */

  /*
   * 🔴 A PATIENT SEES "InstaPay", A COMPANY SEES "Bank Transfer".
   *
   * Same account underneath. An Egyptian consumer recognises the first from
   * their phone; a finance team filing an invoice would be puzzled by it.
   */
  check(
    "🔴 the heading is chosen by audience, on the server",
    /audience === "company" \? "Bank Transfer" : "InstaPay \/ Bank Transfer"/.test(lib),
    "the word on top differs; the account underneath does not",
  );

  /*
   * 🔴 THE DETAILS CANNOT CHANGE MID-TRANSFER.
   *
   * An operator who edits the account number while eleven people are
   * transferring has sent eleven real payments to an account we are no longer
   * checking, with nothing tying them to anything.
   */
  check(
    "🔴 there is a lock that counts what is in flight before details may be edited",
    /export async function detailsLockedBy/.test(lib) &&
      /inArray\(manualPayments\.state, \["awaiting_proof", "submitted"\]\)/.test(lib),
    "it returns the number blocking, so the screen can say why rather than just refuse",
  );

  /* ================================================================== */
  /*  It is reachable, and by the right people                           */
  /* ================================================================== */

  const page = readSource("app/(admin)/admin/transfers/page.tsx");
  check(
    "🔴 the queue is staff, not owner-only",
    /requireStaff\(\)/.test(page) && !/requireRole\("super_admin"\)/.test(page),
    "somebody is on a spinner waiting to join a therapy session; it cannot wait for a founder to wake up",
  );

  check(
    "🔴 …and it is oldest first, so the longest wait is not permanent",
    /orderBy\(manualPayments\.submittedAt\)/.test(lib),
    "newest first means whoever has waited longest waits longest, forever",
  );

  const nav = readSource("app/(admin)/layout.tsx");
  check(
    "🔴 the nav carries a live count, because this queue is worked by the minute",
    /\/admin\/transfers/.test(nav) && /waitingCount/.test(nav),
    "every number in that badge is a person waiting",
  );

  const actions = readSource("app/(admin)/admin/transfers/actions.ts");
  const exported = [...actions.matchAll(/export async function (\w+)/g)].map((m) => m[1]!);
  check(
    "🔴 an operator can confirm or reject, and nothing else",
    exported.length === 2 && exported.includes("confirm") && exported.includes("reject"),
    `${exported.join(", ")}. Editing an amount or reopening a decision would let the record stop matching what happened`,
  );

  check(
    "🔴 both decisions are audited, with the rejection reason carried into the audit row",
    /await audit\(\{[\s\S]{0,300}transfer\.confirm/.test(actions) &&
      /await audit\(\{[\s\S]{0,300}transfer\.reject[\s\S]{0,200}reason,/.test(actions),
    "the payment row is what the payer reads and the audit row is what we read in six months",
  );

  /* ================================================================== */
  /*  It is wired into a real flow, and the details cannot move under it  */
  /* ================================================================== */

  const potActions = readSource("app/(sponsor)/sponsor/pot/actions.ts");

  /*
   * 🔴 THE CARD RAIL AND THE TRANSFER RAIL ARE NEVER BOTH OFFERED.
   *
   * `sponsorNeedsTransfer` reads the same `entity` column `topUpPot` refuses on,
   * so a sponsor is on exactly one of them. Two opinions about which rail
   * somebody is on is how a company is shown a bank account and then charged a
   * card, or shown neither.
   */
  check(
    "🔴 the transfer door asks the same column the card door refuses on",
    /sponsorNeedsTransfer/.test(potActions) && /declarePaid/.test(potActions),
    "one sponsor, one rail, decided by `entity` in both places",
  );

  /*
   * 🔴 AND IT IS ASKED AGAIN IN THE ACTION, not trusted from the screen. A form
   * that renders on a condition is a form somebody can post without meeting it.
   */
  check(
    "🔴 …and the action re-asks it rather than trusting the form was rendered",
    /if \(!\(await sponsorNeedsTransfer/.test(potActions),
    "a form rendered on a condition is a form somebody can post without meeting it",
  );

  const settingsActions = readSource("app/(admin)/admin/settings/actions.ts");

  /*
   * 🔴 C366 — `savePayouts` MUST READ BEFORE IT WRITES.
   *
   * `writeSettingsGroup` replaces the row. This action built the object from its
   * six form fields, so the moment the transfer details joined the same group an
   * admin saving the netting toggle would have deleted the Egyptian bank details
   * every payer's screen reads. Exactly C364's shape, one file over.
   */
  check(
    "🔴 C366 saving the payouts form carries the whole group forward",
    /const existing = await getSettings\(\);[\s\S]{0,400}\.\.\.existing\.payouts,/.test(
      settingsActions,
    ),
    "a writer built from a fixed list of keys drops everything it was not told about",
  );

  /*
   * 🔴 THE LOCK IS A REFUSAL, NOT A WARNING, and it names the number blocking.
   *
   * Editing the account number while people are mid-transfer sends real payments
   * into an account we are no longer checking, with no processor to ask.
   */
  check(
    "🔴 the details cannot be saved while a payment is in flight",
    /detailsLockedBy\(\)/.test(settingsActions) &&
      /if \(inFlight > 0\) \{[\s\S]{0,200}return \{/.test(settingsActions),
    "a refusal with the count in it, so the message is what is happening rather than what is forbidden",
  );

  /*
   * 🔴 THE AUDIT ROW CARRIES THE LABELS AND NOT THE VALUES. This is an account
   * number, and an audit log is read by more people than a settings screen is.
   */
  check(
    "🔴 …and the audit records which fields changed, never the account numbers",
    /transferFields\.map\(\(f\) => f\.label\)/.test(settingsActions) &&
      !/f\.value/.test(settingsActions.slice(settingsActions.indexOf("settings.transferFields"))),
    "what we need six months from now is which fields changed and when",
  );

  const coverage = readSource("components/sponsor/coverage-form.tsx");

  /*
   * 🔴 THE COVERAGE SLIDER IS LOCKED UNTIL EDIT, AND SAYS WHAT THE MONEY BUYS.
   *
   * A slider that moves on first touch is one somebody drags by accident on a
   * phone, and this decides what a company pays for every session its staff
   * book. And "10%" is abstract where "your $200 covers 100 sessions" is a
   * decision a finance team can actually take.
   */
  check(
    "🔴 the coverage slider needs Edit first, and Save after",
    /setEditing\(true\)/.test(coverage) && /editing \?/.test(coverage),
    "two deliberate acts around a number that decides what every session costs them",
  );

  check(
    "🔴 …and it says how many sessions the balance covers at that percentage",
    /balanceUsd \/ \(\(sessionPriceUsd \* draft\) \/ 100\)/.test(coverage),
    "the same sum a finance team would do on paper before agreeing to anything",
  );

  check(
    "🔴 …from a setting, so the average is not invented on the screen",
    /averageSessionCents/.test(readSource("lib/settings/defs.ts")) &&
      /sessionPriceUsd=\{settings\.sponsor\.averageSessionCents/.test(
        readSource("app/(sponsor)/sponsor/pot/page.tsx"),
      ),
    "a projection built on an average nobody can change is a projection nobody can correct",
  );

  /*
   * 🔴 A RECEIPT IS NOT A CREDENTIAL. Identity documents sit under a retention
   * rule; a payment receipt should not land in the same bucket as somebody's
   * licence just because both are uploads.
   */
  const uploads = readSource("lib/uploads.ts");
  check(
    "🔴 a transfer receipt has its own upload kind, apart from identity documents",
    /"receipt"/.test(uploads) && /receiptUploadProblem/.test(uploads),
    "a payment receipt does not belong in the bucket a licence is retained in",
  );

  /* ================================================================== */
  /*  74 · the rail reaches all three payers, and in the right currency   */
  /* ================================================================== */

  /*
   * 🔴 TWO AMOUNTS, BECAUSE THERE ARE TWO FACTS AND NEITHER IS DERIVABLE LATER.
   *
   * ⚠️ `grantPotTopUp` added `amount_cents` — pounds — straight onto
   * `sponsor_pots.balance_cents`, which is dollars. A company sending 10,000 EGP
   * had a million cents credited: fifty times what it paid, with no processor
   * anywhere to reverse it. 0106 is the column that makes the two sayable apart,
   * and these are the checks that keep them apart.
   */
  const settlesSql = readFileSync("drizzle/0106_what_it_settles.sql", "utf8");
  check(
    "🔴 0106 what a transfer SETTLES is its own NOT NULL column, with a floor",
    /ADD COLUMN IF NOT EXISTS settles_cents integer/.test(settlesSql) &&
      /ALTER COLUMN settles_cents SET NOT NULL/.test(settlesSql) &&
      /CHECK \(settles_cents > 0\)/.test(settlesSql),
    "the payer's pounds and our dollars are two facts, and a rate applied twice is a rate two places can disagree about",
  );

  /*
   * 🔴 EVERY GRANT SPENDS `settlesCents`, AND NONE OF THEM SPENDS `amountCents`.
   *
   * An absence assertion, so it gets a planted offender below (§6).
   */
  const grantBody = grants.slice(grants.indexOf("export async function grantFor"));
  check(
    "🔴 a grant credits what the transfer SETTLES, never what was sent",
    /payment\.settlesCents/.test(grantBody) && !/payment\.amountCents/.test(grantBody),
    "pounds added to a dollar balance is the bug 0106 exists for",
  );

  check(
    "🔴 CONTROL the same scan catches a grant reading the payer's own currency",
    /payment\.amountCents/.test("balance_cents + ${payment.amountCents}"),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /*
   * 🔴 THE RATE IS THE OPERATOR'S, NOT THE MARKET'S, AND IT IS ASKED IN ONE PLACE.
   *
   * `quoteFor` refuses a static rate in production (C37), so a rail built on it
   * would have no number to show an Egyptian payer at all. And two call sites
   * that each knew a rate could quote two different ones for the same session.
   */
  const entry = readSource("lib/billing/manual-entry.ts");
  check(
    "🔴 one place converts dollars to pounds, from a setting an operator can change",
    /egpRateMicro/.test(lib) &&
      /egpRateMicro/.test(readSource("lib/settings/defs.ts")) &&
      !/quoteFor/.test(lib) &&
      !/quoteFor/.test(entry),
    "a market feed that refuses in production is a rail with no price on it",
  );

  check(
    "🔴 …and every caller hands it dollars, so no screen has to know the rate",
    /settlesCents: number;/.test(entry) && /egpMinorFor\(input\.settlesCents/.test(entry),
    "a call site that passed pounds is a call site that had to know the rate",
  );

  /*
   * 🔴 ALL THREE PAYERS ARE ON IT, AND EACH ASKS AGAIN IN ITS OWN ACTION.
   *
   * The patient's session, the clinician's bill and the company's pot. A rail
   * that reached one of them would leave the other two with no way to pay us at
   * all, which was the whole blocker this work exists to clear.
   */
  const payActions = readSource("app/pay/[token]/actions.ts");
  const billActions = readSource("app/(app)/billing/actions.ts");

  const FLOWS = [
    ["the patient's session", payActions, "organizationNeedsTransfer"],
    ["the clinician's bill", billActions, "organizationNeedsTransfer"],
    ["the company's pot", potActions, "sponsorNeedsTransfer"],
  ] as const;

  const unguarded = FLOWS.filter(
    ([, source, guard]) =>
      !source.includes("declarePaid") || !new RegExp(`if \\(!\\(await ${guard}`).test(source),
  );
  check(
    "🔴 all three payers can pay by transfer, and each action re-asks which rail they are on",
    unguarded.length === 0,
    unguarded.map(([why]) => why).join(", ") || FLOWS.map(([why]) => why).join(" · "),
  );

  /*
   * 🔴 AND NOT ONE OF THEM TAKES THE PRICE FROM THE FORM.
   *
   * The session reads `priceCents` off its own row; the bill reads
   * `outstandingCents` off the invoices. The pot is the exception and is meant
   * to be: the company is choosing how much to put in.
   */
  check(
    "🔴 the session and the bill price themselves from stored rows, never from the post",
    /settlesCents: session\.priceCents/.test(payActions) &&
      /settlesCents: summary\.outstandingCents/.test(billActions),
    "a payer who can type what they owe is a payer who owes less",
  );

  /*
   * 🔴 THE WAITING SCREEN COMES BACK BY ITSELF.
   *
   * The whole rail rests on the middle state being durable, and a patient who
   * has paid at eleven at night is waiting on an operator pressing Confirm. Told
   * to reload, somebody in that state does not reload: they decide it is broken.
   */
  check(
    "🔴 a payer left waiting has their page re-ask the server without touching it",
    /live\.state !== "submitted"/.test(ui) && /router\.refresh\(\)/.test(ui),
    "the moment an operator confirms, the session becomes joinable and nothing else tells them",
  );

  /*
   * 🔴 ONE TRANSFER SETTLES THE WHOLE BILL, LIKE THE CARD RAIL ALREADY DOES.
   *
   * `createInvoiceCheckout` puts every outstanding invoice in one checkout. One
   * invoice per transfer would mean six bank transfers of $4 and an operator
   * matching them by hand.
   */
  check(
    "🔴 a clinician's transfer settles their outstanding invoices, oldest first",
    /eq\(invoices\.status, "due"\)\)\)\s*\.orderBy\(invoices\.issuedAt\)/.test(grants) &&
      /if \(payable > remaining\) continue;/.test(grants),
    "and it stops rather than part-paying one, because a half-settled invoice is a number two systems disagree about",
  );

  /* ================================================================== */
  /*  74 · a plan you can actually be on, and one you can fall off       */
  /* ================================================================== */

  const service = readSource("lib/billing/service.ts");

  /*
   * 🔴 THE RAIL CAN PUT SOMEBODY ON A PLAN, WHICH IT COULD NOT BEFORE.
   *
   * ⚠️ `entitledTier` reads a paid obligation first and the Stripe mirror
   * second. Obligations were raised in exactly ONE place: the `invoice.paid`
   * webhook. So an Egyptian therapist had neither, and fell through to the tier
   * their lifetime spend had earned — pay as you go — however much they
   * transferred. The rail settled invoices and granted nothing.
   */
  check(
    "🔴 a transfer can start a subscription, by raising the obligation entitlement reads",
    /export async function subscribeByTransfer/.test(service) &&
      /raiseObligation/.test(service) &&
      /export async function settleOldestObligationByTransfer/.test(service) &&
      /settleOldestObligationByTransfer/.test(grants),
    "settling an invoice clears a debt; entitlement is a different row, and nothing was writing it",
  );

  /*
   * 🔴 AND IT RAISES A BILL RATHER THAN GRANTING A PLAN.
   *
   * The whole rail rests on nothing happening until a person confirms. A
   * subscribe button that set the tier would be the one optimistic grant in it.
   */
  const subscribeBody = service.slice(
    service.indexOf("export async function subscribeByTransfer"),
    service.indexOf("export async function settleOldestObligationByTransfer"),
  );
  check(
    "🔴 …and subscribing only BILLS: the plan starts when an operator confirms",
    /state: "due"|status: "due"/.test(subscribeBody) &&
      !/settleObligation/.test(subscribeBody) &&
      !/mirrorSubscription/.test(subscribeBody),
    "a subscribe button that granted the tier would be the one optimistic grant on this rail",
  );

  check(
    "🔴 CONTROL the same scan catches a subscribe path that settled its own obligation",
    /settleObligation/.test('await settleObligation({ organizationId, via: "manual" });'),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /*
   * 🔴 AND THE EGYPTIAN THERAPIST IS NOT SENT TO STRIPE.
   *
   * `createSubscriptionCheckout` has no entity gate, so Subscribe charged an
   * Egyptian practice into the US entity — the same blocker `topUpPot` refuses
   * out loud, happening silently one button over.
   */
  check(
    "🔴 Subscribe bills an Egyptian practice instead of sending it to a checkout that would charge the wrong entity",
    /organizationNeedsTransfer\(actor\.organizationId\)\)\s*\{[\s\S]{0,400}subscribeByTransfer/.test(
      billActions,
    ),
    "one account, one rail, asked before the redirect rather than after the charge",
  );

  /*
   * 🔴 FALLING OFF A PLAN IS THE OBLIGATION LAPSING, AND NOTHING ELSE.
   *
   * A failed card payment marks the subscription `past_due` and the therapist
   * keeps the month they paid for; an unpaid transfer leaves the obligation
   * `due` until `lapseOverdue` marks it `lapsed`. Both then land on the same
   * line in `entitledTier`: a lapsed obligation grants nothing, so they are on
   * whatever their spend earned, which is pay as you go.
   */
  const entitle = readSource("lib/billing/plans.ts");
  check(
    "🔴 only a PAID obligation grants a plan, so an unpaid month falls to pay as you go by itself",
    /ob\.state === "paid"/.test(entitle) && /lapseOverdue/.test(readSource("lib/billing/obligations.ts")),
    "no code anywhere has to remember to demote somebody: the entitlement expires because it was never paid",
  );

  /*
   * 🔴 LEAVING A CLINIC LANDS ON PAY AS YOU GO, BY THE SAME MECHANISM.
   *
   * The departing clinician gets a fresh `solo` organisation with no
   * subscription row at all, and `getSubscription` creates one as `payg`. No
   * demotion step to forget.
   */
  const clinicAdmin = readSource("lib/data/clinic-admin.ts");
  check(
    "🔴 a clinician who leaves a clinic keeps their patients and lands on pay as you go",
    /kind: "solo"/.test(clinicAdmin) &&
      /releaseSeat/.test(clinicAdmin) &&
      /plan: "payg", status: "active"/.test(service),
    "a new organisation has no subscription, and the default for no subscription is metered",
  );

  /*
   * 🔴 AND A CLINIC ADMIN CANNOT SUSPEND A CLINICIAN. An absence, so it has a
   * planted offender. A practice manager can end the working relationship; they
   * cannot reach into somebody's account and switch them off, because that
   * account is the clinician's own and their patients are behind it.
   */
  check(
    "🔴 a clinic admin can remove a clinician from the clinic and cannot suspend their account",
    !/suspendUser|setUserStatus/.test(clinicAdmin),
    "removing ends the relationship; suspending would reach into an account that is not theirs",
  );

  check(
    "🔴 CONTROL the same scan catches a suspend reaching the clinic surface",
    /suspendUser|setUserStatus/.test('await setUserStatus(userId, "suspended");'),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /*
   * 🔴 74.4 — THE PRORATED FIGURE IS CHARGED, NOT JUST SHOWN.
   *
   * ⚠️ `seatChange` has computed it since sprint 62 and the quote screen has
   * shown it since sprint 62, and nothing billed it. A solo therapist becoming
   * a clinic on the 15th read "$89 for the 15 days remaining", agreed, and paid
   * nothing until the next renewal.
   */
  const seats = readSource("lib/billing/seats.ts");
  /*
   * ⚠️ The first version of this asserted `/billSeatProration/` against
   * `seats.ts`, which the IMPORT LINE satisfies. Renaming the call site left it
   * green: a check measuring that the function was mentioned rather than that
   * it was called, which is the §6 family landing inside the file whose job is
   * to catch it. It asserts the invocation now.
   */
  check(
    "🔴 a mid-month seat change bills the prorated figure the clinic was shown",
    /await billSeatProration\(\{/.test(seats) &&
      /export async function billSeatProration/.test(service),
    "quoting first only means anything if the quote is what happens",
  );

  check(
    "🔴 CONTROL the same scan is not satisfied by the import alone",
    !/await billSeatProration\(\{/.test(
      'const { billSeatProration } = await import("./service");',
    ),
    "watched refusing the line that made the first version of this check pass",
  );

  check(
    "🔴 …quoted BEFORE the write, because after it every figure is zero",
    seats.indexOf("const change = await quoteSeatChange(") <
      seats.indexOf("const [updated] = await controlDb"),
    "reading the count back off the row after changing it asks what it changed from and gets the answer it changed to",
  );

  check(
    "🔴 …and a downgrade is credit against next month, never a refund",
    /change\.proratedCents < 0[\s\S]{0,300}setUpcomingDiscount/.test(seats),
    "C331: otherwise a practice adds five seats on the first, removes them on the last, and pays for none",
  );

  /* ================================================================== */
  /*  74 · and somebody can actually GET onto the rail                   */
  /* ================================================================== */

  /*
   * 🔴 THE DEFECT CLASS BEHIND THIS WHOLE SPRINT: A COLUMN NOTHING WRITES.
   *
   * ⚠️ Two sprints built a bank transfer rail for Egypt. Which side of it
   * anybody is on is decided by exactly two columns: `sponsors.entity` and
   * `organizations.region`. `applyToSponsor` hard-codes the first to `us` with a
   * comment saying "an operator moves it when that changes", and nothing did.
   * The second had NEVER been written by anything since C118 added it.
   *
   * So every sponsor was `us` and every practice was `us`, `sponsorNeedsTransfer`
   * and `organizationNeedsTransfer` were false for every account in existence,
   * and the entire rail — the queue, the screens, the grants, the gates above —
   * was reachable by nobody. Every one of those checks passed the whole time.
   *
   * `verify:reachable` finds a server action no screen calls. This is the other
   * half of the same idea: a COLUMN a feature branches on that no screen sets.
   */
  const WRITERS = [
    [
      "a sponsor's entity",
      "sponsors.entity",
      readSource("lib/data/sponsor-admin.ts"),
      /export async function setSponsorEntity/,
      readSource("components/admin/sponsor-manager.tsx"),
      /setEntity\(sponsor\.id, entity\)/,
    ],
    [
      "a clinic's region",
      "organizations.region",
      readSource("lib/data/clinic-admin.ts"),
      /export async function setClinicRegion/,
      readSource("components/admin/clinic-manager.tsx"),
      /setRegion\(clinic\.id, region\)/,
    ],
    [
      "a solo practice's region",
      "organizations.region",
      readSource("app/(app)/settings/actions.ts"),
      /\.update\(organizations\)[\s\S]{0,200}\.set\(\{ region/,
      readSource("components/settings/payouts.tsx"),
      /name="practiceRegion"/,
    ],
  ] as const;

  const unwritable = WRITERS.filter(
    ([, , writer, writes, screen, clicks]) => !writes.test(writer) || !clicks.test(screen),
  );
  check(
    "🔴 every column that decides WHICH RAIL somebody is on can be set through a screen",
    unwritable.length === 0,
    unwritable.map(([why]) => why).join(", ") || WRITERS.map(([why]) => why).join(" · "),
  );

  check(
    "🔴 CONTROL the same scan catches a writer that exists with no screen behind it",
    !/setEntity\(sponsor\.id, entity\)/.test("export async function setSponsorEntity() {}"),
    "a function nobody can click is the exact shape this sprint spent a day on",
  );

  /*
   * 🔴 AND MOVING ONE IS REFUSED ONCE MONEY HAS MOVED.
   *
   * Changing the entity under a pot that holds a balance moves money we have
   * already invoiced into another company's books, retrospectively. Changing a
   * clinic's region under a due invoice changes which rail an issued bill is
   * paid on. Neither is a settings change; both are accounting events.
   */
  check(
    "🔴 …and neither can be moved once there is money on the old one",
    /balanceCents \?\? 0\) > 0/.test(readSource("lib/data/sponsor-admin.ts")) &&
      /eq\(invoices\.status, "due"\)/.test(readSource("lib/data/clinic-admin.ts")),
    "a balance or an unpaid invoice is a fact about the company that billed it",
  );

  finish("sprints 73 and 74");
}

main();
