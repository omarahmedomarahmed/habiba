import "server-only";

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { aiRequestLogs, invoices, payableCents, sessions, subscriptions } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { consumeCredit, currentTier, getCreditBalance } from "./credits";

export async function getSubscription(organizationId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  if (row) return row;

  // Every organisation has a plan; default to metered rather than nothing.
  const [created] = await db
    .insert(subscriptions)
    .values({ organizationId, plan: "payg", status: "active" })
    .onConflictDoNothing({ target: subscriptions.organizationId })
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);
  return existing!;
}

/**
 * Raise the bill for a completed session.
 *
 * Idempotency is a unique index on `session_id` plus ON CONFLICT DO NOTHING,
 * rather than SELECT-then-INSERT. The old code did the latter with no unique
 * constraint, so the reconciler racing a live completion produced two charges
 * for one session.
 *
 * "First session free" is claimed with a conditional UPDATE that can only
 * succeed once. Reading the flag and then writing it let two simultaneous
 * completions both get waived.
 */
export async function chargeForSession(opts: {
  organizationId: string;
  sessionId: string;
}): Promise<{ status: string; amountCents: number } | null> {
  try {
    await getSubscription(opts.organizationId);

    /*
     * Credits first, always.
     *
     * §3: unused credits are consumed before any rate applies, so a therapist
     * who bought thirty sessions at the Growth rate and then dropped to PAYG
     * spends what they paid for before they are charged $4 for anything. The
     * spend is a conditional UPDATE inside `consumeCredit` — see the comment
     * there for why this is not a read followed by a write.
     *
     * Note the order relative to the free first session below: a credit is
     * spent in preference to the freebie. That is the right way round. The free
     * session exists to remove the risk from a therapist's *first* session, and
     * somebody who has already bought a bundle has plainly cleared that bar;
     * burning their trial on a session they had already paid for would be a
     * gift of nothing.
     */
    const credit = await consumeCredit(opts.organizationId);
    if (credit.spent) {
      await raiseInvoice({
        organizationId: opts.organizationId,
        kind: "session",
        sessionId: opts.sessionId,
        amountCents: 0,
        status: "included",
        description: "Session · from your credits",
      });
      return { status: "included", amountCents: 0 };
    }

    const claimed = await db
      .update(subscriptions)
      .set({ trialSessionUsed: true, updatedAt: new Date() })
      .where(
        and(
          eq(subscriptions.organizationId, opts.organizationId),
          eq(subscriptions.trialSessionUsed, false),
        ),
      )
      .returning({ id: subscriptions.id });

    if (claimed.length > 0) {
      await raiseInvoice({
        organizationId: opts.organizationId,
        kind: "session",
        sessionId: opts.sessionId,
        amountCents: 0,
        status: "waived",
        description: "First session — on us",
      });
      return { status: "waived", amountCents: 0 };
    }

    // No credits and no trial left: their tier's rate, read from
    // `platform_settings` at the moment the session completed. An admin who
    // changes the rate changes what the *next* session bills; this invoice is
    // already a fact.
    const tier = await currentTier(opts.organizationId);
    await raiseInvoice({
      organizationId: opts.organizationId,
      kind: "session",
      sessionId: opts.sessionId,
      amountCents: tier.rateCents,
      status: "due",
      description: "Completed session",
    });
    return { status: "due", amountCents: tier.rateCents };
  } catch (error) {
    // Billing must never block a clinician finishing a session. The reconciler
    // picks up anything missed.
    log.error("session charge failed", {
      session: ref(opts.sessionId),
      reason: safeErrorMessage(error),
    });
    return null;
  }
}

async function raiseInvoice(input: {
  organizationId: string;
  kind: "session" | "subscription";
  sessionId?: string | null;
  amountCents: number;
  status: "waived" | "included" | "due" | "paid";
  description: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  stripePaymentIntentId?: string | null;
}) {
  const [created] = await db
    .insert(invoices)
    .values({
      organizationId: input.organizationId,
      kind: input.kind,
      sessionId: input.sessionId ?? null,
      amountCents: input.amountCents,
      status: input.status,
      description: input.description,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      paidAt: input.status === "paid" ? new Date() : null,
    })
    .onConflictDoNothing({ target: invoices.sessionId })
    .returning({ id: invoices.id });

  /*
   * Only a real bill reaches the ledger.
   *
   * `onConflictDoNothing` returns nothing when the reconciler and a live
   * completion race each other, and that empty result is what stops the second
   * one posting a duplicate. Waived and included sessions are zero and post
   * nothing at all — there is no revenue to recognise and no receivable to
   * chase.
   */
  if (created && input.amountCents > 0) {
    const { postInvoiceRaised, postInvoicePaidByCard } = await import("./ledger");
    await postInvoiceRaised({
      id: created.id,
      organizationId: input.organizationId,
      amountCents: input.amountCents,
      description: input.description,
    });
    // A subscription invoice is written already paid, so the receivable it just
    // created is cleared in the same breath.
    if (input.status === "paid") {
      await postInvoicePaidByCard({
        invoiceId: created.id,
        organizationId: input.organizationId,
        amountCents: input.amountCents,
        memo: input.description,
      });
    }
  }
}

/**
 * Record a credit purchase as an invoice.
 *
 * This closes the gap that once made a therapist pay $99 for a subscription and
 * see nothing: money left their account and the product had no row for it. The
 * product being bought has changed — sessions in advance rather than a monthly
 * plan — and the requirement has not. Any standing admin discount is consumed
 * here, once.
 *
 * The invoice kind is still `subscription`, which is now a misnomer for
 * "something other than a completed session". Renaming it means migrating
 * `invoices.kind` across every historical row and every reader, for a label; it
 * is recorded in §2 instead and left for the admin sprint.
 */
export async function recordCreditPurchaseInvoice(opts: {
  organizationId: string;
  amountCents: number;
  /** Sessions bought, for the line the therapist reads on the invoice. */
  quantity: number;
  stripePaymentIntentId?: string | null;
  description?: string;
}): Promise<void> {
  const subscription = await getSubscription(opts.organizationId);
  const discount = Math.min(subscription.upcomingDiscountCents, opts.amountCents);

  const [created] = await db
    .insert(invoices)
    .values({
      organizationId: opts.organizationId,
      kind: "subscription",
      amountCents: opts.amountCents,
      discountCents: discount,
      discountReason: discount > 0 ? subscription.upcomingDiscountReason : null,
      status: "paid",
      description:
        opts.description ?? `${opts.quantity} session credits`,
      periodStart: null,
      periodEnd: null,
      stripePaymentIntentId: opts.stripePaymentIntentId ?? null,
      paidAt: new Date(),
    })
    .returning({ id: invoices.id });

  if (created && discount > 0) {
    await db
      .update(subscriptions)
      .set({ upcomingDiscountCents: 0, upcomingDiscountReason: null, updatedAt: new Date() })
      .where(eq(subscriptions.organizationId, opts.organizationId));
  }

  if (created) {
    const { postInvoiceRaised, postInvoicePaidByCard, postInvoiceWrittenOff } = await import(
      "./ledger"
    );
    const description = opts.description ?? "Unlimited — monthly subscription";
    await postInvoiceRaised({
      id: created.id,
      organizationId: opts.organizationId,
      amountCents: opts.amountCents,
      description,
    });
    // The discount is the part of the bill we chose not to collect, so it
    // leaves the books as an expense rather than never having been revenue —
    // which is what makes "how much did we give away this month" answerable.
    if (discount > 0) {
      await postInvoiceWrittenOff({
        invoiceId: created.id,
        organizationId: opts.organizationId,
        amountCents: discount,
        memo: subscription.upcomingDiscountReason ?? "Credit applied",
        adminUserId: null,
      });
    }
    await postInvoicePaidByCard({
      invoiceId: created.id,
      organizationId: opts.organizationId,
      amountCents: opts.amountCents - discount,
      memo: description,
    });
  }
}

/**
 * What each billed session actually involved.
 *
 * "Completed session · $6" is a line item, not an explanation, and a clinician
 * looking at eleven of them has no way to tell a fifty-minute session apart
 * from a two-minute one that disconnected. This is the work behind the number:
 * minutes transcribed, whether a note was written, how many copilot questions
 * were asked afterwards.
 *
 * Deliberately the *work*, not our cost. What we pay a model is our business
 * and putting it on a customer's bill invites an argument about margin instead
 * of the question the breakdown is there to answer, which is "what did I get
 * for this". Administrators see the cost side; see `lib/data/admin.ts`.
 *
 * One grouped query for the whole page rather than one per invoice — a billing
 * page with sixty rows would otherwise be sixty round trips.
 */
export type SessionUsage = {
  transcribedSeconds: number;
  noteWritten: boolean;
  copilotQuestions: number;
  riskScans: number;
  translated: boolean;
};

export async function usageBySession(
  organizationId: string,
  sessionIds: string[],
): Promise<Map<string, SessionUsage>> {
  const found = new Map<string, SessionUsage>();
  if (sessionIds.length === 0) return found;

  const rows = await db
    .select({
      sessionId: aiRequestLogs.sessionId,
      kind: aiRequestLogs.kind,
      calls: sql<number>`COUNT(*)::int`,
      audioSeconds: sql<number>`COALESCE(SUM(${aiRequestLogs.audioSeconds}), 0)::int`,
    })
    .from(aiRequestLogs)
    .where(
      and(
        eq(aiRequestLogs.organizationId, organizationId),
        inArray(aiRequestLogs.sessionId, sessionIds),
        eq(aiRequestLogs.status, "success"),
      ),
    )
    .groupBy(aiRequestLogs.sessionId, aiRequestLogs.kind);

  for (const row of rows) {
    if (!row.sessionId) continue;
    const usage =
      found.get(row.sessionId) ??
      ({
        transcribedSeconds: 0,
        noteWritten: false,
        copilotQuestions: 0,
        riskScans: 0,
        translated: false,
      } satisfies SessionUsage);

    if (row.kind === "transcribe") usage.transcribedSeconds += row.audioSeconds;
    if (row.kind === "note") usage.noteWritten = true;
    if (row.kind === "translate") usage.translated = true;
    if (row.kind === "risk") usage.riskScans += row.calls;
    // Both sides of the copilot count: a question the clinician asked and a
    // question the patient asked cost the same and are the same feature.
    if (row.kind === "copilot" || row.kind === "patient_copilot") {
      usage.copilotQuestions += row.calls;
    }

    found.set(row.sessionId, usage);
  }

  return found;
}

export async function listInvoices(organizationId: string, limit = 100) {
  return db
    .select()
    .from(invoices)
    .where(eq(invoices.organizationId, organizationId))
    .orderBy(desc(invoices.issuedAt))
    .limit(limit);
}

export async function getDueInvoices(organizationId: string) {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.status, "due")))
    .orderBy(desc(invoices.issuedAt));
}

export async function billingSummary(organizationId: string) {
  const subscription = await getSubscription(organizationId);
  const [settings, tier, credits] = await Promise.all([
    getSettings(),
    currentTier(organizationId),
    getCreditBalance(organizationId),
  ]);

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [month] = await db
    .select({
      sessionsThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${invoices.kind} = 'session')::int`,
      spentCents: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amountCents} - ${invoices.discountCents} ELSE 0 END), 0)::int`,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), gte(invoices.issuedAt, startOfMonth)));

  const [outstanding] = await db
    .select({
      dueCents: sql<number>`COALESCE(SUM(${invoices.amountCents} - ${invoices.discountCents}), 0)::int`,
      dueCount: sql<number>`COUNT(*)::int`,
    })
    .from(invoices)
    .where(and(eq(invoices.organizationId, organizationId), eq(invoices.status, "due")));

  return {
    subscription,
    tier,
    tiers: settings.pricing.tiers,
    credits,
    sessionsThisMonth: month?.sessionsThisMonth ?? 0,
    spentThisMonthCents: month?.spentCents ?? 0,
    outstandingCents: outstanding?.dueCents ?? 0,
    outstandingCount: outstanding?.dueCount ?? 0,
  };
}

/** Total payable for a set of invoices, after discounts. Server-side only. */
export async function sumPayable(
  organizationId: string,
  invoiceIds: string[],
): Promise<{ totalCents: number; rows: (typeof invoices.$inferSelect)[] }> {
  if (invoiceIds.length === 0) return { totalCents: 0, rows: [] };

  const rows = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.status, "due"),
        inArray(invoices.id, invoiceIds),
      ),
    );

  // The amount is computed here from stored rows, never accepted from the
  // client. The old patient-payment endpoint took `price_cents` from the
  // request body.
  const totalCents = rows.reduce((sum, row) => sum + payableCents(row), 0);
  return { totalCents, rows };
}

export async function reconcileMissingCharges(): Promise<number> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const orphans = await db
    .select({ id: sessions.id, organizationId: sessions.organizationId })
    .from(sessions)
    .leftJoin(invoices, eq(invoices.sessionId, sessions.id))
    .where(
      and(eq(sessions.status, "completed"), gte(sessions.endedAt, since), isNull(invoices.id)),
    )
    .limit(100);

  for (const orphan of orphans) {
    await chargeForSession({ organizationId: orphan.organizationId, sessionId: orphan.id });
  }

  return orphans.length;
}

/* ------------------------------------------------------------------ admin -- */

export async function discountInvoice(opts: {
  invoiceId: string;
  discountCents: number;
  reason: string;
  adminUserId: string;
}): Promise<{ error?: string }> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, opts.invoiceId))
    .limit(1);

  if (!invoice) return { error: "Invoice not found." };
  if (invoice.status === "paid") return { error: "That invoice is already paid." };

  // Clamped rather than trusted: a discount larger than the bill would make the
  // payable total negative and the ledger meaningless.
  const discount = Math.max(0, Math.min(opts.discountCents, invoice.amountCents));

  await db
    .update(invoices)
    .set({
      discountCents: discount,
      discountReason: opts.reason.trim() || null,
      discountedBy: opts.adminUserId,
      // A full discount settles the bill rather than leaving a £0 invoice due.
      status: discount >= invoice.amountCents ? "waived" : invoice.status,
    })
    .where(eq(invoices.id, opts.invoiceId));

  /*
   * Money given away is an expense, not revenue that never existed.
   *
   * The difference matters at exactly the moment somebody asks how much the
   * platform is discounting and why. Only the *increase* is posted, so raising
   * a discount from $2 to $5 writes off $3 rather than $5 a second time.
   */
  const increase = discount - invoice.discountCents;
  if (increase > 0) {
    const { postInvoiceWrittenOff } = await import("./ledger");
    await postInvoiceWrittenOff({
      invoiceId: invoice.id,
      organizationId: invoice.organizationId,
      amountCents: increase,
      memo: opts.reason.trim() || "Discount applied by an administrator",
      adminUserId: opts.adminUserId,
    });
  }

  return {};
}

export async function setUpcomingDiscount(opts: {
  organizationId: string;
  discountCents: number;
  reason: string;
}): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      upcomingDiscountCents: Math.max(0, opts.discountCents),
      upcomingDiscountReason: opts.reason.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, opts.organizationId));
}
