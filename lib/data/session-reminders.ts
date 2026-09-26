import "server-only";

import { and, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { patients, sessionReminders, sessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { whenFor, wordsFor } from "@/lib/i18n/message-words";
import { log, ref, safeErrorMessage } from "@/lib/logger";
import { notify } from "@/lib/notify";
import { resolveZone } from "@/lib/scheduling/tz";
import { capSeconds } from "@/lib/session-clock";
import { patientSessionUrl } from "@/lib/sessions/patient-link";
import { dueMark, LOOKAHEAD_MINUTES, OPEN_NOW_MARK, type ReminderMark } from "@/lib/sessions/reminders";
import { getSettings } from "@/lib/settings";

/**
 * 🔴 0183: THE MINUTE TICK. Sends the 60, 30 and 15 minute reminders and the
 * "you can go in now" at 5, for every booked session starting inside the hour.
 *
 * The rule (which mark, and when a mark is stale) is `lib/sessions/reminders.ts`,
 * pure and tested. This is the I/O around it:
 *
 *   1. One indexed read: sessions still `scheduled`, not cancelled, not started,
 *      with a join link, booked inside the next hour, with the marks already
 *      claimed for that booked instant.
 *   2. For each one with a mark due, the CLAIM: an insert into
 *      `session_reminders` that does nothing on conflict. Only the tick whose
 *      insert returned a row sends, so two ticks that overlap cannot both send,
 *      and a rerun sends nothing twice.
 *   3. The message, through `notify()` like every other patient message: email
 *      (the outbox while SIMULATION_RUNNING holds invented addresses), WhatsApp
 *      when they have a number, and the in-app notice, in the patient's language.
 *
 * ## Why no quiet hours here
 *
 * The day-before reminder waits for morning (11R.16). These do not: the patient
 * chose this hour for their session, and a reminder about a session starting in
 * fifteen minutes that waits until morning is no reminder at all.
 *
 * ## A failed message never stops the tick
 *
 * Each send is caught on its own; the claim is kept with outcome `failed`, so
 * a provider that is down produces one logged failure per mark rather than a
 * retry every minute for an hour.
 */
export async function sweepSessionReminders(now: Date = new Date()): Promise<{
  due: number;
  sent: number;
  unreachable: number;
  failed: number;
}> {
  const until = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60_000);

  const rows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      scheduledAt: sessions.scheduledAt,
      startedAt: sessions.startedAt,
      cancelledAt: sessions.cancelledAt,
      joinToken: sessions.joinToken,
      guestEmail: sessions.guestEmail,
      organizationId: sessions.organizationId,
      patientEmail: patients.email,
      patientPhone: patients.phone,
      patientTimezone: patients.timezone,
      personId: patients.personId,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      therapistTimezone: users.timezone,
      /* The marks already claimed for THIS booked instant; a moved booking starts afresh. */
      sent: sql<number[]>`COALESCE((
        SELECT array_agg(r."mark") FROM ${sessionReminders} r
         WHERE r."session_id" = ${sessions.id}
           AND r."scheduled_for" = ${sessions.scheduledAt}
      ), ARRAY[]::integer[])`,
    })
    .from(sessions)
    .leftJoin(patients, and(eq(patients.id, sessions.patientId), isNull(patients.deletedAt)))
    .leftJoin(users, eq(users.id, sessions.therapistId))
    .where(
      and(
        eq(sessions.status, "scheduled"),
        isNull(sessions.cancelledAt),
        isNull(sessions.startedAt),
        isNotNull(sessions.joinToken),
        gt(sessions.scheduledAt, now),
        lte(sessions.scheduledAt, until),
      ),
    )
    .limit(500);

  let due = 0;
  let sent = 0;
  let unreachable = 0;
  let failed = 0;

  const settings = rows.length > 0 ? await getSettings() : null;

  for (const row of rows) {
    const mark = dueMark(row, now.getTime(), (row.sent ?? []).map(Number));
    if (mark === null || !row.scheduledAt || !settings) continue;
    due += 1;

    const [claimed] = await db
      .insert(sessionReminders)
      .values({ sessionId: row.id, mark, scheduledFor: row.scheduledAt })
      .onConflictDoNothing()
      .returning({ mark: sessionReminders.mark });
    if (!claimed) continue;

    let outcome: "sent" | "unreachable" | "failed" = "sent";
    try {
      const delivered = await sendReminder(row, mark, {
        lengthMinutes: Math.round(capSeconds(settings.clock) / 60),
        earlyMinutes: settings.rules.start.joinEarlyMinutes,
      });
      outcome = delivered ? "sent" : "unreachable";
    } catch (error) {
      outcome = "failed";
      log.warn("session reminder not sent", { session: ref(row.id), mark, reason: safeErrorMessage(error) });
    }

    if (outcome !== "sent") {
      await db
        .update(sessionReminders)
        .set({ outcome })
        .where(
          and(
            eq(sessionReminders.sessionId, row.id),
            eq(sessionReminders.mark, mark),
            eq(sessionReminders.scheduledFor, row.scheduledAt),
          ),
        );
    }
    if (outcome === "sent") sent += 1;
    else if (outcome === "unreachable") unreachable += 1;
    else failed += 1;
  }

  return { due, sent, unreachable, failed };
}

async function sendReminder(
  row: {
    id: string;
    scheduledAt: Date | null;
    joinToken: string | null;
    guestEmail: string | null;
    organizationId: string;
    patientEmail: string | null;
    patientPhone: string | null;
    patientTimezone: string | null;
    personId: string | null;
    therapistFirst: string | null;
    therapistLast: string | null;
    therapistTimezone: string | null;
  },
  mark: ReminderMark,
  clock: { lengthMinutes: number; earlyMinutes: number },
): Promise<boolean> {
  const email = row.patientEmail ?? row.guestEmail ?? null;
  const url = patientSessionUrl(env.appUrl, row.joinToken);
  if (!row.scheduledAt || !url) return false;
  if (!email && !row.patientPhone && !row.personId) return false;

  /* 🔴 Ruling 8: in the patient's own language and zone, the date included. */
  const words = await wordsFor(row.personId ? { personId: row.personId } : null);
  const { t } = words;
  const zone = resolveZone(row.patientTimezone, row.therapistTimezone);
  const when = whenFor(row.scheduledAt, zone, words);
  const therapist =
    [row.therapistFirst, row.therapistLast].filter(Boolean).join(" ") || t("pmsg.yourTherapist");
  const vars = { therapist, when, length: clock.lengthMinutes, early: clock.earlyMinutes };

  /*
   * The 5 is "go in now" only when the room really is open by then: the join
   * window is an audited setting (`rules.start.joinEarlyMinutes`), and a
   * message saying "go in now" to a door that is still shut is worse than none.
   */
  const openNow = mark === OPEN_NOW_MARK && clock.earlyMinutes >= OPEN_NOW_MARK;

  const delivery = await notify(
    {
      personId: row.personId,
      email,
      phone: row.patientPhone,
      timezone: row.patientTimezone,
      organizationId: row.organizationId,
      locale: words.locale,
    },
    openNow
      ? {
          notice: { kind: "session_invited", key: "pnotice.openNow", sessionId: row.id },
          kind: "booking.reminder",
          subject: t("pmsg.openNow.subject"),
          body: t("pmsg.openNow.body", vars),
          link: { label: t("pmsg.openNow.link"), url },
          variables: [therapist, when],
        }
      : {
          notice: { kind: "session_invited", key: "pnotice.reminderSoon", sessionId: row.id },
          kind: "booking.reminder",
          subject:
            mark === 60
              ? t("pmsg.soon.subjectHour", { therapist })
              : t("pmsg.soon.subjectMinutes", { therapist, minutes: mark }),
          body: t("pmsg.soon.body", vars),
          link: { label: t("pmsg.openSession"), url },
          variables: [therapist, when],
        },
  );

  return delivery.sent;
}
