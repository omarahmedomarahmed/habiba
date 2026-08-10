"use client";

import { ChevronRight, DoorOpen, Star } from "lucide-react";

import type { RadarEntry } from "@/components/radar/types";
import { formatUsd } from "@/lib/billing/plans";
import { cn, fullName, initials } from "@/lib/utils";

/** One clinician, on the dark hero board or the light radar page. */
export function TherapistCard({
  entry,
  tone = "light",
  onSelect,
}: {
  entry: RadarEntry;
  tone?: "light" | "dark";
  onSelect: () => void;
}) {
  const dark = tone === "dark";
  const bookable = entry.status === "online" || entry.reservedByYou;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
        dark
          ? bookable
            ? "border-white/10 bg-white/5 hover:border-teal-400/50 hover:bg-white/10"
            : "border-white/5 bg-white/[0.03]"
          : bookable
            ? "border-slate-200 bg-white hover:border-teal-400 hover:shadow-sm"
            : "border-slate-200 bg-slate-50",
      )}
    >
      <Avatar entry={entry} dark={dark} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm font-semibold",
              dark ? "text-white" : "text-slate-900",
            )}
          >
            {fullName(entry.firstName, entry.lastName, "Clinician")}
          </span>
          {entry.rating ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold",
                dark ? "text-amber-300" : "text-amber-600",
              )}
              title={`${entry.rating.average} from ${entry.rating.count} sessions`}
            >
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {entry.rating.average.toFixed(1)}
            </span>
          ) : null}
            <StatusPill status={entry.status} dark={dark} mine={entry.reservedByYou} />
        </span>

        <span className={cn("block truncate text-xs", dark ? "text-white/50" : "text-slate-500")}>
          {[entry.credentials, entry.languages.slice(0, 2).join(" · ")]
            .filter(Boolean)
            .join(" — ") || "Licensed clinician"}
        </span>

        {entry.specialties.length > 0 || entry.practice ? (
          <span className="mt-1 flex flex-wrap items-center gap-1">
            {/* Walk-ins first: it is the one thing on this card that changes
                what a patient can physically do next. */}
            {entry.practice ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  dark ? "bg-teal-400/20 text-teal-200" : "bg-teal-100 text-teal-700",
                )}
              >
                <DoorOpen className="h-2.5 w-2.5" aria-hidden />
                Walk-ins
              </span>
            ) : null}
            {entry.specialties.slice(0, 2).map((item) => (
              <span
                key={item}
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  dark ? "bg-white/10 text-white/70" : "bg-slate-100 text-slate-600",
                )}
              >
                {item}
              </span>
            ))}
            {entry.specialties.length > 2 ? (
              <span className={cn("text-[10px]", dark ? "text-white/40" : "text-slate-400")}>
                +{entry.specialties.length - 2}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-right">
        <span className={cn("block text-sm font-bold", dark ? "text-white" : "text-slate-900")}>
          {entry.rateCents > 0 ? formatUsd(entry.rateCents) : "Free"}
        </span>
        <span className={cn("block text-[10px]", dark ? "text-white/40" : "text-slate-400")}>
          30 min
        </span>
      </span>

      <ChevronRight
        className={cn("h-4 w-4 shrink-0", dark ? "text-white/30" : "text-slate-300")}
        aria-hidden
      />
    </button>
  );
}

export function Avatar({
  entry,
  dark,
  large,
}: {
  entry: RadarEntry;
  dark?: boolean;
  large?: boolean;
}) {
  const size = large ? "h-16 w-16 text-lg" : "h-11 w-11 text-xs";

  if (entry.photoUrl) {
    return (
      // Deliberately a plain <img>: the URL is clinician-supplied, and the image
      // optimiser would happily fetch arbitrary hosts on our behalf.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={entry.photoUrl}
        alt=""
        className={cn("shrink-0 rounded-2xl object-cover", size)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl font-semibold",
        dark ? "bg-white/10 text-white" : "bg-navy-500 text-white",
        size,
      )}
    >
      {initials(entry.firstName, entry.lastName ?? "")}
    </span>
  );
}

export function StatusPill({
  status,
  dark,
  mine,
}: {
  status: RadarEntry["status"];
  dark?: boolean;
  /** This visitor holds the reservation — a completely different message. */
  mine?: boolean;
}) {
  const map = {
    online: { label: "Available", light: "bg-teal-100 text-teal-800", dark: "bg-teal-400/20 text-teal-300" },
    pending: { label: "Being booked", light: "bg-amber-100 text-amber-800", dark: "bg-amber-400/20 text-amber-200" },
    in_session: { label: "In session", light: "bg-slate-200 text-slate-600", dark: "bg-white/10 text-white/50" },
  } as const;

  // "Being booked" shown to the person doing the booking is the bug this whole
  // reservation model exists to fix. Say what is actually true instead.
  const tone =
    mine && status === "pending"
      ? {
          label: "Held for you",
          light: "bg-brand-100 text-brand-800",
          dark: "bg-brand-400/20 text-brand-200",
        }
      : map[status];

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        dark ? tone.dark : tone.light,
      )}
    >
      {status === "online" || mine ? <span className="live-dot">●</span> : null} {tone.label}
    </span>
  );
}
