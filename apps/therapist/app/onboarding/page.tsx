"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { therapistsAPI } from "@/lib/api";
import {
  Brain, CheckCircle2, ChevronRight, ChevronLeft, User, Building2,
  Stethoscope, Shield, CreditCard, Users, Calendar, Sparkles,
  Upload, Globe, Phone, Mail, MapPin, Award, BookOpen, Zap,
  AlertTriangle, Check, Lock, ArrowRight, Camera, FileText, Network
} from "lucide-react";
import { cn } from "@/lib/utils";

type OnboardingStep =
  | "welcome"
  | "profile"
  | "practice"
  | "credentials"
  | "specialties"
  | "availability"
  | "billing_setup"
  | "ai_preferences"
  | "complete";

interface OnboardingData {
  first_name: string;
  last_name: string;
  pronouns: string;
  credentials: string;
  license_type: string;
  license_number: string;
  license_state: string;
  license_expiry: string;
  npi_number: string;
  practice_name: string;
  practice_type: "solo" | "group" | "hospital" | "community" | "";
  practice_address: string;
  practice_city: string;
  practice_state: string;
  practice_zip: string;
  phone: string;
  website: string;
  bio: string;
  years_experience: string;
  education: string;
  specialties: string[];
  modalities: string[];
  populations: string[];
  languages: string[];
  session_fee: string;
  sliding_scale: boolean;
  accepts_insurance: boolean;
  insurance_panels: string[];
  telehealth: boolean;
  in_person: boolean;
  weekly_capacity: string;
  ai_scribe: boolean;
  ai_copilot: boolean;
  ai_memory: boolean;
  ai_radar: boolean;
  notification_prefs: string[];
}

const STEPS: Array<{
  id: OnboardingStep;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  { id: "welcome", label: "Welcome", description: "Getting started", icon: Sparkles },
  { id: "profile", label: "Your Profile", description: "Personal information", icon: User },
  { id: "practice", label: "Practice", description: "Your practice details", icon: Building2 },
  { id: "credentials", label: "Credentials", description: "License & certifications", icon: Award },
  { id: "specialties", label: "Specialties", description: "Your clinical focus areas", icon: Stethoscope },
  { id: "availability", label: "Availability", description: "Schedule & capacity", icon: Calendar },
  { id: "billing_setup", label: "Billing", description: "Fees & insurance", icon: CreditCard },
  { id: "ai_preferences", label: "AI Setup", description: "Configure AI features", icon: Brain },
  { id: "complete", label: "Complete", description: "Ready to start", icon: CheckCircle2 },
];

const SPECIALTIES = [
  "Depression", "Anxiety", "PTSD / Trauma", "OCD", "Bipolar Disorder",
  "Eating Disorders", "Substance Use / Addiction", "ADHD", "Personality Disorders",
  "Grief & Loss", "Relationship Issues", "Family Therapy", "Couples Therapy",
  "Child & Adolescent", "Geriatric Mental Health", "LGBTQ+", "Cultural Issues",
  "Chronic Pain & Illness", "Sleep Disorders", "Work & Career",
];

const MODALITIES = [
  "Cognitive Behavioral Therapy (CBT)", "Dialectical Behavior Therapy (DBT)",
  "EMDR", "Psychodynamic", "Acceptance & Commitment Therapy (ACT)",
  "Mindfulness-Based (MBSR/MBCT)", "Schema Therapy", "Motivational Interviewing",
  "Internal Family Systems (IFS)", "Somatic Therapy", "Narrative Therapy",
  "Solution-Focused Brief Therapy", "Play Therapy", "Art Therapy",
];

const POPULATIONS = [
  "Adults", "Adolescents (13-17)", "Children (5-12)", "Seniors (65+)",
  "Couples", "Families", "Groups", "LGBTQ+ Individuals", "First Responders",
  "Military / Veterans", "Healthcare Workers",
];

const INSURANCE_PANELS = [
  "Aetna", "Blue Cross Blue Shield", "Cigna", "United Healthcare",
  "Humana", "Medicare", "Medicaid", "Optum", "Magellan", "Beacon Health",
  "Tricare", "Kaiser Permanente",
];

const initialData: OnboardingData = {
  first_name: "", last_name: "", pronouns: "", credentials: "",
  license_type: "", license_number: "", license_state: "", license_expiry: "",
  npi_number: "", practice_name: "", practice_type: "",
  practice_address: "", practice_city: "", practice_state: "", practice_zip: "",
  phone: "", website: "", bio: "", years_experience: "", education: "",
  specialties: [], modalities: [], populations: [], languages: ["English"],
  session_fee: "", sliding_scale: false, accepts_insurance: false, insurance_panels: [],
  telehealth: true, in_person: false, weekly_capacity: "",
  ai_scribe: true, ai_copilot: true, ai_memory: true, ai_radar: true,
  notification_prefs: ["session_reminders", "risk_alerts", "ai_insights"],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [data, setData] = useState<OnboardingData>(initialData);
  const [completedSteps, setCompletedSteps] = useState<Set<OnboardingStep>>(new Set());
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progressPercent = (stepIndex / (STEPS.length - 1)) * 100;

  const goToNext = async () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    const nextStep = STEPS[stepIndex + 1];

    // On the last data-entry step (ai_preferences → complete), save everything to the API
    if (currentStep === 'ai_preferences' && nextStep?.id === 'complete') {
      setSaving(true);
      try {
        await therapistsAPI.updateProfile({
          first_name: data.first_name,
          last_name: data.last_name,
          display_name: `${data.credentials ? data.credentials + ' ' : ''}${data.first_name} ${data.last_name}`.trim(),
          bio: data.bio,
          license_number: data.license_number,
          license_state: data.license_state,
          npi_number: data.npi_number,
          years_experience: data.years_experience,
          specializations: data.specialties,
          languages: data.languages,
          weekly_capacity: data.weekly_capacity,
          telehealth_enabled: data.telehealth,
          in_person_enabled: data.in_person,
          ai_scribe_enabled: data.ai_scribe,
          ai_copilot_enabled: data.ai_copilot,
        });
      } catch {
        // Non-blocking — profile can be updated from settings; don't block onboarding
      } finally {
        setSaving(false);
      }
    }

    if (nextStep) setCurrentStep(nextStep.id);
  };

  const goToPrev = () => {
    const prevStep = STEPS[stepIndex - 1];
    if (prevStep) setCurrentStep(prevStep.id);
  };

  const toggleArrayItem = (key: keyof OnboardingData, item: string) => {
    const current = data[key] as string[];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    setData({ ...data, [key]: updated });
  };

  const update = (key: keyof OnboardingData, value: string | boolean | string[]) => {
    setData({ ...data, [key]: value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex">
      {/* Left sidebar */}
      <div className="w-72 bg-[#0A2342] flex flex-col min-h-screen shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#2EC4B6] rounded-xl flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold">24Therapy</div>
              <div className="text-white/50 text-xs">Therapist Setup</div>
            </div>
          </div>
        </div>

        {/* Steps */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-1">
            {STEPS.map((step, idx) => {
              const isActive = step.id === currentStep;
              const isCompleted = completedSteps.has(step.id);
              const isAccessible = idx <= stepIndex;
              const Icon = step.icon;

              return (
                <button
                  key={step.id}
                  onClick={() => isAccessible && setCurrentStep(step.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                    isActive ? "bg-white/15 text-white" :
                    isCompleted ? "text-emerald-300 hover:bg-white/5" :
                    isAccessible ? "text-white/60 hover:bg-white/5" :
                    "text-white/25 cursor-not-allowed"
                  )}
                  disabled={!isAccessible}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    isCompleted ? "bg-emerald-500" :
                    isActive ? "bg-[#2EC4B6]" :
                    "bg-white/10"
                  )}>
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <div className={cn("text-sm font-medium", isActive && "text-white")}>{step.label}</div>
                    <div className="text-xs opacity-60">{step.description}</div>
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Progress */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-xs">Setup Progress</span>
            <span className="text-white text-xs font-semibold">{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2EC4B6] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center py-12 px-8 overflow-y-auto">
        <div className="w-full max-w-2xl">

          {/* WELCOME STEP */}
          {currentStep === "welcome" && (
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0A2342] to-[#2EC4B6] rounded-3xl flex items-center justify-center mx-auto mb-8">
                <Brain className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Welcome to 24Therapy
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-xl mx-auto">
                You're joining the next generation of mental health practice. Let's set up your account — it takes about 10 minutes.
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10 text-left max-w-lg mx-auto">
                {[
                  { icon: Brain, title: "AI-Powered Session Support", desc: "Real-time copilot, auto-documentation, clinical intelligence" },
                  { icon: Shield, title: "HIPAA Compliant", desc: "End-to-end encrypted, SOC 2 Type II certified infrastructure" },
                  { icon: Users, title: "Patient Memory Layer", desc: "Longitudinal intelligence that compounds with every session" },
                  { icon: Zap, title: "Crisis Radar", desc: "Early warning system for at-risk patients" },
                ].map((feature) => {
                  const FIcon = feature.icon;
                  return (
                    <div key={feature.title} className="bg-white rounded-2xl p-4 border border-gray-200">
                      <div className="w-8 h-8 bg-[#0A2342]/10 rounded-lg flex items-center justify-center mb-3">
                        <FIcon className="h-4 w-4 text-[#0A2342]" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900 mb-1">{feature.title}</p>
                      <p className="text-xs text-gray-500">{feature.desc}</p>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={goToNext}
                className="flex items-center gap-2 px-8 py-3.5 bg-[#0A2342] text-white rounded-2xl text-base font-semibold hover:bg-[#123A63] transition-colors mx-auto"
              >
                Get Started <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* PROFILE STEP */}
          {currentStep === "profile" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Profile</h2>
                <p className="text-gray-600">This information will appear on your therapist profile visible to patients.</p>
              </div>

              {/* Avatar upload */}
              <div className="flex items-center gap-5 mb-8 p-5 bg-white rounded-2xl border border-gray-200">
                <div className="w-20 h-20 bg-gray-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 cursor-pointer hover:border-[#0A2342] transition-colors">
                  <Camera className="h-6 w-6 text-gray-400 mb-1" />
                  <span className="text-[10px] text-gray-400">Upload photo</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-0.5">Profile Photo</p>
                  <p className="text-sm text-gray-500">Patients see your photo when booking. JPG or PNG, at least 400×400px.</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">First Name *</label>
                    <input
                      value={data.first_name}
                      onChange={e => update("first_name", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342]"
                      placeholder="Dr. Sarah"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Last Name *</label>
                    <input
                      value={data.last_name}
                      onChange={e => update("last_name", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342]"
                      placeholder="Johnson"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Professional Credentials *</label>
                    <input
                      value={data.credentials}
                      onChange={e => update("credentials", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="Ph.D., LCSW, LPC, etc."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Pronouns</label>
                    <select
                      value={data.pronouns}
                      onChange={e => update("pronouns", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">Prefer not to say</option>
                      <option>she/her</option>
                      <option>he/him</option>
                      <option>they/them</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Years of Experience</label>
                    <select
                      value={data.years_experience}
                      onChange={e => update("years_experience", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">Select</option>
                      <option>1-2 years</option>
                      <option>3-5 years</option>
                      <option>6-10 years</option>
                      <option>11-15 years</option>
                      <option>16-20 years</option>
                      <option>20+ years</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Highest Education</label>
                    <select
                      value={data.education}
                      onChange={e => update("education", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">Select</option>
                      <option>Master's Degree (MSW, MFT, MA, MS)</option>
                      <option>Doctoral Degree (Ph.D., Psy.D., Ed.D.)</option>
                      <option>Medical Degree (MD, DO)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Professional Bio *</label>
                  <textarea
                    value={data.bio}
                    onChange={e => update("bio", e.target.value)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    placeholder="Tell patients about your approach, specialties, and what they can expect working with you..."
                  />
                  <p className="text-xs text-gray-400 mt-1">{data.bio.length}/600 characters</p>
                </div>
              </div>
            </div>
          )}

          {/* PRACTICE STEP */}
          {currentStep === "practice" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Practice</h2>
                <p className="text-gray-600">Tell us about where you practice.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Practice Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "solo", label: "Solo Private Practice", desc: "Independent practitioner" },
                      { id: "group", label: "Group Practice", desc: "Part of a multi-therapist practice" },
                      { id: "hospital", label: "Hospital / Health System", desc: "Inpatient or outpatient hospital setting" },
                      { id: "community", label: "Community Mental Health", desc: "Non-profit or community organization" },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => update("practice_type", type.id)}
                        className={cn(
                          "flex flex-col items-start p-4 rounded-2xl border text-left transition-all",
                          data.practice_type === type.id
                            ? "border-[#0A2342] bg-[#0A2342]/5 ring-1 ring-[#0A2342]/20"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        <span className="font-semibold text-sm text-gray-900 mb-1">{type.label}</span>
                        <span className="text-xs text-gray-500">{type.desc}</span>
                        {data.practice_type === type.id && (
                          <CheckCircle2 className="h-4 w-4 text-[#0A2342] mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Practice Name</label>
                  <input
                    value={data.practice_name}
                    onChange={e => update("practice_name", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    placeholder="e.g. Westside Therapy Group or Dr. Johnson's Practice"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Practice Address</label>
                  <input
                    value={data.practice_address}
                    onChange={e => update("practice_address", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none mb-2"
                    placeholder="Street address"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      value={data.practice_city}
                      onChange={e => update("practice_city", e.target.value)}
                      className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="City"
                    />
                    <select
                      value={data.practice_state}
                      onChange={e => update("practice_state", e.target.value)}
                      className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">State</option>
                      {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      value={data.practice_zip}
                      onChange={e => update("practice_zip", e.target.value)}
                      className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="ZIP"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Phone Number</label>
                    <input
                      value={data.phone}
                      onChange={e => update("phone", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Website (optional)</label>
                    <input
                      value={data.website}
                      onChange={e => update("website", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="https://yourpractice.com"
                    />
                  </div>
                </div>

                {/* Delivery mode */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">Session Delivery</label>
                  <div className="flex gap-3">
                    {[
                      { key: "telehealth", label: "Telehealth / Video", icon: Globe },
                      { key: "in_person", label: "In-Person Office", icon: Building2 },
                    ].map(({ key, label, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => update(key as keyof OnboardingData, !data[key as keyof OnboardingData])}
                        className={cn(
                          "flex-1 flex items-center gap-3 p-4 rounded-2xl border transition-all",
                          data[key as keyof OnboardingData]
                            ? "border-[#0A2342] bg-[#0A2342]/5"
                            : "border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center",
                          data[key as keyof OnboardingData] ? "bg-[#0A2342] text-white" : "bg-gray-100 text-gray-500"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{label}</span>
                        {data[key as keyof OnboardingData] && (
                          <CheckCircle2 className="h-4 w-4 text-[#0A2342] ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CREDENTIALS STEP */}
          {currentStep === "credentials" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Credentials & Licensing</h2>
                <p className="text-gray-600">Your license information is verified and kept secure.</p>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">License Type *</label>
                    <select
                      value={data.license_type}
                      onChange={e => update("license_type", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">Select license type</option>
                      <option>LCSW - Licensed Clinical Social Worker</option>
                      <option>LPC - Licensed Professional Counselor</option>
                      <option>LMFT - Licensed Marriage & Family Therapist</option>
                      <option>PhD - Doctor of Philosophy (Psychology)</option>
                      <option>PsyD - Doctor of Psychology</option>
                      <option>MD - Medical Doctor (Psychiatry)</option>
                      <option>DO - Doctor of Osteopathic Medicine</option>
                      <option>EdD - Doctor of Education</option>
                      <option>LPCC - Licensed Professional Clinical Counselor</option>
                      <option>LMHC - Licensed Mental Health Counselor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">License State *</label>
                    <select
                      value={data.license_state}
                      onChange={e => update("license_state", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    >
                      <option value="">Select state</option>
                      {["CA","NY","TX","FL","IL","PA","OH","GA","NC","MI"].map(s => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">License Number *</label>
                    <input
                      value={data.license_number}
                      onChange={e => update("license_number", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                      placeholder="e.g. LCSW123456"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">License Expiry</label>
                    <input
                      type="date"
                      value={data.license_expiry}
                      onChange={e => update("license_expiry", e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">NPI Number</label>
                  <input
                    value={data.npi_number}
                    onChange={e => update("npi_number", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                    placeholder="10-digit NPI number"
                  />
                  <p className="text-xs text-gray-400 mt-1">Required for insurance billing</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">License Verification</p>
                      <p className="text-xs text-blue-700 mt-1">
                        24Therapy automatically verifies your license with your state board. This typically takes 1-2 business days. You can start using the platform immediately while verification is pending.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SPECIALTIES STEP */}
          {currentStep === "specialties" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Clinical Focus</h2>
                <p className="text-gray-600">Select your specialties, treatment modalities, and patient populations. This drives patient matching and AI recommendations.</p>
              </div>

              <div className="space-y-6">
                {/* Specialties */}
                <div>
                  <label className="text-base font-semibold text-gray-900 mb-3 block">
                    Specialties <span className="text-sm font-normal text-gray-500">({data.specialties.length} selected)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map(s => (
                      <button
                        key={s}
                        onClick={() => toggleArrayItem("specialties", s)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-sm transition-all",
                          data.specialties.includes(s)
                            ? "bg-[#0A2342] text-white border-[#0A2342]"
                            : "border-gray-200 text-gray-700 hover:border-gray-300"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modalities */}
                <div>
                  <label className="text-base font-semibold text-gray-900 mb-3 block">
                    Treatment Modalities <span className="text-sm font-normal text-gray-500">({data.modalities.length} selected)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MODALITIES.map(m => (
                      <button
                        key={m}
                        onClick={() => toggleArrayItem("modalities", m)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-sm transition-all",
                          data.modalities.includes(m)
                            ? "bg-[#2EC4B6] text-white border-[#2EC4B6]"
                            : "border-gray-200 text-gray-700 hover:border-gray-300"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Populations */}
                <div>
                  <label className="text-base font-semibold text-gray-900 mb-3 block">
                    Patient Populations <span className="text-sm font-normal text-gray-500">({data.populations.length} selected)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {POPULATIONS.map(p => (
                      <button
                        key={p}
                        onClick={() => toggleArrayItem("populations", p)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-sm transition-all",
                          data.populations.includes(p)
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "border-gray-200 text-gray-700 hover:border-gray-300"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AVAILABILITY STEP */}
          {currentStep === "availability" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Availability</h2>
                <p className="text-gray-600">Set your weekly capacity. You can adjust your schedule in detail from the settings after onboarding.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">Weekly Session Capacity *</label>
                  <div className="grid grid-cols-4 gap-3">
                    {["5-10", "11-15", "16-20", "21-25", "26-30", "30+"].map(cap => (
                      <button
                        key={cap}
                        onClick={() => update("weekly_capacity", cap)}
                        className={cn(
                          "py-3 rounded-2xl border text-sm font-medium transition-all",
                          data.weekly_capacity === cap
                            ? "bg-[#0A2342] text-white border-[#0A2342]"
                            : "border-gray-200 text-gray-700 hover:border-gray-300"
                        )}
                      >
                        {cap}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Sessions per week</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Calendar Sync Available</p>
                      <p className="text-xs text-amber-700 mt-1">
                        After onboarding, you can sync with Google Calendar, Outlook, or iCal to set your detailed availability automatically.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BILLING STEP */}
          {currentStep === "billing_setup" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Billing & Fees</h2>
                <p className="text-gray-600">Configure how you charge patients. You can use our integrated billing or your own system.</p>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Standard Session Fee (USD)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">$</span>
                      <input
                        value={data.session_fee}
                        onChange={e => update("session_fee", e.target.value)}
                        className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none"
                        placeholder="150"
                        type="number"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Per 50-minute session</p>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.sliding_scale}
                    onChange={e => update("sliding_scale", e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Offer Sliding Scale</p>
                    <p className="text-xs text-gray-500">Adjust fees based on patient financial need</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-4 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.accepts_insurance}
                    onChange={e => update("accepts_insurance", e.target.checked)}
                    className="w-5 h-5"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Accept Insurance</p>
                    <p className="text-xs text-gray-500">Accept insurance payments from patients</p>
                  </div>
                </label>

                {data.accepts_insurance && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-3 block">
                      Insurance Panels <span className="text-gray-400 font-normal">({data.insurance_panels.length} selected)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {INSURANCE_PANELS.map(ins => (
                        <button
                          key={ins}
                          onClick={() => toggleArrayItem("insurance_panels", ins)}
                          className={cn(
                            "py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left",
                            data.insurance_panels.includes(ins)
                              ? "bg-[#0A2342] text-white border-[#0A2342]"
                              : "border-gray-200 text-gray-700 hover:border-gray-300"
                          )}
                        >
                          {ins}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI PREFERENCES STEP */}
          {currentStep === "ai_preferences" && (
            <div>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">AI Feature Setup</h2>
                <p className="text-gray-600">Configure which AI features to enable. All features are HIPAA-compliant and fully encrypted.</p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    key: "ai_scribe",
                    icon: FileText,
                    title: "AI Scribe",
                    description: "Automatically generate SOAP, DAP, or BIRP notes from session transcripts. Save 30+ minutes per day on documentation.",
                    badge: "Most Popular",
                    badgeColor: "bg-emerald-100 text-emerald-700",
                  },
                  {
                    key: "ai_copilot",
                    icon: Brain,
                    title: "Session Copilot",
                    description: "Real-time clinical suggestions, pattern recognition, memory retrieval, and evidence-based question recommendations during sessions.",
                    badge: "High Impact",
                    badgeColor: "bg-blue-100 text-blue-700",
                  },
                  {
                    key: "ai_memory",
                    icon: Network,
                    title: "Patient Memory Layer",
                    description: "Build a longitudinal knowledge graph for each patient. AI remembers and connects insights across all sessions automatically.",
                    badge: "Unique to 24Therapy",
                    badgeColor: "bg-indigo-100 text-indigo-700",
                  },
                  {
                    key: "ai_radar",
                    icon: Zap,
                    title: "Crisis Radar",
                    description: "AI-powered early warning system that monitors language patterns, mood trends, and behavioral signals for risk escalation.",
                    badge: "Safety Critical",
                    badgeColor: "bg-amber-100 text-amber-700",
                  },
                ].map(({ key, icon: Icon, title, description, badge, badgeColor }) => (
                  <div
                    key={key}
                    onClick={() => update(key as keyof OnboardingData, !data[key as keyof OnboardingData])}
                    className={cn(
                      "p-5 rounded-2xl border-2 cursor-pointer transition-all",
                      data[key as keyof OnboardingData]
                        ? "border-[#0A2342] bg-[#0A2342]/5"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        data[key as keyof OnboardingData] ? "bg-[#0A2342]" : "bg-gray-100"
                      )}>
                        <Icon className={cn("h-5 w-5", data[key as keyof OnboardingData] ? "text-white" : "text-gray-500")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{title}</span>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", badgeColor)}>{badge}</span>
                        </div>
                        <p className="text-sm text-gray-600">{description}</p>
                      </div>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-1",
                        data[key as keyof OnboardingData] ? "border-[#0A2342] bg-[#0A2342]" : "border-gray-300"
                      )}>
                        {data[key as keyof OnboardingData] && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Your Data is Yours</span>
                  </div>
                  <p className="text-xs text-slate-600">All AI features operate within your own encrypted, isolated data environment. Patient data is never used to train shared models. You control all data retention and deletion.</p>
                </div>
              </div>
            </div>
          )}

          {/* COMPLETE STEP */}
          {currentStep === "complete" && (
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-4">You're all set!</h1>
              <p className="text-xl text-gray-600 mb-8 max-w-lg mx-auto leading-relaxed">
                Your account has been configured. Welcome to the future of mental health practice.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-10 text-left">
                {[
                  { icon: Brain, title: "AI Copilot Ready", desc: "Access during sessions", color: "text-indigo-600", bg: "bg-indigo-50" },
                  { icon: Users, title: "Start Adding Patients", desc: "Import or add manually", color: "text-blue-600", bg: "bg-blue-50" },
                  { icon: Calendar, title: "Schedule Sessions", desc: "Set your availability", color: "text-emerald-600", bg: "bg-emerald-50" },
                ].map(f => {
                  const FIcon = f.icon;
                  return (
                    <div key={f.title} className="bg-white rounded-2xl p-4 border border-gray-200">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", f.bg)}>
                        <FIcon className={cn("h-5 w-5", f.color)} />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 px-8 py-3.5 bg-[#0A2342] text-white rounded-2xl text-base font-semibold hover:bg-[#123A63] transition-colors mx-auto"
              >
                Go to Dashboard <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Navigation */}
          {currentStep !== "welcome" && currentStep !== "complete" && (
            <div className="flex items-center justify-between mt-10 pt-8 border-t border-gray-200">
              <button
                onClick={goToPrev}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={goToNext}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-semibold hover:bg-[#123A63] disabled:opacity-60 transition-colors"
              >
                {saving ? 'Saving…' : 'Continue'} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
