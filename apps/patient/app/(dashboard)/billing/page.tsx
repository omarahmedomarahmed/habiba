"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard, DollarSign, Receipt, Download, CheckCircle,
  Clock, AlertCircle, ChevronRight, Shield, Building2,
  FileText, Calendar, ExternalLink, RefreshCw, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { billingAPI } from "@/lib/api";

type PaymentStatus = "paid" | "pending" | "overdue" | "insurance_pending" | "write_off";

const STATUS_CONFIG: Record<PaymentStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  paid: { label: "Paid", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
  pending: { label: "Due", icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
  overdue: { label: "Overdue", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  insurance_pending: { label: "Insurance Processing", icon: RefreshCw, color: "text-orange-600", bg: "bg-orange-50" },
  write_off: { label: "Write-off", icon: X, color: "text-gray-500", bg: "bg-gray-100" },
};

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatAmount = (amount: number | undefined) => {
  if (!amount) return "$0.00";
  // Handle both cents (>1000) and dollars
  return amount > 1000 ? formatCents(amount) : `$${amount.toFixed(2)}`;
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
            <div className="w-16 h-6 bg-gray-200 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[1,2,3].map(j => <div key={j} className="h-8 bg-gray-100 rounded" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PatientBillingPage() {
  const [activeTab, setActiveTab] = useState<"invoices" | "insurance" | "payments">("invoices");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  const fetchBillingData = useCallback(async () => {
    try {
      setError(null);
      const [invoiceData, subData] = await Promise.allSettled([
        billingAPI.invoices({ page, limit: LIMIT }),
        billingAPI.subscription(),
      ]);

      if (invoiceData.status === "fulfilled") {
        const d = invoiceData.value as any;
        const list = d?.data || d || [];
        setInvoices(Array.isArray(list) ? list : []);
        setTotal(d?.total || list.length);
      }

      if (subData.status === "fulfilled") {
        setSubscription(subData.value);
      }
    } catch (err: any) {
      setError("Unable to load billing data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchBillingData(); }, [fetchBillingData]);

  // Compute summary from real invoice data
  const pendingTotal = invoices
    .filter((i) => i.status === "pending" || i.status === "overdue")
    .reduce((sum, i) => sum + (i.patient_responsibility_cents || i.amount_cents || 0), 0);

  const ytdPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + (i.patient_responsibility_cents || i.amount_paid_cents || i.amount_cents || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing & Payments</h1>
            <p className="text-sm text-gray-500 mt-1">Your invoices, insurance details, and payment history</p>
          </div>
          <button onClick={() => { setLoading(true); fetchBillingData(); }} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-sm text-amber-700">{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-7 bg-gray-200 rounded w-1/2" />
              </div>
            ))
          ) : (
            <>
              <div className={cn("bg-white rounded-2xl border p-4", pendingTotal > 0 ? "border-orange-200" : "border-gray-200")}>
                <div className="text-xs text-gray-500 mb-1">Balance Due</div>
                <div className={cn("text-2xl font-bold", pendingTotal > 0 ? "text-orange-600" : "text-gray-900")}>
                  {formatCents(pendingTotal)}
                </div>
                {pendingTotal > 0 && <div className="text-xs text-orange-500 mt-1">Action required</div>}
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Paid This Year</div>
                <div className="text-2xl font-bold text-gray-900">{formatCents(ytdPaid)}</div>
                <div className="text-xs text-gray-400 mt-1">Out-of-pocket</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-xs text-gray-500 mb-1">Plan</div>
                <div className="text-lg font-bold text-gray-900 truncate">{subscription?.plan_name || "–"}</div>
                <div className="text-xs text-gray-400 mt-1 capitalize">{subscription?.status || "–"}</div>
              </div>
            </>
          )}
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
                activeTab === tab.id ? "bg-white text-[#0A2342] shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          loading ? <LoadingSkeleton /> : invoices.length > 0 ? (
            <div className="space-y-3">
              {invoices.map((invoice: any) => {
                const status = (invoice.status || "pending") as PaymentStatus;
                const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const amountCents = invoice.amount_cents || Math.round((invoice.amount || 0) * 100);
                const insuranceCents = invoice.insurance_paid_cents || Math.round((invoice.insurance_paid || 0) * 100);
                const patientCents = invoice.patient_responsibility_cents || amountCents - insuranceCents;
                return (
                  <div key={invoice.id} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">
                          {invoice.description || `Invoice ${invoice.invoice_number || invoice.id}`}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {invoice.service_date || (invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : "–")}
                          {invoice.provider_name && ` · ${invoice.provider_name}`}
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0", statusCfg.bg, statusCfg.color)}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-gray-400 mb-0.5">Billed</div>
                        <div className="font-medium text-gray-700">{formatCents(amountCents)}</div>
                      </div>
                      {insuranceCents > 0 && (
                        <div>
                          <div className="text-gray-400 mb-0.5">Insurance</div>
                          <div className="font-medium text-emerald-600">-{formatCents(insuranceCents)}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-gray-400 mb-0.5">Your Share</div>
                        <div className="font-semibold text-gray-900">{formatCents(patientCents)}</div>
                      </div>
                    </div>
                    {(status === "pending" || status === "overdue") && (
                      <button className="mt-3 w-full h-9 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#0A2342]/90 transition-colors">
                        Pay {formatCents(patientCents)}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Pagination */}
              {total > LIMIT && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / LIMIT)}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * LIMIT >= total}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-700 mb-1">No invoices yet</h3>
              <p className="text-sm text-gray-400">Your billing history will appear here after your first session.</p>
            </div>
          )
        )}

        {/* Insurance Tab */}
        {activeTab === "insurance" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            {subscription?.insurance ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{subscription.insurance.provider}</div>
                    <div className="text-xs text-gray-500">{subscription.insurance.plan}</div>
                  </div>
                  <span className="ml-auto text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">Verified</span>
                </div>
                {[
                  { label: "Member ID", value: subscription.insurance.member_id },
                  { label: "Group Number", value: subscription.insurance.group_number },
                  { label: "Copay", value: subscription.insurance.copay },
                ].map(({ label, value }) => value && (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-700 mb-1">No insurance on file</h3>
                <p className="text-sm text-gray-400">Contact your provider to add insurance information.</p>
              </div>
            )}
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === "payments" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-1">Manage Payment Methods</h3>
            <p className="text-sm text-gray-400 mb-4">Securely add or update your payment information.</p>
            <button className="h-10 px-6 bg-[#0A2342] text-white rounded-xl text-sm font-medium hover:bg-[#0A2342]/90 transition-colors">
              Add Payment Method
            </button>
          </div>
        )}

        {/* HIPAA Notice */}
        <div className="mt-8 flex items-start gap-2 text-xs text-gray-400">
          <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Your billing information is protected under HIPAA. All payment processing is handled via Stripe with PCI-DSS compliance.</span>
        </div>
      </div>
    </div>
  );
}
