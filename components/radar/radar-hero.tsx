"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";

import { BookingSheet } from "@/components/radar/booking-sheet";
import {
  matches,
  NO_FILTER,
  RadarFilters,
  type RadarFilter,
} from "@/components/radar/filters";
import { TherapistCard } from "@/components/radar/therapist-card";

/**
 * Same globe as the radar page, same chunk, loaded after the fold is painted.
 *
 * The hero renders and is readable before it arrives — it is the background,
 * not the content — so a slow connection gets the headline and the booking
 * board immediately and the world fades in behind them.
 */
const Globe = dynamic(
  () => import("@/components/radar/globe").then((m) => m.Globe),
  {
    ssr: false,
  },
);
import type { RadarEntry } from "@/components/radar/types";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

/** See the note on REFRESH_MS in public-radar.tsx. */
const REFRESH_MS = 4_000;

/**
 * The homepage hero *is* the radar.
 *
 * Not a card lower down the page and not a link to somewhere else: the map is
 * the background of the fold, the clinicians on it are clickable, the filters
 * are right there, and booking happens without ever leaving the page. A person
 * in crisis should not have to read a value proposition and then find a button.
 *
 * Fetched on the client because the marketing pages are ISR-cached for an hour
 * and an hour-old radar is a lie. The map renders immediately at a fixed size
 * and fills in, so nothing below it ever moves.
 */
export type RadarStrings = {
  checking: string;
  online: string;
  private: string;
  noAccount: string;
  fromPrice: string;
  free: string;
  goOnRadar: string;
  full: string;
  finding: string;
  nobody: string;
  nobodyMatching: string;
  appearWhenOnline: string;
  othersAvailable: string;
  showEveryone: string;
  /** 🔴 Safety copy. The Arabic names no US number — 988 is not dialable here. */
  notEmergency: string;
};

export function RadarHero({
  heading,
  body,
  eyebrow,
  strings,
}: {
  heading?: string;
  body?: string;
  eyebrow?: string;
  /**
   * 🔴 21R.8 / C84 — the chrome, in the reader's language, from the server.
   *
   * The heading and body have come from the CMS since sprint 18, so an Arabic
   * reader got an Arabic headline surrounded by English: "Private and
   * encrypted", "Full radar", "Finding clinicians…", and the line saying this
   * is not an emergency service — which is the one on the page that most
   * needs to be read. A client component cannot resolve them itself without
   * rendering one language on the server pass and another after hydration.
   */
  strings: RadarStrings;
}) {
  const [entries, setEntries] = useState<RadarEntry[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewer] = useState(() => viewerId());
  const [filter, setFilter] = useState<RadarFilter>(NO_FILTER);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(
          `/api/radar?v=${encodeURIComponent(viewer)}`,
          {
            cache: "no-store",
          },
        );
        if (!response.ok || cancelled) return;
        setEntries((await response.json()).therapists as RadarEntry[]);
      } catch {
        if (!cancelled) setEntries((current) => current ?? []);
      }
    };

    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [viewer]);

  const all = entries ?? [];

  const visible = useMemo(
    () => all.filter((entry) => matches(entry, filter)),
    [all, filter],
  );

  const online = all.filter((entry) => entry.status === "online");
  const bookable = visible.filter((entry) => entry.status === "online");
  const cheapest = bookable.reduce<number | null>(
    (low, entry) =>
      low === null || entry.rateCents < low ? entry.rateCents : low,
    null,
  );
  const selected = all.find((entry) => entry.userId === selectedId) ?? null;

  return (
    <section className="relative isolate overflow-hidden bg-navy-600">
      {/* The globe is the hero background, not an illustration beside it. It
          stays draggable where the copy does not cover it, and the gradients
          are what keep white text on a rotating planet legible. */}
      <div className="absolute inset-0 overflow-hidden">
        {/* A darker disc behind the sphere. Without it the globe's own ocean
            is within a few percent of the hero background and the whole thing
            reads as a faint smudge rather than a planet. */}
        <div
          className="absolute top-1/2 left-1/2 aspect-square w-[150%] -translate-y-1/2 translate-x-[-28%] rounded-full bg-[radial-gradient(circle,#04101f_38%,rgba(4,16,31,0)_66%)] sm:w-[105%] lg:w-[86%]"
          aria-hidden
        />
        <div className="absolute top-1/2 left-1/2 aspect-square w-[130%] -translate-y-1/2 translate-x-[-32%] sm:w-[92%] lg:w-[74%]">
          <Globe
            entries={visible}
            selected={filter.country || null}
            onSelect={(code) =>
              setFilter((f) => ({ ...f, country: code ?? "", region: "" }))
            }
            onPick={(entry) => setSelectedId(entry.userId)}
            className="h-full w-full"
          />
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy-600 via-navy-600/70 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-600 via-transparent to-navy-600/60"
          aria-hidden
        />
      </div>

      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-12 sm:px-6 sm:pt-16 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-300">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                online.length > 0 ? "live-dot bg-teal-400" : "bg-slate-500",
              )}
            />
            {entries === null
              ? strings.checking
              : online.length > 0
                ? strings.online.replace("{count}", String(online.length))
                : eyebrow || "Crisis Radar"}
          </span>

          <h1 className="mt-5 text-balance text-[2.1rem] leading-[1.08] font-bold tracking-tight text-white sm:text-[3.25rem]">
            {heading || "Talk to a real therapist in the next sixty seconds"}
          </h1>

          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-white/65">
            {body ||
              "Every dot is a licensed clinician who is online this minute. Pick one, tell them what to call you, and you are in a session. No account, no waiting list, no form about your insurance."}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/55">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-400" aria-hidden />
              {strings.private}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-teal-400" aria-hidden />
              {cheapest === null
                ? strings.noAccount
                : strings.fromPrice.replace(
                    "{price}",
                    cheapest > 0 ? formatUsd(cheapest) : strings.free,
                  )}
            </span>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-semibold text-navy-600 hover:bg-white/90"
            >
              {strings.goOnRadar}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/radar"
              className="inline-flex h-13 items-center justify-center rounded-2xl border border-white/20 px-5 text-base font-semibold text-white hover:bg-white/10"
            >
              {strings.full}
            </Link>
          </div>
        </div>

        {/* ------------------------------------------------- the live board */}
        <div className="rounded-3xl border border-white/10 bg-navy-500/70 p-3 backdrop-blur-md lg:sticky lg:top-20 lg:self-start">
          <div className="px-1 pb-2">
            <RadarFilters
              entries={all}
              value={filter}
              onChange={setFilter}
              tone="dark"
            />
          </div>

          <div className="max-h-[22rem] space-y-2 overflow-y-auto pe-0.5">
            {entries === null ? (
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-white/50">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {strings.finding}
              </div>
            ) : visible.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-semibold text-white">
                  {all.length === 0 ? strings.nobody : strings.nobodyMatching}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                  {all.length === 0
                    ? strings.appearWhenOnline
                    : strings.othersAvailable.replace(
                        "{count}",
                        String(online.length),
                      )}
                </p>
                {all.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilter(NO_FILTER)}
                    className="mt-3 text-sm font-semibold text-teal-300"
                  >
                    {strings.showEveryone}
                  </button>
                ) : null}
              </div>
            ) : (
              visible.map((entry) => (
                <TherapistCard
                  key={entry.userId}
                  entry={entry}
                  tone="dark"
                  onSelect={() => setSelectedId(entry.userId)}
                />
              ))
            )}
          </div>

          <p className="px-3 pt-2 pb-1 text-[11px] leading-relaxed text-white/40">
            {strings.notEmergency}
          </p>
        </div>
      </div>

      {selected ? (
        <BookingSheet entry={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </section>
  );
}
