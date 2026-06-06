'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Zap, Eye, EyeOff, AlertCircle, Lock } from 'lucide-react';
import { useAdminAuth } from '@/lib/store';
import { authAPI, APIError } from '@/lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await authAPI.login(email, password, showMfa ? mfaCode : undefined);

      // Validate admin role
      if (!data.user || !['super_admin', 'admin', 'org_admin'].includes(data.user.role)) {
        setError('Unauthorized: Admin access only.');
        return;
      }

      const userName =
        data.user.first_name && data.user.last_name
          ? `${data.user.first_name} ${data.user.last_name}`
          : data.user.email;

      login(
        {
          id: data.user.id,
          email: data.user.email,
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          name: userName,
          role: data.user.role,
          organization_id: data.user.organization_id,
        },
        data.tokens.access_token,
        data.tokens.refresh_token,
        data.tokens.expires_in
      );

      router.push('/dashboard');
    } catch (err: any) {
      if (err instanceof APIError) {
        if (err.status === 401) {
          const msg = err.message?.toLowerCase() || '';
          if (msg.includes('mfa') || msg.includes('two-factor') || msg.includes('otp')) {
            setShowMfa(true);
            setError('Please enter your MFA code.');
          } else {
            setError('Invalid credentials. Please try again.');
          }
        } else if (err.status === 403) {
          setError('Account suspended. Contact support.');
        } else {
          setError(err.message || 'Login failed. Please try again.');
        }
      } else {
        // Network error or backend down
        setError(
          'Cannot connect to server. Please check your connection or try again later.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 mb-4 shadow-2xl shadow-red-500/25">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-sm text-gray-400 mt-1">24Therapy Mental Health OS — Platform Operations</p>
        </div>

        {/* Security Notice */}
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-300">
            Restricted access. All sessions are monitored and logged for compliance.
          </p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Admin Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@24therapy.com"
                required
                autoComplete="email"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showMfa && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  MFA Code
                </label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all text-center tracking-widest text-lg"
                />
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Secure Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Shield className="w-3 h-3" />
            <span>HIPAA Compliant</span>
          </div>
          <span className="text-gray-700">·</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Shield className="w-3 h-3" />
            <span>SOC 2 Type II</span>
          </div>
          <span className="text-gray-700">·</span>
          <span className="text-xs text-gray-600">HITECH</span>
        </div>
      </div>
    </div>
  );
}
