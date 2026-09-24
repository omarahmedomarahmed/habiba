/*
 * 🔴 76.56 — WHAT IS IN THE BANK. super_admin only, and never clinical.
 */
import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { controlDb as db } from "@/lib/db";
import { OTHER_COST_KINDS, capitalContributions, otherCosts, type OtherCostKind } from "@/lib/db/schema";

/**
 * Money in that is not revenue, and money out that nothing in the product bought.
 *
 * ## 🔴 THE NUMBER THIS EXISTS FOR, AND WHY IT WAS WRONG WITHOUT IT
 *
 * `/admin/actuals` accumulated the `cash` ledger account from zero and printed
 * the result in a column headed **Cash**. That sum is correct and it is not the
 * bank balance: it is what six months of TRADING did to the balance. A company
 * that put in fifty thousand dollars and spent thirty of it read as minus thirty
 * thousand, on a screen whose whole argument is that it measures rather than
 * assumes.
 *
 * The §6 family, one more time. The sum was right about the rows it was given
 * and silent about the row nothing had ever written.
 *
 * ## 🔴 AND THE SECOND NUMBER, WHICH IS THE ONE THAT KILLS COMPANIES
 *
 * The balance includes money that is not ours: VAT collected and not yet
 * remitted, what clinicians have earned and we have not paid out, and every
 * employer's unspent pot. All three are in the same bank account and none of
 * them can be spent. `bankBalance` and `ours` are therefore two different
 * figures and the screen shows both, because the commonest way a young company
 * believes it has runway is by counting other people's money as its own.
 *
 * ## Why these are not ledger entries, which was the first design
 *
 * Posting them would put an accountant's invoice into the vault, the money
 * reconciliation and a therapist's own statement, all of which are about money
 * that moved between us and a customer. And `scripts/baseline.ts` and
 * `verify:actuals` both count ledger rows, so a typed figure would read as
 * trading. A row means one thing.
 */

export type CapitalRow = {
  id: string;
  amountCents: number;
  receivedOn: string;
  source: string;
  note: string | null;
};

export type OtherCostRow = {
  id: string;
  kind: OtherCostKind;
  /** `YYYY-MM`, because the day is never read. */
  month: string;
  amountCents: number;
  note: string | null;
};

/** What each kind is called on screen, and what it is for. */
export const OTHER_COST_LABELS: Record<OtherCostKind, { label: string; hint: string }> = {
  video: { label: "Video", hint: "Daily, per participant minute, billed against an account" },
  bank_charges: { label: "Bank charges", hint: "what the bank took on each EGP transfer" },
  hosting: { label: "Hosting", hint: "Vercel, Neon, blob storage, the domain" },
  software: { label: "Software", hint: "anything bought with a card and used monthly" },
  professional: { label: "Accountant and legal", hint: "people we pay who are not on the payroll" },
  marketing: { label: "Marketing", hint: "money spent to bring somebody in" },
  other: { label: "Everything else", hint: "with a note saying what it was" },
};

/**
 * 🔴 THE SECOND LOCK, the same one `lib/data/payroll.ts` explains at length.
 *
 * The page redirects, which is right for a person who followed a link. It is
 * wrong for a caller that is not a page, where a thrown redirect reads as a
 * routing accident rather than a refusal. What the company has in the bank is
 * not a queue.
 */
function mustBeFounder(actor: Actor): void {
  if (actor.role !== "super_admin") {
    throw new Error("capital: what is in the bank is super_admin only");
  }
}

/* -------------------------------------------------------------------- reads */

export async function listCapital(actor: Actor): Promise<CapitalRow[]> {
  mustBeFounder(actor);

  const rows = await db
    .select()
    .from(capitalContributions)
    .orderBy(asc(capitalContributions.receivedOn), asc(capitalContributions.createdAt));

  return rows.map((row) => ({
    id: row.id,
    amountCents: row.amountCents,
    receivedOn: String(row.receivedOn),
    source: row.source,
    note: row.note,
  }));
}

export async function listOtherCosts(actor: Actor): Promise<OtherCostRow[]> {
  mustBeFounder(actor);

  const rows = await db
    .select()
    .from(otherCosts)
    .orderBy(desc(otherCosts.month), asc(otherCosts.kind));

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    month: String(row.month).slice(0, 7),
    amountCents: row.amountCents,
    note: row.note,
  }));
}

/**
 * Capital that had arrived by the END of each month, accumulated.
 *
 * 🔴 CUMULATIVE, not per month. The question the balance column asks is "how
 * much had been put in by then", and an angel cheque in month 2 is still in the
 * bank in month 5. A per-month figure added to a per-month cash movement would
 * put the cheque in one month and take it out of the next.
 */
export async function capitalByMonth(months: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (months.length === 0) return out;

  const rows = await db
    .select({
      receivedOn: capitalContributions.receivedOn,
      amountCents: capitalContributions.amountCents,
    })
    .from(capitalContributions);

  let running = 0;
  for (const month of months) {
    for (const row of rows) {
      if (String(row.receivedOn).slice(0, 7) === month) running += row.amountCents;
    }
    out.set(month, running);
  }

  /*
   * 🔴 MONEY THAT ARRIVED BEFORE THE FIRST MONTH IN THE RANGE.
   *
   * `monthRange` starts at the first thing that happened in the product, and
   * the founders put money in before that or there would have been nothing to
   * happen with. Without this every figure in the column is short by the
   * opening cheque, which is the largest one.
   */
  const first = months[0]!;
  const before = rows
    .filter((row) => String(row.receivedOn).slice(0, 7) < first)
    .reduce((total, row) => total + row.amountCents, 0);

  if (before > 0) {
    for (const month of months) out.set(month, (out.get(month) ?? 0) + before);
  }

  return out;
}

/** What each month was charged for the things nothing in the product buys. */
export async function otherCostsByMonth(): Promise<Map<string, number>> {
  const rows = await db
    .select({ month: otherCosts.month, amountCents: otherCosts.amountCents })
    .from(otherCosts);

  const out = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.month).slice(0, 7);
    out.set(key, (out.get(key) ?? 0) + row.amountCents);
  }
  return out;
}

/* ------------------------------------------------------------------- writes */

export async function addCapital(
  actor: Actor,
  input: { amountCents: number; receivedOn: string; source: string; note?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  mustBeFounder(actor);

  const source = input.source.trim();
  if (!source) return { ok: false, error: "Say whose money it is." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.receivedOn)) {
    return { ok: false, error: "The date it arrived has to be a date." };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: "An amount that is not a positive number is not money in." };
  }

  const [row] = await db
    .insert(capitalContributions)
    .values({
      amountCents: input.amountCents,
      receivedOn: input.receivedOn,
      source,
      note: input.note?.trim() || null,
      createdBy: actor.userId,
    })
    .returning({ id: capitalContributions.id });

  await audit({
    actor,
    category: "admin",
    action: "capital.added",
    resourceType: "capital_contribution",
    resourceId: row!.id,
    reason: `${String(input.amountCents)} cents from ${source} on ${input.receivedOn}`,
  });

  return { ok: true, id: row!.id };
}

export async function removeCapital(
  actor: Actor,
  input: { id: string; why?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  mustBeFounder(actor);

  const [row] = await db
    .select()
    .from(capitalContributions)
    .where(eq(capitalContributions.id, input.id))
    .limit(1);

  if (!row) return { ok: false, error: "No contribution by that id." };

  await db.delete(capitalContributions).where(eq(capitalContributions.id, input.id));

  await audit({
    actor,
    category: "admin",
    action: "capital.removed",
    resourceType: "capital_contribution",
    resourceId: input.id,
    /* Both figures, so a deletion can be read back as what it removed. */
    reason: `${String(row.amountCents)} cents from ${row.source} on ${String(row.receivedOn)}${input.why ? `, ${input.why}` : ""}`,
  });

  return { ok: true };
}

/**
 * 🔴 ONE FIGURE PER KIND PER MONTH, AND A SECOND WRITE REPLACES IT.
 *
 * The unique index refuses the duplicate. Failing on it would be right for a
 * double submit and wrong for a founder correcting a number they just typed, so
 * this replaces and the audit log carries both amounts. Same decision, and the
 * same reasoning, as `setSalary`.
 */
export async function setOtherCost(
  actor: Actor,
  input: { kind: string; month: string; amountCents: number; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  mustBeFounder(actor);

  if (!(OTHER_COST_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: "That is not one of the kinds of cost this screen holds." };
  }
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    return { ok: false, error: "The month has to look like 2026-03." };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    return { ok: false, error: "A cost cannot be negative." };
  }

  const kind = input.kind as OtherCostKind;
  const first = `${input.month}-01`;

  const [existing] = await db
    .select({ id: otherCosts.id, amountCents: otherCosts.amountCents })
    .from(otherCosts)
    .where(and(eq(otherCosts.kind, kind), eq(otherCosts.month, first)))
    .limit(1);

  /*
   * Zero is how a founder removes a line they typed by mistake, rather than a
   * delete button that would need its own confirmation for a number.
   */
  if (existing && input.amountCents === 0) {
    await db.delete(otherCosts).where(eq(otherCosts.id, existing.id));
  } else if (existing) {
    await db
      .update(otherCosts)
      .set({
        amountCents: input.amountCents,
        note: input.note?.trim() || null,
        createdBy: actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(otherCosts.id, existing.id));
  } else if (input.amountCents > 0) {
    await db.insert(otherCosts).values({
      kind,
      month: first,
      amountCents: input.amountCents,
      note: input.note?.trim() || null,
      createdBy: actor.userId,
    });
  }

  await audit({
    actor,
    category: "admin",
    action: existing ? "cost.corrected" : "cost.set",
    resourceType: "other_cost",
    resourceId: `${kind}:${input.month}`,
    reason:
      `${OTHER_COST_LABELS[kind].label} ${input.month}: ${String(input.amountCents)} cents` +
      (existing ? `, was ${String(existing.amountCents)}` : "") +
      (input.note ? `. ${input.note}` : ""),
  });

  return { ok: true };
}
