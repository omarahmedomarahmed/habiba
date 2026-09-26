import { DeviceFrame } from "@/components/demo/device-frame";
import { ClinicConsole, CompanyConsole, PartnerConsole } from "@/components/demo/portal-demo";
import { SplitBar } from "@/components/visual/primitives";
import { getI18n } from "@/lib/i18n/server";
import { getSettings, platformFeeOn } from "@/lib/settings";
import { DEMO_SESSION_EGP, egp } from "@/lib/marketing/prices";

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
export function CompanyDemo({ initial }: { initial?: string } = {}) {
  return (
    <DeviceFrame as="browser" path="/sponsor" bodyClassName="h-[30rem]">
      <CompanyConsole initial={initial} />
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
export function ClinicDemo({ initial }: { initial?: string } = {}) {
  return (
    <DeviceFrame as="browser" path="/clinic" bodyClassName="h-[30rem]">
      <ClinicConsole initial={initial} />
    </DeviceFrame>
  );
}

/**
 * A PARTNER, the same way: the keys a developer holds and the log of what was
 * sent to them, on the partner portal's navy desk.
 */
export function PartnerDemo({ initial }: { initial?: string } = {}) {
  return (
    <DeviceFrame as="browser" path="/partner" bodyClassName="h-[26rem]">
      <PartnerConsole initial={initial} />
    </DeviceFrame>
  );
}

/**
 * 🔴 A THERAPIST: the fee split, as the bar the portal draws.
 *
 * `SplitBar`'s widths are its figures, so this is the actual proportion rather than a
 * drawing of one. The price is illustrative; the CUT is not. It was a literal 15%
 * and would have gone on promising 15% the day an admin changed the fee, so it
 * reads `platformFeeBps` and rounds the way the charge does (`platformFeeOn`).
 */
export async function TherapistSplitDemo() {
  const [{ t, locale }, settings] = await Promise.all([getI18n(), getSettings()]);
  /* The benchmark session in pounds, from the product's defaults, not a typed figure. */
  const price = DEMO_SESSION_EGP;
  const money = (minor: number) => egp(minor, locale);
  const feeBps = settings.session.platformFeeBps;
  const fee = platformFeeOn(price, feeBps);
  const percent = Number((feeBps / 100).toFixed(2));

  return (
    <div className="rounded-3xl border border-navy-100/80 bg-white p-5 shadow-[0_1px_2px_rgba(10,35,66,0.04),0_8px_24px_-12px_rgba(10,35,66,0.12)]">
      <SplitBar
        parts={[
          { label: t("tnew.youKeep", { amount: money(price - fee) }), value: price - fee, kind: "keep" },
          { label: t("tnew.ourFee", { amount: money(fee), percent }), value: fee, kind: "fee" },
        ]}
        note={t("tnew.vatOnTop")}
      />
    </div>
  );
}
