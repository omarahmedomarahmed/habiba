"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { MapPin, Radio, X } from "lucide-react";

import { toggleClinicVisits, toggleRadar } from "@/app/(app)/on-call/actions";
import { formatUsd } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/**
 * The orb: what the radar is doing, on every page, without going to look.
 *
 * ## Why it exists next to the status pill rather than instead of it
 *
 * `StatusPill` renders only when the clinician is *active* — deliberately, it
 * is a "you are advertised right now" banner. So the one state a clinician most
 * often needs to fix, **off the radar**, was the one state nothing showed. They
 * had to navigate to `/on-call` to discover they were invisible, which is the
 * navigation the orb removes.
 *
 * The orb therefore renders in every state including offline, and the pill
 * keeps its job of shouting during a live booking. They do not overlap: the
 * pill is top-centre and transient, the orb is bottom-corner and permanent.
 *
 * ## The five states
 *
 * Straight from §4.2.3, and each one is a different question the clinician is
 * asking:
 *
 *   dim         off the radar          "am I visible?"          no
 *   teal        live, nobody looking   "am I visible?"          yes
 *   amber       someone is looking     "is anything happening?" maybe
 *   red pulsing booked and paying      "do I need to move?"     yes, now
 *   red steady  in session             "am I in a session?"     yes
 *
 * Pulsing is reserved for the one state that needs a human to move. A dot that
 * pulses in four states is decoration, and a clinician learns to ignore it —
 * which is exactly what you cannot afford in the fifth.
 */

export type OrbStatus = "offline" | "online" | "pending" | "in_session";

export function RadarOrb({
  status,
  /** True when the pending state is a real booking rather than a viewer. */
  booked,
  /**
   * Move up out of the way of the booking card.
   *
   * That card is a full-width interruption in the same corner, and a status
   * orb sitting on top of "your patient is waiting for you" is the one
   * overlap that actually costs something.
   */
  liftedForBooking,
  suspended,
  rateCents,
  chargesEnabled,
  acceptsWalkIns,
  practiceAddress,
  practiceConfirmed,
}: {
  status: OrbStatus;
  booked: boolean;
  liftedForBooking?: boolean;
  suspended: boolean;
  rateCents: number;
  chargesEnabled: boolean;
  acceptsWalkIns: boolean;
  practiceAddress: string | null;
  practiceConfirmed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [walkIns, setWalkIns] = useState(acceptsWalkIns);
  const [live, setLive] = useState(status);
  const panelRef = useRef<HTMLDivElement>(null);

  // Follow the server when it disagrees — a booking landing, or another tab.
  useEffect(() => setLive(status), [status]);
  useEffect(() => setWalkIns(acceptsWalkIns), [acceptsWalkIns]);

  // Escape closes it. A floating panel that traps a clinician mid-session is a
  // panel covering the thing they opened it to get back to.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tone = suspended
    ? "suspended"
    : live === "in_session"
      ? "session"
      : live === "pending"
        ? booked
          ? "booked"
          : "viewing"
        : live === "online"
          ? "live"
          : "off";

  const LABEL: Record<string, string> = {
    suspended: "Suspended from the radar",
    session: "In a session",
    booked: "Someone is booking you",
    viewing: "Someone is looking at your profile",
    live: "Live on the radar",
    off: "Off the radar",
  };

  const DOT: Record<string, string> = {
    suspended: "bg-red-500",
    session: "bg-red-500",
    // The only pulse in the set. See the comment above.
    booked: "live-dot bg-red-500",
    viewing: "bg-amber-400",
    live: "bg-teal-400",
    off: "bg-slate-500",
  };

  const setOnline = (next: boolean) =>
    startTransition(async () => {
      setError(null);
      const result = await toggleRadar(next);
      if (result.error) setError(result.error);
      else setLive(next ? "online" : "offline");
    });

  const setVisits = (next: boolean) =>
    startTransition(async () => {
      setError(null);
      // Optimistic, then reconciled: the toggle should feel like a switch, and
      // the server is the one that knows whether an address exists.
      setWalkIns(next);
      const result = await toggleClinicVisits(next);
      if (result.error) {
        setWalkIns(!next);
        setError(result.error);
      }
    });

  return (
    <div
      className={cn(
        "pointer-events-none fixed end-3 z-50 flex flex-col items-end gap-2 lg:end-6",
        liftedForBooking ? "bottom-52 lg:bottom-40" : "bottom-24 lg:bottom-6",
      )}
    >
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Crisis Radar"
          className="animate-fade-rise pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-navy-500/20 ring-1 ring-slate-200"
        >
          <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[tone])} />
                {LABEL[tone]}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {tone === "off"
                  ? "Nobody can find you on the map."
                  : tone === "live"
                    ? "A stranger in crisis can reach you now."
                    : tone === "viewing"
                      ? "You are showing as busy to everyone else."
                      : tone === "booked"
                        ? "Money is in flight. Open the room."
                        : tone === "session"
                          ? "You are unavailable to everyone else."
                          : "An administrator has taken you off the radar."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="tap-target -me-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="space-y-3 px-4 py-3">
            {/*
              The toggle is absent during a session and a booking rather than
              disabled. `setOnline(false)` refuses in both states — see the
              conditional UPDATE in `lib/data/radar.ts` — so offering the
              control would be offering an action that cannot succeed.
            */}
            {!suspended && (tone === "off" || tone === "live" || tone === "viewing") ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setOnline(tone === "off")}
                className={cn(
                  "tap-target flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60",
                  tone === "off"
                    ? "bg-teal-500 text-white hover:bg-teal-600"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
              >
                <Radio className="h-4 w-4" aria-hidden />
                {pending ? "Working…" : tone === "off" ? "Go on the radar" : "Go off the radar"}
              </button>
            ) : null}

            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Your session rate</dt>
                <dd className="font-medium tabular-nums text-slate-900">
                  {rateCents > 0 ? formatUsd(rateCents) : "Free"}
                </dd>
              </div>
              {rateCents > 0 && !chargesEnabled ? (
                /*
                 * Said here because this is where they set the price. Since
                 * sprint 1.8 a payment is refused outright when payouts are not
                 * set up — we no longer take the money and hold it — so a rate
                 * without Connect is a rate nobody can pay.
                 */
                <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-800">
                  Payouts are not set up, so this rate cannot be charged. Patients see you as
                  free until you finish in{" "}
                  <Link href="/settings" className="font-semibold underline">
                    Settings
                  </Link>
                  .
                </p>
              ) : null}
            </dl>

            <div className="border-t border-slate-100 pt-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={walkIns}
                  disabled={pending || !practiceConfirmed}
                  onChange={(e) => setVisits(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 disabled:opacity-50"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">
                    Accept clinic visits
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {practiceConfirmed
                      ? "Your address is shown on the map while this is on."
                      : "Add and confirm your practice address first."}
                  </span>
                </span>
              </label>

              {practiceAddress ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                  <span className="min-w-0 break-words">{practiceAddress}</span>
                </p>
              ) : null}
            </div>

            {error ? (
              /*
               * H8: one polite live region per screen, and the portal's belongs
               * to the page. A short-lived error inside a panel the clinician
               * just acted in is `assertive` so it is announced now rather than
               * queued behind whatever the page is saying.
               */
              <p role="alert" aria-live="assertive" className="text-xs text-red-600">
                {error}
              </p>
            ) : null}

            <Link
              href="/on-call"
              className="block pt-1 text-center text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Full radar settings
            </Link>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${LABEL[tone]}. Open radar controls.`}
        className={cn(
          "tap-target pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-1 transition-colors",
          tone === "off"
            ? "bg-white ring-slate-200 hover:bg-slate-50"
            : "bg-navy-500 ring-navy-500/20 hover:bg-navy-600",
        )}
      >
        <span className={cn("h-3 w-3 rounded-full", DOT[tone])} />
      </button>
    </div>
  );
}
