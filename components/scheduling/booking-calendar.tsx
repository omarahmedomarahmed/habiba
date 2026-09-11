"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, Clock } from "lucide-react";

import { book } from "@/app/(public)/t/[id]/book/actions";
import { Card } from "@/components/ui";
import { byDayIn, formatTime, formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { PhoneField } from "@/components/forms/phone-field";
import { countryFromLocale } from "@/lib/phone/e164";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * The booking calendar on a public profile. PLAN.md 11.3.
 *
 * ## Times are shown in the reader's own zone
 *
 * The server stores and reasons in UTC; a person choosing an evening appointment
 * needs to see their evening. `toLocaleTimeString` with no locale argument uses
 * the browser's, which is the only clock the person actually lives in.
 *
 * ## What happens when we cannot confirm
 *
 * The Resend domain is not verified and there is no WhatsApp key, so most
 * bookings today send nothing. The confirmation screen says which happened,
 * plainly, and tells them to write the time down when it did not — "check your
 * email" for a message that was never sent is how somebody misses their
 * appointment.
 */
export function BookingCalendar({
  slots,
  therapistName,
  therapistTimezone,
  rateLabel,
}: {
  slots: { id: string; startsAt: string }[];
  therapistName: string;
  /** The zone the first render uses, before the browser answers. 12.3 / C84. */
  therapistTimezone: string | null;
  rateLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [picked, setPicked] = useState<{ id: string; startsAt: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(
    () => countryFromLocale(typeof navigator === "undefined" ? null : navigator.language) ?? "EG",
  );
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ when: string; sent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * 11R.1 / 11R.4 — the reader's own zone, used for every time on this screen.
   * The same string is sent to the server with the booking, so the
   * confirmation is rendered in it too — that is C61: the calendar said 22:00
   * and the email said 19:00 UTC.
   *
   * 🔴 12.3 / C84 — read **after mount**, not during render.
   *
   * This called `Intl.DateTimeFormat().resolvedOptions().timeZone` inline. On
   * the SSR pass that is the server's zone, so this page — the one where a
   * patient picks an appointment — shipped 22:00 UTC in the HTML and hydrated
   * to 00:00 Cairo. C61 was that exact bug in the email; this was the same bug
   * between the two render passes of the calendar itself.
   *
   * The therapist's zone is the fallback rather than UTC. The server knows it,
   * both passes agree on it, and somebody looking at this profile is far more
   * likely to be near that clinician than to be in UTC.
   *
   * `useReaderZone()` is called with **no fallback** deliberately: the fallback
   * belongs in `resolveZone`, where it is recorded as `source: "clinician"`.
   * Folding it into the hook would make `zone.source` read `"reader"` before
   * the browser has said anything — and the booking below sends the zone to
   * the server only when it really is the reader's, so a wrong `source` would
   * file the therapist's zone as the patient's.
   */
  const detected = useReaderZone();
  const zone = resolveZone(detected, therapistTimezone);

  const days = byDayIn(
    slots.map((s) => ({ ...s, startsAt: new Date(s.startsAt) })),
    zone.name,
    locale,
  );

  if (done) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Check className="h-4 w-4 text-teal-500" aria-hidden />
          Booked with {therapistName}
        </p>
        <p className="mt-1 text-sm text-slate-700">{done.when}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {done.sent
            ? "We have sent you a confirmation with the link to join."
            : "🔴 We could not send you a confirmation, write this time down. Your therapist has it too."}
        </p>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
          {t("pbook.noTimes")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {therapistName} has not published any hours yet. If this is urgent, they may be on the
          Crisis Radar right now.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
        {t("pbook.bookSession")}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        One hour with {therapistName} · {rateLabel}
      </p>

      {picked ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
            {formatWhen(new Date(picked.startsAt), zone, locale)}
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("pbook.firstName")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder={t("pbook.email")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          {/*
            11R.12 — a country beside the number, because expanding a national
            number without one is guessing which country's human being to
            message.
          */}
          <PhoneField
            value={phone}
            country={phoneCountry}
            onValueChange={setPhone}
            onCountryChange={setPhoneCountry}
            placeholder={t("pbook.phone")}
          />

          {/*
            11R.21 — one of the two, required. Said before they type, not after
            they submit: a booking nobody can be told about is not a booking.
          */}
          <p className="text-xs leading-relaxed text-slate-500">
            {t("pbook.oneOfThese")}
          </p>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("pbook.note")}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !name.trim() || (!email.trim() && !phone.trim())}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await book({
                    slotId: picked.id,
                    name,
                    email,
                    phone,
                    phoneCountry,
                    note,
                    timezone: zone.source === "reader" ? zone.name : undefined,
                  });
                  if (result.error) setError(result.error);
                  else if (result.booked) {
                    // The server rendered this string, in this zone. The screen
                    // and the message cannot disagree because there is one of
                    // them.
                    setDone({
                      when: result.booked.when,
                      sent: Boolean(result.confirmationSent),
                    });
                  }
                })
              }
              className="tap-target h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Booking…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="tap-target h-11 rounded-xl px-3 text-sm font-medium text-slate-600"
            >
              {t("pbook.pickAnother")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {days.slice(0, 10).map((day) => (
            <div key={day.key}>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {day.label}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {day.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() =>
                      setPicked({ id: slot.id, startsAt: slot.startsAt.toISOString() })
                    }
                    className="tap-target flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:border-slate-900 hover:bg-slate-50"
                  >
                    <Clock className="h-3 w-3 text-slate-400" aria-hidden />
                    {formatTime(slot.startsAt, zone.name)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
