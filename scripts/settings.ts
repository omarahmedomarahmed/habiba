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
import { ne } from "drizzle-orm";

import {
  COUNTRY_SEED,
  SETTINGS_DEFAULTS,
  SETTINGS_GROUPS,
  settingsProblem,
} from "../lib/settings/defs";
import { connect, schema } from "./db";

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

  for (const group of ["pricing", "session"] as const) {
    await db
      .insert(platformSettings)
      .values({ key: group, value: SETTINGS_DEFAULTS[group] as never })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value: SETTINGS_DEFAULTS[group] as never, updatedAt: new Date() },
      });
    console.log(`repriced: ${group}`);
  }

  const moved = await db
    .update(subscriptions)
    .set({ plan: "payg", updatedAt: new Date() })
    .where(ne(subscriptions.plan, "payg"))
    .returning({ id: subscriptions.id, org: subscriptions.organizationId });

  console.log(`moved to PAYG: ${moved.length} subscription(s)`);
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

async function main() {
  const verb = process.argv[2] ?? "seed";
  const { pool, db } = connect();
  try {
    if (verb === "seed") await seed(db);
    else if (verb === "reprice") await reprice(db);
    else if (verb === "show") await show(db);
    else {
      console.error(`unknown verb "${verb}". Use seed, reprice or show.`);
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
