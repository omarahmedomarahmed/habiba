'use client';

import { useState } from 'react';
import {
  Store, Star, Download, Eye, CheckCircle, XCircle, Clock,
  Plus, Search, Filter, TrendingUp, DollarSign, Users,
  BarChart2, Package, Globe, ArrowUp, Shield, Zap
} from 'lucide-react';

const MARKETPLACE_STATS = {
  total_tools: 48,
  active_tools: 34,
  pending_review: 5,
  total_installs: 18420,
  revenue_this_month: 24800,
  avg_rating: 4.6,
};

const TOOLS = [
  {
    id: '1', name: 'Advanced SOAP Note Generator', category: 'AI Notes', version: '2.4.1',
    publisher: '24Therapy Team', status: 'published', installs: 2840,
    rating: 4.9, reviews: 142, price: 'included', type: 'ai_tool',
    description: 'Enterprise-grade SOAP note generation with DSM-5 alignment and multi-session context.',
  },
  {
    id: '2', name: 'CBT Worksheet Engine', category: 'Treatment Tools', version: '1.8.0',
    publisher: 'TherapyTools Inc.', status: 'published', installs: 1640,
    rating: 4.7, reviews: 89, price: '$29/mo', type: 'addon',
    description: 'Automated CBT worksheet generation and assignment with progress tracking.',
  },
  {
    id: '3', name: 'Crisis Safety Plan Builder', category: 'Safety', version: '1.2.3',
    publisher: 'SafeMind Labs', status: 'published', installs: 980,
    rating: 4.8, reviews: 67, price: 'free', type: 'safety',
    description: 'Collaborative crisis safety plan creation with patient sign-off and therapist alerts.',
  },
  {
    id: '4', name: 'Sleep Pattern Analyzer', category: 'Assessments', version: '3.1.0',
    publisher: 'SleepCo', status: 'published', installs: 724,
    rating: 4.5, reviews: 41, price: '$19/mo', type: 'assessment',
    description: 'AI-powered sleep pattern analysis from patient self-reports and wearable integration.',
  },
  {
    id: '5', name: 'EHR Bridge — Epic', category: 'Integrations', version: '0.9.2',
    publisher: 'HealthBridge Systems', status: 'pending_review', installs: 0,
    rating: 0, reviews: 0, price: 'Enterprise', type: 'integration',
    description: 'Bidirectional integration with Epic EHR for session notes, medications, and billing.',
  },
  {
    id: '6', name: 'Mindfulness Exercises Library', category: 'Patient Tools', version: '2.0.1',
    publisher: 'MindfulPath', status: 'published', installs: 3280,
    rating: 4.6, reviews: 198, price: 'free', type: 'patient_tool',
    description: 'Library of 200+ guided mindfulness exercises with therapist prescription tools.',
  },
  {
    id: '7', name: 'Insurance Billing Automation', category: 'Billing', version: '1.5.0',
    publisher: 'BillRight Inc.', status: 'pending_review', installs: 0,
    rating: 0, reviews: 0, price: '$49/mo', type: 'billing',
    description: 'Automated insurance claim submission and tracking with ICD-10/CPT codes.',
  },
  {
    id: '8', name: 'Custom Assessment Builder', category: 'Assessments', version: '1.1.0',
    publisher: '24Therapy Team', status: 'published', installs: 1120,
    rating: 4.4, reviews: 56, price: 'Pro+', type: 'ai_tool',
    description: 'Build custom assessment forms with scoring logic and automated analysis.',
  },
];

const CATEGORY_FILTERS = ['All', 'AI Notes', 'Treatment Tools', 'Safety', 'Assessments', 'Integrations', 'Billing', 'Patient Tools'];

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-400/20 text-green-300',
  pending_review: 'bg-amber-400/20 text-amber-300',
  rejected: 'bg-red-400/20 text-red-300',
  deprecated: 'bg-gray-400/20 text-gray-400',
};

const TYPE_COLORS: Record<string, string> = {
  ai_tool: 'text-purple-400',
  addon: 'text-blue-400',
  safety: 'text-red-400',
  assessment: 'text-amber-400',
  integration: 'text-cyan-400',
  billing: 'text-green-400',
  patient_tool: 'text-pink-400',
};

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<'tools' | 'analytics' | 'review'>('tools');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const filtered = TOOLS.filter((tool) => {
    const matchSearch = tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'All' || tool.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const pendingReview = TOOLS.filter(t => t.status === 'pending_review');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-400" />
            Marketplace
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage tools, integrations, and third-party add-ons
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-500 hover:to-blue-500 transition-all">
            <Plus className="w-4 h-4" />
            Add Tool
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-4">
        {[
          { label: 'Total Tools', value: MARKETPLACE_STATS.total_tools, icon: Package, color: 'text-white' },
          { label: 'Published', value: MARKETPLACE_STATS.active_tools, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Pending Review', value: MARKETPLACE_STATS.pending_review, icon: Clock, color: 'text-amber-400' },
          { label: 'Total Installs', value: MARKETPLACE_STATS.total_installs.toLocaleString(), icon: Download, color: 'text-blue-400' },
          { label: 'Revenue/Mo', value: `$${MARKETPLACE_STATS.revenue_this_month.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Avg Rating', value: `${MARKETPLACE_STATS.avg_rating} ★`, icon: Star, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 p-1 rounded-xl w-fit">
        {[
          { id: 'tools', label: 'All Tools', icon: Store },
          { id: 'analytics', label: 'Analytics', icon: BarChart2 },
          { id: 'review', label: `Pending Review (${pendingReview.length})`, icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tools Tab */}
      {activeTab === 'tools' && (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex gap-1.5">
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryFilter === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {filtered.map((tool) => (
              <div key={tool.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center">
                      <Package className={`w-5 h-5 ${TYPE_COLORS[tool.type] || 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{tool.name}</div>
                      <div className="text-xs text-gray-500">{tool.publisher} · v{tool.version}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[tool.status]}`}>
                    {tool.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mb-4 leading-relaxed">{tool.description}</p>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    <span className="text-white font-medium">{tool.rating > 0 ? tool.rating : '—'}</span>
                    <span className="text-gray-600">({tool.reviews})</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <Download className="w-3 h-3" />
                    <span>{tool.installs.toLocaleString()} installs</span>
                  </div>
                  <div className="ml-auto">
                    <span className={`font-semibold ${
                      tool.price === 'included' || tool.price === 'free' ? 'text-green-400' :
                      tool.price === 'Enterprise' ? 'text-purple-400' : 'text-white'
                    }`}>
                      {tool.price}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="flex-1 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-all">
                    <Eye className="w-3 h-3 inline mr-1" />
                    View Details
                  </button>
                  {tool.status === 'published' && (
                    <button className="px-3 py-1.5 bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-all">
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pending Review Tab */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {pendingReview.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">No Pending Reviews</h3>
              <p className="text-sm text-gray-500">All submitted tools have been reviewed.</p>
            </div>
          ) : (
            pendingReview.map((tool) => (
              <div key={tool.id} className="bg-gray-900 border border-amber-700/30 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{tool.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{tool.publisher} · {tool.category} · v{tool.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                      PENDING REVIEW
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">{tool.description}</p>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-all">
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-all">
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-all">
                    <Eye className="w-4 h-4" />
                    Full Review
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Most Installed', tool: 'Mindfulness Exercises Library', installs: 3280, growth: 24 },
              { label: 'Highest Rated', tool: 'Advanced SOAP Note Generator', rating: 4.9, reviews: 142 },
              { label: 'Top Revenue', tool: 'CBT Worksheet Engine', revenue: '$8,240/mo', growth: 18 },
            ].map(({ label, tool, ...rest }, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="text-xs text-gray-500 mb-2">{label}</div>
                <div className="text-sm font-semibold text-white mb-1">{tool}</div>
                {Object.entries(rest).map(([k, v]) => (
                  <div key={k} className="text-xs text-gray-400">
                    {k}: <span className="text-white">{String(v)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
