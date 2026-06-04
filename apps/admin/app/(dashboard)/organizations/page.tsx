'use client';

import { useState } from 'react';
import {
  Building2, Search, Filter, Plus, MoreHorizontal, ChevronRight,
  Users, Activity, CreditCard, CheckCircle, XCircle, Clock,
  AlertTriangle, Globe, Star, Download, Eye, Edit, Ban,
  ExternalLink, TrendingUp, Zap
} from 'lucide-react';

const ORGS = [
  {
    id: '1', name: 'Mindful Wellness Clinic', slug: 'mindful-wellness',
    plan: 'Enterprise', status: 'active', type: 'clinic',
    therapists: 24, patients: 412, sessions_month: 1840,
    mrr: 2400, total_revenue: 28800, joined: '2024-01-15',
    country: 'US', city: 'New York', health_score: 94,
    last_active: '5 min ago', verified: true,
  },
  {
    id: '2', name: 'Dr. Sarah Thompson Practice', slug: 'dr-thompson',
    plan: 'Pro', status: 'active', type: 'solo',
    therapists: 1, patients: 48, sessions_month: 160,
    mrr: 149, total_revenue: 1788, joined: '2024-03-20',
    country: 'US', city: 'Chicago', health_score: 87,
    last_active: '1h ago', verified: true,
  },
  {
    id: '3', name: 'Horizon Mental Health Group', slug: 'horizon-mh',
    plan: 'Growth', status: 'active', type: 'group_practice',
    therapists: 8, patients: 124, sessions_month: 480,
    mrr: 599, total_revenue: 4193, joined: '2024-02-08',
    country: 'CA', city: 'Toronto', health_score: 91,
    last_active: '30 min ago', verified: true,
  },
  {
    id: '4', name: 'Calm Path Counseling', slug: 'calm-path',
    plan: 'Starter', status: 'trial', type: 'small_practice',
    therapists: 3, patients: 31, sessions_month: 72,
    mrr: 0, total_revenue: 0, joined: '2024-05-01',
    country: 'UK', city: 'London', health_score: 62,
    last_active: '2d ago', verified: false,
  },
  {
    id: '5', name: 'BrightMind Behavioral Health', slug: 'brightmind',
    plan: 'Enterprise', status: 'active', type: 'hospital',
    therapists: 67, patients: 1280, sessions_month: 5440,
    mrr: 8900, total_revenue: 89000, joined: '2023-08-12',
    country: 'US', city: 'Boston', health_score: 98,
    last_active: '2 min ago', verified: true,
  },
  {
    id: '6', name: 'NovaMind Therapy', slug: 'novamind',
    plan: 'Growth', status: 'suspended', type: 'group_practice',
    therapists: 5, patients: 68, sessions_month: 0,
    mrr: 0, total_revenue: 2394, joined: '2023-11-30',
    country: 'AU', city: 'Sydney', health_score: 23,
    last_active: '14d ago', verified: true,
  },
];

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

export default function OrganizationsPage() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const filtered = ORGS.filter((org) => {
    const matchSearch = org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === 'all' || org.plan.toLowerCase() === planFilter;
    const matchStatus = statusFilter === 'all' || org.status === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  const totalMrr = filtered.reduce((acc, o) => acc + o.mrr, 0);

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
            {ORGS.length} organizations · ${totalMrr.toLocaleString()}/mo visible MRR
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Active', value: ORGS.filter(o => o.status === 'active').length, icon: CheckCircle, color: 'text-green-400' },
          { label: 'On Trial', value: ORGS.filter(o => o.status === 'trial').length, icon: Clock, color: 'text-amber-400' },
          { label: 'Suspended', value: ORGS.filter(o => o.status === 'suspended').length, icon: Ban, color: 'text-red-400' },
          { label: 'Enterprise', value: ORGS.filter(o => o.plan === 'Enterprise').length, icon: Star, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
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
            placeholder="Search organizations..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
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
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} results</span>
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
            {filtered.map((org) => (
              <tr key={org.id} className="hover:bg-gray-800/50 transition-colors group">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-blue-300 text-sm font-bold shrink-0">
                      {org.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white">{org.name}</span>
                        {org.verified && <CheckCircle className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <div className="text-xs text-gray-500">
                        {TYPE_LABELS[org.type]} · {org.city}, {org.country} · {org.last_active}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[org.plan]}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="text-xs text-gray-300">
                    <span className="text-white font-medium">{org.therapists}</span> therapists
                  </div>
                  <div className="text-xs text-gray-500">
                    {org.patients} patients · {org.sessions_month.toLocaleString()} sessions/mo
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="text-sm font-semibold text-white">
                    {org.mrr > 0 ? `$${org.mrr.toLocaleString()}` : '—'}
                  </div>
                  {org.total_revenue > 0 && (
                    <div className="text-xs text-gray-500">
                      ${org.total_revenue.toLocaleString()} total
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
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
                </td>
                <td className="px-4 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[org.status]}`}>
                    {org.status}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
