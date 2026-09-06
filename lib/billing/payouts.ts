import "server-only";

import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  payoutMethods,
  payoutRequestEvents,
  payoutRequests,
  users,
  type Entity,
  type PayoutMethod,
  type PayoutStatus,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

import { quoteFor } from "./fx";
import { heldForTherapist, postManualPayout } from "./ledger";
import { convert, payoutCurrencyFor } from "./money";

/**
 * Manual payouts: the queue three people work, at any hour. PLAN.md 16.2–16.3d.
 *
 * ## 🔴 A payout request is a promise
 *
 * The rule this module exists to keep is 16.3: **nothing may quietly fail.**
 * Every state a request can be in has a timestamp and a person; every
 * transition writes an event; a request that ages raises an alert on a *phone
 * and an email*, not on a dashboard nobody has open at three in the morning
 * (16.3b); and the therapist can watch all of it (16.2). A stuck request is
 * money somebody is owed and cannot see moving, which is how trust is lost
 * even when the money eventually arrives.
 *
 * ## Where the two-person rule really lives
 *
 * In the database (`payout_requests_approver_not_payee`,
 * `payout_requests_approver_not_editor`, `payout_requests_sent_was_approved`).
 * The checks below produce the good error messages; the constraints are what
 * make the rule true. A manual process is where the fraud is (C74), and a rule
 * enforced only by the code path that usually runs is a rule that is one new
 * admin script away from not existing.
 */

export type PayoutQueueRow = {
  id: string;
  therapistId: string;
  therapistName: string;
  amountCents: number;
  payoutAmountMinor: number;
  payoutCurrency: string;
  method: PayoutMethod;
  identifier: string;
  accountName: string;
  status: PayoutStatus;
  entity: Entity;
  requestedAt: Date;
  ownerUserId: string | null;
  ownerName: string | null;
  /** 16.3b — how long this has been somebody's job. */
  ageHours: number;
  overdue: boolean;
  needsTwoPeople: boolean;
  proofUrl: string | null;
};

/* ---------------------------------------------------------- the details -- */

/**
 * Save where a clinician's money goes. 16.2.
 *
 * `editedByUserId` is stamped on every save, including the clinician's own,
 * because C74's rule is about *who last touched the destination* and a
 * clinician editing their own account details is precisely the case the rule
 * is protecting. It is copied onto each request at request time, so approval
 * can be refused by the database rather than by a lookup that might race an
 * edit.
 */
export async function savePayoutMethod(input: {
  therapistId: string;
  organizationId: string;
  method: PayoutMethod;
  identifier: string;
  accountName: string;
  editedByUserId: string;
}): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const identifier = input.identifier.trim();
  const accountName = input.accountName.trim();

  if (identifier.length < 3) return { error: "Enter the account or wallet number." };
  if (accountName.length < 3) {
    return { error: "Enter the full name exactly as it appears on that account." };
  }

  const settings = await getSettings();
  if (input.method !== "stripe" && !settings.payouts.egyptPayoutMethods.includes(input.method)) {
    return { error: "That payout method is not available." };
  }

  // One default per clinician, so "where does their money go" has one answer.
  await db
    .update(payoutMethods)
    .set({ isDefault: false })
    .where(
      and(eq(payoutMethods.therapistId, input.therapistId), isNull(payoutMethods.deletedAt)),
    );

  const [row] = await db
    .insert(payoutMethods)
    .values({
      therapistId: input.therapistId,
      organizationId: input.organizationId,
      method: input.method,
      identifier,
      accountName,
      currency: payoutCurrencyFor(input.method),
      editedByUserId: input.editedByUserId,
      editedAt: new Date(),
      isDefault: true,
    })
    .returning({ id: payoutMethods.id });

  return { ok: true, id: row?.id };
}

export async function defaultMethodFor(therapistId: string) {
  const [row] = await db
    .select()
    .from(payoutMethods)
    .where(
      and(
        eq(payoutMethods.therapistId, therapistId),
        eq(payoutMethods.isDefault, true),
        isNull(payoutMethods.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/* --------------------------------------------------------- the request -- */

/**
 * A clinician asks for money we are holding. 16.2.
 *
 * The amount is checked against the **ledger**, not against a column: a
 * balance that is a `SUM` cannot drift from the entries that produced it,
 * and a balance kept in a column can. Anything above what we hold is refused
 * with the real number, because "insufficient funds" on money somebody earned
 * is an answer that needs to be checkable by the person reading it.
 */
export async function requestPayout(input: {
  therapistId: string;
  organizationId: string;
  amountCents: number;
}): Promise<{ ok?: boolean; error?: string; id?: string }> {
  const held = await heldForTherapist(input.therapistId);
  const amount = Math.floor(input.amountCents);

  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount to withdraw." };
  if (amount > held) {
    return { error: `You can withdraw up to ${(held / 100).toFixed(2)} right now.` };
  }

  const method = await defaultMethodFor(input.therapistId);
  if (!method) return { error: "Add a payout method first — we need to know where to send it." };

  const open = await db
    .select({ id: payoutRequests.id })
    .from(payoutRequests)
    .where(
      and(
        eq(payoutRequests.therapistId, input.therapistId),
        inArray(payoutRequests.status, ["requested", "approved", "sent"]),
      ),
    )
    .limit(1);
  if (open.length > 0) {
    return { error: "You already have a withdrawal in progress. It is on the queue." };
  }

  /*
   * The rate is frozen onto the request here (16.6). What the therapist is
   * told they will receive in EGP is what the queue will pay, whatever the
   * market does between the request and the transfer — and if that is not
   * true any more, it is a decision somebody makes, not a number that
   * silently changed.
   */
  const payoutCurrency = payoutCurrencyFor(method.method);
  const quote = payoutCurrency === "usd" ? null : await quoteFor("usd", payoutCurrency);
  if (payoutCurrency !== "usd" && !quote) {
    return { error: "We cannot price that currency right now. Try again shortly." };
  }

  const payoutAmountMinor = quote ? convert(amount, quote.rateMicro) : amount;
  const entity: Entity = method.method === "stripe" ? "us" : "eg";

  const [row] = await db
    .insert(payoutRequests)
    .values({
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      amountCents: amount,
      payoutAmountMinor,
      payoutCurrency,
      fxRateMicro: quote?.rateMicro ?? null,
      fxQuotedAt: quote?.quotedAt ?? null,
      entity,
      methodId: method.id,
      method: method.method,
      identifier: method.identifier,
      accountName: method.accountName,
      detailsEditedByUserId: method.editedByUserId,
      status: "requested",
    })
    .returning({ id: payoutRequests.id });

  if (row) {
    await db.insert(payoutRequestEvents).values({
      requestId: row.id,
      fromStatus: null,
      toStatus: "requested",
      actorUserId: input.therapistId,
      note: "Requested by the clinician",
    });
  }

  log.info("payout requested", { user: ref(input.therapistId), amount, entity });
  return { ok: true, id: row?.id };
}

/* -------------------------------------------------------- the transitions -- */

async function move(input: {
  requestId: string;
  from: PayoutStatus[];
  to: PayoutStatus;
  actorUserId: string | null;
  note?: string;
  set?: Record<string, unknown>;
}): Promise<{ ok?: boolean; error?: string }> {
  /*
   * The status is part of the WHERE, so two people pressing the same button
   * produce one transition and one loser. A read-then-write here would let a
   * payout be sent twice by two members of a three-person team working the
   * same queue at the same hour, which is the exact shape of a double payment.
   */
  const updated = await db
    .update(payoutRequests)
    .set({ status: input.to, updatedAt: new Date(), ...(input.set ?? {}) })
    .where(
      and(
        eq(payoutRequests.id, input.requestId),
        inArray(payoutRequests.status, input.from),
      ),
    )
    .returning({ id: payoutRequests.id });

  if (updated.length === 0) {
    return { error: "That request has already moved on. Reload the queue." };
  }

  await db.insert(payoutRequestEvents).values({
    requestId: input.requestId,
    fromStatus: input.from[0] ?? null,
    toStatus: input.to,
    actorUserId: input.actorUserId,
    note: input.note ?? null,
  });

  return { ok: true };
}

/**
 * 🔴 16.3d / C74 — approval, and who is allowed to give it.
 *
 * Three refusals, in the order they are worth explaining:
 *
 *   1. Not the clinician being paid. Obvious, and the database agrees.
 *   2. **Not the person who last edited the payout details.** Somebody who
 *      can change the destination account and then approve the transfer to it
 *      needs no accomplice.
 *   3. Above the threshold, a second person must have taken ownership. Below
 *      it, one approver is enough — a $20 wallet transfer does not need two
 *      signatures and a rule that pretends it does is a rule people work
 *      around.
 */
export async function approvePayout(input: {
  requestId: string;
  approverUserId: string;
  note?: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const [row] = await db
    .select()
    .from(payoutRequests)
    .where(eq(payoutRequests.id, input.requestId))
    .limit(1);

  if (!row) return { error: "That request no longer exists." };
  if (row.status !== "requested") return { error: "That request is not waiting for approval." };

  if (row.therapistId === input.approverUserId) {
    return { error: "A clinician cannot approve their own payout." };
  }
  if (row.detailsEditedByUserId && row.detailsEditedByUserId === input.approverUserId) {
    return {
      error:
        "You last edited these payout details, so somebody else has to approve sending money to them.",
    };
  }

  const settings = await getSettings();
  if (
    row.amountCents > settings.payouts.twoPersonThresholdCents &&
    (!row.ownerUserId || row.ownerUserId === input.approverUserId)
  ) {
    return {
      error:
        "Above the two-person threshold a different member of staff must take ownership before this can be approved.",
    };
  }

  return move({
    requestId: input.requestId,
    from: ["requested"],
    to: "approved",
    actorUserId: input.approverUserId,
    note: input.note,
    set: { approvedByUserId: input.approverUserId, approvedAt: new Date() },
  });
}

/**
 * The transfer has been made at the bank. 16.2, 16.3c.
 *
 * This is where the money leaves the books, and it is also where the proof
 * goes on: a screenshot of the transfer, which the therapist sees on their
 * earnings screen. A payout marked sent with nothing to show for it is the
 * state a dispute cannot be settled from.
 */
export async function markPayoutSent(input: {
  requestId: string;
  senderUserId: string;
  proofUrl: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const proof = input.proofUrl.trim();
  if (proof.length < 5) return { error: "Attach the transfer receipt before marking this sent." };

  const [row] = await db
    .select()
    .from(payoutRequests)
    .where(eq(payoutRequests.id, input.requestId))
    .limit(1);

  if (!row) return { error: "That request no longer exists." };
  if (row.status !== "approved") return { error: "Only an approved payout can be sent." };

  const txnId = await postManualPayout({
    requestId: row.id,
    organizationId: row.organizationId,
    therapistId: row.therapistId,
    amountCents: row.amountCents,
    entity: row.entity,
    sentByUserId: input.senderUserId,
  });

  const moved = await move({
    requestId: input.requestId,
    from: ["approved"],
    to: "sent",
    actorUserId: input.senderUserId,
    note: "Transfer made",
    set: {
      sentByUserId: input.senderUserId,
      sentAt: new Date(),
      proofUrl: proof,
      ledgerTxnId: txnId,
    },
  });
  if (moved.error) return moved;

  /*
   * A clinician's number lives in `profile`, not in a column — see
   * `TherapistProfile`. `notify()` sends on every channel it has (13R.12), so
   * a clinician with no number still gets the email and one with a number gets
   * both. Nothing here decides between them.
   */
  const [payee] = await db
    .select({ email: users.email, profile: users.profile, timezone: users.timezone })
    .from(users)
    .where(eq(users.id, row.therapistId))
    .limit(1);

  await notify(
    {
      email: payee?.email ?? null,
      phone: payee?.profile?.phone ?? null,
      timezone: payee?.timezone ?? null,
    },
    {
      kind: "payout.sent",
      subject: "Your withdrawal is on its way",
      body: `We have sent ${(row.payoutAmountMinor / 100).toFixed(2)} ${row.payoutCurrency.toUpperCase()} to ${row.accountName}. The transfer receipt is on your earnings page.`,
    },
  );

  return { ok: true };
}

/** The clinician says it arrived, or the team confirms the bank did. */
export async function confirmPayout(input: {
  requestId: string;
  actorUserId: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  return move({
    requestId: input.requestId,
    from: ["sent"],
    to: "confirmed",
    actorUserId: input.actorUserId,
    note: "Arrival confirmed",
    set: { confirmedAt: new Date() },
  });
}

/**
 * Refused, with a reason the therapist reads.
 *
 * No money has moved at this point, so nothing is reversed — but the reason is
 * mandatory. "Rejected" with no sentence is the failure mode 16.3 is about,
 * one step worse than silence because it looks like an answer.
 */
export async function rejectPayout(input: {
  requestId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 5) return { error: "Say why, so the clinician knows what to fix." };

  const result = await move({
    requestId: input.requestId,
    from: ["requested", "approved"],
    to: "rejected",
    actorUserId: input.actorUserId,
    note: reason,
    set: { rejectedReason: reason },
  });
  if (result.error) return result;

  const [row] = await db
    .select({ email: users.email, profile: users.profile, timezone: users.timezone })
    .from(payoutRequests)
    .innerJoin(users, eq(users.id, payoutRequests.therapistId))
    .where(eq(payoutRequests.id, input.requestId))
    .limit(1);

  if (row) {
    await notify(
      { email: row.email, phone: row.profile?.phone ?? null, timezone: row.timezone },
      {
        kind: "payout.rejected",
        subject: "We could not process your withdrawal",
        body: reason,
      },
    );
  }
  return result;
}

/** 16.3b — a named owner. A request nobody owns is a request nobody works. */
export async function claimPayout(input: {
  requestId: string;
  ownerUserId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const updated = await db
    .update(payoutRequests)
    .set({ ownerUserId: input.ownerUserId, updatedAt: new Date() })
    .where(
      and(
        eq(payoutRequests.id, input.requestId),
        inArray(payoutRequests.status, ["requested", "approved"]),
      ),
    )
    .returning({ id: payoutRequests.id });

  if (updated.length === 0) return { error: "That request is no longer open." };

  await db.insert(payoutRequestEvents).values({
    requestId: input.requestId,
    fromStatus: null,
    toStatus: "requested",
    actorUserId: input.ownerUserId,
    note: "Taken on",
  });
  return { ok: true };
}

/* ------------------------------------------------------------- the queues -- */

/**
 * 16.3a — **two queues, because they are not the same job.**
 *
 * `manual` is work: EGP transfers a person has to make from a bank app.
 * `automated` is a record: Stripe Connect payouts that already happened,
 * listed so the team can see them and never so anybody thinks they must act.
 * Mixing them produces a screen where the real work is buried in noise, and
 * at three in the morning that is the difference between a payout going out
 * and a payout ageing.
 */
export async function manualQueue(): Promise<PayoutQueueRow[]> {
  const settings = await getSettings();
  const owner = sql<string>`owner_user.first_name`;

  const rows = await db
    .select({
      id: payoutRequests.id,
      therapistId: payoutRequests.therapistId,
      firstName: users.firstName,
      lastName: users.lastName,
      amountCents: payoutRequests.amountCents,
      payoutAmountMinor: payoutRequests.payoutAmountMinor,
      payoutCurrency: payoutRequests.payoutCurrency,
      method: payoutRequests.method,
      identifier: payoutRequests.identifier,
      accountName: payoutRequests.accountName,
      status: payoutRequests.status,
      entity: payoutRequests.entity,
      requestedAt: payoutRequests.requestedAt,
      ownerUserId: payoutRequests.ownerUserId,
      proofUrl: payoutRequests.proofUrl,
    })
    .from(payoutRequests)
    .innerJoin(users, eq(users.id, payoutRequests.therapistId))
    .where(inArray(payoutRequests.status, ["requested", "approved", "sent"]))
    .orderBy(asc(payoutRequests.requestedAt))
    .limit(200);

  void owner;
  const now = Date.now();

  return rows.map((row) => {
    const ageHours = (now - row.requestedAt.getTime()) / 3_600_000;
    return {
      id: row.id,
      therapistId: row.therapistId,
      therapistName: [row.firstName, row.lastName].filter(Boolean).join(" "),
      amountCents: row.amountCents,
      payoutAmountMinor: row.payoutAmountMinor,
      payoutCurrency: row.payoutCurrency,
      method: row.method,
      identifier: row.identifier,
      accountName: row.accountName,
      status: row.status,
      entity: row.entity,
      requestedAt: row.requestedAt,
      ownerUserId: row.ownerUserId,
      ownerName: null,
      ageHours: Math.round(ageHours * 10) / 10,
      overdue: ageHours >= settings.payouts.alertAfterHours,
      needsTwoPeople: row.amountCents > settings.payouts.twoPersonThresholdCents,
      proofUrl: row.proofUrl,
    };
  });
}

/** One clinician's own history, for their earnings screen. 16.2, 16.10. */
export async function payoutsForTherapist(therapistId: string, limit = 20) {
  return db
    .select()
    .from(payoutRequests)
    .where(eq(payoutRequests.therapistId, therapistId))
    .orderBy(desc(payoutRequests.requestedAt))
    .limit(limit);
}

/* --------------------------------------------------------------- the alarm -- */

/**
 * 🔴 16.3b — a request that has aged raises an alert **on a phone and an
 * email**, not on a dashboard.
 *
 * Called from the cron. `notify()` sends on every channel it has (13R.12), so
 * "reaches a phone and an email" is a property of that function rather than
 * something this one has to remember — which is the point of there being one
 * alerting path and three callers (16.3b, 20.12, 20.20).
 *
 * `alertedAt` is stamped in the same statement that selects, so a cron that
 * runs twice in a minute does not send twice. Alerting twice is how an alert
 * becomes noise, and noise is how a real one is missed.
 */
export async function alertAgedPayouts(): Promise<{ alerted: number }> {
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.payouts.alertAfterHours * 3_600_000);

  const aged = await db
    .update(payoutRequests)
    .set({ alertedAt: new Date() })
    .where(
      and(
        inArray(payoutRequests.status, ["requested", "approved"]),
        lt(payoutRequests.requestedAt, cutoff),
        isNull(payoutRequests.alertedAt),
      ),
    )
    .returning({
      id: payoutRequests.id,
      therapistId: payoutRequests.therapistId,
      amountCents: payoutRequests.amountCents,
      ownerUserId: payoutRequests.ownerUserId,
    });

  for (const row of aged) {
    const staff = await db
      .select({ email: users.email, profile: users.profile, timezone: users.timezone })
      .from(users)
      .where(eq(users.role, "super_admin"))
      .limit(10);

    for (const person of staff) {
      await notify(
        { email: person.email, phone: person.profile?.phone ?? null, timezone: person.timezone },
        {
          kind: "payout.overdue",
          subject: "A payout has been waiting too long",
          body: `A withdrawal of $${(row.amountCents / 100).toFixed(2)} has been open for more than ${settings.payouts.alertAfterHours} hours.${row.ownerUserId ? "" : " Nobody has taken it on."}`,
        },
      );
    }
  }

  if (aged.length > 0) log.warn("aged payout requests alerted", { count: aged.length });
  return { alerted: aged.length };
}
