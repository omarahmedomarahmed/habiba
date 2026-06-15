"use client";

import { useState, useEffect } from "react";
import { patientsAPI } from "@/lib/api";
import {
  Brain, Network, Heart, AlertTriangle, TrendingUp, Star, Shield,
  Target, Pill, User, Flag, Activity, Lightbulb, ArrowLeft,
  Sparkles, Layers, Clock, Search,
  RefreshCw, Filter, Database
} from "lucide-react";
import Link from "next/link";

export default function KnowledgeGraphPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    (patientsAPI.list as (params: { limit: number }) => Promise<any>)({ limit: 50 })
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setPatients(list);
        if (list.length > 0) setSelectedPatientId(list[0].id as string);
      })
      .catch(() => {})
      .finally(() => setLoadingPatients(false));
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    setLoadingMemories(true);
    patientsAPI
      .memories(selectedPatientId)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setMemories(list);
      })
      .catch(() => setMemories([]))
      .finally(() => setLoadingMemories(false));
  }, [selectedPatientId]);

  const selectedPatient = patients.find((p: any) => p.id === selectedPatientId);

  const categories = Array.from(
    new Set(memories.map((m: any) => m.category || "memory"))
  ) as string[];

  const filteredMemories = memories.filter((m: any) => {
    const matchesCategory =
      activeFilter === "all" || (m.category || "memory") === activeFilter;
    const matchesSearch =
      !searchQuery ||
      (m.content as string)?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const importanceBadge = (importance: string) => {
    switch (importance) {
      case "critical":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="flex h-full gap-0 -mx-6 -mt-6">
      {/* Left panel */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <Network className="h-5 w-5 text-[#0A2342]" />
            <h2 className="font-bold text-[#0A2342] text-sm">Memory Graph</h2>
            <Link href="/memory" className="ml-auto text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-gray-500">Patient memory visualization</p>
        </div>

        {/* Patient selector */}
        <div className="p-3 border-b border-gray-100">
          {loadingPatients ? (
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ) : patients.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No patients found</p>
          ) : (
            <select
              value={selectedPatientId ?? ""}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A2342]"
            >
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.name || `Patient ${p.id}`}
                </option>
              ))}
            </select>
          )}
          {selectedPatient && (
            <p className="text-[10px] text-gray-400 mt-1.5 px-1">
              {memories.length} memories recorded
            </p>
          )}
        </div>

        {/* Category filter */}
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 px-1">
            Filter by Category
          </p>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveFilter("all")}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all ${
                activeFilter === "all"
                  ? "bg-[#0A2342] text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Memories</span>
              <span className="ml-auto opacity-60">{memories.length}</span>
            </button>
            {categories.map((cat) => {
              const count = memories.filter(
                (m: any) => (m.category || "memory") === cat
              ).length;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveFilter(cat)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all capitalize ${
                    activeFilter === cat
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>{cat}</span>
                  <span className="ml-auto opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="p-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
            Importance
          </p>
          {[
            { key: "critical", color: "bg-red-500", label: "Critical" },
            { key: "high", color: "bg-orange-400", label: "High" },
            { key: "medium", color: "bg-blue-400", label: "Medium" },
            { key: "low", color: "bg-gray-300", label: "Low" },
          ].map(({ key, color, label }) => (
            <div key={key} className="flex items-center gap-2 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200">
          <div className="relative flex-1 max-w-xs">
            <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search memories…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0A2342]"
            />
          </div>
          <span className="text-xs text-gray-400">
            {filteredMemories.length} of {memories.length} memories
          </span>
          {loadingMemories && (
            <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Memory cards */}
        <div className="flex-1 overflow-y-auto p-5">
          {loadingPatients ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-xl p-4 h-28 animate-pulse"
                />
              ))}
            </div>
          ) : !selectedPatientId ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
              <User className="h-10 w-10 opacity-30" />
              <p className="text-sm">Select a patient to view memories</p>
            </div>
          ) : loadingMemories ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-xl p-4 h-28 animate-pulse"
                />
              ))}
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-3">
              <Brain className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium text-gray-500">
                {memories.length === 0
                  ? "No memories recorded yet for this patient."
                  : "No memories match the current filter."}
              </p>
              {memories.length > 0 && (
                <button
                  onClick={() => {
                    setActiveFilter("all");
                    setSearchQuery("");
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMemories.map((m: any) => (
                <div
                  key={m.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                      {m.category || "memory"}
                    </span>
                    {m.importance && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full capitalize ${importanceBadge(
                          m.importance
                        )}`}
                      >
                        {m.importance}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {m.created_at
                        ? new Date(m.created_at as string).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {m.content as string}
                  </p>
                  {m.session_id && (
                    <p className="text-[10px] text-gray-400 mt-2">
                      Session #{String(m.session_id).slice(0, 8)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-15 — 24Therapy audit
