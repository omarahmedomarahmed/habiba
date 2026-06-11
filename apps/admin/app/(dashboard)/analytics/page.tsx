"use client";

import { useState, useEffect } from "react";
import { adminAPI } from "@/lib/api";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity, Brain,
  BarChart3, BarChart2, PieChart, Calendar, ArrowUpRight, ArrowDownRight,
  Download, RefreshCw, ChevronDown, Star, Clock, Target, Zap,
  Shield, Building2, CreditCard, AlertTriangle, CheckCircle, Filter
} from "lucide-react";

type DateRange = "7d" | "30d" | "90d" | "ytd" | "12m";
type AnalyticsTab = "revenue" | "clinical" | "ai" | "growth" | "cohorts";

function MetricCard({ title, value, change, changeLabel, icon: Icon, color, prefix = "", suffix = "" }: {
  title: string; value: string | number; change: number; changeLabel: string;
  icon: typeof TrendingUp; color: string; prefix?: string; suffix?: string;
}) {
  const isPositive = change >= 0;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isPositive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}%
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{prefix}{value}{suffix}</div>
      <div className="text-sm text-slate-500 mt-0.5">{title}</div>
      <div className="text-xs text-slate-400 mt-1">{changeLabel}</div>
    </div>
  );
}

function SimpleBar({ label, value, max, color = "bg-[#2EC4B6]" }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 text-xs text-slate-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <div className="w-10 text-xs text-slate-700 text-right font-medium">{value.toLocaleString()}</div>
    </div>
  );
}

function MiniSpark({ data, color = "#2EC4B6" }: { data: number[]; color?: string }) {
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

const MRR_DATA = [68, 72, 75, 71, 78, 82, 88, 91, 94, 98, 103, 109];
const SESSION_DATA = [1240, 1310, 1290, 1380, 1420, 1390, 1480, 1510, 1550, 1620, 1680, 1740];
const PATIENT_DATA = [2800, 2950, 3100, 3020, 3200, 3380, 3510, 3640, 3790, 3920, 4050, 4210];
const AI_DATA = [890, 960, 1020, 1100, 1180, 1240, 1310, 1390, 1460, 1540, 1620, 1710];

const TOP_ORGS = [
  { name: "Pacific Mental Health", seats: 28, mrr: 3625, sessions: 342, growth: 18 },
  { name: "Bay Area Therapy Group", seats: 22, mrr: 2849, sessions: 278, growth: 12 },
  { name: "Serenity Practice Network", seats: 18, mrr: 2331, sessions: 214, growth: 9 },
  { name: "Mindful Wellness Clinic", seats: 15, mrr: 1943, sessions: 187, growth: 22 },
  { name: "Harbor Point Counseling", seats: 12, mrr: 1554, sessions: 156, growth: 6 },
  { name: "Summit Health Partners", seats: 11, mrr: 1424, sessions: 143, growth: 31 },
  { name: "Clarity Therapy Collective", seats: 9, mrr: 1166, sessions: 114, growth: 14 },
];

const PLAN_DIST = [
  { plan: "Enterprise", count: 8, mrr_pct: 38, color: "bg-violet-500" },
  { plan: "Professional", count: 47, mrr_pct: 45, color: "bg-blue-500" },
  { plan: "Starter", count: 83, mrr_pct: 14, color: "bg-teal-500" },
  { plan: "Trial", count: 24, mrr_pct: 3, color: "bg-slate-300" },
];

const CLINICAL_METRICS = [
  { label: "Avg PHQ-9 Improvement", value: "-5.8 pts", sub: "12-week treatment", change: "+0.4 pts vs last Q", trend: "up" },
  { label: "Treatment Completion Rate", value: "74%", sub: "12+ sessions", change: "+3% vs last Q", trend: "up" },
  { label: "No-Show Rate", value: "8.2%", sub: "platform avg", change: "-1.4% vs last Q", trend: "up" },
  { label: "Crisis Interventions", value: "34", sub: "this month", change: "-12% vs last month", trend: "up" },
  { label: "Avg Session Duration", value: "51 min", sub: "platform avg", change: "+2 min vs last Q", trend: "neutral" },
  { label: "Patient Satisfaction", value: "4.8/5", sub: "post-session surveys", change: "+0.1 vs last Q", trend: "up" },
];

const AI_COSTS = [
  { model: "GPT-4o (Scribe)", sessions: 14210, tokens_m: 312, cost: 9360, avg_per_session: 0.66 },
  { model: "Whisper (Transcription)", sessions: 14210, tokens_m: 0, cost: 2842, avg_per_session: 0.20 },
  { model: "GPT-4o (Copilot)", sessions: 8940, tokens_m: 187, cost: 5610, avg_per_session: 0.63 },
  { model: "GPT-4o (Memory)", sessions: 14210, tokens_m: 96, cost: 2880, avg_per_session: 0.20 },
  { model: "Embeddings", sessions: 14210, tokens_m: 24, cost: 480, avg_per_session: 0.03 },
];

export default function AdminAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [tab, setTab] = useState<AnalyticsTab>("revenue");
  const [liveStats, setLiveStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    adminAPI.analyticsOverview(dateRange)
      .then((data: any) => setLiveStats(data))
      .catch(() => {/* keep static fallback */});
  }, [dateRange]);

  const tabs: { id: AnalyticsTab; label: string; icon: typeof BarChart3 }[] = [
    { id: "revenue", label: "Revenue & Growth", icon: DollarSign },
    { id: "clinical", label: "Clinical Outcomes", icon: Activity },
    { id: "ai", label: "AI Performance", icon: Brain },
    { id: "growth", label: "Customer Growth", icon: TrendingUp },
    { id: "cohorts", label: "Cohort Analysis", icon: PieChart },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
          <p className="text-slate-500 mt-1">Business intelligence, clinical outcomes, and AI performance</p>
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
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Monthly Recurring Revenue" value="109,240" change={12.4} changeLabel="vs last month" icon={DollarSign} color="bg-green-100 text-green-700" prefix="$" />
        <MetricCard title="Annual Run Rate" value="1.31M" change={18.2} changeLabel="vs last year" icon={TrendingUp} color="bg-blue-100 text-blue-700" prefix="$" />
        <MetricCard title="Active Therapist Seats" value="4,847" change={8.7} changeLabel="vs last month" icon={Users} color="bg-violet-100 text-violet-700" />
        <MetricCard title="Sessions This Month" value="14,210" change={6.3} changeLabel="vs last month" icon={Activity} color="bg-teal-100 text-teal-700" />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard title="Net Revenue Churn" value="1.8" change={-0.3} changeLabel="ppts vs last month" icon={TrendingDown} color="bg-orange-100 text-orange-700" suffix="%" />
        <MetricCard title="New Organizations" value="12" change={33} changeLabel="vs last month" icon={Building2} color="bg-cyan-100 text-cyan-700" />
        <MetricCard title="AI Notes Generated" value="11,240" change={14.2} changeLabel="vs last month" icon={Brain} color="bg-pink-100 text-pink-700" />
        <MetricCard title="Avg Revenue Per Seat" value="22.54" change={3.4} changeLabel="vs last month" icon={CreditCard} color="bg-amber-100 text-amber-700" prefix="$" />
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

      {/* Revenue & Growth Tab */}
      {tab === "revenue" && (
        <div className="space-y-6">
          {/* MRR Chart */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-900">Monthly Recurring Revenue (12 months)</h3>
                <p className="text-sm text-slate-500 mt-0.5">$68K → $109K (+60.3% YoY)</p>
              </div>
              <MiniSpark data={MRR_DATA} color="#2EC4B6" />
            </div>
            <div className="flex items-end gap-1.5 h-40">
              {MRR_DATA.map((v, i) => {
                const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
                const max = Math.max(...MRR_DATA);
                const h = Math.round((v / max) * 100);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-slate-400 font-medium">${v}K</div>
                    <div
                      className="w-full bg-gradient-to-t from-[#0A2342] to-[#2EC4B6] rounded-t-md transition-all"
                      style={{ height: `${h}%`, maxHeight: "100%" }}
                    />
                    <div className="text-xs text-slate-400">{months[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan Distribution & Top Orgs */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Plan Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-5">Revenue by Plan</h3>
              <div className="space-y-4">
                {PLAN_DIST.map((p) => (
                  <div key={p.plan}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-sm ${p.color}`} />
                        <span className="font-medium text-slate-700">{p.plan}</span>
                        <span className="text-slate-400">({p.count} orgs)</span>
                      </div>
                      <span className="font-semibold text-slate-900">{p.mrr_pct}% of MRR</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full">
                      <div className={`${p.color} h-2 rounded-full`} style={{ width: `${p.mrr_pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center text-sm">
                <div>
                  <div className="text-xl font-bold text-slate-900">162</div>
                  <div className="text-slate-400">Total Organizations</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-slate-900">$10,220</div>
                  <div className="text-slate-400">Avg Contract Value</div>
                </div>
              </div>
            </div>

            {/* Top Organizations */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-5">Top Organizations by MRR</h3>
              <div className="space-y-3">
                {TOP_ORGS.map((org, i) => (
                  <div key={org.name} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{org.name}</div>
                      <div className="text-xs text-slate-400">{org.seats} seats · {org.sessions} sessions/mo</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900">${org.mrr.toLocaleString()}</div>
                      <div className="text-xs text-green-600">+{org.growth}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Churn & Expansion */}
          <div className="grid grid-cols-3 gap-5">
            {[
              { label: "New MRR", value: "$12,840", sub: "12 new orgs", color: "text-green-600 bg-green-50", icon: TrendingUp },
              { label: "Expansion MRR", value: "$4,210", sub: "seat upgrades + plan upgrades", color: "text-blue-600 bg-blue-50", icon: ArrowUpRight },
              { label: "Churned MRR", value: "$1,960", sub: "2 orgs churned", color: "text-red-600 bg-red-50", icon: TrendingDown },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">{item.value}</div>
                  <div className="text-sm font-medium text-slate-700">{item.label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clinical Outcomes Tab */}
      {tab === "clinical" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
            {CLINICAL_METRICS.map((m) => (
              <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-5">
                <div className="text-2xl font-bold text-slate-900 mb-1">{m.value}</div>
                <div className="text-sm font-medium text-slate-700">{m.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{m.sub}</div>
                <div className={`text-xs font-medium mt-2 ${m.trend === "up" ? "text-green-600" : "text-slate-400"}`}>
                  {m.trend === "up" ? "↑" : "→"} {m.change}
                </div>
              </div>
            ))}
          </div>

          {/* PHQ-9 Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5">PHQ-9 Score Distribution (Active Patients)</h3>
            <div className="space-y-2">
              {[
                { label: "Minimal (0-4)", value: 1240, total: 4210, color: "bg-green-400" },
                { label: "Mild (5-9)", value: 1480, total: 4210, color: "bg-yellow-400" },
                { label: "Moderate (10-14)", value: 890, total: 4210, color: "bg-orange-400" },
                { label: "Mod-Severe (15-19)", value: 420, total: 4210, color: "bg-red-400" },
                { label: "Severe (20-27)", value: 180, total: 4210, color: "bg-red-700" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-slate-600">{item.label}</div>
                  <div className="flex-1 bg-slate-100 h-3 rounded-full">
                    <div className={`${item.color} h-3 rounded-full`} style={{ width: `${(item.value / item.total) * 100}%` }} />
                  </div>
                  <div className="w-16 text-xs text-right text-slate-700 font-medium">
                    {item.value.toLocaleString()} ({Math.round((item.value / item.total) * 100)}%)
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions trend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5">Sessions by Month (12 months)</h3>
            <div className="flex items-end gap-2 h-36">
              {SESSION_DATA.map((v, i) => {
                const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-sm"
                      style={{ height: `${(v / Math.max(...SESSION_DATA)) * 100}%` }}
                    />
                    <div className="text-xs text-slate-400">{months[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI Performance Tab */}
      {tab === "ai" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: "AI Notes Generated", value: "11,240", icon: Brain, color: "text-violet-600 bg-violet-50" },
              { label: "Avg Generation Time", value: "38s", icon: Clock, color: "text-blue-600 bg-blue-50" },
              { label: "Human Review Rate", value: "94%", icon: CheckCircle, color: "text-green-600 bg-green-50" },
              { label: "Total AI Cost (month)", value: "$21,172", icon: DollarSign, color: "text-orange-600 bg-orange-50" },
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

          {/* AI Cost Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">AI Cost Breakdown by Model</h3>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-5 px-6 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-2">Model / Use Case</div>
                <div>Sessions</div>
                <div>Monthly Cost</div>
                <div>Cost per Session</div>
              </div>
              {AI_COSTS.map((row) => (
                <div key={row.model} className="grid grid-cols-5 px-6 py-4 hover:bg-slate-50 transition items-center text-sm">
                  <div className="col-span-2 font-medium text-slate-900">{row.model}</div>
                  <div className="text-slate-600">{row.sessions.toLocaleString()}</div>
                  <div className="text-slate-900 font-semibold">${row.cost.toLocaleString()}</div>
                  <div className="text-slate-600">${row.avg_per_session.toFixed(2)}</div>
                </div>
              ))}
              <div className="grid grid-cols-5 px-6 py-4 bg-slate-50 text-sm font-bold">
                <div className="col-span-2 text-slate-900">Total</div>
                <div className="text-slate-700">{AI_COSTS[0].sessions.toLocaleString()}</div>
                <div className="text-slate-900">${AI_COSTS.reduce((s, r) => s + r.cost, 0).toLocaleString()}</div>
                <div className="text-slate-700">${(AI_COSTS.reduce((s, r) => s + r.cost, 0) / AI_COSTS[0].sessions).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* AI adoption by module */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5">AI Feature Adoption Rate</h3>
            <div className="space-y-3">
              {[
                { label: "AI Scribe (Note Generation)", pct: 92 },
                { label: "Session Transcription", pct: 88 },
                { label: "AI Copilot (Live)", pct: 61 },
                { label: "Memory Layer", pct: 54 },
                { label: "Risk Monitoring", pct: 79 },
                { label: "Session Prep Summary", pct: 71 },
              ].map((item) => (
                <SimpleBar key={item.label} label={item.label} value={item.pct} max={100} color={item.pct >= 80 ? "bg-green-500" : item.pct >= 60 ? "bg-blue-500" : "bg-amber-400"} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Growth Tab */}
      {tab === "growth" && (
        <div className="space-y-6">
          {/* Sign-ups over time */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5">Patient Growth (12 months)</h3>
            <div className="flex items-end gap-2 h-36">
              {PATIENT_DATA.map((v, i) => {
                const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-[#0A2342] to-[#2EC4B6] rounded-t-sm"
                      style={{ height: `${(v / Math.max(...PATIENT_DATA)) * 100}%` }}
                    />
                    <div className="text-xs text-slate-400">{months[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Acquisition channels */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-5">New Org Acquisition Channels</h3>
              <div className="space-y-3">
                {[
                  { label: "Organic / SEO", count: 34, pct: 42 },
                  { label: "Referral", count: 22, pct: 27 },
                  { label: "Paid Search (Google)", count: 12, pct: 15 },
                  { label: "Conference / Events", count: 8, pct: 10 },
                  { label: "Partnership", count: 5, pct: 6 },
                ].map((ch) => (
                  <div key={ch.label} className="flex items-center gap-3">
                    <div className="w-32 text-xs text-slate-600 truncate">{ch.label}</div>
                    <div className="flex-1 bg-slate-100 h-2 rounded-full">
                      <div className="bg-[#1F5EFF] h-2 rounded-full" style={{ width: `${ch.pct}%` }} />
                    </div>
                    <div className="w-12 text-xs text-right text-slate-700">{ch.count} ({ch.pct}%)</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-5">Funnel Conversion</h3>
              <div className="space-y-3">
                {[
                  { stage: "Website Visitors", count: "24,800", pct: 100, color: "bg-slate-300" },
                  { stage: "Demo Requests", count: "496", pct: 2, color: "bg-blue-300" },
                  { stage: "Demo Completed", count: "372", pct: 75, color: "bg-blue-400" },
                  { stage: "Trial Started", count: "248", pct: 67, color: "bg-teal-400" },
                  { stage: "Converted to Paid", count: "124", pct: 50, color: "bg-green-500" },
                ].map((s) => (
                  <div key={s.stage} className="flex items-center justify-between gap-3">
                    <div className="w-32 text-xs text-slate-600">{s.stage}</div>
                    <div className="flex-1 bg-slate-100 h-3 rounded-full">
                      <div className={`${s.color} h-3 rounded-full`} style={{ width: `${s.pct}%` }} />
                    </div>
                    <div className="text-xs text-slate-700 font-medium w-10 text-right">{s.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cohorts Tab */}
      {tab === "cohorts" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Organization Cohort Retention (by signup month)</h3>
              <p className="text-sm text-slate-500 mt-0.5">% of organizations still active N months after signup</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-500 font-semibold uppercase tracking-wider">Cohort</th>
                    {[1, 2, 3, 4, 5, 6, 9, 12].map(m => (
                      <th key={m} className="px-3 py-3 text-center text-slate-500 font-semibold uppercase tracking-wider">M{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { cohort: "Jan 2026", orgs: 18, ret: [100, 94, 89, 83, 78, 72, null, null] },
                    { cohort: "Oct 2025", orgs: 22, ret: [100, 96, 91, 87, 82, 79, 71, null] },
                    { cohort: "Jul 2025", orgs: 28, ret: [100, 93, 88, 84, 79, 75, 68, 62] },
                    { cohort: "Apr 2025", orgs: 24, ret: [100, 95, 90, 85, 81, 77, 70, 64] },
                    { cohort: "Jan 2025", orgs: 31, ret: [100, 92, 87, 82, 77, 73, 67, 61] },
                  ].map((row) => (
                    <tr key={row.cohort} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.cohort} <span className="text-slate-400">({row.orgs})</span>
                      </td>
                      {row.ret.map((r, i) => (
                        <td key={i} className="px-3 py-3 text-center">
                          {r !== null ? (
                            <span className={`font-medium ${r >= 90 ? "text-green-600" : r >= 75 ? "text-blue-600" : r >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {r}%
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5">Time to Value (Days to First AI Note)</h3>
            <div className="space-y-2">
              {[
                { label: "< 1 day", count: 42, pct: 26 },
                { label: "1-3 days", count: 67, pct: 41 },
                { label: "3-7 days", count: 35, pct: 22 },
                { label: "7-14 days", count: 12, pct: 7 },
                { label: "> 14 days", count: 6, pct: 4 },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-slate-600">{item.label}</div>
                  <div className="flex-1 bg-slate-100 h-2.5 rounded-full">
                    <div className="bg-gradient-to-r from-[#0A2342] to-[#2EC4B6] h-2.5 rounded-full" style={{ width: `${item.pct}%` }} />
                  </div>
                  <div className="text-xs text-slate-700 w-20 text-right">{item.count} orgs ({item.pct}%)</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
