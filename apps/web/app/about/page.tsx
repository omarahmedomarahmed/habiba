import Link from "next/link";
import {
  Heart, Brain, Shield, Globe, Users, Target, ArrowRight,
  CheckCircle2, Star, Award, Zap, TrendingUp, Sparkles,
  BookOpen, Building2, Phone, Mail
} from "lucide-react";

const MISSION_PILLARS = [
  {
    icon: Heart,
    title: "Therapist Empowerment",
    description: "Reduce burnout. Eliminate documentation burden. Give therapists back their most precious resource — time to focus on patients.",
    color: "bg-rose-50 text-rose-600"
  },
  {
    icon: Brain,
    title: "Clinical Intelligence",
    description: "AI that understands mental health — not just words. Purpose-built agents trained on clinical frameworks, DSM standards, and evidence-based care.",
    color: "bg-indigo-50 text-indigo-600"
  },
  {
    icon: Users,
    title: "Patient Access",
    description: "Remove barriers to mental health care. Intelligent matching connects people to the right therapist at the right time — instantly.",
    color: "bg-emerald-50 text-emerald-600"
  },
  {
    icon: Shield,
    title: "Ethical AI",
    description: "AI assists. Humans decide. We are committed to responsible AI that supports — never replaces — the therapeutic relationship.",
    color: "bg-amber-50 text-amber-600"
  },
];

const COMPANY_STATS = [
  { value: "500+", label: "Licensed Therapists", icon: Users },
  { value: "12,000+", label: "Patients Helped", icon: Heart },
  { value: "200,000+", label: "Sessions Documented", icon: BookOpen },
  { value: "8.5hrs", label: "Weekly Time Saved / Therapist", icon: Zap },
];

const VALUES = [
  "We believe therapists should spend their time with patients, not paperwork.",
  "We believe AI should empower clinicians, not replace them.",
  "We believe mental health care should be accessible to everyone.",
  "We believe patient data is sacred — consent, privacy, and security are non-negotiable.",
  "We believe the best mental health outcomes come from strong therapeutic relationships.",
  "We believe technology should fade into the background and let care shine through.",
];

const TEAM = [
  {
    name: "Dr. Leila Mansour",
    title: "Co-Founder & Chief Clinical Officer",
    bio: "Licensed psychologist with 15 years in clinical practice. Former faculty at Johns Hopkins. Built the clinical AI architecture from the ground up.",
    initials: "LM",
    gradient: "from-rose-500 to-pink-600"
  },
  {
    name: "James Park",
    title: "Co-Founder & CEO",
    bio: "Serial founder with exits in health tech. Previously scaled a telehealth company to 500K users. Passionate about mental health access.",
    initials: "JP",
    gradient: "from-blue-500 to-indigo-600"
  },
  {
    name: "Dr. Sofia Reyes",
    title: "Head of AI Research",
    bio: "PhD in Computational Linguistics from MIT. Expert in clinical NLP and multi-agent AI systems for healthcare applications.",
    initials: "SR",
    gradient: "from-emerald-500 to-teal-600"
  },
  {
    name: "Marcus Williams",
    title: "CTO",
    bio: "Former engineering lead at Epic Systems and Headspace. Architected enterprise-grade HIPAA-compliant healthcare platforms.",
    initials: "MW",
    gradient: "from-amber-500 to-orange-600"
  },
];

const BACKED_BY = [
  { name: "HealthTech Ventures", type: "Series A Lead" },
  { name: "MindBridge Capital", type: "Strategic Investor" },
  { name: "Y Combinator Alumni", type: "Program Graduate" },
  { name: "NIH Collaboration", type: "Research Partner" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <section className="pt-28 pb-20 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8">
            <Sparkles className="w-4 h-4 text-[#24C8DB]" />
            <span className="text-sm font-medium">Our Mission</span>
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Building the Global Mental Health Operating System
          </h1>
          <p className="text-xl text-white/70 leading-relaxed max-w-3xl mx-auto">
            24Therapy.ai exists to reduce therapist burnout, eliminate documentation burden, 
            and democratize access to quality mental health care — powered by AI, delivered by humans.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {COMPANY_STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center">
                <Icon className="w-6 h-6 text-[#24C8DB] mx-auto mb-2" />
                <p className="text-3xl font-bold text-white mb-1">{value}</p>
                <p className="text-sm text-white/50">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Pillars */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">Why We Exist</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              Mental health care is in crisis — too few providers, too much paperwork, too many people without access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {MISSION_PILLARS.map((pillar) => (
              <div key={pillar.title} className="flex gap-5 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${pillar.color}`}>
                  <pillar.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#0A2342] mb-2">{pillar.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{pillar.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* The problem */}
          <div className="bg-[#0A2342] rounded-3xl p-10 text-white">
            <div className="max-w-3xl mx-auto text-center">
              <h3 className="text-3xl font-bold mb-6">The Problem We're Solving</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                  { stat: "50%", label: "of therapists report burnout from documentation" },
                  { stat: "3hrs/day", label: "average time spent on notes and paperwork" },
                  { stat: "1 in 4", label: "people who need care never access it" },
                ].map(({ stat, label }) => (
                  <div key={stat} className="text-center">
                    <p className="text-4xl font-bold text-[#24C8DB] mb-2">{stat}</p>
                    <p className="text-white/70 text-sm">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-white/70 leading-relaxed">
                The mental health system is broken — not because of lack of compassionate professionals, 
                but because of outdated tools that burden providers with administrative work instead of enabling care. 
                We're building the infrastructure to fix that.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">Our Core Beliefs</h2>
          </div>
          <div className="space-y-4">
            {VALUES.map((value, i) => (
              <div key={i} className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200">
                <div className="w-8 h-8 bg-[#0A2342] rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">{i + 1}</span>
                </div>
                <p className="text-slate-700 leading-relaxed pt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-bold text-[#0A2342] mb-4">Built by People Who Care</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">
              A team of clinicians, engineers, and product leaders with deep expertise in mental health and enterprise healthcare.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {TEAM.map((member) => (
              <div key={member.name} className="text-center">
                <div className={`w-20 h-20 bg-gradient-to-br ${member.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <span className="text-white text-xl font-bold">{member.initials}</span>
                </div>
                <h3 className="font-bold text-[#0A2342] mb-1">{member.name}</h3>
                <p className="text-sm text-[#2F80ED] font-medium mb-2">{member.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Backed by / Partners */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400 uppercase tracking-widest mb-8">Backed By & Partnered With</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BACKED_BY.map(({ name, type }) => (
              <div key={name} className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
                <p className="font-semibold text-[#0A2342] text-sm">{name}</p>
                <p className="text-xs text-slate-400 mt-1">{type}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0A2342] to-[#1E4F8C] text-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">Let's Build the Future of Mental Health Together</h2>
              <p className="text-white/70 mb-8">
                Whether you're a therapist, investor, enterprise partner, or someone who believes in our mission — we'd love to connect.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-[#24C8DB]" />
                  <a href="mailto:hello@24therapy.ai" className="text-white/80 hover:text-white">hello@24therapy.ai</a>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-[#24C8DB]" />
                  <span className="text-white/80">New York · London · Dubai</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <Link href="/signup?role=therapist" className="w-full py-4 bg-[#1F5EFF] rounded-2xl text-white font-semibold text-center hover:bg-[#1649D4] transition-all flex items-center justify-center gap-2">
                Join as a Therapist <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/signup" className="w-full py-4 bg-white/10 rounded-2xl text-white font-semibold text-center hover:bg-white/20 transition-all border border-white/20">
                Get Support as a Patient
              </Link>
              <Link href="/contact" className="w-full py-4 border border-white/20 rounded-2xl text-white font-semibold text-center hover:bg-white/5 transition-all">
                Partner With Us
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
