"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MicOff, Pause, Play, RotateCcw, ShieldAlert } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { RiskBanner } from "@/components/clinical/risk-banner";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import type { DemoContent } from "@/lib/content/demo";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";

/**
 * 🔴 76.85 — THE THREE CLINICAL DEMOS, WITH THEIR OWN CONTROLS ON THEM.
 *
 * ## The rule this file exists to satisfy
 *
 * *Make every single mockup interactive.* Not as a flourish: each of these
 * three demos was making a claim that a still frame cannot make, and in each
 * case the missing half was a CONTROL the real product has.
 *
 *   - The transcript claimed it runs live. A frozen list of five lines is a
 *     picture of a finished transcript, which is what a competitor's
 *     screenshot also looks like. And it hid the control that matters most to
 *     a clinician, which is the one that STOPS it.
 *   - The note claimed it is "a draft with your name on it until you approve
 *     it". The demo rendered the draft and nothing else, so the sentence
 *     doing the reassuring was unaccompanied by the thing it describes.
 *   - The risk banner claimed it is "a prompt for your attention rather than a
 *     safety net". A banner you cannot dismiss is a safety net. The real one
 *     dismisses, and the demonstration has to as well or it is advertising a
 *     product that nags.
 *
 * ## Everything here is still the real component
 *
 * `TranscriptPanel`, `NoteCard` and `RiskBanner` are imported from
 * `components/clinical/`, which is where the portal gets them. What this file
 * adds is the state the portal keeps around them, so the claim and the picture
 * are the same object. Fixtures only; no action, no route, no fetch.
 */

const TICK_MS = 2000;

/**
 * The transcript, arriving, with the off-record switch beside it.
 *
 * 🔴 Off the record is not a pause button with a nicer name. It is the one
 * thing in this product a clinician reaches for when a patient says "can you
 * stop recording", and it is the reason the panel takes a `paused` prop at all.
 * A demo without it shows software that listens and never stops.
 */
export function TranscriptDemo({ content }: { content?: DemoContent }) {
  const t = useT();
  const lines = content?.transcript ?? DEMO_TRANSCRIPT;

  const [visible, setVisible] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [offRecord, setOffRecord] = useState(false);
  const [still, setStill] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setStill(true);
      setVisible(lines.length);
      return;
    }
    setVisible(1);
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!playing || still || offRecord) return;
    timer.current = setInterval(() => {
      setVisible((n) => (n >= lines.length ? n : n + 1));
    }, TICK_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, still, offRecord, lines.length]);

  const done = visible >= lines.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-navy-500">
      <TranscriptPanel
        lines={lines.slice(0, visible)}
        live={!offRecord}
        paused={offRecord}
        autoScroll={!still}
        className="min-h-0 flex-1"
      />

      <div className="flex shrink-0 items-center gap-2 border-t border-slate-800/60 bg-navy-600/70 px-3 py-2.5">
        {!still ? (
          <button
            type="button"
            onClick={() => {
              if (done) {
                setVisible(1);
                setOffRecord(false);
                setPlaying(true);
              } else {
                setPlaying((p) => !p);
              }
            }}
            className="tap-target flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-slate-200 hover:bg-white/5"
          >
            {done ? (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            ) : playing ? (
              <Pause className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Play className="h-3.5 w-3.5" aria-hidden />
            )}
            {done ? t("hdemo.replay") : playing ? t("hdemo.pause") : t("hdemo.play")}
          </button>
        ) : null}

        <button
          type="button"
          aria-pressed={offRecord}
          onClick={() => { setOffRecord((v) => !v); }}
          className={cn(
            "tap-target ms-auto flex items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold",
            offRecord
              ? "border-amber-400/40 bg-amber-400/20 text-amber-100"
              : "border-white/15 text-slate-200 hover:bg-white/5",
          )}
        >
          <MicOff className="h-3.5 w-3.5" aria-hidden />
          {offRecord ? t("dclin.recordingOff") : t("dclin.goOffRecord")}
        </button>
      </div>
    </div>
  );
}

/**
 * The note, and the approval that makes it a note rather than a suggestion.
 *
 * 🔴 `status` is the real prop and the card draws the real difference: a draft
 * is marked as one everywhere it appears. The button here is what turns it, and
 * it is the last thing that happens to every note in this product.
 */
export function NoteDemo({ content }: { content?: DemoContent }) {
  const t = useT();
  const [approved, setApproved] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <NoteCard
          note={content?.note ?? DEMO_NOTE}
          status={approved ? "approved" : "draft"}
          compact
          patientLabel="demo"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-200 bg-slate-50 px-3.5 py-3">
        {approved ? (
          <>
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] font-medium text-brand-800">
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              {t("dclin.approved")}
            </p>
            <button
              type="button"
              onClick={() => { setApproved(false); }}
              className="tap-target shrink-0 rounded-lg px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-200"
            >
              {t("dclin.backToDraft")}
            </button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-700">
              {t("dclin.draftUntil")}
            </p>
            <button
              type="button"
              onClick={() => { setApproved(true); }}
              className="tap-target shrink-0 rounded-xl bg-brand-500 px-3.5 text-[12px] font-semibold text-navy-600 hover:bg-brand-400"
            >
              {t("dclin.approve")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The risk banner, and the fact that it goes away.
 *
 * 🔴 C98 — no phone number is drawn here. The real banner takes the crisis line
 * for the READER's country and renders a sentence when there is none, and a
 * marketing page has no country in hand. A demo that invented one would be
 * putting a number on the page that reaches nothing from Cairo.
 */
export function RiskDemo({ content }: { content?: DemoContent }) {
  const t = useT();
  const [shown, setShown] = useState(true);

  return (
    <div className="flex h-full flex-col justify-center gap-3 bg-slate-50 p-3.5">
      {shown ? (
        <RiskBanner
          level="high"
          indicators={[content?.riskIndicator ?? "want to die"]}
          onDismiss={() => { setShown(false); }}
          className="w-full animate-fade-rise"
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <ShieldAlert className="mx-auto h-5 w-5 text-slate-600" aria-hidden />
          <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
            {t("dclin.dismissedBody")}
          </p>
          <button
            type="button"
            onClick={() => { setShown(true); }}
            className="tap-target mt-2 rounded-xl bg-slate-900 px-3.5 text-[12px] font-semibold text-white"
          >
            {t("dclin.raiseAgain")}
          </button>
        </div>
      )}
    </div>
  );
}
