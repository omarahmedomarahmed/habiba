'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, RefreshCw, Download, Search, ChevronDown,
  X, CheckCircle, AlertCircle, Edit2, Clock, Ban
} from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { exportCSV } from '@/lib/csv';

interface Subscription {
  id: string;
  name: string;
  plan: string;
  status: string;
  stripe_subscription_id?: string;
  trial_ends_at?: string;
  seats: number;
  used_seats: number;
  total_paid: number;
  created_at: string;
}

interface SubStats {
  active: number;
  trialing: number;
  past_due: number;
  cancelled: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  trialing: 'text-blue-400 bg-blue-400/10',
  past_due: 'text-amber-400 bg-amber-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
  suspended: 'text-red-400 bg-red-400/10',
};

function StatCard({ icon: Icon, label, value, color = 'blue' }: { icon: React.ElementType; label: string; value: number; color?: string }) {
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
      <div className="text-2xl font-bold text-white">{value ?? 0}</div>
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

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [stats, setStats] = useState<SubStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editModal, setEditModal] = useState<Subscription | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editTrialEnds, setEditTrialEnds] = useState('');
  const [editSeats, setEditSeats] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminAPI.adminSubscriptions(params);
      setSubs(res.subscriptions || []);
      setStats(res.stats || null);
    } catch {
      showToast('error', 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  const openEdit = (sub: Subscription) => {
    setEditModal(sub);
    setEditStatus(sub.status);
    setEditPlan(sub.plan);
    setEditTrialEnds(sub.trial_ends_at ? sub.trial_ends_at.slice(0, 10) : '');
    setEditSeats(String(sub.seats));
  };

  const handleEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await adminAPI.updateAdminSubscription(editModal.id, {
        status: editStatus !== editModal.status ? editStatus : undefined,
        plan: editPlan !== editModal.plan ? editPlan : undefined,
        trial_ends_at: editTrialEnds || undefined,
        max_therapists: editSeats ? parseInt(editSeats) : undefined,
      });
      showToast('success', 'Subscription updated');
      setEditModal(null);
      fetchSubs();
    } catch {
      showToast('error', 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    exportCSV(
      subs.map(s => ({
        id: s.id,
        organization: s.name,
        plan: s.plan,
        status: s.status,
        stripe_id: s.stripe_subscription_id ?? '',
        trial_ends_at: s.trial_ends_at ?? '',
        seats: s.seats,
        used_seats: s.used_seats,
        total_paid_usd: s.total_paid,
        created_at: s.created_at,
      })),
      `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const fmt = (dt?: string) => dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const isDowngrade = editModal && editStatus !== editModal.status && ['cancelled', 'suspended', 'past_due'].includes(editStatus);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Toast toast={toast} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" /> Subscription Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage every org subscription and billing tier</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchSubs} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={CheckCircle} label="Active" value={stats?.active ?? 0} color="green" />
        <StatCard icon={Clock} label="Trialing" value={stats?.trialing ?? 0} color="blue" />
        <StatCard icon={AlertCircle} label="Past Due" value={stats?.past_due ?? 0} color="amber" />
        <StatCard icon={Ban} label="Cancelled" value={stats?.cancelled ?? 0} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search organization..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="cancelled">Cancelled</option>
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
                <th className="text-left px-4 py-3 font-medium">Organization</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Trial Ends</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Seats</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Total Paid</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading subscriptions...</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No subscriptions found</td></tr>
              ) : subs.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-white">{sub.name}</div>
                    {sub.stripe_subscription_id && <div className="text-xs text-gray-600 font-mono">{sub.stripe_subscription_id.slice(0, 20)}...</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                      {sub.plan || 'free'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.status] || 'text-gray-400 bg-gray-400/10'}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{fmt(sub.trial_ends_at)}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm hidden lg:table-cell">{sub.used_seats}/{sub.seats}</td>
                  <td className="px-4 py-3 text-gray-300 text-sm hidden xl:table-cell">${Number(sub.total_paid || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(sub)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="Edit subscription">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white">Edit Subscription — {editModal.name}</h2>
              <button onClick={() => setEditModal(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none">
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past Due</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Plan Tier</label>
                <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none">
                  <option value="free">Free</option>
                  <option value="payg">Pay-as-you-go</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Professional</option>
                  <option value="unlimited">Unlimited</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Trial Ends At</label>
                <input type="date" value={editTrialEnds} onChange={e => setEditTrialEnds(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Max Therapist Seats</label>
                <input type="number" value={editSeats} onChange={e => setEditSeats(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none" />
              </div>
              {isDowngrade && (
                <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                  <p className="text-xs text-red-300">Warning: Downgrading to <strong>{editStatus}</strong> may affect org access. Logged to audit trail.</p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditModal(null)} className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">Cancel</button>
                <button onClick={handleEdit} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
