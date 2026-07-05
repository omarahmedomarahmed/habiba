"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  User, Settings, Bell, Shield, CreditCard, Brain, Building2,
  Save, Camera, Eye, EyeOff, CheckCircle, AlertCircle, Trash2,
  Plus, X, Globe, Lock, Smartphone, Key, Download,
  LogOut, RefreshCw, Zap, Network, FileText, ClipboardList,
  Clock, DollarSign, Mail, Phone, MapPin, Link2, Upload,
  AlertTriangle, ChevronRight, Palette, Monitor, Volume2,
  Users, Calendar, BarChart3, ExternalLink, Copy, Check, ArrowRight, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { therapistsAPI, usersAPI } from "@/lib/api";
import { SPECIALTIES, LANGUAGES } from "@/lib/specialties";
import { useUIStore } from "@/lib/store";
import { hasTier } from "@/lib/tiers";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

type SettingsTab =
  | "profile"
  | "practice"
  | "availability"
  | "ai"
  | "notifications"
  | "security"
  | "billing"
  | "usage";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "practice", label: "Practice", icon: Building2 },
  { id: "availability", label: "Availability", icon: Calendar },
  { id: "ai", label: "AI & Scribe", icon: Brain },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
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

function UpgradeNotice({ feature }: { feature: string }) {
  return (
    <div className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-2xl p-6 text-white">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-5 h-5 text-yellow-300" />
        <h3 className="font-bold text-lg">A paid plan is required</h3>
      </div>
      <p className="text-sm text-white/80 mb-4 max-w-md">
        {feature} is available once you upgrade. Pay-as-you-go therapists can run
        sessions and take notes; Radar matching, recordings, and availability
        scheduling unlock on Starter and above.
      </p>
      <Link
        href="/billing"
        className="inline-flex items-center gap-1.5 h-9 px-4 bg-white text-[#0A2342] text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors"
      >
        View plans <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
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

function TherapistSettingsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab") as SettingsTab | null;
  // Billing lives on its own /billing page now — never inside settings.
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam && tabParam !== "billing" && tabParam !== "usage" ? tabParam : "profile",
  );
  const subscriptionTier = useUIStore((s) => s.subscriptionTier);
  // null = not yet loaded → don't flash a gate; treat as allowed until known.
  const isPaid = subscriptionTier !== null && hasTier(subscriptionTier, "starter");

  useEffect(() => {
    if (tabParam === "billing" || tabParam === "usage") router.replace("/billing");
  }, [tabParam, router]);
  // Availability
  const [availSlots, setAvailSlots] = useState<{ day_of_week: number; start_time: string; end_time: string; is_active: boolean }[]>(
    DAYS.map((_, i) => ({ day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: i >= 1 && i <= 5 }))
  );
  const [availSaving, setAvailSaving] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  useEffect(() => {
    if (activeTab === "availability") {
      therapistsAPI.availability().then((res: any) => {
        const data: any[] = Array.isArray(res) ? res : res?.data ?? [];
        if (data.length > 0) {
          setAvailSlots(DAYS.map((_, i) => {
            const row = data.find((d: any) => d.day_of_week === i);
            return row
              ? { day_of_week: i, start_time: row.start_time?.slice(0, 5) || "09:00", end_time: row.end_time?.slice(0, 5) || "17:00", is_active: row.is_active }
              : { day_of_week: i, start_time: "09:00", end_time: "17:00", is_active: false };
          }));
        }
      }).catch(() => {});
    }
  }, [activeTab]);

  const handleSaveAvailability = async () => {
    setAvailSaving(true);
    setAvailSaved(false);
    try {
      await therapistsAPI.updateAvailability(availSlots.map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active,
      })));
      setAvailSaved(true);
      setTimeout(() => setAvailSaved(false), 3000);
    } catch { /* non-critical */ } finally {
      setAvailSaving(false);
    }
  };

  useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  // Profile state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 1.5 * 1024 * 1024) { alert('Image must be under 1.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setAvatarPreview(dataUrl);
      setAvatarUploading(true);
      try {
        await therapistsAPI.uploadAvatar(dataUrl);
      } catch {
        alert('Avatar upload failed. Please try again.');
        setAvatarPreview(null);
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const [profile, setProfile] = useState({
    first_name: "", last_name: "", email: "",
    phone: "", title: "", credentials: "",
    display_name: "",
    license_number: "", license_state: "", license_expiry: "",
    years_experience: "",
    location: "",
    bio: "",
    specializations: [] as string[],
    languages: [] as string[],
    timezone: "America/New_York",
    session_fee: "",
    sliding_scale: false,
    accepting_new_patients: true,
    avatar_url: "",
  });
  const [specialtyInput, setSpecialtyInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");

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
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (pwNew.length < 8) { setPwMsg({ type: "err", text: "New password must be at least 8 characters." }); return; }
    setPwLoading(true);
    try {
      await usersAPI.changePassword(pwCurrent, pwNew);
      setPwCurrent(""); setPwNew("");
      setPwMsg({ type: "ok", text: "Password updated." });
    } catch (e: any) {
      setPwMsg({ type: "err", text: e?.message || "Could not change password." });
    } finally {
      setPwLoading(false);
    }
  };


  // Load real profile on mount
  useEffect(() => {
    therapistsAPI.me().then((raw: any) => {
      const data = raw?.data?.therapist ?? raw?.data ?? raw;
      if (data) {
        setProfile((prev) => ({
          ...prev,
          first_name: data.first_name || prev.first_name,
          last_name: data.last_name || prev.last_name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          display_name: data.display_name || prev.display_name,
          bio: data.bio || prev.bio,
          license_number: data.license_number || prev.license_number,
          license_state: data.license_state || prev.license_state,
          years_experience: data.years_experience != null ? String(data.years_experience) : prev.years_experience,
          location: data.location || data.city || prev.location,
          specializations: Array.isArray(data.specializations) && data.specializations.length
            ? data.specializations
            : (Array.isArray(data.specialties) ? data.specialties : prev.specializations),
          languages: Array.isArray(data.languages) && data.languages.length ? data.languages : prev.languages,
          session_fee: data.session_fee_min != null ? String(data.session_fee_min) : prev.session_fee,
          accepting_new_patients: data.accepting_new_patients != null ? Boolean(data.accepting_new_patients) : prev.accepting_new_patients,
          avatar_url: data.avatar_url || prev.avatar_url,
        }));
        if (data.ai_preferences && typeof data.ai_preferences === "object") {
          setAiPrefs((prev) => ({ ...prev, ...data.ai_preferences }));
        }
      }
    }).catch(() => {});

    usersAPI.getNotificationPreferences().then((p: any) => {
      if (!p) return;
      setNotifPrefs((prev) => ({
        ...prev,
        email_reminders: p.email_enabled ?? prev.email_reminders,
        sms_reminders: p.sms_enabled ?? prev.sms_reminders,
        push_enabled: p.push_enabled ?? prev.push_enabled,
        session_reminders: p.email_session_reminders ?? prev.session_reminders,
        risk_alerts: p.email_risk_alerts ?? prev.risk_alerts,
        billing_events: p.email_payment_events ?? prev.billing_events,
        messages: p.push_messages ?? prev.messages,
        quiet_hours: p.quiet_hours_enabled ?? prev.quiet_hours,
        quiet_start: p.quiet_start ? String(p.quiet_start).slice(0, 5) : prev.quiet_start,
        quiet_end: p.quiet_end ? String(p.quiet_end).slice(0, 5) : prev.quiet_end,
      }));
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await therapistsAPI.updateProfile({
        display_name: profile.display_name || `${profile.first_name} ${profile.last_name}`.trim(),
        bio: profile.bio,
        license_number: profile.license_number,
        license_state: profile.license_state,
        years_experience: profile.years_experience ? parseInt(profile.years_experience) : undefined,
        location: profile.location,
        specializations: profile.specializations,
        languages: profile.languages,
        accepting_new_patients: profile.accepting_new_patients,
        ...(profile.session_fee !== "" && Number.isFinite(Number(profile.session_fee))
          ? { session_fee_min: Number(profile.session_fee), session_fee_max: Number(profile.session_fee) }
          : {}),
        ai_preferences: aiPrefs,
      });
      await usersAPI.updateNotificationPreferences({
        email_enabled: notifPrefs.email_reminders,
        sms_enabled: notifPrefs.sms_reminders,
        push_enabled: notifPrefs.push_enabled,
        email_session_reminders: notifPrefs.session_reminders,
        email_risk_alerts: notifPrefs.risk_alerts,
        email_payment_events: notifPrefs.billing_events,
        push_messages: notifPrefs.messages,
        quiet_hours_enabled: notifPrefs.quiet_hours,
        quiet_start: notifPrefs.quiet_hours ? notifPrefs.quiet_start : null,
        quiet_end: notifPrefs.quiet_hours ? notifPrefs.quiet_end : null,
      }).catch(() => { /* notif prefs are best-effort */ });
    } catch {
      // non-critical
    } finally {
      setSaving(false);
    }
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const addTag = (key: "specializations" | "languages", value: string) => {
    const v = value.trim();
    if (!v) return;
    setProfile((prev) => prev[key].includes(v) ? prev : { ...prev, [key]: [...prev[key], v] });
  };
  const removeTag = (key: "specializations" | "languages", value: string) => {
    setProfile((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== value) }));
  };

  // API key generation is not yet implemented — placeholder removed for security

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
                      {(avatarPreview || profile.avatar_url) ? (
                        <img
                          src={avatarPreview || profile.avatar_url}
                          alt="Profile photo"
                          className="w-20 h-20 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0A2342] to-[#2EC4B6] flex items-center justify-center">
                          <span className="text-white font-bold text-xl">
                            {`${(profile.first_name || "").charAt(0)}${(profile.last_name || "").charAt(0)}`.toUpperCase() || "?"}
                          </span>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:border-[#2EC4B6] disabled:opacity-50"
                        title={avatarUploading ? 'Uploading…' : 'Change photo'}
                      >
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
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Display Name <span className="text-gray-400">(shown on your public profile)</span></label>
                          <input
                            value={profile.display_name}
                            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                            placeholder="e.g. Dr. Sarah Chen, PsyD"
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
                      { label: "Years of Experience", key: "years_experience", type: "number" },
                      { label: "Location / City", key: "location" },
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
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={specialtyInput}
                      onChange={(e) => setSpecialtyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag("specializations", specialtyInput); setSpecialtyInput(""); } }}
                      placeholder="Add a specialty and press Enter"
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                    />
                    <button
                      type="button"
                      onClick={() => { addTag("specializations", specialtyInput); setSpecialtyInput(""); }}
                      className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-2 rounded-xl text-sm hover:border-[#2EC4B6] hover:text-[#2EC4B6]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-400 mb-2">Quick add from common specialties</p>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALTIES.map((s) => {
                        const active = profile.specializations.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setProfile({
                              ...profile,
                              specializations: active
                                ? profile.specializations.filter((x) => x !== s)
                                : [...profile.specializations, s],
                            })}
                            className={cn(
                              "px-3 py-1.5 rounded-xl border text-sm transition-all",
                              active ? "bg-[#0A2342] text-white border-[#0A2342]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                            )}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Languages Spoken" description="Shown on your public profile and booking page">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {profile.languages.map((l) => (
                      <span key={l} className="flex items-center gap-1.5 bg-[#2EC4B6]/10 text-[#0A2342] px-3 py-1 rounded-full text-sm">
                        {l}
                        <button onClick={() => removeTag("languages", l)} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={languageInput}
                      onChange={(e) => setLanguageInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag("languages", languageInput); setLanguageInput(""); } }}
                      placeholder="Add a language and press Enter"
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                    />
                    <button
                      type="button"
                      onClick={() => { addTag("languages", languageInput); setLanguageInput(""); }}
                      className="flex items-center gap-1 border border-gray-300 text-gray-600 px-3 py-2 rounded-xl text-sm hover:border-[#2EC4B6] hover:text-[#2EC4B6]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-400 mb-2">Quick add common languages</p>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGES.map((l) => {
                        const active = profile.languages.includes(l);
                        return (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setProfile({
                              ...profile,
                              languages: active
                                ? profile.languages.filter((x) => x !== l)
                                : [...profile.languages, l],
                            })}
                            className={cn(
                              "px-3 py-1.5 rounded-xl border text-sm transition-all",
                              active ? "bg-[#2EC4B6] text-white border-[#2EC4B6]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                            )}
                          >
                            {l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SectionCard>

              </>
            )}

            {/* ─── PRACTICE TAB ─── */}
            {activeTab === "practice" && (
              <>
                <SectionCard title="Session Rate" description="Your standard fee — shown on your public profile and pre-fills new sessions">
                  <div className="max-w-xs">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Standard Session Fee (USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={profile.session_fee}
                        onChange={(e) => setProfile({ ...profile, session_fee: e.target.value })}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Saved with the Save Changes button above.</p>
                  </div>
                </SectionCard>

                <SectionCard title="Marketplace Visibility" description="How you appear to patients searching for a therapist">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-700">Accepting new patients</div>
                      <div className="text-xs text-gray-400">Shown as accepting new patients on your public profile</div>
                    </div>
                    <ToggleSwitch
                      enabled={profile.accepting_new_patients}
                      onChange={(v) => setProfile({ ...profile, accepting_new_patients: v })}
                    />
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

                <p className="text-xs text-gray-400 px-1">
                  Changes here are saved with the <span className="font-medium">Save Changes</span> button above.
                </p>
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
                <SectionCard title="Password" description="Choose a strong password you don't use elsewhere">
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? "text" : "password"}
                          value={pwCurrent}
                          onChange={(e) => setPwCurrent(e.target.value)}
                          autoComplete="current-password"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] pr-10"
                        />
                        <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={pwNew}
                          onChange={(e) => setPwNew(e.target.value)}
                          autoComplete="new-password"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6] pr-10"
                        />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">At least 8 characters.</p>
                    </div>
                    {pwMsg && (
                      <p className={cn("text-xs", pwMsg.type === "ok" ? "text-emerald-600" : "text-red-500")}>{pwMsg.text}</p>
                    )}
                    <button
                      onClick={handleChangePassword}
                      disabled={pwLoading || !pwCurrent || !pwNew}
                      className="bg-[#0A2342] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0d2d56] disabled:opacity-50 flex items-center gap-2"
                    >
                      {pwLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                      {pwLoading ? "Updating…" : "Update Password"}
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
                  <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">API Access — Coming Soon</p>
                      <p className="text-xs text-amber-600 mt-1">Programmatic API access for integrations is under development. Contact support to join the early access programme.</p>
                    </div>
                  </div>
                </SectionCard>

              </>
            )}

            {/* ─── AVAILABILITY TAB ─── */}
            {activeTab === "availability" && (
              !isPaid ? <UpgradeNotice feature="Availability scheduling" /> : (
              <>
                <SectionCard
                  title="Weekly Schedule"
                  description="Set the hours you're available for patient bookings. Patients see these slots on your booking page."
                >
                  <div className="space-y-3">
                    {availSlots.map((slot, i) => (
                      <div key={slot.day_of_week} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                        slot.is_active ? "border-[#1F5EFF]/30 bg-blue-50/50" : "border-gray-100 bg-gray-50"
                      )}>
                        <button
                          onClick={() => setAvailSlots(prev => prev.map((s, idx) => idx === i ? { ...s, is_active: !s.is_active } : s))}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            slot.is_active ? "bg-[#1F5EFF] border-[#1F5EFF]" : "border-gray-300 bg-white"
                          )}
                        >
                          {slot.is_active && <Check className="w-3 h-3 text-white" />}
                        </button>
                        <span className={cn("w-24 text-sm font-medium shrink-0", slot.is_active ? "text-slate-800" : "text-slate-400")}>
                          {DAYS[slot.day_of_week]}
                        </span>
                        {slot.is_active ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={slot.start_time}
                              onChange={e => setAvailSlots(prev => prev.map((s, idx) => idx === i ? { ...s, start_time: e.target.value } : s))}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30 bg-white"
                            />
                            <span className="text-slate-400 text-sm">to</span>
                            <input
                              type="time"
                              value={slot.end_time}
                              onChange={e => setAvailSlots(prev => prev.map((s, idx) => idx === i ? { ...s, end_time: e.target.value } : s))}
                              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30 bg-white"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">Unavailable</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSaveAvailability}
                    disabled={availSaving}
                    className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-[#1F5EFF] text-white text-sm font-semibold rounded-xl hover:bg-[#1649D4] transition-colors disabled:opacity-50"
                  >
                    {availSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : availSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {availSaving ? "Saving…" : availSaved ? "Saved!" : "Save Availability"}
                  </button>
                </SectionCard>

                <SectionCard
                  title="Timezone"
                  description="Your availability slots are shown to patients in your local timezone."
                >
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30"
                    defaultValue="America/New_York"
                  >
                    {[
                      "America/New_York", "America/Chicago", "America/Denver",
                      "America/Los_Angeles", "America/Phoenix", "Europe/London",
                      "Europe/Paris", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo",
                    ].map(tz => (
                      <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-2">Timezone is saved as part of your profile.</p>
                </SectionCard>
              </>
              )
            )}


          </div>
        </div>
      </div>
    </div>
  );
}

export default function TherapistSettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#1F5EFF]" /></div>}>
      <TherapistSettingsInner />
    </Suspense>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
