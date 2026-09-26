"use client";

import * as React from "react";
import { LayoutGroup, motion } from "motion/react";
import { CalendarDays, CircleUser, Globe2, ListChecks, Receipt } from "lucide-react";

import { BrowserFrame as DsBrowserFrame } from "@/app/design/_ds/frames";
import { spring } from "./motion";
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
  sos,
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
  /** Phone only: the label of the SOS orb, drawn when the screen is the patient app. */
  sos?: string;
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
        sos={sos}
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

/**
 * 🔴 THE REDESIGN'S DESK WINDOW, imported from the design system rather than
 * redrawn: `app/design/_ds/frames.tsx` is the window every portal mockup was
 * approved inside, so the website shows the product in the same glass.
 */
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
    <DsBrowserFrame url={`24therapy.app${path ?? ""}`} className={className}>
      <div className={cn("h-[20rem] bg-navy-50", bodyClassName)}>{children}</div>
    </DsBrowserFrame>
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
  sos,
}: {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  nav?: boolean;
  tabs?: NavTab[];
  activeTab?: string;
  onTab?: (key: string) => void;
  sos?: string;
}) {
  const bar: NavTab[] = tabs ?? TABS.map((t) => ({ ...t, key: t.label }));
  const pill = React.useId();
  return (
    <div
      className={cn(
        /*
         * 🔴 A PHONE HAS TO BE PHONE-SHAPED. A fixed 9:19.5 body with the
         * content scrolling inside it, in the redesign's clothes: the navy-900
         * body with its faint inner edge, the island, and the navy-50 ground
         * every patient screen is painted on (`app/design/_ds/frames.tsx`).
         */
        "mx-auto w-[300px] max-w-full shrink-0 rounded-[3rem] bg-navy-900 p-2.5 shadow-[0_40px_120px_-30px_rgba(3,11,23,0.65),inset_0_0_0_2px_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2.4rem] bg-navy-50">
        {/* The status bar: the time, the island and the indicators every phone carries. */}
        <div
          aria-hidden
          className="relative z-20 flex h-10 shrink-0 select-none items-center justify-between px-6 text-navy-700"
        >
          <span className="text-[11px] font-semibold">9:41</span>
          <span className="pointer-events-none absolute start-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-black rtl:translate-x-1/2" />
          <span className="flex items-center gap-1">
            <SignalIcon />
            <BatteryIcon />
          </span>
        </div>

        <div className={cn("no-scrollbar min-h-0 flex-1 overflow-y-auto", nav && "pb-20", bodyClassName)}>
          {children}
        </div>

        {/*
          🔴 THE SOS ORB, where the real app floats it: red, round, above the
          bar's corner, on every patient screen. Drawn, not pressable: the crisis sheet
          it opens carries real numbers, and a marketing page has no country
          to pick them by (C98).
        */}
        {sos ? (
          <span
            role="img"
            aria-label={sos}
            className="absolute end-3 bottom-[3.9rem] z-30 flex h-10 w-10 select-none items-center justify-center rounded-full bg-red-600 text-[10px] font-bold tracking-wider text-white shadow-[0_8px_20px_-6px_rgba(220,38,38,0.7)] ring-4 ring-white/80"
          >
            SOS
          </span>
        ) : null}

        {nav ? (
          /*
            The bar floats: a white card with rounded ends above the home
            indicator, the page's ground showing round it, and the redesign's
            sliding navy-50 pill under the tab you are on.
          */
          <div
            aria-hidden={onTab ? undefined : true}
            className="absolute inset-x-2 bottom-3 z-20 select-none rounded-[22px] bg-white/95 px-1.5 pt-1.5 pb-1 shadow-[0_12px_32px_-12px_rgba(10,35,66,0.35)] ring-1 ring-navy-100 backdrop-blur-xl"
          >
            <LayoutGroup id={pill}>
              <div className="flex items-end justify-around">
                {bar.map(({ key, icon: Icon, label, lifted }) => {
                  const on = activeTab === key;
                  /*
                   * 🔴 76.81 — THE LIFTED GLOBE CARRIES NO WRITTEN LABEL, as on
                   * the real bar: the string is "Find someone now" and four
                   * words do not fit under a circle in either language.
                   */
                  const body = lifted ? (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-500 text-navy-700 shadow-[0_10px_28px_-8px_rgba(46,196,182,0.8)] ring-4 ring-white">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                  ) : (
                    <>
                      {on ? (
                        <motion.span
                          layoutId="phone-tab"
                          transition={spring}
                          className="absolute inset-0 rounded-2xl bg-navy-50"
                        />
                      ) : null}
                      <Icon className="relative h-[18px] w-[18px]" aria-hidden />
                      <span className="relative max-w-[3.6rem] truncate text-[9.5px] leading-none font-semibold">
                        {label}
                      </span>
                    </>
                  );
                  const shape = cn(
                    "relative flex flex-col items-center justify-center gap-1",
                    lifted ? "-mt-6" : "h-11 min-w-0 flex-1 rounded-2xl",
                    !lifted && (on ? "text-navy-700" : "text-navy-400"),
                  );
                  return onTab ? (
                    <button
                      key={key}
                      type="button"
                      aria-current={on ? "page" : undefined}
                      aria-label={lifted ? label : undefined}
                      onClick={() => { onTab(key); }}
                      className={cn(shape, "tap-target outline-none focus-visible:ring-2 focus-visible:ring-brand-400")}
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
            </LayoutGroup>
          </div>
        ) : null}

        {/* The home indicator, under the floating bar. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-1 z-20 mx-auto h-1 w-24 rounded-full bg-navy-900/70"
        />
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
