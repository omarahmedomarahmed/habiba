"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, Shield, LayoutGrid,
  X, BarChart3, Settings, AlertTriangle
} from "lucide-react";

const PRIMARY_TABS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Users", icon: Users, href: "/users" },
  { label: "Orgs", icon: Building2, href: "/organizations" },
  { label: "Safety", icon: Shield, href: "/compliance" },
  { label: "More", icon: LayoutGrid, href: null },
];

const MORE_ITEMS = [
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Crisis Alerts", icon: AlertTriangle, href: "/crisis" },
  { label: "Audit Logs", icon: Shield, href: "/audit-logs" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function AdminBottomNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  const isActive = (href: string | null) => {
    if (!href) return showMore;
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
        <div className="fixed bottom-[64px] left-0 right-0 bg-[#0A2342] rounded-t-3xl border-t border-white/10 z-50 md:hidden p-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-white">More</span>
            <button onClick={() => setShowMore(false)} className="p-1 text-white/40">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setShowMore(false)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/10"
              >
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-white/70" />
                </div>
                <span className="text-[10px] text-center leading-tight text-white/60">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A2342] border-t border-white/10 md:hidden">
        <div className="flex items-center justify-around px-2 py-1">
          {PRIMARY_TABS.map((tab) => {
            const active = isActive(tab.href);
            if (!tab.href) {
              return (
                <button
                  key="more"
                  onClick={() => setShowMore(!showMore)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] ${
                    showMore ? "text-[#2EC4B6]" : "text-white/60"
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
                className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[56px] transition-colors ${
                  active ? "text-[#2EC4B6]" : "text-white/60"
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
