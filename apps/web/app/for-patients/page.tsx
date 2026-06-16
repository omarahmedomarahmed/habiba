"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Heart, Search, Star, ShieldCheck, UserCheck, Lock,
  ArrowRight, ClipboardList, ChevronRight
} from "lucide-react";
import { PublicAssessmentTaker } from "@/components/marketing/PublicAssessmentTaker";
import { getApiUrl, getTherapistAppUrl } from "@/lib/env";

const API_URL = getApiUrl();
const THERAPIST_APP_URL = getTherapistAppUrl();

interface Therapist {
  id: string;
  name: string;
  title: string;
  initials: string;
  gradient: string;
  specializations: string[];
  rating: number;
  availability: string;
  public_slug?: string;
}

const AVAIL_LABELS: Record<string, string> = {
  today: "Available Today",
  this_week: "This Week",
  next_week: "Next Week",
};

const AVAIL_COLORS: Record<string, string> = {
  today: "bg-emerald-100 text-emerald-700",
  this_week: "bg-blue-100 text-blue-700",
  next_week: "bg-slate-100 text-slate-600",
};

const SPECIALTIES = [
  "All Specialties", "Anxiety", "Depression", "Trauma / PTSD", "OCD",
  "Relationships", "Grief & Loss", "ADHD", "LGBTQ+", "Family Issues",
];

export default function ForPatientsPage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("All Specialties");

  useEffect(() => {
    async function fetchTherapists() {
      try {
        const params = new URLSearchParams({ limit: "6" });
        if (search) params.set("q", search);
        if (specialty !== "All Specialties") params.set("specializations", specialty);
        const res = await fetch(`${API_URL}/marketplace/search?${params}`);
        if (!res.ok) return;
        const json = await res.json();
        const data = (json.data?.listings || json.data || []) as Array<Record<string, unknown>>;
        if (data.length === 0) return;
        setTherapists(data.map((t) => ({
          id: t.id as string,
          name: `${t.first_name || ""} ${t.last_name || ""}`.trim() || (t.display_name as string) || "Therapist",
          title: (t.title as string) || "Licensed Therapist",
          initials: String(t.first_name || t.display_name || "T").charAt(0).toUpperCase(),
          gradient: "from-blue-500 to-violet-600",
          specializations: (t.specializations as string[]) || [],
          rating: (t.rating as number) || 4.8,
          availability: (t.availability_status as string) || "this_week",
          public_slug: t.public_slug as string | undefined,
        })));
      } catch (_e) {
        // silently keep static fallback
      }
    }
    fetchTherapists();
  }, [search, specialty]);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0A2342] via-[#0d2d56] to-[#1a3a6a] text-white pt-28 pb-20">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" style={{ animation: "pulse 5s ease-in-out infinite" }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" style={{ animation: "pulse 7s ease-in-out infinite" }} />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm mb-8">
            <Heart className="w-4 h-4 text-[#2EC4B6]" />
            <span className="font-medium">For Patients</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Your Mental Health<br />
            <span className="text-[#2EC4B6]">Journey Starts Here</span>
          </h1>
          <p className="text-xl text-white/75 mb-10 max-w-2xl mx-auto">
            Find a licensed therapist, take a free self-assessment, and get matched — no account needed. Just click a link your therapist sends to join a session.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="#assessment"
              className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition-colors flex items-center gap-2"
            >
              Take a Free Assessment <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              href="/find-therapist"
              className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors"
            >
              Find a Therapist
            </Link>
          </div>
        </div>
      </section>

      {/* Therapist search */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Browse Licensed Therapists</h2>
            <p className="text-slate-500">All therapists on 24Therapy are licensed and verified. Book directly from their profile — no account required.</p>
          </div>

          {/* Search bar */}
          <div className="flex gap-3 mb-8 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or specialty..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
              />
            </div>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-700 bg-white focus:outline-none focus:border-[#2EC4B6]"
            >
              {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Therapist grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {therapists.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-lg font-medium text-slate-700 mb-1">Therapist directory loading</p>
                <p className="text-sm text-slate-500">Check back soon or <a href="/find-therapist" className="text-[#2EC4B6] underline">browse the full directory</a></p>
              </div>
            ) : therapists.slice(0, 6).map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-[#2EC4B6]/40 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{t.name}</p>
                    <p className="text-xs text-slate-500 truncate">{t.title}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {t.specializations.slice(0, 2).map((s) => (
                    <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium text-slate-700">{t.rating}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AVAIL_COLORS[t.availability] || AVAIL_COLORS.this_week}`}>
                    {AVAIL_LABELS[t.availability] || "Available"}
                  </span>
                </div>

                <Link
                  href={t.public_slug ? `${THERAPIST_APP_URL}/t/${t.public_slug}` : `${THERAPIST_APP_URL}/therapists/${t.id}`}
                  className="block w-full py-2.5 bg-[#0A2342] text-white text-center text-sm font-semibold rounded-xl hover:bg-[#123A63] transition-colors"
                >
                  Book Session
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/find-therapist"
              className="inline-flex items-center gap-2 text-[#2EC4B6] font-semibold hover:underline"
            >
              See all therapists <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Patient-facing features */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Simple, Safe, Private</h2>
            <p className="text-slate-500">Everything that matters when you reach out for support.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: UserCheck,
                title: "No Account Needed",
                description: "Just click the link your therapist sends. Enter your name, join. HIPAA-secure video — no app download, no signup, no friction.",
                color: "text-[#2EC4B6] bg-[#2EC4B6]/10",
              },
              {
                icon: ShieldCheck,
                title: "Licensed & Verified",
                description: "Every therapist on 24Therapy is licensed and identity-verified before they appear on the platform. You can see their credentials on their profile.",
                color: "text-blue-600 bg-blue-50",
              },
              {
                icon: Lock,
                title: "Your Session, Your Privacy",
                description: "HIPAA-compliant video. Sessions are never recorded or stored without your explicit consent. End-to-end encrypted from your browser.",
                color: "text-purple-600 bg-purple-50",
              },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="bg-slate-50 rounded-2xl border border-slate-200 p-6 text-center hover:shadow-sm transition-all">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${feature.color}`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Assessment Taker */}
      <section id="assessment" className="py-20 bg-slate-50 scroll-mt-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#2EC4B6]/10 text-[#2EC4B6] rounded-full px-4 py-2 text-sm font-semibold mb-4">
              <ClipboardList className="w-4 h-4" />
              Free Self-Assessment
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How Are You Feeling?</h2>
            <p className="text-slate-500">
              Take a clinically validated self-assessment — PHQ-9 (depression), GAD-7 (anxiety), or PCL-5 (trauma). Results are instant, private, and free.
            </p>
          </div>
          <PublicAssessmentTaker />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#0A2342] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Talk to Someone?</h2>
          <p className="text-white/70 mb-8">Browse our directory of licensed therapists. Book a session with a single click — no account required to join.</p>
          <Link
            href="/find-therapist"
            className="inline-flex items-center gap-2 bg-[#2EC4B6] text-white px-8 py-4 rounded-xl font-semibold hover:bg-[#26b0a2] transition-colors text-lg"
          >
            Find a Therapist <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-white/40 text-sm mt-4">If you are in crisis, call or text 988 — Suicide &amp; Crisis Lifeline</p>
        </div>
      </section>
    </div>
  );
}
