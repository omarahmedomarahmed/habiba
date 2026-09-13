"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/guard";
import {
  createSponsorUser,
  openPot,
  rotateCode,
  setSponsorState,
} from "@/lib/data/sponsor-admin";
import { SPONSOR_STATES, type SponsorState } from "@/lib/db/schema";

export type AdminSponsorState = { error?: string; ok?: boolean };

/**
 * Admin's side of the corporate account. PLAN.md 53.6, C233, C237.
 *
 * 🔴 `requireRole("super_admin")`, all of it. Activating a sponsor opens a corporate account and
 * opening a pot commits the company to refund terms; both are the same authority as
 * the payouts queue and the vault.
 *
 * 🔴 Every one of these is audited with a real `Actor`, unlike the sponsor's own
 * acts, which carry a sponsor user id and no actor. The two are different
 * principals and the audit table's own comment says a row naming both is the
 * invariant its column split exists to hold.
 */
export async function activate(
  sponsorId: string,
  state: string,
): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");

  if (!SPONSOR_STATES.includes(state as SponsorState)) return { error: "Not a state." };

  await setSponsorState(sponsorId, state as SponsorState);

  await audit({
    actor,
    category: "admin",
    action: `sponsor.${state}`,
    resourceType: "sponsor",
    resourceId: sponsorId,
  });

  revalidatePath("/admin/sponsors");
  return { ok: true };
}

/**
 * 🔴 53.13 / C233 — the pot is opened WITH its terms and cannot be opened without
 * them. The refund policy is free text because it is OUR promise to a customer,
 * which is the opposite of the removal reason: that one is a sponsor writing about
 * an individual and is a fixed list for exactly that reason.
 */
export async function openTheirPot(
  _prev: AdminSponsorState,
  formData: FormData,
): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");

  const sponsorId = String(formData.get("sponsorId") ?? "");
  const expires = new Date(String(formData.get("expiresAt") ?? ""));

  const result = await openPot({
    sponsorId,
    refundPolicy: String(formData.get("refundPolicy") ?? ""),
    expiresAt: expires,
    overdraftCents: Math.round(Number(String(formData.get("overdraft") ?? "0")) * 100),
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "sponsor.pot_opened",
    resourceType: "sponsor",
    resourceId: sponsorId,
  });

  revalidatePath("/admin/sponsors");
  return { ok: true };
}

/** 53.6 — the first portal user, with a password an operator sets on the call. */
export async function addPortalUser(
  _prev: AdminSponsorState,
  formData: FormData,
): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");

  const sponsorId = String(formData.get("sponsorId") ?? "");
  const role = String(formData.get("role") ?? "viewer");

  const result = await createSponsorUser({
    sponsorId,
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? "") || null,
    password: String(formData.get("password") ?? ""),
    role: role === "admin" ? "admin" : "viewer",
  });

  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "sponsor.user_created",
    resourceType: "sponsor",
    resourceId: sponsorId,
  });

  revalidatePath("/admin/sponsors");
  return { ok: true };
}

/** 53.9 — mint or rotate their joining code from our side too. */
export async function mintCode(sponsorId: string): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");

  await rotateCode(sponsorId);

  await audit({
    actor,
    category: "admin",
    action: "sponsor.code_rotated",
    resourceType: "sponsor",
    resourceId: sponsorId,
  });

  revalidatePath("/admin/sponsors");
  return { ok: true };
}
