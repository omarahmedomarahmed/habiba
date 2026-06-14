'use client';

import { useState, useEffect, useCallback } from 'react';
import { Banknote, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { adminAPI, APIError } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-400/20 text-amber-300',
  processed: 'bg-green-400/20 text-green-300',
  rejected: 'bg-red-400/20 text-red-300',
};

function money(cents: number) {
  return `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayoutsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminAPI.payoutRequests(statusFilter !== 'all' ? statusFilter : undefined);
      setRequests(Array.isArray(result) ? result : ((result as any)?.data ?? []));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Failed to load payout requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleProcess = async (id: string) => {
    setActionLoading(id);
    try {
      await adminAPI.processPayout(id);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'processed', processed_at: new Date().toISOString() } : r));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process payout');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount_cents || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-400" />
            Therapist Payouts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and process therapist payout requests · ACH / Wire / SWIFT</p>
        </div>
        <button onClick={fetchRequests} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchRequests} className="ml-auto text-red-400 hover:text-red-300 underline text-xs">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total Requests</div>
          <div className="text-2xl font-bold text-white">{loading ? '—' : requests.length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-400">{loading ? '—' : requests.filter(r => r.status === 'pending').length}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Pending Amount</div>
          <div className="text-2xl font-bold text-green-400">{loading ? '—' : money(totalPending)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-24 animate-pulse" />)
        ) : requests.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
            <Banknote className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No payout requests found.</p>
          </div>
        ) : (
          requests.map((r) => {
            const bd = r.bank_details || {};
            const method = (r.method || r.therapist_payout_method || 'ach').toUpperCase();
            return (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base font-semibold text-white">{r.therapist_name || 'Unknown'}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[r.status] || 'bg-gray-400/20 text-gray-400'}`}>
                        {r.status}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-300">{method}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">{r.therapist_email}</div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                      {bd.bank_name && <span>Bank: <span className="text-gray-200">{bd.bank_name}</span></span>}
                      {bd.account_number && <span>Acct: <span className="text-gray-200 font-mono">****{String(bd.account_number).slice(-4)}</span></span>}
                      {bd.routing_number && <span>Routing: <span className="text-gray-200 font-mono">{bd.routing_number}</span></span>}
                      {bd.swift_bic && <span>SWIFT: <span className="text-gray-200 font-mono">{bd.swift_bic}</span></span>}
                      {bd.iban_or_account && <span>IBAN: <span className="text-gray-200 font-mono">{bd.iban_or_account}</span></span>}
                      {bd.account_name && <span>Name: <span className="text-gray-200">{bd.account_name}</span></span>}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      Requested {r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'}
                      {r.processed_at && <span className="text-green-400">· Processed {new Date(r.processed_at).toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-white mb-2">{money(r.amount_cents)}</div>
                    {r.status === 'pending' && (
                      <button
                        onClick={() => handleProcess(r.id)}
                        disabled={actionLoading === r.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {actionLoading === r.id ? 'Processing…' : 'Mark Processed'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
