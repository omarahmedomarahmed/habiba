import { AlertTriangle, Clock, Quote } from "lucide-react";

import { Badge, Card } from "@/components/clinician/kit";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/messages";
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

const INDICATOR_LABEL: Record<string, MessageKey> = {
  ideation: "risk.ind.ideation",
  intent: "risk.ind.intent",
  plan: "risk.ind.plan",
  means: "risk.ind.means",
  timeframe: "risk.ind.timeframe",
  previous_attempt: "risk.ind.previousAttempt",
  self_harm: "risk.ind.selfHarm",
  homicidal_ideation: "risk.ind.homicidal",
  psychosis: "risk.ind.psychosis",
  abuse: "risk.ind.abuse",
  protective_factor: "risk.ind.protective",
};

/** W3: the level and the source were printed as the raw enum value. */
const LEVEL_LABEL: Record<string, MessageKey> = {
  moderate: "risk.lvl.moderate",
  elevated: "risk.lvl.elevated",
  high: "risk.lvl.high",
  critical: "risk.lvl.critical",
};
const SOURCE_LABEL: Record<string, MessageKey> = {
  keyword: "risk.src.keyword",
  model: "risk.src.model",
};

const LEVEL_TONE = {
  critical: "border-red-300 bg-red-50",
  high: "border-red-200 bg-red-50/70",
  elevated: "border-amber-300 bg-amber-50",
  moderate: "border-navy-100 bg-white",
} as const;

export async function RiskAssessment({
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
  /*
   * 37L.9 — the date follows the reader, the zone follows the server.
   *
   * This rendered `Intl.DateTimeFormat("en-GB", …)` inline with `zone ?? "UTC"`:
   * a clinician's own risk history, in a fixed language, in a zone that was not
   * theirs whenever the prop was null. The zone stays a prop (12.3 — never read
   * from the runtime during render); the language is asked for here, because a
   * prop is a thing a call site can forget and this component has one call site
   * today and will have more.
   */
  const { locale, t } = await getI18n();
  const levelWord = (value: string) => (LEVEL_LABEL[value] ? t(LEVEL_LABEL[value]!) : value);
  const sourceWord = (value: string) => (SOURCE_LABEL[value] ? t(SOURCE_LABEL[value]!) : value);

  const protective = findings.filter((f) => f.indicator === "protective_factor");
  const risks = findings.filter((f) => f.indicator !== "protective_factor");

  return (
    <Card className={cn("border p-4", LEVEL_TONE[level], className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-700">
            {t("risk.assessedTitle", { level: levelWord(level) })}
          </p>
          {recommendedAction ? (
            <p className="mt-0.5 text-sm leading-relaxed text-navy-600">{recommendedAction}</p>
          ) : null}

          {/*
            🔴 Where it came from, in a sentence, because the two are not the
            same claim. The phrase list matching "overdose" and a classifier
            finding a plan across four turns are different evidence, and a
            clinician who cannot tell them apart learns to treat both as noise.
          */}
          <p className="mt-1 text-xs text-navy-400">
            {source === "model" ? t("risk.fromModel") : t("risk.fromKeyword")}
          </p>
        </div>
      </div>

      {risks.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {risks.map((finding, index) => (
            <li key={index} className="rounded-lg border border-navy-100 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="red">
                  {INDICATOR_LABEL[finding.indicator]
                    ? t(INDICATOR_LABEL[finding.indicator]!)
                    : finding.indicator}
                </Badge>
                <span className="text-xs text-navy-400">
                  {t("risk.confidence", { value: finding.confidence.toFixed(2) })}
                </span>
              </div>
              <p className="mt-1.5 flex gap-1.5 text-sm italic leading-relaxed text-navy-600">
                <Quote className="mt-1 h-3 w-3 shrink-0 text-navy-200" aria-hidden />
                {finding.quote}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {keywordIndicators.length > 0 && risks.length === 0 ? (
        <p className="mt-3 text-xs text-navy-400">
          {t("risk.matched")} <span className="font-medium">{keywordIndicators.join(", ")}</span>
        </p>
      ) : null}

      {protective.length > 0 ? (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3">
          <p className="text-xs font-medium text-brand-900">{t("risk.safetyPlan")}</p>
          <ul className="mt-1 space-y-1">
            {protective.map((finding, index) => (
              <li key={index} className="text-xs italic text-brand-800">
                {finding.quote}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prior.length > 0 ? (
        <div className="mt-3 rounded-lg border border-navy-100 bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-navy-400">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {t("risk.before")}
          </p>
          <ul className="mt-1 space-y-1">
            {prior.map((row, index) => (
              <li key={index} className="text-xs text-navy-400">
                {formatDate(row.createdAt, zone, locale)}{" "}
                · {levelWord(row.level)} · {sourceWord(row.source)}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] leading-relaxed text-navy-400">
            {t("risk.historyNote")}
          </p>
        </div>
      ) : null}

      {unquoted > 0 ? (
        <p className="mt-3 text-[11px] text-navy-400">
          {unquoted === 1 ? t("risk.unquotedOne") : t("risk.unquotedMany", { count: unquoted })}
        </p>
      ) : null}
    </Card>
  );
}
