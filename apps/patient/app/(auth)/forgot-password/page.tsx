"use client";

import { useState } from "react";
import { Brain, ArrowLeft, CheckCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOMAINS } from "@/lib/domains";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export default function PatientForgotPasswordPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <a href={DOMAINS.web} className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-800">24Therapy</span>
        </a>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          {sent ? (
            /* Success state */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-2">Check your email</h1>
              <p className="text-sm text-slate-500 mb-6">
                If <span className="font-medium text-slate-700">{email}</span> has an account,
                we&apos;ve sent a password reset link. Check your inbox (and spam folder).
              </p>
              <p className="text-xs text-slate-400 mb-6">
                The link expires in 1 hour.
              </p>
              <a
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </a>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-secondary-600" />
                </div>
                <h1 className="text-xl font-bold text-slate-800">Reset your password</h1>
                <p className="text-sm text-slate-500 mt-1">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className={cn(
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                    loading || !email
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:from-secondary-600 hover:to-secondary-700 shadow-md hover:shadow-lg"
                  )}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-6">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-secondary-600 hover:text-secondary-700 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </a>
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          If you&apos;re in crisis, call{" "}
          <span className="text-red-600 font-semibold">988</span> (Suicide &amp; Crisis Lifeline).
        </p>
      </div>
    </div>
  );
}
