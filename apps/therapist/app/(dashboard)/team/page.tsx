"use client";

import { useState, useEffect } from "react";
import {
  Users, UserPlus, Mail, Shield, Clock, MoreVertical, Search,
  CheckCircle, AlertTriangle, Star, Activity, Calendar, X,
  ChevronDown, BarChart3, Zap, Crown, UserCheck, Settings,
  Copy, Send, Trash2, Edit2, Eye, Lock, TrendingUp, Phone
} from "lucide-react";
import { therapistsAPI } from "@/lib/api";

type TeamRole = "owner" | "supervisor" | "therapist" | "intern" | "admin";
type TeamStatus = "active" | "inactive" | "pending" | "suspended";

interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: TeamRole;
  email: string;
  phone: string;
  license: string;
  license_state: string;
  status: TeamStatus;
  active_patients: number;
  capacity: number;
  sessions_this_week: number;
  avg_session_rating: number;
  notes_pending: number;
  joined_date: string;
  specializations: string[];
  color: string;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-violet-100 text-violet-700",
  supervisor: "bg-blue-100 text-blue-700",
  therapist: "bg-teal-100 text-teal-700",
  intern: "bg-orange-100 text-orange-700",
  admin: "bg-gray-100 text-gray-600",
};

const ROLE_CONFIG: Record<TeamRole, { label: string; color: string; icon: typeof Shield }> = {
  owner: { label: "Owner", color: "bg-violet-100 text-violet-700", icon: Crown },
  supervisor: { label: "Supervisor", color: "bg-blue-100 text-blue-700", icon: Shield },
  therapist: { label: "Therapist", color: "bg-teal-100 text-teal-700", icon: UserCheck },
  intern: { label: "Intern", color: "bg-orange-100 text-orange-700", icon: Star },
  admin: { label: "Admin", color: "bg-gray-100 text-gray-600", icon: Settings },
};

const STATUS_CONFIG: Record<TeamStatus, { label: string; dot: string }> = {
  active: { label: "Active", dot: "bg-green-400" },
  inactive: { label: "Inactive", dot: "bg-gray-400" },
  pending: { label: "Pending", dot: "bg-amber-400" },
  suspended: { label: "Suspended", dot: "bg-red-400" },
};

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("therapist");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (email) setSent(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-lg">Invite Team Member</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          {sent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h4 className="font-bold text-slate-900 mb-2">Invitation Sent!</h4>
              <p className="text-slate-500 text-sm">An invitation email has been sent to <strong>{email}</strong>. They'll have 7 days to accept.</p>
              <button onClick={onClose} className="mt-5 w-full bg-[#0A2342] text-white py-2.5 rounded-xl font-semibold hover:bg-[#1a3a6a] transition">
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="therapist@email.com"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as TeamRole)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6] bg-white"
                >
                  <option value="therapist">Therapist — Full clinical access to own patients</option>
                  <option value="supervisor">Supervisor — Can review and co-sign for assigned interns</option>
                  <option value="intern">Intern — Supervised practice, all notes require co-sign</option>
                  <option value="admin">Admin — Practice ops, billing, scheduling (no PHI)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Personal message (optional)</label>
                <textarea
                  placeholder="Welcome to the team! Looking forward to working with you..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
                  rows={3}
                />
              </div>
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-xs text-blue-700">
                <strong>Permissions for {role}:</strong>
                {role === "therapist" && " Full SOAP note access, patient management, billing for own patients."}
                {role === "supervisor" && " All therapist permissions + review/co-sign intern notes + supervision dashboard."}
                {role === "intern" && " Create notes (pending supervisor approval), view own patients only."}
                {role === "admin" && " Scheduling, billing, reports — no access to clinical notes or PHI."}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={!email}
                  className="flex-1 bg-[#2EC4B6] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#26b0a2] transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Invitation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | TeamRole>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | TeamStatus>("all");
  const [showInvite, setShowInvite] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    therapistsAPI.list().then((res: any) => {
      const members = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setTeamMembers(members.map((t: any) => ({
        id: t.id || "",
        name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || t.email || "Unknown",
        initials: `${(t.first_name || "?")[0]}${(t.last_name || "?")[0]}`.toUpperCase(),
        role: (t.role || "therapist") as TeamRole,
        email: t.email || "",
        phone: t.phone || "",
        license: t.license_number || "",
        license_state: t.license_state || "",
        status: (t.status || "active") as TeamStatus,
        active_patients: t.active_patients || 0,
        capacity: t.capacity || 20,
        sessions_this_week: t.sessions_this_week || 0,
        avg_session_rating: t.avg_session_rating || 0,
        notes_pending: t.notes_pending || 0,
        joined_date: t.created_at || "",
        specializations: Array.isArray(t.specializations) ? t.specializations : [],
        color: "bg-[#0A2342] text-white",
      })));
    }).catch(() => setTeamMembers([]));
  }, []);

  const filtered = teamMembers.filter((m) => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === "all" || m.role === filterRole;
    const matchStatus = filterStatus === "all" || m.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const totalPatients = teamMembers.filter(m => m.status === "active").reduce((s, m) => s + m.active_patients, 0);
  const totalCapacity = teamMembers.filter(m => m.status === "active").reduce((s, m) => s + m.capacity, 0);
  const activeCount = teamMembers.filter(m => m.status === "active").length;
  const pendingNotes = teamMembers.reduce((s, m) => s + m.notes_pending, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-slate-500 mt-1">Manage therapists, roles, permissions, and capacity</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="bg-[#0A2342] text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-[#1a3a6a] transition"
        >
          <UserPlus className="w-4 h-4" />
          Invite Team Member
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Clinicians", value: activeCount, sub: `${teamMembers.length} total`, icon: Users, color: "text-blue-600 bg-blue-50" },
          { label: "Total Patients", value: totalPatients, sub: `${totalCapacity} capacity`, icon: Activity, color: "text-teal-600 bg-teal-50" },
          { label: "Capacity Used", value: `${Math.round((totalPatients / totalCapacity) * 100)}%`, sub: `${totalCapacity - totalPatients} seats open`, icon: BarChart3, color: "text-violet-600 bg-violet-50" },
          { label: "Notes Pending", value: pendingNotes, sub: "awaiting signature", icon: AlertTriangle, color: pendingNotes > 5 ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-sm font-medium text-slate-700">{stat.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{stat.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search team members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
        >
          <option value="all">All Roles</option>
          <option value="owner">Owner</option>
          <option value="supervisor">Supervisor</option>
          <option value="therapist">Therapist</option>
          <option value="intern">Intern</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending Invite</option>
        </select>
      </div>

      {/* Team Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">Clinician</div>
          <div className="col-span-2">Role & License</div>
          <div className="col-span-2">Caseload</div>
          <div className="col-span-2">This Week</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map((member) => {
            const roleConf = ROLE_CONFIG[member.role];
            const statusConf = STATUS_CONFIG[member.status];
            const RoleIcon = roleConf.icon;
            const capacityPct = (member.active_patients / member.capacity) * 100;

            return (
              <div key={member.id} className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-slate-50/60 transition items-center">
                {/* Name */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl font-bold text-sm flex items-center justify-center flex-shrink-0 ${member.color}`}>
                    {member.initials}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{member.name}</div>
                    <div className="text-xs text-slate-400">{member.email}</div>
                  </div>
                </div>

                {/* Role & License */}
                <div className="col-span-2">
                  <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${roleConf.color} mb-1`}>
                    <RoleIcon className="w-3 h-3" />
                    {roleConf.label}
                  </span>
                  <div className="text-xs text-slate-400">{member.license} · {member.license_state}</div>
                </div>

                {/* Caseload */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{member.active_patients} / {member.capacity}</span>
                    <span className={`${capacityPct >= 90 ? "text-red-500" : capacityPct >= 75 ? "text-amber-500" : "text-green-500"}`}>
                      {Math.round(capacityPct)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${capacityPct >= 90 ? "bg-red-400" : capacityPct >= 75 ? "bg-amber-400" : "bg-green-400"}`}
                      style={{ width: `${Math.min(capacityPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* This Week */}
                <div className="col-span-2 text-sm">
                  <div className="text-slate-700">{member.sessions_this_week} sessions</div>
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Star className="w-3 h-3 text-amber-400" />
                    {member.avg_session_rating}
                    {member.notes_pending > 0 && (
                      <span className="ml-1 text-red-500 font-medium">· {member.notes_pending} pending</span>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
                    <span className="text-sm text-slate-700">{statusConf.label}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Since {member.joined_date.split("-")[0]}</div>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex justify-end">
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === member.id ? null : member.id)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    {activeMenu === member.id && (
                      <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-lg z-10 w-44 py-1">
                        {[
                          { icon: Eye, label: "View Profile" },
                          { icon: Edit2, label: "Edit Role" },
                          { icon: Mail, label: "Send Message" },
                          { icon: BarChart3, label: "View Analytics" },
                          { icon: Lock, label: "Manage Permissions" },
                          { icon: member.status === "active" ? Trash2 : CheckCircle, label: member.status === "active" ? "Deactivate" : "Reactivate", danger: member.status === "active" },
                        ].map((action) => {
                          const Icon = action.icon;
                          return (
                            <button
                              key={action.label}
                              onClick={() => setActiveMenu(null)}
                              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50 transition ${(action as any).danger ? "text-red-500" : "text-slate-700"}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {action.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Specializations Summary */}
      <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#2EC4B6]" />
          Team Specializations
        </h3>
        <div className="flex flex-wrap gap-3">
          {Array.from(new Set(teamMembers.flatMap(m => m.specializations))).map((spec) => {
            const count = teamMembers.filter(m => m.specializations.includes(spec) && m.status === "active").length;
            return (
              <div key={spec} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
                <span className="text-sm font-medium text-slate-700">{spec}</span>
                <span className="text-xs bg-[#0A2342] text-white px-2 py-0.5 rounded-full">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Actions */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Action Required
        </h3>
        <div className="space-y-2">
          {teamMembers.filter(m => m.notes_pending > 0).map(m => (
            <div key={m.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-amber-100">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-900">{m.name}</span>
                <span className="text-amber-600">has {m.notes_pending} unsigned note{m.notes_pending > 1 ? "s" : ""}</span>
              </div>
              <button className="text-xs text-[#1F5EFF] font-medium hover:underline">Send reminder</button>
            </div>
          ))}
        </div>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
