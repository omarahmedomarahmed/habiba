"use client";

import { useState } from "react";
import {
  User, Settings, Bell, Shield, CreditCard, Brain, Building2,
  Save, Camera, Eye, EyeOff, CheckCircle, AlertCircle, Trash2,
  Plus, X, Globe, Lock, Smartphone, Key, Download,
  LogOut, RefreshCw, Zap, Network, FileText, ClipboardList,
  Clock, DollarSign, Mail, Phone, MapPin, Link2, Upload,
  AlertTriangle, ChevronRight, Palette, Monitor, Volume2,
  Users, Calendar, BarChart3, ExternalLink, Copy, Check
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "profile"
  | "practice"
  | "ai"
  | "notifications"
  | "security"
  | "billing";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "practice", label: "Practice", icon: Building2 },
  { id: "ai", label: "AI & Scribe", icon: Brain },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
];

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "w-11 h-6 rounded-full relative transition-colors flex-shrink-0",
        enabled ? "bg-[#2EC4B6]" : "bg-gray-200"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
        enabled ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
      <div className="mb-4">
        <h3 className="font-semibold text-[#0A2342]">{title}</h3>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function TherapistSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [savedToast, setSavedToast] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    first_name: "Sarah", last_name: "Chen", email: "sarah.chen@mindfulpractice.com",
    phone: "+1 (555) 234-5678", title: "Dr.", credentials: "PsyD",
    license_number: "PSY-12345", license_state: "CA", license_expiry: "2026-06-30",
    bio: "Licensed psychologist specializing in anxiety, trauma, and OCD. 12 years experience with adults and adolescents using evidence-based approaches including CBT, EMDR, and ACT.",
    specializations: ["Anxiety", "Trauma/PTSD", "OCD", "Depression", "Relationship Issues"],
    languages: ["English", "Mandarin"],
    timezone: "America/Los_Angeles",
    session_fee: "200",
    sliding_scale: true,
  });

  // AI preferences
  const [aiPrefs, setAiPrefs] = useState({
    scribe_enabled: true,
    copilot_enabled: true,
    risk_monitoring: true,
    memory_enabled: true,
    auto_extract_memories: true,
    note_format: "soap",
    copilot_verbosity: "moderate",
    risk_threshold: "elevated",
    session_prep_enabled: true,
    auto_approve_notes: false,
    show_confidence_scores: true,
    require_supervisor_review: false,
  });

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    session_reminders: true,
    new_patients: true,
    risk_alerts: true,
    note_reviews: true,
    messages: true,
    billing_events: true,
    ai_insights_weekly: true,
    email_reminders: true,
    sms_reminders: false,
    push_enabled: true,
    reminder_lead_time: "60",
    quiet_hours: false,
    quiet_start: "22:00",
    quiet_end: "07:00",
  });

  // Security state
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState("60");

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText("sk_live_24therapy_abc123xyz");
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0A2342]">Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your account, AI configuration, and practice settings</p>
          </div>
          <button
            onClick={handleSave}
            className="bg-[#0A2342] hover:bg-[#0d2d56] text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>

        {/* Save Toast */}
        {savedToast && (
          <div className="fixed top-6 right-6 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="w-4 h-4" />
            Settings saved successfully
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-48 flex-shrink-0">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden sticky top-4">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-gray-100 last:border-0",
                      activeTab === tab.id
                        ? "bg-[#0A2342] text-white"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">

            {/* ─── PROFILE TAB ─── */}
            {activeTab === "profile" && (
              <>
                <SectionCard title="Profile Photo & Identity">
                  <div className="flex items-start gap-6 mb-6">
                    <div className="relative flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A2342] to-[#2EC4B6] flex items-center justify-center">
                        <span className="text-white font-bold text-xl">SC</span>
                      </div>
                      <button className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:border-[#2EC4B6]">
                        <Camera className="w-3.5 h-3.5 text-gray-600" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                          <select
                            value={profile.title}
                            onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                          >
                            <option>Dr.</option>
                            <option>Ms.</option>
                            <option>Mr.</option>
                            <option>Mx.</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Credentials</label>
                          <input
                            value={profile.credentials}
                            onChange={(e) => setProfile({ ...profile, credentials: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                            placeholder="PsyD, LCSW, etc."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                          <input
                            value={profile.first_name}
                            onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                          <input
                            value={profile.last_name}
                            onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Contact Information">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Email Address", key: "email", type: "email", icon: Mail },
                      { label: "Phone Number", key: "phone", type: "tel", icon: Phone },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <div className="relative">
                          <field.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type={field.type}
                            value={(profile as unknown as Record<string, string>)[field.key]}
                            onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                            className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                          />
                        </div>
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
                      <select
                        value={profile.timezone}
                        onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                      >
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/New_York">Eastern Time (ET)</option>
                      </select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="License & Credentials">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "License Number", key: "license_number" },
                      { label: "License State", key: "license_state" },
                      { label: "Expiry Date", key: "license_expiry", type: "date" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <input
                          type={field.type || "text"}
                          value={(profile as unknown as Record<string, string>)[field.key]}
                          onChange={(e) => setProfile({ ...profile, [field.key]: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                        />
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Professional Bio" description="Shown on your public marketplace profile">
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={4}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#2EC4B6] resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{profile.bio.length} / 500 characters</p>
                </SectionCard>

                <SectionCard title="Specializations">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {profile.specializations.map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1.5 bg-[#0A2342]/5 text-[#0A2342] px-3 py-1 rounded-full text-sm"
                      >
                        {s}
                        <button
                          onClick={() => setProfile({ ...profile, specializations: profile.specializations.filter((x) => x !== s) })}
                          className="hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <button className="flex items-center gap-1 border border-dashed border-gray-300 text-gray-400 px-3 py-1 rounded-full text-sm hover:border-[#2EC4B6] hover:text-[#2EC4B6]">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ─── PRACTICE TAB ─── */}
            {activeTab === "practice" && (
              <>
                <SectionCard title="Session Settings" description="Default configuration for new sessions">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Default Session Duration", options: ["30 min","45 min","50 min","60 min","90 min"], value: "50 min" },
                      { label: "Session Type", options: ["Video (default)","Phone","In-Person"], value: "Video (default)" },
                      { label: "Reminder Lead Time", options: ["15 min","30 min","1 hour","2 hours","24 hours"], value: "1 hour" },
                      { label: "Buffer Between Sessions", options: ["None","5 min","10 min","15 min","30 min"], value: "10 min" },
                    ].map((field) => (
                      <div key={field.label}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <select
                          defaultValue={field.value}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                        >
                          {field.options.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Billing & Rates" description="Your session fees and payment preferences">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Standard Session Fee (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          value={profile.session_fee}
                          onChange={(e) => setProfile({ ...profile, session_fee: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                      <select className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white">
                        <option>USD — US Dollar</option>
                        <option>CAD — Canadian Dollar</option>
                        <option>EUR — Euro</option>
                        <option>GBP — British Pound</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Sliding Scale Available</div>
                      <div className="text-xs text-gray-400">Shown on your marketplace profile</div>
                    </div>
                    <ToggleSwitch
                      enabled={profile.sliding_scale}
                      onChange={(v) => setProfile({ ...profile, sliding_scale: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Late Cancellation Fee</div>
                      <div className="text-xs text-gray-400">Charge for cancellations under 24 hours</div>
                    </div>
                    <ToggleSwitch enabled={true} onChange={() => {}} />
                  </div>
                </SectionCard>

                <SectionCard title="Marketplace & Radar" description="Control your public profile and matching visibility">
                  {[
                    { label: "Listed on 24Therapy Marketplace", desc: "Patients can find and book you", value: true },
                    { label: "Accept Radar Requests", desc: "Receive urgent patient matching requests", value: true },
                    { label: "Show Availability in Directory", desc: "Display next available slot publicly", value: true },
                    { label: "Accept New Patients", desc: "Show as accepting new patients on profile", value: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.desc}</div>
                      </div>
                      <ToggleSwitch enabled={item.value} onChange={() => {}} />
                    </div>
                  ))}
                </SectionCard>

                <SectionCard title="EHR Integrations" description="Connect to your existing EHR or practice management system">
                  <div className="space-y-3">
                    {[
                      { name: "SimplePractice", status: "not_connected", icon: "SP" },
                      { name: "TherapyNotes", status: "not_connected", icon: "TN" },
                      { name: "Epic (FHIR)", status: "enterprise_only", icon: "EP" },
                      { name: "Cerner (FHIR)", status: "enterprise_only", icon: "CN" },
                    ].map((ehr) => (
                      <div key={ehr.name} className="flex items-center justify-between border border-gray-200 rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                            {ehr.icon}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{ehr.name}</span>
                        </div>
                        {ehr.status === "enterprise_only" ? (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">Enterprise only</span>
                        ) : (
                          <button className="text-xs text-[#2EC4B6] border border-[#2EC4B6] px-3 py-1 rounded-lg hover:bg-[#2EC4B6]/5">
                            Connect
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

            {/* ─── AI TAB ─── */}
            {activeTab === "ai" && (
              <>
                <SectionCard title="AI Feature Toggles" description="Control which AI features are active during sessions">
                  {[
                    { key: "scribe_enabled", label: "AI Scribe", desc: "Auto-generate clinical notes from sessions" },
                    { key: "copilot_enabled", label: "Clinical Copilot", desc: "Real-time suggestions during sessions" },
                    { key: "risk_monitoring", label: "Risk Detection", desc: "AI monitors for safety signals in session" },
                    { key: "memory_enabled", label: "Patient Memory Layer", desc: "Build longitudinal patient knowledge graph" },
                    { key: "auto_extract_memories", label: "Auto-Extract Memories", desc: "AI automatically adds nodes after sessions" },
                    { key: "session_prep_enabled", label: "Session Prep Briefs", desc: "AI generates pre-session intelligence brief" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.desc}</div>
                      </div>
                      <ToggleSwitch
                        enabled={(aiPrefs as unknown as Record<string, boolean>)[item.key] as boolean}
                        onChange={(v) => setAiPrefs({ ...aiPrefs, [item.key]: v })}
                      />
                    </div>
                  ))}
                </SectionCard>

                <SectionCard title="Note Configuration" description="Default format and review workflow for AI-generated notes">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Default Note Format</label>
                      <select
                        value={aiPrefs.note_format}
                        onChange={(e) => setAiPrefs({ ...aiPrefs, note_format: e.target.value })}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                      >
                        <option value="soap">SOAP (Subjective, Objective, Assessment, Plan)</option>
                        <option value="dap">DAP (Data, Assessment, Plan)</option>
                        <option value="birp">BIRP (Behavior, Intervention, Response, Plan)</option>
                        <option value="progress">Progress Note</option>
                        <option value="narrative">Narrative</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Copilot Verbosity</label>
                      <select
                        value={aiPrefs.copilot_verbosity}
                        onChange={(e) => setAiPrefs({ ...aiPrefs, copilot_verbosity: e.target.value })}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                      >
                        <option value="minimal">Minimal — key flags only</option>
                        <option value="moderate">Moderate — suggestions + questions</option>
                        <option value="detailed">Detailed — comprehensive guidance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Risk Alert Threshold</label>
                      <select
                        value={aiPrefs.risk_threshold}
                        onChange={(e) => setAiPrefs({ ...aiPrefs, risk_threshold: e.target.value })}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                      >
                        <option value="critical">Critical only</option>
                        <option value="high">High + Critical</option>
                        <option value="elevated">Elevated + High + Critical</option>
                        <option value="moderate">Moderate + above (recommended)</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Auto-Approve Notes</div>
                      <div className="text-xs text-gray-400">Notes automatically finalized without review (not recommended)</div>
                    </div>
                    <ToggleSwitch
                      enabled={aiPrefs.auto_approve_notes}
                      onChange={(v) => setAiPrefs({ ...aiPrefs, auto_approve_notes: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Require Supervisor Review</div>
                      <div className="text-xs text-gray-400">All notes must be approved by a supervisor</div>
                    </div>
                    <ToggleSwitch
                      enabled={aiPrefs.require_supervisor_review}
                      onChange={(v) => setAiPrefs({ ...aiPrefs, require_supervisor_review: v })}
                    />
                  </div>
                </SectionCard>

                <SectionCard title="AI Usage This Month">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Notes Generated", value: "47", icon: FileText },
                      { label: "Time Saved", value: "~9.4 hrs", icon: Clock },
                      { label: "Copilot Suggestions", value: "312", icon: Brain },
                    ].map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                          <Icon className="w-5 h-5 text-[#2EC4B6] mx-auto mb-1" />
                          <div className="font-bold text-[#0A2342]">{stat.value}</div>
                          <div className="text-xs text-gray-400">{stat.label}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600">Notes included in plan</span>
                      <span className="font-medium">47 / 200</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#2EC4B6] rounded-full" style={{ width: "24%" }} />
                    </div>
                  </div>
                </SectionCard>
              </>
            )}

            {/* ─── NOTIFICATIONS TAB ─── */}
            {activeTab === "notifications" && (
              <>
                <SectionCard title="Notification Channels">
                  {[
                    { key: "email_reminders", label: "Email Notifications", desc: "Receive notifications by email" },
                    { key: "sms_reminders", label: "SMS Notifications", desc: "Receive text message notifications" },
                    { key: "push_enabled", label: "Push Notifications", desc: "Browser and mobile push notifications" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.desc}</div>
                      </div>
                      <ToggleSwitch
                        enabled={(notifPrefs as unknown as Record<string, boolean>)[item.key] as boolean}
                        onChange={(v) => setNotifPrefs({ ...notifPrefs, [item.key]: v })}
                      />
                    </div>
                  ))}
                </SectionCard>

                <SectionCard title="Notification Events">
                  {[
                    { key: "session_reminders", label: "Session Reminders", desc: "Before scheduled sessions" },
                    { key: "new_patients", label: "New Patient Intakes", desc: "When a new patient completes intake" },
                    { key: "risk_alerts", label: "Risk Alerts", desc: "AI-detected patient safety signals (always on)" },
                    { key: "note_reviews", label: "Note Review Requests", desc: "When a note needs supervisor review" },
                    { key: "messages", label: "New Secure Messages", desc: "Messages from patients or colleagues" },
                    { key: "billing_events", label: "Billing Events", desc: "Payment received, claim updates" },
                    { key: "ai_insights_weekly", label: "Weekly AI Insights", desc: "AI-generated practice summary" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.desc}</div>
                      </div>
                      <ToggleSwitch
                        enabled={(notifPrefs as unknown as Record<string, boolean>)[item.key] as boolean}
                        onChange={(v) => setNotifPrefs({ ...notifPrefs, [item.key]: v })}
                      />
                    </div>
                  ))}
                </SectionCard>

                <SectionCard title="Quiet Hours" description="Suppress non-urgent notifications during set hours">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Enable Quiet Hours</div>
                      <div className="text-xs text-gray-400">Risk alerts are never silenced</div>
                    </div>
                    <ToggleSwitch
                      enabled={notifPrefs.quiet_hours}
                      onChange={(v) => setNotifPrefs({ ...notifPrefs, quiet_hours: v })}
                    />
                  </div>
                  {notifPrefs.quiet_hours && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Quiet From</label>
                        <input
                          type="time"
                          value={notifPrefs.quiet_start}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, quiet_start: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Quiet Until</label>
                        <input
                          type="time"
                          value={notifPrefs.quiet_end}
                          onChange={(e) => setNotifPrefs({ ...notifPrefs, quiet_end: e.target.value })}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                        />
                      </div>
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {/* ─── SECURITY TAB ─── */}
            {activeTab === "security" && (
              <>
                <SectionCard title="Password">
                  <div className="space-y-3">
                    {[
                      { label: "Current Password", key: "current", show: showOldPassword, toggle: () => setShowOldPassword(!showOldPassword) },
                      { label: "New Password", key: "new", show: showNewPassword, toggle: () => setShowNewPassword(!showNewPassword) },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        <div className="relative">
                          <input
                            type={field.show ? "text" : "password"}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] pr-10"
                          />
                          <button
                            type="button"
                            onClick={field.toggle}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}
                    <button className="bg-[#0A2342] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0d2d56]">
                      Update Password
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Two-Factor Authentication (2FA)" description="Required for accounts handling PHI">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        {mfaEnabled ? (
                          <><CheckCircle className="w-4 h-4 text-emerald-500" /> 2FA is enabled</>
                        ) : (
                          <><AlertCircle className="w-4 h-4 text-orange-500" /> 2FA is disabled</>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">Authenticator app (TOTP)</div>
                    </div>
                    <ToggleSwitch enabled={mfaEnabled} onChange={setMfaEnabled} />
                  </div>
                  {!mfaEnabled && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs text-amber-700">
                        Enabling 2FA is strongly recommended for all accounts with access to patient health information (PHI). This is required for HIPAA compliance.
                      </p>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Session Security">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Auto-Logout After Inactivity</label>
                    <select
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>
                </SectionCard>

                <SectionCard title="API Access" description="API key for integrations and automation">
                  <div className="flex items-center gap-3 mb-3">
                    <code className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-sm font-mono">
                      sk_live_••••••••••••••••••••abc123
                    </code>
                    <button
                      onClick={handleCopyApiKey}
                      className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-2 rounded-xl text-sm hover:border-gray-400"
                    >
                      {copiedApiKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copiedApiKey ? "Copied!" : "Copy"}
                    </button>
                    <button className="border border-gray-300 text-gray-600 px-3 py-2 rounded-xl text-sm hover:border-gray-400">
                      Regenerate
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Keep your API key secret. It provides access to your patient data.</p>
                </SectionCard>

                <SectionCard title="Active Sessions">
                  <div className="space-y-3">
                    {[
                      { device: "MacBook Pro — Chrome", location: "San Francisco, CA", time: "Active now", current: true },
                      { device: "iPhone 15 — Safari", location: "San Francisco, CA", time: "2 hours ago", current: false },
                      { device: "iPad — Safari", location: "Oakland, CA", time: "Yesterday", current: false },
                    ].map((session) => (
                      <div key={session.device} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                        <div>
                          <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            {session.device}
                            {session.current && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">Current</span>}
                          </div>
                          <div className="text-xs text-gray-400">{session.location} · {session.time}</div>
                        </div>
                        {!session.current && (
                          <button className="text-xs text-red-500 hover:text-red-700 font-medium">Revoke</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button className="mt-3 text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                    <LogOut className="w-4 h-4" /> Sign out all other sessions
                  </button>
                </SectionCard>
              </>
            )}

            {/* ─── BILLING TAB ─── */}
            {activeTab === "billing" && (
              <>
                <SectionCard title="Current Subscription">
                  <div className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-xl p-4 text-white mb-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-white/70">Current Plan</div>
                        <div className="text-2xl font-bold">Professional</div>
                        <div className="text-sm text-white/70 mt-0.5">$129/month · Billed monthly</div>
                      </div>
                      <span className="bg-[#2EC4B6] text-white text-xs px-2 py-1 rounded-full font-medium">Active</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: "AI Notes Included", value: "200/month" },
                      { label: "AI Notes Used", value: "47 this month" },
                      { label: "Patients", value: "Unlimited" },
                      { label: "Next Billing Date", value: "Jan 1, 2025" },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs text-gray-400">{item.label}</div>
                        <div className="text-sm font-semibold text-gray-800 mt-0.5">{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:border-[#2EC4B6] hover:text-[#2EC4B6]">
                      Upgrade Plan
                    </button>
                    <button className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:border-red-300 hover:text-red-500">
                      Cancel Subscription
                    </button>
                  </div>
                </SectionCard>

                <SectionCard title="Payment Method">
                  <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-4 mb-3">
                    <div className="w-10 h-6 bg-[#1F5EFF] rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">VISA</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-800">Visa ending in 4242</div>
                      <div className="text-xs text-gray-400">Expires 08/2027</div>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>
                  </div>
                  <button className="w-full border border-dashed border-gray-300 text-gray-500 py-3 rounded-xl text-sm hover:border-[#2EC4B6] hover:text-[#2EC4B6] flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add payment method
                  </button>
                </SectionCard>

                <SectionCard title="Invoice History">
                  <div className="space-y-2">
                    {[
                      { date: "Dec 1, 2024", amount: "$129.00", status: "Paid" },
                      { date: "Nov 1, 2024", amount: "$129.00", status: "Paid" },
                      { date: "Oct 1, 2024", amount: "$129.00", status: "Paid" },
                    ].map((inv) => (
                      <div key={inv.date} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                        <div className="text-sm text-gray-600">{inv.date}</div>
                        <div className="font-medium text-gray-800">{inv.amount}</div>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{inv.status}</span>
                        <button className="text-xs text-[#2EC4B6] flex items-center gap-1 hover:underline">
                          <Download className="w-3 h-3" /> PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
