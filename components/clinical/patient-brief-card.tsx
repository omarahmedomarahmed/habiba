"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * What the patient actually receives.
 *
 * Rendered in two places that must never disagree: the clinician's review
 * screen, where the whole point is to show them exactly what is about to be
 * sent, and the patient's own page after they rate the session. Same component,
 * same layout, same words — a "preview" that renders differently from the thing
 * it previews is worse than no preview, because it invites a clinician to
 * approve something they have not seen.
 *
 * Three parts, in the order somebody reads them:
 *
 * - the prose, which is what happened;
 * - the steps, which are what to do, in a block of their own because a list
 *   buried in a third paragraph is a list nobody comes back to;
 * - one line about what happens next.
 *
 * Takes `rtl` as a boolean rather than a language tag. The clinician's side has
 * the note's language from the schema and the patient's side has its own table
 * of codes; passing the answer instead of the question keeps this component out
 * of both.
 */
export function PatientBriefCard({
  brief,
  steps,
  next,
  rtl = false,
  stepsLabel = "Before we next meet",
  nextLabel = "Next session",
  className,
}: {
  brief: string;
  steps: string[];
  next: string;
  rtl?: boolean;
  stepsLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  const paragraphs = brief.split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <div dir={rtl ? "rtl" : "ltr"} className={cn("space-y-4", rtl && "text-end", className)}>
      {paragraphs.length > 0 ? (
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-800">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          Nothing written for the patient yet.
        </p>
      )}

      {steps.length > 0 ? (
        <div className="rounded-2xl bg-teal-50/70 px-4 py-3.5">
          <p className="text-[11px] font-bold tracking-wider text-teal-700 uppercase">
            {stepsLabel}
          </p>
          <ul className="mt-2.5 space-y-2.5">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-2.5 text-[15px] leading-relaxed text-teal-950">
                <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border border-teal-300 bg-white text-teal-600">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {next ? (
        <p className="border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">{nextLabel}:</span> {next}
        </p>
      ) : null}
    </div>
  );
}
