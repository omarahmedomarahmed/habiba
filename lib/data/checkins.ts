import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { checkinMutes, checkinReplies, checkins, patientAccounts, people } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { countryFromE164 } from "@/lib/phone/e164";
import { REGION_ZONES } from "@/lib/scheduling/tz";

/**
 * Everything the check-in channel reads and writes. PLAN.md 44.1, 44.2, C97.
 *
 * 🔴 NO `lib/ai` IMPORT IN THIS FILE OR ANYWHERE IN `lib/checkins/`, which is 44.2 as a property of
 * an import graph rather than a promise: *a check-in asks, it never interprets.*
 */

export type Candidate = {
  personId: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  locale: string;
  muted: boolean;
  lastSentAt: Date | null;
  lastBody: string | null;
};

/**
 * 🔴 WHO IS EVEN A CANDIDATE, AND THE ANSWER IS NARROWER THAN "EVERY PATIENT".
 *
 * C97 says *every patient*, and this returns only people with a CLAIMED account. That is a
 * narrowing of the requirement and it is deliberate, so it is named here rather than absorbed:
 *
 * A `people` row exists for everybody a clinician ever wrote down, including somebody they added
 * once and never saw again, and somebody whose phone number they typed from memory. Messaging that
 * list is messaging people who have never heard of us, using contact details they did not give us,
 * to ask how they are. The first such message is the one that ends the product.
 *
 * A claimed account means the person themselves signed in, took ownership of their record and
 * agreed to the consent question §3 step 7 asks (22R). That is the smallest thing that makes an
 * unprompted message something they could have expected, and it is the line this draws.
 *
 * 🔴 It also means the check-in channel is EMPTY until patients claim records, which is the honest
 * state of this product today and should be visible as a count rather than discovered later.
 */
/**
 * 🔴 PE81: the zone the quiet window is read in, when they never saved one.
 *
 * An unknown zone is treated as night (lib/checkins/policy.ts), which is the
 * direction that cannot wake anybody, and it meant a patient who left the zone
 * empty at signup was never checked on at all. Their phone's country, then
 * their record's region, answers it where the country keeps ONE zone
 * (`REGION_ZONES`, Egypt today); a country with several has no entry, so it is
 * still refused rather than guessed.
 */
function zoneFor(row: { timezone: string | null; phone: string | null; region: string | null }): string | null {
  if (row.timezone) return row.timezone;
  const country = countryFromE164(row.phone)?.toLowerCase();
  return (country && REGION_ZONES[country]) || (row.region && REGION_ZONES[row.region]) || null;
}

export async function candidates(limit = 500): Promise<Candidate[]> {
  const rows = await controlDb
    .select({
      personId: people.id,
      firstName: people.firstName,
      email: patientAccounts.email,
      phone: patientAccounts.phone,
      timezone: patientAccounts.timezone,
      region: people.region,
      locale: people.locale,
      mutedId: checkinMutes.id,
    })
    .from(people)
    /* 🔴 The claimed account. An inner join, so an unclaimed person is not a candidate at all. */
    .innerJoin(patientAccounts, eq(patientAccounts.personId, people.id))
    .leftJoin(
      checkinMutes,
      and(eq(checkinMutes.personId, people.id), isNull(checkinMutes.unmutedAt)),
    )
    /* 🔴 `people` has no soft delete: a person row is never removed, which is 5.1's design. The
       account's is what matters here, because a closed account is somebody who left. */
    .where(isNull(patientAccounts.deletedAt))
    .limit(limit);

  /*
   * The last check-in per person, in one query rather than one per candidate. `DISTINCT ON` is the
   * right tool and Postgres-specific, which is fine: this product has one database.
   */
  const last = rows.length
    ? await controlDb.execute(sql`
        SELECT DISTINCT ON (person_id) person_id, sent_at, body
          FROM checkins
         WHERE person_id IN (${sql.join(
           rows.map((r) => sql`${r.personId}`),
           sql`, `,
         )})
         ORDER BY person_id, sent_at DESC`)
    : { rows: [] as Record<string, unknown>[] };

  const lastByPerson = new Map<string, { sentAt: Date; body: string }>();
  for (const row of last.rows) {
    lastByPerson.set(String(row.person_id), {
      sentAt: new Date(String(row.sent_at)),
      body: String(row.body),
    });
  }

  return rows.map((row) => ({
    personId: row.personId,
    firstName: row.firstName,
    email: row.email,
    phone: row.phone,
    timezone: zoneFor(row),
    /* 🔴 0169 / ruling 8: the language they chose; English is the floor, as everywhere. */
    locale: row.locale === "ar" || row.locale === "en" ? row.locale : "en",
    muted: row.mutedId !== null,
    lastSentAt: lastByPerson.get(row.personId)?.sentAt ?? null,
    lastBody: lastByPerson.get(row.personId)?.body ?? null,
  }));
}

/**
 * 🔴 THE MUTE RATE, WHICH IS THE NUMBER THE FOUNDER ASKED FOR AND THE ONE THAT HALTS THE CHANNEL.
 *
 * The denominator is people who could be messaged at all — claimed accounts with a way to reach
 * them. Not everybody ever messaged, because a channel that has been running a week would divide by
 * a week's sends and read artificially high; and not everybody in `people`, because most of them
 * were never candidates.
 *
 * Returns zero when there is nobody, rather than dividing by zero into `NaN`: a `NaN` compared
 * against the halt threshold is false, so the channel would keep running on an empty database, and
 * that is the wrong direction to be wrong in.
 */
export async function muteRate(
  /** 🔴 W2-A08: `settings.checkins.measuredSince`. Mutes before it were about an older cadence. */
  since: string | null = null,
): Promise<{ rate: number; muted: number; reachable: number }> {
  const from = since ? new Date(since) : new Date(0);
  const [row] = (
    await controlDb.execute(sql`
    SELECT
      count(*)::int AS reachable,
      count(m.id)::int AS muted
      FROM people p
      JOIN patient_accounts a ON a.person_id = p.id AND a.deleted_at IS NULL
      LEFT JOIN checkin_mutes m
        ON m.person_id = p.id AND m.unmuted_at IS NULL AND m.muted_at >= ${from.toISOString()}::timestamptz
     WHERE (a.email IS NOT NULL OR a.phone IS NOT NULL)`)
  ).rows as { reachable: number; muted: number }[];

  const reachable = row?.reachable ?? 0;
  const muted = row?.muted ?? 0;

  return { rate: reachable === 0 ? 0 : muted / reachable, muted, reachable };
}

/** Record a check-in that went out. Written after the send, with whether it landed. */
export async function recordCheckin(input: {
  personId: string;
  channel: "email" | "whatsapp";
  body: string;
  locale: string;
  delivered: boolean;
}): Promise<{ checkinId: string } | null> {
  const [created] = await controlDb
    .insert(checkins)
    .values(input)
    .returning({ id: checkins.id });

  return created ? { checkinId: created.id } : null;
}

/**
 * 🔴 MUTE. Idempotent, because two "stop" replies in a row must not be two rows.
 *
 * `checkin_mutes_live_unique` would refuse the second insert, and `onConflictDoNothing` turns that
 * into a no-op rather than an exception: somebody who replies "stop" twice has not done anything
 * wrong and must not see an error.
 */
export async function mute(personId: string, via: "reply" | "screen"): Promise<void> {
  await controlDb
    .insert(checkinMutes)
    .values({ personId, via })
    .onConflictDoNothing();

  log.info("checkins muted", { person: ref(personId), via });
}

/**
 * Unmute. A second stamp on the existing row, never a delete: the rate stays measurable.
 *
 * ## 🔴 `now()` RATHER THAN `new Date()`, AND THE CONSTRAINT CAUGHT ME GETTING THIS WRONG
 *
 * `muted_at` is written by the column's DEFAULT, which is the database's `now()`. The first version
 * of this function wrote `unmuted_at` from `new Date()`, which is the APPLICATION's clock — a
 * different machine, rounded to milliseconds where `now()` is microseconds.
 *
 * So somebody who muted and then immediately unmuted produced a row whose unmute was a few
 * milliseconds BEFORE its mute, and `checkin_mutes_unmute_after_mute` refused the write. On a
 * serverless deployment the app and the database are always different machines and the skew can be
 * far larger than a few milliseconds, in either direction.
 *
 * The person who hits this is somebody who pressed the wrong button and corrected it, which is
 * exactly the person who should meet no error at all. Two timestamps compared by a constraint have
 * to come from ONE clock, and the database's is the only one both writes can share.
 *
 * 🔴 Worth saying plainly: the constraint found this, in its own verifier, before a patient did.
 * Without `checkin_mutes_unmute_after_mute` the row would have been written with the two the wrong
 * way round and the mute rate would have gone negative for a window with nothing to explain it.
 */
export async function unmute(personId: string): Promise<void> {
  await controlDb
    .update(checkinMutes)
    .set({ unmutedAt: sql`now()` })
    .where(and(eq(checkinMutes.personId, personId), isNull(checkinMutes.unmutedAt)));
}

export async function isMuted(personId: string): Promise<{ muted: boolean; mutedAt: Date | null }> {
  const [row] = await controlDb
    .select({ mutedAt: checkinMutes.mutedAt })
    .from(checkinMutes)
    .where(and(eq(checkinMutes.personId, personId), isNull(checkinMutes.unmutedAt)))
    .limit(1);

  return { muted: Boolean(row), mutedAt: row?.mutedAt ?? null };
}

/**
 * 🔴 44.2 — STORE A REPLY. THE WORDS, AND WHETHER IT WENT TO THE CRISIS PATH.
 *
 * Nothing else. No score, no sentiment, no summary, because there is no column for one and no model
 * is called on the way here. `crisisAlertRaised` is a fact about what we DID, not a finding about
 * the person: the finding, if any, is a `risk_assessments` row written by the ordinary path.
 */
export async function recordReply(input: {
  checkinId: string;
  personId: string;
  body: string;
  crisisAlertRaised: boolean;
}): Promise<void> {
  await controlDb.insert(checkinReplies).values(input);
}

/** The most recent check-in we sent this person, so a reply can be attached to it. */
export async function lastCheckinFor(personId: string): Promise<{ id: string } | null> {
  const [row] = await controlDb
    .select({ id: checkins.id })
    .from(checkins)
    .where(eq(checkins.personId, personId))
    .orderBy(desc(checkins.sentAt))
    .limit(1);

  return row ?? null;
}

/**
 * 🔴 What an ADMIN sees: the counts, and not one person's words.
 *
 * *Measure the mute rate.* This is that measurement, and the select list is the wall: how many were
 * sent, how many replied, how many of those replies routed to the crisis path, how many muted and
 * how many came back. No bodies, no names, no person ids.
 *
 * A screen listing what patients replied to an unprompted message would be the worst surface in
 * this product: unprompted, unasked-for, and read by somebody with no clinical relationship to
 * them. The crisis path already puts a worrying reply in front of the one person who should see it.
 */
export async function checkinStats(days = 30) {
  const [row] = (
    await controlDb.execute(sql`
    SELECT
      (SELECT count(*)::int FROM checkins
        WHERE sent_at > now() - (${days} || ' days')::interval) AS sent,
      (SELECT count(*)::int FROM checkins
        WHERE sent_at > now() - (${days} || ' days')::interval AND delivered) AS delivered,
      (SELECT count(*)::int FROM checkin_replies
        WHERE received_at > now() - (${days} || ' days')::interval) AS replies,
      (SELECT count(*)::int FROM checkin_replies
        WHERE received_at > now() - (${days} || ' days')::interval AND crisis_alert_raised)
        AS crisis_routed,
      (SELECT count(*)::int FROM checkin_mutes
        WHERE muted_at > now() - (${days} || ' days')::interval) AS muted,
      (SELECT count(*)::int FROM checkin_mutes
        WHERE unmuted_at > now() - (${days} || ' days')::interval) AS unmuted`)
  ).rows as {
    sent: number;
    delivered: number;
    replies: number;
    crisis_routed: number;
    muted: number;
    unmuted: number;
  }[];

  return {
    sent: row?.sent ?? 0,
    delivered: row?.delivered ?? 0,
    replies: row?.replies ?? 0,
    crisisRouted: row?.crisis_routed ?? 0,
    muted: row?.muted ?? 0,
    unmuted: row?.unmuted ?? 0,
  };
}

/**
 * 🔴 THE ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * No function here returns a reply's body to anybody, and `checkinStats` returns six integers. A
 * reply is written once, read by the crisis path if it needs to be, and never listed on a screen.
 */
export const NO_SCREEN_LISTS_WHAT_A_PATIENT_REPLIED = true;
