"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Brain, LayoutDashboard, Users, Calendar, FileText, BarChart2,
  Settings, CreditCard, Zap, ChevronLeft, ChevronRight,
  AlertTriangle, Activity, MessageSquare, ClipboardList, Bell,
  Target, Network, Workflow, Send, BarChart3, Stethoscope,
  BookMarked, Wrench, GitBranch, Shield, UserCog, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore, useUIStore } from "@/lib/store";
import { getInitials } from "@/lib/utils";
import { sessionsAPI } from "@/lib/api";

interface SessionUsage {
  plan_key: string;
  sessions_this_month: number;
  max_sessions_month: number | null;
  trial_session_used: boolean;
}

const NAV_ITEMS = [
  {
    section: "CORE",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/patients", icon: Users, label: "Patients" },
      { href: "/sessions", icon: Calendar, label: "Sessions" },
      { href: "/calendar", icon: Calendar, label: "Calendar" },
      { href: "/notes", icon: FileText, label: "Notes & Reports" },
    ],
  },
  {
    section: "CLINICAL",
    items: [
      { href: "/assessments", icon: ClipboardList, label: "Assessments" },
      { href: "/treatment-plans", icon: Target, label: "Treatment Plans" },
      { href: "/clinical-tools", icon: Stethoscope, label: "Clinical Tools" },
      { href: "/referrals", icon: Send, label: "Referrals" },
      { href: "/reports", icon: BarChart3, label: "Reports" },
      { href: "/risk-monitor", icon: AlertTriangle, label: "Risk Monitor", badge: "AI" },
      { href: "/radar", icon: Zap, label: "Radar", badge: "LIVE" },
      { href: "/messages", icon: MessageSquare, label: "Messages" },
    ],
  },
  {
    section: "INTELLIGENCE",
    items: [
      { href: "/memory", icon: Network, label: "Memory Layer" },
      { href: "/ai-workspace", icon: Brain, label: "AI Workspace" },
      { href: "/assistant", icon: Brain, label: "AI Assistant" },
    ],
  },
  {
    section: "PRACTICE",
    items: [
      { href: "/crm", icon: BookMarked, label: "CRM" },
      { href: "/analytics", icon: BarChart2, label: "Analytics" },
      { href: "/workflow", icon: GitBranch, label: "Workflows" },
      { href: "/billing", icon: CreditCard, label: "Billing" },
      { href: "/team", icon: UserCog, label: "Team" },
    ],
  },
  {
    section: "COMPLIANCE",
    items: [
      { href: "/audit-logs", icon: Shield, label: "Audit Logs" },
    ],
  },
];

const BOTTOM_ITEMS = [
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, notificationCount } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const [usage, setUsage] = useState<SessionUsage | null>(null);

  useEffect(() => {
    sessionsAPI.usage().then(setUsage).catch(() => {});
  }, []);

  const planLabel: Record<string, string> = {
    free_trial: 'Pay As You Go',
    pay_per_session: 'Pay As You Go',
    starter: 'Starter',
    pro: 'Unlimited',
    practice: 'Practice',
    enterprise: 'Enterprise',
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-30 bg-white border-r border-slate-200 shadow-sidebar",
        "flex flex-col transition-all duration-200",
        sidebarCollapsed ? "w-[60px]" : "w-[240px]"
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
            sidebarCollapsed && "mx-auto ml-auto"
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_ITEMS.map(({ section, items }) => (
          <div key={section}>
            {!sidebarCollapsed && (
              <div className="text-[10px] font-semibold text-slate-400 px-2 mb-1 tracking-wider">{section}</div>
            )}
            <ul className="space-y-0.5">
              {items.map(({ href, icon: Icon, label, badge }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "sidebar-item relative group",
                      isActive(href) && "active",
                      sidebarCollapsed && "justify-center px-0"
                    )}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && (
                      <>
                        <span>{label}</span>
                        {badge && (
                          <span className="ml-auto text-[10px] bg-accent text-white px-1.5 py-0.5 rounded font-bold">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                    {sidebarCollapsed && badge && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-accent rounded-full" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Session Usage Meter */}
      {usage && !sidebarCollapsed && (
        <div className="mx-2 mb-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {planLabel[usage.plan_key] || usage.plan_key}
            </span>
            <Link href="/billing" className="text-[10px] text-primary font-medium hover:underline">
              Upgrade
            </Link>
          </div>
          {usage.plan_key === 'free_trial' && (
            <div className={cn(
              "text-[11px] font-medium",
              usage.trial_session_used ? "text-red-600" : "text-green-600"
            )}>
              {usage.trial_session_used ? "Free session used" : "1 free session available"}
            </div>
          )}
          {usage.plan_key === 'pay_per_session' && (
            <div className="text-[11px] text-slate-600">$12 per session</div>
          )}
          {usage.max_sessions_month !== null && usage.plan_key !== 'free_trial' && (
            <>
              <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                <span>{usage.sessions_this_month}/{usage.max_sessions_month} sessions</span>
                <span className={cn(
                  usage.sessions_this_month >= usage.max_sessions_month ? "text-red-600 font-bold" :
                  usage.sessions_this_month >= usage.max_sessions_month - 2 ? "text-yellow-600 font-medium" : ""
                )}>
                  {usage.max_sessions_month - usage.sessions_this_month} left
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    usage.sessions_this_month >= usage.max_sessions_month ? "bg-red-500" :
                    usage.sessions_this_month >= usage.max_sessions_month * 0.8 ? "bg-yellow-500" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(100, (usage.sessions_this_month / usage.max_sessions_month) * 100)}%` }}
                />
              </div>
            </>
          )}
          {usage.max_sessions_month === null && usage.plan_key !== 'free_trial' && usage.plan_key !== 'pay_per_session' && (
            <div className="flex items-center gap-1 text-[11px] text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span>Unlimited sessions</span>
            </div>
          )}
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
        {!sidebarCollapsed && (
          <Activity className="w-3.5 h-3.5 text-green-500 shrink-0" />
        )}
      </div>
    </aside>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
