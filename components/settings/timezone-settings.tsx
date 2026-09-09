"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Globe } from "lucide-react";

import { saveTimezone } from "@/app/(app)/settings/actions";
import { Card } from "@/components/ui";
import { formatTime, zoneLabel } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";

/**
 * The clinician's own time zone. PLAN.md 11R.2.
 *
 * ## Two things depend on this and neither can ask a browser
 *
 * The hours published on `/on-call` are read as wall-clock hours *here*, and
 * the reminder cron checks this before deciding whether 05:00 is a reasonable
 * moment to message somebody. Both run without a screen in front of them.
 *
 * ## The list comes from the runtime
 *
 * `Intl.supportedValuesOf("timeZone")` is the IANA database the same `Intl`
 * calls will use to do the arithmetic, so a name that appears here is a name
 * `zonedHourToUtc` can convert. A hand-kept list of "the zones our therapists
 * are in" would drift from it the first time somebody moves.
 */
export function TimezoneSettings({ initial }: { initial: string | null }) {
  /*
   * 12.3 / C84 — the genuine exception, still not read during render.
   *
   * Offering the browser's zone is the entire point of this screen, so unlike
   * everywhere else there is no server value to prefer. But a `useMemo` runs on
   * the SSR pass too: it returned the server's zone in the HTML and the
   * clinician's a frame later, which on *this* screen means the suggestion
   * flickers from UTC to their city. The hook returns null until mounted, so
   * both passes agree and the suggestion simply appears.
   */
  const detected = useReaderZone();

  const [zone, setZone] = useState(initial ?? detected ?? "UTC");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const zones = useMemo(() => {
    const supported =
      typeof Intl !== "undefined" && "supportedValuesOf" in Intl
        ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
            "timeZone",
          )
        : [];

    // The current value is always present, even if this runtime has never
    // heard of it — otherwise the select silently changes what is stored.
    return [...new Set([zone, "UTC", ...supported])].sort();
  }, [zone]);

  const now = new Date();

  return (
    <Card className="p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Globe className="h-4 w-4 text-slate-400" aria-hidden />
        Your time zone
      </p>
      <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
        The hours you publish are read in this zone, and we will not send you or your patients a
        reminder in the middle of the night here.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="block text-xs font-medium text-slate-600">Time zone</span>
          <select
            value={zone}
            onChange={(e) => {
              setZone(e.target.value);
              setSaved(false);
            }}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
          >
            {zones.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await saveTimezone(zone);
              if (result.error) setError(result.error);
              else setSaved(true);
            })
          }
          className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      {/*
        The check that this is the right answer: the time it is *now* in the
        zone they picked. Somebody who has selected the wrong Cairo sees it
        here, before a patient does.
      */}
      <p className="mt-2 text-xs text-slate-500">
        It is {formatTime(now, zone)} in {zoneLabel(zone)} right now.
        {initial === null && detected ? ` We have not saved one yet. Your browser says ${detected}.` : ""}
      </p>

      {saved ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-teal-700">
          <Check className="h-3 w-3" aria-hidden />
          Saved.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
