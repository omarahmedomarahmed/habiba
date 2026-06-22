'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server, RefreshCw, Download, Search, ChevronDown,
  CheckCircle, AlertCircle, Zap, DollarSign, Clock
} from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { exportCSV } from '@/lib/csv';

interface LogEntry {
  id: string;
  model_id: string;
  request_type: string;
  status: string;
  error_message?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  latency_ms: number;
  created_at: string;
  organization_id: string;
  organization_name: string;
  user_email?: string;
}

interface LogStats {
  today: number;
  avg_latency: number;
  error_rate: number;
  cost_today: number;
}

function StatCard({ icon: Icon, label, value, color = 'blue', sub }: { icon: React.ElementType; label: string; value: string | number; color?: string; sub?: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10',
    green: 'text-green-400 bg-green-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

export default function ApiLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (modelFilter) params.model_id = modelFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminAPI.requestLogs(params);
      setLogs(res.logs || []);
      setStats(res.stats || null);
    } catch {
      showToast('error', 'Failed to load API logs');
    } finally {
      setLoading(false);
    }
  }, [modelFilter, statusFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 30000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  const handleExport = () => {
    exportCSV(
      logs.map(l => ({
        id: l.id,
        timestamp: l.created_at,
        organization: l.organization_name,
        model: l.model_id,
        type: l.request_type,
        status: l.status,
        prompt_tokens: l.prompt_tokens,
        completion_tokens: l.completion_tokens,
        total_tokens: l.total_tokens,
        cost_usd: l.cost_usd,
        latency_ms: l.latency_ms,
        error: l.error_message ?? '',
      })),
      `api-logs-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const filteredLogs = search
    ? logs.filter(l => l.organization_name?.toLowerCase().includes(search.toLowerCase()) || l.model_id?.toLowerCase().includes(search.toLowerCase()) || l.user_email?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  const fmt = (dt: string) => new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border ${
          toast.type === 'success' ? 'bg-green-900/90 border-green-700/50 text-green-200' : 'bg-red-900/90 border-red-700/50 text-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" /> API Request Logs
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time AI request log from ai_request_logs</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${autoRefresh ? 'bg-cyan-900/30 border-cyan-700/50 text-cyan-300' : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'}`}
          >
            <Zap className="w-4 h-4" /> {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh'}
          </button>
          <button onClick={fetchLogs} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Server} label="Requests Today" value={stats?.today ?? 0} color="blue" />
        <StatCard icon={Clock} label="Avg Latency" value={stats?.avg_latency ? `${Math.round(Number(stats.avg_latency))}ms` : '—'} color="green" />
        <StatCard icon={AlertCircle} label="Error Rate" value={stats?.error_rate ? `${stats.error_rate}%` : '0%'} color="amber" />
        <StatCard icon={DollarSign} label="Cost Today" value={stats?.cost_today ? `$${Number(stats.cost_today).toFixed(4)}` : '$0.00'} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search org, model, user..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
        </div>
        <div className="relative">
          <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none">
            <option value="">All Models</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o-mini</option>
            <option value="whisper-1">Whisper-1</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none">
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Org</th>
                <th className="text-left px-4 py-3 font-medium">Model</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Type</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">Tokens</th>
                <th className="text-right px-4 py-3 font-medium hidden xl:table-cell">Cost</th>
                <th className="text-right px-4 py-3 font-medium hidden xl:table-cell">Latency</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">Loading API logs...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">No API logs found</td></tr>
              ) : filteredLogs.map(log => (
                <>
                  <tr
                    key={log.id}
                    className={`hover:bg-gray-800/40 transition-colors cursor-pointer ${log.status === 'error' ? 'bg-red-950/20' : ''}`}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{fmt(log.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm hidden md:table-cell">{log.organization_name}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs font-mono">{log.model_id}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{log.request_type}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs text-right hidden lg:table-cell">{log.total_tokens?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-300 text-xs text-right hidden xl:table-cell">${Number(log.cost_usd || 0).toFixed(5)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs text-right hidden xl:table-cell">{log.latency_ms}ms</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${log.status === 'success' || log.status === 'completed' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                  {expandedId === log.id && log.error_message && (
                    <tr key={`${log.id}-err`} className="bg-red-950/30">
                      <td colSpan={8} className="px-4 py-3 text-xs text-red-300 font-mono">
                        <strong>Error:</strong> {log.error_message}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-500">
            Showing {filteredLogs.length} entries — click error rows to expand
          </div>
        )}
      </div>
    </div>
  );
}
