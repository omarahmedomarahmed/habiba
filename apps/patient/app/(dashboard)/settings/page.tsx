"use client";

import { useState } from "react";
import {
  User, Bell, Shield, Lock, CreditCard, Brain, Phone, Mail,
  Globe, Eye, EyeOff, LogOut, ChevronRight, CheckCircle2,
  AlertTriangle, Smartphone, Monitor, Download, Trash2,
  Heart, MessageSquare, Calendar, Activity, Save, Edit3
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsSection = "profile" | "notifications" | "privacy" | "security" | "billing" | "ai" | "data";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ElementType; description: string }[] = [
  { id: "profile", label: "Profile", icon: User, description: "Personal information & preferences" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Manage alerts and reminders" },
  { id: "privacy", label: "Privacy", icon: Eye, description: "Control data sharing and visibility" },
  { id: "security", label: "Security", icon: Lock, description: "Password, 2FA, active sessions" },
  { id: "ai", label: "AI Settings", icon: Brain, description: "AI companion & data usage" },
  { id: "billing", label: "Billing", icon: CreditCard, description: "Plan, invoices, payment" },
  { id: "data", label: "Your Data", icon: Download, description: "Export, delete, data rights" },
];

const NOTIFICATION_SETTINGS = [
  { id: "session_reminder", label: "Session Reminders", description: "24h and 1h before sessions", group: "appointments", enabled: true },
  { id: "homework_reminder", label: "Homework Reminders", description: "Daily reminder for assigned tasks", group: "appointments", enabled: true },
  { id: "mood_prompt", label: "Mood Check-in Prompts", description: "Daily reminder to log your mood", group: "wellness", enabled: true },
  { id: "journal_prompt", label: "Journal Prompts", description: "Receive daily writing prompts", group: "wellness", enabled: false },
  { id: "therapist_message", label: "New Messages", description: "When Dr. Smith sends a message", group: "communication", enabled: true },
  { id: "report_ready", label: "Session Report Ready", description: "When your session report is approved", group: "communication", enabled: true },
  { id: "assessment_due", label: "Assessment Due", description: "When your therapist requests an assessment", group: "communication", enabled: true },
  { id: "weekly_summary", label: "Weekly Progress Summary", description: "AI-generated summary every Sunday", group: "ai", enabled: false },
];

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-11 h-6 rounded-full relative transition-all shrink-0",
        enabled ? "bg-[#0A2342]" : "bg-gray-200"
      )}
    >
      <div className={cn(
        "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all",
        enabled ? "left-6" : "left-1"
      )} />
    </button>
  );
}

export default function PatientSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [notifications, setNotifications] = useState(
    NOTIFICATION_SETTINGS.reduce((acc, n) => ({ ...acc, [n.id]: n.enabled }), {} as Record<string, boolean>)
  );
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [aiCompanionEnabled, setAiCompanionEnabled] = useState(true);
  const [moodDataShared, setMoodDataShared] = useState(true);
  const [journalShared, setJournalShared] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const toggleNotification = (id: string) => {
    setNotifications(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const notificationGroups: Record<string, typeof NOTIFICATION_SETTINGS> = {};
  NOTIFICATION_SETTINGS.forEach(n => {
    if (!notificationGroups[n.group]) notificationGroups[n.group] = [];
    notificationGroups[n.group].push(n);
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account, privacy, and preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <nav className="space-y-0.5">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  activeSection === section.id ? "bg-[#0A2342] text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">

          {/* PROFILE */}
          {activeSection === "profile" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Personal Information</h3>
                  <button
                    onClick={() => setEditingProfile(!editingProfile)}
                    className="flex items-center gap-1.5 text-xs text-[#0A2342] font-medium"
                  >
                    <Edit3 className="h-3 w-3" /> {editingProfile ? "Cancel" : "Edit"}
                  </button>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                    <span className="text-xl font-bold text-white">SC</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Sarah Chen</p>
                    <p className="text-sm text-gray-500">sarah.c@email.com</p>
                    {editingProfile && (
                      <button className="text-xs text-[#0A2342] mt-1 hover:underline">Change photo</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "First Name", value: "Sarah" },
                    { label: "Last Name", value: "Chen" },
                    { label: "Email", value: "sarah.c@email.com" },
                    { label: "Phone", value: "+1 (555) 234-5678" },
                    { label: "Date of Birth", value: "May 14, 1991" },
                    { label: "Timezone", value: "Eastern Time (ET)" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <label className="text-xs text-gray-400 block mb-1">{label}</label>
                      {editingProfile ? (
                        <input defaultValue={value} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20" />
                      ) : (
                        <p className="text-sm text-gray-900">{value}</p>
                      )}
                    </div>
                  ))}
                </div>

                {editingProfile && (
                  <button className="mt-4 w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]">
                    Save Changes
                  </button>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Emergency Contact</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Name</p>
                    <p className="text-sm text-gray-900">Lisa Chen (Sister)</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm text-gray-900">+1 (555) 876-5432</p>
                  </div>
                </div>
                <button className="mt-3 text-xs text-[#0A2342] font-medium">Edit emergency contact</button>
              </div>

              {/* Language */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-400" /> Language & Region
                </h3>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                  <option>English (US)</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>Arabic</option>
                </select>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div className="space-y-4">
              {Object.entries(notificationGroups).map(([group, items]) => (
                <div key={group} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-3 capitalize">{group}</h3>
                  <div className="space-y-3">
                    {items.map(n => (
                      <div key={n.id} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{n.label}</p>
                          <p className="text-xs text-gray-400">{n.description}</p>
                        </div>
                        <Toggle enabled={notifications[n.id]} onToggle={() => toggleNotification(n.id)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Notification Channels</h3>
                <div className="space-y-3">
                  {[
                    { label: "Email Notifications", icon: Mail, enabled: true },
                    { label: "SMS/Text Notifications", icon: Smartphone, enabled: false },
                    { label: "Push Notifications (Browser)", icon: Monitor, enabled: true },
                  ].map(({ label, icon: Icon, enabled }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-700">{label}</p>
                      </div>
                      <Toggle enabled={enabled} onToggle={() => {}} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY */}
          {activeSection === "privacy" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-1">Data Shared with Dr. Alex Smith</h3>
                <p className="text-xs text-gray-400 mb-4">Your therapist can see this information to provide better care.</p>

                <div className="space-y-3">
                  {[
                    { id: "mood", label: "Mood Logs", description: "Daily mood, energy, anxiety entries", icon: Activity, enabled: moodDataShared, set: setMoodDataShared },
                    { id: "journal_shared", label: "Non-Private Journal Entries", description: "Only entries you've marked as 'Shared'", icon: Heart, enabled: journalShared, set: setJournalShared },
                  ].map(({ id, label, description, icon: Icon, enabled, set }) => (
                    <div key={id} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex gap-3">
                        <Icon className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{label}</p>
                          <p className="text-xs text-gray-400">{description}</p>
                        </div>
                      </div>
                      <Toggle enabled={enabled} onToggle={() => set(!enabled)} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Marketing & Communications</h3>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Marketing Emails</p>
                    <p className="text-xs text-gray-400">News, features, and educational content</p>
                  </div>
                  <Toggle enabled={marketingEmails} onToggle={() => setMarketingEmails(!marketingEmails)} />
                </div>
              </div>

              <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4 flex gap-3">
                <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">Your mental health data is protected under HIPAA and is never sold to third parties. AI models are never trained on your personal data.</p>
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeSection === "security" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Current Password</label>
                    <div className="relative">
                      <input type={showCurrentPassword ? "text" : "password"} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                      <button onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">New Password</label>
                    <input type="password" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
                  </div>
                  <button className="w-full py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]">
                    Update Password
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">Two-Factor Authentication</h3>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Recommended</span>
                </div>
                <p className="text-xs text-gray-500 mb-3">Add an extra layer of security to your account.</p>
                <button className="text-sm text-[#0A2342] font-medium hover:text-[#1E4F8C]">Enable 2FA →</button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Active Sessions</h3>
                {[
                  { device: "MacBook Pro (Chrome)", location: "New York, NY", current: true, time: "Now" },
                  { device: "iPhone 14 (App)", location: "New York, NY", current: false, time: "2 days ago" },
                ].map((session) => (
                  <div key={session.device} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <Monitor className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{session.device}</p>
                      <p className="text-xs text-gray-400">{session.location} · {session.time}</p>
                    </div>
                    {session.current ? (
                      <span className="text-xs text-emerald-600 font-medium">Current</span>
                    ) : (
                      <button className="text-xs text-rose-500 hover:text-rose-700">Revoke</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI SETTINGS */}
          {activeSection === "ai" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">AI Companion</h3>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Enable AI Companion</p>
                      <p className="text-xs text-gray-400">Chat with AI between therapy sessions</p>
                    </div>
                    <Toggle enabled={aiCompanionEnabled} onToggle={() => setAiCompanionEnabled(!aiCompanionEnabled)} />
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 flex gap-2">
                    <Brain className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">The AI companion uses context from your mood logs, journal entries (non-private), and session history to provide personalized support.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">AI Data Access</h3>
                <div className="space-y-3">
                  {[
                    { label: "Allow AI to read mood history", desc: "For personalized insights and pattern detection", enabled: true },
                    { label: "Allow AI to access journal themes", desc: "Only themes, not full content", enabled: false },
                    { label: "Allow AI insight sharing with therapist", desc: "AI observations shared with Dr. Smith", enabled: true },
                  ].map(({ label, desc, enabled }) => (
                    <div key={label} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <Toggle enabled={enabled} onToggle={() => {}} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BILLING */}
          {activeSection === "billing" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Current Plan</h3>
                <div className="bg-[#0A2342] rounded-xl p-4 text-white mb-3">
                  <p className="text-xs text-white/60 mb-1">Active Plan</p>
                  <p className="font-bold text-lg">Individual Care</p>
                  <p className="text-white/70 text-sm">Weekly sessions with Dr. Alex Smith · $150/session</p>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Next billing date</span>
                  <span className="font-medium text-gray-900">December 22, 2025</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
                    <p className="text-xs text-gray-400">Expires 12/27</p>
                  </div>
                  <button className="ml-auto text-xs text-[#0A2342] font-medium">Update</button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Recent Invoices</h3>
                {[
                  { date: "Dec 15, 2025", amount: "$150", session: "Session #24", status: "paid" },
                  { date: "Dec 8, 2025", amount: "$150", session: "Session #23", status: "paid" },
                  { date: "Dec 1, 2025", amount: "$150", session: "Session #22", status: "paid" },
                ].map(inv => (
                  <div key={inv.date} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm text-gray-900">{inv.session}</p>
                      <p className="text-xs text-gray-400">{inv.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">{inv.amount}</span>
                      <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* YOUR DATA */}
          {activeSection === "data" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Download Your Data</h3>
                <p className="text-xs text-gray-400 mb-4">Export all your data including mood logs, journal entries, session reports, and assessment history.</p>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm hover:bg-gray-50">
                  <Download className="h-4 w-4" /> Request Data Export
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Your Rights</h3>
                <div className="space-y-2">
                  {[
                    "Right to access your data",
                    "Right to correct inaccurate data",
                    "Right to delete your data (with limitations for clinical records)",
                    "Right to data portability",
                    "Right to restrict processing",
                  ].map(right => (
                    <div key={right} className="flex items-center gap-2 text-xs text-gray-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {right}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-rose-50 rounded-2xl border border-rose-100 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <h3 className="font-semibold text-rose-800">Delete Account</h3>
                </div>
                <p className="text-xs text-rose-600 mb-3">This will permanently delete your account. Clinical records may be retained per legal and compliance requirements. This action cannot be undone.</p>
                <button className="flex items-center gap-2 px-4 py-2 text-rose-600 border border-rose-200 rounded-xl text-sm hover:bg-rose-100">
                  <Trash2 className="h-4 w-4" /> Request Account Deletion
                </button>
              </div>

              <button className="w-full flex items-center justify-center gap-2 py-2.5 text-rose-600 border border-rose-100 rounded-xl text-sm hover:bg-rose-50">
                <LogOut className="h-4 w-4" /> Sign Out of All Devices
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
