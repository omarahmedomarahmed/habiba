"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell, Search, Plus, ChevronDown, LogOut, User, Settings,
  Zap, Brain
} from "lucide-react";
import { useAuthStore, useUIStore } from "@/lib/store";
import { getInitials } from "@/lib/utils";
import { authAPI } from "@/lib/api";
import { useRouter } from "next/navigation";

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Welcome back" },
  "/patients": { title: "Patients", subtitle: "Manage your patient roster" },
  "/sessions": { title: "Sessions", subtitle: "Schedule and manage sessions" },
  "/notes": { title: "Notes & Reports", subtitle: "Clinical documentation" },
  "/assessments": { title: "Assessments", subtitle: "PHQ-9, GAD-7, PCL-5 and more" },
  "/radar": { title: "Radar", subtitle: "Real-time patient matching" },
  "/messages": { title: "Messages", subtitle: "Secure patient communication" },
  "/risk-monitor": { title: "Risk Monitor", subtitle: "Patient safety alerts" },
  "/analytics": { title: "Analytics", subtitle: "Practice intelligence" },
  "/ai-workspace": { title: "AI Workspace", subtitle: "Your private AI assistant" },
  "/billing": { title: "Billing", subtitle: "Revenue and payouts" },
  "/settings": { title: "Settings", subtitle: "Profile and preferences" },
  "/notifications": { title: "Notifications", subtitle: "Your alerts and updates" },
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const notificationCount = useUIStore((s) => s.notificationCount);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const basePath = "/" + pathname.split("/")[1];
  const pageInfo = PAGE_TITLES[basePath] || { title: "24Therapy" };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { /* silent */ }
    clearAuth();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-20">
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-slate-900 truncate">{pageInfo.title}</h1>
        {pageInfo.subtitle && (
          <p className="text-[11px] text-slate-400 hidden sm:block">{pageInfo.subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 px-3 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-500 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Search patients...</span>
          <kbd className="ml-2 text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400">⌘K</kbd>
        </button>

        {/* Quick Schedule */}
        <Link
          href="/sessions/new"
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 bg-secondary text-white rounded-lg text-xs font-medium hover:bg-secondary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule
        </Link>

        {/* Radar */}
        <Link
          href="/radar"
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 bg-accent/10 text-accent rounded-lg text-xs font-medium hover:bg-accent/20 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Radar
        </Link>

        {/* AI Workspace */}
        <Link
          href="/ai-workspace"
          className="h-8 w-8 flex items-center justify-center bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
          title="AI Workspace"
        >
          <Brain className="w-4 h-4 text-primary" />
        </Link>

        {/* Notifications */}
        <Link href="/notifications" className="relative h-8 w-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-4 h-4 text-slate-500" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 h-8 px-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold">
              {user ? getInitials(`${user.first_name} ${user.last_name}`) : "T"}
            </div>
            <span className="hidden sm:block text-xs font-medium text-slate-700">
              {user ? `Dr. ${user.last_name}` : "Therapist"}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-40 animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <Link href="/settings/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <User className="w-4 h-4 text-slate-400" />Profile
                </Link>
                <Link href="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <Settings className="w-4 h-4 text-slate-400" />Settings
                </Link>
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut className="w-4 h-4" />Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                autoFocus
                placeholder="Search patients, sessions, notes..."
                className="flex-1 text-sm outline-none text-slate-900 placeholder:text-slate-400"
                onKeyDown={(e) => e.key === "Escape" && setIsSearchOpen(false)}
              />
              <button onClick={() => setIsSearchOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">ESC</button>
            </div>
            <div className="p-3">
              <p className="text-xs text-slate-400 text-center py-6">Start typing to search...</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
