import { Meter, SeesWhat, SplitBar } from "@/components/visual/primitives";
import { SpendHeatmap } from "@/components/sponsor/spend-heatmap";
import { CLINIC, POT, SPEND_CURVE } from "@/lib/marketing/fixtures";
import { getI18n } from "@/lib/i18n/server";

/**
 * 🔴 65.17 / 65.20 — THE REAL COMPONENTS, RENDERED, ONE PER AUDIENCE.
 *
 * > *Not screenshots that rot, not mockups drawn in a design tool: the actual sponsor
 * > spend chart, the actual radar card, the actual coverage meter, the actual note view,
 * > imported from the portal and fed fixture data.*
 *
 * Every import above is the component the portal itself renders. `SpendHeatmap` is the
 * one on `/sponsor`, C229's suppression rule and all; `TherapistCard` is the one on the
 * radar; `Meter`, `SeesWhat` and `SplitBar` are the 65.4 vocabulary the portals use.
 *
 * ## 🔴 WHAT THIS BUYS, AND IT IS NOT PRETTINESS
 *
 * *A marketing page that renders the product cannot show a product we do not have.* A
 * screenshot of the spend chart survives the chart being deleted. This does not: the
 * build breaks, which is the only kind of marketing claim that maintains itself.
 *
 * It also runs the rules. The heatmap below hatches a suppressed week because that is
 * what the component does, so the marketing page demonstrates C229 without anybody
 * writing a sentence about C229.
 *
 * ## 🔴 65.19 — AND EVERY NUMBER COMES FROM `lib/marketing/fixtures.ts`
 *
 * Which imports nothing. There is no path from a row to this file.
 */

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

/**
 * 🔴 A COMPANY: the pot as a meter, and the wall as two columns.
 *
 * C227 and C244 are the pitch rather than the small print, which is 65.15's own wording:
 * *bring mental health to your people, and never learn who went.* So the `SeesWhat` is
 * the product demonstration and the meter is the thing beside it.
 */
export async function CompanyDemo() {
  const { t } = await getI18n();

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-900/5">
      <Meter
        usedLabel={money(POT.remainingCents)}
        ofLabel={t("sponsor.ofLastTopUp", { amount: money(POT.addedCents) })}
        fraction={1 - POT.remainingCents / POT.addedCents}
        note={t("sponsor.expiresOn", { date: POT.expiresLabel })}
      />

      <SpendHeatmap
        weeks={SPEND_CURVE.map((point, index) => ({
          weekStart: `W${index + 1}`,
          /* 🔴 One suppressed week, because a chart without one hides the rule. */
          spendCents: index === 2 ? null : point.cents,
        }))}
      />

      <SeesWhat
        who={t("sponsor.apply.seesWho")}
        can={[t("sponsor.apply.seesCount"), t("sponsor.apply.seesWeekly")]}
        cannot={[t("sponsor.neverIndividual"), t("sponsor.neverAttendance")]}
      />
    </div>
  );
}

/**
 * 🔴 A CLINIC: seats, and the clinical wall that comes with them.
 *
 * The seat figure is `lib/marketing/fixtures.ts`'s, not `seatMonthlyCents`'s, because a
 * marketing page that computes a live price is a page that quotes one, and `verify:claims`
 * rule 62.11 is about exactly which figures may appear beside the word "seat".
 */
export async function ClinicDemo() {
  const { t } = await getI18n();

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-900/5">
      <div>
        <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
          {CLINIC.seats}
        </p>
        <p className="text-sm text-slate-500">{t("clinic.seatsWord")}</p>
      </div>

      <SeesWhat
        who={t("clinic.apply.seesWho")}
        can={[t("clinic.apply.seesSchedule"), t("clinic.apply.seesBills")]}
        cannot={[t("clinic.neverNote"), t("clinic.neverRisk")]}
      />
    </div>
  );
}

/**
 * 🔴 A THERAPIST: the fee split, as the bar the portal draws.
 *
 * `SplitBar`'s widths are its figures, so this is the actual proportion rather than a
 * drawing of one. The percentages come from the fixtures for the reason above.
 */
export async function TherapistSplitDemo() {
  const { t } = await getI18n();
  const price = 6_000;
  const fee = Math.round(price * 0.15);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 ring-slate-900/5">
      <SplitBar
        parts={[
          { label: t("tnew.youKeep", { amount: money(price - fee) }), value: price - fee, kind: "keep" },
          { label: t("tnew.ourFee", { amount: money(fee), percent: 15 }), value: fee, kind: "fee" },
        ]}
        note={t("tnew.vatOnTop")}
      />
    </div>
  );
}
