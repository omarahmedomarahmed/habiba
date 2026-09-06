import "server-only";

import { env } from "@/lib/env";
import { log, safeErrorMessage } from "@/lib/logger";

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
};

export type Message = {
  /** A stable key, so a provider template can be mapped to it. */
  kind:
    | "booking.confirmed"
    | "booking.reminder"
    | "booking.cancelled"
    | "session.summary_ready"
    | "claim.code"
    /** 13.3 — the therapist hands their patient the link to their own record. */
    | "claim.invite";
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
  return { sent: false, channel: null, channels: [], reason };
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
