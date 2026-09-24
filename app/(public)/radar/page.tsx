import type { Metadata } from "next";

import { RadarConsole, RadarSafetyLine } from "@/components/radar/radar-console";
import { listRadar } from "@/lib/data/radar";
import { firstOpenHours } from "@/lib/data/scheduling";
import { getI18n } from "@/lib/i18n/server";
import { crisisCountryFor } from "@/lib/crisis/line";
import { SosOrbServer } from "@/components/patient/sos-orb-server";

export const metadata: Metadata = {
  title: "Crisis Radar, talk to a therapist now",
  description:
    "See which licensed therapists are available this minute, what languages they speak and what they charge. No account, no waiting list.",
};

/**
 * Rendered per request, never cached.
 *
 * Availability is the entire content of this page. A cached radar is a page
 * that sends someone in crisis to a clinician who logged off twenty minutes
 * ago, which is worse than showing them nothing.
 */
export const dynamic = "force-dynamic";

/**
 * Full bleed, on purpose.
 *
 * There is no measure, no prose column and no heading here, because the page
 * is not making an argument — it is showing who is reachable. The old version
 * put a 4xl column of explanation above a globe in a card, which is how you
 * lay out an article about a product rather than the product.
 *
 * The one piece of writing that survives is the emergency line, and it sits
 * outside the console so it can never end up inside a collapsed panel.
 */
export default async function RadarPage() {
  /* 🔴 W2-P12: what to book when nobody is on shift, so an empty radar is not a dead end. */
  const [therapists, firstHours] = await Promise.all([listRadar(), firstOpenHours()]);

  return (
    <div className="bg-[#04101f]">
      <RadarConsole initial={therapists} firstHours={firstHours} />
      <RadarSafetyLine />
      {/*
        🔴 51.4 — the orb belongs HERE most of all.

        This is the page a person in crisis actually lands on, and until now it
        carried a disclaimer ("this is not an emergency service") and no way to
        act on it. A sentence telling somebody what this is not, with no button
        for what they should do instead, is the worst version of that line.

        No `phone`: a visitor here is anonymous, so `lineForNumber(null)`
        returns null and the sheet shows the sentence that is true everywhere.
        That is the honest answer rather than a degraded one, and it is a
        plain `tel:` away from a dialler either way.
      */}
      <SosOrbServer country={crisisCountryFor({ locale: (await getI18n()).locale })} />
    </div>
  );
}
