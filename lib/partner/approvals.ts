import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { controlDb } from "@/lib/db";
import { authSessions, clinicianPartnerApprovals, organizations, partners } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/**
 * 🔴 F6: A CLINICIAN'S OWN APPROVAL OF THE PLATFORM THAT MAY OPEN 24THERAPY FOR THEM.
 *
 * Their practice being on a partner's bill is between the practice and the
 * partner. Being signed in by that partner's server is the clinician's own
 * decision, made here from Settings, Integrations, and revoked there in one tap,
 * which also ends any session the partner opened for them.
 *
 * The only partner a clinician can approve is the one their practice is billed
 * through (`organizations.partner_id` with `partner_billed`): there is no list
 * of every platform to pick from, and approving one that is not theirs does
 * nothing.
 */

export type PartnerApproval = { partnerId: string; partnerName: string; approvedAt: Date | null };

/** The partner this clinician's practice is on, with their approval of it (or null). */
export async function partnerApprovalsFor(actor: Actor): Promise<PartnerApproval[]> {
  const rows = await controlDb
    .select({
      partnerId: partners.id,
      partnerName: partners.name,
      approvedAt: clinicianPartnerApprovals.approvedAt,
      revokedAt: clinicianPartnerApprovals.revokedAt,
    })
    .from(organizations)
    .innerJoin(partners, eq(partners.id, organizations.partnerId))
    .leftJoin(
      clinicianPartnerApprovals,
      and(
        eq(clinicianPartnerApprovals.partnerId, partners.id),
        eq(clinicianPartnerApprovals.userId, actor.userId),
      ),
    )
    .where(and(eq(organizations.id, actor.organizationId), eq(organizations.billingMode, "partner_billed")))
    .limit(5);

  return rows.map((row) => ({
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    approvedAt: row.approvedAt && !row.revokedAt ? row.approvedAt : null,
  }));
}

/** Whether this clinician has approved this partner, now. Asked at launch AND at redemption. */
export async function hasApprovedPartner(userId: string, partnerId: string): Promise<boolean> {
  const [row] = await controlDb
    .select({ userId: clinicianPartnerApprovals.userId })
    .from(clinicianPartnerApprovals)
    .where(
      and(
        eq(clinicianPartnerApprovals.userId, userId),
        eq(clinicianPartnerApprovals.partnerId, partnerId),
        isNull(clinicianPartnerApprovals.revokedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function approvePartner(
  actor: Actor,
  partnerId: string,
): Promise<{ ok?: true; error?: string }> {
  const mine = (await partnerApprovalsFor(actor)).some((p) => p.partnerId === partnerId);
  if (!mine) return { error: "Your practice is not on that platform." };

  await controlDb
    .insert(clinicianPartnerApprovals)
    .values({ userId: actor.userId, partnerId })
    .onConflictDoUpdate({
      target: [clinicianPartnerApprovals.userId, clinicianPartnerApprovals.partnerId],
      set: { approvedAt: new Date(), revokedAt: null },
    });

  await audit({
    actor,
    category: "auth",
    action: "partner.launch_approved",
    resourceType: "partner",
    resourceId: partnerId,
  });
  log.info("clinician approved a partner launch", { partner: ref(partnerId) });
  return { ok: true };
}

export async function revokePartner(
  actor: Actor,
  partnerId: string,
): Promise<{ ok: true }> {
  await controlDb
    .update(clinicianPartnerApprovals)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(clinicianPartnerApprovals.userId, actor.userId),
        eq(clinicianPartnerApprovals.partnerId, partnerId),
        isNull(clinicianPartnerApprovals.revokedAt),
      ),
    );

  /* Any session this partner opened for them ends with the approval. */
  await controlDb
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authSessions.userId, actor.userId),
        eq(authSessions.partnerId, partnerId),
        isNull(authSessions.revokedAt),
      ),
    );

  await audit({
    actor,
    category: "auth",
    action: "partner.launch_revoked",
    resourceType: "partner",
    resourceId: partnerId,
  });
  log.info("clinician revoked a partner launch", { partner: ref(partnerId) });
  return { ok: true };
}
