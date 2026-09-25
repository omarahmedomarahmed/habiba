"use client";

import { useState } from "react";

import { DIALLING_CODES } from "@/lib/phone/e164";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

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

/**
 * 🔴 Exported, because 55.11's CSV importer needs the same list.
 *
 * A file of national numbers needs one country for the file, chosen by the clinician, for
 * exactly the reason this field needs one per number. Two lists of country names would drift,
 * and the drift would show as a country that can be picked on one screen and not the other.
 */
export const COUNTRY_KEYS: Record<string, MessageKey> = {
  EG: "cc.eg",
  SA: "cc.sa",
  AE: "cc.ae",
  KW: "cc.kw",
  QA: "cc.qa",
  BH: "cc.bh",
  OM: "cc.om",
  JO: "cc.jo",
  LB: "cc.lb",
  IQ: "cc.iq",
  MA: "cc.ma",
  DZ: "cc.dz",
  TN: "cc.tn",
  LY: "cc.ly",
  SD: "cc.sd",
  PS: "cc.ps",
  TR: "cc.tr",
  GB: "cc.gb",
  US: "cc.us",
  CA: "cc.ca",
  DE: "cc.de",
  FR: "cc.fr",
  IT: "cc.it",
  NL: "cc.nl",
  SE: "cc.se",
  AU: "cc.au",
};

/**
 * 🔴 W3: a country's name in the reader's language. The names were English on
 * the Arabic sign-up form, next to Arabic labels.
 */
export function useCountryName(): (code: string) => string {
  const t = useT();
  return (code: string) => (COUNTRY_KEYS[code] ? t(COUNTRY_KEYS[code]!) : code);
}

export function PhoneField({
  value,
  country,
  onValueChange,
  onCountryChange,
  placeholder,
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
  const t = useT();
  const nameOf = useCountryName();

  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label={t("phone.country")}
          name={countryName}
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          className="h-11 w-32 shrink-0 rounded-xl border border-slate-200 px-2 text-sm"
        >
          {Object.keys(DIALLING_CODES)
            .sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
            .map((code) => (
              <option key={code} value={code}>
                {nameOf(code)} +{DIALLING_CODES[code]}
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
          placeholder={placeholder ?? t("phone.placeholder")}
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
          {t("phone.readAs", { country: nameOf(country) })}
        </p>
      ) : null}
    </div>
  );
}
