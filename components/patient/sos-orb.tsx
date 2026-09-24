"use client";

import { useEffect, useRef, useState } from "react";
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
   * 🔴 W1-09: the reader's own line when we can place them (their number,
   * then the page's country), with the numbers that always answer beside it.
   * When we cannot, every enabled country's line, each labelled, rather than
   * nothing. `sosLinesFor` holds the rule and its tests; the sentence that is
   * true everywhere is printed under the list either way.
   */
  const lines = sosLinesFor({ phone, country, countries });

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
          "fixed z-[300] flex h-14 w-14 -translate-y-1/2 touch-none items-center justify-center rounded-full bg-red-600 text-white shadow-lg",
          side === "end" ? "end-3" : "start-3",
          dimmed && !open ? "opacity-55" : "opacity-100",
        )}
      >
        <span className="text-[11px] font-bold tracking-wider">SOS</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[310] flex flex-col justify-end bg-slate-900/60 p-3">
          <div className="max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-4">
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
                className="-m-2 rounded-lg p-2 text-slate-500"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className={cn("mt-4 grid gap-2.5", lines.length + (practiceNumber ? 1 : 0) > 1 ? "grid-cols-2" : "grid-cols-1")}>
              {lines.map((entry) => (
                <a
                  key={`${entry.country}-${entry.line.tel}`}
                  href={`tel:${entry.line.tel}`}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-red-600 px-3 py-4 text-white"
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
                  <span className="text-lg font-bold tracking-wide">{entry.line.label}</span>
                  <span className="text-[11px] opacity-80">
                    {COUNTRY_LABEL[entry.country] ?? entry.countryName ?? entry.country}
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
const COUNTRY_LABEL: Record<string, string> = { US: "United States", EG: "مصر · Egypt" };

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
