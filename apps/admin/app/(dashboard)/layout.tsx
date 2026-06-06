'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/layout/admin-sidebar';
import { useAdminAuth } from '@/lib/store';
import { authAPI } from '@/lib/api';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const WARNING_BEFORE_MS = 5 * 60 * 1000; // warn 5 min before idle expiry

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, expiresAt, logout, updateTokens } = useAdminAuth();
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(300);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const absoluteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const handleLogout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* empty */ }
    logout();
    router.push('/login');
  }, [logout, router]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowTimeoutWarning(false);

    // Show warning 5 min before idle timeout
    warningTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
      setTimeoutCountdown(300);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Auto-logout on idle timeout
    idleTimerRef.current = setTimeout(() => {
      handleLogout();
    }, IDLE_TIMEOUT_MS);
  }, [handleLogout]);

  // Setup idle detection
  useEffect(() => {
    if (!isAuthenticated) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    // Absolute session timeout
    absoluteTimerRef.current = setTimeout(() => {
      handleLogout();
    }, ABSOLUTE_TIMEOUT_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current);
    };
  }, [isAuthenticated, resetIdleTimer, handleLogout]);

  // Countdown timer when warning shown
  useEffect(() => {
    if (!showTimeoutWarning) return;
    const interval = setInterval(() => {
      setTimeoutCountdown((prev) => {
        if (prev <= 1) { handleLogout(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showTimeoutWarning, handleLogout]);

  // Check token expiry on mount
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (expiresAt && Date.now() > expiresAt) {
      // Token expired — try to refresh
      authAPI.refresh().then((newToken) => {
        if (!newToken) {
          logout();
          router.push('/login');
        }
      });
    }
  }, [isAuthenticated, expiresAt, logout, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 ml-64 overflow-y-auto bg-gray-950">
        {children}
      </main>

      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Session Expiring</h3>
              <p className="text-gray-400 text-sm mb-4">
                Your session will expire due to inactivity in{' '}
                <span className="text-yellow-400 font-bold">{Math.floor(timeoutCountdown / 60)}:{String(timeoutCountdown % 60).padStart(2, '0')}</span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={resetIdleTimer}
                  className="flex-1 h-10 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Stay Signed In
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 h-10 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
