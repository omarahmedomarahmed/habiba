"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target, Search, Plus, ChevronRight,
  Mail, Calendar, TrendingUp,
  CheckCircle2, Star, X, MoreHorizontal,
  Sparkles, AlertCircle, RefreshCw, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { crmAPI, APIError } from "@/lib/api";

type LeadStage = "prospect" | "contacted" | "demo_scheduled" | "negotiating" | "closed_won" | "closed_lost";
type LeadType = "solo_therapist" | "group_practice" | "enterprise" | "health_system";

interface Lead {
  id: string;
  name: string;
  organization: string;
  type: LeadType;
  stage: LeadStage;
  owner: string;
  email: string;
  phone: string;
  therapist_count: number;
  deal_value: number;
  source: string;
  last_contact: string;
  next_action: string;
  next_action_date: string;
  score: number;
  notes: string;
  tags: string[];
  created_at: string;
}

interface PipelineStats {
  pipeline_value: number;
  won_value: number;
  hot_leads: number;
  active_deals: number;
  pipeline_change?: string;
  won_count?: number;
}

const STAGE_CONFIG: Record<LeadStage, { label: string; color: string; bg: string; border: string }> = {
  prospect: { label: "Prospect", color: "text-slate-400", bg: "bg-slate-800", border: "border-slate-600" },
  contacted: { label: "Contacted", color: "text-blue-400", bg: "bg-blue-900/40", border: "border-blue-700/60" },
  demo_scheduled: { label: "Demo Scheduled", color: "text-violet-400", bg: "bg-violet-900/40", border: "border-violet-700/60" },
  negotiating: { label: "Negotiating", color: "text-orange-400", bg: "bg-orange-900/40", border: "border-orange-700/60" },
  closed_won: { label: "Closed Won", color: "text-green-400", bg: "bg-green-900/40", border: "border-green-700/60" },
  closed_lost: { label: "Closed Lost", color: "text-red-400", bg: "bg-red-900/40", border: "border-red-700/60" },
};

const TYPE_CONFIG: Record<LeadType, { label: string; color: string }> = {
  solo_therapist: { label: "Solo", color: "text-blue-400" },
  group_practice: { label: "Group Practice", color: "text-violet-400" },
  enterprise: { label: "Enterprise", color: "text-orange-400" },
  health_system: { label: "Health System", color: "text-red-400" },
};

const PIPELINE_STAGES: LeadStage[] = [
  "prospect", "contacted", "demo_scheduled", "negotiating", "closed_won",
];

const VALID_STAGES: LeadStage[] = [
  "prospect", "contacted", "demo_scheduled", "negotiating", "closed_won", "closed_lost",
];
const VALID_TYPES: LeadType[] = ["solo_therapist", "group_practice", "enterprise", "health_system"];

// ── helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-400 bg-green-900/40" :
    score >= 60 ? "text-yellow-400 bg-yellow-900/40" :
    "text-slate-400 bg-slate-700";
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", color)}>{score}</span>;
}

// ── normalizer ───────────────────────────────────────────────────────────────
function normalizeLead(raw: Record<string, unknown>): Lead {
  const stageRaw = String(raw.stage || raw.status || raw.pipeline_stage || "prospect").toLowerCase();
  const stage: LeadStage = VALID_STAGES.includes(stageRaw as LeadStage)
    ? (stageRaw as LeadStage) : "prospect";

  const typeRaw = String(
    raw.type || raw.lead_type || raw.org_type || raw.organization_type || "solo_therapist"
  ).toLowerCase().replace(/\s+/g, "_");
  const type: LeadType = VALID_TYPES.includes(typeRaw as LeadType)
    ? (typeRaw as LeadType) : "solo_therapist";

  const contact = (raw.contact as Record<string, unknown>) || {};

  return {
    id: String(raw.id || raw._id || Math.random()),
    name: String(raw.name || raw.contact_name || contact.name || raw.full_name || "Unknown"),
    organization: String(raw.organization || raw.company || raw.org_name || raw.practice_name || "Unknown"),
    type,
    stage,
    owner: String(raw.owner || raw.assigned_to || raw.sales_rep || "Unassigned"),
    email: String(raw.email || contact.email || raw.contact_email || ""),
    phone: String(raw.phone || contact.phone || raw.contact_phone || ""),
    therapist_count: Number(raw.therapist_count || raw.therapists || raw.team_size || 1),
    deal_value: Number(raw.deal_value || raw.value || raw.annual_value || raw.arr || 0),
    source: String(raw.source || raw.lead_source || raw.channel || ""),
    last_contact: String(raw.last_contact || raw.last_contacted_at || ""),
    next_action: String(raw.next_action || raw.next_step || "Follow up"),
    next_action_date: String(raw.next_action_date || raw.follow_up_date || raw.due_date || ""),
    score: Number(raw.score || raw.lead_score || raw.qualification_score || 50),
    notes: String(raw.notes || raw.description || raw.summary || ""),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    created_at: String(raw.created_at || raw.createdAt || ""),
  };
}

function normalizeStats(raw: Record<string, unknown>): PipelineStats {
  return {
    pipeline_value: Number(raw.pipeline_value || raw.total_pipeline || raw.open_value || 0),
    won_value: Number(raw.won_value || raw.closed_won_value || raw.total_won || 0),
    hot_leads: Number(raw.hot_leads || raw.qualified_leads || 0),
    active_deals: Number(raw.active_deals || raw.open_deals || 0),
    pipeline_change: String(raw.pipeline_change || raw.week_change || ""),
    won_count: Number(raw.won_count || raw.closed_count || 0),
  };
}

// ── skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 animate-pulse">
      <div className="h-3.5 bg-gray-700 rounded w-32 mb-1.5" />
      <div className="h-2.5 bg-gray-700/60 rounded w-24 mb-3" />
      <div className="flex gap-2 mb-2">
        <div className="h-4 bg-gray-700/60 rounded w-16" />
        <div className="h-4 bg-gray-700/60 rounded w-12" />
      </div>
      <div className="h-3 bg-gray-700/40 rounded w-full" />
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function AdminCRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"pipeline" | "list" | "analytics">("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<"all" | LeadStage>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [total, setTotal] = useState(0);

  // ── fetch leads ──────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = { limit: 100 };
      if (selectedStage !== "all") params.stage = selectedStage;
      if (searchQuery) params.search = searchQuery;

      const json = await crmAPI.leads(params);
      const raw = Array.isArray(json) ? json : (json as any).data ?? [];
      setTotal((json as any).total ?? raw.length);
      setLeads((raw as Record<string, unknown>[]).map(normalizeLead));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        setLeads([]);
        return;
      }
      setError("Failed to load leads. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedStage, searchQuery]);

  // ── fetch stats ──────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const json = await crmAPI.pipelineStats();
      setStats(normalizeStats(json as Record<string, unknown>));
    } catch {
      // non-critical — silently ignore
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchLeads, searchQuery ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchLeads, searchQuery]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── derived stats (computed from loaded leads when API stats not available) ─
  const activeleads = leads.filter((l) => l.stage !== "closed_lost");
  const pipelineValue = stats?.pipeline_value ??
    leads.filter((l) => l.stage !== "closed_won" && l.stage !== "closed_lost")
      .reduce((s, l) => s + l.deal_value, 0);
  const wonValue = stats?.won_value ??
    leads.filter((l) => l.stage === "closed_won").reduce((s, l) => s + l.deal_value, 0);
  const hotLeads = stats?.hot_leads ??
    leads.filter((l) => l.score >= 80 && l.stage !== "closed_won" && l.stage !== "closed_lost").length;
  const activeDeals = stats?.active_deals ??
    leads.filter((l) => !["closed_won", "closed_lost"].includes(l.stage)).length;

  // ── client-side filter ───────────────────────────────────────────────────
  const filtered = leads.filter((l) => {
    if (selectedStage !== "all" && l.stage !== selectedStage) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        l.organization.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">CRM & Sales Pipeline</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track leads, demos, and enterprise deals</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchLeads(); fetchStats(); }}
            className="flex items-center gap-1.5 h-9 px-3 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(["pipeline", "list", "analytics"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn("px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all",
                  view === v ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
                )}>
                {v}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchLeads} className="text-xs font-semibold underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Pipeline Value",
            value: statsLoading && !stats ? "—" : formatCurrency(pipelineValue),
            icon: TrendingUp, color: "text-blue-400",
            change: stats?.pipeline_change || "Active pipeline",
          },
          {
            label: "Won (Q4)",
            value: statsLoading && !stats ? "—" : formatCurrency(wonValue),
            icon: CheckCircle2, color: "text-green-400",
            change: stats?.won_count ? `${stats.won_count} deals closed` : "Closed deals",
          },
          {
            label: "Hot Leads",
            value: loading ? "—" : hotLeads,
            icon: Star, color: "text-yellow-400",
            change: "Score ≥80",
          },
          {
            label: "Active Deals",
            value: loading ? "—" : activeDeals,
            icon: Target, color: "text-violet-400",
            change: "Across all stages",
          },
        ].map(({ label, value, icon: Icon, color, change }) => (
          <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs">{label}</span>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <div className="text-xl font-black text-white">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{change}</div>
          </div>
        ))}
      </div>

      {/* AI Insights Banner */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-violet-900/50 border border-indigo-700/40 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-indigo-300 mb-1">AI Sales Intelligence</div>
          <div className="text-xs text-gray-300">
            {loading
              ? "Loading insights..."
              : leads.length === 0
              ? "No active leads to analyze. Add leads to get AI insights."
              : <>
                  🔥 <strong>{leads.filter((l) => l.score >= 90)[0]?.organization ?? "Top lead"}</strong> has the highest match score —
                  consider prioritizing outreach.
                  · ⚡ <strong>{hotLeads} hot leads</strong> (score ≥80) in your pipeline.
                  · 📊 <strong>Group practice</strong> conversion rate is 2.4x higher than solo this quarter.
                </>
            }
          </div>
        </div>
        <button className="text-xs text-indigo-400 hover:text-indigo-200 flex items-center gap-1 shrink-0">
          Full Report <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pipeline View */}
      {view === "pipeline" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = filtered.filter((l) => l.stage === stage);
              const stageValue = stageLeads.reduce((s, l) => s + l.deal_value, 0);
              const conf = STAGE_CONFIG[stage];
              return (
                <div key={stage} className="w-72">
                  <div className={cn("rounded-lg border px-3 py-2 mb-3", conf.bg, conf.border)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold", conf.color)}>{conf.label}</span>
                      <span className={cn(
                        "text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center bg-gray-900",
                        conf.color
                      )}>
                        {loading ? "…" : stageLeads.length}
                      </span>
                    </div>
                    <div className={cn("text-xs mt-0.5", conf.color)}>
                      {loading ? "—" : formatCurrency(stageValue)}
                    </div>
                  </div>

                  {/* Loading skeletons */}
                  {loading && (
                    <div className="space-y-2.5">
                      <SkeletonCard />
                      {stage === "contacted" && <SkeletonCard />}
                    </div>
                  )}

                  {/* Empty column */}
                  {!loading && stageLeads.length === 0 && (
                    <div className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center">
                      <p className="text-xs text-gray-600">No leads</p>
                    </div>
                  )}

                  {/* Lead cards */}
                  {!loading && (
                    <div className="space-y-2.5">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="bg-gray-800 border border-gray-700 rounded-xl p-3 cursor-pointer hover:border-gray-600 hover:bg-gray-750 transition-all"
                        >
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{lead.organization}</div>
                              <div className="text-xs text-gray-400 truncate">{lead.name}</div>
                            </div>
                            <ScoreBadge score={lead.score} />
                          </div>

                          <div className="flex items-center gap-1.5 mb-2">
                            <span className={cn("text-[10px] font-semibold", TYPE_CONFIG[lead.type]?.color ?? "text-gray-400")}>
                              {TYPE_CONFIG[lead.type]?.label ?? lead.type}
                            </span>
                            <span className="text-gray-600">·</span>
                            <span className="text-[10px] text-gray-400">{lead.therapist_count} therapists</span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-green-400">{formatCurrency(lead.deal_value)}</span>
                            {lead.next_action_date && (
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Calendar className="w-3 h-3" />
                                {lead.next_action_date.substring(5)}
                              </div>
                            )}
                          </div>

                          {lead.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="inline-block mt-1.5 mr-1 text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value as "all" | LeadStage)}
              className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Stages</option>
              {Object.entries(STAGE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {total > 0 && !loading && (
              <span className="text-xs text-gray-500 ml-auto">{filtered.length} of {total}</span>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  {["Organization", "Stage", "Type", "Therapists", "Deal Value", "Score", "Next Action", "Owner"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {loading && [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-700/50">
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: j === 0 ? 120 : 64 }} />
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Target className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No leads found</p>
                    </td>
                  </tr>
                )}

                {!loading && filtered.map((lead) => {
                  const sConf = STAGE_CONFIG[lead.stage] ?? STAGE_CONFIG.prospect;
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-700/30 cursor-pointer transition-all"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-white">{lead.organization}</div>
                        <div className="text-xs text-gray-400">{lead.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", sConf.bg, sConf.color)}>
                          {sConf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[11px] font-semibold", TYPE_CONFIG[lead.type]?.color ?? "text-gray-400")}>
                          {TYPE_CONFIG[lead.type]?.label ?? lead.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">{lead.therapist_count}</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-400">{formatCurrency(lead.deal_value)}</td>
                      <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-300">{lead.next_action}</div>
                        <div className="text-[11px] text-gray-500">{lead.next_action_date}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{lead.owner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics View */}
      {view === "analytics" && (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Pipeline by Stage</h3>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-2.5 bg-gray-700 rounded w-32 mb-1.5" />
                    <div className="h-2 bg-gray-700 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {PIPELINE_STAGES.map((stage) => {
                  const stageLeads = leads.filter((l) => l.stage === stage);
                  const val = stageLeads.reduce((s, l) => s + l.deal_value, 0);
                  const conf = STAGE_CONFIG[stage];
                  const pct = pipelineValue > 0 ? (val / pipelineValue) * 100 : 0;
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-semibold", conf.color)}>{conf.label}</span>
                        <span className="text-xs text-gray-400">{formatCurrency(val)}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Pipeline by Type</h3>
            {loading ? (
              <div className="space-y-2.5 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 bg-gray-700 rounded w-24" />
                    <div className="h-3 bg-gray-700 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {VALID_TYPES.map((type) => {
                  const typeLeads = leads.filter((l) => l.type === type && l.stage !== "closed_lost");
                  const val = typeLeads.reduce((s, l) => s + l.deal_value, 0);
                  const conf = TYPE_CONFIG[type];
                  return (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className={cn("font-semibold", conf.color)}>{conf.label}</span>
                      <span className="text-gray-500 w-12 text-right">{typeLeads.length} leads</span>
                      <span className="text-green-400 font-semibold w-20 text-right">{formatCurrency(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Lead Sources</h3>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 bg-gray-700 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {Array.from(
                  leads.reduce((map, l) => {
                    if (!l.source) return map;
                    const prev = map.get(l.source) || { count: 0, value: 0 };
                    map.set(l.source, { count: prev.count + 1, value: prev.value + l.deal_value });
                    return map;
                  }, new Map<string, { count: number; value: number }>())
                )
                  .sort((a, b) => b[1].value - a[1].value)
                  .slice(0, 6)
                  .map(([source, { count, value }]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 flex-1 truncate">{source || "Unknown"}</span>
                      <span className="text-gray-500 w-12 text-right">{count} leads</span>
                      <span className="text-green-400 font-semibold w-20 text-right">{formatCurrency(value)}</span>
                    </div>
                  ))
                }
                {leads.length > 0 && leads.every((l) => !l.source) && (
                  <p className="text-xs text-gray-500">No source data available</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Score Distribution</h3>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-gray-700 rounded" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Hot (80-100)", filter: (l: Lead) => l.score >= 80, color: "bg-green-500 text-green-400" },
                  { label: "Warm (60-79)", filter: (l: Lead) => l.score >= 60 && l.score < 80, color: "bg-yellow-500 text-yellow-400" },
                  { label: "Cold (<60)", filter: (l: Lead) => l.score < 60, color: "bg-gray-500 text-gray-400" },
                ].map(({ label, filter, color }) => {
                  const [barColor, textColor] = color.split(" ");
                  const count = leads.filter(filter).length;
                  const pct = leads.length > 0 ? (count / leads.length) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-semibold", textColor)}>{label}</span>
                        <span className="text-xs text-gray-400">{count} leads</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end" onClick={() => setSelectedLead(null)}>
          <div className="w-[480px] bg-gray-900 border-l border-gray-700 h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{selectedLead.organization}</h2>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full border",
                  STAGE_CONFIG[selectedLead.stage]?.bg ?? "bg-gray-800",
                  STAGE_CONFIG[selectedLead.stage]?.color ?? "text-gray-400",
                  STAGE_CONFIG[selectedLead.stage]?.border ?? "border-gray-600",
                )}>
                  {STAGE_CONFIG[selectedLead.stage]?.label ?? selectedLead.stage}
                </span>
                <span className={cn("text-xs font-semibold", TYPE_CONFIG[selectedLead.type]?.color ?? "text-gray-400")}>
                  {TYPE_CONFIG[selectedLead.type]?.label ?? selectedLead.type}
                </span>
                <ScoreBadge score={selectedLead.score} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Deal Value", value: formatCurrency(selectedLead.deal_value) + "/yr" },
                  { label: "Therapists", value: `${selectedLead.therapist_count}` },
                  { label: "Lead Source", value: selectedLead.source || "—" },
                  { label: "Owner", value: selectedLead.owner || "Unassigned" },
                  { label: "Last Contact", value: selectedLead.last_contact || "—" },
                  { label: "Created", value: selectedLead.created_at || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                    <div className="text-sm font-semibold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Contact</div>
                <div className="text-sm text-white">{selectedLead.name}</div>
                {selectedLead.email && <div className="text-xs text-gray-400 mt-0.5">{selectedLead.email}</div>}
                {selectedLead.phone && <div className="text-xs text-gray-400">{selectedLead.phone}</div>}
              </div>

              {selectedLead.next_action && (
                <div className="bg-orange-900/30 border border-orange-700/40 rounded-lg p-3">
                  <div className="text-xs font-bold text-orange-400 mb-1">Next Action</div>
                  <div className="text-sm text-white">{selectedLead.next_action}</div>
                  {selectedLead.next_action_date && (
                    <div className="text-xs text-orange-300/70 mt-0.5">{selectedLead.next_action_date}</div>
                  )}
                </div>
              )}

              {selectedLead.notes && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Notes</div>
                  <p className="text-xs text-gray-300 leading-relaxed">{selectedLead.notes}</p>
                </div>
              )}

              {selectedLead.tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLead.tags.map((tag) => (
                      <span key={tag} className="text-[11px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-gray-700">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-semibold transition-all">
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2 border border-gray-600 text-gray-300 text-sm rounded-lg hover:border-gray-500 transition-all">
                  <Calendar className="w-4 h-4" /> Schedule
                </button>
                <button className="flex items-center justify-center gap-2 py-2 px-3 border border-gray-600 text-gray-300 text-sm rounded-lg hover:border-gray-500 transition-all">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
