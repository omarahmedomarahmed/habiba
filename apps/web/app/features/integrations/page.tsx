"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap, Globe, ArrowRight, CheckCircle, Code, Shield, Database,
  RefreshCw, Clock, FileText, Bell, Heart, Activity, Lock,
  MessageSquare, BarChart3, GitBranch, Layers, Search, Star
} from "lucide-react";

type IntegrationCategory = "all" | "ehr" | "telehealth" | "billing" | "communication" | "analytics" | "identity";

const CATEGORIES = [
  { id: "all" as IntegrationCategory, label: "All Integrations" },
  { id: "ehr" as IntegrationCategory, label: "EHR / EMR" },
  { id: "telehealth" as IntegrationCategory, label: "Telehealth" },
  { id: "billing" as IntegrationCategory, label: "Billing & Payments" },
  { id: "communication" as IntegrationCategory, label: "Communication" },
  { id: "analytics" as IntegrationCategory, label: "Analytics & BI" },
  { id: "identity" as IntegrationCategory, label: "Identity & SSO" },
];

const INTEGRATIONS = [
  // EHR
  { id: "epic", category: "ehr" as IntegrationCategory, name: "Epic", desc: "Full FHIR R4 bidirectional sync. Patient demographics, notes, diagnoses, medications.", badge: "Enterprise", status: "live", logo: "E" },
  { id: "cerner", category: "ehr" as IntegrationCategory, name: "Cerner / Oracle Health", desc: "Bidirectional patient records, clinical notes, and order integration.", badge: "Enterprise", status: "live", logo: "C" },
  { id: "simplepractice", category: "ehr" as IntegrationCategory, name: "SimplePractice", desc: "Import patient records, session history, and notes. Sync calendar and availability.", badge: "Popular", status: "live", logo: "SP" },
  { id: "therapynotes", category: "ehr" as IntegrationCategory, name: "TherapyNotes", desc: "Migrate patient data, treatment notes, and billing records to 24Therapy.ai.", badge: "", status: "live", logo: "TN" },
  { id: "athena", category: "ehr" as IntegrationCategory, name: "Athenahealth", desc: "Patient demographics, scheduling, clinical notes via HL7 FHIR R4.", badge: "", status: "beta", logo: "A" },
  { id: "allscripts", category: "ehr" as IntegrationCategory, name: "Allscripts", desc: "Medication reconciliation, diagnosis import, and care coordination.", badge: "", status: "beta", logo: "AL" },
  // Telehealth
  { id: "zoom", category: "telehealth" as IntegrationCategory, name: "Zoom for Healthcare", desc: "HIPAA-compliant video sessions with AI scribe overlay and real-time note generation.", badge: "", status: "live", logo: "Z" },
  { id: "doxy", category: "telehealth" as IntegrationCategory, name: "Doxy.me", desc: "Embed 24Therapy AI in Doxy.me sessions for documentation and copilot support.", badge: "", status: "live", logo: "D" },
  // Billing
  { id: "stripe", category: "billing" as IntegrationCategory, name: "Stripe", desc: "Patient payment processing, subscription management, and revenue reconciliation.", badge: "Required", status: "live", logo: "S" },
  { id: "availity", category: "billing" as IntegrationCategory, name: "Availity", desc: "Insurance eligibility verification, ERA posting, and claim status tracking.", badge: "Popular", status: "live", logo: "AV" },
  { id: "officeally", category: "billing" as IntegrationCategory, name: "Office Ally", desc: "Electronic claim submission and ERA processing for mental health billing.", badge: "", status: "live", logo: "OA" },
  { id: "apexedi", category: "billing" as IntegrationCategory, name: "Apex EDI", desc: "Clearinghouse integration for insurance claim submission and adjudication.", badge: "", status: "beta", logo: "AP" },
  // Communication
  { id: "twilio", category: "communication" as IntegrationCategory, name: "Twilio", desc: "SMS/voice appointment reminders, crisis text line integration, and 2FA.", badge: "Required", status: "live", logo: "TW" },
  { id: "sendgrid", category: "communication" as IntegrationCategory, name: "SendGrid", desc: "HIPAA-compliant transactional email: notifications, reports, and care summaries.", badge: "", status: "live", logo: "SG" },
  { id: "slack", category: "communication" as IntegrationCategory, name: "Slack", desc: "Team notifications for risk alerts, scheduled reports, and admin notifications.", badge: "", status: "live", logo: "SL" },
  // Analytics
  { id: "tableau", category: "analytics" as IntegrationCategory, name: "Tableau", desc: "Export de-identified clinical and operational data for population-level dashboards.", badge: "Enterprise", status: "live", logo: "TB" },
  { id: "powerbi", category: "analytics" as IntegrationCategory, name: "Power BI", desc: "Real-time data connectors for custom mental health operational analytics.", badge: "Enterprise", status: "live", logo: "PBI" },
  { id: "looker", category: "analytics" as IntegrationCategory, name: "Looker / LookML", desc: "Pre-built LookML models for mental health practice analytics.", badge: "", status: "beta", logo: "LK" },
  // Identity
  { id: "okta", category: "identity" as IntegrationCategory, name: "Okta", desc: "Enterprise SSO with SAML 2.0. Automated provisioning/deprovisioning via SCIM.", badge: "Enterprise", status: "live", logo: "OK" },
  { id: "azure-ad", category: "identity" as IntegrationCategory, name: "Azure AD / Entra ID", desc: "Microsoft enterprise identity with SAML/OIDC and Microsoft 365 integration.", badge: "Enterprise", status: "live", logo: "AAD" },
  { id: "google-ws", category: "identity" as IntegrationCategory, name: "Google Workspace", desc: "Google SSO for practice staff with calendar and Google Meet integration.", badge: "", status: "live", logo: "GW" },
];

const API_CAPABILITIES = [
  { icon: Database, title: "REST API", desc: "Full CRUD operations on all platform entities. JSON over HTTPS with versioned endpoints (v1, v2)." },
  { icon: Zap, title: "Webhooks", desc: "Real-time event notifications for session events, note completion, risk alerts, and billing events." },
  { icon: GitBranch, title: "HL7 FHIR R4", desc: "Industry-standard health data exchange. Patient, Observation, Condition, MedicationRequest resources." },
  { icon: Globe, title: "GraphQL API", desc: "Flexible data querying for complex reporting and embedded analytics (Enterprise tier)." },
  { icon: Layers, title: "SDKs", desc: "Official JavaScript/TypeScript and Python SDKs with full TypeScript types." },
  { icon: Code, title: "Embedded Components", desc: "Drop-in React components for AI scribe, patient intake, and outcome tracking in your application." },
];

export default function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>("all");
  const [search, setSearch] = useState("");

  const filtered = INTEGRATIONS.filter((i) => {
    const matchCat = activeCategory === "all" || i.category === activeCategory;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.desc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#0A2342] to-[#0d2d55] text-white py-20">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-6">
            <Zap className="w-4 h-4 text-[#2EC4B6]" />
            <span className="text-sm font-medium">Integrations</span>
          </div>
          <h1 className="text-5xl font-bold mb-5">
            Connect Your Entire<br />
            <span className="text-[#2EC4B6]">Clinical Stack</span>
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            24Therapy.ai integrates with the tools your practice already uses — EHRs, billing systems, telehealth platforms, and identity providers. No more switching tabs.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/contact?type=integration" className="bg-[#2EC4B6] text-white px-7 py-3 rounded-xl font-semibold hover:bg-[#26b0a2] transition flex items-center gap-2">
              Request Integration <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#api" className="border border-white/30 text-white px-7 py-3 rounded-xl font-semibold hover:bg-white/10 transition">
              API Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-50 border-b border-slate-200 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { v: "20+", l: "Native Integrations" },
              { v: "FHIR R4", l: "HL7 Standard" },
              { v: "REST + Webhooks", l: "API Architecture" },
              { v: "< 15 min", l: "Avg. Setup Time" },
            ].map((s) => (
              <div key={s.l}>
                <div className="text-xl font-bold text-slate-900">{s.v}</div>
                <div className="text-sm text-slate-500">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration Browser */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search integrations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2EC4B6]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeCategory === cat.id
                      ? "bg-[#0A2342] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((integration) => (
              <div key={integration.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md hover:border-[#2EC4B6]/30 transition-all">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                    {integration.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-slate-900">{integration.name}</span>
                      {integration.badge && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          integration.badge === "Enterprise" ? "bg-violet-100 text-violet-700" :
                          integration.badge === "Popular" ? "bg-blue-100 text-blue-700" :
                          integration.badge === "Required" ? "bg-orange-100 text-orange-700" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {integration.badge}
                        </span>
                      )}
                    </div>
                    <div className={`text-xs font-medium ${integration.status === "live" ? "text-green-600" : "text-amber-600"}`}>
                      {integration.status === "live" ? "● Live" : "● Beta"}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{integration.desc}</p>
                <button className="mt-4 text-sm text-[#1F5EFF] font-medium flex items-center gap-1 hover:gap-2 transition-all">
                  Learn more <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No integrations found. <button onClick={() => { setSearch(""); setActiveCategory("all"); }} className="text-[#1F5EFF]">Clear filters</button></p>
            </div>
          )}
        </div>
      </section>

      {/* API Section */}
      <section id="api" className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Code className="w-4 h-4" />
              API-First Architecture
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Build on 24Therapy.ai</h2>
            <p className="text-slate-600 max-w-xl mx-auto">
              Every platform capability is accessible via API. Build custom integrations, embed AI features, or create white-label products.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {API_CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.title} className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="w-10 h-10 rounded-lg bg-[#0A2342] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#2EC4B6]" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{cap.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{cap.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Code snippet */}
          <div className="bg-[#0A2342] rounded-2xl p-8 text-sm font-mono">
            <div className="text-slate-400 mb-2"># Generate session note via API</div>
            <div className="text-white">
              <span className="text-yellow-300">curl</span> -X POST https://api.24therapy.ai/v1/sessions/note-generate \<br />
              {"  "}-H <span className="text-green-300">&quot;Authorization: Bearer $API_KEY&quot;</span> \<br />
              {"  "}-H <span className="text-green-300">&quot;Content-Type: application/json&quot;</span> \<br />
              {"  "}-d <span className="text-green-300">&apos;&#123;&quot;session_id&quot;: &quot;sess_abc123&quot;, &quot;format&quot;: &quot;SOAP&quot;, &quot;auto_approve&quot;: false&#125;&apos;</span>
            </div>
          </div>
        </div>
      </section>

      {/* Request Integration CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Globe className="w-12 h-12 text-[#2EC4B6] mx-auto mb-5" />
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Don&apos;t See Your Tool?</h2>
          <p className="text-slate-600 mb-8">
            We&apos;re constantly adding new integrations. If you need a specific EHR, billing system, or tool, let us know — we prioritize integration requests from customers.
          </p>
          <Link href="/contact?type=integration" className="bg-[#0A2342] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#1a3a6a] transition inline-flex items-center gap-2">
            Request Integration <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
