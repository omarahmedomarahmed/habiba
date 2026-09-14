"use server";

import { acceptInvitation, joinWithExistingAccount } from "@/lib/data/clinic-admin";
import { callerKey, consume } from "@/lib/rate-limit";

export type JoinState = { error?: string; ok?: boolean };

/**
 * 54.5 / 54.6 — the invited clinician accepts. PLAN.md C261, C267.
 *
 * 🔴 THIS CREATES AN `unverified` CLINICIAN AND NOTHING MORE.
 *
 * They then walk the same verification flow as anybody who signed up alone, because the
 * clinic's word is not evidence (C267). `acceptInvitation` passes `unverified`
 * explicitly even though it is the column default, so a reader does not have to open the
 * schema to learn whether a hospital's invitation confers a licence.
 *
 * 🔴 And the database refuses an acceptance on a row whose `terms_shown_at` is null, so
 * C261's sentence having been served is a constraint rather than a paragraph somebody
 * remembered to render.
 */
export async function accept(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const throttle = await consume(await callerKey("clinic-join"), 10, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Wait a few minutes." };

  const result = await acceptInvitation({
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
  });

  if (result.error) return { error: result.error };
  return { ok: true };
}

/**
 * 🔴 62.6 / 62.7 — the other half of the same screen: they already have an
 * account here, and it is already paid for.
 *
 * `joinWithExistingAccount` takes the seat with their own period end on it and
 * refuses to move a caseload; what it deliberately does NOT do is talk to the
 * payment gateway, because that is a network call and it sits inside a write
 * path. So the cancellation happens here, after the seat exists.
 *
 * 🔴 AT PERIOD END, NEVER IMMEDIATELY (C329). `cancelSubscription` is the
 * function that already means that, which is why this calls it rather than
 * writing its own update: a second implementation of "stop this renewing" is how
 * one of them ends up meaning "stop this now" and taking away a month somebody
 * paid for.
 *
 * 🔴 A FAILURE HERE DOES NOT FAIL THE JOIN. They are on the clinic's account
 * with a seat dated from their own renewal; a gateway having a bad afternoon
 * must not undo that. The worst case is a subscription that renews once more,
 * which is money we can return, and it is logged rather than silent.
 */
export async function joinWithAccount(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const throttle = await consume(await callerKey("clinic-join"), 10, 15 * 60);
  if (!throttle.allowed) return { error: "Too many attempts. Wait a few minutes." };

  const result = await joinWithExistingAccount({
    token: String(formData.get("token") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (result.error) return { error: result.error };

  if (result.cancelSubscriptionFor) {
    const { cancelSubscription } = await import("@/lib/billing/stripe");
    const { log } = await import("@/lib/logger");
    try {
      await cancelSubscription(result.cancelSubscriptionFor);
    } catch {
      log.error("could not stop a joining clinician's own subscription renewing");
    }
  }

  return { ok: true };
}
