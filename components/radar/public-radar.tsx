"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { BookingSheet } from "@/components/radar/booking-sheet";
import { RadarFilters } from "@/components/radar/filters";
import { TherapistCard } from "@/components/radar/therapist-card";
import { WorldRadar, type RadarDot } from "@/components/radar/world-radar";
import type { RadarEntry } from "@/components/radar/types";
import { Card } from "@/components/ui";
import { countryName } from "@/lib/geo";
import { cn, fullName } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

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
 * languages, what they work with, their rate and their country. No patient data
 * touches this component and no authenticated call is made — a person in crisis
 * gets a list and a button, not a signup form.
 *
 * The list refreshes on a timer because availability changes underneath it. A
 * stale radar sends someone to a clinician who is already with another patient,
 * which for this audience is not a minor inconvenience.
 */
export function PublicRadar({ initial }: { initial: RadarEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [specialty, setSpecialty] = useState("");
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
    () =>
      entries.filter(
        (entry) =>
          (!language || entry.languages.includes(language)) &&
          (!specialty || entry.specialties.includes(specialty)),
      ),
    [entries, language, specialty],
  );

  const dots: RadarDot[] = useMemo(
    () =>
      visible.map((entry) => ({
        id: entry.userId,
        country: entry.country,
        status: entry.status,
        label: `${fullName(entry.firstName, entry.lastName, "Clinician")} · ${
          countryName(entry.country) ?? "Location not shared"
        }`,
      })),
    [visible],
  );

  // Always the unfiltered count. "Nobody available" when four people are online
  // and you have simply picked a narrow filter is a lie that sends someone away.
  const onlineCount = entries.filter((entry) => entry.status === "online").length;
  const selected = entries.find((entry) => entry.userId === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl bg-navy-500">
        <div className="aspect-[2/1] sm:aspect-[5/2]">
          <WorldRadar dots={dots} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-navy-500 to-transparent px-4 py-3">
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
            Tap a dot or a card
          </p>
        </div>
      </div>

      {entries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <RadarFilters
            entries={entries}
            language={language}
            specialty={specialty}
            onLanguage={setLanguage}
            onSpecialty={setSpecialty}
          />
          <span className="ml-auto text-xs text-slate-500">
            {visible.length} of {entries.length}
          </span>
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
            onClick={() => {
              setLanguage("");
              setSpecialty("");
            }}
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
