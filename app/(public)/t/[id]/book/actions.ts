"use server";

import { bookSlot, holdSlot } from "@/lib/data/scheduling";
import { notify } from "@/lib/notify";
import { env } from "@/lib/env";
import { callerKey, consume } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export type BookState = {
  error?: string;
  booked?: { startsAt: string; therapistName: string };
  /** Whether we could actually tell them. Reported, never assumed. */
  confirmationSent?: boolean;
};

/**
 * Book an hour from a public profile. PLAN.md 11.3 / 11.7.
 *
 * Unauthenticated, like the join flow: somebody booking their first session
 * has no account, and requiring one is the step that loses them.
 */
export async function book(input: {
  slotId: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
}): Promise<BookState> {
  /*
   * Throttled on the caller. The side effects are real — each accepted booking
   * creates a patient row and a session — and unbounded side effects on an
   * unauthenticated endpoint are worth bounding whether or not there is an
   * obvious attack.
   */
  const throttle = await consume(await callerKey("book"), 6, 60 * 60);
  if (!throttle.allowed) {
    return { error: "Too many attempts. Wait a moment and try again." };
  }

  const name = input.name.trim();
  if (!name) return { error: "Please enter your first name." };
  if (name.length > 80) return { error: "That name is a little long." };

  /*
   * Hold first, then book. The hold is a conditional UPDATE, so two people
   * pressing the same Tuesday at the same moment produce one winner and one
   * honest refusal — decided by the database rather than by whichever request
   * happened to read first.
   */
  const held = await holdSlot(input.slotId);
  if (!held.ok) return { error: held.error };

  const result = await bookSlot({
    slotId: input.slotId,
    patientName: name,
    patientEmail: input.email?.trim() || null,
    patientPhone: input.phone?.trim() || null,
    note: input.note?.trim() || null,
  });

  if (!result.ok) return { error: result.error };

  /*
   * 11.7 — the confirmation.
   *
   * 🔴 A time, a name and a link. No clinical content: this message ends up in
   * an inbox or a WhatsApp backup, and §6's rule about what a patient sees
   * does not stop at our own screens.
   *
   * Whether it arrived is returned to the page rather than assumed. The Resend
   * domain is not verified yet and there is no WhatsApp key, so today the
   * honest answer is usually "no" — and a booking screen that says "we have
   * emailed you" when nothing was sent is worse than one that says to write
   * the time down.
   */
  const when = result.startsAt.toISOString().replace("T", " ").slice(0, 16);
  const delivery = await notify(
    { email: input.email?.trim() || null, phone: input.phone?.trim() || null },
    {
      kind: "booking.confirmed",
      subject: `Your session with ${result.therapistName}`,
      body: `Your session with ${result.therapistName} is booked for ${when} UTC.\n\nJoin from the link below a few minutes before. If you need to cancel, reply to this message or tell your therapist.`,
      link: { label: "Open your session", url: `${env.appUrl}/sessions/${result.sessionId}` },
      variables: [result.therapistName, `${when} UTC`],
    },
  );

  log.info("booking confirmed", { sent: delivery.sent, channel: delivery.channel ?? "none" });

  return {
    booked: { startsAt: result.startsAt.toISOString(), therapistName: result.therapistName },
    confirmationSent: delivery.sent,
  };
}
