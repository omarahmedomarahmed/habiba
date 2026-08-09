"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { WorldRadar, type RadarDot } from "@/components/radar/world-radar";
import type { RadarEntry } from "@/components/radar/public-radar";
import { formatUsd } from "@/lib/billing/plans";
import { countryName } from "@/lib/geo";
import { cn, fullName } from "@/lib/utils";

/**
 * The radar as a hero.
 *
 * Fetched on the client rather than rendered on the server, because the
 * marketing pages are ISR-cached for an hour and a radar that is an hour old is
 * a lie. The map renders immediately with no dots and fills in — the layout
 * never moves, which is the bug that made the previous live hero shove the rest
 * of the page down as it loaded.
 */
export function RadarHero() {
  const [entries, setEntries] = useState<RadarEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/radar", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        setEntries((await response.json()).therapists as RadarEntry[]);
      } catch {
        // Leave whatever was last on screen; an empty radar is not an error
        // worth shouting about on a marketing page.
        if (!cancelled) setEntries((current) => current ?? []);
      }
    };

    void load();
    const timer = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const dots: RadarDot[] = useMemo(
    () =>
      (entries ?? []).map((entry) => ({
        id: entry.userId,
        country: entry.country,
        status: entry.status,
        label: `${fullName(entry.firstName, entry.lastName, "Clinician")} · ${
          countryName(entry.country) ?? "Location not shared"
        }`,
      })),
    [entries],
  );

  const online = (entries ?? []).filter((entry) => entry.status === "online");
  const cheapest = online.reduce<number | null>(
    (low, entry) => (low === null || entry.rateCents < low ? entry.rateCents : low),
    null,
  );

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-navy-600 shadow-2xl shadow-black/30">
        {/* Fixed aspect ratio: the slot is the same size before and after data
            arrives, so nothing below it moves. */}
        <div className="aspect-[2/1]">
          <WorldRadar dots={dots} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  entries === null
                    ? "bg-slate-500"
                    : online.length > 0
                      ? "live-dot bg-teal-400"
                      : "bg-slate-500",
                )}
              />
              {entries === null
                ? "Checking who is on shift…"
                : online.length > 0
                  ? `${online.length} available right now`
                  : "Nobody on the radar this minute"}
            </p>
            {cheapest !== null ? (
              <p className="truncate text-xs text-white/50">
                From {cheapest > 0 ? formatUsd(cheapest) : "free"} for 30 minutes · no account
              </p>
            ) : (
              <p className="truncate text-xs text-white/50">
                Licensed therapists, live, no waiting list
              </p>
            )}
          </div>

          <Link
            href="/radar"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 text-sm font-semibold text-white hover:bg-teal-600"
          >
            Open radar
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
