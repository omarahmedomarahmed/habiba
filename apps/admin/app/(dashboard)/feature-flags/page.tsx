"use client";

import { useState, useEffect } from "react";
import apiFetch from "@/lib/api";
import {
  Zap, Search, Plus, ChevronDown, Building2, Users, Globe,
  AlertTriangle, CheckCircle, Clock, Edit2, Trash2, X, Save,
  ToggleLeft, ToggleRight, Filter, RefreshCw, Eye
} from "lucide-react";

type FlagScope = "global" | "org" | "user" | "plan";
type FlagType = "boolean" | "percentage" | "variant";
type FlagEnv = "all" | "production" | "staging" | "development";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  type: FlagType;
  scope: FlagScope;
  enabled_globally: boolean;
  enabled_pct?: number;
  variants?: string[];
  enabled_orgs?: string[];
  enabled_plans?: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  rollout_notes?: string;
}

const FLAGS: FeatureFlag[] = [
  {
    id: "f1", key: "ai_copilot_live", name: "AI Copilot Live Mode", description: "Real-time AI session copilot with live suggestion overlay during video sessions.", type: "boolean", scope: "global", enabled_globally: true, tags: ["ai", "core", "beta"], created_at: "2026-04-15", updated_at: "2026-06-01", created_by: "Platform Team", rollout_notes: "Rolled out to all Professional+ plans after Q1 beta.",
  },
  {
    id: "f2", key: "memory_graph_viz", name: "Memory Graph Visualization", description: "Interactive knowledge graph visualization of patient memory nodes. Currently in beta.", type: "percentage", scope: "org", enabled_globally: false, enabled_pct: 35, tags: ["memory", "beta", "ui"], created_at: "2026-05-01", updated_at: "2026-06-03", created_by: "AI Team",
  },
  {
    id: "f3", key: "workflow_marketplace", name: "Workflow Template Marketplace", description: "Allow orgs to share and import workflow templates from a community marketplace.", type: "boolean", scope: "plan", enabled_globally: false, enabled_plans: ["enterprise"], tags: ["workflows", "enterprise"], created_at: "2026-05-15", updated_at: "2026-06-04", created_by: "Product Team",
  },
  {
    id: "f4", key: "ehr_epic_integration", name: "Epic EHR Integration", description: "Bidirectional FHIR R4 sync with Epic. Patient demographics, notes, diagnoses.", type: "boolean", scope: "org", enabled_globally: false, enabled_orgs: ["Pacific Mental Health", "RegionHealth System"], tags: ["ehr", "enterprise", "fhir"], created_at: "2026-03-01", updated_at: "2026-05-20", created_by: "Integrations Team",
  },
  {
    id: "f5", key: "group_sessions", name: "Group Session Support", description: "Multi-patient group therapy sessions with shared notes and group billing.", type: "percentage", scope: "global", enabled_globally: false, enabled_pct: 10, tags: ["sessions", "alpha"], created_at: "2026-06-01", updated_at: "2026-06-04", created_by: "Clinical Team", rollout_notes: "Alpha rollout — monitoring for performance issues.",
  },
  {
    id: "f6", key: "patient_app_v2", name: "Patient Portal v2", description: "Redesigned patient portal with AI companion, homework tracking, and profile page.", type: "boolean", scope: "global", enabled_globally: true, tags: ["patient", "ui", "core"], created_at: "2026-05-28", updated_at: "2026-06-04", created_by: "Design Team",
  },
  {
    id: "f7", key: "ai_risk_auto_escalation", name: "AI Risk Auto-Escalation", description: "Automatically escalate to supervisor when AI detects PHQ-9 >= 15 or C-SSRS positive.", type: "boolean", scope: "org", enabled_globally: false, tags: ["ai", "risk", "safety"], created_at: "2026-04-01", updated_at: "2026-05-15", created_by: "Safety Team",
  },
  {
    id: "f8", key: "billing_auto_claim", name: "Automatic Claim Submission", description: "Auto-submit insurance claims when note is signed. Requires Availity or Office Ally integration.", type: "boolean", scope: "org", enabled_globally: false, tags: ["billing", "automation"], created_at: "2026-05-10", updated_at: "2026-06-02", created_by: "Billing Team",
  },
];

function FlagRow({ flag, onToggle }: { flag: FeatureFlag; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="grid grid-cols-12 gap-3 px-5 py-4 hover:bg-slate-50/60 transition items-center">
        {/* Key */}
        <div className="col-span-3">
          <div className="font-mono text-sm font-semibold text-slate-900">{flag.key}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{flag.name}</div>
        </div>

        {/* Scope */}
        <div className="col-span-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            flag.scope === "global" ? "bg-blue-100 text-blue-700" :
            flag.scope === "org" ? "bg-violet-100 text-violet-700" :
            flag.scope === "plan" ? "bg-teal-100 text-teal-700" :
            "bg-slate-100 text-slate-600"
          }`}>
            {flag.scope === "global" ? <Globe className="w-3 h-3 inline mr-1" /> :
             flag.scope === "org" ? <Building2 className="w-3 h-3 inline mr-1" /> :
             <Users className="w-3 h-3 inline mr-1" />}
            {flag.scope}
          </span>
        </div>

        {/* Rollout */}
        <div className="col-span-2 text-sm">
          {flag.type === "percentage" ? (
            <div>
              <div className="text-slate-700 font-medium">{flag.enabled_pct}% rollout</div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1">
                <div className="bg-[#2EC4B6] h-1.5 rounded-full" style={{ width: `${flag.enabled_pct}%` }} />
              </div>
            </div>
          ) : flag.type === "boolean" ? (
            <span className="text-slate-500 text-xs">Boolean</span>
          ) : (
            <span className="text-slate-500 text-xs">A/B Variant</span>
          )}
        </div>

        {/* Tags */}
        <div className="col-span-3 flex flex-wrap gap-1">
          {flag.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>

        {/* Toggle */}
        <div className="col-span-1 flex justify-center">
          <button onClick={() => onToggle(flag.id)} className="focus:outline-none">
            {flag.enabled_globally ? (
              <ToggleRight className="w-7 h-7 text-[#2EC4B6]" />
            ) : (
              <ToggleLeft className="w-7 h-7 text-slate-300" />
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="col-span-1 flex items-center gap-1 justify-end">
          <button onClick={() => setExpanded(!expanded)} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition">
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 bg-slate-50/60 border-t border-slate-100">
          <div className="pt-4 grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Description</div>
              <div className="text-sm text-slate-700">{flag.description}</div>
            </div>
            {flag.rollout_notes && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Rollout Notes</div>
                <div className="text-sm text-slate-700">{flag.rollout_notes}</div>
              </div>
            )}
            {flag.enabled_orgs && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Enabled Orgs</div>
                <div className="flex flex-wrap gap-1">
                  {flag.enabled_orgs.map(org => (
                    <span key={org} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{org}</span>
                  ))}
                </div>
              </div>
            )}
            {flag.enabled_plans && (
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Enabled Plans</div>
                <div className="flex flex-wrap gap-1">
                  {flag.enabled_plans.map(plan => (
                    <span key={plan} className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{plan}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-1">Metadata</div>
              <div className="text-xs text-slate-500">Created {flag.created_at} · Updated {flag.updated_at} · By {flag.created_by}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition">
              <Edit2 className="w-3.5 h-3.5" /> Edit Flag
            </button>
            <button className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition">
              <Building2 className="w-3.5 h-3.5" /> Add Org Override
            </button>
            <button className="flex items-center gap-1.5 text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 transition ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState(FLAGS);
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("all");

  useEffect(() => {
    apiFetch<FeatureFlag[]>('/admin/feature-flags')
      .then(res => { if (Array.isArray(res) && res.length > 0) setFlags(res); })
      .catch(() => {/* keep static fallback */});
  }, []);

  const allTags = Array.from(new Set(FLAGS.flatMap(f => f.tags)));

  const filtered = flags.filter(f => {
    const matchSearch = !search || f.key.includes(search) || f.name.toLowerCase().includes(search.toLowerCase());
    const matchTag = filterTag === "all" || f.tags.includes(filterTag);
    return matchSearch && matchTag;
  });

  const handleToggle = async (id: string) => {
    const flag = flags.find(f => f.id === id);
    if (!flag) return;
    const newEnabled = !flag.enabled_globally;
    setFlags(prev => prev.map(f => f.id === id ? { ...f, enabled_globally: newEnabled } : f));
    try {
      await apiFetch(`/admin/feature-flags/${flag.key}`, {
        method: 'PATCH', body: JSON.stringify({ enabled: newEnabled }),
      });
    } catch { /* optimistic update stays */ }
  };

  const enabledCount = flags.filter(f => f.enabled_globally).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#2EC4B6]" />
            Feature Flags
          </h1>
          <p className="text-slate-500 mt-1">Control feature rollouts per org, plan, or globally</p>
        </div>
        <button className="flex items-center gap-2 bg-[#0A2342] text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1a3a6a] transition">
          <Plus className="w-4 h-4" />
          New Flag
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: "Total Flags", value: flags.length, icon: Zap, color: "bg-blue-50 text-blue-600" },
          { label: "Globally Enabled", value: enabledCount, icon: CheckCircle, color: "bg-green-50 text-green-600" },
          { label: "Partial Rollout", value: flags.filter(f => f.type === "percentage").length, icon: Clock, color: "bg-amber-50 text-amber-600" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flags..." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]" />
        </div>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
          <option value="all">All Tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Flags Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">Flag Key / Name</div>
          <div className="col-span-2">Scope</div>
          <div className="col-span-2">Rollout</div>
          <div className="col-span-3">Tags</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1"></div>
        </div>
        {filtered.map(flag => (
          <FlagRow key={flag.id} flag={flag} onToggle={handleToggle} />
        ))}
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
