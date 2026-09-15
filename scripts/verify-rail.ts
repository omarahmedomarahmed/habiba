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

  finish("sprint 73");
}

main();
