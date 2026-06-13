"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Brain, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AUTH_URLS } from "@/lib/domains";

const navItems = [
  {
    label: "Product",
    href: "/features",
    children: [
      { label: "AI Scribe", href: "/ai-scribe", desc: "Auto-generate SOAP/DAP/BIRP notes in seconds" },
      { label: "Clinical Copilot", href: "/features/ai-copilot", desc: "Live session guidance & risk detection" },
      { label: "Radar Matching", href: "/features/radar-matching", desc: "Connect patients to therapists in < 5 min" },
      { label: "Patient Memory", href: "/features/memory-layer", desc: "Longitudinal AI knowledge graph" },
      { label: "Assessments", href: "/features/assessments", desc: "PHQ-9, GAD-7, PCL-5 & custom tools" },
      { label: "Smart Scheduling", href: "/features/smart-scheduling", desc: "Zero-friction patient booking" },
      { label: "Analytics", href: "/features/analytics", desc: "Revenue & outcome intelligence" },
      { label: "Integrations", href: "/features/integrations", desc: "EHR, calendar, billing connections" },
    ],
  },
  {
    label: "Solutions",
    href: "/for-therapists",
    children: [
      { label: "For Therapists", href: "/for-therapists", desc: "AI tools for solo & group practices" },
      { label: "For Enterprises", href: "/enterprise", desc: "Clinics, hospitals & health systems" },
      { label: "Find a Therapist", href: "/find-therapist", desc: "AI-powered patient matching" },
    ],
  },
  { label: "Pricing", href: "/pricing" },
  {
    label: "Resources",
    href: "/blog",
    children: [
      { label: "Docs", href: "/docs", desc: "Guides, API reference & integration setup" },
      { label: "Blog", href: "/blog", desc: "AI, clinical practice & mental health tech" },
      { label: "Security & HIPAA", href: "/hipaa", desc: "Compliance, encryption & privacy" },
      { label: "About Us", href: "/about", desc: "Mission, team & company story" },
      { label: "Book a Demo", href: "/demo", desc: "30-minute personalized walkthrough" },
    ],
  },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-white shadow-md border-b border-slate-100"
          : "bg-white/95 backdrop-blur-md border-b border-slate-100"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-[#0A2342] leading-none">24Therapy</span>
              <span className="text-[#1F5EFF] font-bold text-lg">.ai</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5">
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
                  {item.children && (
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 transition-transform duration-150",
                        activeDropdown === item.label ? "rotate-180" : ""
                      )}
                    />
                  )}
                </Link>

                {item.children && activeDropdown === item.label && (
                  <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="flex flex-col p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                        onClick={() => setActiveDropdown(null)}
                      >
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-[#1F5EFF] transition-colors">
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
          <div className="hidden lg:flex items-center gap-2">
            <a
              href={AUTH_URLS.therapistLogin}
              className="text-sm font-medium text-slate-600 hover:text-[#1F5EFF] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Log in
            </a>
            <Link
              href="/chat"
              className="text-sm font-medium text-slate-700 hover:text-[#1F5EFF] px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 hover:border-[#1F5EFF]/30"
            >
              Try AI Free
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1F5EFF] hover:bg-[#0A2342] px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Get Started Free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-1 shadow-lg">
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
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className="block px-4 py-2 text-xs text-slate-600 hover:text-[#1F5EFF] rounded-xl hover:bg-slate-50 transition-colors"
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
            <a
              href={AUTH_URLS.therapistLogin}
              className="block px-4 py-3 text-sm font-medium text-slate-700 text-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Log in
            </a>
            <Link
              href="/chat"
              className="block px-4 py-3 text-sm font-medium text-slate-700 text-center rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Try AI Free
            </Link>
            <Link
              href="/signup"
              className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-white bg-[#1F5EFF] rounded-xl hover:bg-[#0A2342] transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Sparkles className="w-4 h-4" />
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
