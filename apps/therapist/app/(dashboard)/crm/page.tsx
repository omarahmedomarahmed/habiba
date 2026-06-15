'use client';

import { useState, useEffect } from 'react';
import {
  Users, Search, Plus, Phone, Mail, Building2, Globe, TrendingUp,
  Calendar, ChevronRight, ArrowRight, CheckCircle, Clock,
  Star, DollarSign, MessageSquare, BarChart2, Target, Edit,
  Eye, MoreHorizontal, Filter, Download, Zap
} from 'lucide-react';

interface Lead {
  id: string; name: string; company: string; title: string;
  email: string; phone: string; stage: string; source: string; value: number;
  practice_size: number; country: string; city: string;
  last_contact: string; created: string; assigned_to: string; notes: string; score: number;
}

const STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-gray-700' },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-700' },
  { id: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-purple-700' },
  { id: 'proposal_sent', label: 'Proposal Sent', color: 'bg-amber-700' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-700' },
  { id: 'won', label: 'Won ✓', color: 'bg-green-700' },
  { id: 'lost', label: 'Lost', color: 'bg-red-700' },
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
  const [leads, setLeads] = useState<Lead[]>([]);

  // No backend CRM endpoint yet — leads populated when API is available
  useEffect(() => { setLeads([]); }, []);

  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.company.toLowerCase().includes(search.toLowerCase())
  );

  const totalPipelineValue = leads.filter(l => !['won', 'lost'].includes(l.stage))
    .reduce((acc, l) => acc + l.value, 0);

  const wonRevenue = leads.filter(l => l.stage === 'won')
    .reduce((acc, l) => acc + l.value, 0);

  const selectedLeadData = selectedLead ? leads.find(l => l.id === selectedLead) : null;

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
          { label: 'Total Leads', value: leads.length, icon: Users, color: 'text-white' },
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
            const stageLeads = leads.filter(l => l.stage === stage.id);
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
                {leads.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">No pipeline data yet.</p>
                ) : STAGES.map((stage) => {
                  const count = leads.filter(l => l.stage === stage.id).length;
                  const value = leads.filter(l => l.stage === stage.id).reduce((a, l) => a + l.value, 0);
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
                          style={{ width: `${leads.length ? (count / leads.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Lead Sources</h3>
              {leads.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No source data yet.</p>
              ) : (
                <div className="space-y-3">
                  {Array.from(new Set(leads.map(l => l.source))).map((source, i) => {
                    const count = leads.filter(l => l.source === source).length;
                    const colors = ['bg-blue-500','bg-green-500','bg-purple-500','bg-amber-500','bg-cyan-500','bg-gray-500'];
                    return (
                      <div key={source} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${colors[i % colors.length]}`} />
                        <span className="text-xs text-gray-300 flex-1">{source}</span>
                        <span className="text-xs text-white font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Activities</h3>
            {leads.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No recent activities yet.</p>
            ) : (
              <div className="space-y-3">
                {leads.slice(0, 5).map((lead, i) => (
                  <div key={lead.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                    <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm text-white capitalize">{lead.stage.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-500 ml-2">— {lead.name}</span>
                    </div>
                    <span className="text-xs text-gray-600">{lead.last_contact}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
