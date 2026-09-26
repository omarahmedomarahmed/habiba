"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { LogoLoader } from "@/components/brand/logo-loader";
import { useT } from "@/lib/i18n/client";
import { NAV_DONE, NAV_START, type NavStartDetail } from "@/lib/nav-progress";

/**
 * 🔴 THE PAGE CHANGE INDICATOR, ON EVERY SCREEN. Founder, 26 September.
 *
 * "Every page click and move from one page to another happens with no
 * indicator of loading." Every page here is dynamic and reads the database, so
 * a tap on a link left the old page frozen under the finger until the new one
 * arrived, and the usual answer to a tap that did nothing is a second tap.
 *
 * Two layers, both pure CSS once they are switched on:
 *
 *   1. A thin teal bar across the top, from the click itself. Its opacity has
 *      an 80ms delay, so a navigation that is already cached finishes before
 *      a pixel of it is drawn.
 *   2. The 24T mark over the page, fading in only once the wait passes 300ms
 *      (an animation delay, not a timer), for the slow ones.
 *
 * ## Why it is switched by attribute and not by React state
 *
 * Speed. The start signal arrives inside the router's own `startTransition`
 * (`instrumentation-client.ts`), and a state update made there joins the
 * transition: React would hold the bar back until the new page was ready,
 * which is exactly when it is no longer needed. So both layers are rendered
 * once, hidden, and the handler flips a `data-` attribute on them directly.
 * The bar is on screen in the same frame as the click, with no render at all.
 *
 * It ends when the path or query it watches changes, or on an explicit done
 * signal for work that holds it (the language switch), or after fifteen seconds
 * whatever happens, so a navigation that failed quietly never leaves it running.
 *
 * Neither layer takes pointer events or space: nothing under it moves and
 * nothing is blocked.
 *
 * 🔴 THE ROOM IS EXEMPT. A session room changes its own state through the
 * router, and a veil over a live video call because a panel opened would be
 * worse than no indicator. Inside the room, nothing is drawn at all.
 */

const ROOM_PATH = /^\/(?:ar\/)?sessions\/[^/]+\/room(?:\/|$)/;
const SAFETY_MS = 15_000;
/** Finished this fast, it was never visible: take it down without a fade. */
const QUICK_MS = 150;
const FADE_MS = 340;
/** Must match the veil's animation delay in `globals.css`. */
const VEIL_MS = 300;

function inRoom(): boolean {
  return ROOM_PATH.test(window.location.pathname) || document.querySelector('[data-surface="room"]') !== null;
}

export function NavProgress() {
  const t = useT();
  const bar = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const held = useRef(false);
  const veiled = useRef(false);
  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const id of timers.current) window.clearTimeout(id);
    timers.current = [];
  };

  const set = (el: HTMLDivElement | null, name: string, value: string) => {
    if (el) el.setAttribute(name, value);
  };

  const hide = useCallback(() => {
    set(bar.current, "data-nav-progress", "idle");
    set(veil.current, "data-nav-overlay", "idle");
  }, []);

  const finish = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    held.current = false;
    clearTimers();
    const elapsed = performance.now() - startedAt.current;
    if (elapsed < QUICK_MS) {
      hide();
      return;
    }
    set(bar.current, "data-nav-progress", "done");
    /* A veil that has not begun to fade in has nothing to fade out. */
    set(veil.current, "data-nav-overlay", veiled.current || elapsed >= VEIL_MS ? "done" : "idle");
    timers.current.push(window.setTimeout(hide, FADE_MS));
  }, [hide]);

  useEffect(() => {
    const onStart = (event: Event) => {
      const detail = ((event as CustomEvent<NavStartDetail>).detail ?? {}) as NavStartDetail;
      if (inRoom()) return;
      /* A navigation inside held work (the language switch's own step) belongs to it. */
      if (active.current && held.current && !detail.hold) return;

      let samePath = false;
      if (detail.href && !detail.hold) {
        let target: URL;
        try {
          target = new URL(detail.href, window.location.href);
        } catch {
          return;
        }
        if (target.origin !== window.location.origin) return;
        /* A hash, or the page already on screen: nothing is loading. */
        if (target.pathname + target.search === window.location.pathname + window.location.search) return;
        samePath = target.pathname === window.location.pathname;
      }

      clearTimers();
      active.current = true;
      held.current = Boolean(detail.hold);
      veiled.current = Boolean(detail.veilNow);
      startedAt.current = performance.now();

      /*
        `idle` first and a forced style read, so the CSS animations start again
        from their first frame even when one navigation follows another before
        the last one's fade has finished.
      */
      hide();
      void bar.current?.offsetWidth;
      set(bar.current, "data-nav-progress", "loading");
      /* A change of query only (a tab, a filter) gets the bar and never the veil. */
      if (!samePath) set(veil.current, "data-nav-overlay", detail.veilNow ? "now" : "loading");

      timers.current.push(window.setTimeout(finish, SAFETY_MS));
    };
    const onDone = () => finish();

    window.addEventListener(NAV_START, onStart);
    window.addEventListener(NAV_DONE, onDone);
    return () => {
      window.removeEventListener(NAV_START, onStart);
      window.removeEventListener(NAV_DONE, onDone);
      clearTimers();
    };
  }, [finish, hide]);

  const onRouteChange = useCallback(() => {
    if (!held.current) finish();
  }, [finish]);

  return (
    <>
      <Suspense fallback={null}>
        <RouteWatcher onChange={onRouteChange} />
      </Suspense>
      <div
        ref={bar}
        data-nav-progress="idle"
        aria-hidden
        className="nav-bar pointer-events-none fixed inset-x-0 top-0 z-[290] h-[3px]"
      >
        <i className="nav-bar-fill" />
        <i className="nav-bar-finish" />
      </div>
      <div
        ref={veil}
        data-nav-overlay="idle"
        className="nav-veil pointer-events-none fixed inset-0 z-[289] flex items-center justify-center bg-white/75"
      >
        <LogoLoader label={t("common.loading")} />
      </div>
    </>
  );
}

/**
 * The end signal: the router committed a new path or query. Its own component
 * inside `Suspense`, because `useSearchParams` in the root layout would
 * otherwise opt every static page out of static rendering.
 */
function RouteWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onChange();
  }, [pathname, search, onChange]);

  return null;
}
