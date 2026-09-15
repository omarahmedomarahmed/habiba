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
  ] as const;

  const unrendered = RENDERED.filter(([, key]) => !ui.includes(`t("${key}")`));
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

  finish("sprint 73");
}

main();
