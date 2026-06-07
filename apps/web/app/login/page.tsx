"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import Link from "next/link";

// The /login route redirects users to their appropriate portal
// Patients → my.24therapy.ai, Therapists → app.24therapy.ai
export default function LoginPage() {
  const therapistPortal =
    process.env.NEXT_PUBLIC_THERAPIST_APP_URL || "https://app.24therapy.ai";
  const patientPortal =
    process.env.NEXT_PUBLIC_PATIENT_APP_URL || "https://my.24therapy.ai";

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
            Sign In
          </h1>
          <p className="text-slate-500 text-sm text-center mb-8">
            Choose your portal to continue
          </p>

          <div className="space-y-4">
            <a
              href={`${therapistPortal}/login`}
              className="flex items-center justify-between w-full p-5 bg-[#0A2342] hover:bg-[#0D2D57] text-white rounded-2xl transition-all group"
            >
              <div>
                <p className="font-bold text-lg">Therapist Portal</p>
                <p className="text-white/60 text-sm mt-0.5">
                  AI scribe, copilot & practice management
                </p>
              </div>
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors shrink-0 ml-4">
                <Brain className="w-5 h-5" />
              </div>
            </a>

            <a
              href={`${patientPortal}/login`}
              className="flex items-center justify-between w-full p-5 bg-slate-50 hover:bg-slate-100 text-[#0A2342] rounded-2xl border border-slate-200 transition-all group"
            >
              <div>
                <p className="font-bold text-lg text-[#0A2342]">Patient Portal</p>
                <p className="text-slate-500 text-sm mt-0.5">
                  Sessions, AI companion & wellness tracking
                </p>
              </div>
              <div className="w-10 h-10 bg-[#0A2342]/10 rounded-xl flex items-center justify-center group-hover:bg-[#0A2342]/20 transition-colors shrink-0 ml-4">
                <Brain className="w-5 h-5 text-[#0A2342]" />
              </div>
            </a>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#1F5EFF] font-medium hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
