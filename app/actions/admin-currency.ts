"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/guard";
import { ADMIN_CURRENCY_COOKIE } from "@/lib/money/admin-currency";

/**
 * The console's own currency switch. Staff only, and it changes nothing a
 * patient, clinician or company sees: their screens lead with pounds whatever
 * this says.
 */
export async function setAdminCurrency(currency: "USD" | "EGP"): Promise<void> {
  await requireStaff();
  (await cookies()).set(ADMIN_CURRENCY_COOKIE, currency === "EGP" ? "EGP" : "USD", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/admin", "layout");
}
