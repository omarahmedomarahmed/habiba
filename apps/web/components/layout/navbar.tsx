"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Features",
    href: "/features",
    children: [
      { label: "AI Scribe", href: "/features/ai-scribe", desc: "Auto-generate clinical notes" },
      { label: "Clinical Copilot", href: "/features/clinical-copilot", desc: "Live session guidance" },
      { label: "Radar Matching", href: "/features/radar", desc: "Instant therapist matching" },
      { label: "Telehealth", href: "/features/teletherapy", desc: "Secure video sessions" },
      { label: "Practice Management", href: "/features/practice-management", desc: "Multi-therapist practices" },
      { label: "Analytics", href: "/features/analytics", desc: "Outcome intelligence" },
    ],
  },
  {
    label: "Solutions",
    href: "/solutions",
    children: [
      { label: "For Therapists", href: "/solutions/therapists", desc: "Solo practitioners" },
      { label: "For Practices", href: "/solutions/practices", desc: "Group practices" },
      { label: "For Clinics", href: "/solutions/clinics", desc: "Mental health clinics" },
      { label: "For Enterprise", href: "/solutions/enterprise", desc: "Hospitals & universities" },
    ],
  },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-[#0A2342] leading-none">24Therapy</span>
              <span className="text-[#1F5EFF] font-bold text-lg">.ai</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={() => item.children && setActiveDropdown(item.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-700 hover:text-[#1F5EFF] rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {item.label}
                  {item.children && <ChevronDown className="w-3 h-3" />}
                </Link>

                {item.children && activeDropdown === item.label && (
                  <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 animate-fade-in">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex flex-col p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                      >
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-[#1F5EFF]">
                          {child.label}
                        </span>
                        <span className="text-xs text-slate-500 mt-0.5">{child.desc}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-[#1F5EFF] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold text-white bg-[#1F5EFF] hover:bg-[#0A2342] px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-2 animate-fade-in">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block px-4 py-3 text-sm font-medium text-slate-700 hover:text-[#1F5EFF] rounded-xl hover:bg-slate-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-2 space-y-2">
            <Link
              href="/login"
              className="block px-4 py-3 text-sm font-medium text-slate-700 text-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="block px-4 py-3 text-sm font-semibold text-white text-center bg-[#1F5EFF] rounded-xl hover:bg-[#0A2342] transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
