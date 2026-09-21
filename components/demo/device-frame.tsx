"use client";

import * as React from "react";
import { CalendarDays, CircleUser, Globe2, ListChecks, Receipt } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 🔴 76.65 — A RENDERED COMPONENT IS NOT OBVIOUSLY A SCREEN, AND THAT IS THE
 * WHOLE PROBLEM THIS SOLVES.
 *
 * Every demo on the public site renders the product's own component against
 * synthetic fixtures, which is the honest way to show software. But a note card
 * floating on a marketing page with a rounded border reads as *a card somebody
 * designed for a marketing page*. The reader has no way to tell that what they
 * are looking at is the actual interface, which is the one thing the demo exists
 * to say.
 *
 * So every demo sits inside a frame that says "this is a screen": browser chrome
 * with an address bar for the screens people use at a desk, a phone body with a
 * notch for the ones they use in a room with a patient.
 *
 * ## Why the address bar carries a path and not a brand
 *
 * `24therapy.app/sessions/live` tells the reader where in the product they are
 * standing. A frame that just says the company name is decoration; one that
 * names the route is a second piece of information for free, and it is the piece
 * that makes the screenshot legible as part of a larger thing.
 *
 * ## It is `<div>`s, not an image
 *
 * The same argument as the demos themselves (C80): a PNG of a browser window
 * starts rotting the afternoon it is made, does not respond to a narrow screen,
 * and cannot inherit the page's own colour tokens. This weighs nothing, scales,
 * and is the same navy the product paints its own chrome with.
 */

type Frame = "browser" | "phone" | "none";

export type NavTab = {
  key: string;
  label: string;
  icon: typeof Globe2;
  /** The radar, which is centred and raised because it is on the real bar. */
  lifted?: boolean;
};

export function DeviceFrame({
  as = "browser",
  path,
  nav = true,
  tabs,
  activeTab,
  onTab,
  children,
  className,
  bodyClassName,
}: {
  /** `browser` for a desk screen, `phone` for one used in the room. */
  as?: Frame;
  /** The route this screen lives at, without the host. */
  path?: string;
  /** Phone only: draw the app's bottom navigation. Off for a screen that has none. */
  nav?: boolean;
  /**
   * 🔴 76.81 — THE BAR IS A CONTROL WHEN A CALLER GIVES IT ONE TO BE.
   *
   * With `onTab` the five tabs are buttons and the active one is lit; without
   * it they are the drawn bar this frame has always had. Both shapes stay
   * because a single-screen demo has nowhere for a tab to go, and a dead button
   * is worse than a picture of a button: it invites a press and answers it with
   * nothing.
   */
  tabs?: NavTab[];
  activeTab?: string;
  onTab?: (key: string) => void;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  if (as === "none") return <>{children}</>;
  if (as === "phone") {
    return (
      <PhoneFrame
        className={className}
        bodyClassName={bodyClassName}
        nav={nav}
        tabs={tabs}
        activeTab={activeTab}
        onTab={onTab}
      >
        {children}
      </PhoneFrame>
    );
  }
  return (
    <BrowserFrame path={path} className={className} bodyClassName={bodyClassName}>
      {children}
    </BrowserFrame>
  );
}

function BrowserFrame({
  path,
  children,
  className,
  bodyClassName,
}: {
  path?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-700/60 bg-navy-600 shadow-2xl shadow-navy-900/30",
        className,
      )}
    >
      {/*
       * The chrome. `select-none` because a reader dragging across the page
       * should not end up with "24therapy.app/sessions/live" in their clipboard,
       * and `aria-hidden` because a screen reader announcing three coloured
       * circles and a URL that goes nowhere is noise in front of the content.
       */}
      <div
        aria-hidden
        className="flex select-none items-center gap-2 border-b border-slate-700/60 bg-navy-700 px-3 py-2.5"
      >
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
        </div>

        {path ? (
          <div className="ms-2 flex min-w-0 flex-1 items-center rounded-md bg-navy-800/70 px-2.5 py-1">
            <span className="truncate font-mono text-[11px] leading-none text-slate-300">
              24therapy.app{path}
            </span>
          </div>
        ) : null}
      </div>

      <div className={cn("h-[20rem] bg-white", bodyClassName)}>{children}</div>
    </div>
  );
}

/**
 * The patient app's own five tabs, drawn as the bar rather than described.
 *
 * 🔴 The globe is centred and lifted because it is centred and lifted in
 * `components/patient/bottom-nav.tsx`: the radar is the one thing on this app
 * somebody might need urgently, so it sits under the thumb. A frame that drew
 * five even tabs would be drawing a different product.
 */
type Tab = { icon: typeof Globe2; label: string; lifted?: boolean };

/**
 * The fallback bar, for a demo that shows one screen and has nowhere to go.
 * A caller that passes `tabs` replaces these with the app's real, keyed ones.
 */
const TABS: readonly Tab[] = [
  { icon: CalendarDays, label: "Sessions" },
  { icon: ListChecks, label: "Steps" },
  { icon: Globe2, label: "Talk now", lifted: true },
  { icon: Receipt, label: "Billing" },
  { icon: CircleUser, label: "You" },
];

function PhoneFrame({
  children,
  className,
  bodyClassName,
  nav = true,
  tabs,
  activeTab,
  onTab,
}: {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  nav?: boolean;
  tabs?: NavTab[];
  activeTab?: string;
  onTab?: (key: string) => void;
}) {
  const bar: NavTab[] = tabs ?? TABS.map((t) => ({ ...t, key: t.label }));
  return (
    <div
      className={cn(
        /*
         * 🔴 A PHONE HAS TO BE PHONE-SHAPED, AND THE FIRST VERSION WAS NOT.
         *
         * It was a 300px box that grew to whatever the content needed, so a
         * two-entry journal drew something roughly square and the founder's
         * word for it was "a smartwatch". A phone is read as a phone because of
         * its ASPECT, so the body is a fixed 9:19.5 and the content scrolls
         * inside it, exactly as it does on the real device.
         */
        "mx-auto w-[300px] max-w-full shrink-0 rounded-[2.75rem] border-[10px] border-navy-800 bg-navy-800 shadow-2xl shadow-navy-900/40",
        className,
      )}
    >
      <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2rem] bg-white">
        {/* The status bar: the time and the indicators every phone carries. */}
        <div
          aria-hidden
          className="relative flex h-11 shrink-0 select-none items-end justify-between bg-white px-6 pb-1"
        >
          <span className="text-[11px] font-semibold text-slate-900">9:41</span>
          {/* The notch, floating over the bar as it does on the device. */}
          <span className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-6 w-28 rounded-b-2xl bg-navy-800" />
          <span className="flex items-center gap-1 text-slate-900">
            <SignalIcon />
            <BatteryIcon />
          </span>
        </div>

        <div className={cn("no-scrollbar min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
          {children}
        </div>

        {nav ? (
          <div
            aria-hidden={onTab ? undefined : true}
            className="relative shrink-0 select-none border-t border-slate-200 bg-white/95 px-2 pt-2 pb-1"
          >
            <div className="flex items-end justify-around">
              {bar.map(({ key, icon: Icon, label, lifted }) => {
                const on = activeTab === key;
                /*
                 * 🔴 The lifted globe is brand-filled ALWAYS, and the flat tabs
                 * light only when they are the one you are on. That is what the
                 * real bar does: the radar is the thing somebody might need
                 * urgently, so it is loud whether or not you are looking at it.
                 */
                /*
                 * 🔴 76.81 — THE LIFTED GLOBE CARRIES NO WRITTEN LABEL, and
                 * that is not a space saving. `components/patient/bottom-nav.tsx`
                 * gives it an `aria-label` and nothing visible, because the
                 * string is "Find someone now" and four words do not fit under
                 * a 56px circle in either language. The first draft of this
                 * frame printed it anyway and the bar read "Find some…", which
                 * is a fifth tab labelled with a truncation.
                 */
                const body = (
                  <>
                    <span
                      className={cn(
                        "grid place-items-center",
                        lifted
                          ? "h-11 w-11 rounded-full bg-brand-500 text-navy-600 shadow-lg shadow-brand-500/30"
                          : cn("h-5 w-5", on ? "text-brand-700" : "text-slate-600"),
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {lifted ? null : (
                      <span
                        className={cn(
                          "max-w-[3.8rem] truncate text-[9px] leading-none",
                          on ? "font-semibold text-brand-700" : "text-slate-600",
                        )}
                      >
                        {label}
                      </span>
                    )}
                  </>
                );
                const shape = cn("flex flex-col items-center gap-0.5", lifted && "-mt-5");
                return onTab ? (
                  <button
                    key={key}
                    type="button"
                    aria-current={on ? "page" : undefined}
                    aria-label={lifted ? label : undefined}
                    onClick={() => { onTab(key); }}
                    className={cn(shape, "tap-target")}
                  >
                    {body}
                  </button>
                ) : (
                  <span key={key} className={shape}>
                    {body}
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {/*
         * The home indicator. Without it the content runs into the rounded
         * corner and the phone reads as cut off. It is also where the real
         * product's `safe-bottom` padding goes, so this is a thing the app
         * genuinely reserves rather than a drawn decoration.
         */}
        <div
          aria-hidden
          className="flex shrink-0 select-none items-center justify-center bg-white pt-1 pb-2"
        >
          <span className="h-1 w-28 rounded-full bg-slate-900/80" />
        </div>
      </div>
    </div>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 18 12" className="h-2.5 w-4 fill-current" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="3" width="3" height="9" rx="1" />
      <rect x="15" y="0" width="3" height="12" rx="1" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg viewBox="0 0 26 12" className="h-2.5 w-5" aria-hidden>
      <rect x="0.5" y="0.5" width="21" height="11" rx="3" className="fill-none stroke-current" strokeOpacity="0.4" />
      <rect x="2" y="2" width="16" height="8" rx="1.5" className="fill-current" />
      <rect x="23" y="4" width="2" height="4" rx="1" className="fill-current" fillOpacity="0.4" />
    </svg>
  );
}

/**
 * Which frame a given demo belongs in.
 *
 * 🔴 The split is not cosmetic and it is not about screen size: it is about
 * where the person using that screen is standing. A clinician reads a note and
 * a transcript at a desk after a session; a patient opens the radar on a phone
 * in the moment they need somebody, and a therapist starts a recording on a
 * phone with a patient in the room. Drawing the radar in a browser window would
 * quietly misdescribe the product.
 */
const PHONE: ReadonlySet<string> = new Set(["session-room"]);

/**
 * 🔴 76.81 — THE DEMOS THAT BRING THEIR OWN FRAME.
 *
 * `PatientApp` draws the phone itself, because the bar at the bottom of that
 * phone is its navigation rather than chrome around it — a component that took
 * a frame from its caller could not light the tab you are standing on. So the
 * showcase must NOT wrap these again: `frameFor` returning `phone` for `radar`
 * put a phone inside a phone, which is the one arrangement that reads as a bug
 * rather than as a screen.
 */
const SELF_FRAMED: ReadonlySet<string> = new Set([
  "radar",
  "patient-app",
  "homework",
  "patient-sessions",
  "journal",
  "summary",
]);

/**
 * 🔴 SOME SCREENS DO NOT FIT IN 320 PIXELS AND SAYING SO IS NOT A COMPROMISE.
 *
 * The standard body height suits a note or a list. The copilot carries a
 * header, a growing thread and a composer, and at 20rem the thread itself got
 * about 130 pixels — one and a half messages, in a component whose whole point
 * is that entries ACCUMULATE. A demo that clips the thing being demonstrated
 * argues against the product. These get a taller body; the grid still lines up
 * because a row is sized by its tallest tile either way.
 */
const TALL: ReadonlySet<string> = new Set(["copilot", "transcript", "note"]);

const PATHS: Readonly<Record<string, string>> = {
  transcript: "/sessions/live",
  note: "/sessions/note",
  risk: "/radar",
  copilot: "/copilot",
  profile: "/patients",
  "session-room": "/sessions/live",
};

export function frameFor(demo?: string): { as: Frame; path?: string; bodyClassName?: string } {
  if (!demo || demo === "none") return { as: "none" };
  if (SELF_FRAMED.has(demo)) return { as: "none" };
  if (PHONE.has(demo)) return { as: "phone" };
  return {
    as: "browser",
    path: PATHS[demo],
    bodyClassName: TALL.has(demo) ? "h-[30rem]" : undefined,
  };
}
