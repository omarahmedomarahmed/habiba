"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Check, Clock } from "lucide-react";

import { book } from "@/app/(public)/t/[id]/book/actions";
import { Card } from "@/components/ui";
import { byDay } from "@/lib/scheduling/hours";

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
  rateLabel,
}: {
  slots: { id: string; startsAt: string }[];
  therapistName: string;
  rateLabel: string;
}) {
  const [picked, setPicked] = useState<{ id: string; startsAt: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ startsAt: string; sent: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const days = byDay(slots.map((s) => ({ ...s, startsAt: new Date(s.startsAt) })));

  if (done) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Check className="h-4 w-4 text-teal-500" aria-hidden />
          Booked with {therapistName}
        </p>
        <p className="mt-1 text-sm text-slate-700">{longWhen(new Date(done.startsAt))}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {done.sent
            ? "We have sent you a confirmation with the link to join."
            : "🔴 We could not send you a confirmation — write this time down. Your therapist has it too."}
        </p>
      </Card>
    );
  }

  if (slots.length === 0) {
    return (
      <Card className="p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
          No times on the calendar
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
        Book a session
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        One hour with {therapistName} · {rateLabel}
      </p>

      {picked ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
            {longWhen(new Date(picked.startsAt))}
          </p>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email (so we can send the link)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder="WhatsApp number (optional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything they should know before you meet? (optional)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !name.trim()}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await book({
                    slotId: picked.id,
                    name,
                    email,
                    phone,
                    note,
                  });
                  if (result.error) setError(result.error);
                  else if (result.booked) {
                    setDone({
                      startsAt: result.booked.startsAt,
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
              Pick another time
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {days.slice(0, 10).map((day) => (
            <div key={day.day}>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {longDay(new Date(`${day.day}T12:00:00Z`))}
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
                    {shortTime(slot.startsAt)}
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

/* Formatted in the reader's own zone — see the note at the top. */
const shortTime = (at: Date) =>
  at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const longDay = (at: Date) =>
  at.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

const longWhen = (at: Date) =>
  `${at.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} at ${shortTime(at)}`;
