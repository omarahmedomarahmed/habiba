"use server";

import { revalidatePath } from "next/cache";

import { rotateCode } from "@/lib/data/sponsor-admin";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

/**
 * 🔴 53.9 / C237 — the code is revocable and rotatable, and rotating it is one
 * tap for the sponsor rather than a support ticket.
 *
 * Admin only. A code that stops working strands every poster in the building, so
 * it is the same authority as ending somebody's benefit.
 */
export async function replaceCode(): Promise<{ ok: true }> {
  const actor = await requireSponsorAdmin();
  await rotateCode(actor.sponsorId);
  revalidatePath("/sponsor/code");
  return { ok: true };
}
