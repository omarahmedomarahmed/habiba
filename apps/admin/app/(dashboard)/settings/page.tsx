'use client';

import { useState } from 'react';
import {
  Settings, Shield, Brain, Bell, Globe, Key, Server, Database,
  Mail, Code, Save, Eye, EyeOff, AlertTriangle,
  CheckCircle, Lock, RefreshCw, Plus, Trash2
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'ai' | 'notifications' | 'api' | 'integrations'>('general');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            Platform Settings
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure global platform settings, security policies, and integrations
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-gradient-to-r from-red-600 to-orange-600 text-white hover:from-red-500 hover:to-orange-500'
          }`}
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {[
              { id: 'general', label: 'General', icon: Settings },
              { id: 'security', label: 'Security', icon: Shield },
              { id: 'ai', label: 'AI Configuration', icon: Brain },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'api', label: 'API & Webhooks', icon: Key },
              { id: 'integrations', label: 'Integrations', icon: Globe },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  activeTab === id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-5">Platform Information</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Platform Name', value: '24Therapy Mental Health OS', type: 'text' },
                    { label: 'Support Email', value: 'support@24therapy.com', type: 'email' },
                    { label: 'Legal Contact', value: 'legal@24therapy.com', type: 'email' },
                    { label: 'Privacy Policy URL', value: 'https://24therapy.com/privacy', type: 'url' },
                    { label: 'Terms of Service URL', value: 'https://24therapy.com/terms', type: 'url' },
                  ].map(({ label, value, type }) => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
                      <input
                        type={type}
                        defaultValue={value}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-5">Feature Flags</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Radar Marketplace', desc: 'Allow therapists to receive patient matching requests', enabled: true },
                    { label: 'AI Memory Layer', desc: 'Enable longitudinal patient memory accumulation', enabled: true },
                    { label: 'Video Sessions', desc: 'Enable WebRTC video sessions in-platform', enabled: true },
                    { label: 'AI Safety Monitor', desc: 'Real-time crisis and risk monitoring during sessions', enabled: true },
                    { label: 'Public Marketplace', desc: 'Allow third-party tools in the marketplace', enabled: true },
                    { label: 'Research Mode', desc: 'Allow anonymized aggregate data for research (consent required)', enabled: false },
                    { label: 'White Label Mode', desc: 'Allow organizations to white-label the platform', enabled: false },
                  ].map(({ label, desc, enabled }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-white">{label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                      </div>
                      <button
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? 'bg-green-500' : 'bg-gray-700'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            enabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Authentication & Access
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Session Timeout (minutes)', value: '30', type: 'number' },
                    { label: 'Max Login Attempts', value: '5', type: 'number' },
                    { label: 'Lockout Duration (minutes)', value: '15', type: 'number' },
                    { label: 'JWT Expiry (hours)', value: '24', type: 'number' },
                    { label: 'Refresh Token Expiry (days)', value: '30', type: 'number' },
                  ].map(({ label, value, type }) => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
                      <input
                        type={type}
                        defaultValue={value}
                        className="w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-green-400" />
                  Compliance Policies
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'HIPAA Mode', desc: 'Enforce HIPAA compliance policies platform-wide', enabled: true },
                    { label: 'GDPR Mode', desc: 'Enable GDPR data rights and consent management', enabled: true },
                    { label: 'MFA Required for Admin', desc: 'Force multi-factor authentication for admin accounts', enabled: true },
                    { label: 'MFA Required for Therapists', desc: 'Recommend MFA for all therapist accounts', enabled: false },
                    { label: 'Audit All Data Access', desc: 'Log every patient data access event', enabled: true },
                    { label: 'IP Allowlisting (Enterprise)', desc: 'Restrict enterprise org access to approved IPs', enabled: false },
                  ].map(({ label, desc, enabled }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-white">{label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                      </div>
                      <button
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? 'bg-green-500' : 'bg-gray-700'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* AI Configuration */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  AI Model Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Primary LLM Provider</label>
                    <select className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
                      <option>OpenAI (GPT-4o)</option>
                      <option>Anthropic (Claude 3.5 Sonnet)</option>
                      <option>Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">OpenAI API Key</label>
                    <input
                      type="password"
                      defaultValue="sk-•••••••••••••••••••••••••"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Anthropic API Key</label>
                    <input
                      type="password"
                      defaultValue="sk-ant-•••••••••••••••••••"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">AI Monthly Budget Cap ($)</label>
                    <input
                      type="number"
                      defaultValue="10000"
                      className="w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Budget Alert Threshold (%)</label>
                    <input
                      type="number"
                      defaultValue="80"
                      className="w-full max-w-xs px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-yellow-300">AI Safety Notice</div>
                    <p className="text-xs text-yellow-400/80 mt-1">
                      AI models never have unrestricted access to patient data. All retrievals are scoped to the requesting therapist's patient roster and organization boundary. PHI is redacted in all AI logs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API & Webhooks */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    Platform API Keys
                  </h3>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    New Key
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Production API Key', key: 'sk_live_24t_••••••••••••••••', permissions: 'Full Access', created: '2024-01-01', last_used: '2 min ago' },
                    { name: 'Staging API Key', key: 'sk_test_24t_••••••••••••••••', permissions: 'Read Only', created: '2024-03-15', last_used: '1h ago' },
                    { name: 'Webhook Signing Secret', key: 'whsec_••••••••••••••••••••', permissions: 'Webhooks', created: '2024-01-01', last_used: '5 min ago' },
                  ].map((apiKey) => (
                    <div key={apiKey.name} className="flex items-center gap-4 p-4 bg-gray-800 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{apiKey.name}</div>
                        <div className="text-xs font-mono text-gray-500 mt-0.5">{apiKey.key}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-400">{apiKey.permissions}</div>
                        <div className="text-xs text-gray-600">Last used: {apiKey.last_used}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-white transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-blue-400" />
                    Webhooks
                  </h3>
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 hover:text-white rounded-lg text-xs transition-colors">
                    <Plus className="w-3.5 h-3.5" />
                    Add Webhook
                  </button>
                </div>
                <div className="space-y-2">
                  {[
                    { url: 'https://ehr.clinic.com/webhooks/24therapy', events: ['session.completed', 'note.generated', 'patient.created'], status: 'active' },
                    { url: 'https://billing.service.com/hooks/payments', events: ['invoice.paid', 'subscription.created'], status: 'active' },
                  ].map((hook, i) => (
                    <div key={i} className="p-4 bg-gray-800 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-mono text-blue-400">{hook.url}</div>
                          <div className="flex gap-1.5 mt-2">
                            {hook.events.map(e => (
                              <span key={e} className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded font-mono">{e}</span>
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full font-semibold">
                          {hook.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Stripe', desc: 'Payment processing and billing', status: 'connected', icon: '💳', category: 'Billing' },
                { name: 'SendGrid', desc: 'Transactional email delivery', status: 'connected', icon: '📧', category: 'Email' },
                { name: 'Twilio', desc: 'SMS and phone notifications', status: 'connected', icon: '📱', category: 'SMS' },
                { name: 'AWS S3', desc: 'Recording and file storage', status: 'connected', icon: '☁️', category: 'Storage' },
                { name: 'OpenAI', desc: 'GPT-4o and Whisper models', status: 'connected', icon: '🤖', category: 'AI' },
                { name: 'Anthropic', desc: 'Claude AI models', status: 'connected', icon: '🧠', category: 'AI' },
                { name: 'Daily.co', desc: 'WebRTC video infrastructure', status: 'connected', icon: '📹', category: 'Video' },
                { name: 'Sentry', desc: 'Error monitoring and alerting', status: 'connected', icon: '🔍', category: 'Monitoring' },
                { name: 'Epic EHR', desc: 'Electronic health records', status: 'available', icon: '🏥', category: 'EHR' },
                { name: 'Cerner', desc: 'EHR integration', status: 'available', icon: '🏥', category: 'EHR' },
              ].map((integration) => (
                <div key={integration.name} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{integration.name}</div>
                        <div className="text-xs text-gray-500">{integration.category}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      integration.status === 'connected' ? 'bg-green-400/20 text-green-300' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {integration.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{integration.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Notification Configuration
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Admin Email Alerts', desc: 'Send critical platform alerts to admin email', enabled: true },
                  { label: 'Compliance Alerts', desc: 'Alert compliance team on HIPAA violations or anomalies', enabled: true },
                  { label: 'Revenue Milestones', desc: 'Notify on MRR milestones ($10K, $50K, $100K, etc.)', enabled: true },
                  { label: 'New Enterprise Signup', desc: 'Alert sales team on Enterprise plan signups', enabled: true },
                  { label: 'AI Error Threshold', desc: 'Alert when AI error rate exceeds 2%', enabled: true },
                  { label: 'Daily Performance Report', desc: 'Send daily platform summary at 8AM UTC', enabled: false },
                  { label: 'Security Incident Paging', desc: 'Page on-call engineer for critical security events', enabled: true },
                ].map(({ label, desc, enabled }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-white">{label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                    </div>
                    <button className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-700'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Webhook({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}
