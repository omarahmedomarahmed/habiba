import Link from "next/link";
import { FileText, Mail, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service | 24Therapy.ai",
  description: "24Therapy.ai Terms of Service — your legal agreement with us.",
};

export default function TermsPage() {
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
            <FileText className="w-8 h-8 text-[#2EC4B6]" />
            <h1 className="text-3xl md:text-4xl font-bold">Terms of Service</h1>
          </div>
          <p className="text-white/70">Last updated: {lastUpdated}</p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="prose prose-slate max-w-none">

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
            <p className="text-amber-800 text-sm">
              <strong>Important:</strong> 24Therapy.ai is a clinical documentation and practice management tool. It is not a medical device, does not provide clinical advice, and does not replace licensed clinical judgment. AI-generated content must be reviewed by the licensed therapist before use in clinical records.
            </p>
          </div>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-600 mb-6">
            By accessing or using 24Therapy.ai ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization. These Terms apply to all users — therapists, patients, administrators, and any other users.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">2. Description of Service</h2>
          <p className="text-gray-600 mb-6">
            24Therapy.ai provides a Software-as-a-Service (SaaS) mental health practice management platform including: AI-assisted clinical documentation, telehealth infrastructure, patient management, billing, scheduling, clinical assessments, and practice analytics. The Service is designed for use by licensed mental health professionals ("Therapists") and their patients ("Patients").
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">3. Eligibility</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li><strong>Therapist accounts:</strong> You must be a licensed mental health professional in good standing in your jurisdiction. You represent that your license is valid and that you will maintain it throughout your use of the Service.</li>
            <li><strong>Patient accounts:</strong> You must be 18 years or older, or have parental/guardian consent if under 18 and applicable law permits.</li>
            <li><strong>Organization accounts:</strong> The signing representative must have authority to bind the organization to these Terms.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">4. Account Responsibilities</h2>
          <p className="text-gray-600 mb-4">You are responsible for:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>Maintaining the security of your account credentials and enabling MFA.</li>
            <li>All activity that occurs under your account.</li>
            <li>Notifying us immediately of any unauthorized access at <a href="mailto:security@24therapy.ai" className="text-[#2EC4B6] hover:underline">security@24therapy.ai</a>.</li>
            <li>Ensuring patient consent is obtained before using AI documentation, recording, or any data sharing features.</li>
            <li>Complying with all applicable laws, including HIPAA, state licensing requirements, and mandatory reporting obligations.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">5. AI Features — Critical Limitations</h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
            <p className="text-red-800 text-sm font-medium mb-2">Clinical Responsibility Notice</p>
            <p className="text-red-700 text-sm">
              All AI-generated content (notes, summaries, suggestions, risk alerts, assessments) must be reviewed, validated, and edited as needed by the licensed therapist before being used as a clinical record. The therapist bears full clinical and legal responsibility for all clinical decisions and documentation. 24Therapy AI features are tools to assist, not replace, clinical judgment.
            </p>
          </div>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>AI-generated notes are drafts that require clinician review and approval.</li>
            <li>AI risk alerts are informational signals — not clinical diagnoses or mandatory action triggers.</li>
            <li>AI copilot suggestions are clinical aids — the therapist remains solely responsible for all interventions.</li>
            <li>AI does not provide diagnoses, prescriptions, or mandatory clinical recommendations.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">6. HIPAA Compliance</h2>
          <p className="text-gray-600 mb-6">
            24Therapy.ai operates as a Business Associate under HIPAA. A Business Associate Agreement (BAA) is executed with all therapist and organization accounts as part of onboarding. The BAA governs the handling of Protected Health Information. Therapists are Covered Entities responsible for ensuring their use of the Service complies with HIPAA and applicable state privacy laws.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">7. Acceptable Use</h2>
          <p className="text-gray-600 mb-4">You may not use the Service to:</p>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>Violate any applicable laws, including HIPAA, state licensing laws, or professional ethics rules.</li>
            <li>Provide clinical services beyond your scope of practice or licensure.</li>
            <li>Misrepresent your identity, credentials, or licensure status.</li>
            <li>Share patient data with unauthorized parties.</li>
            <li>Attempt to reverse-engineer, scrape, or extract AI models or training data.</li>
            <li>Use the Service to train competing AI models without express written permission.</li>
            <li>Conduct unauthorized penetration testing or security scanning.</li>
            <li>Use the platform for any activity that could harm patients or violate the standard of care.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">8. Subscription and Payment</h2>
          <ul className="list-disc pl-6 text-gray-600 mb-6 space-y-2">
            <li>Subscriptions are billed monthly or annually as selected at sign-up.</li>
            <li>Annual subscriptions are non-refundable after 30 days of the start date.</li>
            <li>Price changes will be communicated 30 days in advance.</li>
            <li>Accounts with failed payments will be suspended after 7 days and deleted after 30 days.</li>
            <li>Usage-based AI features (overages above plan limits) are billed monthly in arrears.</li>
            <li>All payments are processed by Stripe. We do not store payment card numbers.</li>
          </ul>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">9. Data Ownership</h2>
          <p className="text-gray-600 mb-6">
            You retain ownership of all clinical data, patient records, and practice data you input into the Service. 24Therapy.ai does not claim ownership of your clinical content. Upon account termination, you may export your data in standard formats. We will retain data for the period required by law before deletion.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">10. Intellectual Property</h2>
          <p className="text-gray-600 mb-6">
            The 24Therapy.ai platform, including software, design, AI models, and all non-clinical content, is owned by 24Therapy, Inc. and protected by copyright and trade secret law. You receive a limited, non-exclusive, non-transferable license to use the Service for its intended purpose during your active subscription.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">11. Disclaimers</h2>
          <p className="text-gray-600 mb-6">
            THE SERVICE IS PROVIDED "AS IS." 24THERAPY MAKES NO WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE OR NON-INFRINGEMENT. AI-GENERATED CONTENT IS PROVIDED AS A DRAFT AND MAY CONTAIN ERRORS. 24THERAPY DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">12. Limitation of Liability</h2>
          <p className="text-gray-600 mb-6">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, 24THERAPY'S TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT PAID BY YOU TO 24THERAPY IN THE 12 MONTHS PRECEDING THE CLAIM. 24THERAPY SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">13. Termination</h2>
          <p className="text-gray-600 mb-6">
            Either party may terminate the subscription with 30 days written notice. 24Therapy may terminate immediately for violation of these Terms, non-payment, or conduct that poses a risk to patient safety. Upon termination, you have 30 days to export your data before it is scheduled for deletion per our retention policy.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">14. Governing Law</h2>
          <p className="text-gray-600 mb-6">
            These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles. Disputes shall be resolved by binding arbitration under AAA rules, except for injunctive relief which may be sought in any court of competent jurisdiction.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">15. Changes to Terms</h2>
          <p className="text-gray-600 mb-6">
            We may modify these Terms with 30 days notice. Material changes will be communicated by email. Continued use after the effective date constitutes acceptance.
          </p>

          <h2 className="text-xl font-bold text-[#0A2342] mb-4">16. Contact</h2>
          <div className="bg-gray-50 rounded-xl p-6 flex items-start gap-4">
            <Mail className="w-5 h-5 text-[#2EC4B6] flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-[#0A2342] mb-1">Legal Team</p>
              <p className="text-gray-600 text-sm">
                For legal inquiries or Terms questions:<br />
                <a href="mailto:legal@24therapy.ai" className="text-[#2EC4B6] hover:underline">legal@24therapy.ai</a>
              </p>
            </div>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200 flex flex-wrap gap-4 text-sm text-gray-500">
          <Link href="/privacy" className="hover:text-[#2EC4B6]">Privacy Policy</Link>
          <Link href="/security" className="hover:text-[#2EC4B6]">Security & HIPAA</Link>
          <Link href="/contact" className="hover:text-[#2EC4B6]">Contact Us</Link>
        </div>
      </div>
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
