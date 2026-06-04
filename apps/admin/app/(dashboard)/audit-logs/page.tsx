'use client';

import { useState, useMemo } from 'react';
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

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const AUDIT_DATA: AuditEntry[] = [
  {
    id: '1',
    timestamp: '2025-01-15T14:32:11Z',
    action: 'admin.impersonate_user',
    category: 'admin_actions',
    severity: 'high',
    actor: { id: 'a1', name: 'Alex Kim', email: 'alex@24therapy.com', role: 'super_admin' },
    target: { type: 'user', id: 'u42', label: 'Dr. Sarah Chen (therapist)' },
    org: { id: 'org1', name: 'Mindful Horizons Clinic' },
    outcome: 'success',
    ip_address: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    geo: 'San Francisco, CA',
    details: 'Admin initiated impersonation session for support investigation',
    metadata: { reason: 'Support ticket #4521', duration: '12 minutes' },
    session_id: 'sess_imp_0192',
    log_id: 'log_00001',
  },
  {
    id: '2',
    timestamp: '2025-01-15T14:18:44Z',
    action: 'phi.export_patient_records',
    category: 'phi_access',
    severity: 'critical',
    actor: { id: 'u88', name: 'Dr. Marcus Webb', email: 'marcus@greenvalley.com', role: 'therapist' },
    target: { type: 'patient', id: 'p201', label: 'Patient #P-2024-0201 (bulk export)' },
    org: { id: 'org3', name: 'Green Valley Counseling' },
    outcome: 'success',
    ip_address: '192.168.5.22',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    geo: 'Denver, CO',
    details: 'Bulk export of 14 patient records (PDF) for practice transition',
    metadata: { records_count: '14', format: 'PDF', size_mb: '8.4' },
    session_id: 'sess_0883',
    log_id: 'log_00002',
  },
  {
    id: '3',
    timestamp: '2025-01-15T13:55:02Z',
    action: 'auth.login_failed',
    category: 'authentication',
    severity: 'medium',
    actor: { id: 'unknown', name: 'Unknown', email: 'unknown@attacker.net', role: 'patient' },
    outcome: 'failure',
    ip_address: '203.0.113.42',
    user_agent: 'python-requests/2.28.0',
    geo: 'Frankfurt, DE',
    details: 'Failed login attempt — invalid credentials (3rd attempt in 10 min)',
    metadata: { attempts_in_window: '3', lockout_triggered: 'false' },
    log_id: 'log_00003',
  },
  {
    id: '4',
    timestamp: '2025-01-15T13:40:17Z',
    action: 'feature_flag.toggle',
    category: 'feature_flags',
    severity: 'medium',
    actor: { id: 'a1', name: 'Alex Kim', email: 'alex@24therapy.com', role: 'super_admin' },
    target: { type: 'flag', id: 'ff_ai_copilot_v2', label: 'ai_copilot_v2' },
    outcome: 'success',
    ip_address: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    geo: 'San Francisco, CA',
    details: 'Feature flag "ai_copilot_v2" enabled globally (was: disabled)',
    metadata: { previous_value: 'false', new_value: 'true', scope: 'global' },
    log_id: 'log_00004',
  },
  {
    id: '5',
    timestamp: '2025-01-15T13:22:49Z',
    action: 'org.plan_upgraded',
    category: 'org_management',
    severity: 'low',
    actor: { id: 'u14', name: 'Jordan Price', email: 'jordan@serenehealth.com', role: 'org_admin' },
    target: { type: 'organization', id: 'org2', label: 'Serene Health Partners' },
    org: { id: 'org2', name: 'Serene Health Partners' },
    outcome: 'success',
    ip_address: '172.16.10.5',
    user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2)',
    geo: 'Austin, TX',
    details: 'Organization upgraded from Professional to Enterprise plan',
    metadata: { from_plan: 'professional', to_plan: 'enterprise', mrr_delta: '+$890' },
    log_id: 'log_00005',
  },
  {
    id: '6',
    timestamp: '2025-01-15T12:58:33Z',
    action: 'ai.model_config_updated',
    category: 'ai_operations',
    severity: 'high',
    actor: { id: 'a1', name: 'Alex Kim', email: 'alex@24therapy.com', role: 'super_admin' },
    target: { type: 'config', id: 'ai_cfg_001', label: 'GPT-4o Scribe Model Config' },
    outcome: 'success',
    ip_address: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    geo: 'San Francisco, CA',
    details: 'AI model temperature reduced from 0.8 → 0.4 for clinical scribe accuracy',
    metadata: { model: 'gpt-4o', param: 'temperature', from: '0.8', to: '0.4' },
    log_id: 'log_00006',
  },
  {
    id: '7',
    timestamp: '2025-01-15T12:34:08Z',
    action: 'user.role_changed',
    category: 'user_management',
    severity: 'medium',
    actor: { id: 'u14', name: 'Jordan Price', email: 'jordan@serenehealth.com', role: 'org_admin' },
    target: { type: 'user', id: 'u77', label: 'Dr. Lisa Nguyen' },
    org: { id: 'org2', name: 'Serene Health Partners' },
    outcome: 'success',
    ip_address: '172.16.10.5',
    user_agent: 'Chrome/121.0',
    geo: 'Austin, TX',
    details: 'User role changed from Intern to Licensed Therapist',
    metadata: { from_role: 'intern', to_role: 'therapist', supervisor: 'Dr. J. Price' },
    log_id: 'log_00007',
  },
  {
    id: '8',
    timestamp: '2025-01-15T11:50:22Z',
    action: 'billing.invoice_voided',
    category: 'billing',
    severity: 'medium',
    actor: { id: 'a2', name: 'Morgan Lee', email: 'morgan@24therapy.com', role: 'admin' },
    target: { type: 'record', id: 'inv_2024_0042', label: 'Invoice #2024-0042' },
    org: { id: 'org5', name: 'Harbor Light Wellness' },
    outcome: 'success',
    ip_address: '10.0.0.4',
    user_agent: 'Mozilla/5.0 (X11; Linux x86_64)',
    geo: 'San Francisco, CA',
    details: 'Invoice voided due to duplicate charge; credit memo issued',
    metadata: { amount: '$1,240.00', reason: 'duplicate_charge', credit_issued: 'true' },
    log_id: 'log_00008',
  },
  {
    id: '9',
    timestamp: '2025-01-15T11:20:55Z',
    action: 'system.backup_completed',
    category: 'system_config',
    severity: 'info',
    actor: { id: 'sys', name: 'System Scheduler', email: 'system@24therapy.internal', role: 'system' },
    outcome: 'success',
    ip_address: '10.0.0.100',
    user_agent: 'System/BackupService v2.1',
    geo: 'Internal',
    details: 'Automated daily database backup completed successfully',
    metadata: { size_gb: '47.2', duration_s: '183', encrypted: 'true', destination: 'S3/us-east-1' },
    log_id: 'log_00009',
  },
  {
    id: '10',
    timestamp: '2025-01-15T10:45:39Z',
    action: 'phi.unauthorized_access_attempt',
    category: 'security',
    severity: 'critical',
    actor: { id: 'u33', name: 'Sam Rivera', email: 'sam@mindfulclinic.com', role: 'therapist' },
    target: { type: 'patient', id: 'p099', label: 'Patient #P-2024-0099' },
    org: { id: 'org4', name: 'Mindful Clinic' },
    outcome: 'failure',
    ip_address: '192.168.1.88',
    user_agent: 'Chrome/121.0',
    geo: 'Chicago, IL',
    details: 'Access to patient records denied — patient not assigned to this therapist',
    metadata: { reason: 'not_treating_provider', access_type: 'session_notes' },
    log_id: 'log_00010',
  },
  {
    id: '11',
    timestamp: '2025-01-15T10:12:04Z',
    action: 'org.created',
    category: 'org_management',
    severity: 'info',
    actor: { id: 'a1', name: 'Alex Kim', email: 'alex@24therapy.com', role: 'super_admin' },
    target: { type: 'organization', id: 'org9', label: 'Summit Mental Health Group' },
    outcome: 'success',
    ip_address: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (Macintosh)',
    geo: 'San Francisco, CA',
    details: 'New organization onboarded — Enterprise plan, 25 seats',
    metadata: { plan: 'enterprise', seats: '25', onboarding_source: 'sales_crm' },
    log_id: 'log_00011',
  },
  {
    id: '12',
    timestamp: '2025-01-15T09:30:17Z',
    action: 'auth.mfa_disabled',
    category: 'security',
    severity: 'high',
    actor: { id: 'u55', name: 'Casey Morgan', email: 'casey@riverflow.com', role: 'org_admin' },
    target: { type: 'user', id: 'u55', label: 'Casey Morgan (self)' },
    org: { id: 'org6', name: 'River Flow Therapy' },
    outcome: 'warning',
    ip_address: '198.51.100.7',
    user_agent: 'Firefox/122.0',
    geo: 'Portland, OR',
    details: 'MFA disabled for account — HIPAA compliance risk; notification sent to org admin',
    metadata: { mfa_method: 'totp', warning_sent: 'true', compliance_flag: 'HIPAA-MFA-001' },
    log_id: 'log_00012',
  },
  {
    id: '13',
    timestamp: '2025-01-15T08:55:42Z',
    action: 'data.patient_record_deleted',
    category: 'patient_data',
    severity: 'critical',
    actor: { id: 'u14', name: 'Jordan Price', email: 'jordan@serenehealth.com', role: 'org_admin' },
    target: { type: 'patient', id: 'p188', label: 'Patient #P-2024-0188 (GDPR erasure)' },
    org: { id: 'org2', name: 'Serene Health Partners' },
    outcome: 'success',
    ip_address: '172.16.10.5',
    user_agent: 'Chrome/121.0',
    geo: 'Austin, TX',
    details: 'Patient record permanently deleted per GDPR Article 17 right-to-erasure request',
    metadata: { request_id: 'gdpr_0022', verified_identity: 'true', retention_check: 'passed' },
    log_id: 'log_00013',
  },
  {
    id: '14',
    timestamp: '2025-01-15T08:22:19Z',
    action: 'system.config_changed',
    category: 'system_config',
    severity: 'high',
    actor: { id: 'a1', name: 'Alex Kim', email: 'alex@24therapy.com', role: 'super_admin' },
    target: { type: 'config', id: 'sys_cfg_session_timeout', label: 'Session Timeout Config' },
    outcome: 'success',
    ip_address: '10.0.0.1',
    user_agent: 'Mozilla/5.0 (Macintosh)',
    geo: 'San Francisco, CA',
    details: 'Global session timeout reduced from 8 hours to 4 hours for HIPAA compliance',
    metadata: { from_value: '480min', to_value: '240min', affected_users: '1,247' },
    log_id: 'log_00014',
  },
  {
    id: '15',
    timestamp: '2025-01-14T23:11:05Z',
    action: 'auth.api_key_revoked',
    category: 'authentication',
    severity: 'medium',
    actor: { id: 'a2', name: 'Morgan Lee', email: 'morgan@24therapy.com', role: 'admin' },
    target: { type: 'config', id: 'ak_0044', label: 'API Key ak_live_...8c3f' },
    org: { id: 'org7', name: 'Clarity Behavioral Health' },
    outcome: 'success',
    ip_address: '10.0.0.4',
    user_agent: 'Mozilla/5.0',
    geo: 'San Francisco, CA',
    details: 'API key revoked — suspected exposure in public GitHub repository',
    metadata: { key_age_days: '142', last_used: '2025-01-14', rotation_reason: 'suspected_exposure' },
    log_id: 'log_00015',
  },
];

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
  const PAGE_SIZE = 10;

  // Stats
  const stats = useMemo(() => {
    const critical = AUDIT_DATA.filter(e => e.severity === 'critical').length;
    const failures = AUDIT_DATA.filter(e => e.outcome === 'failure').length;
    const phiEvents = AUDIT_DATA.filter(e => e.category === 'phi_access' || e.category === 'patient_data').length;
    const securityAlerts = AUDIT_DATA.filter(e => e.category === 'security').length;
    return { critical, failures, phiEvents, securityAlerts, total: AUDIT_DATA.length };
  }, []);

  // Unique orgs for filter
  const orgs = useMemo(() => {
    const seen = new Map<string, string>();
    AUDIT_DATA.forEach(e => { if (e.org) seen.set(e.org.id, e.org.name); });
    return Array.from(seen.entries());
  }, []);

  // Filtered data
  const filtered = useMemo(() => {
    return AUDIT_DATA.filter(e => {
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
          <button className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
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
            <span className="font-medium text-gray-900">{AUDIT_DATA.length}</span> events
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
              {paginated.length > 0 ? (
                paginated.map(entry => <AuditRow key={entry.id} entry={entry} />)
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No audit events match your filters</p>
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
