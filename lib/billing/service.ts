import "server-only";

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { qualified } from "@/lib/db/qualified";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  aiRequestLogs,
  invoiceLines,
  invoices,
  payableCents,
  sessions,
  subscriptions,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

import { currentTier, getCreditBalance, spendCredit } from "./credits";
import { sessionLines } from "./plans";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/billing/service.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
     * 🔴 46.1 — the consent state decides the AI line and nothing else.
     *
     * Read from the session rather than passed in, so a caller cannot get it
     * wrong and so the reconciler (46.14) reaches the same answer hours later.
     * Anything other than `granted` means no AI fee: declined, withdrawn, and
     * the null of a session that never asked are all "the patient did not turn
     * it on", and treating them alike is what makes this a rule rather than a
     * branch nobody can enumerate.
     */
    const [session] = await db
      .select({ consent: sessions.recordingConsent })
      .from(sessions)
      .where(eq(sessions.id, opts.sessionId))
      .limit(1);

    const aiConsented = session?.consent === "granted";

    /*
     * 🔴 ME20: ONE CHARGER PER SESSION, CLAIMED BEFORE ANY MONEY MOVES.
     *
     * The invoice insert was idempotent and everything before it was not: a
     * completion and the reconciler racing both spent credit, and both could
     * net the fee from held earnings, with one invoice to show for it. The
     * claim is one conditional UPDATE on the session (0171). A claim older
     * than ten minutes with still no invoice is a charger that died part way,
     * and the next one takes it over.
     */
    const [claim] = await db
      .update(sessions)
      .set({ chargeClaimedAt: new Date() })
      .where(
        and(
          eq(sessions.id, opts.sessionId),
          sql`NOT EXISTS (SELECT 1 FROM invoices i WHERE i.session_id = ${opts.sessionId})`,
          sql`(${sessions.chargeClaimedAt} IS NULL
               OR ${sessions.chargeClaimedAt} < now() - interval '10 minutes')`,
        ),
      )
      .returning({ id: sessions.id });
    if (!claim) return null;

    const settings = await getSettings();
    const tier = await currentTier(opts.organizationId);
    const { lines, totalCents } = sessionLines({
      settings,
      tierKey: tier.key,
      aiConsented,
    });

    /*
     * 🔴 The free first session waives the bill; it does not delete the lines.
     *
     * A waived invoice still records what the session WOULD have cost, in both
     * kinds, because "this therapist's first session was free" and "this
     * session had no AI" are different facts and sprint 49 has to be able to
     * tell them apart when it reports the consent rate. A waiver that erased
     * the AI line would make every trial session look like a refusal.
     */
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
        description: "First session, on us",
        lines: lines.map((line) => ({ ...line, amountCents: 0, tierKey: tier.key })),
      });
      return { status: "waived", amountCents: 0 };
    }

    /*
     * Credit first, always.
     *
     * §3: credit is spent before any rate applies, so a therapist who bought
     * $60 and then let it lapse toward pay as you go spends what they paid for
     * before they are charged for anything. The spend is a conditional UPDATE
     * inside `spendCredit`, for the reason given there.
     *
     * 🔴 46.4 — credit is money and covers ANY line, so a partial cover is a
     * real outcome now. $0.60 of credit against a $1 platform fee pays $0.60
     * and bills $0.40. The old model had nothing to split: a credit was one
     * session, and it either covered it or did not.
     *
     * The order relative to the trial above is reversed from what it was, and
     * deliberately. A credit used to be spent in preference to the freebie,
     * which was right when a credit was a session somebody had bought. Now
     * that credit is money, spending real money on a session we had promised
     * to give away is simply taking it.
     */
    const credit = await spendCredit(opts.organizationId, totalCents);
    const outstanding = Math.max(0, totalCents - credit.spentCents);

    if (outstanding === 0) {
      await raiseInvoice({
        organizationId: opts.organizationId,
        kind: "session",
        sessionId: opts.sessionId,
        amountCents: 0,
        status: "included",
        description: "Session · from your credit",
        lines: lines.map((line) => ({ ...line, tierKey: tier.key })),
      });
      return { status: "included", amountCents: 0 };
    }

    /*
     * 🔴 C69 / 16.6a / 46.5 — netting, when we are already holding their money.
     *
     * When we hold enough, the fee comes out of the held balance in one ledger
     * transaction: we owe them less, they owe us nothing new, and no money
     * moves anywhere. Behind `payouts.netFeeFromHeldEarnings` because whether
     * to net is a business decision rather than a technical one.
     */
    if (outstanding > 0) {
      const netted = await netFeeFromEarnings({
        organizationId: opts.organizationId,
        sessionId: opts.sessionId,
        amountCents: outstanding,
        lines: lines.map((line) => ({ ...line, tierKey: tier.key })),
      });
      if (netted) return { status: "netted", amountCents: outstanding };
    }

    await raiseInvoice({
      organizationId: opts.organizationId,
      kind: "session",
      sessionId: opts.sessionId,
      amountCents: outstanding,
      status: "due",
      description: "Completed session",
      lines: lines.map((line) => ({ ...line, tierKey: tier.key })),
    });
    return { status: "due", amountCents: outstanding };
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

/**
 * Take a session fee out of what we are holding for this clinician. C69.
 *
 * Returns false — and changes nothing — when the setting is off, when we hold
 * nothing, or when we hold *less than the fee*. A partial netting would leave
 * a bill for the remainder, which is two charges for one session and a
 * statement nobody can read; the whole fee comes out of earnings or none of it
 * does.
 */
async function netFeeFromEarnings(input: {
  organizationId: string;
  sessionId: string;
  amountCents: number;
  /** 46.13 — a netted bill has the same composition as any other. */
  lines?: { kind: "platform" | "ai"; amountCents: number; tierKey?: string | null }[];
}): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.payouts.netFeeFromHeldEarnings) return false;

  const [session] = await db
    .select({ therapistId: sessions.therapistId })
    .from(sessions)
    .where(eq(sessions.id, input.sessionId))
    .limit(1);
  if (!session?.therapistId) return false;

  /*
   * 🔴 K16b (ME21): FROM THE BOOKS THE MONEY IS ON. This was always posted to
   * `us`, so an Egyptian clinician's fee came off `us` revenue while their
   * earnings sat on `eg`, and the two entities' books stopped agreeing. The
   * fee is netted on the one entity holding enough; none alone, no netting.
   */
  const { heldForTherapistByEntity, postFeeNettedFromHeld } = await import("./ledger");
  const heldBy = await heldForTherapistByEntity(session.therapistId);
  const entity = heldBy.eg >= input.amountCents ? "eg" : heldBy.us >= input.amountCents ? "us" : null;
  if (!entity) return false;

  const netted = await raiseInvoice({
    organizationId: input.organizationId,
    kind: "session",
    sessionId: input.sessionId,
    amountCents: input.amountCents,
    status: "paid",
    description: "Completed session · taken from your earnings",
    postToLedger: false,
    lines: input.lines,
  });
  /* ME20: only the call that wrote this session's invoice nets its fee. */
  if (!netted.id) return true;

  await postFeeNettedFromHeld({
    sessionId: input.sessionId,
    organizationId: input.organizationId,
    therapistId: session.therapistId,
    amountCents: input.amountCents,
    entity,
  });

  return true;
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
  /**
   * False when the caller posts its own transaction. Netting is the one case:
   * the money never arrives as cash, so the ordinary raised-then-paid pair
   * would invent a cash receipt that never happened.
   */
  postToLedger?: boolean;
  /**
   * 🔴 46.13 — what the bill is made of.
   *
   * Written as children of the invoice rather than as separate invoices,
   * because `invoices_session_unique` permits one invoice per session and that
   * index is what stopped a real double charge. See the `invoice_lines`
   * comment in the schema.
   */
  lines?: { kind: "platform" | "ai"; amountCents: number; tierKey?: string | null }[];
  /** K14: spend a waiting seat credit on this bill once it is raised. */
  spendSeatCredit?: boolean;
}): Promise<{ id: string | null; creditCents: number }> {
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
   * 🔴 46.13 — the lines, written only when the invoice was.
   *
   * Guarded on `created` for the same reason the ledger post below is: an
   * empty result means the reconciler and a live completion raced and this one
   * lost, so the invoice already exists and already has its lines. Writing
   * them here anyway is how one session acquires two platform fees.
   *
   * `onConflictDoNothing` on top of that, because the two guards answer
   * different questions: `created` says this call made the invoice, the
   * conflict target says nobody has written this line kind, and 46.14's
   * reconciler relies on the second when it adds a line to an invoice it did
   * not create.
   */
  if (created && input.lines && input.lines.length > 0) {
    await db
      .insert(invoiceLines)
      .values(
        input.lines.map((line) => ({
          invoiceId: created.id,
          kind: line.kind,
          amountCents: line.amountCents,
          tierKey: line.tierKey ?? null,
        })),
      )
      .onConflictDoNothing();
  }

  /*
   * Only a real bill reaches the ledger.
   *
   * `onConflictDoNothing` returns nothing when the reconciler and a live
   * completion race each other, and that empty result is what stops the second
   * one posting a duplicate. Waived and included sessions are zero and post
   * nothing at all — there is no revenue to recognise and no receivable to
   * chase.
   */
  if (created && input.amountCents > 0 && input.postToLedger !== false) {
    const { postInvoiceRaised, postInvoicePaid } = await import("./ledger");
    await postInvoiceRaised({
      id: created.id,
      organizationId: input.organizationId,
      amountCents: input.amountCents,
      description: input.description,
    });
    // A subscription invoice is written already paid, so the receivable it just
    // created is cleared in the same breath.
    if (input.status === "paid") {
      await postInvoicePaid({
        invoiceId: created.id,
        organizationId: input.organizationId,
        amountCents: input.amountCents,
        memo: input.description,
      });
    }
  }

  const creditCents =
    created && input.spendSeatCredit && input.status === "due"
      ? await spendUpcomingDiscount({
          organizationId: input.organizationId,
          invoiceId: created.id,
          amountCents: input.amountCents,
        })
      : 0;
  return { id: created?.id ?? null, creditCents };
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
    const { postInvoiceRaised, postInvoicePaid, postInvoiceWrittenOff } = await import(
      "./ledger"
    );
    const description = opts.description ?? "Unlimited, monthly subscription";
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
    await postInvoicePaid({
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

  /*
   * 🔴 46.7 — this month's spend, split by line item.
   *
   * A single total cannot answer the question a therapist actually has, which
   * is "what is the AI costing me". It also cannot answer the one sprint 49
   * needs, which is what share of sessions patients consented to. Both come
   * off the same two numbers.
   *
   * Read from `invoice_lines` rather than derived from the invoice total,
   * because the total is one number and the composition is the point.
   */
  const [split] = await db
    .select({
      platformCents: sql<number>`COALESCE(SUM(${invoiceLines.amountCents}) FILTER (WHERE ${invoiceLines.kind} = 'platform'), 0)::int`,
      aiCents: sql<number>`COALESCE(SUM(${invoiceLines.amountCents}) FILTER (WHERE ${invoiceLines.kind} = 'ai'), 0)::int`,
    })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
    .where(and(eq(invoices.organizationId, organizationId), gte(invoices.issuedAt, startOfMonth)));

  const { heldForTherapistOrg } = await import("./ledger");
  const heldEarningsCents = await heldForTherapistOrg(organizationId).catch(() => 0);

  return {
    subscription,
    tier,
    tiers: settings.pricing.tiers,
    credits,
    platformFeeCents: settings.session.platformFeeCents,
    sessionsThisMonth: month?.sessionsThisMonth ?? 0,
    spentThisMonthCents: month?.spentCents ?? 0,
    spentPlatformCents: split?.platformCents ?? 0,
    spentAiCents: split?.aiCents ?? 0,
    heldEarningsCents,
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

/**
 * 🔴 46.14 / C251 — the reconciler asks per LINE KIND, not per invoice.
 *
 * It used to ask "has this session an invoice". With one bill per session that
 * was the whole question. With two lines it is the wrong one and fails
 * silently in the direction nobody notices: a session whose platform fee
 * posted and whose AI fee did not **has** an invoice, so it is not an orphan,
 * so it is never looked at again. We would under-bill, indefinitely, and every
 * dashboard would agree that nothing was wrong.
 *
 * So there are two passes, and the second is the new one:
 *
 *   1. A completed session with no invoice at all. The original case.
 *   2. A session invoice whose composition does not match what the session
 *      should have raised. The missing line is added to the invoice that
 *      exists, and `invoice_lines_invoice_kind_unique` makes that idempotent
 *      against a live completion doing the same thing.
 *
 * Pass 2 deliberately does not re-run `chargeForSession`: that would spend
 * credit and claim the free session a second time. It repairs the composition
 * of a bill that has already been decided.
 */
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

  const repaired = await reconcileMissingLines(since);
  return orphans.length + repaired;
}

/**
 * Pass 2: invoices that exist and are missing a line.
 *
 * The platform line is owed by every session invoice, without exception, so a
 * missing one is unambiguous. The AI line is owed only where the patient
 * consented, which is read from the session exactly as `chargeForSession`
 * reads it, so the two cannot drift into disagreeing about what should be
 * there.
 */
async function reconcileMissingLines(since: Date): Promise<number> {
  const rows = await db
    .select({
      invoiceId: invoices.id,
      organizationId: invoices.organizationId,
      status: invoices.status,
      consent: sessions.recordingConsent,
      sessionId: sessions.id,
    })
    .from(invoices)
    .innerJoin(sessions, eq(sessions.id, invoices.sessionId))
    .where(
      and(
        eq(invoices.kind, "session"),
        eq(sessions.status, "completed"),
        gte(sessions.endedAt, since),
      ),
    )
    .limit(100);

  if (rows.length === 0) return 0;

  const existing = await db
    .select({ invoiceId: invoiceLines.invoiceId, kind: invoiceLines.kind })
    .from(invoiceLines)
    .where(
      inArray(
        invoiceLines.invoiceId,
        rows.map((row) => row.invoiceId),
      ),
    );

  const have = new Set(existing.map((line) => `${line.invoiceId}:${line.kind}`));
  let repaired = 0;

  for (const row of rows) {
    const settings = await getSettings();
    const tier = await currentTier(row.organizationId);
    const { lines } = sessionLines({
      settings,
      tierKey: tier.key,
      aiConsented: row.consent === "granted",
    });

    const missing = lines.filter((line) => !have.has(`${row.invoiceId}:${line.kind}`));
    if (missing.length === 0) continue;

    await db
      .insert(invoiceLines)
      .values(
        missing.map((line) => ({
          invoiceId: row.invoiceId,
          kind: line.kind,
          /*
           * A waived or included invoice is composed of zeroes: the bill was
           * already settled, and adding a priced line to it would invent a
           * receivable that nobody owes. What is being repaired is the record
           * of what the session was made of, not the amount.
           */
          amountCents:
            row.status === "waived" || row.status === "included" ? 0 : line.amountCents,
          tierKey: tier.key,
        })),
      )
      .onConflictDoNothing();

    log.warn("invoice line reconciled", {
      session: ref(row.sessionId),
      kinds: missing.map((line) => line.kind).join(","),
    });
    repaired += 1;
  }

  return repaired;
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

/**
 * 🔴 K14: A SEAT CREDIT IS ADDED TO WHAT IS WAITING, NEVER WRITTEN OVER IT.
 *
 * `setUpcomingDiscount` sets the figure, which is right for an administrator
 * stating one. Two seat reductions in a month went through it too, so the
 * second replaced the first and the clinic lost the first credit. One UPDATE,
 * so two reductions racing both land.
 */
export async function addUpcomingDiscount(opts: {
  organizationId: string;
  discountCents: number;
  reason: string;
}): Promise<void> {
  const cents = Math.max(0, Math.round(opts.discountCents));
  if (cents === 0) return;
  await getSubscription(opts.organizationId);
  const reason = opts.reason.trim() || "Credit";
  await db
    .update(subscriptions)
    .set({
      upcomingDiscountCents: sql`${subscriptions.upcomingDiscountCents} + ${cents}`,
      upcomingDiscountReason: sql`left(CASE WHEN ${subscriptions.upcomingDiscountCents} > 0
        AND ${subscriptions.upcomingDiscountReason} IS NOT NULL
        THEN ${subscriptions.upcomingDiscountReason} || '; ' || ${reason}
        ELSE ${reason} END, 500)`,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.organizationId, opts.organizationId));
}

/**
 * 🔴 K14: AND IT IS SPENT ON THE NEXT SEAT BILL.
 *
 * The credit a seat reduction books was consumed only by
 * `recordCreditPurchaseInvoice`, which nothing calls, so it sat on /billing
 * for ever. This takes what is waiting, up to the bill, off a bill just
 * raised: the invoice carries it as a discount, a full cover waives the bill,
 * and the part given is written off in the books as every discount is.
 *
 * The take is one conditional UPDATE reading the balance it changes, so two
 * bills raised at once cannot both spend the same credit.
 */
async function spendUpcomingDiscount(input: {
  organizationId: string;
  invoiceId: string;
  amountCents: number;
}): Promise<number> {
  if (input.amountCents <= 0) return 0;
  const taken = await db.execute(sql`
    WITH before AS (
      SELECT id, upcoming_discount_cents AS had, upcoming_discount_reason AS why
        FROM subscriptions
       WHERE organization_id = ${input.organizationId} AND upcoming_discount_cents > 0
       FOR UPDATE
    )
    UPDATE subscriptions s
       SET upcoming_discount_cents = before.had - LEAST(before.had, ${input.amountCents}),
           upcoming_discount_reason = CASE WHEN before.had > ${input.amountCents} THEN before.why ELSE NULL END,
           updated_at = now()
      FROM before
     WHERE s.id = before.id
    RETURNING LEAST(before.had, ${input.amountCents})::int AS used, before.why AS why`);
  const row = taken.rows[0] as { used: number; why: string | null } | undefined;
  const used = row?.used ?? 0;
  if (used <= 0) return 0;

  await db
    .update(invoices)
    .set({
      discountCents: used,
      discountReason: row?.why ?? "Seat credit",
      status: used >= input.amountCents ? "waived" : "due",
    })
    .where(eq(invoices.id, input.invoiceId));

  const { postInvoiceWrittenOff } = await import("./ledger");
  await postInvoiceWrittenOff({
    invoiceId: input.invoiceId,
    organizationId: input.organizationId,
    amountCents: used,
    memo: row?.why ?? "Seat credit applied",
    adminUserId: null,
  });
  return used;
}

/* ================================================= 74 · the transfer rail == */

/**
 * 🔴 74.3 — AN EGYPTIAN THERAPIST SUBSCRIBES WITHOUT A GATEWAY.
 *
 * ## The hole this closes, which was invisible because it was an absence
 *
 * `entitledTier` reads a paid obligation first and the Stripe mirror second.
 * Obligations were raised in exactly one place: the `invoice.paid` webhook. So
 * a therapist paying by bank transfer had no obligation and no mirror, and
 * `entitledTier` fell through to the tier their lifetime spend had earned —
 * pay as you go — **however much money they sent us.** The rail could settle
 * invoices and could not put anybody on a plan.
 *
 * The comment beside the Stripe call already described the fix: "an Egyptian
 * renewal does not come through here at all: it is an invoice, settling the
 * same obligation with a different `settled_via`." This is that, with an
 * operator in place of the gateway.
 *
 * ## 🔴 IT RAISES A BILL, IT DOES NOT GRANT A PLAN
 *
 * Nothing here makes anybody entitled to anything. It writes a `due` obligation
 * and a `due` invoice, and the plan starts when an operator confirms the money
 * arrived. That is the same rule the whole rail runs on: no optimistic grant,
 * anywhere, because a product that acts on a claim about money can be robbed by
 * typing a plausible reference number.
 *
 * ## 🔴 ONE UNPAID MONTH AT A TIME, WHICH IS ALSO THE IDEMPOTENCY
 *
 * ⚠️ The first version leaned on `renewal_obligations_period_unique` for this
 * and it did nothing, because the period started at `now`: two clicks a
 * millisecond apart are two different periods, so both rows were accepted and
 * the therapist was billed twice. Found by running it, not by reading it.
 *
 * The rule that actually holds is a product rule rather than an index: **you
 * cannot start another month while one is unpaid.** A therapist with a due
 * obligation pays that one; there is no second bill to be confused about, no
 * second transfer for an operator to match, and pressing Subscribe again says
 * so instead of quietly charging again.
 */
export async function subscribeByTransfer(input: {
  organizationId: string;
  tierKey: string;
  now?: Date;
}): Promise<{ ok?: true; error?: string; amountCents?: number }> {
  const settings = await getSettings();
  const tier = settings.pricing.tiers.find((t) => t.key === input.tierKey);

  /*
   * 🔴 Looked up by `find` rather than by `tierByKey`, whose fail-closed
   * fallback returns the free tier for an unknown key. Here that would raise an
   * obligation for $0 and read as a subscription nobody has to pay for.
   */
  if (!tier || tier.monthlyCents <= 0) {
    return { error: "That is not a plan you can subscribe to." };
  }

  const { renewalObligations } = await import("@/lib/db/schema");
  const [outstanding] = await db
    .select({ id: renewalObligations.id })
    .from(renewalObligations)
    .where(
      and(
        eq(renewalObligations.organizationId, input.organizationId),
        /*
         * 🔴 K1: a lapsed month whose bill is still due counts too. Paying that
         * bill now starts the plan (`settleOldestObligationByTransfer`), so a
         * second month beside it would be a second bill for one plan.
         */
        sql`(${renewalObligations.state} = 'due' OR (${renewalObligations.state} = 'lapsed' AND EXISTS (
          SELECT 1 FROM invoices i
           WHERE i.organization_id = ${qualified(renewalObligations.organizationId)}
             AND i.kind = 'subscription'
             AND i.status = 'due'
             AND i.period_start = ${qualified(renewalObligations.periodStart)})))`,
      ),
    )
    .limit(1);

  if (outstanding) {
    return { error: "You already have a month waiting to be paid. Pay that one first." };
  }

  const now = input.now ?? new Date();
  const periodStart = new Date(now);
  const periodEnd = new Date(now);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

  const { raiseObligation } = await import("./obligations");
  const raised = await raiseObligation({
    organizationId: input.organizationId,
    plan: tier.key,
    amountCents: tier.monthlyCents,
    /*
     * 🔴 USD, because that is what the plan costs. The pounds live on the
     * payment row, where 0106 stores them beside what they settle. An
     * obligation denominated in the payer's currency would make "what does this
     * plan cost" a question with a different answer per customer.
     */
    currency: "usd",
    periodStart,
    periodEnd,
    /* Due the day it is raised: the plan does not start until it is paid. */
    dueAt: periodStart,
  });

  if (!raised.id) {
    return { error: "You already have a bill for this month. Pay that one." };
  }

  await raiseInvoice({
    organizationId: input.organizationId,
    kind: "subscription",
    amountCents: tier.monthlyCents,
    status: "due",
    description: `${tier.name}, monthly`,
    periodStart,
    periodEnd,
  });

  return { ok: true, amountCents: tier.monthlyCents };
}

/**
 * 🔴 0160 — THE NEXT MONTH, RAISED FROM A PAID ONE, ON THE TRANSFER RAIL.
 *
 * Stripe renewed a subscription by itself; nothing renewed one here. An
 * Egyptian plan was billed once, when somebody pressed Subscribe, and a
 * clinic's seats only when the count changed, so every practice's second
 * month was free (live walkthrough). This runs in the daily billing job:
 *
 *   - a PAID month ending within `RENEW_DAYS_BEFORE`, whose `auto_renew` is on,
 *     with nothing raised from its end yet, raises the next month: a `due`
 *     obligation and a `due` subscription invoice, due the day the paid month
 *     ends. The reminders (`obligationsDueWithin`) and the lapse after the due
 *     date are the ones a first month already has.
 *   - the price is today's: the plan's monthly figure, or the seat price at the
 *     practice's current seat count when it has seats.
 *   - only on the transfer rail. A practice with a Stripe subscription renews
 *     through Stripe, and raising a month here would bill it twice.
 *
 * Idempotent: `renewal_obligations_period_unique` refuses a second row for the
 * same period, and a period that starts where the paid one ends is the same
 * period however many times the job asks.
 */
export const RENEW_DAYS_BEFORE = 7;

export async function raiseManualRenewals(
  now = new Date(),
  /** One practice only: how a verifier asks without billing everybody else. */
  onlyOrganizationId?: string,
): Promise<{ raised: number }> {
  const { renewalObligations, subscriptions } = await import("@/lib/db/schema");
  const horizon = new Date(now.getTime() + RENEW_DAYS_BEFORE * 86_400_000);
  const ending = await db
    .select({
      organizationId: renewalObligations.organizationId,
      plan: renewalObligations.plan,
      periodEnd: renewalObligations.periodEnd,
    })
    .from(renewalObligations)
    .where(
      and(
        eq(renewalObligations.state, "paid"),
        eq(renewalObligations.autoRenew, true),
        onlyOrganizationId ? eq(renewalObligations.organizationId, onlyOrganizationId) : undefined,
        sql`${renewalObligations.periodEnd} <= ${horizon}`,
        /* A month that ended long ago was let go; renewal does not reach back. */
        sql`${renewalObligations.periodEnd} > ${new Date(now.getTime() - 3 * 86_400_000)}`,
        sql`NOT EXISTS (
          SELECT 1 FROM ${renewalObligations} AS nxt
           WHERE nxt.organization_id = ${renewalObligations.organizationId}
             AND nxt.period_start >= ${renewalObligations.periodEnd} - interval '1 hour'
             AND nxt.state <> 'void')`,
      ),
    )
    .limit(200);

  const settings = await getSettings();
  const { organizationNeedsTransfer } = await import("./manual-entry");
  const { currentSeatBill } = await import("./seats");
  const { raiseObligation } = await import("./obligations");
  let raised = 0;

  for (const month of ending) {
    try {
      if (!(await organizationNeedsTransfer(month.organizationId))) continue;
      const [stripeSub] = await db
        .select({ id: subscriptions.stripeSubscriptionId, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, month.organizationId))
        .limit(1);
      if (stripeSub?.id && stripeSub.status !== "cancelled") continue;

      const tier = settings.pricing.tiers.find((t) => t.key === month.plan && t.monthlyCents > 0);
      if (!tier) continue;
      const seats = await currentSeatBill(month.organizationId);
      const amountCents = seats.seats > 0 ? seats.monthlyCents : tier.monthlyCents;
      if (amountCents <= 0) continue;

      const periodStart = month.periodEnd;
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

      const obligation = await raiseObligation({
        organizationId: month.organizationId,
        plan: tier.key,
        amountCents,
        currency: "usd",
        periodStart,
        periodEnd,
        dueAt: periodStart,
      });
      if (!obligation.id) continue;

      const bill = await raiseInvoice({
        organizationId: month.organizationId,
        kind: "subscription",
        amountCents,
        status: "due",
        description: seats.seats > 0 ? `${tier.name}, ${seats.seats} seats, monthly` : `${tier.name}, monthly`,
        periodStart,
        periodEnd,
        /* K14: a seat credit from last month comes off this one. */
        spendSeatCredit: true,
      });
      /*
       * K14: a credit that covered the whole month paid it; the month is
       * settled rather than left due to lapse over a bill nobody owes.
       */
      if (bill.id && bill.creditCents >= amountCents) {
        const { settleObligation } = await import("./obligations");
        await settleObligation({
          organizationId: month.organizationId,
          periodStart,
          via: "manual",
          ref: bill.id,
        });
      }
      raised += 1;
    } catch (error) {
      log.error("renewal not raised", { organization: ref(month.organizationId), reason: safeErrorMessage(error) });
    }
  }

  if (raised > 0) log.info("manual renewals raised", { raised });
  return { raised };
}

/**
 * 🔴 0160 — Cancel and Resume on the transfer rail. Cancel turns renewal off
 * on the month in force and voids a next month raised but not paid, with its
 * invoice; the plan runs to the end of what was paid. Resume turns it back on,
 * and the next daily run raises the month if it is due.
 */
export async function setManualRenewal(organizationId: string, renew: boolean, now = new Date()): Promise<boolean> {
  const { renewalObligations } = await import("@/lib/db/schema");
  const { obligationCovering } = await import("./obligations");
  const current = await obligationCovering(organizationId, now);
  if (!current || current.state !== "paid") return false;

  await db
    .update(renewalObligations)
    .set({ autoRenew: renew, updatedAt: new Date() })
    .where(
      and(
        eq(renewalObligations.organizationId, organizationId),
        eq(renewalObligations.periodStart, current.periodStart),
      ),
    );

  if (!renew) {
    const voided = await db
      .update(renewalObligations)
      .set({ state: "void", updatedAt: new Date() })
      .where(
        and(
          eq(renewalObligations.organizationId, organizationId),
          eq(renewalObligations.state, "due"),
          sql`${renewalObligations.periodStart} >= ${current.periodEnd}`,
        ),
      )
      .returning({ periodStart: renewalObligations.periodStart });
    for (const month of voided) {
      await db
        .update(invoices)
        .set({ status: "void" })
        .where(
          and(
            eq(invoices.organizationId, organizationId),
            eq(invoices.kind, "subscription"),
            eq(invoices.status, "due"),
            eq(invoices.periodStart, month.periodStart),
          ),
        );
    }
  }
  return true;
}

/**
 * 🔴 74.3 — THE OTHER HALF: a confirmed transfer starts the plan.
 *
 * Called from `grantSubscription` once the invoices are settled. Guarded on
 * `state = 'due'` inside `settleObligation`, so an operator confirming twice
 * settles once and the second call reports that it moved nothing.
 *
 * 🔴 It settles the EARLIEST due obligation rather than the one covering now.
 * A therapist who let a month lapse and then transferred is paying off the
 * month they missed, and settling the current one instead would leave the older
 * row due forever while the dunning sweep chased somebody who had paid.
 */
export async function settleOldestObligationByTransfer(input: {
  organizationId: string;
  ref: string;
  paidAt?: Date;
  /** What the transfer settles, in USD cents. Below the month owed, nothing is granted. */
  settlesCents?: number;
  /**
   * 🔴 K1: the invoices this transfer just paid. When given, only a month whose
   * own subscription invoice is among them is settled, so a transfer that paid
   * session fees and could not cover the plan's invoice does not grant the plan
   * on the strength of its total.
   */
  paidInvoiceIds?: string[];
}): Promise<{ settled: boolean }> {
  const { renewalObligations } = await import("@/lib/db/schema");

  /*
   * 🔴 K1: `due` OR `lapsed`. A plan bought by transfer is due the day it is
   * raised, and a transfer confirmed after the billing run lapsed it cleared
   * the bill and never turned the plan on, because only `due` was looked at.
   * A lapsed month the payer then paid for is a month they bought. `due` is
   * still preferred, oldest first, for the reason above.
   */
  const paidIds = input.paidInvoiceIds;
  const [oldest] = await db
    .select({
      id: renewalObligations.id,
      state: renewalObligations.state,
      periodStart: renewalObligations.periodStart,
      periodEnd: renewalObligations.periodEnd,
      amountCents: renewalObligations.amountCents,
    })
    .from(renewalObligations)
    .where(
      and(
        eq(renewalObligations.organizationId, input.organizationId),
        inArray(renewalObligations.state, ["due", "lapsed"]),
        paidIds === undefined
          ? undefined
          : paidIds.length === 0
            ? sql`false`
            : sql`EXISTS (
                SELECT 1 FROM invoices i
                 WHERE i.organization_id = ${qualified(renewalObligations.organizationId)}
                   AND i.kind = 'subscription'
                   AND i.status = 'paid'
                   AND i.period_start = ${qualified(renewalObligations.periodStart)}
                   AND i.id IN (${sql.join(paidIds.map((id) => sql`${id}::uuid`), sql`, `)}))`,
      ),
    )
    .orderBy(sql`(${renewalObligations.state} = 'due') DESC`, renewalObligations.periodStart)
    .limit(1);

  if (!oldest) return { settled: false };

  /*
   * 🔴 THE MONEY HAS TO COVER THE MONTH, AND NOTHING USED TO CHECK.
   *
   * This marked the oldest due obligation `paid` on the strength of a
   * confirmation existing, never comparing what arrived against what was owed.
   * `settleObligation` takes no amount either, so there was no second line of
   * defence.
   *
   * What that bought, combined with a live payment row whose amount was frozen:
   *
   *   1. A metered therapist finishes a session. A $4 invoice is raised.
   *   2. They press "I have paid". A row opens at $4.
   *   3. Before an operator gets to it, they press Subscribe. An $80
   *      obligation and an $80 invoice are raised.
   *   4. They declare again; the stale $4 row came back.
   *   5. An operator confirms about 200 EGP, the $4 invoice settles, and this
   *      function marked the **$80 obligation paid**.
   *   6. `entitledTier` put them on the Practice tier. Every session fee zero
   *      for a month.
   *
   * $80 a month, repeatable. The amount check is the whole fix, and it belongs
   * here rather than in the caller because every caller would otherwise have to
   * remember it.
   */
  if (input.settlesCents !== undefined && input.settlesCents < oldest.amountCents) {
    log.warn("transfer did not cover the month it was meant to settle", {
      organizationId: ref(input.organizationId),
      sentCents: input.settlesCents,
      owedCents: oldest.amountCents,
    });
    return { settled: false };
  }

  if (oldest.state === "due") {
    const { settleObligation } = await import("./obligations");
    return settleObligation({
      organizationId: input.organizationId,
      periodStart: oldest.periodStart,
      via: "manual",
      ref: input.ref,
      paidAt: input.paidAt,
    });
  }

  /*
   * 🔴 K1: A LAPSED MONTH PAID LATE STARTS WHEN IT IS PAID. Its dates passed
   * while nobody had paid, so settling it where it stood would grant a month
   * that is partly or wholly over. The same length, from the payment; its
   * invoice moves with it so the two still name one period. Guarded on
   * `lapsed` in the WHERE, so a second confirm moves nothing.
   */
  const paidAt = input.paidAt ?? new Date();
  const start = oldest.periodStart < paidAt ? paidAt : oldest.periodStart;
  const end = new Date(start.getTime() + (oldest.periodEnd.getTime() - oldest.periodStart.getTime()));
  const [moved] = await db
    .update(renewalObligations)
    .set({
      state: "paid",
      periodStart: start,
      periodEnd: end,
      paidAt,
      settledVia: "manual",
      settledRef: input.ref,
      updatedAt: new Date(),
    })
    .where(and(eq(renewalObligations.id, oldest.id), eq(renewalObligations.state, "lapsed")))
    .returning({ id: renewalObligations.id });
  if (!moved) return { settled: false };

  await db
    .update(invoices)
    .set({ periodStart: start, periodEnd: end })
    .where(
      and(
        eq(invoices.organizationId, input.organizationId),
        eq(invoices.kind, "subscription"),
        eq(invoices.periodStart, oldest.periodStart),
      ),
    );
  log.info("lapsed renewal obligation settled late", { obligation: ref(moved.id) });
  return { settled: true };
}

/**
 * 🔴 74.4 — THE MID-MONTH SEAT CHANGE, BILLED FOR THE DAYS IT BOUGHT.
 *
 * `seatChange` has computed this figure since sprint 62 and the quote screen
 * has shown it since sprint 62. Nothing ever charged it. A solo therapist
 * becoming a clinic on the 15th read "$89 for the 15 days remaining", agreed,
 * and was billed nothing — so the first month of every upgrade was free and the
 * account only started costing what it said at the next renewal.
 *
 * 🔴 `due`, not `paid`. This is a bill, and how it gets paid is the rail the
 * account is on: a card through `payInvoices`, a bank transfer through the
 * queue. Marking it paid here would invent a receipt for money nobody sent.
 *
 * 🔴 And the description carries the ARITHMETIC, not just the amount. "3 seats
 * from 1, for the 15 days left of this month" is a line somebody can check
 * against the quote they agreed to; "Seat change" is a line they have to ask
 * about.
 */
export async function billSeatProration(input: {
  organizationId: string;
  amountCents: number;
  fromSeats: number;
  toSeats: number;
  daysRemaining: number;
}): Promise<void> {
  if (input.amountCents <= 0) return;

  await raiseInvoice({
    organizationId: input.organizationId,
    kind: "subscription",
    amountCents: input.amountCents,
    status: "due",
    description: `${input.toSeats} seats from ${input.fromSeats}, for the ${input.daysRemaining} days left of this month`,
    /* K14: a credit from an earlier reduction is spent here first. */
    spendSeatCredit: true,
  });
}

/**
 * 🔴 K14: THE MONTHLY SEAT BILL, WHICH NOTHING RAISED.
 *
 * A clinic paid a prorated bill the day it added seats and never again: the
 * only recurring bill on the transfer rail was `raiseManualRenewals`, which
 * needs a paid plan month to renew from, and a clinic that bought seats
 * without a plan has none. So every clinic's seats were free from their
 * second month.
 *
 * The daily billing job calls this. For each practice with seats and no other
 * recurring bill (no plan month still in force or waiting, no running Stripe
 * subscription), it raises one `due` subscription invoice for the calendar
 * month at today's seat price, with any seat credit taken off it.
 *
 *   - Only in the first `SEAT_BILL_DAYS` of the month, so a seat bought on the
 *     25th is paid by its proration and next month's bill, never twice.
 *   - Not when seats were first bought this month: the proration already
 *     charged those days (`seatPeriod` prorates to the month's end).
 *   - A seat whose clinician is still inside a month they paid for themselves
 *     (62.6, `billable_from` after the month starts) is not counted.
 *
 * Idempotent: the month's bill is looked for under a per-practice lock before
 * it is raised, so a second run, or two at once, raises nothing.
 */
export const SEAT_BILL_DAYS = 3;

export async function raiseSeatMonths(
  now = new Date(),
  /** One practice only: how a verifier asks without billing everybody else. */
  onlyOrganizationId?: string,
): Promise<{ raised: number }> {
  const { seatMonth } = await import("./seats");
  const { periodStart, periodEnd } = seatMonth(now);
  if (now.getTime() >= periodStart.getTime() + SEAT_BILL_DAYS * 86_400_000) return { raised: 0 };

  const { organizations } = await import("@/lib/db/schema");
  const candidates = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(
        sql`${organizations.seats} > 0`,
        onlyOrganizationId ? eq(organizations.id, onlyOrganizationId) : undefined,
        sql`NOT EXISTS (
          SELECT 1 FROM renewal_obligations o
           WHERE o.organization_id = ${qualified(organizations.id)}
             AND o.state IN ('due', 'paid')
             AND o.period_end > ${now})`,
        sql`NOT EXISTS (
          SELECT 1 FROM subscriptions s
           WHERE s.organization_id = ${qualified(organizations.id)}
             AND s.stripe_subscription_id IS NOT NULL
             AND s.status <> 'cancelled')`,
      ),
    )
    .limit(500);

  const settings = await getSettings();
  const { seatMonthlyCents } = await import("@/lib/settings/defs");
  let raised = 0;

  for (const org of candidates) {
    try {
      const claimed = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`seat-month:${org.id}`}))`);
        const found = await tx.execute(sql`
          SELECT
            (SELECT seats FROM organizations WHERE id = ${org.id}) AS seats,
            (SELECT count(*)::int FROM clinic_seats
              WHERE organization_id = ${org.id} AND released_at IS NULL
                AND billable_from > ${periodStart.toISOString()}::timestamptz) AS waiting,
            EXISTS (SELECT 1 FROM invoices
                     WHERE organization_id = ${org.id} AND kind = 'subscription'
                       AND status <> 'void'
                       AND period_start = ${periodStart.toISOString()}::timestamptz AND period_end = ${periodEnd.toISOString()}::timestamptz) AS billed,
            EXISTS (SELECT 1 FROM invoices
                     WHERE organization_id = ${org.id} AND kind = 'subscription'
                       AND status <> 'void' AND issued_at >= ${periodStart.toISOString()}::timestamptz
                       AND description LIKE '% seats from 0,%') AS started_this_month`);
        const row = found.rows[0] as
          | { seats: number; waiting: number; billed: boolean; started_this_month: boolean }
          | undefined;
        if (!row || row.billed || row.started_this_month) return null;
        const seats = Math.max(0, Number(row.seats) - Number(row.waiting));
        const amountCents = seatMonthlyCents(seats, settings.pricing.seatBands);
        if (seats === 0 || amountCents <= 0) return null;

        /*
         * The invoice is written inside the lock, so a second run finds it.
         * Its ledger legs and the credit follow outside, as `raiseInvoice`
         * posts them, keyed on the invoice this call made.
         */
        const [invoice] = await tx
          .insert(invoices)
          .values({
            organizationId: org.id,
            kind: "subscription",
            amountCents,
            status: "due",
            description: `Seats, ${seats}, monthly`,
            periodStart,
            periodEnd,
          })
          .returning({ id: invoices.id });
        return invoice ? { id: invoice.id, amountCents, seats } : null;
      });
      if (!claimed) continue;

      const { postInvoiceRaised } = await import("./ledger");
      await postInvoiceRaised({
        id: claimed.id,
        organizationId: org.id,
        amountCents: claimed.amountCents,
        description: `Seats, ${claimed.seats}, monthly`,
      });
      await spendUpcomingDiscount({ organizationId: org.id, invoiceId: claimed.id, amountCents: claimed.amountCents });
      raised += 1;
    } catch (error) {
      log.error("seat month not raised", { organization: ref(org.id), reason: safeErrorMessage(error) });
    }
  }

  if (raised > 0) log.info("seat months raised", { raised });
  return { raised };
}
