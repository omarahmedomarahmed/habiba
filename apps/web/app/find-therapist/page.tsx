"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, MapPin, Star, Clock, Video, MessageSquare, Heart,
  Filter, ChevronRight, CheckCircle2, Brain, Shield, Award,
  Globe, Sparkles, X, Sliders, Users, Calendar, ArrowRight,
  Phone, User, BookOpen, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Therapist {
  id: string;
  name: string;
  title: string;
  license: string;
  photo_initials: string;
  gradient: string;
  specializations: string[];
  approaches: string[];
  languages: string[];
  rating: number;
  reviews: number;
  sessions: number;
  years_experience: number;
  availability: "today" | "this_week" | "next_week";
  video: boolean;
  messaging: boolean;
  phone: boolean;
  rate_per_session: number;
  accepting_new: boolean;
  verified: boolean;
  premium: boolean;
  location: string;
  bio: string;
  match_score: number;
  next_available: string;
  public_slug?: string;
}

// Static array removed — replaced with real API data

const SPECIALIZATIONS = [
  "Anxiety", "Depression", "Trauma / PTSD", "OCD", "Bipolar Disorder",
  "ADHD", "Grief & Loss", "Work Stress", "Relationships", "Family Issues",
  "Life Transitions", "LGBTQ+", "Men's Health", "Women's Health", "Teen Issues",
  "Addiction", "Eating Disorders", "Chronic Illness"
];

const APPROACHES = [
  "CBT", "DBT", "EMDR", "Psychodynamic", "Mindfulness", "ACT",
  "EFT", "Narrative Therapy", "Person-Centered"
];

function AvailabilityBadge({ availability }: { availability: Therapist["availability"] }) {
  const styles = {
    today: "bg-emerald-100 text-emerald-700",
    this_week: "bg-blue-100 text-blue-700",
    next_week: "bg-gray-100 text-gray-600"
  };
  const labels = { today: "Available Today", this_week: "Available This Week", next_week: "Available Next Week" };
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", styles[availability])}>
      {labels[availability]}
    </span>
  );
}

function MatchScore({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-indigo-50 rounded-xl px-2.5 py-1.5">
      <Sparkles className="h-3 w-3 text-indigo-600" />
      <span className="text-xs font-semibold text-indigo-700">{score}% Match</span>
    </div>
  );
}

import { getApiUrl } from '@/lib/env';

const API_URL = getApiUrl();

function computeMatchScore(t: any, query: string, specs: string[]): number {
  let score = 50;
  if (t.overall_rating) score += Math.min((Number(t.overall_rating) / 5) * 25, 25);
  if (t.accepting_patients !== false) score += 10;
  if (t.years_experience) score += Math.min(Number(t.years_experience), 10);
  if (specs.length && t.specializations?.some((s: string) => specs.includes(s))) score += 15;
  if (query && t.display_name?.toLowerCase().includes(query.toLowerCase())) score += 5;
  return Math.min(Math.round(score), 99);
}

const LANGUAGES = ["English", "Spanish", "French", "Arabic", "Mandarin", "Portuguese", "German", "Hindi", "Tagalog", "Korean"];

export default function FindTherapistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [filterLanguage, setFilterLanguage] = useState("");
  const [liveTherapists, setLiveTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("any");
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);
  const [aiMatchStarted, setAiMatchStarted] = useState(false);

  useEffect(() => {
    async function fetchTherapists() {
      setLoading(true);
      setFetchError(false);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('q', searchQuery);
        if (selectedSpecs.length) params.set('specializations', selectedSpecs.join(','));
        if (filterLanguage) params.set('languages', filterLanguage);
        const res = await fetch(`${API_URL}/marketplace/search?${params}`);
        if (!res.ok) throw new Error('API error');
        const json = await res.json();
        const raw: any[] = json?.results ?? json?.data?.listings ?? json?.data ?? (Array.isArray(json) ? json : []);
        const mapped = raw.map((t: any) => ({
          id: t.therapist_id ?? t.id,
          name: t.display_name ?? (`${t.first_name || ''} ${t.last_name || ''}`.trim() || 'Therapist'),
          license: t.license_type || '',
          title: t.title || t.specialization || 'Licensed Therapist',
          photo_initials: (t.display_name || t.first_name || 'T').charAt(0).toUpperCase(),
          gradient: 'from-blue-500 to-violet-600',
          location: t.location || 'Online',
          specializations: t.specializations || [],
          languages: t.languages || ['English'],
          rating: t.overall_rating ?? t.rating ?? 4.8,
          reviews: t.total_reviews ?? t.review_count ?? 0,
          sessions: 0,
          years_experience: t.years_experience ?? 0,
          availability: (t.availability || 'this_week') as 'today' | 'this_week' | 'next_week',
          video: true,
          messaging: true,
          phone: false,
          rate_per_session: t.session_price_cents ? Math.round(t.session_price_cents / 100) : (t.session_price ?? 0),
          accepting_new: t.accepting_patients ?? t.accepting_new_patients ?? true,
          verified: t.verification_status === 'approved',
          premium: false,
          bio: t.bio || '',
          match_score: computeMatchScore(t, searchQuery, selectedSpecs),
          next_available: 'This week',
          approaches: t.therapeutic_approaches || [],
          public_slug: t.public_slug || t.booking_slug || undefined,
        }));
        mapped.sort((a: any, b: any) => b.match_score - a.match_score);
        setLiveTherapists(mapped);
      } catch {
        setFetchError(true);
        setLiveTherapists([]);
      } finally {
        setLoading(false);
      }
    }
    fetchTherapists();
  }, [searchQuery, selectedSpecs, filterLanguage]);

  const toggleSpec = (spec: string) => {
    setSelectedSpecs(prev => prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]);
  };

  const filteredTherapists = liveTherapists.filter(t => {
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.specializations.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSpecs = selectedSpecs.length === 0 || selectedSpecs.some(s => t.specializations.includes(s));
    const matchesAvailability = availabilityFilter === "any" || t.availability === availabilityFilter;
    return matchesSearch && matchesSpecs && matchesAvailability;
  });

  if (selectedTherapist) {
    const t = selectedTherapist;
    return (
      <div className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
            <button onClick={() => setSelectedTherapist(null)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-[#0A2342]">{t.name}</span>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
            <div className={`bg-gradient-to-r ${t.gradient} p-8 text-white`}>
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{t.photo_initials}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-bold mb-1">{t.name}</h1>
                      <p className="text-white/80">{t.title}</p>
                      <p className="text-xs text-white/60 mt-1">License: {t.license}</p>
                    </div>
                    <MatchScore score={t.match_score} />
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> <span className="font-bold">{t.rating}</span> <span className="text-white/60">({t.reviews} reviews)</span></span>
                    <span>{t.sessions}+ sessions</span>
                    <span>{t.years_experience} years exp.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-700 leading-relaxed mb-6">{t.bio}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-semibold text-[#0A2342] mb-2">Specializations</h3>
                  <div className="flex flex-wrap gap-2">
                    {t.specializations.map(s => <span key={s} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm border border-indigo-100">{s}</span>)}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A2342] mb-2">Therapeutic Approaches</h3>
                  <div className="flex flex-wrap gap-2">
                    {t.approaches.map(a => <span key={a} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm border border-emerald-100">{a}</span>)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600 mb-6 p-4 bg-slate-50 rounded-xl">
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {t.location}</span>
                <span className="flex items-center gap-1"><Globe className="h-4 w-4" /> {t.languages.join(", ")}</span>
              </div>

              <div className="bg-gradient-to-r from-[#0A2342] to-[#1E4F8C] rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold">Next available: {t.next_available}</p>
                    <p className="text-white/60 text-sm">${t.rate_per_session} per session</p>
                  </div>
                  <AvailabilityBadge availability={t.availability} />
                </div>
                <div className="flex gap-3">
                  <Link
                    href={t.public_slug ? `/t/${t.public_slug}` : `/find-therapist`}
                    className="flex-1 py-3 bg-white text-[#0A2342] rounded-xl font-semibold hover:bg-white/90 text-sm text-center"
                  >
                    Book Session
                  </Link>
                  {t.messaging && (
                    <button className="px-4 py-3 bg-white/10 text-white rounded-xl border border-white/20 hover:bg-white/20 text-sm">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white py-16 pt-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Find Your Therapist</h1>
          <p className="text-white/70 text-lg mb-8">Match with licensed therapists based on your needs, availability, and preferences</p>

          {/* AI Match Banner */}
          {!aiMatchStarted && (
            <button
              onClick={() => setAiMatchStarted(true)}
              className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-2xl px-6 py-4 hover:bg-white/20 transition-all mb-8 w-full max-w-md text-left"
            >
              <div className="w-10 h-10 bg-[#1F5EFF] rounded-xl flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold">Try AI Matching</p>
                <p className="text-xs text-white/60">Answer 3 questions to get perfectly matched</p>
              </div>
              <ArrowRight className="h-5 w-5 ml-auto text-white/60" />
            </button>
          )}

          {/* Search */}
          <div className="flex gap-3 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, specialty, or approach..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl hover:bg-white/20 flex items-center gap-2 text-sm"
            >
              <Sliders className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0A2342]">Filters</h3>
              <button onClick={() => { setSelectedSpecs([]); setAvailabilityFilter("any"); }} className="text-xs text-gray-400 hover:text-gray-600">Clear all</button>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Availability</p>
              <div className="flex gap-2">
                {[["any", "Any Time"], ["today", "Today"], ["this_week", "This Week"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setAvailabilityFilter(val)}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all", availabilityFilter === val ? "bg-[#0A2342] text-white border-[#0A2342]" : "border-gray-200 text-gray-600 hover:border-[#0A2342]")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Language</p>
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none focus:border-[#0A2342] w-48 bg-white"
              >
                <option value="">All Languages</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Specialization</p>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map(spec => (
                  <button
                    key={spec}
                    onClick={() => toggleSpec(spec)}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all", selectedSpecs.includes(spec) ? "bg-[#0A2342] text-white border-[#0A2342]" : "border-gray-200 text-gray-600 hover:border-[#0A2342]")}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            {loading ? "Loading…" : fetchError ? "Could not load therapists" : `${filteredTherapists.length} therapist${filteredTherapists.length !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* Empty / error state */}
        {!loading && (fetchError || filteredTherapists.length === 0) && (
          <div className="text-center py-16 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="font-medium text-gray-500">{fetchError ? "Could not load therapists" : "No therapists found"}</p>
            <p className="text-sm mt-1">{fetchError ? "Please try again later." : "Try adjusting your filters or search terms."}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTherapists.map(t => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-[#1F5EFF]/30 hover:shadow-md transition-all flex flex-col">
              <div className="flex items-start gap-4 flex-1">
                <div className={`w-14 h-14 bg-gradient-to-br ${t.gradient} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                  <span className="text-lg font-bold text-white">{t.photo_initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-[#0A2342] truncate">{t.name}</h3>
                        {t.verified && <Shield className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
                        {t.premium && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{t.title}</p>
                    </div>
                    <MatchScore score={t.match_score} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {t.specializations.slice(0, 3).map(s => (
                      <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">{s}</span>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-slate-700">{t.rating}</span>
                      <span className="text-slate-400">({t.reviews})</span>
                    </span>
                    <span className="font-semibold text-[#0A2342] ml-auto">${t.rate_per_session}/session</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <AvailabilityBadge availability={t.availability} />
                    <div className="flex items-center gap-1 ml-auto">
                      {t.video && <Video className="h-4 w-4 text-blue-400" />}
                      {t.messaging && <MessageSquare className="h-4 w-4 text-green-400" />}
                      {t.phone && <Phone className="h-4 w-4 text-amber-400" />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                <Link
                  href={`/therapists/${t.id}`}
                  className="flex-1 py-2.5 border border-[#0A2342] text-[#0A2342] rounded-xl text-sm font-medium hover:bg-slate-50 text-center"
                >
                  View Profile
                </Link>
                <Link
                  href={t.public_slug ? `/t/${t.public_slug}` : `/signup`}
                  className="flex-1 py-2.5 bg-[#0A2342] text-white rounded-xl text-sm font-semibold hover:bg-[#123A63] text-center"
                >
                  Book Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
