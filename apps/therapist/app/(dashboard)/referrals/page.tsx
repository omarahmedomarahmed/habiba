"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Send, Plus, Search, CheckCircle2,
  AlertCircle, User, FileText, Phone, Mail, MapPin, Calendar,
  Building2, Brain, AlertTriangle, ArrowRight, Download,
  Eye, Edit3, Clipboard,
  Heart, Shield, Sparkles, Activity, MessageSquare, Clock, Loader2
} from "lucide-react";
import { cn, getInitials, formatDate } from "@/lib/utils";
import { referralsAPI, APIError } from "@/lib/api";

type ReferralStatus = "draft" | "sent" | "acknowledged" | "completed" | "declined" | "pending_info";
type ReferralUrgency = "routine" | "urgent" | "emergent";
type ReferralType = "psychiatry" | "psychology" | "social_work" | "primary_care" | "specialist" | "substance_use" | "eating_disorder" | "trauma" | "group_therapy" | "inpatient";

interface Referral {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_dob?: string;
  patient_insurance?: string;
  type: ReferralType;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  referred_to: string;
  referred_provider: string;
  referred_provider_credential?: string;
  reason: string;
  clinical_summary?: string;
  diagnoses: string[];
  medications: string[];
  created_at: string;
  sent_at?: string;
  acknowledged_at?: string;
  completed_at?: string;
  notes?: string;
  ai_generated: boolean;
}

const STATUS_CONFIG: Record<ReferralStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100", icon: Edit3 },
  sent: { label: "Sent", color: "text-blue-700", bg: "bg-blue-100", icon: Send },
  acknowledged: { label: "Acknowledged", color: "text-indigo-700", bg: "bg-indigo-100", icon: CheckCircle2 },
  completed: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-red-700", bg: "bg-red-100", icon: AlertCircle },
  pending_info: { label: "Pending Info", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
};

const URGENCY_CONFIG: Record<ReferralUrgency, { label: string; color: string; dot: string }> = {
  routine: { label: "Routine", color: "text-gray-600", dot: "bg-gray-400" },
  urgent: { label: "Urgent", color: "text-orange-700", dot: "bg-orange-500" },
  emergent: { label: "Emergent", color: "text-red-700", dot: "bg-red-500" },
};

const TYPE_CONFIG: Record<ReferralType, { label: string; color: string }> = {
  psychiatry: { label: "Psychiatry", color: "text-purple-700" },
  psychology: { label: "Psychology", color: "text-blue-700" },
  social_work: { label: "Social Work", color: "text-teal-700" },
  primary_care: { label: "Primary Care", color: "text-green-700" },
  specialist: { label: "Specialist", color: "text-slate-700" },
  substance_use: { label: "Substance Use", color: "text-orange-700" },
  eating_disorder: { label: "Eating Disorders", color: "text-rose-700" },
  trauma: { label: "Trauma", color: "text-indigo-700" },
  group_therapy: { label: "Group Therapy", color: "text-amber-700" },
  inpatient: { label: "Inpatient/IOP", color: "text-red-700" },
};

const REFERRAL_TEMPLATES = [
  { id: "t1", name: "Psychiatry - Medication Management", type: "psychiatry", urgency: "routine" },
  { id: "t2", name: "Psychiatric Evaluation - Urgent", type: "psychiatry", urgency: "urgent" },
  { id: "t3", name: "EMDR / Trauma Specialist", type: "trauma", urgency: "routine" },
  { id: "t4", name: "Substance Use / Dual Diagnosis", type: "substance_use", urgency: "urgent" },
  { id: "t5", name: "Eating Disorder Specialist", type: "eating_disorder", urgency: "urgent" },
  { id: "t6", name: "Group Therapy Referral", type: "group_therapy", urgency: "routine" },
  { id: "t7", name: "Inpatient/Crisis Evaluation", type: "inpatient", urgency: "emergent" },
  { id: "t8", name: "Primary Care Coordination", type: "primary_care", urgency: "routine" },
];

function normalizeReferral(raw: Record<string, unknown>): Referral {
  const patient = (raw.patient as Record<string, unknown>) || {};
  const patientName =
    (raw.patient_name as string) ||
    (patient.first_name ? `${patient.first_name} ${patient.last_name || ""}`.trim() : "Unknown");

  const validStatuses: ReferralStatus[] = ["draft", "sent", "acknowledged", "completed", "declined", "pending_info"];
  const status = validStatuses.includes(raw.status as ReferralStatus) ? (raw.status as ReferralStatus) : "draft";

  const validTypes = Object.keys(TYPE_CONFIG) as ReferralType[];
  const type = validTypes.includes(raw.type as ReferralType) ? (raw.type as ReferralType) : "specialist";

  const validUrgencies: ReferralUrgency[] = ["routine", "urgent", "emergent"];
  const urgency = validUrgencies.includes(raw.urgency as ReferralUrgency) ? (raw.urgency as ReferralUrgency) : "routine";

  return {
    id: (raw.id as string) || "",
    patient_id: (raw.patient_id as string) || (patient.id as string) || "",
    patient_name: patientName,
    patient_dob: (raw.patient_dob as string) || undefined,
    patient_insurance: (raw.patient_insurance as string) || (raw.insurance as string) || undefined,
    type,
    urgency,
    status,
    referred_to: (raw.referred_to as string) || (raw.organization as string) || "",
    referred_provider: (raw.referred_provider as string) || (raw.provider_name as string) || "",
    referred_provider_credential: (raw.referred_provider_credential as string) || undefined,
    reason: (raw.reason as string) || (raw.referral_reason as string) || "",
    clinical_summary: (raw.clinical_summary as string) || undefined,
    diagnoses: Array.isArray(raw.diagnoses) ? (raw.diagnoses as string[]) : [],
    medications: Array.isArray(raw.medications) ? (raw.medications as string[]) : [],
    created_at: (raw.created_at as string) || "",
    sent_at: (raw.sent_at as string) || undefined,
    acknowledged_at: (raw.acknowledged_at as string) || undefined,
    completed_at: (raw.completed_at as string) || undefined,
    notes: (raw.notes as string) || undefined,
    ai_generated: !!(raw.ai_generated ?? raw.is_ai_generated),
  };
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-gray-100 rounded" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
          <div className="h-3 w-full bg-gray-100 rounded" />
        </div>
        <div className="h-6 w-24 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

const LIMIT = 20;

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "templates">("list");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "all">("all");

  const totalPages = Math.ceil(total / LIMIT);

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: LIMIT,
        ...(search ? { search } : {}),
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      };
      const result = await referralsAPI.list(params);
      const raw = Array.isArray(result) ? result : ((result as { data?: unknown[] }).data ?? []);
      const tot = Array.isArray(result) ? (result as unknown[]).length : ((result as { total?: number }).total ?? raw.length);
      setReferrals((raw as Record<string, unknown>[]).map(normalizeReferral));
      setTotal(tot);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      if (err instanceof APIError && (err.status === 404 || err.status === 405)) {
        setReferrals([]);
      } else {
        setError((err as Error).message || "Failed to load referrals");
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchReferrals(); }, search ? 400 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals, statusFilter, page]);

  const handleSend = async (ref: Referral) => {
    if (ref.status !== "draft" || sendingId) return;
    setSendingId(ref.id);
    try {
      await referralsAPI.send(ref.id);
      const patch = { status: "sent" as ReferralStatus, sent_at: new Date().toISOString() };
      setReferrals((prev) => prev.map((r) => r.id === ref.id ? { ...r, ...patch } : r));
      if (selectedReferral?.id === ref.id) setSelectedReferral((prev) => prev ? { ...prev, ...patch } : prev);
    } catch { /* silently ignore */ }
    finally { setSendingId(null); }
  };

  const stats = {
    total: total,
    pending: referrals.filter((r) => ["draft", "sent", "pending_info"].includes(r.status)).length,
    completed: referrals.filter((r) => r.status === "completed").length,
    urgent: referrals.filter((r) => r.urgency === "urgent" || r.urgency === "emergent").length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Referrals</h1>
            <p className="text-ink-500 text-sm mt-1">AI-assisted referral letter generation and tracking</p>
          </div>
          <button className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Referral
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="card p-4 border-l-4 border-l-red-500 bg-red-50/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
            <button onClick={fetchReferrals} className="text-xs text-red-600 hover:underline font-medium">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Referrals", value: loading ? "—" : stats.total, icon: Send, color: "text-blue-600 bg-blue-50" },
            { label: "In Progress", value: loading ? "—" : stats.pending, icon: Clock, color: "text-amber-600 bg-amber-50" },
            { label: "Completed", value: loading ? "—" : stats.completed, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
            { label: "Urgent / Emergent", value: loading ? "—" : stats.urgent, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-ink-900">{s.value}</div>
                <div className="text-xs text-ink-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-tertiary rounded-lg w-fit">
          {[{ key: "list", label: "Referrals", icon: FileText }, { key: "templates", label: "Templates", icon: Clipboard }].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "list" | "templates")}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "list" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: List */}
            <div className="lg:col-span-3 space-y-4">
              {/* Filters */}
              <div className="card p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search referrals..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-field pl-9 w-full"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(["all", "draft", "sent", "acknowledged", "completed", "declined"] as const).map((s) => {
                    const cfg = s !== "all" ? STATUS_CONFIG[s] : null;
                    return (
                      <button
                        key={s}
                        onClick={() => { setStatusFilter(s); setPage(1); }}
                        className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors",
                          statusFilter === s
                            ? "bg-primary-600 text-white"
                            : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
                        )}
                      >
                        {s === "all" ? "All" : cfg?.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List */}
              {loading && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}

              {!loading && referrals.length === 0 && (
                <div className="card p-12 text-center">
                  <Send className="w-12 h-12 text-ink-300 mx-auto mb-3" />
                  <p className="text-ink-500 font-medium">No referrals found</p>
                  <p className="text-ink-400 text-sm mt-1">
                    {search || statusFilter !== "all" ? "Try adjusting your filters" : "Create your first referral"}
                  </p>
                </div>
              )}

              {!loading && referrals.map((ref) => {
                const statusCfg = STATUS_CONFIG[ref.status] ?? STATUS_CONFIG.draft;
                const urgencyCfg = URGENCY_CONFIG[ref.urgency] ?? URGENCY_CONFIG.routine;
                const typeCfg = TYPE_CONFIG[ref.type] ?? { label: "Specialist", color: "text-gray-600" };
                const StatusIcon = statusCfg.icon;
                const isSelected = selectedReferral?.id === ref.id;

                return (
                  <div
                    key={ref.id}
                    onClick={() => setSelectedReferral(ref)}
                    className={cn(
                      "card p-5 cursor-pointer hover:shadow-card-hover transition-all",
                      isSelected && "border-primary-300 bg-primary-50/20",
                      ref.urgency === "emergent" && "border-l-4 border-l-red-500",
                      ref.urgency === "urgent" && !isSelected && "border-l-4 border-l-orange-400"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary-700">{getInitials(ref.patient_name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-ink-900 text-sm">{ref.patient_name}</span>
                          <span className={cn("text-xs font-medium", typeCfg.color)}>→ {typeCfg.label}</span>
                          {ref.ai_generated && (
                            <span className="flex items-center gap-0.5 text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-full">
                              <Sparkles className="w-2.5 h-2.5" /> AI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-500 mb-1">{ref.referred_to} · {ref.referred_provider}</p>
                        <p className="text-xs text-ink-600 line-clamp-2">{ref.reason}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className={cn("flex items-center gap-1 font-medium", urgencyCfg.color)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", urgencyCfg.dot)} />
                            {urgencyCfg.label}
                          </span>
                          <span className="text-ink-400">{formatDate(ref.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={cn("flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-xl", statusCfg.bg, statusCfg.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                        {ref.status === "draft" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSend(ref); }}
                            disabled={sendingId === ref.id}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            {sendingId === ref.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Send
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-ink-500">
                    {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm disabled:opacity-40">Previous</button>
                    <span className="text-sm text-ink-600 font-medium">Page {page} of {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Detail panel */}
            <div className="lg:col-span-2">
              {selectedReferral ? (
                <div className="card p-5 space-y-5 sticky top-6">
                  {/* Patient */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                        <span className="font-bold text-primary-700">{getInitials(selectedReferral.patient_name)}</span>
                      </div>
                      <div>
                        <h2 className="font-bold text-ink-900">{selectedReferral.patient_name}</h2>
                        {selectedReferral.patient_dob && (
                          <p className="text-xs text-ink-500">DOB: {selectedReferral.patient_dob}</p>
                        )}
                        {selectedReferral.patient_insurance && (
                          <p className="text-xs text-ink-400">{selectedReferral.patient_insurance}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors" title="Download">
                        <Download className="w-4 h-4 text-ink-400" />
                      </button>
                      <button className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors" title="Edit">
                        <Edit3 className="w-4 h-4 text-ink-400" />
                      </button>
                    </div>
                  </div>

                  {/* Status timeline */}
                  <div className="bg-surface-secondary rounded-xl p-3 space-y-1.5">
                    {[
                      { label: "Created", date: selectedReferral.created_at, done: true },
                      { label: "Sent", date: selectedReferral.sent_at, done: !!selectedReferral.sent_at },
                      { label: "Acknowledged", date: selectedReferral.acknowledged_at, done: !!selectedReferral.acknowledged_at },
                      { label: "Completed", date: selectedReferral.completed_at, done: !!selectedReferral.completed_at },
                    ].map((step) => (
                      <div key={step.label} className={cn("flex items-center gap-2 text-xs", step.done ? "text-emerald-700" : "text-ink-400")}>
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", step.done ? "bg-emerald-500" : "bg-ink-200")} />
                        <span className="font-medium">{step.label}</span>
                        {step.date && <span className="ml-auto">{formatDate(step.date)}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Referred to */}
                  <div>
                    <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Referred To</h3>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-ink-900">{selectedReferral.referred_provider}</p>
                      {selectedReferral.referred_provider_credential && (
                        <p className="text-xs text-ink-500">{selectedReferral.referred_provider_credential}</p>
                      )}
                      <p className="text-xs text-ink-500">{selectedReferral.referred_to}</p>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Reason for Referral</h3>
                    <p className="text-sm text-ink-700 leading-relaxed">{selectedReferral.reason}</p>
                  </div>

                  {/* Diagnoses */}
                  {selectedReferral.diagnoses.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Diagnoses</h3>
                      <div className="space-y-1">
                        {selectedReferral.diagnoses.map((d, i) => (
                          <p key={i} className="text-xs text-ink-700 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-primary-600 shrink-0" />
                            {d}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {selectedReferral.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Clinical Notes</p>
                      <p className="text-xs text-amber-800">{selectedReferral.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {selectedReferral.status === "draft" && (
                      <button
                        onClick={() => handleSend(selectedReferral)}
                        disabled={sendingId === selectedReferral.id}
                        className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-50"
                      >
                        {sendingId === selectedReferral.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send Referral
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-2 border border-surface-tertiary rounded-xl text-xs text-ink-600 hover:bg-surface-tertiary transition-colors">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-2 border border-surface-tertiary rounded-xl text-xs text-ink-600 hover:bg-surface-tertiary transition-colors">
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card p-12 text-center">
                  <FileText className="w-12 h-12 text-ink-300 mx-auto mb-3" />
                  <p className="text-ink-500">Select a referral to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {REFERRAL_TEMPLATES.map((t) => {
              const urgencyCfg = URGENCY_CONFIG[t.urgency as ReferralUrgency];
              const typeCfg = TYPE_CONFIG[t.type as ReferralType];
              return (
                <div key={t.id} className="card p-4 hover:shadow-card-hover transition-all cursor-pointer group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-ink-900 text-sm">{t.name}</h3>
                      <p className={cn("text-xs font-medium mt-0.5", typeCfg?.color)}>{typeCfg?.label}</p>
                    </div>
                    <span className={cn("text-xs font-medium flex items-center gap-1", urgencyCfg.color)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", urgencyCfg.dot)} />
                      {urgencyCfg.label}
                    </span>
                  </div>
                  <button className="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3" /> Use Template
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
