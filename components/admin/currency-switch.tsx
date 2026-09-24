"use client";

import { useTransition } from "react";

import { setAdminCurrency } from "@/app/actions/admin-currency";
import type { DisplayCurrency } from "@/lib/money/convert";

/** Every figure in the console, in dollars or in pounds. The console only. */
export function CurrencySwitch({ current }: { current: DisplayCurrency }) {
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label="Currency" className="flex overflow-hidden rounded-lg border border-white/20 text-xs font-semibold">
      {(["USD", "EGP"] as const).map((c) => (
        <button
          key={c}
          type="button"
          disabled={pending || c === current}
          aria-pressed={c === current}
          onClick={() => start(() => setAdminCurrency(c))}
          className={c === current ? "bg-white px-2 py-1 text-navy-600" : "px-2 py-1 text-white/70 hover:text-white"}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
