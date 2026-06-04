'use client';

import { useState } from 'react';
import {
  Users, Building2, DollarSign, Brain, Activity, AlertTriangle,
  TrendingUp, TrendingDown, Zap, Shield, Server, Clock, ArrowUp,
  ArrowDown, MoreHorizontal, ExternalLink, CheckCircle, XCircle,
  RefreshCw, Eye, ChevronRight, CreditCard, Star, Globe
} from 'lucide-react';

// ============================================================
// Mock Platform Data
// ============================================================
const PLATFORM_STATS = {
  mrr: 284500,
  arr: 3414000,
  mrr_growth: 18.4,
  active_organizations: 312,
  active_therapists: 1847,
  active_patients: 24391,
  sessions_today: 1283,
  sessions_month: 38940,
  ai_notes_today: 1094,
  ai_tokens_today: 4280000,
  ai_cost_today: 342,
  radar_requests_today: 47,
  radar_conversion: 68,
  compliance_issues: 2,
  support_tickets: 14,
  system_uptime: 99.97,
  avg_session_duration: 52,
  nps_score: 72,
};

const RECENT_ORGS = [
  { id: '1', name: 'Mindful Wellness Clinic', plan: 'Enterprise', therapists: 24, patients: 412, status: 'active', mrr: 2400, joined: '2d ago' },
  { id: '2', name: 'Dr. Sarah Thompson', plan: 'Pro', therapists: 1, patients: 48, status: 'active', mrr: 149, joined: '4d ago' },
  { id: '3', name: 'Horizon Mental Health', plan: 'Growth', therapists: 8, patients: 124, status: 'active', mrr: 599, joined: '1w ago' },
  { id: '4', name: 'Calm Path Counseling', plan: 'Starter', therapists: 3, patients: 31, status: 'trial', mrr: 0, joined: '2w ago' },
];

const SYSTEM_HEALTH = [
  { name: 'API Gateway', status: 'operational', latency: '12ms', uptime: '99.99%' },
  { name: 'AI Service', status: 'operational', latency: '340ms', uptime: '99.94%' },
  { name: 'Database', status: 'operational', latency: '4ms', uptime: '100%' },
  { name: 'Video Service', status: 'operational', latency: '28ms', uptime: '99.89%' },
  { name: 'Notification Service', status: 'operational', latency: '89ms', uptime: '99.97%' },
  { name: 'Billing Service', status: 'operational', latency: '156ms', uptime: '99.99%' },
];

const RECENT_ALERTS = [
  { id: '1', type: 'compliance', message: 'PHI access anomaly detected — Dr. Park account', time: '23 min ago', severity: 'high' },
  { id: '2', type: 'billing', message: 'Stripe webhook retry — Invoice #INV-8821', time: '1h ago', severity: 'medium' },
  { id: '3', type: 'system', message: 'AI model latency spike — p99 exceeded 2s', time: '3h ago', severity: 'low' },
  { id: '4', type: 'security', message: 'Failed login attempts — 5 attempts from 134.56.x.x', time: '6h ago', severity: 'medium' },
];

const AI_USAGE = [
  { model: 'GPT-4o', requests: 8420, tokens: 2840000, cost: '$228.40', pct: 65 },
  { model: 'Claude 3.5 Sonnet', requests: 2180, tokens: 980000, cost: '$78.40', pct: 20 },
  { model: 'Whisper (STT)', requests: 1283, tokens: 0, cost: '$25.66', pct: 10 },
  { model: 'GPT-4o-mini', requests: 940, tokens: 460000, cost: '$9.20', pct: 5 },
];

// ============================================================
// Components
// ============================================================
function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  change,
  color = 'blue',
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  change?: number;
  color?: string;
  href?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
    cyan: 'text-cyan-400 bg-cyan-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition-colors" />
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {(sub || change !== undefined) && (
        <div className="mt-2 flex items-center gap-2">
          {change !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(change)}%
            </div>
          )}
          {sub && <span className="text-xs text-gray-600">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    operational: 'bg-green-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${map[status] || 'bg-gray-500'} animate-pulse`} />
  );
}

export default function AdminDashboardPage() {
  const [refreshing, setRefreshing] = useState(false);
  const now = new Date();

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(1)}K`
      : `$${n}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}Last updated: {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-green-400 font-medium">All Systems Operational</span>
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Revenue Banner */}
      <div className="bg-gradient-to-r from-red-900/40 via-orange-900/30 to-purple-900/30 border border-red-700/30 rounded-xl p-6">
        <div className="grid grid-cols-3 divide-x divide-gray-700">
          <div className="pr-6">
            <div className="text-xs text-gray-400 mb-1">Monthly Recurring Revenue</div>
            <div className="text-3xl font-bold text-white">{fmt(PLATFORM_STATS.mrr)}</div>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUp className="w-3 h-3 text-green-400" />
              <span className="text-sm text-green-400 font-semibold">{PLATFORM_STATS.mrr_growth}%</span>
              <span className="text-xs text-gray-500">vs last month</span>
            </div>
          </div>
          <div className="px-6">
            <div className="text-xs text-gray-400 mb-1">Annual Recurring Revenue</div>
            <div className="text-3xl font-bold text-white">{fmt(PLATFORM_STATS.arr)}</div>
            <div className="text-xs text-gray-500 mt-1">Projected ARR</div>
          </div>
          <div className="pl-6">
            <div className="text-xs text-gray-400 mb-1">NPS Score</div>
            <div className="text-3xl font-bold text-white">{PLATFORM_STATS.nps_score}</div>
            <div className="text-xs text-gray-500 mt-1">Industry avg: 32</div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Building2}
          label="Active Organizations"
          value={PLATFORM_STATS.active_organizations.toLocaleString()}
          change={8.2}
          sub="vs last month"
          color="blue"
        />
        <MetricCard
          icon={Users}
          label="Active Therapists"
          value={PLATFORM_STATS.active_therapists.toLocaleString()}
          change={12.1}
          sub="vs last month"
          color="green"
        />
        <MetricCard
          icon={Activity}
          label="Active Patients"
          value={PLATFORM_STATS.active_patients.toLocaleString()}
          change={15.7}
          sub="vs last month"
          color="purple"
        />
        <MetricCard
          icon={Clock}
          label="Sessions Today"
          value={PLATFORM_STATS.sessions_today.toLocaleString()}
          change={6.3}
          sub="vs yesterday"
          color="cyan"
        />
        <MetricCard
          icon={Brain}
          label="AI Notes Generated"
          value={PLATFORM_STATS.ai_notes_today.toLocaleString()}
          sub="Today"
          color="orange"
        />
        <MetricCard
          icon={DollarSign}
          label="AI Cost Today"
          value={`$${PLATFORM_STATS.ai_cost_today}`}
          sub={`${(PLATFORM_STATS.ai_tokens_today / 1_000_000).toFixed(2)}M tokens`}
          color="amber"
        />
        <MetricCard
          icon={Zap}
          label="Radar Requests"
          value={PLATFORM_STATS.radar_requests_today}
          sub={`${PLATFORM_STATS.radar_conversion}% conversion`}
          color="red"
        />
        <MetricCard
          icon={Shield}
          label="Compliance Issues"
          value={PLATFORM_STATS.compliance_issues}
          sub="Requires attention"
          color={PLATFORM_STATS.compliance_issues > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Organizations */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Recent Organizations</h3>
            </div>
            <a href="/organizations" className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          <div className="divide-y divide-gray-800">
            {RECENT_ORGS.map((org) => (
              <div key={org.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                  {org.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{org.name}</div>
                  <div className="text-xs text-gray-500">
                    {org.therapists} therapists · {org.patients} patients · {org.joined}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-white">
                    {org.mrr > 0 ? `$${org.mrr}/mo` : 'Trial'}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    org.plan === 'Enterprise' ? 'bg-purple-400/20 text-purple-300' :
                    org.plan === 'Pro' ? 'bg-blue-400/20 text-blue-300' :
                    org.status === 'trial' ? 'bg-amber-400/20 text-amber-300' :
                    'bg-green-400/20 text-green-300'
                  }`}>
                    {org.plan}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-semibold text-white">System Health</h3>
            </div>
            <span className="text-xs text-green-400 font-medium">{PLATFORM_STATS.system_uptime}% uptime</span>
          </div>
          <div className="divide-y divide-gray-800">
            {SYSTEM_HEALTH.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={svc.status} />
                  <div>
                    <div className="text-xs font-medium text-white">{svc.name}</div>
                    <div className="text-[10px] text-gray-500">{svc.uptime}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 font-mono">{svc.latency}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* AI Usage Breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-white">AI Model Usage — Today</h3>
            </div>
            <a href="/ai-governance" className="text-xs text-gray-500 hover:text-white transition-colors">
              Details →
            </a>
          </div>
          <div className="p-5 space-y-4">
            {AI_USAGE.map((model) => (
              <div key={model.model}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-white">{model.model}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{model.requests.toLocaleString()} req</span>
                    <span className="text-xs font-semibold text-purple-300">{model.cost}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                    style={{ width: `${model.pct}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="border-t border-gray-800 pt-3 flex justify-between">
              <span className="text-xs text-gray-500">Total today</span>
              <span className="text-xs font-semibold text-white">$341.66</span>
            </div>
          </div>
        </div>

        {/* Platform Alerts */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Platform Alerts</h3>
              <span className="bg-amber-400/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {RECENT_ALERTS.length}
              </span>
            </div>
            <a href="/compliance" className="text-xs text-gray-500 hover:text-white transition-colors">
              View all →
            </a>
          </div>
          <div className="divide-y divide-gray-800">
            {RECENT_ALERTS.map((alert) => (
              <div key={alert.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  alert.severity === 'high' ? 'bg-red-500' :
                  alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white leading-relaxed">{alert.message}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500">{alert.time}</span>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      alert.type === 'compliance' ? 'bg-red-500/20 text-red-300' :
                      alert.type === 'security' ? 'bg-orange-500/20 text-orange-300' :
                      alert.type === 'billing' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>
                      {alert.type}
                    </span>
                  </div>
                </div>
                <button className="text-gray-600 hover:text-gray-400 transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
