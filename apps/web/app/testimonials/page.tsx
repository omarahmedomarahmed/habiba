"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Star, Quote, Brain, ArrowRight, ChevronLeft, ChevronRight,
  Heart, Shield, TrendingUp, Clock, Users, Award, Sparkles,
  CheckCircle2, Video, FileText, Play
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURED_TESTIMONIALS = [
  {
    id: "f1",
    name: "Dr. Rebecca Torres",
    credential: "PsyD · Private Practice · San Francisco, CA",
    photo: "RT",
    color: "from-violet-500 to-purple-600",
    role: "therapist",
    rating: 5,
    headline: "I went from burnout to running my best practice in 6 months.",
    quote: "I was on the verge of leaving private practice. The documentation burden was crushing me — sometimes 3–4 hours of notes after seeing patients all day. With 24Therapy's AI, I finish every note in 5 minutes. I now have the mental energy to actually be present with my patients instead of dreading the paperwork afterward. The AI copilot during sessions has also caught patterns I've missed — it's like having a brilliant colleague in the room.",
    stat1: { value: "4hrs → 25min", label: "Daily documentation time" },
    stat2: { value: "+40%", label: "Patient capacity increase" },
    video: false,
  },
  {
    id: "f2",
    name: "Marcus & Jennifer Okafor",
    credential: "Couple · Therapy patients since 2024",
    photo: "MJ",
    color: "from-teal-500 to-cyan-600",
    role: "patient",
    rating: 5,
    headline: "We were on the verge of divorce. 24Therapy helped us find the right therapist in 48 hours.",
    quote: "We had tried to find a couples therapist for months — every good one was booked for 6 weeks or had no openings. 24Therapy's matching system found us a Gottman-certified therapist who had an opening the next day and was in-network with our insurance. The patient portal has made it easy to track our session goals and homework between appointments. We're in a completely different place than we were a year ago.",
    stat1: { value: "48 hours", label: "Time to matched therapist" },
    stat2: { value: "12 months", label: "Active in therapy" },
    video: false,
  },
  {
    id: "f3",
    name: "Dr. James Whitfield",
    credential: "LCSW · Group Practice Director · Chicago, IL",
    photo: "JW",
    color: "from-blue-500 to-indigo-600",
    role: "practice",
    rating: 5,
    headline: "Our group practice's revenue grew 35% after switching to 24Therapy.",
    quote: "Running a 7-therapist practice used to mean drowning in admin. With 24Therapy, we have a unified platform where every therapist uses the AI tools, our billing is automated, and I have a real-time dashboard of our clinical outcomes across all patients. The analytics showed us that two of our therapists had unusually high patient churn — patterns we'd never have noticed before. We addressed it through supervision and outcomes improved significantly.",
    stat1: { value: "+35%", label: "Practice revenue growth" },
    stat2: { value: "7 therapists", label: "All on platform" },
    video: true,
  },
];

const TESTIMONIALS_GRID = [
  {
    name: "Sofia Martinez",
    credential: "Patient · Anxiety & Depression",
    photo: "SM",
    color: "from-pink-500 to-rose-600",
    role: "patient",
    rating: 5,
    quote: "The AI companion in the app was a game-changer for me. Having a compassionate, always-available chat when my anxiety spikes at 2am made such a difference between sessions.",
  },
  {
    name: "Dr. Kwan Park",
    credential: "PhD · Solo Practice · Seattle, WA",
    photo: "KP",
    color: "from-emerald-500 to-teal-600",
    role: "therapist",
    rating: 5,
    quote: "The memory layer is extraordinary. Before each session, I get a brief that captures everything meaningful from our history. My patients say I seem to 'remember everything' — that's the AI working.",
  },
  {
    name: "David & Rachel Nkosi",
    credential: "Patients · Couples Therapy",
    photo: "DN",
    color: "from-amber-500 to-orange-600",
    role: "patient",
    rating: 5,
    quote: "Being able to complete mood check-ins and access between-session resources made the work we do in therapy stick so much better. The progress tracking is motivating.",
  },
  {
    name: "Christine Lee",
    credential: "LMFT · Private Practice · NYC",
    photo: "CL",
    color: "from-violet-500 to-fuchsia-600",
    role: "therapist",
    rating: 5,
    quote: "The risk monitoring has saved lives. I received an alert about a patient I wouldn't have known was struggling until our next session. That early intervention made all the difference.",
  },
  {
    name: "Amara Johnson",
    credential: "Patient · PTSD & Trauma",
    photo: "AJ",
    color: "from-blue-500 to-sky-600",
    role: "patient",
    rating: 5,
    quote: "Finding a trauma-informed therapist who takes my insurance was nearly impossible before 24Therapy. The matching was incredibly accurate — my therapist felt like a fit from day one.",
  },
  {
    name: "Dr. Thomas Reeves",
    credential: "PsyD · Hospital System · Houston, TX",
    photo: "TR",
    color: "from-slate-500 to-gray-600",
    role: "practice",
    rating: 5,
    quote: "We integrated 24Therapy's API with our EHR. The workflow automation and compliance tools reduced our documentation audit prep from weeks to hours.",
  },
  {
    name: "Hannah Weiss",
    credential: "Patient · OCD & Anxiety",
    photo: "HW",
    color: "from-rose-500 to-pink-600",
    role: "patient",
    rating: 4,
    quote: "My therapist uses the ERP tracking in 24Therapy to track my exposure hierarchy. Seeing my progress visualized on the app is incredibly motivating. The crisis resources were there when I needed them.",
  },
  {
    name: "Dr. Yemi Oduya",
    credential: "LCSW · Community Mental Health · Atlanta, GA",
    photo: "YO",
    color: "from-green-500 to-emerald-600",
    role: "therapist",
    rating: 5,
    quote: "Working with underserved populations means I carry a heavy load. 24Therapy's AI copilot helps me manage high caseloads without compromising quality. The sliding scale and Medicaid billing tools are essential.",
  },
  {
    name: "Robert Castillo",
    credential: "Patient · Depression & Grief",
    photo: "RC",
    color: "from-cyan-500 to-blue-600",
    role: "patient",
    rating: 5,
    quote: "After my wife passed, I needed to talk to someone immediately. I was matched and in a session within 24 hours. Having the journal and mood tracker between sessions helped me see my gradual progress.",
  },
];

const STATS = [
  { value: "94%", label: "Therapist satisfaction rate", icon: Star },
  { value: "87%", label: "Patients report better outcomes", icon: TrendingUp },
  { value: "3.2pts", label: "Average PHQ-9 score improvement", icon: Heart },
  { value: "2,400+", label: "Active therapists on platform", icon: Users },
  { value: "48hrs", label: "Average time to matched therapist", icon: Clock },
  { value: "85%", label: "Documentation time saved", icon: FileText },
];

type FilterRole = "all" | "therapist" | "patient" | "practice";

export default function TestimonialsPage() {
  const [activeRole, setActiveRole] = useState<FilterRole>("all");
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const filteredGrid = TESTIMONIALS_GRID.filter(t => {
    if (activeRole === "all") return true;
    return t.role === activeRole;
  });

  const featured = FEATURED_TESTIMONIALS[featuredIndex];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <Sparkles className="w-3.5 h-3.5 text-[#2EC4B6]" />
            Real stories from therapists and patients
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-5">
            Lives Changed.<br />
            <span className="text-[#2EC4B6]">Practices Transformed.</span>
          </h1>
          <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
            Hear from therapists who've reclaimed their time, patients who found their match, and practices that scaled with confidence.
          </p>
          <div className="flex justify-center flex-wrap gap-6">
            {STATS.slice(0, 3).map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-black text-[#2EC4B6]">{value}</div>
                <div className="text-xs text-white/60 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="bg-[#0A2342]/5 border-b border-slate-200 py-8 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-3 md:grid-cols-6 gap-6">
          {STATS.map(({ value, label, icon: Icon }) => (
            <div key={label} className="text-center">
              <Icon className="w-5 h-5 text-[#2EC4B6] mx-auto mb-1.5" />
              <div className="text-xl font-black text-[#0A2342]">{value}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Testimonial Carousel */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-[#0A2342]">Featured Stories</h2>
          </div>

          <div className="bg-gradient-to-br from-[#0A2342]/5 to-[#2EC4B6]/5 border border-slate-200 rounded-3xl p-8 relative">
            <Quote className="w-10 h-10 text-[#2EC4B6]/30 absolute top-6 left-8" />

            <div className="flex items-start gap-6 mb-6">
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0 bg-gradient-to-br",
                featured.color
              )}>
                {featured.photo}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-slate-800 text-lg">{featured.name}</h3>
                  {featured.video && (
                    <span className="flex items-center gap-1 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Play className="w-2.5 h-2.5" /> Video Story
                    </span>
                  )}
                </div>
                <div className="text-sm text-slate-500">{featured.credential}</div>
                <div className="flex mt-1.5">
                  {Array.from({ length: featured.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
              </div>
            </div>

            <h4 className="text-xl font-bold text-slate-800 mb-4 leading-snug">"{featured.headline}"</h4>
            <p className="text-base text-slate-600 leading-relaxed mb-6">"{featured.quote}"</p>

            <div className="flex gap-4 flex-wrap">
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-3">
                <div className="text-xl font-black text-[#0A2342]">{featured.stat1.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{featured.stat1.label}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-3">
                <div className="text-xl font-black text-[#2EC4B6]">{featured.stat2.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{featured.stat2.label}</div>
              </div>
            </div>

            {/* Navigation */}
            <div className="absolute right-8 top-8 flex gap-2">
              <button
                onClick={() => setFeaturedIndex(prev => (prev - 1 + FEATURED_TESTIMONIALS.length) % FEATURED_TESTIMONIALS.length)}
                className="w-8 h-8 border border-slate-200 bg-white rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFeaturedIndex(prev => (prev + 1) % FEATURED_TESTIMONIALS.length)}
                className="w-8 h-8 border border-slate-200 bg-white rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dots */}
            <div className="flex gap-2 mt-6">
              {FEATURED_TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFeaturedIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === featuredIndex ? "w-6 bg-[#0A2342]" : "w-1.5 bg-slate-300"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grid Testimonials */}
      <section className="py-16 px-4 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h2 className="text-2xl font-black text-[#0A2342]">More Stories</h2>
            <div className="flex gap-2 flex-wrap">
              {(["all", "therapist", "patient", "practice"] as FilterRole[]).map(role => (
                <button
                  key={role}
                  onClick={() => setActiveRole(role)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize",
                    activeRole === role
                      ? "bg-[#0A2342] text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:border-[#0A2342]"
                  )}
                >
                  {role === "practice" ? "Group Practice" : role === "all" ? "All" : role.charAt(0).toUpperCase() + role.slice(1) + "s"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {filteredGrid.map(({ name, credential, photo, color, role, rating, quote }) => (
              <div key={name} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br", color)}>
                      {photo}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{name}</div>
                      <div className="text-[11px] text-slate-400">{credential}</div>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full",
                    role === "therapist" ? "bg-[#0A2342]/10 text-[#0A2342]" :
                      role === "patient" ? "bg-[#2EC4B6]/10 text-[#1a8c82]" :
                        "bg-violet-100 text-violet-700"
                  )}>
                    {role === "practice" ? "Group Practice" : role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                </div>
                <div className="flex mb-3">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">"{quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-black text-[#0A2342] mb-10">Built for Every Mental Health Professional</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                icon: Users,
                title: "For Solo Practitioners",
                desc: "Reduce paperwork, gain AI-powered insights, accept new patients, and grow your practice sustainably.",
                cta: "Get Started Free",
                href: "/for-therapists",
              },
              {
                icon: Building,
                title: "For Group Practices",
                desc: "Multi-therapist management, practice analytics, shared patient routing, and centralized billing.",
                cta: "Explore Group Plans",
                href: "/enterprise",
              },
              {
                icon: Heart,
                title: "For Patients",
                desc: "Find the right therapist fast, access care between sessions, track progress, and get crisis support anytime.",
                cta: "Find a Therapist",
                href: "/find-therapist",
              },
            ].map(({ icon: Icon, title, desc, cta, href }) => (
              <div key={title} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left">
                <Icon className="w-8 h-8 text-[#0A2342] mb-4" />
                <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 mb-4">{desc}</p>
                <Link href={href} className="text-sm font-semibold text-[#1F5EFF] flex items-center gap-1 hover:gap-2 transition-all">
                  {cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] rounded-2xl p-10">
            <h3 className="text-2xl font-black text-white mb-3">Ready to Experience It Yourself?</h3>
            <p className="text-white/70 mb-6">Join 2,400+ therapists and 50,000+ patients already using 24Therapy.ai</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/for-therapists" className="bg-[#2EC4B6] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#25a99d] transition-all inline-flex items-center gap-2">
                For Therapists — Start Free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/find-therapist" className="bg-white/20 text-white border border-white/30 px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all inline-flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Find My Therapist
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Fix import
function Building({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 22V12h6v10M9 7h.01M15 7h.01M9 12h.01M15 12h.01" />
    </svg>
  );
}
