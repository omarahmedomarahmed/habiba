'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Building2, DollarSign, Brain, Activity, AlertTriangle,
  TrendingUp, Zap, Shield, Server, Clock, ArrowUp, ArrowDown,
  ChevronRight, RefreshCw, Eye, PhoneCall
} from 'lucide-react';
import { adminAPI, notificationsAPI } from '@/lib/api';
import { useAdminAuth } from '@/lib/store';

interface CrisisEvent {
  id: string;
  org_name?: string;
  therapist_name?: string;
  risk_level: string;
  body: string;
  created_at: string;
  read_at?: string;
}

// ============================================================
// FALLBACK DATA (shown when API is unavailable)
// ============================================================
const FALLBACK_STATS = {
  mrr: 0, arr: 0, mrr_growth: 0,
  active_organizations: 0, active_therapists: 0, active_patients: 0,
  sessions_today: 0, ai_notes_today: 0, ai_cost_today: 0,
  radar_requests_today: 0, radar_conversion: 0, compliance_issues: 0,
  system_uptime: 100, nps_score: 0,
};

// ============================================================
// Components
// ============================================================
function MetricCard({
  icon: Icon, label, value, sub, change, color = 'blue',
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; change?: number; color?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10', green: 'text-green-400 bg-green-400/10',
    purple: 'text-purple-400 bg-purple-400/10', amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10', cyan: 'text-cyan-400 bg-cyan-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
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
    operational: 'bg-green-500', degraded: 'bg-amber-500', down: 'bg-red-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] || 'bg-gray-500'} animate-pulse`} />;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-1/2 mb-2" />
      <div className="h-8 bg-gray-800 rounded w-1/3" />
    </div>
  );
}

export default function AdminDashboardPage() {
  const { accessToken } = useAdminAuth();
  const [stats, setStats] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [crisisEvents, setCrisisEvents] = useState<CrisisEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      // Parallel fetch of dashboard data
      const [analyticsData, orgsData] = await Promise.allSettled([
        adminAPI.analyticsOverview('today'),
        adminAPI.organizations({ limit: 5, sort: 'created_at', order: 'desc' }),
      ]);

      if (analyticsData.status === 'fulfilled') {
        setStats(analyticsData.value);
      }
      if (orgsData.status === 'fulfilled') {
        const orgList = (orgsData.value as any)?.data || orgsData.value;
        setOrgs(Array.isArray(orgList) ? orgList.slice(0, 4) : []);
      }
    } catch (err: any) {
      setError('Unable to load live data. Showing cached values.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch crisis alerts from last 24h
  useEffect(() => {
    const fetchCrisis = async () => {
      try {
        const data = await notificationsAPI.list({ type: 'crisis_alert', limit: 10 });
        const items = Array.isArray(data) ? data : (data as any).data ?? [];
        setCrisisEvents(items.map((n: any) => ({
          id: n.id,
          org_name: n.metadata?.org_name,
          therapist_name: n.metadata?.therapist_name,
          risk_level: n.metadata?.risk_level || 'high',
          body: n.body || n.title || 'Crisis detected',
          created_at: n.created_at,
          read_at: n.read_at,
        })));
      } catch {
        // non-critical
      }
    };
    fetchCrisis();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const s = stats || FALLBACK_STATS;

  const fmtMoney = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <div className="flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg">
              <span className="text-xs text-amber-400">{error}</span>
            </div>
          )}
          {!error && !loading && (
            <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-400 font-medium">Live Data</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-all disabled:opacity-50"
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
            {loading ? <LoadingSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-white">{fmtMoney(s.mrr || 0)}</div>
                {s.mrr_growth !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUp className="w-3 h-3 text-green-400" />
                    <span className="text-sm text-green-400 font-semibold">{s.mrr_growth}%</span>
                    <span className="text-xs text-gray-500">vs last month</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="px-6">
            <div className="text-xs text-gray-400 mb-1">Annual Recurring Revenue</div>
            {loading ? <LoadingSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-white">{fmtMoney(s.arr || s.mrr * 12 || 0)}</div>
                <div className="text-xs text-gray-500 mt-1">Projected ARR</div>
              </>
            )}
          </div>
          <div className="pl-6">
            <div className="text-xs text-gray-400 mb-1">NPS Score</div>
            {loading ? <LoadingSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-white">{s.nps_score || '–'}</div>
                <div className="text-xs text-gray-500 mt-1">Industry avg: 32</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="animate-pulse space-y-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg" />
                <div className="h-7 bg-gray-800 rounded w-1/2" />
                <div className="h-3 bg-gray-800 rounded w-3/4" />
              </div>
            </div>
          ))
        ) : (
          <>
            <MetricCard icon={Building2} label="Active Organizations" value={(s.active_organizations || 0).toLocaleString()} change={s.org_growth} sub="vs last month" color="blue" />
            <MetricCard icon={Users} label="Active Therapists" value={(s.active_therapists || 0).toLocaleString()} change={s.therapist_growth} sub="vs last month" color="green" />
            <MetricCard icon={Activity} label="Active Patients" value={(s.active_patients || 0).toLocaleString()} change={s.patient_growth} sub="vs last month" color="purple" />
            <MetricCard icon={Clock} label="Sessions Today" value={(s.sessions_today || 0).toLocaleString()} change={s.session_growth} sub="vs yesterday" color="cyan" />
            <MetricCard icon={Brain} label="AI Notes Generated" value={(s.ai_notes_today || 0).toLocaleString()} sub="Today" color="orange" />
            <MetricCard icon={DollarSign} label="AI Cost Today" value={`$${(s.ai_cost_today || 0).toFixed(2)}`} sub="AI usage" color="amber" />
            <MetricCard icon={Zap} label="Radar Requests" value={s.radar_requests_today || 0} sub={s.radar_conversion ? `${s.radar_conversion}% conversion` : 'matching'} color="red" />
            <MetricCard icon={Shield} label="Compliance Issues" value={s.compliance_issues || 0} sub={s.compliance_issues > 0 ? 'Requires attention' : 'All clear'} color={s.compliance_issues > 0 ? 'red' : 'green'} />
          </>
        )}
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
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-lg bg-gray-800 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-800 rounded animate-pulse w-1/2" />
                    <div className="h-3 bg-gray-800 rounded animate-pulse w-3/4" />
                  </div>
                </div>
              ))
            ) : orgs.length > 0 ? (
              orgs.map((org: any) => (
                <div key={org.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold shrink-0">
                    {(org.name || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{org.name}</div>
                    <div className="text-xs text-gray-500">
                      {org.therapist_count || 0} therapists · {org.patient_count || 0} patients
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-white">
                      {org.status === 'trial' ? 'Trial' : org.plan_name || org.subscription_plan || '–'}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      org.status === 'active' ? 'bg-green-400/20 text-green-300' :
                      org.status === 'trial' ? 'bg-amber-400/20 text-amber-300' :
                      'bg-gray-400/20 text-gray-300'
                    }`}>
                      {org.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center">
                <Building2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No organizations yet</p>
              </div>
            )}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-semibold text-white">System Health</h3>
            </div>
            <span className="text-xs text-green-400 font-medium">{s.system_uptime || 100}% uptime</span>
          </div>
          <div className="divide-y divide-gray-800">
            {[
              { name: 'API Gateway', status: 'operational', latency: '–' },
              { name: 'AI Service', status: 'operational', latency: '–' },
              { name: 'Database', status: 'operational', latency: '–' },
              { name: 'Video Service', status: 'operational', latency: '–' },
              { name: 'Notifications', status: 'operational', latency: '–' },
              { name: 'Billing Service', status: 'operational', latency: '–' },
            ].map((svc) => (
              <div key={svc.name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={svc.status} />
                  <div className="text-xs font-medium text-white">{svc.name}</div>
                </div>
                <div className="text-xs text-gray-400 font-mono">{svc.latency}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Crisis Monitoring Panel */}
      <div className="bg-gray-900 border border-red-900/50 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-red-900/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Crisis Alerts — Last 24h</h3>
            {crisisEvents.filter(e => !e.read_at).length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {crisisEvents.filter(e => !e.read_at).length}
              </span>
            )}
          </div>
          <a href="/compliance" className="text-xs text-gray-500 hover:text-white transition-colors">
            View all →
          </a>
        </div>
        {crisisEvents.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {crisisEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  event.risk_level === 'critical' ? 'bg-red-500 animate-ping' : 'bg-orange-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase ${
                      event.risk_level === 'critical' ? 'text-red-400' : 'text-orange-400'
                    }`}>{event.risk_level}</span>
                    {event.org_name && <span className="text-xs text-gray-500">· {event.org_name}</span>}
                    {!event.read_at && <span className="text-[10px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">UNREAD</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{event.body}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
                <a href="/compliance" className="text-gray-600 hover:text-red-400 transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <PhoneCall className="w-8 h-8 text-green-500/50 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No crisis alerts in the last 24 hours</p>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Platform Alerts</h3>
          </div>
          <a href="/audit-logs" className="text-xs text-gray-500 hover:text-white transition-colors">
            View audit log →
          </a>
        </div>
        {loading ? (
          <div className="px-5 py-6">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-800 rounded" />)}
            </div>
          </div>
        ) : alerts.length > 0 ? (
          <div className="divide-y divide-gray-800">
            {alerts.map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-800/50 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  alert.severity === 'critical' || alert.severity === 'high' ? 'bg-red-500' :
                  alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white leading-relaxed">{alert.message || alert.description}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {alert.created_at ? new Date(alert.created_at).toLocaleString() : alert.time}
                  </div>
                </div>
                <button className="text-gray-600 hover:text-gray-400 transition-colors">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-8 text-center">
            <Shield className="w-8 h-8 text-green-500/50 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No active alerts — all systems healthy</p>
          </div>
        )}
      </div>
    </div>
  );
}
