"use client";

import { Star } from "lucide-react";

import { Avatar, StatusPill } from "@/components/radar/therapist-card";
import type { RadarEntry } from "@/components/radar/types";
import { formatUsd } from "@/lib/billing/plans";
import { useT, useLocale } from "@/lib/i18n/client";
/*
 * 🔴 C84 / 12.3 — THE SHARED FORMATTER, NOT AN `Intl` CALL OF ITS OWN.
 *
 * This file had its own `Intl.DateTimeFormat("en-GB", …)` for the next-open time, which
 * `verify:sprint12` and `verify:sprint37l2` both refuse: a component that formats a time
 * itself is a component that will be wrong about a zone or a locale on its own schedule,
 * and there is no way to fix every one of them at once. `formatTime` is the repository's
 * one answer and it takes the zone explicitly.
 */
import { formatTime } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { cn, fullName, relativeDay } from "@/lib/utils";

/**
 * 🔴 65.6 — THE LIST VIEW, BESIDE THE MAP.
 *
 * > *The radar gets a LIST VIEW beside the map: therapists as rows, with photo, name,
 * > languages, price, next availability and a rating. The map answers "who is near me"
 * > and the list answers "who is there", and most people are asking the second question.*
 *
 * ## 🔴 WHY THIS IS NOT THE PANEL THAT WAS ALREADY THERE
 *
 * The right-hand panel is a 24rem column of cards floating over a globe. It is a
 * *legend* for the map: it exists to tell you what the dots are. Its cards truncate,
 * they carry two specialties and a `+3`, and they have no room for the one column a
 * person comparing clinicians needs most, which is when they are next free.
 *
 * This is the other question, given the whole width. Nothing is truncated, the columns
 * line up so two rows can actually be compared, and **next availability is a column**
 * rather than something you discover by opening a booking sheet one clinician at a time.
 *
 * ## 🔴 65.8 — AND IT SAYS WHEN IT DOES NOT KNOW
 *
 * A clinician who has published no hours gets *"no hours published"*, not a blank cell
 * and not a cheerful "ask them". A rating below the bar is absent rather than rounded
 * up. The price is the one they set, which is the rule `shapeBoard` already holds.
 *
 * ## 🔴 65.21 — ARABIC
 *
 * Logical properties throughout and no fixed column widths on the text side: an Arabic
 * name and an English one are different lengths and the row wraps rather than clipping.
 * The times are formatted in the reader's own zone, which arrives after mount, so the
 * cell renders the date alone until it does rather than flashing the server's UTC.
 */
export function RadarList({
  entries,
  onSelect,
}: {
  entries: RadarEntry[];
  onSelect: (entry: RadarEntry) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const zone = useReaderZone();

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.userId}>
          <button
            type="button"
            onClick={() => onSelect(entry)}
            className={cn(
              "flex w-full flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border p-3 text-start transition-colors sm:flex-nowrap",
              entry.status === "online" || entry.reservedByYou
                ? "border-white/10 bg-white/5 hover:border-teal-400/50 hover:bg-white/10"
                : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]",
            )}
          >
            <Avatar entry={entry} dark />

            {/* -------------------------------------------- who they are */}
            <span className="min-w-0 flex-1 basis-48">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {fullName(entry.firstName, entry.lastName, t("radar.clinician"))}
                </span>
                <StatusPill status={entry.status} dark mine={entry.reservedByYou} />
              </span>
              <span className="mt-0.5 block text-xs text-white/50">
                {[entry.credentials, entry.city, entry.country].filter(Boolean).join(" · ")}
              </span>
            </span>

            {/* ------------------------------------------------ languages */}
            {/*
              🔴 EVERY LANGUAGE, NOT THE FIRST TWO.

              Language is the thing that rules a clinician out hardest, which is why the
              filter panel asks it first. A card that shows two and hides the rest makes
              somebody open a profile to find out whether they can be understood.
            */}
            <span className="flex min-w-0 flex-wrap gap-1 sm:basis-40">
              {entry.languages.length > 0 ? (
                entry.languages.map((language) => (
                  <span
                    key={language}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70"
                  >
                    {language}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-white/30">{t("radar.noLanguages")}</span>
              )}
            </span>

            {/* --------------------------------------- next availability */}
            <span className="sm:basis-36">
              <span className="block text-[10px] tracking-wide text-white/35 uppercase">
                {t("radar.nextOpen")}
              </span>
              {entry.status === "online" ? (
                <span className="block text-sm font-semibold text-teal-300">
                  {t("radar.freeNow")}
                </span>
              ) : entry.nextOpenAt ? (
                <span className="block text-sm font-semibold text-white tabular-nums">
                  {relativeDay(entry.nextOpenAt, zone, locale, t)}
                  {zone ? ` · ${formatTime(new Date(entry.nextOpenAt), zone)}` : ""}
                </span>
              ) : (
                <span className="block text-sm text-white/35">{t("radar.noHours")}</span>
              )}
            </span>

            {/* --------------------------------------------------- rating */}
            <span className="sm:basis-24">
              {entry.rating ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-300">
                  <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                  {entry.rating.average.toFixed(1)}
                  <span className="text-xs font-normal text-white/40">
                    ({entry.rating.count})
                  </span>
                </span>
              ) : (
                /* 🔴 65.8 — below the bar there is no score, so there is no star. */
                <span className="text-xs text-white/30">{t("radar.noRating")}</span>
              )}
            </span>

            {/* ---------------------------------------------------- price */}
            <span className="text-end sm:basis-24">
              <span className="block text-sm font-bold text-white tabular-nums">
                {entry.sessionRateCents > 0
                  ? formatUsd(entry.sessionRateCents)
                  : t("radar.free")}
              </span>
              <span className="block text-[10px] text-white/40">{t("radar.perHalfHour")}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
