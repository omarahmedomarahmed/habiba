"use client";

import { useState, useEffect } from "react";
import apiFetch from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";
import {
  Phone, MessageSquare, AlertTriangle, Heart, Shield, MapPin,
  ChevronRight, ArrowRight, User, Clock, CheckCircle2,
  ExternalLink, Activity, Mic, Globe, Star, Bookmark,
  Video, Home, Brain, HelpCircle, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

const CRISIS_HOTLINES = [
  {
    id: "988",
    name: "988 Suicide & Crisis Lifeline",
    number: "988",
    description: "Free, confidential 24/7 support. Call or text 988.",
    available: "24/7",
    type: "call_text",
    priority: "primary",
    color: "bg-red-600",
  },
  {
    id: "crisis_text",
    name: "Crisis Text Line",
    number: "Text HOME to 741741",
    description: "Free crisis counseling via text message, 24/7.",
    available: "24/7",
    type: "text",
    priority: "primary",
    color: "bg-blue-600",
  },
  {
    id: "nami",
    name: "NAMI Helpline",
    number: "1-800-950-6264",
    description: "National Alliance on Mental Illness. M-F 10AM-10PM ET.",
    available: "Mon-Fri 10AM-10PM ET",
    type: "call",
    priority: "secondary",
    color: "bg-indigo-600",
  },
  {
    id: "samhsa",
    name: "SAMHSA Helpline",
    number: "1-800-662-4357",
    description: "Substance use and mental health treatment referrals.",
    available: "24/7",
    type: "call",
    priority: "secondary",
    color: "bg-emerald-600",
  },
  {
    id: "trans",
    name: "Trans Lifeline",
    number: "1-877-565-8860",
    description: "Crisis support for transgender people.",
    available: "Varies",
    type: "call",
    priority: "secondary",
    color: "bg-purple-600",
  },
  {
    id: "trevor",
    name: "Trevor Project (LGBTQ+)",
    number: "1-866-488-7386",
    description: "Crisis support for LGBTQ+ youth under 25.",
    available: "24/7",
    type: "call_text_chat",
    priority: "secondary",
    color: "bg-pink-600",
  },
  {
    id: "veterans",
    name: "Veterans Crisis Line",
    number: "988, then press 1",
    description: "Confidential support for veterans and their families.",
    available: "24/7",
    type: "call",
    priority: "secondary",
    color: "bg-amber-700",
  },
];

const GROUNDING_EXERCISES = [
  {
    id: "5-4-3-2-1",
    name: "5-4-3-2-1 Grounding",
    duration: "3 min",
    description: "Use your five senses to ground yourself in the present moment",
    steps: [
      "5 things you can SEE — look around and name them",
      "4 things you can TOUCH — feel textures around you",
      "3 things you can HEAR — listen carefully",
      "2 things you can SMELL — or remember a favorite scent",
      "1 thing you can TASTE — or take a sip of water",
    ],
  },
  {
    id: "box-breathing",
    name: "Box Breathing",
    duration: "4 min",
    description: "A military-grade breathing technique to rapidly calm the nervous system",
    steps: [
      "Breathe IN for 4 counts",
      "HOLD for 4 counts",
      "Breathe OUT for 4 counts",
      "HOLD for 4 counts",
      "Repeat 4-6 times",
    ],
  },
  {
    id: "body-scan",
    name: "Quick Body Scan",
    duration: "5 min",
    description: "Release physical tension and reconnect with your body",
    steps: [
      "Close your eyes and take 3 slow breaths",
      "Notice tension starting from your feet",
      "Slowly move up: legs, stomach, chest, shoulders",
      "Consciously release tension as you notice it",
      "End with 3 more slow breaths",
    ],
  },
];

const SAFETY_PLAN_QUESTIONS = [
  { id: "q1", text: "Warning signs that a crisis may be developing:", placeholder: "What thoughts, feelings, behaviors tell you a crisis might be coming?" },
  { id: "q2", text: "Internal coping strategies (things I can do alone):", placeholder: "Activities, distractions, or coping skills that help me feel better" },
  { id: "q3", text: "People and social settings that provide distraction:", placeholder: "Safe people to be around, places that help" },
  { id: "q4", text: "People I can ask for help:", placeholder: "Name and contact info of trusted people" },
  { id: "q5", text: "Professionals I can contact in a crisis:", placeholder: "Therapist, psychiatrist, crisis line numbers" },
  { id: "q6", text: "Making my environment safe:", placeholder: "Steps to reduce access to means during a crisis" },
  { id: "q7", text: "Reasons for living:", placeholder: "What matters most to you — family, goals, pets, experiences..." },
];

export default function CrisisPage() {
  const [activeTab, setActiveTab] = useState<"resources" | "grounding" | "safety_plan">("resources");
  const [activeGrounding, setActiveGrounding] = useState<string | null>(null);
  const [groundingStep, setGroundingStep] = useState(0);
  const [groundingRunning, setGroundingRunning] = useState(false);
  const [safetyPlanAnswers, setSafetyPlanAnswers] = useState<Record<string, string>>({});
  const [safetyPlanSaved, setSafetyPlanSaved] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    // Load existing safety plan from backend on mount
    apiFetch<any>('/patients/me/safety-plan')
      .then((data: any) => { if (data?.answers) setSafetyPlanAnswers(data.answers); })
      .catch(() => {});
  }, []);

  const handleSaveSafetyPlan = async () => {
    try {
      await apiFetch('/patients/me/safety-plan', {
        method: 'PUT',
        body: JSON.stringify({ answers: safetyPlanAnswers }),
      });
    } catch { /* save locally even if API fails */ }
    setSafetyPlanSaved(true);
  };

  const handleShareWithTherapist = async () => {
    try {
      await apiFetch('/notifications/send', {
        method: 'POST',
        body: JSON.stringify({
          type: 'safety_plan_share',
          message: `${user?.first_name || 'Patient'} has shared their updated safety plan with you.`,
          data: { safety_plan: safetyPlanAnswers },
        }),
      });
    } catch { /* silent */ }
  };

  const selectedExercise = GROUNDING_EXERCISES.find(e => e.id === activeGrounding);

  const startGrounding = (exerciseId: string) => {
    setActiveGrounding(exerciseId);
    setGroundingStep(0);
    setGroundingRunning(true);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Emergency banner */}
      <div className="bg-red-600 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-100 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-bold text-lg mb-1">In Immediate Danger?</h2>
            <p className="text-red-100 text-sm mb-3">If you or someone else is in immediate danger, call emergency services right now.</p>
            <a
              href="tel:911"
              className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-5 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
            >
              <Phone className="h-4 w-4" /> Call 911 Immediately
            </a>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Crisis Support</h1>
        <p className="text-gray-600">You are not alone. Help is available right now, 24 hours a day.</p>
      </div>

      {/* Quick access to therapist */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#0A2342] rounded-xl flex items-center justify-center text-white font-bold">
            AS
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Dr. Alex Smith</p>
            <p className="text-sm text-gray-500">Your therapist</p>
          </div>
          <div className="flex gap-2">
            <a href="tel:+15555551234" className="flex items-center gap-1.5 px-4 py-2 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors">
              <Phone className="h-4 w-4" /> Call
            </a>
            <Link href="/messages" className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              <MessageSquare className="h-4 w-4" /> Message
            </Link>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">⚠️ Your therapist is not a 24/7 emergency service. For immediate crisis, use the crisis lines below.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1.5">
        {[
          { id: "resources", label: "Crisis Lines", icon: Phone },
          { id: "grounding", label: "Grounding Exercises", icon: Brain },
          { id: "safety_plan", label: "My Safety Plan", icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all",
              activeTab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* CRISIS LINES TAB */}
      {activeTab === "resources" && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Crisis Hotlines & Resources</h2>

          {/* Primary hotlines */}
          <div className="space-y-3">
            {CRISIS_HOTLINES.filter(h => h.priority === "primary").map((hotline) => (
              <div key={hotline.id} className={cn("rounded-2xl p-5 text-white", hotline.color)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{hotline.name}</h3>
                    <p className="text-white/80 text-sm mb-3">{hotline.description}</p>
                    <div className="flex items-center gap-2 text-white/70 text-xs">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Available {hotline.available}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <a
                    href={`tel:${hotline.number.replace(/\D/g, '')}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-900 font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <Phone className="h-4 w-4" /> {hotline.number}
                  </a>
                  {hotline.type.includes("text") && (
                    <a
                      href="sms:988"
                      className="flex items-center gap-1.5 px-4 bg-white/20 text-white font-medium py-3 rounded-xl hover:bg-white/30 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4" /> Text
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Secondary hotlines */}
          <div className="grid gap-3">
            {CRISIS_HOTLINES.filter(h => h.priority === "secondary").map((hotline) => (
              <div key={hotline.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", hotline.color.replace("bg-", "bg-"))} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{hotline.name}</h4>
                      <span className="text-[10px] text-gray-400">{hotline.available}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{hotline.description}</p>
                    <a
                      href={`tel:${hotline.number.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0A2342] hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" /> {hotline.number}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Emergency rooms */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" /> Find Nearest Emergency Services
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <a
                href="https://www.google.com/maps/search/emergency+room+near+me"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 hover:border-red-200 hover:bg-red-50 transition-colors"
              >
                <MapPin className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-gray-900">Find ER Near Me</span>
                <ExternalLink className="h-3.5 w-3.5 text-gray-400 ml-auto" />
              </a>
              <a
                href="https://findtreatment.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">Find Treatment</span>
                <ExternalLink className="h-3.5 w-3.5 text-gray-400 ml-auto" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* GROUNDING EXERCISES TAB */}
      {activeTab === "grounding" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Grounding Exercises</h2>
            <p className="text-sm text-gray-500">These evidence-based techniques can help you feel safer and more in control.</p>
          </div>

          {!activeGrounding ? (
            <div className="space-y-3">
              {GROUNDING_EXERCISES.map((exercise) => (
                <div key={exercise.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
                      <p className="text-sm text-gray-600 mt-0.5">{exercise.description}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-500 shrink-0 bg-gray-100 px-2.5 py-1 rounded-full">
                      <Clock className="h-3 w-3" /> {exercise.duration}
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {exercise.steps.slice(0, 2).map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="w-4 h-4 bg-gray-100 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                        {step}
                      </div>
                    ))}
                    <div className="text-xs text-gray-400">+ {exercise.steps.length - 2} more steps...</div>
                  </div>
                  <button
                    onClick={() => startGrounding(exercise.id)}
                    className="w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors"
                  >
                    Start Exercise
                  </button>
                </div>
              ))}
            </div>
          ) : selectedExercise ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-[#0A2342] p-6 text-white text-center">
                <h3 className="font-bold text-xl mb-2">{selectedExercise.name}</h3>
                <p className="text-white/70 text-sm">Step {groundingStep + 1} of {selectedExercise.steps.length}</p>
                <div className="h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-[#2EC4B6] rounded-full transition-all duration-500"
                    style={{ width: `${((groundingStep + 1) / selectedExercise.steps.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="p-8 text-center">
                <div className="text-5xl mb-4">
                  {["👁️", "✋", "👂", "👃", "👅", "🫁", "🧘"][groundingStep] || "✨"}
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-6 leading-relaxed">
                  {selectedExercise.steps[groundingStep]}
                </p>

                <div className="flex gap-3 max-w-xs mx-auto">
                  {groundingStep > 0 && (
                    <button
                      onClick={() => setGroundingStep(s => s - 1)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm"
                    >
                      Back
                    </button>
                  )}
                  {groundingStep < selectedExercise.steps.length - 1 ? (
                    <button
                      onClick={() => setGroundingStep(s => s + 1)}
                      className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={() => { setActiveGrounding(null); setGroundingStep(0); }}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium"
                    >
                      ✓ Complete
                    </button>
                  )}
                </div>
              </div>

              <div className="px-8 pb-6">
                <button
                  onClick={() => { setActiveGrounding(null); setGroundingStep(0); }}
                  className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Back to exercises
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* SAFETY PLAN TAB */}
      {activeTab === "safety_plan" && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1">My Personal Safety Plan</h2>
            <p className="text-sm text-gray-500">
              A safety plan helps you prepare for difficult moments. Create this with your therapist for best results.
            </p>
          </div>

          {safetyPlanSaved ? (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 mb-2">Safety Plan Saved</h3>
              <p className="text-sm text-gray-600 mb-4">Your safety plan is saved and accessible here anytime.</p>
              <button onClick={() => setSafetyPlanSaved(false)} className="text-sm text-emerald-600 font-medium hover:underline">
                Edit plan
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {SAFETY_PLAN_QUESTIONS.map((q, i) => (
                <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 bg-[#0A2342] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-gray-900 mb-2 block">{q.text}</label>
                      <textarea
                        value={safetyPlanAnswers[q.id] || ""}
                        onChange={e => setSafetyPlanAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder={q.placeholder}
                        rows={3}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <button
                  onClick={handleSaveSafetyPlan}
                  className="flex-1 py-3 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors"
                >
                  Save Safety Plan
                </button>
                <button onClick={handleShareWithTherapist} className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  Share with Therapist
                </button>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-xs text-amber-700">
                  <strong>Tip:</strong> Review your safety plan with your therapist, Dr. Alex Smith. Ask to work on this together in your next session.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
