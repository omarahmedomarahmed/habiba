import type { DisplayCurrency } from "./convert";

/** The console's leading currency, per operator's browser. Dollars unless switched. */
export const ADMIN_CURRENCY_COOKIE = "24t_admin_ccy";

export function adminCurrencyFrom(value: string | undefined): DisplayCurrency {
  return value === "EGP" ? "EGP" : "USD";
}
