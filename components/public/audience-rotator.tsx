"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { BookingSheet } from "@/components/radar/booking-sheet";
import type { RadarEntry } from "@/components/radar/types";
import { useT } from "@/lib/i18n/client";
import { cn, fullName } from "@/lib/utils";
import { viewerId } from "@/lib/viewer";

/**
 * The same globe the radar page draws, the same chunk, loaded after the fold
 * is painted. The words are readable before it arrives: it is the picture,
 * not the content, so a slow phone gets the headline first and the world
 * fades in beside it.
 */
const Globe = dynamic(() => import("@/components/radar/globe").then((m) => m.Globe), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-full bg-[radial-gradient(circle,rgba(46,196,182,0.18),transparent_62%)]" />
  ),
});

/**
 * One hero, four audiences, and the real radar beside them. Task 137, and the
 * website redesign (`app/design/website/home.tsx`).
 *
 * ## What the fold is now
 *
 * The mockup's hero: the headline on the left, the planet on the right. The
 * planet is not an illustration. It is `components/radar/globe.tsx`, fed the
 * same `/api/radar` the radar page reads, so every point on it is a clinician
 * who is on shift this minute, and pressing one opens the same booking sheet
 * the radar opens. When nobody is on shift the globe is empty and the pill
 * above the headline says so (B30): a visitor at three in the morning is never
 * promised somebody the radar does not have.
 *
 * The four audiences follow as the mockup's cards, and the four working
 * screens as its "try the product" band, one tab per audience.
 *
 * ## Why this is not a carousel
 *
 * A carousel fails because the entire frame swaps, so the reader's eye is
 * reset every few seconds and they learn to either wait or leave. The fix is
 * not a smoother transition, it is to move less.
 *
 * Fixed for all four: the band, the stem of the headline, both buttons, the
 * globe. What moves is one clause of the headline, one line of lede, and the
 * screen in the band below.
 *
 * ## The rules it obeys, and why each one is here
 *
 * **It stops on interaction and never resumes.** Hover, focus, press or touch
 * anywhere in the hero or the screens stops it for the rest of the page view.
 * Resuming when the pointer leaves is what makes a page feel like it is
 * chasing the reader, and WCAG 2.2.2 wants the control handed over once, not
 * lent.
 *
 * **It stops when it is off screen.** Somebody who scrolls down and comes back
 * should not find themselves three panels along from where they left.
 *
 * **`prefers-reduced-motion` means no rotation at all**, not a slower one. The
 * first panel, four labels, all four reachable by pressing them.
 *
 * **The timer is visible.** Four labels with a rule under each, and the active
 * one's rule fills over six seconds. That is the honest version of carousel
 * dots: a dot hides how long you have, a filling rule shows it.
 *
 * **All four panels are in the DOM**, stacked in one grid cell with the
 * inactive three made `inert`, so the tallest sets the height once and nothing
 * under it ever jumps. It also means a crawler and a screen reader reading the
 * whole page get all four headlines rather than one.
 *
 * ## What it cannot do, deliberately
 *
 * It does not animate per character. Character staggering is the single most
 * recognisable generated-marketing tell and it makes a headline unreadable
 * for the half second somebody is deciding whether to stay.
 */

const DWELL_MS = 6000;

/**
 * Availability changes in seconds, not minutes. Same cadence as the radar
 * hero and `LiveCount`, and only while the tab is visible.
 */
const REFRESH_MS = 4_000;

export type Panel = {
  label: string;
  clause: string;
  body?: string;
  href?: string;
  hrefLabel?: string;
  demo: React.ReactNode;
};

export function AudienceRotator({
  stem,
  panels,
  cta,
  eyebrow,
  live,
  demoNote,
}: {
  stem: string;
  panels: Panel[];
  cta?: { label: string; href: string };
  eyebrow: string;
  /** 🔴 B30: the real radar's count beside the invented screens, zero included. */
  live?: { checking: string; online: string; nobody: string };
  /** 🔴 B30: the screens are examples, said under them rather than left to be inferred. */
  demoNote?: string;
}) {
  const t = useT();
  const [at, setAt] = React.useState(0);
  /*
   * One way. Nothing sets this back to false, which is the whole point: the
   * reader took control and keeps it.
   */
  const [stopped, setStopped] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [reduced, setReduced] = React.useState(false);
  const root = React.useRef<HTMLElement>(null);

  /* ------------------------------------------------ the real radar -- */
  const [entries, setEntries] = React.useState<RadarEntry[] | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const viewer = viewerId();
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(`/api/radar?v=${encodeURIComponent(viewer)}`, { cache: "no-store" });
        if (!response.ok || cancelled) return;
        setEntries((await response.json()).therapists as RadarEntry[]);
      } catch {
        /* A failed poll keeps the last answer rather than inventing one. */
      }
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const online = React.useMemo(() => (entries ?? []).filter((entry) => entry.status === "online"), [entries]);
  const selected = (entries ?? []).find((entry) => entry.userId === picked) ?? null;
  const count = entries === null ? null : online.length;
  const liveText = live
    ? count === null
      ? live.checking
      : count === 0
        ? live.nobody
        : live.online.replace("{count}", String(count))
    : null;

  /* ------------------------------------------------ the rotation -- */
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => { setReduced(query.matches); };
    query.addEventListener("change", onChange);
    return () => { query.removeEventListener("change", onChange); };
  }, []);

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setVisible(entry?.isIntersecting ?? true); },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => { observer.disconnect(); };
  }, []);

  const running = !stopped && !reduced && visible && panels.length > 1;

  React.useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setAt((i) => (i + 1) % panels.length);
    }, DWELL_MS);
    return () => { window.clearTimeout(timer); };
  }, [running, at, panels.length]);

  const stop = React.useCallback(() => { setStopped(true); }, []);
  const hold = {
    onPointerEnter: stop,
    onPointerDown: stop,
    onFocusCapture: stop,
    onKeyDownCapture: stop,
  };

  const panel = panels[at];
  if (!panel) return null;

  /* The first clinician on shift, for the card beside the globe. Real, or absent. */
  const first = online[0] ?? null;

  return (
    <>
      <section
        ref={root}
        aria-roledescription="carousel"
        aria-label={eyebrow}
        {...hold}
        className="relative isolate overflow-hidden bg-navy-900 text-white"
      >
        <GridLines />
        <div
          aria-hidden
          className="pointer-events-none absolute -start-48 top-24 -z-10 h-[560px] w-[560px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-5 pb-14 pt-10 sm:px-6 sm:pt-14 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[1fr_1.05fr] lg:pb-16 lg:pt-8">
          <div className="relative z-10 min-w-0">
            {/*
              🔴 B30: the live pill is the radar's own count, not a number
              typed into a page. Zero is said as zero.
            */}
            {liveText ? (
              <p className="animate-[fade-rise_0.5s_ease-out_both] inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[14px] font-semibold text-white ring-1 ring-white/15">
                <span
                  aria-hidden
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full",
                    count ? "live-dot bg-brand-400" : "bg-white/40",
                  )}
                />
                {liveText}
              </p>
            ) : null}

            {/*
              The stem never moves. It is what tells the eye it is still inside
              the same sentence while the clause under it changes.
            */}
            <h1 className="mt-6 text-balance text-[40px] font-bold leading-[1.04] tracking-tight text-white sm:text-[60px] lg:text-[68px]">
              {stem}{" "}
              {/*
                🔴 All four clauses in one grid cell, so the block is as tall as
                the longest of them in whichever language is being read. A height
                that changed with the clause would make the buttons under it
                jump, which is the one movement a reader definitely notices.

                The three behind are `aria-hidden` AND `invisible`: `aria-hidden`
                keeps them out of the accessible name of this heading, and
                `visibility: hidden` keeps them out of the accessibility tree
                even if the attribute is ever dropped. Both preserve the layout,
                which `display: none` would not.
              */}
              <span className="relative inline-grid align-top">
                {panels.map((one, i) => (
                  <span
                    key={one.label}
                    aria-hidden={i !== at}
                    className={cn(
                      "col-start-1 row-start-1 text-brand-400 transition-[opacity,visibility,transform] duration-300",
                      i === at
                        ? "visible translate-y-0 opacity-100"
                        : "pointer-events-none invisible translate-y-2 opacity-0",
                    )}
                  >
                    {one.clause}
                  </span>
                ))}
              </span>
            </h1>

            {/*
              `aria-live` off while it is moving on its own, polite once the
              reader has taken control. Announcing a change nobody asked for is
              how a screen reader user loses their place.
            */}
            <div aria-live={stopped ? "polite" : "off"} className="mt-6 grid">
              {panels.map((one, i) =>
                one.body ? (
                  <p
                    key={one.label}
                    aria-hidden={i !== at}
                    className={cn(
                      "col-start-1 row-start-1 max-w-xl text-pretty text-[18px] leading-relaxed text-white/85 transition-opacity duration-300",
                      i === at ? "opacity-100" : "invisible opacity-0",
                    )}
                  >
                    {one.body}
                  </p>
                ) : null,
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {cta ? (
                <Link
                  href={cta.href}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand-500 px-7 text-[16px] font-semibold text-navy-700 shadow-[0_8px_24px_-8px_rgba(46,196,182,0.7)] transition-[background-color,transform] hover:-translate-y-px hover:bg-brand-400 active:scale-[0.97]"
                >
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-navy-700" aria-hidden />
                  {cta.label}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Link>
              ) : null}
              {panel.href && panel.hrefLabel ? (
                <Link
                  href={panel.href}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-7 text-[16px] font-semibold text-white backdrop-blur transition-[background-color,transform] hover:-translate-y-px hover:bg-white/15 active:scale-[0.97]"
                >
                  {panel.hrefLabel}
                </Link>
              ) : null}
            </div>

            {/*
              The labels, and the timer made honest. A filling rule shows how
              long you have; a dot hides it. Once stopped they are a plain
              segmented control and the active rule stays filled.
            */}
            <div role="tablist" aria-label={eyebrow} className="mt-10 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
              {panels.map((one, i) => (
                <button
                  key={one.label}
                  type="button"
                  role="tab"
                  aria-selected={i === at}
                  aria-controls="audience-screens"
                  onClick={() => {
                    stop();
                    setAt(i);
                  }}
                  className="group text-start outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span
                    className={cn(
                      "block text-[14px] font-semibold transition-colors",
                      i === at ? "text-white" : "text-white/70 group-hover:text-white/90",
                    )}
                  >
                    {one.label}
                  </span>
                  <span className="mt-1.5 block h-0.5 w-full overflow-hidden rounded-full bg-white/20">
                    <span
                      /*
                       * Keyed on the step so the fill restarts from zero each
                       * time. Without the key React reuses the element and the
                       * animation carries on from wherever the last one stopped.
                       */
                      key={`${i}-${at}-${running ? "run" : "hold"}`}
                      data-state={i !== at ? "empty" : running ? "running" : "done"}
                      className="fill-rule block h-full rounded-full bg-brand-400"
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/*
            🔴 THE PLANET IS THE RADAR. Every point is a clinician on shift
            now, read from `/api/radar`; pressing one opens the booking sheet
            the radar page opens. No point is drawn that the radar does not
            have.
          */}
          <div className="relative mx-auto aspect-square w-full max-w-[420px] sm:max-w-[560px] lg:-me-16 lg:max-w-[680px]">
            <Globe
              entries={entries ?? []}
              selected={null}
              onSelect={() => {}}
              onPick={(entry) => setPicked(entry.userId)}
              className="h-full w-full"
            />
            {first ? (
              <button
                type="button"
                onClick={() => setPicked(first.userId)}
                className="absolute start-0 top-[12%] z-10 hidden max-w-[16rem] animate-[fade-rise_0.6s_ease-out_both] items-center gap-3 rounded-2xl bg-white/95 p-3 pe-5 text-start shadow-2xl backdrop-blur sm:flex"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy-600 to-brand-700 text-[14px] font-bold text-white">
                  {first.firstName.slice(0, 1)}
                  {(first.lastName ?? "").slice(0, 1)}
                  <span className="absolute -bottom-0.5 -end-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-navy-700">
                    {fullName(first.firstName, first.lastName, t("radar.clinician"))}
                  </span>
                  <span className="block truncate text-[13px] text-navy-500">
                    {[t("radar.freeNow"), first.city, first.languages.slice(0, 2).join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------ the four audiences -- */}
      <section className="bg-navy-50 px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-700 rtl:tracking-normal">
            {eyebrow}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {panels.map((one, i) =>
              one.href ? (
                <Link
                  key={one.label}
                  href={one.href}
                  className={cn(
                    "group relative flex min-h-[200px] flex-col overflow-hidden rounded-[28px] p-7 transition-transform duration-300 hover:-translate-y-1.5",
                    i === 0 || i === 3 ? "bg-navy-900 text-white" : "bg-white text-navy-700 ring-1 ring-navy-100",
                  )}
                >
                  <span
                    className={cn(
                      "absolute end-6 top-6 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:rotate-45 rtl:group-hover:-rotate-45",
                      i === 0 || i === 3 ? "bg-white/10" : "bg-navy-50",
                    )}
                  >
                    <ArrowUpRight className="h-5 w-5 rtl:-scale-x-100" aria-hidden />
                  </span>
                  <span
                    className={cn(
                      "mt-auto pt-10 text-[13px] font-bold uppercase tracking-[0.16em] rtl:tracking-normal",
                      i === 0 || i === 3 ? "text-brand-300" : "text-brand-700",
                    )}
                  >
                    {one.label}
                  </span>
                  <span className="mt-2 text-[22px] font-bold leading-tight sm:text-[24px]">
                    {one.hrefLabel ?? one.clause}
                  </span>
                </Link>
              ) : null,
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------- the working screens -- */}
      <section
        id="audience-screens"
        aria-label={eyebrow}
        {...hold}
        className="relative isolate overflow-hidden bg-navy-900 px-5 py-16 text-white sm:px-6 sm:py-24"
      >
        <GridLines />
        <div
          aria-hidden
          className="pointer-events-none absolute start-1/2 top-0 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-50 blur-3xl rtl:translate-x-1/2"
          style={{ background: "radial-gradient(circle, rgba(46,196,182,0.45), rgba(46,196,182,0) 70%)" }}
        />
        <div className="mx-auto max-w-7xl">
          <div className="flex justify-center">
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {panels.map((one, i) => (
                <button
                  key={one.label}
                  type="button"
                  aria-pressed={i === at}
                  onClick={() => {
                    stop();
                    setAt(i);
                  }}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-400",
                    i === at ? "bg-brand-500 text-navy-700" : "bg-white/[0.08] text-white/85 ring-1 ring-white/15 hover:text-white",
                  )}
                >
                  {one.label}
                </button>
              ))}
            </div>
          </div>

          {/*
            🔴 THE FRAME DOES NOT MOVE, and that is why all four are mounted and
            stacked rather than one being swapped in. The tallest of the four
            sets the height once and nothing under it moves again. `inert`
            rather than `hidden`: the three behind must not be reachable by
            tab or readable by a screen reader, but they must still occupy
            their cell.
          */}
          <div className="relative mx-auto mt-10 grid min-w-0 max-w-5xl">
            {panels.map((one, i) => (
              <div
                key={one.label}
                inert={i !== at}
                aria-hidden={i !== at}
                className={cn(
                  "col-start-1 row-start-1 min-w-0 transition-opacity duration-300",
                  i === at ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                {one.demo}
              </div>
            ))}
            {demoNote ? (
              <p className="col-start-1 row-start-2 mt-4 text-center text-[13px] text-white/70">{demoNote}</p>
            ) : null}
          </div>
        </div>
      </section>

      {selected ? <BookingSheet entry={selected} onClose={() => setPicked(null)} /> : null}
    </>
  );
}

/** The mockups' faint grid on the dark band, fading out below the top. */
function GridLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)",
      }}
    />
  );
}
