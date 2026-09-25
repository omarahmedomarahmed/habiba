/*
 * 🔴 30.1 — the CONTROL PLANE. One copy, read by every region.
 *
 * This module reads facts about the PRODUCT rather than about a person:
 * settings, content, taxonomy, language, the operator console. There is one
 * of each and Cairo reads the same rows as Virginia. The compiler would not
 * let this file compile without making that choice explicitly.
 */
import "server-only";

import { eq, sql } from "drizzle-orm";
import { cache } from "react";

import { controlDb as db } from "@/lib/db";
import { countrySettings, platformSettings, settingsHistory } from "@/lib/db/schema";
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
/**
 * 🔴 0161 — a verifier states which position of a rule switch it tests, in its
 * own process, without writing the shared row (`scripts/_rules.ts`). A value
 * on `globalThis` rather than an import, so a check can set it before any of
 * the application's modules (and its environment) have loaded. Never set by
 * the application, and ignored outright on a deployment.
 */
const OVERRIDE_KEY = "__24tRulesOverrideForChecks";

function withOverride(settings: PlatformSettings): PlatformSettings {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return settings;
  const patch = (globalThis as Record<string, unknown>)[OVERRIDE_KEY] as
    | Partial<Record<string, object>>
    | undefined;
  if (!patch) return settings;
  const rules = { ...settings.rules } as Record<string, object>;
  for (const [key, part] of Object.entries(patch)) {
    rules[key] = { ...(rules[key] ?? {}), ...(part ?? {}) };
  }
  return { ...settings, rules: rules as PlatformSettings["rules"] };
}

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
    return withOverride(out);
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
    return withOverride(SETTINGS_DEFAULTS);
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
  const [previous] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, input.group))
    .limit(1);
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
  /*
   * 🔴 0161 — the whole value before and after, whichever form saved it. A form's
   * own audit line says what it meant to change; this row says what did.
   */
  await db.insert(settingsHistory).values({
    scope: "platform",
    key: input.group,
    before: (previous?.value ?? null) as never,
    after: parsed as never,
    changedBy: input.updatedBy,
  });
  return parsed;
}

export async function writeCountrySettings(input: {
  country: CountrySettings;
  updatedBy: string | null;
}): Promise<void> {
  const c = parseCountry(input.country);
  const [previous] = await db
    .select()
    .from(countrySettings)
    .where(eq(countrySettings.code, c.code))
    .limit(1);
  await db
    .insert(countrySettings)
    .values({
      code: c.code,
      name: c.name,
      vatBps: c.vatBps,
      currency: c.currency,
      paymentMethods: c.paymentMethods,
      collectionProvider: c.collectionProvider,
      payoutMethods: c.payoutMethods,
      entity: c.entity,
      regulators: c.regulators,
      idLabelFront: c.idLabelFront,
      idLabelBack: c.idLabelBack,
      licenceLabel: c.licenceLabel,
      sampleImageUrl: c.sampleImageUrl,
      crisisLineLabel: c.crisisLineLabel,
      crisisLineTel: c.crisisLineTel,
      /*
       * 🔴 Stamped whenever a line is present, because "is this number still
       * right" is asked a year later and answered by a name and a date. Null
       * when there is no line, so an empty country is not recorded as having
       * been checked by somebody.
       */
      crisisLineVerifiedAt: c.crisisLineTel ? new Date() : null,
      crisisLineVerifiedBy: c.crisisLineTel ? input.updatedBy : null,
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
        collectionProvider: c.collectionProvider,
        payoutMethods: c.payoutMethods,
        entity: c.entity,
        regulators: c.regulators,
        idLabelFront: c.idLabelFront,
        idLabelBack: c.idLabelBack,
        licenceLabel: c.licenceLabel,
        sampleImageUrl: c.sampleImageUrl,
        crisisLineLabel: c.crisisLineLabel,
        crisisLineTel: c.crisisLineTel,
        /*
         * 🔴 AE68: only when the line itself changed. Every save of the country
         * card (a VAT rate, a label) used to re-stamp the line as checked by
         * whoever saved, so "who last checked this number, and when" named
         * somebody who never looked at it. Compared against the stored row in
         * the same statement, so two saves cannot disagree about it.
         */
        crisisLineVerifiedAt: sql`CASE
          WHEN excluded.crisis_line_tel IS NULL THEN NULL
          WHEN ${countrySettings.crisisLineTel} IS DISTINCT FROM excluded.crisis_line_tel
            OR ${countrySettings.crisisLineLabel} IS DISTINCT FROM excluded.crisis_line_label
            OR ${countrySettings.crisisLineVerifiedAt} IS NULL
          THEN now()
          ELSE ${countrySettings.crisisLineVerifiedAt} END`,
        crisisLineVerifiedBy: sql`CASE
          WHEN excluded.crisis_line_tel IS NULL THEN NULL
          WHEN ${countrySettings.crisisLineTel} IS DISTINCT FROM excluded.crisis_line_tel
            OR ${countrySettings.crisisLineLabel} IS DISTINCT FROM excluded.crisis_line_label
            OR ${countrySettings.crisisLineVerifiedAt} IS NULL
          THEN ${input.updatedBy}::uuid
          ELSE ${countrySettings.crisisLineVerifiedBy} END`,
        enabled: c.enabled,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    });
  await db.insert(settingsHistory).values({
    scope: "country",
    key: c.code,
    before: (previous ? parseCountry(previous) : null) as never,
    after: c as never,
    changedBy: input.updatedBy,
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
        collectionProvider: c.collectionProvider,
        payoutMethods: c.payoutMethods,
        entity: c.entity,
        regulators: c.regulators,
        idLabelFront: c.idLabelFront,
        idLabelBack: c.idLabelBack,
        licenceLabel: c.licenceLabel,
        sampleImageUrl: c.sampleImageUrl,
        enabled: c.enabled,
      })
      .onConflictDoNothing({ target: countrySettings.code })
      .returning({ code: countrySettings.code });
    countries += inserted.length;
  }

  return { groups, countries };
}

/** 🔴 0161 — the last changes to one group or country, newest first, for the settings screen. */
export async function settingsHistoryFor(scope: "platform" | "country", key: string, limit = 20) {
  const { desc, and } = await import("drizzle-orm");
  return db
    .select()
    .from(settingsHistory)
    .where(and(eq(settingsHistory.scope, scope), eq(settingsHistory.key, key)))
    .orderBy(desc(settingsHistory.changedAt))
    .limit(limit);
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
