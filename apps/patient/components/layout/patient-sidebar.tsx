"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Calendar, ClipboardList, MessageCircle,
  TrendingUp, BookOpen, Settings, Heart, Bell, LogOut, Menu, X,
  Smile, BookOpenCheck, Brain, Phone, Activity, CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import { getInitials } from "@/lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/home", icon: Home, label: "Home" },
  { href: "/appointments", icon: Calendar, label: "Appointments" },
  { href: "/mood", icon: Smile, label: "Mood Tracker" },
  { href: "/journal", icon: BookOpenCheck, label: "Journal" },
  { href: "/progress", icon: TrendingUp, label: "My Progress" },
  { href: "/assessments", icon: ClipboardList, label: "Assessments" },
  { href: "/ai-companion", icon: Brain, label: "AI Companion" },
  { href: "/messages", icon: MessageCircle, label: "Messages" },
  { href: "/resources", icon: BookOpen, label: "Resources" },
  { href: "/sessions", icon: Activity, label: "Sessions" },
  { href: "/reports", icon: ClipboardList, label: "My Reports" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/billing", icon: CreditCard, label: "Billing" },
  { href: "/crisis", icon: Phone, label: "Crisis Support", urgent: true },
];

export function PatientSidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname.startsWith(href);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-9 h-9 bg-gradient-to-br from-[#0A2342] to-[#2F80ED] rounded-xl flex items-center justify-center">
          <Heart className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
        </div>
        <div>
          <div className="font-bold text-[#0A2342] text-sm">24Therapy</div>
          <div className="text-[10px] text-slate-400 font-medium">Patient Portal</div>
        </div>
        <button
          className="ml-auto md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Patient card */}
      {user && (
        <div className="mx-3 my-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A2342] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {getInitials(`${user.first_name} ${user.last_name}`)}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user.first_name} {user.last_name}
              </p>
              {user.therapist_name && (
                <p className="text-[10px] text-slate-500 truncate">Dr. {user.therapist_name}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div className="h-full w-[65%] bg-[#0A2342] rounded-full" />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">65% goals</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-[#0A2342] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
            {item.href === "/ai-companion" && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
            {(item as { urgent?: boolean }).urgent && (
              <span className="ml-auto text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">SOS</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Crisis Line */}
      <div className="mx-3 mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="h-3 w-3 text-rose-600" />
          <p className="text-xs font-semibold text-rose-700">Crisis Support</p>
        </div>
        <p className="text-xs text-rose-600">Call or text <strong>988</strong></p>
        <p className="text-xs text-rose-600">Text HOME to <strong>741741</strong></p>
      </div>

      {/* Bottom */}
      <div className="border-t border-slate-100 px-3 py-2 space-y-0.5">
        <Link href="/settings" onClick={() => setMobileOpen(false)}
          className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", isActive("/settings") ? "bg-[#0A2342] text-white" : "text-slate-600 hover:bg-slate-100")}>
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <button
          onClick={clearAuth}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-slate-600 hover:bg-red-50 hover:text-red-600 w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-4 h-4 text-slate-600" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={cn(
        "md:hidden fixed left-0 top-0 bottom-0 z-50 w-[260px] bg-white border-r border-slate-200 shadow-xl transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-white border-r border-slate-200 z-30">
        <SidebarContent />
      </aside>
    </>
  );
}
