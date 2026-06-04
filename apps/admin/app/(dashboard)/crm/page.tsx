"use client";

import { useState } from "react";
import {
  Target, Search, Filter, Plus, ChevronRight, Star,
  Mail, Phone, Calendar, DollarSign, BarChart3, Users,
  Clock, CheckCircle2, ArrowRight, Globe, Building,
  TrendingUp, Sparkles, MoreHorizontal, Eye, Send,
  AlertCircle, X, Check, Tag, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const STAGE_CONFIG: Record<LeadStage, { label: string; color: string; bg: string; border: string }> = {
  prospect: { label: "Prospect", color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-300" },
  contacted: { label: "Contacted", color: "text-blue-700", bg: "bg-blue-100", border: "border-blue-300" },
  demo_scheduled: { label: "Demo Scheduled", color: "text-violet-700", bg: "bg-violet-100", border: "border-violet-300" },
  negotiating: { label: "Negotiating", color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-300" },
  closed_won: { label: "Closed Won", color: "text-green-700", bg: "bg-green-100", border: "border-green-300" },
  closed_lost: { label: "Closed Lost", color: "text-red-700", bg: "bg-red-100", border: "border-red-300" },
};

const TYPE_CONFIG: Record<LeadType, { label: string; color: string }> = {
  solo_therapist: { label: "Solo", color: "text-blue-600" },
  group_practice: { label: "Group Practice", color: "text-violet-600" },
  enterprise: { label: "Enterprise", color: "text-orange-600" },
  health_system: { label: "Health System", color: "text-red-600" },
};

const MOCK_LEADS: Lead[] = [
  {
    id: "l1",
    name: "Dr. Katherine Wells",
    organization: "Mind & Balance Therapy",
    type: "group_practice",
    stage: "demo_scheduled",
    owner: "Sarah (Sales)",
    email: "k.wells@mindbalance.com",
    phone: "(212) 555-0123",
    therapist_count: 8,
    deal_value: 28800,
    source: "LinkedIn Outbound",
    last_contact: "2025-12-18",
    next_action: "Product demo",
    next_action_date: "2025-12-22",
    score: 87,
    notes: "Very interested in AI documentation tools. Currently using SimplePractice, frustrated with billing limitations.",
    tags: ["High Priority", "NYC Market", "Q1 Close"],
    created_at: "2025-12-01",
  },
  {
    id: "l2",
    name: "Horizon Mental Health",
    organization: "Horizon Mental Health Group",
    type: "enterprise",
    stage: "negotiating",
    owner: "Marcus (Enterprise)",
    email: "operations@horizonmh.org",
    phone: "(415) 555-0234",
    therapist_count: 45,
    deal_value: 162000,
    source: "Conference - APTA 2025",
    last_contact: "2025-12-19",
    next_action: "Legal contract review",
    next_action_date: "2025-12-28",
    score: 94,
    notes: "3-location health system in Bay Area. Requires custom EHR integration. BAA signed.",
    tags: ["Enterprise Deal", "EHR Integration", "Hot Lead"],
    created_at: "2025-11-10",
  },
  {
    id: "l3",
    name: "Dr. James Park",
    organization: "Park Psychology",
    type: "solo_therapist",
    stage: "contacted",
    owner: "AI Outbound",
    email: "dr.park@parkpsych.com",
    phone: "(312) 555-0345",
    therapist_count: 1,
    deal_value: 1788,
    source: "Google Ads",
    last_contact: "2025-12-17",
    next_action: "Follow up email",
    next_action_date: "2025-12-21",
    score: 62,
    notes: "Downloaded AI scribe whitepaper. Opened 3 emails. Saw pricing page twice.",
    tags: ["Marketing Qualified"],
    created_at: "2025-12-10",
  },
  {
    id: "l4",
    name: "Sunrise Community Counseling",
    organization: "Sunrise Community Health",
    type: "enterprise",
    stage: "closed_won",
    owner: "Aisha (Enterprise)",
    email: "admin@sunrisehealth.org",
    phone: "(214) 555-0456",
    therapist_count: 22,
    deal_value: 79200,
    source: "Inbound - Website",
    last_contact: "2025-12-15",
    next_action: "Onboarding kickoff",
    next_action_date: "2026-01-05",
    score: 100,
    notes: "Signed annual contract. 22 therapists, 3 admins. Onboarding scheduled for January.",
    tags: ["Won", "Annual Contract", "Q4 Close"],
    created_at: "2025-10-15",
  },
  {
    id: "l5",
    name: "Dr. Rebecca Osei",
    organization: "Osei Therapy Group",
    type: "group_practice",
    stage: "prospect",
    owner: "Unassigned",
    email: "r.osei@oseitherapy.com",
    phone: "(713) 555-0567",
    therapist_count: 5,
    deal_value: 18000,
    source: "Therapist Referral",
    last_contact: "—",
    next_action: "Initial outreach",
    next_action_date: "2025-12-21",
    score: 71,
    notes: "Referred by Dr. Wells. Practices in Houston. Uses Jane App currently.",
    tags: ["Referral Lead"],
    created_at: "2025-12-19",
  },
  {
    id: "l6",
    name: "VA Medical Center — Mental Health",
    organization: "US Department of Veterans Affairs",
    type: "health_system",
    stage: "contacted",
    owner: "Federal Sales Team",
    email: "mh.contracts@va.gov",
    phone: "(202) 555-0678",
    therapist_count: 200,
    deal_value: 840000,
    source: "Government RFP",
    last_contact: "2025-12-16",
    next_action: "RFP Response submission",
    next_action_date: "2026-01-15",
    score: 78,
    notes: "Federal contract opportunity. 18-month procurement process. FISMA compliance required.",
    tags: ["Federal", "Long Cycle", "Strategic"],
    created_at: "2025-11-01",
  },
];

const PIPELINE_STAGES: LeadStage[] = ["prospect", "contacted", "demo_scheduled", "negotiating", "closed_won"];

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-700 bg-green-100" : score >= 60 ? "text-yellow-700 bg-yellow-100" : "text-slate-600 bg-slate-100";
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", color)}>{score}</span>;
}

export default function AdminCRMPage() {
  const [view, setView] = useState<"pipeline" | "list" | "analytics">("pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<"all" | LeadStage>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const filteredLeads = MOCK_LEADS.filter(l => {
    if (selectedStage !== "all" && l.stage !== selectedStage) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.organization.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
    }
    return true;
  });

  const pipelineValue = MOCK_LEADS.filter(l => l.stage !== "closed_won" && l.stage !== "closed_lost")
    .reduce((sum, l) => sum + l.deal_value, 0);
  const wonValue = MOCK_LEADS.filter(l => l.stage === "closed_won").reduce((sum, l) => sum + l.deal_value, 0);
  const hotLeads = MOCK_LEADS.filter(l => l.score >= 80 && l.stage !== "closed_won" && l.stage !== "closed_lost").length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">CRM & Sales Pipeline</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track leads, demos, and enterprise deals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1">
            {(["pipeline", "list", "analytics"] as const).map(v => (
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

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pipeline Value", value: formatCurrency(pipelineValue), icon: TrendingUp, color: "text-blue-400", change: "+$48K this week" },
          { label: "Won (Q4)", value: formatCurrency(wonValue), icon: CheckCircle2, color: "text-green-400", change: "2 deals closed" },
          { label: "Hot Leads", value: hotLeads, icon: Star, color: "text-yellow-400", change: `Score ≥80` },
          { label: "Active Deals", value: MOCK_LEADS.filter(l => !["closed_won", "closed_lost"].includes(l.stage)).length, icon: Target, color: "text-violet-400", change: "Across all stages" },
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
            🔥 <strong>Horizon Mental Health</strong> has 94/100 score — contract review phase, high likelihood of close this month.
            · ⚡ <strong>3 prospects</strong> visited the pricing page in the last 24hrs — consider triggering follow-up sequence.
            · 📊 <strong>Group practice</strong> conversion rate is 2.4x higher than solo this quarter.
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
            {PIPELINE_STAGES.map(stage => {
              const stageLeads = MOCK_LEADS.filter(l => l.stage === stage);
              const stageValue = stageLeads.reduce((s, l) => s + l.deal_value, 0);
              const conf = STAGE_CONFIG[stage];
              return (
                <div key={stage} className="w-72">
                  <div className={cn("rounded-lg border px-3 py-2 mb-3", conf.bg, conf.border)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-bold", conf.color)}>{conf.label}</span>
                      <span className={cn("text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center bg-white", conf.color)}>
                        {stageLeads.length}
                      </span>
                    </div>
                    <div className={cn("text-xs mt-0.5", conf.color)}>{formatCurrency(stageValue)}</div>
                  </div>

                  <div className="space-y-2.5">
                    {stageLeads.map(lead => (
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
                          <span className={cn("text-[10px] font-semibold", TYPE_CONFIG[lead.type].color)}>
                            {TYPE_CONFIG[lead.type].label}
                          </span>
                          <span className="text-gray-600">·</span>
                          <span className="text-[10px] text-gray-400">{lead.therapist_count} therapists</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-green-400">{formatCurrency(lead.deal_value)}</span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {lead.next_action_date.substring(5)}
                          </div>
                        </div>

                        {lead.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="inline-block mt-1.5 mr-1 text-[9px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Won Column */}
            <div className="w-72">
              <div className="rounded-lg border border-green-700/50 bg-green-900/20 px-3 py-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-green-400">Closed Won</span>
                  <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center bg-green-900 text-green-400">
                    {MOCK_LEADS.filter(l => l.stage === "closed_won").length}
                  </span>
                </div>
                <div className="text-xs text-green-400">{formatCurrency(wonValue)}</div>
              </div>
              <div className="space-y-2.5">
                {MOCK_LEADS.filter(l => l.stage === "closed_won").map(lead => (
                  <div key={lead.id} className="bg-green-900/20 border border-green-800/50 rounded-xl p-3">
                    <div className="text-sm font-semibold text-green-300">{lead.organization}</div>
                    <div className="text-xs text-green-500">{lead.name}</div>
                    <div className="text-sm font-bold text-green-400 mt-1.5">{formatCurrency(lead.deal_value)}/yr</div>
                  </div>
                ))}
              </div>
            </div>
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
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value as any)}
              className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="all">All Stages</option>
              {Object.entries(STAGE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  {["Organization", "Stage", "Type", "Therapists", "Deal Value", "Score", "Next Action", "Owner"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filteredLeads.map(lead => {
                  const sConf = STAGE_CONFIG[lead.stage];
                  return (
                    <tr key={lead.id} className="hover:bg-gray-700/30 cursor-pointer transition-all" onClick={() => setSelectedLead(lead)}>
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
                        <span className={cn("text-[11px] font-semibold", TYPE_CONFIG[lead.type].color)}>
                          {TYPE_CONFIG[lead.type].label}
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
            <div className="space-y-3">
              {PIPELINE_STAGES.map(stage => {
                const stageLeads = MOCK_LEADS.filter(l => l.stage === stage);
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
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Lead Source Breakdown</h3>
            <div className="space-y-2.5">
              {[
                { source: "LinkedIn Outbound", count: 12, value: 156000 },
                { source: "Google Ads", count: 28, value: 86000 },
                { source: "Inbound - Website", count: 45, value: 210000 },
                { source: "Conference/Events", count: 8, value: 340000 },
                { source: "Referrals", count: 15, value: 95000 },
                { source: "Government RFP", count: 2, value: 1240000 },
              ].map(({ source, count, value }) => (
                <div key={source} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex-1">{source}</span>
                  <span className="text-gray-500 w-12 text-right">{count} leads</span>
                  <span className="text-green-400 font-semibold w-20 text-right">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Monthly Revenue Forecast</h3>
            <div className="space-y-2">
              {[
                { month: "Jan 2026", mrr: 145000, confidence: 92 },
                { month: "Feb 2026", mrr: 167000, confidence: 78 },
                { month: "Mar 2026", mrr: 188000, confidence: 65 },
              ].map(({ month, mrr, confidence }) => (
                <div key={month} className="flex items-center gap-4 py-2 border-b border-gray-700/50 last:border-0">
                  <div className="text-xs text-gray-400 w-20">{month}</div>
                  <div className="text-sm font-bold text-white">{formatCurrency(mrr)}</div>
                  <div className="flex-1">
                    <div className="w-full h-1.5 bg-gray-700 rounded-full">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${confidence}%` }} />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 w-12 text-right">{confidence}% conf</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-bold text-white mb-4">Team Performance</h3>
            <div className="space-y-3">
              {[
                { name: "Aisha (Enterprise)", deals: 3, value: 340000, won: 1 },
                { name: "Marcus (Enterprise)", deals: 2, value: 240000, won: 0 },
                { name: "Sarah (Sales)", deals: 8, value: 86000, won: 3 },
                { name: "AI Outbound", deals: 15, value: 48000, won: 2 },
              ].map(({ name, deals, value, won }) => (
                <div key={name} className="flex items-center gap-3 text-xs">
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                    {name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-gray-300 font-medium">{name}</div>
                    <div className="text-gray-500">{deals} active · {won} won</div>
                  </div>
                  <div className="text-green-400 font-bold">{formatCurrency(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Panel */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end" onClick={() => setSelectedLead(null)}>
          <div className="w-[480px] bg-gray-900 border-l border-gray-700 h-full overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{selectedLead.organization}</h2>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={cn("text-xs font-bold px-2 py-1 rounded-full border", STAGE_CONFIG[selectedLead.stage].bg, STAGE_CONFIG[selectedLead.stage].color, STAGE_CONFIG[selectedLead.stage].border)}>
                  {STAGE_CONFIG[selectedLead.stage].label}
                </span>
                <span className={cn("text-xs font-semibold", TYPE_CONFIG[selectedLead.type].color)}>
                  {TYPE_CONFIG[selectedLead.type].label}
                </span>
                <ScoreBadge score={selectedLead.score} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Deal Value", value: formatCurrency(selectedLead.deal_value) + "/yr" },
                  { label: "Therapists", value: `${selectedLead.therapist_count}` },
                  { label: "Lead Source", value: selectedLead.source },
                  { label: "Owner", value: selectedLead.owner },
                  { label: "Last Contact", value: selectedLead.last_contact },
                  { label: "Created", value: selectedLead.created_at },
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
                <div className="text-xs text-gray-400 mt-0.5">{selectedLead.email}</div>
                <div className="text-xs text-gray-400">{selectedLead.phone}</div>
              </div>

              <div className="bg-orange-900/30 border border-orange-700/40 rounded-lg p-3">
                <div className="text-xs font-bold text-orange-400 mb-1">Next Action</div>
                <div className="text-sm text-white">{selectedLead.next_action}</div>
                <div className="text-xs text-orange-300/70 mt-0.5">{selectedLead.next_action_date}</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Notes</div>
                <p className="text-xs text-gray-300 leading-relaxed">{selectedLead.notes}</p>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedLead.tags.map(tag => (
                    <span key={tag} className="text-[11px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              </div>

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
