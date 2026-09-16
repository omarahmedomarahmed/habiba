import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { patients, sessions, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";

/**
 * 🔴 76.17 — THE DOOR IS OPEN. Sent the moment a clinician starts the session.
 *
 * ## Why this is an event and not a schedule
 *
 * The obvious build is a cron that fires at the booked time. Two things are
 * wrong with it, and the second is the one that matters.
 *
 * The reminders job runs hourly at twenty past, because everything in this
 * product is folded into five cron jobs on purpose. A session at nine would be
 * told about at twenty past nine, which is not an alert, it is an apology.
 *
 * And the booked time is not when the door opens. A clinician running six
 * minutes late has a patient sitting in an empty room wondering whether they
 * are in the right place, which `no-show-recovery.tsx` exists because of. The
 * instant a patient can actually walk in is the instant somebody pressed
 * Start, so that is the instant this fires. It is one message, about a fact,
 * at the moment the fact becomes true.
 *
 * ## 🔴 EXACTLY ONCE, AND THE TRANSITION IS WHAT GUARANTEES IT
 *
 * Nothing here checks whether we already sent one. `startSession` only calls
 * this when its UPDATE actually moved the row out of `scheduled`, which the
 * database decides. Re-entering a live room transitions nothing and sends
 * nothing, and two clinicians pressing Start together produce one winner.
 *
 * A patient's phone buzzing twice about one session is how somebody learns to
 * ignore the buzz, and this is the one message on this product that is worth
 * interrupting them for.
 *
 * ## The link is the join link, not the session page
 *
 * `/sessions/<id>` is the CLINICIAN's page. A patient sent there meets a sign
 * in wall, and the whole design of this rail is that a patient never needs an
 * account to be in a room. The join token is the door.
 *
 * ## 🔴 A FAILED MESSAGE NEVER FAILS A SESSION
 *
 * Wrapped, like the payment notices. The room is already open by the time this
 * runs; throwing would turn a delivery problem into a clinician who cannot
 * start a session, with a patient waiting.
 */
export async function noticeSessionStarted(sessionId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        joinToken: sessions.joinToken,
        guestName: sessions.guestName,
        /*
         * The patient's own contact, falling back to the guest's. The exact
         * shape `bookingsNeedingReminder` uses, so the two messages about one
         * session can never reach different people.
         */
        email: sessions.guestEmail,
        patientEmail: patients.email,
        patientPhone: patients.phone,
        patientFirst: patients.firstName,
        therapistFirst: users.firstName,
        therapistLast: users.lastName,
      })
      .from(sessions)
      .leftJoin(patients, and(eq(patients.id, sessions.patientId), isNull(patients.deletedAt)))
      .leftJoin(users, eq(users.id, sessions.therapistId))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!row?.joinToken) return;

    const to = {
      email: row.patientEmail ?? row.email ?? null,
      phone: row.patientPhone ?? null,
    };
    if (!to.email && !to.phone) return;

    const name = row.patientFirst ?? row.guestName ?? "there";
    const therapist = [row.therapistFirst, row.therapistLast].filter(Boolean).join(" ");
    const url = `${env.appUrl}/join/${row.joinToken}`;

    await notify(to, {
      kind: "session.started",
      subject: "Your session has started",
      body:
        `Hi ${name},\n\n` +
        (therapist
          ? `${therapist} is in the room and waiting for you.`
          : "Your therapist is in the room and waiting for you.") +
        "\n\nUse the link below to go in.",
      link: { label: "Go in now", url },
      /*
       * 🔴 ONE VARIABLE, THE THERAPIST'S NAME, and the template has to agree.
       * `sendWhatsapp` refuses a count mismatch rather than sending a message
       * with a hole in it, which is the right failure and is worth knowing
       * about: the email still goes.
       */
      variables: [therapist || "Your therapist"],
    });
  } catch (error) {
    log.warn("could not tell a patient their session had started", {
      session: ref(sessionId),
      reason: String(error),
    });
  }
}
