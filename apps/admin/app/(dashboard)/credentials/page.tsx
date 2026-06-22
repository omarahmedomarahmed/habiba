'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileBadge, RefreshCw, Download, Search, ChevronDown,
  X, CheckCircle, AlertCircle, Clock, Eye
} from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { exportCSV } from '@/lib/csv';

interface Credential {
  id: string;
  therapist_id: string;
  therapist_name: string;
  therapist_email: string;
  organization_name: string;
  document_type: string;
  document_url?: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  verified_at?: string;
}

interface CredStats {
  pending: number;
  verified: number;
  rejected: number;
}

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

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-400/10',
  verified: 'text-green-400 bg-green-400/10',
  rejected: 'text-red-400 bg-red-400/10',
};

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [stats, setStats] = useState<CredStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState<Credential | null>(null);
  const [verifyModal, setVerifyModal] = useState<Credential | null>(null);
  const [rejectModal, setRejectModal] = useState<Credential | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await adminAPI.therapistCredentials(params);
      setCredentials(res.credentials || []);
      setStats(res.stats || null);
    } catch {
      showToast('error', 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  const handleVerify = async () => {
    if (!verifyModal) return;
    setSaving(true);
    try {
      await adminAPI.updateTherapistCredential(verifyModal.id, { status: 'verified' });
      showToast('success', 'Credential verified');
      setVerifyModal(null);
      fetchCredentials();
    } catch {
      showToast('error', 'Failed to verify credential');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectionReason.trim()) return;
    setSaving(true);
    try {
      await adminAPI.updateTherapistCredential(rejectModal.id, { status: 'rejected', rejection_reason: rejectionReason });
      showToast('success', 'Credential rejected');
      setRejectModal(null);
      setRejectionReason('');
      fetchCredentials();
    } catch {
      showToast('error', 'Failed to reject credential');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    exportCSV(
      credentials.map(c => ({
        id: c.id,
        therapist: c.therapist_name,
        email: c.therapist_email,
        org: c.organization_name,
        doc_type: c.document_type,
        status: c.status,
        submitted: c.created_at,
        verified_at: c.verified_at ?? '',
        rejection_reason: c.rejection_reason ?? '',
      })),
      `credentials-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const fmt = (dt?: string) => dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Toast toast={toast} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileBadge className="w-5 h-5 text-purple-400" /> Therapist Credentials
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and verify therapist license documents</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchCredentials} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={Clock} label="Pending Review" value={stats?.pending ?? 0} color="amber" />
        <StatCard icon={CheckCircle} label="Verified" value={stats?.verified ?? 0} color="green" />
        <StatCard icon={AlertCircle} label="Rejected" value={stats?.rejected ?? 0} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search therapist..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none">
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Therapist</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Org</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Document Type</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Submitted</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Loading credentials...</td></tr>
            ) : credentials.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No credentials found {statusFilter === 'pending' ? '— the queue is clear!' : ''}</td></tr>
            ) : credentials.map(cred => (
              <tr key={cred.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{cred.therapist_name}</div>
                  <div className="text-xs text-gray-500">{cred.therapist_email}</div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden md:table-cell">{cred.organization_name}</td>
                <td className="px-4 py-3 text-gray-300 text-sm hidden lg:table-cell">{cred.document_type}</td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{fmt(cred.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cred.status] || 'text-gray-400 bg-gray-400/10'}`}>
                    {cred.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setSelected(cred)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white" title="View">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {cred.status === 'pending' && (
                      <>
                        <button onClick={() => setVerifyModal(cred)} className="p-1.5 rounded-lg hover:bg-green-900/40 text-gray-400 hover:text-green-400" title="Verify">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setRejectModal(cred); setRejectionReason(''); }} className="p-1.5 rounded-lg hover:bg-red-900/40 text-gray-400 hover:text-red-400" title="Reject">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Slide-Over */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-full max-w-[480px] bg-gray-900 border-l border-gray-700 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white">Credential Details</h2>
              <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <D label="Therapist" value={selected.therapist_name} />
                <D label="Email" value={selected.therapist_email} />
                <D label="Organization" value={selected.organization_name} />
              </div>
              <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                <D label="Document Type" value={selected.document_type} />
                <D label="Status" value={selected.status} />
                <D label="Submitted" value={fmt(selected.created_at)} />
                <D label="Verified At" value={fmt(selected.verified_at)} />
                {selected.rejection_reason && <D label="Rejection Reason" value={selected.rejection_reason} />}
              </div>
              {selected.document_url && (
                <a href={selected.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 bg-blue-900/20 border border-blue-700/30 rounded-xl text-sm text-blue-300 hover:text-blue-200">
                  <Eye className="w-4 h-4" /> View Document
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white">Verify Credential</h2>
              <button onClick={() => setVerifyModal(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-300">
                Verify credential document for <strong className="text-white">{verifyModal.therapist_name}</strong>?
                This action is logged to the audit trail.
              </p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setVerifyModal(null)} className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">Cancel</button>
                <button onClick={handleVerify} disabled={saving} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : 'Verify Credential'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white">Reject Credential</h2>
              <button onClick={() => setRejectModal(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-300">Reject credential for <strong className="text-white">{rejectModal.therapist_name}</strong>. A reason is required.</p>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Rejection Reason *</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. License expired, document illegible..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-xl text-sm">Cancel</button>
                <button onClick={handleReject} disabled={saving || !rejectionReason.trim()} className="flex-1 px-4 py-2.5 bg-red-600 disabled:bg-red-900 disabled:text-red-400 text-white rounded-xl text-sm font-semibold">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : 'Reject Credential'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function D({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-200 text-right">{value || '—'}</span>
    </div>
  );
}
