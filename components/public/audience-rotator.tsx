"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * One hero, four audiences. Task 137.
 *
 * ## Why this is not a carousel
 *
 * A carousel fails because the entire frame swaps, so the reader's eye is
 * reset every few seconds and they learn to either wait or leave. The fix is
 * not a smoother transition, it is to move less.
 *
 * Fixed for all four: the band, its edges, the index mark, the first clause of
 * the headline, both buttons, the device frame, the frame's chrome, the
 * frame's height and the label row. That is about seventy per cent of the
 * hero. What moves is one clause of the headline, one line of lede, and what
 * is inside the frame.
 *
 * ## The rules it obeys, and why each one is here
 *
 * **It stops on interaction and never resumes.** Hover, focus, press or touch
 * anywhere in the hero stops it for the rest of the page view. Resuming when
 * the pointer leaves is what makes a page feel like it is chasing the reader,
 * and WCAG 2.2.2 wants the control handed over once, not lent.
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
 * under the hero ever jumps. It also means a crawler and a screen reader
 * reading the whole page get all four headlines rather than one.
 *
 * ## What it cannot do, deliberately
 *
 * It does not animate per character. Character staggering is the single most
 * recognisable generated-marketing tell and it makes a headline unreadable
 * for the half second somebody is deciding whether to stay.
 */

const DWELL_MS = 6000;

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
}: {
  stem: string;
  panels: Panel[];
  cta?: { label: string; href: string };
  eyebrow: string;
}) {
  const [at, setAt] = React.useState(0);
  /*
   * One way. Nothing sets this back to false, which is the whole point: the
   * reader took control and keeps it.
   */
  const [stopped, setStopped] = React.useState(false);
  const [visible, setVisible] = React.useState(true);
  const [reduced, setReduced] = React.useState(false);
  const root = React.useRef<HTMLElement>(null);

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
      { threshold: 0.35 },
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

  const panel = panels[at];
  if (!panel) return null;

  return (
    <section
      ref={root}
      aria-roledescription="carousel"
      aria-label={eyebrow}
      onPointerEnter={stop}
      onPointerDown={stop}
      onFocusCapture={stop}
      onKeyDownCapture={stop}
      className="relative overflow-hidden bg-navy-500 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -end-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -start-32 h-96 w-96 rounded-full bg-teal-500/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-teal-300">
            [ 01 ] {eyebrow}
          </p>

          {/*
            The stem never moves. It is what tells the eye it is still inside
            the same sentence while the clause under it changes.
          */}
          <h1 className="mt-4 text-balance text-[2.1rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
            {stem}{" "}
            {/*
              🔴 All four clauses in one grid cell, so the block is as tall as
              the longest of them in whichever language is being read. A height
              that changed with the clause would make the buttons under it
              jump, which is the one movement a reader definitely notices.

              The three behind are `aria-hidden` AND `invisible`, which is two
              mechanisms for the same thing on purpose: `aria-hidden` keeps
              them out of the accessible name of this heading, and
              `visibility: hidden` keeps them out of the accessibility tree
              even if the attribute is ever dropped. Both preserve the layout,
              which `display: none` would not.

              The honest cost: the raw HTML of this `h1` contains all four
              clauses run together. A crawler that executes CSS sees only the
              visible one; a crawler that reads the markup sees the run-on.
              That is the price of locking the height without measuring text,
              and it is paid on one element rather than on the page.
            */}
            <span className="relative inline-grid align-top">
              {panels.map((one, i) => (
                <span
                  key={one.label}
                  aria-hidden={i !== at}
                  className={cn(
                    "col-start-1 row-start-1 text-teal-300 transition-[opacity,visibility] duration-200",
                    i === at
                      ? "visible opacity-100"
                      : "pointer-events-none invisible opacity-0",
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
          <div aria-live={stopped ? "polite" : "off"} className="mt-4 min-h-[3.5rem]">
            {panel.body ? (
              <p className="max-w-xl text-[17px] leading-relaxed text-white/85">{panel.body}</p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {cta ? (
              <Link href={cta.href}>
                <Button size="lg" variant="teal" full className="sm:w-auto">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-navy-600" aria-hidden />
                  {cta.label}
                </Button>
              </Link>
            ) : null}
            {panel.href && panel.hrefLabel ? (
              <Link href={panel.href}>
                <Button
                  size="lg"
                  variant="ghost"
                  full
                  className="text-white hover:bg-white/10 sm:w-auto"
                >
                  {panel.hrefLabel}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Button>
              </Link>
            ) : null}
          </div>

          {/*
            The labels, and the timer made honest. A filling rule shows how
            long you have; a dot hides it. Once stopped they are a plain
            segmented control and the active rule stays filled.
          */}
          <div role="tablist" aria-label={eyebrow} className="mt-9 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
            {panels.map((one, i) => (
              <button
                key={one.label}
                type="button"
                role="tab"
                aria-selected={i === at}
                onClick={() => {
                  stop();
                  setAt(i);
                }}
                className="group text-start"
              >
                <span
                  className={cn(
                    "block text-sm font-semibold transition-colors",
                    i === at ? "text-white" : "text-white/60 group-hover:text-white/85",
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
                    data-state={
                      i !== at ? "empty" : running ? "running" : "done"
                    }
                    className="fill-rule block h-full rounded-full bg-teal-400"
                  />
                </span>
              </button>
            ))}
          </div>
        </div>

        {/*
          🔴 THE FRAME DOES NOT MOVE, and that is why all four are mounted and
          stacked rather than one being swapped in.

          `hidden` on the inactive three would make the column's height the
          ACTIVE panel's height, so the whole band would grow and shrink every
          six seconds and everything under it would jump. Stacked in one grid
          cell, the tallest of the four sets the height once and nothing moves
          again.

          It also means all four headlines and all four screens are in the
          document, which is what a crawler and a screen reader reading the
          whole page should get.

          `inert` rather than `hidden`: the three behind must not be reachable
          by tab or readable by a screen reader, but they must still occupy
          their cell.
        */}
        <div className="relative grid min-w-0">
          {panels.map((one, i) => (
            <div
              key={one.label}
              inert={i !== at}
              aria-hidden={i !== at}
              className={cn(
                "col-start-1 row-start-1 transition-opacity duration-200",
                i === at ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              {one.demo}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
