import "server-only";

/**
 * Where a row lives. PLAN.md 30.1, C118.
 *
 * ## 🔴 Why this is a type and not a setting
 *
 * Egyptian counsel says Egyptian data must sit in Egypt, and Neon has no
 * Egyptian region. So this is a **second database**, not a connection string
 * with a different flag, and the day Cairo is signed the product either routes
 * on the entity already or it does not.
 *
 * The failure mode to design against is the one this codebase has met twice
 * (C84's timezone, C150's locale): a helper that some call sites remember to
 * use, and the ones that forgot are found in production, on a screen. So the
 * region is not a helper. `lib/db` no longer exports a database at all. There
 * are exactly two ways to reach Postgres:
 *
 *   - `dbFor(region)` — data that belongs to somebody, in their jurisdiction.
 *   - `controlDb` — the control plane: settings, content, taxonomy, the
 *     directory that says which region an entity is in. Global by definition.
 *
 * Neither can be called without saying which. That is the whole seam: a query
 * that has not named a plane does not compile, so "going live in Egypt" is an
 * environment variable rather than an audit of 67 tables.
 *
 * ## Today, deliberately, `eg` is the US instance
 *
 * `DATABASE_URL_EG` is unset, so `dbFor("eg")` returns the US pool. That is
 * the ruling: build the seam, point Egypt at the US instance, ship. What makes
 * it honest rather than a lie in a type is that the product **says so** —
 * `regionStatus()` reports it, the cross-border consent screen shows it to the
 * patient it affects, and `verify:sprint30` asserts that the two are the same
 * fact rather than two strings that happen to agree today.
 */

export const REGIONS = ["us", "eg"] as const;
export type Region = (typeof REGIONS)[number];

export const DEFAULT_REGION: Region = "us";

export function isRegion(value: string | null | undefined): value is Region {
  return REGIONS.includes(value as Region);
}

/**
 * The one place a region maps to a connection string.
 *
 * `eg` falls back to the US URL rather than throwing, because the alternative
 * is a product that cannot start until a contract is signed. The fallback is
 * **reported**, not hidden: see `regionStatus()`.
 */
export function connectionStringFor(region: Region): { url: string; resident: boolean } {
  if (region === "eg") {
    const dedicated = process.env.DATABASE_URL_EG;
    if (dedicated) return { url: dedicated, resident: true };
    return { url: process.env.DATABASE_URL ?? "", resident: false };
  }
  return { url: process.env.DATABASE_URL ?? "", resident: true };
}

export type RegionStatus = {
  region: Region;
  label: string;
  /** True only when this region has its own database in its own country. */
  resident: boolean;
  /** Where the data actually is right now. */
  servedFrom: Region;
};

/**
 * What is actually true about each region, right now.
 *
 * 🔴 Read from the environment every time rather than computed once at import.
 * A value frozen at module load is a value that says "Egypt is resident"
 * because somebody set the variable after the process started, and the first
 * person to believe it would be a patient reading a consent screen.
 */
export function regionStatus(region: Region): RegionStatus {
  const { resident } = connectionStringFor(region);
  return {
    region,
    label: regionLabel(region),
    resident,
    servedFrom: resident ? region : DEFAULT_REGION,
  };
}

export function allRegionStatus(): RegionStatus[] {
  return REGIONS.map(regionStatus);
}

/**
 * 🔴 The country, in the reader's language, with the locale as a PARAMETER.
 *
 * Not a lookup the runtime resolves: C150's standing rule, and this is exactly
 * the surface it was written for. The first version returned English only, so
 * the Arabic cross-border consent read *"سجلّك الصحي يخصّ Egypt"* — an Arabic
 * sentence with the two country names in Latin script, on the one screen whose
 * entire legal value is that the person understood it. "They agreed" is not a
 * defence if half the sentence was in a language they do not read.
 *
 * It fell out of a verifier check rather than a review, which is the argument
 * for asserting on the rendered string instead of on the function's existence.
 */
const LABEL: Record<string, Record<Region, string>> = {
  en: { us: "United States", eg: "Egypt" },
  ar: { us: "الولايات المتحدة", eg: "مصر" },
};

export function regionLabel(region: Region, locale = "en"): string {
  return (LABEL[locale] ?? LABEL.en!)[region];
}

/**
 * 🔴 A module that has not been routed yet, saying so out loud.
 *
 * ## Why this exists instead of `dbFor(DEFAULT_REGION)`
 *
 * Sprint 30 removed the bare `db`, which forced 108 files to declare a plane.
 * For most of the clinical core the right region is knowable from an entity in
 * hand and they route on it. For the rest — a rate limiter, a payout ledger, a
 * page that reads one column to decide whether to show a banner — the right
 * answer needs the call site to carry an entity it does not carry yet.
 *
 * The tempting move is `dbFor("us")` with a comment. That compiles, it is
 * indistinguishable from a considered decision, and the day Cairo is live
 * nobody can tell the two apart without reading 91 files. It is exactly the
 * "seam by convention" this sprint exists to avoid.
 *
 * So an unrouted module says so in a way a script can count. Every call is
 * registered with its reason, `verify:sprint30` prints the list, and the
 * number appears in the sprint report. The debt is a list rather than an
 * archaeology exercise, and it cannot grow quietly: a new pin changes a number
 * somebody reads.
 */
const PINS = new Map<string, string>();

export function pinnedToDefaultRegion(where: string, reason: string): Region {
  PINS.set(where, reason);
  return DEFAULT_REGION;
}

/** Every module still pinned, for the verifier and the report. */
export function regionPins(): { where: string; reason: string }[] {
  return [...PINS.entries()].map(([where, reason]) => ({ where, reason }));
}

/**
 * Does serving `homeRegion` from where it is actually served cross a border?
 *
 * The question the consent screen asks, in one function, so the screen and the
 * record of processing cannot disagree about whether a transfer happened.
 */
export function crossesBorder(homeRegion: Region): boolean {
  return regionStatus(homeRegion).servedFrom !== homeRegion;
}
