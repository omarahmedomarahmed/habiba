"use client";

import { useState } from "react";

import { DesignNav, PhoneFrame, SampleIntro } from "../_ds/frames";
import { Chips } from "../_ds/ui";

import { PatientApp } from "./app";
import type { Lang } from "./copy";

export function PatientSample() {
  const [lang, setLang] = useState<Lang>("en");
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(46,196,182,0.14),transparent_55%)]">
      <div className="hidden sm:block">
        <DesignNav />
        <SampleIntro
          eyebrow="Patients · the app"
          title="Find someone, book at your real price, go in."
          body="A working app. Tap a mood, search and filter, open a therapist, start a session, say yes or no to recording, end it, and watch the summary arrive only once it is signed. SOS is in the bar on every screen."
          tryThis={["a mood chip", "Find → filters", "Start and pay", "Stop recording", "SOS", "Record → answer Dr Kareem"]}
        />
      </div>
      <div className="mb-4 hidden justify-center sm:flex">
        <Chips value={lang} onChange={setLang} options={[{ id: "en", label: "English" }, { id: "ar", label: "العربية" }]} />
      </div>
      <div className="sm:pb-16">
        <PhoneFrame dark>
          <PatientApp key={lang} lang={lang} />
        </PhoneFrame>
      </div>
      <div className="flex justify-center gap-3 p-4 sm:hidden">
        <Chips value={lang} onChange={setLang} options={[{ id: "en", label: "English" }, { id: "ar", label: "العربية" }]} />
      </div>
    </div>
  );
}
