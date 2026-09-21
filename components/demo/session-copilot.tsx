"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Lightbulb, Send, Sparkles } from "lucide-react";

import type { DemoContent } from "@/lib/content/demo";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * 🔴 76.70 — THE COPILOT, AS A CONVERSATION RATHER THAN A NOTICE BOARD.
 *
 * ## What was wrong with the old one
 *
 * It was a dark navy box, 13px, holding five sentences at once, and it never
 * moved. Three separate faults in one component:
 *
 *   1. **Dark.** Every other surface in the session room is dark because it is
 *      chrome around the patient's words. The copilot is something the
 *      clinician READS, mid-session, at a glance, and dark grey on navy at
 *      13px is the one thing a person will not do while somebody is talking.
 *   2. **All at once.** The real thing arrives one line at a time, when it has
 *      something to say. Five sentences stacked in a box is a list of features,
 *      not a picture of the product working.
 *   3. **One direction.** Half of what this is for is the therapist asking it
 *      about the person in front of them. A panel that only speaks is a
 *      notifier wearing an assistant's name.
 *
 * ## So: white, larger, arriving, and answerable
 *
 * Suggestions land one by one into a thread that keeps them. The newest wears a
 * ring and a tint for a few seconds and then settles, which is what "it appeared
 * during the session and I can still find it" looks like. Underneath, the
 * questions a clinician actually asks are there to press, and the answer comes
 * back with the sessions it came from attached.
 *
 * ## Every citation is real, within the demo
 *
 * The chips open the quoted line. That is the product's rule — an answer about a
 * patient names the moment it came from — and a demonstration that skipped it
 * would be advertising a behaviour the real screen refuses to have.
 *
 * ## It fetches nothing
 *
 * Same property as every other demo: props in, fixtures only, no action, no
 * route. That is what makes putting a clinical-looking surface on an anonymous
 * marketing page safe rather than alarming.
 */

type Entry =
  | { id: string; kind: "nudge"; label: string; text: string }
  | { id: string; kind: "you"; text: string }
  | { id: string; kind: "answer"; text: string; cites: Cite[] };

type Cite = { on: string; at: string; who: "therapist" | "patient"; quote: string };

/** How long a fresh arrival stays lit before it settles into the thread. */
const LIT_MS = 4500;
/** The gap between unprompted suggestions. Slow: this is a session, not a feed. */
const NUDGE_MS = 3800;
/** The pause between a question and its answer, so the answer reads as a reply. */
const THINK_MS = 900;

export function SessionCopilot({
  content,
  className,
}: {
  content?: DemoContent;
  className?: string;
}) {
  const t = useT();
  const nudges = content?.copilot ?? [];
  const asks = content?.copilotAsks ?? [];

  /*
   * 🔴 Reduced motion gets the whole thread at once, not a shorter animation.
   *
   * The motion here IS the content arriving, so there is no way to tone it
   * down: somebody who has asked their system not to animate things should see
   * the finished state immediately and still be able to press a question. The
   * value is read in an effect rather than at module scope because this
   * component is server-rendered first and `matchMedia` does not exist there.
   */
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const onChange = () => { setStill(mq.matches); };
    mq.addEventListener("change", onChange);
    return () => { mq.removeEventListener("change", onChange); };
  }, []);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [lit, setLit] = useState<string | null>(null);
  const [asked, setAsked] = useState<number[]>([]);
  const [thinking, setThinking] = useState(false);
  const [openCite, setOpenCite] = useState<string | null>(null);

  /* How many unprompted suggestions have landed. Drives the timer below. */
  const landed = useRef(0);

  useEffect(() => {
    if (still) {
      landed.current = nudges.length;
      setEntries(
        nudges.map((n, i) => ({
          id: `n${String(i)}`,
          kind: "nudge" as const,
          label: n.kind,
          text: n.text,
        })),
      );
      return;
    }

    const timer = setInterval(() => {
      const i = landed.current;
      if (i >= nudges.length) {
        clearInterval(timer);
        return;
      }
      landed.current = i + 1;
      const nudge = nudges[i];
      if (!nudge) return;
      const id = `n${String(i)}`;
      setEntries((prev) => [...prev, { id, kind: "nudge", label: nudge.kind, text: nudge.text }]);
      setLit(id);
    }, NUDGE_MS);

    return () => { clearInterval(timer); };
    // `nudges` is a fixture array rebuilt on every render of the parent, so it
    // is compared by its length rather than by identity: depending on the array
    // itself restarts the timer on every keystroke elsewhere on the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, nudges.length]);

  /* The lit entry settles on its own. One timer per arrival, cleared on change. */
  useEffect(() => {
    if (lit === null) return;
    const settle = setTimeout(() => { setLit(null); }, LIT_MS);
    return () => { clearTimeout(settle); };
  }, [lit]);

  /*
   * Follow the thread, but never yank somebody who has scrolled up to read.
   * The same `pinned` rule as the transcript panel, and for the same reason:
   * dragging a clinician back to the bottom while they are reading is a worse
   * defect than the one auto-scroll fixes.
   */
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pinned.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: still ? "instant" : "smooth" });
  }, [entries.length, thinking, still]);

  function ask(i: number) {
    const item = asks[i];
    if (!item || asked.includes(i)) return;
    setAsked((prev) => [...prev, i]);
    const qid = `q${String(i)}`;
    setEntries((prev) => [...prev, { id: qid, kind: "you", text: item.q }]);
    setLit(null);

    if (still) {
      setEntries((prev) => [
        ...prev,
        { id: `a${String(i)}`, kind: "answer", text: item.a, cites: item.cites },
      ]);
      return;
    }

    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      const id = `a${String(i)}`;
      setEntries((prev) => [...prev, { id, kind: "answer", text: item.a, cites: item.cites }]);
      setLit(id);
    }, THINK_MS);
  }

  const remaining = asks.map((_, i) => i).filter((i) => !asked.includes(i));

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-white", className)}>
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-brand-700" aria-hidden />
        <span className="text-xs font-bold tracking-wide text-slate-900 uppercase">
          {t("dcp.title")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
          <span className="text-[11px] font-medium text-slate-600">{t("dcp.inSession")}</span>
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
        }}
        aria-live="polite"
        aria-atomic="false"
        className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3.5"
      >
        {entries.length === 0 ? (
          <p className="pt-6 text-center text-sm text-slate-600">{t("dcp.quiet")}</p>
        ) : null}

        {entries.map((entry) => (
          <Bubble
            key={entry.id}
            entry={entry}
            lit={lit === entry.id}
            still={still}
            openCite={openCite}
            onCite={setOpenCite}
          />
        ))}

        {thinking ? (
          <div className="flex items-center gap-1.5 ps-1" aria-label={t("dcp.thinking")}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400"
                style={{ animationDelay: `${String(i * 160)}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/*
       * The composer. The questions are buttons rather than a text field a
       * visitor types into, because a free box on a marketing page promises an
       * answer this demo cannot give, and a box that ignores what you typed is
       * worse than no box. The field beside them is shown as what it is: the
       * real one, disabled here.
       */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
        {remaining.length > 0 ? (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {remaining.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => { ask(i); }}
                className="tap-target rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[13px] font-medium text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                {asks[i]?.q}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <input
            disabled
            aria-label={t("dcp.askLabel")}
            placeholder={
              remaining.length > 0 ? t("dcp.askOwn") : t("dcp.askAnything")
            }
            className="min-w-0 flex-1 bg-transparent text-[14px] text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
          <Send className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Bubble({
  entry,
  lit,
  still,
  openCite,
  onCite,
}: {
  entry: Entry;
  lit: boolean;
  still: boolean;
  openCite: string | null;
  onCite: (id: string | null) => void;
}) {
  const t = useT();

  if (entry.kind === "you") {
    return (
      <div className={cn("flex justify-end", !still && "animate-fade-rise")}>
        <p className="max-w-[85%] rounded-2xl rounded-ee-md bg-navy-500 px-3.5 py-2 text-[14px] leading-relaxed text-white">
          {entry.text}
        </p>
      </div>
    );
  }

  /*
   * 🔴 `lit` is a ring and a tint, never a colour swap.
   *
   * An entry that changes colour when it settles reads as two different kinds
   * of thing, and a clinician scrolling back would be trying to remember what
   * the pale ones meant. It is the same bubble throughout; the ring only says
   * "this one arrived just now".
   */
  const litRing = lit ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand-200/70" : "";

  if (entry.kind === "nudge") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-colors duration-500",
          litRing,
          !still && "animate-fade-rise",
        )}
      >
        <div className="flex items-start gap-2.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wider text-brand-800 uppercase">
              {entry.label}
            </p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-slate-900">{entry.text}</p>
          </div>
        </div>
      </div>
    );
  }

  const open = openCite?.startsWith(`${entry.id}:`) ? Number(openCite.split(":")[1]) : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white px-3.5 py-3 transition-colors duration-500",
        litRing,
        !still && "animate-fade-rise",
      )}
    >
      <p className="text-[14px] leading-relaxed text-slate-900">{entry.text}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {entry.cites.map((cite, i) => {
          const key = `${entry.id}:${String(i)}`;
          return (
            <button
              key={key}
              type="button"
              aria-expanded={open === i}
              onClick={() => { onCite(open === i ? null : key); }}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                open === i
                  ? "bg-brand-500 text-navy-600"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
            >
              <Info className="h-3 w-3" aria-hidden />
              {cite.on} · {cite.at}
            </button>
          );
        })}
      </div>

      {open !== null && entry.cites[open] ? (
        <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-bold tracking-wider text-slate-600 uppercase">
            {entry.cites[open].who === "patient" ? t("dcp.patientSaid") : t("dcp.youSaid")} ·{" "}
            {entry.cites[open].on} · {entry.cites[open].at}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-800 italic">
            “{entry.cites[open].quote}”
          </p>
        </div>
      ) : null}
    </div>
  );
}
