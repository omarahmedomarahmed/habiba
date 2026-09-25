import "server-only";

import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import {
  BACK_OFFICE_ROLES,
  payoutMethods,
  payoutRequestEvents,
  payoutRequests,
  users,
  type Entity,
  type PayoutMethod,
  type PayoutRequest,
  type PayoutStatus,
} from "@/lib/db/schema";
import type { MessageKey } from "@/lib/i18n/messages";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { getSettings } from "@/lib/settings";

import { fourEyesProblem } from "./four-eyes";
import { quoteFor } from "./fx";
import {
  heldForTherapist,
  postManualPayout,
  postManualPayoutReturned,
  type LedgerExecutor,
} from "./ledger";
import { convert, payoutCurrencyFor } from "./money";
import { plausibleTransferReceipt } from "./transfer-receipt";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/billing/payouts.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /** 64.1: the payouts provider's side, when one is sending it. */
  providerState: "sending" | "sent" | "failed" | null;
  providerError: string | null;
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
    const { moneyText } = await import("@/lib/money/text");
    return { error: `You can withdraw up to ${await moneyText(held)} right now.` };
  }

  const method = await defaultMethodFor(input.therapistId);
  if (!method) return { error: "Add a payout method first. We need to know where to send it." };

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
  /*
   * 🔴 THE OPERATOR'S RATE, like every other Egyptian payment. This asked
   * `quoteFor`, which refuses a static rate in production and has no provider
   * behind it, so on the live deployment an Egyptian clinician could not
   * withdraw at all. The rate is frozen onto the request either way.
   */
  const payoutCurrency = payoutCurrencyFor(method.method);
  const { egpRateMicro } = await import("./manual");
  const operatorRate = payoutCurrency === "egp" ? await egpRateMicro() : 0;
  const quote =
    payoutCurrency === "usd"
      ? null
      : payoutCurrency === "egp" && operatorRate > 0
        ? { rateMicro: operatorRate, quotedAt: new Date() }
        : await quoteFor("usd", payoutCurrency);
  if (payoutCurrency !== "usd" && !quote) {
    return { error: "We cannot price that currency right now. Try again shortly." };
  }

  const payoutAmountMinor = quote ? convert(amount, quote.rateMicro) : amount;
  const entity: Entity = method.method === "stripe" ? "us" : "eg";

  /*
   * 🔴 ONE OPEN REQUEST, ENFORCED UNDER A LOCK. The check above and this insert
   * were two statements, so a double submit made two requests, each up to the
   * whole balance. The per-clinician lock makes the second wait, then see the
   * first.
   */
  const [row] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`payout:${input.therapistId}`}))`);
    const stillOpen = await tx
      .select({ id: payoutRequests.id })
      .from(payoutRequests)
      .where(
        and(
          eq(payoutRequests.therapistId, input.therapistId),
          inArray(payoutRequests.status, ["requested", "approved", "sent"]),
        ),
      )
      .limit(1);
    if (stillOpen.length > 0) return [];
    return tx
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
  });
  if (!row) return { error: "You already have a withdrawal in progress. It is on the queue." };

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
  /** Runs in the same transaction, and only for the call that won the move. */
  alsoPost?: (tx: LedgerExecutor) => Promise<unknown>;
  /** Only when the provider is not mid-send: money in flight is not rejected. */
  notWhileSending?: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  /*
   * The status is part of the WHERE, so two people pressing the same button
   * produce one transition and one loser. A read-then-write here would let a
   * payout be sent twice by two members of a three-person team working the
   * same queue at the same hour, which is the exact shape of a double payment.
   */
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(payoutRequests)
      .set({ status: input.to, updatedAt: new Date(), ...(input.set ?? {}) })
      .where(
        and(
          eq(payoutRequests.id, input.requestId),
          inArray(payoutRequests.status, input.from),
          input.notWhileSending
            ? sql`(${payoutRequests.providerState} IS NULL OR ${payoutRequests.providerState} NOT IN ('sending', 'sent'))`
            : undefined,
        ),
      )
      .returning({ id: payoutRequests.id });

    if (updated.length === 0) {
      return { error: "That request has already moved on. Reload the queue." };
    }

    await tx.insert(payoutRequestEvents).values({
      requestId: input.requestId,
      fromStatus: input.from[0] ?? null,
      toStatus: input.to,
      actorUserId: input.actorUserId,
      note: input.note ?? null,
    });

    /*
     * 🔴 W1-04: the ledger post rides on the WON transition. It used to run
     * before the move, so both of two concurrent "Mark sent" calls posted and
     * the loser's legs stayed on the books with no request pointing at them.
     */
    if (input.alsoPost) await input.alsoPost(tx);

    return { ok: true };
  });
}

/**
 * 🔴 W2-A01 / D9: every act on a payout asks the four-eyes questions, not
 * only approval. Staff work this queue now, so "the payee or the last editor
 * takes it on, sends it or confirms it" is a thing a team member could do,
 * and `fourEyesProblem` is the same rule the refund queue asks.
 *
 * Returns a dictionary key as the error; the action says it in the reader's
 * language.
 */
async function fourEyes(
  row: Pick<PayoutRequest, "therapistId" | "detailsEditedByUserId" | "amountCents" | "ownerUserId">,
  actorUserId: string,
  movesMoney: boolean,
): Promise<{ error: MessageKey } | null> {
  const settings = await getSettings();
  const problem = fourEyesProblem({
    actorUserId,
    payeeUserId: row.therapistId,
    editorUserId: row.detailsEditedByUserId,
    amountCents: row.amountCents,
    thresholdCents: settings.payouts.twoPersonThresholdCents,
    ownerUserId: row.ownerUserId,
    movesMoney,
    twoPeople: settings.rules.approvals.payouts,
  });
  if (!problem) return null;
  return {
    error:
      problem === "payee" ? "aaccess.fourPayee" : problem === "editor" ? "aaccess.fourEditor" : "arefund.errTwo",
  };
}

/**
 * 🔴 0161 / ruling 13 — the approver may also send only when payouts need one
 * person. With the switch on, whoever approved does not also send.
 */
async function approverSends(
  row: Pick<PayoutRequest, "approvedByUserId">,
  senderUserId: string,
): Promise<{ error: string } | null> {
  const settings = await getSettings();
  if (!settings.rules.approvals.payouts) return null;
  if (row.approvedByUserId && row.approvedByUserId === senderUserId) {
    return { error: "You approved this one. A second person sends it." };
  }
  return null;
}

/**
 * 🔴 0161 — THE COMPENSATING CONTROL FOR ONE-PERSON PAYOUTS.
 *
 * With one person able to approve and send, somebody who changed where a
 * clinician is paid could pay the next withdrawal to themselves. So a payout
 * destination somebody other than the clinician changed within
 * `rules.approvals.payoutDetailsCooldownHours` waits. Zero switches it off.
 */
async function detailsCoolingDown(
  row: Pick<PayoutRequest, "methodId" | "therapistId">,
  now = new Date(),
): Promise<{ error: string } | null> {
  const settings = await getSettings();
  const hours = settings.rules.approvals.payoutDetailsCooldownHours;
  if (hours <= 0 || !row.methodId) return null;
  const [method] = await db
    .select({ editedAt: payoutMethods.editedAt, editedBy: payoutMethods.editedByUserId })
    .from(payoutMethods)
    .where(eq(payoutMethods.id, row.methodId))
    .limit(1);
  /*
   * The clinician changing their own details is not the path ruling 13 opened;
   * somebody else changing them, then paying alone, is. So the wait applies
   * when the last edit was not the clinician's own.
   */
  if (!method?.editedAt || method.editedBy === row.therapistId) return null;
  const until = method.editedAt.getTime() + hours * 60 * 60 * 1000;
  if (until <= now.getTime()) return null;
  return {
    error: `These payout details changed less than ${hours} hours ago. This payout can go after ${new Date(until).toISOString().slice(0, 16).replace("T", " ")} UTC.`,
  };
}

async function requestRow(requestId: string): Promise<PayoutRequest | null> {
  const [row] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, requestId)).limit(1);
  return row ?? null;
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

  // Approval is the act that lets money leave, so the threshold rule is asked here.
  const refused = await fourEyes(row, input.approverUserId, true);
  if (refused) return refused;
  const cooling = await detailsCoolingDown(row);
  if (cooling) return cooling;

  /*
   * 🔴 AND WHETHER WE HOLD IT (live walkthrough). A request is checked against
   * the balance when it is made, and a balance moves after that: a refund, an
   * adjustment, a bill netted from it. Approval asked only who, so a $255
   * request against $51 held was approved on production and one "sent" from
   * paying out money the books do not owe. Other approved, unsent requests
   * count against it first.
   */
  const short = await moreThanHeld(row);
  if (short) return short;

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
 * 🔴 Whether we still hold this request's money, asked at approval and again
 * at "sent" (live walkthrough). The balance moves after a request is made (a
 * refund, an adjustment, a bill netted from it), and other approved, unsent
 * requests for the same clinician count against it first.
 */
async function moreThanHeld(row: { id: string; therapistId: string; amountCents: number }): Promise<{ error: string } | null> {
  const held = await heldForTherapist(row.therapistId);
  const [others] = await db
    .select({ total: sql<number>`COALESCE(SUM(${payoutRequests.amountCents}), 0)::int` })
    .from(payoutRequests)
    .where(
      and(
        eq(payoutRequests.therapistId, row.therapistId),
        eq(payoutRequests.status, "approved"),
        sql`${payoutRequests.id} <> ${row.id}`,
      ),
    );
  const room = held - (others?.total ?? 0);
  if (row.amountCents <= room) return null;
  const { moneyText } = await import("@/lib/money/text");
  return {
    error: `We hold ${await moneyText(Math.max(0, room))} for them now, less than this request. Reject it so they can ask again.`,
  };
}

/**
 * The transfer has been made at the bank. 16.2, 16.3c.
 *
 * This is where the money leaves the books, and it is also where the proof
 * goes on: a screenshot of the transfer, which the therapist sees on their
 * earnings screen. A payout marked sent with nothing to show for it is the
 * state a dispute cannot be settled from.
 *
 * 🔴 A19: "something to show" was five characters of anything. It is now the
 * bank's reference or a link to the receipt, by `plausibleTransferReceipt`,
 * and the queue's field states the same rule.
 */
export async function markPayoutSent(input: {
  requestId: string;
  senderUserId: string;
  proofUrl: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const proof = input.proofUrl.trim();
  if (!plausibleTransferReceipt(proof)) {
    return {
      error:
        "Enter the bank's reference (6 to 40 characters with 4+ digits) or an https link to the receipt.",
    };
  }

  const [row] = await db
    .select()
    .from(payoutRequests)
    .where(eq(payoutRequests.id, input.requestId))
    .limit(1);

  if (!row) return { error: "That request no longer exists." };
  if (row.status !== "approved") return { error: "Only an approved payout can be sent." };
  /* A provider is already sending it: its callback finishes it, not a second hand. */
  if (row.providerState === "sending") return { error: "A payouts provider is sending this one." };
  const refused = await fourEyes(row, input.senderUserId, false);
  if (refused) return refused;
  /*
   * 🔴 Whoever approved it does not also send it, while the payouts switch
   * says two people (ruling 13 turned it off by default).
   */
  const sameHand = await approverSends(row, input.senderUserId);
  if (sameHand) return sameHand;
  const cooling = await detailsCoolingDown(row);
  if (cooling) return cooling;
  const short = await moreThanHeld(row);
  if (short) return short;

  return recordSent(row, input.senderUserId, proof, "Transfer made");
}

/**
 * The money left: the guarded move to `sent`, the ledger post in the same
 * transaction for the call that won it (W1-04), and the clinician told. Shared
 * by "Mark sent" and the payouts provider's callback, so both leave the books
 * and the screens in exactly the same state.
 */
async function recordSent(
  row: PayoutRequest,
  senderUserId: string,
  proof: string,
  note: string,
  extra: Record<string, unknown> = {},
): Promise<{ ok?: boolean; error?: string }> {
  const input = { requestId: row.id, senderUserId };
  const txnId = crypto.randomUUID();
  const moved = await move({
    requestId: input.requestId,
    from: ["approved"],
    to: "sent",
    actorUserId: input.senderUserId,
    note,
    set: {
      sentByUserId: input.senderUserId,
      sentAt: new Date(),
      proofUrl: proof,
      ledgerTxnId: txnId,
      ...extra,
    },
    alsoPost: (tx) =>
      postManualPayout({
        requestId: row.id,
        organizationId: row.organizationId,
        therapistId: row.therapistId,
        amountCents: row.amountCents,
        entity: row.entity,
        sentByUserId: input.senderUserId,
        txnId,
        executor: tx,
      }),
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

/**
 * 🔴 64.1: SEND THROUGH THE PAYOUTS PROVIDER, instead of by hand.
 *
 * The same person rules as "Mark sent" (four eyes, never the payee or the
 * editor), asked at the moment somebody presses Send, because the provider's
 * callback has no person in it. The request is claimed `sending` first, in the
 * WHERE, so two presses make one instruction; the provider's reference is
 * stored with it. Nothing posts to the ledger here: the money has not left
 * until the provider says so (`applyPayoutEvent`), which is when "Mark sent"
 * would have been pressed.
 */
export async function sendViaProvider(input: {
  requestId: string;
  senderUserId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const { payoutProvider, PROVIDER_METHODS } = await import("./gateway");
  const provider = await payoutProvider();
  if (!provider) return { error: "No payouts provider is switched on. Send it by hand." };

  const row = await requestRow(input.requestId);
  if (!row) return { error: "That request no longer exists." };
  if (row.status !== "approved") return { error: "Only an approved payout can be sent." };
  if (!(PROVIDER_METHODS as readonly string[]).includes(row.method)) {
    return { error: "The provider does not send to this kind of account. Send it by hand." };
  }
  const refused = await fourEyes(row, input.senderUserId, false);
  if (refused) return refused;
  /* 🔴 The approver does not also send it, while the payouts switch says two people. */
  const sameHand = await approverSends(row, input.senderUserId);
  if (sameHand) return sameHand;
  const cooling = await detailsCoolingDown(row);
  if (cooling) return cooling;
  const short = await moreThanHeld(row);
  if (short) return short;

  const placeholder = `claim:${row.id}:${crypto.randomUUID()}`;
  const [claimed] = await db
    .update(payoutRequests)
    .set({
      provider: provider.name,
      providerRef: placeholder,
      providerState: "sending",
      providerError: null,
      providerSenderUserId: input.senderUserId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(payoutRequests.id, row.id),
        eq(payoutRequests.status, "approved"),
        sql`(${payoutRequests.providerState} IS NULL OR ${payoutRequests.providerState} = 'failed')`,
      ),
    )
    .returning({ id: payoutRequests.id });
  if (!claimed) return { error: "That request has already moved on. Reload the queue." };

  const { env } = await import("@/lib/env");
  /*
   * 🔴 A THROW IS NOT A SILENCE. It used to leave the row `sending` for ever,
   * with neither Send nor Mark sent on screen. It is recorded as failed with
   * a sentence saying to check with the provider first: the request id is the
   * provider's idempotency key, so a second send of the same one is refused
   * there if the first did land.
   */
  const sent = await provider
    .send({
      reference: row.id,
      amountMinor: row.payoutAmountMinor,
      currency: "egp",
      method: row.method as (typeof PROVIDER_METHODS)[number],
      identifier: row.identifier,
      accountName: row.accountName,
      callbackUrl: `${env.appUrl}/api/payouts/callback`,
    })
    .catch((error: unknown) => ({
      ok: false as const,
      reason: `no answer from the provider (${safeErrorMessage(error)}); check with them before sending again`,
    }));
  if (!sent.ok) {
    await db
      .update(payoutRequests)
      .set({ providerState: "failed", providerError: sent.reason.slice(0, 300), updatedAt: new Date() })
      .where(eq(payoutRequests.id, row.id));
    return { error: "The provider refused it. Try again, or send it by hand." };
  }
  await db
    .update(payoutRequests)
    .set({ providerRef: sent.providerRef, updatedAt: new Date() })
    .where(and(eq(payoutRequests.id, row.id), eq(payoutRequests.providerRef, placeholder)));
  await db.insert(payoutRequestEvents).values({
    requestId: row.id,
    fromStatus: "approved",
    toStatus: "approved",
    actorUserId: input.senderUserId,
    note: `Sent through ${provider.name}; waiting for it to confirm`,
  });
  /*
   * 🔴 THE ANSWER WAS THE OUTCOME. Paymob Send answers a wallet payout with
   * "successful" at once and sends no callback for it, so waiting for one
   * would leave the request `sending` for ever. The outcome in the answer is
   * applied exactly as the callback would be, through the same guarded path,
   * once the provider's reference is saved above.
   */
  if (sent.settled) {
    await applyPayoutEvent(provider.name, { ...sent.settled, providerRef: sent.providerRef, reference: row.id });
  }
  return { ok: true };
}

/**
 * 🔴 WHAT THE PROVIDER SAID, APPLIED ONCE. `sent` is "Mark sent" with the
 * provider's reference as the proof and the person who pressed Send as the
 * sender; `failed` leaves the request approved, with the reason, to send again
 * or by hand. Anything else is not an event.
 */
export async function applyPayoutEvent(
  providerName: string,
  event: { providerRef: string; reference: string; outcome: "sent" | "failed" | "pending"; failure: string | null },
): Promise<{ applied: "sent" | "failed" | "ignored" | "unapplied" }> {
  /*
   * 🔴 By OUR reference, which the provider was given before it answered.
   * Matching on its own ref missed a callback that beat the save of that ref;
   * a ref that is already saved must still agree.
   */
  /*
   * A provider that does not echo our reference (Paymob Send's inquiry may
   * not) is matched on its own, which by then is saved: a callback for a
   * payout comes long after the send that stored it.
   */
  const byOurs = /^[0-9a-f-]{36}$/i.test(event.reference);
  if (!byOurs && (!event.providerRef || event.providerRef.startsWith("claim:"))) return { applied: "ignored" };
  const [row] = await db
    .select()
    .from(payoutRequests)
    .where(
      and(
        eq(payoutRequests.provider, providerName),
        byOurs ? eq(payoutRequests.id, event.reference) : eq(payoutRequests.providerRef, event.providerRef),
      ),
    )
    .limit(1);
  if (!row) return { applied: "ignored" };
  if (row.providerRef && !row.providerRef.startsWith("claim:") && row.providerRef !== event.providerRef) {
    return { applied: "ignored" };
  }

  if (event.outcome === "failed") {
    const [failed] = await db
      .update(payoutRequests)
      .set({ providerState: "failed", providerError: (event.failure ?? "failed").slice(0, 300), updatedAt: new Date() })
      .where(and(eq(payoutRequests.id, row.id), eq(payoutRequests.providerState, "sending")))
      .returning({ id: payoutRequests.id });
    return { applied: failed ? "failed" : "ignored" };
  }
  if (event.outcome !== "sent") return { applied: "ignored" };
  if (row.providerState !== "sending") {
    /*
     * 🔴 A "sent" we cannot apply is money that left with nothing booked. It
     * is raised loudly, and the caller answers an error so the provider
     * retries rather than dropping it.
     */
    if (row.providerState !== "sent") {
      log.error("provider says a payout was sent that is not being sent", { request: ref(row.id), state: row.providerState ?? "none", status: row.status });
      return { applied: "unapplied" };
    }
    return { applied: "ignored" };
  }

  const sender = row.providerSenderUserId ?? row.approvedByUserId;
  if (!sender) {
    log.error("provider sent a payout with nobody on record who sent it", { request: ref(row.id) });
    return { applied: "ignored" };
  }
  const done = await recordSent(row, sender, `provider:${providerName}:${event.providerRef}`, `Sent by ${providerName}`, {
    providerState: "sent",
  });
  return { applied: done.ok ? "sent" : "ignored" };
}

/** The clinician says it arrived, or the team confirms the bank did. */
export async function confirmPayout(input: {
  requestId: string;
  actorUserId: string | null;
}): Promise<{ ok?: boolean; error?: string }> {
  const row = await requestRow(input.requestId);
  if (!row) return { error: "That request no longer exists." };
  const refused = input.actorUserId ? await fourEyes(row, input.actorUserId, false) : null;
  if (refused) return refused;

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
 * 🔴 W2-A04: the transfer was made and it did not arrive (bounced, wrong
 * wallet, the clinician says nothing came). Migration 0140.
 *
 * Only "Confirm arrival" was offered for a sent payout and `rejectPayout`
 * refuses one, so the books said the clinician had been paid and nothing in
 * the product could say otherwise. The money is ours again and owed to them.
 *
 * The same guarded-move-then-post as "Mark sent" (W1-04): the status is in
 * the WHERE, the reversal rides on the won move inside its transaction, so two
 * presses reverse the ledger once. The reason is mandatory and is what the
 * clinician reads.
 */
export async function markPayoutReturned(input: {
  requestId: string;
  actorUserId: string;
  reason: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const reason = input.reason.trim();
  if (reason.length < 5) return { error: "Say why, so the clinician knows what to fix." };

  const row = await requestRow(input.requestId);
  if (!row) return { error: "That request no longer exists." };
  if (row.status !== "sent") return { error: "That request has already moved on. Reload the queue." };
  const refused = await fourEyes(row, input.actorUserId, false);
  if (refused) return refused;

  const txnId = crypto.randomUUID();
  const moved = await move({
    requestId: input.requestId,
    from: ["sent"],
    to: "returned",
    actorUserId: input.actorUserId,
    note: reason,
    set: { returnedAt: new Date(), returnedReason: reason, returnedLedgerTxnId: txnId },
    alsoPost: (tx) =>
      postManualPayoutReturned({
        requestId: row.id,
        organizationId: row.organizationId,
        therapistId: row.therapistId,
        amountCents: row.amountCents,
        entity: row.entity,
        actorUserId: input.actorUserId,
        txnId,
        executor: tx,
      }),
  });
  if (moved.error) return moved;

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
      kind: "payout.returned",
      subject: "Your withdrawal did not arrive",
      body: `${reason} The money is back in your balance, so you can ask for it again.`,
    },
  );

  return { ok: true };
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

  const current = await requestRow(input.requestId);
  if (!current) return { error: "That request no longer exists." };
  const refused = await fourEyes(current, input.actorUserId, false);
  if (refused) return refused;
  /*
   * 🔴 NOT WHILE THE PROVIDER IS SENDING IT. A reject here used to win, the
   * provider's "sent" was then ignored with a 200, the money had left, the
   * ledger never posted and the balance was there to withdraw twice.
   */
  if (current.providerState === "sending" || current.providerState === "sent") {
    return { error: "The payouts provider is sending this. Wait for its answer." };
  }

  const result = await move({
    requestId: input.requestId,
    from: ["requested", "approved"],
    to: "rejected",
    notWhileSending: true,
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
  /*
   * W2-A01: taking a request on is what makes somebody the "different
   * person" above the threshold, so the payee and the last editor may not be
   * it.
   */
  const row = await requestRow(input.requestId);
  if (!row) return { error: "That request is no longer open." };
  const refused = await fourEyes(row, input.ownerUserId, false);
  if (refused) return refused;

  const updated = await db
    .update(payoutRequests)
    .set({ ownerUserId: input.ownerUserId, updatedAt: new Date() })
    .where(
      and(
        eq(payoutRequests.id, input.requestId),
        inArray(payoutRequests.status, ["requested", "approved"]),
        /* Taking it on does not take it from somebody who already has. */
        sql`(${payoutRequests.ownerUserId} IS NULL OR ${payoutRequests.ownerUserId} = ${input.ownerUserId})`,
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
      providerState: payoutRequests.providerState,
      providerError: payoutRequests.providerError,
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
      /* 🔴 0161: only while the payouts switch asks for two people. */
      needsTwoPeople:
        settings.rules.approvals.payouts && row.amountCents > settings.payouts.twoPersonThresholdCents,
      proofUrl: row.proofUrl,
      providerState: row.providerState,
      providerError: row.providerError,
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
      // W2-A01 / D9: staff work this queue now, so the alarm reaches them too.
      .where(inArray(users.role, [...BACK_OFFICE_ROLES]))
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
