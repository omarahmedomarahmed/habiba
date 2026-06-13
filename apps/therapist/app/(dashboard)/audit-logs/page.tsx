"use client";

import { useState, useEffect } from "react";
import {
  Shield, Search, Filter, Download, Eye, FileText, Users,
  Lock, AlertTriangle, ChevronDown, RefreshCw, Calendar,
  Activity, Clock, ArrowRight, CheckCircle, X, Info
} from "lucide-react";
import { organizationsAPI } from "@/lib/api";

type AuditAction =
  | "view_record" | "edit_note" | "create_note" | "delete_note" | "sign_note"
  | "view_patient" | "export_records" | "login" | "logout" | "failed_login"
  | "change_permission" | "ai_generation" | "message_send" | "download_report"
  | "session_start" | "session_end" | "change_password" | "api_access";

type AuditCategory = "all" | "phi_access" | "notes" | "auth" | "ai" | "exports" | "admin";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  category: Exclude<AuditCategory, "all">;
  actor_name: string;
  actor_role: string;
  target_type?: string;
  target_name?: string;
  patient_id?: string;
  patient_name?: string;
  ip_address: string;
  user_agent: string;
  outcome: "success" | "failure" | "warning";
  details?: string;
  session_id?: string;
}

const AUDIT_LOGS: AuditEntry[] = [
  { id: "a1", timestamp: "2026-06-04T14:32:11Z", action: "sign_note", category: "notes", actor_name: "Dr. Sarah Chen", actor_role: "Owner", target_type: "Clinical Note", target_name: "Session Note #1842", patient_id: "P001", patient_name: "Jordan A.", ip_address: "192.168.1.45", user_agent: "Chrome/120", outcome: "success", details: "SOAP note signed and finalized for session 2026-06-04" },
  { id: "a2", timestamp: "2026-06-04T14:28:55Z", action: "ai_generation", category: "ai", actor_name: "Dr. Sarah Chen", actor_role: "Owner", target_type: "AI Scribe", target_name: "Session Note Draft", patient_id: "P001", patient_name: "Jordan A.", ip_address: "192.168.1.45", user_agent: "Chrome/120", outcome: "success", details: "SOAP note generated via AI Scribe. Model: gpt-4o. Format: SOAP. Duration: 47 min session." },
  { id: "a3", timestamp: "2026-06-04T14:15:02Z", action: "session_start", category: "phi_access", actor_name: "Dr. Sarah Chen", actor_role: "Owner", target_type: "Session", target_name: "Video Session", patient_id: "P001", patient_name: "Jordan A.", ip_address: "192.168.1.45", user_agent: "Chrome/120", outcome: "success" },
  { id: "a4", timestamp: "2026-06-04T13:50:31Z", action: "view_patient", category: "phi_access", actor_name: "Marcus Webb", actor_role: "Supervisor", target_type: "Patient Record", target_name: "Full Patient File", patient_id: "P003", patient_name: "Alex R.", ip_address: "192.168.1.52", user_agent: "Chrome/120", outcome: "success", details: "Supervisory review of intern caseload" },
  { id: "a5", timestamp: "2026-06-04T13:42:19Z", action: "edit_note", category: "notes", actor_name: "Aisha Donnelly", actor_role: "Intern", target_type: "Clinical Note", target_name: "Progress Note #0937", patient_id: "P007", patient_name: "Sam K.", ip_address: "192.168.1.61", user_agent: "Firefox/121", outcome: "success", details: "Edited diagnostic impression section. Pending supervisor co-sign." },
  { id: "a6", timestamp: "2026-06-04T12:30:00Z", action: "export_records", category: "exports", actor_name: "Dr. Sarah Chen", actor_role: "Owner", target_type: "Patient Records", target_name: "Treatment Summary Export", patient_id: "P002", patient_name: "Riley M.", ip_address: "192.168.1.45", user_agent: "Chrome/120", outcome: "success", details: "PDF export for insurance authorization. Patient consent obtained." },
  { id: "a7", timestamp: "2026-06-04T11:15:44Z", action: "failed_login", category: "auth", actor_name: "Unknown", actor_role: "—", ip_address: "94.240.11.182", user_agent: "Python-requests/2.28", outcome: "failure", details: "3 failed login attempts from unknown IP. Account temporarily locked for 15 minutes." },
  { id: "a8", timestamp: "2026-06-04T10:58:22Z", action: "login", category: "auth", actor_name: "Dr. Priya Patel", actor_role: "Therapist", ip_address: "10.0.0.23", user_agent: "Safari/17", outcome: "success" },
  { id: "a9", timestamp: "2026-06-04T10:31:10Z", action: "view_record", category: "phi_access", actor_name: "James Okafor", actor_role: "Therapist", target_type: "Session Transcript", target_name: "Session Transcript #2241", patient_id: "P011", patient_name: "Casey T.", ip_address: "10.0.0.31", user_agent: "Chrome/120", outcome: "success" },
  { id: "a10", timestamp: "2026-06-04T09:14:05Z", action: "change_permission", category: "admin", actor_name: "Dr. Sarah Chen", actor_role: "Owner", target_type: "User", target_name: "Aisha Donnelly", ip_address: "192.168.1.45", user_agent: "Chrome/120", outcome: "success", details: "Expanded supervisor access to include Aisha Donnelly's caseload" },
  { id: "a11", timestamp: "2026-06-03T16:45:22Z", action: "create_note", category: "notes", actor_name: "Dr. Priya Patel", actor_role: "Therapist", target_type: "Clinical Note", target_name: "Intake Assessment Note", patient_id: "P015", patient_name: "New Patient", ip_address: "10.0.0.23", user_agent: "Safari/17", outcome: "success" },
  { id: "a12", timestamp: "2026-06-03T15:00:00Z", action: "download_report", category: "exports", actor_name: "Dr. Sarah Chen", actor_role: "Owner", target_type: "Practice Report", target_name: "Monthly Outcomes Report", ip_address: "192.168.1.45", user_agent: "Chrome/120", outcome: "success" },
];

const CATEGORY_CONFIG: Record<Exclude<AuditCategory, "all">, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  phi_access: { label: "PHI Access", color: "text-blue-700", bg: "bg-blue-100", icon: Eye },
  notes: { label: "Clinical Notes", color: "text-violet-700", bg: "bg-violet-100", icon: FileText },
  auth: { label: "Authentication", color: "text-amber-700", bg: "bg-amber-100", icon: Lock },
  ai: { label: "AI Activity", color: "text-teal-700", bg: "bg-teal-100", icon: Activity },
  exports: { label: "Data Exports", color: "text-orange-700", bg: "bg-orange-100", icon: Download },
  admin: { label: "Admin Actions", color: "text-slate-700", bg: "bg-slate-100", icon: Shield },
};

const ACTION_LABELS: Record<AuditAction, string> = {
  view_record: "Viewed Record",
  edit_note: "Edited Note",
  create_note: "Created Note",
  delete_note: "Deleted Note",
  sign_note: "Signed Note",
  view_patient: "Viewed Patient",
  export_records: "Exported Records",
  login: "Logged In",
  logout: "Logged Out",
  failed_login: "Failed Login",
  change_permission: "Changed Permission",
  ai_generation: "AI Generation",
  message_send: "Sent Message",
  download_report: "Downloaded Report",
  session_start: "Session Started",
  session_end: "Session Ended",
  change_password: "Changed Password",
  api_access: "API Access",
};

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<AuditCategory>("all");
  const [filterOutcome, setFilterOutcome] = useState<"all" | "success" | "failure" | "warning">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("7d");
  const [logs, setLogs] = useState<AuditEntry[]>(AUDIT_LOGS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    organizationsAPI.auditLogs().then((res: any) => {
      const entries = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      if (entries.length > 0) {
        setLogs(entries.map((e: any) => ({
          id: e.id || "",
          timestamp: e.created_at || e.timestamp || "",
          action: e.action || "view_record",
          category: e.category || "phi_access",
          actor_name: e.actor_name || e.user_name || "Unknown",
          actor_role: e.actor_role || e.role || "",
          target_type: e.target_type || e.resource_type || undefined,
          target_name: e.target_name || e.resource_id || undefined,
          patient_id: e.patient_id || undefined,
          patient_name: e.patient_name || undefined,
          ip_address: e.ip_address || "",
          user_agent: e.user_agent || "",
          outcome: e.outcome || "success",
          details: e.details || e.notes || undefined,
          session_id: e.session_id || undefined,
        })));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const actionLabel = ACTION_LABELS[log.action as AuditAction] || log.action;
    const matchSearch = !search || log.actor_name.toLowerCase().includes(search.toLowerCase()) || log.patient_name?.toLowerCase().includes(search.toLowerCase()) || actionLabel.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || log.category === filterCat;
    const matchOutcome = filterOutcome === "all" || log.outcome === filterOutcome;
    return matchSearch && matchCat && matchOutcome;
  });

  const successCount = logs.filter(l => l.outcome === "success").length;
  const failureCount = logs.filter(l => l.outcome === "failure").length;
  const phiCount = logs.filter(l => l.category === "phi_access").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#2EC4B6]" />
            Audit Logs
          </h1>
          <p className="text-slate-500 mt-1">HIPAA-compliant audit trail — all PHI access, clinical actions, and system events</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* HIPAA Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <strong>HIPAA Audit Trail:</strong> These logs are immutable and tamper-evident. All entries are retained for a minimum of 6 years. Logs are available for export to support compliance audits and breach investigations.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Events (7d)", value: logs.length, icon: Activity, color: "text-slate-600 bg-slate-100" },
          { label: "Successful Actions", value: successCount, icon: CheckCircle, color: "text-green-600 bg-green-50" },
          { label: "Failed Attempts", value: failureCount, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
          { label: "PHI Access Events", value: phiCount, icon: Eye, color: "text-blue-600 bg-blue-50" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className={`w-9 h-9 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm text-slate-500">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by user, patient, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
          />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as AuditCategory)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filterOutcome} onChange={(e) => setFilterOutcome(e.target.value as typeof filterOutcome)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
          <option value="all">All Outcomes</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="warning">Warning</option>
        </select>
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
          <option value="1d">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2">Timestamp</div>
          <div className="col-span-2">Actor</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-1">Outcome</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((log) => {
            const catConf = CATEGORY_CONFIG[log.category];
            const CatIcon = catConf.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div key={log.id}>
                <div
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition items-center cursor-pointer ${log.outcome === "failure" ? "bg-red-50/40" : ""}`}
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                >
                  {/* Timestamp */}
                  <div className="col-span-2 text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {formatTimestamp(log.timestamp)}
                  </div>

                  {/* Actor */}
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-slate-900">{log.actor_name}</div>
                    <div className="text-xs text-slate-400">{log.actor_role}</div>
                  </div>

                  {/* Action */}
                  <div className="col-span-2 text-sm text-slate-700">{ACTION_LABELS[log.action as AuditAction] || log.action}</div>

                  {/* Category */}
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${catConf.bg} ${catConf.color}`}>
                      <CatIcon className="w-3 h-3" />
                      {catConf.label}
                    </span>
                  </div>

                  {/* Target */}
                  <div className="col-span-2 text-sm text-slate-600">
                    {log.patient_name ? (
                      <div>
                        <div className="text-xs text-slate-400">Patient</div>
                        <div>{log.patient_name}</div>
                      </div>
                    ) : log.target_name ? (
                      <div className="text-xs text-slate-500 truncate">{log.target_name}</div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>

                  {/* Outcome */}
                  <div className="col-span-1">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                      log.outcome === "success" ? "bg-green-100 text-green-700" :
                      log.outcome === "failure" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {log.outcome === "success" ? "✓" : log.outcome === "failure" ? "✗" : "!"}
                      {log.outcome}
                    </span>
                  </div>

                  {/* Expand */}
                  <div className="col-span-1 flex justify-end">
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-xs">
                      <div>
                        <div className="text-slate-400 mb-1">IP Address</div>
                        <div className="font-medium text-slate-700 font-mono">{log.ip_address}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-1">User Agent</div>
                        <div className="font-medium text-slate-700">{log.user_agent}</div>
                      </div>
                      {log.session_id && (
                        <div>
                          <div className="text-slate-400 mb-1">Session ID</div>
                          <div className="font-medium text-slate-700 font-mono">{log.session_id}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-slate-400 mb-1">Log ID</div>
                        <div className="font-medium text-slate-700 font-mono">{log.id}</div>
                      </div>
                      {log.details && (
                        <div className="col-span-4">
                          <div className="text-slate-400 mb-1">Details</div>
                          <div className="text-slate-700 leading-relaxed">{log.details}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>Showing {filtered.length} of {logs.length} events</span>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">Previous</button>
          <span className="px-3 py-1.5 bg-[#0A2342] text-white rounded-lg">1</span>
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">2</button>
          <button className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition">Next</button>
        </div>
      </div>
    </div>
  );
}
