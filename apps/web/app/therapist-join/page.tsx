"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain, CheckCircle2, ArrowRight, Shield, Star, Clock,
  DollarSign, Users, Sparkles, Award, ChevronRight, Check,
  Calendar, FileText, BarChart3, Zap, Heart, Globe,
  BookOpen, Video, Lock, TrendingUp, Building
} from "lucide-react";
import { cn } from "@/lib/utils";

const BENEFITS = [
  {
    icon: Brain,
    color: "text-violet-600",
    bg: "bg-violet-50",
    title: "AI Copilot for Every Session",
    desc: "Real-time session guidance, live suggestions, automatic note-taking, and pattern recognition — so you can focus entirely on your patient.",
  },
  {
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "70% Less Paperwork",
    desc: "AI-generated clinical notes, treatment plans, referral letters, and reports. Review and sign in seconds instead of spending hours documenting.",
  },
  {
    icon: Users,
    color: "text-teal-600",
    bg: "bg-teal-50",
    title: "Built-In Patient Referrals",
    desc: "Join a network of 10,000+ patients seeking therapists. Our AI matches patients to you based on your specialties, approach, and availability.",
  },
  {
    icon: BarChart3,
    color: "text-green-600",
    bg: "bg-green-50",
    title: "Practice Intelligence Dashboard",
    desc: "Track clinical outcomes, revenue trends, patient progress, and business health in one place — with AI insights to grow your practice.",
  },
  {
    icon: Shield,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "HIPAA-Secure & Compliant",
    desc: "SOC 2 Type II, HIPAA BAA, end-to-end encryption. Built for mental health providers. Your patients' data is always protected.",
  },
  {
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    title: "Streamlined Billing",
    desc: "Integrated insurance billing, claim tracking, superbills, and payment processing. Get paid faster with less administrative overhead.",
  },
];

const PLANS = [
  {
    name: "Solo",
    price: "$89",
    period: "/month",
    description: "For independent practitioners",
    features: [
      "AI-powered clinical notes",
      "Session room with copilot",
      "Patient memory layer",
      "Telehealth platform",
      "Up to 30 active patients",
      "Basic analytics",
      "Email support",
    ],
    highlighted: false,
    cta: "Start Free Trial",
  },
  {
    name: "Professional",
    price: "$149",
    period: "/month",
    description: "For growing practices",
    features: [
      "Everything in Solo",
      "Unlimited active patients",
      "Advanced analytics & reports",
      "Referral management",
      "Risk monitoring (AI Radar)",
      "Workflow automation",
      "Priority support",
      "Custom forms & templates",
    ],
    highlighted: true,
    badge: "Most Popular",
    cta: "Start Free Trial",
  },
  {
    name: "Group",
    price: "$299",
    period: "/month",
    description: "For group practices (2-10 therapists)",
    features: [
      "Everything in Professional",
      "Multi-therapist management",
      "Practice-level analytics",
      "Shared patient pool",
      "Billing & claims management",
      "White-label options",
      "Dedicated onboarding",
      "SLA support",
    ],
    highlighted: false,
    cta: "Contact Sales",
  },
];

const TESTIMONIALS = [
  {
    name: "Dr. Rachel Kim",
    credential: "PhD, LCSW · Solo Practice · Boston, MA",
    photo: "RK",
    color: "from-violet-500 to-purple-600",
    quote: "I was spending 3 hours a day on documentation. With 24Therapy, it's under 30 minutes. The AI copilot during sessions is genuinely useful — it catches patterns I might miss.",
    stat: "85% reduction in documentation time",
  },
  {
    name: "Carlos Mendez",
    credential: "LMFT · Group Practice Owner · Austin, TX",
    photo: "CM",
    color: "from-blue-500 to-cyan-600",
    quote: "We onboarded 5 therapists in our practice. The analytics have completely transformed how we understand our clinical outcomes. We're now able to show measurable patient improvement to payers.",
    stat: "3x more new patient referrals",
  },
  {
    name: "Dr. Amara Osei",
    credential: "PsyD · Private Practice · Atlanta, GA",
    photo: "AO",
    color: "from-teal-500 to-emerald-600",
    quote: "The memory layer is what sold me. When I sit down with a patient, I already have a comprehensive brief of everything we've worked on. The AI doesn't replace my judgment — it extends it.",
    stat: "40% better clinical outcomes",
  },
];

const STEPS = [
  { num: "01", title: "Apply Online", desc: "Complete a 10-minute application. We verify your license and credentials." },
  { num: "02", title: "Onboard in < 1 Hour", desc: "Set up your practice profile, availability, and preferences with guided setup." },
  { num: "03", title: "Start Seeing Patients", desc: "Accept referrals, manage your schedule, and begin using AI tools immediately." },
  { num: "04", title: "Grow with Intelligence", desc: "Use analytics, memory layer, and AI insights to improve outcomes and scale." },
];

export default function TherapistJoinPage() {
  const [formStep, setFormStep] = useState<"interest" | "thanks">("interest");
  const [formData, setFormData] = useState({
    name: "", email: "", credential: "", state: "", practice_type: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormStep("thanks");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] via-[#1a3a6b] to-[#0A2342] py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-96 h-96 bg-[#2EC4B6] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-64 h-64 bg-[#1F5EFF] rounded-full blur-2xl" />
        </div>
        <div className="max-w-5xl mx-auto relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#2EC4B6]/20 text-[#2EC4B6] text-xs font-bold px-3 py-1.5 rounded-full mb-5">
                <Sparkles className="w-3.5 h-3.5" /> Now accepting applications — Limited spots available
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5">
                Practice Smarter.<br />
                <span className="text-[#2EC4B6]">Help More Patients.</span>
              </h1>
              <p className="text-lg text-white/70 mb-8">
                Join 2,400+ therapists using 24Therapy.ai to eliminate paperwork, access AI-powered clinical tools, and deliver better care — while building a more sustainable practice.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                {["No setup fees", "14-day free trial", "Cancel anytime"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-white/80 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#2EC4B6]" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="#apply" className="inline-flex items-center gap-2 bg-[#2EC4B6] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#25a99d] transition-all shadow-lg">
                  Apply Now — Free <ArrowRight className="w-4 h-4" />
                </a>
                <a href="#plans" className="inline-flex items-center gap-2 border border-white/20 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/10 transition-all">
                  View Plans
                </a>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { value: "2,400+", label: "Active Therapists", icon: Users },
                { value: "85%", label: "Documentation Time Saved", icon: Clock },
                { value: "10K+", label: "Patient Referrals/Month", icon: Heart },
                { value: "4.8/5", label: "Therapist Satisfaction", icon: Star },
              ].map(({ value, label, icon: Icon }) => (
                <div key={label} className="bg-white/10 border border-white/20 rounded-2xl p-5">
                  <Icon className="w-6 h-6 text-[#2EC4B6] mb-2" />
                  <div className="text-2xl font-black text-white">{value}</div>
                  <div className="text-xs text-white/60 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#0A2342] mb-3">Everything You Need to Run an AI-Powered Practice</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">A complete Mental Health Operating System — not just a scheduling tool or note-taker.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {BENEFITS.map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-all">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-4", bg)}>
                  <Icon className={cn("w-5 h-5", color)} />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#0A2342] mb-3">From Application to First Session in Days</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative">
                <div className="w-10 h-10 bg-[#0A2342] rounded-xl flex items-center justify-center text-white font-black text-sm mb-4">{num}</div>
                <h3 className="font-bold text-slate-800 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
                {num !== "04" && (
                  <ChevronRight className="absolute top-3 -right-3 w-5 h-5 text-slate-300 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#0A2342] mb-3">Trusted by Independent Therapists & Group Practices</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, credential, photo, color, quote, stat }) => (
              <div key={name} className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold bg-gradient-to-br", color)}>
                    {photo}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{name}</div>
                    <div className="text-xs text-slate-500">{credential}</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 italic">"{quote}"</p>
                <div className="bg-[#2EC4B6]/10 text-[#1a8c82] text-xs font-bold px-3 py-1.5 rounded-full inline-block">
                  📈 {stat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="plans" className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-[#0A2342] mb-3">Transparent Pricing — Start Free</h2>
            <p className="text-slate-500 text-lg">All plans include a 14-day free trial. No credit card required.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map(({ name, price, period, description, features, highlighted, badge, cta }) => (
              <div
                key={name}
                className={cn(
                  "rounded-2xl border p-6 relative",
                  highlighted
                    ? "bg-gradient-to-b from-[#0A2342] to-[#1a3a6b] border-[#0A2342] shadow-xl"
                    : "bg-white border-slate-200"
                )}
              >
                {badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2EC4B6] text-white text-xs font-bold px-3 py-1 rounded-full">{badge}</div>
                )}
                <div className={cn("text-sm font-bold mb-1", highlighted ? "text-[#2EC4B6]" : "text-[#1F5EFF]")}>{name}</div>
                <div className={cn("flex items-baseline gap-1 mb-1", highlighted ? "text-white" : "text-slate-800")}>
                  <span className="text-3xl font-black">{price}</span>
                  <span className={cn("text-sm", highlighted ? "text-white/60" : "text-slate-400")}>{period}</span>
                </div>
                <p className={cn("text-xs mb-5", highlighted ? "text-white/60" : "text-slate-400")}>{description}</p>
                <ul className="space-y-2 mb-6">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={cn("w-4 h-4 mt-0.5 shrink-0", highlighted ? "text-[#2EC4B6]" : "text-[#0A2342]")} />
                      <span className={highlighted ? "text-white/80" : "text-slate-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#apply"
                  className={cn(
                    "w-full py-2.5 rounded-xl font-bold text-sm text-center block transition-all",
                    highlighted
                      ? "bg-[#2EC4B6] text-white hover:bg-[#25a99d]"
                      : "border-2 border-[#0A2342] text-[#0A2342] hover:bg-[#0A2342] hover:text-white"
                  )}
                >
                  {cta}
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-slate-400 mt-6">
            Enterprise pricing available for health systems and large group practices.{" "}
            <Link href="/enterprise" className="text-[#1F5EFF] font-medium">Learn more →</Link>
          </p>
        </div>
      </section>

      {/* Application Form */}
      <section id="apply" className="py-20 px-4 bg-slate-50">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-[#0A2342] mb-3">Apply to Join 24Therapy.ai</h2>
            <p className="text-slate-500">Takes 10 minutes. We'll review your application within 24 hours.</p>
          </div>

          {formStep === "thanks" ? (
            <div className="bg-white rounded-2xl border border-green-200 p-10 text-center shadow-sm">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Application Received!</h3>
              <p className="text-slate-500 text-sm mb-4">
                Thanks, <strong>{formData.name}</strong>! We'll review your application and reach out to{" "}
                <strong>{formData.email}</strong> within 24 hours with next steps.
              </p>
              <p className="text-xs text-slate-400">In the meantime, explore our <Link href="/for-therapists" className="text-[#1F5EFF]">therapist resources</Link>.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342] outline-none"
                    placeholder="Dr. First Last"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Professional Email *</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342] outline-none"
                    placeholder="you@practice.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Credentials *</label>
                  <select
                    required
                    value={formData.credential}
                    onChange={e => setFormData(prev => ({ ...prev, credential: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342] outline-none"
                  >
                    <option value="">Select...</option>
                    <option>PhD</option>
                    <option>PsyD</option>
                    <option>LCSW</option>
                    <option>LMFT</option>
                    <option>LPC</option>
                    <option>LPCC</option>
                    <option>NCC</option>
                    <option>MD / DO (Psychiatry)</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Licensed State *</label>
                  <select
                    required
                    value={formData.state}
                    onChange={e => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342] outline-none"
                  >
                    <option value="">State</option>
                    {["CA","NY","TX","FL","IL","PA","WA","MA","CO","AZ","GA","NC","VA","OH","NJ","MN","MI","OR","MD"].map(s => <option key={s}>{s}</option>)}
                    <option>Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Practice Type</label>
                  <select
                    value={formData.practice_type}
                    onChange={e => setFormData(prev => ({ ...prev, practice_type: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#0A2342]/20 focus:border-[#0A2342] outline-none"
                  >
                    <option value="">Select...</option>
                    <option>Solo / Independent Practice</option>
                    <option>Group Practice (Employed)</option>
                    <option>Group Practice Owner</option>
                    <option>Clinic / Community Mental Health</option>
                    <option>Hospital / Health System</option>
                    <option>Employee Assistance (EAP)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input type="checkbox" required id="terms" className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-[#0A2342]" />
                <label htmlFor="terms" className="text-xs text-slate-500">
                  I agree to the <Link href="/terms" className="text-[#1F5EFF]">Terms of Service</Link> and understand that 24Therapy.ai requires a valid, active license to practice.
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0A2342] text-white py-3.5 rounded-xl font-bold hover:bg-[#0A2342]/90 transition-all flex items-center justify-center gap-2"
              >
                Submit Application <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-xs text-slate-400">
                We review all applications within 24 hours. Questions? <a href="mailto:providers@24therapy.ai" className="text-[#1F5EFF]">providers@24therapy.ai</a>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 bg-white border-t border-slate-100 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 items-center">
          {[
            { icon: Shield, label: "HIPAA Compliant" },
            { icon: Award, label: "SOC 2 Type II" },
            { icon: Lock, label: "256-bit Encryption" },
            { icon: Globe, label: "BAA Included" },
            { icon: CheckCircle2, label: "Credential Verified" },
            { icon: Star, label: "4.8/5 Therapist Rating" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-slate-600">
              <Icon className="w-4 h-4 text-[#2EC4B6]" />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
