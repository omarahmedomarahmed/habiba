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
    // W2-M03: the flip is the shared claim both rails use, `claimSessionPaid`.
    ((/paymentStatus: "paid"/.test(grants) && /eq\(sessions\.paymentStatus, "pending"\)/.test(grants)) ||
      (/claimSessionPaid\(/.test(grants) &&
        /paymentStatus: "paid"/.test(readSource("lib/billing/session-owed.ts")) &&
        /eq\(sessions\.paymentStatus, "pending"\)/.test(readSource("lib/billing/session-owed.ts")))),
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
    /SET granted_at = now\(\)[\s\S]{0,120}granted_at IS NULL/.test(grants) && /db\.transaction\(/.test(grants),
    "0153: the credit is claimed on the payment, in one transaction with the pot and the ledger",
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
    ["the rate a pot top-up converts at", "transfer.rateNote"],
  ] as const;

  /*
   * 🔴 76.1 — `transfer.amountLabel` LEFT THIS LIST BECAUSE THE FIELD LEFT THE
   * SCREEN, and the stepper's own strings took its place.
   *
   * The old row asserted the label on a free text box in dollars. That box is
   * gone: a payer typing an amount on a rail with no processor is how somebody
   * sends $5 or $50,000 by slipping on a zero. Deleting the row without
   * replacing it would have quietly dropped a whole screen out of the one check
   * that proves this flow is translated at all, which is the §6 shape — a check
   * that keeps passing while the thing it guarded walks away.
   */
  const stepper = readSource("components/billing/top-up-stepper.tsx");
  const STEPPER_STRINGS = [
    ["the heading over the stepper", "topup.choose"],
    ["the two buttons", "topup.more"],
    ["how many sessions it covers", "topup.covers"],
    ["what reaches the pot", "topup.credit"],
    ["the tax on top", "topup.vat"],
    ["what to transfer", "topup.send"],
  ] as const;

  const unstepped = STEPPER_STRINGS.filter(([, key]) => !stepper.includes(`t("${key}"`));
  check(
    "🔴 …and the stepper that replaced the amount box is translated too",
    unstepped.length === 0,
    unstepped.map(([why]) => why).join(", ") ||
      STEPPER_STRINGS.map(([why]) => why).join(" · "),
  );

  check(
    "🔴 CONTROL every one of those keys exists in BOTH dictionaries",
    STEPPER_STRINGS.every(([, key]) => Boolean(en[key]) && Boolean(ar[key])),
    "a key rendered and never translated is an English screen for an Arabic payer",
  );

  /*
   * 🔴 AND THE BROWSER DOES NOT FORMAT ANY OF THE MONEY ON IT (C84).
   *
   * Every figure on the stepper arrives from the server already written in the
   * reader's language. `Intl` here would render one string on the server pass
   * and another in the browser, and these are the digits somebody copies into a
   * banking app. It is also Arabic-Indic against Western numerals for half this
   * market. `verify:sprint12` bans the construct repository-wide; this says the
   * screen it matters most on holds no arithmetic at all.
   */
  check(
    "🔴 …and the stepper holds an INDEX, never an amount it formats itself",
    /useState\(0\)/.test(stepper) &&
      !/Intl\./.test(stepper) &&
      !/toLocaleString/.test(stepper) &&
      !/toFixed/.test(stepper),
    "a number the browser computes is a number the browser can disagree with the server about",
  );

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
  /*
   * 🔴 76.15 — THE THIRD ACTION, AND WHY THE LIST IS NAMED RATHER THAN COUNTED.
   *
   * This asserted `length === 2`, and it went red the moment
   * `confirmUnclaimed` was added. That is the check doing its job: a third way
   * for an operator to move money is exactly the kind of widening that must not
   * happen quietly, and "there is no third button" was a real ruling.
   *
   * It is now a named ALLOWLIST rather than a count, because the ruling was
   * never about arithmetic. Adding a fourth still goes red; adding the third
   * required writing down what it is and holding the three properties below
   * that make it safe.
   *
   * 🔴 WHY THE THIRD ONE EARNS ITS PLACE. The rail's design is that nothing
   * moves until a person confirms a CLAIM, and it has one gap it cannot close:
   * a payer who sends the money and never presses Submit. They have paid us and
   * the bank line is real. Refusing to credit them is the product punishing
   * somebody for its own middle state.
   *
   * What it still cannot do is edit an amount or reopen a decision, which is
   * what the original ruling was actually protecting.
   */
  const ALLOWED_ACTIONS = ["confirm", "reject", "confirmUnclaimed"];
  const extra = exported.filter((name) => !ALLOWED_ACTIONS.includes(name));

  check(
    "🔴 an operator can confirm, reject, or credit an unclaimed transfer, and nothing else",
    extra.length === 0 && ALLOWED_ACTIONS.every((name) => exported.includes(name)),
    extra.length > 0
      ? `${extra.join(", ")} is a fourth way to move money and has to be argued for`
      : `${exported.join(", ")}. Editing an amount or reopening a decision is still impossible`,
  );

  /*
   * 🔴 W2-A03: THE EXCEPTION ACTIONS, NAMED THE SAME WAY, in their own file.
   *
   * Money that arrived and did not do its job (the grant threw, the session
   * was cancelled meanwhile, the bill was overpaid) and open carts nobody
   * submitted. Three acts, and each earns its place for a stated reason:
   *
   *   retryException           re-runs the grant a confirmation ALREADY ran,
   *                            claimed in a guarded WHERE so it runs once; it
   *                            cannot confirm a claim or change an amount
   *   resolveTransferException writes down what a person did, with a sentence
   *   discardOpenCart          deletes an `awaiting_proof` row only, which
   *                            carries no money and no claim
   *
   * A fourth export here goes red exactly like one in `actions.ts`.
   */
  const exceptionActions = readSource("app/(admin)/admin/transfers/exception-actions.ts");
  const exceptionExports = [...exceptionActions.matchAll(/export async function (\w+)/g)].map((m) => m[1]!);
  const EXCEPTION_ACTIONS = ["retryException", "resolveTransferException", "discardOpenCart"];
  check(
    "🔴 W2-A03 the exception acts are retry, resolve and discard, each staff and audited, and nothing else",
    exceptionExports.length === EXCEPTION_ACTIONS.length &&
      EXCEPTION_ACTIONS.every((name) => {
        const body = exceptionActions.slice(exceptionActions.indexOf(`function ${name}`));
        return /await requireStaff\(\)/.test(body.slice(0, 400)) && /await audit\(/.test(body.slice(0, 1200));
      }),
    exceptionExports.join(", "),
  );
  const railExceptions = readSource("lib/billing/rail-exceptions.ts");
  check(
    "🔴 W2-A03 a retry is claimed in the WHERE, and a discard can only remove an open cart",
    /eq\(manualPayments\.exception, "grant_failed"\)/.test(railExceptions) &&
      /eq\(manualPayments\.id, paymentId\), eq\(manualPayments\.state, "awaiting_proof"\)/.test(railExceptions),
    "two Retry presses run the grant once, and a submitted claim can never be discarded",
  );

  /*
   * 🔴 AND THE THREE PROPERTIES THAT MAKE THE THIRD ONE SAFE.
   *
   * Without all three it is a button for inventing payments.
   */
  const manualLib = readSource("lib/billing/manual.ts");
  check(
    "🔴 crediting without proof demands a written reason, and keeps it ON the payment",
    // W2-A05 moved the number to one constant for every admin reason; it must still be 10 or more.
    (/reason\.length < 10/.test(manualLib) ||
      (/reason\.length < MIN_REASON/.test(manualLib) &&
        Number(/MIN_REASON = (\d+)/.exec(readSource("lib/admin/reason.ts"))?.[1] ?? 0) >= 10)) &&
      /rejectReason: `Received without proof\./.test(manualLib),
    "a log entry is not enough: the fact must follow this money to every screen that shows it",
  );

  check(
    "🔴 …and it routes through the ordinary confirmation, so there is one way money moves",
    /return confirmPayment\(\{/.test(
      manualLib.slice(manualLib.indexOf("export async function confirmWithoutProof")),
    ),
    "a second path that wrote its own rows is how two systems start disagreeing about a payment",
  );

  check(
    "🔴 …and it can only act on a payment somebody actually opened",
    /eq\(manualPayments\.state, "awaiting_proof"\)/.test(
      manualLib.slice(manualLib.indexOf("export async function confirmWithoutProof")),
    ),
    "an operator who wants to credit an account with no such row has to make one the way a payer would",
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
   * 🔴 A14: THE PAYOUTS AUDIT ROW NAMES WHAT CHANGED, OLD AND NEW.
   *
   * It recorded netting and spread only, so moving the four-eyes threshold or
   * the pound rate left a row that could not say so. Asked of the function the
   * action calls, with real before and after objects, and then of the action,
   * so the helper cannot be correct and unused.
   */
  const { payoutSettingsChanges } = await import("../lib/settings/payout-changes");
  const { SETTINGS_DEFAULTS } = await import("../lib/settings/defs");
  const before = SETTINGS_DEFAULTS.payouts;
  const moved = payoutSettingsChanges(before, {
    ...before,
    twoPersonThresholdCents: before.twoPersonThresholdCents + 100_000,
    egpRateMicro: before.egpRateMicro + 1_500_000,
  });
  check(
    "🔴 A14 the payouts audit row records the four-eyes threshold and the pound rate, old and new",
    moved.includes(`twoPersonThresholdCents ${before.twoPersonThresholdCents} to ${before.twoPersonThresholdCents + 100_000}`) &&
      moved.includes(`egpRateMicro ${before.egpRateMicro} to ${before.egpRateMicro + 1_500_000}`) &&
      /reason: payoutSettingsChanges\(existing\.payouts, value\)/.test(settingsActions),
    moved,
  );
  const untouched = payoutSettingsChanges(before, {
    ...before,
    // A planted bank line: the one group key this form must never report.
    transferFields: [
      { key: "planted", label: "Planted", value: "000", hint: "", position: 0 },
    ] as unknown as typeof before.transferFields,
  });
  check(
    "🔴 A14 CONTROL a save that changed none of the form's fields says so, and the bank details it does not own stay out",
    untouched === "no field changed",
    untouched,
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
   * 🔴 75.8 — A MANUAL POT TOP-UP REACHES THE BOOKS, WHICH IT DID NOT.
   *
   * `topUpPot` credits the NET, raises `vat_payable` and journals three legs.
   * `grantPotTopUp` credited the gross and journalled NOTHING, and `topUpPot`
   * refuses `entity = 'eg'`, so for an Egyptian sponsor this was not a fallback
   * with a correct card branch underneath: it was the only path.
   *
   * The visible half is `ledgerPotBalance`, which is what a sponsor is SHOWN on
   * `pot.ts`'s own rule that a screen disagreeing with the books is how a
   * customer finds a bug we should have found. With no legs it returned zero, so
   * a company that transferred $5,000 read $0 on its own pot screen while every
   * booking decision thought the money was there.
   */
  const potGrant = grants.slice(grants.indexOf("async function grantPotTopUp"));
  check(
    "🔴 a pot funded by transfer posts the same three legs the card rail posts",
    /journal\(\{/.test(potGrant) &&
      /kind: "pot_topup"/.test(potGrant) &&
      /account: "cash"/.test(potGrant) &&
      /account: "vat_payable"/.test(potGrant) &&
      /account: "sponsor_pot"/.test(potGrant),
    "with no legs, reconcilePots reports the whole top-up as drift and the sponsor's own screen reads zero",
  );

  check(
    "🔴 …and it credits the NET, so a sponsor cannot spend the tax on sessions",
    /balance_cents = balance_cents \+ \$\{net\}/.test(potGrant) &&
      /10_000 \+ vatBps/.test(potGrant),
    "pot.ts says what crediting the gross costs, and it was describing this exact path",
  );

  check(
    "🔴 CONTROL neither the gross credit nor the missing journal survives",
    !/balance_cents = balance_cents \+ \$\{payment\.settlesCents\}/.test(potGrant),
    "watched finding the line that credited the tax to the company that owed it",
  );

  /*
   * 🔴 AND THE WELCOME CREDIT, WHICH OPENS A POT THE SAME WAY AND HAD THE SAME HOLE.
   *
   * `openPot` wrote `balanceCents: credit` with no leg, under a comment claiming
   * that is *"how a confirmed top-up behaves too"*. It is not: `topUpPot` posts
   * `sponsor_pot` negative when the money lands. The plan gives all three
   * companies a welcome credit, so all three would have opened with a balance
   * every booking could spend, a sponsor screen reading zero, and
   * `reconcilePots` reporting the credit as drift on day one.
   *
   * 🔴 `platform_expense` rather than `cash`, because no money arrived. We gave
   * away therapy and we pay a clinician real money the first time it is spent.
   */
  const potAdmin = readSource("lib/data/sponsor-admin.ts");
  check(
    "🔴 a welcome credit posts a leg too, so a granted pot reconciles from the first day",
    /journal\(\{/.test(potAdmin) &&
      /account: "platform_expense"/.test(potAdmin) &&
      /account: "sponsor_pot"/.test(potAdmin),
    "a balance with no leg is a sponsor shown zero on the screen that tells them what they can spend",
  );

  check(
    "🔴 CONTROL …and it is NOT booked as cash, because nobody sent us any",
    !/account: "cash"/.test(potAdmin),
    "booking a gift as cash is how a company's free credit becomes revenue in the board's own numbers",
  );

  check(
    "🔴 …and the guard that refuses a second Confirm runs BEFORE the legs are posted",
    potGrant.indexOf("RETURNING sponsor_pots.id") < potGrant.indexOf("journal({") &&
      potGrant.indexOf("result.rows.length === 0") < potGrant.indexOf("journal({"),
    "this rail has no webhook replay guard, and two sets of legs for one transfer is a book nothing can reconcile",
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
  /*
   * ⚠️ 76.16 — THIS USED TO NAME THE EXPRESSION, AND THE EXPRESSION CHANGED.
   *
   * It asserted `settlesCents: summary.outstandingCents` literally. That was
   * true while the bill always meant everything, and the moment a clinician
   * could choose four of eleven sessions the figure legitimately became
   * `open?.settlesCents ?? summary.outstandingCents` and a correct change
   * failed a gate. A check that fails on a correct change gets edited to match
   * whatever was written, which is a gate that only ever confirms the diff.
   *
   * So it is a PROPERTY now: every settles figure on these two rails is read
   * from the server, and nothing on the request may reach one.
   */
  const SETTLES = /(?:settlesCents\s*[:=]\s*)([^,;\n]+)/g;
  const FROM_THE_REQUEST = /formData|form\.get|request|\bNumber\s*\(|parseInt|parseFloat|input\.amount/;

  const settlesFrom = (source: string) =>
    [...source.matchAll(SETTLES)].map((m) => m[1]!.trim());

  const tainted = [
    ...settlesFrom(payActions).map((rhs) => `session: ${rhs}`),
    ...settlesFrom(billActions).map((rhs) => `bill: ${rhs}`),
  ].filter((entry) => FROM_THE_REQUEST.test(entry));

  /*
   * ⚠️ 76.27 — AND THIS ONCE ASSERTED THE DEFECT.
   *
   * It required `priceCents: session.priceCents` on the session rail, which was
   * true and was WRONG: `payFromPot` debits an employer's share at booking, so
   * the price of the session stopped being what the patient owes the moment a
   * company covered part of one. All three places that priced a session read
   * that column, agreed with each other, and asked an employee for the half
   * their employer had already paid.
   *
   * A check can pin a defect in place. This one did, for as long as the defect
   * and the check said the same thing. The property is the one that was meant:
   * every settles figure is read from the server, and the session's starting
   * point is WHAT THE PATIENT OWES rather than what the session cost.
   */
  const sessionPricesFromOwed =
    /patientOwesFor\(/.test(payActions) &&
    /priceCents: owed\.grossCents/.test(payActions) &&
    !/priceCents: session\.priceCents/.test(payActions);

  check(
    "🔴 the session and the bill price themselves from stored rows, never from the post",
    tainted.length === 0 &&
      sessionPricesFromOwed &&
      /livePaymentFor\(/.test(billActions) &&
      /billingSummary\(/.test(billActions),
    tainted.join(", ") ||
      "the session reads what is still owed after a benefit paid; the bill reads the open claim",
  );

  check(
    "🔴 …and a covered session never charges the employer's share to the employee",
    /patientShareCents/.test(readSource("lib/billing/session-owed.ts")) &&
      /patientOwesFor\(/.test(readSource("app/pay/[token]/page.tsx")) &&
      !/priceCents: session\.priceCents/.test(readSource("app/pay/[token]/page.tsx")),
    "the split is frozen onto session_payments at booking, and that is the figure to ask for",
  );

  check(
    "🔴 CONTROL the same scan catches the version that read the session's own price",
    /priceCents: session\.priceCents/.test("  priceCents: session.priceCents,") &&
      !/priceCents: session\.priceCents/.test("  priceCents: owed.grossCents,"),
    "an absence assertion is worth nothing until it is watched finding the thing it forbids",
  );

  check(
    "🔴 CONTROL the same scan catches a settles taken off the form",
    settlesFrom('const settlesCents = Number(formData.get("amount"));').some((rhs) =>
      FROM_THE_REQUEST.test(rhs),
    ) && settlesFrom("settlesCents: open?.settlesCents ?? summary.outstandingCents").every(
      (rhs) => !FROM_THE_REQUEST.test(rhs),
    ),
    "an absence assertion is worth nothing until it is watched finding something, and clearing something",
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

  /* ================================================================== */
  /*  The money actually moves, and not only the gate                    */
  /* ================================================================== */

  /*
   * 🔴 THE DEFECT THIS EXISTS FOR, AND IT SURVIVED EVERY OTHER CHECK IN THIS
   * FILE.
   *
   * `grantSession` flipped `sessions.payment_status` to `paid` and stopped.
   * That is the JOIN GATE: it is what lets the patient into the room, and every
   * check above was satisfied by it. It is not the BOOKS.
   *
   * `postSessionPayment` is the only writer of `platform_revenue`,
   * `vat_payable` and `therapist_payable` for a session, and it had exactly two
   * call sites: Stripe and a sponsor pot. Egypt has neither. So in the only
   * market this product launches in, where every patient pays by transfer:
   * our 15% was never recognised, no VAT liability was ever recorded, and a
   * therapist's held balance stayed at zero, which made `requestPayout` refuse
   * every withdrawal they ever attempted.
   *
   * A rail that opens the door and records no money is worse than one that does
   * neither, because everything on the screen says it worked.
   */
  check(
    "🔴 a confirmed session transfer posts the money, not just the join gate",
    /postSessionPayment\(\{/.test(grants) &&
      /insert\(sessionPayments\)/.test(grants) &&
      /crossingFor\(\{/.test(grants),
    "flipping payment_status lets them into the room; it does not pay anybody",
  );

  /*
   * 🔴 AND IT POSTS EXACTLY ONCE. The `payment_status = 'pending'` guard is the
   * idempotency for the whole body, so the function must RETURN when that
   * update matches nothing rather than falling through to post a second time.
   * An operator double-clicking Confirm is the ordinary case, not the exotic
   * one.
   */
  check(
    "🔴 …and it returns when the session was not pending, so a second Confirm posts nothing",
    // W2-A03 flags a non-payable session before returning; nothing may POST on that way out.
    /was not pending(?:(?!postSessionPayment)[\s\S]){0,1500}?\n\s*return;/.test(grants) &&
      /onConflictDoNothing\(\{ target: sessionPayments\.sessionId \}\)/.test(grants),
    "two guards: the status guard for the grant, the unique session for the payment row",
  );

  /*
   * 🔴 AND IT IS HELD, NOT ROUTED. The pounds landed in our account and the
   * therapist's share is ours to pay out by hand. A `destination` capture would
   * claim Stripe routed it, which is the one thing that certainly did not
   * happen on a rail with no Stripe in it.
   */
  check(
    "🔴 …and the capture says we are holding it, which is why the payouts queue exists",
    /capture: "platform"/.test(grants) && /paidVia: "local_egp"/.test(grants),
    "egp_local_to_manual is a crossing the schema already knew about and nothing wrote",
  );

  /* ================================================================== */
  /*  The tax the country says is owed is actually asked for             */
  /* ================================================================== */

  /*
   * 🔴 THE EGYPTIAN RAIL COLLECTED NO VAT, ON THE ONLY RAIL THIS MARKET HAS.
   *
   * The CARD branch of `/pay/[token]` has always run `sessionMoney` with the
   * country's `vatBps` and charged `patientTotalCents`. The TRANSFER branch
   * quoted `session.priceCents` and stopped. Every Egyptian practice takes the
   * transfer branch, and `collectionProblem` refuses the Stripe branch for a
   * `paymob` country anyway, so no Egyptian session ever collected the 14% that
   * `country_settings` says is owed.
   *
   * `lib/settings/defs.ts` says in its own words why that matters: a guessed 0%
   * is an under-collection somebody eventually owes. It was being violated by
   * the product's only live rail.
   */
  const payPage = readSource("app/pay/[token]/page.tsx");

  check(
    "🔴 an Egyptian payer is quoted the price WITH the VAT their country charges",
    /export async function sessionTransferMoney/.test(entry) &&
      /vatOn\(gross, vatBps\)/.test(entry) &&
      /settlesCents: gross \+ vat/.test(entry),
    "the card branch always charged it; the only rail this market has did not",
  );

  check(
    "🔴 …and the screen that quotes it and the action that declares it use the SAME helper",
    /sessionTransferMoney\(\{/.test(payPage) &&
      /sessionTransferMoney\(\{/.test(payActions) &&
      /settlesCents: money\.settlesCents/.test(payPage) &&
      /settlesCents: money\.settlesCents/.test(payActions),
    "two places deriving one number is how a payer is shown one amount and charged another",
  );

  check(
    "🔴 neither of them quotes the bare price any more",
    !/settlesCents: session\.priceCents/.test(payPage) &&
      !/settlesCents: session\.priceCents/.test(payActions),
    "that exact line is what under-collected on every Egyptian session",
  );

  check(
    "🔴 CONTROL the same scan catches the line it was written to find",
    /settlesCents: session\.priceCents/.test("settlesCents: session.priceCents,"),
    "an absence assertion is worth nothing until it is watched finding something",
  );

  /*
   * 🔴 THE RAIL AND THE TAX ARE DECIDED BY ONE COLUMN, WHICH IS WHY THERE IS NO
   * WINDOW BETWEEN THEM.
   *
   * `organizationNeedsTransfer` renders the transfer screen when `region = 'eg'`.
   * `sessionTransferMoney` reads the SAME column to find the country whose
   * `vatBps` it charges. So the screen cannot exist in a state where the tax does
   * not: the run starts with Nile Practice on `us`, and the afternoon an operator
   * moves it to `eg` in `R1`, the bank details and the 14% arrive together.
   *
   * Had the tax been read from anywhere else, that move would have been two
   * separate switches with a gap between them, and the gap is a day of sessions
   * quoted without the tax that was owed on them.
   */
  check(
    "🔴 …and one column decides BOTH, so the screen cannot render without the tax",
    /organizations\.region/.test(entry) &&
      (entry.match(/select\(\{ region: organizations\.region \}\)/g) ?? []).length === 2,
    "two columns would be two switches, and the gap between them is a day of untaxed sessions",
  );

  check(
    "🔴 …and the country is matched case-insensitively, because the column is 'eg' and the row is 'EG'",
    /toUpperCase\(\)/.test(readSource("lib/settings/index.ts")),
    "a case-sensitive lookup would return no country, and no country is a silent 0% on the only rail",
  );

  check(
    "🔴 …and the payer is TOLD why the figure is bigger than the fee",
    /taxNote/.test(entry) && /transfer\.taxNote/.test(readSource("components/billing/pay-by-transfer.tsx")),
    "1,140 pounds for a 1,000 pound session reads as a markup unless a line says otherwise",
  );

  /*
   * 🔴 76.33 — RESTATED AS A PROPERTY, because it was greping for one line.
   *
   * It matched `payment.settlesCents - row.priceCents` as a literal. That was
   * the right expression for an uncovered session and the WRONG one for a
   * covered employee: `settles` is VAT on the patient's SHARE, `price_cents` is
   * the whole session, the subtraction goes negative, and the clamp turns tax
   * we genuinely owe into zero. Correcting the base to the share broke this
   * check on a product that had just been fixed.
   *
   * §6 in the instrument: a check that greps for the shape of an answer fails
   * when the shape moves and passes when the shape survives a gutting. The
   * property is what matters — the tax is DERIVED FROM THE MONEY by
   * subtraction, never recomputed from a rate that an operator may have edited
   * between the quote and the confirmation.
   *
   * 🔴 AND THE NUMBER ITSELF IS PROVEN AGAINST ROWS by `verify:edges`, which
   * puts 140 of VAT on a half-covered session and reads `vat_payable` back out
   * of the ledger. Source can say the subtraction is there; only a run can say
   * it subtracts the right two things.
   */
  check(
    "🔴 …and the ledger posts the VAT that ARRIVED, derived from the money rather than a rate",
    /const vatCents = Math\.max\(0, payment\.settlesCents - \w+\)/.test(grants) &&
      !/vatBps:\s*country\.vatBps/.test(grants) &&
      /vatCents,/.test(grants),
    "a rate an operator changed between the quote and the confirmation must not move a posted figure",
  );

  /*
   * 🔴 76.33 — AND THE BASE IS WHAT THE PAYER WAS ASKED FOR, not the price.
   *
   * The half this file could not see. `declareSessionTransfer` quotes
   * `patientOwesFor(...)` plus VAT on that, so subtracting the full price from
   * what arrived is subtracting two different things and calling the remainder
   * tax. For every covered employee it produced a negative number, clamped to
   * zero, and the tax disappeared.
   */
  check(
    "🔴 …and the base it subtracts is the payer's SHARE, never the session's price",
    /patientShareCents = priorPayment\?\.patientShareCents \?\? row\.priceCents/.test(grants) &&
      /payment\.settlesCents - patientShareCents/.test(grants),
    "subtracting the whole price from a part payment makes the tax negative, and a clamp makes it vanish",
  );

  /* ================================================================== */
  /*  One payment screen, and the wall that keeps it payer-facing        */
  /* ================================================================== */

  /*
   * 🔴 76.6 — THE POPUP MAY ONLY BE RENDERED WHERE THE READER IS THE PAYER.
   *
   * It shows a name, and C243 bans a payer's name from a money surface: a
   * therapist's earnings screen showing who PAID reveals which employer covers
   * which patient, and an operator's queue showing it reveals the same thing to
   * the back office. The popup is safe from that only because of WHO IS LOOKING
   * AT IT — the reader is the payer, so the name is their own.
   *
   * That is a property of the call sites, not of the component, so the
   * component cannot hold it. This does. `verify:sprint53` catches the name
   * itself; this catches the surface it could be rendered on.
   */
  const POPUP_ALLOWED = [
    "app/pay/",
    "app/(sponsor)/",
    "app/(app)/billing/",
    "app/(patient)/",
    "app/join/",
    "components/billing/",
  ];

  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const sourceFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (path.endsWith(".tsx") || path.endsWith(".ts")) {
        sourceFiles.push(path);
      }
    }
  };
  walk("app");
  walk("components");

  const popupRenderers = sourceFiles.filter((file) => /PaymentPopup/.test(readSource(file)));

  const strayPopups = popupRenderers.filter(
    (file) => !POPUP_ALLOWED.some((prefix) => file.startsWith(prefix)),
  );

  check(
    "🔴 the payment popup is rendered only where the reader IS the payer",
    strayPopups.length === 0,
    strayPopups.join(", ") || `${popupRenderers.length} call sites, all payer-facing`,
  );

  check(
    "🔴 CONTROL the same scan would catch it on a therapist or admin surface",
    !POPUP_ALLOWED.some((prefix) => "app/(admin)/admin/transfers/page.tsx".startsWith(prefix)) &&
      !POPUP_ALLOWED.some((prefix) => "app/(app)/earnings/page.tsx".startsWith(prefix)),
    "watched refusing the two surfaces C243 was written about",
  );

  /*
   * 🔴 76.10 — EVERY PAYER GETS THE SAME SHEET, AND THE SHEET SAYS WHICH THEY ARE.
   *
   * Four payers, one component, identical bank details underneath. That is the
   * right implementation and it was briefly the wrong experience: a clinic
   * manager and a company's finance officer both met a white sheet with an IBAN
   * on it and no way to tell at a glance whether it was the practice's bill or
   * the employer's pot.
   *
   * The check is on the CALL SITES rather than the component, because the
   * component cannot know which payer it is serving.
   */
  /*
   * ⚠️ 76.16 — AND IT FOLLOWS ONE HOP, because a correct change broke it once.
   *
   * This filtered `popupRenderers` to files under `app/`, which meant "a page
   * that types the word PaymentPopup". Sprint 76 gave the clinician's bill a
   * picker: `app/(app)/billing/page.tsx` now renders `BillPicker`, which
   * renders the popup, and the page stopped containing the word. Nothing about
   * the property changed — the page still builds the subject and still names
   * its payer — but the check said the bill no longer reaches the sheet.
   *
   * That is the §6 family: a check passing or failing on how something is
   * spelled rather than on what is true. A wrapper under `components/billing/`
   * counts as the sheet, because that directory is already the one `POPUP_ALLOWED`
   * trusts, and the subject it renders is built by the page above it.
   */
  const popupWrappers = popupRenderers
    .filter((f) => f.startsWith("components/billing/"))
    .map((f) => f.split("/").pop()!.replace(/\.tsx?$/, ""))
    /* "bill-picker" is exported as `BillPicker`: match the component name. */
    .map((base) => base.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase()));

  const reachesTheSheet = (file: string) => {
    const source = readSource(file);
    return (
      /PaymentPopup/.test(source) || popupWrappers.some((name) => new RegExp(`<${name}\\b`).test(source))
    );
  };

  const popupCallers = sourceFiles.filter((f) => f.startsWith("app/") && reachesTheSheet(f));
  const untyped = popupCallers.filter((f) => !/payerType:/.test(readSource(f)));

  check(
    "🔴 every payment sheet says which payer it is for",
    untyped.length === 0 && popupCallers.length >= 3,
    untyped.join(", ") || `${popupCallers.length} payer screens, each naming its own kind`,
  );

  check(
    "🔴 …and the three rails a person can pay on all reach the same sheet",
    popupCallers.some((f) => f.startsWith("app/pay/")) &&
      popupCallers.some((f) => f.includes("(app)/billing")) &&
      popupCallers.some((f) => f.includes("(sponsor)/sponsor/pot")),
    "a session, a practice bill and a company pot: one component, one set of details",
  );

  /*
   * 🔴 AND THE PATIENT'S MINIMISED STATE IS AN ORB RATHER THAN A BAR.
   *
   * A patient who minimises is going back to the app, and a bar across the top
   * of a patient's screen follows them into a session. The orb sits BELOW the
   * SOS orb's layer, which is C235 expressed as a z-index: the crisis path
   * never depends on money, so a payment reminder must never cover it.
   */
  const popup = readSource("components/billing/payment-popup.tsx");
  check(
    "🔴 the patient minimises to an orb, and it sits under the crisis one",
    /minimised="orb"/.test(readSource("app/pay/[token]/page.tsx")) &&
      /z-\[60\]/.test(popup) &&
      /*
       * W1-09 moved the orb from 70 to 300, above the radar booking sheet at
       * 100. What this asserts is the ORDER, so it reads the orb's layer
       * rather than pinning the old number.
       */
      Number(/fixed z-\[(\d+)\]/.exec(readSource("components/patient/sos-orb.tsx"))?.[1] ?? 0) > 60,
    "a payment reminder covering the SOS button is C235 broken by a stacking context",
  );

  check(
    "🔴 …and the open sheet clears the bottom nav rather than covering it",
    /pb-20/.test(popup),
    "a modal over the tab bar makes the way out the one control that is hidden",
  );

  check(
    "🔴 …and the name it shows is the READER's, never a payer read off a row",
    /viewerName/.test(readSource("components/billing/payment-popup.tsx")) &&
      !/payerName|payerEmail/.test(readSource("components/billing/payment-popup.tsx")),
    "a prop called payerName invites an operator's queue to pass the payer on the row",
  );

  /* ================================================================== */
  /*  🔴 76.16 — WHAT A TRANSFER SAYS IT COVERS                          */
  /* ================================================================== */

  /*
   * A pay-as-you-go clinician can now pay four of eleven sessions, and three
   * things have to agree about which four: the total, the list on the sheet,
   * and the row an operator reads. These hold the ways they could drift apart.
   */
  const billLinesSource = readSource("lib/billing/bill-lines.ts");
  const entrySource = readSource("lib/billing/manual-entry.ts");
  const picker = readSource("components/billing/bill-picker.tsx");

  check(
    "🔴 a chosen invoice is priced by the query, not by the caller",
    /eq\(invoices\.organizationId, organizationId\)/.test(billLinesSource) &&
      /eq\(invoices\.status, "due"\)/.test(billLinesSource) &&
      /payableCents\(row\)/.test(billLinesSource) &&
      !/amountCents: *[a-z]+\.amountCents *\+/.test(billLinesSource),
    "the ids arrive from a browser: a foreign one has to buy nothing, silently",
  );

  check(
    "🔴 …and the total is summed from what was FOUND, never from what was asked for",
    /lines\.reduce\(/.test(billLinesSource) && !/invoiceIds\.reduce|invoiceIds\.length \*/.test(billLinesSource),
    "a total computed from the request is a total the request decided",
  );

  /*
   * 🔴 THE OPEN ROW WINS OVER THE PAGE, for the amount AND for the lines.
   *
   * A payer who committed to a figure and went to their bank must come back to
   * that figure. A bill that grew in between, or an invoice settled by another
   * route, must not redraw a claim that is already in flight.
   */
  check(
    "🔴 an open claim's own total and lines beat the page's fresher sum",
    /amountLabel: formatMoney\(egpMinorFor\(live\.settlesCents/.test(entrySource) &&
      /lines: asLines\(live\.lineItems\)/.test(entrySource),
    "the sheet has to agree with the claim, not with what the account owes this minute",
  );

  check(
    "🔴 CONTROL and with nothing open it falls back to the page's own lines",
    /lines: asLines\(input\.lines\)/.test(entrySource),
    "a freeze with no thaw would leave a paid-off account quoting a stale list for ever",
  );

  /*
   * 🔴 C84 AGAIN, ON THE ONE SCREEN WHERE IT COSTS MONEY.
   *
   * The picker holds a set of ids and nothing else. Every figure it shows was
   * written by the server, because `Intl` in a browser renders different digits
   * from the server pass and these are the characters somebody copies into a
   * banking app. It is the same ruling the stepper follows one sprint earlier.
   */
  check(
    "🔴 the browser picks which invoices, and prices none of them",
    !/toLocaleString|Intl\./.test(picker) && /quote\(picked\)/.test(picker),
    "a total assembled in the browser is a total the browser decided",
  );

  /*
   * ⚠️ AND THE FIRST DRAFT OF THIS CHECK GREPPED FOR A COMMENT, which C205
   * strips before any of these ever see the file. It passed nothing and failed
   * honestly, which is the one thing a comment-shaped assertion can be relied
   * on to do. The property is about the code: `quoteInvoices` opens no row.
   */
  const quoteBody = billActions
    .split("export async function quoteInvoices")[1]
    ?.split("export async function")[0] ?? "";

  check(
    "🔴 …and ticking a box opens no payment, only reading an account number does",
    quoteBody.length > 0 &&
      !/openCart|openManualPayment|db\.insert|db\.update/.test(quoteBody) &&
      /openCart/.test(billActions),
    "a row per tick would put everybody who was still deciding in front of an operator",
  );

  /*
   * 🔴 AND THE DECLARATION CARRIES THE SAME LINES THE SHEET SHOWED.
   *
   * `declareBillTransfer` reads the open row rather than the account, so the
   * amount a payer submits is the amount they were shown. Without this the
   * sheet says $7, the row says $11 and an operator matching a bank statement
   * reads a third number.
   */
  check(
    "🔴 what a clinician submits is what their sheet said, down to the lines",
    /const open = await livePaymentFor\("subscription"/.test(billActions) &&
      /settlesCents,/.test(billActions) &&
      /lineItems: open\?\.lineItems/.test(billActions),
    "a part payment declared as the whole bill is a claim about money nobody made",
  );

  /*
   * 🔴 THE LINES ARE NOT THE TOTAL, and nothing may treat them as one.
   *
   * `settlesCents` is the figure every grant acts on. Tax is added on top and
   * is never a line, so the lines legitimately fall short of the total — a
   * grant that summed them would credit a company its VAT back.
   */
  check(
    "🔴 no grant reads the line items, and settlesCents stays the only figure money moves on",
    !/lineItems/.test(readSource("lib/billing/manual-grants.ts")),
    "the lines describe a payment for a person to read; they are not an amount",
  );

  /*
   * ⚠️ THESE THREE READ SOURCE, AND SOURCE IS THE WEAKER KIND OF EVIDENCE HERE.
   *
   * Sprint 74's own lesson, written down because it cost a sprint: all three
   * defects found in the entitlement loop were true of the source and false of
   * the database. These catch the posting being DELETED. They cannot catch it
   * posting the wrong number, and only a run against real rows can.
   * `verify:entitlement` is where that belongs and it does not cover this yet.
   */

  /* ================================================================== */
  /*  78.6 · the two clocks, and the transfer that went missing between  */
  /* ================================================================== */

  /*
   * 🔴 `decided_at` MUST BE THE DATABASE'S CLOCK.
   *
   * `grantPotTopUp` refuses to credit a pot twice by comparing
   * `p.decided_at < sponsor_pots.updated_at`. The right-hand side is written by
   * Postgres with `now()`. The left-hand side was written by Node with
   * `new Date()`, and on the branch this was found the database ran 800
   * milliseconds ahead of the application.
   *
   * A pot opened and its first transfer confirmed inside that second produced a
   * `decided_at` EARLIER than the `updated_at` stamped moments before it. The
   * guard read a legitimate first confirmation as a replay and credited
   * nothing. The payment still showed as confirmed, `confirmPayment` logged the
   * failed grant and returned success, and the company's money was simply not
   * there. It was caught by a seeded pot coming out at minus 3,500 cents.
   *
   * §6, and this one was reproduced rather than reasoned about: a fixture that
   * creates a pot and evaluates the same comparison twice, once with each
   * clock, answers `YES, the money is lost` for `new Date()` and `no, the pot
   * is credited` for `now()`. The scan below is what keeps it that way.
   */
  check(
    "🔴 78.6 a payment's decision is dated by the database, not by this process",
    !/decidedAt:\s*new Date\(\)/.test(lib) && /decidedAt:\s*sql`now\(\)`/.test(lib),
    "a JS timestamp compared against a Postgres one is two clocks gating money",
  );

  /*
   * 🔴 CONTROL, because a scan for an absence passes on a file it failed to
   * read. The guard it protects must still be the comparison described above,
   * or this check is defending a line that moved.
   */
  check(
    "🔴 CONTROL …and no guard compares two clocks any more (0153)",
    !/decided_at < sponsor_pots\.updated_at/.test(grants),
    "the claim replaced the comparison this scan used to defend",
  );

  /* ================================================================== */
  /*  79.1 · nobody is invited to a room that was never built            */
  /* ================================================================== */

  /*
   * 🔴 THE DEFECT, IN THE SHAPE IT ACTUALLY HAD.
   *
   * `createPrivateRoom` returned null when `DAILY_API_KEY` was unset, and both
   * call sites were written as:
   *
   *     const room = await createPrivateRoom(session.id);
   *     if (room) { save the url }
   *     if (guestEmail) { send the invite }
   *
   * No `else`. The session was created with a null `video_room_url`, the
   * invitation went out anyway, and two people clicked a link to a room nobody
   * had built. It shipped on production, where the key had never been set, and
   * it was found by a founder sitting in one of those sessions.
   *
   * A truthy check on a room is not the defect. A truthy check with nothing on
   * the other side of it is, which is why this scans for the absence of a
   * failure branch rather than for the presence of the call.
   */
  const sessionActions = readSource("app/(app)/sessions/actions.ts");
  const radarActions = readSource("app/(public)/radar/actions.ts");

  for (const [what, source] of [
    ["the clinician's", sessionActions],
    ["the radar's", radarActions],
  ] as const) {
    const calls = source.includes("createPrivateRoom(");
    const handlesFailure = /if\s*\(!\s*made\.ok\)/.test(source);
    check(
      `🔴 79.1 ${what} booking refuses to continue without a room`,
      !calls || handlesFailure,
      "a room that failed to build must stop the booking, not be skipped over",
    );
  }

  /*
   * Compared by POSITION rather than by a pattern spanning both, because
   * `readSource` strips comments and a regex anchored on one would be matching
   * whatever survived rather than the order of the two calls.
   */
  const roomAt = sessionActions.indexOf('createPrivateRoom("pre-session")');
  const sessionAt = sessionActions.indexOf("createSession(actor");
  check(
    "🔴 …and the room is built BEFORE the session and the chart are",
    roomAt > 0 && sessionAt > 0 && roomAt < sessionAt,
    roomAt < 0
      ? "the pre-session room build is gone"
      : `room at ${String(roomAt)}, session at ${String(sessionAt)}: ` +
        "a failure after the chart exists makes a retry create a second one for the same person",
  );

  /*
   * 🔴 AND THE TWO PLACES A PERSON ARRIVES, which is where every session made
   * before this fix still lands. Both must try to build the room rather than
   * rendering an empty frame at somebody who has just paid.
   */
  for (const [who, file] of [
    ["clinician", "app/(room)/sessions/[id]/room/page.tsx"],
    ["patient", "app/join/[token]/actions.ts"],
  ] as const) {
    check(
      `🔴 79.1 the ${who}'s arrival builds a missing room rather than showing a blank`,
      /ensureRoom\(/.test(readSource(file)),
      "production is full of sessions with no room, and their patients hold join links",
    );
  }

  /*
   * 🔴 79.1 — EVERY PATH THAT MAKES A VIDEO SESSION, FOUND RATHER THAN LISTED.
   *
   * The two checks above name two files, and naming files is exactly how this
   * shipped. There is a THIRD path, `lib/data/session-invite.ts`, which creates
   * a `modality: "video"` session from the patient profile and never asked for
   * a room at all. Not a room that failed: no attempt. A clinician pressed
   * Invite, the patient got a door, and the two of them sat in the same session
   * record unable to hear each other.
   *
   * It survived because the rule in everybody's head was "the room is built
   * where sessions are made", and that was true of two places out of three. So
   * this finds the callers instead of trusting a list: every file that creates
   * a session with `modality: "video"` must also reach a room, directly or
   * through `ensureRoom`.
   */
  const { readdirSync: readDir } = await import("node:fs");
  const { join: joinPath } = await import("node:path");
  const everySource: string[] = [];
  const sweep = (dir: string) => {
    for (const entry of readDir(dir, { withFileTypes: true })) {
      const path = joinPath(dir, entry.name);
      if (entry.isDirectory()) sweep(path);
      else if (path.endsWith(".ts") || path.endsWith(".tsx")) everySource.push(path);
    }
  };
  sweep("app");
  sweep("lib");

  /*
   * A THERAPY session, not an auth one. `createSession` is the name of both,
   * and three of the six files that call something by that name are signing
   * somebody in. The discriminator is where it comes from, or a direct insert
   * into the table.
   */
  const makers = everySource.filter((file) => {
    const body = readSource(file);
    return (
      /import\s*\{[^}]*\bcreateSession\b[^}]*\}\s*from\s*"@\/lib\/data\/sessions"/.test(body) ||
      /\.insert\(sessions\)/.test(body)
    );
  });

  /*
   * 🔴 THE RULE IS NOT "BUILD A ROOM AT CREATION", and getting that wrong is
   * how the first draft of this check went red about correct code.
   *
   * A Daily room carries a four-hour `exp`. An appointment booked on Monday for
   * Thursday would outlive its own room, so `bookFromSlot` in
   * `lib/data/scheduling.ts` deliberately creates none and is RIGHT not to.
   *
   * What must hold is that nobody ever meets a session with no room. That has
   * two halves, and both are checked: a path whose patient is invited to arrive
   * NOW builds the room before the invitation goes, and both arrival paths
   * build one if they find none. The second half is what makes a future booking
   * safe; the first is what stops a patient being the one who discovers the
   * door is cold.
   */
  const IMMEDIATE = [
    "app/(app)/sessions/actions.ts",
    "app/(public)/radar/actions.ts",
    "lib/data/session-invite.ts",
  ];

  const coldDoors = IMMEDIATE.filter(
    (file) => !/createPrivateRoom\(|ensureRoom\(/.test(readSource(file)),
  );
  check(
    "🔴 79.1 every path that invites somebody NOW builds the room first",
    coldDoors.length === 0,
    coldDoors.length > 0 ? `no room in: ${coldDoors.join(", ")}` : IMMEDIATE.join(", "),
  );

  /*
   * 🔴 AND THE LIST IS CHECKED AGAINST REALITY, because a list is how this
   * shipped. `session-invite.ts` was the third of three and nobody had it: the
   * rule in everybody's head was "the room is built where sessions are made",
   * which was true of two places out of three. A new file that makes sessions
   * fails here until somebody decides which half of the rule it lives under.
   */
  const KNOWN = [
    ...IMMEDIATE,
    /* Where `createSession` and `ensureRoom` themselves live. */
    "lib/data/sessions.ts",
    /*
     * A future appointment. No room at creation ON PURPOSE: a Daily room
     * expires in four hours, so one built for Thursday on Monday is gone before
     * anybody arrives. The arrival paths build it — which is what makes this
     * safe, PROVIDED the patient can reach an arrival path at all. See
     * DEFERRED below: that proviso is the half this check originally missed.
     */
    "lib/data/scheduling.ts",
    /*
     * 🔴 FOUND BY THIS CHECK, which is the first thing it did. A session a
     * partner's platform already RAN, written back to us as `status:
     * "completed"` so the note and the books exist. Nobody joins it through us
     * and there is nothing to join, so it needs no room and never will.
     */
    "lib/partner/writeback.ts",
  ];
  const strangers = makers.filter((file) => !KNOWN.includes(file));
  check(
    "🔴 …and no file makes sessions that this rule has not been applied to",
    strangers.length === 0,
    strangers.length > 0
      ? `unaccounted for: ${strangers.join(", ")}`
      : `${String(makers.length)} session-making files, all accounted for`,
  );

  /*
   * 🔴 AND THE DEFERRED PATHS MINT A WAY IN.
   *
   * ## The hole this closes, and it is the hole this whole check was for
   *
   * The two checks above let a path off building a room if the patient
   * arrives later, on the grounds that "both arrival paths build one". That
   * sentence is only true of a patient who can REACH an arrival path.
   *
   * `bookSlot` minted no `joinToken`. So a future booking had `join_token`
   * NULL, there was no `/join/<token>` for the patient anywhere, and the heal
   * that justified skipping the room could never run — because the only two
   * places that call `ensureRoom` are the clinician's room page and the join
   * page, and one of those did not exist for this session. Confirmed on
   * production: `d20af554`, booked for 24 September, both columns null,
   * created forty minutes AFTER the room fix shipped.
   *
   * Exactly the shape of the `feedbackToken` gap in the same INSERT, one
   * field along, and invisible for the same reason: the other two creation
   * paths both mint one, so the rule in everybody's head was true of two
   * places out of three. Including this one's own verifier.
   */
  const DEFERRED = ["lib/data/scheduling.ts"];
  const tokenless = DEFERRED.filter((file) => !/joinToken:/.test(readSource(file)));
  check(
    "🔴 79.1 a path that defers the room still mints a join token to come back with",
    tokenless.length === 0,
    tokenless.length > 0
      ? `no joinToken in: ${tokenless.join(", ")}, so the patient has no way to reach the heal`
      : DEFERRED.join(", "),
  );

  /*
   * 🔴 NOTHING CANCELS A SESSION SOMEBODY HAS PAID FOR.
   *
   * ## The hour this cost a stranger
   *
   * `bookFromRadar` holds one clinician per address, and hands back whatever
   * that address held before so an abandoned booking does not strand a
   * clinician for ten minutes. Reclaiming the old one read:
   *
   *     .set({ status: "cancelled", joinToken: null })
   *     .where(and(eq(sessions.id, previous), eq(sessions.status, "scheduled")))
   *
   * No payment term. Observed on production to the millisecond: a session was
   * created, paid for, and CONFIRMED BY A HUMAN at 02:28:47, and at 02:33:04 a
   * different visitor booked a different clinician and that paid session was
   * cancelled with its join token set to NULL. Four minutes after paying, with
   * nothing said to them, and their pay page still reading "It will be waiting
   * for you here."
   *
   * The key is a NETWORK, not a person — a household, an office, a campus, any
   * carrier on CGNAT. So "the previous booking from this address" is routinely
   * a stranger's.
   *
   * ## Why a gate and not just a fix
   *
   * The periodic sweep in `lib/data/radar.ts` already guarded on
   * `payment_status` and `patient_joined_at`. The same intent was implemented
   * twice, one of them was wrong, and the wrong one was the one on the request
   * path. A comment would not have caught that. This does: every site that
   * cancels a session it did not create in the same request has to carry both
   * guards, or be named here with a reason.
   */
  const CANCEL_EXEMPT = new Map<string, string>([
    /*
     * Cancels the session it created moments earlier in the same call, after
     * losing the claim race or failing to build a room. Nobody has paid for a
     * session that is seconds old and was never handed to anyone.
     */
    ["app/(public)/radar/actions.ts", "also cancels its own just-created session, which is exempt"],
    /*
     * A clinician cancelling their own session from their own screen. Paid or
     * not is their call to make, not ours to refuse.
     */
    ["lib/data/sessions.ts", "a clinician cancelling their own booking on purpose"],
    /* Cancels a slot's session on the clinician's instruction, same reasoning. */
    ["lib/data/scheduling.ts", "a clinician cancelling or rescheduling their own hour"],
    /* Offers the patient a cancellation after a no-show; they choose it. */
    ["lib/data/recovery.ts", "the patient's own choice after nobody turned up"],
    /*
     * W1-28: the "cancelled" here is a REFUND REQUEST's status, not a session's:
     * an operator withdrawing a queued refund, with a required reason, only while
     * the row is still `owed`. Its only session writes happen when a refund is
     * marked sent: payment status back to pending (as the card refund does) and
     * the recovery outcome from `refund_owed` to `refunded`. It never sets a
     * session's status.
     */
    ["lib/billing/refunds.ts", "cancels a refund request, never a session"],
    /*
     * W2-A10: an operator taking a clinician off the board cancels the booking
     * in flight (still `scheduled`, the guard is in its WHERE) and hands it to
     * `afterClinicianCancel`, which refunds a paid one or queues the refund and
     * tells the patient it was us. Leaving a paid patient waiting for somebody
     * we removed is the outcome this check exists to prevent, not this.
     */
    ["lib/data/radar-admin.ts", "an operator removing a clinician mid-booking; refunded through clinician-cancel"],
    /*
     * Task 40 / ruling 16: the PATIENT cancelling their own paid booking, on
     * purpose. Guarded on `scheduled` and no start in its WHERE; the money is
     * refunded inside the window (a setting) or held for the clinician after
     * it, and `verify:booking-change` proves both happen once.
     */
    ["lib/data/booking-change.ts", "the patient cancelling their own booking; refunded or held by ruling 16"],
    /* 0147: the state sent to the Tax Authority when a tax document is withdrawn. No session. */
    ["lib/billing/eta/client.ts", "cancels a tax document at the Tax Authority, never a session"],
  ]);

  const cancellers = everySource.filter((file) =>
    /status:\s*"cancelled"/.test(readSource(file)),
  );
  const cancelUnguarded = cancellers.filter((file) => {
    if (CANCEL_EXEMPT.has(file)) return false;
    const body = readSource(file);
    return !(/paymentStatus/.test(body) && /patientJoinedAt/.test(body));
  });
  check(
    "🔴 no path cancels a session that is paid for or already joined",
    cancelUnguarded.length === 0,
    cancelUnguarded.length > 0
      ? `cancels without a payment guard: ${cancelUnguarded.join(", ")}`
      : `${String(cancellers.length)} cancelling files, ${String(CANCEL_EXEMPT.size)} named exempt`,
  );

  /*
   * And the one that bit us carries the guards in the specific block that bit
   * us, not merely somewhere in a two-thousand line file. The exemption above
   * lets this file cancel its OWN new session; it must still never take away
   * somebody else's paid one.
   */
  const radarBody = readSource("app/(public)/radar/actions.ts");
  const holdBlock = radarBody.slice(radarBody.indexOf("takeHold("));
  const holdGuarded =
    /ne\(sessions\.paymentStatus,\s*"paid"\)/.test(holdBlock) &&
    /isNull\(sessions\.patientJoinedAt\)/.test(holdBlock);
  check(
    "🔴 …and the per-address hold will not reclaim a paid booking",
    holdGuarded,
    holdGuarded
      ? "the reclaim checks payment and arrival"
      : "the reclaim can still cancel a session a stranger paid for",
  );

  /*
   * 🔴 A ROOM THAT OUTLIVES THE APPOINTMENT IT IS FOR.
   *
   * A Daily room has a hard expiry. `createPrivateRoom` set it to four hours
   * from the moment it was called, with no reference to when the session was
   * actually for, and `ensureRoom` returned early whenever a URL was present,
   * with no check on whether that URL still opened onto anything.
   *
   * Each half is fine alone. Together they destroy a future appointment
   * permanently, and it takes one curious clinician: open Wednesday's session
   * on Monday, the room page builds a room that dies Monday teatime, and on
   * Wednesday `ensureRoom` sees a URL and returns it. Nothing ever nulls that
   * column, so the heal written for exactly this case can never fire again.
   *
   * Observed on production: room `s-14347218b21044bbaf83`, exp
   * 2026-09-21T06:38Z, for a session at 2026-09-23T16:00Z. Dead 57 hours
   * early.
   */
  const videoBody = readSource("lib/video.ts");
  const expiryFromSession = /liveAt/.test(videoBody) && /Math\.max\(Date\.now\(\)/.test(videoBody);
  check(
    "🔴 a room's expiry is taken from the hour the session is for, not from now",
    expiryFromSession,
    expiryFromSession
      ? "createPrivateRoom builds from max(now, the session's hour)"
      : "the expiry ignores scheduledAt, so a future booking gets a room that dies first",
  );

  const sessionsBody = readSource("lib/data/sessions.ts");
  const healChecksExpiry =
    /videoRoomExpiresAt/.test(sessionsBody) &&
    /videoRoomExpiresAt\s*>\s*needsBy/.test(sessionsBody);
  check(
    "🔴 …and the heal treats an expired room as no room at all",
    healChecksExpiry,
    healChecksExpiry
      ? "ensureRoom asks whether the room is alive when the session needs it"
      : "ensureRoom returns any URL it finds, including a room Daily has reaped",
  );

  check(
    "🔴 CONTROL the sweep finds the files it is about, not an empty set",
    makers.length >= 4 && makers.includes("lib/data/session-invite.ts"),
    `${String(makers.length)} found: a sweep that misses the file this was written about proves nothing`,
  );

  /*
   * 🔴 CONTROL, because every check above is satisfied by a file that does not
   * mention rooms at all. The scan must be able to see the thing it is about.
   */
  check(
    "🔴 CONTROL the scan is reading files that really do make rooms",
    /createPrivateRoom\(/.test(sessionActions) && /createPrivateRoom\(/.test(radarActions),
    "a path rename would quietly pass every check above",
  );

  /*
   * 🔴 AND IT CAN BE ASKED, which is the half that was missing entirely.
   * `features.video` reads whether a string is present; a revoked key is
   * present. The console makes a real room and deletes it.
   */
  check(
    "🔴 79.1 the console can answer whether video actually works",
    /videoHealth\(\)/.test(readSource("components/admin/video-check.tsx")) &&
      /<VideoCheck \/>/.test(readSource("app/(admin)/admin/settings/page.tsx")),
    "DAILY_API_KEY is write-only on Vercel, so using it is the only way to know",
  );

  finish("sprints 73 and 74");
}

main();
