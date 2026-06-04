"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, Brain, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Features",
    href: "/features",
    children: [
      { label: "AI Scribe", href: "/ai-scribe", desc: "Auto-generate clinical notes from sessions" },
      { label: "Clinical Copilot", href: "/ai-scribe#copilot", desc: "Live session guidance & suggestions" },
      { label: "Patient Memory", href: "/ai-scribe#memory", desc: "Longitudinal patient intelligence" },
      { label: "Risk Detection", href: "/ai-scribe#risk", desc: "Real-time safety monitoring" },
      { label: "Telehealth", href: "/features/teletherapy", desc: "HIPAA-secure video sessions" },
      { label: "Practice Analytics", href: "/features/analytics", desc: "Revenue & outcome intelligence" },
    ],
  },
  {
    label: "For Therapists",
    href: "/for-therapists",
    children: [
      { label: "Solo Practitioners", href: "/for-therapists", desc: "Full AI suite for independent therapists" },
      { label: "Group Practices", href: "/for-therapists#practice", desc: "Multi-therapist management" },
      { label: "Clinics & Hospitals", href: "/for-therapists#enterprise", desc: "Enterprise & white-label solutions" },
      { label: "Apply as Therapist", href: "/therapist-join", desc: "Join the 24Therapy network" },
    ],
  },
  {
    label: "Radar",
    href: "/find-therapist",
    children: [
      { label: "Find a Therapist", href: "/find-therapist", desc: "AI-powered matching to your needs" },
      { label: "How Radar Works", href: "/find-therapist#how", desc: "Our intelligent matching system" },
      { label: "Urgent Support", href: "/find-therapist?urgency=now", desc: "Connect with a therapist today" },
    ],
  },
  {
    label: "Resources",
    href: "/blog",
    children: [
      { label: "Blog", href: "/blog", desc: "AI, clinical practice, and mental health technology" },
      { label: "Enterprise", href: "/enterprise", desc: "Group practices, clinics, and health systems" },
      { label: "Security & HIPAA", href: "/security", desc: "Compliance, encryption, and privacy" },
      { label: "About Us", href: "/about", desc: "Mission, team, and company story" },
    ],
  },
  { label: "Pricing", href: "/pricing" },
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
                  <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 animate-fade-in z-50">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex flex-col p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                        onClick={() => setActiveDropdown(null)}
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
              href="https://admin.24therapy.ai"
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5"
            >
              Admin
            </Link>
            <Link
              href="https://portal.24therapy.ai"
              className="text-sm font-medium text-slate-700 hover:text-[#1F5EFF] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/find-therapist"
              className="text-sm font-medium text-slate-700 hover:text-[#1F5EFF] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
            >
              Find Therapist
            </Link>
            <Link
              href="/signup?role=therapist"
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1F5EFF] hover:bg-[#0A2342] px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Start Free Trial
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
        <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-1 animate-fade-in">
          {navItems.map((item) => (
            <div key={item.label}>
              <Link
                href={item.href}
                className="block px-4 py-3 text-sm font-semibold text-slate-800 hover:text-[#1F5EFF] rounded-xl hover:bg-slate-50 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="ml-4 space-y-0.5">
                  {item.children.map(child => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-4 py-2 text-xs text-slate-600 hover:text-[#1F5EFF] rounded-xl hover:bg-slate-50"
                      onClick={() => setIsOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="pt-3 space-y-2 border-t border-slate-100">
            <Link
              href="/login"
              className="block px-4 py-3 text-sm font-medium text-slate-700 text-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/find-therapist"
              className="block px-4 py-3 text-sm font-medium text-slate-700 text-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Find a Therapist
            </Link>
            <Link
              href="/signup?role=therapist"
              className="block px-4 py-3 text-sm font-semibold text-white text-center bg-[#1F5EFF] rounded-xl hover:bg-[#0A2342] transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
