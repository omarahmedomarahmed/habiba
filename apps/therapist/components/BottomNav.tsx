"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Calendar, LayoutGrid,
  FileText, Target, Brain, Settings, BarChart3,
  CreditCard, Bell, Zap, ShieldAlert, X
} from "lucide-react";

// MVP mobile nav — the therapist product is phone-first (docs/PRODUCT_MVP.md)
const PRIMARY_TABS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Sessions", icon: Calendar, href: "/sessions" },
  { label: "Patients", icon: Users, href: "/patients" },
  { label: "Notes", icon: FileText, href: "/notes" },
  { label: "More", icon: LayoutGrid, href: null },
];

const MORE_ITEMS = [
  { label: "Treatment Plans", icon: Target, href: "/treatment-plans" },
  { label: "AI Workspace", icon: Brain, href: "/ai-workspace" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Radar", icon: Zap, href: "/radar" },
  { label: "Risk Monitor", icon: ShieldAlert, href: "/risk-monitor" },
  { label: "Billing", icon: CreditCard, href: "/billing" },
  { label: "Notifications", icon: Bell, href: "/notifications" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function TherapistBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string | null) => {
    if (!href) return false;
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {showMore && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {showMore && (
        <div className="fixed bottom-[64px] left-0 right-0 bg-white rounded-t-3xl border-t border-slate-200 z-50 md:hidden p-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-slate-900">More</span>
            <button onClick={() => setShowMore(false)} className="p-1 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-50"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-slate-600" />
                </div>
                <span className="text-[10px] text-center leading-tight text-slate-600">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 md:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {PRIMARY_TABS.map((tab) => {
            const active = tab.href ? isActive(tab.href) : showMore;
            if (!tab.href) {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] ${
                    showMore ? "text-[#1F5EFF]" : "text-slate-500"
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setShowMore(false)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl min-w-[56px] transition-colors ${
                  active ? "text-[#1F5EFF]" : "text-slate-500"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
