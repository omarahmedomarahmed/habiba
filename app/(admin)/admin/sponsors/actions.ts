"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { emailAccountLink } from "@/lib/auth/account-links";
import { requireRole } from "@/lib/auth/guard";
import {
  createSponsorUser,
  openPot,
  rotateCode,
  setSponsorEntity,
  setSponsorState,
} from "@/lib/data/sponsor-admin";
import { ENTITIES, SPONSOR_STATES, type Entity, type SponsorState } from "@/lib/db/schema";

export type AdminSponsorState = { error?: string; ok?: boolean };

/**
 * 🔴 W2-A05: one reason rule for every destructive or customer-visible act
 * (`lib/admin/reason.ts`), the same number the confirm step enables at, said
 * in the reader's language.
 */
async function reasonRefused(reason: unknown): Promise<string | null> {
  const problem = reasonProblem(reason);
  if (!problem) return null;
  const { getI18n } = await import("@/lib/i18n/server");
  return (await getI18n()).t(problem);
}

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
  reason: string,
): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");

  if (!SPONSOR_STATES.includes(state as SponsorState)) return { error: "Not a state." };
  // W2-A05: suspending or closing a company's account is theirs to be told about.
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  await setSponsorState(sponsorId, state as SponsorState);

  await audit({
    actor,
    category: "admin",
    action: `sponsor.${state}`,
    resourceType: "sponsor",
    resourceId: sponsorId,
    reason: reasonText(reason),
  });

  revalidatePath("/admin/sponsors");
  return { ok: true };
}

/**
 * 🔴 74.5 — WHICH ENTITY BILLS THIS CUSTOMER, AND THEREFORE WHICH RAIL THEY PAY ON.
 *
 * `applyToSponsor` lands every enquiry on `us`, with a comment saying an
 * operator moves it. Nothing did, for two sprints: an Egyptian company was
 * offered a corporate card charge into an entity that cannot invoice them,
 * while the bank transfer rail built for exactly them could not be reached,
 * because `sponsorNeedsTransfer` reads this column.
 *
 * `super_admin`, like every other action in this file, and for a harder reason
 * than most: this decides which company's books a customer's money lands in.
 */
export async function setEntity(sponsorId: string, entity: string): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");

  if (!ENTITIES.includes(entity as Entity)) return { error: "Not an entity." };

  const result = await setSponsorEntity(sponsorId, entity as Entity);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "sponsor.entity",
    resourceType: "sponsor",
    resourceId: sponsorId,
    reason: `Billed from the ${entity} entity`,
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
    /*
     * 🔴 The welcome credit, typed by the operator on the call. Left at zero it
     * changes nothing, which is the right default: a credit is an offer
     * somebody decided to make, not a thing that happens to every account.
     */
    welcomeCreditCents: Math.round(
      Number(String(formData.get("welcomeCredit") ?? "0")) * 100,
    ),
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

/**
 * 53.6: the first portal user. 🔴 W2-A06: invited by an emailed link, never a
 * password the operator types (`lib/auth/account-links.ts`).
 */
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
    role: role === "admin" ? "admin" : "viewer",
  });

  if (result.error || !result.id) return { error: result.error };
  await emailAccountLink({
    audience: "sponsor",
    accountId: result.id,
    email: result.email!,
    createdByUserId: actor.userId,
  });

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
export async function mintCode(sponsorId: string, reason: string): Promise<AdminSponsorState> {
  const actor = await requireRole("super_admin");
  // W2-A05: rotating kills the old code for anybody halfway through signing up.
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  await rotateCode(sponsorId);

  await audit({
    actor,
    category: "admin",
    action: "sponsor.code_rotated",
    resourceType: "sponsor",
    resourceId: sponsorId,
    reason: reasonText(reason),
  });

  revalidatePath("/admin/sponsors");
  return { ok: true };
}
