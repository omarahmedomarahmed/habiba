"use client";

import { useState } from "react";

import { DIALLING_CODES } from "@/lib/phone/e164";

/**
 * A phone number, with the country it belongs to. PLAN.md 11R.12.
 *
 * ## Why the selector is not optional
 *
 * `01001234567` is a valid mobile in Egypt, Italy and Kenya, and a different
 * human being in each. `toE164` refuses to expand a national number without a
 * country — correctly — so a phone field with no country beside it is a field
 * whose value can never be sent to anybody. C64 was exactly that: a number
 * that reached Meta as `01001234567` and bounced.
 *
 * The selector is pre-filled from the visitor's locale, which is a *guess for
 * the default* and nothing more. It is still shown, still changeable, and the
 * server still refuses a number without one.
 */

const NAMES: Record<string, string> = {
  EG: "Egypt",
  SA: "Saudi Arabia",
  AE: "UAE",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
  JO: "Jordan",
  LB: "Lebanon",
  IQ: "Iraq",
  MA: "Morocco",
  DZ: "Algeria",
  TN: "Tunisia",
  LY: "Libya",
  SD: "Sudan",
  PS: "Palestine",
  TR: "Türkiye",
  GB: "United Kingdom",
  US: "United States",
  CA: "Canada",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  NL: "Netherlands",
  SE: "Sweden",
  AU: "Australia",
};

export function PhoneField({
  value,
  country,
  onValueChange,
  onCountryChange,
  placeholder = "Phone or WhatsApp number",
  id = "phone",
  name,
  countryName,
}: {
  value: string;
  country: string;
  onValueChange: (next: string) => void;
  onCountryChange: (next: string) => void;
  placeholder?: string;
  id?: string;
  /** Set both when the field sits inside a plain `<form action={…}>`. */
  name?: string;
  countryName?: string;
}) {
  const [touched, setTouched] = useState(false);

  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Country"
          name={countryName}
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          className="h-11 w-32 shrink-0 rounded-xl border border-slate-200 px-2 text-sm"
        >
          {Object.keys(DIALLING_CODES)
            .sort((a, b) => (NAMES[a] ?? a).localeCompare(NAMES[b] ?? b))
            .map((code) => (
              <option key={code} value={code}>
                {NAMES[code] ?? code} +{DIALLING_CODES[code]}
              </option>
            ))}
        </select>

        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onBlur={() => setTouched(true)}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
        />
      </div>

      {/*
        Said before they submit, not after. A number typed with the wrong
        country selected is not a validation error — it is a message that goes
        to a stranger.
      */}
      {touched && value.trim() ? (
        <p className="mt-1 text-xs text-slate-500">
          We will read this as a {NAMES[country] ?? country} number.
        </p>
      ) : null}
    </div>
  );
}
