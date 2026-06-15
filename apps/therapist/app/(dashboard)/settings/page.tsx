"use client";

import { useState, useEffect } from "react";
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
import { therapistsAPI, billingAPI, bookingAPI } from "@/lib/api";
import { useSearchParams } from "next/navigation";
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
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "usage", label: "Usage", icon: BarChart3 },
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

function TherapistSettingsInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as SettingsTab | null;
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || "profile");
  const [billingUsage, setBillingUsage] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Booking slug
  const [slug, setSlug] = useState("");
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugCopied, setSlugCopied] = useState(false);

  // Session offerings
  const [offerings, setOfferings] = useState<{ duration_mins: number; price_cents: number; is_enabled: boolean }[]>([
    { duration_mins: 30, price_cents: 0, is_enabled: false },
    { duration_mins: 60, price_cents: 0, is_enabled: false },
  ]);
  const [offeringSaving, setOfferingSaving] = useState(false);

  // Wallet
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutBank, setPayoutBank] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutDone, setPayoutDone] = useState(false);

  // Bank details
  type PayoutMethod = "ach" | "wire" | "swift";
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("ach");
  const [bankDetails, setBankDetails] = useState({
    bank_name: "", routing_number: "", account_number: "", account_type: "checking",
    beneficiary_address: "", swift_bic: "", iban_or_account: "", bank_address: "", country_code: "",
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

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

  useEffect(() => {
    if ((activeTab === "usage" || activeTab === "billing") && !billingUsage) {
      setBillingLoading(true);
      billingAPI.usageMe().then(setBillingUsage).catch(() => {}).finally(() => setBillingLoading(false));
    }
  }, [activeTab, billingUsage]);

  useEffect(() => {
    if (activeTab === "billing" && !wallet) {
      setWalletLoading(true);
      billingAPI.wallet().then((res: any) => setWallet(res?.data ?? res)).catch(() => {}).finally(() => setWalletLoading(false));
    }
  }, [activeTab, wallet]);

  useEffect(() => {
    if (activeTab === "billing") {
      therapistsAPI.me().then((res: any) => {
        const d = res?.data ?? res;
        if (d?.payout_method) setPayoutMethod(d.payout_method as PayoutMethod);
        if (d?.bank_details) setBankDetails((prev) => ({ ...prev, ...d.bank_details }));
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "billing") {
      bookingAPI.myOfferings().then((res: any) => {
        const data: any[] = res?.data ?? res ?? [];
        if (data.length > 0) {
          setOfferings([
            { duration_mins: 30, price_cents: data.find((o: any) => o.duration_mins === 30)?.price_cents ?? 0, is_enabled: data.some((o: any) => o.duration_mins === 30 && o.is_enabled) },
            { duration_mins: 60, price_cents: data.find((o: any) => o.duration_mins === 60)?.price_cents ?? 0, is_enabled: data.some((o: any) => o.duration_mins === 60 && o.is_enabled) },
          ]);
        }
      }).catch(() => {});
    }
  }, [activeTab]);

  const handleSaveSlug = async () => {
    if (!slug.trim()) return;
    setSlugSaving(true);
    setSlugError(null);
    try {
      await therapistsAPI.updateSlug(slug.trim());
    } catch (err: any) {
      setSlugError(err?.data?.message || (err?.status === 409 ? "That slug is already taken." : "Could not save slug."));
    } finally {
      setSlugSaving(false);
    }
  };

  const copyBookingLink = async () => {
    const url = `${window.location.origin}/t/${slug}`;
    await navigator.clipboard.writeText(url);
    setSlugCopied(true);
    setTimeout(() => setSlugCopied(false), 2000);
  };

  const handleSaveOfferings = async () => {
    setOfferingSaving(true);
    try {
      await bookingAPI.updateOfferings(offerings.filter((o) => o.is_enabled).map((o) => ({
        duration_mins: o.duration_mins,
        price_cents: Math.round(o.price_cents),
        is_enabled: true,
      })));
    } catch { /* non-critical */ } finally {
      setOfferingSaving(false);
    }
  };

  const handleSaveBankDetails = async () => {
    setBankSaving(true);
    try {
      await therapistsAPI.updateBankDetails(payoutMethod, bankDetails as Record<string, unknown>);
      setBankSaved(true);
      setTimeout(() => setBankSaved(false), 3000);
    } catch { /* non-critical */ } finally {
      setBankSaving(false);
    }
  };

  const handleRequestPayout = async () => {
    const cents = Math.round(parseFloat(payoutAmount) * 100);
    if (!cents || cents <= 0) return;
    setPayoutLoading(true);
    try {
      await billingAPI.requestPayout({ amount_cents: cents, bank_details: { account_name: payoutBank, method: payoutMethod } });
      setPayoutDone(true);
      setWallet(null);
    } catch { /* show error */ } finally {
      setPayoutLoading(false);
    }
  };
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  // Profile state
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
        }));
        if (data.public_slug || data.booking_slug) setSlug(data.public_slug || data.booking_slug);
      }
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
        accepting_new_patients: true,
      });
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
                        <span className="text-white font-bold text-xl">
                          {`${(profile.first_name || "").charAt(0)}${(profile.last_name || "").charAt(0)}`.toUpperCase() || "?"}
                        </span>
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
                </SectionCard>

                <SectionCard title="Booking Link" description="Share with patients to let them self-schedule and pay online">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm text-slate-500 shrink-0 whitespace-nowrap">
                      {typeof window !== "undefined" ? window.location.origin : "https://app.24therapy.ai"}/t/
                    </span>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="your-name"
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2EC4B6]"
                    />
                  </div>
                  {slugError && <p className="text-xs text-red-500 mb-2">{slugError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveSlug}
                      disabled={slugSaving || !slug.trim()}
                      className="px-4 py-2 bg-[#0A2342] text-white text-sm font-semibold rounded-xl hover:bg-[#0d2d56] disabled:opacity-50"
                    >
                      {slugSaving ? "Saving…" : "Save"}
                    </button>
                    {slug && (
                      <button
                        onClick={copyBookingLink}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50"
                      >
                        {slugCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        {slugCopied ? "Copied!" : "Copy link"}
                      </button>
                    )}
                    {slug && (
                      <a
                        href={`/t/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50"
                      >
                        <ExternalLink className="w-4 h-4" /> Preview
                      </a>
                    )}
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

            {/* ─── AVAILABILITY TAB ─── */}
            {activeTab === "availability" && (
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
            )}

            {/* ─── BILLING TAB ─── */}
            {activeTab === "billing" && (
              <>
                {/* ── Wallet ── */}
                <SectionCard title="Your Wallet" description="85% of patient payments are credited here after sessions">
                  {walletLoading ? (
                    <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                  ) : wallet ? (
                    <>
                      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl p-4 text-white mb-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-sm text-white/70">Available balance</div>
                            <div className="text-3xl font-bold">${((wallet.balance_cents || 0) / 100).toFixed(2)}</div>
                          </div>
                          <button
                            onClick={() => { setShowPayoutModal(true); setPayoutDone(false); setPayoutAmount(""); }}
                            className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                          >
                            Request Payout
                          </button>
                        </div>
                        <div className="flex gap-6 mt-3">
                          <div>
                            <div className="text-xs text-white/60">Lifetime earned</div>
                            <div className="text-sm font-semibold">${((wallet.lifetime_earned_cents || 0) / 100).toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-white/60">Lifetime withdrawn</div>
                            <div className="text-sm font-semibold">${((wallet.lifetime_withdrawn_cents || 0) / 100).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                      {wallet.transactions?.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent transactions</div>
                          {wallet.transactions.slice(0, 10).map((tx: any) => (
                            <div key={tx.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                              <span className="text-gray-600">{tx.description || tx.type}</span>
                              <span className={tx.type === "credit" ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                                {tx.type === "credit" ? "+" : "-"}${(tx.amount_cents / 100).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-2">No transactions yet. Earnings appear here after patient payments.</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">Loading wallet…</p>
                  )}
                </SectionCard>

                {/* ── Payout Bank Details ── */}
                <SectionCard title="Payout Settings" description="Where we send your earnings. Processed within 48 hours of request.">
                  {/* Method tabs */}
                  <div className="flex gap-2 mb-5">
                    {(["ach", "wire", "swift"] as PayoutMethod[]).map((m) => (
                      <button key={m} onClick={() => setPayoutMethod(m)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${payoutMethod === m ? "bg-[#0A2342] text-white border-[#0A2342]" : "text-gray-600 border-gray-200 hover:border-gray-300 bg-white"}`}>
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    {/* ACH fields */}
                    {payoutMethod === "ach" && (<>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                          <input value={bankDetails.bank_name} onChange={(e) => setBankDetails(d => ({...d, bank_name: e.target.value}))} placeholder="e.g. Chase" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Account Type</label>
                          <select value={bankDetails.account_type} onChange={(e) => setBankDetails(d => ({...d, account_type: e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF] bg-white">
                            <option value="checking">Checking</option>
                            <option value="savings">Savings</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Routing Number (9 digits)</label>
                        <input value={bankDetails.routing_number} onChange={(e) => setBankDetails(d => ({...d, routing_number: e.target.value}))} placeholder="021000021" maxLength={9} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                        <input value={bankDetails.account_number} onChange={(e) => setBankDetails(d => ({...d, account_number: e.target.value}))} placeholder="Your account number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                    </>)}

                    {/* Wire fields */}
                    {payoutMethod === "wire" && (<>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                        <input value={bankDetails.bank_name} onChange={(e) => setBankDetails(d => ({...d, bank_name: e.target.value}))} placeholder="e.g. Bank of America" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Account Number</label>
                        <input value={bankDetails.account_number} onChange={(e) => setBankDetails(d => ({...d, account_number: e.target.value}))} placeholder="Your account number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">ABA Routing Number</label>
                        <input value={bankDetails.routing_number} onChange={(e) => setBankDetails(d => ({...d, routing_number: e.target.value}))} placeholder="9-digit routing number" maxLength={9} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiary Address</label>
                        <input value={bankDetails.beneficiary_address} onChange={(e) => setBankDetails(d => ({...d, beneficiary_address: e.target.value}))} placeholder="Your mailing address" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                    </>)}

                    {/* SWIFT fields */}
                    {payoutMethod === "swift" && (<>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">SWIFT / BIC Code</label>
                          <input value={bankDetails.swift_bic} onChange={(e) => setBankDetails(d => ({...d, swift_bic: e.target.value.toUpperCase()}))} placeholder="CHASUS33" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF] uppercase" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Country Code (ISO)</label>
                          <input value={bankDetails.country_code} onChange={(e) => setBankDetails(d => ({...d, country_code: e.target.value.toUpperCase()}))} placeholder="US" maxLength={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF] uppercase" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">IBAN or Account Number</label>
                        <input value={bankDetails.iban_or_account} onChange={(e) => setBankDetails(d => ({...d, iban_or_account: e.target.value}))} placeholder="IBAN or account number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                        <input value={bankDetails.bank_name} onChange={(e) => setBankDetails(d => ({...d, bank_name: e.target.value}))} placeholder="e.g. Deutsche Bank" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Bank Address</label>
                        <input value={bankDetails.bank_address} onChange={(e) => setBankDetails(d => ({...d, bank_address: e.target.value}))} placeholder="Full bank address" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1F5EFF]" />
                      </div>
                    </>)}
                  </div>

                  <p className="text-xs text-gray-400 mt-4 mb-4">ACH: 1–3 business days · Wire: 2–5 days · SWIFT: 3–7 days after initiation.</p>

                  <button onClick={handleSaveBankDetails} disabled={bankSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#0A2342] text-white text-sm font-semibold rounded-xl hover:bg-[#1F5EFF] transition-colors disabled:opacity-50">
                    {bankSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : bankSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {bankSaved ? "Saved!" : "Save Bank Details"}
                  </button>
                </SectionCard>

                {/* ── Session Offerings ── */}
                <SectionCard title="Session Offerings" description="Configure durations and prices for your booking calendar">
                  <div className="space-y-3 mb-4">
                    {offerings.map((o, i) => (
                      <div key={o.duration_mins} className="flex items-center gap-4 border border-gray-200 rounded-xl p-3">
                        <ToggleSwitch
                          enabled={o.is_enabled}
                          onChange={(v) => setOfferings(prev => prev.map((x, xi) => xi === i ? { ...x, is_enabled: v } : x))}
                        />
                        <span className="text-sm font-medium text-gray-700 w-16">{o.duration_mins} min</span>
                        {o.is_enabled && (
                          <div className="flex items-center gap-1 flex-1">
                            <span className="text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={o.price_cents > 0 ? (o.price_cents / 100).toFixed(0) : ""}
                              onChange={(e) => setOfferings(prev => prev.map((x, xi) => xi === i ? { ...x, price_cents: Math.round(parseFloat(e.target.value || "0") * 100) } : x))}
                              placeholder="Price in USD"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#2EC4B6]"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSaveOfferings}
                    disabled={offeringSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0A2342] text-white text-sm font-semibold rounded-xl hover:bg-[#0d2d56] disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {offeringSaving ? "Saving…" : "Save Offerings"}
                  </button>
                </SectionCard>

                {/* Payout Modal */}
                {showPayoutModal && (
                  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                      {payoutDone ? (
                        <>
                          <div className="flex items-center gap-3 mb-4">
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                            <div>
                              <h2 className="text-lg font-bold text-gray-900">Payout requested</h2>
                              <p className="text-sm text-gray-500">We'll process it within 3-5 business days.</p>
                            </div>
                          </div>
                          <button onClick={() => setShowPayoutModal(false)} className="w-full h-10 bg-[#0A2342] text-white rounded-xl text-sm font-semibold">Close</button>
                        </>
                      ) : (
                        <>
                          <h2 className="text-lg font-bold text-gray-900 mb-1">Request Payout</h2>
                          <p className="text-xs text-gray-500 mb-4">Via {payoutMethod.toUpperCase()} · Processed within 48 hours</p>
                          <div className="space-y-3 mb-5">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (USD)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                                <input
                                  type="number"
                                  min="50"
                                  max={wallet ? (wallet.balance_cents / 100).toFixed(2) : undefined}
                                  value={payoutAmount}
                                  onChange={(e) => setPayoutAmount(e.target.value)}
                                  placeholder={`Min $50 · Max $${wallet ? (wallet.balance_cents / 100).toFixed(2) : "0"}`}
                                  className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-[#1F5EFF]"
                                />
                              </div>
                            </div>
                            {bankDetails.bank_name && (
                              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-xs text-gray-600">
                                Sending to: <span className="font-medium">{bankDetails.bank_name}</span>
                                {bankDetails.account_number && ` ····${bankDetails.account_number.slice(-4)}`}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-3">
                            <button onClick={() => setShowPayoutModal(false)} className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50">
                              Cancel
                            </button>
                            <button
                              onClick={handleRequestPayout}
                              disabled={payoutLoading || !payoutAmount}
                              className="flex-1 h-10 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {payoutLoading ? "Submitting…" : "Request Payout"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <SectionCard title="Current Plan">
                  {billingLoading ? (
                    <div className="h-24 bg-gray-100 rounded-xl animate-pulse mb-4" />
                  ) : billingUsage ? (
                    <>
                      <div className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-xl p-4 text-white mb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-white/70">Current Plan</div>
                            <div className="text-2xl font-bold">{billingUsage.plan?.name || "Pay As You Go"}</div>
                            <div className="text-sm text-white/70 mt-0.5">
                              {billingUsage.plan?.price_monthly_usd
                                ? `$${billingUsage.plan.price_monthly_usd}/month`
                                : billingUsage.plan?.price_per_session_usd
                                  ? `$${billingUsage.plan.price_per_session_usd}/session`
                                  : "Custom pricing"}
                            </div>
                          </div>
                          <span className="bg-[#2EC4B6] text-white text-xs px-2 py-1 rounded-full font-medium">Active</span>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={() => setActiveTab("usage")}
                          className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:border-[#2EC4B6] hover:text-[#2EC4B6]"
                        >
                          View Usage & Upgrade
                        </button>
                        {!cancelConfirm ? (
                          <button
                            onClick={() => setCancelConfirm(true)}
                            className="px-4 py-2.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50"
                          >
                            Cancel Subscription
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-slate-600">Are you sure?</span>
                            <button
                              onClick={async () => {
                                try {
                                  await billingAPI.cancel();
                                  setBillingUsage(null);
                                  setCancelConfirm(false);
                                } catch { setCancelConfirm(false); }
                              }}
                              className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700"
                            >
                              Yes, Cancel
                            </button>
                            <button onClick={() => setCancelConfirm(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl">
                              Keep Plan
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-xl p-4 text-white mb-4">
                      <div className="text-sm text-white/70">Current Plan</div>
                      <div className="text-2xl font-bold">Pay As You Go</div>
                      <div className="text-sm text-white/70 mt-0.5">$6/session · First session free</div>
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Charge History">
                  {billingLoading ? (
                    <div className="space-y-2">
                      {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}
                    </div>
                  ) : billingUsage?.charge_history?.length > 0 ? (
                    <div className="space-y-2">
                      {billingUsage.charge_history.slice(0, 10).map((ch: any) => (
                        <div key={ch.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                          <div className="text-sm text-gray-600 flex-1 min-w-0 truncate">{ch.description || ch.plan_key}</div>
                          <div className="font-medium text-gray-800 mx-3">
                            {ch.discount_usd > 0 ? (
                              <span><span className="line-through text-gray-400 text-xs">${ch.amount_usd}</span> $0</span>
                            ) : (
                              `$${Number(ch.amount_due_usd || ch.amount_usd).toFixed(2)}`
                            )}
                          </div>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            ch.status === "paid" ? "bg-emerald-100 text-emerald-700"
                            : ch.status === "waived" ? "bg-blue-100 text-blue-700"
                            : ch.status === "included" ? "bg-gray-100 text-gray-600"
                            : "bg-red-100 text-red-600"
                          )}>
                            {ch.status === "waived" ? "Free" : ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No charges yet</p>
                  )}
                </SectionCard>
              </>
            )}

            {/* ─── USAGE TAB ─── */}
            {activeTab === "usage" && (
              <>
                {billingLoading ? (
                  <div className="space-y-4">
                    {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
                  </div>
                ) : billingUsage ? (
                  <>
                    {/* Plan card */}
                    <SectionCard title="Your Plan">
                      <div className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-xl p-4 text-white mb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm text-white/70">Current Plan</div>
                            <div className="text-2xl font-bold">{billingUsage.plan?.name || "Pay As You Go"}</div>
                            <div className="text-sm text-white/70 mt-0.5">
                              {billingUsage.plan?.price_monthly_usd
                                ? `$${billingUsage.plan.price_monthly_usd}/month`
                                : billingUsage.plan?.price_per_session_usd
                                  ? `$${billingUsage.plan.price_per_session_usd}/session — first session free`
                                  : ""}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Plan cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        {[
                          { key: "starter", name: "Starter", price: "$59/mo", desc: "20 sessions · 50% off", highlight: false },
                          { key: "pro", name: "Unlimited", price: "$99/mo", desc: "Unlimited sessions", highlight: true },
                          { key: "practice", name: "Practice", price: "from $189/mo", desc: "2+ therapists", highlight: false },
                        ].map((plan) => (
                          <div key={plan.key} className={cn(
                            "rounded-xl p-3 border",
                            plan.highlight ? "border-[#1F5EFF] bg-[#1F5EFF]/5" : "border-gray-200"
                          )}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-sm text-[#0A2342]">{plan.name}</span>
                              {plan.highlight && <span className="text-xs bg-[#1F5EFF] text-white px-2 py-0.5 rounded-full">Popular</span>}
                            </div>
                            <div className="text-lg font-bold text-[#0A2342]">{plan.price}</div>
                            <div className="text-xs text-gray-500 mb-2">{plan.desc}</div>
                            <button
                              onClick={async () => {
                                const res = await billingAPI.subscribe({
                                  plan_key: plan.key,
                                  interval: "monthly",
                                  success_url: window.location.href + "?subscribed=1",
                                  cancel_url: window.location.href,
                                });
                                if (res?.checkout_url) window.location.href = res.checkout_url;
                                else if (res?.message) alert(res.message);
                              }}
                              className="w-full bg-[#1F5EFF] text-white text-xs font-medium py-1.5 rounded-lg hover:bg-[#1F5EFF]/90 transition-colors"
                            >
                              Switch to {plan.name}
                            </button>
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    {/* Sessions meter */}
                    {billingUsage.quota && (
                      <SectionCard title="Sessions This Month">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Used</span>
                            <span className="font-semibold text-[#0A2342]">
                              {billingUsage.quota.used} / {billingUsage.quota.included + billingUsage.quota.rollover_in}
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-[#1F5EFF] rounded-full h-2 transition-all"
                              style={{ width: `${Math.min(100, (billingUsage.quota.used / (billingUsage.quota.included + billingUsage.quota.rollover_in)) * 100)}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-lg font-bold text-[#0A2342]">{billingUsage.quota.included}</div>
                              <div className="text-xs text-gray-400">Included</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-lg font-bold text-[#2EC4B6]">{billingUsage.quota.rollover_in}</div>
                              <div className="text-xs text-gray-400">Rolled over</div>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <div className="text-lg font-bold text-green-600">{billingUsage.quota.remaining}</div>
                              <div className="text-xs text-gray-400">Remaining</div>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    )}

                    {billingUsage.plan?.plan_key === "pay_per_session" && (
                      <SectionCard title="Sessions This Month">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold text-[#0A2342]">{billingUsage.sessions_this_month}</div>
                            <div className="text-sm text-gray-500">sessions completed · ${(billingUsage.sessions_this_month * 6).toFixed(2)} billed</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">$6/session</div>
                            <div className="text-xs text-[#1F5EFF]">Save 50% → Starter $59/mo</div>
                          </div>
                        </div>
                      </SectionCard>
                    )}

                    {/* Pending bills */}
                    {billingUsage.pending_bills?.length > 0 && (
                      <SectionCard title="Unpaid Bills">
                        <div className="space-y-3">
                          {billingUsage.pending_bills.map((bill: any) => (
                            <div key={bill.id} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl p-3">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-red-800">{bill.description}</div>
                                <div className="text-xs text-red-500 mt-0.5">
                                  {bill.charged_at ? new Date(bill.charged_at).toLocaleDateString() : ""}
                                </div>
                              </div>
                              <div className="font-bold text-red-700 mx-3">${Number(bill.amount_due_usd).toFixed(2)}</div>
                              {bill.stripe_checkout_url ? (
                                <a
                                  href={bill.stripe_checkout_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-700"
                                >
                                  Pay Now
                                </a>
                              ) : (
                                <span className="text-xs text-red-400">Payment link pending</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    )}

                    {/* AI Credits */}
                    <SectionCard title="AI Assistant Credits">
                      <div className="flex items-center justify-between">
                        <div>
                          {billingUsage.ai_credits === "unlimited" ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[#2EC4B6]" />
                                <span className="text-2xl font-bold text-[#0A2342]">Unlimited</span>
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5">Included in your plan</div>
                            </>
                          ) : (
                            <>
                              <div className="text-2xl font-bold text-[#0A2342]">{billingUsage.ai_credits}</div>
                              <div className="text-sm text-gray-500 mt-0.5">messages remaining · every session adds 5</div>
                            </>
                          )}
                        </div>
                        <Link href="/assistant" className="flex items-center gap-1 text-sm text-[#1F5EFF] hover:underline">
                          Open Assistant <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </SectionCard>

                    {/* Charge history */}
                    <SectionCard title="Charge History">
                      <div className="space-y-2">
                        {billingUsage.charge_history?.slice(0, 20).map((ch: any) => (
                          <div key={ch.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                            <div className="text-sm text-gray-600 flex-1 min-w-0 truncate">
                              {ch.description || ch.plan_key}
                            </div>
                            <div className="font-medium text-gray-800 mx-3">
                              {ch.discount_usd > 0 ? (
                                <span><span className="line-through text-gray-400 text-xs">${Number(ch.amount_usd).toFixed(2)}</span> Free</span>
                              ) : (
                                `$${Number(ch.amount_due_usd || ch.amount_usd).toFixed(2)}`
                              )}
                            </div>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              ch.status === "paid" ? "bg-emerald-100 text-emerald-700"
                              : ch.status === "waived" ? "bg-blue-100 text-blue-700"
                              : ch.status === "included" ? "bg-gray-100 text-gray-600"
                              : "bg-red-100 text-red-600"
                            )}>
                              {ch.status === "waived" ? "Free" : ch.status.charAt(0).toUpperCase() + ch.status.slice(1)}
                            </span>
                          </div>
                        ))}
                        {(!billingUsage.charge_history || billingUsage.charge_history.length === 0) && (
                          <p className="text-sm text-gray-400 text-center py-4">No charges yet</p>
                        )}
                      </div>
                    </SectionCard>
                  </>
                ) : (
                  <SectionCard title="Usage">
                    <p className="text-sm text-gray-400 text-center py-8">Loading usage data…</p>
                  </SectionCard>
                )}
              </>
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
