"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Search, CheckCircle } from "lucide-react";
import Link from "next/link";
import { patientsAPI, treatmentPlansAPI } from "@/lib/api";
import { cn } from "@/lib/utils";

const APPROACHES = [
  "CBT", "DBT", "EMDR", "ACT", "MBCT", "EFT",
  "Psychodynamic", "Humanistic", "Integrative", "Trauma-Informed",
];

const FREQUENCIES = ["weekly", "bi-weekly", "monthly", "2x-weekly", "intensive"];

const DIAGNOSES = [
  "F32.1 — Major Depressive Disorder, Moderate",
  "F41.1 — Generalized Anxiety Disorder",
  "F43.10 — PTSD, Unspecified",
  "F40.10 — Social Anxiety Disorder",
  "F33.0 — MDD, Recurrent, Mild",
  "F31.81 — Bipolar II Disorder",
  "F60.3 — Borderline Personality Disorder",
  "F90.2 — ADHD, Combined Presentation",
  "F10.10 — Alcohol Use Disorder, Mild",
];

interface Patient {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface Goal {
  description: string;
  priority: "high" | "medium" | "low";
  target_date: string;
}

function NewPlanForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [form, setForm] = useState({
    presenting_problem: "",
    primary_diagnosis: "",
    therapeutic_approach: "CBT",
    frequency: "weekly",
    estimated_sessions: 12,
    start_date: new Date().toISOString().split("T")[0],
  });
  const [goals, setGoals] = useState<Goal[]>([
    { description: "", priority: "high", target_date: "" },
  ]);
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

  const handleSubmit = async () => {
    if (!selectedPatient) return;
    setSubmitting(true);
    try {
      await treatmentPlansAPI.create({
        ...form,
        patient_id: selectedPatient.id,
        goals: goals.filter((g) => g.description),
      });
      router.push("/treatment-plans");
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link
        href="/treatment-plans"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Treatment Plans
      </Link>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">New Treatment Plan</h1>

      {/* Step 1: Patient */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold mb-4">Select Patient</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
            />
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {filteredPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                  selectedPatient?.id === p.id
                    ? "border-[#0A2342] bg-[#0A2342]/5"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-[#0A2342] text-white text-xs font-bold flex items-center justify-center">
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <span className="font-medium text-sm">
                  {p.first_name} {p.last_name}
                </span>
                {selectedPatient?.id === p.id && (
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
            className="w-full py-3 bg-[#0A2342] text-white rounded-xl font-semibold disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}

      {/* Step 2: Clinical details */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold">Clinical Details</h2>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Presenting Problem *</label>
            <textarea
              value={form.presenting_problem}
              onChange={(e) => setForm((f) => ({ ...f, presenting_problem: e.target.value }))}
              placeholder="Describe the client's presenting concerns..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Primary Diagnosis</label>
            <select
              value={form.primary_diagnosis}
              onChange={(e) => setForm((f) => ({ ...f, primary_diagnosis: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
            >
              <option value="">Select diagnosis...</option>
              {DIAGNOSES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Therapeutic Approach</label>
              <select
                value={form.therapeutic_approach}
                onChange={(e) => setForm((f) => ({ ...f, therapeutic_approach: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              >
                {APPROACHES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Session Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              >
                {FREQUENCIES.map((freq) => (
                  <option key={freq} value={freq}>{freq}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm"
            >
              Back
            </button>
            <button
              disabled={!form.presenting_problem}
              onClick={() => setStep(3)}
              className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl font-semibold disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Goals */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold">Treatment Goals</h2>
          {goals.map((goal, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Goal {i + 1}</span>
                {goals.length > 1 && (
                  <button
                    onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <textarea
                value={goal.description}
                onChange={(e) =>
                  setGoals(goals.map((g, j) => j === i ? { ...g, description: e.target.value } : g))
                }
                placeholder="Describe this treatment goal (SMART)..."
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={goal.priority}
                  onChange={(e) =>
                    setGoals(goals.map((g, j) =>
                      j === i ? { ...g, priority: e.target.value as Goal["priority"] } : g
                    ))
                  }
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
                <input
                  type="date"
                  value={goal.target_date}
                  onChange={(e) =>
                    setGoals(goals.map((g, j) =>
                      j === i ? { ...g, target_date: e.target.value } : g
                    ))
                  }
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              setGoals([...goals, { description: "", priority: "medium", target_date: "" }])
            }
            className="w-full py-2.5 border-2 border-dashed border-slate-200 text-slate-500 rounded-xl text-sm flex items-center justify-center gap-2 hover:border-slate-300"
          >
            <Plus className="w-4 h-4" /> Add Goal
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || goals.every((g) => !g.description)}
              className="flex-1 py-2.5 bg-[#2EC4B6] text-white rounded-xl font-semibold disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Treatment Plan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewTreatmentPlanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading...</div>}>
      <NewPlanForm />
    </Suspense>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
