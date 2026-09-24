"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { markAllRead } from "@/lib/data/notifications";

/**
 * 🔴 W2-T06: clear the list. `markAllRead` existed and nothing called it, so
 * a notice stayed unread for ever once it had been seen somewhere else.
 * Scoped to the signed-in clinician inside the function; nothing is taken from
 * the form.
 */
export async function readAll(): Promise<void> {
  const actor = await requireUser();
  await markAllRead(actor);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
