'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
import {
  Shield, AlertTriangle, CheckCircle, Clock, Eye, Download,
  Search, Filter, FileText, Lock, AlertCircle, ChevronRight,
  User, Calendar, Globe, Activity, XCircle, RefreshCw,
  ExternalLink, Ban, Key, Database
} from 'lucide-react';

const AUDIT_LOGS = [
  { id: '1', action: 'Viewed Patient Record', user: 'Dr. Sarah Thompson', user_id: 'u_1', resource: 'Patient', resource_id: 'p_128', org: 'Mindful Wellness', ip: '192.168.1.45', timestamp: '2024-06-04 14:23:11', risk: 'low', outcome: 'success' },
  { id: '2', action: 'Exported Session Transcript', user: 'Dr. James Rodriguez', user_id: 'u_2', resource: 'Transcript', resource_id: 't_891', org: 'BrightMind Health', ip: '10.0.2.15', timestamp: '2024-06-04 14:18:42', risk: 'high', outcome: 'success' },
  { id: '3', action: 'Modified Medication Record', user: 'Emily Chen', user_id: 'u_3', resource: 'Medication', resource_id: 'm_234', org: 'Horizon MH', ip: '172.16.5.88', timestamp: '2024-06-04 14:11:05', risk: 'medium', outcome: 'success' },
  { id: '4', action: 'Failed Login Attempt', user: 'anna.p@novamind.au', user_id: 'unknown', resource: 'Auth', resource_id: 'auth', org: 'NovaMind', ip: '134.56.89.12', timestamp: '2024-06-04 13:55:22', risk: 'high', outcome: 'failure' },
  { id: '5', action: 'Downloaded Recording', user: 'Dr. Mark Williams', user_id: 'u_4', resource: 'Recording', resource_id: 'r_445', org: 'Calm Path', ip: '89.243.5.102', timestamp: '2024-06-04 13:44:18', risk: 'high', outcome: 'success' },
  { id: '6', action: 'Created Treatment Plan', user: 'Dr. Sarah Thompson', user_id: 'u_1', resource: 'TreatmentPlan', resource_id: 'tp_89', org: 'Mindful Wellness', ip: '192.168.1.45', timestamp: '2024-06-04 13:30:00', risk: 'low', outcome: 'success' },
  { id: '7', action: 'Permission Escalation Attempt', user: 'Emily Chen', user_id: 'u_3', resource: 'Permission', resource_id: 'perm_admin', org: 'Horizon MH', ip: '172.16.5.88', timestamp: '2024-06-04 13:15:44', risk: 'critical', outcome: 'blocked' },
  { id: '8', action: 'Accessed AI Memory Layer', user: 'Dr. James Rodriguez', user_id: 'u_2', resource: 'Memory', resource_id: 'mem_batch', org: 'BrightMind Health', ip: '10.0.2.15', timestamp: '2024-06-04 12:58:33', risk: 'medium', outcome: 'success' },
];

const COMPLIANCE_FRAMEWORKS = [
  { name: 'HIPAA', status: 'compliant', last_review: '2024-05-15', score: 97, issues: 0, next_review: '2024-08-15' },
  { name: 'GDPR', status: 'compliant', last_review: '2024-04-20', score: 94, issues: 1, next_review: '2024-07-20' },
  { name: 'SOC 2 Type II', status: 'compliant', last_review: '2024-03-01', score: 96, issues: 0, next_review: '2024-09-01' },
  { name: 'HITECH', status: 'compliant', last_review: '2024-05-15', score: 98, issues: 0, next_review: '2024-08-15' },
  { name: 'ISO 27001', status: 'in_progress', last_review: '2024-01-10', score: 78, issues: 4, next_review: '2024-07-10' },
];

const CONSENT_RECORDS = [
  { id: '1', patient: 'Patient #P-1841', type: 'Recording Consent', version: '2.1', granted: '2024-05-12', ip: '85.204.x.x', status: 'active' },
  { id: '2', patient: 'Patient #P-2203', type: 'AI Processing Consent', version: '1.4', granted: '2024-05-20', ip: '91.124.x.x', status: 'active' },
  { id: '3', patient: 'Patient #P-891', type: 'Treatment Consent', version: '3.0', granted: '2024-04-08', ip: '192.168.x.x', status: 'active' },
  { id: '4', patient: 'Patient #P-3412', type: 'Data Processing', version: '2.0', granted: '2024-05-28', ip: '178.62.x.x', status: 'active' },
  { id: '5', patient: 'Patient #P-1129', type: 'Research Consent', version: '1.0', granted: '2024-03-14', ip: '95.223.x.x', status: 'withdrawn', withdrawn: '2024-05-01' },
];

const RISK_COLORS: Record<string, string> = {
  low: 'text-green-300 bg-green-400/10',
  medium: 'text-amber-300 bg-amber-400/10',
  high: 'text-red-300 bg-red-400/10',
  critical: 'text-red-200 bg-red-500/20 font-bold',
};

const OUTCOME_COLORS: Record<string, string> = {
  success: 'text-green-400',
  failure: 'text-red-400',
  blocked: 'text-orange-400',
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'audit' | 'frameworks' | 'consents' | 'incidents'>('audit');
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [liveAuditLogs, setLiveAuditLogs] = useState(AUDIT_LOGS);

  useEffect(() => {
    async function load() {
      try {
        const res = await adminAPI.phiAuditLog({ limit: 50 }) as { data: Record<string, unknown>[] };
        if (res.data?.length > 0) {
          setLiveAuditLogs(res.data.map(e => ({
            id: e.id as string,
            action: `${e.access_type} ${e.resource_type}`.trim(),
            user: (e.user_email as string) || (e.user_id as string) || 'Unknown',
            user_id: e.user_id as string,
            resource: (e.resource_type as string) || 'Unknown',
            resource_id: (e.resource_id as string) || '',
            org: (e.organization_name as string) || (e.organization_id as string) || '',
            ip: (e.ip_address as string) || '',
            timestamp: new Date(e.created_at as string).toLocaleString(),
            risk: 'low',
            outcome: 'success',
          })));
        }
      } catch { /* keep static fallback */ }
    }
    load();
  }, []);

  const filteredLogs = liveAuditLogs.filter(log => {
    const matchSearch = log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === 'all' || log.risk === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Compliance & Audit Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            HIPAA · GDPR · SOC 2 · HITECH — Immutable audit trail
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all">
            <FileText className="w-4 h-4" />
            Generate Audit Report
          </button>
        </div>
      </div>

      {/* Compliance Status Cards */}
      <div className="grid grid-cols-5 gap-4">
        {COMPLIANCE_FRAMEWORKS.map((fw) => (
          <div key={fw.name} className={`bg-gray-900 border rounded-xl p-4 ${
            fw.status === 'compliant' ? 'border-green-700/30' : 'border-amber-700/30'
          }`}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs font-semibold text-white">{fw.name}</span>
              {fw.status === 'compliant' ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <Clock className="w-4 h-4 text-amber-400" />
              )}
            </div>
            <div className={`text-2xl font-bold mb-1 ${
              fw.score >= 90 ? 'text-green-300' : fw.score >= 75 ? 'text-amber-300' : 'text-red-300'
            }`}>
              {fw.score}%
            </div>
            <div className="text-[10px] text-gray-500">
              {fw.issues > 0 ? (
                <span className="text-amber-400">{fw.issues} open issues</span>
              ) : (
                <span className="text-green-400">No issues</span>
              )}
            </div>
            <div className="text-[10px] text-gray-600 mt-1">Next: {fw.next_review}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
        {[
          { id: 'audit', label: 'Audit Logs', icon: Activity },
          { id: 'frameworks', label: 'Frameworks', icon: Shield },
          { id: 'consents', label: 'Consent Records', icon: FileText },
          { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audit logs..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Immutable — Cannot be modified
            </span>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Resource</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP Address</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Risk</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className={`hover:bg-gray-800/50 transition-colors ${
                    log.risk === 'critical' ? 'bg-red-900/10' : ''
                  }`}>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono text-gray-400">{log.timestamp}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-white">{log.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-300">{log.user}</div>
                      <div className="text-[10px] text-gray-600">{log.org}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400">{log.resource}</span>
                      <span className="text-[10px] text-gray-600 ml-1 font-mono">{log.resource_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500">{log.ip}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${RISK_COLORS[log.risk]}`}>
                        {log.risk}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium capitalize ${OUTCOME_COLORS[log.outcome]}`}>
                        {log.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consent Records Tab */}
      {activeTab === 'consents' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Consent Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Version</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Granted</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {CONSENT_RECORDS.map((record) => (
                <tr key={record.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono text-gray-300">{record.patient}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white">{record.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-400">v{record.version}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-400">{record.granted}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-gray-600">{record.ip}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      record.status === 'active' ? 'bg-green-400/20 text-green-300' :
                      'bg-red-400/20 text-red-300'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Frameworks Tab */}
      {activeTab === 'frameworks' && (
        <div className="grid grid-cols-1 gap-4">
          {COMPLIANCE_FRAMEWORKS.map((fw) => (
            <div key={fw.name} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {fw.status === 'compliant' ? (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  ) : (
                    <Clock className="w-6 h-6 text-amber-400" />
                  )}
                  <div>
                    <h3 className="text-base font-semibold text-white">{fw.name}</h3>
                    <p className="text-xs text-gray-500">Last reviewed: {fw.last_review}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${fw.score >= 90 ? 'text-green-300' : 'text-amber-300'}`}>
                    {fw.score}%
                  </div>
                  <div className={`text-xs capitalize ${fw.status === 'compliant' ? 'text-green-400' : 'text-amber-400'}`}>
                    {fw.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${fw.score >= 90 ? 'bg-green-500' : 'bg-amber-500'}`}
                  style={{ width: `${fw.score}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-500">
                  {fw.issues > 0 ? (
                    <span className="text-amber-400">{fw.issues} open issues require attention</span>
                  ) : 'All controls passing'}
                </span>
                <span className="text-xs text-gray-500">Next review: {fw.next_review}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incidents Tab */}
      {activeTab === 'incidents' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No Open Incidents</h3>
          <p className="text-sm text-gray-500">All security and compliance incidents have been resolved.</p>
          <button className="mt-4 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors">
            View Incident History
          </button>
        </div>
      )}
    </div>
  );
}
