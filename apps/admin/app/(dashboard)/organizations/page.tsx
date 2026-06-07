'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Search, Plus, MoreHorizontal,
  Users, CheckCircle, XCircle, Clock, Ban, Eye, Edit,
  Download, Star, AlertTriangle, RefreshCw
} from 'lucide-react';
import { adminAPI, APIError } from '@/lib/api';

const PLAN_COLORS: Record<string, string> = {
  Enterprise: 'bg-purple-400/20 text-purple-300 border border-purple-400/30',
  Pro: 'bg-blue-400/20 text-blue-300 border border-blue-400/30',
  Growth: 'bg-green-400/20 text-green-300 border border-green-400/30',
  Starter: 'bg-gray-400/20 text-gray-300 border border-gray-400/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-400/20 text-green-300',
  trial: 'bg-amber-400/20 text-amber-300',
  suspended: 'bg-red-400/20 text-red-300',
  churned: 'bg-gray-400/20 text-gray-400',
};

const TYPE_LABELS: Record<string, string> = {
  solo: 'Solo Practice',
  small_practice: 'Small Practice',
  group_practice: 'Group Practice',
  clinic: 'Clinic',
  hospital: 'Hospital',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: `${60 + (i * 10) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminAPI.organizations({
        page,
        limit: LIMIT,
        search: search || undefined,
        plan: planFilter !== 'all' ? planFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      // Handle both { data: [], total } and bare array shapes
      if (Array.isArray(result)) {
        setOrgs(result);
        setTotal((result as any[]).length);
      } else {
        setOrgs((result as any).data ?? []);
        setTotal((result as any).total ?? 0);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchOrgs, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchOrgs, search]);

  // Stats computed from loaded data
  const stats = {
    active: orgs.filter(o => o.status === 'active').length,
    trial: orgs.filter(o => o.status === 'trial').length,
    suspended: orgs.filter(o => o.status === 'suspended').length,
    enterprise: orgs.filter(o => o.plan === 'Enterprise' || o.plan === 'enterprise').length,
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Organizations
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${total.toLocaleString()} organizations`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOrgs}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-red-500 hover:to-orange-500 transition-all">
            <Plus className="w-4 h-4" />
            Add Organization
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error} — showing cached data if available.</span>
          <button onClick={fetchOrgs} className="ml-auto text-red-400 hover:text-red-300 underline text-xs">Retry</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Active', value: loading ? '—' : stats.active, icon: CheckCircle, color: 'text-green-400' },
          { label: 'On Trial', value: loading ? '—' : stats.trial, icon: Clock, color: 'text-amber-400' },
          { label: 'Suspended', value: loading ? '—' : stats.suspended, icon: Ban, color: 'text-red-400' },
          { label: 'Enterprise', value: loading ? '—' : stats.enterprise, icon: Star, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${loading ? 'text-gray-600' : 'text-white'}`}>{value}</div>
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
            placeholder="Search organizations..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Plans</option>
          <option value="enterprise">Enterprise</option>
          <option value="pro">Pro</option>
          <option value="growth">Growth</option>
          <option value="starter">Starter</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
        <span className="text-xs text-gray-500">{loading ? '…' : `${total} results`}</span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usage</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MRR</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Health</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : orgs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <Building2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    {search || planFilter !== 'all' || statusFilter !== 'all'
                      ? 'No organizations match your filters.'
                      : 'No organizations yet.'}
                  </p>
                </td>
              </tr>
            ) : (
              orgs.map((org) => (
                <tr key={org.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-blue-300 text-sm font-bold shrink-0">
                        {(org.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">{org.name}</span>
                          {(org.verified || org.verification_status === 'verified') && (
                            <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {TYPE_LABELS[org.type] || org.type || 'Organization'}{org.city ? ` · ${org.city}` : ''}{org.country ? `, ${org.country}` : ''}
                          {org.last_active ? ` · ${org.last_active}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[org.plan] || 'bg-gray-400/20 text-gray-300'}`}>
                      {org.plan || 'Free'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-300">
                      <span className="text-white font-medium">{org.therapists_count ?? org.therapists ?? 0}</span> therapists
                    </div>
                    <div className="text-xs text-gray-500">
                      {org.patients_count ?? org.patients ?? 0} patients
                      {(org.sessions_this_month ?? org.sessions_month) != null && ` · ${(org.sessions_this_month ?? org.sessions_month).toLocaleString()} sessions/mo`}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="text-sm font-semibold text-white">
                      {org.mrr > 0 ? `$${org.mrr.toLocaleString()}` : '—'}
                    </div>
                    {org.total_revenue > 0 && (
                      <div className="text-xs text-gray-500">${org.total_revenue.toLocaleString()} total</div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {org.health_score != null ? (
                      <div className="inline-flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${
                          org.health_score >= 80 ? 'bg-green-400' :
                          org.health_score >= 60 ? 'bg-amber-400' : 'bg-red-400'
                        }`} />
                        <span className={`text-sm font-bold ${
                          org.health_score >= 80 ? 'text-green-300' :
                          org.health_score >= 60 ? 'text-amber-300' : 'text-red-300'
                        }`}>
                          {org.health_score}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[org.status] || 'bg-gray-400/20 text-gray-400'}`}>
                      {org.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
