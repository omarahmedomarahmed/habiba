"use client";

import { useState, useEffect } from "react";
import { patientsAPI, memoriesAPI } from "@/lib/api";
import {
  Brain, Search, Filter, Plus, ChevronRight, Tag, Calendar,
  User, AlertTriangle, Heart, Lightbulb, Flag, Target, Pill,
  TrendingUp, Clock, Link2, Edit3, Trash2, Star, Network,
  Activity, BookOpen, MessageSquare, Shield, Sparkles,
  ArrowRight, Eye, Layers, Database, Zap, RefreshCw, Hash
} from "lucide-react";
import { cn } from "@/lib/utils";

type MemoryCategory =
  | "all"
  | "relationship"
  | "trigger"
  | "pattern"
  | "progress"
  | "preference"
  | "trauma"
  | "family"
  | "medication"
  | "goal"
  | "life_event"
  | "observation";

type MemoryImportance = "critical" | "high" | "medium" | "low";

interface MemoryNode {
  id: string;
  patient_id: string;
  patient_name: string;
  category: Exclude<MemoryCategory, "all">;
  subcategory?: string;
  content: string;
  evidence: string[];
  source_sessions: string[];
  created_at: string;
  updated_at: string;
  importance: MemoryImportance;
  confidence: number;
  tags: string[];
  related_memories?: string[];
  ai_generated: boolean;
  therapist_verified: boolean;
  is_active: boolean;
  context_window?: string;
}

interface PatientMemoryProfile {
  patient_id: string;
  patient_name: string;
  total_memories: number;
  last_updated: string;
  intelligence_score: number;
  sessions_analyzed: number;
}


const CATEGORY_CONFIG: Record<Exclude<MemoryCategory, "all">, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  relationship: { label: "Relationships", icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
  trigger: { label: "Triggers", icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
  pattern: { label: "Patterns", icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
  progress: { label: "Progress", icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
  preference: { label: "Preferences", icon: Star, color: "text-purple-600", bg: "bg-purple-50" },
  trauma: { label: "Trauma/Grief", icon: Shield, color: "text-rose-700", bg: "bg-rose-50" },
  family: { label: "Family", icon: User, color: "text-amber-600", bg: "bg-amber-50" },
  medication: { label: "Medication", icon: Pill, color: "text-teal-600", bg: "bg-teal-50" },
  goal: { label: "Goals", icon: Target, color: "text-indigo-600", bg: "bg-indigo-50" },
  life_event: { label: "Life Events", icon: Flag, color: "text-slate-600", bg: "bg-slate-100" },
  observation: { label: "Observations", icon: Eye, color: "text-gray-600", bg: "bg-gray-50" },
};

const IMPORTANCE_CONFIG: Record<MemoryImportance, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
  high: { label: "High", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  medium: { label: "Medium", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  low: { label: "Low", color: "text-gray-600", bg: "bg-gray-100 border-gray-200" },
};

export default function MemoryPage() {
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<MemoryCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemory, setSelectedMemory] = useState<MemoryNode | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "graph" | "timeline">("list");
  const [importanceFilter, setImportanceFilter] = useState<MemoryImportance | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState<Exclude<MemoryCategory, "all">>("observation");
  const [liveMemories, setLiveMemories] = useState<MemoryNode[]>([]);
  const [liveProfiles, setLiveProfiles] = useState<PatientMemoryProfile[]>([]);

  useEffect(() => {
    async function loadPatients() {
      try {
        const res = await patientsAPI.list({ limit: 50 }) as { data: Record<string, unknown>[] };
        const profiles = (res.data || []).map(p => ({
          patient_id: p.id as string,
          patient_name: `${p.first_name} ${p.last_name}`,
          total_memories: 0,
          last_updated: p.updated_at as string || new Date().toISOString(),
          intelligence_score: 0,
          sessions_analyzed: 0,
        }));
        if (profiles.length > 0) {
          setLiveProfiles(profiles);
          setSelectedPatient(profiles[0].patient_id);
        }
      } catch { /* keep static fallback */ }
    }
    loadPatients();
  }, []);

  useEffect(() => {
    if (!selectedPatient) return;
    setLiveMemories([]);
    patientsAPI.memories(selectedPatient)
      .then((res: any) => {
        const nodes = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setLiveMemories(nodes.map((n: any) => ({
          ...n,
          category: n.memory_type || n.category || "observation",
          importance: n.importance || "medium",
          confidence: n.confidence || 0.8,
          tags: Array.isArray(n.tags) ? n.tags : [],
          evidence: Array.isArray(n.evidence) ? n.evidence : [],
          source_sessions: Array.isArray(n.source_sessions) ? n.source_sessions : [],
          ai_generated: n.ai_generated ?? true,
          therapist_verified: n.therapist_verified ?? false,
          is_active: n.is_active ?? true,
        })));
        setLiveProfiles(prev => prev.map(p =>
          p.patient_id === selectedPatient ? { ...p, total_memories: nodes.length } : p
        ));
      })
      .catch(() => setLiveMemories([]));
  }, [selectedPatient]);

  const currentPatient = liveProfiles.find(p => p.patient_id === selectedPatient);

  const patientMemories = liveMemories.filter(m => {
    const matchesPatient = m.patient_id === selectedPatient;
    const matchesCategory = activeCategory === "all" || m.category === activeCategory;
    const matchesSearch = !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesImportance = importanceFilter === "all" || m.importance === importanceFilter;
    return matchesPatient && matchesCategory && matchesSearch && matchesImportance;
  });

  const criticalMemories = liveMemories.filter(m => m.patient_id === selectedPatient && m.importance === "critical");
  const categoryCounts = Object.keys(CATEGORY_CONFIG).reduce((acc, cat) => {
    acc[cat] = liveMemories.filter(m => m.patient_id === selectedPatient && m.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar - Patient selector + category nav */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col min-h-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Database className="h-5 w-5 text-[#0A2342]" />
            <h2 className="font-bold text-[#0A2342]">Memory Layer</h2>
            <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">AI</span>
          </div>
          <p className="text-xs text-gray-500">Longitudinal patient intelligence accumulated across all sessions</p>
        </div>

        {/* Patient selector */}
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Patient</p>
          <div className="space-y-1">
            {liveProfiles.map(p => (
              <button
                key={p.patient_id}
                onClick={() => { setSelectedPatient(p.patient_id); setSelectedMemory(null); }}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-xl text-sm transition-all",
                  selectedPatient === p.patient_id ? "bg-[#0A2342] text-white" : "hover:bg-gray-50 text-gray-700"
                )}
              >
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold", selectedPatient === p.patient_id ? "bg-white/10 text-white" : "bg-gray-200 text-gray-600")}>
                  {p.patient_name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-xs truncate">{p.patient_name}</p>
                  <p className={cn("text-xs", selectedPatient === p.patient_id ? "text-white/60" : "text-gray-400")}>
                    {p.total_memories} memories · {p.sessions_analyzed} sessions
                  </p>
                </div>
                <div className={cn("text-xs font-bold", selectedPatient === p.patient_id ? "text-emerald-300" : "text-emerald-600")}>
                  {p.intelligence_score}%
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="p-4 flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Category</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveCategory("all")}
              className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all", activeCategory === "all" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50")}
            >
              <Layers className="h-4 w-4" />
              <span>All Memories</span>
              <span className="ml-auto text-xs text-gray-400">{liveMemories.filter(m => m.patient_id === selectedPatient).length}</span>
            </button>
            {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => {
              const count = categoryCounts[cat] || 0;
              if (count === 0) return null;
              const Icon = config.icon;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat as MemoryCategory)}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all", activeCategory === cat ? `${config.bg} ${config.color} font-medium` : "text-gray-600 hover:bg-gray-50")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{config.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-bold text-gray-900">
                {currentPatient?.patient_name} — Patient Intelligence
              </h1>
              <p className="text-xs text-gray-500">
                {currentPatient?.total_memories} memory nodes · {currentPatient?.sessions_analyzed} sessions analyzed · Updated {currentPatient?.last_updated}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">Intelligence: {currentPatient?.intelligence_score}%</span>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#0A2342] text-white rounded-xl text-sm hover:bg-[#123A63]"
              >
                <Plus className="h-4 w-4" /> Add Memory
              </button>
            </div>
          </div>

          {/* Intelligence score bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-500 w-32">Clinical Intelligence</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                style={{ width: `${currentPatient?.intelligence_score}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700">{currentPatient?.intelligence_score}%</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search memories, tags, or content..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342]"
              />
            </div>

            {/* Importance filter */}
            <select
              value={importanceFilter}
              onChange={e => setImportanceFilter(e.target.value as MemoryImportance | "all")}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            >
              <option value="all">All Importance</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>

            {/* View mode */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(["list", "timeline"] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all", viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Critical memories banner */}
        {criticalMemories.length > 0 && activeCategory === "all" && (
          <div className="mx-6 mt-4 bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span className="text-sm font-semibold text-rose-800">Critical Clinical Context — Always Load</span>
            </div>
            <div className="space-y-1">
              {criticalMemories.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemory(m)}
                  className="w-full text-left text-xs text-rose-700 hover:text-rose-900 flex items-center gap-2"
                >
                  <span className="w-1 h-1 rounded-full bg-rose-400 shrink-0" />
                  {m.content.substring(0, 100)}...
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Memory list / detail split */}
        <div className="flex-1 flex overflow-hidden mt-4">
          {/* Memory list */}
          <div className={cn("overflow-y-auto px-6 pb-6 space-y-3", selectedMemory ? "w-1/2 border-r border-gray-200 pr-4" : "w-full")}>
            {patientMemories.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Brain className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No memories found for this filter</p>
              </div>
            ) : (
              patientMemories.map(memory => {
                const catConfig = CATEGORY_CONFIG[memory.category];
                const importanceConf = IMPORTANCE_CONFIG[memory.importance];
                const Icon = catConfig?.icon || Brain;

                return (
                  <button
                    key={memory.id}
                    onClick={() => setSelectedMemory(selectedMemory?.id === memory.id ? null : memory)}
                    className={cn(
                      "w-full text-left bg-white rounded-2xl border p-4 transition-all hover:shadow-sm",
                      selectedMemory?.id === memory.id ? "border-[#0A2342] ring-1 ring-[#0A2342]/20" : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", catConfig?.bg)}>
                        <Icon className={cn("h-4 w-4", catConfig?.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", importanceConf.bg, importanceConf.color)}>
                            {importanceConf.label}
                          </span>
                          <span className="text-xs text-gray-400">{catConfig?.label}</span>
                          {memory.ai_generated && (
                            <span className="flex items-center gap-1 text-xs text-indigo-500 ml-auto">
                              <Sparkles className="h-2.5 w-2.5" /> AI
                            </span>
                          )}
                          {memory.therapist_verified && (
                            <Shield className="h-3 w-3 text-emerald-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed line-clamp-2 mb-2">{memory.content}</p>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-wrap gap-1">
                            {memory.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">#{tag}</span>
                            ))}
                          </div>
                          <span className="ml-auto text-xs text-gray-400">{memory.source_sessions.length} sessions</span>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <span className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <span className="block h-full bg-blue-500 rounded-full" style={{ width: `${memory.confidence * 100}%` }} />
                            </span>
                            {Math.round(memory.confidence * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Memory detail panel */}
          {selectedMemory && (
            <div className="w-1/2 overflow-y-auto px-6 pb-6">
              <div className="bg-white rounded-2xl border border-gray-200">
                {/* Header */}
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const cfg = CATEGORY_CONFIG[selectedMemory.category];
                        const Icon = cfg?.icon || Brain;
                        return (
                          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", cfg?.bg)}>
                            <Icon className={cn("h-4 w-4", cfg?.color)} />
                          </div>
                        );
                      })()}
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{CATEGORY_CONFIG[selectedMemory.category]?.label}</p>
                        {selectedMemory.subcategory && (
                          <p className="text-xs text-gray-400">{selectedMemory.subcategory.replace(/_/g, " ")}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setSelectedMemory(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">✕</button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", IMPORTANCE_CONFIG[selectedMemory.importance].bg, IMPORTANCE_CONFIG[selectedMemory.importance].color)}>
                      {IMPORTANCE_CONFIG[selectedMemory.importance].label} Importance
                    </span>
                    <span className="text-xs text-gray-400">Confidence: {Math.round(selectedMemory.confidence * 100)}%</span>
                    {selectedMemory.ai_generated && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles className="h-2.5 w-2.5" /> AI Generated</span>}
                    {selectedMemory.therapist_verified && <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield className="h-2.5 w-2.5" /> Verified</span>}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Content */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Memory Content</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{selectedMemory.content}</p>
                  </div>

                  {/* Context window */}
                  {selectedMemory.context_window && (
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mb-1">
                        <Zap className="h-3 w-3" /> AI Context Instruction
                      </p>
                      <p className="text-xs text-amber-700">{selectedMemory.context_window}</p>
                    </div>
                  )}

                  {/* Evidence */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Supporting Evidence</p>
                    <div className="space-y-1.5">
                      {selectedMemory.evidence.map((e, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="w-4 h-4 bg-gray-100 rounded text-gray-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                          <span className="text-gray-600">{e}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Source sessions */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Source Sessions</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMemory.source_sessions.map(s => (
                        <span key={s} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-xl text-xs font-medium border border-blue-100 cursor-pointer hover:bg-blue-100">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMemory.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs">#{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs text-gray-400">
                    <span>Created: {selectedMemory.created_at}</span>
                    <span>Updated: {selectedMemory.updated_at}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add Memory Node</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 font-medium">Category</label>
                <select
                  value={newMemoryCategory}
                  onChange={e => setNewMemoryCategory(e.target.value as Exclude<MemoryCategory, "all">)}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => (
                    <option key={cat} value={cat}>{cfg.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 font-medium">Memory Content</label>
                <textarea
                  value={newMemoryContent}
                  onChange={e => setNewMemoryContent(e.target.value)}
                  placeholder="Document the clinical observation, pattern, or insight..."
                  className="w-full mt-1 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none h-28 resize-none"
                />
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-700">
                  <strong>Tip:</strong> Add supporting evidence from sessions to increase AI confidence in this memory node.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
              <button
                onClick={async () => {
                  if (!newMemoryContent.trim() || !selectedPatient) return;
                  try {
                    await memoriesAPI.addNode(selectedPatient, {
                      memory_type: newMemoryCategory,
                      content: newMemoryContent,
                    });
                    setNewMemoryContent("");
                    setShowAddModal(false);
                    // Refresh memories
                    patientsAPI.memories(selectedPatient).then((res: any) => {
                      const nodes = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
                      setLiveMemories(nodes.map((n: any) => ({
                        ...n,
                        category: n.memory_type || n.category || "observation",
                        importance: n.importance || "medium",
                        confidence: n.confidence || 0.8,
                        tags: Array.isArray(n.tags) ? n.tags : [],
                        evidence: Array.isArray(n.evidence) ? n.evidence : [],
                        source_sessions: Array.isArray(n.source_sessions) ? n.source_sessions : [],
                        ai_generated: n.ai_generated ?? true,
                        therapist_verified: n.therapist_verified ?? false,
                        is_active: n.is_active ?? true,
                      })));
                    }).catch(() => {});
                  } catch { /* keep modal open on error */ }
                }}
                className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium"
              >
                Save Memory
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
