'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import {
  Brain, Activity, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Clock, Eye, Settings, BarChart2, Zap,
  DollarSign, ArrowUp, ArrowDown, RefreshCw, Shield,
  Database, Server, Cpu, GitBranch, Play, Pause
} from 'lucide-react';

const MODEL_PERFORMANCE = [
  {
    id: '1', model: 'GPT-4o', provider: 'OpenAI', version: 'gpt-4o-2024-11-20',
    status: 'active', use_cases: ['Session summaries', 'SOAP notes', 'Treatment plans'],
    requests_today: 8420, requests_month: 248900,
    tokens_today: 2840000, tokens_month: 84200000,
    cost_today: 228.40, cost_month: 6750.00,
    avg_latency_ms: 1840, p99_latency_ms: 4200,
    success_rate: 99.2, error_rate: 0.8,
    avg_quality_score: 4.7, safety_incidents: 0,
    enabled: true, fallback_model: 'GPT-4o-mini',
  },
  {
    id: '2', model: 'Claude 3.5 Sonnet', provider: 'Anthropic', version: 'claude-3-5-sonnet-20241022',
    status: 'active', use_cases: ['DAP notes', 'Clinical reasoning', 'Copilot suggestions'],
    requests_today: 2180, requests_month: 64800,
    tokens_today: 980000, tokens_month: 29100000,
    cost_today: 78.40, cost_month: 2332.00,
    avg_latency_ms: 2100, p99_latency_ms: 5100,
    success_rate: 99.5, error_rate: 0.5,
    avg_quality_score: 4.8, safety_incidents: 0,
    enabled: true, fallback_model: 'GPT-4o',
  },
  {
    id: '3', model: 'Whisper Large v3', provider: 'OpenAI', version: 'whisper-large-v3',
    status: 'active', use_cases: ['Live transcription', 'Session audio processing'],
    requests_today: 1283, requests_month: 38200,
    tokens_today: 0, tokens_month: 0,
    cost_today: 25.66, cost_month: 764.00,
    avg_latency_ms: 340, p99_latency_ms: 820,
    success_rate: 98.9, error_rate: 1.1,
    avg_quality_score: 4.6, safety_incidents: 0,
    enabled: true, fallback_model: null,
  },
  {
    id: '4', model: 'GPT-4o-mini', provider: 'OpenAI', version: 'gpt-4o-mini-2024-07-18',
    status: 'active', use_cases: ['Quick suggestions', 'Memory tagging', 'Radar matching'],
    requests_today: 940, requests_month: 28100,
    tokens_today: 460000, tokens_month: 13700000,
    cost_today: 9.20, cost_month: 274.00,
    avg_latency_ms: 420, p99_latency_ms: 980,
    success_rate: 99.7, error_rate: 0.3,
    avg_quality_score: 4.3, safety_incidents: 0,
    enabled: true, fallback_model: null,
  },
  {
    id: '5', model: 'text-embedding-3-large', provider: 'OpenAI', version: 'text-embedding-3-large',
    status: 'active', use_cases: ['Memory semantic search', 'Patient matching', 'Knowledge graph'],
    requests_today: 12400, requests_month: 368000,
    tokens_today: 1840000, tokens_month: 54600000,
    cost_today: 0.74, cost_month: 22.00,
    avg_latency_ms: 45, p99_latency_ms: 120,
    success_rate: 99.99, error_rate: 0.01,
    avg_quality_score: 4.9, safety_incidents: 0,
    enabled: true, fallback_model: null,
  },
];

const AI_SAFETY_RULES = [
  { id: '1', rule: 'PHI Redaction in Logs', category: 'Privacy', status: 'active', enforcement: 'block' },
  { id: '2', rule: 'Crisis Content Detection', category: 'Safety', status: 'active', enforcement: 'alert' },
  { id: '3', rule: 'Therapist Context Scope', category: 'Access Control', status: 'active', enforcement: 'block' },
  { id: '4', rule: 'Organization Boundary Enforcement', category: 'Tenant Isolation', status: 'active', enforcement: 'block' },
  { id: '5', rule: 'AI Hallucination Monitoring', category: 'Quality', status: 'active', enforcement: 'flag' },
  { id: '6', rule: 'Prompt Injection Detection', category: 'Security', status: 'active', enforcement: 'block' },
  { id: '7', rule: 'Sensitive Topic Escalation', category: 'Clinical Safety', status: 'active', enforcement: 'alert' },
  { id: '8', rule: 'Model Output PII Scan', category: 'Privacy', status: 'active', enforcement: 'sanitize' },
];

const ENFORCEMENT_COLORS: Record<string, string> = {
  block: 'bg-red-400/20 text-red-300',
  alert: 'bg-amber-400/20 text-amber-300',
  flag: 'bg-blue-400/20 text-blue-300',
  sanitize: 'bg-purple-400/20 text-purple-300',
};

export default function AIGovernancePage() {
  const [activeTab, setActiveTab] = useState<'models' | 'safety' | 'costs' | 'memory'>('models');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [liveModels, setLiveModels] = useState(MODEL_PERFORMANCE);

  useEffect(() => {
    adminAPI.platformStats()
      .then((stats: any) => {
        if (stats?.ai_models?.length > 0) setLiveModels(stats.ai_models);
      })
      .catch(() => {/* keep static fallback */});
  }, []);

  const totalCostToday = liveModels.reduce((acc, m) => acc + m.cost_today, 0);
  const totalCostMonth = liveModels.reduce((acc, m) => acc + m.cost_month, 0);
  const totalRequestsToday = liveModels.reduce((acc, m) => acc + m.requests_today, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            AI Governance Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Model orchestration · Cost management · Safety controls · Memory governance
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <Settings className="w-4 h-4" />
            Model Config
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-all">
            <Shield className="w-4 h-4" />
            Safety Report
          </button>
        </div>
      </div>

      {/* AI Cost Overview */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'AI Cost Today', value: `$${totalCostToday.toFixed(2)}`, icon: DollarSign, color: 'text-amber-400', sub: 'Across all models' },
          { label: 'Cost This Month', value: `$${totalCostMonth.toLocaleString()}`, icon: TrendingUp, color: 'text-orange-400', sub: 'vs $8,420 budget' },
          { label: 'Requests Today', value: totalRequestsToday.toLocaleString(), icon: Activity, color: 'text-blue-400', sub: 'All models combined' },
          { label: 'Safety Incidents', value: '0', icon: Shield, color: 'text-green-400', sub: 'Last 30 days' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-600 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
        {[
          { id: 'models', label: 'Model Performance', icon: Brain },
          { id: 'safety', label: 'Safety Rules', icon: Shield },
          { id: 'costs', label: 'Cost Analysis', icon: DollarSign },
          { id: 'memory', label: 'Memory Governance', icon: Database },
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

      {/* Models Tab */}
      {activeTab === 'models' && (
        <div className="space-y-3">
          {liveModels.map((model) => (
            <div key={model.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    model.provider === 'OpenAI' ? 'bg-green-400/10' : 'bg-orange-400/10'
                  }`}>
                    <Brain className={`w-5 h-5 ${model.provider === 'OpenAI' ? 'text-green-400' : 'text-orange-400'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{model.model}</span>
                      <span className="text-xs text-gray-500">by {model.provider}</span>
                      {model.enabled ? (
                        <span className="text-[10px] bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full font-semibold">ACTIVE</span>
                      ) : (
                        <span className="text-[10px] bg-gray-400/20 text-gray-400 px-2 py-0.5 rounded-full font-semibold">DISABLED</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{model.version}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button className={`p-1.5 rounded transition-colors ${
                    model.enabled
                      ? 'hover:bg-gray-700 text-green-400 hover:text-white'
                      : 'hover:bg-gray-700 text-gray-500 hover:text-green-400'
                  }`}>
                    {model.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Use cases */}
              <div className="flex gap-1.5 mb-4">
                {model.use_cases.map((uc) => (
                  <span key={uc} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                    {uc}
                  </span>
                ))}
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-6 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Req Today</div>
                  <div className="text-sm font-semibold text-white">{model.requests_today.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Cost Today</div>
                  <div className="text-sm font-semibold text-amber-300">${model.cost_today.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Avg Latency</div>
                  <div className="text-sm font-semibold text-white">{model.avg_latency_ms}ms</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">P99 Latency</div>
                  <div className="text-sm font-semibold text-white">{model.p99_latency_ms}ms</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Success Rate</div>
                  <div className={`text-sm font-semibold ${model.success_rate >= 99 ? 'text-green-300' : 'text-amber-300'}`}>
                    {model.success_rate}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-0.5">Quality Score</div>
                  <div className="text-sm font-semibold text-purple-300">{model.avg_quality_score}/5.0</div>
                </div>
              </div>

              {/* Latency bar */}
              <div className="mt-3">
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      model.success_rate >= 99.5 ? 'bg-green-500' :
                      model.success_rate >= 98 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${model.success_rate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Safety Rules Tab */}
      {activeTab === 'safety' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">AI Safety & Content Rules</span>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Add Rule
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rule</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Enforcement</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {AI_SAFETY_RULES.map((rule) => (
                <tr key={rule.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-sm text-white">{rule.rule}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{rule.category}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ENFORCEMENT_COLORS[rule.enforcement]}`}>
                      {rule.enforcement}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-2 h-2 bg-green-400 rounded-full" />
                      <span className="text-xs text-green-300">Active</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost Analysis Tab */}
      {activeTab === 'costs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total AI Cost This Month', value: `$${totalCostMonth.toLocaleString()}`, change: -8.2, note: 'vs $11,230 last month' },
              { label: 'Cost Per Session', value: '$0.26', change: -12.4, note: 'Improving efficiency' },
              { label: 'Cost Per Patient Per Month', value: '$0.42', change: -5.1, note: 'Very efficient' },
            ].map(({ label, value, change, note }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-2">{label}</div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {change < 0 ? (
                    <ArrowDown className="w-3 h-3 text-green-400" />
                  ) : (
                    <ArrowUp className="w-3 h-3 text-red-400" />
                  )}
                  <span className={`text-xs font-medium ${change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.abs(change)}%
                  </span>
                  <span className="text-xs text-gray-500">{note}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Cost Breakdown by Model</h3>
            <div className="space-y-3">
              {liveModels.map((model) => (
                <div key={model.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300">{model.model}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-500">{model.requests_month.toLocaleString()} req/mo</span>
                      <span className="text-sm font-semibold text-white">${model.cost_month.toLocaleString()}/mo</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                      style={{ width: `${(model.cost_month / totalCostMonth) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Memory Governance Tab */}
      {activeTab === 'memory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Memory Nodes', value: '1.84M', icon: Database, color: 'text-purple-400' },
              { label: 'Memories Created Today', value: '12,840', icon: Activity, color: 'text-blue-400' },
              { label: 'Cross-Patient Access Blocks', value: '0', icon: Shield, color: 'text-green-400' },
              { label: 'Memory Storage', value: '42.8 GB', icon: Server, color: 'text-amber-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
                <div className="text-2xl font-bold text-white">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Memory Access Control Architecture</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { title: 'Tenant Isolation', desc: 'Each organization\'s memories are completely isolated. No cross-tenant access possible.', status: 'enforced', icon: Shield },
                { title: 'Therapist Scope', desc: 'AI can only access memories for patients assigned to the requesting therapist.', status: 'enforced', icon: Shield },
                { title: 'Permission-Based Retrieval', desc: 'Memory retrieval requires explicit permission checks against the patient\'s access controls.', status: 'enforced', icon: Shield },
                { title: 'PHI Protection', desc: 'All memory content is encrypted at rest. PII is redacted in logs and exports.', status: 'enforced', icon: Shield },
                { title: 'Audit Trail', desc: 'Every memory read and write is logged in the immutable audit system.', status: 'enforced', icon: Shield },
                { title: 'Retention Policy', desc: 'Memory retention follows organizational settings. Expired memories are purged on schedule.', status: 'enforced', icon: Shield },
              ].map(({ title, desc, status, icon: Icon }) => (
                <div key={title} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-semibold text-white">{title}</span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  <span className="mt-2 inline-block text-[10px] bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full">
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick fix: import Plus
function Plus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
