'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Plus, Shield, CheckCircle,
  Ban, Eye, Edit, Download, RefreshCw, UserCheck, AlertCircle, MoreHorizontal
} from 'lucide-react';
import { adminAPI, APIError } from '@/lib/api';

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-400/20 text-red-300 border border-red-400/30',
  admin: 'bg-purple-400/20 text-purple-300 border border-purple-400/30',
  org_admin: 'bg-indigo-400/20 text-indigo-300 border border-indigo-400/30',
  therapist: 'bg-blue-400/20 text-blue-300 border border-blue-400/30',
  assistant: 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30',
  patient: 'bg-green-400/20 text-green-300 border border-green-400/30',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-300',
  pending: 'text-amber-300',
  suspended: 'text-red-300',
  inactive: 'text-gray-400',
};

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: `${55 + (i * 13) % 45}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminAPI.users({
        page,
        limit: LIMIT,
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (Array.isArray(result)) {
        setUsers(result as any[]);
        setTotal((result as any[]).length);
      } else {
        setUsers((result as any).data ?? []);
        setTotal((result as any).total ?? 0);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetchUsers, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [fetchUsers, search]);

  const handleSuspend = async (userId: string) => {
    try {
      await adminAPI.suspendUser(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'suspended' } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to suspend user');
    }
  };

  // Computed stats from current page data
  const stats = {
    total,
    active: users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    noMfa: users.filter(u => !u.mfa_enabled).length,
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Platform Users
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Loading...' : `${total.toLocaleString()} total users across all organizations`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-red-500 hover:to-orange-500 transition-all">
            <Plus className="w-4 h-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-xl text-red-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchUsers} className="ml-auto text-red-400 hover:text-red-300 underline text-xs">Retry</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Users', value: loading ? '—' : total, color: 'text-white' },
          { label: 'Active', value: loading ? '—' : stats.active, color: 'text-green-400' },
          { label: 'Pending Verification', value: loading ? '—' : stats.pending, color: 'text-amber-400' },
          { label: 'Suspended', value: loading ? '—' : stats.suspended, color: 'text-red-400' },
          { label: 'MFA Disabled', value: loading ? '—' : stats.noMfa, color: 'text-orange-400' },
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
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="org_admin">Org Admin</option>
          <option value="therapist">Therapist</option>
          <option value="assistant">Assistant</option>
          <option value="patient">Patient</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-xs text-gray-500">{loading ? '…' : `${total} results`}</span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organization</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Activity</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Security</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    {search || roleFilter !== 'all' || statusFilter !== 'all'
                      ? 'No users match your filters.'
                      : 'No users found.'}
                  </p>
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-500/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(user.first_name || user.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white">
                            {user.first_name && user.last_name
                              ? `${user.first_name} ${user.last_name}`
                              : user.name || 'Unknown'}
                          </span>
                          {(user.risk_level === 'high' || user.risk_score > 70) && (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                          {(user.risk_level === 'medium' || (user.risk_score > 40 && user.risk_score <= 70)) && (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[user.role] || 'bg-gray-400/20 text-gray-300'}`}>
                      {(user.role || 'user').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-300">
                      {user.organization?.name || user.org || '—'}
                    </div>
                    <div className="text-xs text-gray-500">{user.country || ''}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-300">
                      <span className="text-white font-medium">{user.sessions_count ?? user.sessions ?? 0}</span> sessions
                    </div>
                    <div className="text-xs text-gray-500">
                      Last: {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : (user.last_login || 'Never')}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {user.mfa_enabled ? (
                        <div title="MFA Enabled" className="flex items-center gap-1 text-green-400">
                          <Shield className="w-3.5 h-3.5" />
                          <span className="text-xs">MFA</span>
                        </div>
                      ) : (
                        <div title="MFA Disabled" className="flex items-center gap-1 text-red-400">
                          <Shield className="w-3.5 h-3.5" />
                          <span className="text-xs">No MFA</span>
                        </div>
                      )}
                      {(user.verified || user.email_verified) && (
                        <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${
                        user.status === 'active' ? 'bg-green-400' :
                        user.status === 'pending' ? 'bg-amber-400' :
                        user.status === 'suspended' ? 'bg-red-400' : 'bg-gray-500'
                      }`} />
                      <span className={`text-xs font-medium capitalize ${STATUS_COLORS[user.status] || 'text-gray-400'}`}>
                        {user.status || 'unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="View User">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="Edit User">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-amber-400 transition-colors" title="Impersonate">
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                      {user.status === 'active' && (
                        <button
                          onClick={() => handleSuspend(user.id)}
                          className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                          title="Suspend User"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="More Actions">
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
    </div>
  );
}
