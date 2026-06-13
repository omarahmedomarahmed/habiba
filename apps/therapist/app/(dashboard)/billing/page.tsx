"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, Calendar, Clock, Download, Filter,
  CheckCircle2, AlertCircle, XCircle, FileText, CreditCard,
  BarChart3, ChevronRight, Plus, Search, RefreshCw
} from "lucide-react";
import { cn, formatDate, formatCurrency, getInitials } from "@/lib/utils";
import { billingAPI } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  paid: { label: "Paid", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
  pending: { label: "Pending", color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock },
  overdue: { label: "Overdue", color: "text-red-700 bg-red-50 border-red-200", icon: AlertCircle },
  failed: { label: "Failed", color: "text-red-700 bg-red-100 border-red-300", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-gray-600 bg-gray-50 border-gray-200", icon: XCircle },
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-slate-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </div>
            <div className="w-16 h-6 bg-slate-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TherapistBillingPage() {
  const [activeTab, setActiveTab] = useState<"transactions" | "summary" | "subscription">("transactions");
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [invData, sumData, subData] = await Promise.allSettled([
        billingAPI.invoices({ page, limit: LIMIT, status: statusFilter !== "all" ? statusFilter : undefined }),
        billingAPI.summary(),
        billingAPI.subscriptions(),
      ]);

      if (invData.status === "fulfilled") {
        const d = invData.value as any;
        const list = d?.data || d || [];
        setInvoices(Array.isArray(list) ? list : []);
        setTotal(d?.total || list.length);
      }

      if (sumData.status === "fulfilled") setSummary(sumData.value);
      if (subData.status === "fulfilled") setSubscription(subData.value);
    } catch (err: any) {
      setError("Unable to load billing data.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredInvoices = invoices.filter((inv: any) => {
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      (inv.patient_name || "").toLowerCase().includes(query) ||
      (inv.invoice_number || "").toLowerCase().includes(query) ||
      (inv.description || "").toLowerCase().includes(query)
    );
  });

  const monthlyRevenue = summary?.monthly_revenue || invoices.filter(i => i.status === "paid").reduce((s: number, i: any) => s + (i.amount || 0), 0);
  const pendingAmount = invoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((s: number, i: any) => s + (i.amount || 0), 0);

  return (
    <div className="p-6 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">Invoices, payments, and subscription management</p>
        </div>
        <div className="flex gap-2">
          {error && <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">{error}</span>}
          <button onClick={() => { setLoading(true); fetchData(); }} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 h-9 px-4 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary/90">
            <Plus className="w-4 h-4" /> Create Invoice
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-stat animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-3" />
              <div className="h-7 bg-slate-200 rounded w-1/2" />
            </div>
          ))
        ) : (
          <>
            <div className="card-stat">
              <div className="flex items-center gap-2 text-green-600 mb-2"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">This Month</span></div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(monthlyRevenue)}</div>
              <div className="text-xs text-slate-500 mt-0.5">Revenue collected</div>
            </div>
            <div className="card-stat">
              <div className="flex items-center gap-2 text-amber-600 mb-2"><Clock className="w-4 h-4" /><span className="text-xs font-medium">Outstanding</span></div>
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(pendingAmount)}</div>
              <div className="text-xs text-slate-500 mt-0.5">Awaiting payment</div>
            </div>
            <div className="card-stat">
              <div className="flex items-center gap-2 text-blue-600 mb-2"><FileText className="w-4 h-4" /><span className="text-xs font-medium">Total Invoices</span></div>
              <div className="text-2xl font-bold text-slate-900">{total}</div>
              <div className="text-xs text-slate-500 mt-0.5">All time</div>
            </div>
            <div className="card-stat">
              <div className="flex items-center gap-2 text-purple-600 mb-2"><TrendingUp className="w-4 h-4" /><span className="text-xs font-medium">Collection Rate</span></div>
              <div className="text-2xl font-bold text-slate-900">{summary?.collection_rate ? `${summary.collection_rate}%` : "–"}</div>
              <div className="text-xs text-slate-500 mt-0.5">Paid vs billed</div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        {[
          { id: "transactions", label: "Invoices" },
          { id: "summary", label: "Summary" },
          { id: "subscription", label: "Subscription" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id ? "border-secondary text-secondary" : "border-transparent text-slate-500 hover:text-slate-700")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      {activeTab === "transactions" && (
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient, invoice number..."
              className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="h-10 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
            <option value="failed">Failed</option>
          </select>
          <button className="h-10 px-3 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === "transactions" && (
        loading ? <LoadingSkeleton /> : filteredInvoices.length > 0 ? (
          <div className="space-y-2">
            {filteredInvoices.map((inv: any) => {
              const status = inv.status || "pending";
              const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
              const Icon = cfg.icon;
              return (
                <div key={inv.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center text-secondary text-sm font-bold shrink-0">
                      {getInitials(inv.patient_name || "P")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{inv.patient_name || "Patient"}</span>
                        <span className="text-xs text-slate-400">{inv.invoice_number || `#${inv.id.slice(0, 8)}`}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {inv.description || "Therapy session"}
                        {inv.billing_code && ` · ${inv.billing_code}`}
                        {" · "}
                        {inv.session_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "–")}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-900">{formatCurrency(inv.amount || 0)}</div>
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 mt-0.5", cfg.color)}>
                        <Icon className="w-2.5 h-2.5" /> {cfg.label}
                      </span>
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-slate-600">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {total > LIMIT && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50">Previous</button>
                <span className="text-sm text-slate-500">Page {page} of {Math.ceil(total/LIMIT)}</span>
                <button onClick={() => setPage(p => p+1)} disabled={page*LIMIT>=total} className="px-4 py-2 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50">Next</button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-700 mb-1">No invoices found</h3>
            <p className="text-sm text-slate-400">Invoices will appear here after creating sessions.</p>
          </div>
        )
      )}

      {activeTab === "summary" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {summary ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">Revenue Summary</h3>
              {Object.entries(summary).map(([key, val]) => (
                <div key={key} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-sm font-medium text-slate-800">{String(val)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Revenue summary will appear here</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "subscription" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Your Subscription</h3>
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium",
                  subscription.status === "active" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
                  {subscription.status || "–"}
                </span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{subscription.plan_name || "Professional"}</div>
              {subscription.price && <div className="text-slate-500">${subscription.price}/month</div>}
              {subscription.next_billing_date && (
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Next billing: {new Date(subscription.next_billing_date).toLocaleDateString()}
                </div>
              )}
              <button className="mt-4 h-10 px-6 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Manage Subscription
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No subscription data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Reviewed: 2026-06-13 — 24Therapy audit
