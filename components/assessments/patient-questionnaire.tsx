"use client";

import { useRef, useState, useTransition } from "react";

import { answerQuestion, finishAssessment } from "@/app/(patient)/patient/assessments/actions";
import { Card } from "@/components/ui";
import { useLocale, useT } from "@/lib/i18n/client";

/**
 * One question at a time. PLAN.md 56.3, 56.7, 56.9.
 *
 * ## Why one at a time, and what the gamification is allowed to touch
 *
 * A nine-item grid of clinical questions is a form, and a form is answered the
 * way forms are answered: quickly, in a column, pattern-matching down the
 * options. One question filling the screen is answered the way a question is
 * answered. The progress bar, the single card and the size of the tap targets
 * are the whole of 56.3's "gamified" — the SHELL moves, the questions do not.
 *
 * 🔴 The wording of a validated instrument is not ours to improve. The
 * psychometric properties of a PHQ-9 belong to those exact words, in that
 * order, with those response options. Rewriting "Little interest or pleasure
 * in doing things" into something warmer produces a questionnaire that is no
 * longer a PHQ-9 and a number that means nothing on a chart. So the question
 * text and the option labels come from the instrument row and are rendered
 * verbatim, in the instrument's own language, while every word AROUND them is
 * a MessageKey (45).
 *
 * ## 🔴 What this component must never show
 *
 * A running total. A band. A colour that changes with the answer. A person
 * watching a number climb as they answer is a person answering the number
 * rather than the question, and that is the one thing that stops the
 * instrument measuring what it measures. `assignmentForAnswering` never
 * selects a score, so there is nothing here to render even by mistake.
 *
 * ## 56.7 — the clock
 *
 * Started when the question appears, read when an option is chosen. Held in a
 * ref rather than state so that reading it does not depend on a render having
 * happened, and reset on every question including a revisited one. The server
 * treats anything over five minutes as absent: a phone that went to sleep is
 * not a person thinking.
 */

export type Question = {
  key: string;
  text: Record<string, string>;
  options: { value: number; label: Record<string, string> }[];
};

export function PatientQuestionnaire({
  assignmentId,
  name,
  attribution,
  questions,
  answers,
}: {
  assignmentId: string;
  name: Record<string, string>;
  attribution: string;
  questions: Question[];
  answers: Record<string, number>;
}) {
  const t = useT();
  const locale = useLocale();
  const [given, setGiven] = useState<Record<string, number>>(answers);
  const [index, setIndex] = useState(() => {
    const first = questions.findIndex((question) => !(question.key in answers));
    return first === -1 ? questions.length - 1 : first;
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /*
   * 56.7. Reset whenever the question on screen changes, including on the way
   * back: the time somebody takes to settle on the answer they keep is the
   * interesting number, and `recordAnswer` replaces the timing along with the
   * value for exactly that reason.
   */
  const shownAt = useRef<number>(Date.now());
  const showing = useRef<string | null>(null);
  const question = questions[index];
  if (question && showing.current !== question.key) {
    showing.current = question.key;
    shownAt.current = Date.now();
  }

  /*
   * 🔴 The instrument's own language, falling back to English.
   *
   * Not `t`: these strings are the instrument, not the interface. An Arabic
   * PHQ-9 only reaches this line if somebody reviewed the translation, because
   * `instruments_translation_reviewed` refuses to publish one otherwise.
   */
  const say = (text: Record<string, string>) => text[locale] ?? text.en ?? "";

  if (done) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">{t("passess.doneTitle")}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{t("passess.doneBody")}</p>
      </Card>
    );
  }

  if (!question) return null;

  const answered = Object.keys(given).length;
  const choose = (value: number) => {
    const elapsed = Date.now() - shownAt.current;

    startTransition(async () => {
      setError(null);
      const result = await answerQuestion(assignmentId, question.key, value, elapsed);
      if (result.error) {
        setError(result.error);
        return;
      }

      const next = { ...given, [question.key]: value };
      setGiven(next);

      if (Object.keys(next).length === questions.length) {
        const finished = await finishAssessment(assignmentId);
        if (finished.error) {
          setError(finished.error);
          return;
        }
        setDone(true);
        return;
      }

      /*
       * Forward to the next question they have NOT answered, rather than to
       * index + 1. Somebody who came back to change item 3 should not be
       * walked through items 4 to 9 again.
       */
      const remaining = questions.findIndex((q) => !(q.key in next));
      setIndex(remaining === -1 ? Math.min(index + 1, questions.length - 1) : remaining);
    });
  };

  return (
    <div className="space-y-4">
      {/*
        Progress, and nothing that could be read as a result. How far through
        they are is a true thing about the form; how they are doing is not this
        screen's to say.
      */}
      <div>
        <p className="text-xs font-medium text-slate-500">
          {t("passess.progress", { current: index + 1, total: questions.length })}
        </p>
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={questions.length}
        >
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-300"
            style={{ width: `${(answered / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-5">
        <p className="text-xs leading-relaxed text-slate-500">{t("passess.period")}</p>
        <p className="mt-2 text-lg leading-relaxed font-medium text-slate-900">
          {say(question.text)}
        </p>

        <div className="mt-5 space-y-2">
          {question.options.map((option) => {
            const chosen = given[question.key] === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={pending}
                onClick={() => choose(option.value)}
                aria-pressed={chosen}
                className={
                  chosen
                    ? "tap-target flex min-h-12 w-full items-center rounded-xl border border-teal-500 bg-teal-50 px-4 py-3 text-start text-sm font-medium text-slate-900 disabled:opacity-60"
                    : "tap-target flex min-h-12 w-full items-center rounded-xl border border-slate-200 px-4 py-3 text-start text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                }
              >
                {say(option.label)}
              </button>
            );
          })}
        </div>

        {index > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setIndex(index - 1)}
            className="tap-target mt-4 h-11 rounded-xl px-3 text-sm font-medium text-slate-600 disabled:opacity-50"
          >
            {t("passess.back")}
          </button>
        ) : null}

        {error ? (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </Card>

      {/*
        🔴 56.2 — the attribution, on screen, beside the questions rather than
        in a footer nobody opens. An instrument that names its source is one a
        clinician can check, and the licence that lets us show these at all is
        the licence that asks us to say whose they are.
      */}
      <div>
        <p className="text-xs font-medium text-slate-500">{t("passess.sourceLabel")}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          {say(name)}. {attribution}
        </p>
      </div>
    </div>
  );
}
