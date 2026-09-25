import "server-only";

import { and, desc, eq, ne, sql } from "drizzle-orm";

/* Operator records about money, on the control plane like the transfer queue. */
import { controlDb as db } from "@/lib/db";
import { pendingApprovals, users, type PendingApprovalKind } from "@/lib/db/schema";

/**
 * 🔴 0161 / ruling 13c — THE TWO ACTS THAT KEEP TWO PEOPLE.
 *
 * Confirming a transfer nobody can prove, and moving a number in the books by
 * hand, each create money from nothing when one person does them alone. So
 * while their switch is on (the default), the first person writes the whole
 * act down with a reason, and a different person carries out exactly that act,
 * from the stored payload rather than from a form, or declines it.
 *
 * The database holds the line as well: `pending_approvals_two_people` refuses a
 * decision by the person who asked, and `pending_approvals_one_open` refuses a
 * second open request for the same thing.
 */

export type ApprovalGate<P> =
  | { go: true; approvalId: string | null; payload: P; reason: string; askedBy: string | null }
  | { go: false; message: string };

export async function secondPersonGate<P extends Record<string, unknown>>(input: {
  kind: PendingApprovalKind;
  subjectId: string;
  payload: P;
  reason: string;
  actorUserId: string;
  /** From `settings.rules.approvals`. Off, the act goes ahead at once. */
  enabled: boolean;
}): Promise<ApprovalGate<P>> {
  if (!input.enabled) {
    return { go: true, approvalId: null, payload: input.payload, reason: input.reason, askedBy: null };
  }

  const [open] = await db
    .select()
    .from(pendingApprovals)
    .where(
      and(
        eq(pendingApprovals.kind, input.kind),
        eq(pendingApprovals.subjectId, input.subjectId),
        eq(pendingApprovals.state, "asked"),
      ),
    )
    .limit(1);

  if (!open) {
    await db
      .insert(pendingApprovals)
      .values({
        kind: input.kind,
        subjectId: input.subjectId,
        payload: input.payload,
        reason: input.reason.trim().slice(0, 500),
        askedBy: input.actorUserId,
      })
      .onConflictDoNothing();
    return { go: false, message: "Asked. A second person completes it from the list of approvals." };
  }

  if (open.askedBy === input.actorUserId) {
    return { go: false, message: "You asked for this one. A second person completes it." };
  }

  return {
    go: true,
    approvalId: open.id,
    payload: open.payload as P,
    reason: open.reason,
    askedBy: open.askedBy,
  };
}

/** Close a request once its act has happened, or decline it. Only once, never by the asker. */
export async function closeApproval(input: {
  approvalId: string;
  decidedBy: string;
  state: "done" | "declined";
}): Promise<boolean> {
  const closed = await db
    .update(pendingApprovals)
    .set({ state: input.state, decidedBy: input.decidedBy, decidedAt: new Date() })
    .where(
      and(
        eq(pendingApprovals.id, input.approvalId),
        eq(pendingApprovals.state, "asked"),
        ne(pendingApprovals.askedBy, input.decidedBy),
      ),
    )
    .returning({ id: pendingApprovals.id });
  return closed.length > 0;
}

/**
 * 🔴 K4 (0171): a request whose subject is gone is closed as `void`, by nobody.
 *
 * A "credit without proof" request names an open cart. When the payer cancels
 * it, an operator discards it or retention expires it, there is nothing left
 * to credit, and Complete used to fail on it for ever while the request sat
 * open at the top of the transfers screen. `void` needs no decider, because
 * no person decided: the thing it asked about stopped existing.
 */
export async function voidApprovalsFor(kind: PendingApprovalKind, subjectIds: string[]): Promise<number> {
  if (subjectIds.length === 0) return 0;
  const { inArray } = await import("drizzle-orm");
  const voided = await db
    .update(pendingApprovals)
    .set({ state: "void", decidedAt: new Date() })
    .where(
      and(
        eq(pendingApprovals.kind, kind),
        eq(pendingApprovals.state, "asked"),
        inArray(pendingApprovals.subjectId, subjectIds),
      ),
    )
    .returning({ id: pendingApprovals.id });
  return voided.length;
}

export type PendingApprovalRow = {
  id: string;
  kind: PendingApprovalKind;
  subjectId: string;
  payload: Record<string, unknown>;
  reason: string;
  askedBy: string;
  askedByName: string | null;
  askedAt: Date;
};

/** What is waiting for a second person, newest first. */
async function openApprovals(kind?: PendingApprovalKind): Promise<PendingApprovalRow[]> {
  const rows = await db
    .select({
      id: pendingApprovals.id,
      kind: pendingApprovals.kind,
      subjectId: pendingApprovals.subjectId,
      payload: pendingApprovals.payload,
      reason: pendingApprovals.reason,
      askedBy: pendingApprovals.askedBy,
      askedByName: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}`,
      askedAt: pendingApprovals.askedAt,
    })
    .from(pendingApprovals)
    .leftJoin(users, eq(users.id, pendingApprovals.askedBy))
    .where(
      kind
        ? and(eq(pendingApprovals.state, "asked"), eq(pendingApprovals.kind, kind))
        : eq(pendingApprovals.state, "asked"),
    )
    .orderBy(desc(pendingApprovals.askedAt))
    .limit(100);
  return rows;
}

export async function approvalById(id: string) {
  const [row] = await db.select().from(pendingApprovals).where(eq(pendingApprovals.id, id)).limit(1);
  return row ?? null;
}

/**
 * The rows the approvals list shows, one line each, for this reader. `mine`
 * hides Complete from the person who asked, which the database refuses anyway.
 */
export async function approvalViews(kind: PendingApprovalKind, readerUserId: string) {
  const { inArray } = await import("drizzle-orm");
  const { manualPayments } = await import("@/lib/db/schema");
  const rows = await openApprovals(kind);
  const paymentIds = kind === "transfer_without_proof" ? rows.map((r) => r.subjectId) : [];
  const payments =
    paymentIds.length > 0
      ? await db
          .select({ id: manualPayments.id, amountCents: manualPayments.amountCents, currency: manualPayments.currency })
          .from(manualPayments)
          .where(inArray(manualPayments.id, paymentIds))
      : [];
  const money = (minor: number, currency: string) =>
    `${currency.toUpperCase()} ${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return rows.map((r) => {
    const payment = payments.find((p) => p.id === r.subjectId);
    const what =
      kind === "transfer_without_proof"
        ? payment
          ? money(payment.amountCents, payment.currency)
          : r.subjectId.slice(0, 8)
        : kind === "owner_invite"
          ? `${String(r.payload.firstName ?? "")} ${String(r.payload.lastName ?? "")} ${String(r.payload.email ?? "")}`.trim()
          : `${String(r.payload.account ?? "")} ${money(Number(r.payload.amountCents ?? 0), "USD")}`;
    return {
      id: r.id,
      kind: r.kind,
      what,
      reason: r.reason,
      askedByName: r.askedByName?.trim() || "Another admin",
      mine: r.askedBy === readerUserId,
    };
  });
}

/**
 * 🔴 0161 — THE COMPENSATING CONTROL FOR RULING 13.
 *
 * With two-person approval off for payouts, top-ups, verifications and money
 * back to companies, one person can move money alone. That is the founder's
 * choice, and this is what keeps it visible: once a day, every super admin is
 * told each such act of the last 24 hours, with who did it. Nothing is sent on
 * a day with nothing to say.
 */
export async function sendOneHandDigest(now = new Date()): Promise<{ lines: number }> {
  const { and, gte, isNotNull, sql: raw } = await import("drizzle-orm");
  const { manualPayments, payoutRequests, potReturns, therapistVerifications } = await import("@/lib/db/schema");
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const name = async (id: string | null) => {
    if (!id) return "someone";
    const [u] = await db.select({ f: users.firstName, l: users.lastName }).from(users).where(eq(users.id, id)).limit(1);
    return u ? `${u.f} ${u.l}` : "someone";
  };
  const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const lines: string[] = [];

  const payouts = await db
    .select({ amount: payoutRequests.amountCents, by: payoutRequests.sentByUserId })
    .from(payoutRequests)
    .where(
      and(
        gte(payoutRequests.sentAt, since),
        isNotNull(payoutRequests.sentByUserId),
        raw`${payoutRequests.sentByUserId} = ${payoutRequests.approvedByUserId}`,
      ),
    );
  for (const p of payouts) lines.push(`Payout of ${usd(p.amount)} approved and sent by ${await name(p.by)}`);

  const transfers = await db
    .select({ amount: manualPayments.amountCents, currency: manualPayments.currency, by: manualPayments.decidedBy })
    .from(manualPayments)
    .where(and(gte(manualPayments.decidedAt, since), eq(manualPayments.state, "confirmed")));
  for (const t of transfers) {
    lines.push(`Transfer of ${t.currency} ${(t.amount / 100).toFixed(2)} confirmed by ${await name(t.by)}`);
  }

  const returns = await db
    .select({ net: potReturns.netCents, by: potReturns.decidedBy })
    .from(potReturns)
    .where(
      and(
        gte(potReturns.decidedAt, since),
        eq(potReturns.state, "sent"),
        raw`${potReturns.decidedBy} = ${potReturns.requestedBy}`,
      ),
    );
  for (const r of returns) lines.push(`Money back to a company, ${usd(r.net)}, asked and sent by ${await name(r.by)}`);

  const verified = await db
    .select({ state: therapistVerifications.state, by: therapistVerifications.reviewedBy })
    .from(therapistVerifications)
    .where(gte(therapistVerifications.reviewedAt, since));
  for (const v of verified) lines.push(`Verification ${v.state} by ${await name(v.by)}`);

  if (lines.length === 0) return { lines: 0 };

  /*
   * 🔴 K26 (ME48): ONCE A DAY, however often the billing job runs. Everything
   * else in that job does nothing the second time; this sent the whole digest
   * again. Claimed in `ops_alerts` (the watchdog's once-a-day table) before
   * anything is sent, so two runs at once send one.
   */
  const { opsAlerts } = await import("@/lib/db/schema");
  const [claimed] = await db
    .insert(opsAlerts)
    .values({ key: "digest:one-hand", day: now.toISOString().slice(0, 10) })
    .onConflictDoNothing()
    .returning({ key: opsAlerts.key });
  if (!claimed) return { lines: 0 };

  const { notify } = await import("@/lib/notify");
  const founders = await db
    .select({ email: users.email, profile: users.profile, timezone: users.timezone })
    .from(users)
    .where(eq(users.role, "super_admin"))
    .limit(10);
  for (const person of founders) {
    await notify(
      { email: person.email, phone: person.profile?.phone ?? null, timezone: person.timezone },
      {
        kind: "ops.oneHandDigest",
        subject: `${lines.length} money actions by one person in the last day`,
        body: lines.slice(0, 60).join("\n"),
      },
    );
  }
  return { lines: lines.length };
}
