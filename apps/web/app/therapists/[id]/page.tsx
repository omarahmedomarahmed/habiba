"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Star, MapPin, Clock, Video, Users, CheckCircle2, Calendar,
  ChevronLeft, ChevronRight, Shield, Globe, BadgeCheck,
  Award, BookOpen, Heart, MessageSquare, Brain, Sparkles,
  Phone, Mail, Check, AlertCircle, Info, ArrowRight, Quote
} from "lucide-react";
import { cn } from "@/lib/utils";

// Using mock data for the featured therapist
const THERAPIST = {
  id: "t1",
  name: "Dr. Sarah Mitchell",
  credentials: ["PhD", "LCSW"],
  license_number: "PSY-CA-29841",
  license_state: "California",
  verified_date: "December 2024",
  title: "Licensed Clinical Psychologist",
  photo_initials: "SM",
  photo_color: "from-violet-500 to-purple-600",
  specialties: ["Depression", "Anxiety", "Trauma & PTSD", "Women's Issues", "Life Transitions", "Self-Esteem"],
  approaches: ["Cognitive Behavioral Therapy (CBT)", "EMDR", "Mindfulness-Based Stress Reduction (MBSR)", "Acceptance & Commitment Therapy (ACT)", "Psychodynamic"],
  insurance: ["Aetna", "Blue Cross Blue Shield", "Cigna", "UnitedHealthcare", "Optum"],
  languages: ["English", "Spanish"],
  location: "New York, NY (and Telehealth nationwide)",
  telehealth: true,
  in_person: true,
  accepting_new: true,
  next_available: "Tomorrow",
  session_fee: "$180",
  intake_fee: "$200",
  sliding_scale: true,
  sliding_scale_min: "$80",
  rating: 4.9,
  review_count: 127,
  years_experience: 12,
  education: [
    { degree: "PhD, Clinical Psychology", school: "Columbia University", year: "2013" },
    { degree: "MS, Counseling Psychology", school: "Fordham University", year: "2010" },
    { degree: "BA, Psychology", school: "University of Michigan", year: "2008" },
  ],
  certifications: ["EMDR Certified Therapist (EMDRIA)", "Trauma-Focused CBT Certified", "Certified Grief Counselor"],
  about: `I believe that healing is possible for everyone, and my role is to walk alongside you as you rediscover your own strength and resilience. I specialize in working with adults navigating depression, anxiety, trauma, and significant life transitions.

My approach is warm, direct, and evidence-based. I draw from Cognitive Behavioral Therapy (CBT), EMDR for trauma processing, and mindfulness practices — tailoring each session to what resonates most with you. I don't believe in a one-size-fits-all approach. Therapy should feel like a genuine conversation, not a lecture.

I'm particularly passionate about working with women navigating major life changes, identity questions, and the complex intersection of professional demands and personal wellbeing. Many of my clients are high-achieving professionals who are doing "everything right" on paper but feeling disconnected or overwhelmed underneath.

Before establishing my private practice, I worked at Bellevue Hospital's Trauma Center and with the NYC Department of Health, where I developed a deep understanding of both clinical trauma care and systemic mental health challenges. That background informs the depth and seriousness with which I approach every client's care.`,
  session_length: "50 minutes",
  session_format: "Individual therapy",
  client_age: "Adults (18+)",
  video_platform: "Secure 24Therapy.ai telehealth",
  avg_response_time: "< 2 hours",
  typical_wait: "1-2 weeks",
  frequently_treats: ["Major Depressive Disorder", "Generalized Anxiety Disorder", "Post-Traumatic Stress Disorder", "OCD", "Burnout", "Relationship Issues"],
  ai_match_score: 96,
  reviews: [
    {
      initials: "S.C.",
      rating: 5,
      date: "November 2025",
      text: "Dr. Mitchell has been life-changing. After years of struggling with PTSD, her EMDR work has helped me process memories I never thought I could face. She's patient, warm, and truly skilled.",
    },
    {
      initials: "M.R.",
      rating: 5,
      date: "October 2025",
      text: "I was skeptical about therapy but Dr. Mitchell made it feel natural from session one. She has this incredible ability to identify patterns I wasn't aware of. I've made more progress in 3 months than I expected in a year.",
    },
    {
      initials: "L.P.",
      rating: 5,
      date: "September 2025",
      text: "As someone with anxiety, finding the right therapist was anxiety-inducing itself. Dr. Mitchell's thoroughness and warmth immediately put me at ease. The CBT tools she's given me have become part of my daily life.",
    },
    {
      initials: "J.K.",
      rating: 4,
      date: "August 2025",
      text: "Great therapist. Very knowledgeable and structured. I wish sessions were a bit longer sometimes, but the work we do in 50 minutes is always meaningful.",
    },
  ],
};

const AVAILABILITY_SLOTS = [
  { day: "Mon Dec 23", slots: ["10:00 AM", "1:00 PM", "3:00 PM"] },
  { day: "Tue Dec 24", slots: ["9:00 AM", "11:00 AM"] },
  { day: "Thu Dec 26", slots: ["10:00 AM", "2:00 PM", "4:00 PM"] },
  { day: "Fri Dec 27", slots: ["9:00 AM", "11:00 AM", "1:00 PM"] },
];

export default function TherapistProfilePage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "approach" | "insurance" | "reviews">("about");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3>(1);
  const [bookingData, setBookingData] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    primary_concern: "", how_heard: "",
  });
  const [booked, setBooked] = useState(false);

  const handleBook = () => {
    if (bookingStep < 3) {
      setBookingStep(prev => (prev + 1) as 1 | 2 | 3);
    } else {
      setBooked(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm text-slate-500">
          <Link href="/therapists" className="hover:text-[#1F5EFF] flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to Directory
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-6 items-start">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Profile Header */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-5">
              <div className="flex items-start gap-5">
                <div className={cn(
                  "w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black text-white shrink-0 bg-gradient-to-br",
                  THERAPIST.photo_color
                )}>
                  {THERAPIST.photo_initials}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-black text-slate-900">{THERAPIST.name}</h1>
                    <BadgeCheck className="w-6 h-6 text-[#1F5EFF]" />
                    {THERAPIST.ai_match_score && (
                      <div className="bg-gradient-to-r from-[#1F5EFF]/10 to-[#2EC4B6]/10 border border-[#1F5EFF]/20 rounded-lg px-3 py-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#1F5EFF]" />
                        <span className="text-sm font-bold text-[#1F5EFF]">{THERAPIST.ai_match_score}% AI Match</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {THERAPIST.credentials.map(c => (
                      <span key={c} className="text-xs bg-[#0A2342]/8 text-[#0A2342] px-2 py-0.5 rounded-md font-bold">{c}</span>
                    ))}
                    <span className="text-slate-500 text-sm">{THERAPIST.title}</span>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap text-sm text-slate-500">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-bold text-slate-700">{THERAPIST.rating}</span>
                      <span>({THERAPIST.review_count} reviews)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />{THERAPIST.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />{THERAPIST.years_experience} years experience
                    </div>
                    {THERAPIST.languages.length > 1 && (
                      <div className="flex items-center gap-1">
                        <Globe className="w-4 h-4" />{THERAPIST.languages.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {THERAPIST.certifications.map(cert => (
                      <span key={cert} className="text-[11px] bg-[#2EC4B6]/10 text-[#1a8c82] px-2 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                        <Award className="w-2.5 h-2.5" />{cert}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Specialties */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex flex-wrap gap-2">
                  {THERAPIST.specialties.map(s => (
                    <span key={s} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5">
              <div className="flex border-b border-slate-200">
                {(["about", "approach", "insurance", "reviews"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 text-sm font-semibold py-3 capitalize transition-all border-b-2",
                      activeTab === tab ? "border-[#0A2342] text-[#0A2342]" : "border-transparent text-slate-500 hover:text-slate-700"
                    )}>
                    {tab}
                    {tab === "reviews" && ` (${THERAPIST.review_count})`}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === "about" && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-slate-800 mb-3">About Dr. Mitchell</h3>
                      <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{THERAPIST.about}</div>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 mb-3">Education</h3>
                      <div className="space-y-2">
                        {THERAPIST.education.map((edu) => (
                          <div key={edu.degree} className="flex items-start gap-3">
                            <BookOpen className="w-4 h-4 text-[#0A2342] mt-0.5 shrink-0" />
                            <div>
                              <div className="text-sm font-semibold text-slate-800">{edu.degree}</div>
                              <div className="text-xs text-slate-500">{edu.school} · {edu.year}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-800 mb-3">Frequently Treats</h3>
                      <div className="flex flex-wrap gap-2">
                        {THERAPIST.frequently_treats.map(t => (
                          <span key={t} className="text-xs border border-slate-200 text-slate-600 px-3 py-1 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { label: "Session Length", value: THERAPIST.session_length },
                        { label: "Format", value: THERAPIST.session_format },
                        { label: "Client Age", value: THERAPIST.client_age },
                        { label: "Video Platform", value: THERAPIST.video_platform },
                        { label: "Avg Response", value: THERAPIST.avg_response_time },
                        { label: "Typical Wait", value: THERAPIST.typical_wait },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3">
                          <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                          <div className="text-sm font-semibold text-slate-800">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "approach" && (
                  <div className="space-y-5">
                    <h3 className="font-bold text-slate-800">Therapeutic Approaches</h3>
                    <div className="space-y-3">
                      {THERAPIST.approaches.map(approach => (
                        <div key={approach} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-[#2EC4B6] shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{approach}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-[#0A2342]/5 border border-[#0A2342]/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-[#0A2342]" />
                        <span className="text-sm font-bold text-[#0A2342]">AI-Powered Session Intelligence</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Dr. Mitchell uses 24Therapy.ai's AI copilot during sessions, which helps build a longitudinal memory of your treatment history — so every session builds on the last, and important clinical patterns are never lost.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "insurance" && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="font-bold text-slate-800 mb-3">Accepted Insurance Plans</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {THERAPIST.insurance.map(ins => (
                          <div key={ins} className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg">
                            <Shield className="w-4 h-4 text-[#0A2342]" />
                            <span className="text-sm text-slate-700">{ins}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4">
                      <h4 className="text-sm font-bold text-slate-800 mb-3">Fee Structure</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Standard Session (50 min)</span>
                          <span className="font-semibold text-slate-800">{THERAPIST.session_fee}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Initial Intake Session</span>
                          <span className="font-semibold text-slate-800">{THERAPIST.intake_fee}</span>
                        </div>
                        {THERAPIST.sliding_scale && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Sliding Scale (income-based)</span>
                            <span className="font-semibold text-green-600">From {THERAPIST.sliding_scale_min}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-blue-700">
                        <strong>In-network benefits:</strong> If your insurance is listed above, Dr. Mitchell can bill directly. Co-pays and deductibles depend on your specific plan. Contact your insurer for out-of-pocket cost estimates.
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "reviews" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-4xl font-black text-slate-800">{THERAPIST.rating}</div>
                        <div className="flex justify-center mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("w-4 h-4", i < Math.floor(THERAPIST.rating) ? "text-yellow-400 fill-yellow-400" : "text-slate-300")} />
                          ))}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{THERAPIST.review_count} reviews</div>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {[5, 4, 3, 2, 1].map(star => {
                          const count = star === 5 ? 110 : star === 4 ? 15 : star === 3 ? 2 : 0;
                          return (
                            <div key={star} className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 w-4">{star}</span>
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(count / THERAPIST.review_count) * 100}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      {THERAPIST.reviews.map((review, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 text-xs font-bold">
                                {review.initials}
                              </div>
                              <div>
                                <div className="flex">
                                  {Array.from({ length: review.rating }).map((_, j) => (
                                    <Star key={j} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-slate-400">{review.date}</span>
                          </div>
                          <Quote className="w-4 h-4 text-slate-300 mb-1" />
                          <p className="text-sm text-slate-600 leading-relaxed">{review.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Booking Sidebar */}
          <div className="w-80 shrink-0 sticky top-6" id="book">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              {/* Availability */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-base font-bold text-slate-800">{THERAPIST.session_fee}</div>
                  <div className="text-xs text-slate-500">per 50-min session</div>
                </div>
                <div className="text-right">
                  <div className={cn("text-xs font-bold flex items-center gap-1", THERAPIST.accepting_new ? "text-green-600" : "text-orange-600")}>
                    <Clock className="w-3 h-3" />
                    Next: {THERAPIST.next_available}
                  </div>
                  <div className="text-[10px] text-slate-400">Accepting new patients</div>
                </div>
              </div>

              {/* Session Type */}
              <div className="flex gap-2 mb-4">
                {[
                  { label: "Telehealth", icon: Video, available: THERAPIST.telehealth },
                  { label: "In-Person", icon: Users, available: THERAPIST.in_person },
                ].map(({ label, icon: Icon, available }) => (
                  <button key={label} disabled={!available}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg border transition-all",
                      available ? "border-[#0A2342]/30 bg-[#0A2342]/5 text-[#0A2342]" : "border-slate-200 text-slate-400 cursor-not-allowed"
                    )}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* Calendar */}
              <div className="mb-4">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Available Times</div>
                <div className="space-y-2.5">
                  {AVAILABILITY_SLOTS.map(({ day, slots }) => (
                    <div key={day}>
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">{day}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map(slot => (
                          <button
                            key={slot}
                            onClick={() => { setSelectedDate(day); setSelectedTime(slot); }}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-lg border transition-all",
                              selectedDate === day && selectedTime === slot
                                ? "bg-[#0A2342] text-white border-[#0A2342]"
                                : "border-slate-200 text-slate-600 hover:border-[#0A2342]"
                            )}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowBookingModal(true)}
                className={cn(
                  "w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all",
                  selectedTime
                    ? "bg-[#0A2342] text-white hover:bg-[#0A2342]/90 shadow-md"
                    : "bg-slate-100 text-slate-400 cursor-default"
                )}
              >
                <Calendar className="w-4 h-4" />
                {selectedTime ? `Book ${selectedTime}` : "Select a Time"}
              </button>

              <button className="w-full mt-2 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Free 15-min Consultation
              </button>

              {THERAPIST.sliding_scale && (
                <div className="mt-3 text-center text-xs text-slate-400">
                  Sliding scale available from {THERAPIST.sliding_scale_min} · <span className="text-[#1F5EFF]">Ask about eligibility</span>
                </div>
              )}

              {/* Trust indicators */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
                {[
                  { icon: Shield, label: "HIPAA-secure sessions" },
                  { icon: BadgeCheck, label: "License verified Dec 2024" },
                  { icon: Heart, label: "Accepting new patients" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-slate-500">
                    <Icon className="w-3.5 h-3.5 text-[#2EC4B6]" />{label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !booked && setShowBookingModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            {!booked ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-slate-800">Book a Session</h3>
                    <p className="text-xs text-slate-500">With Dr. Sarah Mitchell · {selectedTime}, {selectedDate}</p>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(s => (
                      <div key={s} className={cn("w-8 h-1 rounded-full", s <= bookingStep ? "bg-[#0A2342]" : "bg-slate-200")} />
                    ))}
                  </div>
                </div>

                {bookingStep === 1 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                        <input type="text" value={bookingData.first_name} onChange={e => setBookingData(p => ({ ...p, first_name: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0A2342]/20 outline-none"
                          placeholder="First name" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                        <input type="text" value={bookingData.last_name} onChange={e => setBookingData(p => ({ ...p, last_name: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0A2342]/20 outline-none"
                          placeholder="Last name" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                      <input type="email" value={bookingData.email} onChange={e => setBookingData(p => ({ ...p, email: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0A2342]/20 outline-none"
                        placeholder="your@email.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                      <input type="tel" value={bookingData.phone} onChange={e => setBookingData(p => ({ ...p, phone: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0A2342]/20 outline-none"
                        placeholder="(555) 000-0000" />
                    </div>
                  </div>
                )}

                {bookingStep === 2 && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Primary reason for seeking therapy</label>
                      <select value={bookingData.primary_concern} onChange={e => setBookingData(p => ({ ...p, primary_concern: e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-[#0A2342]/20 outline-none">
                        <option value="">Select...</option>
                        <option>Depression / Low Mood</option>
                        <option>Anxiety</option>
                        <option>Trauma / PTSD</option>
                        <option>Life Transitions</option>
                        <option>Relationships</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-700">Dr. Mitchell will review this before your session to prepare personalized support. This stays private between you and your therapist.</p>
                    </div>
                  </div>
                )}

                {bookingStep === 3 && (
                  <div className="space-y-4">
                    <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                      <div className="font-bold text-slate-800 mb-2">Booking Summary</div>
                      {[
                        { label: "Therapist", value: "Dr. Sarah Mitchell" },
                        { label: "Date & Time", value: `${selectedTime}, ${selectedDate}` },
                        { label: "Session Type", value: "Telehealth (Video)" },
                        { label: "Session Length", value: "50 minutes" },
                        { label: "Session Fee", value: THERAPIST.session_fee },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-slate-500">{label}</span>
                          <span className="font-medium text-slate-800">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" id="confirm" required className="mt-0.5 accent-[#0A2342]" />
                      <label htmlFor="confirm" className="text-xs text-slate-500">
                        I confirm this booking and agree to the 24-hour cancellation policy. I understand my card will not be charged until after the session.
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  {bookingStep > 1 && (
                    <button onClick={() => setBookingStep(prev => (prev - 1) as 1 | 2 | 3)}
                      className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-all">
                      Back
                    </button>
                  )}
                  <button onClick={handleBook}
                    className="flex-1 bg-[#0A2342] text-white py-2.5 rounded-xl font-bold text-sm hover:bg-[#0A2342]/90 transition-all flex items-center justify-center gap-2">
                    {bookingStep === 3 ? (
                      <><Check className="w-4 h-4" /> Confirm Booking</>
                    ) : (
                      <>Continue <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Session Booked!</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Your session with <strong>Dr. Sarah Mitchell</strong> is confirmed for{" "}
                  <strong>{selectedTime}, {selectedDate}</strong>.
                </p>
                <p className="text-xs text-slate-400 mb-6">Check your email for confirmation and session details. You'll receive a reminder 1 hour before your session.</p>
                <Link href="/find-therapist" onClick={() => setShowBookingModal(false)}
                  className="inline-flex items-center gap-2 text-sm text-[#1F5EFF] font-medium">
                  <ChevronLeft className="w-4 h-4" /> Back to Directory
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
