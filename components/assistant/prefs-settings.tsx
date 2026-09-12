"use client";

import { useState, useTransition } from "react";

import { savePrefs } from "@/app/(app)/assistant/actions";
import { Card } from "@/components/ui";
import { NOTE_LANGUAGES } from "@/lib/db/schema";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/messages";

/* 37L.2 — keys, resolved at render. */
const VOICES = {
  british_female: "tasst.voiceBritishF",
  british_male: "tasst.voiceBritishM",
  american_female: "tasst.voiceAmericanF",
  american_male: "tasst.voiceAmericanM",
} as const satisfies Record<string, MessageKey>;

/**
 * Copilot preferences, editable. PLAN.md 10.6, second half.
 *
 * Sprint 10 shipped the first-use card and stored the three values, and left
 * "editable later" unbuilt — logged as a `[~]` rather than claimed. This is
 * that half: the same three fields, on the page a clinician actually goes to
 * when they want to change something.
 *
 * The same server action backs both, so there is one place these are written
 * and one clamp on the speed. Two write paths for one setting is how a slider
 * ends up storing 3.4 and the speech API starts returning 400s.
 */
export function AssistantPrefsSettings({
  initial,
}: {
  initial: {
    language: string;
    voice: keyof typeof VOICES;
    voiceSpeed: number;
  };
}) {
  const [language, setLanguage] = useState(initial.language);
  const [voice, setVoice] = useState<keyof typeof VOICES>(initial.voice);
  const [speed, setSpeed] = useState(initial.voiceSpeed);
  const [saved, setSaved] = useState(false);
  const t = useT();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">{t("tasst.copilot")}</p>
      <p className="mt-0.5 text-sm text-slate-500">
        {t("tasst.copilotBody")}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("tasst.answerIn")}</span>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setSaved(false);
            }}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
          >
            {/*
              "Match my question" first and default. This product's clinicians
              switch between Arabic and English mid-sentence, and a fixed
              language is the setting most likely to be wrong for the next
              thing they type.
            */}
            <option value="auto">{t("tasst.matchQuestion")}</option>
            {Object.entries(NOTE_LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600">{t("tasst.voice")}</span>
          <select
            value={voice}
            onChange={(e) => {
              setVoice(e.target.value as keyof typeof VOICES);
              setSaved(false);
            }}
            className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-2 text-sm"
          >
            {Object.entries(VOICES).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
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
            onChange={(e) => {
              setSpeed(Number(e.target.value));
              setSaved(false);
            }}
            className="mt-3 w-full"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await savePrefs({ language, voice, voiceSpeed: speed });
              setSaved(true);
            })
          }
          className="tap-target h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? t("common.saving") : t("tdoc.save")}
        </button>
        {saved ? <span className="text-xs text-teal-600">{t("common.saved")}</span> : null}
      </div>
    </Card>
  );
}
