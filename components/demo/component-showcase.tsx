"use client";

import * as React from "react";

import { NoteCard } from "@/components/clinical/note-card";
import { RiskBanner } from "@/components/clinical/risk-banner";
import { TranscriptPanel } from "@/components/clinical/transcript-panel";
import { PatientSessionList } from "@/components/patient/session-list";
import type { DemoContent } from "@/lib/content/demo";
import { DEMO_NOTE, DEMO_TRANSCRIPT } from "./fixtures";

/**
 * 🔴 76.66 — ONE HEIGHT, BECAUSE A GRID ROW THAT STEPS READS AS BROKEN.
 *
 * Each case used to size itself: `h-56` on the scrolling ones, `items-center`
 * on the short ones, nothing on the rest. In a two-column grid that produced
 * three different heights down the page and up to 40% dead white inside a frame,
 * which is the look of an empty screen rather than a busy one.
 *
 * Every desk demo is now this tall and its content fills it. Short content gets
 * the room; long content scrolls and is faded at the cut by `Scroller` below, so
 * the clip reads as "there is more" instead of "this is severed".
 */
const H = "h-full";
import { DeviceFrame, frameFor } from "./device-frame";
import { SessionCopilot } from "./session-copilot";

/**
 * Renders the real product component that demonstrates a given claim.
 *
 * Every one of these is the component the clinician actually uses, driven by
 * synthetic fixtures. None of them fetch anything — that is what makes putting
 * them on an anonymous page safe rather than alarming.
 */
function DemoSurface({ demo, content }: { demo?: string; content?: DemoContent }) {
  switch (demo) {
    case "transcript":
      return (
        <div className="overflow-hidden bg-navy-500">
          <TranscriptPanel
            lines={content?.transcript ?? DEMO_TRANSCRIPT.slice(0, 5)}
            live
            autoScroll={false}
            className="h-full"
          />
        </div>
      );

    /*
     * 🔴 76.32 — THE NOTE COMES FROM `content` NOW, like everything else here.
     *
     * It read the English constant directly, so the Arabic homepage rendered
     * an Arabic conversation and then produced an English note out of it. The
     * fixture stays as the floor for a caller that has no content, which is
     * the same two-job arrangement every other case on this switch has.
     */
    case "note":
      return (
        <Scroller className="bg-white">
          <NoteCard note={content?.note ?? DEMO_NOTE} status="draft" compact patientLabel="demo" />
        </Scroller>
      );

    case "risk":
      return (
        <div className={`${H} bg-slate-50 p-3`}>
          <RiskBanner
            level="high"
            indicators={[content?.riskIndicator ?? "want to die"]}
            className="w-full"
          />
        </div>
      );

    /*
     * 🔴 76.70 — THE REAL THING, not a list of the things it might say.
     *
     * This used to be a dark navy box holding all five suggestions at once at
     * 13px, which demonstrated neither of the two facts that matter: that they
     * arrive one at a time during the session, and that a clinician can ask it
     * back. `SessionCopilot` does both, and it is white because it is the one
     * surface in that room a person reads rather than glances at.
     */
    case "copilot":
      return <SessionCopilot content={content} />;

    /*
     * 18.9 — the patient's own app, which is the half of this product nobody
     * evaluating it has ever seen. The real component from sprint 15, against
     * demo rows: it has no field that *could* hold a clinical sentence, which
     * is the point being demonstrated as well as the safety property.
     */
    case "patient-sessions":
      return (
        <Scroller className="bg-slate-50 p-3">
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
              priceCurrency: "egp",
              paymentStatus: "not_required",
              brief: row.brief,
              briefPending: false,
            }))}
          />
        </Scroller>
      );

    case "homework":
      return (
        <Scroller className="space-y-2 bg-white p-3">
          {(content?.homework ?? []).map((item) => (
            <div key={item.title} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
            </div>
          ))}
        </Scroller>
      );

    /*
     * The rolling profile, shown as what it is: dated observations, each one
     * traceable to the session it came from. Never a paragraph of AI prose
     * about somebody — that is the thing sprint 9 refused to build.
     */
    case "profile":
      return (
        <Scroller as="ul" className="space-y-2 bg-white p-3">
            {(content?.observations ?? []).map((row) => (
              <li key={row.at} className="border-s-2 border-brand-200 ps-3">
                <p className="text-[11px] font-semibold tracking-wide text-brand-600 uppercase">
                  {row.at}
                </p>
                <p className="text-sm leading-snug text-slate-700">{row.text}</p>
              </li>
            ))}
        </Scroller>
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
        <Scroller as="ul" className="space-y-2.5 bg-white p-3">
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
        </Scroller>
      );

    /*
     * The journal, and note what is NOT drawn beside it: no shield, no "your
     * therapist is reading this", no reassurance. C123 governs the real screen
     * and it governs the picture of the screen, because a demonstration that
     * promises a watch is the same false promise in a smaller frame.
     */
    case "journal":
      return (
        <Scroller as="ul" className="space-y-2.5 bg-slate-50 p-3">
          {(content?.journalEntries ?? []).map((entry) => (
            <li key={entry.on} className="rounded-xl bg-white p-3">
              <p className="text-[11px] text-slate-400">{entry.on}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.text}</p>
            </li>
          ))}
        </Scroller>
      );

    default:
      return null;
  }
}

/**
 * 🔴 76.65 — EVERY DEMO IS FRAMED AS A SCREEN.
 *
 * `DemoSurface` above draws the product's own component. This wraps it in the
 * browser or phone chrome that tells the reader what they are looking at, and it
 * is the only export, so there is no way to put an unframed demo on a page: the
 * frame is not a decoration a caller opts into, it is part of what a demo IS.
 *
 * `frameFor` decides which chrome from the demo's own name, so a page author
 * choosing `radar` gets a phone without knowing that is the rule.
 */
export function ComponentShowcase({ demo, content }: { demo?: string; content?: DemoContent }) {
  const body = <DemoSurface demo={demo} content={content} />;
  const { as, path, bodyClassName } = frameFor(demo);
  if (as === "none") return body;
  return (
    <DeviceFrame as={as} path={path} bodyClassName={bodyClassName}>
      {body}
    </DeviceFrame>
  );
}

/**
 * A demo's viewport: the canonical height, hidden scrollbars, and a fade at the
 * bottom so a clipped list reads as "there is more below" rather than as text
 * that has been cut in half. Without the fade a transcript ends mid-word and the
 * frame looks broken, which was the first thing anybody noticed about it.
 */
function Scroller({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "ul";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full">
      <Tag className={`no-scrollbar h-full overflow-y-auto ${className ?? ""}`}>{children}</Tag>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent"
      />
    </div>
  );
}
