"use client";

import { useState, useTransition } from "react";

import {
  pollAssessment,
  sendAssessment,
  timingsFor,
} from "@/app/(app)/patients/[id]/assessments/actions";
import { Card } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/**
 * The clinician's side of an assessment. PLAN.md 56.4, 56.5, 56.7.
 *
 * ## 56.4 — two doors, one assignment
 *
 * "Ask them now" is the questionnaire shared into a live session and watched
 * while it is answered; "Send for later" is the same thing left as homework.
 * The live door only appears when there IS a live session, because a button
 * that sends a questionnaire into a room nobody is in is a button that looks
 * like it worked.
 *
 * ## 56.5 — polling, and what polling is allowed to show
 *
 * 🔴 A count while they are answering. A band only once they have finished.
 *
 * A severity label recomputed after each answer is a clinical word that moves
 * while a clinician watches it, and the one they happen to read is the one
 * that sticks. "4 of 9" is watching somebody work. The server enforces this —
 * `pollAssessment` returns a null band for anything not completed — so this
 * component could not render one early even if it tried.
 *
 * Polled on a button rather than a timer. A clinician in a session has a
 * person in front of them, and a panel that repaints itself every two seconds
 * is a reason to look at a screen instead.
 */

export type ClinicianAssignment = {
  id: string;
  instrumentName: string;
  mode: string;
  status: string;
  score: number | null;
  createdAt: string;
};

type Timing = {
  questionKey: string;
  text: string;
  value: number;
  answerMs: number | null;
};

type Progress = {
  status?: string;
  answered?: number;
  total?: number;
  score?: number | null;
  band?: string | null;
};

export function ClinicianAssessments({
  patientId,
  instruments,
  assignments,
  liveSessionId,
  canSend,
}: {
  patientId: string;
  instruments: { key: string; name: string }[];
  assignments: ClinicianAssignment[];
  /** 56.4 — the session they are in right now, if they are in one. */
  liveSessionId: string | null;
  /** Revoked access sends nothing, the same rule homework follows. */
  canSend: boolean;
}) {
  const t = useT();
  const [choice, setChoice] = useState(instruments[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [timings, setTimings] = useState<Record<string, Timing[]>>({});
  const [pending, startTransition] = useTransition();

  const showTimings = (assignmentId: string) =>
    startTransition(async () => {
      setError(null);
      const result = await timingsFor(patientId, assignmentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTimings((current) => ({ ...current, [assignmentId]: result.answers ?? [] }));
    });

  const send = (mode: "room" | "homework") =>
    startTransition(async () => {
      setError(null);
      const result = await sendAssessment(patientId, {
        instrumentKey: choice,
        mode,
        sessionId: mode === "room" ? (liveSessionId ?? undefined) : undefined,
      });
      if (result.error) setError(result.error);
    });

  const poll = (assignmentId: string) =>
    startTransition(async () => {
      setError(null);
      const result = await pollAssessment(patientId, assignmentId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setProgress((current) => ({ ...current, [assignmentId]: result }));
    });

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-slate-900">{t("cassess.title")}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{t("cassess.body")}</p>

      {canSend && instruments.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
          >
            {instruments.map((instrument) => (
              <option key={instrument.key} value={instrument.key}>
                {instrument.name}
              </option>
            ))}
          </select>

          {/*
            🔴 Only when there is a room to share it into. 56.4's two doors are
            one assignment with a session id or without; offering the first
            when no session is live would write an assignment whose `mode` says
            "room" and whose `session_id` is null.
          */}
          {liveSessionId ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => send("room")}
              className="tap-target h-11 rounded-xl bg-teal-500 px-4 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {pending ? t("cassess.sending") : t("cassess.sendRoom")}
            </button>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={() => send("homework")}
            className="tap-target h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? t("cassess.sending") : t("cassess.sendHomework")}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {assignments.length === 0 ? (
          <p className="text-sm text-slate-500">{t("cassess.none")}</p>
        ) : (
          assignments.map((assignment) => {
            const live = progress[assignment.id];
            const status = live?.status ?? assignment.status;
            const score = live?.status === "completed" ? live.score : assignment.score;

            return (
              <div
                key={assignment.id}
                className="rounded-xl border border-slate-200 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {assignment.instrumentName}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {status === "completed"
                      ? t("cassess.completed")
                      : status === "started"
                        ? t("cassess.started")
                        : t("cassess.waiting")}
                    {live?.total !== undefined
                      ? ` · ${t("cassess.progress", {
                          answered: live.answered ?? 0,
                          total: live.total,
                        })}`
                      : ""}
                  </p>
                </div>

                <div className="flex items-baseline gap-3">
                  {score !== null && score !== undefined ? (
                    <span className="text-sm text-slate-700">
                      {t("cassess.score")} {score}
                    </span>
                  ) : null}
                  {/*
                    🔴 The band, and only here. This is the clinician's screen,
                    which is the audience C113 carves out; the patient's own
                    view of the same number carries no label at all.
                  */}
                  {live?.band ? (
                    <span className="text-sm font-semibold text-slate-900">
                      {t("cassess.band")} {live.band}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => poll(assignment.id)}
                    className="tap-target h-9 rounded-lg px-2 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                  >
                    {t("cassess.refresh")}
                  </button>
                </div>
                </div>

                {/*
                  🔴 56.7 — the whole point, and it only exists once they have
                  finished.

                  Opened deliberately rather than shown by default: a column of
                  per-item timings beside a live progress count invites reading
                  a hesitation as it happens, and a pause that is still running
                  is not yet a pause.
                */}
                {status === "completed" ? (
                  timings[assignment.id] ? (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      <p className="text-xs font-medium text-slate-700">
                        {t("cassess.timings")}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {t("cassess.timingsBody")}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {timings[assignment.id].map((timing) => (
                          <li
                            key={timing.questionKey}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            {/* The instrument's own wording, verbatim. */}
                            <span className="text-slate-700">{timing.text}</span>
                            <span className="shrink-0 text-slate-500">
                              {timing.value}
                              {" · "}
                              {timing.answerMs === null
                                ? t("cassess.unknownTime")
                                : t("cassess.seconds", {
                                    seconds: Math.round(timing.answerMs / 100) / 10,
                                  })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => showTimings(assignment.id)}
                      className="tap-target mt-1 h-9 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                    >
                      {t("cassess.timings")}
                    </button>
                  )
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
