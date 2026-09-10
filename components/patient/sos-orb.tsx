"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, X } from "lucide-react";

import { CRISIS_LINES, type CrisisLine } from "@/lib/crisis/line";
import { cn } from "@/lib/utils";

/**
 * The SOS orb. PLAN.md 25.5, C125, C126.
 *
 * ## 🔴 What it is not allowed to be
 *
 * It is not a feature that needs the network, a session, or an account. A
 * person opening this is having the worst minute of their week, and everything
 * about it is built for that minute:
 *
 *   - **Plain `tel:` links.** No fetch, no server action, no analytics call in
 *     the path. It works when our API is down, which is exactly when somebody
 *     might be reaching for it.
 *   - **Never behind a modal that has to load.** The numbers are compiled into
 *     the page from `lib/crisis/line.ts`; opening the orb is a state change, not
 *     a request.
 *   - **Only numbers we have verified** (C98, C125). One entry today. We do not
 *     print a number from memory, because a crisis number that does not dial is
 *     worse than the sentence that is always true: call your local emergency
 *     number.
 *
 * ## Why it is draggable, and why it snaps
 *
 * It sits over everything, including a live session (C126), where it is the
 * case it exists for. It is also, inevitably, over the button somebody is
 * trying to press, so it can be moved and it snaps to whichever side is
 * nearer, which is where a thumb rests anyway.
 */

type Props = {
  /** The practice's own number, when a clinician has set one. Never invented. */
  practiceNumber?: string | null;
  /** Dimmed over a live session, present all the same (C126). */
  dimmed?: boolean;
};

export function SosOrb({ practiceNumber = null, dimmed = false }: Props) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"start" | "end">("end");
  const [top, setTop] = useState(0.62);
  const dragging = useRef(false);

  /* Remembered per device, so it stays where somebody put it. */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("24t_sos");
      if (stored) {
        const parsed = JSON.parse(stored) as { side?: "start" | "end"; top?: number };
        if (parsed.side) setSide(parsed.side);
        if (typeof parsed.top === "number") setTop(parsed.top);
      }
    } catch {
      /* A stored position is a convenience, never a requirement. */
    }
  }, []);

  const remember = (next: { side: "start" | "end"; top: number }) => {
    try {
      window.localStorage.setItem("24t_sos", JSON.stringify(next));
    } catch {
      /* Private mode. The orb still works, it simply forgets. */
    }
  };

  const lines: { country: string; label: string; line: CrisisLine; word: string }[] = Object.entries(
    CRISIS_LINES,
  ).map(([country, line]) => ({
    country,
    label: COUNTRY_LABEL[country] ?? country,
    line,
    word: HELP_WORD[country] ?? "Help",
  }));

  return (
    <>
      <button
        type="button"
        aria-label="Get help now"
        onPointerDown={() => {
          dragging.current = false;
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          dragging.current = true;
          const nextSide = event.clientX > window.innerWidth / 2 ? "end" : "start";
          const nextTop = Math.min(0.92, Math.max(0.08, event.clientY / window.innerHeight));
          setSide(nextSide);
          setTop(nextTop);
        }}
        onPointerUp={() => {
          if (dragging.current) remember({ side, top });
          else setOpen(true);
        }}
        style={{ top: `${top * 100}%` }}
        className={cn(
          "fixed z-[70] flex h-14 w-14 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-red-600 text-white shadow-lg",
          side === "end" ? "end-3" : "start-3",
          dimmed && !open ? "opacity-55" : "opacity-100",
        )}
      >
        <span className="text-[11px] font-bold tracking-wider">SOS</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-slate-900/60 p-3">
          <div className="rounded-3xl bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold tracking-tight text-slate-900">Help now</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                  These are phone numbers, not a chat. They connect you to a person.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="-m-2 rounded-lg p-2 text-slate-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {lines.map((entry) => (
                <a
                  key={entry.country}
                  href={`tel:${entry.line.tel}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-red-600 px-3 py-4 text-white"
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {FLAG[entry.country] ?? ""}
                  </span>
                  <span className="text-xs font-semibold">{entry.word}</span>
                  <span className="text-lg font-bold tracking-wide">{entry.line.label}</span>
                  <span className="text-[11px] opacity-80">{entry.label}</span>
                </a>
              ))}

              {practiceNumber ? (
                <a
                  href={`tel:${practiceNumber}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-900 px-3 py-4 text-white"
                >
                  <span className="text-xs font-semibold">Your practice</span>
                  <span className="text-base font-bold tracking-wide">{practiceNumber}</span>
                </a>
              ) : null}
            </div>

            {/*
              🔴 C98 / C125 — the sentence that is true everywhere, and it is
              not a footnote. We have one verified line, so for almost every
              reader this IS the answer, and printing a number we cannot vouch
              for would be worse than saying this plainly.
            */}
            <p className="mt-4 rounded-2xl bg-slate-100 px-3.5 py-3 text-sm leading-relaxed text-slate-700">
              <Phone className="me-1.5 inline h-4 w-4 align-[-2px]" aria-hidden />
              Anywhere else, call your local emergency number. It is free from any phone, and
              works with no credit and no SIM.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Names as a reader would say them, beside a flag. */
const COUNTRY_LABEL: Record<string, string> = { US: "United States" };

/** The word for help, in the language of that country. */
const HELP_WORD: Record<string, string> = { US: "Help" };

const FLAG: Record<string, string> = { US: "🇺🇸" };
