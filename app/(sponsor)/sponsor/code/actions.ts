"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { mintFirstCode, rotateCode } from "@/lib/data/sponsor-admin";
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

/**
 * 🔴 W2-S03: the first code, which only an operator could make.
 *
 * Admin only, like a rotation, and it refuses when a code is already live, so it
 * cannot strand a poster the way a replacement does.
 */
export async function createCode(): Promise<{ ok?: true; error?: string }> {
  const actor = await requireSponsorAdmin();
  const result = await mintFirstCode(actor.sponsorId);
  if (result.error) return { error: result.error };

  await audit({
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "sponsor.code_created",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
  });

  revalidatePath("/sponsor/code");
  return { ok: true };
}
