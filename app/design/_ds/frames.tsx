"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { BatteryFull, Lock, Signal, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";

import { spring } from "./motion";

export const SAMPLES = [
  { href: "/design", label: "Overview" },
  { href: "/design/website", label: "Website" },
  { href: "/design/patient", label: "Patient app" },
  { href: "/design/therapist", label: "Therapist" },
  { href: "/design/clinic", label: "Clinic" },
  { href: "/design/company", label: "Company" },
  { href: "/design/console", label: "Console" },
  { href: "/design/partner", label: "Partner" },
] as const;

/** The bar across the top of every design page: one tap to any other sample. */
export function DesignNav({ dark = false }: { dark?: boolean }) {
  const path = usePathname();
  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl",
        dark ? "border-white/10 bg-navy-900/95" : "border-navy-100 bg-white/85",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
        <Link href="/design" className={cn("shrink-0 text-[15px] font-black tracking-tight", dark ? "text-white" : "text-navy-700")}>
          24T <span className={dark ? "text-brand-400" : "text-brand-600"}>design</span>
        </Link>
        <div className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SAMPLES.map((sample) => {
            const active = path === sample.href;
            return (
              <Link
                key={sample.href}
                href={sample.href}
                className={cn(
                  "relative shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold",
                  dark ? (active ? "text-navy-700" : "text-white/75 hover:text-white") : active ? "text-white" : "text-navy-500 hover:text-navy-700",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="design-nav"
                    transition={spring}
                    className={cn("absolute inset-0 rounded-full", dark ? "bg-brand-500" : "bg-navy-600")}
                  />
                ) : null}
                <span className="relative">{sample.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/**
 * A phone at 390 x 844, the width every mobile defect was measured at. On a
 * real phone the bezel goes and the app takes the screen, so the sample can be
 * used the way a patient would use it.
 */
export function PhoneFrame({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className="mx-auto w-full sm:w-auto">
      <div className="relative mx-auto sm:rounded-[56px] sm:bg-navy-900 sm:p-3 sm:shadow-[0_40px_120px_-30px_rgba(3,11,23,0.65),inset_0_0_0_2px_rgba(255,255,255,0.08)]">
        <div
          className={cn(
            "relative flex h-[100dvh] w-full flex-col overflow-hidden sm:h-[844px] sm:w-[390px] sm:rounded-[46px]",
            dark ? "bg-navy-900" : "bg-navy-50",
          )}
        >
          <div
            className={cn(
              "relative z-50 hidden h-12 shrink-0 items-center justify-between px-7 text-[14px] font-semibold sm:flex",
              dark ? "text-white" : "text-navy-700",
            )}
          >
            <span>9:41</span>
            <span className="absolute left-1/2 top-2.5 h-7 w-28 -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1.5">
              <Signal className="h-4 w-4" aria-hidden />
              <Wifi className="h-4 w-4" aria-hidden />
              <BatteryFull className="h-5 w-5" aria-hidden />
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A desktop browser window for the portals and the website. */
export function BrowserFrame({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-navy-200/70 bg-white shadow-[0_40px_120px_-40px_rgba(3,11,23,0.45)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-navy-100 bg-navy-50/80 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-navy-200" />
          <span className="h-3 w-3 rounded-full bg-navy-200" />
          <span className="h-3 w-3 rounded-full bg-navy-200" />
        </span>
        <span className="mx-auto flex min-w-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-[12px] text-navy-500 ring-1 ring-navy-100">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{url}</span>
        </span>
        <span className="w-12" />
      </div>
      {children}
    </div>
  );
}

/** The heading block above a sample: what it is and what to try. */
export function SampleIntro({
  eyebrow,
  title,
  body,
  tryThis,
  dark = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tryThis?: string[];
  dark?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-10 text-center">
      <p className={cn("text-[13px] font-bold uppercase tracking-[0.18em]", dark ? "text-brand-300" : "text-brand-700")}>{eyebrow}</p>
      <h1 className={cn("mt-3 text-balance text-[34px] font-bold leading-[1.1] sm:text-[44px]", dark ? "text-white" : "text-navy-700")}>{title}</h1>
      <p className={cn("mx-auto mt-4 max-w-2xl text-pretty text-[17px] leading-relaxed", dark ? "text-white/75" : "text-navy-500")}>{body}</p>
      {tryThis?.length ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {tryThis.map((tip) => (
            <span
              key={tip}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-semibold",
                dark ? "bg-white/10 text-white/85 ring-1 ring-white/12" : "bg-white text-navy-600 ring-1 ring-navy-100",
              )}
            >
              Try: {tip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
