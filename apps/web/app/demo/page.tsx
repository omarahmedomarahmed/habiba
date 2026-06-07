import Link from "next/link";
import { Calendar, Video, MessageSquare, ArrowRight, CheckCircle2, Brain, Sparkles, Clock } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const DEMO_FEATURES = [
  "Live AI Scribe demo with real session transcription",
  "Clinical Copilot walkthrough with risk detection",
  "Patient Memory knowledge graph visualization",
  "Practice analytics & revenue dashboard",
  "HIPAA compliance & security overview",
  "Pricing & implementation timeline",
];

export const metadata = {
  title: "Book a Demo | 24Therapy.ai",
  description: "Schedule a personalized demo of 24Therapy.ai's AI-powered mental health platform.",
};

export default function DemoPage() {
  const calendlyUrl =
    process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/24therapy/demo";

  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 bg-gradient-to-b from-[#0A2342] to-[#0D2D57] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">30-Minute Personalized Demo</span>
          </div>
          <h1 className="text-5xl font-bold mb-5">See 24Therapy.ai in Action</h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Book a live walkthrough with our team. We&apos;ll show you exactly how 24Therapy transforms clinical documentation and patient management.
          </p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left: What we'll cover */}
            <div>
              <h2 className="text-2xl font-bold text-[#0A2342] mb-6">
                What We&apos;ll Cover
              </h2>
              <div className="space-y-3 mb-8">
                {DEMO_FEATURES.map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-slate-700">{f}</span>
                  </div>
                ))}
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#1F5EFF]" />
                  <span className="text-sm text-slate-700">
                    <strong>Duration:</strong> 30 minutes
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5 text-[#1F5EFF]" />
                  <span className="text-sm text-slate-700">
                    <strong>Format:</strong> Live video call (Zoom or Google Meet)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-[#1F5EFF]" />
                  <span className="text-sm text-slate-700">
                    <strong>Audience:</strong> Therapists, practice owners, or clinic directors
                  </span>
                </div>
              </div>

              <div className="mt-8 p-5 bg-[#EEF2FF] rounded-2xl border border-[#1F5EFF]/20">
                <div className="flex items-center gap-3 mb-3">
                  <Brain className="w-5 h-5 text-[#1F5EFF]" />
                  <p className="font-semibold text-[#0A2342]">Prefer to try it yourself?</p>
                </div>
                <p className="text-slate-600 text-sm mb-4">
                  Start a free 14-day trial instantly — no demo required. Full access to all features.
                </p>
                <Link
                  href="/signup?role=therapist"
                  className="inline-flex items-center gap-2 bg-[#1F5EFF] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0A2342] transition-all text-sm"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Right: Booking */}
            <div>
              <h2 className="text-2xl font-bold text-[#0A2342] mb-6">
                Schedule Your Demo
              </h2>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-[#1F5EFF] rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-[#0A2342]">Book a 30-min Demo</p>
                    <p className="text-sm text-slate-500">Choose a time that works for you</p>
                  </div>
                </div>

                <a
                  href={calendlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-4 bg-[#1F5EFF] text-white font-semibold rounded-xl hover:bg-[#0A2342] transition-all shadow-md hover:shadow-lg text-lg"
                >
                  <Calendar className="w-5 h-5" />
                  Open Booking Calendar
                  <ArrowRight className="w-5 h-5" />
                </a>

                <p className="text-center text-xs text-slate-400 mt-4">
                  No commitment required. Cancel or reschedule anytime.
                </p>

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-600 text-center mb-4">
                    Prefer to chat first? Email us directly:
                  </p>
                  <a
                    href="mailto:hello@24therapy.ai?subject=Demo Request"
                    className="flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-[#1F5EFF] border border-[#1F5EFF]/30 rounded-xl hover:bg-[#EEF2FF] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    hello@24therapy.ai
                  </a>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center mt-4">
                For enterprise inquiries, please{" "}
                <Link href="/contact?type=enterprise" className="text-[#1F5EFF] hover:underline">
                  contact our sales team
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
