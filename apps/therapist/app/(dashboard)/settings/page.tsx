"use client";

import { useState } from "react";
import {
  User, Bell, Lock, Brain, CreditCard, Globe, Shield,
  Camera, ChevronRight, Check, Eye, EyeOff, Zap, Palette,
  Clock, Mail, Phone, Save, AlertCircle, CheckCircle2,
  Mic, Video, Calendar, FileText, Languages
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

type Tab = "profile" | "notifications" | "security" | "ai" | "billing" | "integrations";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Lock },
  { key: "ai", label: "AI Preferences", icon: Brain },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "integrations", label: "Integrations", icon: Globe },
];

function ToggleSwitch({
  enabled,
  onChange,
  size = "md",
}: { enabled: boolean; onChange: (v: boolean) => void; size?: "sm" | "md" }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none",
        size === "md" ? "h-6 w-11" : "h-5 w-9",
        enabled ? "bg-primary-600" : "bg-surface-quaternary"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-sm transition-transform",
          size === "md" ? "h-5 w-5" : "h-4 w-4",
          enabled
            ? size === "md" ? "translate-x-5" : "translate-x-4"
            : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [saved, setSaved] = useState(false);

  // Profile state
  const [displayName, setDisplayName] = useState(user?.first_name + " " + user?.last_name || "Dr. Sarah Smith");
  const [title, setTitle] = useState("Licensed Clinical Social Worker (LCSW)");
  const [specializations, setSpecializations] = useState("Anxiety, Depression, Trauma, CBT, EMDR");
  const [bio, setBio] = useState("Specialized in evidence-based therapies for adults dealing with anxiety, depression, and trauma recovery.");
  const [languages, setLanguages] = useState("English, Spanish");
  const [sessionRate, setSessionRate] = useState("150");
  const [sessionDuration, setSessionDuration] = useState("50");
  const [timezone, setTimezone] = useState("America/New_York");

  // Notification state
  const [notifs, setNotifs] = useState({
    session_reminders: true,
    new_messages: true,
    radar_alerts: true,
    risk_alerts: true,
    assessment_due: true,
    billing_updates: true,
    platform_updates: false,
    weekly_report: true,
    email_notifs: true,
    push_notifs: true,
    sms_notifs: false,
  });

  // AI state
  const [aiPrefs, setAIPrefs] = useState({
    auto_transcription: true,
    auto_notes: true,
    note_format: "SOAP",
    context_depth: "standard",
    memory_extraction: true,
    risk_alerts: true,
    treatment_recommendations: true,
    show_ai_confidence: true,
    require_review: true,
  });

  // Security state
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("60");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
          <p className="text-ink-500 text-sm mt-1">Manage your profile, preferences, and account settings</p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 flex-shrink-0">
            <nav className="space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activeTab === tab.key
                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                      : "text-ink-600 hover:bg-surface-tertiary hover:text-ink-900"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* ─── Profile Tab ─── */}
            {activeTab === "profile" && (
              <div className="card p-6 space-y-6">
                <h2 className="text-base font-semibold text-ink-900">Profile Information</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">DS</span>
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors">
                      <Camera className="w-3 h-3 text-white" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium text-ink-900">{displayName}</p>
                    <p className="text-sm text-ink-500">{title}</p>
                    <button className="text-xs text-primary-600 hover:text-primary-700 mt-1 font-medium">Change photo</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Display Name</label>
                    <input
                      className="input-field w-full"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Professional Title</label>
                    <input
                      className="input-field w-full"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Specializations</label>
                    <input
                      className="input-field w-full"
                      value={specializations}
                      onChange={(e) => setSpecializations(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Professional Bio</label>
                    <textarea
                      className="input-field w-full resize-none"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Languages</label>
                    <input className="input-field w-full" value={languages} onChange={(e) => setLanguages(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Timezone</label>
                    <select className="input-field w-full" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      <option value="America/New_York">Eastern (ET)</option>
                      <option value="America/Chicago">Central (CT)</option>
                      <option value="America/Denver">Mountain (MT)</option>
                      <option value="America/Los_Angeles">Pacific (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Session Rate (USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">$</span>
                      <input
                        type="number"
                        className="input-field w-full pl-7"
                        value={sessionRate}
                        onChange={(e) => setSessionRate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Default Session Duration (min)</label>
                    <select
                      className="input-field w-full"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(e.target.value)}
                    >
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="50">50 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="80">80 minutes</option>
                      <option value="90">90 minutes</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Notifications Tab ─── */}
            {activeTab === "notifications" && (
              <div className="card p-6 space-y-6">
                <h2 className="text-base font-semibold text-ink-900">Notification Preferences</h2>

                {/* Delivery Channels */}
                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-3">Delivery Channels</h3>
                  <div className="space-y-3">
                    {[
                      { key: "email_notifs", label: "Email notifications", sub: "Receive updates via email", icon: Mail },
                      { key: "push_notifs", label: "Push notifications", sub: "Browser and mobile push", icon: Bell },
                      { key: "sms_notifs", label: "SMS notifications", sub: "Critical alerts via text", icon: Phone },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-3 border border-surface-tertiary rounded-xl">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-ink-500" />
                          <div>
                            <p className="text-sm font-medium text-ink-900">{item.label}</p>
                            <p className="text-xs text-ink-500">{item.sub}</p>
                          </div>
                        </div>
                        <ToggleSwitch
                          enabled={notifs[item.key as keyof typeof notifs] as boolean}
                          onChange={(v) => setNotifs((n) => ({ ...n, [item.key]: v }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Event Types */}
                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-3">Event Types</h3>
                  <div className="space-y-2">
                    {[
                      { key: "session_reminders", label: "Session reminders", sub: "15 min before sessions" },
                      { key: "new_messages", label: "New patient messages", sub: "In-app message received" },
                      { key: "radar_alerts", label: "Radar matching alerts", sub: "New patient match requests" },
                      { key: "risk_alerts", label: "Risk alerts", sub: "High-risk patient indicators", urgent: true },
                      { key: "assessment_due", label: "Assessment due reminders", sub: "Scheduled assessments pending" },
                      { key: "billing_updates", label: "Billing updates", sub: "Payment received/failed" },
                      { key: "platform_updates", label: "Platform updates", sub: "New features and announcements" },
                      { key: "weekly_report", label: "Weekly summary report", sub: "Practice analytics digest" },
                    ].map((item) => (
                      <div key={item.key} className={cn("flex items-center justify-between p-3 border border-surface-tertiary rounded-xl", item.urgent && "border-red-200 bg-red-50/20")}>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-ink-900">{item.label}</p>
                            {item.urgent && <span className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Required</span>}
                          </div>
                          <p className="text-xs text-ink-500">{item.sub}</p>
                        </div>
                        <ToggleSwitch
                          enabled={notifs[item.key as keyof typeof notifs] as boolean}
                          onChange={(v) => setNotifs((n) => ({ ...n, [item.key]: v }))}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Security Tab ─── */}
            {activeTab === "security" && (
              <div className="card p-6 space-y-6">
                <h2 className="text-base font-semibold text-ink-900">Security Settings</h2>

                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-3">Change Password</h3>
                  <div className="space-y-3 max-w-sm">
                    <div>
                      <label className="label">Current Password</label>
                      <div className="relative">
                        <input type={showOldPw ? "text" : "password"} className="input-field w-full pr-10" placeholder="••••••••" />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowOldPw(!showOldPw)}>
                          {showOldPw ? <EyeOff className="w-4 h-4 text-ink-400" /> : <Eye className="w-4 h-4 text-ink-400" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <div className="relative">
                        <input type={showNewPw ? "text" : "password"} className="input-field w-full pr-10" placeholder="••••••••" />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowNewPw(!showNewPw)}>
                          {showNewPw ? <EyeOff className="w-4 h-4 text-ink-400" /> : <Eye className="w-4 h-4 text-ink-400" />}
                        </button>
                      </div>
                    </div>
                    <button className="btn-primary text-sm">Update Password</button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-3">Two-Factor Authentication</h3>
                  <div className="p-4 border border-surface-tertiary rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-ink-900">Authenticator App (TOTP)</p>
                      <p className="text-xs text-ink-500">Use Google Authenticator or Authy</p>
                    </div>
                    <ToggleSwitch enabled={mfaEnabled} onChange={setMfaEnabled} />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-3">Session Settings</h3>
                  <div>
                    <label className="label">Auto-logout after inactivity (minutes)</label>
                    <select
                      className="input-field w-48"
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                    >
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="120">2 hours</option>
                      <option value="480">8 hours</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ─── AI Tab ─── */}
            {activeTab === "ai" && (
              <div className="card p-6 space-y-6">
                <h2 className="text-base font-semibold text-ink-900">AI Preferences</h2>

                <div className="space-y-3">
                  {[
                    { key: "auto_transcription", label: "Auto-transcription", sub: "Automatically transcribe sessions when started", icon: Mic },
                    { key: "auto_notes", label: "Auto-generate notes", sub: "Generate AI note after session ends", icon: FileText },
                    { key: "memory_extraction", label: "Memory extraction", sub: "Extract patient insights from every session", icon: Brain },
                    { key: "risk_alerts", label: "AI risk detection", sub: "Alert on risk indicators in transcripts", icon: AlertCircle },
                    { key: "treatment_recommendations", label: "Treatment recommendations", sub: "Suggest interventions based on patient history", icon: Zap },
                    { key: "show_ai_confidence", label: "Show AI confidence scores", sub: "Display confidence level on AI suggestions", icon: CheckCircle2 },
                    { key: "require_review", label: "Require manual review before finalizing", sub: "AI notes require therapist approval", icon: Shield },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.key} className="flex items-center justify-between p-3 border border-surface-tertiary rounded-xl">
                        <div className="flex items-center gap-3">
                          <ItemIcon className="w-4 h-4 text-primary-600" />
                          <div>
                            <p className="text-sm font-medium text-ink-900">{item.label}</p>
                            <p className="text-xs text-ink-500">{item.sub}</p>
                          </div>
                        </div>
                        <ToggleSwitch
                          enabled={aiPrefs[item.key as keyof typeof aiPrefs] as boolean}
                          onChange={(v) => setAIPrefs((p) => ({ ...p, [item.key]: v }))}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Default Note Format</label>
                    <select
                      className="input-field w-full"
                      value={aiPrefs.note_format}
                      onChange={(e) => setAIPrefs((p) => ({ ...p, note_format: e.target.value }))}
                    >
                      <option value="SOAP">SOAP Note</option>
                      <option value="DAP">DAP Note</option>
                      <option value="BIRP">BIRP Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">AI Context Depth</label>
                    <select
                      className="input-field w-full"
                      value={aiPrefs.context_depth}
                      onChange={(e) => setAIPrefs((p) => ({ ...p, context_depth: e.target.value }))}
                    >
                      <option value="brief">Brief (faster)</option>
                      <option value="standard">Standard (recommended)</option>
                      <option value="comprehensive">Comprehensive (thorough)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Billing Tab ─── */}
            {activeTab === "billing" && (
              <div className="card p-6 space-y-6">
                <h2 className="text-base font-semibold text-ink-900">Billing & Subscription</h2>
                <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-primary-900">Professional Plan</p>
                      <p className="text-sm text-primary-700 mt-0.5">$149/month · Unlimited sessions, AI scribe, RADAR</p>
                    </div>
                    <span className="px-3 py-1 bg-primary-600 text-white text-xs font-semibold rounded-full">Active</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink-700 mb-3">Payment Method</h3>
                  <div className="p-4 border border-surface-tertiary rounded-xl flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-ink-500" />
                    <div>
                      <p className="text-sm font-medium text-ink-900">Visa ending in 4242</p>
                      <p className="text-xs text-ink-500">Expires 12/2026</p>
                    </div>
                    <button className="ml-auto text-xs text-primary-600 font-medium">Update</button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Integrations Tab ─── */}
            {activeTab === "integrations" && (
              <div className="card p-6 space-y-6">
                <h2 className="text-base font-semibold text-ink-900">Integrations</h2>
                <div className="space-y-3">
                  {[
                    { name: "Google Calendar", desc: "Sync sessions with Google Calendar", connected: true, icon: "🗓️" },
                    { name: "Apple Health", desc: "Connect patient health data", connected: false, icon: "❤️" },
                    { name: "Epic EHR", desc: "Electronic health records integration", connected: false, icon: "🏥" },
                    { name: "Stripe", desc: "Payment processing", connected: true, icon: "💳" },
                    { name: "Twilio", desc: "SMS and video calls", connected: true, icon: "📱" },
                    { name: "Zoom", desc: "Video sessions via Zoom", connected: false, icon: "📹" },
                  ].map((integration) => (
                    <div key={integration.name} className="flex items-center justify-between p-4 border border-surface-tertiary rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{integration.icon}</span>
                        <div>
                          <p className="font-medium text-sm text-ink-900">{integration.name}</p>
                          <p className="text-xs text-ink-500">{integration.desc}</p>
                        </div>
                      </div>
                      <button className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        integration.connected
                          ? "bg-surface-tertiary text-ink-600 hover:bg-red-50 hover:text-red-600"
                          : "bg-primary-600 text-white hover:bg-primary-700"
                      )}>
                        {integration.connected ? "Disconnect" : "Connect"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-ink-400">Changes are saved to your account immediately</p>
              <button
                onClick={handleSave}
                className={cn("btn-primary flex items-center gap-2 transition-all",
                  saved && "bg-green-600 hover:bg-green-700"
                )}
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
