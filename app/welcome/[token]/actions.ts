"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { redeemAccountLink } from "@/lib/auth/account-links";
import { getI18n } from "@/lib/i18n/server";
import { callerKey, consume } from "@/lib/rate-limit";

export type WelcomeState = { error?: string };

/**
 * 🔴 W2-A06: set the password an invitation or a reset link was minted for.
 * The token is the capability; `redeemAccountLink` spends it once, in the
 * same transaction that writes the password.
 */
export async function chooseWelcomePassword(
  _prev: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const { t } = await getI18n();
  // A token is 32 random bytes, so this guards the password hashing, not the guess.
  if (!(await consume(await callerKey("welcome"), 10, 15 * 60)).allowed) return { error: t("nf.body") };

  const result = await redeemAccountLink(
    String(formData.get("token") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if ("error" in result) {
    /* 🔴 B29 / B48: the portal's own floor, in the reader's language. */
    return { error: result.error === "weak" ? t("welcome.weak", { count: result.minimum }) : t("nf.body") };
  }

  await audit({
    actor: null,
    category: "auth",
    action: "password.set_from_link",
    resourceType: result.audience,
    resourceId: result.accountId,
  });
  /* 🔴 B29 / B43 / B48: each portal's sign-in reads `set=1` and says the password is set. */
  redirect(`${result.signIn}?set=1`);
}
