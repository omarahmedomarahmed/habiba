import {
  AlertTriangle, Shield, Clock, Zap, Brain, Phone,
  Activity, FileText, Bell, Eye, Target, CheckCircle,
} from "lucide-react";
import { ProductPageLayout } from "@/components/product/ProductPageLayout";

const FEATURE_ITEMS = [
  {
    icon: Eye,
    title: "Keyword Detection",
    description:
      "Real-time scan of the live session transcript for crisis language — suicidal ideation, self-harm references, expressions of hopelessness. Detection happens as speech is transcribed, not post-session.",
    highlight: "< 2 second detection latency",
  },
  {
    icon: Brain,
    title: "GPT-4o Semantic Analysis",
    description:
      "Beyond keywords: GPT-4o analyzes the clinical context around flagged language. Distinguishes between past trauma narrative and active ideation. Reduces false positives without missing genuine risk.",
    highlight: "Context-aware, not keyword-only",
  },
  {
    icon: Activity,
    title: "Severity Scoring",
    description:
      "Each detected risk is scored on a severity scale (low / moderate / high / critical) informed by C-SSRS research criteria. Severity determines the urgency and type of alert delivered to the therapist.",
    highlight: "C-SSRS-aligned severity model",
  },
  {
    icon: Bell,
    title: "Instant Therapist Alert",
    description:
      "A non-intrusive alert appears in the therapist's copilot panel within 2 seconds of detection. Includes the flagged text, severity level, and a one-click C-SSRS assessment prompt.",
    highlight: "In-session alert, zero clicks required",
  },
  {
    icon: Target,
    title: "C-SSRS Protocol Guidance",
    description:
      "One click opens the Columbia Suicide Severity Rating Scale guided assessment — right in the session view. Walk through the clinical protocol without leaving the session or switching apps.",
    highlight: "Embedded C-SSRS runner",
  },
  {
    icon: FileText,
    title: "Crisis Documentation",
    description:
      "All risk alerts, severity scores, and therapist responses are automatically logged to the session record. HIPAA-compliant audit trail for every crisis event with timestamps and action taken.",
    highlight: "Complete audit trail",
  },
  {
    icon: Phone,
    title: "988 Lifeline Integration",
    description:
      "On every session where a crisis flag is triggered, the 988 Suicide & Crisis Lifeline is surfaced prominently in the therapist view — always one click away for immediate referral.",
    highlight: "988 surfaced on every crisis flag",
  },
  {
    icon: Shield,
    title: "Always-On, Every Plan",
    description:
      "Crisis detection is not a premium add-on. It runs on every session, on every plan — from pay-as-you-go to enterprise. No configuration required. Clinical safety is foundational.",
    highlight: "Included on all plans at no extra cost",
  },
];

const CRISIS_VISUALIZER = (
  <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5 max-w-xl mx-auto text-left">
    {/* Session header */}
    <div className="flex items-center gap-2 mb-4">
      <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
      <span className="text-xs text-white/60 font-medium uppercase tracking-wide">Live Session · Risk Monitor Active</span>
    </div>

    {/* Transcript excerpt */}
    <div className="bg-white/8 border border-white/10 rounded-xl p-3 mb-3 text-xs text-white/70 leading-relaxed">
      <span className="text-white/40">Patient: </span>
      "I've been thinking that things would be{" "}
      <span className="bg-red-500/30 text-red-300 px-1 rounded">easier if I wasn't here</span>
      {" "}anymore…"
    </div>

    {/* Alert card */}
    <div className="bg-red-500/15 border border-red-500/40 rounded-xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm font-bold text-red-300">Risk Signal Detected</span>
        <span className="ml-auto text-[10px] bg-red-500/30 text-red-200 px-2 py-0.5 rounded-full font-bold">HIGH</span>
      </div>
      <p className="text-xs text-red-200/80 mb-3">
        Language consistent with passive suicidal ideation. C-SSRS assessment recommended.
      </p>
      <div className="flex gap-2">
        <button className="flex-1 bg-red-500/30 hover:bg-red-500/50 border border-red-500/40 text-red-200 text-xs py-2 rounded-lg font-semibold transition-colors">
          Open C-SSRS
        </button>
        <button className="flex-1 bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 text-xs py-2 rounded-lg transition-colors">
          Log Response
        </button>
      </div>
    </div>

    <div className="flex items-center gap-2 text-[10px] text-white/30">
      <Shield className="w-3 h-3" />
      Detected in 1.4s · 988 Lifeline: always available · HIPAA logged
    </div>
  </div>
);

export default function CrisisDetectionPage() {
  return (
    <ProductPageLayout
      badgeIcon={AlertTriangle}
      badgeLabel="Crisis Detection"
      badgeTag="Always On"
      heroTitle={
        <>
          Real-Time Crisis Detection.{" "}
          <span className="text-[#2EC4B6]">Every Session.</span>
        </>
      }
      heroSubtitle="AI monitors live session transcripts for suicidal ideation, self-harm language, and acute distress. Instant therapist alert with C-SSRS guidance — so you never miss a critical moment."
      ctaPrimary={{ label: "Get Started Free", href: "/signup?role=therapist" }}
      ctaSecondary={{ label: "See All Features", href: "/features" }}
      heroPreview={CRISIS_VISUALIZER}
      heroAccent="purple"
      stats={[
        { value: "< 2s", label: "Detection latency" },
        { value: "C-SSRS", label: "Aligned protocol" },
        { value: "All plans", label: "No extra cost" },
        { value: "100%", label: "Sessions monitored" },
      ]}
      featuresTitle="How Crisis Detection Works"
      featuresSubtitle="Eight layers of clinical safety infrastructure — from keyword scan to protocol guidance — running continuously in every session."
      featureItems={FEATURE_ITEMS}
      featureColumns={4}
      showPricingCta
      pricingCtaHeadline="Crisis Detection Is Included on Every Plan"
      pricingCtaSubheadline="Clinical safety is not a premium feature. It runs on every session at no additional cost."
    />
  );
}
