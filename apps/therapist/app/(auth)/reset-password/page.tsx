"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brain, Eye, EyeOff, CheckCircle, AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOMAINS } from "@/lib/domains";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api-24therapy-production.up.railway.app/api/v1";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Missing reset token. Please request a new password reset.");
    }
  }, [token]);

  const getStrength = (): { label: string; className: string; width: string } => {
    const len = password.length;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [len >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score <= 1) return { label: "Weak", className: "bg-red-400", width: "w-1/4" };
    if (score === 2) return { label: "Fair", className: "bg-amber-400", width: "w-2/4" };
    if (score === 3) return { label: "Good", className: "bg-blue-400", width: "w-3/4" };
    return { label: "Strong", className: "bg-green-500", width: "w-full" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push("/login"), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 || res.status === 401) {
          setError("Reset link is invalid or has expired. Please request a new one.");
        } else {
          setError(data.message || "Something went wrong. Please try again.");
        }
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const strength = password ? getStrength() : null;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = !loading && password.length >= 8 && password === confirmPassword && !!token;

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
          {success ? (
            /* Success */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-slate-800 mb-2">Password updated!</h1>
              <p className="text-sm text-slate-500">
                Your password has been reset. Redirecting to sign in…
              </p>
            </div>
          ) : (
            <>
              {!token && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-sm mb-6">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Invalid reset link</p>
                    <Link href="/forgot-password" className="text-xs underline text-amber-600 mt-0.5 block">
                      Request a new one →
                    </Link>
                  </div>
                </div>
              )}

              {token && (
                <div className="mb-6">
                  <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                    <Lock className="w-5 h-5 text-secondary" />
                  </div>
                  <h1 className="text-lg font-semibold text-slate-800">Set new password</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Choose a strong password for your account.
                  </p>
                </div>
              )}

              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
                  {error}
                  {error.includes("request a new") && (
                    <Link href="/forgot-password" className="block mt-1 underline text-red-600 text-xs font-medium">
                      Request new reset link →
                    </Link>
                  )}
                </div>
              )}

              {token && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                        minLength={8}
                        autoComplete="new-password"
                        className="w-full h-10 px-3 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
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
                    {/* Strength indicator */}
                    {strength && (
                      <div className="mt-1.5">
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", strength.className, strength.width)} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={cn(
                          "w-full h-10 px-3 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-secondary",
                          mismatch
                            ? "border-red-300 focus:ring-red-300"
                            : "border-slate-200 focus:ring-secondary/50"
                        )}
                        placeholder="Re-enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {mismatch && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full h-10 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Reset Password <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-secondary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            This platform handles Protected Health Information (PHI).
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TherapistResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
