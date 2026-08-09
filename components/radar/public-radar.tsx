"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { BookingSheet } from "@/components/radar/booking-sheet";
import { matches, NO_FILTER, RadarFilters, type RadarFilter } from "@/components/radar/filters";
import { TherapistCard } from "@/components/radar/therapist-card";
import type { RadarEntry } from "@/components/radar/types";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

/**
 * The globe is a separate chunk, loaded after the page is interactive.
 *
 * Its country outlines are 40 kB gzipped — worth every byte on this page and
 * not worth one of them anywhere else. `ssr: false` because it measures itself
 * and animates from the first frame; rendering it on the server would ship a
 * static hemisphere that immediately gets replaced.
 */
const Globe = dynamic(() => import("@/components/radar/globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-teal-400/60" aria-hidden />
    </div>
  ),
});

/**
 * Availability changes in seconds, not minutes.
 *
 * Four seconds is the difference between "this clinician is free" and sending
 * someone in distress to a profile that is already busy. It is cheap: the
 * endpoint is one indexed query, and the per-network read limit is set with
 * this cadence in mind.
 */
const REFRESH_MS = 4_000;

export type { RadarEntry };

/**
 * The full radar board.
 *
 * Everything here is the clinician's own published profile: name, credentials,
 * languages, what they work with, their rate and where they practise. No
 * patient data touches this component and no authenticated call is made — a
 * person in crisis gets a globe, a list and a button, not a signup form.
 */
export function PublicRadar({ initial }: { initial: RadarEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RadarFilter>(NO_FILTER);
  const [refreshing, setRefreshing] = useState(false);
  const [viewer] = useState(() => viewerId());

  useEffect(() => setEntries(initial), [initial]);

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      setRefreshing(true);
      try {
        const response = await fetch(`/api/radar?v=${encodeURIComponent(viewer)}`, {
          cache: "no-store",
        });
        if (response.ok) setEntries((await response.json()).therapists as RadarEntry[]);
      } catch {
        // A failed refresh leaves the last good list on screen.
      } finally {
        setRefreshing(false);
      }
    };
    const timer = setInterval(tick, REFRESH_MS);
    return () => clearInterval(timer);
  }, [viewer]);

  const visible = useMemo(
    () => entries.filter((entry) => matches(entry, filter)),
    [entries, filter],
  );

  // Always the unfiltered count. "Nobody available" when four people are online
  // and you have simply picked a narrow filter is a lie that sends someone away.
  const onlineCount = entries.filter((entry) => entry.status === "online").length;
  const selected = entries.find((entry) => entry.userId === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-[#04101f]">
        {/* Square on a phone, wider on a desktop — the globe is centred either
            way, so the extra width is atmosphere rather than dead space. */}
        <div className="aspect-square sm:aspect-[16/10]">
          <Globe
            entries={visible}
            selected={filter.country || null}
            onSelect={(code) => setFilter((f) => ({ ...f, country: code ?? "", region: "" }))}
            onPick={(entry) => setSelectedId(entry.userId)}
            className="h-full w-full"
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[#04101f] via-[#04101f]/70 to-transparent px-4 pt-10 pb-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                onlineCount > 0 ? "live-dot bg-teal-400" : "bg-slate-500",
              )}
            />
            {onlineCount > 0
              ? `${onlineCount} ${onlineCount === 1 ? "therapist" : "therapists"} available now`
              : "No one on the radar this minute"}
          </p>
          <p className="hidden items-center gap-1.5 text-xs text-white/50 sm:flex">
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
            Drag to spin · tap a country
          </p>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-2">
          <RadarFilters entries={entries} value={filter} onChange={setFilter} />
          <p className="text-xs text-slate-500">
            Showing {visible.length} of {entries.length}
          </p>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">Nobody is on the radar yet</p>
          <p className="mt-1.5 text-sm text-slate-600">
            Clinicians appear here the moment they go online. If you need help right now, call or
            text 988.
          </p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">Nobody matching that is on shift</p>
          <p className="mt-1.5 text-sm text-slate-600">
            {onlineCount} other {onlineCount === 1 ? "clinician is" : "clinicians are"} available
            right now.
          </p>
          <button
            type="button"
            onClick={() => setFilter(NO_FILTER)}
            className="mt-3 text-sm font-semibold text-brand-600"
          >
            Show everyone
          </button>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((entry) => (
            <li key={entry.userId}>
              <TherapistCard entry={entry} onSelect={() => setSelectedId(entry.userId)} />
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <BookingSheet entry={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
