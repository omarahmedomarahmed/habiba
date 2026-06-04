"use client";

import { Radio, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

const radarSteps = [
  { label: "Patient clicks 'Need Help Now'", icon: AlertCircle, color: "text-red-500 bg-red-50" },
  { label: "AI triage assessment (30 seconds)", icon: Radio, color: "text-orange-500 bg-orange-50" },
  { label: "Radar broadcasts to available therapists", icon: Radio, color: "text-yellow-500 bg-yellow-50" },
  { label: "First therapist accepts → session created", icon: CheckCircle, color: "text-blue-500 bg-blue-50" },
  { label: "Session starts — in under 5 minutes", icon: CheckCircle, color: "text-green-500 bg-green-50" },
];

const therapistCards = [
  { name: "Dr. Sarah Ahmed", specialty: "Anxiety & Depression", match: 96, wait: "< 2 min", lang: "EN/AR" },
  { name: "Dr. Omar Hassan", specialty: "Trauma & PTSD", match: 91, wait: "< 4 min", lang: "EN/AR" },
  { name: "Dr. Layla Chen", specialty: "CBT Specialist", match: 87, wait: "< 6 min", lang: "EN" },
];

export function RadarSection() {
  return (
    <section className="py-24 bg-white" id="radar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div>
            <div className="inline-flex items-center gap-2 bg-red-50 text-red-600 text-sm font-semibold px-4 py-2 rounded-full mb-6">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Radar Network — Live
            </div>

            <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-6">
              Help. Right Now.{" "}
              <span className="text-[#1F5EFF]">Not Tomorrow.</span>
            </h2>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Mental health crises don't wait for scheduled appointments. 
              Radar connects patients with available therapists in real-time — 
              24 hours a day, 7 days a week.
            </p>

            <div className="space-y-3 mb-10">
              {radarSteps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${step.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-sm font-medium text-slate-700">{step.label}</span>
                      {i < radarSteps.length - 1 && (
                        <div className="flex-1 h-0.5 bg-slate-100" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <Radio className="w-4 h-4" />
                Access Radar Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/features/radar"
                className="inline-flex items-center gap-2 text-slate-700 font-semibold px-6 py-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Right: Radar visualization */}
          <div className="relative">
            <div className="bg-[#0A2342] rounded-3xl p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-[#24C8DB] animate-pulse" />
                  <span className="font-bold text-white">Radar Network</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-white/60">3 therapists available now</span>
                </div>
              </div>

              {/* Patient request */}
              <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-300 uppercase">Incoming Request</span>
                </div>
                <p className="text-white text-sm font-medium">Patient needs immediate support</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["High Anxiety", "Arabic", "Video", "Budget: $50"].map((tag) => (
                    <span key={tag} className="text-xs bg-white/10 text-white/70 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Available therapists */}
              <div className="space-y-3">
                {therapistCards.map((t, i) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-[#1F5EFF] to-[#24C8DB] rounded-xl flex items-center justify-center font-bold text-white text-sm">
                        {t.name.split(" ")[1][0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        <p className="text-xs text-white/60">{t.specialty}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs font-bold text-[#24C8DB]">{t.match}%</p>
                        <p className="text-xs text-white/40">match</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-green-400">{t.wait}</p>
                        <p className="text-xs text-white/40">wait</p>
                      </div>
                      {i === 0 && (
                        <button className="bg-[#1F5EFF] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1649D4] transition-colors">
                          Accept
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Timer */}
              <div className="mt-4 flex items-center justify-center gap-2 text-white/50 text-sm">
                <Clock className="w-4 h-4" />
                <span>Request expires in 28 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
