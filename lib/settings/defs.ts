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

/**
 * 🔴 46.3 / C223 — a tier is a price threshold and an AI rate, never a count.
 *
 * It used to be `{ rateCents, minimumSessions }`, which encodes "ten sessions
 * at three dollars". That is a session bundle, and the offer is not a bundle:
 * **$30 buys $30 of credit and unlocks the $2 AI rate.** Those are different
 * objects and the second cannot be written in the first, because the money
 * buys credit spendable on any line and the rate is what the threshold bought.
 *
 * The consequence somebody will trip over: **the rate does not expire when the
 * credit does.** A therapist who spent their $60 still has the $1 AI rate. The
 * threshold was a purchase, not a subscription.
 *
 * The word "sessions" leaves the offer entirely, which is also why the public
 * pricing page is rewritten in the same sprint rather than later: $30 does not
 * buy ten of anything and a page that says it does is the false sentence
 * `lib/content/honesty.ts` exists to reject.
 */
export type PricingTier = {
  key: string;
  name: string;
  /** What a therapist must spend, once, to hold this rate. 0 is pay as you go. */
  unlockCents: number;
  /** What one AI-assisted session costs them at this tier. */
  aiRateCents: number;
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
    /**
     * 🔴 46.1 / 46.2 / C209 — charged on EVERY session, without exception.
     *
     * Free ones, in-person ones, and the ones where the patient declined
     * recording. This is the number that makes the AI fee safe to make
     * conditional: if the whole bill vanished on a refusal, a therapist would
     * have a financial reason to lean on the most vulnerable person in the
     * room.
     */
    platformFeeCents: number;
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
  /**
   * The two rails. PLAN.md 16.1 — *"adding an Egyptian collection provider is
   * configuration, not code"*, which is only true if the configuration is
   * here rather than in a constant somebody has to deploy.
   */
  payouts: {
    /** Who collects EGP from patients. A key, resolved to an adapter. */
    egyptCollectionProvider: string;
    /** What a therapist may be paid by, in Egypt. */
    egyptPayoutMethods: string[];
    /**
     * 🔴 16.3d / C74 — above this, a payout needs a second person. Set it to
     * 0 and *every* payout needs two, which is the safe direction to be
     * wrong in; there is deliberately no way to switch the rule off.
     */
    twoPersonThresholdCents: number;
    /** 16.3b — a manual request older than this is overdue and alerts. */
    alertAfterHours: number;
    /**
     * 🔴 C69 / 17.1 — netting, behind a setting because it is a business
     * decision and not a technical one.
     *
     * On (the default): when we are already holding a clinician's money, the
     * session fee is taken out of it rather than billed separately, and 17's
     * "the session pays for itself out of your earnings" describes something
     * that actually happens. Off: the fee is invoiced as it always was and
     * that sentence must not be published.
     */
    netFeeFromHeldEarnings: boolean;
    /**
     * 🔴 C76 — the spread added to the mid-market rate when a therapist
     * chooses to settle in EGP, in basis points.
     *
     * Zero by default: we take no margin on the convenience. The number
     * exists so that a real settlement cost can be recovered *visibly* — it
     * is shown on the screen with the button (16.6b), never discovered on a
     * statement afterwards.
     */
    egpSpreadBps: number;
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
    /*
     * 46.2 / 46.3 — the figures, and the arithmetic that keeps them honest.
     *
     * The all-in cost of an AI session is unchanged at every tier: $1 platform
     * plus $3, $2 or $1 of AI is the $4, $3 and $2 that shipped. What changed
     * is that a session with no AI now costs $1 instead of $4, and a session
     * with AI is two visible lines instead of one opaque one.
     */
    tiers: [
      { key: "payg", name: "Pay as you go", unlockCents: 0, aiRateCents: 300 },
      { key: "starter", name: "Starter", unlockCents: 3000, aiRateCents: 200 },
      { key: "growth", name: "Growth", unlockCents: 6000, aiRateCents: 100 },
    ],
    creditExpiryMonths: 12,
  },
  session: {
    platformFeeBps: 1500,
    platformFeeCents: 100,
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
  payouts: {
    egyptCollectionProvider: "paymob",
    egyptPayoutMethods: ["instapay", "wallet"],
    twoPersonThresholdCents: 50_000,
    alertAfterHours: 12,
    netFeeFromHeldEarnings: true,
    egpSpreadBps: 0,
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

function strings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return out.length > 0 ? out.map((v) => v.trim()) : fallback;
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
      /*
       * 🔴 46.3 — read the new shape, and CONVERT the old one rather than
       * reinterpreting its numbers.
       *
       * A database seeded before this sprint holds `{ rateCents,
       * minimumSessions }`, and settings are parsed on every read, so without
       * this the first read after deploy gives every therapist a free tier
       * until somebody re-saves the group.
       *
       * The first version of this fallback read `minimumSessions` as if it
       * were `unlockCents`, which turned "10 sessions" into ten cents. The
       * sprint 46 verifier printed `starter: $0.1` and that is how it was
       * caught. A field's number does not carry its unit; two fields that mean
       * different things need arithmetic between them, not an `??`.
       *
       * The honest conversion is the money the old bundle actually cost:
       *
       *   unlockCents = minimumSessions × rateCents   10 × $3 = $30
       *   aiRateCents = rateCents − platformFeeCents  $3 − $1 = $2
       *
       * Which reproduces the founder's $30 and $60 thresholds exactly, and
       * keeps the all-in price of an AI session unchanged at every tier. That
       * is not a coincidence: the old rate WAS the all-in price, and the split
       * only says which part of it is conditional.
       */
      unlockCents: int(
        t.unlockCents ?? Number(t.minimumSessions ?? 0) * Number(t.rateCents ?? 0),
        0,
        { min: 0, max: 10_000_000 },
      ),
      // A rate of zero is a real answer — a promotional tier — so the floor is
      // 0 rather than 1. There is no sensible ceiling below the price cap.
      aiRateCents: int(
        t.aiRateCents ?? Number(t.rateCents ?? 0) - SETTINGS_DEFAULTS.session.platformFeeCents,
        0,
        { min: 0, max: 1_000_000 },
      ),
    });
  }

  // An array that parsed to nothing usable is worse than no array: it would
  // leave a therapist with no rate to be billed at.
  if (tiers.length === 0) return SETTINGS_DEFAULTS.pricing.tiers;

  // Cheapest last is how they are shown and how `tierForSpend` walks them.
  return tiers.sort((a, b) => a.unlockCents - b.unlockCents);
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
        /*
         * 🔴 46.2 — the floor is 1 cent, not 0, and the default answers for
         * every row seeded before this sprint.
         *
         * A stored `session` blob written before 46 has no such key, so
         * without this it parsed to `undefined` and every fee arithmetic
         * downstream produced NaN. The sprint 46 verifier caught exactly that
         * on its first run, which is what the pure check at the top of it is
         * there for: a NaN platform fee would have made every invoice in the
         * product NaN cents, and it would have shipped looking like nothing.
         */
        platformFeeCents: int(v.platformFeeCents, d.session.platformFeeCents, {
          min: 1,
          max: 100_000,
        }),
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

    case "payouts":
      return {
        egyptCollectionProvider: str(
          v.egyptCollectionProvider,
          d.payouts.egyptCollectionProvider,
        ),
        egyptPayoutMethods: strings(v.egyptPayoutMethods, d.payouts.egyptPayoutMethods),
        // No ceiling below the price cap, and a floor of zero, because zero
        // means "two people on everything" and that must stay reachable.
        twoPersonThresholdCents: int(
          v.twoPersonThresholdCents,
          d.payouts.twoPersonThresholdCents,
          { min: 0, max: 100_000_000 },
        ),
        alertAfterHours: int(v.alertAfterHours, d.payouts.alertAfterHours, {
          min: 1,
          max: 720,
        }),
        netFeeFromHeldEarnings:
          typeof v.netFeeFromHeldEarnings === "boolean"
            ? v.netFeeFromHeldEarnings
            : d.payouts.netFeeFromHeldEarnings,
        // 1000bps is 10% on top of the market rate. Anything beyond that is a
        // margin being hidden in a rate, which is the thing C76 forbids.
        egpSpreadBps: int(v.egpSpreadBps, d.payouts.egpSpreadBps, { min: 0, max: 1_000 }),
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
  if (!settings.pricing.tiers.some((t) => t.unlockCents === 0)) {
    return "No tier has a threshold of zero, so a therapist who has bought nothing has no AI rate.";
  }
  /*
   * 🔴 46.2 — a platform fee of zero is a configuration, not a typo, and it is
   * the one C209 forbids. Zero means a therapist who never seeks consent gets
   * unlimited hosted video for nothing, which is half the defect this sprint
   * exists to fix. An admin who wants a promotion lowers the AI rate.
   */
  if (settings.session.platformFeeCents <= 0) {
    return "The platform fee is what makes the AI fee safe to make conditional. It cannot be zero.";
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

  /**
   * 20.3 — the two rails, per country.
   *
   * `collectionProvider` is how a patient here pays us; `payoutMethods` is how
   * a clinician here is paid. **Both empty is the interesting case**: a
   * country we can name and cannot transact in, which the admin screen lists
   * by itself, because a clinician who signed up somewhere with no rail is a
   * person we cannot pay rather than a row in a spreadsheet.
   */
  collectionProvider: string | null;
  payoutMethods: string[];
  /** Which entity collects here (§3c). */
  entity: "us" | "eg";

  /** 20.4 / 20.5 — what we ask for here, and who licenses it. */
  regulators: string[];
  idLabelFront: string | null;
  idLabelBack: string | null;
  licenceLabel: string | null;
  sampleImageUrl: string | null;

  enabled: boolean;
};

/** 20.3 — a country nobody can pay into or out of. */
export function hasNoRail(country: CountrySettings): boolean {
  return !country.collectionProvider && country.payoutMethods.length === 0;
}

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
    /*
     * 20.3 — Egypt is the local rail: an Egyptian collector takes the money
     * in, the Egyptian entity holds it, and a clinician here is paid by
     * InstaPay or a wallet. §3c, made data.
     */
    collectionProvider: "paymob",
    payoutMethods: ["instapay", "wallet"],
    entity: "eg",
    /* 20.4 / 20.5 — seeded from `lib/regulators.ts`, editable from admin. */
    regulators: ["Egyptian Ministry of Health and Population"],
    idLabelFront: "National ID (البطاقة), front",
    idLabelBack: "National ID (البطاقة), back",
    licenceLabel: "Practising licence or syndicate card",
    sampleImageUrl: null,
    enabled: true,
  },
  {
    code: "US",
    name: "United States",
    vatBps: 0,
    currency: "usd",
    paymentMethods: ["card"],
    collectionProvider: "stripe",
    payoutMethods: ["stripe"],
    entity: "us",
    regulators: [],
    idLabelFront: "Driver's licence or passport, front",
    idLabelBack: "Driver's licence or passport, back",
    licenceLabel: "State licence",
    sampleImageUrl: null,
    enabled: true,
  },
];

export function parseCountry(row: {
  code: string;
  name: string;
  vatBps: number;
  currency: string;
  paymentMethods: unknown;
  collectionProvider?: string | null;
  payoutMethods?: unknown;
  entity?: string | null;
  regulators?: unknown;
  idLabelFront?: string | null;
  idLabelBack?: string | null;
  licenceLabel?: string | null;
  sampleImageUrl?: string | null;
  enabled: boolean;
}): CountrySettings {
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

  return {
    code: row.code.toUpperCase(),
    name: row.name,
    vatBps: int(row.vatBps, 0, { min: 0, max: 9_000 }),
    currency: str(row.currency, "usd").toLowerCase(),
    paymentMethods: list(row.paymentMethods),
    collectionProvider: row.collectionProvider?.trim() || null,
    payoutMethods: list(row.payoutMethods),
    entity: row.entity === "eg" ? "eg" : "us",
    regulators: list(row.regulators),
    /*
     * Empty means "not configured", which the accessor turns into the shipped
     * fallback in `lib/regulators.ts` — an empty string here would instead
     * mean "we ask for a document with no name", and a clinician staring at a
     * blank label is exactly the support ticket 20.4 is trying to remove.
     */
    idLabelFront: row.idLabelFront?.trim() || null,
    idLabelBack: row.idLabelBack?.trim() || null,
    licenceLabel: row.licenceLabel?.trim() || null,
    sampleImageUrl: row.sampleImageUrl?.trim() || null,
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

/**
 * Convert an amount at a quoted rate.
 *
 * Pure, and separate from `lib/billing/fx.ts` so the arithmetic can be tested
 * without a database. Rounds half-up to a whole minor unit: the patient's
 * currency has no fractional piastres either.
 */
export function convertAtRate(amountCents: number, rateMicro: number): number {
  if (amountCents <= 0 || rateMicro <= 0) return 0;
  return Math.round((amountCents * rateMicro) / 1_000_000);
}

/**
 * What the patient sees, in their own currency, from what the therapist charges.
 *
 * The order of operations is the part worth pinning down, and it follows §3:
 * VAT is computed on the settlement amount and *then* the total is converted —
 * not converted and then taxed. Both give nearly the same number and only one
 * of them is defensible to a tax authority, which cares about the amount in the
 * currency the invoice is denominated in.
 */
export function presentedTotal(input: {
  grossCents: number;
  vatBps: number;
  rateMicro: number;
}): { settlementTotalCents: number; presentedTotalCents: number; vatCents: number } {
  const vat = vatOn(input.grossCents, input.vatBps);
  const settlementTotal = Math.max(0, input.grossCents) + vat;
  return {
    settlementTotalCents: settlementTotal,
    presentedTotalCents: convertAtRate(settlementTotal, input.rateMicro),
    vatCents: vat,
  };
}
