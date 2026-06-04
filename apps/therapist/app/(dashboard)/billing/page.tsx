"use client";

import { useState } from "react";
import {
  DollarSign, TrendingUp, Calendar, Clock, Download, Filter,
  CheckCircle2, AlertCircle, XCircle, Clock as ClockIcon,
  FileText, CreditCard, BarChart3, ChevronRight, Plus, Search
} from "lucide-react";
import { cn, formatDate, formatCurrency, getInitials } from "@/lib/utils";

const MOCK_TRANSACTIONS = [
  {
    id: "t1", patient_name: "Sarah Chen", patient_id: "p1",
    session_date: "2025-12-15", amount: 150, status: "paid",
    billing_code: "90837", description: "Individual therapy, 53+ min",
    invoice_number: "INV-2025-1234", paid_at: "2025-12-16",
    insurance: "BlueCross", payment_method: "insurance",
  },
  {
    id: "t2", patient_name: "Michael Torres", patient_id: "p2",
    session_date: "2025-12-14", amount: 120, status: "pending",
    billing_code: "90834", description: "Individual therapy, 38-52 min",
    invoice_number: "INV-2025-1233", paid_at: null,
    insurance: "Aetna", payment_method: "insurance",
  },
  {
    id: "t3", patient_name: "James Rodriguez", patient_id: "p3",
    session_date: "2025-12-14", amount: 200, status: "paid",
    billing_code: "90837", description: "Individual therapy, 53+ min",
    invoice_number: "INV-2025-1232", paid_at: "2025-12-15",
    insurance: null, payment_method: "credit_card",
  },
  {
    id: "t4", patient_name: "Emma Williams", patient_id: "p4",
    session_date: "2025-12-09", amount: 150, status: "overdue",
    billing_code: "90837", description: "Individual therapy, 53+ min",
    invoice_number: "INV-2025-1231", paid_at: null,
    insurance: "UnitedHealth", payment_method: "insurance",
  },
  {
    id: "t5", patient_name: "Olivia Kim", patient_id: "p5",
    session_date: "2025-12-01", amount: 120, status: "paid",
    billing_code: "90834", description: "Individual therapy, 38-52 min",
    invoice_number: "INV-2025-1230", paid_at: "2025-12-02",
    insurance: null, payment_method: "credit_card",
  },
  {
    id: "t6", patient_name: "David Patel", patient_id: "p6",
    session_date: "2025-11-28", amount: 150, status: "failed",
    billing_code: "90837", description: "Individual therapy, 53+ min",
    invoice_number: "INV-2025-1229", paid_at: null,
    insurance: "Cigna", payment_method: "insurance",
  },
];

const STATUS_CONFIG = {
  paid: { label: "Paid", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
  pending: { label: "Pending", color: "text-amber-700 bg-amber-50 border-amber-200", icon: ClockIcon },
  overdue: { label: "Overdue", color: "text-red-700 bg-red-50 border-red-200", icon: AlertCircle },
  failed: { label: "Failed", color: "text-red-700 bg-red-100 border-red-300", icon: XCircle },
};

export default function BillingPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("30d");

  const filtered = MOCK_TRANSACTIONS.filter((t) => {
    const matchSearch = !search || t.patient_name.toLowerCase().includes(search.toLowerCase()) || t.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = MOCK_TRANSACTIONS.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0);
  const pendingRevenue = MOCK_TRANSACTIONS.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);
  const overdueRevenue = MOCK_TRANSACTIONS.filter((t) => t.status === "overdue").reduce((s, t) => s + t.amount, 0);
  const totalSessions = MOCK_TRANSACTIONS.length;

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Billing & Revenue</h1>
            <p className="text-ink-500 text-sm mt-1">Track payments, invoices, and insurance claims</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Invoice
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {["7d", "30d", "90d", "1y"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                period === p ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
              )}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "1 Year"}
            </button>
          ))}
        </div>

        {/* Revenue Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Revenue", value: formatCurrency(totalRevenue),
              sub: "Collected", icon: DollarSign, color: "text-green-600 bg-green-50",
            },
            {
              label: "Pending", value: formatCurrency(pendingRevenue),
              sub: "Awaiting payment", icon: ClockIcon, color: "text-amber-600 bg-amber-50",
            },
            {
              label: "Overdue", value: formatCurrency(overdueRevenue),
              sub: "Action required", icon: AlertCircle, color: "text-red-600 bg-red-50",
            },
            {
              label: "Sessions Billed", value: totalSessions,
              sub: "This period", icon: FileText, color: "text-blue-600 bg-blue-50",
            },
          ].map((stat) => (
            <div key={stat.label} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ink-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-ink-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{stat.sub}</p>
                </div>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Chart Placeholder */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900">Revenue Overview</h2>
            <button className="text-xs text-primary-600 font-medium flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Full Report
            </button>
          </div>
          <div className="h-36 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl flex items-end gap-2 px-4 pb-4">
            {[45, 65, 40, 85, 70, 90, 75, 55, 80, 95, 60, 70].map((h, i) => (
              <div key={i} className="flex-1 flex items-end">
                <div
                  className="w-full bg-primary-600 rounded-t-sm opacity-70 hover:opacity-100 transition-opacity"
                  style={{ height: `${h}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-ink-400">
            <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span>
            <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
            <span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search by patient or invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "paid", "pending", "overdue", "failed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  statusFilter === s ? "bg-primary-600 text-white" : "bg-surface-tertiary text-ink-600 hover:bg-surface-quaternary"
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-tertiary bg-surface-secondary">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Invoice</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Method</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-tertiary">
                {filtered.map((t) => {
                  const status = STATUS_CONFIG[t.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = status.icon;
                  return (
                    <tr key={t.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary-700">{getInitials(t.patient_name)}</span>
                          </div>
                          <span className="font-medium text-sm text-ink-900">{t.patient_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-ink-600 font-mono">{t.invoice_number}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-ink-500">
                        {formatDate(t.session_date)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs bg-surface-tertiary text-ink-600 px-2 py-1 rounded font-mono">{t.billing_code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-ink-900">{formatCurrency(t.amount)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-ink-500">
                          <CreditCard className="w-3.5 h-3.5" />
                          {t.insurance || t.payment_method.replace("_", " ")}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={cn("flex items-center gap-1 w-fit px-2 py-1 rounded-full text-xs font-medium border", status.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <button className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition-colors">
                            View
                          </button>
                          {t.status === "overdue" && (
                            <button className="text-xs text-red-600 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                              Remind
                            </button>
                          )}
                          {t.status === "failed" && (
                            <button className="text-xs text-amber-600 hover:text-amber-700 font-medium px-2 py-1 rounded hover:bg-amber-50 transition-colors">
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Common CPT Codes */}
        <div>
          <h2 className="text-lg font-semibold text-ink-900 mb-4">Common CPT Codes</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { code: "90837", desc: "Individual therapy, 53+ min", rate: 150 },
              { code: "90834", desc: "Individual therapy, 38-52 min", rate: 120 },
              { code: "90832", desc: "Individual therapy, 16-37 min", rate: 80 },
              { code: "90847", desc: "Family therapy, with patient", rate: 175 },
              { code: "90846", desc: "Family therapy, without patient", rate: 150 },
              { code: "90853", desc: "Group therapy", rate: 65 },
              { code: "90791", desc: "Psychiatric diagnostic eval", rate: 250 },
              { code: "96130", desc: "Psychological testing, 1st hr", rate: 200 },
            ].map((cpt) => (
              <div key={cpt.code} className="card p-3 hover:shadow-sm transition-all">
                <div className="font-mono text-sm font-semibold text-primary-700">{cpt.code}</div>
                <p className="text-xs text-ink-600 mt-0.5 line-clamp-2">{cpt.desc}</p>
                <p className="text-sm font-bold text-ink-900 mt-1">{formatCurrency(cpt.rate)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
