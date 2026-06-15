"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brain, Sparkles, Shield, CheckCircle2, ArrowRight, Eye, EyeOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOMAINS } from "@/lib/domains";
import { getApiUrl } from '@/lib/env';

const API_URL = getApiUrl();

function PatientRedirect() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#102040] flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">
            24Therapy<span className="text-[#2EC4B6]">.ai</span>
          </span>
        </Link>
        <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 bg-[#EEF6FF] rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Users className="w-8 h-8 text-[#1F5EFF]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Looking for therapy?</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">
            You don&apos;t need an account to see a therapist on 24Therapy. Browse verified
            therapists and book a session directly — your therapist sends you a secure join link.
          </p>
          <Link
            href="/find-therapist"
            className="inline-flex items-center gap-2 bg-[#2EC4B6] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#26b0a2] transition w-full justify-center"
          >
            Find a Therapist
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-center text-xs text-slate-400 mt-4">
            Are you a therapist?{" "}
            <button
              onClick={() => window.location.replace("/signup?role=therapist")}
              className="text-[#1F5EFF] font-medium hover:underline"
            >
              Sign up here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function SignupFormInner() {
  const searchParams = useSearchParams();
  const isPatient = searchParams?.get("role") === "patient";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (isPatient) return <PatientRedirect />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          role: "therapist",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Registration failed");
      }

      const { access_token, refresh_token } = json.data?.tokens || {};
      if (access_token && typeof window !== "undefined") {
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token || "");
      }

      setSuccess(true);

      setTimeout(() => {
        window.location.href = `${DOMAINS.therapistApp}/onboarding`;
      }, 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[#0A2342] mb-2">Welcome to 24Therapy!</h2>
          <p className="text-slate-500">Setting up your therapist workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#102040] flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">
            24Therapy<span className="text-[#2EC4B6]">.ai</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#0A2342]">Join 24Therapy as a Therapist</h1>
            <p className="text-slate-500 text-sm mt-1">
              First session free · HIPAA compliant · No credit card
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30 focus:border-[#1F5EFF] transition-all"
                  placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30 focus:border-[#1F5EFF] transition-all"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30 focus:border-[#1F5EFF] transition-all"
                placeholder="you@practice.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 pr-11 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F5EFF]/30 focus:border-[#1F5EFF] transition-all"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                loading
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-[#1F5EFF] text-white hover:bg-[#0A2342] shadow-md hover:shadow-lg"
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Create Therapist Account — Free
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-5">
            Already have an account?{" "}
            <a
              href={`${DOMAINS.therapistApp}/login`}
              className="text-[#1F5EFF] font-medium hover:underline"
            >
              Sign in
            </a>
          </p>

          <p className="text-center text-xs text-slate-400 mt-3">
            Looking for therapy?{" "}
            <Link href="/find-therapist" className="text-[#2EC4B6] hover:underline font-medium">
              Find a therapist
            </Link>
          </p>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6">
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            HIPAA Compliant
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            No credit card
          </span>
          <span className="flex items-center gap-1.5 text-xs text-white/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            Cancel anytime
          </span>
        </div>

        <p className="text-center text-xs text-white/40 mt-4">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-white/60">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="underline hover:text-white/60">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

function SignupFormSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2342] via-[#0D2D57] to-[#102040] flex items-center justify-center p-4 pt-24">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-white/10 rounded-xl" />
          <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="h-7 bg-slate-100 rounded-lg w-64 mx-auto mb-2 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-56 mx-auto animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
            <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-12 bg-slate-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignupForm() {
  return (
    <Suspense fallback={<SignupFormSkeleton />}>
      <SignupFormInner />
    </Suspense>
  );
}
