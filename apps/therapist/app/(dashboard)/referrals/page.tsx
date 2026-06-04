"use client";

import { useState } from "react";
import {
  Send, Plus, Search, Filter, ChevronRight, Clock, CheckCircle2,
  AlertCircle, User, FileText, Phone, Mail, MapPin, Calendar,
  Building2, Pill, Brain, AlertTriangle, ArrowRight, Download,
  Eye, Edit3, MoreHorizontal, Inbox, ExternalLink, Clipboard,
  Heart, Shield, Sparkles, Activity, MessageSquare, Star
} from "lucide-react";
import { cn, getInitials, formatDate } from "@/lib/utils";

type ReferralStatus = "draft" | "sent" | "acknowledged" | "completed" | "declined" | "pending_info";
type ReferralUrgency = "routine" | "urgent" | "emergent";
type ReferralType = "psychiatry" | "psychology" | "social_work" | "primary_care" | "specialist" | "substance_use" | "eating_disorder" | "trauma" | "group_therapy" | "inpatient";

interface Referral {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_dob: string;
  patient_insurance: string;
  type: ReferralType;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  referred_to: string;
  referred_provider: string;
  referred_provider_credential: string;
  reason: string;
  clinical_summary: string;
  diagnoses: string[];
  medications: string[];
  created_at: string;
  sent_at?: string;
  acknowledged_at?: string;
  completed_at?: string;
  notes?: string;
  ai_generated: boolean;
}

const MOCK_REFERRALS: Referral[] = [
  {
    id: "ref001",
    patient_id: "p1",
    patient_name: "Sarah Chen",
    patient_dob: "1990-03-12",
    patient_insurance: "Blue Cross Blue Shield PPO",
    type: "psychiatry",
    urgency: "routine",
    status: "sent",
    referred_to: "Westside Psychiatric Group",
    referred_provider: "Dr. Jennifer Walsh, MD",
    referred_provider_credential: "Psychiatrist, Board Certified",
    reason: "Medication management consultation. Patient currently on Lexapro 10mg with good response. Requesting review of current regimen and potential optimization for seasonal affective component.",
    clinical_summary: "34-year-old female presenting with MDD (F32.1) and GAD (F41.1). Currently in CBT treatment with positive response. PHQ-9 improved from 17 to 13 over 6 months. Requesting psychiatric consultation for medication optimization.",
    diagnoses: ["F32.1 - Major Depressive Disorder, Moderate", "F41.1 - Generalized Anxiety Disorder"],
    medications: ["Escitalopram (Lexapro) 10mg QD", "Melatonin 5mg PRN"],
    created_at: "2025-12-01",
    sent_at: "2025-12-02",
    ai_generated: true,
    notes: "Patient is open to medication consultation. Coordinate with Dr. Walsh on treatment plan alignment."
  },
  {
    id: "ref002",
    patient_id: "p2",
    patient_name: "Marcus Webb",
    patient_dob: "1985-07-22",
    patient_insurance: "Aetna HMO",
    type: "substance_use",
    urgency: "urgent",
    status: "acknowledged",
    referred_to: "Harbor Recovery Center",
    referred_provider: "Dr. Alicia Torres, LCSW-C",
    referred_provider_credential: "LCADC, LCSW",
    reason: "Specialized substance use disorder treatment. Patient disclosed escalating alcohol use (daily 5+ drinks) that is interfering with CBT work. Needs concurrent SUD treatment.",
    clinical_summary: "42-year-old male with PTSD and AUD (F10.20). Alcohol use has increased significantly over past 3 months. Currently unable to engage in trauma processing due to active substance use. Requires parallel SUD intervention.",
    diagnoses: ["F43.10 - PTSD", "F10.20 - Alcohol Use Disorder, Moderate"],
    medications: ["Sertraline (Zoloft) 100mg QD"],
    created_at: "2025-11-28",
    sent_at: "2025-11-28",
    acknowledged_at: "2025-11-29",
    ai_generated: false,
    notes: "Urgent: Patient was tearful during disclosure. Motivational level: moderate. Has agreed to contact Harbor Recovery."
  },
  {
    id: "ref003",
    patient_id: "p3",
    patient_name: "Priya Nair",
    patient_dob: "1998-01-15",
    patient_insurance: "United Healthcare PPO",
    type: "eating_disorder",
    urgency: "urgent",
    status: "completed",
    referred_to: "Centre for Eating Disorders",
    referred_provider: "Dr. Amanda Fitch, PhD",
    referred_provider_credential: "Clinical Psychologist, CEDS",
    reason: "Specialized eating disorder assessment and treatment. Patient presenting with significant restriction, body dysmorphia, and disordered eating patterns consistent with AN-R. BMI 17.2 — medical monitoring required.",
    clinical_summary: "27-year-old female with AN-R (F50.01) and comorbid Major Depressive Disorder. Significant functional impairment, social withdrawal, medical concern at current weight. Stepped-up care recommended.",
    diagnoses: ["F50.01 - Anorexia Nervosa, Restricting Type", "F32.2 - Major Depressive Disorder, Severe"],
    medications: ["None currently"],
    created_at: "2025-10-15",
    sent_at: "2025-10-15",
    acknowledged_at: "2025-10-16",
    completed_at: "2025-11-01",
    ai_generated: true,
    notes: "Patient enrolled in IOP program. Coordinating monthly updates with Dr. Fitch. Continue supportive CBT in parallel."
  },
  {
    id: "ref004",
    patient_id: "p4",
    patient_name: "James Rodriguez",
    patient_dob: "1976-09-05",
    patient_insurance: "Medicare Part B",
    type: "trauma",
    urgency: "routine",
    status: "draft",
    referred_to: "Trauma Recovery Institute",
    referred_provider: "Dr. Robert Kim, PsyD",
    referred_provider_credential: "Trauma Specialist, EMDR Certified",
    reason: "EMDR intensive consultation for combat-related PTSD. Current CBT approach reaching plateau. Patient expressing interest in EMDR after reading about it. Referring for specialist consultation.",
    clinical_summary: "50-year-old male with chronic PTSD (F43.12) from combat exposure. 2 years in CBT with partial response. PCL-5 stable at 42. Requesting EMDR specialist consultation to discuss treatment options.",
    diagnoses: ["F43.12 - Post-Traumatic Stress Disorder, Chronic"],
    medications: ["Prazosin 2mg QHS", "Sertraline 200mg QD"],
    created_at: "2025-12-10",
    ai_generated: true,
  },
];

const STATUS_CONFIG: Record<ReferralStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "text-gray-600", bg: "bg-gray-100", icon: Edit3 },
  sent: { label: "Sent", color: "text-blue-700", bg: "bg-blue-100", icon: Send },
  acknowledged: { label: "Acknowledged", color: "text-indigo-700", bg: "bg-indigo-100", icon: CheckCircle2 },
  completed: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-red-700", bg: "bg-red-100", icon: AlertCircle },
  pending_info: { label: "Pending Info", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
};

const URGENCY_CONFIG: Record<ReferralUrgency, { label: string; color: string; dot: string }> = {
  routine: { label: "Routine", color: "text-gray-600", dot: "bg-gray-400" },
  urgent: { label: "Urgent", color: "text-orange-700", dot: "bg-orange-500" },
  emergent: { label: "Emergent", color: "text-red-700", dot: "bg-red-500" },
};

const TYPE_CONFIG: Record<ReferralType, { label: string; color: string }> = {
  psychiatry: { label: "Psychiatry", color: "text-purple-700" },
  psychology: { label: "Psychology", color: "text-blue-700" },
  social_work: { label: "Social Work", color: "text-teal-700" },
  primary_care: { label: "Primary Care", color: "text-green-700" },
  specialist: { label: "Specialist", color: "text-slate-700" },
  substance_use: { label: "Substance Use", color: "text-orange-700" },
  eating_disorder: { label: "Eating Disorders", color: "text-rose-700" },
  trauma: { label: "Trauma", color: "text-indigo-700" },
  group_therapy: { label: "Group Therapy", color: "text-amber-700" },
  inpatient: { label: "Inpatient/IOP", color: "text-red-700" },
};

const REFERRAL_TEMPLATES = [
  { id: "t1", name: "Psychiatry - Medication Management", type: "psychiatry", urgency: "routine" },
  { id: "t2", name: "Psychiatric Evaluation - Urgent", type: "psychiatry", urgency: "urgent" },
  { id: "t3", name: "EMDR / Trauma Specialist", type: "trauma", urgency: "routine" },
  { id: "t4", name: "Substance Use / Dual Diagnosis", type: "substance_use", urgency: "urgent" },
  { id: "t5", name: "Eating Disorder Specialist", type: "eating_disorder", urgency: "urgent" },
  { id: "t6", name: "Group Therapy Referral", type: "group_therapy", urgency: "routine" },
  { id: "t7", name: "Inpatient/Crisis Evaluation", type: "inpatient", urgency: "emergent" },
  { id: "t8", name: "Primary Care Coordination", type: "primary_care", urgency: "routine" },
];

const AI_GENERATED_REFERRAL = `REFERRAL LETTER

Date: December 10, 2025

TO: Dr. Robert Kim, PsyD
    Trauma Recovery Institute
    245 Healing Path Drive, Suite 300
    San Francisco, CA 94102

FROM: Dr. [Your Name], [Credentials]
      [Practice Name]
      [Address]
      Tel: [Phone] | Fax: [Fax]

RE: James Rodriguez, DOB: 09/05/1976
    Insurance: Medicare Part B | Member ID: [ID]

Dear Dr. Kim,

I am writing to refer Mr. James Rodriguez, a 50-year-old male, for EMDR consultation and potential treatment for chronic PTSD (ICD-10: F43.12) related to combat exposure during his military service.

CLINICAL BACKGROUND:
Mr. Rodriguez has been engaged in weekly individual psychotherapy with me for approximately 2 years, utilizing Cognitive Behavioral Therapy (CBT) with a Trauma-Focused component. While he has achieved partial response — including improved daily functioning and reduced nightmares — we have reached a therapeutic plateau. His PCL-5 score has remained stable at 42 over the past 4 months, suggesting that the current modality alone may not be sufficient for full symptom resolution.

CURRENT PRESENTATION:
• Hyperarousal and hypervigilance, particularly in crowded public spaces
• Recurrent intrusive memories related to specific combat incidents
• Emotional numbing and social withdrawal
• Sleep disruption despite Prazosin 2mg QHS
• Good insight and strong therapeutic alliance

CURRENT MEDICATIONS:
• Prazosin 2mg QHS (nightmare reduction)
• Sertraline (Zoloft) 200mg QD (mood/anxiety stabilization)
• Prescribed by Dr. Marcus Patel, Primary Care

REASON FOR REFERRAL:
Following our discussion of treatment options, Mr. Rodriguez expressed significant interest in EMDR after reading about its evidence base for combat PTSD. I believe an EMDR consultation would be of significant value at this stage. I am requesting your assessment and recommendation, with the intent of coordinating a parallel or transferred treatment approach as clinically indicated.

TREATMENT GOALS:
• Process specific traumatic memories using EMDR protocol
• Reduce PCL-5 score to below 33 (subclinical threshold)
• Improve quality of life and social reintegration

CONSENT:
Mr. Rodriguez has provided written consent for this referral and for the release of relevant clinical information.

Please do not hesitate to contact me with any questions. I look forward to collaborating on Mr. Rodriguez's care.

Sincerely,

[Your Name], [Credentials]
[License Number]
[Contact Information]`;

export default function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed" | "draft">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [showNewReferralModal, setShowNewReferralModal] = useState(false);
  const [showGeneratedLetter, setShowGeneratedLetter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [newReferral, setNewReferral] = useState({
    patient_name: "",
    type: "psychiatry" as ReferralType,
    urgency: "routine" as ReferralUrgency,
    reason: "",
    referred_to: "",
    referred_provider: "",
  });

  const filteredReferrals = MOCK_REFERRALS.filter((r) => {
    const matchesTab = activeTab === "all" 
      ? true 
      : activeTab === "active" 
        ? ["sent", "acknowledged", "pending_info"].includes(r.status)
        : activeTab === "completed" 
          ? r.status === "completed"
          : r.status === "draft";
    const matchesSearch = !searchQuery || r.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) || r.referred_to.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const stats = {
    total: MOCK_REFERRALS.length,
    active: MOCK_REFERRALS.filter(r => ["sent", "acknowledged"].includes(r.status)).length,
    completed: MOCK_REFERRALS.filter(r => r.status === "completed").length,
    draft: MOCK_REFERRALS.filter(r => r.status === "draft").length,
    urgent: MOCK_REFERRALS.filter(r => r.urgency !== "routine").length,
  };

  const generateLetter = async () => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 1800));
    setIsGenerating(false);
    setShowGeneratedLetter(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-500 mt-1">Manage patient referrals and care coordination</p>
        </div>
        <button
          onClick={() => setShowNewReferralModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Referral
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Referrals", value: stats.total, color: "text-gray-900", bg: "bg-white" },
          { label: "Active", value: stats.active, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Completed", value: stats.completed, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Draft", value: stats.draft, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Urgent/Emergent", value: stats.urgent, color: "text-red-700", bg: "bg-red-50" },
        ].map((stat) => (
          <div key={stat.label} className={cn("rounded-2xl p-4 border border-gray-200", stat.bg)}>
            <div className={cn("text-2xl font-bold mb-1", stat.color)}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Referral list */}
        <div className="col-span-2 space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patient or provider..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A2342]/20"
                />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {(["all", "active", "completed", "draft"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all",
                      activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Referral cards */}
          <div className="space-y-3">
            {filteredReferrals.map((referral) => {
              const statusConf = STATUS_CONFIG[referral.status];
              const urgencyConf = URGENCY_CONFIG[referral.urgency];
              const typeConf = TYPE_CONFIG[referral.type];
              const StatusIcon = statusConf.icon;

              return (
                <div
                  key={referral.id}
                  onClick={() => setSelectedReferral(selectedReferral?.id === referral.id ? null : referral)}
                  className={cn(
                    "bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-sm",
                    selectedReferral?.id === referral.id ? "border-[#0A2342] ring-1 ring-[#0A2342]/20" : "border-gray-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-[#0A2342] rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {getInitials(referral.patient_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 text-sm">{referral.patient_name}</span>
                          <span className={cn("text-xs font-medium", typeConf.color)}>
                            {typeConf.label}
                          </span>
                          {referral.ai_generated && (
                            <span className="flex items-center gap-1 text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                              <Sparkles className="h-2.5 w-2.5" /> AI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">→ {referral.referred_to} · {referral.referred_provider}</p>
                        <p className="text-xs text-gray-700 line-clamp-2">{referral.reason}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", urgencyConf.dot)} />
                            <span className={cn("text-xs font-medium", urgencyConf.color)}>{urgencyConf.label}</span>
                          </div>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{formatDate(referral.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xl", statusConf.bg, statusConf.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConf.label}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detail / Templates */}
        <div className="space-y-4">
          {selectedReferral ? (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="bg-[#0A2342] p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-xl",
                    STATUS_CONFIG[selectedReferral.status].bg,
                    STATUS_CONFIG[selectedReferral.status].color
                  )}>
                    {STATUS_CONFIG[selectedReferral.status].label}
                  </span>
                  <button onClick={() => setSelectedReferral(null)} className="text-white/60 hover:text-white text-sm">✕</button>
                </div>
                <h3 className="font-bold text-lg">{selectedReferral.patient_name}</h3>
                <p className="text-white/70 text-sm">{TYPE_CONFIG[selectedReferral.type].label} Referral</p>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto max-h-[600px]">
                {/* Referred to */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Referred To</p>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{selectedReferral.referred_to}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span>{selectedReferral.referred_provider}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{selectedReferral.referred_provider_credential}</p>
                  </div>
                </div>

                {/* Urgency */}
                <div className="flex items-center gap-3">
                  <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium",
                    selectedReferral.urgency === "emergent" ? "bg-red-100 text-red-700" :
                    selectedReferral.urgency === "urgent" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
                  )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", URGENCY_CONFIG[selectedReferral.urgency].dot)} />
                    {URGENCY_CONFIG[selectedReferral.urgency].label}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(selectedReferral.created_at)}</span>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Reason for Referral</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedReferral.reason}</p>
                </div>

                {/* Clinical Summary */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Clinical Summary</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedReferral.clinical_summary}</p>
                </div>

                {/* Diagnoses */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Diagnoses</p>
                  {selectedReferral.diagnoses.map((d) => (
                    <div key={d} className="text-xs bg-gray-50 rounded-lg px-3 py-1.5 mb-1 text-gray-700">{d}</div>
                  ))}
                </div>

                {/* Medications */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Current Medications</p>
                  {selectedReferral.medications.map((m) => (
                    <div key={m} className="flex items-center gap-2 text-xs text-gray-700 mb-1">
                      <Pill className="h-3 w-3 text-gray-400" />
                      {m}
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {selectedReferral.notes && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Clinical Notes</p>
                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                      <p className="text-xs text-amber-800">{selectedReferral.notes}</p>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Timeline</p>
                  <div className="space-y-2">
                    {[
                      { label: "Created", date: selectedReferral.created_at, icon: FileText },
                      { label: "Sent", date: selectedReferral.sent_at, icon: Send },
                      { label: "Acknowledged", date: selectedReferral.acknowledged_at, icon: CheckCircle2 },
                      { label: "Completed", date: selectedReferral.completed_at, icon: CheckCircle2 },
                    ].filter(e => e.date).map((event) => {
                      const EIcon = event.icon;
                      return (
                        <div key={event.label} className="flex items-center gap-2 text-xs">
                          <EIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-gray-600 font-medium w-24">{event.label}</span>
                          <span className="text-gray-400">{formatDate(event.date!)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <button
                    onClick={generateLetter}
                    disabled={isGenerating}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63] transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "Generating Letter..." : "Generate Referral Letter (AI)"}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50">
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </button>
                    <button className="flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-gray-50">
                      <Send className="h-3.5 w-3.5" /> Send via Fax
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Templates */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-[#0A2342]" />
                  Quick Start Templates
                </h3>
                <div className="space-y-2">
                  {REFERRAL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template.id);
                        setShowNewReferralModal(true);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full",
                          template.urgency === "emergent" ? "bg-red-500" :
                          template.urgency === "urgent" ? "bg-orange-500" : "bg-gray-400"
                        )} />
                        <span className="text-xs text-gray-700 font-medium">{template.name}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Outgoing fax */}
              <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">HIPAA-Compliant Faxing</span>
                </div>
                <p className="text-xs text-blue-700">All referral letters transmitted via encrypted secure fax. Delivery confirmation tracked automatically.</p>
              </div>

              {/* AI feature */}
              <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-800">AI Referral Writer</span>
                </div>
                <p className="text-xs text-indigo-700 mb-3">Automatically generates complete, professional referral letters from clinical data — diagnoses, medications, treatment history, and clinical context.</p>
                <button
                  onClick={() => setShowGeneratedLetter(true)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  Preview sample letter <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New Referral Modal */}
      {showNewReferralModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0A2342] p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">New Referral</h2>
                  <p className="text-white/70 text-sm mt-1">AI will generate the referral letter from clinical data</p>
                </div>
                <button onClick={() => setShowNewReferralModal(false)} className="text-white/70 hover:text-white">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Patient */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Patient</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                    <option>Sarah Chen</option>
                    <option>Marcus Webb</option>
                    <option>Priya Nair</option>
                    <option>James Rodriguez</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Referral Type</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                    {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                      <option key={type} value={type}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Urgency Level</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none">
                    <option value="routine">Routine</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergent">Emergent</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Referred Provider/Facility</label>
                  <input
                    placeholder="e.g. Westside Psychiatric Group"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Reason for Referral</label>
                <textarea
                  placeholder="Describe the clinical reason for referral..."
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none h-28 resize-none"
                />
              </div>

              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-800">AI Letter Generation</span>
                </div>
                <p className="text-xs text-indigo-700">The system will automatically populate diagnoses, medications, clinical history, treatment summary, and contact information from the patient record to generate a complete referral letter.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowNewReferralModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Cancel</button>
                <button
                  onClick={() => { setShowNewReferralModal(false); setShowGeneratedLetter(true); }}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium"
                >
                  Generate AI Letter
                </button>
                <button
                  onClick={() => setShowNewReferralModal(false)}
                  className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium"
                >
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Letter Modal */}
      {showGeneratedLetter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">AI-Generated Referral Letter</h3>
                  <p className="text-xs text-gray-500">Review and edit before sending</p>
                </div>
              </div>
              <button onClick={() => setShowGeneratedLetter(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 font-mono text-xs text-gray-700 whitespace-pre-wrap leading-relaxed mb-6">
                {AI_GENERATED_REFERRAL}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowGeneratedLetter(false)} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm">Close</button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  <Edit3 className="h-3.5 w-3.5" /> Edit Letter
                </button>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#123A63]">
                  <Send className="h-4 w-4" /> Send Referral
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
