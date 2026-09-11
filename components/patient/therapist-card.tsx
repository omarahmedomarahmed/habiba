import Link from "next/link";
import { Star } from "lucide-react";

import type { DiscoverTherapist } from "@/lib/data/discover";
import { getI18n } from "@/lib/i18n/server";

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
      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"
    >
      {therapist.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={therapist.photoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
          {therapist.name.slice(0, 1)}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-900">{therapist.name}</span>
          {therapist.online ? (
            <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
              {t("radar.freeNow")}
            </span>
          ) : null}
        </span>
        {therapist.headline ? (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-600">
            {therapist.headline}
          </span>
        ) : null}
        {/*
          🔴 A score appears only when there is one. No stars, no "new", no
          zero: an absent rating is shown by being absent.
        */}
        {therapist.rating.count > 0 ? (
          <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {therapist.rating.average} from {therapist.rating.count} sessions
          </span>
        ) : null}
      </span>
    </Link>
  );
}
