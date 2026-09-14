/**
 * Reading and writing scenarios and benchmarks. The only writes in `lib/finance`.
 *
 * 🔴 It writes to `finance_scenarios` and `finance_benchmarks` and to nothing
 * else, ever. `verify:finance` asserts that no module under `lib/finance/` can
 * reach `invoices`, `session_payments`, `platform_settings` or any other table
 * that decides what somebody is charged. A forecast that can move a price is not
 * a forecast, it is an accident waiting for a Friday afternoon.
 */
import "server-only";

import { desc, eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { financeBenchmarks, financeScenarios } from "@/lib/db/schema";

import type { Assumptions } from "./assumptions";
import type { Measured } from "./benchmark";
import { SCENARIOS } from "./scenarios";

export async function listScenarios() {
  return db.select().from(financeScenarios).orderBy(desc(financeScenarios.updatedAt)).limit(50);
}

export async function getScenario(slug: string) {
  const [row] = await db
    .select()
    .from(financeScenarios)
    .where(eq(financeScenarios.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function latestBenchmark() {
  const [row] = await db
    .select()
    .from(financeBenchmarks)
    .orderBy(desc(financeBenchmarks.createdAt))
    .limit(1);
  return row ?? null;
}

export async function saveBenchmark(m: Measured, takenBy: string) {
  const [row] = await db
    .insert(financeBenchmarks)
    .values({
      label: m.label,
      measured: m as unknown as Record<string, unknown>,
      source: m.source as unknown as Record<string, unknown>,
      takenBy,
    })
    .returning({ id: financeBenchmarks.id });
  return row!.id;
}

export async function saveScenario(input: {
  slug: string;
  name: string;
  assumptions: Assumptions;
  benchmarkId: string | null;
  notes: string | null;
  createdBy: string;
}) {
  await db
    .insert(financeScenarios)
    .values({
      slug: input.slug,
      name: input.name,
      assumptions: input.assumptions as unknown as Record<string, unknown>,
      benchmarkId: input.benchmarkId,
      notes: input.notes,
      createdBy: input.createdBy,
    })
    .onConflictDoUpdate({
      target: financeScenarios.slug,
      set: {
        name: input.name,
        assumptions: input.assumptions as unknown as Record<string, unknown>,
        benchmarkId: input.benchmarkId,
        notes: input.notes,
        updatedAt: new Date(),
      },
    });
}

/**
 * Every scenario a reader can pick: the four shipped ones, plus anything saved.
 *
 * 🔴 The shipped four are code, not rows, and that is deliberate. They are the
 * reference points every saved scenario is a deviation from, and a reference
 * point somebody can edit in place stops being one. Editing a shipped scenario
 * saves a copy under a new slug; the original stays where it is.
 */
export async function allScenarios(): Promise<
  { slug: string; name: string; assumptions: Assumptions; shipped: boolean; benchmarkId: string | null }[]
> {
  const saved = await listScenarios();
  const shipped = SCENARIOS.map((s, i) => ({
    slug: ["benchmark", "real-sessions", "base", "funded"][i]!,
    name: s.name,
    assumptions: s,
    shipped: true,
    benchmarkId: null,
  }));

  const savedRows = saved
    .filter((r) => !shipped.some((s) => s.slug === r.slug))
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      assumptions: r.assumptions as unknown as Assumptions,
      shipped: false,
      benchmarkId: r.benchmarkId,
    }));

  return [...shipped, ...savedRows];
}
