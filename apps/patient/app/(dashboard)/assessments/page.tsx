"use client";

import { useState } from "react";
import {
  ClipboardList, CheckCircle2, Clock, ChevronRight, ArrowLeft,
  AlertCircle, TrendingUp, TrendingDown, Minus, Brain, Shield,
  Star, BarChart2, Calendar, Target, Info, ExternalLink,
  Circle, CheckSquare, ArrowRight, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Assessment {
  id: string;
  name: string;
  short_name: string;
  description: string;
  questions: Question[];
  scoring: ScoringRange[];
  status: "pending" | "completed" | "not_started";
  due_date?: string;
  completed_date?: string;
  last_score?: number;
  last_interpretation?: string;
  history: { date: string; score: number; interpretation: string }[];
  required_by_therapist: boolean;
  estimated_minutes: number;
}

interface Question {
  id: string;
  text: string;
  options: { label: string; value: number }[];
}

interface ScoringRange {
  min: number;
  max: number;
  label: string;
  color: string;
  description: string;
}

const PHQ9_QUESTIONS: Question[] = [
  {
    id: "q1", text: "Little interest or pleasure in doing things",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q2", text: "Feeling down, depressed, or hopeless",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q3", text: "Trouble falling or staying asleep, or sleeping too much",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q4", text: "Feeling tired or having little energy",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q5", text: "Poor appetite or overeating",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q6", text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q7", text: "Trouble concentrating on things, such as reading the newspaper or watching television",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q8", text: "Moving or speaking so slowly that other people could have noticed. Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
  {
    id: "q9", text: "Thoughts that you would be better off dead, or of hurting yourself in some way",
    options: [{ label: "Not at all", value: 0 }, { label: "Several days", value: 1 }, { label: "More than half the days", value: 2 }, { label: "Nearly every day", value: 3 }]
  },
];

const ASSESSMENTS: Assessment[] = [
  {
    id: "a1",
    name: "Patient Health Questionnaire",
    short_name: "PHQ-9",
    description: "A validated screening tool for depression severity. 9 questions about how often you've been bothered by depressive symptoms in the past 2 weeks.",
    questions: PHQ9_QUESTIONS,
    scoring: [
      { min: 0, max: 4, label: "Minimal", color: "text-emerald-600", description: "No significant depression symptoms" },
      { min: 5, max: 9, label: "Mild", color: "text-blue-600", description: "Mild depressive symptoms" },
      { min: 10, max: 14, label: "Moderate", color: "text-amber-600", description: "Moderate depressive symptoms" },
      { min: 15, max: 19, label: "Moderately Severe", color: "text-orange-600", description: "Significant depressive symptoms" },
      { min: 20, max: 27, label: "Severe", color: "text-rose-700", description: "Severe depressive symptoms" },
    ],
    status: "pending",
    due_date: "2025-12-22",
    last_score: 13,
    last_interpretation: "Moderate",
    history: [
      { date: "Dec 15, 2025", score: 13, interpretation: "Moderate" },
      { date: "Nov 1, 2025", score: 15, interpretation: "Moderate" },
      { date: "Sep 15, 2025", score: 17, interpretation: "Moderately Severe" },
      { date: "Aug 15, 2024", score: 19, interpretation: "Moderately Severe" },
    ],
    required_by_therapist: true,
    estimated_minutes: 3
  },
  {
    id: "a2",
    name: "Generalized Anxiety Disorder",
    short_name: "GAD-7",
    description: "A validated 7-question assessment measuring anxiety severity over the past 2 weeks.",
    questions: PHQ9_QUESTIONS.slice(0, 7).map(q => ({ ...q, id: `gad_${q.id}` })),
    scoring: [
      { min: 0, max: 4, label: "Minimal", color: "text-emerald-600", description: "No significant anxiety" },
      { min: 5, max: 9, label: "Mild", color: "text-blue-600", description: "Mild anxiety symptoms" },
      { min: 10, max: 14, label: "Moderate", color: "text-amber-600", description: "Moderate anxiety" },
      { min: 15, max: 21, label: "Severe", color: "text-rose-700", description: "Severe anxiety" },
    ],
    status: "completed",
    completed_date: "Dec 15, 2025",
    last_score: 8,
    last_interpretation: "Mild",
    history: [
      { date: "Dec 15, 2025", score: 8, interpretation: "Mild" },
      { date: "Oct 1, 2025", score: 10, interpretation: "Moderate" },
      { date: "Aug 15, 2024", score: 15, interpretation: "Severe" },
    ],
    required_by_therapist: false,
    estimated_minutes: 2
  },
  {
    id: "a3",
    name: "Columbia Suicide Severity Rating",
    short_name: "C-SSRS",
    description: "A brief assessment to understand your current safety and wellbeing. This is completed at every session.",
    questions: [],
    scoring: [],
    status: "completed",
    completed_date: "Dec 15, 2025",
    last_score: 0,
    last_interpretation: "No current ideation",
    history: [],
    required_by_therapist: true,
    estimated_minutes: 1
  },
];

function ScoreBadge({ score, scoring }: { score: number; scoring: ScoringRange[] }) {
  const range = scoring.find(s => score >= s.min && score <= s.max);
  if (!range) return null;
  return <span className={cn("text-xs font-semibold", range.color)}>{range.label}</span>;
}

function MiniScoreChart({ history }: { history: { date: string; score: number }[] }) {
  if (history.length < 2) return null;
  const max = Math.max(...history.map(h => h.score));
  return (
    <div className="flex items-end gap-1 h-8 mt-2">
      {history.slice().reverse().map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <div
            className={cn("w-full rounded-sm", h.score > (history[0]?.score || 0) ? "bg-rose-300" : "bg-emerald-400")}
            style={{ height: `${(h.score / (max * 1.2)) * 100}%`, minHeight: "4px" }}
          />
        </div>
      ))}
    </div>
  );
}

export default function AssessmentsPage() {
  const [takingAssessment, setTakingAssessment] = useState<Assessment | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState(false);
  const [totalScore, setTotalScore] = useState(0);

  const pending = ASSESSMENTS.filter(a => a.status === "pending");
  const done = ASSESSMENTS.filter(a => a.status === "completed");

  const answerQuestion = (questionId: string, value: number) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);

    if (takingAssessment && currentQuestion < takingAssessment.questions.length - 1) {
      setTimeout(() => setCurrentQuestion(q => q + 1), 300);
    } else {
      // Submit
      const score = Object.values(newAnswers).reduce((a, b) => a + b, 0);
      setTotalScore(score);
      setCompleted(true);
    }
  };

  if (takingAssessment) {
    const assessment = takingAssessment;
    const progress = Math.round((currentQuestion / assessment.questions.length) * 100);

    if (completed) {
      const range = assessment.scoring.find(s => totalScore >= s.min && totalScore <= s.max);
      return (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-8 text-center border border-emerald-100">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{assessment.short_name} Complete</h2>
            <p className="text-sm text-gray-600 mb-4">Your results have been shared with Dr. Alex Smith</p>

            <div className="bg-white rounded-2xl p-6 mb-4">
              <p className="text-5xl font-bold text-gray-900 mb-2">{totalScore}</p>
              {range && (
                <>
                  <p className={cn("text-lg font-semibold mb-1", range.color)}>{range.label}</p>
                  <p className="text-sm text-gray-500">{range.description}</p>
                </>
              )}
            </div>

            {assessment.id === "a1" && totalScore >= 15 && (
              <div className="bg-rose-50 rounded-xl p-3 mb-4 text-left">
                <p className="text-sm text-rose-700 font-medium">Your score suggests significant symptoms. Dr. Smith will review this before your next session.</p>
                <p className="text-xs text-rose-600 mt-1">If you need immediate support, call/text 988</p>
              </div>
            )}

            <button
              onClick={() => { setTakingAssessment(null); setCurrentQuestion(0); setAnswers({}); setCompleted(false); }}
              className="w-full py-3 bg-[#0A2342] text-white rounded-xl font-medium hover:bg-[#123A63]"
            >
              Back to Assessments
            </button>
          </div>
        </div>
      );
    }

    const question = assessment.questions[currentQuestion];
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => { setTakingAssessment(null); setCurrentQuestion(0); setAnswers({}); }}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Exit Assessment
        </button>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-gray-900">{assessment.short_name}</h2>
              <p className="text-sm text-gray-500">{assessment.name}</p>
            </div>
            <span className="text-sm text-gray-500">{currentQuestion + 1}/{assessment.questions.length}</span>
          </div>

          {/* Progress */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-[#0A2342] rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Over the <strong>last 2 weeks</strong>, how often have you been bothered by...
          </p>

          <p className="text-base font-semibold text-gray-900 mb-6 leading-relaxed">{question.text}</p>

          <div className="space-y-2">
            {question.options.map(option => (
              <button
                key={option.value}
                onClick={() => answerQuestion(question.id, option.value)}
                className={cn(
                  "w-full text-left px-4 py-3.5 rounded-xl border-2 text-sm font-medium transition-all",
                  answers[question.id] === option.value
                    ? "border-[#0A2342] bg-[#0A2342] text-white"
                    : "border-gray-200 text-gray-700 hover:border-[#0A2342] hover:text-[#0A2342]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {currentQuestion > 0 && (
            <button
              onClick={() => setCurrentQuestion(q => q - 1)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600"
            >
              ← Previous question
            </button>
          )}
        </div>

        <div className="bg-blue-50 rounded-2xl p-3 flex gap-2">
          <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-600">Your responses are shared with Dr. Alex Smith and are part of your clinical record.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
        <p className="text-sm text-gray-500 mt-0.5">Clinical questionnaires that help track your progress</p>
      </div>

      {/* Due now */}
      {pending.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-amber-800">Due for Your Next Session</h3>
          </div>
          <p className="text-xs text-amber-700 mb-3">Dr. Smith has requested these before Session #25 on Dec 22.</p>
          {pending.map(assessment => (
            <div key={assessment.id} className="bg-white rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{assessment.short_name}</p>
                <p className="text-xs text-gray-500">{assessment.name} · ~{assessment.estimated_minutes} min</p>
                {assessment.last_score !== undefined && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    Last score: {assessment.last_score} ({assessment.last_interpretation})
                  </p>
                )}
              </div>
              <button
                onClick={() => { setTakingAssessment(assessment); setCurrentQuestion(0); setAnswers({}); setCompleted(false); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]"
              >
                Start <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed assessments */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Completed
        </h3>
        <div className="space-y-3">
          {done.map(assessment => (
            <div key={assessment.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{assessment.short_name}</p>
                  <p className="text-xs text-gray-500">{assessment.name}</p>
                </div>
                {assessment.last_score !== undefined && assessment.scoring.length > 0 && (
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900">{assessment.last_score}</p>
                    <ScoreBadge score={assessment.last_score} scoring={assessment.scoring} />
                  </div>
                )}
              </div>

              {assessment.history.length > 0 && (
                <>
                  <MiniScoreChart history={assessment.history} />
                  <div className="mt-3 space-y-1">
                    {assessment.history.slice(0, 3).map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{h.date}</span>
                        <div className="flex items-center gap-2">
                          {i > 0 && (
                            <span className={cn(
                              "font-medium",
                              h.score < assessment.history[i - 1]?.score ? "text-emerald-600" :
                              h.score > assessment.history[i - 1]?.score ? "text-rose-500" : "text-gray-400"
                            )}>
                              {h.score < assessment.history[i - 1]?.score ? "↓" : h.score > assessment.history[i - 1]?.score ? "↑" : "–"}
                            </span>
                          )}
                          <span className="font-bold text-gray-900">{h.score}</span>
                          <span className="text-gray-400">{h.interpretation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Completed: {assessment.completed_date}</span>
                {assessment.questions.length > 0 && (
                  <button
                    onClick={() => { setTakingAssessment(assessment); setCurrentQuestion(0); setAnswers({}); setCompleted(false); }}
                    className="ml-auto text-xs text-[#0A2342] font-medium hover:text-[#1E4F8C] flex items-center gap-1"
                  >
                    Retake <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* About assessments */}
      <div className="bg-gray-50 rounded-2xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          These are validated clinical questionnaires used worldwide to track mental health. Your scores are reviewed by Dr. Alex Smith as part of your treatment. They help measure progress objectively over time.
        </p>
      </div>
    </div>
  );
}
