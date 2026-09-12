import "server-only";

import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
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

  const { heldForTherapist, postFeeNettedFromHeld } = await import("./ledger");
  const held = await heldForTherapist(session.therapistId);
  if (held < input.amountCents) return false;

  await raiseInvoice({
    organizationId: input.organizationId,
    kind: "session",
    sessionId: input.sessionId,
    amountCents: input.amountCents,
    status: "paid",
    description: "Completed session · taken from your earnings",
    postToLedger: false,
    lines: input.lines,
  });

  await postFeeNettedFromHeld({
    sessionId: input.sessionId,
    organizationId: input.organizationId,
    therapistId: session.therapistId,
    amountCents: input.amountCents,
    entity: "us",
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
