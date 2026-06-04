"use client";

import { useState } from "react";
import {
  Building2, Users, Settings, ChevronRight, Plus, Search,
  BarChart3, Shield, CreditCard, Brain, AlertTriangle,
  CheckCircle2, Clock, Globe, Zap, Edit3, Trash2, MoreHorizontal,
  Activity, Star, TrendingUp, X, Check, Key, Copy, Eye, EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";

type OrgStatus = "active" | "trial" | "suspended" | "churned";
type OrgPlan = "solo" | "professional" | "group" | "enterprise" | "health_system";

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_name: string;
  owner_email: string;
  plan: OrgPlan;
  status: OrgStatus;
  therapist_count: number;
  patient_count: number;
  session_count_monthly: number;
  mrr: number;
  created_at: string;
  renewal_date: string;
  health_score: number;
  last_active: string;
  features_enabled: string[];
  api_access: boolean;
  white_label: boolean;
  sso_enabled: boolean;
  ehr_integrations: string[];
  data_region: string;
  support_tier: string;
}

const STATUS_CONFIG: Record<OrgStatus, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: "Active", color: "text-green-400", bg: "bg-green-900/30", dot: "bg-green-400" },
  trial: { label: "Trial", color: "text-yellow-400", bg: "bg-yellow-900/30", dot: "bg-yellow-400" },
  suspended: { label: "Suspended", color: "text-orange-400", bg: "bg-orange-900/30", dot: "bg-orange-400" },
  churned: { label: "Churned", color: "text-red-400", bg: "bg-red-900/30", dot: "bg-red-400" },
};

const PLAN_CONFIG: Record<OrgPlan, { label: string; color: string }> = {
  solo: { label: "Solo", color: "text-blue-400" },
  professional: { label: "Professional", color: "text-violet-400" },
  group: { label: "Group", color: "text-teal-400" },
  enterprise: { label: "Enterprise", color: "text-orange-400" },
  health_system: { label: "Health System", color: "text-red-400" },
};

const MOCK_ORGS: Organization[] = [
  {
    id: "org1",
    name: "Horizon Mental Health Group",
    slug: "horizon-mh",
    owner_name: "Dr. Catherine Bell",
    owner_email: "c.bell@horizonmh.org",
    plan: "enterprise",
    status: "active",
    therapist_count: 45,
    patient_count: 1240,
    session_count_monthly: 2890,
    mrr: 13500,
    created_at: "2024-02-15",
    renewal_date: "2025-02-15",
    health_score: 94,
    last_active: "Today",
    features_enabled: ["ai_scribe", "memory_layer", "risk_monitor", "analytics", "billing", "telehealth", "api_access"],
    api_access: true,
    white_label: true,
    sso_enabled: true,
    ehr_integrations: ["Epic", "Cerner"],
    data_region: "US-East",
    support_tier: "Enterprise (24/7 SLA)",
  },
  {
    id: "org2",
    name: "Mind & Balance Therapy",
    slug: "mind-balance",
    owner_name: "Dr. Katherine Wells",
    owner_email: "k.wells@mindbalance.com",
    plan: "group",
    status: "active",
    therapist_count: 8,
    patient_count: 195,
    session_count_monthly: 312,
    mrr: 2400,
    created_at: "2024-08-10",
    renewal_date: "2025-08-10",
    health_score: 81,
    last_active: "Yesterday",
    features_enabled: ["ai_scribe", "memory_layer", "risk_monitor", "analytics", "telehealth"],
    api_access: false,
    white_label: false,
    sso_enabled: false,
    ehr_integrations: [],
    data_region: "US-East",
    support_tier: "Priority",
  },
  {
    id: "org3",
    name: "Dr. Sarah Mitchell — Solo",
    slug: "smitchell-solo",
    owner_name: "Dr. Sarah Mitchell",
    owner_email: "s.mitchell@sarahmitchell.com",
    plan: "professional",
    status: "active",
    therapist_count: 1,
    patient_count: 28,
    session_count_monthly: 42,
    mrr: 149,
    created_at: "2025-03-01",
    renewal_date: "2026-03-01",
    health_score: 92,
    last_active: "Today",
    features_enabled: ["ai_scribe", "memory_layer", "risk_monitor", "telehealth"],
    api_access: false,
    white_label: false,
    sso_enabled: false,
    ehr_integrations: [],
    data_region: "US-West",
    support_tier: "Standard",
  },
  {
    id: "org4",
    name: "Sunrise Community Health",
    slug: "sunrise-community",
    owner_name: "Jessica Park",
    owner_email: "jpark@sunrisehealth.org",
    plan: "enterprise",
    status: "active",
    therapist_count: 22,
    patient_count: 580,
    session_count_monthly: 1245,
    mrr: 6600,
    created_at: "2023-12-01",
    renewal_date: "2025-12-01",
    health_score: 88,
    last_active: "Today",
    features_enabled: ["ai_scribe", "memory_layer", "risk_monitor", "analytics", "billing", "telehealth", "compliance"],
    api_access: true,
    white_label: false,
    sso_enabled: true,
    ehr_integrations: ["Athenahealth"],
    data_region: "US-East",
    support_tier: "Enterprise (Business Hours)",
  },
  {
    id: "org5",
    name: "Clearwater Wellness",
    slug: "clearwater-wellness",
    owner_name: "Dr. Tom Bradley",
    owner_email: "t.bradley@clearwater.com",
    plan: "group",
    status: "trial",
    therapist_count: 4,
    patient_count: 15,
    session_count_monthly: 22,
    mrr: 0,
    created_at: "2025-12-10",
    renewal_date: "2025-12-24",
    health_score: 67,
    last_active: "2 days ago",
    features_enabled: ["ai_scribe", "telehealth"],
    api_access: false,
    white_label: false,
    sso_enabled: false,
    ehr_integrations: [],
    data_region: "US-West",
    support_tier: "Trial",
  },
];

function HealthScore({ score }: { score: number }) {
  const color = score >= 85 ? "text-green-400" : score >= 65 ? "text-yellow-400" : "text-red-400";
  return <span className={cn("font-bold text-sm", color)}>{score}</span>;
}

export default function PracticeManagementPage() {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | OrgPlan>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgStatus>("all");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "integrations" | "billing" | "security">("overview");

  const filtered = MOCK_ORGS.filter(o => {
    if (planFilter !== "all" && o.plan !== planFilter) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.name.toLowerCase().includes(q) || o.owner_name.toLowerCase().includes(q) || o.slug.includes(q);
    }
    return true;
  });

  const totalMRR = MOCK_ORGS.filter(o => o.status === "active").reduce((s, o) => s + o.mrr, 0);
  const totalTherapists = MOCK_ORGS.filter(o => o.status === "active").reduce((s, o) => s + o.therapist_count, 0);
  const totalPatients = MOCK_ORGS.filter(o => o.status === "active").reduce((s, o) => s + o.patient_count, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Practice Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage all tenant organizations, plans, and configurations</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
          <Plus className="w-4 h-4" /> Create Organization
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total MRR", value: `$${(totalMRR / 1000).toFixed(0)}K`, icon: CreditCard, color: "text-green-400" },
          { label: "Active Orgs", value: MOCK_ORGS.filter(o => o.status === "active").length, icon: Building2, color: "text-blue-400" },
          { label: "Total Therapists", value: totalTherapists, icon: Users, color: "text-violet-400" },
          { label: "Total Patients", value: totalPatients.toLocaleString(), icon: Activity, color: "text-teal-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs">{label}</span>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <div className="text-2xl font-black text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value as any)}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="all">All Plans</option>
          {Object.entries(PLAN_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Org Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              {["Organization", "Plan", "Status", "Therapists", "Patients", "MRR", "Health", "Renewal", ""].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filtered.map(org => {
              const sConf = STATUS_CONFIG[org.status];
              const pConf = PLAN_CONFIG[org.plan];
              return (
                <tr key={org.id} className="hover:bg-gray-700/30 cursor-pointer transition-all" onClick={() => setSelectedOrg(org)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {org.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{org.name}</div>
                        <div className="text-xs text-gray-400">{org.owner_name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold", pConf.color)}>{pConf.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full", sConf.bg, sConf.color)}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", sConf.dot)} />
                      {sConf.label}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{org.therapist_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{org.patient_count}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-400">${org.mrr.toLocaleString()}</td>
                  <td className="px-4 py-3"><HealthScore score={org.health_score} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{org.renewal_date}</td>
                  <td className="px-4 py-3">
                    <button className="text-gray-500 hover:text-gray-300" onClick={e => { e.stopPropagation(); }}>
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Org Detail Panel */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-end" onClick={() => setSelectedOrg(null)}>
          <div className="w-[560px] bg-gray-900 border-l border-gray-700 h-full overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Panel Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                  {selectedOrg.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">{selectedOrg.name}</h2>
                  <div className="text-xs text-gray-400">{selectedOrg.slug}.24therapy.ai</div>
                </div>
              </div>
              <button onClick={() => setSelectedOrg(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 px-6">
              {(["overview", "features", "integrations", "billing", "security"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn(
                    "text-xs font-semibold capitalize py-3 px-3 border-b-2 transition-all",
                    activeTab === tab ? "border-indigo-500 text-indigo-400" : "border-transparent text-gray-500 hover:text-gray-300"
                  )}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-5">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Therapists", value: selectedOrg.therapist_count },
                      { label: "Patients", value: selectedOrg.patient_count },
                      { label: "Monthly Sessions", value: selectedOrg.session_count_monthly },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-800 rounded-lg p-3 text-center">
                        <div className="text-xl font-black text-white">{value}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-bold text-gray-400 uppercase">Organization Details</div>
                    {[
                      { label: "Plan", value: PLAN_CONFIG[selectedOrg.plan].label, color: PLAN_CONFIG[selectedOrg.plan].color },
                      { label: "Status", value: STATUS_CONFIG[selectedOrg.status].label, color: STATUS_CONFIG[selectedOrg.status].color },
                      { label: "Health Score", value: `${selectedOrg.health_score}/100`, color: selectedOrg.health_score >= 85 ? "text-green-400" : "text-yellow-400" },
                      { label: "MRR", value: `$${selectedOrg.mrr.toLocaleString()}`, color: "text-green-400" },
                      { label: "Owner", value: selectedOrg.owner_name, color: "text-white" },
                      { label: "Email", value: selectedOrg.owner_email, color: "text-white" },
                      { label: "Data Region", value: selectedOrg.data_region, color: "text-white" },
                      { label: "Support Tier", value: selectedOrg.support_tier, color: "text-white" },
                      { label: "Created", value: selectedOrg.created_at, color: "text-white" },
                      { label: "Renewal", value: selectedOrg.renewal_date, color: "text-white" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className={cn("font-medium", color)}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {selectedOrg.white_label && (
                    <div className="bg-violet-900/30 border border-violet-700/40 rounded-lg p-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-violet-400" />
                      <div>
                        <div className="text-xs font-bold text-violet-300">White-Label Enabled</div>
                        <div className="text-xs text-violet-400/70">Custom domain and branding active</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Features Tab */}
              {activeTab === "features" && (
                <div className="space-y-3">
                  {[
                    { key: "ai_scribe", label: "AI Session Notes", icon: Brain, desc: "AI-generated clinical documentation" },
                    { key: "memory_layer", label: "Memory Layer", icon: Activity, desc: "Longitudinal patient intelligence" },
                    { key: "risk_monitor", label: "Risk Monitoring", icon: AlertTriangle, desc: "AI safety alerts and radar" },
                    { key: "analytics", label: "Advanced Analytics", icon: BarChart3, desc: "Clinical outcomes and business intelligence" },
                    { key: "billing", label: "Billing Module", icon: CreditCard, desc: "Insurance claims and payment processing" },
                    { key: "telehealth", label: "Telehealth", icon: Globe, desc: "HIPAA video sessions" },
                    { key: "compliance", label: "Compliance Tools", icon: Shield, desc: "Audit logs and HIPAA reporting" },
                    { key: "api_access", label: "API Access", icon: Key, desc: "REST API and webhooks" },
                  ].map(({ key, label, icon: Icon, desc }) => {
                    const enabled = selectedOrg.features_enabled.includes(key) || (key === "api_access" && selectedOrg.api_access);
                    return (
                      <div key={key} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", enabled ? "bg-indigo-900/50" : "bg-gray-700")}>
                          <Icon className={cn("w-4 h-4", enabled ? "text-indigo-400" : "text-gray-500")} />
                        </div>
                        <div className="flex-1">
                          <div className={cn("text-sm font-medium", enabled ? "text-white" : "text-gray-500")}>{label}</div>
                          <div className="text-xs text-gray-500">{desc}</div>
                        </div>
                        <div className={cn(
                          "w-9 h-5 rounded-full relative cursor-pointer",
                          enabled ? "bg-indigo-600" : "bg-gray-700"
                        )}>
                          <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", enabled ? "left-4" : "left-0.5")} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Integrations Tab */}
              {activeTab === "integrations" && (
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-3">EHR Integrations</div>
                    {selectedOrg.ehr_integrations.length > 0 ? (
                      <div className="space-y-2">
                        {selectedOrg.ehr_integrations.map(ehr => (
                          <div key={ehr} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              <span className="text-sm text-white">{ehr}</span>
                            </div>
                            <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">Connected</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No EHR integrations configured.</p>
                    )}
                    <button className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add Integration
                    </button>
                  </div>

                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-3">Platform Access</div>
                    {[
                      { label: "SSO / SAML", enabled: selectedOrg.sso_enabled },
                      { label: "API Access", enabled: selectedOrg.api_access },
                      { label: "White-Label", enabled: selectedOrg.white_label },
                    ].map(({ label, enabled }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                        <span className="text-sm text-gray-300">{label}</span>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                          enabled ? "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-500"
                        )}>{enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Billing Tab */}
              {activeTab === "billing" && (
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-3">Subscription</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Plan", value: PLAN_CONFIG[selectedOrg.plan].label },
                        { label: "MRR", value: `$${selectedOrg.mrr.toLocaleString()}` },
                        { label: "ARR", value: `$${(selectedOrg.mrr * 12).toLocaleString()}` },
                        { label: "Renewal", value: selectedOrg.renewal_date },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-700 rounded-lg p-3">
                          <div className="text-xs text-gray-400">{label}</div>
                          <div className="text-sm font-bold text-white mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 transition-all">
                      Change Plan
                    </button>
                    <button className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all">
                      View Invoices
                    </button>
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === "security" && (
                <div className="space-y-4">
                  <div className="bg-gray-800 rounded-xl p-4">
                    <div className="text-xs font-bold text-gray-400 uppercase mb-3">Security Settings</div>
                    {[
                      { label: "Data Region", value: selectedOrg.data_region },
                      { label: "Encryption", value: "AES-256 at rest" },
                      { label: "In-Transit", value: "TLS 1.3" },
                      { label: "Audit Logs", value: "Enabled (90-day retention)" },
                      { label: "HIPAA BAA", value: "Signed 2024-02-15" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                        <span className="text-xs text-gray-400">{label}</span>
                        <span className="text-xs text-green-400 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button className="flex-1 py-2 text-sm border border-red-700/50 text-red-400 rounded-lg hover:bg-red-900/20 transition-all flex items-center justify-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Suspend Org
                    </button>
                    <button className="flex-1 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 transition-all flex items-center justify-center gap-2">
                      <Key className="w-4 h-4" /> Reset API Keys
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-800">
                <button className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-semibold transition-all">
                  <Edit3 className="w-4 h-4" /> Edit Organization
                </button>
                <button className="flex items-center justify-center gap-2 py-2 px-3 border border-gray-600 text-gray-300 text-sm rounded-lg hover:border-gray-500 transition-all">
                  <Shield className="w-4 h-4" /> Impersonate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
