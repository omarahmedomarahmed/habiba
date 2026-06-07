'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CreditCard, DollarSign, TrendingUp, ArrowUp,
  Download, Search, Eye, RefreshCw, CheckCircle,
  XCircle, Clock, AlertTriangle, Building2,
  BarChart2, Settings, ExternalLink
} from 'lucide-react';
import { adminAPI, APIError } from '@/lib/api';

// NOTE: PLAN_PRICING removed. All pricing from /billing/admin/plans API.

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-400/20 text-green-300',
  overdue: 'bg-red-400/20 text-red-300',
  pending: 'bg-amber-400/20 text-amber-300',
  retry: 'bg-orange-400/20 text-orange-300',
  failed: 'bg-red-400/20 text-red-300',
  active: 'bg-green-400/20 text-green-300',
  trial: 'bg-blue-400/20 text-blue-300',
  past_due: 'bg-red-400/20 text-red-300',
  canceled: 'bg-gray-400/20 text-gray-400',
};

function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-800">
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-800 rounded animate-pulse" style={{ width: `${50 + (i * 12) % 50}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'invoices' | 'pricing'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invSearch, setInvSearch] = useState('');
  const [invPage, setInvPage] = useState(1);
  const [invTotal, setInvTotal] = useState(0);
  const LIMIT = 20;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

  // Fetch overview stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    setError(null);
    try {
      const result = await adminAPI.analyticsRevenue('month');
      setStats(result);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setError('Backend unavailable — revenue data is estimated.');
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Fetch subscriptions
  const fetchSubscriptions = useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await adminAPI.subscriptions({ page: 1, limit: 50 });
      setSubscriptions((result as any).data ?? (Array.isArray(result) ? result : []));
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setSubscriptions([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await adminAPI.invoices({
        page: invPage,
        limit: LIMIT,
        search: invSearch || undefined,
      });
      setInvoices((result as any).data ?? (Array.isArray(result) ? result : []));
      setInvTotal((result as any).total ?? 0);
    } catch (err) {
      if (err instanceof APIError && err.status === 401) return;
      setInvoices([]);
    } finally {
      setLoadingList(false);
    }
  }, [invPage, invSearch]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'subscriptions') fetchSubscriptions();
    if (activeTab === 'invoices') fetchInvoices();
  }, [activeTab, fetchSubscriptions, fetchInvoices]);

  const invTotalPages = Math.ceil(invTotal / LIMIT);

  const mrr = stats?.mrr ?? stats?.revenue_this_month ?? 0;
  const arr = mrr * 12;
  const outstanding = stats?.outstanding_amount ?? 0;
  const outstandingCount = stats?.outstanding_invoices ?? 0;
  const failedCount = stats?.failed_payments ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-green-400" />
            Billing & Revenue
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Subscription management · Invoicing · Revenue analytics
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchStats} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all">
            <DollarSign className="w-4 h-4" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-amber-900/20 border border-amber-700/30 rounded-xl text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Revenue Overview Card */}
      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/20 border border-green-700/30 rounded-xl p-6">
        <div className="grid grid-cols-4 divide-x divide-gray-700">
          <div className="pr-6">
            <div className="text-xs text-gray-400 mb-1">MRR</div>
            {loadingStats ? (
              <div className="h-8 bg-gray-800 rounded animate-pulse w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold text-white">{fmt(mrr)}</div>
                {stats?.mrr_growth != null && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUp className="w-3 h-3 text-green-400" />
                    <span className="text-sm text-green-400 font-semibold">{stats.mrr_growth}%</span>
                    <span className="text-xs text-gray-500">vs last month</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="px-6">
            <div className="text-xs text-gray-400 mb-1">ARR</div>
            {loadingStats ? (
              <div className="h-8 bg-gray-800 rounded animate-pulse w-32" />
            ) : (
              <>
                <div className="text-3xl font-bold text-white">{fmt(arr)}</div>
                <div className="text-xs text-gray-500 mt-1">Annualized run rate</div>
              </>
            )}
          </div>
          <div className="px-6">
            <div className="text-xs text-gray-400 mb-1">Outstanding</div>
            {loadingStats ? (
              <div className="h-8 bg-gray-800 rounded animate-pulse w-28" />
            ) : (
              <>
                <div className="text-3xl font-bold text-amber-300">{fmt(outstanding)}</div>
                <div className="text-xs text-amber-400 mt-1">{outstandingCount} unpaid invoices</div>
              </>
            )}
          </div>
          <div className="pl-6">
            <div className="text-xs text-gray-400 mb-1">Failed Payments</div>
            {loadingStats ? (
              <div className="h-8 bg-gray-800 rounded animate-pulse w-16" />
            ) : (
              <>
                <div className="text-3xl font-bold text-red-300">{failedCount}</div>
                <div className="text-xs text-red-400 mt-1">Require attention</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Revenue Overview', icon: BarChart2 },
          { id: 'subscriptions', label: 'Subscriptions', icon: Building2 },
          { id: 'invoices', label: 'Invoices', icon: CreditCard },
          { id: 'pricing', label: 'Pricing Plans', icon: DollarSign },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Subscriptions Tab */}
      {activeTab === 'subscriptions' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">MRR</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Billing Cycle</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Next Billing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Payment</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loadingList ? (
                [...Array(4)].map((_, i) => <SkeletonRow key={i} cols={7} />)
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-500 text-sm">
                    No subscriptions found.
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm text-white">
                        {sub.organization?.name || sub.org_name || sub.org || '—'}
                      </span>
                      <div className="text-xs text-gray-500">{sub.seats ?? sub.seat_count ?? '—'} seats</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-300 capitalize">{sub.plan || sub.plan_name || '—'}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-semibold text-white">
                        {(sub.mrr || sub.amount) > 0 ? fmt(sub.mrr || sub.amount) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-400 capitalize">{sub.billing_cycle || sub.interval || '—'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-400">
                        {sub.next_billing_date || sub.next_billing
                          ? new Date(sub.next_billing_date || sub.next_billing).toLocaleDateString()
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-500 font-mono">
                        {sub.payment_method || sub.card_last4 ? `•••• ${sub.card_last4}` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[sub.status] || 'bg-gray-400/20 text-gray-400'}`}>
                        {(sub.status || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={invSearch}
                onChange={(e) => { setInvSearch(e.target.value); setInvPage(1); }}
                placeholder="Search invoices..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <span className="text-xs text-gray-500">{invTotal} invoices</span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Invoice</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Organization</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Due</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loadingList ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={7} />)
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-gray-500 text-sm">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="px-5 py-3">
                        <span className="text-xs font-mono text-blue-400">
                          {inv.invoice_number || inv.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-white">
                          {inv.organization?.name || inv.org_name || inv.org || inv.patient_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-white">
                          {fmt((inv.amount || inv.total || 0) / 100 || inv.amount || inv.total || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">
                          {inv.created_at || inv.date
                            ? new Date(inv.created_at || inv.date).toLocaleDateString()
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">
                          {inv.due_date || inv.due
                            ? new Date(inv.due_date || inv.due).toLocaleDateString()
                            : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[inv.status] || 'bg-gray-400/20 text-gray-400'}`}>
                          {inv.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Invoice Pagination */}
            {!loadingList && invTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800">
                <span className="text-xs text-gray-500">Page {invPage} of {invTotalPages} · {invTotal} total</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInvPage(p => Math.max(1, p - 1))}
                    disabled={invPage === 1}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setInvPage(p => Math.min(invTotalPages, p + 1))}
                    disabled={invPage === invTotalPages}
                    className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 hover:text-white disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pricing Plans Tab — Redirects to dedicated Pricing Management page */}
      {activeTab === 'pricing' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Pricing Management</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Subscription plan management has moved to its own dedicated page.
            Manage plans, pricing, features, limits, and billing cycles from the Pricing Management portal.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl text-sm font-medium transition-all"
            >
              <Settings className="w-4 h-4" />
              Open Pricing Management
            </Link>
            <a
              href="http://localhost:3000/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Public Pricing Page
            </a>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
            {[
              { label: 'Create Plans', desc: 'Add new subscription tiers' },
              { label: 'Edit Pricing', desc: 'Change prices, limits, features' },
              { label: 'Live Updates', desc: 'Changes reflect immediately' },
            ].map(({ label, desc }) => (
              <div key={label} className="bg-gray-800 rounded-xl p-4">
                <CheckCircle className="w-4 h-4 text-green-400 mb-2" />
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Revenue This Month',
                value: loadingStats ? null : fmt(stats?.revenue_this_month ?? mrr),
                change: stats?.mrr_growth,
                period: stats?.revenue_last_month ? `vs ${fmt(stats.revenue_last_month)} last month` : 'Monthly recurring',
              },
              {
                label: 'Stripe Volume Today',
                value: loadingStats ? null : fmt(stats?.stripe_volume_today ?? 0),
                period: 'Processing normally',
              },
              {
                label: 'Refunds This Month',
                value: loadingStats ? null : fmt(stats?.refunds_this_month ?? 0),
                period: 'Refund rate tracked',
              },
            ].map(({ label, value, change, period }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-2">{label}</div>
                {value === null ? (
                  <div className="h-8 bg-gray-800 rounded animate-pulse w-28" />
                ) : (
                  <div className="text-2xl font-bold text-white">{value}</div>
                )}
                {change != null && value !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUp className="w-3 h-3 text-green-400" />
                    <span className="text-xs text-green-400 font-medium">{change}%</span>
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-1">{period}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Revenue by Plan</h3>
            {loadingStats ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-6 bg-gray-800 rounded animate-pulse" />
                ))}
              </div>
            ) : stats?.revenue_by_plan ? (
              <div className="space-y-3">
                {Object.entries(stats.revenue_by_plan).map(([plan, rev]: [string, any]) => {
                  const pct = mrr > 0 ? Math.round((rev / mrr) * 100) : 0;
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300 capitalize">{plan}</span>
                        <span className="text-sm font-semibold text-white">{fmt(rev)}</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-600 text-center py-8">
                Revenue breakdown will appear here once billing data is available from the backend.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
