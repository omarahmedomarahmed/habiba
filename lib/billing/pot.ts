import "server-only";

import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  enrolments,
  ledgerEntries,
  patients,
  sessionPayments,
  sessions,
  sponsorMoneyEntries,
  sponsorPots,
  sponsors,
  therapistVerifications,
  users,
} from "@/lib/db/schema";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { getSettings, sessionMoney } from "@/lib/settings";
import { coverageNow, coverageSplit, vatOn } from "@/lib/settings/defs";

import { journal } from "./ledger";
import { crossingFor, payoutRailFor } from "./money";
import { moneyEntryFigures, sharesOf } from "./split-refund";

/**
 * The corporate pot. PLAN.md 53.10 to 53.16, 53.21, C226, C232, C239, C244.
 *
 * ## 🔴 A PAYMENT METHOD, NOT A BILLING SYSTEM (C226)
 *
 * One new ledger account (`sponsor_pot`), one new funding source (`pot` on
 * `session_payments`), and one new crossing. No new session type, no parallel
 * invoice path, no second fee table. A pot-funded session is an ordinary
 * session that produced an ordinary `session_payments` row, and every screen
 * downstream — the earnings page, the receipt, the reconciliation — reads it
 * through the code that was already there.
 *
 * That is the whole of C226, and the temptation it rules out is real: a
 * corporate rail *looks* like it wants its own invoices, its own statements and
 * its own session kind, and every one of those would be a second place where
 * money is counted.
 *
 * ## 🔴 WE HOLD THE MONEY, AND THAT IS §3c's EXPOSURE, NOT A NEW ONE
 *
 * A pot is a prepayment: cash arrives months before any session spends it, and
 * it is spent by third parties. Holding funds and paying them out later is money
 * transmission, which is what 1.8 forbade and what §3c and C73 deliberately
 * reversed — "build it and ship it", with the row left permanently open as an
 * accepted risk.
 *
 * So the pot does not introduce that exposure, it extends it to a new
 * counterparty class. Two consequences are recorded here rather than discovered:
 *
 *   1. **C6 is no longer true as written.** It was closed with "only
 *      `capture: 'destination'` is reachable; 0 historical platform rows". A
 *      pot-funded session has no card charge at session time and no transfer for
 *      Stripe to make, so it is `capture: "platform"` — money on our balance,
 *      paid out later by `releaseHeldEarnings`, which is why that path still
 *      exists. `capture: "platform"` is reachable again.
 *   2. **C232's question is live and is a precondition, not a parallel task.**
 *      Whether unspent pot balance is a liability we may hold is the one thing
 *      counsel has to answer before a second deal, and it is the reason the
 *      account is modelled as a liability rather than as revenue.
 *
 * ## 🔴 VAT IS CHARGED ON THE TOP-UP, NOT ON THE SESSION (C241)
 *
 * The taxable supply is the prepayment from the sponsor, in the jurisdiction of
 * the entity that holds it. Charging VAT again when a session spends the pot
 * would tax the same money twice, and charging it in the *patient's* country
 * would invent a tax relationship between an employee and their employer's
 * purchase. So a pot-funded `session_payments` row has `vat_cents = 0`, and the
 * VAT lives on the top-up invoice where the money actually changed hands.
 *
 * C241 also gates the Egyptian entity: Egyptian e-invoicing is confirmed with
 * counsel BEFORE the Egyptian entity takes a corporate payment. `topUpPot`
 * refuses an `eg` sponsor in plain words rather than issuing a document we
 * cannot stand behind.
 *
 * ## 🔴 NO PAYER NAME ON A POT PAYMENT (C243, C244)
 *
 * `payer_name` stays NULL. It is the column a therapist surface reads, and
 * writing the employer's name into it would put "who pays for this patient" on
 * a clinician's earnings page — the exact leak C243 was raised about, arriving
 * through a column that already existed. A pot payment is identified by its
 * funding source, never by naming the payer.
 */

/**
 * The entity's own VAT rate, read from `country_settings` rather than a constant.
 *
 * 🔴 A duplicate of `countryVatBps` in `lib/billing/invoice.ts` by necessity:
 * importing it would make the money module depend on the document module, which
 * is backwards. Zero is a real answer, not a missing one, and both read the same
 * row so they cannot disagree about a jurisdiction.
 */
/**
 * 🔴 76.1 — WHAT A COMPANY CHOOSES IS THE CREDIT, AND THE TAX GOES ON TOP.
 *
 * ## The question the stepper forced
 *
 * A pot top-up used to work the tax BACKWARDS out of whatever number arrived:
 * $5,000 in a 14% jurisdiction credited $4,386. That was never a decision, it
 * was a guess made while `topUpPot` refused every VAT jurisdiction there was,
 * and the note beside it said so: *"ZERO TODAY, and shipped anyway."*
 *
 * The manual rail changed that. An Egyptian company can now reach a pot, so
 * "is the number they picked the credit or the total?" has a consequence, and
 * it has to be answered once for both rails rather than differently in each.
 *
 * ## Why the credit, and not the total
 *
 * Three reasons, and they agree:
 *
 *   - **The session rail already adds tax on top.** A patient picks a 1,000
 *     pound session and is asked for 1,140. A company picking $100 and being
 *     charged $100 would mean the same product taxes two payers in opposite
 *     directions.
 *   - **The arithmetic on the screen has to be true.** The whole point of the
 *     coverage slider is *"your $100 covers 50 sessions"*. Divide the tax out
 *     and $100 covers 43, and the one sum a finance team does on paper before
 *     agreeing to anything is the sum we got wrong.
 *   - **The plan promises $100 of credit**, not $100 minus whatever tax applies
 *     in the jurisdiction they happen to be in.
 *
 * ## What did NOT change
 *
 * `invoiceFor` still works the tax backwards out of the cash that arrived, and
 * it still lands on the same two numbers: $114 arrives, $100 is net, $14 is
 * tax. The two directions agree because they are now describing the same
 * event from the two ends.
 *
 * And the US rail is unchanged in behaviour: its rate is 0, so credit and
 * total are the same number and always were.
 */
export function potTopUpMoney(input: {
  creditCents: number;
  vatBps: number;
}): { creditCents: number; vatCents: number; settlesCents: number } {
  const credit = Math.max(0, Math.round(input.creditCents));
  const vat = vatOn(credit, input.vatBps);
  return { creditCents: credit, vatCents: vat, settlesCents: credit + vat };
}

export async function entityVatBps(entity: string): Promise<number> {
  const rows = await controlDb.execute(sql`
    SELECT vat_bps FROM country_settings WHERE entity = ${entity} AND enabled = true LIMIT 1`);

  const row = (rows.rows as { vat_bps: number }[])[0];
  return Number(row?.vat_bps ?? 0);
}

/** How much a pot may go below zero is per pot; this is what a missing pot gets. */
const NO_POT = {
  potId: null,
  balanceCents: 0,
  overdraftCents: 0,
  coverageBps: 0,
  pendingCoverageBps: null,
  pendingCoverageFrom: null,
  expiresAt: null,
} as const;

export type PotSpend =
  | { paid: true; sponsorId: string; amountCents: number }
  | {
      paid: false;
      /** W2-S08: `expired`: the pot's expiry date has passed, so it pays for nothing. */
      reason: "no_benefit" | "no_pot" | "insufficient" | "nothing_to_pay" | "expired";
    };

/**
 * 🔴 W2-P15 / E5: WHY THE BENEFIT DID NOT PAY, for the screen that asks for money.
 *
 * E5 is "when the pot runs out the patient is told to ask HR, not shown a
 * payment error". `payFromPot` returns its reason and every caller discarded
 * it, so a covered employee met an ordinary price with nothing saying their
 * benefit had not paid or who could fix it.
 *
 * Read fresh rather than carried from the booking, because the pay and join
 * screens are opened later and by a different request. Null whenever there is
 * nothing to say: a session with nothing owed, somebody with no benefit, or a
 * pot that paid its share (the split is already on the screen). Otherwise:
 *
 *   paused       the re-verification went unanswered; the fix is theirs
 *   unconfirmed  the work address code was never answered; theirs too
 *   unfunded     the benefit is live and paid nothing: ask the organisation
 *
 * The organisation is named to its own employee on their own screen, as the
 * benefit page already does. Never in a notice (C231), and never to anybody else.
 */
export async function benefitShortfall(
  sessionId: string,
): Promise<{ sponsorName: string; state: "paused" | "unconfirmed" | "unfunded" } | null> {
  const [row] = await controlDb
    .select({
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      personId: patients.personId,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row?.personId || row.priceCents <= 0 || row.paymentStatus !== "pending") return null;

  const [benefit] = await controlDb
    .select({
      sponsorName: sponsors.name,
      pausedAt: enrolments.pausedAt,
      lastVerifiedAt: enrolments.lastVerifiedAt,
    })
    .from(enrolments)
    .innerJoin(sponsors, eq(sponsors.id, enrolments.sponsorId))
    .where(
      and(
        eq(enrolments.personId, row.personId),
        eq(enrolments.isPrimary, true),
        isNull(enrolments.removedAt),
        eq(sponsors.state, "active"),
      ),
    )
    .limit(1);
  if (!benefit) return null;

  const [split] = await controlDb
    .select({ sponsorShareCents: sessionPayments.sponsorShareCents })
    .from(sessionPayments)
    .where(eq(sessionPayments.sessionId, sessionId))
    .limit(1);
  if ((split?.sponsorShareCents ?? 0) > 0) return null;

  const state = benefit.pausedAt
    ? "paused"
    : benefit.lastVerifiedAt === null
      ? "unconfirmed"
      : "unfunded";
  return { sponsorName: benefit.sponsorName, state };
}

/**
 * 🔴 53.21 — POT FIRST, ALWAYS. A badged patient never pays out of pocket
 * while their sponsor's pot has money in it.
 *
 * Called when a session is booked, before any pay link is shown. Everything it
 * needs is resolved from the session id: the patient row, the person behind it,
 * their ONE primary enrolment, and that sponsor's pot. Nothing is passed in,
 * because a caller that could pass a sponsor id could pass the wrong one.
 *
 * ## 🔴 It is safe to call twice
 *
 * The spend is claimed with a conditional UPDATE on
 * `payment_status = 'pending'`, and the ledger is posted only if that update
 * matched. Two booking paths both calling this, or a retry after a timeout,
 * cannot spend the pot twice — the same construction `settleSessionPayment`
 * uses, and for the same reason.
 */
export async function payFromPot(sessionId: string): Promise<PotSpend> {
  const [row] = await controlDb
    .select({
      sessionId: sessions.id,
      organizationId: sessions.organizationId,
      therapistId: sessions.therapistId,
      priceCents: sessions.priceCents,
      paymentStatus: sessions.paymentStatus,
      personId: patients.personId,
      stripeAccountId: users.stripeAccountId,
      payoutsEnabled: users.payoutsEnabled,
      /*
       * 🔴 Their own country, because Egypt is always a manual payout however
       * the money arrived. Left-joined: a clinician who has not filed a
       * verification has no country, and `payoutRailFor` reads that as manual
       * rather than assuming Connect.
       */
      therapistCountry: therapistVerifications.country,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return { paid: false, reason: "no_benefit" };
  if (row.priceCents <= 0 || row.paymentStatus !== "pending") {
    return { paid: false, reason: "nothing_to_pay" };
  }
  if (!row.personId) return { paid: false, reason: "no_benefit" };

  /*
   * 🔴 The ONE primary enrolment, and a paused one funds nothing.
   *
   * C249 says exactly one enrolment is primary and the patient chooses it, and a
   * partial unique index makes a second one impossible. C247's pause is a
   * separate column from removal on purpose: an unanswered re-verification stops
   * the funding and touches nothing else, so it is checked here and nowhere near
   * the record.
   *
   * 🔴 AND `last_verified_at IS NOT NULL`, which is 53.19's whole point.
   *
   * `enrol` leaves it null for a `domain_email` until the code sent to that
   * address is answered, and its comment said "the funding does not start". That
   * sentence was a claim about THIS WHERE CLAUSE and it was false until this
   * condition was added: an unverified enrolment was funding sessions while a
   * comment three files away said it could not. A comment asserting a wiring the
   * code does not have is the second most common defect in this repository, and
   * this was one of them, found by reading the two files against each other.
   */
  const [benefit] = await controlDb
    .select({
      sponsorId: enrolments.sponsorId,
      enrolmentId: enrolments.id,
      state: enrolments.state,
      provisionalSessionsUsed: enrolments.provisionalSessionsUsed,
    })
    .from(enrolments)
    .innerJoin(sponsors, eq(sponsors.id, enrolments.sponsorId))
    .where(
      and(
        eq(enrolments.personId, row.personId),
        eq(enrolments.isPrimary, true),
        /*
         * 🔴 61.8 / C321 — `provisional` funds too, and that is the point of it.
         *
         * An HR match enrols somebody and the money starts before their mailbox
         * is confirmed. Making them wait for an email means they pay for the
         * first session themselves and never come back. The cap below is what
         * bounds it.
         */
        inArray(enrolments.state, ["active", "provisional"]),
        isNull(enrolments.removedAt),
        isNull(enrolments.pausedAt),
        isNotNull(enrolments.lastVerifiedAt),
        eq(sponsors.state, "active"),
      ),
    )
    .limit(1);

  if (!benefit) return { paid: false, reason: "no_benefit" };

  /*
   * 🔴 61.9 / C350 — A PROVISIONAL PERSON HAS A LIMIT, AND IT IS CLAIMED HERE.
   *
   * The cap is a settable number, default one: enough that somebody can book
   * and attend while their confirmation email sits unread, not enough that an
   * unconfirmed HR match can spend a term's budget.
   *
   * 🔴 CLAIMED WITH A CONDITIONAL UPDATE, not read and then written. The same
   * construction C382 forced on the pot debit, for the same reason: two
   * bookings arriving together both read "0 used", both pass a check, and both
   * spend. The increment's own WHERE clause is what makes the limit a limit.
   */
  /*
   * 🔴 Tracked, because a claim taken and not used has to be given back.
   *
   * The allowance is claimed BEFORE the pot is debited, which is the right
   * order — the conditional UPDATE is what makes the cap hold under two
   * simultaneous bookings, and checking it after the money moved would be a
   * read-then-write with a window in it. The cost is that every path which
   * returns without funding from here on has to release it, exactly as the pot
   * debit has its compensating credit. A person whose one provisional session
   * was consumed by a booking that never happened has lost their allowance to
   * our bookkeeping.
   */
  let provisionalClaimed = false;

  if (benefit.state === "provisional") {
    const settings = await getSettings();
    const cap = settings.sponsor.provisionalSessions;

    const [claimedProvisional] = await controlDb
      .update(enrolments)
      .set({
        provisionalSessionsUsed: sql`${enrolments.provisionalSessionsUsed} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enrolments.id, benefit.enrolmentId),
          sql`${enrolments.provisionalSessionsUsed} < ${cap}`,
        ),
      )
      .returning({ id: enrolments.id });

    if (!claimedProvisional) {
      /*
       * 🔴 NOT an error the patient sees as a refusal of care. They are offered
       * the ordinary pay link, exactly as an empty pot does, and the fix is in
       * their inbox. `no_benefit` is the reason code every caller already knows
       * how to present gently.
       */
      log.info("provisional enrolment has spent its allowance", { session: ref(sessionId) });
      return { paid: false, reason: "no_benefit" };
    }

    /* Only once the UPDATE matched, so a refused claim releases nothing. */
    provisionalClaimed = true;
  }

  const pot = await potRow(benefit.sponsorId);
  if (!pot.potId) return { paid: false, reason: "no_pot" };

  const gross = row.priceCents;

  /*
   * 🔴 60.1 to 60.6 / C311 / C345 — WHAT THE EMPLOYER ACTUALLY COVERS.
   *
   * Read ONCE, here, at booking, and written onto the payment row below. Never
   * re-read when the money moves: an employer lowering their percentage on a
   * Tuesday must not change what a patient owes for a session they agreed to on
   * Monday. A price somebody was shown is a price they are owed.
   *
   * `coverageNow` applies a pending change by its date rather than by a job,
   * so there is no scheduled task whose failure leaves an employer paying a
   * percentage they changed three weeks ago.
   *
   * 🔴 0% IS LEGAL AND IS NOT REMOVAL (C345). The person keeps their place on
   * the roster and their badge; the money stops. C234 already separates a badge
   * from funding, and this is that separation with a number on it. The pot
   * spends nothing and the patient pays the ordinary way, which `nothing_to_pay`
   * below is NOT the right answer for: they do owe, they owe all of it.
   */
  const coverageBps = coverageNow(pot, new Date());
  const split = coverageSplit({ grossCents: gross, coverageBps, vatBps: 0 });
  const sponsorShare = split.sponsorCents;

  if (sponsorShare <= 0) {
    log.info("this sponsor covers nothing of this session", { session: ref(sessionId) });
    return { paid: false, reason: "no_benefit" };
  }

  /*
   * 🔴 C239 — A SESSION THAT HAS STARTED ALWAYS COMPLETES AND IS ALWAYS PAID,
   * and the overdraft is how that is true without being unbounded.
   *
   * The balance may go below zero by at most the overdraft this sponsor was
   * granted, which the database also refuses to exceed. Past that the pot
   * cannot fund the booking and the patient is offered the ordinary pay link
   * rather than a session that quietly does not happen.
   *
   * A session ALREADY UNDER WAY is a different question and is not decided
   * here: this runs at booking. `sessions.payment_status` is never read by the
   * room, which is what makes that true rather than hopeful.
   */
  /*
   * 🔴 C382 — THE READ BELOW IS NOT THE GUARD. The guard is the debit.
   *
   * This check reads the balance and the real spend happens two hundred lines
   * later in an UPDATE whose only condition is the pot's id. Two bookings
   * arriving together both read a balance that can fund one, both pass here,
   * and both debit. The database's own `sponsor_pots_overdraft_bounded` CHECK
   * then refuses the second one, which sounds like the bound holding and is
   * worse than it failing: by that point the session is already marked paid,
   * the payment row is written and the ledger is posted, so the sponsor has a
   * free session and the books do not balance.
   *
   * So this stays as an EARLY EXIT, which is worth having because it avoids the
   * work and gives the patient the right message, and the actual claim on the
   * money is made below with the condition in the WHERE clause. The same
   * construction `settleSessionPayment` and `cancelSession` use, for the same
   * reason: a read followed by a write is not a decision, it is a guess with a
   * window in it.
   */
  /*
   * 🔴 Against the SPONSOR'S SHARE, not the gross. A pot covering 40% of a $70
   * session needs $28, and refusing on $70 would turn a funded booking away
   * because a pot could not afford a number nobody is asking it for.
   */
  /**
   * Give the provisional allowance back. Unconditional, like the pot's own
   * compensating credit: we took it a moment ago and the thing it was for did
   * not happen, so putting it back can never be wrong.
   */
  const releaseProvisional = async () => {
    if (!provisionalClaimed) return;
    await controlDb
      .update(enrolments)
      .set({
        provisionalSessionsUsed: sql`GREATEST(0, ${enrolments.provisionalSessionsUsed} - 1)`,
        updatedAt: new Date(),
      })
      .where(eq(enrolments.id, benefit.enrolmentId));
  };

  /*
   * 🔴 W2-S08: UNSPENT MONEY EXPIRES ON ITS DATE, AND NOW IT DOES.
   *
   * The pot page, the top-up form and every invoice say "Unspent money expires
   * on {date}", and no code read the date: an expired pot paid for sessions for
   * ever. It stops here, at booking, the same place an empty pot stops, so the
   * employee is offered the ordinary pay link. The company is warned by
   * `alertPots` thirty days before, and on its own pot page.
   *
   * Nothing is written off. What happens to an expired balance is the refund
   * policy agreed when the pot opened (C233), which is a person's decision and
   * not this function's.
   */
  if (pot.expiresAt && pot.expiresAt.getTime() <= Date.now()) {
    log.info("pot has expired and funds nothing", { session: ref(sessionId) });
    await releaseProvisional();
    return { paid: false, reason: "expired" };
  }

  if (pot.balanceCents + pot.overdraftCents < sponsorShare) {
    log.info("pot cannot fund this booking", { session: ref(sessionId) });
    await releaseProvisional();

    /*
     * 🔴 W1-20: NOBODY IS EMAILED FROM HERE, and that is the fix, not a gap.
     *
     * This used to alert the sponsor's admins on every booking that hit an
     * empty pot. Every one of those emails repeated the last, and each one's
     * arrival told an employer the moment somebody tried to book (E1, "never
     * when"). The alert now comes from the daily billing job, `alertPots`, once
     * per pot until the next top-up, with a low-balance warning before it.
     */
    return { paid: false, reason: "insufficient" };
  }

  const settings = await getSettings();
  /*
   * 🔴 C313 — OUR CUT IS ON THE FULL PRICE, whoever paid which part of it.
   *
   * `sessionMoney` still takes the gross. A partly covered session is not a
   * cheaper session: the therapist is paid on the full price and our 15% is on
   * the full price, and nothing about the split reaches an earnings screen.
   * Taking the fee on the sponsor's share alone would make a clinician's
   * revenue depend on their patient's employer, which is both wrong and a way
   * to infer who is sponsored.
   */
  const money = sessionMoney({
    grossCents: gross,
    feeBps: settings.session.platformFeeBps,
    /*
     * 🔴 Zero, and the reason is above: the taxable supply was the top-up.
     * Passing the patient's country VAT here would tax the employer's money a
     * second time in a jurisdiction that has no claim on it.
     */
    vatBps: 0,
  });

  /*
   * 🔴 C382 — THE MONEY IS CLAIMED FIRST, because it is the scarce thing.
   *
   * The debit moved up here from the end of the function and gained its
   * condition. `balance + overdraft >= gross` inside the WHERE means two
   * concurrent bookings cannot both succeed: Postgres serialises the two
   * updates on the row, the second re-evaluates the predicate against the first
   * one's result, and matches nothing.
   *
   * Order matters as much as the condition. The pot is the resource that can
   * run out; the session claim is idempotency. Claiming the session first and
   * discovering the pot is empty afterwards leaves a session marked paid that
   * nobody paid for, which is exactly what the CHECK constraint firing used to
   * produce.
   */
  const [debited] = await controlDb
    .update(sponsorPots)
    /* 🔴 60.1 — the SPONSOR'S SHARE leaves the pot, never the gross. */
    .set({
      balanceCents: sql`${sponsorPots.balanceCents} - ${sponsorShare}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sponsorPots.id, pot.potId),
        sql`${sponsorPots.balanceCents} + ${sponsorPots.overdraftCents} >= ${sponsorShare}`,
      ),
    )
    .returning({ id: sponsorPots.id });

  if (!debited) {
    log.info("pot lost the race to fund this booking", { session: ref(sessionId) });
    await releaseProvisional();
    return { paid: false, reason: "insufficient" };
  }

  const fullyCovered = gross - sponsorShare <= 0;

  /*
   * 🔴 THE PAYMENT ROW IS THE CLAIM NOW, AND 60.1 IS WHY IT HAD TO MOVE.
   *
   * It used to be the session's own status: `pending -> paid`, conditional on
   * `pending`, so a second call matched nothing and the compensating credit put
   * the money back. That worked while a pot paid all or nothing.
   *
   * It stops working the moment coverage is partial, because a partly covered
   * session STAYS `pending` — the patient still owes their share — so a
   * `pending -> pending` update matches every time and a second call would
   * debit the pot again. The guard would have looked untouched and silently
   * stopped guarding, which is this repository's most common defect shape.
   *
   * `session_payments` is unique on `session_id`, so inserting it is the claim:
   * exactly one caller wins, whatever the session's status is or becomes.
   */
  const [payment] = await controlDb
    .insert(sessionPayments)
    .values({
      organizationId: row.organizationId,
      therapistId: row.therapistId,
      sessionId,
      /* 🔴 C243 — NULL. The employer is never the payer name on a clinical surface. */
      payerName: null,
      payerEmail: null,
      grossCents: gross,
      currency: "usd",
      vatCents: 0,
      vatBps: 0,
      /*
       * 🔴 60.2 / C311 — THE FROZEN SPLIT, written here and read for ever after.
       *
       * Three numbers because a percentage alone does not survive a rounding
       * argument, and because a refund has to apportion on the figures the
       * patient was actually shown rather than on a percentage that may since
       * have moved (C315).
       */
      coverageBps,
      sponsorShareCents: sponsorShare,
      patientShareCents: gross - sponsorShare,
      platformFeeCents: money.platformCutCents,
      platformFeeBps: settings.session.platformFeeBps,
      settledInvoiceCents: 0,
      therapistNetCents: money.therapistNetCents,
      capture: "platform",
      crossing: crossingFor({
        paidVia: "pot",
        therapist: payoutRailFor({
          stripeAccountId: row.stripeAccountId,
          payoutsEnabled: row.payoutsEnabled,
          country: row.therapistCountry,
        }),
      }),
      status: "paid",
      paidAt: new Date(),
      fundingSource: "pot",
    })
    .onConflictDoNothing({ target: sessionPayments.sessionId })
    .returning({ id: sessionPayments.id });

  if (!payment) {
    /*
     * 🔴 The compensating credit, and it is unconditional on purpose.
     *
     * We took this money one statement ago and the thing it was for did not
     * happen. Putting it back can never be wrong and can never overdraw
     * anything, so it carries no predicate that could fail and leave a sponsor
     * short.
     */
    await controlDb
      .update(sponsorPots)
      .set({
        balanceCents: sql`${sponsorPots.balanceCents} + ${sponsorShare}`,
        updatedAt: new Date(),
      })
      .where(eq(sponsorPots.id, pot.potId));

    await releaseProvisional();
    return { paid: false, reason: "nothing_to_pay" };
  }

  /*
   * 🔴 AND THE SESSION'S STATUS, AFTER THE CLAIM RATHER THAN AS THE CLAIM.
   *
   * `paid` only when the employer covers all of it. A partly covered session is
   * not a paid session: the patient owes their share, and every screen that
   * asks `paymentStatus === "paid"` — the join page, the room, the pay page —
   * would otherwise let them into a session they have not finished paying for
   * and never show them a link to finish.
   *
   * Guarded on `pending` so this cannot reopen a session some other path has
   * already settled by card.
   */
  if (fullyCovered) {
    await controlDb
      .update(sessions)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(and(eq(sessions.id, sessionId), eq(sessions.paymentStatus, "pending")));
  }

  /*
   * 🔴 53.16 / C232 — ONE txn id across both halves, which is what makes
   * "every pot cent traces to one payment in and one session out" true.
   *
   * Two calls rather than one, because the legs of a `journal` call carry ONE
   * `ref_type`/`ref_id` pair and these two halves are about different things:
   * the first is the sponsor's pot going down, the second is the session
   * payment being distributed. They share the `txnId`, so the daily
   * reconciliation still sums each transaction to zero and a person auditing a
   * pot cent can walk from the pot leg to the session payment.
   *
   * The two `cash` legs cancel, and that cancellation is the statement: NO CASH
   * MOVES when a pot pays. It arrived at top-up.
   */
  const txnId = crypto.randomUUID();

  await journal({
    kind: "session_payment",
    txnId,
    /*
     * 🔴 The sponsor is on `ref_type`/`ref_id` and nowhere else.
     *
     * `ledger_entries` has `organization_id` and `user_id` and a sponsor is
     * neither (C259): an FK to `organizations` would be the join C244 forbids,
     * written into the ledger. The generic ref is what every sponsor figure in
     * `lib/data/sponsors.ts` queries.
     */
    refType: "sponsor",
    refId: benefit.sponsorId,
    legs: [
      {
        account: "sponsor_pot",
        /*
         * 🔴 POSITIVE, because `sponsor_pot` is a LIABILITY and spending it
         * reduces what we owe. A top-up is the negative one. The first draft of
         * `weeklySpend` read the signs the other way round and would have
         * charted every deposit as expenditure.
         */
        amountCents: sponsorShare,
        memo: "A session spent this sponsor's pot",
      },
      {
        account: "cash",
        amountCents: -sponsorShare,
        memo: "Funded from the pot; the cash for it arrived at top-up",
      },
    ],
  });

  const { postSessionPayment } = await import("./ledger");
  await postSessionPayment({
    id: payment.id,
    organizationId: row.organizationId,
    therapistId: row.therapistId,
    capture: "platform",
    grossCents: gross,
    /*
     * 🔴 ZERO, and C241 is the reason rather than an oversight. VAT is charged
     * on the TOP-UP, in the entity that holds the pot, and a pot-funded
     * `session_payments` row carries `vat_cents = 0` for the same reason this
     * leg does: taxing the spend of money already taxed at purchase would
     * charge the employer twice.
     */
    vatCents: 0,
    platformFeeCents: money.platformCutCents,
    settledInvoiceCents: 0,
    therapistNetCents: money.therapistNetCents,
    /*
     * 🔴 W2-S12: THE SAME txn, which the comment above always said and the call
     * never did. Without it `refundToPot` could not find the pot a session was
     * paid from, and every pot refund stopped at "No pot spend is on the books".
     */
    txnId,
  });

  // 🔴 C382 — the debit used to be here, unconditional, after every irreversible
  // effect above it. It is now the first thing this function claims.

  /* W2-S10: the company's money entry, for a person who has been told. */
  await recordMoneyEntry({
    sponsorId: benefit.sponsorId,
    enrolmentId: benefit.enrolmentId,
    kind: "session",
    ...moneyEntryFigures({
      grossCents: gross,
      coverageBps,
      sponsorShareCents: sponsorShare,
      patientShareCents: gross - sponsorShare,
    }),
    paidAt: new Date(),
  });

  log.info("session funded from a pot", { session: ref(sessionId) });
  /*
   * 🔴 The SPONSOR'S SHARE is what was paid from the pot, and the caller uses
   * this to decide whether the patient still owes anything. Returning the gross
   * here would tell the booking path the whole session was covered when 40% of
   * it was.
   */
  return { paid: true, sponsorId: benefit.sponsorId, amountCents: sponsorShare };
}

/**
 * 🔴 C383 — give a sponsor their money back, which was impossible.
 *
 * ## What was wrong
 *
 * `refundSessionPayment` is the only refund path in this product and its third
 * guard is `if (!payment.stripePaymentIntentId) return { error: "That payment
 * has no Stripe charge to refund." }`. A pot payment has no Stripe charge by
 * construction: the money arrived at top-up and the session only moved it.
 *
 * So a no-show, a cancellation or an admin correction on a sponsored session
 * returned nothing. The employer paid for a session that did not happen, every
 * time, and the only way to put it right was a manual ledger adjustment by a
 * super admin who knew to look.
 *
 * ## Finding the sponsor without creating the join C244 forbids
 *
 * `session_payments` deliberately carries NO sponsor id. C244 is explicit that
 * no screen, the admin console included, may join a sponsor to a session, and a
 * column there would put that join one line of SQL away for ever.
 *
 * The ledger already holds it, on `ref_type`/`ref_id`, which is inside the wall
 * rather than outside it: the pot's own accounting has to know whose pot it is.
 * So this walks the transaction rather than adding a column, and the sponsor is
 * never returned to the caller.
 *
 * ## The reversal reuses the transaction id
 *
 * `journal` takes a `txnId` for exactly this, so a person auditing a pot cent
 * can walk from the spend to the reversal and see them as one story rather than
 * two unrelated entries that happen to cancel.
 *
 * ## 🔴 W2-S12: THE POT'S SHARE, AND ONLY THE POT'S HALF OF THE REFUND
 *
 * This credited the pot, and journalled, `grossCents`: a 50% covered $100
 * session refunded put $100 into a pot that had paid $50. It never actually
 * ran, because the walk below looked for the pot leg in the payment's own
 * transaction and `payFromPot` never passed its txn id on, so every pot refund
 * stopped at "No pot spend is on the books" and went to the manual queue for
 * the whole price.
 *
 * Now it returns `sponsorShareCents` (`sharesOf`), and nothing else. The
 * employee's half, and the session's own books, are `refundSessionPayment`'s:
 * this function is the company's money only, which is why it never marks the
 * payment refunded. Returned at most once per payment: the row is locked and a
 * reversal already on the books returns nothing, so a refund asked for twice
 * (an admin retry, the queue sending the employee's half later) cannot credit
 * the pot twice.
 */
export async function refundToPot(input: {
  paymentId: string;
  reason: string;
}): Promise<{ ok?: true; returnedCents?: number; error?: string }> {
  const outcome = await controlDb.transaction(async (tx) => {
    const [payment] = await tx
      .select({
        id: sessionPayments.id,
        sessionId: sessionPayments.sessionId,
        grossCents: sessionPayments.grossCents,
        status: sessionPayments.status,
        fundingSource: sessionPayments.fundingSource,
        coverageBps: sessionPayments.coverageBps,
        sponsorShareCents: sessionPayments.sponsorShareCents,
        patientShareCents: sessionPayments.patientShareCents,
        paidAt: sessionPayments.paidAt,
      })
      .from(sessionPayments)
      .where(eq(sessionPayments.id, input.paymentId))
      .limit(1)
      .for("update");

    if (!payment) return { error: "Payment not found." };
    if (payment.fundingSource !== "pot") return { error: "That payment did not come from a pot." };
    if (payment.status !== "paid") return { error: "Only a settled payment can be refunded." };

    const spend = await potSpendOf(tx, payment);
    if (!spend) return { error: "No pot spend is on the books for that session." };

    /*
     * `sponsor_pot` legs are positive when spent, because the pot is a
     * liability and spending it reduces what we owe. A reversal is the negative
     * one, under the spend's own txn id, so its presence is the fact that this
     * pot already has its money back.
     */
    const [already] = await tx
      .select({ id: ledgerEntries.id })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.txnId, spend.txnId),
          eq(ledgerEntries.account, "sponsor_pot"),
          eq(ledgerEntries.refType, "sponsor"),
          sql`${ledgerEntries.amountCents} < 0`,
        ),
      )
      .limit(1);
    if (already) return { ok: true as const, returnedCents: 0 };

    const [pot] = await tx
      .select({ id: sponsorPots.id })
      .from(sponsorPots)
      .where(eq(sponsorPots.sponsorId, spend.sponsorId))
      .limit(1);
    if (!pot) return { error: "That sponsor no longer has a pot." };

    const { potCents } = sharesOf(payment);

    /*
     * 🔴 The credit is unconditional. Putting money back can never overdraw
     * anything, so it carries no predicate that could fail and leave a sponsor
     * short of money we have already agreed to return.
     */
    await tx
      .update(sponsorPots)
      .set({
        balanceCents: sql`${sponsorPots.balanceCents} + ${potCents}`,
        updatedAt: new Date(),
      })
      .where(eq(sponsorPots.id, pot.id));

    await journal({
      kind: "session_payment",
      txnId: spend.txnId,
      refType: "sponsor",
      refId: spend.sponsorId,
      executor: tx,
      legs: [
        { account: "sponsor_pot", amountCents: -potCents, memo: input.reason.slice(0, 200) },
        { account: "cash", amountCents: potCents, memo: "Returned to the pot" },
      ],
    });

    return { ok: true as const, returnedCents: potCents, sponsorId: spend.sponsorId, payment };
  });

  if (!("payment" in outcome) || !outcome.payment) {
    return "error" in outcome ? { error: outcome.error } : { ok: true, returnedCents: 0 };
  }
  const { payment, sponsorId } = outcome;

  /*
   * W2-S10: the money back, as its own entry in the company's ledger, if the
   * session it reverses was in it. Found through the payment's own session
   * here, inside the money path, and never written to the entry. After the
   * transaction, because the pool has one connection and the transaction held
   * it.
   */
  const [told] = await controlDb
    .select({ enrolmentId: enrolments.id })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(
      enrolments,
      and(eq(enrolments.personId, patients.personId), eq(enrolments.sponsorId, sponsorId)),
    )
    .where(eq(sessions.id, payment.sessionId))
    .limit(1);

  if (told) {
    await recordMoneyEntry({
      sponsorId,
      enrolmentId: told.enrolmentId,
      kind: "refund",
      /* 🔴 W2-S12: the session's own figures, as frozen. Never the whole price covered. */
      ...moneyEntryFigures(payment),
      /* Written only if the session itself was: told before it was paid. */
      paidAt: payment.paidAt ?? new Date(),
    });
  }

  log.info("pot share returned", { session: ref(payment.sessionId) });
  return { ok: true, returnedCents: outcome.returnedCents };
}

type Tx = Parameters<Parameters<typeof controlDb.transaction>[0]>[0];

/**
 * The pot a session was paid from, walked out of the ledger.
 *
 * `ledger_entries` has no session id, deliberately: it keys on
 * `ref_type`/`ref_id`. `postSessionPayment` refs the PAYMENT, and `payFromPot`
 * posts its pot leg under the SAME txn id (W2-S12 made that true), so the pot
 * leg is the positive `sponsor_pot` leg in any transaction that refs this
 * payment.
 *
 * 🔴 A pot session paid before W2-S12 has its pot leg in a transaction of its
 * own, posted a moment before the payment's, by the same call. For those only:
 * the frozen amount, from a sponsor this person is enrolled with, nearest in
 * time to the payment and within a minute of it. Nearest, so the same leg is
 * found every time and the reversal check above stays true.
 */
async function potSpendOf(
  tx: Tx,
  payment: {
    id: string;
    sessionId: string;
    grossCents: number;
    coverageBps: number;
    sponsorShareCents: number;
    patientShareCents: number;
    paidAt: Date | null;
  },
): Promise<{ txnId: string; sponsorId: string } | null> {
  const [same] = await tx
    .select({ txnId: ledgerEntries.txnId, sponsorId: ledgerEntries.refId })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        sql`${ledgerEntries.amountCents} > 0`,
        inArray(
          ledgerEntries.txnId,
          tx
            .select({ txnId: ledgerEntries.txnId })
            .from(ledgerEntries)
            .where(
              and(
                eq(ledgerEntries.refType, "session_payment"),
                eq(ledgerEntries.refId, payment.id),
              ),
            ),
        ),
      ),
    )
    .limit(1);
  if (same?.sponsorId) return { txnId: same.txnId, sponsorId: same.sponsorId };

  if (!payment.paidAt) return null;
  const [person] = await tx
    .select({ personId: patients.personId })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .where(eq(sessions.id, payment.sessionId))
    .limit(1);
  if (!person?.personId) return null;

  const paidAt = payment.paidAt.toISOString();
  const [near] = await tx
    .select({ txnId: ledgerEntries.txnId, sponsorId: ledgerEntries.refId })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.amountCents, sharesOf(payment).potCents),
        inArray(
          ledgerEntries.refId,
          tx
            .select({ sponsorId: enrolments.sponsorId })
            .from(enrolments)
            .where(eq(enrolments.personId, person.personId)),
        ),
        sql`${ledgerEntries.createdAt} BETWEEN ${paidAt}::timestamptz - interval '1 minute'
                                        AND ${paidAt}::timestamptz + interval '1 minute'`,
      ),
    )
    .orderBy(sql`abs(extract(epoch from ${ledgerEntries.createdAt} - ${paidAt}::timestamptz))`)
    .limit(1);
  return near?.sponsorId ? { txnId: near.txnId, sponsorId: near.sponsorId } : null;
}

/**
 * 🔴 W2-S10 / FIX-PLAN D1: ONE MONEY ENTRY FOR THE COMPANY, WITH NOBODY IN IT.
 *
 * Written here, where the split has just been frozen, so the company's ledger
 * (`lib/data/sponsor-ledger.ts`) never joins anything to read it. The entry
 * carries the price, the coverage, the two shares, the Monday of the week and a
 * random `shuffle`; no session, person, therapist or payment id, and no time.
 *
 * 🔴 ONLY FOR A PERSON WHO WAS TOLD FIRST. `ledger_told_at` is set when the
 * in-app notice reaches them (`tellEnrolledAboutLedger`), and a session paid
 * before it never enters a view they were not told about.
 *
 * 🔴 Never allowed to fail a payment. The told-at read is its own query, so a
 * payment still works on a database that has not had 0134 yet (H16), and any
 * failure is logged: a missing report line is recoverable, a refused booking
 * is not.
 */
async function recordMoneyEntry(input: {
  sponsorId: string;
  enrolmentId: string;
  kind: "session" | "refund";
  priceCents: number;
  coverageBps: number;
  coveredCents: number;
  employeeCents: number;
  paidAt: Date;
}): Promise<void> {
  try {
    const [row] = await controlDb
      .select({ toldAt: enrolments.ledgerToldAt })
      .from(enrolments)
      .where(eq(enrolments.id, input.enrolmentId))
      .limit(1);
    if (!row?.toldAt || row.toldAt.getTime() > input.paidAt.getTime()) return;

    const { weekStartOf } = await import("@/lib/sponsor/ledger");
    const { randomInt } = await import("node:crypto");
    await controlDb.insert(sponsorMoneyEntries).values({
      sponsorId: input.sponsorId,
      kind: input.kind,
      weekStart: weekStartOf(new Date()),
      priceCents: Math.max(0, input.priceCents),
      coverageBps: input.coverageBps,
      coveredCents: Math.max(0, input.coveredCents),
      employeeCents: Math.max(0, input.employeeCents),
      shuffle: randomInt(0, 2_147_483_647),
    });
  } catch (error) {
    log.warn("company money entry not written", { reason: safeErrorMessage(error) });
  }
}

/**
 * Money in. PLAN.md 53.11, 53.12, 53.13, C233, C241.
 *
 * 🔴 The terms are a precondition rather than a footnote. A pot with no refund
 * policy and no expiry cannot hold money — the database refuses it — so this
 * refuses the top-up with the reason rather than letting the insert fail with a
 * constraint name.
 *
 * 🔴 W1-01: ONLY AFTER A CONFIRMED CHARGE. This used to journal cash as
 * received on nothing but a form post, so the card rail credited money nobody
 * paid. It now asks the processor whether the named charge succeeded for this
 * sponsor and this amount, and refuses otherwise. No screen calls it today: the
 * card rail is off until a checkout exists to produce that charge.
 */
export async function topUpPot(input: {
  sponsorId: string;
  amountCents: number;
  /** Who authorised it, for the audit. A sponsor user id, never an `Actor`. */
  bySponsorUserId: string | null;
  /** The processor's record that the money arrived. Required, never optional. */
  confirmedCharge: { paymentIntentId: string };
}): Promise<{ ok?: true; error?: string }> {
  const intentId = input.confirmedCharge?.paymentIntentId?.trim();
  if (!intentId) return { error: "There is no confirmed payment for this top-up." };

  const settings = await getSettings();

  const [sponsor] = await controlDb
    .select({ id: sponsors.id, entity: sponsors.entity, state: sponsors.state })
    .from(sponsors)
    .where(eq(sponsors.id, input.sponsorId))
    .limit(1);

  if (!sponsor) return { error: "That account no longer exists." };
  if (sponsor.state !== "active") {
    return { error: "This account is not active yet. We will call you first." };
  }

  /*
   * 🔴 C241 — THE EGYPTIAN ENTITY DOES NOT TAKE A CORPORATE PAYMENT YET.
   *
   * Egyptian e-invoicing is confirmed with counsel before it does. Refused in
   * plain words, here, rather than taking the money and issuing a document we
   * cannot stand behind: an invoice that does not satisfy the ETA is worse than
   * no invoice, because the customer files it.
   */
  if (sponsor.entity === "eg") {
    return {
      error:
        "We cannot take a corporate payment into our Egyptian entity yet. Talk to us and we will arrange it another way.",
    };
  }

  if (input.amountCents < settings.sponsor.minTopUpCents) {
    return { error: "That is below the minimum top up." };
  }

  const pot = await potRow(input.sponsorId);
  if (!pot.potId) {
    return { error: "This account has no pot yet. We open it with you, with the terms agreed." };
  }

  /*
   * 🔴 C233 — the terms are decided before any money, and read before this
   * line. The database refuses a balance above zero without them, so this check
   * is the message rather than the rule.
   */
  const [terms] = await controlDb
    .select({ refundPolicy: sponsorPots.refundPolicy, expiresAt: sponsorPots.expiresAt })
    .from(sponsorPots)
    .where(eq(sponsorPots.id, pot.potId))
    .limit(1);

  if (!terms?.refundPolicy || !terms.expiresAt) {
    return { error: "The refund and expiry terms have to be agreed before a top up." };
  }

  /*
   * 🔴 76.1 — `amountCents` IS THE CREDIT, AND THE TAX IS CHARGED ON TOP OF IT.
   *
   * This block used to divide the tax back out of the figure, so a $5,000
   * top-up credited $4,386. `potTopUpMoney` says at length why that direction
   * was wrong and why it is the same direction on both rails now.
   *
   * 🔴 NOTHING MOVES TODAY. `topUpPot` accepts only the `us` entity (C241 gates
   * the Egyptian one behind e-invoicing) and the US rate is 0, so the credit and
   * the charge are the same number here and always have been. The change is that
   * the day Egypt opens, this rail and the manual one will already agree about
   * what a company was asked for.
   */
  const vatBps = await entityVatBps(sponsor.entity);
  const { creditCents: net, vatCents: vat, settlesCents: charged } = potTopUpMoney({
    creditCents: input.amountCents,
    vatBps,
  });

  /*
   * 🔴 The charge must have succeeded, for exactly what we credit against, and
   * for this sponsor. One charge credits once: its id is on the cash leg.
   */
  const memo = `Card payment ${intentId}`.slice(0, 200);
  if (!(await chargeSucceeded(intentId, charged, input.sponsorId))) {
    return { error: "There is no confirmed payment for this top-up." };
  }
  const [already] = await controlDb
    .select({ id: ledgerEntries.id })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.account, "cash"), eq(ledgerEntries.memo, memo)))
    .limit(1);
  if (already) return { error: "That payment has already been added to the pot." };

  await journal({
    kind: "pot_topup",
    refType: "sponsor",
    refId: input.sponsorId,
    legs: [
      {
        account: "cash",
        /* 🔴 What we CHARGED, which is the credit plus the tax on it. */
        amountCents: charged,
        memo,
      },
      {
        account: "vat_payable",
        /* Negative, the same liability convention. Zero legs are dropped. */
        amountCents: -vat,
        memo: "VAT on the top-up, owed to the tax authority",
      },
      {
        account: "sponsor_pot",
        /* Negative: a liability rises with a negative amount. It is their money. */
        amountCents: -net,
        memo: "Held for this sponsor until a session spends it",
      },
    ],
  });

  await controlDb
    .update(sponsorPots)
    .set({
      balanceCents: sql`${sponsorPots.balanceCents} + ${input.amountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(sponsorPots.id, pot.potId));

  /* W2-S02: the company's own money in, published at once. */
  await publishTopUp(input.sponsorId, net);

  log.info("pot topped up", { sponsor: ref(input.sponsorId) });
  return { ok: true };
}

/**
 * 🔴 W2-S02: A TOP-UP IS PUBLISHED THE MOMENT IT LANDS, and only the top-up.
 *
 * `potBalance` republished only when pot-funded sessions moved `activityFloor`
 * past the last publication, so a company that paid in read the old balance, or
 * "not enough activity", until five more sessions were spent. A top-up is the
 * company's own act and names nobody, so it is published at once.
 *
 * 🔴 ADDED TO THE PUBLISHED FIGURE, NEVER COPIED FROM THE LIVE ONE. Publishing
 * the live balance here would hand over every session spent since the last
 * publication in one subtraction (published, plus top-up, minus shown), which is
 * C229's differencing attack arriving through the money coming in. So the credit
 * is added to what was already published, and the spend waits for the floor.
 *
 * A pot that has never published starts from every credit it has ever had
 * (`pot_topup` legs only, this one included), which is its balance before any
 * reported session. Called after the journal, so that sum can see this credit.
 */
export async function publishTopUp(sponsorId: string, creditCents: number): Promise<void> {
  const credit = Math.max(0, Math.round(creditCents));
  if (credit === 0) return;

  await controlDb.execute(sql`
    UPDATE sponsor_pots
       SET published_balance_cents = CASE
             WHEN published_balance_cents IS NULL THEN (
               SELECT COALESCE(-SUM(l.amount_cents), 0)::int
                 FROM ledger_entries l
                WHERE l.account = 'sponsor_pot'
                  AND l.ref_type = 'sponsor'
                  AND l.ref_id = ${sponsorId}
                  AND l.txn_kind = 'pot_topup')
             ELSE published_balance_cents + ${credit}
           END,
           updated_at = now()
     WHERE sponsor_id = ${sponsorId}`);
}

/** Asked of the processor, never of the browser. Any doubt is a no. */
async function chargeSucceeded(
  paymentIntentId: string,
  amountCents: number,
  sponsorId: string,
): Promise<boolean> {
  const { getStripe } = await import("./stripe");
  const client = getStripe();
  if (!client) return false;

  try {
    const intent = await client.paymentIntents.retrieve(paymentIntentId);
    return (
      intent.status === "succeeded" &&
      intent.currency === "usd" &&
      intent.amount_received === amountCents &&
      intent.metadata?.sponsorId === sponsorId
    );
  } catch (error) {
    log.warn("pot charge not confirmed", { reason: safeErrorMessage(error) });
    return false;
  }
}

/**
 * 🔴 53.16 / C232 — the pot's half of the daily reconciliation.
 *
 * Two numbers that must agree: the balance on `sponsor_pots`, which every
 * spending decision reads, and the ledger, which is the record. They are
 * maintained by the same functions and they can still drift — a crash between
 * the journal and the balance update leaves exactly that. So the redundancy is
 * the check rather than a smell: a disagreement is a number, found by a job,
 * rather than a pot that quietly over- or under-spends for a month.
 */
export async function reconcilePots(): Promise<
  { sponsorId: string; tableCents: number; ledgerCents: number; deltaCents: number }[]
> {
  const rows = await controlDb.execute(sql`
    SELECT p.sponsor_id                                       AS sponsor_id,
           p.balance_cents                                    AS table_cents,
           COALESCE((SELECT -SUM(l.amount_cents)
                       FROM ledger_entries l
                      WHERE l.account   = 'sponsor_pot'
                        AND l.ref_type  = 'sponsor'
                        AND l.ref_id    = p.sponsor_id), 0)   AS ledger_cents
      FROM sponsor_pots p`);

  return (rows.rows as { sponsor_id: string; table_cents: number; ledger_cents: number }[])
    .map((row) => ({
      sponsorId: row.sponsor_id,
      tableCents: Number(row.table_cents),
      ledgerCents: Number(row.ledger_cents),
      deltaCents: Number(row.table_cents) - Number(row.ledger_cents),
    }))
    .filter((row) => row.deltaCents !== 0);
}

/**
 * 🔴 53.27 — the balance a SPONSOR reads comes from the ledger.
 *
 * `sponsor_pots.balance_cents` is what the spending decision reads, because a
 * booking cannot afford an aggregate over every leg ever posted. What a sponsor
 * is SHOWN is the ledger, because the ledger is the record and because a figure
 * on a screen that disagrees with the books is how a customer finds a bug we
 * should have found.
 */
export async function ledgerPotBalance(sponsorId: string): Promise<number> {
  const [row] = await controlDb
    .select({
      cents: sql<number>`COALESCE(-SUM(${ledgerEntries.amountCents}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
      ),
    );

  return row?.cents ?? 0;
}

/** Total spent out of this pot, ever, from the ledger. 53.25, 53.27. */
export async function potTotals(
  sponsorId: string,
): Promise<{ spentCents: number; sessions: number }> {
  const [row] = await controlDb
    .select({
      cents: sql<number>`COALESCE(SUM(${ledgerEntries.amountCents}), 0)::int`,
      sessions: sql<number>`COUNT(*)::int`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.account, "sponsor_pot"),
        eq(ledgerEntries.refType, "sponsor"),
        eq(ledgerEntries.refId, sponsorId),
        sql`${ledgerEntries.amountCents} > 0`,
      ),
    );

  return { spentCents: row?.cents ?? 0, sessions: row?.sessions ?? 0 };
}

/**
 * 🔴 E1 — what was spent across the first `sessions` pot spends, in the order
 * they happened. The spend that goes with a PUBLISHED session count.
 *
 * The company overview printed `potTotals` live beside the floored balance,
 * so "Sessions paid for" went up by one and "Spent so far" by one price the
 * moment one employee had one session: the differencing attack the balance's
 * floor exists to stop, printed twice beside it (seen on production,
 * `takeover/walk/RESULTS.md`). The count is published in floor-sized steps by
 * `potBalance`; this is the money that belongs to that count, and it moves
 * only when the count does.
 */
export async function potSpentThrough(sponsorId: string, sessions: number): Promise<number> {
  if (sessions <= 0) return 0;
  const result = await controlDb.execute<{ cents: number | null }>(sql`
    SELECT COALESCE(SUM(amount_cents), 0)::int AS cents FROM (
      SELECT ${ledgerEntries.amountCents} AS amount_cents
      FROM ${ledgerEntries}
      WHERE ${ledgerEntries.account} = 'sponsor_pot'
        AND ${ledgerEntries.refType} = 'sponsor'
        AND ${ledgerEntries.refId} = ${sponsorId}
        AND ${ledgerEntries.amountCents} > 0
      ORDER BY ${ledgerEntries.createdAt}, ${ledgerEntries.id}
      LIMIT ${sessions}
    ) first_n
  `);
  return Number(result.rows[0]?.cents ?? 0);
}

async function potRow(sponsorId: string) {
  const [pot] = await controlDb
    .select({
      potId: sponsorPots.id,
      /* W2-S08: read at booking, so an expired pot funds nothing. */
      expiresAt: sponsorPots.expiresAt,
      balanceCents: sponsorPots.balanceCents,
      overdraftCents: sponsorPots.overdraftCents,
      /* 🔴 60.1 / C311 — what this employer covers, and any pending change. */
      coverageBps: sponsorPots.coverageBps,
      pendingCoverageBps: sponsorPots.pendingCoverageBps,
      pendingCoverageFrom: sponsorPots.pendingCoverageFrom,
    })
    .from(sponsorPots)
    .where(eq(sponsorPots.sponsorId, sponsorId))
    .limit(1);

  return pot ?? NO_POT;
}
