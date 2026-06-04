"use client";

import { useState } from "react";
import {
  BookOpen, Search, Star, Clock, ExternalLink, Download,
  Brain, Heart, Activity, Moon, Zap, Users, ChevronRight,
  Play, FileText, Video, Headphones, BookMarked, Plus,
  CheckCircle2, Bookmark, Share2, Filter, Tag
} from "lucide-react";
import { cn } from "@/lib/utils";

type ResourceCategory = "all" | "anxiety" | "depression" | "sleep" | "relationships" | "mindfulness" | "cbt" | "crisis";
type ResourceType = "article" | "worksheet" | "video" | "audio" | "exercise" | "guide";

interface Resource {
  id: string;
  title: string;
  description: string;
  category: Exclude<ResourceCategory, "all">;
  type: ResourceType;
  duration: string;
  recommended_by: "therapist" | "ai" | "platform";
  saved: boolean;
  completed: boolean;
  new_for_you: boolean;
  difficulty?: "beginner" | "intermediate" | "advanced";
  tags: string[];
}

const RESOURCES: Resource[] = [
  {
    id: "r1",
    title: "Understanding Cognitive Distortions: A CBT Guide",
    description: "Learn to identify the 15 most common cognitive distortions and how they fuel anxiety and depression. Includes interactive worksheet.",
    category: "cbt",
    type: "article",
    duration: "12 min read",
    recommended_by: "therapist",
    saved: true,
    completed: true,
    new_for_you: false,
    difficulty: "beginner",
    tags: ["CBT", "cognitive distortions", "thought records"]
  },
  {
    id: "r2",
    title: "4-7-8 Breathing: Your In-Pocket Anxiety Tool",
    description: "A guided audio walkthrough of the 4-7-8 breathing technique for immediate anxiety relief. Clinically validated.",
    category: "anxiety",
    type: "audio",
    duration: "8 min",
    recommended_by: "therapist",
    saved: true,
    completed: false,
    new_for_you: false,
    tags: ["breathing", "anxiety", "immediate relief"]
  },
  {
    id: "r3",
    title: "Managing Holiday Season Stress",
    description: "Evidence-based strategies for managing the emotional complexity of the holiday season, including family dynamics and perfectionism.",
    category: "anxiety",
    type: "guide",
    duration: "15 min read",
    recommended_by: "therapist",
    saved: false,
    completed: false,
    new_for_you: true,
    difficulty: "beginner",
    tags: ["holiday", "seasonal", "stress management"]
  },
  {
    id: "r4",
    title: "Sleep Hygiene: The 12 Rules That Actually Work",
    description: "A comprehensive guide to improving sleep quality using evidence-based sleep hygiene practices. Includes a 2-week sleep improvement plan.",
    category: "sleep",
    type: "guide",
    duration: "20 min read",
    recommended_by: "ai",
    saved: false,
    completed: false,
    new_for_you: false,
    difficulty: "beginner",
    tags: ["sleep", "sleep hygiene", "insomnia"]
  },
  {
    id: "r5",
    title: "5-4-3-2-1 Grounding Technique (Video)",
    description: "A calming video walkthrough of the grounding technique for anxiety and dissociation. Perfect to use in moments of overwhelm.",
    category: "anxiety",
    type: "video",
    duration: "6 min",
    recommended_by: "therapist",
    saved: false,
    completed: true,
    new_for_you: false,
    tags: ["grounding", "anxiety", "immediate relief", "dissociation"]
  },
  {
    id: "r6",
    title: "Self-Compassion: How to Be Kind to Yourself",
    description: "Dr. Kristin Neff's foundational self-compassion framework adapted for daily practice. Includes the self-compassion break exercise.",
    category: "depression",
    type: "article",
    duration: "18 min read",
    recommended_by: "therapist",
    saved: true,
    completed: false,
    new_for_you: true,
    difficulty: "beginner",
    tags: ["self-compassion", "inner critic", "kindness"]
  },
  {
    id: "r7",
    title: "Thought Record Worksheet",
    description: "The standard CBT thought record worksheet. Use this to document automatic thoughts, identify distortions, and create balanced alternatives.",
    category: "cbt",
    type: "worksheet",
    duration: "10-15 min/entry",
    recommended_by: "therapist",
    saved: true,
    completed: false,
    new_for_you: false,
    tags: ["thought records", "CBT", "homework"]
  },
  {
    id: "r8",
    title: "Body Scan Meditation for Sleep",
    description: "A 20-minute guided body scan meditation specifically designed to help you fall asleep. Based on MBSR principles.",
    category: "sleep",
    type: "audio",
    duration: "20 min",
    recommended_by: "ai",
    saved: false,
    completed: false,
    new_for_you: false,
    tags: ["meditation", "sleep", "mindfulness", "MBSR"]
  },
  {
    id: "r9",
    title: "Crisis Safety Planning: When to Reach Out",
    description: "A clear guide to recognizing when you need immediate support and the steps to take. Includes personal safety plan template.",
    category: "crisis",
    type: "guide",
    duration: "10 min read",
    recommended_by: "platform",
    saved: false,
    completed: false,
    new_for_you: false,
    tags: ["crisis", "safety plan", "emergency"]
  },
];

const CATEGORIES: { id: ResourceCategory; label: string; icon: React.ElementType; color: string }[] = [
  { id: "all", label: "All Resources", icon: BookOpen, color: "text-gray-600" },
  { id: "anxiety", label: "Anxiety", icon: Activity, color: "text-amber-600" },
  { id: "depression", label: "Depression", icon: Heart, color: "text-rose-600" },
  { id: "sleep", label: "Sleep", icon: Moon, color: "text-indigo-600" },
  { id: "cbt", label: "CBT Tools", icon: Brain, color: "text-blue-600" },
  { id: "mindfulness", label: "Mindfulness", icon: Zap, color: "text-emerald-600" },
  { id: "relationships", label: "Relationships", icon: Users, color: "text-purple-600" },
  { id: "crisis", label: "Crisis Support", icon: CheckCircle2, color: "text-red-600" },
];

const TYPE_CONFIG: Record<ResourceType, { icon: React.ElementType; label: string; color: string }> = {
  article: { icon: FileText, label: "Article", color: "text-blue-600 bg-blue-50" },
  worksheet: { icon: FileText, label: "Worksheet", color: "text-amber-600 bg-amber-50" },
  video: { icon: Video, label: "Video", color: "text-rose-600 bg-rose-50" },
  audio: { icon: Headphones, label: "Audio", color: "text-purple-600 bg-purple-50" },
  exercise: { icon: Zap, label: "Exercise", color: "text-emerald-600 bg-emerald-50" },
  guide: { icon: BookMarked, label: "Guide", color: "text-indigo-600 bg-indigo-50" },
};

const RECOMMENDED_BY_CONFIG = {
  therapist: { label: "Dr. Smith recommends", color: "text-blue-700 bg-blue-50" },
  ai: { label: "AI recommended", color: "text-indigo-700 bg-indigo-50" },
  platform: { label: "Platform resource", color: "text-gray-600 bg-gray-100" },
};

export default function ResourcesPage() {
  const [activeCategory, setActiveCategory] = useState<ResourceCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTypeFilter, setActiveTypeFilter] = useState<ResourceType | "all">("all");
  const [savedResources, setSavedResources] = useState<Set<string>>(new Set(RESOURCES.filter(r => r.saved).map(r => r.id)));
  const [completedResources, setCompletedResources] = useState<Set<string>>(new Set(RESOURCES.filter(r => r.completed).map(r => r.id)));

  const filtered = RESOURCES.filter(r => {
    const matchesCategory = activeCategory === "all" || r.category === activeCategory;
    const matchesSearch = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = activeTypeFilter === "all" || r.type === activeTypeFilter;
    return matchesCategory && matchesSearch && matchesType;
  });

  const toggleSaved = (id: string) => {
    setSavedResources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleCompleted = (id: string) => {
    setCompletedResources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const therapistRecommended = filtered.filter(r => r.recommended_by === "therapist");
  const newForYou = filtered.filter(r => r.new_for_you);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
        <p className="text-sm text-gray-500 mt-0.5">Curated tools, guides, and exercises to support your mental health journey</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search resources..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342]"
        />
      </div>

      {/* Therapist picks section */}
      {therapistRecommended.length > 0 && activeCategory === "all" && !searchQuery && (
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mb-3">
            <Star className="h-3.5 w-3.5 fill-blue-400 text-blue-400" /> Dr. Smith's Recommendations
          </p>
          <div className="space-y-2">
            {therapistRecommended.slice(0, 3).map(r => {
              const typeConf = TYPE_CONFIG[r.type];
              const TypeIcon = typeConf.icon;
              return (
                <div key={r.id} className="bg-white rounded-xl p-3 flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", typeConf.color)}>
                    <TypeIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 line-clamp-1">{r.title}</p>
                    <p className="text-xs text-gray-400">{r.duration}</p>
                  </div>
                  {completedResources.has(r.id) && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border transition-all shrink-0",
                activeCategory === cat.id
                  ? "bg-[#0A2342] text-white border-[#0A2342]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#0A2342]"
              )}
            >
              <Icon className="h-3 w-3" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5">
        {(["all", "article", "video", "audio", "worksheet", "guide", "exercise"] as const).map(type => (
          <button
            key={type}
            onClick={() => setActiveTypeFilter(type)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs capitalize border transition-all",
              activeTypeFilter === type ? "bg-gray-800 text-white border-gray-800" : "text-gray-500 border-gray-200 hover:border-gray-400"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Resources list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No resources found</p>
          </div>
        ) : (
          filtered.map(resource => {
            const typeConf = TYPE_CONFIG[resource.type];
            const TypeIcon = typeConf.icon;
            const recConf = RECOMMENDED_BY_CONFIG[resource.recommended_by];
            const isSaved = savedResources.has(resource.id);
            const isCompleted = completedResources.has(resource.id);

            return (
              <div
                key={resource.id}
                className={cn(
                  "bg-white rounded-2xl border p-4 transition-all",
                  isCompleted ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200 hover:border-[#0A2342]/30 hover:shadow-sm"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", typeConf.color)}>
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 pr-2">
                        {resource.new_for_you && (
                          <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mb-1">NEW</span>
                        )}
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight">{resource.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleSaved(resource.id)}
                          className={cn("p-1.5 rounded-xl transition-all", isSaved ? "text-amber-500 bg-amber-50" : "text-gray-300 hover:text-gray-500")}
                        >
                          <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{resource.description}</p>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="h-3 w-3" /> {resource.duration}
                      </span>
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full", recConf.color)}>
                        {recConf.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {resource.type === "worksheet" ? (
                        <button className="flex-1 py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                          <Download className="h-3 w-3" /> Download
                        </button>
                      ) : resource.type === "video" || resource.type === "audio" ? (
                        <button className="flex-1 py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                          <Play className="h-3 w-3" /> {resource.type === "video" ? "Watch" : "Listen"}
                        </button>
                      ) : (
                        <button className="flex-1 py-2 bg-[#0A2342] text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Open
                        </button>
                      )}
                      <button
                        onClick={() => toggleCompleted(resource.id)}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs border flex items-center gap-1 transition-all",
                          isCompleted ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "border-gray-200 text-gray-500 hover:border-emerald-300"
                        )}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {isCompleted ? "Done" : "Mark done"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Crisis resources - always visible */}
      <div className="bg-rose-50 rounded-2xl border border-rose-200 p-4">
        <p className="text-sm font-semibold text-rose-700 mb-2">🆘 Immediate Crisis Resources</p>
        <div className="space-y-1.5 text-xs text-rose-600">
          <p>• Suicide & Crisis Lifeline: <strong>Call or text 988</strong></p>
          <p>• Crisis Text Line: <strong>Text HOME to 741741</strong></p>
          <p>• International Association for Suicide Prevention: <strong>iasp.info</strong></p>
          <p>• Emergency: <strong>Call 911</strong></p>
        </div>
      </div>
    </div>
  );
}
