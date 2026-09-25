"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Globe2, Languages, MapPin, Star } from "lucide-react";

import { BookingSheet } from "@/components/radar/booking-sheet";
import type { RadarEntry } from "@/components/radar/types";
import { countryFlag } from "@/lib/geo";
import { cn, fullName, initials } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";
import { useT } from "@/lib/i18n/client";
import { Money } from "@/components/ui/money";

export type ProfileEntry = Omit<RadarEntry, "status"> & {
  status: RadarEntry["status"] | "offline";
  bio: string | null;
};

/**
 * A clinician's own page, shareable and live.
 *
 * The radar answers "who is free right now". This answers "is *this* person
 * free right now", which is a different promise and the reason the page exists:
 * it is a link a clinician puts in a bio, and a link that only works while its
 * owner happens to be logged in is not a link anybody can put anywhere.
 *
 * So it renders offline too, and says so plainly rather than hiding the button.
 * The availability line is the live part — it re-reads every five seconds, so a
 * page left open on a phone becomes correct again the moment they come on
 * shift, without anybody refreshing anything.
 */
const REFRESH_MS = 5_000;

export function PublicProfile({ initial }: { initial: ProfileEntry }) {
  const t = useT();
  const [profile, setProfile] = useState(initial);
  const [booking, setBooking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewer] = useState(() => viewerId());

  useEffect(() => setProfile(initial), [initial]);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(
          `/api/radar/profile/${profile.userId}?v=${encodeURIComponent(viewer)}`,
          { cache: "no-store" },
        );
        if (response.ok) setProfile((await response.json()).profile as ProfileEntry);
      } catch {
        // A failed poll leaves the last known state on screen.
      }
    };
    const timer = setInterval(tick, REFRESH_MS);
    return () => clearInterval(timer);
  }, [profile.userId, viewer]);

  const name = fullName(profile.firstName, profile.lastName, t("radar.clinicianFallback"));
  const bookable = profile.status === "online";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard refused — the URL bar still has it. */
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-start gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy-500 text-lg font-bold text-white">
          {initials(profile.firstName, profile.lastName)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{name}</h1>
          {profile.credentials ? (
            <p className="mt-0.5 text-sm text-slate-600">{profile.credentials}</p>
          ) : null}
          {profile.rating ? (
            <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-amber-600">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
              {profile.rating.average.toFixed(1)}
              <span className="font-normal text-slate-600">
                {t(profile.rating.count === 1 ? "radar.fromRatedOne" : "radar.fromRated", { count: profile.rating.count })}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {/* --------------------------------------------------------- live state */}
      <AvailabilityLine status={profile.status} />

      {profile.headline ? (
        <p className="mt-5 text-[15px] leading-relaxed text-slate-700">{profile.headline}</p>
      ) : null}
      {profile.bio ? (
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{profile.bio}</p>
      ) : null}

      <dl className="mt-6 space-y-2.5">
        {profile.languages.length > 0 ? (
          <Row icon={Languages} label={t("radar.speaks")} value={profile.languages.join(", ")} />
        ) : null}
        {profile.specialties.length > 0 ? (
          <Row icon={Check} label={t("radar.worksWith")} value={profile.specialties.join(", ")} />
        ) : null}
        {profile.city || profile.country ? (
          <Row
            icon={Globe2}
            label={t("radar.basedIn")}
            value={`${[profile.city, profile.region].filter(Boolean).join(", ")}${
              profile.country ? ` ${countryFlag(profile.country)}` : ""
            }`}
          />
        ) : null}
        {profile.practice ? (
          <Row
            icon={MapPin}
            label={t("radar.walkIns")}
            value={`${profile.practice.name ?? t("radar.practiceFallback")}, ${profile.practice.address}`}
          />
        ) : null}
      </dl>

      {/* ------------------------------------------------------------- price */}
      <div className="mt-6 flex items-center justify-between rounded-2xl bg-navy-500 px-4 py-3.5 text-white">
        <span className="text-sm">{t("radar.thirtyMinutes")}</span>
        <span className="text-xl font-bold">
          {/* Pounds in the app, dollars on the website, the other on hover (27). */}
          {profile.sessionRateCents > 0 ? <Money cents={profile.sessionRateCents} /> : t("radar.freeTitle")}
        </span>
      </div>

      <button
        type="button"
        disabled={!bookable}
        onClick={() => setBooking(true)}
        className={cn(
          "mt-3 flex h-13 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold transition-colors",
          bookable
            ? "bg-teal-500 text-navy-600 hover:bg-teal-400"
            : "cursor-not-allowed bg-slate-100 text-slate-600",
        )}
      >
        {bookable
          ? t("tprofile.start")
          : profile.status === "offline"
            ? t("tprofile.offShift")
            : t("tprofile.busy")}
      </button>

      {!bookable ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-slate-600">
          {t("tprofile.updates", { name: profile.firstName })}
        </p>
      ) : null}

      <button
        type="button"
        onClick={copyLink}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        {copied ? <Check className="h-4 w-4 text-teal-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? t("tprofile.copied") : t("tprofile.copy")}
      </button>

      {booking ? (
        <BookingSheet
          entry={{ ...profile, status: "online" } as RadarEntry}
          onClose={() => setBooking(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * The one line on this page that has to be right every second.
 *
 * "Being booked" is deliberately distinct from "in session": one of them will
 * probably clear in under a minute and the other will not, and somebody
 * deciding whether to wait needs to know which.
 */
function AvailabilityLine({ status }: { status: ProfileEntry["status"] }) {
  const t = useT();
  /*
   * 🔴 A STATUS WE DO NOT KNOW MUST NOT TAKE THE PAGE DOWN.
   *
   * This indexed the map and read `map.tone` straight off the result. Any
   * status outside the four gave `undefined`, and the next line threw. Two
   * clinicians on production sat at `available` — a string a raw seed INSERT
   * put into a plain `text` column — and `/t/[id]` and `/patient/t/[id]`
   * returned 500 nine times across six visitors.
   *
   * Worse than it sounds, because of how `reachable()` works: a stale
   * heartbeat forces the row to read `offline`, which IS in the map, so the
   * page worked while they were away and broke the moment they were online.
   * The profile failed exactly when somebody could have booked them.
   *
   * 0112 makes the column refuse the bad value. This makes the page survive
   * one anyway, because a public profile is the last place that should be a
   * stack trace.
   */
  const OFF = { dot: "bg-slate-300", text: t("tprofile.statusOff"), tone: "text-slate-600 bg-slate-100" };
  const map =
    {
      online: { dot: "bg-teal-500 live-dot", text: t("tprofile.statusOn"), tone: "text-teal-700 bg-teal-50" },
      pending: { dot: "bg-amber-500", text: t("tprofile.statusPending"), tone: "text-amber-700 bg-amber-50" },
      in_session: { dot: "bg-slate-400", text: t("tprofile.statusInSession"), tone: "text-slate-600 bg-slate-100" },
      offline: OFF,
    }[status] ?? OFF;

  return (
    <p
      className={cn(
        "mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold",
        map.tone,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", map.dot)} />
      {map.text}
    </p>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Languages;
  label: string;
  value: string;
}) {
  const t = useT();
  return (
    <div className="flex gap-3">
      <dt className="flex w-28 shrink-0 items-center gap-1.5 text-sm text-slate-600">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-800">{value}</dd>
    </div>
  );
}
