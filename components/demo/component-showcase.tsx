"use client";

import { Lightbulb } from "lucide-react";

import { NoteCard } from "@/components/clinical/note-card";
import { RiskBanner } from "@/components/clinical/risk-banner";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import { PatientSessionList } from "@/components/patient/session-list";
import type { DemoContent } from "@/lib/content/demo";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";

/**
 * Renders the real product component that demonstrates a given claim.
 *
 * Every one of these is the component the clinician actually uses, driven by
 * synthetic fixtures. None of them fetch anything — that is what makes putting
 * them on an anonymous page safe rather than alarming.
 */
export function ComponentShowcase({ demo, content }: { demo?: string; content?: DemoContent }) {
  switch (demo) {
    case "transcript":
      return (
        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-navy-500 shadow-lg">
          <TranscriptPanel
            lines={content?.transcript ?? DEMO_TRANSCRIPT.slice(0, 5)}
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
                  Two of seven nights went better, worth naming that back.
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

    /*
     * 18.9 — the patient's own app, which is the half of this product nobody
     * evaluating it has ever seen. The real component from sprint 15, against
     * demo rows: it has no field that *could* hold a clinical sentence, which
     * is the point being demonstrated as well as the safety property.
     */
    case "patient-sessions":
      return (
        <div className="no-scrollbar h-56 overflow-y-auto rounded-2xl bg-slate-50 p-3 shadow-lg">
          <PatientSessionList
            zone="UTC"
            sessions={(content?.patientSessions ?? []).map((row, i) => ({
              id: `demo-${i}`,
              // 47.4 — the demo's invented rows say nothing was recorded,
              // which is the honest default and the safest thing to show a
              // stranger on a marketing page.
              provenance: null,
              group: i === 0 ? "today" : "past_scheduled",
              at: new Date(Date.UTC(2026, 2, 12 + (i === 0 ? 1 : -6), 18, 0)),
              therapistName: row.therapist,
              modality: "video",
              priceCents: 0,
              paymentStatus: "not_required",
              brief: row.brief,
              briefPending: false,
            }))}
          />
        </div>
      );

    case "homework":
      return (
        <div className="no-scrollbar h-56 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 shadow-lg">
          {(content?.homework ?? []).map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      );

    /*
     * The rolling profile, shown as what it is: dated observations, each one
     * traceable to the session it came from. Never a paragraph of AI prose
     * about somebody — that is the thing sprint 9 refused to build.
     */
    case "profile":
      return (
        <ul className="no-scrollbar h-56 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 shadow-lg">
            {(content?.observations ?? []).map((row) => (
              <li key={row.at} className="border-s-2 border-brand-200 ps-3">
                <p className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
                  {row.at}
                </p>
                <p className="text-sm leading-snug text-slate-700">{row.text}</p>
              </li>
            ))}
        </ul>
      );

    /*
     * 🔴 28.6 — the portability argument, shown rather than asserted.
     *
     * Two versions with two different clinicians' names on them. That is the
     * whole claim of this product to a patient, and a paragraph saying "your
     * record follows you" is worth less than the picture of it having done so.
     * Invented people, a real layout.
     */
    case "summary":
      return (
        <ul className="no-scrollbar h-56 space-y-2.5 overflow-y-auto rounded-2xl bg-white p-3 shadow-lg">
          {(content?.summaryVersions ?? []).map((version) => (
            <li key={version.version} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <p className="text-sm font-semibold text-slate-900">{version.author}</p>
                <p className="text-[11px] text-slate-400">
                  Version {version.version}
                  {version.on ? ` · ${version.on}` : ""}
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{version.body}</p>
            </li>
          ))}
        </ul>
      );

    /*
     * The journal, and note what is NOT drawn beside it: no shield, no "your
     * therapist is reading this", no reassurance. C123 governs the real screen
     * and it governs the picture of the screen, because a demonstration that
     * promises a watch is the same false promise in a smaller frame.
     */
    case "journal":
      return (
        <ul className="no-scrollbar h-56 space-y-2.5 overflow-y-auto rounded-2xl bg-slate-50 p-3 shadow-lg">
          {(content?.journalEntries ?? []).map((entry) => (
            <li key={entry.on} className="rounded-xl bg-white p-3">
              <p className="text-[11px] text-slate-400">{entry.on}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.text}</p>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
}
