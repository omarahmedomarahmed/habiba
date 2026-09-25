import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";

import { sweepUndeliveredAlerts } from "@/lib/crisis/alerts";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { reconcileMissingCharges } from "@/lib/billing/service";
import { sweepRadar } from "@/lib/data/radar";
import { purgeExpiredLimits } from "@/lib/rate-limit";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { auditLog } from "@/lib/db/schema";
import { bearerMatches } from "@/lib/auth/shared-secret";
import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import { patientSessionLink } from "@/lib/sessions/patient-link";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("app/api/cron/[job]/route.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled work. Four jobs, three of them on a clock.
 *
 * ## The schedule, and why it is shaped like this
 *
 * All three run inside ten minutes of 03:00 UTC, and that is the whole trick.
 * Neon bills for the time the compute is *awake*, not for the work done, and a
 * cron holds the database up for the entire idle timeout it resets on the way
 * past. Three jobs spread across the day cost three wakes; three jobs inside
 * one idle window cost one. The five minutes of compute is the price, not the
 * few seconds of sweeping.
 *
 *   crisis     hourly :20  retries crisis alerts whose notification failed,
 *                     sweeps the radar, closes rooms a patient walked away
 *                     from, tells patients whose summary is written and
 *                     unclaimed, and runs the watchdog. SAFETY-RELEVANT.
 *   reminders  hourly :20  booking reminders, check-ins, webhooks, tax
 *                     documents, and the watchdog again.
 *   billing    03:05  charges completed sessions that produced no charge row,
 *                     which happens when a Stripe webhook is lost.
 *   retention  03:10  purges audit rows past six years, expired sessions,
 *                     spent rate-limit rows and errors past thirty days, and
 *                     takes clinicians with an expired licence off (W1-16).
 *
 * 🔴 0165: `crisis` WAS DAILY, and that was a launch blocker. A crisis alert
 * whose notification failed waited up to a day for its retry. It runs on the
 * same minute as `reminders`, so the two share one wake of the database (the
 * cost this note is about) rather than buying a second one.
 *
 * These were switched off for a while, when the product had no users and the
 * only thing an hourly sweep achieved was five minutes of paid compute per
 * hour to look at an empty table. That was the right call then and the wrong
 * one now: with the schedule off, a session whose room was closed without
 * being ended stayed `in_progress` with a null duration forever, and one is
 * sitting in the database as proof.
 *

 * Authenticated with a shared secret, because a cron endpoint that anyone can
 * hit is a free way to make the platform do work — and `retention` deletes
 * rows.
 *
 * ## Why the schedules are what they are
 *
 * Every one of these opens a database connection, and the database bills by
 * the hour it is *awake*, not by the work it does. Neon suspends an idle
 * compute a set time after the last query — so the real cost of a cron is not
 * its runtime, it is the whole idle timeout it resets on the way past.
 *
 * The first version of this ran `crisis` every five minutes against a
 * five-minute idle timeout, which meant the compute never suspended once: it
 * was billed for twenty-six of the thirty hours it had existed, with nobody
 * using the product at all.
 *
 * Moving to a quarter of an hour was an improvement and not a fix. Four wakes
 * an hour, each holding the database up for the full five-minute timeout, is
 * twenty minutes in every sixty — a third of the clock, in perpetuity, for an
 * idle product. Vercel's own logs made it plain: twenty-four hits on
 * /api/cron/crisis in six hours and eleven on everything else combined.
 *
 * So the schedule went hourly — and then to nothing at all, once it was clear
 * that hourly still meant five minutes of paid compute every hour to sweep an
 * empty table. The history below is kept because it is the reasoning to
 * re-apply when the schedules come back, not because it describes today.
 *
 * ## What moved, and why that is the actual fix
 *
 * Of the three sweeps inside `crisis`, only one was time-critical: a patient
 * left sitting in an empty room, which is measured in ten minutes. Catching
 * that with a clock meant waking the database constantly to ask a question
 * whose answer is almost always "nobody is waiting".
 *
 * It is now checked on the patient's own five-second poll instead — see
 * `markAbandonedIfWaiting`. The event that matters is the patient waiting, and
 * that patient is already talking to us. Nothing runs when nobody is waiting,
 * and when somebody is, it fires at ten minutes rather than at whatever point
 * the next cron happens to land.
 *
 * What is left here is a backstop for the one case the poll cannot see: a
 * patient who closed the tab and walked away. An hour late is fine for that —
 * it decides when a clinician's warning email is sent, not whether anyone gets
 * help.
 *
 * The other two never needed the frequency. `sweepUndeliveredAlerts` retries
 * notifications that have already been persisted, and `sweepRadar` is
 * cosmetic: the reachability predicate excludes a stale clinician at query
 * time, so the board is correct whether or not the sweep has run.
 *
 * The radar sweep lives *inside* `crisis` for the same billing reason. Giving
 * it its own entry would buy a second set of wakes for work that costs nothing
 * to do alongside the first.
 *
 * ## The other half of this, which is not in this file
 *
 * The idle timeout itself. At Neon's default of five minutes, one hourly cron
 * still holds the compute up for five minutes an hour; at sixty seconds it is
 * one. That is a project setting ("Scale to zero after"), not code, and it is
 * worth strictly more than any schedule written here.
 */
/**
 * 🔴 C14 — ONE STEP OF A CHAIN, CAUGHT.
 *
 * The daily billing job is fifteen pieces of unrelated money work in a row, and
 * a throw in the first stopped the other fourteen, the tax documents and the
 * partner bills among them, every day until somebody read a log. Each step is
 * caught and named; the job answers with the ones that failed.
 */
async function step<T>(failed: string[], name: string, run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    failed.push(name);
    log.error("cron step failed", { step: name, reason: safeErrorMessage(error) });
    return null;
  }
}

const JOBS = {
  /**
   * Re-deliver crisis alerts that were persisted but whose notification failed.
   * This is the reason a failed notification does not lose an alert, and it is
   * the single most safety-relevant scheduled job in the system.
   */
  async crisis() {
    /*
     * 🔴 0165: HOURLY, AND EVERY PIECE ON ITS OWN.
     *
     * This ran once a day at 03:00 UTC with no step isolation, so a crisis
     * alert whose notification failed at 03:05 waited a day for its retry, and
     * a throw in any sweep stopped every sweep behind it. Each piece is now
     * caught and named (C14's `step`), and the alert retry goes first.
     */
    const failed: string[] = [];
    const delivered = await step(failed, "sweepUndeliveredAlerts", () => sweepUndeliveredAlerts());
    // Folded in rather than scheduled separately — see the note above. Both
    // are cheap sweeps and the expensive part is waking the database at all.
    // Flattened rather than nested: the log field type is a flat map, and a
    // nested object here is a type error at the call site rather than a
    // helpfully structured log line.
    const swept = await step(failed, "sweepRadar", () => sweepRadar());
    // And the one that matters most: a patient sitting in an empty room
    // because the clinician who advertised themselves never turned up.
    const { sweepAbandonedPatients, sweepUnratedSessions } = await import("@/lib/data/feedback");
    const left = await step(failed, "sweepAbandonedPatients", () => sweepAbandonedPatients());
    /*
     * And the patients whose summary is finished and who never came back for
     * it. Folded in here for the same billing reason as the radar sweep: the
     * expensive part is waking the database, not the query.
     *
     * The event-driven path in `approvePatientNote` catches most of these the
     * moment the clinician signs. This is the backstop for the ones it cannot
     * see — a note signed inside the first three-quarters of an hour, before
     * the reminder is allowed to send at all. Stamped per session
     * (`rating_reminder_at`), so an hourly run reminds each one once.
     */
    const unrated = await step(failed, "sweepUnratedSessions", () => sweepUnratedSessions());

    /*
     * And sessions that ran past the cap with nobody watching.
     *
     * The ladder fires on the polls both sides make, which is right — but a
     * session whose clinician closed the tab and whose patient never had one is
     * polled by nobody, so nothing ever ends it. It stays in progress with the
     * clinician marked unavailable on the public radar. One such row predates
     * this sweep.
     */
    const { sweepOverrunSessions } = await import("@/lib/data/sessions");
    const overrun = await step(failed, "sweepOverrunSessions", () => sweepOverrunSessions());

    /*
     * 🔴 W1-16: the licence sweep moved to `retention`, the daily wake, when
     * this job went hourly. A licence ends on a date, so it is a daily
     * question, and an hourly run would email a clinician about it at whatever
     * hour the date turned over in UTC.
     */

    /*
     * 🔴 0165: THE WATCHDOG. A scheduled job twice its interval late, or new
     * server errors in the last hour, emailed to the super admins at most once
     * a day each. `reminders` runs it too, so either hourly job stopping is
     * noticed by the other, and `ops_alerts` stops the pair sending twice.
     */
    const { watchdog } = await import("@/lib/observability/heartbeat");
    const watched = await step(failed, "watchdog", () => watchdog());

    return {
      failedSteps: failed.join(",") || undefined,
      delivered: delivered ?? undefined,
      released: swept?.released,
      wentOffline: swept?.offline,
      abandoned: swept?.abandoned,
      warned: left?.warned,
      suspended: left?.suspended,
      reminded: unrated?.reminded,
      overrunEnded: overrun?.ended,
      opsProblems: watched?.problems,
      opsAlerted: watched?.alerted,
    };
  },

  /**
   * W1-16: the licence sweep, reachable by hand like `radar`. Scheduled
   * inside `retention`, the daily wake, so it costs no wake of its own.
   */
  async licences() {
    const { sweepLicences } = await import("@/lib/data/licence-expiry");
    return sweepLicences();
  },

  /** Charge completed sessions that somehow produced no charge row. */
  async billing() {
    /* 🔴 C14: each step on its own, so one that throws does not stop the rest. */
    const failed: string[] = [];
    const reconciled = await step(failed, "reconcileMissingCharges", () => reconcileMissingCharges());

    /*
     * And send out anything we are still holding for a clinician Stripe has
     * since verified.
     *
     * The webhook and the settings page both release on their own, and this is
     * the backstop for when neither fires — a dropped `account.updated`, a
     * clinician who finished onboarding on their phone and never came back to
     * the page. It is somebody else's money; one missed event is not an
     * acceptable reason for it to sit here.
     */
    const { releaseAllHeldEarnings } = await import("@/lib/billing/connect");
    const released = await step(failed, "releaseAllHeldEarnings", () => releaseAllHeldEarnings());

    /*
     * 🔴 16.3b — the ageing payout alert.
     *
     * Here rather than on a schedule of its own for the reason at the top of
     * this file: a job that wakes on its own costs a wake, and this one is
     * cheap and belongs with the other money work. `alertAgedPayouts` sends
     * through `notify()`, so it reaches a phone **and** an email — a dashboard
     * nobody has open at 3am is not an alert.
     */
    const { alertAgedPayouts } = await import("@/lib/billing/payouts");
    const aged = await step(failed, "alertAgedPayouts", () => alertAgedPayouts());

    /* 🔴 0161 / ruling 13: every money act one person did alone, told to the super admins daily. */
    const { sendOneHandDigest } = await import("@/lib/billing/approvals");
    const oneHand = await step(failed, "sendOneHandDigest", () => sendOneHandDigest());

    /*
     * 🔴 53.19b / C247 — the re-verification cycle, and it is here rather than on
     * a schedule of its own for the reason at the top of this file: a job that
     * wakes on its own costs a whole idle timeout.
     *
     * It belongs with the money work because that is what it does. Without a
     * roster, nothing else can notice somebody has left an organisation, so this
     * is the only thing standing between a sponsor's pot and funding therapy for
     * somebody who resigned eight months ago.
     *
     * 🔴 It pauses the FUNDING. It does not remove anybody, and it touches no
     * record: two writes, `paused_at` on the enrolment and one notice to the
     * person. The remedy is in their hands, in the app, and an operator can undo
     * it in one statement.
     */
    const { pauseUnverified } = await import("@/lib/data/enrolment-verify");
    const reverified = await step(failed, "pauseUnverified", () => pauseUnverified());

    /* 🔴 0162 / ruling 15: off a company's staff list past the grace period, the benefit pauses. */
    const { pauseDroppedFromLists } = await import("@/lib/data/sponsor-email-list");
    const { getSettings: rulesNow } = await import("@/lib/settings");
    const dropped = await step(failed, "pauseDroppedFromLists", async () =>
      pauseDroppedFromLists((await rulesNow()).rules.enrolment.listRemovalGraceDays),
    );

    /*
     * 🔴 53.16 / C232 — the pot half of the daily reconciliation, counted here.
     *
     * `reconcilePots` returns only the pots whose balance column disagrees with
     * the ledger, so the number in this log line is zero every day until it is
     * not. The admin screen shows the same list; this is the line that appears in
     * a log an operator greps when a customer asks why a figure moved.
     */
    const { reconcilePots } = await import("@/lib/billing/pot");
    const potDrift = await step(failed, "reconcilePots", () => reconcilePots());
    if ((potDrift?.length ?? 0) > 0) {
      log.warn("pot balances disagree with the ledger", { pots: potDrift?.length });
    }

    /*
     * W1-20: a company whose pot is low or empty is told here, once per pot
     * until the next top-up, rather than from the booking that found it empty.
     * A daily email says nothing about when anybody booked.
     */
    const { alertPots } = await import("@/lib/billing/pot-alerts");
    const potAlerts = await step(failed, "alertPots", () => alertPots());

    /*
     * W2-S10: every enrolled person is told, in the app, that their company
     * sees each session's money with no name on it, BEFORE any of their
     * sessions enters that view. `payFromPot` checks the timestamp this sets.
     */
    const { tellEnrolledAboutLedger } = await import("@/lib/data/enrolment-verify");
    const ledgerTold = await step(failed, "tellEnrolledAboutLedger", () => tellEnrolledAboutLedger());

    /*
     * 🔴 59.16 / 59.13 — DUNNING, AND THE LAPSE THAT FOLLOWS IT.
     *
     * Sprint 57 shipped two monthly plans and named the absence of dunning as a
     * gap. So a renewal that failed produced silence, and then a plan ending.
     * Somebody losing a plan they meant to keep because a card expired and
     * nobody told them is the most avoidable churn there is.
     *
     * 🔴 REMINDERS FIRST, LAPSE SECOND, in that order and in the same run. The
     * other way round would lapse an obligation on the morning of its due date
     * and then send a reminder about it, which is worse than saying nothing.
     */
    /* 🔴 0160 — the next month on the transfer rail, raised before the reminders read it. */
    const { raiseManualRenewals } = await import("@/lib/billing/service");
    const renewals = await step(failed, "raiseManualRenewals", () => raiseManualRenewals());

    const { obligationsDueWithin, lapseOverdue, DUNNING_DAYS_BEFORE } = await import(
      "@/lib/billing/obligations"
    );
    const dueSoon = await step(failed, "obligationsDueWithin", () => obligationsDueWithin(Math.max(...DUNNING_DAYS_BEFORE)));
    const lapsed = await step(failed, "lapseOverdue", () => lapseOverdue());
    if ((lapsed?.lapsed ?? 0) > 0) {
      log.warn("renewal obligations lapsed", { count: lapsed?.lapsed });
    }

    /*
     * 🔴 59.15 — the reconciler, counted here and shown on the vault screen.
     *
     * Both directions, because asking one of them is how a discrepancy
     * survives: an obligation we believe is paid with nothing behind it, and a
     * paid renewal invoice that bought a period the product does not know
     * about. The second produces a support ticket rather than a variance.
     */
    const { reconcileRenewals } = await import("@/lib/billing/obligations");
    const renewalDrift = await step(failed, "reconcileRenewals", () => reconcileRenewals());
    if (
      (renewalDrift?.paidWithNoReference.length ?? 0) > 0 ||
      (renewalDrift?.invoicesWithNoObligation.length ?? 0) > 0
    ) {
      log.warn("renewals do not reconcile", {
        paidWithNoReference: renewalDrift?.paidWithNoReference.length,
        invoicesWithNoObligation: renewalDrift?.invoicesWithNoObligation.length,
      });
    }

    /*
     * 🔴 W2-X03: the webhook queue USED to be drained here, once a day, so a
     * delivery could be a day late and its retries a day apart. It moved to
     * `reminders`, the hourly wake, below.
     */

    /*
     * 🔴 68.16 — THE 80% AND 90% ALERTS, beside the other money work.
     *
     * *To the contact on the account, with one tap to raise the limit.* A dashboard
     * nobody has open is not an alert, so this goes through `notify()` like the
     * ageing payout alert above and reaches a phone and an email.
     *
     * The stamps are claimed with a conditional UPDATE inside
     * `alertApproachingLimits`, so a cron that overlaps itself does not send twice:
     * alerting twice is how an alert becomes noise, and noise is how a real one is
     * missed.
     */
    const { alertApproachingLimits } = await import("@/lib/partner/usage");
    const limits = await step(failed, "alertApproachingLimits", () => alertApproachingLimits());

    /*
     * 🔴 68.19 — THE MONTHLY BILL, from real usage, on the same ledger.
     *
     * Safe to run daily: `postMonthlyBill` bills the PREVIOUS month and refuses to
     * post twice for one period, asking the ledger rather than a flag. The ledger is
     * the record, so asking it is asking the thing that decides.
     */
    const { billAllPartners } = await import("@/lib/partner/billing");
    const partnerBills = await step(failed, "billAllPartners", () => billAllPartners());

    /*
     * 🔴 42.3 / 55.9 — the expired launch tokens, swept.
     *
     * Two minutes each, so a busy partner produces thousands a day and every one of them is
     * already dead: `redeemLaunch` has `expires_at > now()` and `used_at IS NULL` in its
     * WHERE, so an unswept row opens nothing.
     *
     * It is deleted anyway, and the reason is that the row names a clinician and the key that
     * asked about them. Kept for ever it becomes a log of which clinicians a partner launched
     * and when, held in a table nothing reads. `audit_log` is where that question is answered
     * deliberately, with retention somebody chose.
     *
     * A day's grace rather than at expiry, so a support question about a launch that failed
     * this morning still has a row to look at.
     */
    const { sweepExpiredLaunches } = await import("@/lib/partner/launch");
    const launchesSwept = await step(failed, "sweepExpiredLaunches", () => sweepExpiredLaunches());

    /*
     * 🔴 0165: the check-ins moved to `reminders`, the hourly wake. This job
     * runs at 03:05 UTC, inside every Egyptian patient's quiet window, so here
     * they reached nobody in Egypt at all.
     */

    /* 🔴 C14: the tax documents moved to `reminders`, the hourly wake. */

    return {
      failedSteps: failed.join(",") || undefined,
      reconciled,
      released: released?.released,
      centsMoved: released?.centsMoved,
      payoutsAlerted: aged?.alerted,
      oneHandActions: oneHand?.lines,
      benefitsPaused: reverified?.paused,
      droppedFromLists: dropped?.paused,
      potsOutOfBalance: potDrift?.length,
      potAlerts: potAlerts?.alerted,
      ledgerTold: ledgerTold?.told,
      renewalsRaised: renewals?.raised,
      renewalsDueSoon: dueSoon?.length,
      renewalsLapsed: lapsed?.lapsed,
      renewalsPaidNoReference: renewalDrift?.paidWithNoReference.length,
      renewalsInvoiceNoObligation: renewalDrift?.invoicesWithNoObligation.length,
      /* 🔴 68.16 / 68.19 — the partner limit alerts and the closed month. */
      partnerLimitAlerts: limits?.alerted,
      partnerMonthsBilled: partnerBills?.billed,
      launchTokensSwept: launchesSwept,
    };
  },

  /**
   * Radar housekeeping: release lapsed booking claims and drop clinicians whose
   * heartbeat has stopped.
   *
   * Explicitly *not* the guard against double-booking — the claiming UPDATE
   * already treats an expired claim as available, so correctness does not
   * depend on this running. What it fixes is the public list advertising
   * someone who closed their laptop twenty minutes ago.
   */
  /**
   * The radar sweep, still reachable by hand.
   *
   * Not on a schedule of its own — `crisis` runs it. Kept as a named job
   * because "put everyone's status back where it should be, now" is a thing
   * you want to be able to do from a terminal at the exact moment something
   * looks wrong, without waiting a quarter of an hour.
   */
  async radar() {
    return sweepRadar();
  },

  /**
   * Retention. Audit records are kept for six years, then deleted.
   *
   * The old job filtered on `accessed_at`, a column that does not exist on that
   * table, and wrapped the query in `.catch(() => [])` — so it threw on every
   * run, swallowed the error, reported success, and had never deleted a single
   * row. Here the column is real and the error is not swallowed.
   */
  async retention() {
    const cutoff = new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000);
    const purged = await db
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .returning({ id: auditLog.id });

    const sessionsPurged = await purgeExpiredSessions();
    // Rate-limit rows self-invalidate on read; this only stops the table
    // growing without bound.
    const limitsPurged = await purgeExpiredLimits();
    // Errors are kept for a month — long enough to see a pattern, short
    // enough that a route throwing all weekend does not become the largest
    // table in the database.
    const { purgeOldErrors } = await import("@/lib/observability/errors");
    const errorsPurged = await purgeOldErrors();
    // W2-A03: open carts nobody submitted expire, and stop locking the bank details.
    const { expireOpenCarts } = await import("@/lib/billing/rail-exceptions");
    const cartsExpired = await expireOpenCarts();

    /*
     * 🔴 W1-16 / 0165: licences that ran out, and those about to. Moved here,
     * the daily wake, when `crisis` went hourly: a licence ends on a date.
     * Caught on its own, so a throw here does not hide the purges above.
     */
    const failed: string[] = [];
    const { sweepLicences } = await import("@/lib/data/licence-expiry");
    const licences = await step(failed, "sweepLicences", () => sweepLicences());

    return {
      failedSteps: failed.join(",") || undefined,
      auditPurged: purged.length,
      sessionsPurged,
      limitsPurged,
      errorsPurged,
      cartsExpired,
      licencesExpired: licences?.expired,
      licencesWarned: licences?.warned,
    };
  },

  /**
   * Read the text out of uploaded documents. PLAN.md 8.3, H9.
   *
   * Here rather than in the upload handler because a 25 MB file on a request
   * handler is a timeout on exactly the document somebody cared about. Bounded
   * and resumable: it takes the oldest pending rows and leaves the rest for the
   * next tick, so a long queue is slow rather than fatal.
   *
   * Folded into the same 03:00-ish window as everything else, for the billing
   * reason at the top of this file — the expensive part is waking the database,
   * not the work.
   */
  /**
   * Appointment reminders. PLAN.md 11.7, rebuilt by 11R.15–11R.17. C65.
   *
   * ## Hourly, and why that is affordable
   *
   * The note at the top of this file is about Neon billing for the time the
   * compute is *awake*, not the work done — so the cost of a cron is the idle
   * timeout it resets, not its runtime. The arithmetic, recorded as 11R.17
   * asks:
   *
   *   Neon's "scale to zero" on this project is 0 seconds (`suspend_timeout_
   *   seconds: 0` on every endpoint), so a wake costs the seconds it runs and
   *   nothing after. Twenty-four wakes a day at ~2s each is ~48s of compute,
   *   against 0.25 CU minimum — call it 0.003 CU-hours a day, roughly a cent
   *   a month at Neon's $0.16/CU-hour. The daily job it replaces cost a
   *   twenty-fourth of that.
   *
   *   That is the whole price. It buys: a same-day booking getting a reminder
   *   at all, and nobody being messaged at 05:20 because 03:20 UTC happened to
   *   be the slot. A cent a month against a patient missing their appointment
   *   is not a close call.
   *
   * ## Two passes, one message
   *
   *   `bookingsNeedingReminder(20, 24)` — the ordinary case, caught by exactly
   *   one hourly run because the band is four hours wide and the runs are an
   *   hour apart.
   *   `sameDayNeedingReminder()` — anything booked *inside* that band, which
   *   the first pass structurally cannot see (C65's actual defect).
   *
   * Both are gated on `reminded_at IS NULL`, so a slot gets one reminder
   * whichever pass finds it first.
   *
   * ## 🔴 Nothing goes out in the middle of the night
   *
   * 11R.16: quiet between 22:00 and 07:00 **where the recipient is**. A slot
   * inside the quiet window is left for the next run, which is an hour away —
   * so a Cairo patient booked for tomorrow evening is told at 07:xx their
   * time, not 05:20. A reminder that wakes somebody at dawn is the product
   * being useful at the patient's expense, and they turn notifications off.
   *
   * ## And no ISO strings
   *
   * §6 / C61: the time in the message is rendered by `formatWhenWithCaveat` in
   * the recipient's own zone, and says which zone it fell back to. The old
   * body said "19:00 UTC" while the booking screen said "22:00".
   */
  async reminders() {
    /* 🔴 C14: each step on its own, so one that throws does not stop the rest. */
    const failed: string[] = [];

    /*
     * 🔴 44.1 / C97 / 0165: THE CHECK-INS, on the hourly wake, and first.
     *
     * They ran in the daily `billing` job at 03:05 UTC, which is 05:05 or 06:05
     * in Cairo: inside the default quiet window (21:00 to 09:00 in the
     * patient's own zone), so every patient in Egypt was skipped every day and
     * the channel reached nobody there. Hourly, each patient is reached in the
     * first run of their own daytime.
     *
     * The cadence is still per person, `settings.checkins.everyHours` (never
     * under six), checked against the `checkins` row each send writes, so an
     * hourly run sends to nobody who was messaged recently, is inside their
     * night, or has muted. Two runs at once cannot both send: the sweep holds a
     * lease (`lib/checkins/send.ts`). The skip reasons are in the return value,
     * because "measure the mute rate" needs the denominator visible.
     *
     * Before the booking reminders rather than after, so a throw in those
     * cannot stop it. `step` catches its own throws.
     */
    const { sweepCheckins } = await import("@/lib/checkins/send");
    const checkins = await step(failed, "sweepCheckins", () => sweepCheckins());

    /* 🔴 0165: the watchdog, also run by `crisis`. See there. */
    const { watchdog } = await import("@/lib/observability/heartbeat");
    const watched = await step(failed, "watchdog", () => watchdog());

    const { bookingsNeedingReminder, sameDayNeedingReminder, markReminded } = await import(
      "@/lib/data/scheduling"
    );
    const { notify } = await import("@/lib/notify");
    const { whenFor, wordsFor } = await import("@/lib/i18n/message-words");
    const { isQuietHour, resolveZone } = await import("@/lib/scheduling/tz");

    const now = new Date();
    const ahead = await bookingsNeedingReminder(20, 24);
    const sameDay = await sameDayNeedingReminder();

    // A slot can satisfy both queries at a boundary; `reminded_at` makes the
    // second send a no-op, but deduplicating here saves the wasted call.
    const seen = new Set<string>();
    const due = [...ahead, ...sameDay].filter((booking) => {
      if (seen.has(booking.slotId)) return false;
      seen.add(booking.slotId);
      return true;
    });

    let sent = 0;
    let unreachable = 0;
    let heldForMorning = 0;

    for (const booking of due) {
      const zone = resolveZone(booking.patientTimezone, booking.therapistTimezone);

      // 11R.16 — leave it for the next hourly run.
      if (isQuietHour(now, zone.name)) {
        heldForMorning += 1;
        continue;
      }

      const therapist = [booking.therapistFirstName, booking.therapistLastName]
        .filter(Boolean)
        .join(" ");
      /*
       * 🔴 37L.9 / RULING 8: the date is in the patient's language now, because
       * the sentence around it is too: the words come from `wordsFor`, which
       * reads the language they chose.
       */
      const words = await wordsFor(booking.personId ? { personId: booking.personId } : null);
      const when = whenFor(booking.startsAt, zone, words);
      const door = patientSessionLink(env.appUrl, booking.joinToken);

      const delivery = await notify(
        {
          personId: booking.personId,
          email: booking.patientEmail,
          phone: booking.patientPhone,
          timezone: booking.patientTimezone,
          locale: words.locale,
        },
        {
          notice: { kind: "session_invited", key: "pnotice.reminder" },
          kind: "booking.reminder",
          subject: words.t("pmsg.sessionWith", { therapist }),
          body: words.t("pmsg.reminder.body", { therapist, when }),
          /* 🔴 W2-P05: the patient's own door, not the clinician's session page. */
          link: door ? { ...door, label: words.t("pmsg.openSession") } : null,
          variables: [therapist, when],
        },
      );

      /*
       * Stamped whatever happened. A reminder that could not be delivered will
       * not be delivered by trying again next hour either — the patient has no
       * address — and re-sending every hour would turn one unreachable booking
       * into a daily log storm.
       */
      await markReminded(booking.slotId);
      if (delivery.sent) sent += 1;
      else unreachable += 1;
    }

    /*
     * 11R.22 — and the hours nobody ever paid for go back on the calendar.
     *
     * Folded into this job rather than scheduled separately, for the reason at
     * the top of this file: the expensive part is waking the database, and
     * this sweep is one indexed query on most hours.
     *
     * The patient is told. An hour they were sent a confirmation for
     * disappearing without a word is the product quietly cancelling somebody's
     * therapy appointment — the quiet window applies here too, and a release
     * held until morning is simply released on the next run, because
     * `status = 'open'` makes it no longer a candidate.
     */
    /* 🔴 Pay before start: unpaid in-person links expire; paid ones that never started are refunded. */
    const { sweepInPerson } = await import("@/lib/data/in-person");
    /* Isolated: a failure here must not stop the booking release below. */
    await sweepInPerson(now).catch((error) =>
      log.error("in-person sweep failed", { reason: safeErrorMessage(error) }),
    );
    /* 🔴 0169: a wallet hold on a session that ended unpaid goes back to the wallet. */
    const { sweepWalletHolds } = await import("@/lib/billing/wallet");
    await sweepWalletHolds().catch((error) =>
      log.error("wallet sweep failed", { reason: safeErrorMessage(error) }),
    );

    const { releaseUnconfirmedBookings } = await import("@/lib/data/scheduling");
    const released = await releaseUnconfirmedBookings(now);
    let releasesTold = 0;

    for (const row of released) {
      const zone = resolveZone(row.patientTimezone, row.therapistTimezone);
      const therapist = [row.therapistFirstName, row.therapistLastName].filter(Boolean).join(" ");
      /* 🔴 Ruling 8: in the patient's own language, the date included. */
      const words = await wordsFor(row.personId ? { personId: row.personId } : null);
      const when = whenFor(row.startsAt, zone, words);

      const delivery = await notify(
        {
          personId: row.personId,
          email: row.patientEmail,
          phone: row.patientPhone,
          timezone: row.patientTimezone,
          locale: words.locale,
        },
        {
          notice: { kind: "session_cancelled", key: "pnotice.released", sessionId: row.sessionId },
          kind: "booking.cancelled",
          subject: words.t("pmsg.released.subject", { therapist }),
          body: words.t("pmsg.released.body", { therapist, when }),
          link: { label: words.t("pmsg.bookAgain"), url: `${env.appUrl}/radar` },
          variables: [therapist, when],
        },
      );

      if (delivery.sent) releasesTold += 1;
    }

    /*
     * 🔴 42.4 / 55.10 / W2-X03: THE WEBHOOK QUEUE, drained on this wake.
     *
     * Hourly because a partner waits on a delivery, and on THIS job because it is
     * already the hourly wake: a schedule of its own would buy a second set of wakes
     * for a query that finds nothing on most hours (the note at the top of this file).
     * Each failure waits longer, over about three days (`lib/partner/retry.ts`), so
     * an hour is the finest the schedule needs.
     *
     * 🔴 C24: in batches for up to 45 seconds, not one batch of 50, so a busy
     * hour is sent in that hour; the reminders above and the ETA job below share
     * this call's 300 seconds.
     *
     * 🔴 Queued rather than sent at the moment the thing happened, so a partner's dead
     * endpoint cannot hold up a session ending or a note being approved. What crosses the
     * wire is an event and an id, so a delivery sitting in the queue for an hour leaks
     * nothing while it waits.
     */
    const { deliverPending } = await import("@/lib/partner/webhooks");
    const hooks = await step(failed, "deliverPending", () => deliverPending());

    /*
     * 🔴 0147 / C14 — every tax document still waiting is tried again, and every
     * one with the Tax Authority is asked about. Hourly, as the job describes
     * itself: a company waiting on an invoice should not wait for 3am.
     * Idempotent: ETA refuses an internal id twice, and the move out of
     * `waiting` is conditional.
     */
    const { advanceEtaDocuments } = await import("@/lib/billing/eta/issue");
    const eta = await step(failed, "advanceEtaDocuments", () => advanceEtaDocuments());

    return {
      failedSteps: failed.join(",") || undefined,
      etaAdvanced: eta?.advanced,
      /* C12a: credit notes a sent return was missing, opened this hour. */
      etaRebuilt: eta?.rebuilt,
      remindersDue: due.length,
      remindersSent: sent,
      unreachable,
      heldForMorning,
      released: released.length,
      releasesTold,
      webhooksSent: hooks?.sent,
      webhooksRetrying: hooks?.failed,
      webhooksFailed: hooks?.gaveUp,
      /* C24: the 45 second budget ran out with deliveries still due; next hour takes them. */
      webhooksMore: hooks?.more,
      checkinsSent: checkins?.sent,
      checkinsMuteRate: checkins ? Math.round(checkins.muteRate * 100) / 100 : undefined,
      checkinsSkippedQuiet: checkins?.skipped.quiet_hours,
      checkinsSkippedMuted: checkins?.skipped.muted,
      checkinsSkippedTooSoon: checkins?.skipped.too_soon,
      checkinsHalted: checkins?.skipped.mute_rate_halt,
      checkinsOverlapped: checkins?.overlapped,
      opsProblems: watched?.problems,
      opsAlerted: watched?.alerted,
    };
  },

  /** W2-X03: the webhook queue, reachable by hand. Scheduled inside `reminders`. */
  async webhooks() {
    const { deliverPending } = await import("@/lib/partner/webhooks");
    return deliverPending();
  },

  async extract() {
    const { extractPending } = await import("@/lib/data/documents");
    const { done, failed } = await extractPending();
    return { extracted: done, extractFailed: failed };
  },
} as const;

type JobName = keyof typeof JOBS;

export async function GET(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;

  if (!bearerMatches(request, env.cronSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!Object.hasOwn(JOBS, job)) {
    return NextResponse.json({ error: "unknown_job" }, { status: 404 });
  }

  /*
   * 🔴 0165: every run leaves a heartbeat, clean or not, and the hourly
   * watchdog emails the super admins when a scheduled job's last CLEAN run is
   * twice its interval old. A failed step counts as not clean, so a job that
   * runs every hour and fails the same step every hour is still reported.
   * `recordHeartbeat` never throws.
   */
  const { recordHeartbeat } = await import("@/lib/observability/heartbeat");

  try {
    const result = await JOBS[job as JobName]();
    const failedSteps = "failedSteps" in result ? (result.failedSteps as string | undefined) : undefined;
    await recordHeartbeat(job, { failedSteps });
    log.info("cron job completed", { job, ...result });
    return NextResponse.json({ job, ...result });
  } catch (error) {
    await recordHeartbeat(job, { threw: true });
    log.error("cron job failed", { job, reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }
}
