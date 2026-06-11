"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PatientSidebar } from "@/components/layout/patient-sidebar";
import { useAuthStore } from "@/lib/store";
import { authAPI, clearStoredTokens } from "@/lib/api";
import { getSocket, disconnectSocket } from "@/lib/socket";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const ABSOLUTE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hr

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, expiresAt, clearAuth } = useAuthStore();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [crisisBanner, setCrisisBanner] = useState<{ conversationId: string | null; message: string } | null>(null);
  const idleRef = useRef<NodeJS.Timeout | null>(null);
  const warnRef = useRef<NodeJS.Timeout | null>(null);
  const absRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* empty */ }
    clearAuth();
    clearStoredTokens();
    router.push("/login");
  }, [clearAuth, router]);

  const resetIdleTimer = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    if (warnRef.current) clearTimeout(warnRef.current);
    setShowWarning(false);
    warnRef.current = setTimeout(() => { setShowWarning(true); setCountdown(300); }, IDLE_TIMEOUT_MS - 5 * 60 * 1000);
    idleRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) { router.push("/login"); return; }

    // Check token expiry
    if (expiresAt && Date.now() > expiresAt) {
      authAPI.me().catch(() => { clearAuth(); router.push("/login"); });
    }

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    absRef.current = setTimeout(handleLogout, ABSOLUTE_TIMEOUT_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleRef.current) clearTimeout(idleRef.current);
      if (warnRef.current) clearTimeout(warnRef.current);
      if (absRef.current) clearTimeout(absRef.current);
    };
  }, [isAuthenticated, expiresAt, resetIdleTimer, handleLogout, clearAuth, router]);

  useEffect(() => {
    if (!showWarning) return;
    const interval = setInterval(() => {
      setCountdown((prev) => { if (prev <= 1) { handleLogout(); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning, handleLogout]);

  useEffect(() => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    const handler = (payload: { conversation_id: string | null; message: string }) => {
      setCrisisBanner({ conversationId: payload.conversation_id, message: payload.message });
    };
    socket.on('crisis_support', handler);
    return () => { socket.off('crisis_support', handler); };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-secondary-500/30 border-t-secondary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <PatientSidebar />
      <main className="flex-1 md:ml-[240px] overflow-hidden">
        {crisisBanner && (
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-medium">{crisisBanner.message}</p>
            <div className="flex items-center gap-3 shrink-0">
              {crisisBanner.conversationId && (
                <a
                  href={`/messages?conversation=${crisisBanner.conversationId}&priority=crisis`}
                  className="text-xs font-bold bg-white text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Open Chat
                </a>
              )}
              <a href="/crisis" className="text-xs underline text-blue-100 hover:text-white">Resources</a>
              <button onClick={() => setCrisisBanner(null)} className="text-blue-200 hover:text-white text-lg leading-none">&times;</button>
            </div>
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Session Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Session Expiring</h3>
              <p className="text-slate-500 text-sm mb-4">
                Your session expires in{" "}
                <span className="text-yellow-600 font-bold">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={resetIdleTimer}
                  className="flex-1 h-10 bg-secondary-500 hover:bg-secondary-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Stay Signed In
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
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
