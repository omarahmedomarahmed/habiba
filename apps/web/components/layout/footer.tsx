import Link from "next/link";
import { Brain, Twitter, Linkedin, Mail } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "AI Scribe", href: "/features/ai-scribe" },
    { label: "Clinical Copilot", href: "/features/clinical-copilot" },
    { label: "Radar Matching", href: "/features/radar" },
    { label: "Telehealth", href: "/features/teletherapy" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
    { label: "Press", href: "/press" },
  ],
  Developers: [
    { label: "API Documentation", href: "/docs" },
    { label: "SDKs", href: "/docs/sdks" },
    { label: "Webhooks", href: "/docs/webhooks" },
    { label: "Status", href: "/status" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "HIPAA Compliance", href: "/hipaa" },
    { label: "GDPR", href: "/gdpr" },
    { label: "Security", href: "/security" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[#0A2342] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Top section */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl">
                24Therapy<span className="text-[#24C8DB]">.ai</span>
              </span>
            </Link>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              The AI Operating System for Mental Healthcare. Empowering therapists.
              Supporting patients. Building the future of mental health.
            </p>
            <div className="flex items-center gap-3">
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
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">
                {category}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-slate-400 text-xs">All systems operational</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
              <span className="text-xs text-slate-300">🔒 HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
              <span className="text-xs text-slate-300">🇪🇺 GDPR Ready</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
