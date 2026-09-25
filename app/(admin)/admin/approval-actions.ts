"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { requireRole, requireStaff } from "@/lib/auth/guard";
import type { LedgerAccount } from "@/lib/db/schema";

/**
 * 🔴 0161 / ruling 13c — a second person completes or declines what a first
 * person asked. Completing re-runs the same action, which finds the open
 * request and carries out its stored act; nothing is read from this form.
 */
export async function completeApproval(id: string): Promise<{ error?: string; ok?: string }> {
  const { approvalById } = await import("@/lib/billing/approvals");
  const row = await approvalById(id);
  if (!row || row.state !== "asked") return { error: "That request has already been decided." };

  if (row.kind === "transfer_without_proof") {
    await requireStaff();
    const { confirmUnclaimed } = await import("./transfers/actions");
    const result = await confirmUnclaimed(String(row.payload.paymentId ?? ""), row.reason);
    return result.error ? { error: result.error } : { ok: result.ok };
  }

  if (row.kind === "owner_invite") {
    /* 🔴 K3: the stored invite, carried out by a different owner. */
    const { inviteOwner } = await import("./team/actions");
    const form = new FormData();
    form.set("email", String(row.payload.email ?? ""));
    form.set("firstName", String(row.payload.firstName ?? ""));
    form.set("lastName", String(row.payload.lastName ?? ""));
    form.set("reason", row.reason);
    const result = await inviteOwner({}, form);
    return result.error ? { error: result.error } : { ok: result.asked ? "Asked." : "Invited." };
  }

  await requireRole("super_admin");
  const { adjustLedger } = await import("./actions");
  const p = row.payload;
  const result = await adjustLedger({
    organizationId: String(p.organizationId ?? ""),
    therapistId: typeof p.therapistId === "string" ? p.therapistId : null,
    account: String(p.account ?? "") as LedgerAccount,
    amountCents: Number(p.amountCents ?? 0),
    reason: row.reason,
    idempotencyKey: String(p.idempotencyKey ?? ""),
  });
  return result.error ? { error: result.error } : { ok: "Posted." };
}

export async function declineApproval(id: string): Promise<{ error?: string; ok?: string }> {
  const { approvalById, closeApproval } = await import("@/lib/billing/approvals");
  const row = await approvalById(id);
  if (!row || row.state !== "asked") return { error: "That request has already been decided." };
  const actor = row.kind === "transfer_without_proof" ? await requireStaff() : await requireRole("super_admin");

  const closed = await closeApproval({ approvalId: id, decidedBy: actor.userId, state: "declined" });
  if (!closed) return { error: "Only a second person can decline it." };

  await audit({
    actor,
    category: "billing",
    action: "approval.declined",
    resourceType: "pending_approval",
    resourceId: id,
    reason: `${row.kind} ${row.subjectId}`,
  });
  revalidatePath("/admin/transfers");
  revalidatePath("/admin/vault");
  revalidatePath("/admin/team");
  return { ok: "Declined." };
}
