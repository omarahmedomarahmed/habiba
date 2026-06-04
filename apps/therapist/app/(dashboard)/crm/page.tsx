'use client';

import { useState } from 'react';
import {
  Users, Search, Plus, Phone, Mail, Building2, Globe, TrendingUp,
  Calendar, ChevronRight, ArrowRight, CheckCircle, Clock,
  Star, DollarSign, MessageSquare, BarChart2, Target, Edit,
  Eye, MoreHorizontal, Filter, Download, Zap
} from 'lucide-react';

const LEADS = [
  {
    id: '1', name: 'Dr. Jennifer Walsh', company: 'Serenity Mental Health', title: 'Founder',
    email: 'j.walsh@serenity.com', phone: '+1 617 555 0192',
    stage: 'demo_scheduled', source: 'LinkedIn Outreach', value: 1200,
    practice_size: 8, country: 'US', city: 'Boston',
    last_contact: '2h ago', created: '2024-05-28',
    assigned_to: 'Sales Rep A', notes: 'Highly interested in AI notes. Has 8 therapists. Trial ASAP.',
    score: 92,
  },
  {
    id: '2', name: 'Dr. Robert Chen', company: 'Pacific Mind Clinic', title: 'Clinical Director',
    email: 'r.chen@pacificmind.com', phone: '+1 415 555 0284',
    stage: 'proposal_sent', source: 'Referral', value: 8900,
    practice_size: 24, country: 'US', city: 'San Francisco',
    last_contact: '1d ago', created: '2024-05-20',
    assigned_to: 'Sales Rep B', notes: 'Enterprise deal. 24 therapists + admin staff. Strong EHR integration need.',
    score: 88,
  },
  {
    id: '3', name: 'Dr. Maya Singh', company: 'Mindful Path UK', title: 'CEO',
    email: 'm.singh@mindfulpath.uk', phone: '+44 20 7946 0102',
    stage: 'qualified', source: 'Website Demo Request', value: 3600,
    practice_size: 12, country: 'UK', city: 'London',
    last_contact: '3d ago', created: '2024-05-15',
    assigned_to: 'Sales Rep A', notes: 'UK expansion opportunity. GDPR compliance questions.',
    score: 76,
  },
  {
    id: '4', name: 'Dr. Hassan Al-Rashid', company: 'Noor Therapy Center', title: 'Owner',
    email: 'h.rashid@noortherapy.ae', phone: '+971 4 555 0291',
    stage: 'new', source: 'Conference — IAPSP 2024', value: 5000,
    practice_size: 15, country: 'UAE', city: 'Dubai',
    last_contact: '1w ago', created: '2024-05-10',
    assigned_to: 'Sales Rep B', notes: 'Arabic language support is critical. Growing market.',
    score: 71,
  },
  {
    id: '5', name: 'Sarah Kim', company: 'TheraTech Solutions', title: 'CTO',
    email: 's.kim@theratech.io', phone: '+1 212 555 0104',
    stage: 'won', source: 'API Partnership', value: 24000,
    practice_size: 50, country: 'US', city: 'New York',
    last_contact: '5d ago', created: '2024-04-01',
    assigned_to: 'Sales Rep A', notes: 'Enterprise API deal. Integration with their existing platform.',
    score: 100,
  },
  {
    id: '6', name: 'Dr. Clara Müller', company: 'Gesundheit Praxis', title: 'Director',
    email: 'c.muller@gesundheit.de', phone: '+49 30 555 0182',
    stage: 'lost', source: 'Cold Outreach', value: 0,
    practice_size: 6, country: 'DE', city: 'Berlin',
    last_contact: '2w ago', created: '2024-04-20',
    assigned_to: 'Sales Rep B', notes: 'Lost to competitor. No German language support was blocker.',
    score: 0,
  },
];

const STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-gray-700', count: 1 },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-700', count: 1 },
  { id: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-purple-700', count: 1 },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-700', count: 1 },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-700', count: 0 },
  { id: 'won', label: 'Won ✓', color: 'bg-green-700', count: 1 },
  { id: 'lost', label: 'Lost', color: 'bg-red-700', count: 1 },
];

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-400/20 text-gray-300',
  qualified: 'bg-blue-400/20 text-blue-300',
  demo_scheduled: 'bg-purple-400/20 text-purple-300',
  demo_completed: 'bg-violet-400/20 text-violet-300',
  proposal_sent: 'bg-amber-400/20 text-amber-300',
  negotiation: 'bg-orange-400/20 text-orange-300',
  won: 'bg-green-400/20 text-green-300',
  lost: 'bg-red-400/20 text-red-300',
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New Lead', qualified: 'Qualified', demo_scheduled: 'Demo Scheduled',
  demo_completed: 'Demo Done', proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
};

export default function CRMPage() {
  const [view, setView] = useState<'pipeline' | 'list' | 'analytics'>('pipeline');
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<string | null>(null);

  const filteredLeads = LEADS.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.company.toLowerCase().includes(search.toLowerCase())
  );

  const totalPipelineValue = LEADS.filter(l => !['won', 'lost'].includes(l.stage))
    .reduce((acc, l) => acc + l.value, 0);

  const wonRevenue = LEADS.filter(l => l.stage === 'won')
    .reduce((acc, l) => acc + l.value, 0);

  const selectedLeadData = selectedLead ? LEADS.find(l => l.id === selectedLead) : null;

  return (
    <div className="p-6 space-y-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            CRM & Sales Pipeline
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Lead management · Demo tracking · Pipeline analytics
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-lg">
            {[
              { id: 'pipeline', label: 'Pipeline' },
              { id: 'list', label: 'List' },
              { id: 'analytics', label: 'Analytics' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id as any)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  view === id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-500 hover:to-blue-500 transition-all">
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Leads', value: LEADS.length, icon: Users, color: 'text-white' },
          { label: 'Pipeline Value', value: `$${(totalPipelineValue / 1000).toFixed(1)}K/mo`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Won Revenue', value: `$${(wonRevenue / 1000).toFixed(0)}K/mo`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Win Rate', value: '28%', icon: Star, color: 'text-amber-400' },
          { label: 'Avg Deal Size', value: '$5.4K', icon: BarChart2, color: 'text-purple-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline View */}
      {view === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const stageLeads = LEADS.filter(l => l.stage === stage.id);
            const stageValue = stageLeads.reduce((acc, l) => acc + l.value, 0);
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <span className="text-xs font-semibold text-gray-300">{stage.label}</span>
                    <span className="text-xs text-gray-600">{stageLeads.length}</span>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs text-gray-500">${(stageValue / 1000).toFixed(1)}K</span>
                  )}
                </div>
                <div className="space-y-2">
                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`bg-gray-900 border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedLead === lead.id ? 'border-purple-500/50' : 'border-gray-800 hover:border-gray-700'
                      }`}
                      onClick={() => setSelectedLead(selectedLead === lead.id ? null : lead.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-medium text-white">{lead.name}</div>
                          <div className="text-xs text-gray-500">{lead.company}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-green-300">${(lead.value / 1000).toFixed(1)}K</div>
                          <div className="text-[10px] text-gray-600">/mo</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          {lead.practice_size} therapists
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Globe className="w-3 h-3" />
                          {lead.country}
                        </div>
                      </div>
                      {lead.score > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500">Lead Score</span>
                            <span className={`text-[10px] font-bold ${
                              lead.score >= 80 ? 'text-green-400' : lead.score >= 60 ? 'text-amber-400' : 'text-gray-400'
                            }`}>
                              {lead.score}
                            </span>
                          </div>
                          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                lead.score >= 80 ? 'bg-green-500' : lead.score >= 60 ? 'bg-amber-500' : 'bg-gray-500'
                              }`}
                              style={{ width: `${lead.score}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {stageLeads.length === 0 && (
                    <div className="border border-dashed border-gray-800 rounded-xl p-4 text-center">
                      <span className="text-xs text-gray-600">No leads</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Lead</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stage</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Last Contact</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-800/50 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center text-purple-300 text-xs font-bold shrink-0">
                          {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{lead.name}</div>
                          <div className="text-xs text-gray-500">{lead.company} · {lead.country}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLORS[lead.stage] || 'bg-gray-400/20 text-gray-300'}`}>
                        {STAGE_LABELS[lead.stage] || lead.stage}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-white">
                        {lead.value > 0 ? `$${(lead.value / 1000).toFixed(1)}K/mo` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-400">{lead.source}</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {lead.score > 0 ? (
                        <span className={`text-xs font-bold ${
                          lead.score >= 80 ? 'text-green-400' : lead.score >= 60 ? 'text-amber-400' : 'text-gray-400'
                        }`}>
                          {lead.score}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-400">{lead.last_contact}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics View */}
      {view === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Pipeline by Stage</h3>
              <div className="space-y-3">
                {STAGES.map((stage) => {
                  const count = LEADS.filter(l => l.stage === stage.id).length;
                  const value = LEADS.filter(l => l.stage === stage.id).reduce((a, l) => a + l.value, 0);
                  return (
                    <div key={stage.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                          <span className="text-xs text-gray-300">{stage.label}</span>
                          <span className="text-[10px] text-gray-600">{count} leads</span>
                        </div>
                        <span className="text-xs text-white font-medium">
                          {value > 0 ? `$${(value / 1000).toFixed(1)}K` : '—'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${stage.color}`}
                          style={{ width: `${(count / LEADS.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Lead Sources</h3>
              <div className="space-y-3">
                {[
                  { source: 'LinkedIn Outreach', count: 1, color: 'bg-blue-500' },
                  { source: 'Website Demo Request', count: 1, color: 'bg-green-500' },
                  { source: 'Referral', count: 1, color: 'bg-purple-500' },
                  { source: 'Conference', count: 1, color: 'bg-amber-500' },
                  { source: 'API Partnership', count: 1, color: 'bg-cyan-500' },
                  { source: 'Cold Outreach', count: 1, color: 'bg-gray-500' },
                ].map(({ source, count, color }) => (
                  <div key={source} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-xs text-gray-300 flex-1">{source}</span>
                    <span className="text-xs text-white font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Activities</h3>
            <div className="space-y-3">
              {[
                { action: 'Demo scheduled', contact: 'Dr. Jennifer Walsh', time: '2h ago', icon: Calendar, color: 'text-purple-400' },
                { action: 'Proposal sent', contact: 'Dr. Robert Chen', time: '1d ago', icon: Mail, color: 'text-blue-400' },
                { action: 'Won deal', contact: 'Sarah Kim — TheraTech', time: '5d ago', icon: CheckCircle, color: 'text-green-400' },
                { action: 'Lead qualified', contact: 'Dr. Maya Singh', time: '3d ago', icon: Star, color: 'text-amber-400' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                  <activity.icon className={`w-4 h-4 ${activity.color} shrink-0`} />
                  <div className="flex-1">
                    <span className="text-sm text-white">{activity.action}</span>
                    <span className="text-xs text-gray-500 ml-2">— {activity.contact}</span>
                  </div>
                  <span className="text-xs text-gray-600">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
