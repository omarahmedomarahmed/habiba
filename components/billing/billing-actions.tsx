"use client";

import { useState, useTransition } from "react";

import { downgrade, paySessionCharge, upgradeToUnlimited } from "@/app/(app)/billing/actions";
import { Button } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";

export function BillingActions({
  plan,
  cancelAtPeriodEnd,
  billingEnabled,
  outstanding,
}: {
  plan: "payg" | "unlimited";
  cancelAtPeriodEnd: boolean;
  billingEnabled: boolean;
  outstanding: { id: string; amountCents: number; description: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result?.error) setError(result.error);
    });

  return (
    <div className="mt-4 space-y-3">
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {outstanding.length > 0 ? (
        <div className="space-y-2">
          {outstanding.map((charge) => (
            <div
              key={charge.id}
              className="flex items-center gap-3 rounded-xl bg-amber-50 px-3.5 py-2.5"
            >
              <span className="flex-1 text-sm text-amber-900">
                {charge.description} · {formatUsd(charge.amountCents)}
              </span>
              <Button
                size="sm"
                disabled={pending || !billingEnabled}
                onClick={() => run(() => paySessionCharge(charge.id))}
              >
                Pay
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {plan === "payg" ? (
        <Button full disabled={pending || !billingEnabled} onClick={() => run(upgradeToUnlimited)}>
          {pending ? "Opening checkout…" : "Switch to Unlimited"}
        </Button>
      ) : cancelAtPeriodEnd ? (
        <p className="rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-600">
          Unlimited ends at the close of your current period, then you return to pay as you go.
        </p>
      ) : (
        <Button variant="secondary" full disabled={pending} onClick={() => run(downgrade)}>
          {pending ? "Working…" : "Cancel Unlimited"}
        </Button>
      )}
    </div>
  );
}
