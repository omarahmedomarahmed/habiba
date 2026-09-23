"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { ArrowLeft, ArrowRight, Menu, Phone, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { spring } from "../../_ds/motion";
import { Btn } from "../../_ds/ui";

export const SITE = [
  { href: "/design/website", label: "Home" },
  { href: "/design/website/patients", label: "For you" },
  { href: "/design/website/therapists", label: "Therapists" },
  { href: "/design/website/clinics", label: "Clinics" },
  { href: "/design/website/companies", label: "Companies" },
  { href: "/design/website/partners", label: "Partners" },
] as const;

/**
 * The site's own bar. Clear over a dark hero, solid once you scroll, and the
 * selection is the same sliding pill as everywhere else. A small pill on the
 * left goes back to all the design samples, since this lives under /design.
 */
export function SiteNav() {
  const path = usePathname();
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 24));

  return (
    <>
      <motion.header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
          solid ? "bg-navy-900/85 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/design"
            className="hidden items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-[12px] font-semibold text-white/70 ring-1 ring-white/10 hover:text-white md:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Samples
          </Link>
          <Link href="/design/website" className="text-[22px] font-black tracking-tight text-white">
            24<span className="text-brand-400">Therapy</span>
          </Link>
          <nav className="ms-6 hidden items-center gap-1 lg:flex">
            {SITE.slice(1).map((item) => {
              const on = path === item.href;
              return (
                <Link key={item.href} href={item.href} className={cn("relative rounded-full px-3.5 py-2 text-[14px] font-semibold", on ? "text-navy-700" : "text-white/75 hover:text-white")}>
                  {on ? <motion.span layoutId="site-nav" transition={spring} className="absolute inset-0 rounded-full bg-brand-500" /> : null}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
            <a href="/design/website#pricing" className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-white/75 hover:text-white">
              Pricing
            </a>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden text-[14px] font-semibold text-white/75 sm:inline">العربية</span>
            <Btn className="hidden h-10 px-4 text-[14px] sm:inline-flex">
              Find someone now <ArrowRight className="h-4 w-4" aria-hidden />
            </Btn>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Menu"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[60] bg-navy-900/98 backdrop-blur-xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex h-16 items-center justify-between px-4">
              <span className="text-[22px] font-black text-white">
                24<span className="text-brand-400">Therapy</span>
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <motion.ul initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }} className="px-6 pt-6">
              {[...SITE, { href: "/design/website#pricing", label: "Pricing" }, { href: "/design", label: "All design samples" }].map((item) => (
                <motion.li key={item.href} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn("block border-b border-white/10 py-4 text-[26px] font-bold", path === item.href ? "text-brand-400" : "text-white")}
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </motion.ul>
            <div className="px-6 pt-8">
              <Btn className="w-full">Find someone now</Btn>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={cn("text-[13px] font-bold uppercase tracking-[0.2em]", dark ? "text-brand-300" : "text-brand-700")}>{children}</p>;
}

export function Title({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <h2 className={cn("mt-3 text-balance text-[34px] font-bold leading-[1.08] tracking-tight sm:text-[48px]", dark ? "text-white" : "text-navy-700", className)}>
      {children}
    </h2>
  );
}

export function Lede({ children, dark = false, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={cn("mt-4 max-w-2xl text-pretty text-[17px] leading-relaxed sm:text-[18px]", dark ? "text-white/70" : "text-navy-500", className)}>{children}</p>;
}

/** A dark band with a faint grid and a slow teal light, the ground most sections now stand on. */
export function Dark({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("relative overflow-hidden bg-navy-900 text-white", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 75%)" }}
      />
      {children}
    </section>
  );
}

export function CrisisStrip() {
  return (
    <section className="bg-red-600">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-5 text-white">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
          <Phone className="h-5 w-5" aria-hidden />
        </span>
        <p className="flex-1 text-[16px] font-semibold sm:text-[17px]">
          In danger right now? Do not wait for a session. In Egypt call <span className="font-black">105</span>, press 1 for Arabic, then 1. Ambulance{" "}
          <span className="font-black">123</span>.
        </p>
        <a href="tel:105" className="rounded-full bg-white px-5 py-2.5 text-[15px] font-bold text-red-700">
          Call 105
        </a>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const cols = [
    { title: "Product", links: ["Find someone now", "How it works", "Pricing", "Security", "Status"] },
    { title: "For", links: ["Patients", "Therapists", "Clinics", "Companies", "Partners"] },
    { title: "Company", links: ["About", "Careers", "Contact", "Press"] },
    { title: "Legal", links: ["Privacy", "Terms", "Data processing", "Subprocessors"] },
  ];
  return (
    <footer className="relative overflow-hidden bg-navy-900 text-white">
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <p className="text-[28px] font-black tracking-tight">
              24<span className="text-brand-400">Therapy</span>
            </p>
            <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/60">Therapy that starts when you need it, in Arabic and English. Your record stays yours.</p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/45">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link} className="text-[15px] text-white/75 hover:text-white">
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[13px] text-white/50">
          <p>Sample page under /design. Links here go nowhere yet.</p>
          <p>English · العربية</p>
        </div>
      </div>
      <p aria-hidden className="pointer-events-none select-none px-5 pb-2 text-center text-[18vw] font-black leading-none tracking-tighter text-white/[0.04]">
        24Therapy
      </p>
    </footer>
  );
}
