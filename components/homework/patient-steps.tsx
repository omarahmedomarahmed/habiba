"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";

import { answerStep } from "@/app/(patient)/patient/homework/actions";
import { Card } from "@/components/ui";

/**
 * What to do next. PLAN.md 9.5, and the warning that governs it.
 *
 * > ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
 * > failures. **Trend to the therapist; next action to the patient.**
 *
 * So this component has no props that could become a score. It is given open
 * steps and nothing else — no history, no counts, no streak, no percentage —
 * because `openStepsFor` never returns them. There is nothing here to render
 * wrongly.
 *
 * ## Two buttons, and the second one is not an admission
 *
 * "I could not do this one" sits beside "Done", the same size, in the same
 * weight. An interface that offers only completion makes not doing a thing
 * into silence, and silence is the one answer a therapist cannot work with.
 * The optional note is optional in the real sense: no validation, no prompt,
 * no nudge.
 */
export function PatientSteps({
  steps,
}: {
  steps: { id: string; title: string; detail: string | null }[];
}) {
  if (steps.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm font-semibold text-slate-900">Nothing to do right now</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          When you and your therapist agree on something to try, it appears here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step, index) => (
        <Step key={step.id} step={step} first={index === 0} />
      ))}
    </div>
  );
}

function Step({
  step,
  first,
}: {
  step: { id: string; title: string; detail: string | null };
  first: boolean;
}) {
  const [answering, setAnswering] = useState<"done" | "skipped" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const answer = (outcome: "done" | "skipped") =>
    startTransition(async () => {
      setError(null);
      const result = await answerStep(step.id, outcome, note);
      if (result.error) setError(result.error);
    });

  return (
    <Card className={first ? "border border-brand-200 p-4" : "p-4"}>
      <p className="text-base leading-relaxed font-medium text-slate-900">{step.title}</p>
      {step.detail ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.detail}</p>
      ) : null}

      {answering ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={`note-${step.id}`} className="block text-xs text-slate-500">
            Anything you want to say about it? You do not have to.
          </label>
          <textarea
            id={`note-${step.id}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => answer(answering)}
              className="tap-target h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Send"}
            </button>
            <button
              type="button"
              onClick={() => setAnswering(null)}
              className="tap-target h-11 rounded-xl px-3 text-sm font-medium text-slate-600"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setAnswering("done")}
            className="tap-target flex h-11 items-center gap-1.5 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden />I did this
          </button>
          {/*
            Same height, same shape, no warning colour. This is an answer, not
            a confession.
          */}
          <button
            type="button"
            disabled={pending}
            onClick={() => setAnswering("skipped")}
            className="tap-target h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            I could not do this one
          </button>
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
