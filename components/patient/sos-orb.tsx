"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, X } from "lucide-react";

import { countryForNumber, lineForNumber, type CrisisLine } from "@/lib/crisis/line";
import { useT } from "@/lib/i18n/client";
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
 *   - 🔴 **Only the READER's number** (C184, 37R.25). Verified is not enough:
 *     a verified line for another country is a button that looks like help and
 *     reaches nothing. The reader's own dialling code decides, and when it
 *     decides nothing the sentence above is the whole answer.
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
  /**
   * 🔴 37R.25 / C184 — the reader's own number, which is the only thing here
   * that says which country's line to print.
   *
   * Until the walkthrough this component rendered every entry in
   * `CRISIS_LINES`, and with one entry in that table it printed a large red
   * `988 · United States` to a patient whose number starts `+20`. In the
   * minute this orb exists for, the wrong country's number is worse than no
   * number: it looks like help and reaches nothing.
   */
  phone?: string | null;
};

export function SosOrb({ practiceNumber = null, dimmed = false, phone = null }: Props) {
  const t = useT();
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

  /*
   * 🔴 One line, for this reader, or none. Never the whole table.
   *
   * `lineForNumber` refuses unless the number's dialling code leaves exactly
   * one verified line, so a `+20` number gets null and falls through to the
   * sentence that is true everywhere. The list rendered here is therefore at
   * most one entry long, and it exists as a list only because a second
   * verified country will slot into it without this component changing.
   */
  const mine = lineForNumber(phone);
  const mineCountry = countryForNumber(phone);
  const lines: { country: string; label: string; line: CrisisLine; word: string }[] =
    mine && mineCountry
      ? [
          {
            country: mineCountry,
            label: COUNTRY_LABEL[mineCountry] ?? mineCountry,
            line: mine,
            word: HELP_WORD[mineCountry] ?? "Help",
          },
        ]
      : [];

  return (
    <>
      <button
        type="button"
        aria-label={t("crisis.orbLabel")}
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
                <p className="text-base font-bold tracking-tight text-slate-900">{t("crisis.sheetTitle")}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                  {t("crisis.sheetBody")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
                className="-m-2 rounded-lg p-2 text-slate-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className={cn("mt-4 grid gap-2.5", lines.length + (practiceNumber ? 1 : 0) > 1 ? "grid-cols-2" : "grid-cols-1")}>
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
                  <span className="text-xs font-semibold">{t("crisis.yourPractice")}</span>
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
              {t("crisis.anywhereElse")}
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
