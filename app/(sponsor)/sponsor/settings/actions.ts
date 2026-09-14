"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { removeIdentifierField, setIdentifierField, setListed } from "@/lib/data/sponsor-admin";
import { IDENTIFIER_KINDS, type IdentifierKind } from "@/lib/db/schema";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type GateState = { error?: string; ok?: boolean };

/**
 * How people join. PLAN.md 53.7, 53.8, C236, C238, C248.
 *
 * 🔴 Admin only, all three. Which identifier an organisation asks for decides who
 * can enrol; whether they are listed publicly decides whether the world knows they
 * buy therapy for their staff. Neither is a read.
 */
export async function addGate(_prev: GateState, formData: FormData): Promise<GateState> {
  const actor = await requireSponsorAdmin();

  const kind = String(formData.get("kind") ?? "");
  if (!IDENTIFIER_KINDS.includes(kind as IdentifierKind)) {
    return { error: "Pick one of the two." };
  }

  const result = await setIdentifierField({
    sponsorId: actor.sponsorId,
    kind: kind as IdentifierKind,
    domain: String(formData.get("domain") ?? "") || null,
    pattern: String(formData.get("pattern") ?? "") || null,
    shapeHint: String(formData.get("shapeHint") ?? "") || null,
  });

  if (result.error) return { error: result.error };

  /*
   * 🔴 0086 / C246 — which identifier an organisation asks for decides who can
   * enrol, and a weak gate is a decision the sponsor was warned about and made.
   * The audit row is what shows they made it, and when.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "gate.added",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    reason: kind,
  });

  revalidatePath("/sponsor/settings");
  return { ok: true };
}

export async function dropGate(fieldId: string): Promise<GateState> {
  const actor = await requireSponsorAdmin();
  await removeIdentifierField(actor.sponsorId, fieldId);

  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "gate.removed",
    resourceType: "sponsor_identifier_field",
    resourceId: fieldId,
  });

  revalidatePath("/sponsor/settings");
  return { ok: true };
}

/** 🔴 C236 — unlisted is the default, and this is the only thing that changes it. */
export async function setPublicListing(listed: boolean): Promise<GateState> {
  const actor = await requireSponsorAdmin();
  await setListed(actor.sponsorId, listed);

  /*
   * 🔴 C236 — unlisted is the default and this is the only thing that changes
   * it. Whether the world knows a company buys therapy for its staff is the
   * kind of decision somebody later says they never agreed to.
   */
  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: listed ? "listing.public" : "listing.private",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
  });

  revalidatePath("/sponsor/settings");
  return { ok: true };
}
