"use client";

import Link from "next/link";
import { CalendarClock, X } from "lucide-react";

import { Avatar } from "@/components/radar/therapist-card";
import type { RadarOfflineEntry } from "@/components/radar/types";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatWhen, resolveZone } from "@/lib/scheduling/tz";
import { useReaderZone } from "@/lib/scheduling/use-reader-zone";
import { fullName } from "@/lib/utils";

/**
 * 🔴 WHAT A TAP ON AN OFFLINE DOT OPENS: "Offline, book a time", and their
 * profile, where the booking calendar is.
 *
 * Not the booking sheet. The sheet is "a session, starting now", and that is
 * a promise only a live clinician can keep, so this card has no "now" in it
 * anywhere: the name, the word offline, the next open hour when they have
 * published one, and one link to `/t/[id]`.
 *
 * Fixed near the top of the screen rather than beside the dot, so it reads the
 * same on the radar page, the home page globe and the patient app, and never
 * sits under a phone's bottom sheet. Below the booking sheet's layer and far
 * below the SOS orb's.
 */
export function OfflineCard({
  entry,
  onClose,
}: {
  entry: RadarOfflineEntry;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const zone = resolveZone(useReaderZone());
  const name = fullName(entry.firstName, entry.lastName, t("radar.clinicianFallback"));

  return (
    <div
      role="dialog"
      aria-label={name}
      className="fixed inset-x-3 top-20 z-[90] mx-auto max-w-sm rounded-2xl border border-white/10 bg-[#071a2e]/95 p-3 text-white shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-start gap-3">
        <span className="opacity-80">
          <Avatar entry={entry} dark />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          {entry.credentials ? (
            <p className="truncate text-xs text-white/85">{entry.credentials}</p>
          ) : null}
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <span className="h-2 w-2 shrink-0 rounded-full border border-slate-400" aria-hidden />
            {t("radar.legendOffline")}
          </p>
          {entry.nextOpenAt ? (
            <p className="mt-1 text-xs text-white/85">
              {t("radar.nextOpen")}: {formatWhen(new Date(entry.nextOpenAt), zone, locale)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="-m-1 rounded-full p-1.5 text-white/85 hover:bg-white/10"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <Link
        href={`/t/${entry.userId}`}
        className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold text-white hover:bg-white/15"
      >
        <CalendarClock className="h-4 w-4" aria-hidden />
        {t("radar.seeTimes")}
      </Link>
    </div>
  );
}
