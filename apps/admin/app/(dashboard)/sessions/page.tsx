'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Video, RefreshCw, Download, Search, Filter, ChevronDown,
  X, CheckCircle, AlertCircle, Clock, Eye, Ban, DollarSign,
  Calendar, User, Building2, Activity
} from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { exportCSV } from '@/lib/csv';

interface Session {
  id: string;
  status: string;
  modality: string;
  scheduled_at: string;
  started_at?: string;
  ended_at?: string;
  duration_minutes?: number;
  billing_status?: string;
  session_price_cents?: number;
  patient_name: string;
  patient_id?: string;
  therapist_name: string;
  therapist_id: string;
  organization_name: string;
  organization_id: string;
  transcript_count: number;
}

interface Stats {
  today: number;
  completed: number;
  in_progress: number;
  cancelled: number;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 bg-blue-400/10',
  in_progress: 'text-green-400 bg-green-400/10',
  completed: 'text-emerald-400 bg-emerald-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
  no_show: 'text-orange-400 bg-orange-400/10',
};

function StatCard({ icon: Icon, label, value, color = 'blue' }: { icon: React.ElementType; label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Toast({ toast }: { toast: { type: 'success' | 'error'; message: string } | null }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border ${
      toast.type === 'success' ? 'bg-green-900/90 border-green-700/50 text-green-200' : 'bg-red-900/90 border-red-700/50 text-red-200'
    }`}>
      {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Session | null>(null);
  const [statusModal, setStatusModal] = useState<Session | null>(null);
  const [billingModal, setBillingModal] = useState<Session | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newReason, setNewReason] = useState('');
  const [billingStatus, setBillingStatus] = useState('');
  const [priceCents, setPriceCents] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminAPI.sessions(params);
      setSessions(res.sessions || []);
      setStats(res.stats || null);
    } catch {
      showToast('error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleStatusOverride = async () => {
    if (!statusModal || confirmText !== 'CONFIRM') return;
    setSaving(true);
    try {
      await adminAPI.updateSessionStatus(statusModal.id, newStatus, newReason);
      showToast('success', `Session status updated to ${newStatus}`);
      setStatusModal(null);
      setConfirmText('');
      setNewStatus('');
      setNewReason('');
      fetchSessions();
    } catch {
      showToast('error', 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleBillingUpdate = async () => {
    if (!billingModal) return;
    setSaving(true);
    try {
      await adminAPI.updateSessionBilling(billingModal.id, {
        billing_status: billingStatus || undefined,
        session_price_cents: priceCents ? parseInt(priceCents) : undefined,
      });
      showToast('success', 'Billing updated');
      setBillingModal(null);
      fetchSessions();
    } catch {
      showToast('error', 'Failed to update billing');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    exportCSV(
      sessions.map(s => ({
        id: s.id,
        status: s.status,
        patient: s.patient_name,
        therapist: s.therapist_name,
        organization: s.organization_name,
        modality: s.modality,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes ?? '',
        billing_status: s.billing_status ?? '',
        price_cents: s.session_price_cents ?? '',
        transcript_segments: s.transcript_count,
      })),
      `sessions-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const fmt = (dt?: string) => dt ? new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-400" /> Platform Sessions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Cross-org session management — god mode</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSessions} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Calendar} label="Today" value={stats?.today ?? 0} color="blue" />
        <StatCard icon={CheckCircle} label="Completed" value={stats?.completed ?? 0} color="green" />
        <StatCard icon={Activity} label="In Progress" value={stats?.in_progress ?? 0} color="amber" />
        <StatCard icon={Ban} label="Cancelled" value={stats?.cancelled ?? 0} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search patient or therapist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Patient</th>
                <th className="text-left px-4 py-3 font-medium">Therapist</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Org</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Scheduled</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Billing</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Transcripts</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading sessions...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No sessions found</td></tr>
              ) : sessions.map(session => (
                <tr key={session.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{session.patient_name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{session.therapist_name}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell">{session.organization_name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[session.status] || 'text-gray-400 bg-gray-400/10'}`}>
                      {session.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{fmt(session.scheduled_at)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden xl:table-cell">
                    {session.billing_status ?? '—'}{session.session_price_cents ? ` ($${(session.session_price_cents / 100).toFixed(2)})` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden xl:table-cell">{session.transcript_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setSelected(session)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setStatusModal(session); setNewStatus(session.status); setConfirmText(''); }}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-amber-400"
                        title="Override status"
                      >
                        <Filter className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setBillingModal(session); setBillingStatus(session.billing_status || ''); setPriceCents(session.session_price_cents ? String(session.session_price_cents) : ''); }}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-green-400"
                        title="Adjust billing"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Slide-Over */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-[480px] bg-gray-900 border-l border-gray-700 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white">Session Details</h2>
              <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <Detail label="Session ID" value={selected.id} mono />
                <Detail label="Status" value={selected.status.replace('_', ' ')} />
                <Detail label="Modality" value={selected.modality} />
                <Detail label="Scheduled" value={fmt(selected.scheduled_at)} />
                <Detail label="Started" value={fmt(selected.started_at)} />
                <Detail label="Ended" value={fmt(selected.ended_at)} />
                <Detail label="Duration" value={selected.duration_minutes ? `${selected.duration_minutes}m` : '—'} />
              </div>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <Detail label="Patient" value={selected.patient_name} />
                <Detail label="Therapist" value={selected.therapist_name} />
                <Detail label="Organization" value={selected.organization_name} />
              </div>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <Detail label="Billing Status" value={selected.billing_status ?? '—'} />
                <Detail label="Price" value={selected.session_price_cents ? `$${(selected.session_price_cents / 100).toFixed(2)}` : '—'} />
                <Detail label="Transcript Segments" value={String(selected.transcript_count)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Override Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white">Override Session Status</h2>
              <button onClick={() => setStatusModal(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">New Status</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                  <option value="no_show">No Show</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Reason (optional)</label>
                <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Enter reason..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                <p className="text-xs text-red-300">Admin override — logged to audit trail. Type <strong>CONFIRM</strong> to proceed.</p>
                <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="Type CONFIRM" className="mt-2 w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setStatusModal(null)} className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">Cancel</button>
                <button
                  onClick={handleStatusOverride}
                  disabled={saving || confirmText !== 'CONFIRM'}
                  className="flex-1 px-4 py-2.5 bg-red-600 disabled:bg-red-900 disabled:text-red-400 text-white rounded-xl text-sm font-semibold"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : 'Override Status'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Modal */}
      {billingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white">Adjust Billing</h2>
              <button onClick={() => setBillingModal(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Billing Status</label>
                <select value={billingStatus} onChange={e => setBillingStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none">
                  <option value="">— unchanged —</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="waived">Waived</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Price (cents)</label>
                <input type="number" value={priceCents} onChange={e => setPriceCents(e.target.value)} placeholder="e.g. 15000 = $150.00" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setBillingModal(null)} className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">Cancel</button>
                <button onClick={handleBillingUpdate} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : 'Update Billing'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs text-gray-200 text-right ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
    </div>
  );
}
