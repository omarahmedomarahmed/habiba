"use client";

import { useState, useEffect } from "react";
import { adminAPI } from "@/lib/api";
import { getApiUrl } from "@/lib/env";
import {
  Wrench, Search, AlertTriangle, CheckCircle,
  ExternalLink, RefreshCw,
  Lock, Unlock, Trash2, Mail, Activity, Eye, Download,
  Star, Clock, UserX
} from "lucide-react";

interface LiveUser { id: string; name: string; email: string; org: string; role: string; last_login: string; }

type ActionTab = "lookup" | "impersonate" | "account_actions";

export default function SupportToolsPage() {
  const [tab, setTab] = useState<ActionTab>("lookup");
  const [lookupSearch, setLookupSearch] = useState("");
  const [lookupResults, setLookupResults] = useState<LiveUser[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [impersonateSearch, setImpersonateSearch] = useState("");
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionUser, setActionUser] = useState<LiveUser | null>(null);

  useEffect(() => {
    adminAPI.users({ limit: 30 })
      .then((res: any) => {
        const users = (Array.isArray(res) ? res : res.data || []).map((u: any) => ({
          id: u.id,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
          email: u.email,
          org: u.organization_name || u.organization?.name || '',
          role: u.role || 'user',
          last_login: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never',
        }));
        setLiveUsers(users);
      })
      .catch(() => {});
  }, []);

  const handleLookup = async () => {
    if (!lookupSearch.trim()) return;
    setLookupLoading(true);
    try {
      const res = await adminAPI.users({ search: lookupSearch, limit: 10 }) as any;
      const users = (Array.isArray(res) ? res : res.data || []).map((u: any) => ({
        id: u.id,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        email: u.email,
        org: u.organization_name || u.organization?.name || '',
        role: u.role || 'user',
        last_login: u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never',
      }));
      setLookupResults(users);
    } catch {
      setLookupResults([]);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleImpersonate = async (userId: string, role?: string) => {
    try {
      const res = await adminAPI.impersonateUser(userId) as any;
      const token = res.impersonation_token;
      if (!token) { alert('Impersonation not available'); return; }
      const portal = role === 'patient'
        ? process.env.NEXT_PUBLIC_PATIENT_URL || 'http://localhost:3002'
        : process.env.NEXT_PUBLIC_THERAPIST_URL || 'http://localhost:3001';
      window.open(`${portal}/login?impersonate=${token}`, '_blank');
    } catch (err: any) {
      alert(`Impersonation failed: ${err.message}`);
    }
  };

  const handleResetPassword = async (user: LiveUser) => {
    try {
      await fetch(`${getApiUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      setActionMsg(`Password reset email sent to ${user.email}`);
    } catch {
      setActionMsg('Failed to send reset email — check API connectivity');
    }
  };

  const handleSuspend = async (user: LiveUser) => {
    if (!window.confirm(`Suspend account for ${user.name}?`)) return;
    try {
      await adminAPI.suspendUser(user.id);
      setActionMsg(`Account suspended for ${user.name}`);
      setLiveUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: u.role } : u));
    } catch (err: any) {
      setActionMsg(`Failed to suspend: ${err.message}`);
    }
  };

  const filteredImpersonate = liveUsers.filter(u =>
    !impersonateSearch || u.name.toLowerCase().includes(impersonateSearch.toLowerCase()) || u.email.toLowerCase().includes(impersonateSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-teal-400" />
            Support Tools
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">User lookup · Impersonation · Account management</p>
        </div>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className="flex items-center gap-3 p-4 bg-green-900/20 border border-green-700/30 rounded-xl text-green-300 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg(null)} className="ml-auto text-green-500 hover:text-green-300">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
        {[
          { id: "lookup" as ActionTab, label: "User Lookup", icon: Search },
          { id: "impersonate" as ActionTab, label: "Impersonation", icon: Eye },
          { id: "account_actions" as ActionTab, label: "Account Actions", icon: Wrench },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* User Lookup Tab */}
      {tab === "lookup" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={lookupSearch}
                onChange={e => setLookupSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="Search by email or name..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={lookupLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl text-sm font-medium hover:from-red-500 hover:to-orange-500 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${lookupLoading ? 'animate-spin' : ''}`} />
              Search
            </button>
          </div>

          {lookupResults.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
              {lookupResults.map(user => (
                <div key={user.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-500/20 flex items-center justify-center text-white text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{user.name}</div>
                      <div className="text-xs text-gray-400">{user.email} · {user.org} · <span className="capitalize">{user.role}</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{user.last_login}</span>
                    <button onClick={() => handleImpersonate(user.id, user.role)} className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-500/30 transition">
                      <Eye className="w-3.5 h-3.5" />Impersonate
                    </button>
                    <button onClick={() => handleResetPassword(user)} className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-500/30 transition">
                      <Mail className="w-3.5 h-3.5" />Reset PW
                    </button>
                    <button onClick={() => handleSuspend(user)} className="flex items-center gap-1.5 text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg font-medium hover:bg-red-500/30 transition">
                      <UserX className="w-3.5 h-3.5" />Suspend
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lookupResults.length === 0 && lookupSearch && !lookupLoading && (
            <div className="text-center py-8 text-gray-500 text-sm">No users found matching &ldquo;{lookupSearch}&rdquo;</div>
          )}
        </div>
      )}

      {/* Impersonation Tab */}
      {tab === "impersonate" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">
              <strong>Sensitive action.</strong> Impersonation is logged in the audit trail. Use only for genuine support with explicit user consent.
            </p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={impersonateSearch} onChange={e => setImpersonateSearch(e.target.value)} placeholder="Filter by email or name..." className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500" />
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {filteredImpersonate.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-500/20 flex items-center justify-center text-white text-sm font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{user.name}</div>
                    <div className="text-xs text-gray-400">{user.email} · {user.org} · <span className="capitalize">{user.role}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Last: {user.last_login}</span>
                  <button onClick={() => handleImpersonate(user.id, user.role)} className="flex items-center gap-1.5 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg font-medium hover:bg-amber-500/30 transition">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Impersonate
                  </button>
                </div>
              </div>
            ))}
            {filteredImpersonate.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-500 text-sm">
                {liveUsers.length === 0 ? 'No users loaded — check API connectivity' : 'No users match your search'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Actions Tab */}
      {tab === "account_actions" && (
        <div className="space-y-5">
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={actionUser?.email || ''}
              readOnly
              placeholder="Select a user from User Lookup tab first..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-400 placeholder-gray-600"
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "Reset Password", desc: "Force a password reset. User receives an email with a reset link.", icon: Lock,
                color: "bg-orange-500/20 text-orange-300", action: "Send Reset Email",
                handler: () => {
                  const email = window.prompt('User email to reset password:');
                  if (!email) return;
                  fetch(`${getApiUrl()}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
                    .then(() => setActionMsg(`Password reset email sent to ${email}`))
                    .catch(() => setActionMsg('Failed to send reset email'));
                }
              },
              {
                title: "Send Email Verification", desc: "Re-send the email verification to a user who hasn't confirmed yet.", icon: Mail,
                color: "bg-teal-500/20 text-teal-300", action: "Send Verification",
                handler: () => setActionMsg('Email verification re-send — use Reset Password flow as workaround (same outcome)')
              },
              {
                title: "Download Org Data", desc: "Generate a full data export for HIPAA right-of-access requests.", icon: Download,
                color: "bg-gray-500/20 text-gray-300", action: "Export Data",
                handler: () => setActionMsg('Contact engineering@24therapy.ai to process HIPAA data export requests.')
              },
              {
                title: "Unlock Suspended Account", desc: "Unlock an account suspended after failed logins or manual suspension.", icon: Unlock,
                color: "bg-green-500/20 text-green-300", action: "Unlock Account",
                handler: () => {
                  const id = window.prompt('User ID to activate:');
                  if (!id) return;
                  adminAPI.activateUser(id).then(() => setActionMsg(`Account activated for user ${id}`)).catch((e: any) => setActionMsg(`Failed: ${e.message}`));
                }
              },
              {
                title: "Add Session Credits", desc: "Add session credits to an organization as a goodwill gesture.", icon: Star,
                color: "bg-violet-500/20 text-violet-300", action: "Add Credits",
                handler: () => setActionMsg('Session credits managed via Billing → Pricing. Contact billing@24therapy.ai for manual credit additions.')
              },
              {
                title: "Delete Test Data", desc: "Remove test patients and sessions created during onboarding demos.", icon: Trash2,
                color: "bg-red-500/20 text-red-300", action: "Request Deletion",
                handler: () => setActionMsg('Test data deletion — contact engineering@24therapy.ai with org ID to process safely.')
              },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.title} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-xl ${action.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{action.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{action.desc}</p>
                    </div>
                  </div>
                  <button onClick={action.handler} className="w-full py-2 rounded-xl text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition">
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
