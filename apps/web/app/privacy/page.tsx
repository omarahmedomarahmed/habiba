import Link from "next/link";
import { Shield, Mail, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | 24Therapy.ai",
  description: "24Therapy.ai Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  const lastUpdated = "June 4, 2026";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#1F5EFF] text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-[#2EC4B6]" />
            <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
          </div>
          <p className="text-white/70">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="prose prose-slate max-w-none">

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-8">
            <p className="text-blue-800 text-sm font-medium mb-2">HIPAA Notice</p>
            <p className="text-blue-700 text-sm">
              24Therapy.ai is a HIPAA-covered entity and business associate. Protected Health Information (PHI) is handled under separate HIPAA Notices of Privacy Practices provided to patients and covered by Business Associate Agreements (BAAs) signed with healthcare providers.
            </p>
          </div>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">1. Who We Are</h2>
          <p className="text-gray-600 mb-6">
            24Therapy.ai ("24Therapy," "we," "us," or "our") is a mental health technology platform that provides AI-powered tools for licensed mental health professionals and their patients. We operate the 24Therapy.ai website, therapist portal, patient portal, and admin portal.
          </p>
          <p className="text-gray-600 mb-6">
            Our principal address is: 24Therapy, Inc., [Address]. For privacy inquiries, contact us at <a href="mailto:privacy@24therapy.ai" className="text-[#2EC4B6] hover:underline">privacy@24therapy.ai</a>.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">2. Information We Collect</h2>

          <h3 className="text-lg font-semibold text-[#0A2342] mb-3">2.1 Information You Provide</h3>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li><strong>Account registration:</strong> Name, email address, phone number, professional credentials (for therapists), and practice information.</li>
            <li><strong>Patient intake forms:</strong> Demographic information, insurance details, presenting concerns, and clinical history (PHI — handled per HIPAA).</li>
            <li><strong>Payment information:</strong> Credit card details processed and stored by Stripe. We do not store raw payment card numbers.</li>
            <li><strong>Communications:</strong> Messages you send us via email, contact forms, or in-platform support.</li>
            <li><strong>Profile information:</strong> Professional bio, photo, credentials, and specializations (therapist profiles listed publicly).</li>
          </ul>

          <h3 className="text-lg font-semibold text-[#0A2342] mb-3">2.2 Information Collected Automatically</h3>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li><strong>Usage data:</strong> Pages visited, features used, click paths, session duration, feature adoption rates.</li>
            <li><strong>Device and browser information:</strong> Browser type, operating system, screen resolution, IP address, device identifiers.</li>
            <li><strong>Log data:</strong> Server logs including timestamps, request methods, and response codes.</li>
            <li><strong>Cookies and tracking:</strong> Session cookies for authentication, functional cookies for preferences, and analytics cookies.</li>
          </ul>

          <h3 className="text-lg font-semibold text-[#0A2342] mb-3">2.3 Protected Health Information (PHI)</h3>
          <p className="text-gray-600 mb-6">
            PHI collected within the platform (patient records, session notes, assessments, diagnoses, and clinical data) is handled exclusively under our HIPAA obligations. PHI is never used for marketing, advertising, or product analytics. PHI is encrypted at rest (AES-256) and in transit (TLS 1.3), and access is strictly controlled by role-based permissions.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>Provide, maintain, and improve the 24Therapy platform and services.</li>
            <li>Process payments and manage subscriptions via Stripe.</li>
            <li>Send transactional emails (account confirmation, password resets, billing receipts).</li>
            <li>Send product updates and clinical feature announcements (opt-out available).</li>
            <li>Respond to support requests and inquiries.</li>
            <li>Monitor platform security, prevent fraud, and enforce our Terms of Service.</li>
            <li>Comply with legal obligations and regulatory requirements.</li>
            <li>Analyze aggregate, de-identified usage patterns to improve the product.</li>
          </ul>
          <p className="text-gray-600 mb-6 font-medium">
            We do not sell your personal information. We do not use PHI for AI model training without explicit written consent.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">4. AI and Machine Learning</h2>
          <p className="text-gray-600 mb-6">
            24Therapy uses AI to generate clinical notes, provide copilot suggestions, detect risk signals, and build patient memory. Key privacy commitments:
          </p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>Session transcripts and notes are not used to train third-party models without consent.</li>
            <li>PHI sent to AI APIs (OpenAI, Anthropic) is covered under executed BAAs with those providers.</li>
            <li>AI-generated content is always reviewed and approved by the licensed therapist before becoming a clinical record.</li>
            <li>Risk detection alerts are generated by AI but always require clinical human review — AI does not take autonomous clinical action.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">5. Information Sharing</h2>
          <p className="text-gray-600 mb-4">We share your information only in these limited circumstances:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li><strong>Service providers:</strong> Subprocessors who help us operate (Stripe for payments, AWS for hosting, OpenAI for AI features) under strict data processing agreements.</li>
            <li><strong>Your organization:</strong> If you use 24Therapy through an employer, practice, or health system, your administrator has access to platform usage and clinical data per your organization's settings.</li>
            <li><strong>Legal requirements:</strong> When required by law, court order, or government authority.</li>
            <li><strong>Business transfers:</strong> In the event of a merger or acquisition, subject to continuity of these privacy protections.</li>
            <li><strong>Your explicit consent:</strong> Any other sharing requires your explicit written consent.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">6. Data Retention</h2>
          <p className="text-gray-600 mb-6">
            Clinical records (PHI) are retained for the minimum period required by applicable state and federal law — typically 7 years for adult records and until age 25 for minor records. Non-clinical account data is retained while your account is active and for 90 days following deletion. You may request data deletion by contacting <a href="mailto:privacy@24therapy.ai" className="text-[#2EC4B6] hover:underline">privacy@24therapy.ai</a>, subject to legal retention requirements.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">7. Security</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>All data encrypted at rest using AES-256</li>
            <li>All data in transit protected by TLS 1.3</li>
            <li>Multi-factor authentication available for all accounts</li>
            <li>Role-based access control (RBAC) enforced at every API endpoint</li>
            <li>Full audit logging of all PHI access events</li>
            <li>Annual penetration testing and SOC 2 Type II certification (in progress)</li>
            <li>Infrastructure hosted on AWS with VPC isolation and private subnets</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">8. Your Rights</h2>
          <p className="text-gray-600 mb-4">Depending on your location, you may have the following rights:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li><strong>Access:</strong> Request a copy of your personal data we hold.</li>
            <li><strong>Correction:</strong> Request correction of inaccurate data.</li>
            <li><strong>Deletion:</strong> Request deletion of your data (subject to legal retention obligations).</li>
            <li><strong>Portability:</strong> Request your data in a machine-readable format.</li>
            <li><strong>Opt-out:</strong> Opt out of marketing communications at any time.</li>
            <li><strong>HIPAA rights:</strong> Patients have additional rights under HIPAA, including right to access, amendment, and accounting of disclosures of PHI.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">9. Cookies</h2>
          <p className="text-gray-600 mb-6">
            We use essential cookies for authentication and platform function. Analytics cookies (via privacy-respecting tools) help us understand feature usage. You can disable non-essential cookies in your browser settings. Disabling cookies may impact platform functionality.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">10. Children's Privacy</h2>
          <p className="text-gray-600 mb-6">
            24Therapy is designed for licensed mental health professionals and their adult patients. For practices serving minors, therapists are responsible for obtaining parental/guardian consent in accordance with applicable law. We do not knowingly collect personal information from children under 13 without parental consent.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">11. Changes to This Policy</h2>
          <p className="text-gray-600 mb-6">
            We may update this policy. Material changes will be communicated by email and/or in-platform notification at least 30 days before taking effect. Continued use of the platform after changes constitutes acceptance.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">12. Contact</h2>
          <div className="bg-gray-50 rounded-xl p-6 flex items-start gap-4">
            <Mail className="w-5 h-5 text-[#2EC4B6] flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-[#0A2342] mb-1">Privacy Officer</p>
              <p className="text-gray-600 text-sm">
                For privacy inquiries, data subject requests, or HIPAA-related questions:<br />
                <a href="mailto:privacy@24therapy.ai" className="text-[#2EC4B6] hover:underline">privacy@24therapy.ai</a>
              </p>
            </div>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/terms" className="hover:text-[#2EC4B6]">Terms of Service</Link>
          <Link href="/security" className="hover:text-[#2EC4B6]">Security & HIPAA</Link>
          <Link href="/contact" className="hover:text-[#2EC4B6]">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
