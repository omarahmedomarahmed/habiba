"use client";

import Link from "next/link";
import {
  Video, Shield, Mic, Lock, Wifi, Clock, CheckCircle, ArrowRight,
  Smartphone, Monitor, Globe, Star, Users, Zap, AlertTriangle,
  FileText, Camera, Volume2, Settings, Play, Heart, Building2,
  Activity, RefreshCw, Award, ChevronRight, Download, BarChart3
} from "lucide-react";

const FEATURES = [
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    description: "Every session is encrypted with AES-256. Video streams, audio, and chat are all protected. Patient data never leaves your control.",
  },
  {
    icon: Mic,
    title: "AI Scribe Integrated",
    description: "The AI listens (with consent) and auto-generates clinical notes in SOAP, DAP, or BIRP format immediately after the session ends.",
  },
  {
    icon: AlertTriangle,
    title: "Real-Time Risk Detection",
    description: "AI monitors session language for risk signals, self-harm indicators, and crisis language — alerting the therapist in real time.",
  },
  {
    icon: Users,
    title: "Branded Waiting Room",
    description: "Patients arrive in your branded virtual waiting room. The therapist sees patient status and can admit when ready.",
  },
  {
    icon: FileText,
    title: "Session Transcripts",
    description: "Consent-based session transcription with speaker labeling, timestamps, and searchable text. Securely stored and encrypted.",
  },
  {
    icon: Smartphone,
    title: "Works on Every Device",
    description: "No app download required. Sessions work on desktop, tablet, and mobile browsers. iOS, Android, Windows, Mac.",
  },
  {
    icon: Clock,
    title: "Automated Reminders",
    description: "Email and SMS reminders sent at 24h, 1h, and 15m before sessions. Dramatically reduces no-shows.",
  },
  {
    icon: RefreshCw,
    title: "Session Recording",
    description: "Encrypted session recordings stored for clinical review. Controlled access, retention policies, and patient consent tracking.",
  },
];

const COMPARISON = [
  { feature: "HIPAA Compliant", us: true, zoom: false, doxy: true, skype: false },
  { feature: "AI Note Generation", us: true, zoom: false, doxy: false, skype: false },
  { feature: "Risk Detection", us: true, zoom: false, doxy: false, skype: false },
  { feature: "EHR Integration", us: true, zoom: false, doxy: false, skype: false },
  { feature: "Automated Billing", us: true, zoom: false, doxy: true, skype: false },
  { feature: "Patient Memory Layer", us: true, zoom: false, doxy: false, skype: false },
  { feature: "Session Transcripts", us: true, zoom: true, doxy: false, skype: false },
  { feature: "Branded Waiting Room", us: true, zoom: false, doxy: true, skype: false },
  { feature: "Built-in Assessments", us: true, zoom: false, doxy: true, skype: false },
  { feature: "Clinical Analytics", us: true, zoom: false, doxy: false, skype: false },
];

const TESTIMONIALS = [
  {
    quote: "The AI scribe inside the video session is a game changer. I used to spend 2 hours after sessions writing notes. Now it's 5 minutes.",
    author: "Dr. Rachel Chen, PsyD",
    role: "Licensed Psychologist, Private Practice",
    rating: 5,
  },
  {
    quote: "Having HIPAA compliance built into the video platform — not bolted on — gives me total confidence with my patients.",
    author: "Marcus Williams, LCSW",
    role: "Trauma Therapist, Group Practice",
    rating: 5,
  },
  {
    quote: "I was using Doxy.me before. The difference is night and day. 24Therapy actually understands what therapists need.",
    author: "Sarah Thompson, LMFT",
    role: "Marriage & Family Therapist",
    rating: 5,
  },
];

const SPECS = [
  { label: "Video Quality", value: "Up to 1080p HD" },
  { label: "Uptime SLA", value: "99.9% guaranteed" },
  { label: "Encryption", value: "AES-256 / TLS 1.3" },
  { label: "Latency", value: "< 150ms global" },
  { label: "Max Participants", value: "20 (group sessions)" },
  { label: "Recording Storage", value: "Encrypted S3" },
  { label: "Compliance", value: "HIPAA, HITECH" },
  { label: "Browser Support", value: "Chrome, Safari, Firefox, Edge" },
];

export default function TeletherapyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
                <Shield className="w-4 h-4 text-[#2EC4B6]" />
                HIPAA-Secure Telehealth
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                Video therapy with{" "}
                <span className="text-[#2EC4B6]">AI built in</span>
              </h1>
              <p className="text-white/80 text-lg mb-8">
                Not just secure video. The only telehealth platform with real-time AI scribe, risk detection, copilot suggestions, and automated note generation — all inside the session room.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/signup?role=therapist"
                  className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
                >
                  Start Free Trial <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="bg-white/10 border border-white/30 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-white/20">
                  <Play className="w-4 h-4" /> Watch Session Demo
                </button>
              </div>
            </div>
            <div className="relative hidden md:block">
              <div className="bg-white/5 border border-white/20 rounded-2xl p-4">
                <div className="bg-[#0d2d56] rounded-xl p-3 mb-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#2EC4B6]/20 flex items-center justify-center">
                    <Video className="w-4 h-4 text-[#2EC4B6]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">Session: Sarah M.</div>
                    <div className="text-xs text-white/50">● Live · 24:15</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-xs text-white/50">REC</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[#0d2d56] rounded-lg h-24 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white/30" />
                  </div>
                  <div className="bg-[#0d2d56] rounded-lg h-24 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white/30" />
                  </div>
                </div>
                <div className="bg-violet-900/40 border border-violet-400/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-violet-500/30 flex items-center justify-center">
                      <Activity className="w-2.5 h-2.5 text-violet-400" />
                    </div>
                    <span className="text-xs font-medium text-violet-300">AI Copilot · Live</span>
                  </div>
                  <p className="text-xs text-white/70">
                    Patient is describing avoidance behaviors around work situations. Consider exploring specific triggers using CBT thought record.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">More than video calls</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Every feature therapists actually need — not a generic video platform with a privacy label slapped on.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="border border-gray-200 rounded-xl p-5 hover:border-[#2EC4B6] hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#2EC4B6]/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#2EC4B6]" />
                  </div>
                  <h3 className="font-semibold text-[#0A2342] mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technical Specs */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Technical Specifications</h2>
            <p className="text-gray-500">Enterprise-grade infrastructure you can trust with patient care</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {SPECS.map((spec) => (
              <div
                key={spec.label}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between"
              >
                <span className="text-gray-600 text-sm">{spec.label}</span>
                <span className="font-semibold text-[#0A2342] text-sm">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">How 24Therapy compares</h2>
            <p className="text-gray-500">The only platform purpose-built for mental health practice</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm text-gray-500 py-3 px-4">Feature</th>
                  <th className="text-center text-sm font-bold text-[#2EC4B6] py-3 px-4 bg-[#2EC4B6]/5 rounded-t-xl">24Therapy</th>
                  <th className="text-center text-sm text-gray-400 py-3 px-4">Zoom</th>
                  <th className="text-center text-sm text-gray-400 py-3 px-4">Doxy.me</th>
                  <th className="text-center text-sm text-gray-400 py-3 px-4">Skype</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="py-3 px-4 text-sm text-gray-700">{row.feature}</td>
                    <td className="py-3 px-4 text-center bg-[#2EC4B6]/5">
                      {row.us ? (
                        <CheckCircle className="w-4 h-4 text-[#2EC4B6] mx-auto" />
                      ) : (
                        <span className="text-gray-300 text-lg">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.zoom ? (
                        <CheckCircle className="w-4 h-4 text-gray-400 mx-auto" />
                      ) : (
                        <span className="text-gray-200 text-lg">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.doxy ? (
                        <CheckCircle className="w-4 h-4 text-gray-400 mx-auto" />
                      ) : (
                        <span className="text-gray-200 text-lg">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.skype ? (
                        <CheckCircle className="w-4 h-4 text-gray-400 mx-auto" />
                      ) : (
                        <span className="text-gray-200 text-lg">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#0A2342] mb-4">Therapists love it</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm mb-4 italic">"{t.quote}"</p>
                <div>
                  <div className="font-semibold text-[#0A2342] text-sm">{t.author}</div>
                  <div className="text-xs text-gray-400">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white">
        <div className="max-w-3xl mx-auto text-center">
          <Video className="w-10 h-10 text-[#2EC4B6] mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4">See a session in action</h2>
          <p className="text-white/70 mb-8 text-lg">
            Schedule a live demo and we'll walk you through a complete session — from waiting room to AI-generated note.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup?role=therapist"
              className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2"
            >
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="bg-white/10 border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/20"
            >
              Request Demo
            </Link>
          </div>
          <p className="text-white/40 text-sm mt-6">HIPAA compliant from day 1 · No IT setup · BAA included</p>
        </div>
      </section>
    </div>
  );
}
