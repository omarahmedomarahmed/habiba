import {
  Radio, Signal, Users, Shield, Clock, Zap,
  CheckCircle, Star, Activity, MessageSquare,
} from "lucide-react";
import { ProductPageLayout } from "@/components/product/ProductPageLayout";

const FEATURE_ITEMS = [
  {
    icon: Signal,
    title: "Instant Broadcast",
    description:
      "Patient submits a brief intake form. The system immediately broadcasts to all available therapists matching their specialty, language, and insurance requirements.",
    highlight: "Broadcast to matched therapists in < 30s",
  },
  {
    icon: Users,
    title: "Smart Matching Criteria",
    description:
      "Matching filters on specialty, language, insurance panel, availability, and patient history. No generalist lottery — every match is clinically relevant.",
    highlight: "8 matching dimensions",
  },
  {
    icon: Activity,
    title: "Real-Time Availability",
    description:
      "Therapist online status and calendar availability update in real time. Patients are never matched to someone unavailable or fully booked.",
    highlight: "Live availability signals",
  },
  {
    icon: Clock,
    title: "First-Accept Flow",
    description:
      "The first available therapist to accept the match request starts the session immediately. No scheduling, no back-and-forth — connection in minutes.",
    highlight: "< 5 minute average response",
  },
  {
    icon: MessageSquare,
    title: "Patient Status Updates",
    description:
      "Patients see their queue position, estimated wait, and receive a notification the moment a therapist accepts. Transparent, calm, no anxiety about the wait.",
    highlight: "Real-time status transparency",
  },
  {
    icon: Star,
    title: "Feedback Loop",
    description:
      "Post-session ratings from both sides refine the matching algorithm. Repeat matches with preferred therapists. Quality improves with every session.",
    highlight: "Gets smarter with every match",
  },
  {
    icon: Shield,
    title: "Safe Urgent Routing",
    description:
      "Crisis flags in the intake are immediately escalated. Radar prioritizes mental health crisis training and routes to on-call therapists first.",
    highlight: "Crisis routing built in",
  },
  {
    icon: CheckCircle,
    title: "Seamless Session Handoff",
    description:
      "On match acceptance, a HIPAA-secure video room is created instantly. The therapist receives a brief AI-prepared patient context card before joining.",
    highlight: "Room ready in < 10 seconds",
  },
];

const HERO_PREVIEW = (
  <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 max-w-2xl mx-auto text-left">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      <span className="text-xs text-white/70 font-medium">Radar • Broadcasting now</span>
    </div>
    <div className="space-y-3">
      <div className="bg-white/10 rounded-xl p-3 border border-white/10">
        <div className="text-xs text-[#2EC4B6] font-medium mb-1">Patient Request</div>
        <div className="text-sm text-white/90">Anxiety · English · Evening slots · Sliding scale</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["Dr. Chen", "Dr. Okafor", "Dr. Patel"].map((name, i) => (
          <div
            key={name}
            className={`rounded-xl p-2.5 border text-center text-xs ${
              i === 0
                ? "bg-[#2EC4B6]/20 border-[#2EC4B6]/40 text-white"
                : "bg-white/5 border-white/10 text-white/60"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-white/20 mx-auto mb-1" />
            {name}
            {i === 0 && <div className="text-[#2EC4B6] font-bold mt-0.5">Accepted ✓</div>}
          </div>
        ))}
      </div>
      <div className="text-center text-xs text-white/50">Session starting in 12 seconds...</div>
    </div>
  </div>
);

export default function RadarMatchingPage() {
  return (
    <ProductPageLayout
      badgeIcon={Radio}
      badgeLabel="Radar Matching"
      badgeTag="< 5 min"
      heroTitle={
        <>
          Connect Patients to the Right Therapist.{" "}
          <span className="text-[#2EC4B6]">Instantly.</span>
        </>
      }
      heroSubtitle="No scheduling friction. No waiting days for an appointment. When a patient needs help now, Radar broadcasts to available, matched therapists and starts a session in minutes."
      ctaPrimary={{ label: "See Radar in Action", href: "/demo" }}
      ctaSecondary={{ label: "For Therapists", href: "/for-therapists" }}
      heroPreview={HERO_PREVIEW}
      stats={[
        { value: "< 5 min", label: "Average response time" },
        { value: "94%", label: "Match satisfaction score" },
        { value: "24 / 7", label: "Therapist availability" },
        { value: "8", label: "Matching dimensions" },
      ]}
      featuresTitle="How Radar Works"
      featuresSubtitle="Eight systems working together to connect the right patient with the right therapist — every time."
      featureItems={FEATURE_ITEMS}
      featureColumns={4}
      ctaIcon={Radio}
      ctaTitle="Ready to Go On-Call?"
      ctaSubtitle="Therapists who join Radar see an average of 4 additional sessions per week from patients who need help right now."
      ctaButtonLabel="Join as a Therapist"
      ctaButtonHref="/for-therapists"
    />
  );
}
