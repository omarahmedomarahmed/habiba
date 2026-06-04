"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Eye, EyeOff, Heart, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PatientLoginPage() {
  const router = useRouter();
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
      await new Promise((r) => setTimeout(r, 800));
      router.push("/home");
    } catch {
      setError("Invalid email or password. Please try again.");
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:border-transparent transition-all"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <a href="#" className="text-xs text-secondary-600 hover:text-secondary-700 font-medium">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                loading
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-secondary-500 to-secondary-600 text-white hover:from-secondary-600 hover:to-secondary-700 shadow-md hover:shadow-lg"
              )}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            New to 24Therapy?{" "}
            <a href="#" className="text-secondary-600 hover:text-secondary-700 font-medium">
              Contact your therapist for an invitation
            </a>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
          <br />
          If you&apos;re in crisis, call{" "}
          <span className="text-red-600 font-semibold">988</span> (Suicide & Crisis Lifeline).
        </p>
      </div>
    </div>
  );
}
