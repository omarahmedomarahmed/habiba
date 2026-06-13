import Link from "next/link";
import { ArrowRight, CheckCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface FeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
  highlight: string;
}

interface ProductPageLayoutProps {
  badgeIcon: LucideIcon;
  badgeLabel: string;
  badgeTag?: string;
  heroTitle: ReactNode;
  heroSubtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary?: { label: string; href: string };
  heroPreview?: ReactNode;
  stats: Array<{ value: string; label: string }>;
  featuresTitle: string;
  featuresSubtitle?: string;
  featureItems: FeatureItem[];
  featureColumns?: 2 | 3 | 4;
  extra?: ReactNode;
  ctaIcon: LucideIcon;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButtonLabel: string;
  ctaButtonHref: string;
}

const GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 lg:grid-cols-3",
  4: "md:grid-cols-2 lg:grid-cols-4",
};

const STATS_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

export function ProductPageLayout({
  badgeIcon: BadgeIcon,
  badgeLabel,
  badgeTag,
  heroTitle,
  heroSubtitle,
  ctaPrimary,
  ctaSecondary,
  heroPreview,
  stats,
  featuresTitle,
  featuresSubtitle,
  featureItems,
  featureColumns = 4,
  extra,
  ctaIcon: CtaIcon,
  ctaTitle,
  ctaSubtitle,
  ctaButtonLabel,
  ctaButtonHref,
}: ProductPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white py-24 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-96 h-96 bg-[#2EC4B6]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#1F5EFF]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-8">
            <BadgeIcon className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">{badgeLabel}</span>
            {badgeTag && (
              <span className="bg-[#2EC4B6] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                {badgeTag}
              </span>
            )}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">{heroTitle}</h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">{heroSubtitle}</p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link
              href={ctaPrimary.href}
              className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2"
            >
              {ctaPrimary.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
            {ctaSecondary && (
              <Link
                href={ctaSecondary.href}
                className="border border-white/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-white/10 transition"
              >
                {ctaSecondary.label}
              </Link>
            )}
          </div>
          {heroPreview}
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 border-b border-slate-200 py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className={`grid ${STATS_COLS[stats.length] ?? "grid-cols-2 md:grid-cols-4"} gap-6 text-center`}>
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-slate-900">{s.value}</div>
                <div className="text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">{featuresTitle}</h2>
            {featuresSubtitle && (
              <p className="text-slate-600 max-w-xl mx-auto">{featuresSubtitle}</p>
            )}
          </div>
          <div className={`grid ${GRID_COLS[featureColumns]} gap-6`}>
            {featureItems.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-[#2EC4B6]/40 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed mb-3">{feature.description}</p>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-[#2EC4B6] flex-shrink-0" />
                    <span className="text-xs font-medium text-[#2EC4B6]">{feature.highlight}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {extra}

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1a3a6a] text-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <CtaIcon className="w-14 h-14 text-[#2EC4B6] mx-auto mb-5" />
          <h2 className="text-3xl font-bold mb-4">{ctaTitle}</h2>
          <p className="text-white/80 mb-8">{ctaSubtitle}</p>
          <Link
            href={ctaButtonHref}
            className="bg-[#2EC4B6] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition inline-flex items-center gap-2"
          >
            {ctaButtonLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
