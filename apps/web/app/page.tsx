import { HeroSection } from "@/components/sections/hero";
import { TrustSection } from "@/components/sections/trust";
import { FeaturesSection } from "@/components/sections/features";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { RadarSection } from "@/components/sections/radar";
import { PricingSection } from "@/components/sections/pricing";
import { TestimonialsSection } from "@/components/sections/testimonials";
export default function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <TrustSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RadarSection />
      <PricingSection />
      <TestimonialsSection />
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
