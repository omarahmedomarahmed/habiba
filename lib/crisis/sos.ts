import {
  CRISIS_LINES,
  EMERGENCY_LINES,
  SUPPORT_LINES,
  countryForNumber,
  crisisLine,
  lineForNumber,
  lineOpenAt,
  type CrisisLine,
} from "@/lib/crisis/line";
import { DIALLING_CODES } from "@/lib/phone/e164";

/**
 * 🔴 W1-09: every number the SOS sheet shows, and in what order.
 *
 * Pure, and kept apart from `line.ts` so the orb (a client component) can call
 * it with rows the server already loaded. The verified-line rules stay in
 * `line.ts`; this only decides which of them a reader sees.
 */

/** A country row as the SOS sheet needs it. The shape of `country_settings`, trimmed. */
export type SosCountry = {
  code: string;
  name: string;
  enabled: boolean;
  crisisLineLabel: string | null;
  crisisLineTel: string | null;
};

export type SosEntry = {
  country: string;
  /** The operator's name for the country, when settings were loaded. */
  countryName: string | null;
  line: CrisisLine;
  open: boolean | null;
};

/**
 * The orb used to print one line from a two-entry table, and nothing at all for
 * an English reader with no phone, even in a country an operator had configured.
 *
 *   1. The reader's own number decides where they are, then the page's country.
 *   2. A country we can place: its line and its always-open numbers, or none
 *      (the sentence that is true everywhere still shows). Never a stranger's.
 *   3. A reader we cannot place: every ENABLED country's line, each labelled,
 *      because a list they can pick their own from beats nothing.
 *
 * `countries` is `country_settings`, read by the server. Without it (an error
 * boundary on the client) the verified table is the list.
 */
export function sosLinesFor(input: {
  phone?: string | null;
  country?: string | null;
  countries?: SosCountry[] | null;
  now?: Date;
}): SosEntry[] {
  const now = input.now ?? new Date();
  const rows = input.countries?.length ? input.countries : null;
  const rowFor = (code: string) => rows?.find((row) => row.code.trim().toUpperCase() === code) ?? null;
  const lineFor = (code: string) => {
    const row = rowFor(code);
    return crisisLine(code, row ? { label: row.crisisLineLabel, tel: row.crisisLineTel } : null);
  };
  const entriesFor = (code: string): SosEntry[] => {
    const countryName = rowFor(code)?.name ?? null;
    const line = lineFor(code);
    const main = line ? [{ country: code, countryName, line, open: lineOpenAt(line, now) }] : [];
    const always = (EMERGENCY_LINES[code] ?? []).map((emergency) => ({
      country: code,
      countryName,
      line: emergency,
      open: lineOpenAt(emergency, now),
    }));
    /*
     * 🔴 F5: the mental health support lines, after the crisis line when it is
     * open and after the always-open numbers when it is likely closed. Their
     * hours are unknown, so they never lead.
     */
    const support = (SUPPORT_LINES[code] ?? []).map((line) => ({
      country: code,
      countryName,
      line,
      open: lineOpenAt(line, now),
    }));
    return main[0]?.open === false ? [...always, ...support, ...main] : [...main, ...support, ...always];
  };

  /* Their own number. The verified table first (C184), then what operators configured. */
  if (lineForNumber(input.phone)) {
    const verified = countryForNumber(input.phone);
    if (verified) return entriesFor(verified);
  }
  const digits = (input.phone ?? "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    const national = digits.slice(1);
    let best = 0;
    let candidates: string[] = [];
    for (const [code, prefix] of Object.entries(DIALLING_CODES)) {
      if (!national.startsWith(prefix)) continue;
      if (prefix.length > best) {
        best = prefix.length;
        candidates = [code];
      } else if (prefix.length === best) {
        candidates.push(code);
      }
    }
    const withLine = candidates.filter((code) => lineFor(code));
    const tels = new Set(withLine.map((code) => lineFor(code)!.tel));
    if (tels.size === 1) return entriesFor(withLine[0]!);
    /* Placed, and nobody holds a line there: the sentence, not a stranger's number. */
    if (candidates.length > 0 && tels.size === 0) {
      return candidates.length === 1 ? entriesFor(candidates[0]!) : [];
    }
  }

  const placed = input.country?.trim().toUpperCase();
  if (placed) return entriesFor(placed);

  const everywhere = rows
    ? rows.filter((row) => row.enabled).map((row) => row.code.trim().toUpperCase())
    : Object.keys(CRISIS_LINES);
  return everywhere.flatMap(entriesFor);
}

/**
 * Names as a reader would say them, beside a flag, in the reader's language.
 * 🔴 Board 872: "مصر · Egypt" put an English word on the Arabic sheet; the
 * English sheet says Egypt and the Arabic one مصر. Shared by the orb and the
 * server-rendered `/sos` page, so the two never name a country differently.
 */
const COUNTRY_LABEL: Record<string, { en: string; ar: string }> = {
  US: { en: "United States", ar: "الولايات المتحدة" },
  EG: { en: "Egypt", ar: "مصر" },
};

export function countryLabel(country: string, locale: string): string | null {
  const known = COUNTRY_LABEL[country];
  if (known) return locale === "ar" ? known.ar : known.en;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? null;
  } catch {
    return null;
  }
}

/** A flag from the ISO code, for any country an operator configures. */
export function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}
