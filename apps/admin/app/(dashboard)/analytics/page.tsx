'use client';

import { useState } from 'react';
import {
  BarChart2, TrendingUp, Users, Brain, Calendar, ArrowUp, ArrowDown,
  Activity, DollarSign, Globe, Star, Clock, Zap, ChevronRight,
  Building2, RefreshCw
} from 'lucide-react';

const GROWTH_DATA = [
  { month: 'Jan', orgs: 180, therapists: 920, patients: 12400, sessions: 22800, mrr: 164000 },
  { month: 'Feb', orgs: 210, therapists: 1080, patients: 14800, sessions: 26400, mrr: 188000 },
  { month: 'Mar', orgs: 238, therapists: 1240, patients: 17200, sessions: 30100, mrr: 208000 },
  { month: 'Apr', orgs: 264, therapists: 1420, patients: 19600, sessions: 33400, mrr: 232000 },
  { month: 'May', orgs: 289, therapists: 1640, patients: 22100, sessions: 36200, mrr: 261000 },
  { month: 'Jun', orgs: 312, therapists: 1847, patients: 24391, sessions: 38940, mrr: 284500 },
];

const PLATFORM_KPIs = [
  { label: 'Monthly Active Organizations', value: 312, change: 8.2, icon: Building2, color: 'text-blue-400' },
  { label: 'Monthly Active Therapists', value: '1,847', change: 12.6, icon: Users, color: 'text-green-400' },
  { label: 'Monthly Active Patients', value: '24,391', change: 15.7, icon: Users, color: 'text-purple-400' },
  { label: 'Sessions This Month', value: '38,940', change: 7.6, icon: Calendar, color: 'text-cyan-400' },
  { label: 'AI Notes Generated', value: '34,200', change: 18.4, icon: Brain, color: 'text-orange-400' },
  { label: 'MRR', value: '$284,500', change: 18.4, icon: DollarSign, color: 'text-green-400' },
  { label: 'NPS Score', value: 72, change: 4.1, icon: Star, color: 'text-amber-400' },
  { label: 'Platform Uptime', value: '99.97%', change: 0.02, icon: Activity, color: 'text-green-400' },
];

const REGIONAL_DATA = [
  { region: 'North America', orgs: 198, therapists: 1120, mrr: 168000, growth: 22 },
  { region: 'Europe', orgs: 72, therapists: 440, mrr: 72000, growth: 35 },
  { region: 'Australia / NZ', orgs: 28, therapists: 184, mrr: 28000, growth: 18 },
  { region: 'Middle East', orgs: 9, therapists: 68, mrr: 11000, growth: 88 },
  { region: 'Asia Pacific', orgs: 5, therapists: 35, mrr: 5500, growth: 120 },
];

const AI_METRICS = [
  { metric: 'SOAP Note Quality Score', value: '4.7/5.0', trend: '+0.2', good: true },
  { metric: 'Avg Note Generation Time', value: '28 sec', trend: '-4 sec', good: true },
  { metric: 'Therapist Acceptance Rate', value: '91.4%', trend: '+2.1%', good: true },
  { metric: 'Memory Retrieval Accuracy', value: '96.2%', trend: '+1.4%', good: true },
  { metric: 'Radar Match Conversion', value: '68.3%', trend: '+5.2%', good: true },
  { metric: 'Crisis Detection Accuracy', value: '94.8%', trend: '+0.8%', good: true },
  { metric: 'AI Cost Per Session', value: '$0.26', trend: '-$0.04', good: true },
  { metric: 'Model Error Rate', value: '0.6%', trend: '-0.2%', good: true },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');
  const [tab, setTab] = useState<'growth' | 'regional' | 'ai' | 'retention'>('growth');

  const current = GROWTH_DATA[GROWTH_DATA.length - 1];
  const prev = GROWTH_DATA[GROWTH_DATA.length - 2];
  const mrrGrowth = (((current.mrr - prev.mrr) / prev.mrr) * 100).toFixed(1);

  const maxMrr = Math.max(...GROWTH_DATA.map(d => d.mrr));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            Platform Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Growth metrics · AI performance · Regional data · Retention
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-lg">
            {['week', 'month', 'quarter', 'year'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-all ${
                  period === p ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 gap-4">
        {PLATFORM_KPIs.map(({ label, value, change, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className={`flex items-center gap-0.5 text-xs font-medium mt-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(change)}%
              <span className="text-gray-600 font-normal ml-1">vs last {period}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
        {[
          { id: 'growth', label: 'Growth Trends', icon: TrendingUp },
          { id: 'regional', label: 'Regional', icon: Globe },
          { id: 'ai', label: 'AI Performance', icon: Brain },
          { id: 'retention', label: 'Retention', icon: Activity },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Growth Trends */}
      {tab === 'growth' && (
        <div className="space-y-4">
          {/* MRR Chart */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-semibold text-white">MRR Growth</h3>
              <div className="flex items-center gap-2">
                <ArrowUp className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-green-400">{mrrGrowth}% this month</span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-32">
              {GROWTH_DATA.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full relative group">
                    <div
                      className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t-md transition-all group-hover:opacity-80"
                      style={{ height: `${(d.mrr / maxMrr) * 128}px` }}
                    />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      ${(d.mrr / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Growth Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Monthly Metrics</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Month', 'Organizations', 'Therapists', 'Patients', 'Sessions', 'MRR'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {[...GROWTH_DATA].reverse().map((d, i) => (
                  <tr key={d.month} className={`hover:bg-gray-800/50 ${i === 0 ? 'bg-gray-800/30' : ''}`}>
                    <td className="px-5 py-3 text-sm font-medium text-white">{d.month} 2024</td>
                    <td className="px-5 py-3 text-sm text-gray-300">{d.orgs}</td>
                    <td className="px-5 py-3 text-sm text-gray-300">{d.therapists.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-300">{d.patients.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm text-gray-300">{d.sessions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-green-300">
                      ${(d.mrr / 1000).toFixed(0)}K
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regional Tab */}
      {tab === 'regional' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Region', 'Organizations', 'Therapists', 'MRR', 'MoM Growth'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {REGIONAL_DATA.map((r) => (
                <tr key={r.region} className="hover:bg-gray-800/50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-white">{r.region}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300">{r.orgs}</td>
                  <td className="px-5 py-4 text-sm text-gray-300">{r.therapists.toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-green-300">
                    ${(r.mrr / 1000).toFixed(0)}K
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <ArrowUp className="w-3 h-3 text-green-400" />
                      <span className="text-sm text-green-400 font-semibold">{r.growth}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Performance Tab */}
      {tab === 'ai' && (
        <div className="grid grid-cols-2 gap-4">
          {AI_METRICS.map(({ metric, value, trend, good }) => (
            <div key={metric} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">{metric}</span>
                <span className={`text-xs font-semibold ${good ? 'text-green-400' : 'text-red-400'}`}>
                  {trend}
                </span>
              </div>
              <div className="text-xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Retention Tab */}
      {tab === 'retention' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Therapist Monthly Retention', value: '94.2%', change: 1.4, period: 'vs 92.8% last month' },
              { label: 'Patient Monthly Retention', value: '88.6%', change: 2.1, period: 'vs 86.5% last month' },
              { label: 'Org Monthly Churn Rate', value: '1.8%', change: -0.4, period: 'vs 2.2% last month (lower is better)' },
            ].map(({ label, value, change, period }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-2">{label}</div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {change >= 0 ? (
                    <ArrowUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-green-400" />
                  )}
                  <span className="text-xs text-green-400 font-medium">{Math.abs(change)}%</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">{period}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Cohort Retention Heatmap (Therapist Cohorts)</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500">Cohort</th>
                    {['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].map(m => (
                      <th key={m} className="px-3 py-2 text-xs text-gray-500 text-center">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cohort: 'Jan 2024', values: [100, 96, 94, 93, 92, 91] },
                    { cohort: 'Feb 2024', values: [100, 97, 95, 94, 93, null] },
                    { cohort: 'Mar 2024', values: [100, 96, 95, 94, null, null] },
                    { cohort: 'Apr 2024', values: [100, 97, 96, null, null, null] },
                    { cohort: 'May 2024', values: [100, 98, null, null, null, null] },
                    { cohort: 'Jun 2024', values: [100, null, null, null, null, null] },
                  ].map(({ cohort, values }) => (
                    <tr key={cohort}>
                      <td className="px-3 py-2 text-xs text-gray-400">{cohort}</td>
                      {values.map((v, i) => (
                        <td key={i} className="px-3 py-2 text-center">
                          {v !== null ? (
                            <div className={`inline-flex items-center justify-center w-14 py-1.5 rounded text-xs font-semibold ${
                              v === 100 ? 'bg-blue-500 text-white' :
                              v >= 95 ? 'bg-green-500/40 text-green-200' :
                              v >= 90 ? 'bg-green-500/25 text-green-300' :
                              'bg-amber-500/20 text-amber-300'
                            }`}>
                              {v}%
                            </div>
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
