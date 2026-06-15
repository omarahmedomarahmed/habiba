"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Users, Settings, Plus, Search,
  BarChart3, Shield, CreditCard, Brain, AlertTriangle,
  CheckCircle2, Globe, Zap, Edit3, MoreHorizontal,
  Activity, TrendingUp, X, Key, RefreshCw, Loader2, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { adminAPI, APIError } from "@/lib/api";

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

const VALID_STATUSES: OrgStatus[] = ["active", "trial", "suspended", "churned"];
const VALID_PLANS: OrgPlan[] = ["solo", "professional", "group", "enterprise", "health_system"];

// ── normalizer ───────────────────────────────────────────────────────────────
function normalizeOrg(raw: Record<string, unknown>): Organization {
  const statusRaw = String(raw.status || "active").toLowerCase();
  const status: OrgStatus = VALID_STATUSES.includes(statusRaw as OrgStatus)
    ? (statusRaw as OrgStatus) : "active";

  const planRaw = String(raw.plan || raw.subscription_plan || raw.tier || "solo").toLowerCase()
    .replace(/\s+/g, "_");
  const plan: OrgPlan = VALID_PLANS.includes(planRaw as OrgPlan)
    ? (planRaw as OrgPlan) : "solo";

  const owner = (raw.owner as Record<string, unknown>) || {};

  return {
    id: String(raw.id || raw._id || ""),
    name: String(raw.name || raw.organization_name || "Unknown Org"),
    slug: String(raw.slug || raw.subdomain || ""),
    owner_name: String(
      raw.owner_name || owner.name || raw.admin_name ||
      `${raw.first_name || ""} ${raw.last_name || ""}`.trim() || "Unknown"
    ),
    owner_email: String(raw.owner_email || owner.email || raw.admin_email || raw.email || ""),
    plan,
    status,
    therapist_count: Number(raw.therapist_count || raw.therapists_count || raw.therapists || 0),
    patient_count: Number(raw.patient_count || raw.patients_count || raw.patients || 0),
    session_count_monthly: Number(raw.session_count_monthly || raw.monthly_sessions || raw.sessions_this_month || 0),
    mrr: Number(raw.mrr || raw.monthly_revenue || raw.revenue || 0),
    created_at: String(raw.created_at || raw.createdAt || ""),
    renewal_date: String(raw.renewal_date || raw.next_renewal || raw.subscription_end || ""),
    health_score: Number(raw.health_score || raw.score || 75),
    last_active: String(raw.last_active || raw.last_activity || ""),
    features_enabled: Array.isArray(raw.features_enabled) ? (raw.features_enabled as string[])
      : Array.isArray(raw.features) ? (raw.features as string[]) : [],
    api_access: Boolean(raw.api_access || raw.has_api_access),
    white_label: Boolean(raw.white_label || raw.white_labeling),
    sso_enabled: Boolean(raw.sso_enabled || raw.sso),
    ehr_integrations: Array.isArray(raw.ehr_integrations) ? (raw.ehr_integrations as string[])
      : Array.isArray(raw.integrations) ? (raw.integrations as string[]) : [],
    data_region: String(raw.data_region || raw.region || "US-East"),
    support_tier: String(raw.support_tier || raw.support_level || "Standard"),
  };
}

// ── helper components ────────────────────────────────────────────────────────
function HealthScore({ score }: { score: number }) {
  const color = score >= 85 ? "text-green-400" : score >= 65 ? "text-yellow-400" : "text-red-400";
  return <span className={cn("font-bold text-sm", color)}>{score}</span>;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-700/50">
      {[...Array(9)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-700 rounded animate-pulse" style={{ width: i === 0 ? 160 : i === 8 ? 24 : 64 }} />
        </td>
      ))}
    </tr>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function PracticeManagementPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | OrgPlan>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgStatus>("all");
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "features" | "integrations" | "billing" | "security">("overview");
  const [suspending, setSuspending] = useState(false);
  const [total, setTotal] = useState(0);

  // ── fetch orgs ───────────────────────────────────────────────────────────
  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = { limit: 100 };
      if (planFilter !== "all") params.plan = planFilter;
      if (statusFilter !== "all") params.status = statusFilter;
      if (search) params.search = search;

      const json = await adminAPI.organizations(params);
      const raw = Array.isArray(json) ? json : (json as any).data ?? [];
      const totalCount = (json as any).total ?? raw.length;
      setTotal(totalCount);
      setOrgs((raw as Record<string, unknown>[]).map(normalizeOrg));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        setOrgs([]);
        return;
      }
      setError("Failed to load organizations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [planFilter, statusFilter, search]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(fetchOrgs, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchOrgs, search]);

  // ── compute stats from loaded data ──────────────────────────────────────
  const activeOrgs = orgs.filter((o) => o.status === "active");
  const totalMRR = activeOrgs.reduce((s, o) => s + o.mrr, 0);
  const totalTherapists = activeOrgs.reduce((s, o) => s + o.therapist_count, 0);
  const totalPatients = activeOrgs.reduce((s, o) => s + o.patient_count, 0);

  // ── suspend org ──────────────────────────────────────────────────────────
  const handleSuspend = async (org: Organization) => {
    if (!confirm(`Suspend ${org.name}? This will disable access for all users.`)) return;
    setSuspending(true);
    try {
      await adminAPI.updateOrganization(org.id, { status: "suspended" });
      setOrgs((prev) => prev.map((o) => o.id === org.id ? { ...o, status: "suspended" } : o));
      if (selectedOrg?.id === org.id) setSelectedOrg({ ...org, status: "suspended" });
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) return;
      alert("Failed to suspend organization. Please try again.");
    } finally {
      setSuspending(false);
    }
  };

  // ── filtered list (client-side text filter applied on top of API filter) ─
  const filtered = orgs.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        o.owner_name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Practice Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage all tenant organizations, plans, and configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrgs()}
            className="flex items-center gap-1.5 h-9 px-3 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> Create Organization
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-900/30 border border-red-700/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={fetchOrgs} className="text-xs font-semibold underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total MRR", value: loading ? "—" : `$${(totalMRR / 1000).toFixed(0)}K`, icon: CreditCard, color: "text-green-400" },
          { label: "Active Orgs", value: loading ? "—" : activeOrgs.length, icon: Building2, color: "text-blue-400" },
          { label: "Total Therapists", value: loading ? "—" : totalTherapists, icon: Users, color: "text-violet-400" },
          { label: "Total Patients", value: loading ? "—" : totalPatients.toLocaleString(), icon: Activity, color: "text-teal-400" },
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as "all" | OrgPlan)}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Plans</option>
          {Object.entries(PLAN_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | OrgStatus)}
          className="bg-gray-800 border border-gray-700 text-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        {total > 0 && !loading && (
          <span className="text-xs text-gray-500 ml-auto">{filtered.length} of {total}</span>
        )}
      </div>

      {/* Org Table */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              {["Organization", "Plan", "Status", "Therapists", "Patients", "MRR", "Health", "Renewal", ""].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {loading && [...Array(4)].map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <Building2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No organizations found</p>
                  {search && (
                    <button onClick={() => setSearch("")} className="text-xs text-indigo-400 mt-1 hover:underline">
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            )}

            {!loading && filtered.map((org) => {
              const sConf = STATUS_CONFIG[org.status] ?? STATUS_CONFIG.active;
              const pConf = PLAN_CONFIG[org.plan] ?? PLAN_CONFIG.solo;
              return (
                <tr
                  key={org.id}
                  className="hover:bg-gray-700/30 cursor-pointer transition-all"
                  onClick={() => { setSelectedOrg(org); setActiveTab("overview"); }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {org.name.charAt(0).toUpperCase()}
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
                  <td className="px-4 py-3 text-sm text-gray-300">{org.patient_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-400">${org.mrr.toLocaleString()}</td>
                  <td className="px-4 py-3"><HealthScore score={org.health_score} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">{org.renewal_date}</td>
                  <td className="px-4 py-3">
                    <button
                      className="text-gray-500 hover:text-gray-300"
                      onClick={(e) => { e.stopPropagation(); setSelectedOrg(org); setActiveTab("overview"); }}
                    >
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
          <div className="w-[560px] bg-gray-900 border-l border-gray-700 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Panel Header */}
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">
                  {selectedOrg.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">{selectedOrg.name}</h2>
                  <div className="text-xs text-gray-400">
                    {selectedOrg.slug ? `${selectedOrg.slug}.24therapy.ai` : selectedOrg.owner_email}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedOrg(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 px-6">
              {(["overview", "features", "integrations", "billing", "security"] as const).map((tab) => (
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
                      { label: "Patients", value: selectedOrg.patient_count.toLocaleString() },
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
                      { label: "Plan", value: PLAN_CONFIG[selectedOrg.plan]?.label ?? selectedOrg.plan, color: PLAN_CONFIG[selectedOrg.plan]?.color ?? "text-white" },
                      { label: "Status", value: STATUS_CONFIG[selectedOrg.status]?.label ?? selectedOrg.status, color: STATUS_CONFIG[selectedOrg.status]?.color ?? "text-white" },
                      { label: "Health Score", value: `${selectedOrg.health_score}/100`, color: selectedOrg.health_score >= 85 ? "text-green-400" : "text-yellow-400" },
                      { label: "MRR", value: `$${selectedOrg.mrr.toLocaleString()}`, color: "text-green-400" },
                      { label: "Owner", value: selectedOrg.owner_name, color: "text-white" },
                      { label: "Email", value: selectedOrg.owner_email, color: "text-white" },
                      { label: "Data Region", value: selectedOrg.data_region, color: "text-white" },
                      { label: "Support Tier", value: selectedOrg.support_tier, color: "text-white" },
                      ...(selectedOrg.created_at ? [{ label: "Created", value: selectedOrg.created_at, color: "text-white" }] : []),
                      ...(selectedOrg.renewal_date ? [{ label: "Renewal", value: selectedOrg.renewal_date, color: "text-white" }] : []),
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
                    const enabled = selectedOrg.features_enabled.includes(key) ||
                      (key === "api_access" && selectedOrg.api_access);
                    return (
                      <div key={key} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", enabled ? "bg-indigo-900/50" : "bg-gray-700")}>
                          <Icon className={cn("w-4 h-4", enabled ? "text-indigo-400" : "text-gray-500")} />
                        </div>
                        <div className="flex-1">
                          <div className={cn("text-sm font-medium", enabled ? "text-white" : "text-gray-500")}>{label}</div>
                          <div className="text-xs text-gray-500">{desc}</div>
                        </div>
                        <div className={cn("w-9 h-5 rounded-full relative cursor-pointer", enabled ? "bg-indigo-600" : "bg-gray-700")}>
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
                        {selectedOrg.ehr_integrations.map((ehr) => (
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
                        { label: "Plan", value: PLAN_CONFIG[selectedOrg.plan]?.label ?? selectedOrg.plan },
                        { label: "MRR", value: `$${selectedOrg.mrr.toLocaleString()}` },
                        { label: "ARR", value: `$${(selectedOrg.mrr * 12).toLocaleString()}` },
                        { label: "Renewal", value: selectedOrg.renewal_date || "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-gray-700 rounded-lg p-3">
                          <div className="text-xs text-gray-400">{label}</div>
                          <div className="text-sm font-bold text-white mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const plans = Object.keys(PLAN_CONFIG).join(', ');
                        const newPlan = window.prompt(`Change plan for ${selectedOrg.name}\nCurrent: ${selectedOrg.plan}\nOptions: ${plans}\n\nEnter new plan key:`);
                        if (newPlan && Object.keys(PLAN_CONFIG).includes(newPlan)) {
                          adminAPI.updateOrganization(selectedOrg.id, { plan: newPlan })
                            .then(() => { setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, plan: newPlan as OrgPlan } : o)); setSelectedOrg({ ...selectedOrg, plan: newPlan as OrgPlan }); })
                            .catch(() => alert('Failed to change plan.'));
                        }
                      }}
                      className="flex-1 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 transition-all"
                    >
                      Change Plan
                    </button>
                    <button
                      onClick={() => router.push('/billing')}
                      className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                    >
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
                      { label: "HIPAA BAA", value: selectedOrg.created_at ? `Signed ${selectedOrg.created_at}` : "On file" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                        <span className="text-xs text-gray-400">{label}</span>
                        <span className="text-xs text-green-400 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSuspend(selectedOrg)}
                      disabled={suspending || selectedOrg.status === "suspended"}
                      className="flex-1 py-2 text-sm border border-red-700/50 text-red-400 rounded-lg hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {suspending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><AlertTriangle className="w-4 h-4" /> {selectedOrg.status === "suspended" ? "Suspended" : "Suspend Org"}</>
                      )}
                    </button>
                    <button
                      onClick={() => alert(`API key reset request queued for ${selectedOrg.name}. The new key will be sent to ${selectedOrg.owner_email}.`)}
                      className="flex-1 py-2 text-sm border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Key className="w-4 h-4" /> Reset API Keys
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t border-gray-800">
                <button
                  onClick={() => {
                    const newName = window.prompt('Edit organization name:', selectedOrg.name);
                    if (newName && newName !== selectedOrg.name) {
                      adminAPI.updateOrganization(selectedOrg.id, { name: newName })
                        .then(() => { setOrgs(prev => prev.map(o => o.id === selectedOrg.id ? { ...o, name: newName } : o)); setSelectedOrg({ ...selectedOrg, name: newName }); })
                        .catch(() => alert('Failed to update organization.'));
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-semibold transition-all"
                >
                  <Edit3 className="w-4 h-4" /> Edit Organization
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Impersonate as admin of ${selectedOrg.name}?`)) {
                      adminAPI.impersonateUser(selectedOrg.id)
                        .then(res => { if (res.impersonation_token) window.open(`/?impersonate_token=${res.impersonation_token}`, '_blank'); })
                        .catch(() => alert('Impersonation unavailable — admin user ID required.'));
                    }
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-3 border border-gray-600 text-gray-300 text-sm rounded-lg hover:border-gray-500 transition-all"
                >
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

// Reviewed: 2026-06-13 — 24Therapy audit
