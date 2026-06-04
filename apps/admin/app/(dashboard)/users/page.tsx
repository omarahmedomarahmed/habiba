'use client';

import { useState } from 'react';
import {
  Users, Search, Plus, Filter, MoreHorizontal, Shield, CheckCircle,
  XCircle, Clock, Ban, Eye, Edit, Mail, Phone, Building2,
  ChevronDown, Download, RefreshCw, UserCheck, AlertCircle, Key
} from 'lucide-react';

const USERS = [
  {
    id: '1', name: 'Dr. Sarah Thompson', email: 'sarah.thompson@mindfulwellness.com',
    role: 'therapist', org: 'Mindful Wellness Clinic', status: 'active',
    verified: true, sessions: 248, patients: 32, joined: '2024-01-15',
    last_login: '2 min ago', country: 'US', plan_access: 'Enterprise',
    mfa_enabled: true, risk_level: 'low',
  },
  {
    id: '2', name: 'James Rodriguez', email: 'james.r@brightmind.health',
    role: 'therapist', org: 'BrightMind Behavioral Health', status: 'active',
    verified: true, sessions: 412, patients: 58, joined: '2023-09-22',
    last_login: '1h ago', country: 'US', plan_access: 'Enterprise',
    mfa_enabled: true, risk_level: 'low',
  },
  {
    id: '3', name: 'Emily Chen', email: 'e.chen@horizonmh.ca',
    role: 'admin', org: 'Horizon Mental Health Group', status: 'active',
    verified: true, sessions: 0, patients: 0, joined: '2024-02-10',
    last_login: '3h ago', country: 'CA', plan_access: 'Growth',
    mfa_enabled: false, risk_level: 'medium',
  },
  {
    id: '4', name: 'Dr. Mark Williams', email: 'mark.w@calmpath.co.uk',
    role: 'therapist', org: 'Calm Path Counseling', status: 'pending',
    verified: false, sessions: 0, patients: 0, joined: '2024-05-01',
    last_login: 'Never', country: 'UK', plan_access: 'Starter',
    mfa_enabled: false, risk_level: 'low',
  },
  {
    id: '5', name: 'Anna Petrova', email: 'a.petrova@novamind.au',
    role: 'therapist', org: 'NovaMind Therapy', status: 'suspended',
    verified: true, sessions: 89, patients: 14, joined: '2023-11-30',
    last_login: '14d ago', country: 'AU', plan_access: 'Growth',
    mfa_enabled: false, risk_level: 'high',
  },
  {
    id: '6', name: 'Support Admin', email: 'support@24therapy.com',
    role: 'super_admin', org: '24Therapy Platform', status: 'active',
    verified: true, sessions: 0, patients: 0, joined: '2023-01-01',
    last_login: '5 min ago', country: 'US', plan_access: 'Super Admin',
    mfa_enabled: true, risk_level: 'low',
  },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-400/20 text-red-300 border border-red-400/30',
  admin: 'bg-purple-400/20 text-purple-300 border border-purple-400/30',
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

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showImpersonate, setShowImpersonate] = useState<string | null>(null);

  const filtered = USERS.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.org.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

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
            {USERS.length.toLocaleString()} total users across all organizations
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Users', value: USERS.length, color: 'text-white' },
          { label: 'Active', value: USERS.filter(u => u.status === 'active').length, color: 'text-green-400' },
          { label: 'Pending Verification', value: USERS.filter(u => u.status === 'pending').length, color: 'text-amber-400' },
          { label: 'Suspended', value: USERS.filter(u => u.status === 'suspended').length, color: 'text-red-400' },
          { label: 'MFA Disabled', value: USERS.filter(u => !u.mfa_enabled).length, color: 'text-orange-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">Admin</option>
          <option value="therapist">Therapist</option>
          <option value="assistant">Assistant</option>
          <option value="patient">Patient</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} results</span>
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
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-gray-800/50 transition-colors group">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-500/20 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white">{user.name}</span>
                        {user.risk_level === 'high' && (
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        {user.risk_level === 'medium' && (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[user.role]}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="text-xs text-gray-300">{user.org}</div>
                  <div className="text-xs text-gray-500">{user.country}</div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-xs text-gray-300">
                    <span className="text-white font-medium">{user.sessions}</span> sessions
                  </div>
                  <div className="text-xs text-gray-500">Last: {user.last_login}</div>
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
                    {user.verified && (
                      <CheckCircle className="w-3.5 h-3.5 text-blue-400" title="Verified" />
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
                    <span className={`text-xs font-medium capitalize ${STATUS_COLORS[user.status]}`}>
                      {user.status}
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
                    <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors" title="More Actions">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
