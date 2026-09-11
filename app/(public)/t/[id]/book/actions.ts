"use server";

import { bookSlot, holdSlot, slotOwner } from "@/lib/data/scheduling";
import { e164Problem, toE164 } from "@/lib/phone/e164";
import { formatWhenWithCaveat, resolveZone } from "@/lib/scheduling/tz";
import { notify } from "@/lib/notify";
import { env } from "@/lib/env";
import { callerKey, consume, subjectKey } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export type BookState = {
  error?: string;
  booked?: { startsAt: string; therapistName: string; when: string };
  /** Whether we could actually tell them, and by what. Reported, never assumed. */
  confirmationSent?: boolean;
  channel?: "email" | "whatsapp" | null;
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
  /** ISO-3166 alpha-2, from the selector beside the phone field. 11R.12. */
  phoneCountry?: string;
  note?: string;
  /** The reader's own zone, so the confirmation is rendered in it. 11R.3. */
  timezone?: string;
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

  /*
   * 11R.22 — two more ceilings, because the per-caller one is the easiest of
   * the three to walk around.
   *
   * The per-caller limit is keyed on an IP. Six an hour from each of a hundred
   * addresses is six hundred bookings against one clinician's calendar, and
   * every one of them creates a patient row and a session. These two are keyed
   * on the *thing being harmed* rather than on whoever is doing it: one hour,
   * and one clinician's week.
   *
   * Deliberately generous. A therapist with a popular Tuesday genuinely does
   * get several attempts on the same hour within a minute of publishing it —
   * that is the race `holdSlot` exists to settle — so this has to sit well
   * above ordinary contention. It is a ceiling, not a queue.
   */
  const perSlot = await consume(subjectKey("book:slot", input.slotId), 12, 60 * 60);
  if (!perSlot.allowed) {
    return { error: "That time is getting a lot of attempts right now. Try another." };
  }

  const owner = await slotOwner(input.slotId);
  if (!owner) return { error: "That time is no longer on the calendar." };

  const perTherapist = await consume(subjectKey("book:therapist", owner), 40, 60 * 60);
  if (!perTherapist.allowed) {
    return {
      error: "This calendar is busy right now. Try again shortly, or use the crisis radar.",
    };
  }

  const name = input.name.trim();
  if (!name) return { error: "Please enter your first name." };
  if (name.length > 80) return { error: "That name is a little long." };

  /*
   * 11R.21 — one contact method, required.
   *
   * C67: a stranger could book with a first name and nothing else, six an
   * hour, each creating a patient row and a session row. But the reason this
   * is a *product* rule rather than an anti-abuse one is simpler: a booking
   * nobody can be told about is not a booking. There is no confirmation, no
   * reminder, and no way to tell them when the clinician cancels.
   */
  const email = input.email?.trim() || null;
  const rawPhone = input.phone?.trim() || null;

  if (!email && !rawPhone) {
    return {
      error:
        "We need an email or a phone number, otherwise we cannot send you the link or tell you if anything changes.",
    };
  }

  /*
   * 11R.12 — expanded to E.164 with the country the form asked for, or
   * refused. Never guessed: `0100 123 4567` is a real number in Egypt, Italy
   * and Kenya, and picking one would send a stranger somebody's appointment.
   */
  let phone: string | null = null;
  if (rawPhone) {
    const parsed = toE164(rawPhone, input.phoneCountry ?? null);
    if (!parsed.ok) return { error: e164Problem(parsed) ?? "Check that phone number." };
    phone = parsed.e164;
  }

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
    patientEmail: email,
    patientPhone: phone,
    patientTimezone: input.timezone ?? null,
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
  /*
   * 🔴 §6 / C61 — rendered in the reader's zone by the one formatter, never
   * `toISOString()`. The defect this replaces: the calendar said "22:00" and
   * this email said "19:00 UTC", and the patient had to work out which to
   * trust while deciding when to leave the house.
   */
  const zone = resolveZone(input.timezone, result.therapistTimezone);
  const when = formatWhenWithCaveat(result.startsAt, zone, "en");

  const delivery = await notify(
    { email, phone, timezone: input.timezone ?? null },
    {
      kind: "booking.confirmed",
      subject: `Your session with ${result.therapistName}`,
      body: `Your session with ${result.therapistName} is booked for ${when}.\n\nJoin from the link below a few minutes before. If you need to cancel, tell your therapist as early as you can.`,
      link: { label: "Open your session", url: `${env.appUrl}/sessions/${result.sessionId}` },
      variables: [result.therapistName, when],
    },
  );

  log.info("booking confirmed", { sent: delivery.sent, channel: delivery.channel ?? "none" });

  return {
    booked: {
      startsAt: result.startsAt.toISOString(),
      therapistName: result.therapistName,
      // Rendered once, on the server, in the reader's zone — so the screen and
      // the message cannot disagree.
      when,
    },
    confirmationSent: delivery.sent,
    channel: delivery.channel,
  };
}
