"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { approveSession } from "@/app/(app)/sessions/actions";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

/**
 * One screen, one action, three items. PLAN.md 26.3, C112.
 *
 * ## 🔴 Everything defaults to off
 *
 * C112's ruling is that **silence publishes nothing**. So nothing here is
 * pre-ticked, the summary box starts empty, and a clinician who opens this
 * panel and closes the tab has published exactly nothing. The opposite default
 * is the one that feels efficient and is how a machine's draft ends up on
 * somebody's phone with a signature nobody read.
 *
 * ## Why the three are on one screen
 *
 * Three separate approvals per session is how approvals become rubber stamps.
 * A clinician who has just finished a session should see, in one place, what
 * they are about to put in the chart, what the patient will read tonight, and
 * what goes into the record that person carries for life.
 *
 * ## What the third one is, and is not
 *
 * The summary is not a longer version of the patient's copy. The copy is about
 * *this session*; the summary is about the course of treatment, it is
 * versioned, it is append-only, and the next clinician this person sees will
 * read it. Which is why it is typed rather than generated: a model has not met
 * them across eleven sessions.
 */

type Props = {
  sessionId: string;
  /** Already signed, already released: shown as done rather than offered again. */
  clinicalSigned: boolean;
  patientReleased: boolean;
  /** Absent when this session has no note yet. */
  hasNote: boolean;
  /** The last version, so the clinician writes the next one rather than the first. */
  previousSummary: { version: number; body: string; approvedByName: string; on: string } | null;
  /** False when the session has no person attached: the summary cannot be filed. */
  canSummarise: boolean;
  patientLabel: string;
};

export function SessionApproval(props: Props) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();

  const [clinical, setClinical] = useState(false);
  const [patient, setPatient] = useState(false);
  const [summary, setSummary] = useState("");
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const nothingToDo = props.clinicalSigned && props.patientReleased && !props.canSummarise;
  if (nothingToDo) return null;

  const willDo =
    (clinical && !props.clinicalSigned) ||
    (patient && !props.patientReleased) ||
    summary.trim().length > 0;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-slate-900">{t("tappr.title")}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        {t("tappr.body")}
      </p>

      <ul className="mt-4 space-y-2.5">
        <li>
          <Choice
            checked={props.clinicalSigned || clinical}
            done={props.clinicalSigned}
            disabled={props.clinicalSigned || !props.hasNote}
            onChange={setClinical}
            title={t("tappr.signNote")}
            body={props.clinicalSigned ? t("tappr.signedBody") : t("tappr.signBody")}
          />
        </li>
        <li>
          <Choice
            checked={props.patientReleased || patient}
            done={props.patientReleased}
            disabled={props.patientReleased || !props.hasNote}
            onChange={setPatient}
            title={t("tappr.release", { name: props.patientLabel })}
            body={props.patientReleased ? t("tappr.releasedBody") : t("tappr.releaseBody")}
          />
        </li>
      </ul>

      {props.canSummarise ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-900">
            {t("tappr.patientVersion")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {t("tappr.summaryBody", { name: props.patientLabel })}
          </p>

          {props.previousSummary ? (
            <details className="mt-2.5 rounded-xl bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                {t("tappr.versionBy", {
                  version: props.previousSummary.version,
                  name: props.previousSummary.approvedByName,
                  date: props.previousSummary.on,
                })}
              </summary>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                {props.previousSummary.body}
              </p>
            </details>
          ) : null}

          <textarea
            rows={5}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={t("tappr.leaveEmpty")}
            className="mt-2.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed"
          />
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {t("tappr.patientVersionBody")}
          </p>
        </div>
      ) : null}

      {feedback.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {feedback.error}
        </p>
      ) : null}
      {feedback.message ? (
        <p role="status" className="mt-3 text-sm text-teal-700">
          {feedback.message}
        </p>
      ) : null}

      <Button
        className="mt-4"
        full
        disabled={pending || !willDo}
        onClick={() =>
          start(async () => {
            const result = await approveSession(props.sessionId, {
              clinical: clinical && !props.clinicalSigned,
              patient: patient && !props.patientReleased,
              summary: summary.trim() ? summary : null,
            });
            setFeedback(result);
            if (!result.error) {
              setSummary("");
              router.refresh();
            }
          })
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Check className="h-4 w-4" aria-hidden />
        )}
        {willDo ? t("tappr.publish") : t("tappr.nothingTicked")}
      </Button>
    </Card>
  );
}

function Choice({
  checked,
  done,
  disabled,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  done: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
        done ? "border-teal-200 bg-teal-50/60" : "border-slate-200",
        disabled && !done ? "opacity-50" : null,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block text-xs leading-relaxed text-slate-600">{body}</span>
      </span>
    </label>
  );
}
