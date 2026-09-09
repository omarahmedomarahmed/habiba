"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarDays, Trash2, X } from "lucide-react";

import { cancel, publish, withdraw } from "@/app/(app)/on-call/schedule-actions";
import { Badge, Card } from "@/components/ui";
import { byDayIn, dayKey, formatTime, formatWeekday, zoneLabel } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";

/**
 * Publishing bookable hours. PLAN.md 11.1.
 *
 * ## The minute never exists
 *
 * The form submits a date and two integers. There is no minute field, no time
 * picker and no free-text time — so 19:15 is not something a clinician can
 * type, let alone submit. The database's CHECK constraint is the backstop;
 * this shape is what makes reaching it impossible.
 *
 * ## Booked hours cannot be removed, only cancelled
 *
 * A booked hour is an appointment somebody is planning their week around.
 * Removing it silently would be the product deciding, on the clinician's
 * behalf, that the patient does not need telling. So the bin is absent on a
 * booked hour and a "cancel" button takes its place, which is a different act
 * with a message attached.
 *
 * ## 11R.2 — the hours are theirs
 *
 * Every time on this screen is rendered in the clinician's own zone, and the
 * From/Until they pick are read in it. The line this replaced said "Hours are
 * set in UTC. Patients see them in their own time zone." — which is a correct
 * sentence describing a defect: a Cairo therapist publishing an 18:00 evening
 * got a 20:00 one, and the screen showed 18:00 back at them so there was
 * nothing to notice.
 */
export function AvailabilityEditor({
  slots,
  timezone,
}: {
  slots: {
    id: string;
    startsAt: string;
    status: "open" | "held" | "booked" | "blocked";
    note: string | null;
  }[];
  /** `users.timezone`, or null when they have never set one. */
  timezone: string | null;
}) {
  const [fromHour, setFromHour] = useState(18);
  const [toHour, setToHour] = useState(21);
  const [days, setDays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adopted, setAdopted] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * The stored zone if there is one; otherwise the browser's, which is what
   * the server will adopt and save on the first publish. Both paths show the
   * same name on screen, so the label never promises a zone the server is not
   * about to use.
   */
  /*
   * 🔴 12.3 / C84 — the browser's zone, after mount only.
   *
   * This was read inline during render, so a clinician with no stored zone saw
   * their published hours labelled UTC in the server HTML and their own city a
   * frame later — on the screen where they decide what "18:00" means.
   *
   * `browserZone` is also what the server adopts on the first publish. That
   * read happens inside the submit handler, which only ever runs in the
   * browser, so it is a real answer by the time it matters.
   */
  const browserZone = useReaderZone();
  const zone = timezone ?? adopted ?? browserZone ?? "UTC";

  const grouped = byDayIn(
    slots.map((s) => ({ ...s, startsAt: new Date(s.startsAt) })),
    zone,
  );
  const nextTwoWeeks = upcomingDays(14, zone);

  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden />
          Hours people can book
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          Whole hours only. Somebody who is not in crisis books one of these instead of pulling you
          out of your evening.
        </p>
      </div>

      {/* ------------------------------------------------------- publishing */}
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {nextTwoWeeks.map((day) => {
            const on = days.includes(day.iso);
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() =>
                  setDays((d) => (on ? d.filter((x) => x !== day.iso) : [...d, day.iso]))
                }
                className={`tap-target h-9 rounded-lg px-2.5 text-xs font-medium ${
                  on ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">From</span>
            <select
              value={fromHour}
              onChange={(e) => setFromHour(Number(e.target.value))}
              className="mt-1 h-10 rounded-xl border border-slate-200 px-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Until</span>
            <select
              value={toHour}
              onChange={(e) => setToHour(Number(e.target.value))}
              className="mt-1 h-10 rounded-xl border border-slate-200 px-2 text-sm"
            >
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={pending || days.length === 0}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await publish({
                  days,
                  fromHour,
                  toHour,
                  browserZone: browserZone ?? undefined,
                });
                if (result.error) setError(result.error);
                else {
                  setDays([]);
                  if (result.zone) setAdopted(result.zone);
                  // 🔴 An hour that does not exist is said out loud. The
                  // clocks going forward is not a reason to quietly publish
                  // fewer hours than the clinician asked for.
                  if (result.impossible) {
                    setError(
                      `${result.impossible} of those hours do not exist, the clocks go forward that morning. Everything else is published.`,
                    );
                  }
                }
              })
            }
            className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Publishing…" : "Publish"}
          </button>
        </div>

        {/*
          Which zone these hours mean, named as a city rather than an offset.
          When nothing is stored yet it says so and points at Settings — the
          server is about to adopt this same value, so the sentence is true
          before and after the first publish.
        */}
        <p className="text-xs text-slate-500">
          These are <strong className="font-semibold">{zoneLabel(zone)}</strong> hours
          {timezone ? "" : ", from this browser"}. Patients see them in their own time zone.{" "}
          <Link href="/settings" className="font-medium text-brand-600">
            {timezone ? "Change" : "Set your time zone"}
          </Link>
        </p>

        {error ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      {/* ---------------------------------------------------- the calendar */}
      {grouped.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">Nothing published yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {grouped.map((day) => (
            <div key={day.key} className="px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {day.label}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {day.slots.map((slot) => (
                  <li key={slot.id} className="flex items-center gap-1">
                    <span
                      className={`flex h-9 items-center rounded-lg px-2.5 text-sm font-medium ${
                        slot.status === "booked"
                          ? "bg-teal-50 text-teal-800"
                          : "border border-slate-200 text-slate-700"
                      }`}
                    >
                      {formatTime(slot.startsAt, zone)}
                      {slot.status === "booked" ? (
                        <Badge tone="teal" className="ms-1.5">
                          Booked
                        </Badge>
                      ) : null}
                    </span>

                    {slot.status === "booked" ? (
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Cancel this appointment"
                        onClick={() =>
                          startTransition(async () => {
                            setError(null);
                            const result = await cancel(slot.id);
                            if (result.error) setError(result.error);
                          })
                        }
                        className="tap-target rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Remove this hour"
                        onClick={() =>
                          startTransition(async () => {
                            setError(null);
                            const result = await withdraw(slot.id);
                            if (result.error) setError(result.error);
                          })
                        }
                        className="tap-target rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * The next `count` calendar days **in the clinician's zone**.
 *
 * Stepping by 24 hours and asking `Intl` which day that lands on, rather than
 * incrementing a UTC date: at 23:30 in Cairo the UTC date is still yesterday,
 * so the old version offered a first chip labelled with a day that had already
 * ended where the clinician was sitting.
 */
function upcomingDays(count: number, zone: string): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const seen = new Set<string>();
  const start = Date.now();

  // Two extra steps and a dedupe, because a 24-hour step across a
  // clocks-go-back boundary can land on the day it started on.
  for (let i = 0; i < count + 2 && out.length < count; i += 1) {
    const at = new Date(start + i * 24 * 3_600_000);
    const iso = dayKey(at, zone);
    if (seen.has(iso)) continue;
    seen.add(iso);

    out.push({
      iso,
      label: formatWeekday(at, zone),
    });
  }
  return out;
}
