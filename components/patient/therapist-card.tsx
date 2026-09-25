import Link from "next/link";
import { Star } from "lucide-react";

import type { DiscoverTherapist } from "@/lib/data/discover";
import { getI18n } from "@/lib/i18n/server";
import { Face } from "@/components/patient/kit";

/**
 * One clinician, in a list. PLAN.md 25.1.
 *
 * 🔴 The rating is the whole reason this is a component rather than markup
 * repeated in three places: an absent score must be shown by being absent, and
 * the way that rule dies is one of the three copies rendering a zero.
 */
export async function TherapistCard({ therapist }: { therapist: DiscoverTherapist }) {
  const { t } = await getI18n();
  return (
    <Link
      href={`/patient/t/${therapist.userId}`}
      className="flex items-start gap-3 rounded-3xl bg-white p-4 ring-1 ring-navy-100 transition-transform active:scale-[0.99]"
    >
      <Face name={therapist.name} photoUrl={therapist.photoUrl} size={52} live={therapist.online} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[16px] font-bold text-navy-700">{therapist.name}</span>
          {therapist.online ? (
            <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-800">
              {t("radar.freeNow")}
            </span>
          ) : null}
          {/*
            🔴 80.5 — BESIDE THE NAME, NEVER INSTEAD OF IT.
            These are our own accounts standing in a directory a stranger
            browses, and a stranger choosing a therapist is entitled to know
            which face is a real practice and which is us showing the product,
            before they tap rather than after. Slate rather than a warning
            colour: it is a fact about the account, not a problem with it.
          */}
          {therapist.demo ? (
            <span className="shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[12px] font-semibold text-navy-500">
              {t("radar.demoAccount")}
            </span>
          ) : null}
        </span>
        {therapist.headline ? (
          <span className="mt-0.5 line-clamp-2 block text-[13px] leading-relaxed text-navy-400">
            {therapist.headline}
          </span>
        ) : null}
        {/*
          🔴 A score appears only when there is one. No stars, no "new", no
          zero: an absent rating is shown by being absent.
        */}
        {therapist.rating.count > 0 ? (
          <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-navy-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {t("common.ratingFrom", {
              average: therapist.rating.average,
              count: therapist.rating.count,
            })}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
