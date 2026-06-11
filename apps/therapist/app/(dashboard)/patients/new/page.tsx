"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import { patientsAPI } from "@/lib/api";

export default function NewPatientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    dob: "",
    gender: "",
    primary_concern: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      setError("First name, last name and email are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patient = await patientsAPI.create({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        date_of_birth: form.dob || undefined,
        gender: form.gender || undefined,
        primary_concern: form.primary_concern || undefined,
        emergency_contact_name: form.emergency_contact_name || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
      });
      const newId = (patient as any).id;
      if (newId) router.push(`/patients/${newId}`);
      else router.push('/patients');
    } catch (err: any) {
      setError(err?.message || "Failed to create patient. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/patients" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">New Patient</h1>
          <p className="text-sm text-slate-500">Add a new patient to your practice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
              <input
                type="text" value={form.first_name} onChange={set("first_name")} required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Sarah"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
              <input
                type="text" value={form.last_name} onChange={set("last_name")} required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Chen"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
              <input
                type="email" value={form.email} onChange={set("email")} required
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="sarah@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input
                type="tel" value={form.phone} onChange={set("phone")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
              <input
                type="date" value={form.dob} onChange={set("dob")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
              <select
                value={form.gender} onChange={set("gender")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select...</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Clinical</h2>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Concern</label>
          <textarea
            value={form.primary_concern} onChange={set("primary_concern")} rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            placeholder="What brings the patient to therapy?"
          />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Emergency Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text" value={form.emergency_contact_name} onChange={set("emergency_contact_name")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="Jane Doe (Sister)"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input
                type="tel" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <Link href="/patients" className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {saving ? "Creating..." : "Create Patient"}
          </button>
        </div>
      </form>
    </div>
  );
}
