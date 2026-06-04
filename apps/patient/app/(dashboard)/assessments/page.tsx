"use client";

import { useState } from "react";
import {
  ClipboardList, ChevronRight, CheckCircle2, Clock, AlertCircle,
  TrendingDown, TrendingUp, Minus, Activity, Brain, Info
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

const MOCK_PENDING = [
  {
    id: "a1", code: "PHQ9", name: "PHQ-9 Depression Screening",
    description: "A 9-question screening tool for depression severity.",
    estimated_minutes: 5, questions: 9, requested_by: "Dr. Smith",
    requested_at: "2025-12-15",
  },
];

const MOCK_COMPLETED = [
  { id: "c1", code: "PHQ9", name: "PHQ-9", score: 13, severity: "Moderate", date: "2025-11-15", trend: "stable" },
  { id: "c2", code: "GAD7", name: "GAD-7", score: 8, severity: "Mild", date: "2025-11-15", trend: "improving" },
  { id: "c3", code: "PHQ9", name: "PHQ-9", score: 14, severity: "Moderate", date: "2025-10-01", trend: null },
  { id: "c4", code: "GAD7", name: "GAD-7", score: 10, severity: "Moderate", date: "2025-10-01", trend: null },
];

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking so slowly that others could have noticed",
  "Thoughts that you would be better off dead or of hurting yourself",
];

const RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

export default function PatientAssessmentsPage() {
  const [activeAssessment, setActiveAssessment] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);

  const totalScore = Object.values(responses).reduce((s, v) => s + v, 0);

  const handleResponse = (questionIdx: number, value: number) => {
    const newResponses = { ...responses, [questionIdx]: value };
    setResponses(newResponses);

    if (questionIdx < PHQ9_QUESTIONS.length - 1) {
      setTimeout(() => setCurrentQ(questionIdx + 1), 300);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const getInterpretation = (score: number) => {
    if (score <= 4) return { label: "Minimal", color: "text-green-600", desc: "Minimal symptoms" };
    if (score <= 9) return { label: "Mild", color: "text-yellow-600", desc: "Mild depression symptoms" };
    if (score <= 14) return { label: "Moderate", color: "text-orange-600", desc: "Moderate depression" };
    if (score <= 19) return { label: "Moderately Severe", color: "text-red-600", desc: "Moderately severe depression" };
    return { label: "Severe", color: "text-red-800", desc: "Severe depression" };
  };

  if (activeAssessment && !submitted) {
    const progress = Object.keys(responses).length / PHQ9_QUESTIONS.length * 100;
    const allAnswered = Object.keys(responses).length === PHQ9_QUESTIONS.length;
    const q = PHQ9_QUESTIONS[currentQ];

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-800">PHQ-9 Assessment</h2>
              <span className="text-sm text-slate-500">{Object.keys(responses).length}/{PHQ9_QUESTIONS.length}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Question */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-6 mb-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Question {currentQ + 1} of {PHQ9_QUESTIONS.length}</p>
            <p className="text-slate-400 text-sm mb-4 italic">
              Over the last 2 weeks, how often have you been bothered by the following problem?
            </p>
            <p className="text-lg font-semibold text-slate-800 mb-6">{q}</p>

            <div className="space-y-2.5">
              {RESPONSE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleResponse(currentQ, opt.value)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                    responses[currentQ] === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-800"
                      : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 text-slate-700"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    responses[currentQ] === opt.value ? "border-blue-500 bg-blue-500" : "border-slate-300"
                  )}>
                    {responses[currentQ] === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="ml-auto text-xs text-slate-400">({opt.value} pts)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {currentQ > 0 ? (
              <button
                onClick={() => setCurrentQ(currentQ - 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ← Back
              </button>
            ) : <div />}
            {allAnswered && (
              <button
                onClick={handleSubmit}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                Submit Assessment
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    const interpretation = getInterpretation(totalScore);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Assessment Complete!</h2>
          <p className="text-slate-500 text-sm mb-6">Your results have been sent to Dr. Smith for review.</p>

          <div className="bg-slate-50 rounded-xl p-5 mb-6">
            <div className={cn("text-4xl font-bold mb-1", interpretation.color)}>{totalScore}</div>
            <div className="text-slate-500 text-sm">out of 27</div>
            <div className={cn("font-semibold mt-2", interpretation.color)}>{interpretation.label}</div>
            <div className="text-slate-600 text-sm mt-1">{interpretation.desc}</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-blue-800">
              <strong>Please remember:</strong> This is a screening tool, not a diagnosis.
              Your therapist will review these results and discuss them with you.
            </p>
          </div>

          {totalScore >= 15 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-red-800">
                <strong>Need support now?</strong> If you&apos;re in crisis, please call{" "}
                <span className="font-bold">988</span> or text HOME to 741741.
              </p>
            </div>
          )}

          <button
            onClick={() => { setActiveAssessment(null); setSubmitted(false); setResponses({}); setCurrentQ(0); }}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assessments</h1>
          <p className="text-slate-500 text-sm mt-1">Standardized measures to track your mental health</p>
        </div>

        {/* Pending */}
        {MOCK_PENDING.length > 0 && (
          <div>
            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending Assessments ({MOCK_PENDING.length})
            </h2>
            {MOCK_PENDING.map((a) => (
              <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">{a.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{a.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>{a.questions} questions · ~{a.estimated_minutes} min</span>
                      <span>Requested by {a.requested_by}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveAssessment(a.id)}
                    className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Start →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Past results */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Past Assessments</h2>
          <div className="space-y-3">
            {MOCK_COMPLETED.map((a) => {
              const trend = a.trend === "improving"
                ? { icon: TrendingDown, color: "text-green-600", label: "Improving" }
                : a.trend === "worsening"
                  ? { icon: TrendingUp, color: "text-red-600", label: "Worsening" }
                  : { icon: Minus, color: "text-slate-500", label: "Stable" };
              const TrendIcon = trend.icon;
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{a.name}</span>
                        {a.trend && (
                          <span className={cn("flex items-center gap-1 text-xs font-medium", trend.color)}>
                            <TrendIcon className="w-3 h-3" />
                            {trend.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{formatDate(a.date)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">{a.score}</div>
                      <div className="text-xs text-slate-500">{a.severity}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
