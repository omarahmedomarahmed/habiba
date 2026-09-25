"use client";

import { useId, useState, useTransition } from "react";
import { CalendarDays, Check, Clock } from "lucide-react";

import { book } from "@/app/(public)/t/[id]/book/actions";
import { Card } from "@/components/ui";
import { byDayIn, formatTime, formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { PhoneField } from "@/components/forms/phone-field";
import { countryFromE164, readerCountry } from "@/lib/phone/e164";
import { useLocale, useT } from "@/lib/i18n/client";
import { rich, slot } from "@/lib/i18n/rich";

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
  booker,
  practice,
}: {
  /** 🔴 Ruling 5c: each hour says where it can be booked for. */
  slots: { id: string; startsAt: string; place?: "online" | "in_person" | "either" }[];
  /** The practice address, shown for an in-person hour. */
  practice?: { name: string | null; address: string } | null;
  therapistName: string;
  /** The zone the first render uses, before the browser answers. 12.3 / C84. */
  therapistTimezone: string | null;
  rateLabel: React.ReactNode;
  /**
   * A signed-in patient's own details, so the form is already filled in.
   * The walkthrough found a signed-in patient asked to type their name,
   * email and number again to book. The server still takes the person from
   * the cookie (W2-P04); this only saves the typing.
   */
  booker?: { firstName: string; email: string | null; phone: string | null } | null;
}) {
  const t = useT();
  const ids = useId();
  const locale = useLocale();
  const [picked, setPicked] = useState<{ id: string; startsAt: string; place?: string } | null>(null);
  /* 🔴 Ruling 5c: on an "either" hour the patient chooses. */
  const [meet, setMeet] = useState<"online" | "in_person">("online");
  const [name, setName] = useState(booker?.firstName ?? "");
  const [email, setEmail] = useState(booker?.email ?? "");
  /* An E.164 number is taken as given by `toE164`, so the country beside it is only a label. */
  const [phone, setPhone] = useState(booker?.phone ?? "");
  const [phoneCountry, setPhoneCountry] = useState(
    () => countryFromE164(booker?.phone ?? null) ?? readerCountry(),
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
          <Check className="h-4 w-4 text-brand-500" aria-hidden />
          {t("pbook.bookedWith", { name: therapistName })}
        </p>
        <p className="mt-1 text-sm text-slate-700">{done.when}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {done.sent ? t("pbook.confirmSent") : t("pbook.confirmNotSent")}
        </p>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
          {t("pbook.noTimes")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("pbook.noHours", { name: therapistName })}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden />
        {t("pbook.bookSession")}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {rich(t("pbook.sessionWith", { name: therapistName, rate: slot(0) }), [rateLabel])}
      </p>

      {picked ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
            {formatWhen(new Date(picked.startsAt), zone, locale)}
          </p>

          {/*
            🔴 B60 — A LABEL YOU CAN SEE, ABOVE EVERY FIELD. These were
            placeholder only, so the words vanished at the first keystroke and
            a screen reader had nothing to name the field by.
          */}
          <label htmlFor={`${ids}-name`} className="block text-xs font-medium text-slate-700">
            {t("pbook.firstName")}
          </label>
          <input
            id={`${ids}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <label htmlFor={`${ids}-email`} className="block text-xs font-medium text-slate-700">
            {t("pbook.email")}
          </label>
          <input
            id={`${ids}-email`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          {/*
            11R.12 — a country beside the number, because expanding a national
            number without one is guessing which country's human being to
            message.
          */}
          <label htmlFor={`${ids}-phone`} className="block text-xs font-medium text-slate-700">
            {t("pbook.phone")}
          </label>
          <PhoneField
            id={`${ids}-phone`}
            value={phone}
            country={phoneCountry}
            onValueChange={setPhone}
            onCountryChange={setPhoneCountry}
          />

          {/*
            11R.21 — one of the two, required. Said before they type, not after
            they submit: a booking nobody can be told about is not a booking.
          */}
          <p className="text-xs leading-relaxed text-slate-500">
            {t("pbook.oneOfThese")}
          </p>
          <label htmlFor={`${ids}-note`} className="block text-xs font-medium text-slate-700">
            {t("pbook.note")}
          </label>
          <textarea
            id={`${ids}-note`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          {picked.place === "either" ? (
            <div className="flex gap-2 text-sm">
              {(["online", "in_person"] as const).map((option) => (
                <label key={option} className="flex items-center gap-1.5">
                  <input type="radio" checked={meet === option} onChange={() => setMeet(option)} />
                  {option === "online" ? t("pbook.online") : t("pbook.inPerson")}
                </label>
              ))}
            </div>
          ) : null}
          {(picked.place === "in_person" || (picked.place === "either" && meet === "in_person")) && practice ? (
            <p className="text-xs text-slate-600">
              {t("pbook.where", { place: [practice.name, practice.address].filter(Boolean).join(", ") })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !name.trim() || (!email.trim() && !phone.trim())}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await book({
                    slotId: picked.id,
                    place: picked.place === "in_person" ? "in_person" : picked.place === "either" ? meet : "online",
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
              {pending ? t("pbook.booking") : t("common.confirm")}
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
                      setPicked({ id: slot.id, startsAt: slot.startsAt.toISOString(), place: slot.place })
                    }
                    className="tap-target flex h-9 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:border-slate-900 hover:bg-slate-50"
                  >
                    <Clock className="h-3 w-3 text-slate-500" aria-hidden />
                    {formatTime(slot.startsAt, zone.name)}
                    {slot.place && slot.place !== "online" ? (
                      <span className="text-[10px] text-brand-700">
                        {slot.place === "in_person" ? t("pbook.inPerson") : t("pbook.either")}
                      </span>
                    ) : null}
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
