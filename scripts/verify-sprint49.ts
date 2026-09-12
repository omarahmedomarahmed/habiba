/**
 * Sprint 49 acceptance: Total View, and the cost ledger it reads.
 *
 *   npm run verify:sprint49
 *
 * ## 🔴 What C221 and 49.14 said, and what was actually there
 *
 * C221: "We cannot say what a session costs us, because token usage is not
 * recorded per model." 49.14: "C221's cost table is a new table, not a column.
 * `aiRequestLogs` records no tokens and no price."
 *
 * Measured before building: `ai_request_logs` records `model`, `input_tokens`,
 * `output_tokens`, `audio_seconds` and `cost_microcents`, and `lib/ai/client.ts`
 * has written all of them on every model call since before sprint 33. The
 * verification database holds real tokens and real prices for four call kinds.
 *
 * A second usage table would have meant thirteen call kinds writing to two
 * places, which drift, whose first symptom is two different answers to "what
 * did this therapist cost us" on one screen. The ruling was rewritten to
 * extend the table instead.
 *
 * ## 🔴 C279, which is why that argument is not theoretical
 *
 * The same divergence had already happened between two COLUMNS of one table.
 * `lib/data/admin.ts` summed `cost_cents` in three places while
 * `lib/data/vault.ts` summed `cost_microcents`, so two admin screens reported
 * different totals for the same calls, in production, for four sprints. The
 * schema comment said `cost_cents` was "no longer the number anything reads",
 * which is what stopped anybody looking.
 *
 * A comment is not a fact about the code. This asserts it.
 */
import { readdirSync } from "node:fs";

import { sql } from "drizzle-orm";

import { readSource, reporter, writesTo } from "./_verify";

const { check, finish } = reporter();

async function main() {
  writesTo();

  const { controlDb: db } = await import("../lib/db");
  const { aiRequestLogs } = await import("../lib/db/schema");
  const { getSettings } = await import("../lib/settings");
  const { __costing } = await import("../lib/ai/client");
  const { PLATFORM_BUCKET, costByPatient, costByAccount, consentRate, revenueBySource } =
    await import("../lib/data/usage");

  /* ------------------------------------------ C279 · one column, one answer -- */

  /*
   * 🔴 Asserted across every reporting path, not on the two files that were
   * wrong. The defect was not that `admin.ts` chose badly; it was that nothing
   * stopped a third file choosing badly tomorrow.
   *
   * `lib/ai/client.ts` is the one legitimate writer and is excluded by name:
   * the column is still written, because something outside this repository may
   * read it and a column that silently stops moving is worse than one nobody
   * reads.
   */
  const WRITERS = ["client.ts"];
  const roots = ["lib/data", "lib/console", "lib/billing", "app"];

  const sources: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/.test(entry.name)) sources.push(path);
    }
  };
  for (const root of roots) walk(root);

  const lossy = sources.filter((file) => {
    if (WRITERS.some((writer) => file.endsWith(writer))) return false;
    return /aiRequestLogs\.costCents/.test(readSource(file));
  });

  check(
    "🔴 C279 no reporting query reads the lossy `cost_cents` column",
    sources.length > 200 && lossy.length === 0,
    lossy.length === 0
      ? `${sources.length} files scanned, all reporting paths on cost_microcents`
      : lossy.join(", "),
  );

  /*
   * 🔴 CONTROL — and the precise column IS being read.
   *
   * The check above passes against a codebase that reports no cost at all,
   * which is the state the whole ledger was in when 91% of calls rounded to
   * zero. This is the half that says the number is there.
   */
  const reading = sources.filter((file) => /costMicrocents/.test(readSource(file)));

  check(
    "🔴 CONTROL …and several reporting paths read `cost_microcents`",
    reading.length >= 3,
    `${reading.length} files: ${reading.slice(0, 4).join(", ")}`,
  );

  /*
   * The size of the disagreement, from the real rows. Not an assertion about
   * which is bigger: per-row rounding sends a 0.6c call up and a 0.4c call
   * down, so the lossy total is higher than the truth on medium calls and
   * lower on tiny ones. What is asserted is that they differ, because a
   * database where they happen to agree would make this check vacuous and
   * nobody would notice.
   */
  const [spread] = (
    await db.execute(sql`
      SELECT SUM(cost_cents)::int AS lossy,
             ROUND(SUM(cost_microcents) / 1000.0)::int AS precise,
             COUNT(*) FILTER (WHERE cost_cents = 0 AND cost_microcents > 0)::int AS rounded_away
      FROM ai_request_logs`)
  ).rows as { lossy: number; precise: number; rounded_away: number }[];

  check(
    "C279 the two columns genuinely disagree, so the check above is not vacuous",
    spread !== undefined && (spread.lossy !== spread.precise || spread.rounded_away > 0),
    spread
      ? `lossy ${spread.lossy}c, precise ${spread.precise}c, ${spread.rounded_away} calls rounded away`
      : "no usage rows",
  );

  /* -------------------------------------------- 49.14a · patient attribution -- */

  const [column] = (
    await db.execute(sql`
      SELECT data_type, is_nullable FROM information_schema.columns
      WHERE table_name = 'ai_request_logs' AND column_name = 'patient_id'`)
  ).rows as { data_type: string; is_nullable: string }[];

  check(
    "🔴 49.14a `ai_request_logs` records who the call was ABOUT, not only who made it",
    column?.data_type === "uuid" && column?.is_nullable === "YES",
    column
      ? `patient_id ${column.data_type}, nullable, ON DELETE SET NULL so a deleted patient does not delete what their care cost`
      : "missing",
  );

  /* ------------------------------------------------- 49.14b · rates in settings -- */

  const settings = await getSettings();

  /*
   * 🔴 Moved, not changed. A transcription that cost 0.3c a minute yesterday
   * costs 0.3c a minute today, and this compares the settings table against
   * the shipped constants rather than against a number retyped here, so the
   * two cannot drift apart in a commit that only touches one of them.
   */
  const shippedTokens = __costing.TOKEN_RATES as Record<
    string,
    { inPerMTok: number; outPerMTok: number }
  >;
  const shippedAudio = __costing.AUDIO_RATES as Record<string, { perAudioMinute: number }>;

  const tokensMatch = Object.entries(shippedTokens).every(([model, rate]) => {
    const row = settings.aiRates.tokens.find((r) => r.model === model);
    return row?.inPerMTok === rate.inPerMTok && row?.outPerMTok === rate.outPerMTok;
  });
  const audioMatch = Object.entries(shippedAudio).every(([model, rate]) => {
    const row = settings.aiRates.audio.find((r) => r.model === model);
    return row?.perAudioMinute === rate.perAudioMinute;
  });

  check(
    "🔴 49.14b the model rates live in settings, and are the shipped figures unchanged",
    tokensMatch && audioMatch && settings.aiRates.tokens.length >= 2,
    `${settings.aiRates.tokens.length} token rates, ${settings.aiRates.audio.length} audio rates, all matching lib/ai/client.ts`,
  );

  /*
   * 🔴 And the history is frozen.
   *
   * C221: "a historical row keeps the cost it was priced at". The cost is
   * computed at write time and stored, so a rate corrected in March prices the
   * next call and cannot rewrite what last week cost. Asserted on the write
   * path, because a read that re-priced from current settings would look
   * identical on a day nobody changed a rate.
   */
  const client = readSource("lib/ai/client.ts");

  check(
    "🔴 49.14b the cost is frozen on the row at write time, so a rate change never rewrites history",
    /costMicrocents: microcents/.test(client) &&
      /estimateCostMicrocents\(input, await ratesInForce\(\)\)/.test(client),
    "priced once, in logUsage, and stored",
  );

  /* ------------------------------------------ 49.14c · the named platform bucket -- */

  /*
   * 🔴 The §6 family in a reporting costume.
   *
   * A null in `GROUP BY organization_id` is omitted from every per-account
   * report while the total above it stays correct. Nothing fails, nothing
   * errors, and the rows do not add up to the total. This plants an
   * unattributable call and asserts it comes back with a NAME.
   */
  const [planted] = await db
    .insert(aiRequestLogs)
    .values({
      organizationId: null,
      userId: null,
      sessionId: null,
      patientId: null,
      kind: "translate",
      model: "gpt-4o-mini",
      inputTokens: 1000,
      outputTokens: 1000,
      costMicrocents: 75_000,
      durationMs: 10,
      status: "success",
    })
    .returning({ id: aiRequestLogs.id });

  try {
    const byAccount = await costByAccount(30);
    const byPatient = await costByPatient(30);

    check(
      "🔴 49.14c / C221 an unattributable call reports as a NAMED bucket, never a null",
      byAccount.some((row) => row.organizationId === PLATFORM_BUCKET) &&
        byPatient.some((row) => row.patientId === PLATFORM_BUCKET),
      `${PLATFORM_BUCKET} present in both the account list and the patient list`,
    );

    /*
     * 🔴 CONTROL — and its cost is actually in the figure.
     *
     * A bucket that appears with a zero beside it is the same disappearance
     * with a label on it. This asserts the planted 7.5 cents is inside the
     * platform row.
     */
    const platformAccount = byAccount.find((row) => row.organizationId === PLATFORM_BUCKET);

    check(
      "🔴 CONTROL the platform bucket carries the cost, rather than appearing empty",
      (platformAccount?.costMicrocents ?? 0) >= 75_000,
      `${platformAccount?.costMicrocents ?? 0} microcents against a planted 75,000`,
    );
  } finally {
    if (planted) {
      await db.execute(sql`DELETE FROM ai_request_logs WHERE id = ${planted.id}`);
    }
  }

  /* ------------------------------------------------------ 49.4 · consent rate -- */

  const consent = await consentRate(3650);

  /*
   * 🔴 Three buckets, not two, and the third is the one worth watching.
   *
   * A session nobody was asked is not a refusal. Folding "not asked" into
   * "declined" makes a product that has stopped asking look like patients
   * saying no, which is the opposite diagnosis and the opposite fix.
   */
  check(
    "🔴 49.4 the consent rate separates `declined` from `never asked`",
    consent.granted + consent.declined + consent.notAsked === consent.total,
    `${consent.total} sessions: ${consent.granted} granted, ${consent.declined} declined, ${consent.notAsked} never asked`,
  );

  check(
    "49.4 …and reports no percentage at all when there is nothing to divide",
    consent.total > 0 ? consent.percent !== null : consent.percent === null,
    "`0% consented` and `no sessions yet` are different facts",
  );

  /* -------------------------------------------- 49.5 / C222 · revenue, unsummed -- */

  const revenue = await revenueBySource(3650);

  /*
   * 🔴 C222 — a patient pays their THERAPIST, not us.
   *
   * The four figures stay four. `therapistGrossCents` is included so nobody
   * has to go and find it, and labelled so nobody adds it to the other three:
   * reporting what a patient paid their clinician as our revenue would
   * misdescribe who paid whom on the screen an investor reads.
   */
  check(
    "🔴 49.5 / C222 revenue is split by source and the therapist's gross is kept apart",
    typeof revenue.platformFeeCents === "number" &&
      typeof revenue.aiFeeCents === "number" &&
      typeof revenue.planPurchaseCents === "number" &&
      typeof revenue.therapistGrossCents === "number",
    `platform ${revenue.platformFeeCents}c, ai ${revenue.aiFeeCents}c, plans ${revenue.planPurchaseCents}c; therapists' own gross ${revenue.therapistGrossCents}c, which is NOT ours`,
  );

  const usage = readSource("lib/data/usage.ts");

  check(
    "🔴 49.11 no figure is derived from another figure on screen",
    !/platformFeeCents \+ aiFeeCents|totalRevenue\s*=/.test(usage),
    "every number is its own query against the ledger and the usage table",
  );

  /* ----------------------------------------------- 49.13 / C244 · the wall -- */

  /*
   * 🔴 Ships before 53, and binds it.
   *
   * "The corporate wall is a property of the DATA, not the audience." No
   * screen here, admin included, may join a sponsor to a session, a booking, a
   * date or a patient name. There are no sponsor tables yet, so what this
   * asserts today is that the reporting layer has not grown a sponsor
   * reference ahead of them, and it will fail the day one is added without a
   * ruling.
   */
  const reportingLayer = ["lib/data/usage.ts", "lib/data/admin.ts", "lib/data/vault.ts"];
  const sponsorAware = reportingLayer.filter((file) => /sponsor/i.test(readSource(file)));

  check(
    "🔴 49.13 / C244 no reporting query joins a sponsor to a session, a date or a name",
    sponsorAware.length === 0,
    sponsorAware.length === 0
      ? "the wall is a property of the data, and 53 inherits it rather than adding it"
      : sponsorAware.join(", "),
  );

  finish("sprint 49");
}

void main();
