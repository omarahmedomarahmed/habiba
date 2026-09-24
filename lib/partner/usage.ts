import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { partnerLimits, partnerSessions, partners } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";

/**
 * The limit they set, and the bill that follows from it. PLAN.md 68.14 to 68.19.
 *
 * ## 🔴 THE RULING, AND IT POINTS THE OPPOSITE WAY FROM EVERY USAGE PRODUCT
 *
 * > *THEY set the limit, and we never exceed it.*
 * >
 * > *At the limit, THEIR product keeps working and OURS stops. Their session
 * > happens, is held on their side, and is theirs. We did not do the session, so we
 * > do not bill for it.*
 *
 * Every metered API in the world treats a limit as a soft ceiling with an overage
 * charge, because overage is revenue. This one treats it as a hard stop that costs us
 * money, because the alternative is an integrator discovering a bill they did not
 * authorise, and the thing they integrated is therapy.
 *
 * ## 🔴 PRICED PER SESSION, NOT PER CALL (68.14)
 *
 * They do the work; we transcribe, write and assist. A call-based price makes an
 * integrator optimise against the product: fewer copilot questions, shorter
 * transcripts, a summary skipped. Per session, the incentive is to use what they paid
 * for, which is what we want them to do.
 */

/** The billing period a moment falls in. Calendar months, in UTC. */
function periodOf(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * 🔴 C15: THE MONTH A SESSION IS METERED AND BILLED IN is the month it became
 * billable (its first audio, `startedAt`), not the month it was opened. The
 * meter, the limit and the bill all count through this one condition, so the
 * page a partner watches all month and the bill that follows cannot disagree.
 * `createdAt` stands in only for a billable row with no stamp, which no writer
 * leaves.
 */
export function billableBetween(from: Date, to?: Date) {
  const at = sql`COALESCE(${partnerSessions.startedAt}, ${partnerSessions.createdAt})`;
  return and(
    eq(partnerSessions.billable, true),
    sql`${at} >= ${from.toISOString()}::timestamptz`,
    to ? sql`${at} < ${to.toISOString()}::timestamptz` : undefined,
  );
}

/**
 * 🔴 W2-X05: MOVE A LIMIT ROW INTO THIS PERIOD, clearing what belonged to the last.
 *
 * Both alert stamps and the stop are facts about one month. Conditional on the row
 * being in an earlier period, so it runs once per partner per month however often
 * it is called, and a stamp written this month is never cleared by it.
 */
async function rollPeriod(periodStart: Date, partnerId?: string): Promise<void> {
  await controlDb
    .update(partnerLimits)
    .set({ alerted80At: null, alerted90At: null, stoppedAt: null, periodStart })
    .where(
      and(
        lt(partnerLimits.periodStart, periodStart),
        partnerId ? eq(partnerLimits.partnerId, partnerId) : undefined,
      ),
    );
}

export type PartnerUsage = {
  limit: number;
  used: number;
  periodStart: Date;
  /** 🔴 What the month will reach at this rate. The number they act on. */
  projected: number;
  stopped: boolean;
};

/**
 * 🔴 68.15 — THE USAGE PAGE'S NUMBERS: the one they chose, the one they spent, and
 * the one the month is heading for.
 *
 * The projection is the reason the page is worth having. "412 of 500" is a fact
 * somebody reads on the 3rd and forgets; "on course for 780" is a decision.
 *
 * 🔴 LIVE ONLY. A sandbox session is never billable (a database CHECK says so), so
 * counting one here would show an integrator burning a limit they are not burning
 * and would make the usage page disagree with the invoice.
 */
export async function usageFor(partnerId: string, now = new Date()): Promise<PartnerUsage> {
  const periodStart = periodOf(now);

  const [limitRow] = await controlDb
    .select({
      monthlySessionLimit: partnerLimits.monthlySessionLimit,
      stoppedAt: partnerLimits.stoppedAt,
      periodStart: partnerLimits.periodStart,
    })
    .from(partnerLimits)
    .where(eq(partnerLimits.partnerId, partnerId))
    .limit(1);

  const [counted] = await controlDb
    .select({ used: sql<number>`count(*)::int` })
    .from(partnerSessions)
    .where(
      and(
        eq(partnerSessions.partnerId, partnerId),
        eq(partnerSessions.environment, "live"),
        billableBetween(periodStart),
      ),
    );

  const used = Number(counted?.used ?? 0);

  /*
   * Days elapsed INCLUDING today, so the first day of a month projects from one day
   * rather than from zero. Dividing by zero would give Infinity, which renders as a
   * projection nobody can act on on exactly the day they set the limit up.
   */
  const dayMs = 24 * 60 * 60 * 1000;
  const elapsed = Math.max(1, Math.ceil((now.getTime() - periodStart.getTime()) / dayMs));
  const inMonth = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return {
    limit: limitRow?.monthlySessionLimit ?? 0,
    used,
    periodStart,
    projected: Math.round((used / elapsed) * inMonth),
    /*
     * 🔴 Stopped only if the stamp belongs to THIS period. A stamp left over from
     * last month would keep a partner switched off through a month they have not
     * spent anything in, which is the failure direction that looks like an outage.
     */
    stopped: Boolean(
      limitRow?.stoppedAt && limitRow.periodStart.getTime() >= periodStart.getTime(),
    ),
  };
}

/**
 * 🔴 68.15 / 68.16 — THEY SET IT, AND THEY RAISE IT, and raising it clears the stop.
 *
 * One tap from the alert, which is what 68.16 asks for: an alert that tells somebody
 * to log in and find a settings page is an alert that arrives at the weekend and is
 * read on Monday.
 *
 * Raising clears `stoppedAt` and both alert stamps, so the 80% alert fires again
 * against the new number. Leaving them set would mean a partner who doubled their
 * limit gets no warning at all before hitting the new one.
 */
export async function setLimit(input: {
  partnerId: string;
  monthlySessionLimit: number;
  now?: Date;
}): Promise<{ ok?: true; error?: string }> {
  const wanted = Math.max(0, Math.floor(input.monthlySessionLimit));
  if (wanted > 1_000_000) return { error: "That is more sessions than we can bill on one account." };

  const now = input.now ?? new Date();
  const periodStart = periodOf(now);

  await controlDb
    .insert(partnerLimits)
    .values({ partnerId: input.partnerId, monthlySessionLimit: wanted, periodStart })
    .onConflictDoUpdate({
      target: partnerLimits.partnerId,
      set: {
        monthlySessionLimit: wanted,
        periodStart,
        /* 🔴 Cleared, so the alerts fire again against the new number. */
        alerted80At: null,
        alerted90At: null,
        stoppedAt: null,
        updatedAt: now,
      },
    });

  log.info("partner limit set", { partner: ref(input.partnerId), limit: wanted });
  return { ok: true };
}

/**
 * 🔴 68.17 — MAY WE DO THIS SESSION? Asked before every piece of work, not after.
 *
 * Returns a reason when the answer is no, because 68.18 requires the stop to be
 * EXPLICIT on their therapist's screen: *a copilot that vanishes without a word is
 * read as our outage, and their therapist is mid-session.* A boolean here would give
 * the route nothing to say.
 *
 * 🔴 A LIMIT OF ZERO IS "NOT SET UP YET", NOT "NOTHING ALLOWED".
 *
 * A partner who has never opened the usage page has a zero in the column, and
 * reading that as a hard stop would mean every new integration is broken on its
 * first live call with a message about a limit they never set. Sandbox is unlimited
 * for the same reason and one better: it bills nothing, so there is nothing to cap.
 */
export async function mayRun(input: {
  partnerId: string;
  environment: "sandbox" | "live";
  now?: Date;
}): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  if (input.environment === "sandbox") return { allowed: true };

  const usage = await usageFor(input.partnerId, input.now ?? new Date());
  if (usage.limit === 0) return { allowed: true };

  if (usage.used >= usage.limit) {
    return {
      allowed: false,
      /*
       * 🔴 The sentence a partner can put on their own screen, and it says whose
       * limit it is. "Quota exceeded" reads as our refusal; this reads as their
       * setting, which is what it is, and names the one action that changes it.
       */
      reason: `This account has reached the monthly session limit it set (${usage.limit}). Your session is unaffected and is held on your own platform. Raise the limit to turn the AI back on.`,
    };
  }

  return { allowed: true };
}

/**
 * 🔴 68.16 — 80% AND 90%, ONCE EACH, TO THE CONTACT ON THE ACCOUNT.
 *
 * Called from the cron. The stamps are claimed in the same UPDATE that selects them,
 * so a cron running twice in a minute does not send twice: alerting twice is how an
 * alert becomes noise, and noise is how a real one is missed. `alertAgedPayouts`
 * records the same reasoning about the same hazard.
 */
export async function alertApproachingLimits(now = new Date()): Promise<{ alerted: number }> {
  const periodStart = periodOf(now);

  /*
   * 🔴 W2-X05: A NEW MONTH CLEARS LAST MONTH'S STAMPS, FOR EVERY PARTNER, FIRST.
   *
   * The stamps were cleared only when somebody saved a limit, so an account that
   * crossed 80% in its first month was never warned again. They belong to a period,
   * and the period rolls here, before any stamp is read.
   */
  await rollPeriod(periodStart);

  const rows = await controlDb
    .select({
      partnerId: partnerLimits.partnerId,
      limit: partnerLimits.monthlySessionLimit,
      alerted80At: partnerLimits.alerted80At,
      alerted90At: partnerLimits.alerted90At,
      name: partners.name,
      contactEmail: partners.contactEmail,
      contactPhone: partners.contactPhone,
    })
    .from(partnerLimits)
    .innerJoin(partners, eq(partners.id, partnerLimits.partnerId))
    .where(sql`${partnerLimits.monthlySessionLimit} > 0`);

  let alerted = 0;

  for (const row of rows) {
    const usage = await usageFor(row.partnerId, now);
    const share = usage.limit > 0 ? usage.used / usage.limit : 0;

    /* 90 first: a partner crossing both in one period gets the urgent one. */
    const at = share >= 0.9 ? 90 : share >= 0.8 ? 80 : null;
    if (at === null) continue;

    const column = at === 90 ? partnerLimits.alerted90At : partnerLimits.alerted80At;
    const already = at === 90 ? row.alerted90At : row.alerted80At;
    if (already) continue;

    /*
     * 🔴 CLAIMED WITH A CONDITIONAL UPDATE, not read then written. Two crons
     * overlapping both read "not alerted", both pass a check, and both send.
     */
    const [claimed] = await controlDb
      .update(partnerLimits)
      .set(
        at === 90
          ? { alerted90At: now, periodStart, updatedAt: now }
          : { alerted80At: now, periodStart, updatedAt: now },
      )
      .where(and(eq(partnerLimits.partnerId, row.partnerId), sql`${column} IS NULL`))
      .returning({ partnerId: partnerLimits.partnerId });

    if (!claimed) continue;

    const { notify } = await import("@/lib/notify");
    await notify(
      { email: row.contactEmail, phone: row.contactPhone },
      {
        kind: "partner.limit_approaching",
        subject: `${row.name}: ${at}% of this month's session limit`,
        /*
         * 🔴 NOT ONE WORD ABOUT ANY PATIENT OR ANY SESSION. This is a message about
         * a number, sent to a commercial contact who has no clinical standing at
         * all. The same rule the sponsor's domain confirmation follows.
         */
        body: `You have used ${usage.used} of the ${usage.limit} sessions this account allows this month, and are on course for about ${usage.projected}. At the limit your own platform keeps working exactly as it does now, and our transcription, notes, summaries and copilot stop until you raise it.`,
        /* 🔴 W2-X05: absolute: an email or a WhatsApp message has no host to resolve against. */
        link: { label: "Raise the limit", url: `${env.appUrl}/partner/usage` },
      },
    );

    alerted += 1;
  }

  return { alerted };
}

/**
 * 🔴 68.17 — RECORD THAT WE STOPPED, which is not the same as reaching the limit.
 *
 * Reaching it is arithmetic anybody can redo. Being stopped is a thing that happened
 * to a partner's therapist mid-afternoon, and "were we ever off, and when" is a
 * question support has to answer without recomputing a month of counts.
 */
export async function markStopped(partnerId: string, now = new Date()): Promise<void> {
  /* W2-X05: last month's stop is not this month's, so the period rolls first. */
  await rollPeriod(periodOf(now), partnerId);
  await controlDb
    .update(partnerLimits)
    .set({ stoppedAt: now, updatedAt: now })
    .where(and(eq(partnerLimits.partnerId, partnerId), sql`stopped_at IS NULL`));
}
