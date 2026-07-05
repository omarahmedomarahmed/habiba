'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, RefreshCw, Zap, DollarSign, AlertCircle, Cpu, Activity,
} from 'lucide-react';
import { adminAPI } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  transcription: 'Transcription (Whisper)',
  soap_note: 'SOAP notes',
  dap_note: 'DAP notes',
  birp_note: 'BIRP notes',
  session_summary: 'Session summaries',
  copilot_suggestions: 'Live copilot',
  emotional_analysis: 'Emotional analysis',
  memory_extraction: 'Memory extraction',
  risk_assessment: 'Risk assessment',
  chat: 'Session chat',
  assistant: 'AI assistant chat',
  embedding: 'Embeddings',
};

const money = (v: any) => `$${Number(v || 0).toFixed(4)}`;
const num = (v: any) => Number(v || 0).toLocaleString();

function StatCard({ icon: Icon, label, value, color = 'blue' }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function AIUsagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.aiUsage(days);
      setData((res as any)?.data ?? res);
    } catch { /* surfaced as empty state */ } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals ?? {};
  const byType: any[] = data?.by_type ?? [];
  const byModel: any[] = data?.by_model ?? [];
  const byTherapist: any[] = data?.by_therapist ?? [];
  const recent: any[] = data?.recent ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" /> AI Usage
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Every model call — transcription, notes, copilot, chat — with tokens and cost.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button onClick={load} className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Zap} label="Total AI calls" value={num(totals.calls)} color="blue" />
        <StatCard icon={Activity} label="Tokens used" value={num(totals.tokens)} color="purple" />
        <StatCard icon={DollarSign} label="Total cost" value={money(totals.cost_usd)} color="green" />
        <StatCard icon={AlertCircle} label="Failed calls" value={num(totals.failures)} color={Number(totals.failures) > 0 ? 'red' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* By type */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white">Usage by type</div>
          <div className="divide-y divide-gray-800">
            {byType.length === 0 && <div className="px-5 py-8 text-center text-sm text-gray-600">No AI usage in this period.</div>}
            {byType.map((t) => (
              <div key={t.request_type} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm text-gray-200">{TYPE_LABELS[t.request_type] || t.request_type}</div>
                  <div className="text-xs text-gray-600">
                    {num(t.calls)} calls · {num(t.tokens)} tokens
                    {Number(t.failures) > 0 && <span className="text-red-400"> · {num(t.failures)} failed</span>}
                  </div>
                </div>
                <div className="text-sm font-mono text-green-400">{money(t.cost_usd)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* By model */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-gray-500" /> Usage by model
          </div>
          <div className="divide-y divide-gray-800">
            {byModel.length === 0 && <div className="px-5 py-8 text-center text-sm text-gray-600">No AI usage in this period.</div>}
            {byModel.map((m) => (
              <div key={m.model_id} className="flex items-center justify-between px-5 py-3">
                <div className="text-sm text-gray-200 font-mono">{m.model_id}</div>
                <div className="text-xs text-gray-500">{num(m.calls)} calls</div>
                <div className="text-sm font-mono text-green-400">{money(m.cost_usd)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By therapist */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white">Usage by therapist</div>
        <div className="divide-y divide-gray-800">
          {byTherapist.length === 0 && <div className="px-5 py-8 text-center text-sm text-gray-600">No AI usage in this period.</div>}
          {byTherapist.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm text-gray-200">{t.therapist_name || 'Unknown'}</div>
                <div className="text-xs text-gray-600">{t.email}</div>
              </div>
              <div className="text-xs text-gray-500">{num(t.calls)} calls</div>
              <div className="text-sm font-mono text-green-400">{money(t.cost_usd)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent calls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 text-sm font-semibold text-white">Recent calls</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="px-5 py-2 font-medium">Time</th>
                <th className="px-5 py-2 font-medium">Type</th>
                <th className="px-5 py-2 font-medium">Model</th>
                <th className="px-5 py-2 font-medium">Therapist</th>
                <th className="px-5 py-2 font-medium">Tokens</th>
                <th className="px-5 py-2 font-medium">Cost</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {recent.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-600">No AI calls recorded yet.</td></tr>
              )}
              {recent.map((r) => (
                <tr key={r.id} className="text-gray-300">
                  <td className="px-5 py-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-5 py-2">{TYPE_LABELS[r.request_type] || r.request_type}</td>
                  <td className="px-5 py-2 font-mono text-xs">{r.model_id}</td>
                  <td className="px-5 py-2 text-xs">{r.therapist_name || '—'}</td>
                  <td className="px-5 py-2 text-xs">{num((r.input_tokens || 0) + (r.output_tokens || 0))}</td>
                  <td className="px-5 py-2 text-xs font-mono text-green-400">{money(r.cost_usd)}</td>
                  <td className="px-5 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === 'failure' ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
