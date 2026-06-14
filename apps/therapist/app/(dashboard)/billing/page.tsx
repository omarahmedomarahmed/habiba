"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2, Zap, ArrowRight, CreditCard, Clock,
  DollarSign, RefreshCw, AlertCircle, ChevronRight, Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import { billingAPI } from "@/lib/api";

// ─── Plan definitions ──────────────────────────────────────────
const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 59,
    period: "mo",
    tagline: "20 sessions/month",
    badge: null,
    color: "border-blue-200 bg-blue-50/30",
    btnColor: "bg-blue-600 hover:bg-blue-700",
    bullets: [
      "20 sessions/month included (~$3 each)",
      "Unused sessions roll over (up to 20)",
      "Full AI scribe — SOAP, DAP, BIRP",
      "Session transcription",
      "AI Copilot during sessions",
      "HIPAA BAA included",
    ],
  },
  {
    key: "pro",
    name: "Unlimited",
    price: 99,
    period: "mo",
    tagline: "Unlimited sessions",
    badge: "Most Popular",
    color: "border-purple-300 bg-purple-50/30 ring-2 ring-purple-200",
    btnColor: "bg-purple-600 hover:bg-purple-700",
    bullets: [
      "Unlimited sessions — no caps",
      "Unlimited AI notes",
      "Advanced session transcription",
      "Emotional AI & crisis detection",
      "Priority AI processing",
      "Advanced analytics dashboard",
      "HIPAA BAA included",
    ],
  },
  {
    key: "practice",
    name: "Practice",
    price: 189,
    period: "mo",
    tagline: "For teams of therapists",
    badge: "Teams",
    color: "border-teal-200 bg-teal-50/30",
    btnColor: "bg-teal-600 hover:bg-teal-700",
    bullets: [
      "2 therapist seats included",
      "Additional seats at $85/mo each",
      "Shared patient management",
      "Team analytics dashboard",
      "Admin portal access",
      "HIPAA BAA included",
    ],
  },
];

// ─── Charge row ────────────────────────────────────────────────
function ChargeRow({ charge }: { charge: any }) {
  const isWaived  = charge.status === "waived";
  const isPending = charge.status === "pending";
  const isPaid    = charge.status === "paid" || charge.status === "included";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
        isWaived  ? "bg-green-100 text-green-700" :
        isPending ? "bg-amber-100 text-amber-700" :
                   "bg-slate-100 text-slate-600"
      )}>
        {isWaived ? "🎁" : isPending ? "!" : "✓"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">
          {charge.patient_name || "Session"}
        </div>
        <div className="text-xs text-slate-400">
          {charge.session_date
            ? new Date(charge.session_date).toLocaleDateString()
            : charge.created_at ? new Date(charge.created_at).toLocaleDateString() : "–"}
        </div>
      </div>
      <div className="text-right shrink-0">
        {isWaived ? (
          <span className="text-xs font-semibold text-green-600">Free 🎁</span>
        ) : (
          <span className="text-sm font-bold text-slate-900">
            ${Number(charge.amount_due_usd || charge.amount || 0).toFixed(2)}
          </span>
        )}
        <div className={cn(
          "text-[10px] font-medium",
          isWaived  ? "text-green-500" :
          isPending ? "text-amber-500" :
                     "text-slate-400"
        )}>
          {isWaived ? "waived" : isPending ? "pending" : "paid"}
        </div>
      </div>
      {isPending && charge.stripe_checkout_url && (
        <a
          href={charge.stripe_checkout_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 h-7 px-3 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
        >
          <DollarSign className="w-3 h-3" /> Pay
        </a>
      )}
    </div>
  );
}

// ─── Plan upgrade card ─────────────────────────────────────────
function PlanCard({
  plan,
  isCurrent,
  onSubscribe,
  loading,
}: {
  plan: typeof PLANS[0];
  isCurrent: boolean;
  onSubscribe: (key: string) => void;
  loading: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-5 flex flex-col gap-3 relative",
      plan.color
    )}>
      {plan.badge && (
        <span className={cn(
          "absolute -top-2.5 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-0.5 rounded-full text-white",
          plan.key === "pro" ? "bg-purple-600" : "bg-teal-600"
        )}>
          {plan.badge}
        </span>
      )}

      <div>
        <div className="text-base font-bold text-slate-900">{plan.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">{plan.tagline}</div>
      </div>

      <div className="flex items-end gap-1">
        <span className="text-3xl font-black text-slate-900">${plan.price}</span>
        <span className="text-sm text-slate-500 mb-1">/{plan.period}</span>
      </div>

      <ul className="space-y-1.5 flex-1">
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-xs text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
            {b}
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div className="h-10 rounded-xl bg-slate-200 text-slate-500 text-sm font-semibold flex items-center justify-center">
          Current plan
        </div>
      ) : (
        <button
          onClick={() => onSubscribe(plan.key)}
          disabled={loading}
          className={cn(
            "h-10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60",
            plan.btnColor
          )}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>Upgrade to {plan.name} <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────
export default function BillingPage() {
  const [usage, setUsage]         = useState<any>(null);
  const [charges, setCharges]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usageRes, chargesRes] = await Promise.allSettled([
        billingAPI.usageMe(),
        billingAPI.summary(),
      ]);
      if (usageRes.status === "fulfilled")   setUsage(usageRes.value);
      if (chargesRes.status === "fulfilled") {
        const d = chargesRes.value as any;
        setCharges(Array.isArray(d?.charges) ? d.charges : Array.isArray(d?.data) ? d.data : []);
      }
    } catch {
      setError("Could not load billing data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubscribe = async (planKey: string) => {
    setUpgrading(planKey);
    try {
      const res = await billingAPI.subscribe({
        plan_key: planKey,
        interval: "monthly",
        success_url: `${window.location.origin}/billing?upgraded=1`,
        cancel_url: `${window.location.origin}/billing`,
      }) as any;
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setError(err?.message || "Could not start upgrade. Please try again.");
    } finally {
      setUpgrading(null);
    }
  };

  const planKey = usage?.plan?.plan_key || usage?.plan_key || "pay_per_session";
  const trialUsed = usage?.trial_session_used ?? false;
  const pendingBill = usage?.pending_bills?.[0];
  const isPAYG = planKey === "pay_per_session" || planKey === "free_trial";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Billing & Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your subscription and session charges</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Current plan banner */}
      {!loading && (
        <div className={cn(
          "rounded-2xl p-5 flex items-center gap-4",
          isPAYG
            ? "bg-gradient-to-r from-[#0A2342] to-[#1F5EFF] text-white"
            : "bg-slate-900 text-white"
        )}>
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            {isPAYG ? <DollarSign className="w-6 h-6 text-white" /> : <Star className="w-6 h-6 text-yellow-300" />}
          </div>
          <div className="flex-1">
            {isPAYG ? (
              <>
                <div className="font-bold text-lg">Pay As You Go</div>
                {!trialUsed ? (
                  <div className="text-sm text-white/80 mt-0.5">
                    🎁 Your <strong>first session is free</strong> — no credit card needed.
                    After that, <strong>$6 per completed session</strong>.
                  </div>
                ) : (
                  <div className="text-sm text-white/80 mt-0.5">
                    $6 per completed session · <span className="text-yellow-300 font-semibold">Upgrade to save 50%</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-bold text-lg capitalize">{planKey.replace("_", " ")} Plan</div>
                <div className="text-sm text-white/80 mt-0.5">Active subscription</div>
              </>
            )}
          </div>
          {isPAYG && trialUsed && (
            <div className="flex flex-col gap-1 shrink-0">
              <div className="text-xs text-white/60 text-right">Starter saves you</div>
              <div className="text-2xl font-black text-yellow-300">50%</div>
              <div className="text-[10px] text-white/60 text-right">vs pay-per-session</div>
            </div>
          )}
        </div>
      )}

      {/* Pending bill alert */}
      {pendingBill && (
        <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-800">
              Payment required — ${Number(pendingBill.amount_due_usd).toFixed(2)} outstanding
            </div>
            <div className="text-xs text-red-600 mt-0.5">
              You need to pay this before scheduling your next session.
              Or upgrade to Starter and get 20 sessions for $59/mo.
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {pendingBill.stripe_checkout_url && (
              <a
                href={pendingBill.stripe_checkout_url}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-4 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                <DollarSign className="w-4 h-4" /> Pay ${Number(pendingBill.amount_due_usd).toFixed(2)}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Upgrade plans */}
      {isPAYG && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Upgrade your plan</h2>
            {trialUsed && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Save 50%+ vs pay-per-session
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={planKey === plan.key}
                onSubscribe={handleSubscribe}
                loading={upgrading === plan.key}
              />
            ))}
          </div>
          <p className="text-xs text-center text-slate-400 mt-3">
            All plans include a HIPAA BAA. Cancel anytime. Annual billing saves 2 months.
          </p>
        </div>
      )}

      {/* Session charge history */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          Session charges
        </h2>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : charges.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 divide-y divide-slate-50">
            {charges.map((c: any, i: number) => <ChargeRow key={c.id || i} charge={c} />)}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <CreditCard className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-500">No session charges yet</div>
            <p className="text-xs text-slate-400 mt-1">
              {!trialUsed
                ? "Your first session will be free — no charge here."
                : "Session charges appear after completing sessions."}
            </p>
            <Link href="/sessions/new" className="mt-4 inline-flex items-center gap-1 text-xs text-[#1F5EFF] font-medium hover:underline">
              Schedule your first session <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* Enterprise CTA */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="font-semibold text-slate-800">Need something bigger?</div>
          <div className="text-sm text-slate-500 mt-0.5">
            Enterprise plans for hospitals, universities, and healthcare systems.
            Custom pricing, SSO, EHR integration, dedicated support.
          </div>
        </div>
        <a
          href="mailto:enterprise@24therapy.ai"
          className="shrink-0 h-9 px-4 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-white transition-colors flex items-center gap-2"
        >
          Contact sales <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
