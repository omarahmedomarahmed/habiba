"use client";

import { useState } from "react";
import {
  User, Mail, Phone, MapPin, Shield, Bell, Lock, Heart,
  Camera, Edit2, Check, X, AlertCircle, Calendar, FileText,
  ChevronRight, Pill, Activity, Brain, Contact, Globe, Clock
} from "lucide-react";

type ProfileTab = "personal" | "health" | "privacy" | "emergency";

function TabBtn({ id, active, onClick, icon: Icon, label }: { id: ProfileTab; active: ProfileTab; onClick: () => void; icon: typeof User; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
        active === id
          ? "bg-[#0A2342] text-white"
          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function EditableField({ label, value, type = "text" }: { label: string; value: string; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</label>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="flex-1 border border-[#2EC4B6] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]/30"
            autoFocus
          />
          <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center hover:bg-green-200 transition">
            <Check className="w-4 h-4 text-green-600" />
          </button>
          <button onClick={() => { setEditing(false); setVal(value); }} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 group">
          <span className="text-sm text-slate-800">{val}</span>
          <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 transition">
            <Edit2 className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, description, defaultVal = false }: { label: string; description?: string; defaultVal?: boolean }) {
  const [on, setOn] = useState(defaultVal);
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className={`w-10 h-6 rounded-full relative transition-colors ${on ? "bg-[#2EC4B6]" : "bg-slate-200"}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? "left-5" : "left-1"}`} />
      </button>
    </div>
  );
}

export default function PatientProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500 mt-1">Manage your personal information and preferences</p>
        </div>
      </div>

      {/* Avatar Card */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold">
              JA
            </div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#2EC4B6] rounded-lg flex items-center justify-center hover:bg-[#26b0a2] transition">
              <Camera className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">Jordan Anderson</h2>
            <p className="text-white/70 text-sm">Patient since January 2026</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2.5 py-1 text-xs">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span>Active Patient</span>
              </div>
              <div className="flex items-center gap-1 bg-white/10 rounded-lg px-2.5 py-1 text-xs">
                <Shield className="w-3 h-3 text-[#2EC4B6]" />
                <span>HIPAA Protected</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabBtn id="personal" active={activeTab} onClick={() => setActiveTab("personal")} icon={User} label="Personal" />
        <TabBtn id="health" active={activeTab} onClick={() => setActiveTab("health")} icon={Heart} label="Health Info" />
        <TabBtn id="privacy" active={activeTab} onClick={() => setActiveTab("privacy")} icon={Lock} label="Privacy & Data" />
        <TabBtn id="emergency" active={activeTab} onClick={() => setActiveTab("emergency")} icon={AlertCircle} label="Emergency" />
      </div>

      {/* Personal Tab */}
      {activeTab === "personal" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <User className="w-5 h-5 text-[#2EC4B6]" />
              Basic Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <EditableField label="First Name" value="Jordan" />
              <EditableField label="Last Name" value="Anderson" />
              <EditableField label="Date of Birth" value="1992-08-14" type="date" />
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Pronouns</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6] bg-slate-50">
                  <option>They/Them</option>
                  <option>He/Him</option>
                  <option>She/Her</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Contact className="w-5 h-5 text-[#2EC4B6]" />
              Contact Information
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <EditableField label="Email Address" value="jordan.anderson@email.com" type="email" />
              <EditableField label="Phone Number" value="+1 (555) 234-5678" type="tel" />
              <EditableField label="City" value="Portland" />
              <EditableField label="State" value="Oregon" />
              <div className="md:col-span-2">
                <EditableField label="Timezone" value="America/Los_Angeles (PST)" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#2EC4B6]" />
              Language & Accessibility
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Preferred Language</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6] bg-slate-50">
                  <option>English</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>Mandarin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Session Preference</label>
                <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6] bg-slate-50">
                  <option>Video</option>
                  <option>Phone</option>
                  <option>In-Person</option>
                  <option>Any</option>
                </select>
              </div>
            </div>
          </div>

          <div className="text-right">
            <button className="bg-[#2EC4B6] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#26b0a2] transition">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Health Info Tab */}
      {activeTab === "health" && (
        <div className="space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Health information is only visible to your care team and is protected under HIPAA. This information helps your therapist provide the best possible care.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#2EC4B6]" />
              Mental Health History
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Primary Concerns (as shared)</label>
                <div className="flex flex-wrap gap-2">
                  {["Anxiety", "Depression", "Work Stress", "Relationship Issues"].map((tag) => (
                    <span key={tag} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full">{tag}</span>
                  ))}
                  <button className="text-xs text-slate-400 border border-dashed border-slate-300 px-3 py-1 rounded-full hover:border-slate-400 transition">
                    + Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Previous Therapy Experience</label>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700">
                  Yes — 2 years with a previous therapist (2022-2024). Focused on CBT for anxiety.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Pill className="w-5 h-5 text-[#2EC4B6]" />
              Medications (shared with care team)
            </h3>
            <div className="space-y-3 mb-4">
              {[
                { name: "Sertraline (Zoloft)", dose: "50mg", freq: "Daily", prescriber: "Dr. Mark Johnson, MD" },
              ].map((med) => (
                <div key={med.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{med.name} — {med.dose}</div>
                    <div className="text-xs text-slate-500">{med.freq} • Prescribed by {med.prescriber}</div>
                  </div>
                  <button className="text-xs text-red-400 hover:text-red-600 transition">Remove</button>
                </div>
              ))}
            </div>
            <button className="text-sm text-[#1F5EFF] font-medium flex items-center gap-1 hover:gap-2 transition-all">
              <span>+ Add Medication</span>
            </button>
          </div>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === "privacy" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#2EC4B6]" />
              Notification Preferences
            </h3>
            <ToggleRow label="Session reminders" description="24 hours and 1 hour before sessions" defaultVal={true} />
            <ToggleRow label="Homework reminders" description="Notifications for assigned exercises" defaultVal={true} />
            <ToggleRow label="Progress milestones" description="Celebrate your therapy achievements" defaultVal={true} />
            <ToggleRow label="Weekly check-in" description="Sunday evening mood check-in prompt" />
            <ToggleRow label="Message notifications" description="When your therapist sends a message" defaultVal={true} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#2EC4B6]" />
              Data & AI Privacy
            </h3>
            <ToggleRow label="Allow AI session notes" description="AI Scribe generates notes from session audio" defaultVal={true} />
            <ToggleRow label="Memory Layer participation" description="AI builds longitudinal patient context" defaultVal={true} />
            <ToggleRow label="Anonymous outcome research" description="De-identified data for mental health research" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase text-slate-500 tracking-wider">Data Requests (HIPAA Rights)</h3>
            <div className="space-y-3">
              {[
                { label: "Request a copy of my records", desc: "Download all your health records" },
                { label: "Request record correction", desc: "Request an amendment to inaccurate information" },
                { label: "Request data deletion", desc: "Submit a deletion request (subject to retention requirements)" },
              ].map((item) => (
                <button key={item.label} className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition text-left">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{item.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emergency Tab */}
      {activeTab === "emergency" && (
        <div className="space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">
              Emergency contacts are only accessed if you&apos;re unable to respond during a safety concern. This information is strictly protected.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-5">Emergency Contact</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <EditableField label="Contact Name" value="Alex Anderson (Sister)" />
              <EditableField label="Relationship" value="Sister" />
              <EditableField label="Phone Number" value="+1 (555) 987-6543" type="tel" />
              <EditableField label="Email" value="alex.anderson@email.com" type="email" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Crisis Safety Plan</h3>
            <p className="text-sm text-slate-600 mb-4">
              Your therapist has helped create a personalized safety plan with you.
            </p>
            <button className="flex items-center gap-2 text-[#1F5EFF] font-medium text-sm hover:gap-3 transition-all">
              <FileText className="w-4 h-4" />
              View My Safety Plan
            </button>
          </div>

          <div className="bg-[#0A2342] rounded-2xl p-6 text-white">
            <h3 className="font-bold mb-3">Crisis Resources</h3>
            <div className="space-y-2 text-sm text-white/80">
              <div>📞 988 Suicide & Crisis Lifeline — Call or text 988</div>
              <div>💬 Crisis Text Line — Text HOME to 741741</div>
              <div>🆘 Emergency — Call 911</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
