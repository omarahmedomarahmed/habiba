"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { reasonProblem, reasonText } from "@/lib/admin/reason";
import { emailAccountLink } from "@/lib/auth/account-links";
import { requireRole } from "@/lib/auth/guard";
import {
  approveForProduction,
  createPartnerUser,
  setPartnerState,
  withdrawApproval,
} from "@/lib/data/partner-admin";
import { PARTNER_STATES, type PartnerState } from "@/lib/db/schema";

export type AdminPartnerState = { error?: string; ok?: boolean };

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
 * Admin's side of a partner. PLAN.md 42.1, 55.2, 55.3, C265.
 *
 * 🔴 `requireRole("super_admin")`, all of it. Activating a partner lets them hold a key, and
 * an employment key is an identity oracle pointed at our own patients.
 *
 * ## 🔴 THERE IS NO ACTION HERE THAT MINTS A KEY, AND THAT IS THE POINT OF THE FILE
 *
 * It would be the obvious convenience: an operator finishing a call, making the key, reading
 * it down the phone. Two things break if it exists.
 *
 * A key minted by us is a key whose SCOPE nobody on their side chose, so the first thing the
 * partner does is ask for more scopes to be safe, and a key that can do everything is the key
 * nobody can safely revoke half of. And it would be a working credential that existed in our
 * hands, spoken aloud, before it existed in theirs: `mintKey` returns the raw key in exactly
 * one response for a reason, and reading it down a phone line is that reason defeated.
 *
 * So this screen creates the PORTAL USER and stops. They mint their own key, in their own
 * portal, behind their own cookie, and 55.3 stays true by construction rather than by an
 * operator remembering.
 */
export async function setState(
  partnerId: string,
  state: string,
  reason: string,
): Promise<AdminPartnerState> {
  const actor = await requireRole("super_admin");

  if (!PARTNER_STATES.includes(state as PartnerState)) return { error: "Not a state." };
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  const result = await setPartnerState(partnerId, state as PartnerState);
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: `partner.${state}`,
    resourceType: "partner",
    resourceId: partnerId,
    reason: reasonText(reason),
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}

/** 55.2 — the first portal user, with a password an operator sets on the call. */
export async function addUser(
  _prev: AdminPartnerState,
  formData: FormData,
): Promise<AdminPartnerState> {
  const actor = await requireRole("super_admin");

  const partnerId = String(formData.get("partnerId") ?? "");
  const role = String(formData.get("role") ?? "developer");

  const result = await createPartnerUser({
    partnerId,
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? "") || null,
    role: role === "admin" ? "admin" : "developer",
  });

  if (result.error || !result.id) return { error: result.error };
  // 🔴 W2-A06: invited by an emailed link, never a password the operator types.
  await emailAccountLink({
    audience: "partner",
    accountId: result.id,
    email: result.email!,
    createdByUserId: actor.userId,
  });

  await audit({
    actor,
    category: "admin",
    action: "partner.user_created",
    resourceType: "partner",
    resourceId: partnerId,
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * 🔴 68.21 / C264 — APPROVE FOR PRODUCTION, AND THE APPROVER'S NAME GOES ON IT.
 *
 * Separate from `setState`, which is the commercial relationship. This is the moment a
 * partner's keys can touch a real person's session, and C264 calls it the owner's act.
 *
 * `actor.userId` is passed rather than assumed, and the database refuses a row with an
 * approval time and no approver, so an approval nobody made cannot exist.
 */
export async function approveProduction(partnerId: string): Promise<AdminPartnerState> {
  const actor = await requireRole("super_admin");

  const result = await approveForProduction({ partnerId, byUserId: actor.userId });
  if (result.error) return { error: result.error };

  await audit({
    actor,
    category: "admin",
    action: "partner.approved_for_production",
    resourceType: "partner",
    resourceId: partnerId,
    reason: "their keys may now reach a real person's session",
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}

/**
 * 🔴 AND IT CAN BE WITHDRAWN, which stops NEW live keys and revokes none.
 *
 * Revoking a live key mid-afternoon stops transcription in rooms that are open, and a
 * commercial dispute with a platform must never arrive in somebody's session. That is
 * `revoke`, a separate and deliberate act, for when it must.
 */
export async function withdrawProduction(
  partnerId: string,
  reason: string,
): Promise<AdminPartnerState> {
  const actor = await requireRole("super_admin");
  const refused = await reasonRefused(reason);
  if (refused) return { error: refused };

  await withdrawApproval(partnerId);

  await audit({
    actor,
    category: "admin",
    action: "partner.approval_withdrawn",
    resourceType: "partner",
    resourceId: partnerId,
    reason: `no new live keys; the keys they hold are untouched. ${reasonText(reason)}`,
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}
