import { Brain, Mic, Target, Users, BarChart3, Shield, Zap, Heart, FileText, Calendar, Radio, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Mic,
    title: "AI Scribe",
    subtitle: "Clinical Documentation Automated",
    description:
      "Real-time transcription with speaker detection. AI generates SOAP, DAP, and BIRP notes automatically. Review, edit, approve in under 60 seconds.",
    highlight: "90% less documentation time",
    color: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    iconBg: "bg-blue-100 text-blue-600",
  },
  {
    icon: Brain,
    title: "Clinical Copilot",
    subtitle: "Live AI Assistance During Sessions",
    description:
      "AI suggests questions, flags risk indicators, tracks treatment goals, and surfaces relevant patient history — all in real-time, visible only to you.",
    highlight: "Live session intelligence",
    color: "from-purple-500 to-purple-600",
    bg: "bg-purple-50",
    iconBg: "bg-purple-100 text-purple-600",
  },
  {
    icon: Radio,
    title: "Radar Matching",
    subtitle: "Instant Therapist Connection",
    description:
      "Patient needs urgent help. Radar broadcasts to available therapists. First to accept starts the session. Patient connected in under 5 minutes.",
    highlight: "< 5 minute response time",
    color: "from-green-500 to-green-600",
    bg: "bg-green-50",
    iconBg: "bg-green-100 text-green-600",
  },
  {
    icon: Heart,
    title: "Patient Memory",
    subtitle: "Longitudinal Clinical Intelligence",
    description:
      "AI builds a structured memory of each patient across sessions. Symptoms, goals, relationships, life events — all searchable and contextual.",
    highlight: "Your clinical second brain",
    color: "from-rose-500 to-rose-600",
    bg: "bg-rose-50",
    iconBg: "bg-rose-100 text-rose-600",
  },
  {
    icon: Target,
    title: "Assessments",
    subtitle: "PHQ-9, GAD-7, PCL-5 & More",
    description:
      "Standardized assessments with automatic scoring and trend visualization. Send to patients between sessions. Track progress over time.",
    highlight: "Evidence-based outcomes",
    color: "from-orange-500 to-orange-600",
    bg: "bg-orange-50",
    iconBg: "bg-orange-100 text-orange-600",
  },
  {
    icon: Users,
    title: "Practice Management",
    subtitle: "Multi-Therapist Teams",
    description:
      "Manage multiple therapists, shared patients, team billing, and practice analytics. Everything under one organization with RBAC.",
    highlight: "Built for teams of any size",
    color: "from-teal-500 to-teal-600",
    bg: "bg-teal-50",
    iconBg: "bg-teal-100 text-teal-600",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    subtitle: "Integrated Booking System",
    description:
      "Patients book from your marketplace profile. Calendar sync, automated reminders, waitlist management, and no-show tracking built in.",
    highlight: "Zero scheduling friction",
    color: "from-indigo-500 to-indigo-600",
    bg: "bg-indigo-50",
    iconBg: "bg-indigo-100 text-indigo-600",
  },
  {
    icon: BarChart3,
    title: "Analytics & Outcomes",
    subtitle: "Practice Intelligence",
    description:
      "Track session utilization, patient outcomes, revenue metrics, AI usage costs, and clinical quality indicators. Data-driven practice growth.",
    highlight: "Full practice visibility",
    color: "from-cyan-500 to-cyan-600",
    bg: "bg-cyan-50",
    iconBg: "bg-cyan-100 text-cyan-600",
  },
  {
    icon: Globe,
    title: "API & Integrations",
    subtitle: "Build On Top of 24Therapy",
    description:
      "Full REST API, webhooks, and SDKs. Integrate with EHRs, insurance systems, and any workflow. White-label available for enterprises.",
    highlight: "Open platform architecture",
    color: "from-gray-500 to-gray-600",
    bg: "bg-gray-50",
    iconBg: "bg-gray-100 text-gray-600",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 bg-white" id="features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 bg-[#EEF2FF] text-[#1F5EFF] text-sm font-semibold px-4 py-2 rounded-full mb-4">
            <Zap className="w-4 h-4" />
            12 Integrated Systems
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0A2342] mb-4">
            Everything a Mental Health Practice Needs.{" "}
            <span className="text-[#1F5EFF]">In One Platform.</span>
          </h2>
          <p className="text-xl text-slate-600">
            No more Zoom + Google Docs + WhatsApp + Excel. 24Therapy replaces every fragmented tool 
            with one AI-powered system that gets smarter over time.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cn(
                  "group p-6 rounded-2xl border border-slate-100 hover:shadow-lg transition-all cursor-pointer",
                  feature.bg,
                  i === 0 ? "lg:col-span-2 row-span-1" : ""
                )}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.iconBg}`}>
                  <Icon className="w-6 h-6" />
                </div>

                <div className="mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {feature.subtitle}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#0A2342] mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{feature.description}</p>

                <div
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r text-white",
                    feature.color
                  )}
                >
                  <Zap className="w-3 h-3" />
                  {feature.highlight}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
