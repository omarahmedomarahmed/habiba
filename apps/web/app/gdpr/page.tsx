import Link from 'next/link';
import { Shield, Mail } from 'lucide-react';

export default function GDPRPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-[#2EC4B6] rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[#0A2342]">24Therapy</span>
        </Link>

        <h1 className="text-4xl font-bold text-slate-900 mb-3">GDPR & Data Rights</h1>
        <p className="text-slate-500 mb-10">Last updated: June 2026</p>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Your Rights Under GDPR</h2>
            <p className="text-slate-600 leading-relaxed">
              If you are located in the European Economic Area (EEA) or the United Kingdom, you have the following rights regarding your personal data under the General Data Protection Regulation (GDPR) and UK GDPR:
            </p>
            <ul className="mt-4 space-y-2 text-slate-600">
              {[
                'Right to access — request a copy of the personal data we hold about you',
                'Right to rectification — correct inaccurate or incomplete data',
                'Right to erasure ("right to be forgotten") — request deletion of your data',
                'Right to restrict processing — limit how we use your data',
                'Right to data portability — receive your data in a machine-readable format',
                'Right to object — object to processing based on legitimate interests or for direct marketing',
                'Rights related to automated decision-making — not be subject to solely automated decisions with legal effects',
              ].map((right, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2EC4B6] mt-2 shrink-0" />
                  {right}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Legal Basis for Processing</h2>
            <p className="text-slate-600 leading-relaxed">We process your personal data on the following legal bases:</p>
            <div className="mt-4 space-y-3">
              {[
                { basis: 'Contractual necessity', desc: 'Processing required to deliver the therapy platform services you have signed up for.' },
                { basis: 'Legitimate interests', desc: 'Analytics, security monitoring, and fraud prevention.' },
                { basis: 'Consent', desc: 'Marketing communications and optional feature enrollment.' },
                { basis: 'Legal obligation', desc: 'HIPAA compliance, tax records, and regulatory reporting.' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="font-semibold text-slate-900 text-sm">{item.basis}</p>
                  <p className="text-slate-500 text-sm mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Data Transfers</h2>
            <p className="text-slate-600 leading-relaxed">
              24Therapy is headquartered in the United States. When we transfer personal data from the EEA or UK to the US, we rely on Standard Contractual Clauses (SCCs) approved by the European Commission. We maintain a Data Processing Agreement (DPA) with all sub-processors handling EU/UK personal data.
            </p>
            <p className="text-slate-600 leading-relaxed mt-3">
              Key sub-processors include: OpenAI (AI services), Neon (database hosting), Railway (cloud infrastructure), Stripe (payment processing), and Daily.co (video). Each maintains appropriate GDPR safeguards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Retention Periods</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-600 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-900">Data Type</th>
                    <th className="text-left py-2 font-semibold text-slate-900">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Account data', '7 years after account closure (tax/legal)'],
                    ['Session transcripts', '7 years (HIPAA minimum)'],
                    ['Clinical notes', '7 years (HIPAA minimum)'],
                    ['Audit logs', '6 years'],
                    ['Marketing data', 'Until consent withdrawn'],
                    ['Support tickets', '3 years'],
                  ].map(([type, period], i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4">{type}</td>
                      <td className="py-2.5">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">Exercising Your Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              To exercise any of your GDPR rights, submit a request to our Data Protection Officer. We will respond within 30 days. For complex requests, we may extend this by an additional 60 days with notice.
            </p>
            <div className="mt-4 bg-[#f0fbfa] rounded-xl p-5 border border-[#2EC4B6]/30">
              <p className="font-semibold text-slate-900 mb-1">Data Protection Officer</p>
              <a href="mailto:dpo@24therapy.ai" className="flex items-center gap-2 text-[#2EC4B6] hover:underline text-sm">
                <Mail className="w-4 h-4" />
                dpo@24therapy.ai
              </a>
            </div>
            <p className="text-slate-500 text-sm mt-4">
              You also have the right to lodge a complaint with your local data protection authority. In the EU, this is your national DPA. In the UK, this is the Information Commissioner&apos;s Office (ICO).
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4 text-sm text-slate-400">
          <Link href="/privacy" className="hover:text-[#2EC4B6]">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-[#2EC4B6]">Terms of Service</Link>
          <Link href="/hipaa" className="hover:text-[#2EC4B6]">HIPAA Notice</Link>
          <Link href="/security" className="hover:text-[#2EC4B6]">Security</Link>
        </div>
      </div>
    </div>
  );
}
