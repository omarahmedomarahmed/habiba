'use client';

import { useState } from 'react';
import {
  CreditCard, DollarSign, TrendingUp, ArrowUp, ArrowDown,
  Download, Search, Filter, Eye, RefreshCw, CheckCircle,
  XCircle, Clock, AlertTriangle, Building2, Calendar,
  ChevronRight, BarChart2, Zap, Users
} from 'lucide-react';

const BILLING_STATS = {
  mrr: 284500,
  arr: 3414000,
  mrr_growth: 18.4,
  revenue_this_month: 284500,
  revenue_last_month: 240200,
  outstanding_invoices: 3,
  outstanding_amount: 8940,
  failed_payments: 2,
  refunds_this_month: 1240,
  stripe_volume_today: 9840,
};

const SUBSCRIPTIONS = [
  { id: '1', org: 'Mindful Wellness Clinic', plan: 'Enterprise', status: 'active', mrr: 2400, seats: 24, billing_cycle: 'monthly', next_billing: '2024-07-01', payment_method: 'Visa •••• 4242' },
  { id: '2', name: 'BrightMind Behavioral Health', plan: 'Enterprise', status: 'active', mrr: 8900, seats: 67, billing_cycle: 'annual', next_billing: '2024-08-12', payment_method: 'Visa •••• 5678' },
  { id: '3', org: 'Horizon Mental Health Group', plan: 'Growth', status: 'active', mrr: 599, seats: 8, billing_cycle: 'monthly', next_billing: '2024-07-08', payment_method: 'MC •••• 9012' },
  { id: '4', org: 'Dr. Sarah Thompson', plan: 'Pro', status: 'active', mrr: 149, seats: 1, billing_cycle: 'monthly', next_billing: '2024-07-20', payment_method: 'Visa •••• 3456' },
  { id: '5', org: 'Calm Path Counseling', plan: 'Starter', status: 'trial', mrr: 0, seats: 3, billing_cycle: 'monthly', next_billing: '2024-06-14', payment_method: 'None' },
  { id: '6', org: 'NovaMind Therapy', plan: 'Growth', status: 'past_due', mrr: 599, seats: 5, billing_cycle: 'monthly', next_billing: '2024-05-30', payment_method: 'MC •••• 7890' },
];

const RECENT_INVOICES = [
  { id: 'INV-9021', org: 'Mindful Wellness Clinic', amount: 2400, status: 'paid', date: '2024-06-01', due: '2024-06-01' },
  { id: 'INV-9020', org: 'BrightMind Behavioral Health', amount: 8900, status: 'paid', date: '2024-06-01', due: '2024-06-01' },
  { id: 'INV-9019', org: 'Horizon Mental Health', amount: 599, status: 'paid', date: '2024-06-08', due: '2024-06-08' },
  { id: 'INV-9018', org: 'NovaMind Therapy', amount: 599, status: 'overdue', date: '2024-05-30', due: '2024-05-30' },
  { id: 'INV-9017', org: 'Dr. Sarah Thompson', amount: 149, status: 'paid', date: '2024-06-20', due: '2024-06-20' },
  { id: 'INV-9016', org: 'Calm Path Counseling', amount: 59, status: 'pending', date: '2024-06-14', due: '2024-06-21' },
  { id: 'INV-8821', org: 'CloudMind Clinic', amount: 1200, status: 'retry', date: '2024-06-01', due: '2024-06-01' },
];

const PLAN_PRICING = [
  { name: 'Starter', price: 59, sessions: 50, therapists: 1, ai_notes: 50, features: ['Basic AI notes', 'Patient management', 'Scheduling'] },
  { name: 'Pro', price: 149, sessions: 200, therapists: 3, ai_notes: 200, features: ['Advanced AI notes', 'AI Memory', 'Radar access', 'Analytics'] },
  { name: 'Growth', price: 599, sessions: 1000, therapists: 15, ai_notes: 1000, features: ['All Pro features', 'Multi-location', 'API access', 'Priority support'] },
  { name: 'Enterprise', price: null, sessions: null, therapists: null, ai_notes: null, features: ['Unlimited everything', 'White label', 'Custom AI', 'Dedicated support', 'SLA'] },
];

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-400/20 text-green-300',
  overdue: 'bg-red-400/20 text-red-300',
  pending: 'bg-amber-400/20 text-amber-300',
  retry: 'bg-orange-400/20 text-orange-300',
  active: 'bg-green-400/20 text-green-300',
  trial: 'bg-blue-400/20 text-blue-300',
  past_due: 'bg-red-400/20 text-red-300',
};

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'invoices' | 'pricing'>('overview');

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

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
            Subscription management · Invoicing · Revenue analytics · Payouts
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Revenue Overview */}
      <div className="bg-gradient-to-r from-green-900/30 to-blue-900/20 border border-green-700/30 rounded-xl p-6">
        <div className="grid grid-cols-4 divide-x divide-gray-700">
          <div className="pr-6">
            <div className="text-xs text-gray-400 mb-1">MRR</div>
            <div className="text-3xl font-bold text-white">{fmt(BILLING_STATS.mrr)}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="w-3 h-3 text-green-400" />
              <span className="text-sm text-green-400 font-semibold">{BILLING_STATS.mrr_growth}%</span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          </div>
          <div className="px-6">
            <div className="text-xs text-gray-400 mb-1">ARR</div>
            <div className="text-3xl font-bold text-white">$3.41M</div>
            <div className="text-xs text-gray-500 mt-1">Annualized run rate</div>
          </div>
          <div className="px-6">
            <div className="text-xs text-gray-400 mb-1">Outstanding</div>
            <div className="text-3xl font-bold text-amber-300">{fmt(BILLING_STATS.outstanding_amount)}</div>
            <div className="text-xs text-amber-400 mt-1">{BILLING_STATS.outstanding_invoices} unpaid invoices</div>
          </div>
          <div className="pl-6">
            <div className="text-xs text-gray-400 mb-1">Failed Payments</div>
            <div className="text-3xl font-bold text-red-300">{BILLING_STATS.failed_payments}</div>
            <div className="text-xs text-red-400 mt-1">Require attention</div>
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
              {SUBSCRIPTIONS.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-5 py-4">
                    <span className="text-sm text-white">{sub.org || (sub as any).name}</span>
                    <div className="text-xs text-gray-500">{sub.seats} seats</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-300">{sub.plan}</span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-semibold text-white">
                      {sub.mrr > 0 ? fmt(sub.mrr) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-400 capitalize">{sub.billing_cycle}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-400">{sub.next_billing}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-gray-500 font-mono">{sub.payment_method}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[sub.status]}`}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
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
              {RECENT_INVOICES.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono text-blue-400">{inv.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-white">{inv.org}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-white">{fmt(inv.amount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{inv.date}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{inv.due}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pricing Plans Tab */}
      {activeTab === 'pricing' && (
        <div className="grid grid-cols-4 gap-4">
          {PLAN_PRICING.map((plan) => (
            <div key={plan.name} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all">
              <div className="mb-4">
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="text-2xl font-bold text-white mt-1">
                  {plan.price ? `$${plan.price}` : 'Custom'}
                  {plan.price && <span className="text-sm font-normal text-gray-500">/mo</span>}
                </div>
              </div>
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Sessions/mo</span>
                  <span className="text-white">{plan.sessions ?? 'Unlimited'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Therapists</span>
                  <span className="text-white">{plan.therapists ?? 'Unlimited'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">AI Notes/mo</span>
                  <span className="text-white">{plan.ai_notes ?? 'Unlimited'}</span>
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-gray-800">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span className="text-xs text-gray-400">{f}</span>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2 bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-all">
                Edit Plan
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Revenue This Month', value: fmt(BILLING_STATS.revenue_this_month), change: 18.4, period: 'vs $240,200 last month' },
              { label: 'Stripe Volume Today', value: fmt(BILLING_STATS.stripe_volume_today), period: 'Processing normally' },
              { label: 'Refunds This Month', value: fmt(BILLING_STATS.refunds_this_month), period: '0.44% refund rate' },
            ].map(({ label, value, change, period }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-2">{label}</div>
                <div className="text-2xl font-bold text-white">{value}</div>
                {change && (
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
            <div className="space-y-3">
              {[
                { plan: 'Enterprise', revenue: 224500, pct: 79, orgs: 8 },
                { plan: 'Growth', revenue: 47000, pct: 17, orgs: 78 },
                { plan: 'Pro', revenue: 9800, pct: 3, orgs: 66 },
                { plan: 'Starter', revenue: 3200, pct: 1, orgs: 54 },
              ].map(({ plan, revenue, pct, orgs }) => (
                <div key={plan}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300">{plan}</span>
                      <span className="text-[10px] text-gray-600">{orgs} orgs</span>
                    </div>
                    <span className="text-sm font-semibold text-white">{fmt(revenue)}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
