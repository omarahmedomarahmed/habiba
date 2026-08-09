"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { users, type TherapistProfile } from "@/lib/db/schema";

export type SettingsState = { error?: string; ok?: boolean };

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const actor = await requireUser();

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return { error: "First name is required." };

  // Explicit field list. The old settings handler wrote whatever the form sent
  // straight into the row, which is how the string "3-5 years" ended up going
  // into an integer column — and because the resulting error aborted the whole
  // UPDATE, both onboarding and settings silently saved nothing.
  const profile: TherapistProfile = {
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
