"use server";

import { revalidatePath } from "next/cache";

import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import { getSettings, writeSettingsGroup } from "@/lib/settings";

export type CheckinsState = { ok?: boolean; error?: string };

/**
 * 🔴 W2-A08: the check-in channel's numbers, editable, and a halt that can be
 * lifted. The owner's, like every other setting (`lib/admin/access.ts`).
 *
 * The page said "every number is yours to change" and nothing edited
 * `settings.checkins`; worse, nothing read a stored value either, because the
 * group had no parser. Both halves are fixed: this writes the group, and
 * `parseGroup` bounds it on the way in.
 */
export async function saveCheckins(_prev: CheckinsState, formData: FormData): Promise<CheckinsState> {
  const actor = await requireRole("super_admin");
  const current = (await getSettings()).checkins;

  const saved = await writeSettingsGroup({
    group: "checkins",
    value: {
      ...current,
      enabled: formData.get("enabled") === "on",
      everyHours: Number(formData.get("everyHours")),
      quietFromHour: Number(formData.get("quietFromHour")),
      quietToHour: Number(formData.get("quietToHour")),
      muteRateHalt: Number(formData.get("haltPercent")) / 100,
    },
    updatedBy: actor.userId,
  });

  await audit({
    actor,
    category: "admin",
    action: "settings.checkins",
    resourceType: "platform_settings",
    resourceId: "checkins",
    reason: JSON.stringify(saved),
  });
  revalidatePath("/admin/checkins");
  return { ok: true };
}

/**
 * Resume a halted channel by measuring the mute rate from now. The people who
 * muted stay muted; the channel is judged again on the cadence it has now.
 * A reason is required: this is the act that lets it message people again.
 */
export async function resumeCheckins(reason: string): Promise<CheckinsState> {
  const actor = await requireRole("super_admin");
  const problem = reasonProblem(reason);
  if (problem) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t(problem) };
  }

  const current = (await getSettings()).checkins;
  await writeSettingsGroup({
    group: "checkins",
    value: { ...current, measuredSince: new Date().toISOString() },
    updatedBy: actor.userId,
  });
  await audit({
    actor,
    category: "admin",
    action: "checkins.resumed",
    resourceType: "platform_settings",
    resourceId: "checkins",
    reason: reasonText(reason),
  });
  revalidatePath("/admin/checkins");
  return { ok: true };
}
