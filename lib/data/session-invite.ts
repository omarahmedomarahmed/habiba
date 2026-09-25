import "server-only";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { getConnectAccount } from "@/lib/billing/connect";
import { getPatient } from "@/lib/data/patients";
import { createSession, ensureRoom } from "@/lib/data/sessions";
import { env } from "@/lib/env";
import { wordsFor } from "@/lib/i18n/message-words";
import { notify } from "@/lib/notify";
import { fullName } from "@/lib/utils";

export type SessionInvite =
  | { url: string; priceCents: number; sent: boolean; channel: "email" | "whatsapp" | null }
  | { error: string };

/**
 * 🔴 76.40 — INVITE THIS PATIENT TO A PAID SESSION, FROM THEIR OWN PROFILE.
 *
 * ## The gap
 *
 * A clinician looking at somebody's record and deciding to see them again had
 * to leave, open the new-session form, find them in a select, re-answer four
 * questions, and then copy a link out of the result. The one screen with the
 * patient, their number and their history on it could not book them.
 *
 * So: one control, on the profile. It creates the session at this clinician's
 * own rate and sends the join link to the number or the address already on the
 * chart.
 *
 * ## 🔴 WHY THIS IS A DATA MODULE AND NOT THE SERVER ACTION
 *
 * The action above it is four lines: read the signed-in clinician, call this,
 * revalidate. Everything worth getting wrong is here, and here it takes an
 * `actor` argument, which is the difference between a function a gate can run
 * against real rows and one that can only be reached through a browser with a
 * cookie.
 *
 * "Make sure it actually works" is not a property of source. `verify:profile`
 * calls this, then reads the `sessions` row it made and checks the price, the
 * patient, the modality and the token.
 *
 * ## 🔴 THE PRICE IS THE CLINICIAN'S OWN RATE, READ ON THE SERVER
 *
 * Never a figure from the browser, and never an argument. `sessionRateCents` is
 * what they set in settings and what every other surface charges, so a link
 * issued here asks the same amount as a link issued anywhere else. C311: a
 * price somebody was shown is a price they are owed, and the way to keep that
 * true is one source for the number.
 *
 * ## 🔴 AND IT REFUSES WITHOUT A WAY TO REACH THEM
 *
 * A walk-in chart (76.36) has a name and nothing else, which is correct: they
 * were in the room. An invitation needs somewhere to go, so this refuses with a
 * sentence naming the fix rather than creating a session, billing for it, and
 * telling the clinician it was sent. The editor that adds a number is on the
 * same screen.
 */
export async function inviteToSession(actor: Actor, patientId: string): Promise<SessionInvite> {
  const patient = await getPatient(actor, patientId);
  if (!patient) return { error: "That patient is not in your practice." };

  if (!patient.phone && !patient.email) {
    return {
      error: "Add a mobile number or an email first, then the invitation has somewhere to go.",
    };
  }

  const connect = await getConnectAccount(actor.userId);
  const priceCents = Math.max(0, Math.round(connect.sessionRateCents ?? 0));

  if (priceCents <= 0) {
    return {
      error: "Set what a session costs in your settings first, then this can invite them to one.",
    };
  }

  const session = await createSession(actor, {
    modality: "video",
    patientId,
    priceCents,
  });

  if (!session?.joinToken) {
    return { error: "Could not create the session. Try again." };
  }

  /*
   * 🔴 79.1 — THE THIRD PATH, AND THE ONE THAT ACTUALLY BIT.
   *
   * This creates a `modality: "video"` session and, until now, no room. Not a
   * room that failed to build: no attempt at all. The clinician pressed Invite,
   * the patient got a message with a door in it, both of them opened it, and
   * they sat in the same session record unable to hear each other.
   *
   * It was missed twice over. `startNewSession` and the radar both build a room
   * and were the two places anybody looked, so the rule read as "the room is
   * built where sessions are made" when it was really "the room is built in two
   * of the three places sessions are made". And the first diagnosis of the
   * live failure blamed a missing `DAILY_API_KEY`, which was wrong: the console
   * health check says the key works and always did. The room was never asked
   * for.
   *
   * `ensureRoom` on arrival covers the sessions already out there. This covers
   * the ones made from here on, which matters because the comment in
   * `startNewSession` states the actual rule: whoever arrives first should
   * never find an empty room, and the patient is usually first.
   */
  const built = await ensureRoom({
    id: session.id,
    modality: "video",
    videoRoomUrl: null,
    videoRoomName: null,
  });
  if (!built.ok) {
    return {
      error:
        "We could not open a room for this session, so nobody has been invited. Try again in a moment.",
    };
  }

  const url = `${env.appUrl}/join/${session.joinToken}`;
  const who = fullName(actor.firstName, actor.lastName);
  /* 🔴 Ruling 8: in the language the patient chose. */
  const words = await wordsFor(patient.personId ? { personId: patient.personId } : null);
  const { t } = words;

  /*
   * 🔴 NO CLINICAL CONTENT AND NO REASON. A name, a price and a door. The same
   * rule the claim invitation follows, and for the same reason: a message sits
   * in somebody's notifications where other people can read it, and "come and
   * talk about your panic attacks" is a disclosure to whoever is holding the
   * phone.
   */
  const delivery = await notify(
    {
      /*
       * 🔴 79.1 — AND IT LANDS INSIDE THE APP TOO.
       *
       * This message used to leave by email or WhatsApp and appear nowhere the
       * patient could find it again. A clinician invited a patient on
       * production, the patient opened the app, and there was nothing there:
       * no invitation, no price, no door. `notify()` writes the in-app row when
       * it is given a person and a notice, so this is the whole fix.
       */
      personId: patient.personId,
      email: patient.email,
      phone: patient.phone,
      timezone: patient.timezone,
      locale: words.locale,
    },
    {
      notice: { kind: "session_invited", key: "pnotice.sessionInvited" },
      kind: "session.invite",
      subject: t("pmsg.invite.subject", { who }),
      body: t("pmsg.invite.body", { who }),
      link: { label: t("pmsg.invite.link"), url },
      variables: [who],
    },
  );

  await audit({
    actor,
    category: "clinical",
    action: "session.invite.send",
    resourceType: "patient",
    resourceId: patientId,
    reason: `invited to a paid session at ${priceCents} cents`,
  });

  return { url, priceCents, sent: delivery.sent, channel: delivery.channel };
}
