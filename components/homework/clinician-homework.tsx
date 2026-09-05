"use client";

import { useState, useTransition } from "react";
import { Check, Plus, SkipForward, Trash2 } from "lucide-react";

import { removeStep, setStep } from "@/app/(app)/patients/[id]/homework/actions";
import { Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";

/**
 * Homework, from the clinician's side. PLAN.md 9.5.
 *
 * ## The trend is here, and only here
 *
 * > ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
 * > failures. Trend to the therapist; next action to the patient.
 *
 * This component receives counts and a skip streak. The patient's component
 * receives one row and no numbers at all — not a different rendering of the
 * same props, a different query. See `lib/data/homework.ts`.
 *
 * ## Why the skip streak is the headline and the rate is not
 *
 * A rate of 40% could be four good weeks and six bad ones in any order. Three
 * skips in a row is a conversation to have on Thursday. The rate is shown
 * because a clinician asked a fair question deserves the number, but it is not
 * what the panel leads with.
 */
export function ClinicianHomework({
  patientId,
  items,
  trend,
  drafted,
  canAssign,
}: {
  patientId: string;
  items: {
    id: string;
    title: string;
    detail: string | null;
    status: "open" | "done" | "skipped";
    source: "drafted" | "therapist";
    createdAt: string;
    completedAt: string | null;
    patientNote: string | null;
  }[];
  trend: {
    open: number;
    done: number;
    skipped: number;
    skipStreak: number;
    completionRate: number | null;
  };
  /** Steps the last note drafted, and whether each is already live. */
  drafted: { title: string; assigned: boolean }[];
  canAssign: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const add = (input: { title: string; detail?: string; fromDraft?: boolean }) =>
    startTransition(async () => {
      setError(null);
      const result = await setStep(patientId, input);
      if (result.error) setError(result.error);
      else {
        setTitle("");
        setDetail("");
        setAdding(false);
      }
    });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Between sessions</p>
          <p className="mt-0.5 text-xs text-slate-500">
            What they agreed to try. They close each one themselves — you cannot.
          </p>
        </div>
        {trend.skipStreak >= 3 ? (
          <Badge tone="amber">{trend.skipStreak} skipped in a row</Badge>
        ) : null}
      </div>

      {/*
        The trend, stated plainly and without a progress bar. A bar invites the
        clinician to read it as a score for the person rather than a signal
        about the work, and it is one screenshot away from being shown to them.
      */}
      <dl className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-100 px-4 py-2.5 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-slate-500">Open</dt>
          <dd className="font-medium tabular-nums text-slate-800">{trend.open}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-slate-500">Done</dt>
          <dd className="font-medium tabular-nums text-slate-800">{trend.done}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-slate-500">Not done</dt>
          <dd className="font-medium tabular-nums text-slate-800">{trend.skipped}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-slate-500">Completed</dt>
          <dd className="font-medium tabular-nums text-slate-800">
            {/*
              Null, not 0%. A patient who has closed nothing has not failed
              everything — there is simply nothing to say yet, and those are
              different clinical facts.
            */}
            {trend.completionRate === null ? "—" : `${Math.round(trend.completionRate * 100)}%`}
          </dd>
        </div>
      </dl>

      {drafted.length > 0 && canAssign ? (
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Drafted from the note
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Written by the note, not by you. Nothing is set until you set it.
          </p>
          <ul className="mt-2 space-y-1.5">
            {drafted.map((draft) => (
              <li key={draft.title} className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-sm text-slate-700">{draft.title}</span>
                {draft.assigned ? (
                  <Badge tone="slate">Set</Badge>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add({ title: draft.title, fromDraft: true })}
                    className="tap-target h-8 shrink-0 rounded-lg bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    Set this
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-500">Nothing set yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {item.status === "done" ? (
                    <Check className="h-4 w-4 text-teal-500" aria-hidden />
                  ) : item.status === "skipped" ? (
                    <SkipForward className="h-4 w-4 text-slate-400" aria-hidden />
                  ) : (
                    <span className="block h-4 w-4 rounded-full border border-slate-300" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.detail}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.source === "drafted" ? "From the note · " : ""}
                    {formatDate(new Date(item.createdAt))}
                    {item.completedAt
                      ? ` · answered ${formatDate(new Date(item.completedAt))}`
                      : ""}
                  </p>
                  {item.patientNote ? (
                    <blockquote className="mt-1.5 border-s-2 border-slate-200 ps-2.5 text-xs leading-relaxed text-slate-600">
                      “{item.patientNote}”
                    </blockquote>
                  ) : null}
                </div>

                {item.status === "open" && canAssign ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        setError(null);
                        const result = await removeStep(patientId, item.id);
                        if (result.error) setError(result.error);
                      })
                    }
                    aria-label="Withdraw this step"
                    className="tap-target shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canAssign ? (
        <div className="border-t border-slate-100 px-4 py-3">
          {adding ? (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Write down the three times you noticed the tight feeling starting"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="When, or what counts as done (optional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending || !title.trim()}
                  onClick={() => add({ title, detail })}
                  className="tap-target h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Set it"}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="tap-target h-9 rounded-lg px-3 text-sm font-medium text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="tap-target flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Set a step
            </button>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="px-4 pb-3 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
