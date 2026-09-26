import Link from "next/link";

import type { DiscoverTherapist } from "@/lib/data/discover";
import { getI18n } from "@/lib/i18n/server";
import { Face } from "@/components/patient/kit";

/**
 * 🔴 65.7 — EXPLORE THERAPISTS, AS A RAIL RATHER THAN A COLUMN OF PARAGRAPHS.
 *
 * The patient home screen had one list of clinicians on it and it was the ranked one.
 * A person who has just arrived is not choosing between the top four, they are finding
 * out whether there is anybody here at all, and that question is answered by faces.
 *
 * ## 🔴 65.8 — THE CARD CANNOT SAY ANYTHING IT DOES NOT KNOW
 *
 * No star, no "new", no "4.9" on somebody with two ratings: `exploreTherapists` hands
 * a count of zero to everyone below the bar and this renders nothing in that slot.
 * The only claims on the card are the person's own name, their own headline, and
 * whether they are online, which the radar decides rather than this component.
 *
 * ## 🔴 65.21 — AND IT IS A RAIL IN BOTH DIRECTIONS
 *
 * `overflow-x-auto` on a flex row follows the document direction, so the same markup
 * scrolls right in English and left in Arabic. The card's width is fixed and its text
 * wraps, because a headline written in Arabic is not the length of one written in
 * English and a card sized to the English one clips it.
 */
export async function ExploreRail({ therapists }: { therapists: DiscoverTherapist[] }) {
  const { t } = await getI18n();

  return (
    <ul className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {therapists.map((therapist) => (
        <li key={therapist.userId} className="w-[200px] shrink-0 snap-start">
          <Link
            href={`/patient/t/${therapist.userId}`}
            className="flex h-full flex-col gap-3 rounded-3xl bg-white p-4 shadow-[0_10px_30px_-18px_rgba(10,35,66,0.35)] ring-1 ring-navy-100 transition-transform active:scale-[0.98]"
          >
            <Face name={therapist.name} photoUrl={therapist.photoUrl} size={48} live={therapist.online} />

            <span className="min-w-0">
              <span className="block truncate text-[15px] leading-snug font-bold text-navy-700">
                {therapist.name}
              </span>
              {therapist.specialties.length > 0 ? (
                <span className="mt-0.5 block truncate text-[13px] leading-snug text-navy-400">
                  {therapist.specialties[0]}
                </span>
              ) : null}
            </span>

            {therapist.online ? (
              <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-800">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
                {t("radar.freeNow")}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
