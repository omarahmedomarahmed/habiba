"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Brain, ArrowRight, Shield, Zap } from "lucide-react";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { DOMAINS } from "@/lib/domains";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // authAPI.login returns { user, tokens: { access_token, refresh_token, expires_in } }
      const res = await authAPI.login(email, password);

      // Validate therapist role
      const userRole = String((res.user as Record<string, unknown>)?.role ?? "");
      if (!["therapist", "org_admin"].includes(userRole)) {
        setError("Access denied: Therapist credentials required.");
        return;
      }

      const { access_token, refresh_token } = res.tokens;

      // Persist tokens to localStorage for API client access
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token || "");
      }

      // Update Zustand auth store
      const u = res.user as Record<string, unknown>;
      const org = res.organization as Record<string, unknown> | undefined;
      setAuth(
        {
          id: String(u.id ?? ""),
          email: String(u.email ?? ""),
          first_name: String(u.first_name ?? ""),
          last_name: String(u.last_name ?? ""),
          role: String(u.role ?? ""),
          avatar_url: u.avatar_url ? String(u.avatar_url) : undefined,
          organization_id: String(u.organization_id ?? ""),
          organization_name: org?.name ? String(org.name) : undefined,
          therapist_id: u.therapist_id ? String(u.therapist_id) : undefined,
        },
        access_token,
        refresh_token || ""
      );

      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("401")) {
          setError("Invalid email or password. Please try again.");
        } else if (msg.includes("suspended") || msg.includes("locked")) {
          setError("Account is suspended. Please contact support.");
        } else if (msg.includes("connect") || msg.includes("network") || msg.includes("fetch")) {
          setError("Cannot reach server. Please check your connection.");
        } else {
          setError(err.message || "Login failed. Please try again.");
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/95 to-secondary/80 flex">
      {/* Left — Brand */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold">24Therapy</span>
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full ml-1">Therapist</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Your AI-Powered<br />Clinical Co-Pilot
            </h1>
            <p className="text-white/70 text-lg">
              Reduce documentation time by 80%. Focus on what matters — your patients.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: Zap, title: "SOAP Notes in 30 seconds", desc: "AI generates clinical notes while you focus on the session" },
              { icon: Brain, title: "Longitudinal Patient Memory", desc: "AI remembers everything across all sessions, every patient" },
              { icon: Shield, title: "HIPAA Compliant", desc: "Enterprise-grade security with full audit trails" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 items-start">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="font-medium text-sm">{title}</div>
                  <div className="text-white/60 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-white/40 text-xs">
          © 2025 24Therapy.ai · HIPAA Compliant · SOC 2 Type II
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white lg:rounded-l-3xl">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-primary">24Therapy</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your therapist portal</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
                placeholder="dr.smith@clinic.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 px-3 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300" />
                <span className="text-sm text-slate-600">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-secondary hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href={`${DOMAINS.web}/signup?role=therapist`} className="text-secondary hover:underline font-medium">
              Apply to join
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline">Terms</Link> and{" "}
              <Link href="/privacy" className="underline">Privacy Policy</Link>.
              This platform handles Protected Health Information (PHI).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
