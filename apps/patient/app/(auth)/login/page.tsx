"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Eye, EyeOff, Heart, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { authAPI, APIError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function PatientLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await authAPI.login(email, password);

      // Validate patient role
      if (!res.user || !["patient"].includes(res.user.role || "")) {
        setError("Access denied: Patient credentials required.");
        return;
      }

      const { access_token, refresh_token, expires_in } = res.tokens;

      // Update Zustand store
      setAuth(
        {
          id: String(res.user.id),
          email: String(res.user.email),
          first_name: String(res.user.first_name || ""),
          last_name: String(res.user.last_name || ""),
          role: String(res.user.role),
          patient_id: res.user.patient_id ? String(res.user.patient_id) : undefined,
          organization_id: String(res.user.organization_id || ""),
          therapist_name: res.user.therapist_name ? String(res.user.therapist_name) : undefined,
          avatar_url: res.user.avatar_url ? String(res.user.avatar_url) : undefined,
        },
        access_token,
        refresh_token,
        expires_in
      );

      router.push("/home");
    } catch (err: unknown) {
      if (err instanceof APIError) {
        if (err.status === 401) {
          setError("Invalid email or password. Please try again.");
        } else if (err.status === 403) {
          setError("Account suspended. Please contact support.");
        } else {
          setError(err.message || "Login failed. Please try again.");
        }
      } else if (err instanceof Error) {
        if (err.message.includes("fetch") || err.message.includes("network") || err.message.includes("connect")) {
          setError("Cannot reach server. Please check your connection.");
        } else {
          setError("Invalid email or password. Please try again.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-secondary-500 to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary-900">Welcome back</h1>
          <p className="text-slate-500 mt-1">Sign in to your patient portal</p>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            HIPAA Compliant
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Brain className="w-3.5 h-3.5 text-primary-500" />
            AI-Powered Support
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            End-to-End Encrypted
          </span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <a href="/forgot-password" className="text-xs text-secondary-600 hover:text-secondary-700 font-medium">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all pr-11"
                  placeholder="••••••••"
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                loading
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:from-secondary-600 hover:to-secondary-700 shadow-md hover:shadow-lg"
              )}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            New to 24Therapy?{" "}
            <a href="/signup" className="text-secondary-600 hover:text-secondary-700 font-medium">
              Contact your therapist for an invitation
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          <br />
          If you&apos;re in crisis, call{" "}
          <span className="text-red-600 font-semibold">988</span> (Suicide &amp; Crisis Lifeline).
        </p>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
