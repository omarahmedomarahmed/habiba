import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/sections/hero";
import { TrustSection } from "@/components/sections/trust";
import { FeaturesSection } from "@/components/sections/features";
import { HowItWorksSection } from "@/components/sections/how-it-works";
import { RadarSection } from "@/components/sections/radar";
import { PricingSection } from "@/components/sections/pricing";
import { TestimonialsSection } from "@/components/sections/testimonials";
import { CTASection } from "@/components/sections/cta";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <HeroSection />
      <TrustSection />
      <FeaturesSection />
      <HowItWorksSection />
      <RadarSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
