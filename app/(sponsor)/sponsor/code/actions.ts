"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
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

  /*
   * 🔴 0086 — a rotation strands every printed poster in the building, and the
   * support call that follows starts with "nobody rotated it". Now it can.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.code_rotated",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
  });

  revalidatePath("/sponsor/code");
  return { ok: true };
}
