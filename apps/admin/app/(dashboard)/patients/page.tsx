'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Heart, RefreshCw, Download, Search, ChevronDown,
  X, CheckCircle, AlertCircle, Users, UserX, UserCheck, AlertTriangle
} from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { exportCSV } from '@/lib/csv';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email?: string;
  status: string;
  organization_id: string;
  organization_name: string;
  therapist_name?: string;
  session_count: number;
  latest_mood?: number;
  created_at: string;
  last_login_at?: string;
}

interface PatientDetail extends Patient {
  user_created_at?: string;
  completed_sessions: number;
  total_sessions: number;
  consent_count: number;
}

interface PatientStats {
  total: number;
  active: number;
  inactive: number;
  no_therapist: number;
}

function StatCard({ icon: Icon, label, value, color = 'blue' }: { icon: React.ElementType; label: string; value: number; color?: string }) {
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
      <div className="text-2xl font-bold text-white">{value ?? 0}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Toast({ toast }: { toast: { type: 'success' | 'error'; message: string } | null }) {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border ${
      toast.type === 'success' ? 'bg-green-900/90 border-green-700/50 text-green-200' : 'bg-red-900/90 border-red-700/50 text-red-200'
    }`}>
      {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stats, setStats] = useState<PatientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<PatientDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'consents'>('overview');
  const [consents, setConsents] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await adminAPI.patients(params);
      setPatients(res.patients || []);
      setStats(res.stats || null);
    } catch {
      showToast('error', 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const openDetail = async (patient: Patient) => {
    setDetailLoading(true);
    setDetailTab('overview');
    setConsents([]);
    try {
      const detail = await adminAPI.getPatient(patient.id);
      setSelected(detail);
    } catch {
      showToast('error', 'Failed to load patient details');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadConsents = async () => {
    if (!selected) return;
    try {
      const data = await adminAPI.getPatientConsents(selected.id);
      setConsents(Array.isArray(data) ? data : []);
    } catch {
      setConsents([]);
    }
  };

  const handleTabChange = (tab: 'overview' | 'consents') => {
    setDetailTab(tab);
    if (tab === 'consents' && consents.length === 0) loadConsents();
  };

  const handleExport = () => {
    exportCSV(
      patients.map(p => ({
        id: p.id,
        name: p.full_name,
        email: p.email ?? '',
        status: p.status,
        organization: p.organization_name,
        therapist: p.therapist_name ?? '',
        sessions: p.session_count,
        latest_mood: p.latest_mood ?? '',
        created_at: p.created_at,
      })),
      `patients-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const fmt = (dt?: string) => dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <Toast toast={toast} />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" /> Platform Patients
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Cross-org patient management — PHI access is logged</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPatients} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Total Patients" value={stats?.total ?? 0} color="blue" />
        <StatCard icon={UserCheck} label="Active" value={stats?.active ?? 0} color="green" />
        <StatCard icon={UserX} label="Inactive" value={stats?.inactive ?? 0} color="amber" />
        <StatCard icon={AlertTriangle} label="No Therapist" value={stats?.no_therapist ?? 0} color="red" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" placeholder="Search patient name or email..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-rose-500" />
        </div>
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none pl-3 pr-8 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none">
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="pending">Pending</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Patient</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Org</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Therapist</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Sessions</th>
              <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Last Mood</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Loading patients...</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No patients found</td></tr>
            ) : patients.map(p => (
              <tr key={p.id} className="hover:bg-gray-800/40 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{p.full_name}</div>
                  {p.email && <div className="text-xs text-gray-500">{p.email}</div>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden md:table-cell">{p.organization_name}</td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden lg:table-cell">{p.therapist_name ?? <span className="text-red-400/70 text-xs">Unassigned</span>}</td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden lg:table-cell">{p.session_count}</td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden xl:table-cell">{p.latest_mood ? `${p.latest_mood}/10` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'active' ? 'text-green-400 bg-green-400/10' : 'text-gray-400 bg-gray-400/10'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openDetail(p)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white">
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Slide-Over */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={() => { setSelected(null); }}>
          <div className="w-full max-w-[480px] bg-gray-900 border-l border-gray-700 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Patient Details</h2>
              <button onClick={() => setSelected(null)} className="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* PHI warning */}
            <div className="mb-4 px-3 py-2 bg-amber-900/20 border border-amber-700/30 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-300">Accessing PHI — this access is logged to the audit trail</p>
            </div>

            {detailLoading ? (
              <div className="text-center py-12 text-gray-500">Loading patient data...</div>
            ) : selected ? (
              <>
                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-gray-800 p-1 rounded-lg">
                  {(['overview', 'consents'] as const).map(tab => (
                    <button key={tab} onClick={() => handleTabChange(tab)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${detailTab === tab ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                      <D label="Name" value={selected.full_name} />
                      <D label="Email" value={selected.email ?? '—'} />
                      <D label="Status" value={selected.status} />
                      <D label="Organization" value={selected.organization_name} />
                      <D label="Primary Therapist" value={selected.therapist_name ?? 'Unassigned'} />
                    </div>
                    <div className="bg-gray-800 rounded-xl p-4 space-y-3">
                      <D label="Total Sessions" value={String(selected.total_sessions ?? 0)} />
                      <D label="Completed Sessions" value={String(selected.completed_sessions ?? 0)} />
                      <D label="Consent Records" value={String(selected.consent_count ?? 0)} />
                      <D label="Patient Since" value={fmt(selected.created_at)} />
                      <D label="Last Login" value={fmt(selected.last_login_at)} />
                    </div>
                  </div>
                )}

                {detailTab === 'consents' && (
                  <div className="space-y-2">
                    {consents.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-sm">No consent records found</div>
                    ) : consents.map((c, i) => (
                      <div key={i} className="bg-gray-800 rounded-xl p-3 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">{c.consent_type ?? 'Unknown'}</span>
                          <span className={c.granted ? 'text-green-400' : 'text-red-400'}>{c.granted ? 'Granted' : 'Denied'}</span>
                        </div>
                        <div className="text-gray-600">{fmt(c.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function D({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-200 text-right">{value || '—'}</span>
    </div>
  );
}
