"use client";

import { useState, useEffect } from "react";
import { adminAPI } from "@/lib/api";
import {
  Wrench, Search, User, Building2, AlertTriangle, CheckCircle, X,
  Clock, MessageSquare, ExternalLink, ChevronDown, RefreshCw,
  Lock, Unlock, Trash2, Mail, Activity, Shield, Eye, Download,
  Filter, MoreVertical, Send, Star, Zap
} from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "critical" | "high" | "medium" | "low";
type TicketCategory = "billing" | "technical" | "hipaa" | "account" | "ai" | "onboarding";

interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  org_name: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
  messages: number;
  assigned_to?: string;
}

const TICKETS: SupportTicket[] = [
  { id: "TK-2841", subject: "AI Scribe not generating notes after session", status: "open", priority: "critical", category: "ai", org_name: "Pacific Mental Health", user_name: "Dr. Lily Martinez", user_email: "lily@pacificmh.com", created_at: "2026-06-04T10:15:00Z", updated_at: "2026-06-04T10:15:00Z", messages: 1 },
  { id: "TK-2840", subject: "Unable to access patient records — 403 error", status: "in_progress", priority: "high", category: "technical", org_name: "Bay Area Therapy Group", user_name: "Marcus Webb", user_email: "m.webb@bayatg.com", created_at: "2026-06-04T08:30:00Z", updated_at: "2026-06-04T09:45:00Z", messages: 4, assigned_to: "Admin" },
  { id: "TK-2839", subject: "Invoice for May showing incorrect amount", status: "open", priority: "high", category: "billing", org_name: "Serenity Practice", user_name: "Admin User", user_email: "admin@serenity.com", created_at: "2026-06-03T16:20:00Z", updated_at: "2026-06-03T16:20:00Z", messages: 1 },
  { id: "TK-2835", subject: "BAA renewal needed for HIPAA compliance", status: "in_progress", priority: "medium", category: "hipaa", org_name: "Summit Health Partners", user_name: "Legal Team", user_email: "legal@summitHP.com", created_at: "2026-06-02T11:00:00Z", updated_at: "2026-06-04T09:00:00Z", messages: 6, assigned_to: "Sarah K." },
  { id: "TK-2831", subject: "Need help adding 5 more therapist seats", status: "resolved", priority: "low", category: "account", org_name: "Clarity Therapy", user_name: "Owner", user_email: "owner@clarityther.com", created_at: "2026-06-01T14:00:00Z", updated_at: "2026-06-03T10:00:00Z", messages: 3 },
  { id: "TK-2828", subject: "Onboarding walkthrough request for new team", status: "resolved", priority: "medium", category: "onboarding", org_name: "Harbor Point Counseling", user_name: "James T.", user_email: "james@harborpt.com", created_at: "2026-05-30T09:00:00Z", updated_at: "2026-06-02T11:00:00Z", messages: 8, assigned_to: "Onboarding" },
];

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "text-blue-700", bg: "bg-blue-100" },
  in_progress: { label: "In Progress", color: "text-amber-700", bg: "bg-amber-100" },
  resolved: { label: "Resolved", color: "text-green-700", bg: "bg-green-100" },
  closed: { label: "Closed", color: "text-slate-500", bg: "bg-slate-100" },
};

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string; dot: string }> = {
  critical: { label: "Critical", color: "text-red-700", dot: "bg-red-500" },
  high: { label: "High", color: "text-orange-700", dot: "bg-orange-500" },
  medium: { label: "Medium", color: "text-amber-700", dot: "bg-amber-400" },
  low: { label: "Low", color: "text-slate-500", dot: "bg-slate-300" },
};

type ActionTab = "tickets" | "impersonate" | "account_actions";

interface LiveUser { id: string; name: string; email: string; org: string; role: string; last_login: string; }

export default function SupportToolsPage() {
  const [tab, setTab] = useState<ActionTab>("tickets");
  const [searchTicket, setSearchTicket] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | TicketStatus>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | TicketPriority>("all");
  const [impersonateSearch, setImpersonateSearch] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);

  useEffect(() => {
    adminAPI.users({ limit: 20 })
      .then((res: any) => {
        const users = (res.data || []).map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          email: u.email,
          org: u.organization_name || '',
          role: u.role || 'user',
          last_login: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never',
        }));
        if (users.length > 0) setLiveUsers(users);
      })
      .catch(() => {});
  }, []);

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await adminAPI.impersonateUser(userId);
      const { impersonation_token, user } = res;
      const portal = user?.role === 'patient' ? process.env.NEXT_PUBLIC_PATIENT_URL || 'http://localhost:3002'
        : process.env.NEXT_PUBLIC_THERAPIST_URL || 'http://localhost:3001';
      window.open(`${portal}/login?impersonate=${impersonation_token}`, '_blank');
    } catch (err: any) {
      alert(`Impersonation failed: ${err.message}`);
    }
  };

  const filteredTickets = TICKETS.filter((t) => {
    const matchSearch = !searchTicket || t.subject.toLowerCase().includes(searchTicket.toLowerCase()) || t.org_name.toLowerCase().includes(searchTicket.toLowerCase()) || t.id.toLowerCase().includes(searchTicket.toLowerCase());
    const matchStatus = filterStatus === "all" || t.status === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    return matchSearch && matchStatus && matchPriority;
  });

  const openCount = TICKETS.filter(t => t.status === "open").length;
  const criticalCount = TICKETS.filter(t => t.priority === "critical").length;
  const inProgressCount = TICKETS.filter(t => t.status === "in_progress").length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#2EC4B6]" />
            Support Tools
          </h1>
          <p className="text-slate-500 mt-1">Customer support, user impersonation, account management</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: "Open Tickets", value: openCount, color: "text-blue-600 bg-blue-50", icon: MessageSquare },
          { label: "Critical / High", value: criticalCount, color: "text-red-600 bg-red-50", icon: AlertTriangle },
          { label: "In Progress", value: inProgressCount, color: "text-amber-600 bg-amber-50", icon: Activity },
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

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        {[
          { id: "tickets" as ActionTab, label: "Support Tickets", icon: MessageSquare },
          { id: "impersonate" as ActionTab, label: "User Impersonation", icon: Eye },
          { id: "account_actions" as ActionTab, label: "Account Actions", icon: Wrench },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tickets Tab */}
      {tab === "tickets" && (
        <div>
          <div className="flex gap-3 mb-5 flex-wrap">
            <div className="relative flex-1 min-w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTicket} onChange={e => setSearchTicket(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as typeof filterPriority)} className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white">
              <option value="all">All Priorities</option>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Subject</div>
              <div className="col-span-2">Organization</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Updated</div>
              <div className="col-span-1"></div>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredTickets.map((ticket) => {
                const stat = STATUS_CONFIG[ticket.status];
                const pri = PRIORITY_CONFIG[ticket.priority];
                return (
                  <div key={ticket.id} className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-slate-50 transition items-center">
                    <div className="col-span-1 text-xs font-mono text-slate-500">{ticket.id}</div>
                    <div className="col-span-3">
                      <div className="text-sm font-medium text-slate-900 truncate">{ticket.subject}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{ticket.user_name}</div>
                    </div>
                    <div className="col-span-2 text-sm text-slate-600 truncate">{ticket.org_name}</div>
                    <div className="col-span-1">
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${pri.dot}`} />
                        <span className={`text-xs font-medium ${pri.color}`}>{pri.label}</span>
                      </div>
                    </div>
                    <div className="col-span-2">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stat.bg} ${stat.color}`}>{stat.label}</span>
                    </div>
                    <div className="col-span-2 text-xs text-slate-400">
                      {new Date(ticket.updated_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      <button className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition text-blue-600">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Impersonation Tab */}
      {tab === "impersonate" && (
        <div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <strong>Sensitive action.</strong> User impersonation creates an audit log entry and notifies the user&apos;s organization owner. Use only for genuine support cases with explicit user consent. All actions taken while impersonating are logged under your admin identity.
            </div>
          </div>
          <div className="relative mb-5">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={impersonateSearch} onChange={e => setImpersonateSearch(e.target.value)} placeholder="Search by email or name..." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]" />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {liveUsers
              .filter(u => !impersonateSearch || u.name.toLowerCase().includes(impersonateSearch.toLowerCase()) || u.email.toLowerCase().includes(impersonateSearch.toLowerCase()))
              .map((user) => (
              <div key={user.email} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                    {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-400">{user.email} · {user.org} · {user.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{user.last_login}</span>
                  <button onClick={() => handleImpersonate(user.id)} className="flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-200 transition">
                    <Eye className="w-3.5 h-3.5" />
                    Impersonate
                  </button>
                </div>
              </div>
            ))}
            {liveUsers.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No users loaded</div>
            )}
          </div>
        </div>
      )}

      {/* Account Actions Tab */}
      {tab === "account_actions" && (
        <div className="space-y-5">
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={accountSearch} onChange={e => setAccountSearch(e.target.value)} placeholder="Search organization or user..." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]" />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { title: "Extend Trial Period", desc: "Extend a trial by 7, 14, or 30 days for a specific organization.", icon: Clock, color: "bg-blue-50 text-blue-600", action: "Extend Trial" },
              { title: "Reset Password", desc: "Force a password reset for a user. They'll receive an email with a reset link.", icon: Lock, color: "bg-orange-50 text-orange-600", action: "Send Reset Email" },
              { title: "Suspend Account", desc: "Temporarily suspend an organization. Prevents all logins and API access.", icon: Lock, color: "bg-red-50 text-red-600", action: "Suspend Account", danger: true },
              { title: "Unlock Account", desc: "Unlock an account that has been suspended or locked after too many failed logins.", icon: Unlock, color: "bg-green-50 text-green-600", action: "Unlock Account" },
              { title: "Add Bonus Credits", desc: "Add AI usage credits or seat credits to an organization as a goodwill gesture.", icon: Star, color: "bg-violet-50 text-violet-600", action: "Add Credits" },
              { title: "Force Email Verification", desc: "Re-send the email verification to a user who hasn&apos;t confirmed their email.", icon: Mail, color: "bg-teal-50 text-teal-600", action: "Send Verification" },
              { title: "Download Org Data", desc: "Generate a full data export for an organization (HIPAA data request).", icon: Download, color: "bg-slate-50 text-slate-600", action: "Export Data" },
              { title: "Delete Test Data", desc: "Remove test patients and sessions created during onboarding or demos.", icon: Trash2, color: "bg-red-50 text-red-600", action: "Delete Test Data", danger: true },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.title} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-xl ${action.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{action.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{action.desc}</p>
                    </div>
                  </div>
                  <button className={`w-full py-2 rounded-xl text-sm font-medium transition ${(action as any).danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                    {action.action}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
