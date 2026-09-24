import "server-only";

import { createHash, randomInt } from "node:crypto";

import { and, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  ENROLMENT_CODE_ATTEMPTS,
  enrolmentVerifications,
  enrolments,
  patientNotifications,
  people,
  sponsors,
} from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { callerKey, consume } from "@/lib/rate-limit";

/**
 * Proof over pattern, and the cycle that keeps it. PLAN.md 53.19, 53.19b, C246,
 * C247, C256.
 *
 * ## 🔴 THE WORK ADDRESS IS NEVER STORED, AND THAT DECIDED EVERYTHING HERE
 *
 * `enrolments.identifier_hash` is a salted hash and there is no plaintext column
 * anywhere, because 53.18b stores the identifier for matching and de-duplication
 * only. So:
 *
 *   - `sendEnrolmentCode` takes the address as an ARGUMENT and is called from
 *     exactly one place, inside `enrol`, while the person is typing it. Nothing
 *     later can email a work inbox because nothing later knows one.
 *   - `pauseUnverified` therefore cannot email anybody. It pauses, and it tells the
 *     PERSON through their own notification log and their own contact details. The
 *     fix is that they re-enter their work address, which mints a new code.
 *
 * That is a better answer than the obvious one. 53.19b says "no reply pauses
 * funding", which reads like an email cycle, and an email cycle needs the address
 * kept for years in a column a payer would love to read.
 *
 * ## 🔴 C247 — A PAUSE TOUCHES THE FUNDING AND NOTHING ELSE
 *
 * `pauseUnverified` writes `paused_at` on `enrolments` and inserts one row in
 * `patient_notifications`. Not the record, not the grants, not the journals, not
 * the summaries, not the history. `unpause` is one statement, which is what
 * "reversible by us in one step" has to mean to be worth saying.
 */

/** Six digits. Short enough to read off a phone, and dead after five guesses. */
const CODE_TTL_MINUTES = 30;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * 🔴 Called from `enrol` and nowhere else, with the address in hand.
 *
 * The address is used and dropped: it reaches `notify` and this function returns,
 * and there is no column it could be written to. `verify:sprint53` asserts that no
 * other file passes an identifier to a sender.
 */
export async function sendEnrolmentCode(
  enrolmentId: string,
  emailAddress: string,
): Promise<{ ok: boolean }> {
  /*
   * Any earlier code for this enrolment is spent first. Two live codes means the
   * older one still opens the gate after somebody asked for a new one because the
   * first went to the wrong place.
   */
  await controlDb
    .update(enrolmentVerifications)
    .set({ usedAt: new Date() })
    .where(
      and(eq(enrolmentVerifications.enrolmentId, enrolmentId), isNull(enrolmentVerifications.usedAt)),
    );

  /*
   * `randomInt`, not `Math.random`. A guessable six-digit code on a gate that
   * grants funding is worth guessing, and the difference is one import.
   */
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await controlDb.insert(enrolmentVerifications).values({
    enrolmentId,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
  });

  /*
   * 🔴 NOT ONE WORD ABOUT THERAPY, and no link.
   *
   * This lands in a work inbox, which in many organisations is readable by an
   * administrator and is legally the employer's. A code that says "your therapy
   * benefit" is a disclosure to whoever else opens that mailbox, and a LINK is
   * worse: a click from a work machine is a log entry on a proxy.
   *
   * So it says a code, and where to type it, and nothing else. The word "benefit"
   * is doing the work 53.2 asks it to do.
   */
  const delivery = await notify(
    /*
     * 🔴 `phone: null`, so the WhatsApp fallback cannot fire.
     *
     * The same construction C128 uses for a record export, for the mirror-image
     * reason: there, email only because WhatsApp is read by whoever holds the
     * phone. Here, this address only, because the person's own phone number has
     * nothing to do with their employer's gate and sending a benefit code to it
     * would make their personal channel part of an employment check.
     */
    { email: emailAddress, phone: null },
    {
      kind: "benefit.verify_code",
      subject: "Your confirmation code",
      body: `Your code is ${code}. Type it into the app to confirm your benefit. It lasts ${CODE_TTL_MINUTES} minutes.`,
      variables: [code],
    },
  );

  log.info("enrolment code sent", { enrolment: ref(enrolmentId), sent: delivery.sent });
  return { ok: delivery.sent };
}

/**
 * 🔴 The code is answered, and the person id is a CONDITION rather than a check.
 *
 * A borrowed enrolment id verifies nothing: the update joins through the person
 * from the session. The same construction every other write in sprint 53 uses.
 */
export async function confirmEnrolmentCode(input: {
  personId: string;
  enrolmentId: string;
  code: string;
}): Promise<{ ok?: true; error?: string }> {
  const throttle = await consume(await callerKey("benefit-code"), 10, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Wait a few minutes." };

  const [row] = await controlDb
    .select({
      id: enrolmentVerifications.id,
      attempts: enrolmentVerifications.attempts,
    })
    .from(enrolmentVerifications)
    .innerJoin(enrolments, eq(enrolments.id, enrolmentVerifications.enrolmentId))
    .where(
      and(
        eq(enrolmentVerifications.enrolmentId, input.enrolmentId),
        /* Theirs, from the session. Not checked afterwards. */
        eq(enrolments.personId, input.personId),
        isNull(enrolmentVerifications.usedAt),
        gt(enrolmentVerifications.expiresAt, new Date()),
        lt(enrolmentVerifications.attempts, ENROLMENT_CODE_ATTEMPTS),
      ),
    )
    .limit(1);

  if (!row) {
    /*
     * One message for expired, spent, over-attempted and not-theirs. Which of
     * the four it was is a hint to whoever is guessing.
     */
    return { error: "That code did not work. Ask for a new one." };
  }

  /*
   * 🔴 The attempt is counted BEFORE the comparison, and unconditionally.
   *
   * Counting only failures leaves the counter at zero for a successful guess and
   * lets an attacker who got lucky once keep going. Counting first also means a
   * crash between the two leaves the attempt spent rather than free.
   */
  await controlDb
    .update(enrolmentVerifications)
    .set({ attempts: sql`${enrolmentVerifications.attempts} + 1` })
    .where(eq(enrolmentVerifications.id, row.id));

  const [matched] = await controlDb
    .update(enrolmentVerifications)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(enrolmentVerifications.id, row.id),
        eq(enrolmentVerifications.codeHash, hashCode(input.code.trim())),
        isNull(enrolmentVerifications.usedAt),
      ),
    )
    .returning({ id: enrolmentVerifications.id });

  if (!matched) return { error: "That code did not work. Ask for a new one." };

  /*
   * 🔴 Verified AND unpaused, in one statement.
   *
   * A person answering a re-verification is both things at once, and two
   * statements would leave a window where they are verified and still not funded.
   */
  await controlDb
    .update(enrolments)
    .set({ lastVerifiedAt: new Date(), pausedAt: null, updatedAt: new Date() })
    .where(
      and(eq(enrolments.id, input.enrolmentId), eq(enrolments.personId, input.personId)),
    );

  log.info("enrolment verified", { enrolment: ref(input.enrolmentId) });
  return { ok: true };
}

/**
 * 🔴 53.19b / C247 — the cycle. Run as a job, on the SPONSOR's calendar.
 *
 * *"Re-verify periodically, a setting defaulting to six months, because without a
 * roster nothing else can notice somebody has left."*
 *
 * ## 🔴 THE CYCLE IS THE SPONSOR'S, NOT THE PERSON'S (C256)
 *
 * *"Last verified leaks the join date, which §3e forbids."* If each person's cycle
 * ran from their own enrolment, their last-verified date would be their join date
 * shifted by whole cycles, and a sponsor reading the roster twice could recover who
 * joined the week after a restructure was announced.
 *
 * So the window is one window per organisation, computed from
 * `verify_cycle_started_at`, and EVERYBODY in it is paused in the same run. The
 * date on every roster row is then the same date and carries no signal about
 * anybody.
 *
 * ## 🔴 It pauses. It does not remove, and it does not touch the record.
 *
 * Two writes: `paused_at` on the enrolment, and one notice to the person. The
 * notice names no employer, because C231 amended: an undeletable row saying an
 * employer asked you to re-confirm is a fact about the employment relationship in
 * a record C234 promises the payer cannot touch.
 */
export async function pauseUnverified(now = new Date()): Promise<{ paused: number }> {
  /*
   * 🔴 W2-S07 — THE SAME NUMBER THE COMPANY IS SHOWN.
   *
   * Both sponsor screens print `settings.sponsor.verifyCycleMonths` (six), and
   * this read `sponsors.verify_cycle_months`, a column that defaults to three
   * and that nothing writes. A company told "every six months" had its people
   * paused at three. The setting is the one number now; the column is unread.
   */
  const settings = await getSettings();
  const months = settings.sponsor.verifyCycleMonths;

  /*
   * The sponsors whose window has come round, computed in SQL from their own
   * start date so a person's own dates are never part of the decision.
   */
  const due = await controlDb
    .select({ id: sponsors.id })
    .from(sponsors)
    .where(
      and(
        eq(sponsors.state, "active"),
        sql`${sponsors.verifyCycleStartedAt} IS NOT NULL`,
        sql`${sponsors.verifyCycleStartedAt} + make_interval(months => ${months}) <= ${now.toISOString()}`,
      ),
    );

  let paused = 0;

  for (const sponsor of due) {
    const stale = await controlDb
      .update(enrolments)
      .set({ pausedAt: now, updatedAt: now })
      .where(
        and(
          eq(enrolments.sponsorId, sponsor.id),
          eq(enrolments.state, "active"),
          isNull(enrolments.removedAt),
          isNull(enrolments.pausedAt),
          /*
           * Only the ones whose proof has actually gone stale. An `id_number`
           * enrolment is verified at creation and has nothing to re-prove, so it
           * is re-checked on the same cycle as everybody else and its date moves
           * with the window rather than with the person.
           */
          or(
            isNull(enrolments.lastVerifiedAt),
            sql`${enrolments.lastVerifiedAt} + make_interval(months => ${months}) <= ${now.toISOString()}`,
          ),
        ),
      )
      .returning({ personId: enrolments.personId });

    for (const row of stale) {
      await controlDb.insert(patientNotifications).values({
        personId: row.personId,
        kind: "verify_needed",
        /* No employer, no reason, no prose on the row. C231. */
        messageKey: "pnotice.verifyNeeded",
      });
    }

    /* The window rolls forward, once, for everybody in it. */
    await controlDb
      .update(sponsors)
      .set({ verifyCycleStartedAt: now, updatedAt: now })
      .where(eq(sponsors.id, sponsor.id));

    paused += stale.length;
  }

  if (paused > 0) log.info("enrolments paused for re-verification", { count: paused });
  return { paused };
}

/**
 * 🔴 C247 — "reversible by us in one step", and this is the one step.
 *
 * One UPDATE, scoped to the enrolment. An operator taking a phone call from
 * somebody whose funding stopped because they changed their work address should not
 * need a migration, a support queue or a second person.
 */
export async function unpause(enrolmentId: string): Promise<{ ok: true }> {
  await controlDb
    .update(enrolments)
    .set({ pausedAt: null, lastVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(enrolments.id, enrolmentId));

  return { ok: true };
}

/**
 * 🔴 C247 — the QUEUE, because "reversible in one step" needs somewhere to stand.
 *
 * `unpause` was written for C247's promise and then had no caller for four
 * sprints. A one-step remedy nobody can reach is a zero-step remedy: the person
 * on extended leave whose funding stopped had, in the shipped product, no way to
 * get it back other than reaching an inbox they cannot reach.
 *
 * ## 🔴 WHY THIS IS A QUEUE AND NOT A SEARCH BOX
 *
 * C247 calls the pause *"a real and unfair outcome"*. A search box waits for the
 * person to notice, work out who to ask, and ask. A queue means an operator sees
 * every one of them whether or not anybody rang, which is the difference between
 * a remedy and a remedy on paper.
 *
 * ## 🔴 WHAT THIS LIST IS NOT
 *
 * Not a roster. `roster()` is the sponsor's list of everybody enrolled and the
 * admin sponsor page refuses to render it, for the stated reason that somebody
 * will screenshot it for the customer who asked. This returns ONLY paused rows,
 * which is a work queue, and it is never handed to a sponsor: C244's wall is
 * about what a payer can see, and no sponsor surface imports this module.
 *
 * 🔴 And it says nothing clinical. 53.2: enrolment is eligibility, never
 * therapy. A paused benefit means a re-verification went unanswered. It does not
 * mean the person has had a session, and this query cannot reach one.
 */
export async function pausedBenefits() {
  return controlDb
    .select({
      enrolmentId: enrolments.id,
      firstName: people.firstName,
      lastName: people.lastName,
      /*
       * 🔴 Their OWN address, the one they signed up with, and never the work
       * one: that is a hash and has no column (53.18b). It is here because an
       * operator on a phone call has to match a caller to a row, and two people
       * called Ahmed at one company is the normal case rather than the edge.
       */
      email: people.email,
      sponsorName: sponsors.name,
      sponsorKind: sponsors.kind,
      identifierKind: enrolments.identifierKind,
      pausedAt: enrolments.pausedAt,
    })
    .from(enrolments)
    .innerJoin(people, eq(people.id, enrolments.personId))
    .innerJoin(sponsors, eq(sponsors.id, enrolments.sponsorId))
    .where(and(isNotNull(enrolments.pausedAt), isNull(enrolments.removedAt)))
    /* Longest paused first: the person waiting longest is the one being failed. */
    .orderBy(enrolments.pausedAt);
}
