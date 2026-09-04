"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import {
  dashboardLink,
  priceProblem,
  requestPayout,
  startOnboarding,
} from "@/lib/billing/connect";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { users, type TherapistProfile } from "@/lib/db/schema";

export type SettingsState = { error?: string; ok?: boolean };

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireUser();

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "First name is required." };

  const [existing] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  // Explicit field list, merged over what is already there. The old settings
  // handler wrote whatever the form sent straight into the row, which is how
  // the string "3-5 years" ended up going into an integer column — and because
  // the resulting error aborted the whole UPDATE, both onboarding and settings
  // silently saved nothing. Merging matters too: this form does not carry the
  // copilot voice preference, and replacing the object outright would erase it.
  const profile: TherapistProfile = {
    ...(existing?.profile ?? {}),
    credentials: String(formData.get("credentials") ?? "").trim() || undefined,
    licenseType: String(formData.get("licenseType") ?? "").trim() || undefined,
    licenseNumber: String(formData.get("licenseNumber") ?? "").trim() || undefined,
    licenseState: String(formData.get("licenseState") ?? "").trim() || undefined,
  };

  await db
    .update(users)
    .set({
      firstName,
      lastName: String(formData.get("lastName") ?? "").trim(),
      profile,
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.userId));

  await audit({
    actor,
    category: "auth",
    action: "profile.update",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Persist the copilot read-aloud voice.
 *
 * Read-modify-write on the same jsonb column as the profile form above, for the
 * same reason: two forms writing one document must both merge or one of them
 * silently deletes the other's fields.
 */
export async function saveVoicePreference(
  voice: string,
  speed: number,
): Promise<{ ok: boolean }> {
  const actor = await requireUser();

  const allowed = ["british_female", "british_male", "american_female", "american_male"] as const;
  if (!(allowed as readonly string[]).includes(voice)) return { ok: false };

  const [existing] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);

  await db
    .update(users)
    .set({
      profile: {
        ...(existing?.profile ?? {}),
        voice: voice as TherapistProfile["voice"],
        voiceSpeed: Math.min(2, Math.max(0.5, Number(speed) || 1)),
      },
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.userId));

  return { ok: true };
}

/* ------------------------------------------------------- payouts (Connect) -- */

/** Send the therapist to Stripe to onboard, or back to finish what they left. */
export async function connectPayouts(): Promise<SettingsState> {
  const actor = await requireUser();
  const result = await startOnboarding({
    userId: actor.userId,
    email: actor.email,
    organizationId: actor.organizationId,
  });
  if (result.error || !result.url) return { error: result.error ?? "Could not reach Stripe." };

  await audit({
    actor,
    category: "billing",
    action: "connect.onboarding.start",
    resourceType: "user",
    resourceId: actor.userId,
  });

  redirect(result.url);
}

export async function openPayoutDashboard(): Promise<SettingsState> {
  const actor = await requireUser();
  const result = await dashboardLink(actor.userId);
  if (result.error || !result.url) return { error: result.error ?? "Could not reach Stripe." };
  redirect(result.url);
}

export async function payOutNow(): Promise<SettingsState> {
  const actor = await requireUser();
  const result = await requestPayout(actor.userId);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "billing",
    action: "connect.payout.request",
    resourceType: "user",
    resourceId: actor.userId,
  });

  revalidatePath("/billing");
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * The therapist's own 30-minute rate, and whether we may take their 24Therapy
 * bill out of the fee on their next patient payment.
 */
export async function updatePaymentSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireUser();

  const dollars = Number(String(formData.get("rateDollars") ?? "0").trim() || "0");
  const cents = Math.round(dollars * 100);
  const problem = priceProblem(cents, (await getSettings()).session);
  if (problem) return { error: problem };

  await db
    .update(users)
    .set({
      sessionRateCents: cents,
      autoSettleFromEarnings: formData.get("autoSettle") === "on",
      updatedAt: new Date(),
    })
    .where(eq(users.id, actor.userId));

  revalidatePath("/settings");
  revalidatePath("/billing");
  return { ok: true };
}
