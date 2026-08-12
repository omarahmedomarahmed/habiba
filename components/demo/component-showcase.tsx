"use client";

import { Lightbulb } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { RiskBanner } from "@/components/clinical/risk-banner";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";

/**
 * Renders the real product component that demonstrates a given claim.
 *
 * Every one of these is the component the clinician actually uses, driven by
 * synthetic fixtures. None of them fetch anything — that is what makes putting
 * them on an anonymous page safe rather than alarming.
 */
export function ComponentShowcase({ demo }: { demo?: string }) {
  switch (demo) {
    case "transcript":
      return (
        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-navy-500 shadow-lg">
          <TranscriptPanel
            lines={DEMO_TRANSCRIPT.slice(0, 5)}
            live
            autoScroll={false}
            className="h-56"
          />
        </div>
      );

    case "note":
      return (
        <div className="no-scrollbar h-56 overflow-y-auto rounded-2xl shadow-lg">
          <NoteCard note={DEMO_NOTE} status="draft" compact patientLabel="demo" />
        </div>
      );

    case "risk":
      return (
        <div className="flex h-56 items-center">
          <RiskBanner level="high" indicators={["want to die"]} className="w-full shadow-lg" />
        </div>
      );

    case "copilot":
      return (
        <div className="flex h-56 items-center">
          <div className="w-full rounded-2xl bg-navy-500 px-4 py-4 shadow-lg">
            <div className="flex items-start gap-2.5">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" aria-hidden />
              <ul className="space-y-2">
                <li className="text-sm leading-snug text-slate-100">
                  <span className="me-1.5 text-[10px] font-bold tracking-wider text-brand-300 uppercase">
                    explore
                  </span>
                  Two of seven nights went better — worth naming that back.
                </li>
                <li className="text-sm leading-snug text-slate-100">
                  <span className="me-1.5 text-[10px] font-bold tracking-wider text-brand-300 uppercase">
                    observation
                  </span>
                  Fatigue and worry described as a loop, not two problems.
                </li>
              </ul>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
