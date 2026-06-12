"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brain, Eye, EyeOff, CheckCircle, AlertTriangle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DOMAINS } from "@/lib/domains";

import { getApiUrl } from "@/lib/env";
const API_BASE = getApiUrl();

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

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const passwordStrength = (): { label: string; color: string; width: string } => {
    const len = password.length;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [len >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score <= 1) return { label: "Weak", color: "bg-red-400", width: "w-1/4" };
    if (score === 2) return { label: "Fair", color: "bg-amber-400", width: "w-2/4" };
    if (score === 3) return { label: "Good", color: "bg-blue-400", width: "w-3/4" };
    return { label: "Strong", color: "bg-green-500", width: "w-full" };
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
        // Redirect to login after 2.5s
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

  const strength = password ? passwordStrength() : null;

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
          {success ? (
            /* Success state */
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-2">Password updated!</h1>
              <p className="text-sm text-slate-500 mb-2">
                Your password has been reset successfully.
              </p>
              <p className="text-xs text-slate-400">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                {!token ? (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Invalid reset link</p>
                      <p className="text-xs mt-0.5 text-amber-600">
                        Please{" "}
                        <a href="/forgot-password" className="underline font-medium">
                          request a new password reset
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center mb-4">
                      <Lock className="w-6 h-6 text-secondary-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-800">Set new password</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Choose a strong password for your account.
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  {error}
                  {error.includes("request a new") && (
                    <a href="/forgot-password" className="block mt-1 underline font-medium text-red-600 text-xs">
                      Request new reset link →
                    </a>
                  )}
                </div>
              )}

              {token && (
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all pr-11"
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                      >
                        {showPassword
                          ? <EyeOff className="w-4 h-4 text-slate-400" />
                          : <Eye className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    {/* Strength bar */}
                    {strength && (
                      <div className="mt-2">
                        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", strength.color, strength.width)} />
                        </div>
                        <p className={cn("text-xs mt-1", strength.color.replace("bg-", "text-"))}>
                          {strength.label}
                        </p>
                      </div>
                    )}
                  </div>

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
                          "w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all pr-11",
                          confirmPassword && password !== confirmPassword
                            ? "border-red-300 focus:ring-red-400"
                            : "border-slate-200 focus:ring-secondary-500"
                        )}
                        placeholder="Re-enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2"
                      >
                        {showConfirm
                          ? <EyeOff className="w-4 h-4 text-slate-400" />
                          : <Eye className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !password || !confirmPassword || password !== confirmPassword}
                    className={cn(
                      "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                      loading || !password || !confirmPassword || password !== confirmPassword
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:from-secondary-600 hover:to-secondary-700 shadow-md hover:shadow-lg"
                    )}
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </form>
              )}

              <p className="text-center text-sm text-slate-500 mt-6">
                <a href="/login" className="text-secondary-600 hover:text-secondary-700 font-medium">
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

export default function PatientResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-secondary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
