import {
  Target, ClipboardList, TrendingUp, Send, BarChart3,
  CheckCircle, FileText, Shield, Zap, Link2,
} from "lucide-react";
import { ProductPageLayout } from "@/components/product/ProductPageLayout";

const FEATURE_ITEMS = [
  {
    icon: ClipboardList,
    title: "PHQ-9 Depression Screening",
    description:
      "The gold-standard 9-item questionnaire for depression severity. Auto-scored with severity classification (minimal, mild, moderate, severe) and trend tracking across sessions.",
    highlight: "Clinically validated scoring",
  },
  {
    icon: Target,
    title: "GAD-7 Anxiety Assessment",
    description:
      "7-item anxiety disorder assessment with automatic scoring, cutoff alerts, and longitudinal trend visualization. Identify treatment response in real time.",
    highlight: "Full GAD-7 + GAD-2 screening",
  },
  {
    icon: Shield,
    title: "PCL-5 PTSD Checklist",
    description:
      "DSM-5 aligned 20-item PTSD symptom checklist with cluster scoring. Tracks all four PTSD symptom clusters independently for precise treatment targeting.",
    highlight: "DSM-5 cluster analysis",
  },
  {
    icon: FileText,
    title: "Columbia Suicide Severity (C-SSRS)",
    description:
      "The C-SSRS safety screener for suicidal ideation and behavior. Triggers immediate clinical alert if high-risk responses are detected.",
    highlight: "Automatic safety escalation",
  },
  {
    icon: Send,
    title: "Between-Session Delivery",
    description:
      "Send assessments directly to patient portals or via SMS/email. Patients complete on any device. Results appear in the therapist dashboard immediately.",
    highlight: "Any device, any time",
  },
  {
    icon: TrendingUp,
    title: "Trend Visualization",
    description:
      "Score history charts across any time range. See patient trajectory at a glance — improving, plateauing, or deteriorating — and adjust treatment plans accordingly.",
    highlight: "Visual progress tracking",
  },
  {
    icon: Link2,
    title: "Treatment Goal Linking",
    description:
      "Link assessment scores directly to treatment goals. When PHQ-9 scores improve, goal progress updates automatically. Evidence-based treatment planning built in.",
    highlight: "Auto-links to treatment goals",
  },
  {
    icon: BarChart3,
    title: "Custom Assessment Builder",
    description:
      "Build custom questionnaires for your practice with scoring rules, conditional logic, and likert scales. Share across your organization or keep practice-specific.",
    highlight: "Unlimited custom assessments",
  },
];

const TOOL_LIST = [
  { name: "PHQ-9", category: "Depression", items: 9 },
  { name: "GAD-7", category: "Anxiety", items: 7 },
  { name: "PCL-5", category: "PTSD", items: 20 },
  { name: "C-SSRS", category: "Safety", items: 6 },
  { name: "MDQ", category: "Bipolar", items: 13 },
  { name: "AUDIT", category: "Alcohol Use", items: 10 },
  { name: "DAST-10", category: "Drug Use", items: 10 },
  { name: "CAGE", category: "Alcohol", items: 4 },
  { name: "ACE", category: "Childhood Trauma", items: 10 },
  { name: "DASS-21", category: "Multi-domain", items: 21 },
  { name: "SPIN", category: "Social Anxiety", items: 17 },
  { name: "Custom", category: "Your Design", items: null },
];

const EXTRA = (
  <section className="py-16 bg-slate-50">
    <div className="max-w-5xl mx-auto px-6">
      <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">
        15+ Validated Assessment Tools
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {TOOL_LIST.map((tool) => (
          <div
            key={tool.name}
            className="bg-white rounded-xl border border-slate-200 p-4 text-center hover:border-[#2EC4B6]/40 hover:shadow-sm transition-all"
          >
            <div className="font-bold text-slate-900 mb-1">{tool.name}</div>
            <div className="text-xs text-slate-500">{tool.category}</div>
            {tool.items && (
              <div className="text-xs text-[#2EC4B6] font-medium mt-1">{tool.items} items</div>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default function AssessmentsPage() {
  return (
    <ProductPageLayout
      badgeIcon={Target}
      badgeLabel="Assessments"
      badgeTag="Evidence-Based"
      heroTitle={
        <>
          Standardized Assessments.{" "}
          <span className="text-[#2EC4B6]">Automated & Tracked.</span>
        </>
      }
      heroSubtitle="Send validated screening tools to patients between sessions. Scores are automatic, trends are visual, and results feed directly into treatment plans and progress notes."
      ctaPrimary={{ label: "Start Free Trial", href: "/signup" }}
      ctaSecondary={{ label: "See All Tools", href: "#tools" }}
      stats={[
        { value: "15+", label: "Validated tools" },
        { value: "Auto", label: "Scoring & alerts" },
        { value: "Any", label: "Device delivery" },
        { value: "PHQ-9", label: "Included free" },
      ]}
      featuresTitle="What Assessments Does"
      featuresSubtitle="Everything from standardized screening to custom questionnaires — with scoring, trends, and treatment goal integration."
      featureItems={FEATURE_ITEMS}
      featureColumns={4}
      extra={EXTRA}
      ctaIcon={ClipboardList}
      ctaTitle="Measure What Matters"
      ctaSubtitle="Evidence-based outcomes start with evidence-based measurement. Start using assessments in your practice today — included with every plan."
      ctaButtonLabel="Start Free Trial"
      ctaButtonHref="/signup"
    />
  );
}
