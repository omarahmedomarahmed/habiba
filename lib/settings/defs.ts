/**
 * Every figure that used to be a constant.
 *
 * This module is deliberately pure — no database import, no `server-only` — so
 * that the same definitions can be read by the server, shipped to the browser
 * as a snapshot, and asserted in a test that has no `DATABASE_URL`. The
 * database is the authority; what lives here is the *shape* of a setting and
 * the value we fall back to when the row is missing or corrupt.
 *
 * ## Why a fallback exists at all
 *
 * Sprint 1 says no pricing constant may remain in code, and this file looks
 * like a violation of that. It is not, and the distinction matters: nothing
 * here is *read* while a row exists. These values exist so that a settings
 * table that has not been seeded yet, or a jsonb value someone has hand-edited
 * into nonsense, degrades to a known price rather than to `undefined` — which
 * in a billing path is a charge of `NaN` cents, and in a cap is no cap at all.
 *
 * Each group is stored as one jsonb row rather than a column per figure, so
 * adding a setting in a later sprint is a seed, not a migration. Parsing is
 * field-by-field: one bad field falls back on its own and the rest of the group
 * survives, because a typo in the copilot allowance must not silently reset the
 * platform fee.
 */

/** A rate a therapist can buy at, and the quantity that unlocks it. */
export type PricingTier = {
  key: string;
  name: string;
  /** What one session costs the therapist at this tier. */
  rateCents: number;
  /** Sessions they must buy at once to get the rate. 0 is pay-as-you-go. */
  minimumSessions: number;
};

export type PlatformSettings = {
  pricing: {
    tiers: PricingTier[];
    /** How long bought credits last. */
    creditExpiryMonths: number;
  };
  session: {
    /** Our cut of a patient payment, in basis points. */
    platformFeeBps: number;
    /** Below this, the card processing fee eats the whole charge. */
    minPriceCents: number;
    maxPriceCents: number;
  };
  clock: {
    /** Nothing on screen for this long. */
    runningMinutes: number;
    /** Counted down on both screens, then a hard stop. */
    countdownMinutes: number;
    /** A gap this long past the running time means everyone has left. */
    silenceSeconds: number;
  };
  copilot: {
    /** Per patient, per session, rolling over on that patient. */
    messagesPerPatientPerSession: number;
    /** An unclaimed patient, unlocked by documenting them. */
    unclaimedPatientCredits: number;
    /** The general chat, per calendar month, across every thread. */
    generalMessagesPerMonth: number;
  };
};

/**
 * The seed, and the fallback.
 *
 * These are the numbers in §3 of PLAN.md. Changing one here changes what a
 * fresh database is seeded with; it does not change a database that has
 * already been seeded, which is the whole point of the table.
 */
export const SETTINGS_DEFAULTS: PlatformSettings = {
  pricing: {
    tiers: [
      { key: "payg", name: "Pay as you go", rateCents: 400, minimumSessions: 0 },
      { key: "starter", name: "Starter", rateCents: 300, minimumSessions: 10 },
      { key: "growth", name: "Growth", rateCents: 200, minimumSessions: 30 },
    ],
    creditExpiryMonths: 12,
  },
  session: {
    platformFeeBps: 1500,
    minPriceCents: 500,
    maxPriceCents: 50_000,
  },
  clock: {
    runningMinutes: 50,
    countdownMinutes: 10,
    silenceSeconds: 90,
  },
  copilot: {
    messagesPerPatientPerSession: 10,
    unclaimedPatientCredits: 5,
    generalMessagesPerMonth: 50,
  },
};

export type SettingsGroup = keyof PlatformSettings;

export const SETTINGS_GROUPS = Object.keys(SETTINGS_DEFAULTS) as SettingsGroup[];

/* --------------------------------------------------------------- parsing -- */

/**
 * A whole number of the given unit, or the fallback.
 *
 * `Number.isSafeInteger` rather than `isFinite`: a float here is a fraction of
 * a cent that rounds differently in two places, and `1e21` is a cap that
 * overflows into a price nobody can pay.
 */
function int(value: unknown, fallback: number, opts: { min?: number; max?: number } = {}): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return fallback;
  if (opts.min !== undefined && value < opts.min) return fallback;
  if (opts.max !== undefined && value > opts.max) return fallback;
  return value;
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseTiers(value: unknown): PricingTier[] {
  if (!Array.isArray(value) || value.length === 0) return SETTINGS_DEFAULTS.pricing.tiers;

  const tiers: PricingTier[] = [];
  for (const raw of value) {
    const t = record(raw);
    const key = str(t.key, "");
    if (key === "") continue;
    tiers.push({
      key,
      name: str(t.name, key),
      // A rate of zero is a real answer — a promotional tier — so the floor is
      // 0 rather than 1. There is no sensible ceiling below the price cap.
      rateCents: int(t.rateCents, 0, { min: 0, max: 1_000_000 }),
      minimumSessions: int(t.minimumSessions, 0, { min: 0, max: 100_000 }),
    });
  }

  // An array that parsed to nothing usable is worse than no array: it would
  // leave a therapist with no rate to be billed at.
  if (tiers.length === 0) return SETTINGS_DEFAULTS.pricing.tiers;

  // Cheapest last is how they are shown and how `tierForQuantity` walks them.
  return tiers.sort((a, b) => a.minimumSessions - b.minimumSessions);
}

/** Merge one stored group over its defaults, field by field. */
export function parseGroup<G extends SettingsGroup>(
  group: G,
  value: unknown,
): PlatformSettings[G] {
  const d = SETTINGS_DEFAULTS;
  const v = record(value);

  switch (group) {
    case "pricing":
      return {
        tiers: parseTiers(v.tiers),
        creditExpiryMonths: int(v.creditExpiryMonths, d.pricing.creditExpiryMonths, {
          min: 1,
          max: 120,
        }),
      } as PlatformSettings[G];

    case "session":
      return {
        // 10_000 bps is the entire payment. A fee of 100% is not a
        // configuration, it is a therapist who gets nothing.
        platformFeeBps: int(v.platformFeeBps, d.session.platformFeeBps, { min: 0, max: 9_000 }),
        minPriceCents: int(v.minPriceCents, d.session.minPriceCents, { min: 0, max: 1_000_000 }),
        maxPriceCents: int(v.maxPriceCents, d.session.maxPriceCents, { min: 1, max: 10_000_000 }),
      } as PlatformSettings[G];

    case "clock":
      return {
        runningMinutes: int(v.runningMinutes, d.clock.runningMinutes, { min: 1, max: 600 }),
        countdownMinutes: int(v.countdownMinutes, d.clock.countdownMinutes, { min: 0, max: 600 }),
        silenceSeconds: int(v.silenceSeconds, d.clock.silenceSeconds, { min: 10, max: 3_600 }),
      } as PlatformSettings[G];

    case "copilot":
      return {
        messagesPerPatientPerSession: int(
          v.messagesPerPatientPerSession,
          d.copilot.messagesPerPatientPerSession,
          { min: 0, max: 10_000 },
        ),
        unclaimedPatientCredits: int(
          v.unclaimedPatientCredits,
          d.copilot.unclaimedPatientCredits,
          { min: 0, max: 10_000 },
        ),
        generalMessagesPerMonth: int(
          v.generalMessagesPerMonth,
          d.copilot.generalMessagesPerMonth,
          { min: 0, max: 100_000 },
        ),
      } as PlatformSettings[G];

    default:
      return d[group];
  }
}

/**
 * A price cap below the floor makes every price invalid and no error explains
 * why. Caught here rather than in the form, because the two figures are edited
 * on different rows and neither edit is wrong on its own.
 */
export function settingsProblem(settings: PlatformSettings): string | null {
  if (settings.session.maxPriceCents < settings.session.minPriceCents) {
    return "The price cap is below the minimum chargeable price.";
  }
  if (!settings.pricing.tiers.some((t) => t.minimumSessions === 0)) {
    return "No tier has a minimum of zero, so a therapist who has bought nothing has no rate.";
  }
  return null;
}

/* ------------------------------------------------------------- countries -- */

export type CountrySettings = {
  code: string;
  name: string;
  /** VAT the patient pays on top, in basis points. Egypt is 1400. */
  vatBps: number;
  /** ISO 4217, lowercase, as Stripe wants it. */
  currency: string;
  /** Payment method keys offered in this country. */
  paymentMethods: string[];
  enabled: boolean;
};

/**
 * Seeded countries.
 *
 * Only the two we can state a rate for. A VAT rate is a legal fact about a
 * jurisdiction, and seeding a guess is worse than seeding nothing: a guessed
 * 0% is an under-collection somebody eventually owes, and a guessed 20% is
 * money taken from a patient for a tax that does not exist. Every other
 * country is added by an admin in sprint 15, and until then
 * `requireCountrySettings` refuses to price a session there.
 */
export const COUNTRY_SEED: CountrySettings[] = [
  {
    code: "EG",
    name: "Egypt",
    vatBps: 1400,
    currency: "egp",
    paymentMethods: ["card"],
    enabled: true,
  },
  {
    code: "US",
    name: "United States",
    vatBps: 0,
    currency: "usd",
    paymentMethods: ["card"],
    enabled: true,
  },
];

export function parseCountry(row: {
  code: string;
  name: string;
  vatBps: number;
  currency: string;
  paymentMethods: unknown;
  enabled: boolean;
}): CountrySettings {
  return {
    code: row.code.toUpperCase(),
    name: row.name,
    vatBps: int(row.vatBps, 0, { min: 0, max: 9_000 }),
    currency: str(row.currency, "usd").toLowerCase(),
    paymentMethods: Array.isArray(row.paymentMethods)
      ? row.paymentMethods.filter((m): m is string => typeof m === "string")
      : [],
    enabled: row.enabled,
  };
}

/* ----------------------------------------------------------------- money -- */

/**
 * VAT, and the reason it is its own function.
 *
 * §3: the patient pays VAT on top of everything, and a refund returns our cut
 * but never the VAT — because the VAT was remitted to a government that is not
 * refunding it because a session was cancelled. Rounding is half-up on the
 * patient's side of the line, which is the direction a tax authority expects.
 */
export function vatOn(amountCents: number, vatBps: number): number {
  if (amountCents <= 0 || vatBps <= 0) return 0;
  return Math.round((amountCents * vatBps) / 10_000);
}

/**
 * The platform cut. Rounded **down** so the therapist is never short a cent.
 *
 * The two roundings deliberately go opposite ways: VAT rounds up toward the
 * authority, our fee rounds down toward the clinician. Both errors are at most
 * a cent and both land on us.
 */
export function platformFeeOn(grossCents: number, feeBps: number): number {
  if (grossCents <= 0 || feeBps <= 0) return 0;
  return Math.floor((grossCents * feeBps) / 10_000);
}

/**
 * Every line of a paid session, named.
 *
 * §3 is explicit that the patient and the therapist each see these as separate
 * lines with reasons, never one number, so the breakdown is computed once here
 * and rendered in several places rather than re-derived by each of them.
 */
export type SessionMoney = {
  /** The therapist's asking price. */
  grossCents: number;
  vatCents: number;
  /** What the patient is actually charged. */
  patientTotalCents: number;
  platformCutCents: number;
  /** What reaches the therapist, before their own session bill. */
  therapistNetCents: number;
};

export function sessionMoney(input: {
  grossCents: number;
  feeBps: number;
  vatBps: number;
}): SessionMoney {
  const gross = Math.max(0, Math.round(input.grossCents));
  const vat = vatOn(gross, input.vatBps);
  const cut = platformFeeOn(gross, input.feeBps);
  return {
    grossCents: gross,
    vatCents: vat,
    patientTotalCents: gross + vat,
    platformCutCents: cut,
    therapistNetCents: gross - cut,
  };
}
