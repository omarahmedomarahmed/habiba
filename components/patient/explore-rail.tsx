import Link from "next/link";

import type { DiscoverTherapist } from "@/lib/data/discover";
import { getI18n } from "@/lib/i18n/server";

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
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {therapists.map((therapist) => (
        <li key={therapist.userId} className="w-40 shrink-0 snap-start">
          <Link
            href={`/patient/t/${therapist.userId}`}
            className="flex h-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3"
          >
            {therapist.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={therapist.photoUrl}
                alt=""
                className="h-16 w-16 rounded-2xl object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-600">
                {therapist.name.slice(0, 1)}
              </span>
            )}

            <span className="min-w-0">
              <span className="block text-sm leading-snug font-semibold text-slate-900">
                {therapist.name}
              </span>
              {therapist.specialties.length > 0 ? (
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                  {therapist.specialties[0]}
                </span>
              ) : null}
            </span>

            {therapist.online ? (
              <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                <span className="live-dot">●</span>
                {t("radar.freeNow")}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
