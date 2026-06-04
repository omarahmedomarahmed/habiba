"use client";

import { useState } from "react";
import {
  User, Bell, Lock, Shield, Eye, EyeOff, Phone, Mail,
  ChevronRight, CheckCircle2, Save, Camera, Globe, Heart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
        enabled ? "bg-blue-600" : "bg-slate-200"
      )}
    >
      <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0")} />
    </button>
  );
}

export default function PatientSettingsPage() {
  const { user } = useAuthStore();
  const [saved, setSaved] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const [notifs, setNotifs] = useState({
    session_reminders: true,
    assessment_reminders: true,
    therapist_messages: true,
    progress_updates: true,
    email: true,
    push: true,
    sms: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            Profile Information
          </h2>

          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-600">SC</span>
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Sarah Chen</p>
              <p className="text-sm text-slate-500">Patient since Aug 2024</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">First Name</label>
              <input defaultValue="Sarah" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Last Name</label>
              <input defaultValue="Chen" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
              <input defaultValue="sarah.chen@email.com" type="email" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
              <input defaultValue="+1 (555) 234-5678" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Timezone</label>
              <select className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>Eastern (ET)</option>
                <option>Central (CT)</option>
                <option>Pacific (PT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500" />
            Emergency Contact
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Contact Name</label>
              <input defaultValue="David Chen" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Relationship</label>
              <input defaultValue="Brother" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label>
              <input defaultValue="+1 (555) 345-6789" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            Notifications
          </h2>
          {[
            { key: "session_reminders", label: "Session reminders", sub: "24 hours and 1 hour before" },
            { key: "assessment_reminders", label: "Assessment reminders", sub: "When new assessments are assigned" },
            { key: "therapist_messages", label: "Therapist messages", sub: "New messages from Dr. Smith" },
            { key: "progress_updates", label: "Progress insights", sub: "Weekly progress summaries" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.sub}</p>
              </div>
              <Toggle
                enabled={notifs[item.key as keyof typeof notifs] as boolean}
                onChange={(v) => setNotifs((n) => ({ ...n, [item.key]: v }))}
              />
            </div>
          ))}

          <div className="pt-2">
            <p className="text-xs font-medium text-slate-600 mb-2">Delivery method</p>
            <div className="flex items-center gap-3">
              {[
                { key: "email", label: "Email" },
                { key: "push", label: "Push" },
                { key: "sms", label: "SMS" },
              ].map((ch) => (
                <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifs[ch.key as keyof typeof notifs] as boolean}
                    onChange={(e) => setNotifs((n) => ({ ...n, [ch.key]: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-sm text-slate-700">{ch.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-500" />
            Security
          </h2>
          <div className="max-w-xs space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Current Password</label>
              <input type="password" placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">New Password</label>
              <input type="password" placeholder="••••••••" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              Update Password
            </button>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-2">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-green-500" />
            Privacy & Data
          </h2>
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
            Your data is encrypted, HIPAA-compliant, and never shared without your consent.
          </div>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            Download My Data
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
            Request Account Deletion
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={handleSave}
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
            saved
              ? "bg-green-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
          )}
        >
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}
