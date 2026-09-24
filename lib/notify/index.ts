import "server-only";

import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";
import type { MessageKey } from "@/lib/i18n/messages";
import type { PatientNoticeKind } from "@/lib/db/schema";

/**
 * One place a message to a patient goes out from. PLAN.md 11.7, and C43.
 *
 * ## Why a seam rather than calling Resend from six places
 *
 * Three things are about to want to reach a patient — a booking confirmation,
 * a reminder the day before, and a link to their own summary after a session —
 * and each of them should go by whatever channel that person actually reads.
 * In Egypt that is WhatsApp far more often than email. Building each caller
 * against `sendEmail` would mean rewriting all of them the day a WhatsApp key
 * arrives, which is the day nobody has time.
 *
 * So callers say **what** they want to send and to **whom**, and this module
 * decides how. Today it can decide "email"; tomorrow it can decide "WhatsApp,
 * falling back to email", and no caller changes.
 *
 * ## What is deliberately not here
 *
 * 🔴 **No clinical content, ever.** §6: a patient never sees a transcript or a
 * clinical note, and an outbound message is the easiest place in the product
 * to break that by accident — a "helpful" reminder that quotes the session
 * summary is a chart sitting in a WhatsApp backup on somebody's phone. Every
 * template below is a time, a name, a link, or a sentence written for this
 * purpose. The link goes to a page that does its own authentication.
 */

export type Channel = "email" | "whatsapp";

export type Recipient = {
  /**
   * 🔴 79.1 — THE PERSON, SO THE MESSAGE ALSO LANDS INSIDE THE APP.
   *
   * Every message this function sends used to leave by email or WhatsApp and
   * appear nowhere the recipient could find it again. `patient_notifications`
   * existed the whole time and had exactly three writers, all of them about the
   * employer benefit, so a patient invited to a session by their clinician
   * opened the app to an empty log and no way in. That is what a founder found
   * by inviting a patient on production and watching nothing happen.
   *
   * The delivery channels and the in-app log are the same event, so they are
   * written at the same seam rather than at twenty-six call sites that each
   * have to remember. Pass this and `notice` on the message, and the row is
   * written; pass neither and nothing changes, which is what makes the gate a
   * ratchet rather than a wall.
   */
  personId?: string | null;
  email: string | null;
  /** E.164, or null. 0 of 66 patients had one when this was written — see C43. */
  phone: string | null;
  /** Their own preference, when they have expressed one. */
  prefers?: Channel | null;
  /**
   * IANA zone, for anything time-shaped in the body. 11R.3.
   *
   * Carried on the recipient rather than baked into the body by the caller, so
   * a future channel that formats its own payload has the zone available
   * instead of parsing it back out of a sentence.
   */
  timezone?: string | null;
  /**
   * 🔴 76.50 — WHOSE PRACTICE THIS BELONGS TO, when the caller knows.
   *
   * Optional because several kinds go to somebody with no row anywhere yet: a
   * sponsor contact proving a domain, a person being invited to claim a record
   * they have not claimed. A delivery attempt with no organisation is still
   * worth recording; one that refused to be recorded without one would be a
   * table with a hole exactly where the interesting cases are.
   */
  organizationId?: string | null;
};

export type Message = {
  /**
   * 🔴 79.1 — WHERE THIS LANDS INSIDE THE APP, when it should land anywhere.
   *
   * Two fields rather than one because the row and the channels want different
   * things. `kind` groups it for the reader; `key` is a `MessageKey` resolved
   * at RENDER through the same three layer resolver as every other string, so a
   * notice written in March reads in Arabic in April if the person switches,
   * and an admin can reword every copy of it at once. A `body` column holding a
   * sentence would have frozen the wording at the moment it was sent, in one
   * language, which `lib/data/notices.ts` argues at length.
   *
   * Absent means this message has no in-app home yet. `verify:notices` counts
   * those and the number may only fall.
   */
  notice?: { kind: PatientNoticeKind; key: MessageKey };
  /** A stable key, so a provider template can be mapped to it. */
  kind:
    | "booking.confirmed"
    | "booking.reminder"
    | "booking.cancelled"
    /**
     * 🔴 76.17 — THE DOOR IS OPEN, sent the instant a clinician presses Start.
     *
     * The one kind here that is about RIGHT NOW. Every other message can be read
     * an hour later and still be true; this one is worth nothing an hour later,
     * which is why it hangs off the transition rather than off a schedule: the
     * reminders cron runs hourly, and a nine o'clock session announced at twenty
     * past nine is an apology rather than an alert.
     */
    | "session.started"
    /**
     * 🔴 76.40 — THE CLINICIAN ASKS SOMEBODY TO A SESSION, and it is paid.
     *
     * Distinct from `claim.invite`, which offers somebody their RECORD. This
     * one offers an APPOINTMENT, so it carries a price and a join link rather
     * than a claim token, and the link works without an account: most of the
     * people it goes to have never signed in and should not have to in order
     * to be seen.
     *
     * 🔴 No clinical content, and no reason. "Come and talk about your panic
     * attacks" is a disclosure to whoever else reads that phone. A name, a
     * price and a door.
     */
    | "session.invite"
    | "session.summary_ready"
    | "claim.code"
    /** 13.3 — the therapist hands their patient the link to their own record. */
    | "claim.invite"
    /**
     * 🔴 44.1 / C97 — the unprompted one, and the only message in this list nobody asked for.
     *
     * Every other kind here answers something the person did: they booked, they claimed, they wrote
     * in. This one arrives on a schedule, which is why it is the one with a mute, a quiet window and
     * an admin-controlled rate attached to it, and why its body carries the opt-out.
     *
     * 🔴 It says nothing about them. It asks how they are and stops, because 44.2 is that a check-in
     * asks and never interprets.
     */
    | "checkin.asking"
    /** 16.2 — the manual payout rail, which a person works by hand. */
    | "payout.sent"
    | "payout.rejected"
    /** 🔴 16.3b — the ageing alert. A dashboard at 3am is not an alert. */
    | "payout.overdue"
    /** 🔴 W1-16: a clinician's licence ran out, or will within 30 days. */
    | "licence.expired"
    | "licence.expiring"
    /**
     * 🔴 20.22 — a closed support ticket.
     *
     * This message carries a **link and a code**, and not one word of the
     * ticket: not the topic, not the reply, not their own message quoted back.
     * An email carrying the conversation is patient data leaving the building
     * (§6), and this is the only place that rule could be broken.
     */
    | "support.closed"
    /** 20.16 — the code that proves somebody holds the NEW number. */
    | "phone.verify"
    /**
     * 🔴 21R.4 — the code that lets a patient back into their own record.
     *
     * WhatsApp first and email as well, because most patients in this database
     * have no address (§3b, C43): a reset that can only be emailed is a reset
     * most of the people who need it cannot use.
     */
    | "password.reset_code"
    /**
     * 🔴 26.10 / C128 — the link to a full record extract.
     *
     * Email only. This is the most sensitive document the platform produces,
     * and WhatsApp is the channel most likely to be read by somebody else
     * holding the phone, forwarded in one tap, and backed up to an account the
     * person does not control. The caller enforces it by passing no phone at
     * all, so the fallback cannot fire.
     */
    | "record.export"
    /**
     * 🔴 27.6 / C107 — the patient is told on EVERY new grant.
     *
     * No preference switches this off. The threat model is coercion: somebody
     * pressured into approving, or whose phone was held while somebody else
     * did. The only defence a product can offer is that the fact is visible
     * afterwards and revocation costs nothing.
     */
    | "consent.granted"
    /** 27.7 / C108 — the old clinician's answer, including a refusal. */
    | "history.answered"
    /**
     * 🔴 53.19 / 53.18b — the ONE thing we ever send to a work address.
     *
     * *"A work email used to cross the gate is never used for communication
     * unless the person signed up with it. Stored for matching and
     * de-duplication only, never returned to the sponsor, never a destination
     * for anything we send except the one verification code in 53.19."*
     *
     * So this kind exists, and nothing else in this union may be sent to an
     * identifier address. The enforcement is that `sendEnrolmentCode` is the only
     * caller that reads one, and `verify:sprint53` asserts the address never
     * reaches a second sender.
     *
     * The body says nothing about therapy and names no session. A code arriving
     * in a work inbox that says "your therapy benefit" is a disclosure to
     * whoever administers that mailbox.
     */
    | "benefit.verify_code"
    /**
     * 🔴 61.4 / C318 — the mailbox half of proving a domain.
     *
     * Lands in a shared IT mailbox nobody chose to hand us, so it names an
     * organisation and never a person. 53.2's rule about enrolment strings
     * applies with more force to a message nobody asked for.
     */
    | "sponsor.domain_confirm"
    /*
     * 🔴 68.16 — a partner is approaching the session limit THEY set.
     *
     * Sent to a commercial contact with no clinical standing, so it names a number
     * and never a patient, a session or a clinician. The same rule
     * `sponsor.domain_confirm` follows one principal over.
     */
    | "partner.limit_approaching"
    /**
     * 🔴 75.6 — their fund has run out and their people are being asked to pay.
     *
     * Goes to a finance or HR contact with no clinical standing, so it carries a
     * company name and a verb and NOTHING else. C243: an employer never learns
     * which of their staff attended, and "your pot ran out while somebody was
     * booking" would leak exactly that if it named a person, a time or a
     * therapist.
     *
     * It exists because `payFromPot` computed `reason: "insufficient"` for
     * several sprints and all three of its callers threw the return away, so the
     * one person who could fix it in a minute found out when somebody complained.
     */
    | "sponsor.pot_empty"
    /**
     * 🔴 76.14 — THE TWO MOMENTS A PAYER ON THE EGYPTIAN RAIL HEARS FROM US.
     *
     * There is no processor, so the middle state lasts hours and is invisible
     * from anywhere except the product. A payer who sent money into a bank
     * account and heard nothing cannot tell "being checked" from "lost", and
     * the way that goes wrong is not silence: it is a second transfer, which
     * nobody can reverse.
     *
     * Nothing is sent when a payment is merely OPENED. That row exists the
     * moment somebody reads the account number, which is often not even an
     * intention, and a sender whose messages arrive before they are true is a
     * sender people stop reading.
     */
    | "payment.submitted"
    /** 🔴 And the patient's carries the join link, because that is what they bought. */
    | "payment.confirmed";
  subject: string;
  /** Plain text. WhatsApp has no HTML and an SMS fallback would not want it. */
  body: string;
  /** Optional call to action. Rendered as a button in email, appended in chat. */
  link?: { label: string; url: string } | null;
  /** Values a provider-side template needs, in order. See `lib/notify/whatsapp.ts`. */
  variables?: string[];
};

export type Delivery = {
  sent: boolean;
  /** The first channel that worked. `channels` has the whole story. */
  channel: Channel | null;
  /** Every channel that accepted it. 13R.12 — both, not one. */
  channels: Channel[];
  /** Why nothing went out, when nothing did. Never a stack trace. */
  reason?: string;
};

/**
 * Send one message on **every** channel that can carry it. 13R.12 / §3b.
 *
 * ## Both, not one
 *
 * This used to stop at the first channel that worked, which made email a
 * *fallback*. §3b makes it an addition: WhatsApp is the channel that always
 * exists, and email is sent **as well** whenever there is an address, never
 * instead. A patient who reads their email and not their WhatsApp — or the
 * reverse, which is most of them — should not have to have picked the right one
 * in advance.
 *
 * The cost is two messages for people who have both handles, and that is the
 * intended trade: a duplicate appointment reminder is a mild annoyance, a
 * missed one is a missed appointment.
 *
 * `channel` still reports the first that worked, because every existing caller
 * reads it; `channels` is the whole answer.
 */
export async function notify(to: Recipient, message: Message): Promise<Delivery> {
  const sent: Channel[] = [];

  /*
   * 🔴 THE IN-APP ROW IS WRITTEN FIRST, and that order is the decision.
   *
   * Email and WhatsApp are best effort: a provider is down, a key is missing,
   * a number was never collected. The log inside the app is the one place the
   * person can always come back to, so it must not depend on a third party
   * having answered. A send that fails still leaves them something to open.
   *
   * It is also why this is wrapped: a notice that cannot be written must not
   * swallow a session invitation. The failure is logged and the send proceeds.
   */
  if (to.personId && message.notice) {
    try {
      const { controlDb } = await import("@/lib/db");
      const { patientNotifications } = await import("@/lib/db/schema");
      await controlDb.insert(patientNotifications).values({
        personId: to.personId,
        kind: message.notice.kind,
        messageKey: message.notice.key,
      });
    } catch (error) {
      log.warn("in-app notice not written", {
        kind: message.kind,
        reason: safeErrorMessage(error),
      });
    }
  }

  for (const channel of order(to)) {
    if (channel === "whatsapp") {
      const { whatsappConfigured, sendWhatsapp } = await import("./whatsapp");
      if (!whatsappConfigured() || !to.phone) continue;

      try {
        if (await sendWhatsapp(to.phone, message)) sent.push("whatsapp");
      } catch (error) {
        // Logged, not thrown, and email still goes. A failed WhatsApp send must
        // not lose the message — a reminder that silently did not arrive is
        // worse than one that arrived by the other route.
        log.warn("whatsapp send failed", {
          kind: message.kind,
          reason: safeErrorMessage(error),
        });
      }
    }

    if (channel === "email" && to.email) {
      const { sendNotificationEmail } = await import("./email");
      if (await sendNotificationEmail(to.email, message)) sent.push("email");
    }
  }

  if (sent.length > 0) {
    await record(to, message, sent, null);
    return { sent: true, channel: sent[0]!, channels: sent };
  }

  /*
   * Nothing went out, and that is logged rather than thrown.
   *
   * A patient with no email and no phone is the normal case in this database
   * (56 of 66 have no email; none had a phone), so a booking that cannot send
   * a confirmation must still be a booking. The clinician's screen says
   * whether the patient was reachable — see `Delivery.reason`.
   */
  const reason = !to.email && !to.phone ? "no contact details on file" : "no channel available";
  log.info("notification not sent", { kind: message.kind, reason });
  await record(to, message, [], reason);
  return { sent: false, channel: null, channels: [], reason };
}

/**
 * 🔴 76.50 — EVERY ATTEMPT, SENT OR NOT, WRITTEN DOWN.
 *
 * ## Why the failures matter more than the successes here
 *
 * A message that arrived announces itself: the person replies, turns up, pays.
 * A message that never left is silent in every direction, and the operator
 * meets it as "they did not come to their appointment" weeks later with no way
 * to tell whether the product told them.
 *
 * ## 🔴 IT NEVER THROWS, and that is the whole contract
 *
 * This is bookkeeping attached to the end of a send. A booking whose
 * confirmation could not be recorded is still a booking, and a `notify()` that
 * could fail because its audit row failed would be a worse function than the
 * one with no audit row at all. Anything that goes wrong here is logged and
 * swallowed.
 */
async function record(
  to: Recipient,
  message: Message,
  channels: Channel[],
  reason: string | null,
): Promise<void> {
  try {
    const { dbFor } = await import("@/lib/db");
    const { pinnedToDefaultRegion } = await import("@/lib/db/region");
    const { deliveryAttempts } = await import("@/lib/db/schema");

    const db = dbFor(
      pinnedToDefaultRegion(
        "lib/notify/index.ts",
        "not routed yet: a recipient is a phone and an address, and neither names a region",
      ),
    );

    await db.insert(deliveryAttempts).values({
      kind: message.kind,
      hadPhone: Boolean(to.phone),
      hadEmail: Boolean(to.email),
      channels,
      reason,
      organizationId: to.organizationId ?? null,
    });
  } catch (error) {
    log.warn("could not record a delivery attempt", {
      kind: message.kind,
      reason: safeErrorMessage(error),
    });
  }
}

function order(to: Recipient): Channel[] {
  if (to.prefers === "email") return ["email", "whatsapp"];
  if (to.prefers === "whatsapp") return ["whatsapp", "email"];
  return ["whatsapp", "email"];
}

/** Whether anything at all can reach this person. Drives the UI's warning. */
export function reachable(to: Recipient): boolean {
  return Boolean(to.email || to.phone);
}

/** True when email is configured at all. Used by the verifier and the console. */
export function emailConfigured(): boolean {
  return Boolean(env.resendApiKey);
}
