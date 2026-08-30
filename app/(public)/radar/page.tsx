import type { Metadata } from "next";

import { RadarConsole, RadarSafetyLine } from "@/components/radar/radar-console";
import { listRadar } from "@/lib/data/radar";

export const metadata: Metadata = {
  title: "Crisis Radar — talk to a therapist now",
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
  const therapists = await listRadar();

  return (
    <div className="bg-[#04101f]">
      <RadarConsole initial={therapists} />
      <RadarSafetyLine />
    </div>
  );
}
