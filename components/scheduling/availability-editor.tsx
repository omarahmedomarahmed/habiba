"use client";

import { useState, useTransition } from "react";
import { CalendarDays, Trash2, X } from "lucide-react";

import { cancel, publish, withdraw } from "@/app/(app)/on-call/schedule-actions";
import { Badge, Card } from "@/components/ui";
import { byDay } from "@/lib/scheduling/hours";

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
 */
export function AvailabilityEditor({
  slots,
}: {
  slots: {
    id: string;
    startsAt: string;
    status: "open" | "held" | "booked" | "blocked";
    note: string | null;
  }[];
}) {
  const [fromHour, setFromHour] = useState(18);
  const [toHour, setToHour] = useState(21);
  const [days, setDays] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = byDay(slots.map((s) => ({ ...s, startsAt: new Date(s.startsAt) })));
  const nextTwoWeeks = upcomingDays(14);

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
                const result = await publish({ days, fromHour, toHour });
                if (result.error) setError(result.error);
                else setDays([]);
              })
            }
            className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Publishing…" : "Publish"}
          </button>
        </div>

        {/* Times are UTC on the server; said out loud rather than left to be
            discovered by a clinician whose evening slot appears at lunchtime. */}
        <p className="text-xs text-slate-400">
          Hours are set in UTC. Patients see them in their own time zone.
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
            <div key={day.day} className="px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {new Date(`${day.day}T12:00:00Z`).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
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
                      {slot.startsAt.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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

function upcomingDays(count: number): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + i));
    out.push({
      iso: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
    });
  }
  return out;
}
