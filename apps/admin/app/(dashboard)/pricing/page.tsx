'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Star, StarOff, GripVertical, CheckCircle, XCircle, Save,
  AlertTriangle, RefreshCw, TrendingUp, Users, BarChart2,
  ArrowUpDown, Tag, Zap, Shield, Brain, ChevronDown, ChevronUp,
  Eye, EyeOff, Copy, ExternalLink, Info, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubscriptionPlan, PlanFeatures, PlanAddOn } from '@/lib/pricing-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-24therapy-production.up.railway.app/api/v1';

// ─── Mock token for dev (will be replaced with real auth) ─────────────────────
const DEV_TOKEN = typeof window !== 'undefined'
  ? (window as Window & { __adminToken?: string }).__adminToken || 'dev-token'
  : 'dev-token';

// ─── Feature flags available for plans ────────────────────────────────────────
const FEATURE_OPTIONS = [
  { key: 'radar', label: 'Radar Matching', icon: Brain },
  { key: 'api_access', label: 'API Access', icon: Zap },
  { key: 'white_label', label: 'White Label', icon: Tag },
  { key: 'advanced_analytics', label: 'Advanced Analytics', icon: BarChart2 },
  { key: 'custom_branding', label: 'Custom Branding', icon: Star },
  { key: 'hipaa_baa', label: 'HIPAA BAA', icon: Shield },
  { key: 'sso', label: 'SSO / SAML', icon: Shield },
  { key: 'ehr_integration', label: 'EHR Integration', icon: Zap },
  { key: 'dedicated_support', label: 'Dedicated Support', icon: Users },
  { key: 'custom_ai', label: 'Custom AI Models', icon: Brain },
  { key: 'multi_location', label: 'Multi-Location', icon: Users },
  { key: 'video_rooms', label: 'Video Rooms', icon: Users },
  { key: 'mobile_app', label: 'Patient Mobile App', icon: Zap },
];

// ─── Plan metrics mock (will come from /billing/admin/plans/metrics) ──────────
interface PlanMetric {
  plan_key: string;
  active_subscriptions: number;
  mrr_contribution: number;
  cancelled_subscriptions: number;
}

// ─── Plan Editor Modal ─────────────────────────────────────────────────────────

interface PlanEditorProps {
  plan: Partial<SubscriptionPlan> | null;
  isNew: boolean;
  onSave: (data: Partial<SubscriptionPlan>) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function PlanEditor({ plan, isNew, onSave, onClose, saving }: PlanEditorProps) {
  const [form, setForm] = useState<Partial<SubscriptionPlan>>({
    plan_key: '',
    name: '',
    tagline: '',
    description: '',
    price_monthly_usd: undefined,
    price_annual_usd: undefined,
    max_therapists: undefined,
    max_patients: undefined,
    max_sessions_month: undefined,
    ai_notes_included: undefined,
    features: {},
    is_active: true,
    is_featured: false,
    badge_text: '',
    cta_text: 'Start Free Trial',
    trial_days: 14,
    highlight_color: null,
    add_ons: [],
    ...plan,
  });

  const [addOnForm, setAddOnForm] = useState({ name: '', price: '', description: '' });
  const [tab, setTab] = useState<'basic' | 'limits' | 'features' | 'addons' | 'display'>('basic');

  const set = (key: keyof SubscriptionPlan, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const toggleFeature = (key: string) =>
    setForm(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !(prev.features as PlanFeatures)?.[key] },
    }));

  const addAddon = () => {
    if (!addOnForm.name || !addOnForm.price) return;
    setForm(prev => ({
      ...prev,
      add_ons: [...(prev.add_ons || []), { ...addOnForm }],
    }));
    setAddOnForm({ name: '', price: '', description: '' });
  };

  const removeAddon = (i: number) =>
    setForm(prev => ({ ...prev, add_ons: prev.add_ons?.filter((_, idx) => idx !== i) }));

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'limits', label: 'Limits' },
    { id: 'features', label: 'Features' },
    { id: 'addons', label: 'Add-ons' },
    { id: 'display', label: 'Display' },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              {isNew ? 'Create New Plan' : `Edit Plan: ${form.name}`}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {isNew ? 'Configure a new subscription tier' : `Plan key: ${form.plan_key}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'py-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-px',
                tab === t.id
                  ? 'border-red-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Basic Info Tab */}
          {tab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Plan Key *</label>
                  <input
                    value={form.plan_key || ''}
                    onChange={e => set('plan_key', e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    disabled={!isNew}
                    placeholder="e.g. professional"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">Unique identifier, lowercase, no spaces</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Name *</label>
                  <input
                    value={form.name || ''}
                    onChange={e => set('name', e.target.value)}
                    placeholder="e.g. Professional"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Tagline</label>
                <input
                  value={form.tagline || ''}
                  onChange={e => set('tagline', e.target.value)}
                  placeholder="e.g. Full AI-powered practice management"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => set('description', e.target.value)}
                  rows={3}
                  placeholder="Detailed description for internal reference"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Monthly Price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.price_monthly_usd ?? ''}
                      onChange={e => set('price_monthly_usd', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="null = custom"
                      className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">Leave empty for custom/enterprise pricing</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Annual Price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={form.price_annual_usd ?? ''}
                      onChange={e => set('price_annual_usd', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="null = custom"
                      className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <p className="text-[11px] text-gray-600 mt-1">
                    {form.price_monthly_usd && form.price_annual_usd
                      ? `${Math.round((1 - form.price_annual_usd / (form.price_monthly_usd * 12)) * 100)}% savings`
                      : 'Annual discount applied at checkout'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Stripe Monthly Price ID</label>
                  <input
                    value={form.stripe_price_id_monthly || ''}
                    onChange={e => set('stripe_price_id_monthly', e.target.value || null)}
                    placeholder="price_..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Stripe Annual Price ID</label>
                  <input
                    value={form.stripe_price_id_annual || ''}
                    onChange={e => set('stripe_price_id_annual', e.target.value || null)}
                    placeholder="price_..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Trial Period (days)</label>
                <input
                  type="number"
                  min={0}
                  value={form.trial_days ?? 14}
                  onChange={e => set('trial_days', parseInt(e.target.value) || 0)}
                  className="w-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          )}

          {/* Limits Tab */}
          {tab === 'limits' && (
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4 text-xs text-gray-400">
                <Info className="w-4 h-4 inline mr-1.5" />
                Leave fields empty for unlimited. Set to -1 for &quot;none included&quot;.
              </div>

              {[
                { key: 'max_therapists', label: 'Max Therapists', unit: 'therapists' },
                { key: 'max_patients', label: 'Max Patients', unit: 'patients' },
                { key: 'max_sessions_month', label: 'Max Sessions/Month', unit: 'sessions' },
                { key: 'ai_notes_included', label: 'AI Notes Included', unit: 'notes' },
              ].map(({ key, label, unit }) => (
                <div key={key} className="grid grid-cols-3 items-center gap-4">
                  <label className="text-sm text-gray-300">{label}</label>
                  <input
                    type="number"
                    min={-1}
                    value={(form as Record<string, unknown>)[key] != null ? String((form as Record<string, unknown>)[key]) : ''}
                    onChange={e => set(key as keyof SubscriptionPlan, e.target.value !== '' ? parseInt(e.target.value) : null)}
                    placeholder="∞ unlimited"
                    className="col-span-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              ))}

              <div className="mt-4 bg-gray-800/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-3">Preview</h4>
                <div className="space-y-2">
                  {[
                    { key: 'max_therapists', label: 'Therapists' },
                    { key: 'max_patients', label: 'Patients' },
                    { key: 'max_sessions_month', label: 'Sessions/mo' },
                    { key: 'ai_notes_included', label: 'AI Notes' },
                  ].map(({ key, label }) => {
                    const val = (form as Record<string, unknown>)[key] as number | null | undefined;
                    const display = val == null ? 'Unlimited' : val === -1 ? 'None' : val.toString();
                    return (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-400">{label}</span>
                        <span className={cn('font-medium', val == null ? 'text-emerald-400' : 'text-white')}>
                          {display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Features Tab */}
          {tab === 'features' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">Toggle features included in this plan:</p>
              <div className="grid grid-cols-1 gap-2">
                {FEATURE_OPTIONS.map(({ key, label, icon: Icon }) => {
                  const enabled = (form.features as PlanFeatures)?.[key] === true;
                  return (
                    <button
                      key={key}
                      onClick={() => toggleFeature(key)}
                      className={cn(
                        'flex items-center justify-between px-4 py-3 rounded-lg border transition-all text-left',
                        enabled
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn('w-4 h-4', enabled ? 'text-emerald-400' : 'text-gray-500')} />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      {enabled
                        ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                        : <XCircle className="w-4 h-4 text-gray-600" />
                      }
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-ons Tab */}
          {tab === 'addons' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Optional add-ons purchasable alongside this plan:</p>

              {/* Existing add-ons */}
              {(form.add_ons || []).map((addon: PlanAddOn, i: number) => (
                <div key={i} className="flex items-start justify-between bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div>
                    <div className="text-sm font-medium text-white">{addon.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{addon.description}</div>
                    <div className="text-sm font-bold text-red-400 mt-1">{addon.price}</div>
                  </div>
                  <button onClick={() => removeAddon(i)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add new */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Add New Add-on</h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={addOnForm.name}
                    onChange={e => setAddOnForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Add-on name"
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                  />
                  <input
                    value={addOnForm.price}
                    onChange={e => setAddOnForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="$49/mo"
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <input
                  value={addOnForm.description}
                  onChange={e => setAddOnForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Description"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={addAddon}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {tab === 'display' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Display Order</label>
                  <input
                    type="number"
                    min={0}
                    value={form.display_order ?? 0}
                    onChange={e => set('display_order', parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                  />
                  <p className="text-[11px] text-gray-600 mt-1">Lower = appears first on pricing page</p>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">CTA Button Text</label>
                  <input
                    value={form.cta_text || ''}
                    onChange={e => set('cta_text', e.target.value)}
                    placeholder="Start Free Trial"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Badge Text</label>
                <input
                  value={form.badge_text || ''}
                  onChange={e => set('badge_text', e.target.value || null)}
                  placeholder="Most Popular / Best Value / etc."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                />
                <p className="text-[11px] text-gray-600 mt-1">Shown as a banner on the plan card</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Highlight Color</label>
                <input
                  value={form.highlight_color || ''}
                  onChange={e => set('highlight_color', e.target.value || null)}
                  placeholder="#1F5EFF or leave empty"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-400">Visibility Options</label>
                {[
                  { key: 'is_active', label: 'Active (visible to customers)', desc: 'Inactive plans are hidden from pricing pages' },
                  { key: 'is_featured', label: 'Featured (highlighted on pricing page)', desc: 'Featured plans get visual emphasis' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer">
                    <div
                      onClick={() => set(key as keyof SubscriptionPlan, !(form as Record<string, unknown>)[key])}
                      className={cn(
                        'mt-0.5 w-10 h-6 rounded-full relative transition-colors cursor-pointer shrink-0',
                        (form as Record<string, unknown>)[key] ? 'bg-red-600' : 'bg-gray-700'
                      )}
                    >
                      <div className={cn(
                        'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                        (form as Record<string, unknown>)[key] ? 'translate-x-5' : 'translate-x-1'
                      )} />
                    </div>
                    <div>
                      <div className="text-sm text-white">{label}</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name || !form.plan_key}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all',
              saving || !form.name || !form.plan_key
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-500 hover:to-orange-500'
            )}
          >
            {saving ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4" /> {isNew ? 'Create Plan' : 'Save Changes'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Card (in list view) ──────────────────────────────────────────────────

function PlanCard({
  plan,
  metrics,
  onEdit,
  onToggle,
  onDelete,
  onFeature,
}: {
  plan: SubscriptionPlan;
  metrics?: PlanMetric;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onFeature: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mrr = metrics?.mrr_contribution ?? 0;
  const subs = metrics?.active_subscriptions ?? 0;

  return (
    <div className={cn(
      'bg-gray-900 border rounded-xl transition-all',
      plan.is_active ? 'border-gray-800' : 'border-gray-800/50 opacity-60',
      plan.is_featured && plan.is_active && 'ring-1 ring-red-500/30'
    )}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: plan info */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-red-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <code className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono">
                  {plan.plan_key}
                </code>
                {plan.is_featured && (
                  <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-medium">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                )}
                {!plan.is_active && (
                  <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                    Inactive
                  </span>
                )}
                {plan.badge_text && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                    {plan.badge_text}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{plan.tagline || plan.description}</p>

              {/* Pricing summary */}
              <div className="flex items-center gap-4 mt-2">
                <div className="text-sm">
                  <span className="text-white font-semibold">
                    {plan.price_monthly_usd !== null
                      ? `$${plan.price_monthly_usd}/mo`
                      : 'Custom'}
                  </span>
                  {plan.price_annual_usd !== null && plan.price_monthly_usd !== null && (
                    <span className="text-gray-500 ml-2 text-xs">
                      · ${plan.price_annual_usd}/yr
                    </span>
                  )}
                </div>
                {plan.trial_days > 0 && (
                  <span className="text-xs text-emerald-400">{plan.trial_days}d trial</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: metrics + actions */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Metrics */}
            <div className="hidden md:flex items-center gap-4 text-center">
              <div>
                <div className="text-base font-bold text-white">{subs}</div>
                <div className="text-[10px] text-gray-500">Active</div>
              </div>
              <div>
                <div className="text-base font-bold text-emerald-400">
                  ${mrr.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500">MRR</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={onFeature}
                title={plan.is_featured ? 'Remove featured' : 'Set as featured'}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  plan.is_featured
                    ? 'text-yellow-400 hover:bg-yellow-400/10'
                    : 'text-gray-600 hover:text-yellow-400 hover:bg-gray-800'
                )}
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                onClick={onToggle}
                title={plan.is_active ? 'Deactivate plan' : 'Activate plan'}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  plan.is_active
                    ? 'text-emerald-400 hover:bg-emerald-400/10'
                    : 'text-gray-600 hover:text-emerald-400 hover:bg-gray-800'
                )}
              >
                {plan.is_active
                  ? <ToggleRight className="w-4 h-4" />
                  : <ToggleLeft className="w-4 h-4" />}
              </button>
              <button
                onClick={onEdit}
                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setExpanded(e => !e)}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={onDelete}
                className="p-2 text-gray-600 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                disabled={(metrics?.active_subscriptions ?? 0) > 0}
                title={(metrics?.active_subscriptions ?? 0) > 0 ? 'Cannot delete — has active subscribers' : 'Delete plan'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-6">
            {/* Limits */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Limits</h4>
              <div className="space-y-1.5">
                {[
                  { label: 'Therapists', val: plan.max_therapists },
                  { label: 'Patients', val: plan.max_patients },
                  { label: 'Sessions/mo', val: plan.max_sessions_month },
                  { label: 'AI Notes', val: plan.ai_notes_included },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className={cn('font-medium', val === null ? 'text-emerald-400' : 'text-white')}>
                      {val === null ? '∞ Unlimited' : val === -1 ? 'None' : val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Features</h4>
              <div className="space-y-1">
                {FEATURE_OPTIONS.filter(f => (plan.features as PlanFeatures)?.[f.key]).map(f => (
                  <div key={f.key} className="flex items-center gap-2 text-sm text-white">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {f.label}
                  </div>
                ))}
                {FEATURE_OPTIONS.filter(f => !(plan.features as PlanFeatures)?.[f.key]).map(f => (
                  <div key={f.key} className="flex items-center gap-2 text-sm text-gray-600">
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    {f.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Stripe IDs */}
            <div className="col-span-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Stripe Configuration</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Monthly Price ID', val: plan.stripe_price_id_monthly },
                  { label: 'Annual Price ID', val: plan.stripe_price_id_annual },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xs font-mono text-gray-300 mt-0.5">
                      {val || <span className="text-gray-600 italic">Not configured</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Add-ons */}
            {(plan.add_ons || []).length > 0 && (
              <div className="col-span-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add-ons</h4>
                <div className="grid grid-cols-2 gap-2">
                  {(plan.add_ons || []).map((addon: PlanAddOn, i: number) => (
                    <div key={i} className="bg-gray-800 rounded-lg p-3">
                      <div className="text-sm font-medium text-white">{addon.name}</div>
                      <div className="text-xs text-gray-400">{addon.description}</div>
                      <div className="text-sm text-red-400 font-bold mt-1">{addon.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Pricing Management Page ─────────────────────────────────────────────

export default function PricingManagementPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [metrics, setMetrics] = useState<PlanMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try admin endpoint first, fall back to public
      const [plansRes, metricsRes] = await Promise.allSettled([
        fetch(`${API_BASE}/billing/admin/plans`, {
          headers: { Authorization: `Bearer ${DEV_TOKEN}` },
          cache: 'no-store',
        }),
        fetch(`${API_BASE}/billing/admin/plans/metrics`, {
          headers: { Authorization: `Bearer ${DEV_TOKEN}` },
          cache: 'no-store',
        }),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value.ok) {
        const data = await plansRes.value.json();
        setPlans(Array.isArray(data) ? data : (data.data || []));
      } else {
        // Fallback to public endpoint + demo data
        const publicRes = await fetch(`${API_BASE}/billing/plans`);
        if (publicRes.ok) {
          const data = await publicRes.json();
          setPlans(Array.isArray(data) ? data : (data.data || []));
        } else {
          throw new Error('Cannot connect to API');
        }
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
        const data = await metricsRes.value.json();
        setMetrics(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      // Use demo data when API is not connected
      setError('API not connected — showing demo data. Connect backend to manage real plans.');
      setPlans([
        {
          id: 'demo-1', plan_key: 'professional', name: 'Professional',
          tagline: 'Full AI-powered practice management',
          description: 'Unlimited AI for solo therapists',
          price_monthly_usd: 99, price_annual_usd: 990,
          max_therapists: 1, max_patients: null, max_sessions_month: null, ai_notes_included: null,
          features: { radar: true, api_access: false, white_label: false, advanced_analytics: true, custom_branding: true, hipaa_baa: true },
          stripe_price_id_monthly: null, stripe_price_id_annual: null,
          is_active: true, is_featured: true, badge_text: 'Most Popular',
          cta_text: 'Start Free Trial', trial_days: 14, add_ons: [], highlight_color: null, display_order: 1,
        },
        {
          id: 'demo-2', plan_key: 'practice', name: 'Practice',
          tagline: 'Multi-therapist group practices',
          description: 'Multi-therapist team plans',
          price_monthly_usd: 299, price_annual_usd: 2990,
          max_therapists: 10, max_patients: null, max_sessions_month: null, ai_notes_included: null,
          features: { radar: true, api_access: false, white_label: false, advanced_analytics: true, custom_branding: true, hipaa_baa: true, multi_location: true },
          stripe_price_id_monthly: null, stripe_price_id_annual: null,
          is_active: true, is_featured: false, badge_text: null,
          cta_text: 'Start Free Trial', trial_days: 14, add_ons: [], highlight_color: null, display_order: 2,
        },
        {
          id: 'demo-3', plan_key: 'enterprise', name: 'Enterprise',
          tagline: 'Hospitals, universities, healthcare systems',
          description: 'Custom pricing for large organizations',
          price_monthly_usd: null, price_annual_usd: null,
          max_therapists: null, max_patients: null, max_sessions_month: null, ai_notes_included: null,
          features: { radar: true, api_access: true, white_label: true, advanced_analytics: true, custom_branding: true, hipaa_baa: true, sso: true, ehr_integration: true, dedicated_support: true, custom_ai: true },
          stripe_price_id_monthly: null, stripe_price_id_annual: null,
          is_active: true, is_featured: false, badge_text: null,
          cta_text: 'Contact Sales', trial_days: 0, add_ons: [], highlight_color: null, display_order: 3,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleSave = async (data: Partial<SubscriptionPlan>) => {
    setSaving(true);
    try {
      const url = isNewPlan
        ? `${API_BASE}/billing/admin/plans`
        : `${API_BASE}/billing/admin/plans/${editPlan?.id}`;
      const method = isNewPlan ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEV_TOKEN}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed: ${res.status}`);
      }

      const updated = await res.json();
      if (isNewPlan) {
        setPlans(prev => [...prev, updated].sort((a, b) => a.display_order - b.display_order));
      } else {
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
      }

      setEditPlan(null);
      setIsNewPlan(false);
      showToast('success', isNewPlan ? 'Plan created successfully' : 'Plan updated successfully');
    } catch (err) {
      // In demo mode, update local state
      if (isNewPlan) {
        const newPlan = { ...data, id: `demo-${Date.now()}` } as SubscriptionPlan;
        setPlans(prev => [...prev, newPlan].sort((a, b) => a.display_order - b.display_order));
        showToast('success', 'Plan created (demo mode — connect API to persist)');
      } else {
        setPlans(prev => prev.map(p => p.id === editPlan?.id ? { ...p, ...data } as SubscriptionPlan : p));
        showToast('success', 'Plan updated (demo mode — connect API to persist)');
      }
      setEditPlan(null);
      setIsNewPlan(false);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (planId: string) => {
    try {
      const res = await fetch(`${API_BASE}/billing/admin/plans/${planId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${DEV_TOKEN}` },
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
        showToast('success', `Plan ${updated.is_active ? 'activated' : 'deactivated'}`);
      } else {
        throw new Error('API error');
      }
    } catch {
      // Demo mode toggle
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, is_active: !p.is_active } : p));
      showToast('success', 'Plan toggled (demo mode)');
    }
  };

  const handleFeature = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    try {
      const res = await fetch(`${API_BASE}/billing/admin/plans/${planId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEV_TOKEN}` },
        body: JSON.stringify({ is_featured: !plan.is_featured }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans(prev => prev.map(p => p.id === updated.id ? updated : p));
        showToast('success', updated.is_featured ? 'Plan featured' : 'Plan unfeatured');
      } else throw new Error();
    } catch {
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, is_featured: !p.is_featured } : p));
      showToast('success', 'Updated (demo mode)');
    }
  };

  const handleDelete = async (planId: string) => {
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API_BASE}/billing/admin/plans/${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${DEV_TOKEN}` },
      });
      if (res.ok) {
        setPlans(prev => prev.filter(p => p.id !== planId));
        showToast('success', 'Plan deleted');
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Cannot delete plan');
      }
    } catch (err) {
      setPlans(prev => prev.filter(p => p.id !== planId));
      showToast('success', 'Plan deleted (demo mode)');
    }
  };

  const totalMRR = metrics.reduce((sum, m) => sum + (m.mrr_contribution || 0), 0);
  const totalActive = metrics.reduce((sum, m) => sum + (m.active_subscriptions || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium',
          toast.type === 'success' ? 'bg-emerald-900 border border-emerald-700 text-emerald-200' : 'bg-red-900 border border-red-700 text-red-200'
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Plan?</h3>
                <p className="text-sm text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              Are you sure you want to delete this plan? Any organizations using this plan will need to be migrated.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"
              >
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-400" />
            Pricing Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage subscription plans · pricing · features · limits · billing cycles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadPlans}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <a
            href="/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Pricing Page
          </a>
          <button
            onClick={() => { setEditPlan(null); setIsNewPlan(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-lg text-sm font-medium transition-all"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">Demo Mode Active</p>
            <p className="text-xs text-amber-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Plans', value: plans.filter(p => p.is_active).length, icon: Tag, color: 'text-blue-400' },
          { label: 'Total Plans', value: plans.length, icon: BarChart2, color: 'text-gray-400' },
          { label: 'Active Subscribers', value: totalActive, icon: Users, color: 'text-emerald-400' },
          { label: 'MRR from Plans', value: `$${totalMRR.toLocaleString()}`, icon: TrendingUp, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn('w-4 h-4', color)} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
          </div>
        ))}
      </div>

      {/* Pricing source notice */}
      <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <strong>Single Source of Truth:</strong> All pricing pages (marketing website, therapist portal, patient portal)
          pull plan data from this management system via <code className="bg-blue-500/20 px-1 rounded text-xs">GET /billing/plans</code>.
          Changes made here are reflected immediately across all apps.
        </div>
      </div>

      {/* Plans list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-700" />
              <p className="font-medium">No plans yet</p>
              <p className="text-sm mt-1">Create your first subscription plan to get started</p>
              <button
                onClick={() => { setEditPlan(null); setIsNewPlan(true); }}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors mx-auto"
              >
                <Plus className="w-4 h-4" /> Create First Plan
              </button>
            </div>
          ) : (
            plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                metrics={metrics.find(m => m.plan_key === plan.plan_key)}
                onEdit={() => { setEditPlan(plan); setIsNewPlan(false); }}
                onToggle={() => handleToggle(plan.id)}
                onDelete={() => setConfirmDelete(plan.id)}
                onFeature={() => handleFeature(plan.id)}
              />
            ))
          )}
        </div>
      )}

      {/* Plan Editor Modal */}
      {(editPlan !== null || isNewPlan) && (
        <PlanEditor
          plan={isNewPlan ? null : editPlan}
          isNew={isNewPlan}
          onSave={handleSave}
          onClose={() => { setEditPlan(null); setIsNewPlan(false); }}
          saving={saving}
        />
      )}
    </div>
  );
}
