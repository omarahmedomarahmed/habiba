import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { reasonProblem } from "@/lib/admin/reason";

import { controlDb as db } from "@/lib/db";
import { potReturns, sponsorPots, sponsors } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";

/**
 * 🔴 0148: MONEY BACK OUT OF A COMPANY'S POT.
 *
 * The refund terms every pot is opened under promise unused money back on the
 * terms' conditions, and nothing did it. Now an operator asks for a return and
 * a DIFFERENT operator sends it, the payout rule (four eyes) applied to the
 * one other place money leaves us for somebody outside.
 *
 * Sending is one transaction: the row moves to `sent` only while it is still
 * `requested`, the pot falls only while it holds the amount, and the ledger
 * posts the top-up in reverse (cash out, the pot's liability and the VAT owed
 * both down). The published balance falls by the same credit: the company
 * knows the figure, so it is not a differencing leak. The ETA credit note
 * (Egyptian companies only) follows outside the transaction and never undoes
 * a return that happened; if it fails, the hourly ETA job opens it.
 */

/** `asked`: a cancel written down, waiting for a second person (K23). */
export type ReturnResult = { ok: true; id: string; asked?: boolean } | { error: string };

export async function requestPotReturn(input: {
  sponsorId: string;
  netCents: number;
  egpMinor: number;
  reason: string;
  requestedBy: string;
}): Promise<ReturnResult> {
  const netCents = Math.round(input.netCents);
  const egpMinor = Math.round(input.egpMinor);
  const reason = input.reason.trim().slice(0, 500);
  if (!Number.isFinite(netCents) || netCents <= 0) return { error: "Enter the credit to return." };
  if (!Number.isFinite(egpMinor) || egpMinor <= 0) return { error: "Enter the pounds that will be sent." };
  if (!reason) return { error: "Say why, as the refund terms allow it." };

  const [pot] = await db
    .select({ balanceCents: sponsorPots.balanceCents, entity: sponsors.entity })
    .from(sponsorPots)
    .innerJoin(sponsors, eq(sponsors.id, sponsorPots.sponsorId))
    .where(eq(sponsorPots.sponsorId, input.sponsorId))
    .limit(1);
  if (!pot) return { error: "This company has no pot." };
  if (netCents > pot.balanceCents) return { error: "That is more than the pot holds." };

  const { entityVatBps } = await import("./pot");
  const vatBps = await entityVatBps(pot.entity ?? "eg");
  const vatCents = Math.round((netCents * vatBps) / 10_000);

  const [row] = await db
    .insert(potReturns)
    .values({ sponsorId: input.sponsorId, netCents, vatCents, egpMinor, reason, requestedBy: input.requestedBy })
    .onConflictDoNothing()
    .returning({ id: potReturns.id });
  if (!row) return { error: "A return for this company is already waiting to be sent." };
  return { ok: true, id: row.id };
}

/**
 * 🔴 K23: not sent after all, with the reason. It was one press with no reason
 * and no name but the canceller's. Now the reason is required at the console's
 * length, and while company returns need two people (`rules.approvals.potReturns`)
 * the first person asks and a DIFFERENT person cancels, as a refund's cancel
 * works. The database refuses a cancelled row with no reason or no asker.
 */
export async function cancelPotReturn(input: { id: string; by: string; reason: string }): Promise<ReturnResult> {
  const [row] = await db
    .select({ state: potReturns.state, askedBy: potReturns.cancelAskedBy })
    .from(potReturns)
    .where(eq(potReturns.id, input.id))
    .limit(1);
  if (!row || row.state !== "requested") return { error: "That return is no longer waiting." };
  const { getSettings } = await import("@/lib/settings");
  const twoPeople = (await getSettings()).rules.approvals.potReturns;
  const now = new Date();

  if (!row.askedBy) {
    const reason = input.reason.trim();
    if (reasonProblem(reason)) return { error: "aconfirm.tooShort" };
    const asking = { cancelReason: reason.slice(0, 500), cancelAskedBy: input.by, cancelAskedAt: now };
    const [moved] = await db
      .update(potReturns)
      .set(twoPeople ? asking : { ...asking, state: "cancelled", decidedBy: input.by, decidedAt: now })
      .where(and(eq(potReturns.id, input.id), eq(potReturns.state, "requested"), isNull(potReturns.cancelAskedBy)))
      .returning({ id: potReturns.id });
    if (!moved) return { error: "That return is no longer waiting." };
    return twoPeople ? { ok: true, id: moved.id, asked: true } : { ok: true, id: moved.id };
  }

  if (twoPeople && row.askedBy === input.by) return { error: "apot.cancelTwo" };
  const [cancelled] = await db
    .update(potReturns)
    .set({ state: "cancelled", decidedBy: input.by, decidedAt: now })
    .where(
      and(eq(potReturns.id, input.id), eq(potReturns.state, "requested"), eq(potReturns.cancelAskedBy, row.askedBy)),
    )
    .returning({ id: potReturns.id });
  return cancelled ? { ok: true, id: cancelled.id } : { error: "That return is no longer waiting." };
}

export async function sendPotReturn(input: { id: string; sentBy: string; bankReference: string }): Promise<ReturnResult> {
  const bankReference = input.bankReference.trim().slice(0, 200);
  if (!bankReference) return { error: "Enter the bank reference of the transfer you made." };

  const { journal } = await import("./ledger");
  let sent: { sponsorId: string; netCents: number; vatCents: number; egpMinor: number } | null = null;
  /* 🔴 0161 / ruling 13: off by default, so the person who asked may also send. */
  const { getSettings } = await import("@/lib/settings");
  const twoPeople = (await getSettings()).rules.approvals.potReturns;
  try {
    sent = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(potReturns)
        .where(and(eq(potReturns.id, input.id), eq(potReturns.state, "requested")))
        .for("update")
        .limit(1);
      if (!row) throw new Refused("That return is no longer waiting.");
      if (twoPeople && row.requestedBy === input.sentBy) {
        throw new Refused("A second person sends what the first one asked for.");
      }

      const fell = await tx.execute(sql`
        UPDATE sponsor_pots
           SET balance_cents = balance_cents - ${row.netCents},
               published_balance_cents = CASE WHEN published_balance_cents IS NULL THEN NULL
                                               ELSE GREATEST(0, published_balance_cents - ${row.netCents}) END,
               updated_at = now()
         WHERE sponsor_id = ${row.sponsorId}
           AND balance_cents >= ${row.netCents}
        RETURNING id`);
      if (fell.rows.length === 0) throw new Refused("The pot no longer holds that much. Cancel and ask again.");

      const txnId = await journal({
        kind: "pot_return",
        refType: "sponsor",
        refId: row.sponsorId,
        createdBy: input.sentBy,
        executor: tx,
        legs: [
          { account: "cash", amountCents: -(row.netCents + row.vatCents), memo: "Unused pot money sent back to the company" },
          { account: "vat_payable", amountCents: row.vatCents, memo: "VAT on the returned credit, reversed by credit note" },
          { account: "sponsor_pot", amountCents: row.netCents, memo: "No longer held for this company" },
        ],
      });

      await tx
        .update(potReturns)
        .set({ state: "sent", decidedBy: input.sentBy, decidedAt: new Date(), bankReference, txnId })
        .where(eq(potReturns.id, row.id));
      return { sponsorId: row.sponsorId, netCents: row.netCents, vatCents: row.vatCents, egpMinor: row.egpMinor };
    });
  } catch (error) {
    if (error instanceof Refused) return { error: error.message };
    throw error;
  }
  if (!sent) return { error: "Not sent." };

  /*
   * The credit note, in the pounds that left, split as the ledger split them.
   * 🔴 C12a: built from the committed row, so a throw here is not the end of
   * it: the hourly `advanceEtaDocuments` opens the note for any sent return
   * that has none, through the same function.
   */
  try {
    const { openCreditNoteForReturn } = await import("./eta/issue");
    await openCreditNoteForReturn(input.id);
  } catch (error) {
    log.error("return credit note failed, the hourly job opens it", { return: ref(input.id), reason: safeErrorMessage(error) });
  }
  return { ok: true, id: input.id };
}

class Refused extends Error {}

/** The returns for the admin's sponsor screen, newest first. */
export async function potReturnsFor(sponsorId: string) {
  return db
    .select()
    .from(potReturns)
    .where(eq(potReturns.sponsorId, sponsorId))
    .orderBy(desc(potReturns.createdAt))
    .limit(20);
}
