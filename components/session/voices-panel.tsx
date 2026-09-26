"use client";

import { useState, useTransition } from "react";

import {
  nameVoice,
  unnameVoice,
  type SessionPanelState,
} from "@/app/(app)/sessions/[id]/actions";
import { Card } from "@/components/clinician/kit";
import { useT } from "@/lib/i18n/client";

/**
 * Who is speaking. PLAN.md 51.6, 37.2, 37R.22, C179.
 *
 * ## 🔴 The rule this screen exists to make operable
 *
 * *An unrecognised voice is a numbered speaker, never a guess.* That rule is
 * only something anybody can rely on if there is no way to write a guess down,
 * and `bound_by` has exactly two values for that reason: `track`, which is the
 * recording already knowing because a video session captured two of them, and
 * `operator`, which is a named human saying so. There is no `model` and there
 * must not be.
 *
 * So this panel offers "This is me" and "This is the patient" and nothing
 * shaped like a suggestion. An unbound voice reads "Speaker 2" until a person
 * decides, and a person deciding is audited.
 *
 * ## Unbinding is a real control, not an undo
 *
 * Taking a name off puts every transcript line that claimed that person back
 * to unknown, in the same statement, by trigger. Without that, a correction
 * leaves a transcript still asserting the thing just corrected, which is worse
 * than the original mistake because it now has a correction beside it.
 *
 * It is also the only route from one person to another: the no-repoint trigger
 * refuses a direct swap, so changing your mind is two deliberate steps rather
 * than one slip.
 */

export type VoiceRow = {
  id: string;
  ordinal: number;
  role: "therapist" | "patient" | null;
  boundBy: "track" | "operator" | null;
  boundByName: string | null;
  speakingMs: number;
};

export function VoicesPanel({
  sessionId,
  voices,
  canEdit,
}: {
  sessionId: string;
  voices: VoiceRow[];
  canEdit: boolean;
}) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * The result type is named rather than written inline. `_i18n-coverage`
   * reads an inline `Promise<{ ... }>` as a string literal and the ratchet
   * would rise by one for a type annotation nobody ever sees, which is the
   * kind of false green that teaches people to ignore a number.
   */
  const act = (fn: () => Promise<SessionPanelState>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-navy-700">{t("portal.voices.title")}</h2>

      {voices.length === 0 ? (
        <p className="mt-1 text-sm text-navy-400">{t("portal.voices.none")}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {voices.map((voice) => (
            <div key={voice.id} className="rounded-xl border border-navy-100 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-navy-700">
                    {/*
                      🔴 A numbered speaker until somebody says otherwise.
                      There is no likeliest name and no confidence score.
                    */}
                    {voice.role === "therapist"
                      ? t("portal.voices.therapist")
                      : voice.role === "patient"
                        ? t("portal.voices.patient")
                        : t("portal.voices.unnamed", { ordinal: voice.ordinal })}
                  </p>
                  <p className="mt-0.5 text-xs text-navy-400">
                    {t("portal.voices.speaking", {
                      seconds: Math.round(voice.speakingMs / 1000),
                    })}
                    {voice.boundBy === "track"
                      ? ` · ${t("portal.voices.boundByTrack")}`
                      : voice.boundBy === "operator"
                        ? ` · ${t("portal.voices.boundByOperator", {
                            who: voice.boundByName ?? "",
                          })}`
                        : ""}
                  </p>
                </div>

                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    {voice.role === null ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => nameVoice(sessionId, voice.id, "therapist"))}
                          className="tap-target h-9 rounded-lg bg-navy-50 px-2.5 text-xs font-semibold text-navy-600 hover:bg-navy-100 disabled:opacity-50"
                        >
                          {pending ? t("portal.voices.saving") : t("portal.voices.bindTherapist")}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => nameVoice(sessionId, voice.id, "patient"))}
                          className="tap-target h-9 rounded-lg bg-navy-50 px-2.5 text-xs font-semibold text-navy-600 hover:bg-navy-100 disabled:opacity-50"
                        >
                          {pending ? t("portal.voices.saving") : t("portal.voices.bindPatient")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => act(() => unnameVoice(sessionId, voice.id))}
                        className="tap-target h-9 rounded-lg px-2.5 text-xs font-medium text-navy-400 hover:underline disabled:opacity-50"
                      >
                        {t("portal.voices.unbind")}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {canEdit && voices.some((voice) => voice.role !== null) ? (
            <p className="text-xs leading-relaxed text-navy-400">
              {t("portal.voices.unbindBody")}
            </p>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
