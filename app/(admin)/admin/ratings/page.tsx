import type { Metadata } from "next";
import { Star } from "lucide-react";

import { Card } from "@/components/ui";
import { requireRole } from "@/lib/auth/guard";
import { allRatings } from "@/lib/data/radar-admin";
import { countryFlag } from "@/lib/geo";
import { cn, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Ratings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Every rating, everywhere.
 *
 * Two scores kept apart all the way through: what patients think of the
 * clinician, and what they think of us. The second is the one nobody else will
 * ever volunteer — a patient who found the therapist excellent and the app
 * infuriating leaves five stars in one column and two in the other, and a
 * combined number would have hidden exactly the thing worth knowing.
 *
 * No patient identity on this page, and no route to one from it. The rating
 * form promises the person who wrote it stays anonymous; a promise that holds
 * for the therapist but not for whoever runs the platform is not a promise.
 */
export default async function RatingsPage() {
  await requireRole("super_admin");
  const { rows, summary } = await allRatings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ratings</h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          What patients said, without who said it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Therapists" value={summary.therapistAverage.toFixed(1)} star />
        <Stat label="24Therapy" value={summary.serviceAverage.toFixed(1)} star />
        <Stat label="Rated sessions" value={String(summary.completed)} />
        <Stat
          label="Unhappy with us"
          value={String(summary.unhappyWithUs)}
          tone={summary.unhappyWithUs > 0 ? "red" : undefined}
        />
      </div>

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <Star className="mx-auto h-6 w-6 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-900">No ratings yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Patients rate us on the way in and the session on the way out.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => {
            const tags = [...(row.therapistTags ?? []), ...(row.serviceTags ?? [])];
            return (
              <Card key={row.id} className="p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.country ? <span aria-hidden>{countryFlag(row.country)} </span> : null}
                    {[row.therapistFirst, row.therapistLast].filter(Boolean).join(" ")}
                  </p>
                  <Score label="therapist" value={row.therapistStars} />
                  <Score label="us" value={row.serviceStars} />
                  <span className="ms-auto text-[11px] text-slate-400">
                    {relativeDay(row.createdAt)}
                  </span>
                </div>

                {tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {row.comment ? (
                  <p className="mt-2 border-s-2 border-slate-200 ps-3 text-sm leading-relaxed text-slate-700 italic">
                    “{row.comment}”
                  </p>
                ) : null}

                {row.therapistStars === null ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Rated us on arrival; the session itself was never rated.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        value >= 4 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700",
      )}
    >
      <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
      {value} {label}
    </span>
  );
}

function Stat({
  label,
  value,
  star,
  tone,
}: {
  label: string;
  value: string;
  star?: boolean;
  tone?: "red";
}) {
  return (
    <Card className="px-3 py-2.5">
      <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 flex items-center gap-1 text-2xl font-bold tracking-tight tabular-nums",
          tone === "red" ? "text-red-600" : "text-slate-900",
        )}
      >
        {star ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden /> : null}
        {value}
      </p>
    </Card>
  );
}
