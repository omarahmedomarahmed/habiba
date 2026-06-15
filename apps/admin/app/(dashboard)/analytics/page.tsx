"use client";

import { useState, useEffect } from "react";
import { adminAPI } from "@/lib/api";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity, Brain,
  BarChart3, PieChart, Calendar, ArrowUpRight, ArrowDownRight,
  Download, RefreshCw, Building2, CreditCard, CheckCircle, Clock,
  AlertCircle, Loader2
} from "lucide-react";

type DateRange = "7d" | "30d" | "90d" | "ytd" | "12m";
type AnalyticsTab = "overview" | "sessions" | "ai" | "growth";

function MetricCard({ title, value, change, changeLabel, icon: Icon, color, prefix = "", suffix = "" }: {
  title: string; value: string | number; change?: number; changeLabel?: string;
  icon: typeof TrendingUp; color: string; prefix?: string; suffix?: string;
}) {
  const isPositive = (change ?? 0) >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-900">{prefix}{value}{suffix}</div>
      <div className="text-sm text-slate-500 mt-0.5">{title}</div>
      {changeLabel && <div className="text-xs text-slate-400 mt-1">{changeLabel}</div>}
    </div>
  );
}

function SimpleBar({ label, value, max, color = "bg-[#2EC4B6]" }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 text-xs text-slate-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <div className="w-10 text-xs text-slate-700 text-right font-medium">{value.toLocaleString()}</div>
    </div>
  );
}

function EmptyChart({ message = "No data available for this period" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 text-slate-400">
      <BarChart3 className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function SparkLine({ data, color = "#2EC4B6" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return <div className="w-20 h-8" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PlatformData {
  period: string;
  generated_at: string;
  organizations: Record<string, number>;
  users: Record<string, number>;
  sessions: Record<string, number>;
  revenue: Record<string, number>;
  ai: Record<string, number>;
  growth: Array<{ date: string; sessions: number; new_users: number; revenue: number }>;
}

export default function AdminAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    adminAPI.analyticsOverview(dateRange)
      .then((res: any) => {
        // Handle both direct data and wrapped { data: ... } response shapes
        const d = res?.data ?? res;
        setData(d);
        setLastUpdated(new Date().toLocaleTimeString());
        setLoading(false);
      })
      .catch((err: any) => {
        setError("Could not load analytics data. Check API connectivity.");
        setLoading(false);
      });
  };

  useEffect(() => { loadData(); }, [dateRange]);

  const tabs: { id: AnalyticsTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "sessions", label: "Sessions", icon: Activity },
    { id: "ai", label: "AI Performance", icon: Brain },
    { id: "growth", label: "Growth Trends", icon: TrendingUp },
  ];

  const org = data?.organizations ?? {};
  const users = data?.users ?? {};
  const sessions = data?.sessions ?? {};
  const revenue = data?.revenue ?? {};
  const ai = data?.ai ?? {};
  const growth = data?.growth ?? [];

  const sessionData = growth.map((g) => g.sessions);
  const userGrowthData = growth.map((g) => g.new_users);
  const revenueData = growth.map((g) => Number(g.revenue ?? 0));

  const fmt = (n: number | undefined, decimals = 0) =>
    n != null ? n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "0";
  const fmtUsd = (n: number | undefined) =>
    n != null ? `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
          <p className="text-slate-500 mt-1">
            Live business intelligence from the database
            {lastUpdated && <span className="ml-2 text-xs text-slate-400">· Updated {lastUpdated}</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="ytd">Year to date</option>
            <option value="12m">Last 12 months</option>
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-slate-100 mb-4" />
              <div className="h-7 bg-slate-100 rounded-lg mb-2 w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards — always shown once data loaded */}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              title="Total Organizations"
              value={fmt(org.total_orgs)}
              icon={Building2}
              color="bg-blue-100 text-blue-700"
            />
            <MetricCard
              title="Active Therapists"
              value={fmt(users.total_therapists)}
              icon={Users}
              color="bg-violet-100 text-violet-700"
            />
            <MetricCard
              title="Total Patients"
              value={fmt(users.total_patients)}
              icon={Users}
              color="bg-teal-100 text-teal-700"
            />
            <MetricCard
              title="Sessions (period)"
              value={fmt(sessions.new_sessions)}
              icon={Activity}
              color="bg-green-100 text-green-700"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <MetricCard
              title="Revenue (period)"
              value={fmtUsd(revenue.revenue_period)}
              icon={DollarSign}
              color="bg-amber-100 text-amber-700"
            />
            <MetricCard
              title="AI Notes Generated"
              value={fmt(ai.soap_notes_generated)}
              icon={Brain}
              color="bg-pink-100 text-pink-700"
            />
            <MetricCard
              title="AI Cost (period)"
              value={`$${fmt(ai.total_ai_cost, 2)}`}
              icon={CreditCard}
              color="bg-orange-100 text-orange-700"
            />
            <MetricCard
              title="Completed Sessions"
              value={fmt(sessions.completed_sessions)}
              icon={CheckCircle}
              color="bg-cyan-100 text-cyan-700"
            />
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-200 pb-0 overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap -mb-px ${
                    tab === t.id
                      ? "border-[#0A2342] text-[#0A2342]"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Overview Tab */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Organization breakdown */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-900 mb-5">Organization Status</h3>
                  <div className="space-y-2">
                    <SimpleBar label="Active" value={org.active_orgs ?? 0} max={org.total_orgs || 1} color="bg-green-500" />
                    <SimpleBar label="Trialing" value={org.trialing_orgs ?? 0} max={org.total_orgs || 1} color="bg-amber-400" />
                    <SimpleBar label="Enterprise" value={org.enterprise_orgs ?? 0} max={org.total_orgs || 1} color="bg-violet-500" />
                    <SimpleBar label="Professional" value={org.professional_orgs ?? 0} max={org.total_orgs || 1} color="bg-blue-500" />
                    <SimpleBar label="Starter" value={org.starter_orgs ?? 0} max={org.total_orgs || 1} color="bg-teal-500" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <div className="text-xl font-bold text-slate-900">{fmt(org.total_orgs)}</div>
                      <div className="text-slate-400">Total Organizations</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-slate-900">{fmt(org.new_orgs)}</div>
                      <div className="text-slate-400">New this period</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-bold text-slate-900 mb-5">User Breakdown</h3>
                  <div className="space-y-2">
                    <SimpleBar label="Therapists" value={users.total_therapists ?? 0} max={users.total_users || 1} color="bg-violet-500" />
                    <SimpleBar label="Patients" value={users.total_patients ?? 0} max={users.total_users || 1} color="bg-teal-500" />
                    <SimpleBar label="Admins" value={users.total_admins ?? 0} max={users.total_users || 1} color="bg-blue-500" />
                    <SimpleBar label="Active (period)" value={users.active_users ?? 0} max={users.total_users || 1} color="bg-green-500" />
                    <SimpleBar label="Email Verified" value={users.verified_users ?? 0} max={users.total_users || 1} color="bg-amber-400" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <div className="text-xl font-bold text-slate-900">{fmt(users.total_users)}</div>
                      <div className="text-slate-400">Total Users</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-slate-900">{fmt(users.new_users)}</div>
                      <div className="text-slate-400">New this period</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue summary */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-5">Revenue Summary</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: "Period Revenue", value: fmtUsd(revenue.revenue_period) },
                    { label: "Lifetime Revenue", value: fmtUsd(revenue.revenue_total) },
                    { label: "Avg Transaction", value: fmtUsd(revenue.avg_transaction) },
                    { label: "Transactions", value: fmt(revenue.transactions_period) },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <div className="text-2xl font-bold text-slate-900">{m.value}</div>
                      <div className="text-sm text-slate-500 mt-1">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sessions Tab */}
          {tab === "sessions" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: "Total Sessions", value: fmt(sessions.total_sessions) },
                  { label: "Completed (period)", value: fmt(sessions.completed_sessions) },
                  { label: "No-shows", value: fmt(sessions.no_shows) },
                  { label: "Avg Duration", value: sessions.avg_duration_minutes ? `${fmt(sessions.avg_duration_minutes)} min` : "—" },
                ].map((m) => (
                  <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-5">
                    <div className="text-2xl font-bold text-slate-900">{m.value}</div>
                    <div className="text-sm text-slate-500 mt-1">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-5">Sessions Over Time</h3>
                {sessionData.length > 0 && sessionData.some((v) => v > 0) ? (
                  <div className="flex items-end gap-1.5 h-36">
                    {sessionData.slice(-30).map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm"
                          style={{ height: `${(v / (Math.max(...sessionData) || 1)) * 100}%`, minHeight: v > 0 ? "2px" : undefined }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyChart message="No session data recorded yet for this period" />
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-3">AI Scribe Usage</h3>
                <p className="text-sm text-slate-500 mb-4">Sessions with AI scribe enabled</p>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-slate-900">{fmt(sessions.scribe_sessions)}</div>
                  <div className="text-slate-400">of {fmt(sessions.new_sessions)} sessions this period</div>
                  {sessions.new_sessions > 0 && (
                    <div className="ml-auto text-lg font-bold text-teal-600">
                      {Math.round(((sessions.scribe_sessions ?? 0) / sessions.new_sessions) * 100)}% adoption
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Tab */}
          {tab === "ai" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: "Total AI Calls", value: fmt(ai.total_ai_calls), icon: Brain, color: "text-violet-600 bg-violet-50" },
                  { label: "Avg Latency", value: ai.avg_latency_ms ? `${Math.round(ai.avg_latency_ms)}ms` : "—", icon: Clock, color: "text-blue-600 bg-blue-50" },
                  { label: "AI Errors", value: fmt(ai.ai_errors), icon: AlertCircle, color: "text-red-600 bg-red-50" },
                  { label: "Total Tokens", value: fmt(ai.total_tokens), icon: CreditCard, color: "text-orange-600 bg-orange-50" },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center mb-3`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="text-2xl font-bold text-slate-900">{m.value}</div>
                      <div className="text-sm text-slate-500">{m.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-5">AI Task Breakdown</h3>
                <div className="space-y-3">
                  <SimpleBar label="SOAP Notes" value={ai.soap_notes_generated ?? 0} max={ai.total_ai_calls || 1} color="bg-violet-500" />
                  <SimpleBar label="Risk Assessments" value={ai.risk_assessments ?? 0} max={ai.total_ai_calls || 1} color="bg-red-400" />
                  <SimpleBar label="Memory Extractions" value={ai.memory_extractions ?? 0} max={ai.total_ai_calls || 1} color="bg-teal-500" />
                </div>
                {(ai.total_ai_calls ?? 0) === 0 && (
                  <p className="text-sm text-slate-400 mt-4">No AI calls recorded yet for this period.</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-3">AI Cost (period)</h3>
                <div className="text-4xl font-bold text-slate-900">${fmt(ai.total_ai_cost, 4)}</div>
                <p className="text-sm text-slate-500 mt-1">
                  {ai.total_ai_calls && ai.total_ai_calls > 0
                    ? `$${((ai.total_ai_cost ?? 0) / ai.total_ai_calls).toFixed(4)} per AI call average`
                    : "No AI calls in this period"}
                </p>
              </div>
            </div>
          )}

          {/* Growth Tab */}
          {tab === "growth" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-slate-900">New Users Over Time</h3>
                  <SparkLine data={userGrowthData} color="#2EC4B6" />
                </div>
                {userGrowthData.some((v) => v > 0) ? (
                  <div className="flex items-end gap-1.5 h-36">
                    {userGrowthData.map((v, i) => (
                      <div key={i} className="flex-1">
                        <div
                          className="w-full bg-gradient-to-t from-[#0A2342] to-[#2EC4B6] rounded-t-sm"
                          style={{ height: `${(v / (Math.max(...userGrowthData) || 1)) * 100}%`, minHeight: v > 0 ? "2px" : undefined }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyChart message="No user growth data yet — will populate as users register" />
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-slate-900">Revenue Trend</h3>
                  <SparkLine data={revenueData} color="#22c55e" />
                </div>
                {revenueData.some((v) => v > 0) ? (
                  <div className="flex items-end gap-1.5 h-36">
                    {revenueData.map((v, i) => (
                      <div key={i} className="flex-1">
                        <div
                          className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-sm"
                          style={{ height: `${(v / (Math.max(...revenueData) || 1)) * 100}%`, minHeight: v > 0 ? "2px" : undefined }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyChart message="No revenue data yet — will populate as payments are processed" />
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold text-slate-900 mb-3">Period Summary</h3>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fmt(org.new_orgs)}</div>
                    <div className="text-sm text-slate-500">New Organizations</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fmt(users.new_users)}</div>
                    <div className="text-sm text-slate-500">New Users</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{fmt(sessions.new_sessions)}</div>
                    <div className="text-sm text-slate-500">New Sessions</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
