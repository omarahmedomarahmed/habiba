import type { LedgerAccount } from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * 🔴 Board 593 (AD11.3): WHAT A HAND ADJUSTMENT DOES, in the words a screen shows.
 *
 * The ledger stores one signed number per leg, debit positive. A clinician's
 * held balance is a liability, so it is read as the NEGATIVE of its sum
 * (`heldBalances`, `heldForTherapist`). The form asked for "Amount ($),
 * negative is fine" and posted that number as the leg, so an operator who
 * typed +2 to give Dr Amira a $2 goodwill credit took $2 OFF her balance
 * ($64 to $62), and a second operator completed it, because nothing on either
 * screen said which way the money would move.
 *
 * The operator now chooses a direction ("add to this balance" or "take it
 * off") on the balance as every other screen reads it, and this file is the
 * one place that turns that into the ledger's sign. The preview and the
 * approval card read their before and after through the same functions, so
 * what the screen promises and what the ledger posts cannot drift apart.
 */

/**
 * Accounts read as the negative of their sum: what we owe (liabilities) and
 * what we earned (income). Every other account reads as its sum: what we have
 * or are owed, and what we spent. `fx_difference` is expense-shaped, as its
 * own comment in the schema says.
 */
const READ_NEGATED: readonly LedgerAccount[] = [
  "therapist_payable",
  "sponsor_pot",
  "patient_wallet",
  "vat_payable",
  "platform_revenue",
];

export type AdjustDirection = "up" | "down";

/** The balance as the screens read it, from the ledger's raw sum. */
function shownBalance(account: LedgerAccount, ledgerSumCents: number): number {
  const value = READ_NEGATED.includes(account) ? -ledgerSumCents : ledgerSumCents;
  return value === 0 ? 0 : value;
}

/** The signed leg that moves the shown balance of `account` up or down by `cents`. */
export function ledgerAmountFor(account: LedgerAccount, direction: AdjustDirection, cents: number): number {
  const magnitude = Math.abs(Math.round(cents));
  const up = READ_NEGATED.includes(account) ? -magnitude : magnitude;
  return direction === "up" ? up : -up;
}

/**
 * The other leg, which is always ours: `postAdjustment` posts it, and the
 * preview names it, from this one rule. An adjustment to our own income or
 * costs balances against the other one, never against itself: a leg and its
 * mirror on one account would post two rows and move nothing.
 */
export function counterAccountFor(account: LedgerAccount, ledgerCents: number): LedgerAccount {
  if (account === "platform_revenue") return "platform_expense";
  if (account === "platform_expense") return "platform_revenue";
  return ledgerCents > 0 ? "platform_revenue" : "platform_expense";
}

export type EffectRow = {
  account: LedgerAccount;
  /** Shown balance before and after, in cents. */
  beforeCents: number;
  afterCents: number;
};

/**
 * Both legs of an adjustment, as balances before and after.
 *
 * `sums` are the ledger's raw sums of each account in the scope the screen
 * shows (the clinician for their held balance, the organisation otherwise).
 */
export function adjustmentEffect(input: {
  account: LedgerAccount;
  ledgerCents: number;
  sums: Partial<Record<LedgerAccount, number>>;
}): [EffectRow, EffectRow] {
  const counter = counterAccountFor(input.account, input.ledgerCents);
  const row = (account: LedgerAccount, legCents: number): EffectRow => {
    const before = input.sums[account] ?? 0;
    return {
      account,
      beforeCents: shownBalance(account, before),
      afterCents: shownBalance(account, before + legCents),
    };
  };
  return [row(input.account, input.ledgerCents), row(counter, -input.ledgerCents)];
}

/** Dollars as the console reads them, sign first: "-$2.00". */
export function usd(cents: number): string {
  const abs = (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cents < 0 ? "-" : ""}$${abs}`;
}

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** A balance's name in words: whose it is and which account, never the code. */
function balanceLabel(
  t: Translate,
  account: LedgerAccount,
  names: { clinician?: string | null; org?: string | null },
): string {
  if (account === "therapist_payable" && names.clinician) return t("adj.heldFor", { name: names.clinician });
  const words = t(`adj.acct.${account}` as MessageKey);
  return names.org ? t("adj.forOrg", { account: words, org: names.org }) : words;
}

/** One line per balance, named in words: what it is now and what it becomes. */
export function effectLines(
  t: Translate,
  rows: readonly EffectRow[],
  names: { clinician?: string | null; org?: string | null },
): string[] {
  return rows.map((row) =>
    t("adj.effect", {
      account: balanceLabel(t, row.account, names),
      before: usd(row.beforeCents),
      after: usd(row.afterCents),
    }),
  );
}

export function effectSentence(
  t: Translate,
  rows: readonly EffectRow[],
  names: { clinician?: string | null; org?: string | null },
): string {
  return effectLines(t, rows, names).join(" ");
}
