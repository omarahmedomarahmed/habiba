"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search, Filter, Star, MapPin, Clock, Video, CheckCircle,
  Brain, Shield, ChevronRight, Users, Award, Sparkles,
  Heart, BookOpen, Zap, SlidersHorizontal, X, Globe,
  BadgeCheck, Calendar, DollarSign, ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Therapist {
  id: string;
  name: string;
  credentials: string[];
  title: string;
  photo_initials: string;
  photo_color: string;
  specialties: string[];
  approaches: string[];
  insurance: string[];
  languages: string[];
  location: string;
  telehealth: boolean;
  in_person: boolean;
  accepting_new: boolean;
  next_available: string;
  session_fee: string;
  sliding_scale: boolean;
  rating: number;
  review_count: number;
  years_experience: number;
  bio: string;
  ai_match_score?: number;
  verified: boolean;
  featured?: boolean;
  badges: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const THERAPISTS: Therapist[] = [
  {
    id: "t1",
    name: "Dr. Sarah Mitchell",
    credentials: ["PhD", "LCSW"],
    title: "Licensed Clinical Psychologist",
    photo_initials: "SM",
    photo_color: "from-violet-500 to-purple-600",
    specialties: ["Depression", "Anxiety", "Trauma & PTSD", "Women's Issues"],
    approaches: ["CBT", "EMDR", "Mindfulness-Based"],
    insurance: ["Aetna", "Blue Cross", "Cigna", "UnitedHealth"],
    languages: ["English", "Spanish"],
    location: "New York, NY",
    telehealth: true,
    in_person: true,
    accepting_new: true,
    next_available: "Tomorrow",
    session_fee: "$180",
    sliding_scale: true,
    rating: 4.9,
    review_count: 127,
    years_experience: 12,
    bio: "Dr. Mitchell specializes in trauma-informed care using EMDR and CBT. Her warm, collaborative approach helps clients build resilience and reclaim their wellbeing. She has helped hundreds of clients navigate depression, anxiety, and complex trauma.",
    ai_match_score: 96,
    verified: true,
    featured: true,
    badges: ["Top Rated", "EMDR Certified", "Trauma Specialist"],
  },
  {
    id: "t2",
    name: "Marcus Johnson",
    credentials: ["LMFT"],
    title: "Licensed Marriage & Family Therapist",
    photo_initials: "MJ",
    photo_color: "from-blue-500 to-cyan-600",
    specialties: ["Couples Therapy", "Relationship Issues", "Anxiety", "Life Transitions"],
    approaches: ["EFT", "Gottman Method", "ACT"],
    insurance: ["Cigna", "Aetna", "Kaiser"],
    languages: ["English"],
    location: "Los Angeles, CA",
    telehealth: true,
    in_person: true,
    accepting_new: true,
    next_available: "Dec 22",
    session_fee: "$165",
    sliding_scale: false,
    rating: 4.8,
    review_count: 89,
    years_experience: 8,
    bio: "Marcus specializes in couples and relationship therapy, using the evidence-based Gottman Method and EFT. He creates a safe space where individuals and couples can explore patterns, deepen connection, and build lasting change.",
    ai_match_score: 91,
    verified: true,
    badges: ["Gottman Certified", "Couples Specialist"],
  },
  {
    id: "t3",
    name: "Dr. Priya Nair",
    credentials: ["PsyD", "LPC"],
    title: "Clinical Psychologist",
    photo_initials: "PN",
    photo_color: "from-teal-500 to-emerald-600",
    specialties: ["OCD", "Anxiety Disorders", "Panic", "Phobias"],
    approaches: ["ERP", "CBT", "Acceptance-Based"],
    insurance: ["Blue Cross", "UnitedHealth", "Humana", "Aetna"],
    languages: ["English", "Hindi", "Tamil"],
    location: "Chicago, IL",
    telehealth: true,
    in_person: false,
    accepting_new: true,
    next_available: "Dec 24",
    session_fee: "$175",
    sliding_scale: true,
    rating: 4.9,
    review_count: 64,
    years_experience: 10,
    bio: "Dr. Nair is an OCD and anxiety specialist trained in ERP (Exposure and Response Prevention), the gold-standard treatment for OCD. She provides compassionate, structured, evidence-based care tailored to each client's unique challenges.",
    ai_match_score: 88,
    verified: true,
    badges: ["OCD Specialist", "ERP Certified"],
  },
  {
    id: "t4",
    name: "James R. Thompson",
    credentials: ["LCSW", "CADC"],
    title: "Licensed Clinical Social Worker",
    photo_initials: "JT",
    photo_color: "from-orange-500 to-amber-600",
    specialties: ["Substance Use", "Addiction Recovery", "Depression", "Men's Issues"],
    approaches: ["Motivational Interviewing", "CBT", "12-Step Integration"],
    insurance: ["Medicaid", "Medicare", "Cigna"],
    languages: ["English"],
    location: "Houston, TX",
    telehealth: true,
    in_person: true,
    accepting_new: false,
    next_available: "Jan 8",
    session_fee: "$145",
    sliding_scale: true,
    rating: 4.7,
    review_count: 103,
    years_experience: 15,
    bio: "James has extensive experience working with addiction and substance use recovery. A licensed addiction counselor, he integrates motivational interviewing with CBT to help clients build lasting sobriety and address underlying mental health challenges.",
    verified: true,
    badges: ["Addiction Certified", "15+ Years Experience"],
  },
  {
    id: "t5",
    name: "Dr. Elena Vasquez",
    credentials: ["PhD"],
    title: "Licensed Psychologist",
    photo_initials: "EV",
    photo_color: "from-rose-500 to-pink-600",
    specialties: ["Grief & Loss", "Trauma", "Life Transitions", "Anxiety"],
    approaches: ["Psychodynamic", "DBT", "Somatic"],
    insurance: ["Aetna", "Blue Cross", "UnitedHealth"],
    languages: ["English", "Spanish", "Portuguese"],
    location: "Miami, FL",
    telehealth: true,
    in_person: true,
    accepting_new: true,
    next_available: "Dec 21",
    session_fee: "$190",
    sliding_scale: false,
    rating: 4.8,
    review_count: 77,
    years_experience: 9,
    bio: "Dr. Vasquez specializes in grief, loss, and major life transitions. Her integrative approach weaves together psychodynamic insight, somatic awareness, and DBT skills to help clients process loss and rediscover meaning.",
    ai_match_score: 83,
    verified: true,
    badges: ["Grief Specialist", "Somatic Certified", "Trilingual"],
  },
  {
    id: "t6",
    name: "David Chen",
    credentials: ["LPC", "NCC"],
    title: "Licensed Professional Counselor",
    photo_initials: "DC",
    photo_color: "from-indigo-500 to-blue-600",
    specialties: ["ADHD", "Young Adults", "Academic Stress", "Depression"],
    approaches: ["CBT", "Mindfulness", "Strengths-Based"],
    insurance: ["Cigna", "Aetna", "Student Health Plans"],
    languages: ["English", "Mandarin"],
    location: "San Francisco, CA",
    telehealth: true,
    in_person: false,
    accepting_new: true,
    next_available: "Tomorrow",
    session_fee: "$155",
    sliding_scale: true,
    rating: 4.6,
    review_count: 45,
    years_experience: 5,
    bio: "David specializes in working with young adults, college students, and professionals navigating ADHD, depression, and the pressures of modern life. He takes a strengths-based, practical approach focused on building executive function and resilience.",
    ai_match_score: 79,
    verified: true,
    badges: ["ADHD Specialist", "Young Adult Focus"],
  },
];

const SPECIALTIES = [
  "Depression", "Anxiety", "Trauma & PTSD", "OCD", "Couples Therapy",
  "Grief & Loss", "Substance Use", "ADHD", "Life Transitions", "Teen & Young Adults",
];

const APPROACHES = ["CBT", "DBT", "EMDR", "ACT", "Psychodynamic", "Mindfulness", "Somatic", "ERP"];

const INSURANCE_OPTIONS = ["Aetna", "Blue Cross", "Cigna", "UnitedHealth", "Medicaid", "Medicare", "Kaiser"];

// ─── Therapist Card ───────────────────────────────────────────────────────────

function TherapistCard({ therapist }: { therapist: Therapist }) {
  return (
    <div className={cn(
      "bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-all group",
      therapist.featured ? "border-[#1F5EFF]/30 shadow-md" : "border-slate-200"
    )}>
      {therapist.featured && (
        <div className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] px-4 py-1.5 text-center">
          <span className="text-[10px] font-bold text-white tracking-widest uppercase">⭐ Featured Therapist</span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 bg-gradient-to-br",
            therapist.photo_color
          )}>
            {therapist.photo_initials}
          </div>

          {/* Basic Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 group-hover:text-[#1F5EFF] transition-colors">{therapist.name}</h3>
              {therapist.verified && (
                <BadgeCheck className="w-4 h-4 text-[#1F5EFF]" />
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {therapist.credentials.map(c => (
                <span key={c} className="text-[11px] bg-[#0A2342]/5 text-[#0A2342] px-1.5 py-0.5 rounded font-bold">{c}</span>
              ))}
              <span className="text-xs text-slate-500">{therapist.title}</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-slate-700">{therapist.rating}</span>
              <span className="text-xs text-slate-400">({therapist.review_count} reviews)</span>
              <span className="text-slate-300 mx-1">·</span>
              <span className="text-xs text-slate-500">{therapist.years_experience} yrs exp</span>
            </div>
          </div>

          {/* AI Match Score */}
          {therapist.ai_match_score && (
            <div className="shrink-0 text-center bg-gradient-to-b from-[#1F5EFF]/10 to-[#2EC4B6]/10 border border-[#1F5EFF]/20 rounded-xl px-3 py-2">
              <div className="text-lg font-black text-[#1F5EFF]">{therapist.ai_match_score}%</div>
              <div className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">AI Match</div>
            </div>
          )}
        </div>

        {/* Location & Modality */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />{therapist.location}
          </div>
          {therapist.telehealth && (
            <div className="flex items-center gap-1 text-xs text-[#1F5EFF]">
              <Video className="w-3 h-3" />Telehealth
            </div>
          )}
          {therapist.in_person && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Users className="w-3 h-3" />In-Person
            </div>
          )}
          {therapist.languages.length > 1 && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Globe className="w-3 h-3" />{therapist.languages.slice(1).join(", ")}
            </div>
          )}
        </div>

        {/* Specialties */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {therapist.specialties.slice(0, 4).map(s => (
            <span key={s} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {therapist.specialties.length > 4 && (
            <span className="text-[11px] text-slate-400">+{therapist.specialties.length - 4} more</span>
          )}
        </div>

        {/* Bio */}
        <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">{therapist.bio}</p>

        {/* Badges */}
        {therapist.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {therapist.badges.map(badge => (
              <span key={badge} className="text-[10px] bg-[#2EC4B6]/10 text-[#1a8c82] px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                <Award className="w-2.5 h-2.5" />{badge}
              </span>
            ))}
          </div>
        )}

        {/* Insurance */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <Shield className="w-3 h-3 text-slate-400" />
          <span className="text-[11px] text-slate-500">
            {therapist.insurance.slice(0, 3).join(", ")}
            {therapist.insurance.length > 3 && ` +${therapist.insurance.length - 3}`}
          </span>
          {therapist.sliding_scale && (
            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Sliding Scale</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-800">{therapist.session_fee}<span className="text-xs font-normal text-slate-400">/session</span></div>
            <div className={cn(
              "text-[11px] font-semibold flex items-center gap-1 mt-0.5",
              therapist.accepting_new ? "text-green-600" : "text-orange-600"
            )}>
              <Clock className="w-3 h-3" />
              {therapist.accepting_new ? `Next: ${therapist.next_available}` : `Waitlist: ${therapist.next_available}`}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/therapists/${therapist.id}`}
              className="px-3 py-1.5 text-xs border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
            >
              View Profile
            </Link>
            {therapist.accepting_new && (
              <Link
                href={`/therapists/${therapist.id}#book`}
                className="px-3 py-1.5 text-xs bg-[#0A2342] text-white rounded-lg hover:bg-[#0A2342]/90 transition-all font-semibold"
              >
                Book Free Consult
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TherapistDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedApproaches, setSelectedApproaches] = useState<string[]>([]);
  const [selectedInsurance, setSelectedInsurance] = useState<string[]>([]);
  const [telehealthOnly, setTelehealthOnly] = useState(false);
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const [slidingScaleOnly, setSlidingScaleOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"match" | "rating" | "availability" | "price">("match");
  const [showFilters, setShowFilters] = useState(false);

  const toggleSpecialty = (s: string) => {
    setSelectedSpecialties(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const filtered = THERAPISTS.filter(t => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.name.toLowerCase().includes(q) &&
        !t.specialties.some(s => s.toLowerCase().includes(q)) &&
        !t.approaches.some(a => a.toLowerCase().includes(q)) &&
        !t.location.toLowerCase().includes(q)) return false;
    }
    if (selectedSpecialties.length > 0 && !selectedSpecialties.some(s => t.specialties.includes(s))) return false;
    if (selectedApproaches.length > 0 && !selectedApproaches.some(a => t.approaches.includes(a))) return false;
    if (selectedInsurance.length > 0 && !selectedInsurance.some(i => t.insurance.includes(i))) return false;
    if (telehealthOnly && !t.telehealth) return false;
    if (acceptingOnly && !t.accepting_new) return false;
    if (slidingScaleOnly && !t.sliding_scale) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "match") return (b.ai_match_score || 0) - (a.ai_match_score || 0);
    if (sortBy === "rating") return b.rating - a.rating;
    if (sortBy === "availability") {
      if (a.accepting_new && !b.accepting_new) return -1;
      if (!a.accepting_new && b.accepting_new) return 1;
      return 0;
    }
    if (sortBy === "price") return parseInt(a.session_fee.replace("$", "")) - parseInt(b.session_fee.replace("$", ""));
    return 0;
  });

  const activeFilterCount = selectedSpecialties.length + selectedApproaches.length + selectedInsurance.length +
    (telehealthOnly ? 1 : 0) + (acceptingOnly ? 1 : 0) + (slidingScaleOnly ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Matching — 500+ Verified Therapists
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
            Find Your Perfect Therapist
          </h1>
          <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
            Our AI matches you with the right therapist based on your needs, preferences, insurance, and availability — not just a list.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by specialty, approach, name, or location..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl text-sm border-0 shadow-lg focus:ring-2 focus:ring-[#2EC4B6] outline-none"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {["Depression", "Anxiety", "Trauma", "Couples", "OCD", "ADHD"].map(s => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s === "Couples" ? "Couples Therapy" : s === "Trauma" ? "Trauma & PTSD" : s)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  selectedSpecialties.some(ss => ss.includes(s))
                    ? "bg-[#2EC4B6] text-white"
                    : "bg-white/20 text-white hover:bg-white/30"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-slate-700 font-semibold">{filtered.length} therapists found</span>
            {activeFilterCount > 0 && (
              <span className="ml-2 text-xs bg-[#1F5EFF]/10 text-[#1F5EFF] px-2 py-0.5 rounded-full">{activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:ring-2 focus:ring-[#1F5EFF]/20"
            >
              <option value="match">Best AI Match</option>
              <option value="rating">Highest Rated</option>
              <option value="availability">Soonest Available</option>
              <option value="price">Lowest Fee</option>
            </select>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 border rounded-lg text-sm font-medium transition-all",
                showFilters ? "bg-[#0A2342] text-white border-[#0A2342]" : "bg-white border-slate-200 text-slate-700"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className={cn("text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center",
                  showFilters ? "bg-white text-[#0A2342]" : "bg-[#0A2342] text-white"
                )}>{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filters Panel */}
          {showFilters && (
            <div className="w-64 shrink-0">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 text-sm">Filters</h3>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setSelectedSpecialties([]);
                        setSelectedApproaches([]);
                        setSelectedInsurance([]);
                        setTelehealthOnly(false);
                        setAcceptingOnly(false);
                        setSlidingScaleOnly(false);
                      }}
                      className="text-xs text-[#1F5EFF] font-medium"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Quick toggles */}
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Telehealth Available", value: telehealthOnly, set: setTelehealthOnly },
                    { label: "Accepting New Patients", value: acceptingOnly, set: setAcceptingOnly },
                    { label: "Sliding Scale Fees", value: slidingScaleOnly, set: setSlidingScaleOnly },
                  ].map(({ label, value, set }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => set(!value)}
                        className={cn(
                          "w-9 h-5 rounded-full transition-all relative cursor-pointer",
                          value ? "bg-[#0A2342]" : "bg-slate-200"
                        )}
                      >
                        <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all", value ? "left-4" : "left-0.5")} />
                      </div>
                      <span className="text-xs text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>

                {/* Specialties */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Specialties</div>
                  <div className="space-y-1">
                    {SPECIALTIES.map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer">
                        <div
                          onClick={() => toggleSpecialty(s)}
                          className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                            selectedSpecialties.includes(s) ? "bg-[#0A2342] border-[#0A2342]" : "border-slate-300"
                          )}
                        >
                          {selectedSpecialties.includes(s) && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs text-slate-700">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Insurance */}
                <div className="border-t border-slate-100 pt-4 mt-4">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Insurance</div>
                  <div className="space-y-1">
                    {INSURANCE_OPTIONS.map(ins => (
                      <label key={ins} className="flex items-center gap-2 cursor-pointer">
                        <div
                          onClick={() => setSelectedInsurance(prev =>
                            prev.includes(ins) ? prev.filter(x => x !== ins) : [...prev, ins]
                          )}
                          className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                            selectedInsurance.includes(ins) ? "bg-[#0A2342] border-[#0A2342]" : "border-slate-300"
                          )}
                        >
                          {selectedInsurance.includes(ins) && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-xs text-slate-700">{ins}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Grid */}
          <div className="flex-1">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <div className="text-lg font-bold text-slate-600 mb-2">No therapists found</div>
                <div className="text-sm text-slate-400 mb-4">Try adjusting your filters or search terms</div>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSpecialties([]);
                    setSelectedInsurance([]);
                  }}
                  className="text-sm text-[#1F5EFF] font-medium"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered.map(therapist => (
                  <TherapistCard key={therapist.id} therapist={therapist} />
                ))}
              </div>
            )}

            {/* AI Matching CTA */}
            <div className="mt-8 bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-2xl p-8 text-center">
              <Sparkles className="w-8 h-8 text-[#2EC4B6] mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Let AI Find Your Perfect Match</h3>
              <p className="text-white/70 text-sm mb-6 max-w-lg mx-auto">
                Answer 5 questions about your needs, schedule, and insurance — our AI will match you with the 3 best-fit therapists from our vetted network.
              </p>
              <Link
                href="/find-therapist"
                className="inline-flex items-center gap-2 bg-[#2EC4B6] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#25a99d] transition-colors"
              >
                <Brain className="w-4 h-4" />
                Start AI Matching — Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small component fix
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
