"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Brain, LayoutDashboard, Users, FileText,
  Settings, CreditCard, MessageSquare, Bell, Calendar,
  ChevronLeft, ChevronRight, Activity, ArrowRight, Zap, Link2, Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useUIStore } from "@/lib/store";
import { getInitials } from "@/lib/utils";
import { sessionsAPI } from "@/lib/api";
import { hasTier, FEATURE_MIN_TIER, type Tier } from "@/lib/tiers";

interface SessionUsage {
  plan_key: string;
  sessions_this_month: number;
  max_sessions_month: number | null;
  trial_session_used: boolean;
}

const NAV_ITEMS = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { href: "/sessions",   icon: Calendar,         label: "Sessions" },
  { href: "/patients",   icon: Users,            label: "Patients" },
  { href: "/notes",      icon: FileText,         label: "Notes" },
  { href: "/messages",   icon: MessageSquare,    label: "Messages" },
];

const BOTTOM_ITEMS = [
  { href: "/billing",       icon: CreditCard, label: "Billing" },
  { href: "/notifications", icon: Bell,       label: "Notifications" },
  { href: "/settings",      icon: Settings,   label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, notificationCount } = useUIStore();
  const subscriptionTier = useUIStore((s) => s.subscriptionTier);
  const user = useAuthStore((s) => s.user);
  const [usage, setUsage] = useState<SessionUsage | null>(null);

  // Locked until proven otherwise once the tier is known; null (loading) = unlocked.
  const isLocked = (feature: string) => {
    const required = FEATURE_MIN_TIER[feature];
    if (!required || subscriptionTier === null) return false;
    return !hasTier(subscriptionTier as Tier, required);
  };

  useEffect(() => {
    sessionsAPI.usage().then(setUsage).catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const planBadge = () => {
    if (!usage) return null;
    const key = usage.plan_key;
    if (key === "pay_per_session" || key === "free_trial") {
      if (!usage.trial_session_used) return { label: "1 FREE session", color: "bg-green-100 text-green-700" };
      return { label: "$6 / session", color: "bg-slate-100 text-slate-600" };
    }
    if (key === "starter") return { label: "Starter", color: "bg-blue-100 text-blue-700" };
    if (key === "pro")     return { label: "Unlimited", color: "bg-purple-100 text-purple-700" };
    if (key === "practice") return { label: "Practice", color: "bg-teal-100 text-teal-700" };
    if (key === "enterprise") return { label: "Enterprise", color: "bg-slate-100 text-slate-600" };
    return null;  // unknown or null plan — show nothing instead of "Enterprise"
  };

  const badge = planBadge();
  const isPAYG = usage && (usage.plan_key === "pay_per_session" || usage.plan_key === "free_trial");
  const showUpgrade = isPAYG;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-30 bg-white border-r border-slate-200 shadow-sidebar",
        "flex flex-col transition-all duration-200",
        sidebarCollapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-slate-100 shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
          <Brain className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        {!sidebarCollapsed && (
          <div className="ml-2.5 overflow-hidden">
            <div className="font-bold text-primary text-sm leading-tight">24Therapy</div>
            <div className="text-[10px] text-slate-400 font-medium">Therapist Portal</div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "ml-auto w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors",
            sidebarCollapsed && "mx-auto"
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "sidebar-item relative",
                  isActive(href) && "active",
                  sidebarCollapsed && "justify-center px-0"
                )}
                title={sidebarCollapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{label}</span>}
              </Link>
            </li>
          ))}
        </ul>

        {/* More section — collapsed into an expandable if needed */}
        {!sidebarCollapsed && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold text-slate-400 px-2 mb-1 tracking-wider">ADVANCED</div>
            <ul className="space-y-0.5">
              {[
                { href: "/analytics",      icon: Activity, label: "Analytics",    feature: "analytics" },
                { href: "/radar",          icon: Zap,      label: "Radar", badge: "LIVE", feature: "radar" },
                { href: "/ai-workspace",   icon: Brain,    label: "AI Workspace", feature: "ai-workspace" },
                { href: "/booking",        icon: Link2,    label: "Booking",      feature: "booking" },
              ].map(({ href, icon: Icon, label, badge, feature }) => {
                const locked = isLocked(feature);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={cn("sidebar-item", isActive(href) && "active", locked && "opacity-60")}
                      title={locked ? `${label} — upgrade to unlock` : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{label}</span>
                      {locked ? (
                        <Lock className="ml-auto w-3.5 h-3.5 text-slate-400" />
                      ) : badge ? (
                        <span className="ml-auto text-[10px] bg-accent text-white px-1.5 py-0.5 rounded font-bold">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Upgrade nudge for PAYG users */}
      {showUpgrade && !sidebarCollapsed && (
        <div className="mx-2 mb-2 p-3 rounded-xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white">
          <div className="text-[11px] font-bold mb-0.5">
            {!usage?.trial_session_used ? "🎁 First session free" : "Save 50% on sessions"}
          </div>
          <div className="text-[10px] text-white/70 mb-2">
            {!usage?.trial_session_used
              ? "Then $6/session. Upgrade for unlimited."
              : "Starter plan: 20 sessions for $59/mo"}
          </div>
          <Link
            href="/billing"
            className="flex items-center gap-1 text-[11px] font-semibold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
          >
            View plans <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Plan badge */}
      {badge && !sidebarCollapsed && (
        <div className="mx-2 mb-2">
          <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-full", badge.color)}>
            {badge.label}
          </span>
        </div>
      )}

      {/* Bottom items */}
      <div className="border-t border-slate-100 px-2 py-2 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "sidebar-item relative",
              isActive(href) && "active",
              sidebarCollapsed && "justify-center px-0"
            )}
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>{label}</span>}
            {href === "/notifications" && notificationCount > 0 && (
              <span className={cn(
                "bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center",
                sidebarCollapsed ? "absolute top-0.5 right-0.5 w-4 h-4" : "ml-auto w-5 h-5"
              )}>
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* User Profile */}
      <div className={cn(
        "border-t border-slate-100 p-2 flex items-center gap-2",
        sidebarCollapsed && "justify-center"
      )}>
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
          {user ? getInitials(`${user.first_name} ${user.last_name}`) : "T"}
        </div>
        {!sidebarCollapsed && user && (
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-slate-800 truncate">
              {user.first_name} {user.last_name}
            </div>
            <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
          </div>
        )}
      </div>
    </aside>
  );
}
