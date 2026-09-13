"use client";

import { useT } from "@/lib/i18n/client";

/**
 * A year of weekly spend. PLAN.md 53.25, C228, C229.
 *
 * ## 🔴 A suppressed week and an empty week look DIFFERENT
 *
 * `spendCents: null` means "we are not publishing a figure for this period"; `0`
 * means "nothing was spent". Rendering them the same way would destroy the only
 * thing suppression is for: a sponsor who can tell a suppressed week from a quiet
 * one can subtract the neighbours and recover it, which is C229's differencing
 * attack done by eye on a chart.
 *
 * So a suppressed cell is hatched and labelled, and a zero cell is the palest
 * shade of the scale. The tooltip on a suppressed cell says the figure rolled
 * into the next one, which is true and is what stops somebody treating it as a
 * gap in the data.
 *
 * ## 🔴 Spend, never a session count
 *
 * There is nowhere on this component to put one. The prop does not carry it. A
 * week's session count with a small number in it is one person's therapy, and the
 * page's total count is safe only because it is all-time and organisation-wide.
 */

export type HeatWeek = {
  /** ISO date of the Monday, already grouped in SQL. No day exists upstream. */
  weekStart: string;
  /** 🔴 null is SUPPRESSED, not zero. The two render differently on purpose. */
  spendCents: number | null;
};

export function SpendHeatmap({ weeks }: { weeks: HeatWeek[] }) {
  const t = useT();

  if (weeks.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">{t("sponsor.suppressed")}</p>;
  }

  const reported = weeks
    .map((week) => week.spendCents)
    .filter((cents): cents is number => cents !== null);
  const peak = Math.max(1, ...reported);

  return (
    <div className="mt-3 overflow-x-auto">
      <div className="flex min-w-max gap-1">
        {weeks.map((week) => {
          const suppressed = week.spendCents === null;
          const share = suppressed ? 0 : week.spendCents! / peak;

          /*
           * Five steps rather than a continuous opacity. A continuous scale
           * invites reading a value off a colour, and a value read off a colour
           * is a weekly figure recovered to within a few percent.
           */
          const step = share === 0 ? 0 : share < 0.25 ? 1 : share < 0.5 ? 2 : share < 0.75 ? 3 : 4;
          const shade = [
            "bg-slate-100",
            "bg-teal-100",
            "bg-teal-200",
            "bg-teal-400",
            "bg-teal-600",
          ][step];

          return (
            <div
              key={week.weekStart}
              title={
                suppressed
                  ? t("sponsor.suppressedBody")
                  : t("sponsor.week", { date: week.weekStart })
              }
              aria-label={
                suppressed
                  ? t("sponsor.suppressed")
                  : t("sponsor.week", { date: week.weekStart })
              }
              className={
                suppressed
                  ? "h-6 w-6 shrink-0 rounded border border-dashed border-slate-300 bg-[repeating-linear-gradient(45deg,#f1f5f9_0,#f1f5f9_2px,#fff_2px,#fff_4px)]"
                  : `h-6 w-6 shrink-0 rounded ${shade}`
              }
            />
          );
        })}
      </div>
    </div>
  );
}
