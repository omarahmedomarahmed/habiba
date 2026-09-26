"use client";

import * as React from "react";

import type { DemoContent } from "@/lib/content/demo";

import { NoteDemo, RiskDemo, TranscriptDemo } from "./clinical-demo";
import { DeviceFrame, frameFor } from "./device-frame";
import { PatientApp } from "./patient-app";
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
    /*
     * 🔴 76.85 — THE THREE CLINICAL DEMOS CARRY THEIR OWN CONTROLS.
     *
     * Each was a still frame of a component whose claim is about something
     * HAPPENING: a transcript arriving and being stopped, a draft becoming a
     * note, an alert that can be dismissed because it is a prompt rather than
     * a safety net. See `clinical-demo.tsx` for why each control is the real
     * one rather than a demo flourish.
     */
    case "transcript":
      return <TranscriptDemo content={content} />;

    case "note":
      return <NoteDemo content={content} />;

    case "risk":
      return <RiskDemo content={content} />;

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
    /*
     * 🔴 76.81 — THE PATIENT'S SCREENS ARE THE PATIENT'S APP NOW.
     *
     * Each of these used to be one screen under a drawn, dead bottom bar, so a
     * reader could see the app HAD a Sessions tab and never find out what was
     * on it. They render the same component opened on their own tab: five real
     * tabs, the screen's name at the top where the app puts it, and the radar's
     * booking flow live. A page asking for `homework` still gets the homework
     * screen; it just gets it inside something a person can move around in.
     */
    case "patient-sessions":
      return <PatientApp content={content} initial="sessions" />;

    /*
     * 🔴 `open`, not `initial`. Steps stopped being a tab when Option A put
     * Therapists on the bar; it is a screen hanging off Home now, in the app
     * and here. A page asking for `homework` still gets the homework screen,
     * with a working bar under it that says where it actually lives.
     */
    case "homework":
      return <PatientApp content={content} open="steps" />;

    case "radar":
      return <PatientApp content={content} initial="radar" />;

    /*
     * The app itself opens where the app opens: home, on the navy header card,
     * with the radar one press away on the lifted globe.
     */
    case "patient-app":
      return <PatientApp content={content} initial="home" />;

    /*
     * 🔴 76.81 — THE JOURNAL AND THE SUMMARY ARE SCREENS OF HER APP, not two
     * cards that happen to be phone-shaped. They hang off the home screen in
     * the real product and they hang off it here, so a reader who arrives at
     * the journal can find out what else is on the device they are holding.
     */
    case "journal":
      return <PatientApp content={content} open="journal" />;

    case "summary":
      return <PatientApp content={content} open="summary" />;

    /*
     * The rolling profile, shown as what it is: dated observations, each one
     * traceable to the session it came from. Never a paragraph of AI prose
     * about somebody — that is the thing sprint 9 refused to build.
     */
    case "profile":
      return (
        <Scroller as="ul" className="space-y-2 bg-navy-50 p-3">
            {(content?.observations ?? []).map((row) => (
              <li
                key={row.at}
                className="rounded-2xl border border-navy-100/80 bg-white p-3 shadow-[0_1px_2px_rgba(10,35,66,0.04)]"
              >
                <p className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
                  {row.at}
                </p>
                <p className="mt-0.5 text-sm leading-snug text-navy-600">{row.text}</p>
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
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-navy-50 to-transparent"
      />
    </div>
  );
}
