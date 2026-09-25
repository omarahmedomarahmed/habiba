import { MessageSquareQuote, Star } from "lucide-react";

import { Card } from "@/components/ui";
import { RATINGS_VISIBLE_AFTER } from "@/lib/data/feedback";
import { cn, relativeDay } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";

/*
 * 12.3 / C70 — the zone this screen prints its dates in.
 *
 * A **prop**, not `readerZone()`: this renders on the server, where the
 * browser's zone is not available and the server's own is UTC. The page passes
 * `actor.timezone`, so a clinician who has set one in Settings sees their own
 * days and one who has not is shown UTC rather than being quietly told the
 * wrong thing.
 */

/**
 * What patients said, shown to the clinician they said it about.
 *
 * The rating form tells the patient "your therapist sees this without your
 * name on it", and this is the screen that makes that true. A promise made on
 * a form and not kept anywhere in the product is worse than not making it.
 *
 * No names, no session links, no way to work out who wrote what beyond the
 * date — which for somebody with a single session that day is not much of a
 * veil, and is the honest limit of anonymity in a two-person conversation.
 * Nothing here says otherwise.
 */
export async function FeedbackCard({
  therapistAverage,
  serviceAverage,
  total,
  recent,
  zone,
}: {
  /** The reader's own zone. 12.3. */
  zone: string | null;
  therapistAverage: number;
  serviceAverage: number;
  total: number;
  recent: {
    id: string;
    stars: number;
    tags: string[];
    comment: string | null;
    createdAt: Date;
  }[];
}) {
  const { t, locale } = await getI18n();
  if (total === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">{t("radar.ratings")}</p>
        {/* 🔴 W3: this said a rating unlocks the summary; W2-P10 made the rating optional. */}
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {t("radar.ratingsEmpty", { count: RATINGS_VISIBLE_AFTER })}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-slate-900">{t("radar.ratings")}</p>
        <span className="flex items-center gap-1 text-lg font-bold text-amber-500">
          <Star className="h-4 w-4 fill-current" aria-hidden />
          {therapistAverage.toFixed(1)}
        </span>
        <span className="text-xs text-slate-600">
          {total === 1 ? t("radar.fromOne") : t("radar.fromMany", { count: total })}
        </span>
        {serviceAverage > 0 ? (
          <span className="text-xs text-slate-600">
            {t("radar.ratedUs", { score: serviceAverage.toFixed(1) })}
          </span>
        ) : null}
      </div>

      {total < RATINGS_VISIBLE_AFTER ? (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          {t("radar.notPublicYet", { count: RATINGS_VISIBLE_AFTER })}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2.5">
        {recent.slice(0, 6).map((entry) => (
          <li key={entry.id} className="border-t border-slate-100 pt-2.5 first:border-0 first:pt-0">
            <div className="flex items-center gap-2">
              <span className="flex" aria-label={t("radar.starsOf", { stars: entry.stars })}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "h-3 w-3",
                      star <= entry.stars ? "fill-amber-400 text-amber-400" : "text-slate-200",
                    )}
                    aria-hidden
                  />
                ))}
              </span>
              <span className="text-[11px] text-slate-600">{relativeDay(entry.createdAt, zone, locale, t)}</span>
            </div>

            {entry.tags.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {entry.comment ? (
              <p className="mt-1.5 flex gap-1.5 text-sm leading-relaxed text-slate-700">
                <MessageSquareQuote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />
                {entry.comment}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
