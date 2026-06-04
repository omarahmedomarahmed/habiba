"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain, Search, Plus, Filter, Network, Clock, CheckCircle2,
  AlertCircle, Tag, ChevronRight, Eye, Star, TrendingUp,
  User, Activity, Pill, Calendar, Zap, Shield, Heart,
  BookOpen, Target, Lightbulb, RefreshCw, Database
} from "lucide-react";
import { cn, formatDate, getInitials } from "@/lib/utils";

const MEMORY_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  symptom: { icon: Activity, color: "text-red-600 bg-red-50", label: "Symptom" },
  medication: { icon: Pill, color: "text-blue-600 bg-blue-50", label: "Medication" },
  diagnosis: { icon: Shield, color: "text-purple-600 bg-purple-50", label: "Diagnosis" },
  life_event: { icon: Calendar, color: "text-amber-600 bg-amber-50", label: "Life Event" },
  relationship: { icon: User, color: "text-pink-600 bg-pink-50", label: "Relationship" },
  belief: { icon: Lightbulb, color: "text-yellow-600 bg-yellow-50", label: "Belief" },
  behavior: { icon: Zap, color: "text-orange-600 bg-orange-50", label: "Behavior" },
  trigger: { icon: AlertCircle, color: "text-red-600 bg-red-50", label: "Trigger" },
  coping_skill: { icon: Heart, color: "text-green-600 bg-green-50", label: "Coping Skill" },
  goal: { icon: Target, color: "text-primary-600 bg-primary-50", label: "Goal" },
  trauma: { icon: Shield, color: "text-red-700 bg-red-100", label: "Trauma" },
  strength: { icon: Star, color: "text-amber-600 bg-amber-50", label: "Strength" },
  insight: { icon: Lightbulb, color: "text-cyan-600 bg-cyan-50", label: "Insight" },
  treatment_response: { icon: TrendingUp, color: "text-green-600 bg-green-50", label: "Treatment Response" },
};

const MOCK_PATIENTS_WITH_MEMORY = [
  {
    id: "p1", name: "Sarah Chen", avatar: "SC",
    total_nodes: 48, last_updated: "2025-12-15T10:00:00Z",
    top_nodes: [
      { id: "m1", type: "diagnosis", label: "Major Depressive Disorder", confidence: "confirmed", times_observed: 24 },
      { id: "m2", type: "symptom", label: "Sleep disturbance, difficulty falling asleep", confidence: "high", times_observed: 12 },
      { id: "m3", type: "trigger", label: "Work deadlines and performance pressure", confidence: "high", times_observed: 8 },
      { id: "m4", type: "coping_skill", label: "Deep breathing exercises", confidence: "confirmed", times_observed: 15 },
      { id: "m5", type: "goal", label: "Return to gym 3x/week", confidence: "medium", times_observed: 3 },
    ],
  },
  {
    id: "p3", name: "James Rodriguez", avatar: "JR",
    total_nodes: 72, last_updated: "2025-12-14T14:00:00Z",
    top_nodes: [
      { id: "m6", type: "diagnosis", label: "PTSD", confidence: "confirmed", times_observed: 36 },
      { id: "m7", type: "trauma", label: "Military combat exposure (2019)", confidence: "confirmed", times_observed: 5 },
      { id: "m8", type: "symptom", label: "Hypervigilance and startle response", confidence: "high", times_observed: 20 },
      { id: "m9", type: "medication", label: "Sertraline 100mg", confidence: "confirmed", times_observed: 18 },
      { id: "m10", type: "behavior", label: "Avoidance of crowded spaces", confidence: "high", times_observed: 10 },
    ],
  },
  {
    id: "p2", name: "Michael Torres", avatar: "MT",
    total_nodes: 31, last_updated: "2025-12-10T11:00:00Z",
    top_nodes: [
      { id: "m11", type: "diagnosis", label: "Generalized Anxiety Disorder", confidence: "confirmed", times_observed: 12 },
      { id: "m12", type: "trigger", label: "Financial uncertainty and job insecurity", confidence: "high", times_observed: 7 },
      { id: "m13", type: "strength", label: "Strong family support network", confidence: "high", times_observed: 6 },
    ],
  },
];

const CONFIDENCE_CONFIG = {
  confirmed: { color: "text-green-700 bg-green-50 border-green-200", label: "Confirmed" },
  high: { color: "text-blue-700 bg-blue-50 border-blue-200", label: "High" },
  medium: { color: "text-amber-700 bg-amber-50 border-amber-200", label: "Medium" },
  low: { color: "text-ink-500 bg-surface-tertiary border-surface-quaternary", label: "Low" },
};

export default function MemoryPage() {
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selected = MOCK_PATIENTS_WITH_MEMORY.find((p) => p.id === selectedPatient);

  const filteredNodes = selected ? selected.top_nodes.filter((n) => {
    const matchType = !typeFilter || n.type === typeFilter;
    const matchSearch = !search || n.label.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  }) : [];

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900 flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary-600" />
              Mental Health Memory Layer
            </h1>
            <p className="text-ink-500 text-sm mt-1">
              Longitudinal patient intelligence — knowledge accumulated across all sessions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" />
              Sync Memory
            </button>
            <button className="btn-secondary flex items-center gap-2 text-sm">
              <Network className="w-4 h-4" />
              Knowledge Graph
            </button>
          </div>
        </div>

        {/* Intelligence Banner */}
        <div className="card p-4 bg-gradient-to-r from-primary-50 to-purple-50 border-primary-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-primary-900">Patient Intelligence Active</h3>
              <p className="text-sm text-primary-700 mt-0.5">
                The Memory Layer is continuously learning from sessions, notes, and assessments.
                Every interaction improves AI assistance quality for all your patients.
              </p>
              <div className="flex items-center gap-6 mt-3 text-xs">
                <span className="flex items-center gap-1 text-primary-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {MOCK_PATIENTS_WITH_MEMORY.reduce((s, p) => s + p.total_nodes, 0)} total memory nodes
                </span>
                <span className="flex items-center gap-1 text-primary-700">
                  <Brain className="w-3.5 h-3.5" />
                  {MOCK_PATIENTS_WITH_MEMORY.length} patients tracked
                </span>
                <span className="flex items-center gap-1 text-primary-700">
                  <Zap className="w-3.5 h-3.5" />
                  AI extraction: active
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient List */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-ink-900">Patients</h2>
            {MOCK_PATIENTS_WITH_MEMORY.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient.id)}
                className={cn(
                  "w-full text-left card p-4 hover:shadow-card-hover transition-all",
                  selectedPatient === patient.id && "border-primary-300 bg-primary-50/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-700">{patient.avatar}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-ink-900">{patient.name}</div>
                    <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-2">
                      <Brain className="w-3 h-3" />
                      {patient.total_nodes} memory nodes
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-400" />
                </div>

                {/* Mini breakdown by type */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {[...new Set(patient.top_nodes.map((n) => n.type))].slice(0, 5).map((type) => {
                    const config = MEMORY_TYPE_CONFIG[type] || { color: "text-ink-600 bg-surface-tertiary", label: type };
                    const Icon = config.icon || Brain;
                    return (
                      <span key={type} className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded", config.color)}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>

          {/* Memory Detail */}
          <div className="lg:col-span-2">
            {selected ? (
              <div className="space-y-4">
                {/* Patient Header */}
                <div className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-700">{selected.avatar}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-ink-900">{selected.name}</h3>
                      <p className="text-xs text-ink-500">{selected.total_nodes} memory nodes · Last updated {formatDate(selected.last_updated)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/patients/${selected.id}`}
                      className="btn-secondary text-sm flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Full Profile
                    </Link>
                    <button className="btn-primary text-sm flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Add Memory
                    </button>
                  </div>
                </div>

                {/* Search & Type Filter */}
                <div className="card p-3 flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
                    <input
                      type="text"
                      placeholder="Search memories..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="input-field pl-8 w-full py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      onClick={() => setTypeFilter(null)}
                      className={cn("px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors",
                        !typeFilter ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600"
                      )}
                    >
                      All
                    </button>
                    {Object.entries(MEMORY_TYPE_CONFIG).slice(0, 8).map(([type, config]) => {
                      const TypeIcon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                          className={cn("flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors",
                            typeFilter === type ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
                          )}
                        >
                          <TypeIcon className="w-3 h-3" />
                          {config.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Memory Nodes */}
                <div className="space-y-2">
                  {filteredNodes.length === 0 && (
                    <div className="card p-8 text-center">
                      <Brain className="w-10 h-10 text-ink-300 mx-auto mb-2" />
                      <p className="text-ink-500 text-sm">No memory nodes found</p>
                    </div>
                  )}
                  {filteredNodes.map((node) => {
                    const typeConfig = MEMORY_TYPE_CONFIG[node.type] || { icon: Brain, color: "text-ink-600 bg-surface-tertiary", label: node.type };
                    const confConfig = CONFIDENCE_CONFIG[node.confidence as keyof typeof CONFIDENCE_CONFIG] || CONFIDENCE_CONFIG.low;
                    const TypeIcon = typeConfig.icon;
                    return (
                      <div key={node.id} className="card p-4 hover:shadow-sm transition-all group">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", typeConfig.color)}>
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm text-ink-900">{node.label}</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", confConfig.color)}>
                                  {confConfig.label}
                                </span>
                                <span className="text-xs text-ink-400">×{node.times_observed}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className={cn("text-xs px-1.5 py-0.5 rounded", typeConfig.color)}>
                                {typeConfig.label}
                              </span>
                              {node.confidence === "confirmed" && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Validated
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors" title="Edit">
                              <Tag className="w-3.5 h-3.5 text-ink-400" />
                            </button>
                            <button className="p-1.5 hover:bg-green-50 rounded-lg transition-colors" title="Validate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Memory Form */}
                <div className="card p-4 border-dashed border-surface-quaternary">
                  <button className="w-full flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium py-2 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add Memory Node Manually
                  </button>
                </div>
              </div>
            ) : (
              <div className="card p-16 text-center">
                <Brain className="w-16 h-16 text-primary-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ink-700">Select a Patient</h3>
                <p className="text-sm text-ink-500 mt-2 max-w-sm mx-auto">
                  Choose a patient to explore their Mental Health Memory Layer —
                  a structured knowledge graph that grows with every session.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
