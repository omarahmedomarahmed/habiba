"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ChevronRight, ChevronLeft, ArrowRight, Mail, AlertTriangle } from "lucide-react";
import { getApiUrl } from "@/lib/env";

const API_URL = getApiUrl();

const ASSESSMENTS = {
  phq9: {
    id: "phq9",
    name: "PHQ-9",
    label: "Depression Screening",
    description: "9-question depression severity scale",
    questions: [
      "Little interest or pleasure in doing things?",
      "Feeling down, depressed, or hopeless?",
      "Trouble falling or staying asleep, or sleeping too much?",
      "Feeling tired or having little energy?",
      "Poor appetite or overeating?",
      "Feeling bad about yourself — or that you are a failure or have let yourself or your family down?",
      "Trouble concentrating on things, such as reading or watching TV?",
      "Moving or speaking so slowly others could have noticed? Or being so fidgety or restless you moved around a lot more than usual?",
      "Thoughts that you would be better off dead, or of hurting yourself in some way?",
    ],
    scale: [0, 1, 2, 3],
    scaleLabels: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    severity: (score: number) => {
      if (score <= 4) return { label: "Minimal", color: "green", recommend: false };
      if (score <= 9) return { label: "Mild", color: "yellow", recommend: true };
      if (score <= 14) return { label: "Moderate", color: "orange", recommend: true };
      return { label: "Severe", color: "red", recommend: true };
    },
    maxScore: 27,
  },
  gad7: {
    id: "gad7",
    name: "GAD-7",
    label: "Anxiety Assessment",
    description: "7-question anxiety disorder scale",
    questions: [
      "Feeling nervous, anxious, or on edge?",
      "Not being able to stop or control worrying?",
      "Worrying too much about different things?",
      "Trouble relaxing?",
      "Being so restless that it's hard to sit still?",
      "Becoming easily annoyed or irritable?",
      "Feeling afraid as if something awful might happen?",
    ],
    scale: [0, 1, 2, 3],
    scaleLabels: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    severity: (score: number) => {
      if (score <= 4) return { label: "Minimal", color: "green", recommend: false };
      if (score <= 9) return { label: "Mild", color: "yellow", recommend: true };
      return { label: "Moderate–Severe", color: "red", recommend: true };
    },
    maxScore: 21,
  },
  pcl5: {
    id: "pcl5",
    name: "PCL-5",
    label: "PTSD Screen",
    description: "5-question trauma symptom screen",
    questions: [
      "Having nightmares about a traumatic event, or thinking about it when you didn't want to?",
      "Trying hard not to think about it, or avoiding situations that reminded you of it?",
      "Being constantly on guard, watchful, or easily startled?",
      "Feeling numb or detached from people, activities, or your surroundings?",
      "Feeling guilty or unable to stop blaming yourself or others for a traumatic event?",
    ],
    scale: [0, 1, 2, 3, 4],
    scaleLabels: ["Not at all", "A little bit", "Moderately", "Quite a bit", "Extremely"],
    severity: (score: number) => {
      if (score <= 9) return { label: "Below threshold", color: "green", recommend: false };
      return { label: "Possible PTSD symptoms", color: "orange", recommend: true };
    },
    maxScore: 20,
  },
} as const;

type AssessmentKey = keyof typeof ASSESSMENTS;

const SEVERITY_COLORS: Record<string, string> = {
  green: "bg-green-50 border-green-200 text-green-800",
  yellow: "bg-yellow-50 border-yellow-200 text-yellow-800",
  orange: "bg-orange-50 border-orange-200 text-orange-800",
  red: "bg-red-50 border-red-200 text-red-800",
};

export function PublicAssessmentTaker() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<AssessmentKey[]>([]);
  const [assessmentIdx, setAssessmentIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<AssessmentKey, number[]>>({ phq9: [], gad7: [], pcl5: [] });
  const [email, setEmail] = useState("");
  const [wantsEmail, setWantsEmail] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const toggleAssessment = (key: AssessmentKey) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const currentKey = selected[assessmentIdx] as AssessmentKey | undefined;
  const current = currentKey ? ASSESSMENTS[currentKey] : null;

  const handleAnswer = (val: number) => {
    if (!currentKey || !current) return;
    const updated = [...(answers[currentKey] || [])];
    updated[questionIdx] = val;
    setAnswers((prev) => ({ ...prev, [currentKey]: updated }));

    const isLast = questionIdx === current.questions.length - 1;
    const isLastAssessment = assessmentIdx === selected.length - 1;

    if (isLast) {
      if (isLastAssessment) {
        setStep(3);
      } else {
        setAssessmentIdx((i) => i + 1);
        setQuestionIdx(0);
      }
    } else {
      setQuestionIdx((i) => i + 1);
    }
  };

  const getScore = (key: AssessmentKey) =>
    (answers[key] || []).reduce((sum, v) => sum + (v ?? 0), 0);

  const results = selected.map((key) => {
    const def = ASSESSMENTS[key];
    const score = getScore(key);
    const sev = def.severity(score);
    return { key, name: def.name, label: def.label, score, maxScore: def.maxScore, severity: sev };
  });

  const anyRecommend = results.some((r) => r.severity.recommend);

  const handleEmailSubmit = async () => {
    if (!email || !email.includes("@")) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const res = await fetch(`${API_URL}/assessments/public/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          results: results.map((r) => ({
            type: r.key,
            score: r.score,
            severity: r.severity.label,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1 — Choose
  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Choose Your Assessments</h3>
          <p className="text-slate-500">Select one or more. Takes 2–5 minutes. Results are private and never stored without your consent.</p>
        </div>
        <div className="space-y-3 mb-8">
          {(Object.keys(ASSESSMENTS) as AssessmentKey[]).map((key) => {
            const def = ASSESSMENTS[key];
            const isSelected = selected.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleAssessment(key)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                  isSelected
                    ? "border-[#2EC4B6] bg-[#2EC4B6]/5"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? "border-[#2EC4B6] bg-[#2EC4B6]" : "border-slate-300"
                }`}>
                  {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900">{def.name} — {def.label}</div>
                  <div className="text-sm text-slate-500">{def.description} · {def.questions.length} questions</div>
                </div>
              </button>
            );
          })}
        </div>
        <button
          disabled={selected.length === 0}
          onClick={() => { setStep(2); setAssessmentIdx(0); setQuestionIdx(0); }}
          className="w-full py-4 bg-[#2EC4B6] text-white rounded-2xl font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#26b0a2] transition-colors flex items-center justify-center gap-2"
        >
          Start Assessment <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-center text-xs text-slate-400 mt-4">Not a clinical diagnosis. For self-awareness only.</p>
      </div>
    );
  }

  // Step 2 — Questions
  if (step === 2 && current && currentKey) {
    const totalQuestions = selected.reduce((sum, k) => sum + ASSESSMENTS[k].questions.length, 0);
    const completedBefore = selected.slice(0, assessmentIdx).reduce((sum, k) => sum + ASSESSMENTS[k].questions.length, 0);
    const globalIdx = completedBefore + questionIdx;
    const progress = Math.round((globalIdx / totalQuestions) * 100);

    return (
      <div className="max-w-xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
            <span>{current.name} — Q{questionIdx + 1} of {current.questions.length}</span>
            <span>{progress}% complete</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2EC4B6] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
          <p className="text-sm font-medium text-[#2EC4B6] mb-3 uppercase tracking-wide">Over the past 2 weeks, how often have you been bothered by:</p>
          <p className="text-lg font-semibold text-slate-900 leading-relaxed">{current.questions[questionIdx]}</p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {current.scale.map((val, i) => (
            <button
              key={val}
              onClick={() => handleAnswer(val)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-[#2EC4B6] hover:bg-[#2EC4B6]/5 text-left transition-all bg-white"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                {val}
              </div>
              <span className="text-slate-700 font-medium">{current.scaleLabels[i]}</span>
            </button>
          ))}
        </div>

        {questionIdx > 0 && (
          <button
            onClick={() => setQuestionIdx((i) => i - 1)}
            className="mt-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="w-4 h-4" /> Previous question
          </button>
        )}
      </div>
    );
  }

  // Step 3 — Results
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <CheckCircle className="w-12 h-12 text-[#2EC4B6] mx-auto mb-3" />
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Your Results</h3>
        <p className="text-slate-500 text-sm">These scores are for self-awareness only and are not a clinical diagnosis.</p>
      </div>

      {/* Score cards */}
      <div className="space-y-4 mb-6">
        {results.map((r) => (
          <div key={r.key} className={`rounded-2xl border-2 p-5 ${SEVERITY_COLORS[r.severity.color] || SEVERITY_COLORS.green}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-bold text-base">{r.name}</span>
                <span className="text-sm ml-2 opacity-70">— {r.label}</span>
              </div>
              <span className="font-bold text-lg">{r.score} / {r.maxScore}</span>
            </div>
            <div className="text-sm font-semibold">{r.severity.label} symptoms detected</div>
            <div className="mt-2 h-1.5 bg-black/10 rounded-full overflow-hidden">
              <div className="h-full bg-current opacity-40 rounded-full transition-all" style={{ width: `${(r.score / r.maxScore) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation banner */}
      {anyRecommend && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 mb-1">It may be helpful to speak with a therapist</p>
              <p className="text-sm text-amber-700">Your results suggest that professional support could be beneficial. Many people feel significantly better with the right therapist.</p>
              <Link
                href="/find-therapist"
                className="mt-3 inline-flex items-center gap-2 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors"
              >
                Find a therapist now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Email section */}
      {!submitted ? (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#2EC4B6]" /> Email yourself your results
          </h4>
          <p className="text-sm text-slate-500 mb-4">
            Get your results by email — and we&apos;ll include a 50% discount code for your first session with a therapist.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:border-[#2EC4B6] bg-white"
          />
          <label className="flex items-start gap-2 text-sm text-slate-600 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={wantsEmail}
              onChange={(e) => setWantsEmail(e.target.checked)}
              className="mt-0.5 accent-[#2EC4B6]"
            />
            Send me my results and a 50% discount code for my first session
          </label>
          <button
            disabled={!email || !email.includes("@") || !wantsEmail || submitting}
            onClick={handleEmailSubmit}
            className="w-full py-3 bg-[#2EC4B6] text-white rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#26b0a2] transition-colors"
          >
            {submitting ? "Sending…" : "Send My Results"}
          </button>
          {submitError && <p className="text-red-500 text-xs text-center mt-2">Something went wrong. Please try again.</p>}
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-semibold text-green-800">Check your inbox!</p>
          <p className="text-sm text-green-700 mt-1">We&apos;ve sent your results and a 50% discount code for your first session.</p>
        </div>
      )}

      <button
        onClick={() => { setStep(1); setSelected([]); setAnswers({ phq9: [], gad7: [], pcl5: [] }); setSubmitted(false); }}
        className="w-full mt-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
      >
        Take another assessment
      </button>

      <p className="text-center text-xs text-slate-400 mt-4">
        This is not a clinical diagnosis. Results are for self-awareness only. If you are in crisis, please call or text 988.
      </p>
    </div>
  );
}
