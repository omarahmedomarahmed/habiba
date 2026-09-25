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
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

/**
 * Availability changes in seconds, not minutes: four is the difference between
 * "this clinician is free" and sending someone to a profile already busy. The
 * endpoint is one indexed query and its read limit is set with this cadence in
 * mind. Same figure as `radar-console.tsx`.
 */
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
      low === null || entry.sessionRateCents < low ? entry.sessionRateCents : low,
    null,
  );
  const selected = all.find((entry) => entry.userId === selectedId) ?? null;
  /* The sentence around the figure, so the figure itself can be a `Money`. */
  const [fromBefore = "", fromAfter = ""] = strings.fromPrice.split("{price}");

  return (
    <section className="relative isolate overflow-hidden bg-navy-900">
      {/* The globe is the hero background, not an illustration beside it. It
          stays draggable where the copy does not cover it, and the gradients
          are what keep white text on a rotating planet legible. */}
      <div className="absolute inset-0 overflow-hidden">
        {/* A darker disc behind the sphere. Without it the globe's own ocean
            is within a few percent of the hero background and the whole thing
            reads as a faint smudge rather than a planet. */}
        <div
          className="absolute top-1/2 left-1/2 aspect-square w-[150%] -translate-y-1/2 translate-x-[-28%] rtl:translate-x-[-72%] rounded-full bg-[radial-gradient(circle,#04101f_38%,rgba(4,16,31,0)_66%)] sm:w-[105%] lg:w-[86%]"
          aria-hidden
        />
        <div className="absolute top-1/2 left-1/2 aspect-square w-[130%] -translate-y-1/2 translate-x-[-32%] rtl:translate-x-[-68%] sm:w-[92%] lg:w-[74%]">
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
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy-900 via-navy-900/70 to-transparent rtl:bg-gradient-to-l"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-900 via-transparent to-navy-900/60"
          aria-hidden
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 pt-12 pb-14 sm:px-6 sm:pt-20 sm:pb-24 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-12">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[14px] font-semibold text-white ring-1 ring-white/15">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                online.length > 0 ? "live-dot bg-teal-400" : "bg-white/40",
              )}
            />
            {entries === null
              ? strings.checking
              : online.length > 0
                ? strings.online.replace("{count}", String(online.length))
                : eyebrow}
          </span>

          <h1 className="mt-6 text-balance text-[40px] leading-[1.04] font-bold tracking-tight text-white sm:text-[60px] lg:text-[68px]">
            {heading}
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-[18px] leading-relaxed text-white/85">
            {body}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-400" aria-hidden />
              {strings.private}
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-teal-400" aria-hidden />
              {/*
                Through `Money`, as the cards below are: a bare dollar string here
                read "From $40" above cards reading pounds for the same person.
              */}
              {cheapest === null ? (
                strings.noAccount
              ) : (
                <span>
                  {fromBefore}
                  {cheapest > 0 ? <Money cents={cheapest} /> : strings.free}
                  {fromAfter}
                </span>
              )}
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-teal-500 px-7 text-[16px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] transition-[background-color,transform] hover:-translate-y-px hover:bg-teal-400"
            >
              {strings.goOnRadar}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
            <Link
              href="/radar"
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-7 text-[16px] font-semibold text-white backdrop-blur transition-[background-color,transform] hover:-translate-y-px hover:bg-white/15"
            >
              {strings.full}
            </Link>
          </div>
        </div>

        {/* ------------------------------------------------- the live board */}
        <div className="rounded-[28px] bg-white/[0.06] p-3 ring-1 ring-white/10 backdrop-blur-md lg:self-center">
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
              <div className="flex h-32 items-center justify-center gap-2 text-sm text-white/85">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {strings.finding}
              </div>
            ) : visible.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-semibold text-white">
                  {all.length === 0 ? strings.nobody : strings.nobodyMatching}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/85">
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

          <p className="px-3 pt-2 pb-1 text-[11px] leading-relaxed text-white/85">
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
