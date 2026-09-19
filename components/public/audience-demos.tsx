import { DeviceFrame } from "@/components/demo/device-frame";
import { ClinicConsole, CompanyConsole } from "@/components/demo/portal-demo";
import { SplitBar } from "@/components/visual/primitives";
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
 * 🔴 76.71 — A COMPANY, AS THE CONSOLE THEY WILL SIT IN FRONT OF.
 *
 * This used to be a meter, the spend chart and a two-column "sees / never sees"
 * panel, floating on the page with no chrome around them. All true, and it
 * answered none of the question an HR lead arrives with. `CompanyConsole` draws
 * the portal: the sidebar, the pot, where the money went, the joining code, and
 * the settings row for "require staff to attend" shown as **not built**.
 *
 * The real `SpendHeatmap` and the real `Meter` are still inside it, so 65.17
 * holds: this cannot outlive the feature it is about.
 */
export function CompanyDemo() {
  return (
    <DeviceFrame as="browser" path="/sponsor" bodyClassName="h-[26rem]">
      <CompanyConsole />
    </DeviceFrame>
  );
}

/**
 * 🔴 76.71 — A CLINIC, the same way.
 *
 * The old one was the numeral 11 above the word "seats". This is the week's
 * appointments, the clinicians and where each one's verification has got to,
 * earnings with no withdraw button beside them, and one bill for the period.
 */
export function ClinicDemo() {
  return (
    <DeviceFrame as="browser" path="/clinic" bodyClassName="h-[26rem]">
      <ClinicConsole />
    </DeviceFrame>
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
