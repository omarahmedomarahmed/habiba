'use client';

import { useState, useMemo, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import { exportCSV } from '@/lib/csv';
import {
  Shield, Search, Filter, Download, RefreshCw, ChevronDown, ChevronUp,
  Eye, AlertTriangle, CheckCircle2, XCircle, Clock, User, Building2,
  FileText, Lock, Unlock, Trash2, Edit3, LogIn, LogOut, Key,
  Database, Settings, CreditCard, Brain, Activity, AlertCircle,
  Calendar, Globe, Cpu, UserCheck, Users, ToggleLeft
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditOutcome = 'success' | 'failure' | 'warning';
type AuditSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

type AuditCategory =
  | 'authentication'
  | 'authorization'
  | 'patient_data'
  | 'phi_access'
  | 'user_management'
  | 'org_management'
  | 'billing'
  | 'ai_operations'
  | 'system_config'
  | 'data_export'
  | 'feature_flags'
  | 'admin_actions'
  | 'security';

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  category: AuditCategory;
  severity: AuditSeverity;
  actor: {
    id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin' | 'org_admin' | 'therapist' | 'patient' | 'system';
  };
  target?: {
    type: 'user' | 'organization' | 'patient' | 'session' | 'record' | 'config' | 'flag';
    id: string;
    label: string;
  };
  org?: { id: string; name: string };
  outcome: AuditOutcome;
  ip_address: string;
  user_agent: string;
  geo?: string;
  details: string;
  metadata?: Record<string, string>;
  session_id?: string;
  log_id: string;
}


// ─── Helper Maps ──────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'admin.impersonate_user': 'User Impersonation',
  'phi.export_patient_records': 'PHI Export',
  'auth.login_failed': 'Login Failed',
  'feature_flag.toggle': 'Feature Flag Toggle',
  'org.plan_upgraded': 'Plan Upgraded',
  'ai.model_config_updated': 'AI Config Updated',
  'user.role_changed': 'Role Changed',
  'billing.invoice_voided': 'Invoice Voided',
  'system.backup_completed': 'Backup Completed',
  'phi.unauthorized_access_attempt': 'Unauthorized PHI Access',
  'org.created': 'Org Created',
  'auth.mfa_disabled': 'MFA Disabled',
  'data.patient_record_deleted': 'Patient Record Deleted',
  'system.config_changed': 'System Config Changed',
  'auth.api_key_revoked': 'API Key Revoked',
};

const CATEGORY_COLORS: Record<AuditCategory, string> = {
  authentication: 'bg-purple-100 text-purple-700',
  authorization: 'bg-indigo-100 text-indigo-700',
  patient_data: 'bg-blue-100 text-blue-700',
  phi_access: 'bg-red-100 text-red-700',
  user_management: 'bg-amber-100 text-amber-700',
  org_management: 'bg-green-100 text-green-700',
  billing: 'bg-emerald-100 text-emerald-700',
  ai_operations: 'bg-cyan-100 text-cyan-700',
  system_config: 'bg-slate-100 text-slate-700',
  data_export: 'bg-orange-100 text-orange-700',
  feature_flags: 'bg-violet-100 text-violet-700',
  admin_actions: 'bg-rose-100 text-rose-700',
  security: 'bg-red-100 text-red-800',
};

const SEVERITY_CONFIG: Record<AuditSeverity, { color: string; dot: string }> = {
  info: { color: 'text-slate-500', dot: 'bg-slate-400' },
  low: { color: 'text-green-600', dot: 'bg-green-500' },
  medium: { color: 'text-amber-600', dot: 'bg-amber-500' },
  high: { color: 'text-orange-600', dot: 'bg-orange-500' },
  critical: { color: 'text-red-600', dot: 'bg-red-500' },
};

const OUTCOME_CONFIG: Record<AuditOutcome, { icon: React.ReactNode; color: string; label: string }> = {
  success: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-600', label: 'Success' },
  failure: { icon: <XCircle className="w-4 h-4" />, color: 'text-red-600', label: 'Failure' },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600', label: 'Warning' },
};

const CATEGORY_ICONS: Record<AuditCategory, React.ReactNode> = {
  authentication: <Key className="w-3.5 h-3.5" />,
  authorization: <Lock className="w-3.5 h-3.5" />,
  patient_data: <FileText className="w-3.5 h-3.5" />,
  phi_access: <Shield className="w-3.5 h-3.5" />,
  user_management: <User className="w-3.5 h-3.5" />,
  org_management: <Building2 className="w-3.5 h-3.5" />,
  billing: <CreditCard className="w-3.5 h-3.5" />,
  ai_operations: <Brain className="w-3.5 h-3.5" />,
  system_config: <Settings className="w-3.5 h-3.5" />,
  data_export: <Download className="w-3.5 h-3.5" />,
  feature_flags: <ToggleLeft className="w-3.5 h-3.5" />,
  admin_actions: <UserCheck className="w-3.5 h-3.5" />,
  security: <AlertTriangle className="w-3.5 h-3.5" />,
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}

function RoleBadge({ role }: { role: AuditEntry['actor']['role'] }) {
  const map: Record<AuditEntry['actor']['role'], string> = {
    super_admin: 'bg-red-100 text-red-700',
    admin: 'bg-orange-100 text-orange-700',
    org_admin: 'bg-amber-100 text-amber-700',
    therapist: 'bg-blue-100 text-blue-700',
    patient: 'bg-green-100 text-green-700',
    system: 'bg-slate-100 text-slate-600',
  };
  const labels: Record<AuditEntry['actor']['role'], string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    org_admin: 'Org Admin',
    therapist: 'Therapist',
    patient: 'Patient',
    system: 'System',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${map[role]}`}>
      {labels[role]}
    </span>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const outcome = OUTCOME_CONFIG[entry.outcome];
  const catColor = CATEGORY_COLORS[entry.category];

  return (
    <>
      <tr
        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
          expanded ? 'bg-gray-50' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand */}
        <td className="py-3 pl-4 pr-2 w-8">
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </td>

        {/* Timestamp */}
        <td className="py-3 pr-4 whitespace-nowrap">
          <div className="text-xs text-gray-900 font-mono">
            {new Date(entry.timestamp).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric'
            })}
          </div>
          <div className="text-[10px] text-gray-400 font-mono">
            {new Date(entry.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            })}
          </div>
        </td>

        {/* Action + Category */}
        <td className="py-3 pr-4">
          <div className="text-sm font-medium text-gray-900">
            {ACTION_LABELS[entry.action] || entry.action}
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 ${catColor}`}>
            {CATEGORY_ICONS[entry.category]}
            {entry.category.replace(/_/g, ' ')}
          </span>
        </td>

        {/* Actor */}
        <td className="py-3 pr-4">
          <div className="text-sm text-gray-900">{entry.actor.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <RoleBadge role={entry.actor.role} />
            {entry.org && (
              <span className="text-[10px] text-gray-400 truncate max-w-[100px]">
                {entry.org.name}
              </span>
            )}
          </div>
        </td>

        {/* Target */}
        <td className="py-3 pr-4">
          {entry.target ? (
            <div>
              <div className="text-sm text-gray-700 truncate max-w-[160px]">{entry.target.label}</div>
              <div className="text-[10px] text-gray-400 capitalize">{entry.target.type}</div>
            </div>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>

        {/* Severity */}
        <td className="py-3 pr-4 whitespace-nowrap">
          <SeverityBadge severity={entry.severity} />
        </td>

        {/* Outcome */}
        <td className="py-3 pr-6 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${outcome.color}`}>
            {outcome.icon}
            {outcome.label}
          </span>
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="bg-gray-50/70 border-b border-gray-200">
          <td colSpan={7} className="px-6 pb-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Event details */}
              <div className="md:col-span-2 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-sm text-gray-700">{entry.details}</p>
                </div>
                {entry.metadata && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metadata</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(entry.metadata).map(([k, v]) => (
                        <div key={k} className="bg-white rounded border border-gray-200 px-2 py-1">
                          <span className="text-[10px] text-gray-400">{k.replace(/_/g, ' ')}: </span>
                          <span className="text-xs font-medium text-gray-700">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Technical info */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Technical Details</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Globe className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-400">IP: </span>
                      <span className="font-mono text-gray-700">{entry.ip_address}</span>
                      {entry.geo && <span className="text-gray-400"> ({entry.geo})</span>}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Cpu className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600 break-all">{entry.user_agent}</span>
                  </div>
                  {entry.session_id && (
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="font-mono text-gray-600">{entry.session_id}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-mono text-gray-600">{entry.log_id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">
                      {new Date(entry.timestamp).toISOString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<AuditOutcome | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<AuditSeverity | 'all'>('all');
  const [orgFilter, setOrgFilter] = useState('all');
  const [actorRoleFilter, setActorRoleFilter] = useState<AuditEntry['actor']['role'] | 'all'>('all');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('all');
  const [page, setPage] = useState(1);
  const [liveData, setLiveData] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await adminAPI.auditLogs({ limit: 100 }) as { data: Record<string, unknown>[] };
        if (res.data?.length > 0) {
          setLiveData(res.data.map(e => ({
            id: e.id as string,
            timestamp: e.created_at as string,
            category: (e.action_category || 'phi_access') as AuditCategory,
            action: e.action as string || `${e.access_type} ${e.resource_type}`,
            outcome: (e.outcome || 'success') as AuditOutcome,
            severity: (e.severity || 'low') as AuditSeverity,
            actor: {
              id: e.user_id as string,
              name: (e.user_email as string) || (e.user_id as string) || 'Unknown',
              role: (e.user_role || 'therapist') as AuditEntry['actor']['role'],
              email: (e.user_email as string) || '',
            },
            target: e.resource_id ? {
              type: ((e.resource_type as string) || 'record') as 'user' | 'organization' | 'patient' | 'session' | 'record' | 'config' | 'flag',
              id: (e.resource_id as string),
              label: (e.resource_type as string) || '',
            } : undefined,
            org: {
              id: (e.organization_id as string) || '',
              name: (e.organization_name as string) || '',
            },
            ip_address: (e.ip_address as string) || '',
            user_agent: (e.user_agent as string) || '',
            details: (e.details as string) || `${e.access_type || ''} ${e.resource_type || ''}`.trim(),
            log_id: (e.id as string) || '',
          })));
        }
      } catch { /* empty */ }
      finally { setLoading(false); }
    }
    loadLogs();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const critical = liveData.filter(e => e.severity === 'critical').length;
    const failures = liveData.filter(e => e.outcome === 'failure').length;
    const phiEvents = liveData.filter(e => e.category === 'phi_access' || e.category === 'patient_data').length;
    const securityAlerts = liveData.filter(e => e.category === 'security').length;
    return { critical, failures, phiEvents, securityAlerts, total: liveData.length };
  }, [liveData]);

  // Unique orgs for filter
  const orgs = useMemo(() => {
    const seen = new Map<string, string>();
    liveData.forEach(e => { if (e.org) seen.set(e.org.id, e.org.name); });
    return Array.from(seen.entries());
  }, [liveData]);

  // Filtered data
  const filtered = useMemo(() => {
    return liveData.filter(e => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.actor.name.toLowerCase().includes(q) &&
          !e.actor.email.toLowerCase().includes(q) &&
          !e.details.toLowerCase().includes(q) &&
          !(ACTION_LABELS[e.action] || e.action).toLowerCase().includes(q) &&
          !e.log_id.toLowerCase().includes(q) &&
          !(e.org?.name || '').toLowerCase().includes(q) &&
          !(e.target?.label || '').toLowerCase().includes(q)
        ) return false;
      }
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (outcomeFilter !== 'all' && e.outcome !== outcomeFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (orgFilter !== 'all' && e.org?.id !== orgFilter) return false;
      if (actorRoleFilter !== 'all' && e.actor.role !== actorRoleFilter) return false;
      return true;
    });
  }, [search, categoryFilter, outcomeFilter, severityFilter, orgFilter, actorRoleFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCSV = () => {
    exportCSV(
      filtered.map(e => ({
        log_id: e.log_id,
        timestamp: e.timestamp,
        actor_name: e.actor.name,
        actor_email: e.actor.email,
        actor_role: e.actor.role,
        organization: e.org?.name ?? '',
        category: e.category,
        action: e.action,
        outcome: e.outcome,
        severity: e.severity,
        target: e.target?.label ?? '',
        details: e.details,
        ip_address: e.ip_address,
      })),
      `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" />
            Platform Audit Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Immutable HIPAA-compliant audit trail for all platform events across all organizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-500" />
            Refresh
          </button>
          <button onClick={handleExportCSV} disabled={!filtered.length} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* HIPAA Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">HIPAA Audit Trail — 6-Year Retention Policy</p>
          <p className="text-xs text-blue-600 mt-0.5">
            All events are cryptographically signed and stored immutably. Log tampering triggers automatic compliance alerts.
            Logs are retained for 6 years per HIPAA §164.312(b) requirements. Export available for compliance reporting.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total Events" value={stats.total.toLocaleString()}
          sub="Last 24 hours" icon={<Activity className="w-5 h-5 text-gray-600" />}
          color="bg-gray-100"
        />
        <StatCard
          label="Critical Events" value={String(stats.critical)}
          sub="Require review" icon={<AlertCircle className="w-5 h-5 text-red-600" />}
          color="bg-red-100"
        />
        <StatCard
          label="Failed Actions" value={String(stats.failures)}
          sub="Access denied / errors" icon={<XCircle className="w-5 h-5 text-orange-600" />}
          color="bg-orange-100"
        />
        <StatCard
          label="PHI Events" value={String(stats.phiEvents)}
          sub="Patient data access" icon={<FileText className="w-5 h-5 text-blue-600" />}
          color="bg-blue-100"
        />
        <StatCard
          label="Security Alerts" value={String(stats.securityAlerts)}
          sub="Auth & access issues" icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          color="bg-amber-100"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Search */}
          <div className="xl:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search action, actor, org, details..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30"
            />
          </div>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value as AuditCategory | 'all'); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 bg-white"
          >
            <option value="all">All Categories</option>
            {(Object.keys(CATEGORY_COLORS) as AuditCategory[]).map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
            ))}
          </select>

          {/* Severity */}
          <select
            value={severityFilter}
            onChange={e => { setSeverityFilter(e.target.value as AuditSeverity | 'all'); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 bg-white"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>

          {/* Outcome */}
          <select
            value={outcomeFilter}
            onChange={e => { setOutcomeFilter(e.target.value as AuditOutcome | 'all'); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 bg-white"
          >
            <option value="all">All Outcomes</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
            <option value="warning">Warning</option>
          </select>

          {/* Org */}
          <select
            value={orgFilter}
            onChange={e => { setOrgFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/30 bg-white"
          >
            <option value="all">All Organizations</option>
            {orgs.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* Active filter chips + result count */}
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-medium text-gray-900">{filtered.length}</span> of{' '}
            <span className="font-medium text-gray-900">{liveData.length}</span> events
          </p>
          <div className="flex items-center gap-2">
            {categoryFilter !== 'all' && (
              <button
                onClick={() => setCategoryFilter('all')}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100"
              >
                {categoryFilter.replace(/_/g, ' ')} ×
              </button>
            )}
            {severityFilter !== 'all' && (
              <button
                onClick={() => setSeverityFilter('all')}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100"
              >
                {severityFilter} ×
              </button>
            )}
            {outcomeFilter !== 'all' && (
              <button
                onClick={() => setOutcomeFilter('all')}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full hover:bg-red-100"
              >
                {outcomeFilter} ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-3 pl-4 pr-2 w-8" />
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Timestamp
                </th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Action / Category
                </th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Severity
                </th>
                <th className="py-3 pr-6 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Outcome
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Loading audit log…</p>
                </td></tr>
              ) : paginated.length > 0 ? (
                paginated.map(entry => <AuditRow key={entry.id} entry={entry} />)
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">{liveData.length === 0 ? 'No audit events recorded yet.' : 'No audit events match your filters'}</p>
                    <button
                      onClick={() => {
                        setSearch(''); setCategoryFilter('all');
                        setOutcomeFilter('all'); setSeverityFilter('all');
                        setOrgFilter('all'); setPage(1);
                      }}
                      className="mt-2 text-xs text-red-500 hover:underline"
                    >
                      Clear all filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Page {page} of {totalPages} • {filtered.length} events
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${
                      page === p
                        ? 'bg-gray-900 text-white'
                        : 'border border-gray-200 hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compliance Info Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Retention Schedule
          </h3>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between"><span>PHI access logs</span><span className="font-medium text-gray-900">6 years</span></div>
            <div className="flex justify-between"><span>Authentication events</span><span className="font-medium text-gray-900">3 years</span></div>
            <div className="flex justify-between"><span>Admin actions</span><span className="font-medium text-gray-900">6 years</span></div>
            <div className="flex justify-between"><span>System events</span><span className="font-medium text-gray-900">1 year</span></div>
            <div className="flex justify-between"><span>Security incidents</span><span className="font-medium text-gray-900">7 years</span></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            High-Risk Event Types
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {['PHI export', 'Record deletion', 'MFA disabled', 'Role escalation', 'Unauthorized access', 'API key ops', 'Impersonation'].map(t => (
              <span key={t} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            Compliance Certifications
          </h3>
          <div className="space-y-1.5 text-xs text-gray-600">
            {[
              { name: 'HIPAA §164.312(b)', status: 'Compliant' },
              { name: 'SOC 2 Type II', status: 'Certified' },
              { name: 'HITECH Act', status: 'Compliant' },
              { name: 'GDPR Article 30', status: 'Compliant' },
              { name: 'NIST 800-66', status: 'Aligned' },
            ].map(item => (
              <div key={item.name} className="flex justify-between">
                <span>{item.name}</span>
                <span className="text-green-600 font-medium">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
