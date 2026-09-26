"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, X } from "lucide-react";

import { sosLinesFor, type SosCountry } from "@/lib/crisis/sos";
import { useLocale, useT } from "@/lib/i18n/client";
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
 *     reaches nothing. The reader's own dialling code decides, then the page's
 *     country. 🔴 W1-09: when neither places them, every enabled country's
 *     line is listed with its country's name, because nothing at all was the
 *     worse answer for an English reader with no phone.
 *
 * ## Why it is draggable, and why it snaps
 *
 * It sits over everything, including a live session (C126), where it is the
 * case it exists for. It is also, inevitably, over the button somebody is
 * trying to press, so it can be moved and it snaps to whichever side is
 * nearer, which is where a thumb rests anyway.
 *
 * 🔴 2026-09-26, the rules of the drag, each one about staying reachable:
 *
 *   - **A tap is still a tap.** Movement under `TAP_SLOP` pixels opens the
 *     sheet exactly as before; only more than that is a drag, and a drag never
 *     opens it. Enter and Space open it too: it is a real `<button>`.
 *   - **It snaps to the nearer edge**, in logical terms (`start`/`end`), so a
 *     position saved in Arabic is the same thumb position in English.
 *   - **It is always fully on screen and never over the bottom navigation.**
 *     The floor is the top of anything marked `data-bottom-nav`, measured, so
 *     it cannot be dropped under the tab bar or left there by a rotation.
 *   - **Remembered per device** in `localStorage`, every access in try/catch:
 *     private mode forgets, and the orb works the same.
 */

/** Pixels of movement below which a press is a tap, not a drag. */
const TAP_SLOP = 6;
/** Half the orb (h-14 is 56px), plus the ring and a margin. */
const HALF = 28;
const MARGIN = 12;

/**
 * The band the orb's centre may sit in, in pixels: below the top edge and
 * above the bottom navigation, whichever is higher on screen.
 */
function band(): { min: number; max: number; height: number } {
  const height = window.innerHeight;
  let floor = height;
  for (const node of document.querySelectorAll<HTMLElement>("[data-bottom-nav]")) {
    const rect = node.getBoundingClientRect();
    if (rect.height > 0 && rect.top > height / 2) floor = Math.min(floor, rect.top);
  }
  const min = HALF + MARGIN;
  const max = Math.max(min, floor - HALF - MARGIN);
  return { min, max, height };
}

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
  /**
   * 🔴 THE COUNTRY, FOR EVERY READER WHO HAS NO NUMBER ON FILE.
   *
   * `phone` was the only signal, and a GUEST HAS NO PHONE. So on the flagship
   * radar flow, on `/join/[token]`, on the payment screen, on the public
   * therapist profile and on the feedback and support pages, this component
   * rendered the generic "call your local emergency number" sentence and no
   * number at all, to an Arabic-reading Egyptian in the minute the orb exists
   * for.
   *
   * Egypt's 105 was in `CRISIS_LINES` and reachable the whole time. The
   * components simply never asked for it. Every one of those pages knows the
   * country from the session's practice, the therapist, or the locale, and now
   * passes it.
   *
   * The phone still wins when there is one: somebody's own number is a better
   * guess at where they are than the page they are looking at.
   */
  country?: string | null;
  /**
   * 🔴 W1-09: every country's line as an operator configured it, loaded by
   * the server (`SosOrbServer`, the patient chrome). Absent on a client-only
   * page such as an error boundary, where the verified table is the list.
   */
  countries?: SosCountry[] | null;
};

export function SosOrb({
  practiceNumber = null,
  dimmed = false,
  phone = null,
  country = null,
  countries = null,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"start" | "end">("end");
  /*
   * Low on the screen by default, and above the pay or join orb, which sits
   * at `bottom-24` on the same side. At 0.62 it rested on the booking form's
   * phone field on a phone (live walkthrough); at 0.82 it sat on that orb.
   */
  const [top, setTop] = useState(0.72);
  /*
   * The measured band, or null before the first client render. The server
   * render places the orb by percentage; the client clamps it into the band,
   * so a remembered position from a taller screen is never off this one.
   */
  const [limits, setLimits] = useState<{ min: number; max: number; height: number } | null>(null);
  /* Where the finger is while dragging, in viewport pixels. Null when not dragging. */
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  /* Set by a drag, read by the click that the browser fires after it. */
  const swallowClick = useRef(false);

  const measure = useCallback(() => {
    try {
      setLimits(band());
    } catch {
      /* Measuring is a nicety; the percentage position still works. */
    }
  }, []);

  useEffect(() => {
    measure();
    /* The tab bar can mount a moment after the orb, and a rotation moves both. */
    const later = window.setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(later);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* Remembered per device, so it stays where somebody put it. */
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("24t_sos");
      if (stored) {
        const parsed = JSON.parse(stored) as { side?: "start" | "end"; top?: number };
        if (parsed.side === "start" || parsed.side === "end") setSide(parsed.side);
        if (typeof parsed.top === "number" && Number.isFinite(parsed.top)) {
          setTop(Math.min(1, Math.max(0, parsed.top)));
        }
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
   * 🔴 W1-09: the reader's own line when we can place them (their number,
   * then the page's country), with the numbers that always answer beside it.
   * When we cannot, every enabled country's line, each labelled, rather than
   * nothing. `sosLinesFor` holds the rule and its tests; the sentence that is
   * true everywhere is printed under the list either way.
   */
  const lines = sosLinesFor({ phone, country, countries });

  /* The centre, in pixels, clamped into the band. */
  const clampY = (y: number, box: { min: number; max: number }) =>
    Math.min(box.max, Math.max(box.min, y));

  const restingTop = limits ? `${clampY(top * limits.height, limits)}px` : `${top * 100}%`;

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    press.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    swallowClick.current = false;
    measure();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* Capture is a nicety: without it a fast drag may drop, never break. */
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.moved) {
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < TAP_SLOP) return;
      current.moved = true;
    }
    const box = limits ?? band();
    const x = Math.min(window.innerWidth - HALF - MARGIN, Math.max(HALF + MARGIN, event.clientX));
    setDrag({ x, y: clampY(event.clientY, box) });
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = press.current;
    if (!current || current.id !== event.pointerId) return;
    press.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released. */
    }
    if (!current.moved || !drag) {
      setDrag(null);
      return;
    }

    /* A drag: snap to the nearer edge, in logical terms, and remember it. */
    swallowClick.current = true;
    const box = band();
    setLimits(box);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const right = drag.x > window.innerWidth / 2;
    const nextSide: "start" | "end" = right !== rtl ? "end" : "start";
    const nextTop = clampY(drag.y, box) / box.height;
    setSide(nextSide);
    setTop(nextTop);
    setDrag(null);
    remember({ side: nextSide, top: nextTop });
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("crisis.orbLabel")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        /*
         * 🔴 One door for every way of opening it: a tap, Enter and Space all
         * arrive as a click. The only click refused is the one a drag leaves
         * behind, so moving the orb never also opens it.
         */
        onClick={() => {
          if (swallowClick.current) {
            swallowClick.current = false;
            return;
          }
          setOpen(true);
        }}
        style={
          drag
            ? { top: `${drag.y}px`, left: `${drag.x - HALF}px`, insetInlineStart: "auto", insetInlineEnd: "auto" }
            : { top: restingTop }
        }
        className={cn(
          "fixed z-[300] flex h-14 w-14 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-red-600 text-white shadow-[0_8px_20px_-6px_rgba(220,38,38,0.7)] ring-4 ring-white/80 select-none focus-visible:outline-none focus-visible:ring-red-300",
          drag ? "cursor-grabbing" : side === "end" ? "end-3 cursor-grab" : "start-3 cursor-grab",
          dimmed && !open && !drag ? "opacity-55" : "opacity-100",
        )}
      >
        <span className="text-[11px] font-bold tracking-wider">SOS</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[310] flex flex-col justify-end bg-navy-900/55 p-3 backdrop-blur-[2px]">
          <div className="mx-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_-20px_60px_-20px_rgba(3,11,23,0.45)]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-navy-200" aria-hidden />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[24px] font-bold tracking-tight text-navy-700">{t("crisis.sheetTitle")}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-navy-500">
                  {t("crisis.sheetBody")}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={() => setOpen(false)}
                className="-m-2 rounded-full p-2 text-navy-400 hover:bg-navy-50"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className={cn("mt-4 grid gap-2.5", lines.length + (practiceNumber ? 1 : 0) > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {lines.map((entry) => (
                <a
                  key={`${entry.country}-${entry.line.tel}`}
                  href={`tel:${entry.line.tel}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-3xl bg-red-600 px-3 py-4 text-white shadow-[0_8px_20px_-8px_rgba(220,38,38,0.6)] active:scale-[0.98]"
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {flagOf(entry.country)}
                  </span>
                  <span className="text-xs font-semibold">
                    {entry.line.name
                      ? locale === "ar"
                        ? entry.line.name.ar
                        : entry.line.name.en
                      : (HELP_WORD[entry.country] ?? "Help")}
                  </span>
                  <span className="text-[26px] leading-none font-bold tracking-wide">{entry.line.label}</span>
                  <span className="text-[11px] opacity-80">
                    {countryLabel(entry.country, locale) ?? entry.countryName ?? entry.country}
                  </span>
                  {/*
                    🔴 W1-09: whether somebody is likely to answer, only where a
                    source gave the hours. Unknown hours say nothing.
                  */}
                  {entry.open !== null ? (
                    <span className="text-[11px] font-semibold">
                      {entry.line.hours === "always"
                        ? t("crisis.anyTime")
                        : entry.open
                          ? t("crisis.openNow")
                          : t("crisis.closedNow")}
                    </span>
                  ) : null}
                  {/*
                    🔴 C350 — the menu, on the button, before the call.
                    Egypt's 105 answers with a menu and the mental health
                    service is two choices in. Printed here rather than after
                    the number is dialled, because by then the reader is on a
                    phone and this screen is behind it.
                  */}
                  {entry.line.steps ? (
                    <span className="mt-0.5 text-center text-[11px] leading-snug opacity-90">
                      {locale === "ar" ? entry.line.steps.ar : entry.line.steps.en}
                    </span>
                  ) : null}
                </a>
              ))}

              {practiceNumber ? (
                <a
                  href={`tel:${practiceNumber}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-3xl bg-navy-900 px-3 py-4 text-white"
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
            <p className="mt-4 rounded-2xl bg-navy-50 px-3.5 py-3 text-sm leading-relaxed text-navy-600">
              <Phone className="me-1.5 inline h-4 w-4 align-[-2px]" aria-hidden />
              {t("crisis.anywhereElse")}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Names as a reader would say them, beside a flag, in the reader's language.
 * 🔴 Board 872: "مصر · Egypt" put an English word on the Arabic sheet; the
 * English sheet says Egypt and the Arabic one مصر.
 */
const COUNTRY_LABEL: Record<string, { en: string; ar: string }> = {
  US: { en: "United States", ar: "الولايات المتحدة" },
  EG: { en: "Egypt", ar: "مصر" },
};

function countryLabel(country: string, locale: string): string | null {
  const known = COUNTRY_LABEL[country];
  if (known) return locale === "ar" ? known.ar : known.en;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? null;
  } catch {
    return null;
  }
}

/**
 * The word for help, in the language of that country.
 *
 * 🔴 C350 — Egypt's is Arabic, not an English word with an Arabic line under
 * it. The button is for somebody dialling an Arabic menu.
 */
const HELP_WORD: Record<string, string> = { US: "Help", EG: "نجدة" };

/** A flag from the ISO code, for any country an operator configures. */
function flagOf(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}
