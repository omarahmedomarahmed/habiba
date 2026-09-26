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
import type { EnvironmentName } from "./_environments";
import { hostOf, writesTo } from "./_verify";

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

/**
 * 🔴 76.20 — WHAT THIS DATABASE IS ACTUALLY CONFIGURED WITH, AND WHAT IT IS NOT.
 *
 *   npm run settings:check
 *
 * ## The gap this closes, and it cost the launch a near miss
 *
 * Production ran for weeks holding the pre-sprint-26 prices. Every gate was
 * green the whole time, because settings are DATA and the gates read CODE. The
 * only reason it was found is that somebody pointed a gate at a fresh branch of
 * production for an unrelated reason.
 *
 * ## 🔴 THE TWO FAILURES ARE NOT THE SAME FAILURE, and only one is dangerous
 *
 * **A missing GROUP is safe.** `parseGroup` fills anything absent from the code
 * defaults, so a database with no `sponsor` row behaves exactly as the defaults
 * say. Worth reporting, because an absent row cannot be edited by an operator
 * and silently moves the day somebody changes a default, but nothing is broken.
 *
 * **A STALE STORED VALUE is the dangerous one, and it is the one defaults
 * cannot rescue.** `pricing.tiers` existed on production and said $99. Nothing
 * fell back, nothing warned, and the product charged the old price. This is the
 * shape that has to be loud.
 *
 * **An EMPTY value that has no meaningful default is the third.**
 * `payouts.transferFields` defaults to `[]` because there is no bank account a
 * program could invent, and an empty list renders "not set up yet" on the one
 * screen this market pays through. A database can be fully seeded, fully
 * repriced, and still unable to take a single payment.
 *
 * ## It reads and never writes
 *
 * So it may be pointed at production, which is the database that most needs
 * asking. It is in `npm run gates` for that reason.
 */
/**
 * 🔴 76.20 — COMPARED BY CONTENT, AND THE FIRST DRAFT WAS NOT.
 *
 * It used `JSON.stringify` on both sides, which made it a test of KEY ORDER.
 * Postgres returns `jsonb` with its own key ordering, so `{a,b}` stored came
 * back `{b,a}` and three groups were reported stale with identical values.
 * That is the §6 family landing on the instrument written to catch §6: a check
 * that fails by measuring the wrong thing is as useless as one that passes that
 * way, and noisier, so it is the version somebody switches off.
 *
 * Object keys are sorted; ARRAY ORDER IS KEPT, because it is meaningful
 * everywhere it appears here. The tiers sort payg first, the seat bands are
 * read in order, and the transfer fields are the order a payer reads them in.
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function check(db: Db): Promise<number> {
  const rows = await db.select().from(platformSettings);
  const stored = new Map(rows.map((r) => [r.key, r.value as Record<string, unknown>]));

  const missingGroups = SETTINGS_GROUPS.filter((g) => !stored.has(g));
  const stale: string[] = [];
  const defaulted: string[] = [];

  for (const group of SETTINGS_GROUPS) {
    const live = stored.get(group);
    if (!live) continue;
    const defaults = SETTINGS_DEFAULTS[group] as Record<string, unknown>;

    for (const [key, want] of Object.entries(defaults)) {
      if (!(key in live)) {
        defaulted.push(`${group}.${key}`);
        continue;
      }
      /*
       * 🔴 COMPARED BY VALUE, and a difference is REPORTED rather than judged.
       *
       * An operator is meant to change prices: a tier that differs from the
       * default is usually somebody doing their job. What this cannot tell
       * apart is that and a value nobody has touched since the default moved
       * underneath it, so it prints both sides and lets a person decide. A
       * check that guessed would be one people learn to ignore.
       */
      if (stable(live[key]) !== stable(want)) {
        stale.push(
          `${group}.${key}\n      stored:  ${stable(live[key]).slice(0, 150)}\n      default: ${stable(want).slice(0, 150)}`,
        );
      }
    }
  }

  /*
   * 🔴 76.42 — THE HOUSE RULE, APPLIED TO DATA.
   *
   * `verify:sprint24` fails the build on a single em dash in source, and it
   * reads source, which is every place this product's copy lives except one.
   * The settings tables hold strings that render to a clinician: the country
   * label on the verification upload, the hint beside a bank field, the label
   * on an InstaPay handle.
   *
   * Production held "National ID (البطاقة) — front" for as long as the country
   * rows have existed. The defaults were corrected in code and `settings:seed`
   * is `onConflictDoNothing`, so the fix never reached a database that already
   * had the row: exactly the shape of stale data a source gate cannot see.
   *
   * It exits non-zero, unlike a stale price. A price somebody set is somebody
   * doing their job; there is no version of this that is a decision.
   */
  const dashes: string[] = [];
  const sweep = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (value.includes("\u2014")) dashes.push(`${path}: ${value.slice(0, 80)}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, i) => sweep(entry, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) sweep(v, `${path}.${k}`);
    }
  };
  for (const [key, value] of stored) sweep(value, key);

  /* 🔴 THE ONE THAT STOPS THE PRODUCT WORKING, checked by name. */
  const payouts = stored.get("payouts") as { transferFields?: unknown[] } | undefined;
  const fields = payouts?.transferFields ?? [];
  const noBankAccount = !Array.isArray(fields) || fields.length === 0;

  const countries = await db.select().from(countrySettings);
  for (const row of countries) sweep(row, `country ${row.code}`);
  const missingCountries = COUNTRY_SEED.filter(
    (c) => !countries.some((row) => row.code === c.code),
  ).map((c) => c.code);

  console.log("\n🔴 What this database is configured with.\n");

  console.log(`  ${SETTINGS_GROUPS.length - missingGroups.length}/${SETTINGS_GROUPS.length} setting groups stored`);
  if (missingGroups.length > 0) {
    console.log(`  --  absent, so the code defaults apply: ${missingGroups.join(", ")}`);
    console.log("      Safe, but an operator cannot edit what is not there. `settings:seed` writes them.");
  }
  if (defaulted.length > 0) {
    console.log(`  --  keys absent from a stored group, filled from defaults: ${defaulted.join(", ")}`);
  }

  if (stale.length > 0) {
    console.log(`\n  ⚠️  ${stale.length} stored value(s) differ from the code defaults.`);
    console.log("      Either somebody set them on purpose, or a default moved and this did not.");
    for (const entry of stale) console.log(`    · ${entry}`);
  } else {
    console.log("\n  every stored value equals its default");
  }

  console.log(
    `\n  ${missingCountries.length === 0 ? "every seeded country is present" : `🔴 countries missing: ${missingCountries.join(", ")}`}`,
  );

  if (noBankAccount) {
    console.log(
      "\n🔴 NO TRANSFER FIELDS. There is no bank account on this database, so the payment\n" +
        "   sheet renders 'not set up yet' and nobody on the Egyptian rail can pay.\n" +
        "   There is no default for this and there cannot be one: set it in /admin/settings.",
    );
  } else {
    console.log(`\n  bank details present: ${(fields as { key: string }[]).map((f) => f.key).join(", ")}`);
  }

  if (dashes.length > 0) {
    console.log(`\n🔴 ${dashes.length} stored string(s) contain an em dash, which this product does not use.`);
    console.log("   These render to a clinician. Fix them in /admin/settings or with an UPDATE.");
    for (const entry of dashes) console.log(`    · ${entry}`);
  }

  /*
   * 🔴 ONLY THE THREE THAT ARE NEVER A DECISION EXIT NON-ZERO. A stale price
   * might be deliberate and a missing group is harmless; failing on either
   * would make this a gate people switch off, which is H20 exactly. An em dash
   * in copy is not a decision anybody made.
   */
  return noBankAccount || missingCountries.length > 0 || dashes.length > 0 ? 1 : 0;
}

/**
 * 🔴 76.42 — DO THE THREE ENVIRONMENTS HOLD THE SAME SETTINGS?
 *
 *   npm run settings:compare
 *
 * ## Why this is not `check` run three times
 *
 * `check` asks one database whether it matches the CODE. Three green `check`
 * runs do not mean three identical databases: every value an operator
 * deliberately changed shows as "differs from default" on all three and tells
 * you nothing about whether they differ from EACH OTHER. The FX rate is the
 * obvious one, and the transfer fields are the one that matters — there is no
 * code default for a bank account, so `check` can only ask whether one exists.
 *
 * ## 🔴 WHAT IT MEANS FOR THE SIMULATION
 *
 * A six month run is evidence about the product only if the product it runs on
 * is the product. A simulation priced off a stale tier table produces a P&L
 * about a business nobody is launching, and the failure is invisible: every
 * number is internally consistent and all of them are about the wrong company.
 *
 * ## It READS, on every connection, and writes nothing anywhere
 *
 * Which is why it can be pointed at production, and why it must be: production
 * is the database that most needs asking and the one a write guard has always
 * refused to let anybody ask.
 */
/**
 * 🔴 76.59 — THE SETTINGS THAT ARE ALLOWED TO DIFFER, NAMED, ONE LINE OF REASON EACH.
 *
 * ## Why this list exists at all, and why it is this short
 *
 * The verdict below used to be "any difference fails", and its comment said the
 * quiet part: *nobody sets a value on one environment ON PURPOSE that another
 * must not have*. That was true when it was written and it stopped being true
 * the day `simulate:seed` narrowed the copilot quota on production to protect
 * the run's ten dollars of model credit. The gate then went red about a decision
 * somebody had made deliberately and written down, which is the first step of
 * H20: a gate that fails for a reason everybody knows is a gate everybody stops
 * reading, and the drift it exists to catch walks in behind the known failure.
 *
 * ## 🔴 AN ALLOWANCE IS NOT A MUTE
 *
 * Three things keep this from becoming a hole:
 *
 *   - **Every allowed difference is still PRINTED**, under its own heading, with
 *     its reason beside it. Nobody reads "environments agree" and believes it.
 *   - **Both values are pinned.** `copilot.messagesPerPatientPerSession` is
 *     allowed to be 4 on production while it is 10 everywhere else. Production
 *     at 3, or dev at 4, or the same key drifting anywhere else, still fails.
 *     The allowance is for one value on one environment, not for one key.
 *   - **An allowance that matched nothing is printed too**, as not in effect, so
 *     a rule that outlived its reason is visible rather than dormant.
 *
 * Anything not on this list still fails, and adding to it is a code change with
 * a reason attached, which is the point.
 */
type Allowance = {
  /** The leaf key, spelled exactly as the diff below prints it. */
  leaf: string;
  /** The one environment allowed to hold something else. */
  on: EnvironmentName;
  /** What it is allowed to hold there, serialised. Nothing else passes. */
  is: string;
  /** What every other environment must still hold. */
  elsewhere: string;
  /** Why, in one line, for whoever reads the output. */
  because: string;
};

const ALLOWED: Allowance[] = [
  ...([["joinEarlyMinutes", "5"], ["soonMinutes", "15"]] as const).map(([key, value]): Allowance => ({
    leaf: `rules.start.${key}`,
    on: "production",
    is: "(absent)",
    elsewhere: value,
    because:
      "The start clock (15 minutes 'starting soon', 5 minutes 'join early') is new on this branch. " +
      "Production's stored rules row predates it, so the code default applies there, which is the " +
      "same number. It is saved through /admin/settings once the new code is live (ruling N5), " +
      "and then this allowance matches nothing and is printed as not in effect.",
  })),
];

async function compare(): Promise<number> {
  const { ENVIRONMENTS, urlFor } = await import("./_environments");

  type Loaded = {
    name: string;
    settings: Map<string, unknown>;
    countries: Map<string, unknown>;
  };

  const loaded: Loaded[] = [];
  const absent: string[] = [];
  const mislabelled: string[] = [];

  for (const env of ENVIRONMENTS) {
    const url = urlFor(env);
    if (!url) {
      absent.push(`${env.name} (set ${env.variable})`);
      continue;
    }

    /*
     * 🔴 THE LABEL IS CHECKED AGAINST THE HOST BEFORE ANYTHING IS READ.
     *
     * `DATABASE_URL_PRODUCTION` holding the dev branch is a variable that lies,
     * and every comparison downstream of it would be a comparison of dev with
     * dev, reported as agreement. That is the §6 family — a check that passes
     * by measuring the wrong thing — and it is cheap to refuse.
     */
    if (!url.includes(env.endpoint)) {
      mislabelled.push(`${env.variable} does not point at ${env.endpoint} (${env.branch})`);
      continue;
    }

    const { pool, db } = connect(url);
    try {
      const rows = await db.select().from(platformSettings);
      const countryRows = await db.select().from(countrySettings);
      loaded.push({
        name: env.name,
        settings: new Map(rows.map((r) => [r.key, r.value])),
        countries: new Map(
          countryRows.map((r) => [r.code, { ...r, updatedAt: null, createdAt: null }]),
        ),
      });
    } finally {
      await pool.end();
    }
  }

  console.log("\n🔴 The same settings, on every environment?\n");

  for (const line of mislabelled) console.log(`  🔴 ${line}`);
  if (absent.length > 0) console.log(`  --  not configured: ${absent.join(", ")}`);
  console.log(`  --  compared: ${loaded.map((l) => l.name).join(", ") || "nothing"}\n`);

  if (loaded.length < 2) {
    console.log(
      "🔴 Fewer than two environments to compare, so this answered nothing.\n" +
        "   Each environment needs its own connection string. See .env.example.",
    );
    return 1;
  }

  const [first, ...rest] = loaded as [Loaded, ...Loaded[]];

  type Difference = { key: string; left: string; right: string; other: string };
  const differences: Difference[] = [];

  /*
   * 🔴 THE DIFFERENCE IS REPORTED PER LEAF KEY, not per group.
   *
   * The first version printed both whole serialisations truncated to 160
   * characters, so a one-key drift inside `payouts` — which has fourteen keys
   * and an array of transfer fields — printed two identical-looking prefixes
   * and told the reader nothing. A diff nobody can read is a diff nobody acts
   * on, which is H20 pointed at output rather than at a schedule.
   */
  const leaves = (value: unknown, prefix: string): Map<string, string> => {
    const out = new Map<string, string>();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          for (const [ik, iv] of leaves(v, `${prefix}.${k}`)) out.set(ik, iv);
        } else {
          out.set(`${prefix}.${k}`, stable(v));
        }
      }
      return out;
    }
    out.set(prefix, stable(value));
    return out;
  };

  const compareLeaves = (label: string, mine: unknown, theirs: unknown, other: string) => {
    const a = leaves(mine, label);
    const b = leaves(theirs, label);
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      const left = a.get(key) ?? "(absent)";
      const right = b.get(key) ?? "(absent)";
      if (left === right) continue;
      differences.push({ key, left: left.slice(0, 200), right: right.slice(0, 200), other });
    }
  };

  const keys = [...new Set(loaded.flatMap((l) => [...l.settings.keys()]))].sort();
  for (const key of keys) {
    for (const other of rest) {
      compareLeaves(key, first.settings.get(key), other.settings.get(key), other.name);
    }
  }

  const codes = [...new Set(loaded.flatMap((l) => [...l.countries.keys()]))].sort();
  for (const code of codes) {
    for (const other of rest) {
      compareLeaves(`country ${code}`, first.countries.get(code), other.countries.get(code), other.name);
    }
  }

  /*
   * 🔴 THE ALLOWANCE IS MATCHED ON BOTH VALUES AND ON WHICH SIDE HOLDS WHICH.
   *
   * `first` is production, so a difference reads `left` on production and
   * `right` on the other environment. An allowance says one environment may
   * hold one value while the rest hold another, and both halves have to line up
   * before it applies. Widening it to "this key may differ" would let the same
   * key drift to a third value and report it as expected, which is the §6
   * family wearing a permission slip.
   */
  const allowanceFor = (d: Difference): Allowance | null =>
    ALLOWED.find((a) => {
      if (a.leaf !== d.key) return false;
      if (a.on === first.name) return d.left === a.is && d.right === a.elsewhere;
      if (a.on === d.other) return d.right === a.is && d.left === a.elsewhere;
      return false;
    }) ?? null;

  const excused = differences.filter((d) => allowanceFor(d) !== null);
  const failing = differences.filter((d) => allowanceFor(d) === null);

  const show = (d: Difference) =>
    `${d.key}\n      ${first.name}:  ${d.left}\n      ${d.other}:  ${d.right}`;

  if (failing.length === 0) {
    console.log(
      `  every setting group and every country agrees across ${loaded.length} environments` +
        (excused.length > 0 ? ", apart from the deliberate differences below" : ""),
    );
  } else {
    console.log(`  🔴 ${failing.length} difference(s):\n`);
    for (const d of failing) console.log(`    · ${show(d)}\n`);
  }

  /*
   * 🔴 PRINTED, NOT SWALLOWED. An allowance that hid its difference would turn
   * this into a gate that reports agreement between databases that do not
   * agree, and the next person to read it would be reading a lie with a clean
   * exit code on top.
   */
  if (excused.length > 0) {
    console.log(`\n  --  ${excused.length} deliberate difference(s), each with its reason:\n`);
    for (const d of excused) {
      console.log(`    · ${show(d)}`);
      console.log(`      why:  ${allowanceFor(d)?.because ?? ""}\n`);
    }
  }

  /*
   * 🔴 AND AN ALLOWANCE THAT MATCHED NOTHING IS SAID OUT LOUD.
   *
   * The copilot quota goes back to ten when the run ends, and on that day this
   * entry stops describing anything. A permission nobody can see is a permission
   * nobody removes, so an unused one is printed as unused rather than left to
   * sit in the file waiting to excuse a future accident.
   */
  const unused = ALLOWED.filter((a) => !excused.some((d) => allowanceFor(d) === a));
  for (const a of unused) {
    console.log(`  --  allowance not in effect: ${a.leaf} is not ${a.is} on ${a.on}. Delete it if it is done`);
  }

  /*
   * 🔴 AN UNEXPLAINED DIFFERENCE FAILS, and this is the one place in this file
   * where that is right. `check` prints a stale price and exits zero because an
   * operator changing a price is somebody doing their job. There is no
   * equivalent story here: an unexplained difference between three environments
   * is either drift or a deploy that did not finish, and both are things to fix
   * rather than to read. The explained ones are above, in full, with the reason
   * that makes each of them a decision instead.
   */
  return failing.length > 0 || mislabelled.length > 0 ? 1 : 0;
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
  const verb = process.argv[2] ?? "seed";

  /*
   * 🔴 76.20 — WHICH VERBS THE PRODUCTION GUARD IS FOR, AND WHICH IT IS NOT.
   *
   * `writesTo()` exists because `scripts/demo.ts` puts fabricated clinicians on
   * the public radar: it refuses production to stop TEST DATA landing on a live
   * site. Two of the four verbs here are not that, and holding them to the rule
   * cost the launch a near miss.
   *
   * **`check` reads.** The database that most needs asking "what are you
   * actually configured with" is production, and a read-only question refused
   * by a write guard is a question nobody asks. That is why production held the
   * pre-sprint-26 prices for weeks with every gate green.
   *
   * **`seed` only ever INSERTS.** Both statements are `onConflictDoNothing`, so
   * it cannot change a value anybody set, and the rows it adds are the code's
   * own defaults, which is exactly what the absent rows were behaving as
   * already. Its own header calls it "safe on every deploy" and nothing has
   * ever run it on a deploy, which is H16's defect wearing a different hat: a
   * step safe to automate and not automated is one somebody does by hand at the
   * worst possible moment. It is `prebuild` now, and it has to be allowed to do
   * its job where the job is.
   *
   * **`reprice` OVERWRITES**, so it keeps the guard and the deliberate door.
   * **`rails` writes fixtures**, so it keeps it too.
   */
  /*
   * Both may be let through to production, because both are the thing the door
   * was built for: a price this product charges, and a blank on a country row.
   * Neither invents a person. 76.52.
   */
  if (verb === "reprice" || verb === "rails") writesTo({ productionIsAllowed: true });
  else if (verb === "seed") console.log(`seeding ${hostOf()}\n`);

  /*
   * 🔴 `compare` OPENS ITS OWN CONNECTIONS, three of them, so it runs before
   * the single shared one below and never touches `DATABASE_URL`. A comparison
   * of three databases that refused to start because a fourth variable was
   * unset would be the most annoying possible way to fail.
   */
  if (verb === "compare") {
    process.exitCode = await compare();
    return;
  }

  const { pool, db } = connect();
  try {
    if (verb === "seed") await seed(db);
    else if (verb === "reprice") await reprice(db);
    else if (verb === "show") await show(db);
    else if (verb === "rails") await rails(db);
    else if (verb === "check") process.exitCode = await check(db);
    else {
      console.error(`unknown verb "${verb}". Use seed, reprice, rails, check, compare or show.`);
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
