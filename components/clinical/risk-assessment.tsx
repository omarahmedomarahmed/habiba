import { AlertTriangle, Clock, Quote } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * What the clinician sees after a session was assessed. PLAN.md 35.1, 35.3.
 *
 * ## 🔴 The quote is the alert
 *
 * "Risk: elevated" is a word a system produced. *"I just want to go to sleep
 * and not wake up"*, with `ideation` beside it, is a thing a clinician can act
 * on, argue with, or recognise as a misread idiom before they ring somebody at
 * nine at night. Same rule as the evidence screen (33.6) and for the same
 * reason: an alert nobody can trace to a line is an alert nobody can defend.
 *
 * ## 🔴 The prior history is HERE, and it is not in the classifier's prompt
 *
 * This is the whole shape of C170 on a screen. A clinician deciding what to do
 * about tonight needs to know this is the third elevated session in a month,
 * or that the last one was eleven months ago — and a model given the same
 * context writes "no acute risk, consistent with the record", which sprint 34
 * measured at five cases out of five. So the history is fetched at display
 * time, by `priorRiskFor`, in a module the classifier does not import and
 * cannot reach, and weighed by the person whose job that is.
 */

export type AssessmentFinding = { indicator: string; quote: string; confidence: number };

const INDICATOR_LABEL: Record<string, string> = {
  ideation: "Thoughts of dying",
  intent: "Stated intent",
  plan: "A plan",
  means: "Access to means",
  timeframe: "A timeframe",
  previous_attempt: "A previous attempt",
  self_harm: "Self-harm",
  homicidal_ideation: "Risk to somebody else",
  psychosis: "Psychosis",
  abuse: "Being harmed by somebody",
  protective_factor: "Protective factor",
};

const LEVEL_TONE = {
  critical: "border-red-300 bg-red-50",
  high: "border-red-200 bg-red-50/70",
  elevated: "border-amber-300 bg-amber-50",
  moderate: "border-slate-200 bg-white",
} as const;

export function RiskAssessment({
  level,
  source,
  findings,
  recommendedAction,
  keywordIndicators = [],
  prior = [],
  unquoted = 0,
  zone,
  className,
}: {
  level: "moderate" | "elevated" | "high" | "critical";
  source: "keyword" | "model";
  findings: AssessmentFinding[];
  recommendedAction: string | null;
  /** The matched phrases, when the phrase list is what raised this. */
  keywordIndicators?: string[];
  prior?: { level: string; createdAt: Date; indicators: string[]; source: string }[];
  /** Findings dropped for quoting something the transcript does not contain. */
  unquoted?: number;
  /** 12.3 — the zone is a PROP from the server, never read from the runtime. */
  zone: string | null;
  className?: string;
}) {
  const protective = findings.filter((f) => f.indicator === "protective_factor");
  const risks = findings.filter((f) => f.indicator !== "protective_factor");

  return (
    <Card className={cn("border p-4", LEVEL_TONE[level], className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Risk assessed for this session · {level}
          </p>
          {recommendedAction ? (
            <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{recommendedAction}</p>
          ) : null}

          {/*
            🔴 Where it came from, in a sentence, because the two are not the
            same claim. The phrase list matching "overdose" and a classifier
            finding a plan across four turns are different evidence, and a
            clinician who cannot tell them apart learns to treat both as noise.
          */}
          <p className="mt-1 text-xs text-slate-500">
            {source === "model"
              ? "Read from the whole session, then checked against the transcript."
              : "Matched against the crisis phrase list."}
          </p>
        </div>
      </div>

      {risks.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {risks.map((finding, index) => (
            <li key={index} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="red">{INDICATOR_LABEL[finding.indicator] ?? finding.indicator}</Badge>
                <span className="text-xs text-slate-400">
                  confidence {finding.confidence.toFixed(2)}
                </span>
              </div>
              <p className="mt-1.5 flex gap-1.5 text-sm italic leading-relaxed text-slate-700">
                <Quote className="mt-1 h-3 w-3 shrink-0 text-slate-300" aria-hidden />
                {finding.quote}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {keywordIndicators.length > 0 && risks.length === 0 ? (
        <p className="mt-3 text-xs text-slate-600">
          Matched: <span className="font-medium">{keywordIndicators.join(", ")}</span>
        </p>
      ) : null}

      {protective.length > 0 ? (
        <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/60 p-3">
          <p className="text-xs font-medium text-teal-900">Also said, for the safety plan:</p>
          <ul className="mt-1 space-y-1">
            {protective.map((finding, index) => (
              <li key={index} className="text-xs italic text-teal-800">
                {finding.quote}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prior.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Before this session
          </p>
          <ul className="mt-1 space-y-1">
            {prior.map((row, index) => (
              <li key={index} className="text-xs text-slate-500">
                {new Intl.DateTimeFormat("en-GB", {
                  dateStyle: "medium",
                  timeZone: zone ?? "UTC",
                }).format(row.createdAt)}{" "}
                · {row.level} · {row.source}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            This history is for you. It was not shown to the system that read the session, so
            what it found is about today.
          </p>
        </div>
      ) : null}

      {unquoted > 0 ? (
        <p className="mt-3 text-[11px] text-slate-400">
          {unquoted} finding{unquoted === 1 ? " was" : "s were"} discarded for quoting something
          the transcript does not contain.
        </p>
      ) : null}
    </Card>
  );
}
