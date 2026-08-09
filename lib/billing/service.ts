import "server-only";

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessionCharges, sessions, subscriptions } from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getPlan } from "./plans";

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
 * Charge for a completed session.
 *
 * Idempotency is a unique index on `session_id` plus ON CONFLICT DO NOTHING,
 * rather than SELECT-then-INSERT. The old code did the latter with no unique
 * constraint, so the ten-minute reconciler racing a live completion produced
 * two charge rows for one session.
 *
 * "First session free" is claimed with a conditional UPDATE that only succeeds
 * once. The old version read the flag, branched, then wrote — so two sessions
 * completing at the same moment both got waived.
 */
export async function chargeForSession(opts: {
  organizationId: string;
  sessionId: string;
}): Promise<{ status: string; amountCents: number } | null> {
  try {
    const subscription = await getSubscription(opts.organizationId);
    const plan = getPlan(subscription.plan);

    if (plan.perSessionCents === null) {
      await recordCharge({
        organizationId: opts.organizationId,
        sessionId: opts.sessionId,
        amountCents: 0,
        status: "included",
        description: `Included in ${plan.name}`,
      });
      return { status: "included", amountCents: 0 };
    }

    // Atomic claim of the one free session.
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
      await recordCharge({
        organizationId: opts.organizationId,
        sessionId: opts.sessionId,
        amountCents: 0,
        status: "waived",
        description: "First session — on us",
      });
      return { status: "waived", amountCents: 0 };
    }

    await recordCharge({
      organizationId: opts.organizationId,
      sessionId: opts.sessionId,
      amountCents: plan.perSessionCents,
      status: "pending",
      description: "Completed session",
    });
    return { status: "pending", amountCents: plan.perSessionCents };
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

async function recordCharge(input: {
  organizationId: string;
  sessionId: string;
  amountCents: number;
  status: "waived" | "included" | "pending";
  description: string;
}) {
  await db
    .insert(sessionCharges)
    .values({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      amountCents: input.amountCents,
      status: input.status,
      description: input.description,
    })
    .onConflictDoNothing({ target: sessionCharges.sessionId });
}

export async function listCharges(organizationId: string, limit = 50) {
  return db
    .select()
    .from(sessionCharges)
    .where(eq(sessionCharges.organizationId, organizationId))
    .orderBy(desc(sessionCharges.chargedAt))
    .limit(limit);
}

export async function billingSummary(organizationId: string) {
  const subscription = await getSubscription(organizationId);
  const plan = getPlan(subscription.plan);

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [usage] = await db
    .select({
      sessionsThisMonth: sql<number>`count(*)::int`,
      outstandingCents: sql<number>`COALESCE(SUM(CASE WHEN ${sessionCharges.status} = 'pending' THEN ${sessionCharges.amountCents} ELSE 0 END), 0)::int`,
    })
    .from(sessionCharges)
    .where(
      and(
        eq(sessionCharges.organizationId, organizationId),
        gte(sessionCharges.chargedAt, startOfMonth),
      ),
    );

  return {
    subscription,
    plan,
    sessionsThisMonth: usage?.sessionsThisMonth ?? 0,
    outstandingCents: usage?.outstandingCents ?? 0,
  };
}

/**
 * Find completed sessions in the last 48 hours that never produced a charge
 * row and charge them. Runs on a schedule; safe to run concurrently with a live
 * completion because of the unique index.
 */
export async function reconcileMissingCharges(): Promise<number> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

  const orphans = await db
    .select({ id: sessions.id, organizationId: sessions.organizationId })
    .from(sessions)
    .leftJoin(sessionCharges, eq(sessionCharges.sessionId, sessions.id))
    .where(
      and(
        eq(sessions.status, "completed"),
        gte(sessions.endedAt, since),
        isNull(sessionCharges.id),
      ),
    )
    .limit(100);

  for (const orphan of orphans) {
    await chargeForSession({
      organizationId: orphan.organizationId,
      sessionId: orphan.id,
    });
  }

  return orphans.length;
}
