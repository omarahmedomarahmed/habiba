/**
 * Local numbers to E.164. PLAN.md 11R.12–11R.14, C64.
 *
 * ## Why a country is a required argument
 *
 * `01001234567` is a valid mobile number in Egypt, Italy, Kenya and half a
 * dozen other places, and it is a different human being in each. Sprint 5's
 * `normalisePhone` refused to expand it for exactly that reason and was right
 * to. The fix is not to guess better — it is to **ask**, which is why every
 * phone field in the product now has a country selector beside it.
 *
 * So there is no `toE164(value)` overload. A caller with no country gets a
 * refusal, and the refusal is the correct behaviour: a number sent to Meta as
 * `01001234567` bounces, and a number expanded to the wrong country reaches a
 * stranger.
 *
 * ## What this is not
 *
 * Not a validator. It does not know that Egyptian mobiles start `10`, `11`,
 * `12` or `15`, and it does not try — a table of national numbering plans is a
 * thing that goes out of date silently. It does the one transformation that is
 * unambiguous once the country is known, and leaves "is this a real number" to
 * the first send.
 */

/** The countries this product operates in, plus the obvious diaspora. */
export const DIALLING_CODES: Record<string, string> = {
  EG: "20",
  SA: "966",
  AE: "971",
  KW: "965",
  QA: "974",
  BH: "973",
  OM: "968",
  JO: "962",
  LB: "961",
  IQ: "964",
  MA: "212",
  DZ: "213",
  TN: "216",
  LY: "218",
  SD: "249",
  PS: "970",
  TR: "90",
  GB: "44",
  US: "1",
  CA: "1",
  DE: "49",
  FR: "33",
  IT: "39",
  NL: "31",
  SE: "46",
  AU: "61",
};

export type E164Result =
  | { ok: true; e164: string }
  | { ok: false; reason: "empty" | "no_country" | "unknown_country" | "too_short" | "too_long" };

/**
 * Expand a number written the way a person writes it.
 *
 * Handles the four shapes that actually turn up:
 *
 *   `+20 100 123 4567`   already E.164, punctuation removed
 *   `0020 100 123 4567`  the international prefix as digits
 *   `0100 123 4567`      national, with the trunk zero
 *   `100 123 4567`       national, without it
 *
 * The trunk zero is dropped only when a country is known, because whether a
 * leading zero is a trunk prefix or part of the number is a national
 * convention — one more reason the country is not optional.
 */
export function toE164(raw: string | null | undefined, country?: string | null): E164Result {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  // Already international: take it as given and only clean the punctuation.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return lengthChecked(digits);
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "empty" };

  // `00` is the international access prefix in most of the world.
  if (digits.startsWith("00")) return lengthChecked(digits.slice(2));

  if (!country) return { ok: false, reason: "no_country" };

  const code = DIALLING_CODES[country.trim().toUpperCase()];
  if (!code) return { ok: false, reason: "unknown_country" };

  /*
   * Somebody typed their own country code without a plus. Accepting it as a
   * national number would produce `+2020100…`, which is nothing.
   */
  if (digits.startsWith(code) && digits.length > code.length + 6) {
    return lengthChecked(digits);
  }

  // The trunk zero, dropped now that we know whose convention applies.
  const national = digits.startsWith("0") ? digits.slice(1) : digits;
  return lengthChecked(`${code}${national}`);
}

/**
 * E.164 allows at most 15 digits and nothing real is under 8.
 *
 * A length check rather than a pattern: the shortest sensible refusal is the
 * one that catches a mistyped number without pretending to know a numbering
 * plan.
 */
function lengthChecked(digits: string): E164Result {
  if (digits.length < 8) return { ok: false, reason: "too_short" };
  if (digits.length > 15) return { ok: false, reason: "too_long" };
  return { ok: true, e164: `+${digits}` };
}

/** Is this already a well-formed E.164 string? Used by `whatsapp:check`. */
export function isE164(value: string | null | undefined): boolean {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

/** The message a person sees. Never "invalid" on its own, which explains nothing. */
export function e164Problem(result: E164Result): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case "empty":
      return "Enter a number, or leave it blank.";
    case "no_country":
      return "Choose the country your number is in.";
    case "unknown_country":
      return "We cannot send messages to that country yet.";
    case "too_short":
      return "That number looks too short.";
    case "too_long":
      return "That number looks too long.";
  }
}

/**
 * A default country from a locale or an accept-language header.
 *
 * A *suggestion* for the selector, never a silent expansion — the selector is
 * still shown, still changeable, and `toE164` still refuses without one. Guess
 * the default, ask for the answer.
 */
export function countryFromLocale(locale: string | null | undefined): string | null {
  if (!locale) return null;
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  if (region && DIALLING_CODES[region]) return region;
  // `ar` with no region is overwhelmingly Egypt in this product's traffic.
  if (locale.toLowerCase().startsWith("ar")) return "EG";
  return null;
}
