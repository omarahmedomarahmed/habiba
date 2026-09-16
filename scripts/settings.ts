/**
 * Seed and reprice the settings tables.
 *
 *   npx tsx scripts/settings.ts seed      idempotent; safe on every deploy
 *   npx tsx scripts/settings.ts reprice   deliberate: overwrites pricing
 *   npx tsx scripts/settings.ts show      print what is actually stored
 *
 * `seed` never overwrites. `reprice` always does, which is why it is a separate
 * verb you have to type: it is the one-time move to the §3 schedule (PLAN.md
 * 1.6) together with moving every therapist to PAYG (1.7), and running it twice
 * would undo an admin's later edits.
 *
 * This does not import `lib/settings` — that module is `server-only` and throws
 * outside a request. It imports the pure definitions instead, which is also the
 * point of keeping them pure.
 */
import { notInArray } from "drizzle-orm";

import {
  COUNTRY_SEED,
  SETTINGS_DEFAULTS,
  SETTINGS_GROUPS,
  settingsProblem,
} from "../lib/settings/defs";
import { connect, schema } from "./db";
import { writesTo } from "./_verify";

const { platformSettings, countrySettings, subscriptions } = schema;

type Db = ReturnType<typeof connect>["db"];

async function seed(db: Db) {
  let groups = 0;
  for (const group of SETTINGS_GROUPS) {
    const rows = await db
      .insert(platformSettings)
      .values({ key: group, value: SETTINGS_DEFAULTS[group] as never })
      .onConflictDoNothing({ target: platformSettings.key })
      .returning({ key: platformSettings.key });
    groups += rows.length;
  }

  let countries = 0;
  for (const c of COUNTRY_SEED) {
    const rows = await db
      .insert(countrySettings)
      .values(c)
      .onConflictDoNothing({ target: countrySettings.code })
      .returning({ code: countrySettings.code });
    countries += rows.length;
  }

  console.log(`seeded: ${groups} setting group(s), ${countries} country/countries (new rows only)`);
}

/**
 * The one-time move to the §3 schedule.
 *
 * Every therapist goes to PAYG, `unlimited` subscribers included. PLAN.md is
 * explicit that this is safe here and says why: they are demo accounts under
 * test by real clinicians, the ledger holds two rows, and no payment has ever
 * been taken. That is a fact about *this* database on the day it was measured,
 * not a general licence — re-read the counts before running this anywhere else.
 */
async function reprice(db: Db) {
  const problem = settingsProblem(SETTINGS_DEFAULTS);
  if (problem) {
    console.error(`refusing to reprice: ${problem}`);
    process.exit(1);
  }

  /*
   * 🔴 76.1 — `sponsor` JOINED THE LIST, AND IT HAD TO.
   *
   * Changing a default in `defs.ts` changes nothing in a database that already
   * holds a row for that group: `parseGroup` fills MISSING keys from the
   * defaults and keeps every key that is present. So dropping the top-up floor
   * from $5,000 to $100 moved the source and left every live database on the
   * old number, while the three NEW keys beside it picked their defaults up
   * immediately.
   *
   * That mixture is the dangerous part rather than the staleness. The stepper's
   * ceiling defaulted to $500,000 cents and the stored floor stayed at the same
   * figure, so the ladder built exactly one rung: a company was offered $5,000
   * or nothing, on a screen written to offer $100. It looked like a rendering
   * bug and it was a settings one.
   *
   * 🔴 SAFE FOR THE OTHER KEYS, CHECKED RATHER THAN ASSUMED. Every remaining
   * field in the stored `sponsor` row already equals its default, so this
   * overwrite moves the floor and adds the new keys and touches nothing else.
   */
  for (const group of ["pricing", "session", "sponsor"] as const) {
    await db
      .insert(platformSettings)
      .values({ key: group, value: SETTINGS_DEFAULTS[group] as never })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: SETTINGS_DEFAULTS[group] as never, updatedAt: new Date() },
      });
    console.log(`repriced: ${group}`);
  }

  /*
   * 🔴 Sprint 57 / C299 — this swept EVERY row that was not `payg`.
   *
   * That was 1.7: a one-time move off the old `unlimited` plan at a moment when
   * nothing could legitimately be subscribed to. After sprint 57 two tiers can
   * be, and the same line would have CANCELLED EVERY PAYING CUSTOMER'S PLAN —
   * silently, from a verb an operator types to fix a price, with a cheerful
   * "moved to PAYG: 40 subscription(s)" underneath it.
   *
   * A one-time migration left standing in a script is a loaded gun aimed at
   * whatever the model becomes next. The sweep now targets only plans the live
   * tier table cannot price, which is what 1.7 actually meant.
   */
  const liveKeys = SETTINGS_DEFAULTS.pricing.tiers.map(
    (t) => t.key as (typeof subscriptions.$inferSelect)["plan"],
  );
  const moved = await db
    .update(subscriptions)
    .set({ plan: "payg", updatedAt: new Date() })
    .where(notInArray(subscriptions.plan, liveKeys))
    .returning({ id: subscriptions.id, org: subscriptions.organizationId });

  console.log(
    `moved to PAYG: ${moved.length} subscription(s) on a retired plan key` +
      ` (live: ${liveKeys.join(", ")})`,
  );
}

async function show(db: Db) {
  const rows = await db.select().from(platformSettings);
  for (const row of rows.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log(`${row.key}: ${JSON.stringify(row.value)}`);
  }
  const countries = await db.select().from(countrySettings);
  for (const c of countries) {
    console.log(`country ${c.code}: vat ${c.vatBps}bps · ${c.currency} · enabled=${c.enabled}`);
  }
  const subs = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions);
  const byPlan = new Map<string, number>();
  for (const s of subs) byPlan.set(s.plan, (byPlan.get(s.plan) ?? 0) + 1);
  console.log(`subscriptions: ${[...byPlan].map(([p, n]) => `${p}=${n}`).join(" ") || "none"}`);
}

/**
 * Fill in the country rails, and **only where nothing is there**. 20.3–20.5.
 *
 * Sprint 20R added nine columns to `country_settings` — which rail a country
 * is on, which entity collects there, and what a clinician there is asked to
 * photograph. The existing rows predate them, so Egypt reads as a country with
 * no way to pay and no way to be paid, which is worse than wrong: it is the
 * product's actual configuration.
 *
 * This is not a backfill of history — nothing here touches a patient, a
 * session or a payment. It is a **configuration** step, and it is written so
 * that it cannot undo an administrator's edit: every field is filled only when
 * the stored value is empty (`COALESCE`-shaped, per field), so running it
 * twice changes nothing the second time and running it after somebody has
 * corrected a label leaves the correction alone.
 */
async function rails(db: ReturnType<typeof connect>["db"]) {
  const { COUNTRY_SEED } = await import("../lib/settings/defs");
  const { countrySettings } = schema;
  const { eq } = await import("drizzle-orm");

  let filled = 0;
  for (const seedRow of COUNTRY_SEED) {
    const [existing] = await db
      .select()
      .from(countrySettings)
      .where(eq(countrySettings.code, seedRow.code))
      .limit(1);

    if (!existing) continue;

    const patch: Record<string, unknown> = {};
    if (!existing.collectionProvider && seedRow.collectionProvider) {
      patch.collectionProvider = seedRow.collectionProvider;
    }
    if ((existing.payoutMethods?.length ?? 0) === 0 && seedRow.payoutMethods.length > 0) {
      patch.payoutMethods = seedRow.payoutMethods;
    }
    if ((existing.regulators?.length ?? 0) === 0 && seedRow.regulators.length > 0) {
      patch.regulators = seedRow.regulators;
    }
    if (!existing.idLabelFront && seedRow.idLabelFront) patch.idLabelFront = seedRow.idLabelFront;
    if (!existing.idLabelBack && seedRow.idLabelBack) patch.idLabelBack = seedRow.idLabelBack;
    if (!existing.licenceLabel && seedRow.licenceLabel) patch.licenceLabel = seedRow.licenceLabel;
    // `entity` has a NOT NULL default of 'us', so "unset" and "deliberately US"
    // are indistinguishable — it is only ever moved when the seed says EG and
    // the stored value is still the default.
    if (existing.entity === "us" && seedRow.entity === "eg") patch.entity = "eg";

    if (Object.keys(patch).length === 0) {
      console.log(`· ${seedRow.code}, already configured, left alone`);
      continue;
    }

    await db.update(countrySettings).set(patch).where(eq(countrySettings.code, seedRow.code));
    filled += 1;
    console.log(`✓ ${seedRow.code}, filled ${Object.keys(patch).join(", ")}`);
  }

  console.log(`\n${filled} countries configured. Empty fields only; nothing was overwritten.`);
}

/*
 * 🔴 Sprint 57 — this script WRITES, so it refuses production by name.
 *
 * Thirty-eight verifiers have called `writesTo()` since C147. These five did not,
 * and an investor found the gap by reading scripts/demo.ts, whose own header says
 * the seeded clinicians are on the public radar and a stranger can book one. That
 * is correct on a branch and a disclosure on production: fabricated `DEMO-` licence
 * numbers, publicly bookable, on a live marketing site.
 *
 * The safety was missing, not the reasoning. It is the same function, imported.
 */
async function main() {
  writesTo();
  const verb = process.argv[2] ?? "seed";
  const { pool, db } = connect();
  try {
    if (verb === "seed") await seed(db);
    else if (verb === "reprice") await reprice(db);
    else if (verb === "show") await show(db);
    else if (verb === "rails") await rails(db);
    else {
      console.error(`unknown verb "${verb}". Use seed, reprice, rails or show.`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
