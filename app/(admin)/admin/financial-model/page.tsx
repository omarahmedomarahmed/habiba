import type { Metadata } from "next";

import { FinancialModel } from "@/components/admin/financial-model";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import type { Assumptions } from "@/lib/finance/assumptions";
import { provenanceSplit } from "@/lib/finance/assumptions";
import type { Measured } from "@/lib/finance/benchmark";
import { allScenarios, latestBenchmark } from "@/lib/finance/store";

export const metadata: Metadata = { title: "Financial model", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The forecast. Thirty-six months, four scenarios, every input badged.
 *
 * ## 🔴 `requireRole("super_admin")`, not `requireStaff`
 *
 * This is the company's own numbers: salaries, runway, the month the cash runs
 * out. The 24/7 team works queues and has no business here, and the difference
 * between the two guards on this screen is the difference between an operating
 * console and a board pack.
 *
 * ## 🔴 It is NOT `/admin/settings`, and that is structural
 *
 * A number in `platform_settings` prices the product: change it and the next
 * invoice changes. A forecast input must be incapable of that, so it lives in
 * `finance_scenarios`, is read by `lib/finance/`, and `verify:finance` asserts
 * that nothing in that module can import anything that writes money.
 *
 * The model READS the real prices and never defines one. An operator who types
 * a different session price has made a scenario, and the input goes grey and
 * says `assumed` the moment they touch it, whatever it was before.
 *
 * ## What the screen is honest about
 *
 * Three things, all of them uncomfortable and all of them on the page rather
 * than in a footnote: which inputs were measured and on how many rows, which
 * can never be measured here at all, and whether the scenario in front of you
 * runs out of money before it breaks even.
 */
export default async function FinancialModelPage() {
  await requireRole("super_admin");

  const [scenarios, benchmark] = await Promise.all([allScenarios(), latestBenchmark()]);

  const measured = (benchmark?.measured ?? null) as Measured | null;

  /*
   * 🔴 The standing list of what cannot be measured here, shown even when no
   * benchmark has been taken. A screen that only names its limits after
   * somebody has run a measurement is a screen whose first reader is misled.
   */
  const couldNotMeasure = measured?.couldNotMeasure ?? [
    "churn: one cohort, three months",
    "acquisition cost: no marketing here",
    "card fees: Stripe is in test mode",
    "video: billed per participant minute, off this database",
    "nothing measured here yet",
  ];

  const split = provenanceSplit(scenarios[2]?.assumptions ?? (scenarios[0]!.assumptions as Assumptions));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial model"
        subtitle="Thirty-six months, and where each number came from."
      />

      {/*
        🔴 THE PROVENANCE SPLIT, AT THE TOP, BEFORE ANY FORECAST.
        A reader who sees a chart first and the caveats last has already formed
        a view. This is the first thing on the page on purpose.
      */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Provenance
            </p>
            <p className="mt-1 text-sm text-slate-700">
              <strong className="text-teal-700">{split.measured} measured</strong> ·{" "}
              <strong>{split.assumed} assumed</strong>
            </p>
          </div>
          <div className="h-3 min-w-40 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-teal-500"
              style={{
                width: `${(split.measured / Math.max(1, split.measured + split.assumed)) * 100}%`,
              }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {measured
            ? `${measured.takenOn}: ${measured.source.completedSessions} sessions, ${measured.source.therapists} therapists, ${measured.source.monthsOfHistory} months.`
            : "Nothing measured here. The unit costs come from the 2026-09-14 API benchmark, which measures the model and not this business."}
        </p>
      </Card>

      <FinancialModel
        scenarios={scenarios.map((s) => ({
          slug: s.slug,
          name: s.name,
          assumptions: s.assumptions,
          shipped: s.shipped,
        }))}
        measuredOn={measured?.takenOn ?? null}
        benchmarkSource={measured?.source ?? null}
        couldNotMeasure={couldNotMeasure}
      />
    </div>
  );
}
