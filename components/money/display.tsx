"use client";

import { createContext, useContext } from "react";

import type { DisplayCurrency } from "@/lib/money/convert";

/**
 * 🔴 WHICH CURRENCY A FIGURE IS SHOWN IN, AND AT WHAT RATE, FROM THE SERVER.
 *
 * Every person using the product reads pounds first and dollars on a hover or
 * a tap. The public website reads dollars first, and the operator console
 * reads dollars first with a switch to pounds that changes only the console.
 *
 * The rate arrives with the page from the operator's setting, once, in the
 * root layout; a nested provider changes only which currency leads. A
 * browser never picks a rate of its own.
 */
type Display = { primary: DisplayCurrency; rateMicro: number };

const MoneyDisplay = createContext<Display>({ primary: "EGP", rateMicro: 0 });

export function MoneyDisplayProvider({
  primary,
  rateMicro,
  children,
}: {
  primary?: DisplayCurrency;
  rateMicro?: number;
  children: React.ReactNode;
}) {
  const parent = useContext(MoneyDisplay);
  return (
    <MoneyDisplay.Provider value={{ primary: primary ?? parent.primary, rateMicro: rateMicro ?? parent.rateMicro }}>
      {children}
    </MoneyDisplay.Provider>
  );
}

export function useMoneyDisplay(): Display {
  return useContext(MoneyDisplay);
}
