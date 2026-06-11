"use client";

import { useState, useEffect } from "react";
import { adminAPI } from "@/lib/api";
import {
  Brain, DollarSign, TrendingUp, TrendingDown, Zap, BarChart3,
  Download, RefreshCw, ArrowUpRight, ArrowDownRight, Clock,
  Building2, Activity, AlertTriangle, ChevronDown
} from "lucide-react";

type CostRange = "7d" | "30d" | "90d" | "12m";

interface ModelCost {
  model: string;
  provider: string;
  use_case: string;
  requests_total: number;
  tokens_in_m: number;
  tokens_out_m: number;
  cost_usd: number;
  cost_per_request: number;
  pct_of_total: number;
  trend: number;
}

interface OrgCost {
  org_name: string;
  seats: number;
  sessions: number;
  ai_cost: number;
  cost_per_seat: number;
  cost_per_session: number;
  trend: number;
  plan: string;
}

const MODEL_COSTS: ModelCost[] = [
  { model: "gpt-4o", provider: "OpenAI", use_case: "Note Generation (Scribe)", requests_total: 14210, tokens_in_m: 312, tokens_out_m: 86, cost_usd: 9360, cost_per_request: 0.659, pct_of_total: 44.2, trend: 8.3 },
  { model: "gpt-4o", provider: "OpenAI", use_case: "AI Copilot (Live)", requests_total: 8940, tokens_in_m: 187, tokens_out_m: 42, cost_usd: 5610, cost_per_request: 0.628, pct_of_total: 26.5, trend: 12.1 },
  { model: "whisper-1", provider: "OpenAI", use_case: "Session Transcription", requests_total: 14210, tokens_in_m: 0, tokens_out_m: 0, cost_usd: 2842, cost_per_request: 0.200, pct_of_total: 13.4, trend: 6.3 },
  { model: "text-embedding-3-small", provider: "OpenAI", use_case: "Memory Embeddings", requests_total: 71050, tokens_in_m: 24, tokens_out_m: 0, cost_usd: 480, cost_per_request: 0.007, pct_of_total: 2.3, trend: 14.8 },
  { model: "gpt-4o-mini", provider: "OpenAI", use_case: "Session Summaries", requests_total: 14210, tokens_in_m: 96, tokens_out_m: 22, cost_usd: 880, cost_per_request: 0.062, pct_of_total: 4.2, trend: -2.1 },
  { model: "gpt-4o", provider: "OpenAI", use_case: "Risk Analysis", requests_total: 4800, tokens_in_m: 48, tokens_out_m: 12, cost_usd: 1440, cost_per_request: 0.300, pct_of_total: 6.8, trend: 18.4 },
  { model: "gpt-4o-mini", provider: "OpenAI", use_case: "Workflow Automation", requests_total: 8200, tokens_in_m: 18, tokens_out_m: 6, cost_usd: 170, cost_per_request: 0.021, pct_of_total: 0.8, trend: 31.2 },
  { model: "claude-3-5-sonnet", provider: "Anthropic", use_case: "Complex Clinical Reasoning", requests_total: 820, tokens_in_m: 22, tokens_out_m: 8, cost_usd: 390, cost_per_request: 0.476, pct_of_total: 1.8, trend: -5.4 },
];

const ORG_COSTS: OrgCost[] = [
  { org_name: "Pacific Mental Health", seats: 28, sessions: 342, ai_cost: 2240, cost_per_seat: 80, cost_per_session: 6.55, trend: 12, plan: "Enterprise" },
  { org_name: "Bay Area Therapy Group", seats: 22, sessions: 278, ai_cost: 1760, cost_per_seat: 80, cost_per_session: 6.33, trend: 8, plan: "Professional" },
  { org_name: "Serenity Practice", seats: 18, sessions: 214, ai_cost: 1440, cost_per_seat: 80, cost_per_session: 6.73, trend: 15, plan: "Professional" },
  { org_name: "Mindful Wellness", seats: 15, sessions: 187, ai_cost: 1200, cost_per_seat: 80, cost_per_session: 6.42, trend: -3, plan: "Professional" },
  { org_name: "Harbor Point Counseling", seats: 12, sessions: 156, ai_cost: 960, cost_per_seat: 80, cost_per_session: 6.15, trend: 22, plan: "Starter" },
  { org_name: "Summit Health Partners", seats: 11, sessions: 143, ai_cost: 880, cost_per_seat: 80, cost_per_session: 6.15, trend: 31, plan: "Professional" },
];

const MONTHLY_AI_SPEND = [14200, 15100, 14800, 16200, 17400, 16900, 18200, 19100, 19800, 20400, 20900, 21172];
const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

export default function AICostsPage() {
  const [range, setRange] = useState<CostRange>("30d");
  const [sortOrg, setSortOrg] = useState<"cost" | "sessions" | "seat_cost">("cost");
  const [liveModelCosts, setLiveModelCosts] = useState(MODEL_COSTS);
  const [liveOrgCosts, setLiveOrgCosts] = useState(ORG_COSTS);

  useEffect(() => {
    adminAPI.analyticsRevenue(range)
      .then((data: any) => {
        if (data?.model_costs?.length > 0) setLiveModelCosts(data.model_costs);
        if (data?.org_costs?.length > 0) setLiveOrgCosts(data.org_costs);
      })
      .catch(() => {/* keep static fallback */});
  }, [range]);

  const totalCost = liveModelCosts.reduce((s, m) => s + m.cost_usd, 0);
  const totalRequests = liveModelCosts.reduce((s, m) => s + m.requests_total, 0);
  const costPerSession = (totalCost / 14210).toFixed(2);

  const sortedOrgs = [...liveOrgCosts].sort((a, b) =>
    sortOrg === "cost" ? b.ai_cost - a.ai_cost :
    sortOrg === "sessions" ? b.sessions - a.sessions :
    b.cost_per_seat - a.cost_per_seat
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-[#2EC4B6]" />
            AI Cost Dashboard
          </h1>
          <p className="text-slate-500 mt-1">OpenAI + Anthropic usage, model costs, and per-organization AI spend</p>
        </div>
        <div className="flex gap-3">
          <select value={range} onChange={e => setRange(e.target.value as CostRange)} className="border border-slate-200 rounded-xl px-4 py-2 text-sm bg-white">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Total AI Spend (Month)", value: `$${totalCost.toLocaleString()}`, change: 12.8, icon: DollarSign, color: "bg-orange-100 text-orange-700" },
          { label: "Total AI Requests", value: totalRequests.toLocaleString(), change: 10.2, icon: Zap, color: "bg-blue-100 text-blue-700" },
          { label: "Cost Per Session", value: `$${costPerSession}`, change: -2.1, icon: Activity, color: "bg-green-100 text-green-700" },
          { label: "OpenAI MoM Increase", value: "+12.8%", change: 12.8, icon: TrendingUp, color: "bg-violet-100 text-violet-700" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const pos = kpi.change >= 0;
          return (
            <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl ${kpi.color} flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${pos ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}{Math.abs(kpi.change)}%
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Spend Trend Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-slate-900">Monthly AI Spend Trend</h3>
            <p className="text-sm text-slate-500 mt-0.5">$14.2K → $21.2K (+49% YoY)</p>
          </div>
          <div className="text-sm text-slate-400">Jul 2025 — Jun 2026</div>
        </div>
        <div className="flex items-end gap-2 h-44">
          {MONTHLY_AI_SPEND.map((v, i) => {
            const max = Math.max(...MONTHLY_AI_SPEND);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-slate-400 font-medium">${Math.round(v / 1000)}K</div>
                <div
                  className="w-full bg-gradient-to-t from-orange-600 to-amber-400 rounded-t-md transition-all hover:from-orange-500 hover:to-amber-300"
                  style={{ height: `${(v / max) * 100}%` }}
                  title={`$${v.toLocaleString()}`}
                />
                <div className="text-xs text-slate-400">{MONTHS[i]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Cost by Model & Use Case</h3>
          <span className="text-sm text-slate-500">Total: ${totalCost.toLocaleString()}/month</span>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="grid grid-cols-12 px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Model</div>
            <div className="col-span-2">Use Case</div>
            <div className="col-span-2 text-right">Requests</div>
            <div className="col-span-2 text-right">Monthly Cost</div>
            <div className="col-span-2">% of Total</div>
            <div className="col-span-1 text-right">Trend</div>
          </div>
          {[...liveModelCosts].sort((a, b) => b.cost_usd - a.cost_usd).map((mc) => (
            <div key={mc.use_case} className="grid grid-cols-12 px-5 py-3.5 hover:bg-slate-50 transition items-center text-sm">
              <div className="col-span-3">
                <div className="font-medium text-slate-900 font-mono">{mc.model}</div>
                <div className="text-xs text-slate-400">{mc.provider}</div>
              </div>
              <div className="col-span-2 text-slate-600 text-xs leading-snug">{mc.use_case}</div>
              <div className="col-span-2 text-right text-slate-700">{mc.requests_total.toLocaleString()}</div>
              <div className="col-span-2 text-right font-semibold text-slate-900">${mc.cost_usd.toLocaleString()}</div>
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 h-1.5 rounded-full">
                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${mc.pct_of_total}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 w-8 text-right">{mc.pct_of_total}%</span>
                </div>
              </div>
              <div className="col-span-1 text-right">
                <span className={`text-xs font-medium flex items-center justify-end gap-0.5 ${mc.trend >= 0 ? "text-red-500" : "text-green-500"}`}>
                  {mc.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(mc.trend)}%
                </span>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-12 px-5 py-4 bg-slate-50 text-sm font-bold items-center">
            <div className="col-span-3 text-slate-900">Total</div>
            <div className="col-span-2"></div>
            <div className="col-span-2 text-right text-slate-700">{totalRequests.toLocaleString()}</div>
            <div className="col-span-2 text-right text-slate-900">${totalCost.toLocaleString()}</div>
            <div className="col-span-2"></div>
            <div className="col-span-1"></div>
          </div>
        </div>
      </div>

      {/* Per-Org AI Costs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">AI Cost by Organization</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <select value={sortOrg} onChange={e => setSortOrg(e.target.value as typeof sortOrg)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white">
              <option value="cost">Total Cost</option>
              <option value="sessions">Sessions</option>
              <option value="seat_cost">Cost/Seat</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {sortedOrgs.map((org, i) => (
            <div key={org.org_name} className="flex items-center gap-5 px-5 py-4 hover:bg-slate-50 transition">
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 flex-shrink-0">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{org.org_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    org.plan === "Enterprise" ? "bg-violet-100 text-violet-700" : org.plan === "Professional" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                  }`}>{org.plan}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{org.seats} seats · {org.sessions} sessions/mo</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-slate-900">${org.ai_cost.toLocaleString()}</div>
                <div className="text-xs text-slate-400">total/mo</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">${org.cost_per_seat}</div>
                <div className="text-xs text-slate-400">per seat</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-slate-700">${org.cost_per_session.toFixed(2)}</div>
                <div className="text-xs text-slate-400">per session</div>
              </div>
              <div>
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${org.trend >= 0 ? "text-orange-600" : "text-green-600"}`}>
                  {org.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(org.trend)}% MoM
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Budget Alerts */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          AI Spend Alerts
        </h3>
        <div className="space-y-2">
          {[
            { msg: "AI Copilot costs up 12.1% MoM — growing faster than session volume. Consider per-request caching.", severity: "warning" },
            { msg: "Risk Analysis model (gpt-4o) running at $0.30/request — opportunity to switch high-volume routes to gpt-4o-mini.", severity: "info" },
            { msg: "Summit Health Partners AI usage up 31% MoM — may need upsell conversation.", severity: "info" },
          ].map((alert, i) => (
            <div key={i} className={`flex items-start gap-2 text-sm p-3 rounded-xl ${alert.severity === "warning" ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
              {alert.severity === "warning" ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {alert.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
