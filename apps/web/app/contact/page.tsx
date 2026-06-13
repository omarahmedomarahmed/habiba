"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail, Phone, MapPin, MessageSquare, Building2, Users, Zap,
  CheckCircle, ArrowRight, Clock, Globe, Send, Heart, Shield,
  Calendar, HelpCircle, BookOpen, ChevronRight
} from "lucide-react";
import { EMAILS } from "@/lib/domains";

type ContactType = "general" | "sales" | "support" | "demo" | "press" | "security";

const CONTACT_OPTIONS = [
  {
    id: "demo" as ContactType,
    icon: Zap,
    title: "Request a Demo",
    description: "See the full platform live. 30-minute walkthrough with our team.",
    color: "bg-[#2EC4B6]/10 text-[#2EC4B6]",
  },
  {
    id: "sales" as ContactType,
    icon: Building2,
    title: "Sales Inquiry",
    description: "Group practices, clinics, and enterprise plans. Talk to our team.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    id: "support" as ContactType,
    icon: HelpCircle,
    title: "Technical Support",
    description: "Platform issues, account problems, or clinical workflow questions.",
    color: "bg-violet-100 text-violet-600",
  },
  {
    id: "press" as ContactType,
    icon: BookOpen,
    title: "Press & Media",
    description: "Media inquiries, company information, and partnership opportunities.",
    color: "bg-orange-100 text-orange-600",
  },
];

const FAQS = [
  {
    q: "How long does onboarding take?",
    a: "Most solo therapists are fully set up and documenting their first AI note within 20 minutes. Group practices receive a dedicated onboarding call.",
  },
  {
    q: "Is the BAA included in all plans?",
    a: "Yes. A signed Business Associate Agreement (BAA) is included with every plan, including Pay As You Go.",
  },
  {
    q: "Do you offer discounts for group practices?",
    a: "Yes. Volume discounts start at 3 therapists. Contact our sales team for custom pricing.",
  },
  {
    q: "How do I migrate from another EHR?",
    a: "We provide migration support for SimplePractice, TherapyNotes, and CSV exports. Our team handles the migration.",
  },
  {
    q: "What is your support response time?",
    a: "Standard plans: < 24h email response. Professional+: < 4h. Enterprise: < 1h with dedicated account manager.",
  },
];

export default function ContactPage() {
  const [selectedType, setSelectedType] = useState<ContactType>("demo");
  const [formData, setFormData] = useState({
    name: "", email: "", organization: "", phone: "", therapist_count: "", message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-[#2EC4B6]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-[#2EC4B6]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0A2342] mb-4">Message received!</h2>
          <p className="text-gray-500 mb-8">
            We typically respond within 2-4 hours during business hours. For urgent support, email{" "}
            <a href={`mailto:${EMAILS.support}`} className="text-[#2EC4B6] font-medium">{EMAILS.support}</a>.
          </p>
          <Link
            href="/"
            className="bg-[#0A2342] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0d2d56] inline-flex items-center gap-2"
          >
            Return Home <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Let's talk</h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Whether you're a solo therapist exploring the platform, or a health system evaluating enterprise options — we're here to help.
          </p>
        </div>
      </section>

      {/* Contact Options */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-4 mb-12">
            {CONTACT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedType(opt.id)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    selectedType === opt.id
                      ? "border-[#2EC4B6] bg-[#2EC4B6]/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${opt.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="font-semibold text-[#0A2342] text-sm mb-1">{opt.title}</div>
                  <div className="text-xs text-gray-500">{opt.description}</div>
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Form */}
            <div>
              <h2 className="text-2xl font-bold text-[#0A2342] mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2EC4B6]"
                      placeholder="Dr. Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2EC4B6]"
                      placeholder="jane@practice.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization / Practice Name</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2EC4B6]"
                    placeholder="Mindful Health Practice"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2EC4B6]"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Therapists</label>
                    <select
                      value={formData.therapist_count}
                      onChange={(e) => setFormData({ ...formData, therapist_count: e.target.value })}
                      className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2EC4B6] bg-white"
                    >
                      <option value="">Select...</option>
                      <option value="1">Just me (solo)</option>
                      <option value="2-5">2–5 therapists</option>
                      <option value="6-20">6–20 therapists</option>
                      <option value="21-100">21–100 therapists</option>
                      <option value="100+">100+ therapists</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2EC4B6] resize-none"
                    placeholder="Tell us what you're looking for..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#0A2342] hover:bg-[#0d2d56] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
                <p className="text-xs text-gray-400 text-center">
                  We respond within 2-4 hours during business hours (M–F, 8am–6pm ET)
                </p>
              </form>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-8">
              <div>
                <h3 className="font-bold text-[#0A2342] mb-4">Direct contacts</h3>
                <div className="space-y-4">
                  {[
                    { icon: Mail, label: "General", value: EMAILS.hello },
                    { icon: Mail, label: "Support", value: EMAILS.support },
                    { icon: Mail, label: "Sales", value: EMAILS.sales },
                    { icon: Mail, label: "Security", value: EMAILS.security },
                    { icon: Mail, label: "Press", value: EMAILS.press },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={`mailto:${item.value}`}
                        className="flex items-center gap-3 hover:text-[#2EC4B6] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">{item.label}</div>
                          <div className="text-sm font-medium text-[#0A2342]">{item.value}</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-[#0A2342] mb-4">Response times</h3>
                <div className="space-y-3">
                  {[
                    { tier: "Solo / Starter", time: "Within 24 hours" },
                    { tier: "Professional", time: "Within 4 hours" },
                    { tier: "Enterprise", time: "Within 1 hour + dedicated manager" },
                  ].map((item) => (
                    <div key={item.tier} className="flex items-center justify-between text-sm border border-gray-200 rounded-xl p-3">
                      <span className="text-gray-600">{item.tier}</span>
                      <span className="font-medium text-[#0A2342]">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0A2342]/5 rounded-2xl p-5">
                <h3 className="font-bold text-[#0A2342] mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#2EC4B6]" />
                  Book a demo directly
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Skip the form. Schedule a 30-minute live demo with our clinical team.
                </p>
                <a
                  href="https://cal.com/24therapy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#2EC4B6] hover:bg-[#26b0a3] text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 w-full justify-center"
                >
                  Schedule Demo <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0A2342] mb-8 text-center">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-[#0A2342] mb-2">{faq.q}</h3>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
