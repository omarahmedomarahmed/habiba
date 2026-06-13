"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, Award,
  ExternalLink, Send
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_DATA: Record<string, {
  name: string;
  abbreviation?: string;
  category: string;
  evidence: string;
  description: string;
  timeframe?: string;
  options?: string[];
  questions?: string[];
  scoring?: { range: string; label: string; color: string; action: string }[];
  steps?: string[];
  scoring_summary?: string;
  crisis_note?: string;
}> = {
  phq9: {
    name: "PHQ-9 Depression Scale",
    abbreviation: "PHQ-9",
    category: "Depression Assessment",
    evidence: "Level I — Kroenke et al., 2001 (JAMA Internal Medicine)",
    description:
      "The Patient Health Questionnaire-9 is a 9-item depression scale that is one of the most validated tools in mental health, used by clinicians worldwide for depression screening and severity monitoring.",
    timeframe: "Over the last 2 weeks",
    options: ["Not at all (0)", "Several days (1)", "More than half the days (2)", "Nearly every day (3)"],
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      "Trouble concentrating on things, such as reading the newspaper or watching television",
      "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
      "Thoughts that you would be better off dead, or of hurting yourself in some way",
    ],
    scoring: [
      { range: "0–4",  label: "Minimal/None",       color: "text-green-700 bg-green-50",  action: "Monitor; may not need treatment" },
      { range: "5–9",  label: "Mild",                color: "text-yellow-700 bg-yellow-50", action: "Watchful waiting; repeat PHQ-9 in 2–4 weeks" },
      { range: "10–14", label: "Moderate",           color: "text-orange-700 bg-orange-50", action: "Treatment plan; consider counseling and/or pharmacotherapy" },
      { range: "15–19", label: "Moderately Severe",  color: "text-red-700 bg-red-50",       action: "Active treatment with pharmacotherapy and/or psychotherapy" },
      { range: "20–27", label: "Severe",             color: "text-red-900 bg-red-100",      action: "Immediate initiation of pharmacotherapy and/or psychotherapy; if severe, consider referral" },
    ],
  },
  gad7: {
    name: "GAD-7 Anxiety Scale",
    abbreviation: "GAD-7",
    category: "Anxiety Assessment",
    evidence: "Level I — Spitzer et al., 2006 (Archives of Internal Medicine)",
    description:
      "The Generalized Anxiety Disorder 7-item scale is a validated tool for screening and measuring the severity of generalized anxiety disorder, panic disorder, social anxiety disorder, and PTSD.",
    timeframe: "Over the last 2 weeks",
    options: ["Not at all (0)", "Several days (1)", "More than half the days (2)", "Nearly every day (3)"],
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it is hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ],
    scoring: [
      { range: "0–4",  label: "Minimal", color: "text-green-700 bg-green-50",  action: "Monitor" },
      { range: "5–9",  label: "Mild",    color: "text-yellow-700 bg-yellow-50", action: "Watchful waiting" },
      { range: "10–14", label: "Moderate", color: "text-orange-700 bg-orange-50", action: "Consider medication or therapy" },
      { range: "15–21", label: "Severe",  color: "text-red-700 bg-red-50",      action: "Active treatment required" },
    ],
  },
  pcl5: {
    name: "PCL-5 PTSD Checklist",
    abbreviation: "PCL-5",
    category: "PTSD Assessment",
    evidence: "Level I — Blevins et al., 2015 (Journal of Traumatic Stress)",
    description:
      "The PTSD Checklist for DSM-5 is a 20-item self-report measure that assesses the 20 DSM-5 PTSD symptoms. A provisional PTSD diagnosis can be made by endorsing one B item, one C item, two D items, and two E items.",
    steps: [
      "Explain the purpose of the assessment and obtain consent",
      "Administer the 20-item questionnaire (0–4 scale for each)",
      "Calculate the total score (0–80)",
      "Score ≥33 indicates probable PTSD diagnosis",
      "Review individual cluster scores (B: intrusion, C: avoidance, D: negative cognitions, E: arousal)",
      "Document in patient record and discuss results with patient",
    ],
    scoring_summary:
      "Score 0–32: Below PTSD threshold. Score ≥33: Probable PTSD — DSM-5 criteria should be reviewed.",
  },
  columbia: {
    name: "Columbia Suicide Severity Rating Scale",
    abbreviation: "C-SSRS",
    category: "Suicide Risk Assessment",
    evidence: "Level I — Posner et al., 2011 (American Journal of Psychiatry)",
    description:
      "The C-SSRS is a clinician-administered assessment that captures the occurrence, severity, and frequency of suicide-related ideation and behavior. It is the gold standard for suicide risk stratification used in clinical practice and FDA-required clinical trials.",
    steps: [
      "Review recent events and stressors before beginning",
      "Ask about passive ideation: 'Have you wished you were dead?'",
      "Ask about active ideation without plan: 'Have you had thoughts of killing yourself?'",
      "If yes to ideation: Ask about plan and intent",
      "Assess behavior: any preparatory actions, aborted, interrupted, or actual attempts",
      "Score 1–5 based on ideation severity; score behavior separately",
      "Document safety plan and level-of-care recommendations",
    ],
    crisis_note:
      "If any active suicidal ideation with plan or intent is present, initiate crisis protocol immediately.",
  },
  audit: {
    name: "Alcohol Use Disorders Identification Test",
    abbreviation: "AUDIT",
    category: "Substance Use Assessment",
    evidence: "Level I — WHO, validated in 160+ countries",
    description:
      "The AUDIT is a 10-item screening tool developed by the WHO to assess hazardous and harmful alcohol use. Scores 8+ indicate hazardous drinking; 16+ indicate harmful drinking; 20+ indicate likely alcohol dependence.",
    steps: [
      "Explain that the questions are about alcohol use in the past year",
      "Administer all 10 items (mixed frequency and consequence questions)",
      "Score: Questions 1–8 scored 0–4; Questions 9–10 scored 0, 2, or 4",
      "Total score 0–7: Low risk. 8–15: Hazardous use — brief intervention. 16–19: Harmful use — brief counseling. 20+: Dependence — referral to specialist",
      "Discuss results and provide brief intervention if indicated",
    ],
  },
};

function parseRangeMax(range: string): number {
  const parts = range.split("–");
  return parseInt(parts[parts.length - 1], 10);
}

function parseRangeMin(range: string): number {
  return parseInt(range.split("–")[0], 10);
}

export default function ClinicalToolRunnerPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const tool = TOOL_DATA[slug];

  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);

  if (!tool) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 mb-4">Tool not found: {slug}</p>
        <Link href="/clinical-tools" className="text-[#1F5EFF] hover:underline">
          ← Back to Clinical Tools
        </Link>
      </div>
    );
  }

  const hasQuestions = !!tool.questions;
  const score = answers.reduce((s, a) => s + (a || 0), 0);
  const allAnswered =
    hasQuestions &&
    tool.questions!.length > 0 &&
    answers.length === tool.questions!.length &&
    answers.every((a) => a !== undefined && a >= 0);

  const scoreSeverity = tool.scoring?.find((s) => {
    const min = parseRangeMin(s.range);
    const max = parseRangeMax(s.range);
    return score >= min && score <= max;
  });

  const maxScore = hasQuestions ? tool.questions!.length * 3 : 0;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <Link
        href="/clinical-tools"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Clinical Tools
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/60 mb-1">{tool.category}</div>
            <h1 className="text-2xl font-bold mb-1">
              {tool.abbreviation ? `${tool.abbreviation} — ` : ""}{tool.name}
            </h1>
            <p className="text-white/70 text-sm">{tool.evidence}</p>
          </div>
          {hasQuestions && (
            <button
              onClick={() => router.push(`/assessments/new?tool=${slug}`)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2EC4B6] text-white rounded-xl text-sm font-medium hover:bg-[#26b0a2] transition"
            >
              <Send className="w-4 h-4" /> Assign to Patient
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-3">About This Tool</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{tool.description}</p>
          </div>

          {/* Assessment questionnaire */}
          {hasQuestions && !submitted && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-1">Administer Assessment</h2>
              <p className="text-xs text-slate-500 mb-4">{tool.timeframe}</p>
              <div className="space-y-5">
                {tool.questions!.map((q, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-slate-800 mb-2">
                      {i + 1}. {q}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {tool.options!.map((opt, val) => (
                        <button
                          key={val}
                          onClick={() => {
                            const newAnswers = [...answers];
                            newAnswers[i] = val;
                            setAnswers(newAnswers);
                          }}
                          className={cn(
                            "py-2 text-xs rounded-xl border transition-all",
                            answers[i] === val
                              ? "bg-[#0A2342] text-white border-[#0A2342]"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Crisis warning for PHQ-9 Q9 — outside the map */}
                {slug === "phq9" && answers[8] !== undefined && answers[8] > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    Suicidal ideation reported. Complete safety assessment.
                  </div>
                )}

                <button
                  onClick={() => setSubmitted(true)}
                  disabled={!allAnswered}
                  className="w-full py-3 bg-[#0A2342] text-white rounded-xl font-semibold disabled:opacity-50 hover:bg-[#123A63] transition"
                >
                  {allAnswered
                    ? `Score Assessment (${answers.filter((a) => a >= 0).length}/${tool.questions!.length} complete)`
                    : `${answers.filter((a) => a >= 0).length} of ${tool.questions!.length} answered`}
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {hasQuestions && submitted && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Assessment Results</h2>
              <div
                className={cn(
                  "rounded-2xl p-5 text-center mb-4",
                  scoreSeverity?.color || "bg-slate-50 text-slate-700"
                )}
              >
                <div className="text-5xl font-bold mb-1">{score}</div>
                <div className="font-semibold text-lg">{scoreSeverity?.label || "Score"}</div>
                <div className="text-sm opacity-70">out of {maxScore}</div>
              </div>

              {scoreSeverity && (
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <div className="text-xs font-semibold text-slate-500 mb-1">CLINICAL RECOMMENDATION</div>
                  <p className="text-sm text-slate-700">{scoreSeverity.action}</p>
                </div>
              )}

              <div className="space-y-1 mb-4">
                {tool.scoring!.map((s) => {
                  const min = parseRangeMin(s.range);
                  const max = parseRangeMax(s.range);
                  const isActive = score >= min && score <= max;
                  return (
                    <div
                      key={s.range}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-xl text-xs",
                        isActive ? s.color : "text-slate-500"
                      )}
                    >
                      <span className="font-medium">{s.range}</span>
                      <span>{s.label}</span>
                      <span className="text-xs opacity-70">{s.action.split(";")[0]}</span>
                    </div>
                  );
                })}
              </div>

              {/* PHQ-9 Q9 crisis warning in results */}
              {slug === "phq9" && answers[8] !== undefined && answers[8] > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Question 9 endorsed (score={answers[8]}). Safety assessment required immediately.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setAnswers([]);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm"
                >
                  Retake
                </button>
                <button className="flex-1 py-2.5 bg-[#2EC4B6] text-white rounded-xl text-sm font-semibold">
                  Save to Record
                </button>
              </div>
            </div>
          )}

          {/* Steps (non-questionnaire tools) */}
          {tool.steps && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Administration Guide</h2>
              <ol className="space-y-3">
                {tool.steps.map((stepText, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-[#0A2342] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">
                      {i + 1}
                    </span>
                    {stepText}
                  </li>
                ))}
              </ol>
              {tool.crisis_note && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {tool.crisis_note}
                </div>
              )}
              {tool.scoring_summary && (
                <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  <strong>Scoring: </strong>
                  {tool.scoring_summary}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/assessments/new?tool=${slug}`)}
                className="w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Assign to Patient
              </button>
              <a
                href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(tool.abbreviation || slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-slate-50"
              >
                <ExternalLink className="w-4 h-4" /> Research Evidence
              </a>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">Evidence Base</span>
            </div>
            <p className="text-xs text-amber-700">{tool.evidence}</p>
          </div>

          {hasQuestions && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <div className="text-xs font-semibold text-blue-700 mb-2">Assessment Info</div>
              <div className="space-y-1 text-xs text-blue-700">
                <div>{tool.questions!.length} questions</div>
                <div>Score range: 0–{maxScore}</div>
                <div>Takes ~{Math.ceil(tool.questions!.length / 3)} minutes</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
