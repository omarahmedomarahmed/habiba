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
  /**
   * 🔴 37L.9 — THE SAME MONDAY, IN WORDS, AND IT IS A SEPARATE FIELD ON PURPOSE.
   *
   * `weekStart` was doing both jobs: React's key and the date a person reads.
   * A key has to be stable and machine-shaped; a date a person reads has to be
   * formatted in their language, which an ISO slice is not. In Arabic it is
   * actively wrong rather than merely ugly, because the bidi algorithm reorders
   * "2027-09-21" to "21-09-2027" on screen and nothing says which end is the
   * year.
   *
   * So the server formats it and sends both. The key stays the ISO string.
   */
  label: string;
  /** 🔴 null is SUPPRESSED, not zero. The two render differently on purpose. */
  spendCents: number | null;
};

export function SpendHeatmap({ weeks }: { weeks: HeatWeek[] }) {
  const t = useT();

  if (weeks.length === 0) {
    return <p className="mt-2 text-sm text-navy-400">{t("sponsor.suppressed")}</p>;
  }

  const reported = weeks
    .map((week) => week.spendCents)
    .filter((cents): cents is number => cents !== null);
  const peak = Math.max(1, ...reported);

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-1.5">
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
            "bg-navy-50 ring-1 ring-inset ring-navy-100",
            "bg-brand-100",
            "bg-brand-200",
            "bg-brand-400",
            "bg-brand-600",
          ][step];

          return (
            <div
              key={week.weekStart}
              title={
                suppressed
                  ? t("sponsor.suppressedBody")
                  : t("sponsor.week", { date: week.label })
              }
              aria-label={
                suppressed
                  ? t("sponsor.suppressed")
                  : t("sponsor.week", { date: week.label })
              }
              className={
                suppressed
                  ? "h-8 w-8 shrink-0 rounded-lg border border-dashed border-navy-200 bg-[repeating-linear-gradient(45deg,#dde3ea,#dde3ea_3px,#fff_3px,#fff_7px)] sm:h-9 sm:w-9"
                  : `h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9 ${shade}`
              }
            />
          );
        })}
      </div>
    </div>
  );
}
