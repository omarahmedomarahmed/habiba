"use client";

import { useState } from "react";
import {
  CreditCard, DollarSign, Receipt, Download, CheckCircle,
  Clock, AlertCircle, ChevronRight, Shield, Building2,
  FileText, Calendar, Plus, ExternalLink, HelpCircle,
  RefreshCw, X, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentStatus = "paid" | "pending" | "overdue" | "insurance_pending" | "write_off";
type InvoiceType = "session" | "copay" | "no_show" | "subscription";

interface PatientInvoice {
  id: string;
  invoice_number: string;
  type: InvoiceType;
  description: string;
  service_date: string;
  due_date?: string;
  amount_cents: number;
  insurance_paid_cents?: number;
  patient_responsibility_cents: number;
  status: PaymentStatus;
  cpt_code?: string;
  paid_at?: string;
  provider: string;
}

const MOCK_INVOICES: PatientInvoice[] = [
  {
    id: "inv1",
    invoice_number: "INV-2024-0234",
    type: "session",
    description: "Individual Therapy Session — 50 min",
    service_date: "Dec 23, 2024",
    due_date: "Jan 6, 2025",
    amount_cents: 20000,
    insurance_paid_cents: 15000,
    patient_responsibility_cents: 5000,
    status: "pending",
    cpt_code: "90837",
    provider: "Dr. Sarah Chen, PsyD",
  },
  {
    id: "inv2",
    invoice_number: "INV-2024-0221",
    type: "session",
    description: "Individual Therapy Session — 50 min",
    service_date: "Dec 16, 2024",
    due_date: "Dec 30, 2024",
    amount_cents: 20000,
    insurance_paid_cents: 15000,
    patient_responsibility_cents: 5000,
    status: "paid",
    cpt_code: "90837",
    paid_at: "Dec 20, 2024",
    provider: "Dr. Sarah Chen, PsyD",
  },
  {
    id: "inv3",
    invoice_number: "INV-2024-0208",
    type: "session",
    description: "Individual Therapy Session — 50 min",
    service_date: "Dec 9, 2024",
    amount_cents: 20000,
    insurance_paid_cents: 15000,
    patient_responsibility_cents: 5000,
    status: "paid",
    cpt_code: "90837",
    paid_at: "Dec 14, 2024",
    provider: "Dr. Sarah Chen, PsyD",
  },
  {
    id: "inv4",
    invoice_number: "INV-2024-0190",
    type: "session",
    description: "Initial Intake Session — 90 min",
    service_date: "Nov 18, 2024",
    amount_cents: 35000,
    insurance_paid_cents: 28000,
    patient_responsibility_cents: 7000,
    status: "paid",
    cpt_code: "90791",
    paid_at: "Nov 25, 2024",
    provider: "Dr. Sarah Chen, PsyD",
  },
  {
    id: "inv5",
    invoice_number: "INV-2024-0175",
    type: "no_show",
    description: "Late Cancellation Fee (< 24h notice)",
    service_date: "Nov 4, 2024",
    amount_cents: 5000,
    patient_responsibility_cents: 5000,
    status: "overdue",
    due_date: "Nov 18, 2024",
    provider: "Dr. Sarah Chen, PsyD",
  },
];

const INSURANCE_INFO = {
  provider: "Blue Cross Blue Shield",
  plan: "PPO Gold",
  member_id: "XY12345678",
  group_number: "GRP-9021",
  copay: "$50",
  deductible_annual: 1000,
  deductible_met: 650,
  oop_max: 3000,
  oop_spent: 1200,
  verification_status: "verified",
};

const STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  paid: { label: "Paid", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  pending: { label: "Due", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  overdue: { label: "Overdue", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  insurance_pending: { label: "Insurance Processing", icon: RefreshCw, color: "text-orange-600", bg: "bg-orange-50" },
  write_off: { label: "Write-off", icon: X, color: "text-gray-500", bg: "bg-gray-100" },
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function PatientBillingPage() {
  const [activeTab, setActiveTab] = useState<"invoices" | "insurance" | "payments">("invoices");
  const [showPayModal, setShowPayModal] = useState<PatientInvoice | null>(null);

  const pendingTotal = MOCK_INVOICES.filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((sum, i) => sum + i.patient_responsibility_cents, 0);

  const ytdPaid = MOCK_INVOICES.filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.patient_responsibility_cents, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Your invoices, insurance details, and payment history</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={cn(
            "bg-white rounded-2xl border p-4",
            pendingTotal > 0 ? "border-orange-200" : "border-gray-200"
          )}>
            <div className="text-xs text-gray-500 mb-1">Balance Due</div>
            <div className={cn("text-2xl font-bold", pendingTotal > 0 ? "text-orange-600" : "text-gray-900")}>
              {formatCents(pendingTotal)}
            </div>
            {pendingTotal > 0 && (
              <div className="text-xs text-orange-500 mt-1">Includes overdue</div>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">Paid This Year</div>
            <div className="text-2xl font-bold text-gray-900">{formatCents(ytdPaid)}</div>
            <div className="text-xs text-gray-400 mt-1">Out-of-pocket</div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500 mb-1">Deductible</div>
            <div className="text-2xl font-bold text-gray-900">
              ${INSURANCE_INFO.deductible_met}
            </div>
            <div className="text-xs text-gray-400 mt-1">of ${INSURANCE_INFO.deductible_annual} met</div>
          </div>
        </div>

        {/* Deductible Progress */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Annual Deductible Progress</span>
            <span className="text-sm text-gray-500">
              ${INSURANCE_INFO.deductible_met} / ${INSURANCE_INFO.deductible_annual}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#2EC4B6] rounded-full"
              style={{ width: `${(INSURANCE_INFO.deductible_met / INSURANCE_INFO.deductible_annual) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              ${INSURANCE_INFO.deductible_annual - INSURANCE_INFO.deductible_met} remaining
            </span>
            <span>Resets Jan 1, 2025</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          {[
            { id: "invoices" as const, label: "Invoices" },
            { id: "insurance" as const, label: "Insurance" },
            { id: "payments" as const, label: "Payment Methods" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white text-[#0A2342] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <div className="space-y-3">
            {MOCK_INVOICES.map((invoice) => {
              const statusCfg = STATUS_CONFIG[invoice.status];
              const StatusIcon = statusCfg.icon;
              return (
                <div
                  key={invoice.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{invoice.description}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {invoice.service_date} · {invoice.provider}
                        {invoice.cpt_code && ` · CPT ${invoice.cpt_code}`}
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0",
                      statusCfg.bg, statusCfg.color
                    )}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                    <div>
                      <div className="text-gray-400 mb-0.5">Billed</div>
                      <div className="font-medium text-gray-700">{formatCents(invoice.amount_cents)}</div>
                    </div>
                    {invoice.insurance_paid_cents !== undefined && (
                      <div>
                        <div className="text-gray-400 mb-0.5">Insurance</div>
                        <div className="font-medium text-emerald-600">-{formatCents(invoice.insurance_paid_cents)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-gray-400 mb-0.5">Your Share</div>
                      <div className="font-bold text-gray-900">{formatCents(invoice.patient_responsibility_cents)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                      {invoice.status === "paid" && invoice.paid_at && `Paid ${invoice.paid_at}`}
                      {invoice.status === "pending" && invoice.due_date && `Due ${invoice.due_date}`}
                      {invoice.status === "overdue" && invoice.due_date && `Was due ${invoice.due_date}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                        <Download className="w-3 h-3" /> Receipt
                      </button>
                      {(invoice.status === "pending" || invoice.status === "overdue") && (
                        <button
                          onClick={() => setShowPayModal(invoice)}
                          className="bg-[#0A2342] hover:bg-[#0d2d56] text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                        >
                          Pay {formatCents(invoice.patient_responsibility_cents)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Insurance Tab */}
        {activeTab === "insurance" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#2EC4B6]" />
                  Active Insurance
                </h2>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Provider", value: INSURANCE_INFO.provider },
                  { label: "Plan", value: INSURANCE_INFO.plan },
                  { label: "Member ID", value: INSURANCE_INFO.member_id },
                  { label: "Group Number", value: INSURANCE_INFO.group_number },
                  { label: "Therapy Copay", value: INSURANCE_INFO.copay },
                  { label: "Out-of-Pocket Max", value: `$${INSURANCE_INFO.oop_max}` },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="text-xs text-gray-400 mb-0.5">{item.label}</div>
                    <div className="text-sm font-medium text-gray-800">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Out-of-Pocket Tracker</h2>
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Out-of-Pocket Maximum</span>
                  <span className="font-medium">${INSURANCE_INFO.oop_spent} / ${INSURANCE_INFO.oop_max}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1F5EFF] rounded-full"
                    style={{ width: `${(INSURANCE_INFO.oop_spent / INSURANCE_INFO.oop_max) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  ${INSURANCE_INFO.oop_max - INSURANCE_INFO.oop_spent} remaining until 100% coverage
                </p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs text-blue-700">
                  Once you meet your out-of-pocket maximum, insurance covers 100% of covered services for the rest of the year.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900 text-sm">Understanding Your Benefits</h2>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Questions about your insurance coverage for mental health services? We can help you understand your benefits.
              </p>
              <a
                href="mailto:billing@24therapy.ai"
                className="text-sm text-[#2EC4B6] hover:text-[#26b0a3] font-medium flex items-center gap-1"
              >
                Contact our billing team <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#2EC4B6]" />
                Saved Payment Methods
              </h2>
              <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-[#1F5EFF] rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">VISA</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Visa ending in 4242</div>
                    <div className="text-xs text-gray-400">Expires 08/2027</div>
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Default</span>
              </div>
              <button className="w-full border border-dashed border-gray-300 rounded-xl p-3 text-sm text-gray-500 hover:border-[#2EC4B6] hover:text-[#2EC4B6] transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add payment method
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-[#2EC4B6]" />
                <h2 className="font-semibold text-gray-900 text-sm">Payment Security</h2>
              </div>
              <p className="text-sm text-gray-500">
                All payments are processed securely by Stripe. Your card details are encrypted and never stored on our servers. Transactions are protected by 256-bit SSL encryption.
              </p>
            </div>
          </div>
        )}

        {/* HIPAA Notice */}
        <div className="mt-8 bg-gray-100 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Billing information is protected under HIPAA. For billing questions, contact{" "}
            <a href="mailto:billing@24therapy.ai" className="text-[#2EC4B6] hover:underline">
              billing@24therapy.ai
            </a>
          </p>
        </div>
      </div>

      {/* Pay Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">Pay Invoice</h2>
              <button onClick={() => setShowPayModal(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Invoice</span>
                <span className="font-medium">{showPayModal.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Service</span>
                <span className="font-medium">{showPayModal.description}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount Due</span>
                <span className="font-bold text-gray-900">{formatCents(showPayModal.patient_responsibility_cents)}</span>
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 mb-4">
              <div className="w-10 h-6 bg-[#1F5EFF] rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">VISA</span>
              </div>
              <div className="text-sm">
                <div className="font-medium text-gray-900">Visa ending in 4242</div>
                <div className="text-xs text-gray-400">Default payment method</div>
              </div>
              <button className="ml-auto text-xs text-[#2EC4B6] hover:underline">Change</button>
            </div>
            <button
              onClick={() => {
                setShowPayModal(null);
              }}
              className="w-full bg-[#0A2342] hover:bg-[#0d2d56] text-white py-3 rounded-xl font-semibold"
            >
              Pay {formatCents(showPayModal.patient_responsibility_cents)}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Secured by Stripe · SSL encrypted
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
