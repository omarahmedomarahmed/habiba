import * as React from "react";

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

export function DeviceFrame({
  as = "browser",
  path,
  children,
  className,
  bodyClassName,
}: {
  /** `browser` for a desk screen, `phone` for one used in the room. */
  as?: Frame;
  /** The route this screen lives at, without the host. */
  path?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  if (as === "none") return <>{children}</>;
  if (as === "phone") {
    return (
      <PhoneFrame className={className} bodyClassName={bodyClassName}>
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
            <span className="truncate font-mono text-[11px] leading-none text-slate-400">
              24therapy.app{path}
            </span>
          </div>
        ) : null}
      </div>

      <div className={cn("bg-white", bodyClassName)}>{children}</div>
    </div>
  );
}

function PhoneFrame({
  children,
  className,
  bodyClassName,
}: {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        /*
         * A phone is narrow, and the point of drawing one is that the reader
         * sees the constraint the product is designed for. Letting it stretch to
         * the width of a desktop column would draw a phone the size of a
         * television, which says the opposite.
         */
        "mx-auto w-full max-w-[300px] rounded-[2.25rem] border-[6px] border-navy-700 bg-navy-700 shadow-2xl shadow-navy-900/30",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.8rem] bg-white">
        {/* The notch, and the status strip it sits in. */}
        <div
          aria-hidden
          className="relative flex h-7 select-none items-center justify-center bg-navy-600"
        >
          <span className="h-4 w-20 rounded-b-xl bg-navy-700" />
        </div>

        <div className={cn("bg-white", bodyClassName)}>{children}</div>

        {/*
         * 🔴 The home indicator, and it is not decoration.
         *
         * Without it the content runs into the rounded bottom corner and the
         * phone reads as cut off rather than as a phone. It is also where the
         * real product's `safe-bottom` padding goes, so drawing it is drawing
         * something the app genuinely reserves.
         */}
        <div
          aria-hidden
          className="flex select-none items-center justify-center bg-white pt-1.5 pb-2"
        >
          <span className="h-1 w-24 rounded-full bg-slate-300" />
        </div>
      </div>
    </div>
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
const PHONE: ReadonlySet<string> = new Set([
  "radar",
  "session-room",
  "journal",
  "homework",
  "patient-sessions",
]);

const PATHS: Readonly<Record<string, string>> = {
  transcript: "/sessions/live",
  note: "/sessions/note",
  risk: "/radar",
  copilot: "/copilot",
  summary: "/records/summary",
  profile: "/patients",
  "patient-sessions": "/patient/sessions",
  homework: "/patient/homework",
  journal: "/patient/journal",
  radar: "/radar",
  "session-room": "/sessions/live",
};

export function frameFor(demo?: string): { as: Frame; path?: string } {
  if (!demo || demo === "none") return { as: "none" };
  if (PHONE.has(demo)) return { as: "phone" };
  return { as: "browser", path: PATHS[demo] };
}
