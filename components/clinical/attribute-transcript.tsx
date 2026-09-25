"use client";

import { useState, useTransition } from "react";

import { attributeLine } from "@/app/(app)/sessions/[id]/actions";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export type TranscriptLineRow = {
  id: string;
  speaker: "therapist" | "patient" | "unknown";
  /** Worked out from the words rather than heard on a track. Dotted underline. */
  inferred: boolean;
  /** A separated voice owns this line, so the voice panel attributes it, not this. */
  voiceBound: boolean;
  text: string;
};

/**
 * 🔴 76.38 — THE TRANSCRIPT, WITH WHO SAID IT, AND A WAY TO CORRECT IT.
 *
 * ## What this replaces
 *
 * A list of paragraphs. The session page rendered `segment.text` and nothing
 * else: no speaker, no attribution, no control. A clinician who ran an offline
 * session with two people on one microphone got every line labelled "Speaker"
 * in the live panel and, afterwards, a wall of text with no attribution at all
 * and no way to add any.
 *
 * ## Three states, and the middle one is the honest one
 *
 *   **you** / **them** — somebody or something decided, and the dotted
 *   underline says which: solid means measured or corrected by a person, dotted
 *   means worked out from the words by `lib/ai/diarise.ts`.
 *
 *   **not sure** — nobody knows. It is a real answer and it is offered as a
 *   choice rather than only being an absence, because a clinician who has
 *   mislabelled a line needs a way back to honest as much as a way to a name.
 *
 * ## 🔴 A LINE A SEPARATED VOICE OWNS IS NOT EDITABLE HERE
 *
 * When the recording separated voices, who a voice is belongs to the voice:
 * name it once in the panel above and every line it said follows. The database
 * refuses a per-line disagreement outright, so rather than offer a control that
 * throws, those lines render their label and say where attribution lives.
 */
export function AttributeTranscript({
  sessionId,
  lines,
}: {
  sessionId: string;
  lines: TranscriptLineRow[];
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* Optimistic, so a tap lands immediately on a list that can be long. */
  const [local, setLocal] = useState<Record<string, TranscriptLineRow["speaker"]>>({});

  const set = (segmentId: string, speaker: TranscriptLineRow["speaker"]) => {
    setLocal((current) => ({ ...current, [segmentId]: speaker }));
    start(async () => {
      setError(null);
      const result = await attributeLine(sessionId, segmentId, speaker);
      if (result?.error) {
        setError(result.error);
        /* Put it back. A control that lies about what it did is worse than one that refuses. */
        setLocal((current) => {
          const next = { ...current };
          delete next[segmentId];
          return next;
        });
      }
    });
  };

  const CHOICES: { key: TranscriptLineRow["speaker"]; label: string }[] = [
    { key: "therapist", label: t("tattr.you") },
    { key: "patient", label: t("tattr.them") },
    { key: "unknown", label: t("tattr.unsure") },
  ];

  /*
   * 🔴 76.38 — WHEN ALMOST NOTHING IS ATTRIBUTED, SAY WHY.
   *
   * A clinician ran an offline session with two people on one microphone and
   * every line came back "Speaker". That is not a failure: the diariser is
   * called before the note, it read the lines, and it declined to guess.
   *
   * The recording is cut into fixed chunks rather than at turn boundaries, so
   * on a single microphone most chunks hold the end of one person's turn and
   * the start of the other's, and C35's rule is that a half-correct label is
   * worse than none, because it is written into a clinical record as if it were
   * certain. `unknown` is the honest answer to a genuinely ambiguous line.
   *
   * What was missing is that nobody said so. A transcript reading "Speaker"
   * forty times with no explanation reads as broken software, and a clinician
   * who believes the product is broken stops trusting the rest of it. So when
   * most of a transcript is unattributed, it says what happened and what the
   * clinician can do about it, which is the control directly underneath.
   */
  const unattributed = lines.filter((line) => line.speaker === "unknown" && !line.voiceBound).length;
  const mostlyUnknown = lines.length >= 4 && unattributed > lines.length * 0.6;

  return (
    <div className="space-y-3">
      {mostlyUnknown ? (
        <p className="rounded-xl bg-navy-50 px-3 py-2.5 text-xs leading-relaxed text-navy-600">
          {t("tattr.oneMic")}
        </p>
      ) : null}
      <p className="text-xs leading-relaxed text-navy-400">{t("tattr.blurb")}</p>
      {error ? (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {lines.map((line) => {
          const speaker = local[line.id] ?? line.speaker;
          return (
            <li key={line.id} className="border-b border-navy-100/70 pb-3 last:border-b-0">
              <p className="text-sm leading-relaxed text-navy-600">{line.text}</p>

              {line.voiceBound ? (
                /*
                 * 🔴 A LABEL, NOT A CONTROL. The voice owns it, and offering
                 * buttons that the database will refuse teaches somebody that
                 * the product is broken rather than that attribution lives one
                 * panel up.
                 */
                <p className="mt-1.5 text-[11px] font-medium text-navy-400">
                  {speaker === "patient"
                    ? t("tattr.them")
                    : speaker === "therapist"
                      ? t("tattr.you")
                      : t("tattr.unsure")}
                  {" · "}
                  {t("tattr.fromVoice")}
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {CHOICES.map((choice) => (
                    <button
                      key={choice.key}
                      type="button"
                      disabled={pending}
                      aria-pressed={speaker === choice.key}
                      onClick={() => set(line.id, choice.key)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50",
                        speaker === choice.key
                          ? "bg-navy-600 text-white"
                          : "bg-navy-50 text-navy-400",
                      )}
                    >
                      {choice.label}
                    </button>
                  ))}
                  {/*
                    🔴 THE DOTTED LINE SURVIVES THE REWRITE, and it is the one
                    thing on this row that is about trust rather than about
                    editing. It means a model worked this out from the words. A
                    clinician's own correction clears it, because that is the
                    one attribution here with a person behind it.
                  */}
                  {line.inferred && !local[line.id] ? (
                    <span className="text-[11px] text-navy-400 italic">{t("tattr.guessed")}</span>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
