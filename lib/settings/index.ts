import "server-only";

import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/lib/db";
import { countrySettings, platformSettings } from "@/lib/db/schema";
import { log, safeErrorMessage } from "@/lib/logger";

import {
  COUNTRY_SEED,
  parseCountry,
  parseGroup,
  SETTINGS_DEFAULTS,
  SETTINGS_GROUPS,
  type CountrySettings,
  type PlatformSettings,
  type SettingsGroup,
} from "./defs";

export * from "./defs";

/**
 * Read every setting, once per request.
 *
 * `cache()` is per-request memoisation, not a cross-request cache, and that is
 * the behaviour the sprint's acceptance test demands: *changing a rate in the
 * database changes what the next session bills, with no deploy.* A process-wide
 * cache with a TTL would make that sentence false for the length of the TTL,
 * and "the price changed but not for everyone yet" is the kind of bug that gets
 * discovered in a therapist's invoice.
 *
 * It is one indexed read of four small rows. If it ever shows up in a trace,
 * the fix is a cache with explicit invalidation on write, not a timer.
 */
export const getSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const rows = await db
      .select({ key: platformSettings.key, value: platformSettings.value })
      .from(platformSettings);

    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const out = {} as PlatformSettings;
    for (const group of SETTINGS_GROUPS) {
      // A group with no row parses from `undefined` and lands on its defaults,
      // which is exactly what an unseeded database should do.
      out[group] = parseGroup(group, stored.get(group)) as never;
    }
    return out;
  } catch (error) {
    /*
     * The database is unreachable and we still have to answer.
     *
     * Falling back rather than throwing is a deliberate choice about which
     * failure is worse. A settings read sits underneath the room, the note and
     * the invoice; throwing here turns a blip into a clinician unable to open
     * a session in progress. The defaults are the seeded values, so the worst
     * case is that a rate change is briefly not honoured — and the error is
     * loud enough to find.
     */
    log.error("settings read failed, using defaults", { reason: safeErrorMessage(error) });
    return SETTINGS_DEFAULTS;
  }
});

/** One group, for a caller that needs a single figure. */
export async function getSetting<G extends SettingsGroup>(group: G): Promise<PlatformSettings[G]> {
  return (await getSettings())[group];
}

/* ------------------------------------------------------------- countries -- */

export const getCountries = cache(async (): Promise<CountrySettings[]> => {
  try {
    const rows = await db.select().from(countrySettings);
    return rows.map(parseCountry).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    log.error("country settings read failed", { reason: safeErrorMessage(error) });
    return [];
  }
});

/**
 * A country we can price in, or `null`.
 *
 * Returning null rather than a zero-VAT default is the entire point of the
 * table. See `country_settings` in the schema: a missing row means unknown, and
 * unknown is not zero.
 */
export async function getCountrySettings(code: string | null | undefined) {
  if (!code) return null;
  const wanted = code.trim().toUpperCase();
  const found = (await getCountries()).find((c) => c.code === wanted);
  return found && found.enabled ? found : null;
}

/* ---------------------------------------------------------------- writes -- */

/**
 * Replace one group.
 *
 * The value is parsed before it is stored, so a bad field is corrected on the
 * way in rather than silently falling back on every read afterwards — an admin
 * who mistypes a rate should see the rate they actually got, not a form that
 * accepted a number the application then ignores.
 *
 * Callers are responsible for the permission check and for the audit entry:
 * this module knows about settings, not about who is allowed to change them.
 */
export async function writeSettingsGroup<G extends SettingsGroup>(input: {
  group: G;
  value: unknown;
  updatedBy: string | null;
}): Promise<PlatformSettings[G]> {
  const parsed = parseGroup(input.group, input.value);
  await db
    .insert(platformSettings)
    .values({
      key: input.group,
      value: parsed as never,
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: parsed as never, updatedBy: input.updatedBy, updatedAt: new Date() },
    });
  return parsed;
}

export async function writeCountrySettings(input: {
  country: CountrySettings;
  updatedBy: string | null;
}): Promise<void> {
  const c = parseCountry(input.country);
  await db
    .insert(countrySettings)
    .values({
      code: c.code,
      name: c.name,
      vatBps: c.vatBps,
      currency: c.currency,
      paymentMethods: c.paymentMethods,
      enabled: c.enabled,
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: countrySettings.code,
      set: {
        name: c.name,
        vatBps: c.vatBps,
        currency: c.currency,
        paymentMethods: c.paymentMethods,
        enabled: c.enabled,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    });
}

/**
 * Put the defaults in, without touching anything already there.
 *
 * Idempotent and non-destructive: `onConflictDoNothing` rather than an upsert,
 * because this runs on deploy and a seed that overwrote a rate an admin had
 * edited would silently undo their change on the next release.
 */
export async function seedSettings(): Promise<{ groups: number; countries: number }> {
  let groups = 0;
  for (const group of SETTINGS_GROUPS) {
    const inserted = await db
      .insert(platformSettings)
      .values({ key: group, value: SETTINGS_DEFAULTS[group] as never })
      .onConflictDoNothing({ target: platformSettings.key })
      .returning({ key: platformSettings.key });
    groups += inserted.length;
  }

  let countries = 0;
  for (const c of COUNTRY_SEED) {
    const inserted = await db
      .insert(countrySettings)
      .values({
        code: c.code,
        name: c.name,
        vatBps: c.vatBps,
        currency: c.currency,
        paymentMethods: c.paymentMethods,
        enabled: c.enabled,
      })
      .onConflictDoNothing({ target: countrySettings.code })
      .returning({ code: countrySettings.code });
    countries += inserted.length;
  }

  return { groups, countries };
}

/** Used by the reprice script and by tests that need a clean read. */
export async function readGroupRaw(group: SettingsGroup) {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, group))
    .limit(1);
  return row ?? null;
}
