"use server";

import { revalidatePath } from "next/cache";

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

  revalidatePath("/sponsor/settings");
  return { ok: true };
}

export async function dropGate(fieldId: string): Promise<GateState> {
  const actor = await requireSponsorAdmin();
  await removeIdentifierField(actor.sponsorId, fieldId);
  revalidatePath("/sponsor/settings");
  return { ok: true };
}

/** 🔴 C236 — unlisted is the default, and this is the only thing that changes it. */
export async function setPublicListing(listed: boolean): Promise<GateState> {
  const actor = await requireSponsorAdmin();
  await setListed(actor.sponsorId, listed);
  revalidatePath("/sponsor/settings");
  return { ok: true };
}
