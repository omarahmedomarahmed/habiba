"use client";

import { useState } from "react";
import Link from "next/link";
import { Brain, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { DOMAINS } from "@/lib/domains";

import { getApiUrl } from "@/lib/env";
const API_BASE = getApiUrl();

export default function TherapistForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      // Always show success to prevent email enumeration
      if (res.ok || res.status === 404) {
        setSent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      // On network error still show success (don't leak info)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link href={DOMAINS.web} className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-base font-semibold text-slate-800">24Therapy</span>
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          {sent ? (
            /* Success */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 mb-2">Check your email</h1>
              <p className="text-sm text-slate-500 mb-4">
                If <span className="font-medium text-slate-700">{email}</span> is registered,
                a reset link is on its way. Check spam too.
              </p>
              <p className="text-xs text-slate-400 mb-6">Link expires in 1 hour.</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            /* Form */
            <>
              <div className="mb-6">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                  <Mail className="w-5 h-5 text-secondary" />
                </div>
                <h1 className="text-lg font-semibold text-slate-800">Reset password</h1>
                <p className="text-sm text-slate-500 mt-1">
                  We&apos;ll email you a link to reset your password.
                </p>
              </div>

              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-10 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          This platform handles Protected Health Information (PHI).
        </p>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
