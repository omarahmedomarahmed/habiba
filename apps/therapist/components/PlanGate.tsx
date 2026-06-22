"use client";

import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { useUIStore } from "@/lib/store";
import { hasTier, TIER_LABEL, type Tier } from "@/lib/tiers";

const FEATURE_BLURB: Record<string, { title: string; desc: string }> = {
  analytics: {
    title: "Practice Analytics",
    desc: "Track outcomes, session trends, and revenue across your whole caseload.",
  },
  radar: {
    title: "Radar Matching",
    desc: "Get matched with new patients actively looking for a therapist like you.",
  },
  "ai-workspace": {
    title: "AI Workspace",
    desc: "A dedicated assistant for drafting notes, summaries, and clinical prep.",
  },
  booking: {
    title: "Public Booking Page",
    desc: "Share a personal booking link and let patients self-schedule and pay.",
  },
  crm: {
    title: "Referral CRM",
    desc: "Manage referral sources and your intake pipeline in one place.",
  },
  memory: {
    title: "Patient Memory Graph",
    desc: "A longitudinal knowledge graph that compounds insight across sessions.",
  },
  "treatment-plans": {
    title: "Treatment Plans",
    desc: "Structured, goal-based treatment plans with progress tracking.",
  },
};

export function UpgradePrompt({ feature, required }: { feature?: string; required: Tier }) {
  const blurb = (feature && FEATURE_BLURB[feature]) || {
    title: "Premium feature",
    desc: "This feature is available on a higher plan.",
  };

  return (
    <div className="flex items-center justify-center p-6 min-h-[60vh]">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-slate-200 shadow-card p-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] flex items-center justify-center mx-auto mb-5">
          <Lock className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{blurb.title}</h2>
        <p className="text-sm text-slate-500 mb-5">{blurb.desc}</p>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F5EFF] bg-blue-50 px-3 py-1.5 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Included with {TIER_LABEL[required]} and above
        </div>
        <Link
          href="/billing"
          className="flex items-center justify-center gap-2 w-full h-11 bg-[#0A2342] text-white rounded-xl text-sm font-semibold hover:bg-[#123A63] transition-colors"
        >
          View plans &amp; upgrade <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Gates premium page content by subscription tier.
 *
 * While the tier is still loading (null) we render children optimistically so
 * entitled users never see a flash of the upgrade wall. This is a UX gate, not
 * a security boundary — sensitive endpoints are still authorized server-side.
 */
export function PlanGate({
  required,
  feature,
  children,
}: {
  required: Tier;
  feature?: string;
  children: React.ReactNode;
}) {
  const tier = useUIStore((s) => s.subscriptionTier);
  if (tier === null) return <>{children}</>;
  if (!hasTier(tier, required)) return <UpgradePrompt feature={feature} required={required} />;
  return <>{children}</>;
}
