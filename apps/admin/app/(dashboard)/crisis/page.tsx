'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, Filter, RefreshCw } from 'lucide-react';
import { crisisAPI } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAdminAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  session_id?: string;
  patient_id: string;
  therapist_id: string;
  therapist_name?: string;
  patient_name?: string;
  risk_level: string;
  risk_type: string;
  indicators: string[];
  ai_confidence?: number;
  source: string;
  alert_status: string;
  conversation_id?: string;
  created_at: string;
  acknowledged_at?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400 border-red-700/50',
  high: 'bg-orange-900/30 text-orange-400 border-orange-700/50',
  elevated: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50',
};

export default function CrisisAlertsPage() {
  const { accessToken } = useAdminAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [activeCount, setActiveCount] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const [res, countRes] = await Promise.all([
        crisisAPI.alerts({ status: statusFilter || undefined, level: levelFilter || undefined }),
        crisisAPI.activeCount(),
      ]);
      setAlerts((res.data as Alert[]) || []);
      setActiveCount((countRes.data as { count: number }).count ?? 0);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter, levelFilter]);

  // Real-time prepend via WebSocket
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const handler = (alert: any) => {
      setAlerts((prev) => [{ ...alert, alert_status: 'delivered', source: alert.source || 'keyword' }, ...prev]);
      setActiveCount((c) => c + 1);
    };
    socket.on('crisis_alert', handler);
    return () => { socket.off('crisis_alert', handler); };
  }, [accessToken]);

  const acknowledge = async (id: string) => {
    try {
      await crisisAPI.acknowledge(id);
      setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, alert_status: 'acknowledged' } : a));
      setActiveCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Crisis Alerts</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time patient safety monitoring across all sessions</p>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-bold">
              <AlertTriangle className="w-4 h-4" />
              {activeCount} active
            </span>
          )}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-800">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-700 rounded-lg px-3 py-1.5 bg-gray-800 text-gray-300"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="delivered">Delivered</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="text-sm border border-gray-700 rounded-lg px-3 py-1.5 bg-gray-800 text-gray-300"
        >
          <option value="">All Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="elevated">Elevated</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p className="font-medium text-gray-300">No crisis alerts</p>
          <p className="text-sm">All sessions are currently safe.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'border rounded-xl p-5 transition-opacity',
                alert.alert_status === 'acknowledged' ? 'opacity-60' : '',
                LEVEL_COLORS[alert.risk_level] || 'bg-gray-800 text-gray-300 border-gray-700',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-bold text-sm uppercase tracking-wide">{alert.risk_level}</span>
                    <span className="text-xs opacity-70 capitalize">{alert.risk_type} · {alert.source}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      alert.alert_status === 'acknowledged' ? 'bg-green-100 text-green-700' :
                      alert.alert_status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700',
                    )}>
                      {alert.alert_status}
                    </span>
                  </div>
                  {(alert.patient_name || alert.therapist_name) && (
                    <p className="text-sm font-medium mb-1">
                      Patient: {alert.patient_name ?? '—'} · Therapist: {alert.therapist_name ?? '—'}
                    </p>
                  )}
                  {alert.indicators?.length > 0 && (
                    <p className="text-xs opacity-70 mb-1">Indicators: {alert.indicators.join(', ')}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs opacity-60 mt-1">
                    <Clock className="w-3 h-3" />
                    {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {alert.conversation_id && (
                    <a
                      href={`/messages?conversation=${alert.conversation_id}&priority=crisis`}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                    >
                      Crisis Chat
                    </a>
                  )}
                  {alert.alert_status !== 'acknowledged' && (
                    <button
                      onClick={() => acknowledge(alert.id)}
                      className="px-3 py-1.5 border border-current text-xs font-semibold rounded-lg hover:bg-white/30"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
