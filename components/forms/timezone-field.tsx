"use client";

import { useState } from "react";

import { Field } from "@/components/ui";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { zoneLabel } from "@/lib/scheduling/tz";

/**
 * Where the person is, detected and then shown. PLAN.md 13.11–13.12 / C85.
 *
 * ## Shown, not assumed
 *
 * The browser knows the answer and we could store it silently. §3b's whole
 * shape is telling somebody what we are about to do with their number before we
 * do it, and where we think they are gets the same courtesy — this is the field
 * that decides what time their appointment reminder says.
 *
 * ## Why it is a hook and not a read
 *
 * C84: `Intl.DateTimeFormat().resolvedOptions().timeZone` during render is the
 * *server's* zone on the SSR pass. `useReaderZone()` returns null until mounted,
 * so both passes agree and the detected value appears rather than flickering
 * from UTC.
 *
 * The select is deliberately a plain list of IANA names. A friendlier "Cairo
 * (GMT+2)" would have to be built from an offset that changes twice a year.
 */
export function TimezoneField({ name = "timezone" }: { name?: string }) {
  const detected = useReaderZone();
  const [chosen, setChosen] = useState<string | null>(null);

  const value = chosen ?? detected ?? "";

  const zones =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
          "timeZone",
        )
      : [];

  const options = [...new Set([...(value ? [value] : []), "UTC", ...zones])].sort();

  return (
    <Field label="Time zone" htmlFor={name}>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => setChosen(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
      >
        {/*
          Empty until the effect runs, so the server pass and the first client
          pass render the same option list. It fills in a frame later.
        */}
        {value === "" ? <option value="">Detecting…</option> : null}
        {options.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {value
          ? `We will show your appointments and reminders in ${zoneLabel(value)} time. Change it if that is wrong.`
          : "So your appointment times are shown in your own clock."}
      </p>
    </Field>
  );
}
