import type { Metadata } from "next";
import Link from "next/link";
import { Brain } from "lucide-react";
import { AUTH_URLS } from "@/lib/domains";

export const metadata: Metadata = {
  title: "Sign In | 24Therapy.ai",
  description: "Sign in to your 24Therapy.ai therapist account.",
  robots: { index: false, follow: false },
};

// The /login route is a Server Component — it renders portal selection links.
// Patients → my.24therapy.ai/login, Therapists → app.24therapy.ai/login
// URLs come from centralized DOMAINS config — never hardcoded.
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] flex items-center justify-center p-4 pt-20">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">
            24Therapy<span className="text-[#2EC4B6]">.ai</span>
          </span>
        </Link>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-[#0A2342] text-center mb-2">
            Therapist Sign In
          </h1>
          <p className="text-slate-500 text-sm text-center mb-8">
            Access your AI-powered practice dashboard
          </p>

          <a
            href={AUTH_URLS.therapistLogin}
            className="flex items-center justify-between w-full p-5 bg-[#0A2342] hover:bg-[#0D2D57] text-white rounded-2xl transition-all group mb-4"
          >
            <div>
              <p className="font-bold text-lg">Sign In to Therapist Portal</p>
              <p className="text-white/60 text-sm mt-0.5">
                AI scribe, copilot &amp; practice management
              </p>
            </div>
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors shrink-0 ml-4">
              <Brain className="w-5 h-5" />
            </div>
          </a>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center mb-4">
            <p className="text-sm text-slate-600">
              Are you a patient?{" "}
              <Link href="/find-therapist" className="text-[#2EC4B6] font-medium hover:underline">
                Visit your therapist&apos;s booking link directly
              </Link>{" "}
              — no account needed to join a session.
            </p>
          </div>

          <p className="text-center text-xs text-slate-400">
            New therapist?{" "}
            <Link href="/signup?role=therapist" className="text-[#1F5EFF] font-medium hover:underline">
              Create a free account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
