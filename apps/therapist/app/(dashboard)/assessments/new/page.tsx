"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Search, CheckCircle, Send,
} from "lucide-react";
import Link from "next/link";
import { patientsAPI, assessmentsAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

const ASSESSMENT_TEMPLATES = [
  { code: "PHQ9",   name: "PHQ-9 Depression Scale",          category: "Depression",       duration: 5,  questions: 9  },
  { code: "GAD7",   name: "GAD-7 Anxiety Scale",             category: "Anxiety",          duration: 3,  questions: 7  },
  { code: "PCL5",   name: "PCL-5 PTSD Checklist",            category: "PTSD",             duration: 5,  questions: 20 },
  { code: "AUDIT",  name: "AUDIT Alcohol Use",               category: "Substance Use",    duration: 4,  questions: 10 },
  { code: "ASRS",   name: "ASRS-v1.1 ADHD Scale",            category: "ADHD",             duration: 5,  questions: 18 },
  { code: "MDQ",    name: "Mood Disorder Questionnaire",      category: "Bipolar",          duration: 5,  questions: 13 },
  { code: "C-SSRS", name: "Columbia Suicide Severity",       category: "Risk Assessment",  duration: 10, questions: 6  },
  { code: "DERS16", name: "DERS-16 Emotion Regulation",      category: "DBT",              duration: 8,  questions: 16 },
];

interface Patient {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

function NewAssessmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolParam = searchParams.get("tool")?.toUpperCase();

  const [step, setStep] = useState(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(toolParam || "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    patientsAPI
      .list({ limit: 50 })
      .then((res: unknown) => {
        const r = res as { data?: Patient[] } | Patient[];
        const arr = Array.isArray(r) ? r : (r as { data?: Patient[] }).data ?? [];
        setPatients(arr as Patient[]);
      })
      .catch(() => {});
  }, []);

  const filteredPatients = patients.filter((p) => {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
    return !search || name.includes(search.toLowerCase());
  });

  const handleAssign = async () => {
    if (!selectedPatient || !selectedTemplate) return;
    setSubmitting(true);
    try {
      await assessmentsAPI.sendToPatient(
        selectedPatient.id,
        selectedTemplate,
        notes ? { note: notes } : undefined
      );
      router.push("/assessments");
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link
        href="/assessments"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Assessments
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">Assign Assessment</h1>
      <p className="text-slate-500 text-sm mb-6">
        Select a patient and choose which assessment to send to their portal.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                step > s
                  ? "bg-green-500 text-white"
                  : step === s
                  ? "bg-[#0A2342] text-white"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              {step > s ? <CheckCircle className="w-4 h-4" /> : s}
            </div>
            <span
              className={cn(
                "text-sm",
                step === s ? "text-slate-900 font-medium" : "text-slate-400"
              )}
            >
              {s === 1 ? "Select Patient" : s === 2 ? "Choose Assessment" : "Confirm"}
            </span>
            {s < 3 && <div className="w-8 h-0.5 bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Patient selection */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
            />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  selectedPatient?.id === patient.id
                    ? "border-[#0A2342] bg-[#0A2342]/5"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-[#0A2342] text-white text-sm font-bold flex items-center justify-center">
                  {(patient.first_name?.[0] || "")}{(patient.last_name?.[0] || "")}
                </div>
                <div>
                  <div className="font-medium text-slate-900 text-sm">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-xs text-slate-500">{patient.email}</div>
                </div>
                {selectedPatient?.id === patient.id && (
                  <CheckCircle className="w-4 h-4 text-[#0A2342] ml-auto" />
                )}
              </button>
            ))}
            {filteredPatients.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">No patients found</div>
            )}
          </div>
          <button
            disabled={!selectedPatient}
            onClick={() => setStep(2)}
            className="w-full mt-4 py-3 bg-[#0A2342] text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Next: Choose Assessment →
          </button>
        </div>
      )}

      {/* Step 2: Template selection */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-[#0A2342] text-white text-xs font-bold flex items-center justify-center">
              {selectedPatient?.first_name?.[0]}{selectedPatient?.last_name?.[0]}
            </div>
            <span className="text-sm font-medium text-slate-900">
              {selectedPatient?.first_name} {selectedPatient?.last_name}
            </span>
            <button onClick={() => setStep(1)} className="ml-auto text-xs text-[#1F5EFF]">
              Change
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {ASSESSMENT_TEMPLATES.map((t) => (
              <button
                key={t.code}
                onClick={() => setSelectedTemplate(t.code)}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all",
                  selectedTemplate === t.code
                    ? "border-[#0A2342] bg-[#0A2342]/5"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-900">{t.code}</span>
                  {selectedTemplate === t.code && (
                    <CheckCircle className="w-4 h-4 text-[#0A2342]" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-1">{t.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{t.questions}Q</span>
                  <span>~{t.duration} min</span>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm"
            >
              Back
            </button>
            <button
              disabled={!selectedTemplate}
              onClick={() => setStep(3)}
              className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl font-semibold disabled:opacity-50"
            >
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-500">Patient</span>
              <span className="font-medium text-slate-900">
                {selectedPatient?.first_name} {selectedPatient?.last_name}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm text-slate-500">Assessment</span>
              <span className="font-medium text-slate-900">
                {ASSESSMENT_TEMPLATES.find((t) => t.code === selectedTemplate)?.name}
              </span>
            </div>
          </div>
          <textarea
            placeholder="Optional note to patient..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2EC4B6] mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm"
            >
              Back
            </button>
            <button
              onClick={handleAssign}
              disabled={submitting}
              className="flex-1 py-2.5 bg-[#2EC4B6] text-white rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? "Assigning..." : "Assign Assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewAssessmentPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading...</div>}>
      <NewAssessmentForm />
    </Suspense>
  );
}
