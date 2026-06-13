"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, Phone, Shield, Brain, CheckSquare, ClipboardList,
  ChevronRight, ChevronLeft, Check, AlertTriangle, Heart,
  FileText, Lock, Sparkles, MapPin, Mail, Calendar,
  UserCheck, Building, CreditCard, Activity, Info,
  Plus, X, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type IntakeStep =
  | "demographics"
  | "contact"
  | "insurance"
  | "clinical"
  | "consent"
  | "review";

interface IntakeData {
  // Demographics
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  pronouns: string;
  how_heard: string;
  preferred_language: string;
  ethnicity: string;
  // Contact
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  emergency_name: string;
  emergency_relationship: string;
  emergency_phone: string;
  // Insurance
  payment_type: "insurance" | "self_pay" | "sliding_scale" | "eap";
  insurance_provider: string;
  insurance_member_id: string;
  insurance_group_number: string;
  insurance_holder_name: string;
  insurance_holder_dob: string;
  insurance_phone: string;
  secondary_insurance: boolean;
  // Clinical
  presenting_concerns: string[];
  previous_therapy: boolean;
  previous_therapy_details: string;
  current_medications: string;
  psychiatric_hospitalization: boolean;
  substance_use: string;
  medical_conditions: string;
  family_mental_health_history: string;
  suicidal_ideation: "never" | "past" | "current_passive" | "current_active" | "";
  self_harm: "never" | "past" | "current" | "";
  homicidal_ideation: "never" | "past" | "current" | "";
  access_to_weapons: boolean | null;
  therapy_goals: string;
  preferred_modality: string;
  session_frequency: string;
  // Consent
  consent_therapy: boolean;
  consent_hipaa: boolean;
  consent_telehealth: boolean;
  consent_records: boolean;
  consent_billing: boolean;
  signature: string;
}

const STEPS: { id: IntakeStep; label: string; icon: React.ElementType }[] = [
  { id: "demographics", label: "Demographics", icon: User },
  { id: "contact", label: "Contact & Emergency", icon: Phone },
  { id: "insurance", label: "Insurance / Billing", icon: Shield },
  { id: "clinical", label: "Clinical Intake", icon: Brain },
  { id: "consent", label: "Consent & HIPAA", icon: CheckSquare },
  { id: "review", label: "Review & Enroll", icon: ClipboardList },
];

const PRESENTING_CONCERNS = [
  "Depression / Low Mood", "Anxiety / Worry", "Panic Attacks",
  "Trauma / PTSD", "OCD", "Bipolar Disorder",
  "ADHD / Focus Issues", "Grief & Loss", "Relationship Problems",
  "Work / Career Stress", "Family Conflict", "Anger Management",
  "Eating Concerns", "Sleep Problems", "Chronic Pain / Illness",
  "Substance Use", "Life Transitions", "Self-Esteem / Identity",
  "Suicidal Thoughts", "Other",
];

const MODALITIES = [
  "No preference", "CBT (Cognitive Behavioral Therapy)",
  "DBT (Dialectical Behavior Therapy)", "EMDR",
  "Psychodynamic", "Mindfulness-Based",
  "Acceptance & Commitment Therapy (ACT)", "Somatic Therapy",
  "Narrative Therapy", "Solution-Focused",
];

const INITIAL_DATA: IntakeData = {
  first_name: "", last_name: "", date_of_birth: "", gender: "", pronouns: "",
  how_heard: "", preferred_language: "English", ethnicity: "",
  email: "", phone: "", address_line1: "", address_line2: "",
  city: "", state: "", zip: "",
  emergency_name: "", emergency_relationship: "", emergency_phone: "",
  payment_type: "insurance", insurance_provider: "", insurance_member_id: "",
  insurance_group_number: "", insurance_holder_name: "", insurance_holder_dob: "",
  insurance_phone: "", secondary_insurance: false,
  presenting_concerns: [], previous_therapy: false, previous_therapy_details: "",
  current_medications: "", psychiatric_hospitalization: false,
  substance_use: "", medical_conditions: "", family_mental_health_history: "",
  suicidal_ideation: "", self_harm: "", homicidal_ideation: "",
  access_to_weapons: null, therapy_goals: "",
  preferred_modality: "No preference", session_frequency: "Weekly",
  consent_therapy: false, consent_hipaa: false,
  consent_telehealth: false, consent_records: false, consent_billing: false,
  signature: "",
};

// ─── Step Components ──────────────────────────────────────────────────────────

function DemographicsStep({ data, onChange }: { data: IntakeData; onChange: (k: keyof IntakeData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">First Name *</label>
          <input
            type="text"
            value={data.first_name}
            onChange={e => onChange("first_name", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Last Name *</label>
          <input
            type="text"
            value={data.last_name}
            onChange={e => onChange("last_name", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date of Birth *</label>
          <input
            type="date"
            value={data.date_of_birth}
            onChange={e => onChange("date_of_birth", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender Identity</label>
          <select
            value={data.gender}
            onChange={e => onChange("gender", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
          >
            <option value="">Select...</option>
            <option>Male</option>
            <option>Female</option>
            <option>Non-binary / Non-conforming</option>
            <option>Transgender Male</option>
            <option>Transgender Female</option>
            <option>Genderqueer</option>
            <option>Agender</option>
            <option>Prefer not to say</option>
            <option>Self-describe</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pronouns</label>
          <select
            value={data.pronouns}
            onChange={e => onChange("pronouns", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
          >
            <option value="">Select...</option>
            <option>He / Him</option>
            <option>She / Her</option>
            <option>They / Them</option>
            <option>Ze / Zir</option>
            <option>Multiple / All pronouns</option>
            <option>Prefer not to say</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preferred Language</label>
          <select
            value={data.preferred_language}
            onChange={e => onChange("preferred_language", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
          >
            <option>English</option>
            <option>Spanish</option>
            <option>Arabic</option>
            <option>Mandarin</option>
            <option>French</option>
            <option>Portuguese</option>
            <option>Hindi</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ethnicity / Race</label>
          <select
            value={data.ethnicity}
            onChange={e => onChange("ethnicity", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
          >
            <option value="">Select...</option>
            <option>White / Caucasian</option>
            <option>Hispanic / Latino</option>
            <option>Black / African American</option>
            <option>Asian / Pacific Islander</option>
            <option>Native American / Alaska Native</option>
            <option>Middle Eastern / North African</option>
            <option>Multiracial</option>
            <option>Prefer not to say</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">How did you hear about us?</label>
          <select
            value={data.how_heard}
            onChange={e => onChange("how_heard", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
          >
            <option value="">Select...</option>
            <option>Google Search</option>
            <option>Psychology Today</option>
            <option>Insurance Provider</option>
            <option>Doctor / Physician Referral</option>
            <option>Friend / Family</option>
            <option>Social Media</option>
            <option>Employer / EAP</option>
            <option>Other</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function ContactStep({ data, onChange }: { data: IntakeData; onChange: (k: keyof IntakeData, v: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" /> Contact Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address *</label>
            <input type="email" value={data.email} onChange={e => onChange("email", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="patient@email.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone Number *</label>
            <input type="tel" value={data.phone} onChange={e => onChange("phone", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="(555) 000-0000" />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Address
        </h3>
        <div className="space-y-3">
          <input type="text" value={data.address_line1} onChange={e => onChange("address_line1", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Street address" />
          <input type="text" value={data.address_line2} onChange={e => onChange("address_line2", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Apt, suite, unit (optional)" />
          <div className="grid grid-cols-3 gap-3">
            <input type="text" value={data.city} onChange={e => onChange("city", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="City" />
            <select value={data.state} onChange={e => onChange("state", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
              <option value="">State</option>
              {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(s => <option key={s}>{s}</option>)}
            </select>
            <input type="text" value={data.zip} onChange={e => onChange("zip", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="ZIP code" />
          </div>
        </div>
      </div>

      <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600" /> Emergency Contact
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
            <input type="text" value={data.emergency_name} onChange={e => onChange("emergency_name", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
              placeholder="Emergency contact name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Relationship</label>
            <select value={data.emergency_relationship} onChange={e => onChange("emergency_relationship", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
              <option value="">Select...</option>
              <option>Spouse / Partner</option>
              <option>Parent</option>
              <option>Sibling</option>
              <option>Child</option>
              <option>Friend</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Phone *</label>
            <input type="tel" value={data.emergency_phone} onChange={e => onChange("emergency_phone", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white"
              placeholder="(555) 000-0000" />
          </div>
        </div>
      </div>
    </div>
  );
}

function InsuranceStep({ data, onChange, onBoolChange }: {
  data: IntakeData;
  onChange: (k: keyof IntakeData, v: string) => void;
  onBoolChange: (k: keyof IntakeData, v: boolean) => void;
}) {
  const paymentTypes = [
    { id: "insurance", label: "Insurance", icon: Shield, desc: "Bill my health insurance" },
    { id: "self_pay", label: "Self Pay", icon: CreditCard, desc: "Pay out of pocket" },
    { id: "sliding_scale", label: "Sliding Scale", icon: Activity, desc: "Income-based fee" },
    { id: "eap", label: "EAP", icon: Building, desc: "Employee Assistance Program" },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-3">Payment Method *</label>
        <div className="grid grid-cols-2 gap-3">
          {paymentTypes.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              onClick={() => onChange("payment_type", id)}
              className={cn(
                "p-4 border-2 rounded-xl text-left transition-all",
                data.payment_type === id
                  ? "border-primary bg-primary/5"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn("w-4 h-4", data.payment_type === id ? "text-primary" : "text-slate-400")} />
                <span className={cn("text-sm font-semibold", data.payment_type === id ? "text-primary" : "text-slate-700")}>{label}</span>
                {data.payment_type === id && <Check className="w-4 h-4 text-primary ml-auto" />}
              </div>
              <div className="text-xs text-slate-500">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {data.payment_type === "insurance" && (
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Insurance Provider *</label>
              <select value={data.insurance_provider} onChange={e => onChange("insurance_provider", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
                <option value="">Select provider...</option>
                <option>Aetna</option>
                <option>Blue Cross Blue Shield</option>
                <option>Cigna</option>
                <option>Humana</option>
                <option>Kaiser Permanente</option>
                <option>Medicaid</option>
                <option>Medicare</option>
                <option>UnitedHealth</option>
                <option>Tricare</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Member ID *</label>
              <input type="text" value={data.insurance_member_id} onChange={e => onChange("insurance_member_id", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="Member ID number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Group Number</label>
              <input type="text" value={data.insurance_group_number} onChange={e => onChange("insurance_group_number", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="Group number" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Insurance Phone</label>
              <input type="tel" value={data.insurance_phone} onChange={e => onChange("insurance_phone", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="Member services number" />
            </div>
          </div>
          <div className="border-t pt-4 border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-3">Policy Holder (if different from patient)</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Full Name</label>
                <input type="text" value={data.insurance_holder_name} onChange={e => onChange("insurance_holder_name", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  placeholder="Policy holder name" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Date of Birth</label>
                <input type="date" value={data.insurance_holder_dob} onChange={e => onChange("insurance_holder_dob", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {(data.payment_type === "self_pay" || data.payment_type === "sliding_scale") && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-blue-800 mb-1">
                {data.payment_type === "self_pay" ? "Self-Pay Rate" : "Sliding Scale Information"}
              </div>
              <div className="text-xs text-blue-700">
                {data.payment_type === "self_pay"
                  ? "Your therapist's standard session rate will be provided during your initial consultation. Payment is due at time of service."
                  : "Our sliding scale fees range from $60–$180 per session based on household income. You will be asked to provide income verification during your first appointment."}
              </div>
            </div>
          </div>
        </div>
      )}

      {data.payment_type === "eap" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Employer / EAP Provider</label>
            <input type="text" value={data.insurance_provider} onChange={e => onChange("insurance_provider", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="e.g., Cigna EAP, Magellan, ComPsych" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authorization / Case Number</label>
            <input type="text" value={data.insurance_member_id} onChange={e => onChange("insurance_member_id", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="Authorization number" />
          </div>
        </div>
      )}
    </div>
  );
}

function ClinicalStep({
  data,
  onChange,
  onBoolChange,
  onConcernToggle,
}: {
  data: IntakeData;
  onChange: (k: keyof IntakeData, v: string) => void;
  onBoolChange: (k: keyof IntakeData, v: boolean) => void;
  onConcernToggle: (concern: string) => void;
}) {
  const safetyQuestions = [
    { key: "suicidal_ideation" as keyof IntakeData, label: "Have you ever had thoughts of suicide or ending your life?", options: ["never", "past", "current_passive", "current_active"], labels: ["Never", "In the past", "Currently (passive)", "Currently (active)"] },
    { key: "self_harm" as keyof IntakeData, label: "Have you ever intentionally harmed yourself (cutting, burning, etc.)?", options: ["never", "past", "current"], labels: ["Never", "In the past", "Currently"] },
    { key: "homicidal_ideation" as keyof IntakeData, label: "Have you ever had thoughts of harming others?", options: ["never", "past", "current"], labels: ["Never", "In the past", "Currently"] },
  ];

  const currentSafetyRisk = data.suicidal_ideation === "current_active" || data.suicidal_ideation === "current_passive" || data.homicidal_ideation === "current" || data.self_harm === "current";

  return (
    <div className="space-y-6">
      {/* Presenting Concerns */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">Presenting Concerns — Select all that apply *</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESENTING_CONCERNS.map(concern => (
            <button
              key={concern}
              onClick={() => onConcernToggle(concern)}
              className={cn(
                "p-2.5 text-xs border rounded-lg text-left transition-all flex items-center gap-2",
                data.presenting_concerns.includes(concern)
                  ? "border-primary bg-primary/5 text-primary font-semibold"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <div className={cn(
                "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                data.presenting_concerns.includes(concern) ? "bg-primary border-primary" : "border-slate-300"
              )}>
                {data.presenting_concerns.includes(concern) && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              {concern}
            </button>
          ))}
        </div>
      </div>

      {/* Therapy Goals */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Therapy Goals — What do you hope to achieve?</label>
        <textarea
          value={data.therapy_goals}
          onChange={e => onChange("therapy_goals", e.target.value)}
          rows={3}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          placeholder="Describe what you hope to work on and achieve through therapy..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preferred Therapy Approach</label>
          <select value={data.preferred_modality} onChange={e => onChange("preferred_modality", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
            {MODALITIES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Preferred Session Frequency</label>
          <select value={data.session_frequency} onChange={e => onChange("session_frequency", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white">
            <option>Weekly</option>
            <option>Bi-weekly</option>
            <option>Monthly</option>
            <option>As needed</option>
          </select>
        </div>
      </div>

      {/* Previous Treatment */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-2">Have you previously received therapy or mental health treatment?</label>
        <div className="flex gap-3">
          {[["Yes", true], ["No", false]].map(([label, val]) => (
            <button key={String(label)}
              onClick={() => onBoolChange("previous_therapy", val as boolean)}
              className={cn(
                "px-4 py-2 text-sm border rounded-lg transition-all",
                data.previous_therapy === val ? "border-primary bg-primary/5 text-primary font-semibold" : "border-slate-200 text-slate-600"
              )}
            >{String(label)}</button>
          ))}
        </div>
        {data.previous_therapy && (
          <textarea
            value={data.previous_therapy_details}
            onChange={e => onChange("previous_therapy_details", e.target.value)}
            rows={2}
            className="mt-2 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
            placeholder="Briefly describe prior treatment (type, duration, what helped or didn't help)..."
          />
        )}
      </div>

      {/* Current Medications */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Current Medications (psychiatric or other)</label>
        <textarea
          value={data.current_medications}
          onChange={e => onChange("current_medications", e.target.value)}
          rows={2}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          placeholder="List medications, dosages if known (e.g., Sertraline 50mg, Adderall 20mg)..."
        />
      </div>

      {/* Safety Screening */}
      <div className="border border-red-200 bg-red-50 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-red-600" />
          <span className="text-sm font-bold text-red-800">Safety Screening</span>
          <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">HIPAA Protected</span>
        </div>
        <p className="text-xs text-red-700">This information helps us ensure your safety and provide appropriate care. All responses are strictly confidential.</p>

        {safetyQuestions.map(({ key, label, options, labels }) => (
          <div key={key as string}>
            <label className="block text-xs font-semibold text-slate-700 mb-2">{label}</label>
            <div className="flex flex-wrap gap-2">
              {options.map((opt, i) => (
                <button key={opt}
                  onClick={() => onChange(key, opt)}
                  className={cn(
                    "px-3 py-1.5 text-xs border rounded-lg transition-all",
                    (data[key] as string) === opt
                      ? opt === "never" ? "border-green-500 bg-green-50 text-green-700 font-semibold"
                        : opt.includes("current") ? "border-red-500 bg-red-100 text-red-700 font-semibold"
                          : "border-yellow-500 bg-yellow-50 text-yellow-700 font-semibold"
                      : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                  )}
                >{labels[i]}</button>
              ))}
            </div>
          </div>
        ))}

        {currentSafetyRisk && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-red-800">Immediate attention required</div>
              <div className="text-xs text-red-700 mt-0.5">
                Based on your responses, your therapist will conduct a comprehensive safety assessment at your first session.
                If you are in crisis right now, please call <strong>988</strong> (Suicide & Crisis Lifeline) or go to your nearest emergency room.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentStep({ data, onChange, onBoolChange }: {
  data: IntakeData;
  onChange: (k: keyof IntakeData, v: string) => void;
  onBoolChange: (k: keyof IntakeData, v: boolean) => void;
}) {
  const consents = [
    {
      key: "consent_therapy" as keyof IntakeData,
      label: "Informed Consent for Therapy",
      description: "I understand that therapy involves discussing personal and sometimes difficult topics. I consent to participating in outpatient psychotherapy services. I understand I may terminate therapy at any time and that my therapist may also terminate if clinically indicated.",
      required: true,
    },
    {
      key: "consent_hipaa" as keyof IntakeData,
      label: "HIPAA Privacy Notice",
      description: "I acknowledge receipt of the Notice of Privacy Practices as required by HIPAA. I understand how my Protected Health Information (PHI) may be used and disclosed. I understand my rights regarding my health information including the right to access, amend, and restrict use.",
      required: true,
    },
    {
      key: "consent_telehealth" as keyof IntakeData,
      label: "Telehealth Consent",
      description: "I consent to receive mental health services via telehealth video conferencing. I understand the limitations and risks of telehealth, including potential for technical failures, privacy considerations, and limitations in crisis response. I confirm I am in a safe, private location during sessions.",
      required: true,
    },
    {
      key: "consent_records" as keyof IntakeData,
      label: "Release of Records Authorization",
      description: "I authorize 24Therapy.ai to maintain my clinical records securely. I understand records may be released to my treating providers with my written consent, or as required by law (court orders, duty to warn, mandated reporting). I have the right to request copies of my records.",
      required: false,
    },
    {
      key: "consent_billing" as keyof IntakeData,
      label: "Financial Responsibility & Billing",
      description: "I agree to be financially responsible for all charges incurred, including co-pays, deductibles, non-covered services, and any amounts not paid by my insurance. I authorize 24Therapy.ai to submit claims to my insurance company on my behalf. I understand the 24-hour cancellation policy.",
      required: true,
    },
  ];

  const allRequired = consents.filter(c => c.required).every(c => data[c.key] as boolean);

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Lock className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-blue-800">Your Privacy is Protected</div>
          <div className="text-xs text-blue-700 mt-0.5">All forms are encrypted and HIPAA-compliant. Your signature is stored as a legal electronic signature under the ESIGN Act.</div>
        </div>
      </div>

      <div className="space-y-3">
        {consents.map(({ key, label, description, required }) => (
          <div
            key={key as string}
            className={cn(
              "border rounded-xl p-4 transition-all",
              (data[key] as boolean) ? "border-primary/30 bg-primary/5" : "border-slate-200"
            )}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => onBoolChange(key, !(data[key] as boolean))}
                className={cn(
                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all",
                  (data[key] as boolean) ? "bg-primary border-primary" : "border-slate-300"
                )}
              >
                {(data[key] as boolean) && <Check className="w-3 h-3 text-white" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                  {required && <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-semibold">REQUIRED</span>}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Electronic Signature — Type your full legal name to sign *
        </label>
        <input
          type="text"
          value={data.signature}
          onChange={e => onChange("signature", e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-serif text-lg"
          placeholder="Your full legal name"
          style={{ fontFamily: "'Georgia', serif", fontSize: "16px" }}
        />
        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Signed electronically on {new Date().toLocaleDateString()} — {new Date().toLocaleTimeString()}
        </div>
      </div>

      {!allRequired && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          Please check all required consent boxes and provide your electronic signature before proceeding.
        </div>
      )}
    </div>
  );
}

function ReviewStep({ data, onEnroll, enrolling }: {
  data: IntakeData;
  onEnroll: () => void;
  enrolling: boolean;
}) {
  const sections = [
    {
      title: "Demographics",
      icon: User,
      items: [
        { label: "Name", value: `${data.first_name} ${data.last_name}` },
        { label: "Date of Birth", value: data.date_of_birth },
        { label: "Gender / Pronouns", value: [data.gender, data.pronouns].filter(Boolean).join(" · ") || "Not specified" },
        { label: "Preferred Language", value: data.preferred_language },
      ],
    },
    {
      title: "Contact",
      icon: Phone,
      items: [
        { label: "Email", value: data.email },
        { label: "Phone", value: data.phone },
        { label: "Address", value: [data.address_line1, data.city, data.state].filter(Boolean).join(", ") || "Not provided" },
        { label: "Emergency Contact", value: data.emergency_name ? `${data.emergency_name} (${data.emergency_relationship}) ${data.emergency_phone}` : "Not provided" },
      ],
    },
    {
      title: "Insurance / Billing",
      icon: Shield,
      items: [
        { label: "Payment Method", value: { insurance: "Insurance", self_pay: "Self-Pay", sliding_scale: "Sliding Scale", eap: "EAP" }[data.payment_type] },
        ...(data.payment_type === "insurance" ? [
          { label: "Provider", value: data.insurance_provider || "Not provided" },
          { label: "Member ID", value: data.insurance_member_id || "Not provided" },
        ] : []),
      ],
    },
    {
      title: "Clinical",
      icon: Brain,
      items: [
        { label: "Presenting Concerns", value: data.presenting_concerns.join(", ") || "Not specified" },
        { label: "Preferred Approach", value: data.preferred_modality },
        { label: "Session Frequency", value: data.session_frequency },
        { label: "Prior Therapy", value: data.previous_therapy ? "Yes" : "No" },
        { label: "Current Medications", value: data.current_medications || "None reported" },
      ],
    },
  ];

  const allConsented = data.consent_therapy && data.consent_hipaa && data.consent_telehealth && data.consent_billing && data.signature.length > 2;

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-bold text-primary">AI Patient Profile Initialization</div>
          <div className="text-xs text-slate-600 mt-0.5">
            Upon enrollment, 24Therapy.ai will automatically build a patient intelligence profile from this intake data,
            initialize the mental health memory layer with structured clinical context, and prepare AI-assisted session insights for your therapist.
          </div>
        </div>
      </div>

      {sections.map(({ title, icon: Icon, items }) => (
        <div key={title} className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 border-b border-slate-200">
            <Icon className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map(({ label, value }) => (
              <div key={label} className="flex items-start px-4 py-2.5 gap-4">
                <span className="text-xs text-slate-500 w-36 shrink-0">{label}</span>
                <span className="text-xs font-medium text-slate-800 flex-1">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="border border-green-200 bg-green-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckSquare className="w-4 h-4 text-green-600" />
          <span className="text-sm font-bold text-green-800">Consent Status</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Informed Consent for Therapy", done: data.consent_therapy },
            { label: "HIPAA Privacy Notice", done: data.consent_hipaa },
            { label: "Telehealth Consent", done: data.consent_telehealth },
            { label: "Financial Responsibility", done: data.consent_billing },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center", done ? "bg-green-500" : "bg-slate-300")}>
                {done && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className={cn("text-xs", done ? "text-green-700" : "text-slate-500")}>{label}</span>
            </div>
          ))}
        </div>
        {data.signature && (
          <div className="mt-3 pt-3 border-t border-green-200 flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-green-600" />
            <span className="text-xs text-green-700">Signed by: <strong>{data.signature}</strong></span>
          </div>
        )}
      </div>

      <button
        onClick={onEnroll}
        disabled={!allConsented || enrolling}
        className={cn(
          "w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all",
          allConsented && !enrolling
            ? "bg-primary text-white hover:bg-primary/90 shadow-md"
            : "bg-slate-200 text-slate-400 cursor-not-allowed"
        )}
      >
        {enrolling ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Enrolling Patient & Initializing AI Profile...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Enroll Patient & Initialize AI Memory Layer
          </>
        )}
      </button>

      {!allConsented && (
        <p className="text-xs text-center text-slate-400">All required consents and electronic signature are required before enrollment.</p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PatientIntakePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<IntakeStep>("demographics");
  const [data, setData] = useState<IntakeData>(INITIAL_DATA);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);

  const handleChange = (key: keyof IntakeData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleBoolChange = (key: keyof IntakeData, value: boolean) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleConcernToggle = (concern: string) => {
    setData(prev => ({
      ...prev,
      presenting_concerns: prev.presenting_concerns.includes(concern)
        ? prev.presenting_concerns.filter(c => c !== concern)
        : [...prev.presenting_concerns, concern],
    }));
  };

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    // Simulate AI initialization
    await new Promise(r => setTimeout(r, 2500));
    setEnrolling(false);
    setEnrolled(true);
    setTimeout(() => {
      router.push("/patients");
    }, 2000);
  };

  if (enrolled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Patient Enrolled Successfully</h2>
          <p className="text-sm text-slate-500 mb-4">
            <strong>{data.first_name} {data.last_name}</strong> has been enrolled and their AI patient intelligence profile is being initialized.
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-left space-y-2">
            <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI Memory Layer Initialized
            </div>
            <div className="text-xs text-slate-600">• Patient intelligence profile created</div>
            <div className="text-xs text-slate-600">• Mental health memory layer activated</div>
            <div className="text-xs text-slate-600">• Session context preparation queued</div>
            <div className="text-xs text-slate-600">• Risk baseline assessment scheduled</div>
          </div>
          <p className="text-xs text-slate-400 mt-4">Redirecting to patient list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">New Patient Intake</h1>
              <p className="text-xs text-slate-500">Complete all sections to enroll the patient</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-500">Step {stepIndex + 1} of {STEPS.length}</div>
            <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 flex gap-6">
        {/* Step Sidebar */}
        <div className="w-52 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = index < stepIndex;
              return (
                <button
                  key={step.id}
                  onClick={() => index <= stepIndex && setCurrentStep(step.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-all",
                    isActive ? "bg-primary/5 text-primary" : isCompleted ? "text-slate-600 hover:bg-slate-50 cursor-pointer" : "text-slate-400 cursor-default",
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                    isActive ? "bg-primary text-white" : isCompleted ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400",
                  )}>
                    {isCompleted ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                  </div>
                  <span className={cn("text-xs font-semibold", isActive ? "text-primary" : "")}>{step.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lock className="w-3 h-3 text-blue-600" />
              <span className="text-[10px] font-bold text-blue-700">HIPAA SECURED</span>
            </div>
            <p className="text-[10px] text-blue-600 leading-relaxed">All patient data is encrypted at rest and in transit. This form is HIPAA compliant.</p>
          </div>
        </div>

        {/* Main Form Area */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-800">
                {STEPS[stepIndex].label}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {currentStep === "demographics" && "Basic patient information and identity"}
                {currentStep === "contact" && "Contact details and emergency contact information"}
                {currentStep === "insurance" && "Insurance coverage and payment method"}
                {currentStep === "clinical" && "Clinical history, concerns, and safety screening"}
                {currentStep === "consent" && "Required consents and HIPAA acknowledgment"}
                {currentStep === "review" && "Review all information before enrolling the patient"}
              </p>
            </div>

            {currentStep === "demographics" && (
              <DemographicsStep data={data} onChange={handleChange} />
            )}
            {currentStep === "contact" && (
              <ContactStep data={data} onChange={handleChange} />
            )}
            {currentStep === "insurance" && (
              <InsuranceStep data={data} onChange={handleChange} onBoolChange={handleBoolChange} />
            )}
            {currentStep === "clinical" && (
              <ClinicalStep
                data={data}
                onChange={handleChange}
                onBoolChange={handleBoolChange}
                onConcernToggle={handleConcernToggle}
              />
            )}
            {currentStep === "consent" && (
              <ConsentStep data={data} onChange={handleChange} onBoolChange={handleBoolChange} />
            )}
            {currentStep === "review" && (
              <ReviewStep data={data} onEnroll={handleEnroll} enrolling={enrolling} />
            )}

            {/* Navigation Buttons */}
            {currentStep !== "review" && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                <button
                  onClick={handleBack}
                  disabled={stepIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 transition-all font-semibold"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {currentStep === "review" && stepIndex > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Back to Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
