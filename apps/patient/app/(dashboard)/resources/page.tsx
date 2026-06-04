"use client";

import { useState } from "react";
import {
  BookOpen, Wind, Heart, Shield, Brain, Play, Clock,
  Star, Download, ChevronRight, Headphones, FileText,
  Target, Zap, Music, Sun, Moon
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "breathing", label: "Breathing" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "cbt", label: "CBT Tools" },
  { key: "sleep", label: "Sleep" },
  { key: "crisis", label: "Crisis Support" },
  { key: "homework", label: "From Therapist" },
];

const RESOURCES = [
  {
    id: "r1", category: "breathing", type: "exercise",
    title: "4-7-8 Breathing Technique",
    description: "A calming breathing pattern for anxiety reduction and sleep improvement. Inhale 4 counts, hold 7, exhale 8.",
    duration: "5 min", icon: Wind, color: "text-blue-600 bg-blue-50",
    recommended_by_therapist: true, tags: ["anxiety", "sleep", "relaxation"],
  },
  {
    id: "r2", category: "mindfulness", type: "exercise",
    title: "Body Scan Meditation",
    description: "A guided mindfulness practice to increase body awareness and release tension.",
    duration: "10 min", icon: Headphones, color: "text-purple-600 bg-purple-50",
    recommended_by_therapist: false, tags: ["mindfulness", "relaxation"],
  },
  {
    id: "r3", category: "cbt", type: "worksheet",
    title: "Thought Record Worksheet",
    description: "Track negative automatic thoughts, identify distortions, and develop balanced alternatives.",
    duration: "15 min", icon: FileText, color: "text-green-600 bg-green-50",
    recommended_by_therapist: true, tags: ["CBT", "thoughts", "homework"],
  },
  {
    id: "r4", category: "cbt", type: "worksheet",
    title: "Behavioral Activation Log",
    description: "Schedule and track activities that improve mood and reduce avoidance behaviors.",
    duration: "Daily", icon: Target, color: "text-amber-600 bg-amber-50",
    recommended_by_therapist: true, tags: ["CBT", "depression", "homework"],
  },
  {
    id: "r5", category: "sleep", type: "guide",
    title: "Sleep Hygiene Guide",
    description: "Evidence-based strategies to improve sleep quality and establish healthy sleep patterns.",
    duration: "5 min read", icon: Moon, color: "text-indigo-600 bg-indigo-50",
    recommended_by_therapist: true, tags: ["sleep", "CBT"],
  },
  {
    id: "r6", category: "crisis", type: "resource",
    title: "Safety Planning Tool",
    description: "Create your personalized safety plan with warning signs, coping strategies, and support contacts.",
    duration: "20 min", icon: Shield, color: "text-red-600 bg-red-50",
    recommended_by_therapist: false, tags: ["crisis", "safety"],
  },
  {
    id: "r7", category: "mindfulness", type: "exercise",
    title: "5-4-3-2-1 Grounding",
    description: "Use your senses to ground yourself during anxiety or panic attacks. Quick and effective.",
    duration: "5 min", icon: Zap, color: "text-cyan-600 bg-cyan-50",
    recommended_by_therapist: false, tags: ["anxiety", "grounding", "panic"],
  },
  {
    id: "r8", category: "sleep", type: "exercise",
    title: "Progressive Muscle Relaxation",
    description: "Systematically tense and release muscle groups to achieve deep physical relaxation.",
    duration: "15 min", icon: Sun, color: "text-orange-600 bg-orange-50",
    recommended_by_therapist: false, tags: ["sleep", "relaxation", "anxiety"],
  },
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  exercise: Play, worksheet: FileText, guide: BookOpen, resource: Shield,
};

export default function PatientResourcesPage() {
  const [category, setCategory] = useState("all");
  const [activeResource, setActiveResource] = useState<string | null>(null);

  const filtered = RESOURCES.filter((r) => category === "all" || r.category === category);
  const therapistRecommended = RESOURCES.filter((r) => r.recommended_by_therapist);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resources</h1>
          <p className="text-slate-500 text-sm mt-1">Tools and exercises to support your mental health journey</p>
        </div>

        {/* From Therapist */}
        {therapistRecommended.length > 0 && (
          <div>
            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              Recommended by Dr. Smith
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {therapistRecommended.map((resource) => {
                const TypeIcon = TYPE_ICONS[resource.type] || Play;
                return (
                  <button
                    key={resource.id}
                    onClick={() => setActiveResource(resource.id)}
                    className="bg-white rounded-xl border border-amber-200 shadow-card p-4 text-left hover:shadow-card-hover transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", resource.color)}>
                        <resource.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-sm">{resource.title}</h3>
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                            Homework
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{resource.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {resource.duration}
                          </span>
                          <span className="flex items-center gap-1">
                            <TypeIcon className="w-3 h-3" />
                            {resource.type}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors",
                  category === cat.key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* All Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((resource) => {
            const TypeIcon = TYPE_ICONS[resource.type] || Play;
            return (
              <button
                key={resource.id}
                onClick={() => setActiveResource(resource.id)}
                className="bg-white rounded-xl border border-slate-200 shadow-card p-4 text-left hover:shadow-card-hover transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", resource.color)}>
                    <resource.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-sm truncate">{resource.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{resource.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{resource.duration}</span>
                      <TypeIcon className="w-3 h-3 ml-1" />
                      <span>{resource.type}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Crisis Section */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Need Immediate Help?</h3>
              <div className="mt-2 space-y-1.5 text-sm text-red-700">
                <p>📞 <strong>988</strong> — Suicide & Crisis Lifeline (call or text)</p>
                <p>💬 <strong>741741</strong> — Crisis Text Line (text HOME)</p>
                <p>🆘 <strong>911</strong> — Emergency Services</p>
                <p>🏥 <strong>988lifeline.org</strong> — Online chat available</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
