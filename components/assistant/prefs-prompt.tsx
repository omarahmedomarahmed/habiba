"use client";

import { useState, useTransition } from "react";

import { savePrefs } from "@/app/(app)/assistant/actions";
import { Card } from "@/components/ui";
import { NOTE_LANGUAGES } from "@/lib/db/schema";

const VOICES = {
  british_female: "British, female",
  british_male: "British, male",
  american_female: "American, female",
  american_male: "American, male",
} as const;

/**
 * Preferences, asked once. PLAN.md 10.6.
 *
 * ## Why it appears here and not in a settings page nobody opens
 *
 * The three things it asks about — what language answers come back in, which
 * voice reads them, how fast — are all invisible until somebody uses the
 * assistant. Asking on the screen where they matter, at the moment they start
 * to matter, is the only time the question means anything.
 *
 * ## Skipping is a real answer
 *
 * "These are fine" stores the defaults and stamps `assistantPrefsSetAt`, so
 * the card never comes back. It is not a dismissal that leaves the question
 * open — a prompt that returns is a prompt people learn to ignore, including
 * on the day it matters.
 */
export function AssistantPrefsPrompt({
  prefs,
}: {
  prefs: {
    language: string;
    voice: keyof typeof VOICES;
    voiceSpeed: number;
  };
}) {
  const [language, setLanguage] = useState(prefs.language);
  const [voice, setVoice] = useState<keyof typeof VOICES>(prefs.voice);
  const [speed, setSpeed] = useState(prefs.voiceSpeed);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  const save = () =>
    startTransition(async () => {
      await savePrefs({ language, voice, voiceSpeed: speed });
      setDismissed(true);
    });

  return (
    <Card className="mb-4 border border-brand-200 p-4">
      <p className="text-sm font-semibold text-slate-900">Before you start</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
        Three things, once. You can change them any time in Settings.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Answer in</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
          >
            {/*
              "Match my question" first and default. This product's users
              switch between Arabic and English mid-sentence, and a fixed
              language is the setting most likely to be wrong for the next
              thing they type.
            */}
            <option value="auto">Match my question</option>
            {Object.entries(NOTE_LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Read-aloud voice</span>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value as keyof typeof VOICES)}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
          >
            {Object.entries(VOICES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Speed · {speed.toFixed(1)}×
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="mt-3 w-full"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="tap-target h-10 rounded-xl px-3 text-sm font-medium text-slate-600"
        >
          These are fine
        </button>
      </div>
    </Card>
  );
}
