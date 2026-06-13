'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User, Search, CheckCircle, XCircle, Clock, Star,
  Eye, Mail, AlertTriangle, MoreHorizontal, Download, RefreshCw,
  ChevronRight, Shield
} from 'lucide-react';
import { adminAPI, APIError } from '@/lib/api';
import { exportCSV } from '@/lib/csv';

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-green-400/20 text-green-300',
  pending: 'bg-amber-400/20 text-amber-300',
  under_review: 'bg-blue-400/20 text-blue-300',
  suspended: 'bg-red-400/20 text-red-300',
  rejected: 'bg-gray-400/20 text-gray-400',
};

const DOC_STATUS: Record<string, string> = {
  verified: 'text-green-400',
  pending: 'text-amber-400',
  missing: 'text-red-400',
  expired: 'text-orange-400',
};

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-800" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-800 rounded w-48" />
          <div className="h-3 bg-gray-800 rounded w-64" />
          <div className="h-3 bg-gray-800 rounded w-32" />
        </div>
        <div className="w-20 h-4 bg-gray-800 rounded" />
      </div>
    </div>
  );
}

export default function TherapistsPage() {
  const [therapists, setTherapists] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const handleExportCSV = () => {
    exportCSV(
      therapists.map(t => ({
        id: t.id,
        display_name: t.display_name,
        email: t.email ?? '',
        organization: t.organization_name ?? '',
        verification_status: t.verification_status,
        availability_status: t.availability_status,
        patient_count: t.patient_count ?? '',
        session_count: t.session_count ?? '',
        rating: t.rating ?? '',
        created_at: t.created_at,
      })),
      `therapists-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const fetchTherapists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminAPI.therapists({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (Array.isArray(result)) {
        setTherapists(result as any[]);
        setTotal((result as any[]).length);
      } else {
        setTherapists((result as any).data ?? []);
        setTotal((result as any).total ?? 0);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Failed to load therapists');
      setTherapists([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchTherapists, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchTherapists, search]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await adminAPI.approveTherapist(id);
      setTherapists(prev => prev.map(t => t.id === id ? { ...t, status: 'verified', verification_status: 'verified' } : t));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve therapist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    setActionLoading(id);
    try {
      await adminAPI.rejectTherapist(id, reason);
      setTherapists(prev => prev.map(t => t.id === id ? { ...t, status: 'rejected', verification_status: 'rejected' } : t));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject therapist');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats from current page
  const stats = {
    total,
    verified: therapists.filter(t => (t.status || t.verification_status) === 'verified').length,
    pending: therapists.filter(t => (t.status || t.verification_status) === 'pending').length,
    suspended: therapists.filter(t => (t.status || t.verification_status) === 'suspended').length,
  };

  const totalPages = Math.ceil(total / LIMIT);
  const getStatus = (t: any) => t.verification_status || t.status || 'unknown';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Therapist Management & Verification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Credential verification · License management · Performance monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchTherapists} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleExportCSV} disabled={!therapists.length} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchTherapists} className="ml-auto text-red-400 hover:text-red-300 underline text-xs">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Therapists', value: loading ? '—' : total, color: 'text-white' },
          { label: 'Verified', value: loading ? '—' : stats.verified, color: 'text-green-400' },
          { label: 'Pending Verification', value: loading ? '—' : stats.pending, color: 'text-amber-400' },
          { label: 'Suspended', value: loading ? '—' : stats.suspended, color: 'text-red-400' },
          { label: 'Avg Rating', value: loading ? '—' : '4.5 ★', color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${loading ? 'text-gray-600' : color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search therapists..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
        <span className="text-xs text-gray-500">{loading ? '…' : `${total} results`}</span>
      </div>

      {/* Therapists List */}
      <div className="space-y-4">
        {loading ? (
          [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
        ) : therapists.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
            <User className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {search || statusFilter !== 'all'
                ? 'No therapists match your filters.'
                : 'No therapists found.'}
            </p>
          </div>
        ) : (
          therapists.map((therapist) => {
            const status = getStatus(therapist);
            const docs = therapist.documents || {};
            const isExpanded = selected === therapist.id;
            const isActing = actionLoading === therapist.id;

            return (
              <div
                key={therapist.id}
                className={`bg-gray-900 border rounded-xl p-5 transition-all cursor-pointer ${
                  isExpanded ? 'border-blue-500/50' : 'border-gray-800 hover:border-gray-700'
                }`}
                onClick={() => setSelected(isExpanded ? null : therapist.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-white text-base font-bold shrink-0">
                    {(therapist.first_name || therapist.name || '?').charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base font-semibold text-white">
                        {therapist.first_name && therapist.last_name
                          ? `${therapist.first_name} ${therapist.last_name}`
                          : therapist.name || therapist.email}
                      </span>
                      {status === 'verified' && <CheckCircle className="w-4 h-4 text-blue-400" />}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[status] || 'bg-gray-400/20 text-gray-400'}`}>
                        {status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {therapist.organization?.name || therapist.organization || '—'}
                      {(therapist.state || therapist.location) && ` · ${therapist.state || therapist.location}`}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      {therapist.license_number && (
                        <span className="text-xs text-gray-400">
                          License: <span className="text-white font-mono">{therapist.license_number}</span>
                        </span>
                      )}
                      {(therapist.rating || therapist.average_rating) > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-300">
                          <Star className="w-3 h-3" />
                          {(therapist.rating || therapist.average_rating).toFixed(1)}
                          {therapist.reviews_count && ` (${therapist.reviews_count})`}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">{therapist.sessions_count ?? therapist.sessions_total ?? 0} sessions</span>
                      <span className="text-xs text-gray-400">{therapist.patients_count ?? therapist.patients ?? 0} patients</span>
                    </div>
                    {therapist.specializations?.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {therapist.specializations.slice(0, 4).map((s: string) => (
                          <span key={s} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {therapist.revenue_generated > 0 && (
                      <>
                        <div className="text-sm font-semibold text-white">${therapist.revenue_generated.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">revenue generated</div>
                      </>
                    )}
                    <ChevronRight className={`w-4 h-4 text-gray-500 mt-2 ml-auto transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-3 gap-6">
                    {/* Documents */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Document Verification</h4>
                      {Object.keys(docs).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(docs).map(([doc, docStatus]) => (
                            <div key={doc} className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 capitalize">{doc.replace(/_/g, ' ')}</span>
                              <span className={`text-xs font-semibold capitalize ${DOC_STATUS[docStatus as string] || 'text-gray-400'}`}>
                                {docStatus as string}
                              </span>
                            </div>
                          ))}
                          {therapist.background_check && (
                            <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                              <span className="text-xs text-gray-400">Background Check</span>
                              <span className={`text-xs font-semibold capitalize ${
                                therapist.background_check === 'passed' ? 'text-green-400' :
                                therapist.background_check === 'pending' ? 'text-amber-400' : 'text-red-400'
                              }`}>
                                {therapist.background_check}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-600">No document data available</p>
                      )}
                    </div>

                    {/* Insurance */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Insurance Networks</h4>
                      {therapist.insurance_networks?.length > 0 || therapist.insurance?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(therapist.insurance_networks || therapist.insurance || []).map((ins: string) => (
                            <span key={ins} className="text-[10px] bg-green-400/10 text-green-300 border border-green-400/20 px-2 py-0.5 rounded">
                              {ins}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No insurance networks listed</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Actions</h4>
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        {(status === 'pending' || status === 'under_review') && (
                          <>
                            <button
                              onClick={() => handleApprove(therapist.id)}
                              disabled={isActing}
                              className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {isActing ? 'Approving...' : 'Approve & Verify'}
                            </button>
                            <button
                              onClick={() => handleReject(therapist.id)}
                              disabled={isActing}
                              className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {isActing ? 'Rejecting...' : 'Reject Application'}
                            </button>
                          </>
                        )}
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                          <Eye className="w-3.5 h-3.5" />
                          View Full Profile
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                          <Mail className="w-3.5 h-3.5" />
                          Send Email
                        </button>
                        {status === 'verified' && (
                          <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/30 text-red-300 hover:text-red-200 rounded-lg text-xs transition-all">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Suspend Account
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-500">Page {page} of {totalPages} · {total} total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
