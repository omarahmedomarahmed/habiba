'use client';

import { useState } from 'react';
import {
  User, Search, CheckCircle, XCircle, Clock, Star,
  Eye, FileText, Shield, Phone, Mail, Globe, Award,
  AlertTriangle, MoreHorizontal, Download, Filter,
  TrendingUp, Users, Calendar, ChevronRight
} from 'lucide-react';

const THERAPISTS = [
  {
    id: '1', name: 'Dr. Sarah Thompson', email: 'sarah.thompson@mindfulwellness.com',
    license: 'LPC-8892', state: 'New York, US', specializations: ['Anxiety', 'Depression', 'Trauma'],
    status: 'verified', application_date: '2024-01-10', verified_date: '2024-01-15',
    sessions_total: 248, patients: 32, rating: 4.9, reviews: 64,
    years_experience: 8, organization: 'Mindful Wellness Clinic',
    insurance: ['Aetna', 'BlueCross', 'United'],
    documents: { license: 'verified', degree: 'verified', id: 'verified', insurance: 'verified' },
    background_check: 'passed', revenue_generated: 48600,
  },
  {
    id: '2', name: 'Dr. James Rodriguez', email: 'james.r@brightmind.health',
    license: 'LMFT-44231', state: 'California, US', specializations: ['PTSD', 'Couples', 'Grief'],
    status: 'verified', application_date: '2023-09-15', verified_date: '2023-09-22',
    sessions_total: 412, patients: 58, rating: 4.8, reviews: 102,
    years_experience: 12, organization: 'BrightMind Behavioral Health',
    insurance: ['Kaiser', 'Medi-Cal', 'TRICARE'],
    documents: { license: 'verified', degree: 'verified', id: 'verified', insurance: 'verified' },
    background_check: 'passed', revenue_generated: 87400,
  },
  {
    id: '3', name: 'Dr. Mark Williams', email: 'mark.w@calmpath.co.uk',
    license: 'BACP-99841', state: 'London, UK', specializations: ['CBT', 'Mindfulness', 'OCD'],
    status: 'pending', application_date: '2024-05-01', verified_date: null,
    sessions_total: 0, patients: 0, rating: 0, reviews: 0,
    years_experience: 5, organization: 'Calm Path Counseling',
    insurance: [],
    documents: { license: 'pending', degree: 'verified', id: 'verified', insurance: 'missing' },
    background_check: 'pending', revenue_generated: 0,
  },
  {
    id: '4', name: 'Dr. Anna Petrova', email: 'a.petrova@novamind.au',
    license: 'APS-22441', state: 'Sydney, AU', specializations: ['Depression', 'Addiction'],
    status: 'suspended', application_date: '2023-11-25', verified_date: '2023-11-30',
    sessions_total: 89, patients: 14, rating: 3.8, reviews: 22,
    years_experience: 6, organization: 'NovaMind Therapy',
    insurance: [],
    documents: { license: 'verified', degree: 'verified', id: 'verified', insurance: 'expired' },
    background_check: 'passed', revenue_generated: 12400,
  },
];

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-green-400/20 text-green-300',
  pending: 'bg-amber-400/20 text-amber-300',
  under_review: 'bg-blue-400/20 text-blue-300',
  suspended: 'bg-red-400/20 text-red-300',
  rejected: 'bg-gray-400/20 text-gray-400',
};

const DOC_STATUS: Record<string, string> = {
  verified: 'text-green-400',
  pending: 'text-amber-400',
  missing: 'text-red-400',
  expired: 'text-orange-400',
};

export default function TherapistsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = THERAPISTS.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      t.organization.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Therapist Management & Verification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Credential verification · License management · Performance monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Therapists', value: THERAPISTS.length, color: 'text-white' },
          { label: 'Verified', value: THERAPISTS.filter(t => t.status === 'verified').length, color: 'text-green-400' },
          { label: 'Pending Verification', value: THERAPISTS.filter(t => t.status === 'pending').length, color: 'text-amber-400' },
          { label: 'Suspended', value: THERAPISTS.filter(t => t.status === 'suspended').length, color: 'text-red-400' },
          { label: 'Avg Rating', value: '4.5 ★', color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search therapists..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Therapists List */}
      <div className="space-y-4">
        {filtered.map((therapist) => (
          <div
            key={therapist.id}
            className={`bg-gray-900 border rounded-xl p-5 transition-all cursor-pointer ${
              selected === therapist.id ? 'border-blue-500/50' : 'border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setSelected(selected === therapist.id ? null : therapist.id)}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-white text-base font-bold shrink-0">
                {therapist.name.charAt(0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-base font-semibold text-white">{therapist.name}</span>
                  {therapist.status === 'verified' && (
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[therapist.status]}`}>
                    {therapist.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{therapist.organization} · {therapist.state}</div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-gray-400">License: <span className="text-white font-mono">{therapist.license}</span></span>
                  {therapist.rating > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-300">
                      <Star className="w-3 h-3" />
                      {therapist.rating} ({therapist.reviews})
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{therapist.sessions_total} sessions</span>
                  <span className="text-xs text-gray-400">{therapist.patients} patients</span>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {therapist.specializations.map((s) => (
                    <span key={s} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-white">
                  {therapist.revenue_generated > 0 ? `$${therapist.revenue_generated.toLocaleString()}` : '—'}
                </div>
                <div className="text-xs text-gray-500">revenue generated</div>
                <ChevronRight className={`w-4 h-4 text-gray-500 mt-2 ml-auto transition-transform ${selected === therapist.id ? 'rotate-90' : ''}`} />
              </div>
            </div>

            {/* Expanded Details */}
            {selected === therapist.id && (
              <div className="mt-5 pt-5 border-t border-gray-800 grid grid-cols-3 gap-6">
                {/* Documents */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Document Verification</h4>
                  <div className="space-y-2">
                    {Object.entries(therapist.documents).map(([doc, status]) => (
                      <div key={doc} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 capitalize">{doc.replace('_', ' ')}</span>
                        <span className={`text-xs font-semibold capitalize ${DOC_STATUS[status]}`}>
                          {status}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-800">
                      <span className="text-xs text-gray-400">Background Check</span>
                      <span className={`text-xs font-semibold capitalize ${
                        therapist.background_check === 'passed' ? 'text-green-400' :
                        therapist.background_check === 'pending' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {therapist.background_check}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Insurance */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Insurance Networks</h4>
                  {therapist.insurance.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {therapist.insurance.map((ins) => (
                        <span key={ins} className="text-[10px] bg-green-400/10 text-green-300 border border-green-400/20 px-2 py-0.5 rounded">
                          {ins}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">No insurance networks listed</span>
                  )}
                </div>

                {/* Actions */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Actions</h4>
                  <div className="space-y-2">
                    {therapist.status === 'pending' && (
                      <>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium transition-all">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve & Verify
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-all">
                          <XCircle className="w-3.5 h-3.5" />
                          Reject Application
                        </button>
                      </>
                    )}
                    <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                      <Eye className="w-3.5 h-3.5" />
                      View Full Profile
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                      <Mail className="w-3.5 h-3.5" />
                      Send Email
                    </button>
                    {therapist.status === 'verified' && (
                      <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/30 text-red-300 hover:text-red-200 rounded-lg text-xs transition-all">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Suspend Account
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
