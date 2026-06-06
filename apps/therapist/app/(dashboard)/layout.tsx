"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authAPI } from "@/lib/api";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useUIStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
const ABSOLUTE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hr

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const expiresAt = useAuthStore((s) => s.expiresAt);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const idleRef = useRef<NodeJS.Timeout | null>(null);
  const warnRef = useRef<NodeJS.Timeout | null>(null);
  const absRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(async () => {
    try { await authAPI.logout(); } catch { /* empty */ }
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    }
    clearAuth();
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

    // Refresh token if near expiry
    if (expiresAt && Date.now() > expiresAt - 60000) {
      authAPI.refresh().catch(() => { clearAuth(); router.push("/login"); });
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

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0 transition-all duration-200",
          sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"
        )}
      >
        <Header />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Session Timeout Warning */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Session Expiring</h3>
              <p className="text-slate-500 text-sm mb-4">
                Session expires in{" "}
                <span className="font-bold text-yellow-600">
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </p>
              <div className="flex gap-3">
                <button onClick={resetIdleTimer} className="flex-1 h-10 bg-secondary text-white text-sm font-medium rounded-lg">Stay Signed In</button>
                <button onClick={handleLogout} className="flex-1 h-10 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
