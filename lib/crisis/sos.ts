import {
  CRISIS_LINES,
  EMERGENCY_LINES,
  countryForNumber,
  crisisLine,
  lineForNumber,
  lineOpenAt,
  type CrisisLine,
} from "@/lib/crisis/line";
import { DIALLING_CODES } from "@/lib/phone/e164";

/**
 * 🔴 W1-09 — every number the SOS sheet shows, and in what order.
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
    return main[0]?.open === false ? [...always, ...main] : [...main, ...always];
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
