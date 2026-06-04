import Link from "next/link";
import { Brain, Twitter, Linkedin, Mail, Github } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "AI Scribe", href: "/ai-scribe" },
    { label: "AI Copilot", href: "/features/ai-copilot" },
    { label: "AI Workspace", href: "/features/ai-workspace" },
    { label: "Memory Layer", href: "/features/memory-layer" },
    { label: "Workflow Engine", href: "/features/workflow-engine" },
    { label: "Telehealth", href: "/features/teletherapy" },
    { label: "Analytics", href: "/features/analytics" },
    { label: "Pricing", href: "/pricing" },
  ],
  Solutions: [
    { label: "Solo Practitioners", href: "/features/use-cases" },
    { label: "Group Practices", href: "/features/use-cases" },
    { label: "Clinics & CMHCs", href: "/features/use-cases" },
    { label: "Health Systems", href: "/features/use-cases" },
    { label: "Integrations", href: "/features/integrations" },
    { label: "Enterprise", href: "/enterprise" },
    { label: "Find a Therapist", href: "/find-therapist" },
    { label: "For Therapists", href: "/for-therapists" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
    { label: "Testimonials", href: "/testimonials" },
  ],
  Developers: [
    { label: "Documentation", href: "/docs" },
    { label: "API Reference", href: "/docs" },
    { label: "Integrations", href: "/features/integrations" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "HIPAA Compliance", href: "/hipaa" },
    { label: "Security", href: "/security" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[#0A2342] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top section */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">
                24Therapy<span className="text-[#2EC4B6]">.ai</span>
              </span>
            </Link>
            <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-xs">
              The AI Operating System for Mental Healthcare. Empowering therapists, supporting patients, building the future of mental health.
            </p>
            <div className="flex items-center gap-3 mb-6">
              <a
                href="https://twitter.com/24therapyai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com/company/24therapyai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="mailto:hello@24therapy.ai"
                className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
            {/* Compliance Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-white/10 text-slate-300 px-2.5 py-1 rounded-lg">🔒 HIPAA</span>
              <span className="text-xs bg-white/10 text-slate-300 px-2.5 py-1 rounded-lg">🇪🇺 GDPR</span>
              <span className="text-xs bg-white/10 text-slate-300 px-2.5 py-1 rounded-lg">SOC 2</span>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-wider">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-slate-400 text-sm hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom section */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">
            © {new Date().getFullYear()} 24Therapy.ai. All rights reserved.
          </p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-slate-400 text-xs">All systems operational</span>
            </div>
            <span className="text-slate-600 text-xs hidden sm:block">•</span>
            <span className="text-slate-400 text-xs">Not for emergency use — call 988 for crisis support</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
