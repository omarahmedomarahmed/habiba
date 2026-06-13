/**
 * Pure CSS/SVG background components — no external assets, aria-hidden.
 * Used site-wide for consistent dark-navy visual treatment.
 */

import React from "react";
import { cn } from "@/lib/utils";

/** Navy gradient mesh background */
export function GradientMesh({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 bg-gradient-to-br from-[#071A33] via-[#0A2342] to-[#0D2A4A]", className)}
    />
  );
}

/** Radial glow orbs */
export function GlowOrbs({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1F5EFF]/15 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#2EC4B6]/10 rounded-full blur-3xl" />
    </div>
  );
}

/** Fine dot grid overlay */
export function DotGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 opacity-[0.03] pointer-events-none", className)}
      style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }}
    />
  );
}

/** SVG wave divider (dark → light transition) */
export function WaveDivider({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div aria-hidden className={cn("absolute bottom-0 left-0 w-full overflow-hidden leading-none", className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className="w-full h-16 md:h-20"
        style={{ transform: inverted ? "scaleY(-1)" : undefined }}
      >
        <path
          d="M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 L1440,80 L0,80 Z"
          fill={inverted ? "#071A33" : "white"}
          fillOpacity="1"
        />
      </svg>
    </div>
  );
}

/** Subtle pattern for light sections (white → soft slate50) */
export function SectionPattern({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 opacity-[0.4] pointer-events-none", className)}
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(10,35,66,0.07) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
