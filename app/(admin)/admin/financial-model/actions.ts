"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import type { Assumptions } from "@/lib/finance/assumptions";
import { take } from "@/lib/finance/benchmark";
import { saveBenchmark, saveScenario } from "@/lib/finance/store";
import { AI_FIXED_USD, AI_PER_MINUTE_USD } from "@/lib/finance/scenarios";

/**
 * The two things a reader can do to the model, and nothing else.
 *
 * ## 🔴 Both are `super_admin`, and both are audited
 *
 * Saving a scenario writes a row somebody may later quote in a fundraising
 * conversation, and taking a benchmark freezes a claim about what this business
 * costs to run. Neither is a preference. The audit row is the answer to "who
 * decided the churn was 3%", asked in six months by somebody who was not here.
 *
 * ## 🔴 There is no third action, and that is the design
 *
 * Nothing here can write a price. `verify:finance` asserts the module graph:
 * `lib/finance/` cannot import billing, and this file's only writes go through
 * `lib/finance/store.ts`, which touches two tables. A forecast that can move an
 * invoice is not a forecast.
 */
export type FinanceActionState = { error?: string; ok?: string };

/**
 * Save a set of assumptions under a slug.
 *
 * 🔴 A shipped scenario is never overwritten. The four in `scenarios.ts` are
 * code, not rows, and they are the reference points every saved scenario is a
 * deviation from. A reference point somebody can edit in place stops being one,
 * so editing one and saving produces a copy under a new slug.
 */
export async function saveScenarioAction(input: {
  slug: string;
  name: string;
  assumptions: Assumptions;
  notes: string | null;
}): Promise<FinanceActionState> {
  const actor = await requireRole("super_admin");

  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (slug.length < 3) return { error: "Give it a name of at least three characters." };

  if (["benchmark", "real-sessions", "base", "funded"].includes(slug)) {
    return { error: "That is one of the four shipped scenarios. Save your version under another name." };
  }

  const { latestBenchmark } = await import("@/lib/finance/store");
  const benchmark = await latestBenchmark();

  await saveScenario({
    slug,
    name: input.name.trim() || slug,
    assumptions: input.assumptions,
    benchmarkId: benchmark?.id ?? null,
    notes: input.notes,
    createdBy: actor.userId,
  });

  await audit({
    actor,
    category: "admin",
    action: "finance.scenario.save",
    resourceType: "finance_scenario",
    reason: `Saved the financial scenario "${input.name}" as ${slug}`,
  });

  revalidatePath("/admin/financial-model");
  return { ok: `Saved as "${input.name}".` };
}

/**
 * Freeze what this database currently says about the unit economics.
 *
 * 🔴 It is a SNAPSHOT, written once and never updated. A forecast quoted in
 * March has to be reproducible in June, and it cannot be if the numbers behind
 * it are a live query. Re-measuring writes a new row and leaves the old one
 * exactly where it was.
 */
export async function takeBenchmarkAction(label: string): Promise<FinanceActionState> {
  const actor = await requireRole("super_admin");

  const measured = await take({
    label: label.trim() || `Measured ${new Date().toISOString().slice(0, 10)}`,
    fallbackAiFixedUsd: AI_FIXED_USD,
    fallbackAiPerMinuteUsd: AI_PER_MINUTE_USD,
  });

  const id = await saveBenchmark(measured, actor.userId);

  await audit({
    actor,
    category: "admin",
    action: "finance.benchmark.take",
    resourceType: "finance_benchmark",
    resourceId: id,
    reason: `Measured ${measured.source.completedSessions} completed sessions; ${measured.couldNotMeasure.length} inputs could not be established`,
  });

  revalidatePath("/admin/financial-model");
  return {
    ok: `Measured ${measured.source.completedSessions} sessions. ${measured.couldNotMeasure.length} things it could not establish, listed on the page.`,
  };
}
