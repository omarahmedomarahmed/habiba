import Link from 'next/link';
import { Newspaper, Download, Mail, ExternalLink } from 'lucide-react';

const PRESS_RELEASES = [
  {
    date: 'June 2026',
    title: '24Therapy Launches AI-Native Mental Health Platform with Real-Time Emotional Intelligence',
    excerpt: '24Therapy today announced the launch of its full mental health operating system, combining AI session scribing, real-time emotional context detection, and an industry-first proactive AI companion for patients.',
    tag: 'Launch',
  },
  {
    date: 'May 2026',
    title: '24Therapy Achieves HIPAA Compliance and BAA Readiness for Enterprise Clients',
    excerpt: 'The platform has completed its HIPAA security review, implementing end-to-end PHI audit logging and encryption-at-rest for all patient data.',
    tag: 'Compliance',
  },
  {
    date: 'April 2026',
    title: '24Therapy Introduces Crisis Detection System: AI Monitors 26 Risk Indicators in Real Time',
    excerpt: 'The crisis detection system fires immediate alerts to therapists and supervisors when high-risk language is detected mid-session, bridging a critical gap in teletherapy safety.',
    tag: 'Product',
  },
];

const MEDIA_ASSETS = [
  { name: 'Logo Pack (SVG + PNG)', size: '2.1 MB', file: '#' },
  { name: 'Product Screenshots', size: '8.4 MB', file: '#' },
  { name: 'Founder Bio + Photo', size: '1.2 MB', file: '#' },
  { name: 'Company Fact Sheet', size: '0.4 MB', file: '#' },
];

const TAG_COLORS: Record<string, string> = {
  Launch: 'bg-blue-100 text-blue-700',
  Compliance: 'bg-green-100 text-green-700',
  Product: 'bg-violet-100 text-violet-700',
};

export default function PressPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1a3a6b] py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#2EC4B6] rounded-lg flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">24Therapy</span>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-4">Press & Media</h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto">
            Resources for journalists, analysts, and media covering AI in mental health and healthcare technology.
          </p>
          <a href="mailto:press@24therapy.ai"
            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-[#2EC4B6] text-white rounded-xl text-sm font-medium hover:bg-[#29b0a3] transition-colors">
            <Mail className="w-4 h-4" />
            press@24therapy.ai
          </a>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-16 space-y-16">
        {/* Fast Facts */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Fast Facts</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { label: 'Founded', value: '2025' },
              { label: 'Headquarters', value: 'San Francisco, CA' },
              { label: 'Focus', value: 'Mental Health AI' },
              { label: 'Portals', value: '4 (Web, Therapist, Patient, Admin)' },
              { label: 'AI Models', value: 'GPT-4o, Whisper, Embeddings' },
              { label: 'Compliance', value: 'HIPAA, SOC 2 (in progress)' },
            ].map(fact => (
              <div key={fact.label} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{fact.label}</p>
                <p className="font-semibold text-slate-900">{fact.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Press Releases */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Press Releases</h2>
          <div className="space-y-4">
            {PRESS_RELEASES.map((pr, i) => (
              <div key={i} className="border border-slate-200 rounded-2xl p-6 hover:border-[#2EC4B6] transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-slate-400">{pr.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[pr.tag] || 'bg-slate-100 text-slate-600'}`}>
                    {pr.tag}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{pr.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{pr.excerpt}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Media Assets */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Media Assets</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {MEDIA_ASSETS.map((asset, i) => (
              <a key={i} href={asset.file}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-[#2EC4B6] hover:bg-slate-50 transition-colors group">
                <div>
                  <p className="font-medium text-slate-900 group-hover:text-[#2EC4B6] transition-colors">{asset.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{asset.size}</p>
                </div>
                <Download className="w-4 h-4 text-slate-400 group-hover:text-[#2EC4B6] transition-colors" />
              </a>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Media Inquiries</h2>
          <p className="text-slate-500 mb-4">For interviews, quotes, and editorial requests, contact our press team.</p>
          <a href="mailto:press@24therapy.ai"
            className="inline-flex items-center gap-2 text-[#2EC4B6] font-medium hover:underline">
            <Mail className="w-4 h-4" />
            press@24therapy.ai
          </a>
        </section>
      </div>
    </div>
  );
}
