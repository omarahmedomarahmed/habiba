/**
 * PageHero — standard navy hero used on every marketing page.
 * Baseline: homepage hero gradient + glows + dot grid + optional wave.
 */

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GradientMesh, GlowOrbs, DotGrid, WaveDivider } from "./backgrounds";

export interface PageHeroCta {
  label: string;
  href: string;
  primary?: boolean;
}

export interface PageHeroProps {
  badge?: string;
  title: string;
  titleGradientPart?: string;
  subtitle?: string;
  primaryCta?: PageHeroCta;
  secondaryCta?: PageHeroCta;
  children?: React.ReactNode;
  size?: "default" | "compact" | "large";
  wave?: boolean;
  className?: string;
}

export function PageHero({
  badge,
  title,
  titleGradientPart,
  subtitle,
  primaryCta,
  secondaryCta,
  children,
  size = "default",
  wave = true,
  className,
}: PageHeroProps) {
  const paddingMap = {
    compact: "pt-24 pb-12",
    default: "pt-28 pb-16",
    large: "pt-32 pb-20",
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden text-white",
        paddingMap[size],
        className,
      )}
    >
      <GradientMesh />
      <GlowOrbs />
      <DotGrid />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          {badge && (
            <div className="inline-flex items-center gap-2 bg-white/8 border border-white/15 rounded-full px-4 py-2 text-sm text-white/80 mb-6">
              {badge}
            </div>
          )}

          <h1 className={cn("font-bold tracking-tight text-white mb-4", size === "large" ? "text-6xl" : "text-5xl md:text-6xl")}>
            {titleGradientPart ? (
              <>
                {title.replace(titleGradientPart, "")}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D8EFF] via-[#2EC4B6] to-[#4D8EFF]">
                  {titleGradientPart}
                </span>
              </>
            ) : title}
          </h1>

          {subtitle && (
            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-8 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}

          {(primaryCta || secondaryCta) && (
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
              {primaryCta && (
                <Link
                  href={primaryCta.href}
                  className="bg-[#1F5EFF] hover:bg-[#1F5EFF]/90 text-white font-semibold px-7 py-3.5 rounded-2xl transition-all hover:scale-105 shadow-lg shadow-[#1F5EFF]/30"
                >
                  {primaryCta.label}
                </Link>
              )}
              {secondaryCta && (
                <Link
                  href={secondaryCta.href}
                  className="bg-white/10 hover:bg-white/20 text-white font-semibold px-7 py-3.5 rounded-2xl border border-white/20 transition-all"
                >
                  {secondaryCta.label}
                </Link>
              )}
            </div>
          )}

          {children}
        </div>
      </div>

      {wave && <WaveDivider />}
    </section>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
