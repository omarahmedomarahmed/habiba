import { BACK_OFFICE_ROLES, type Role } from "@/lib/db/schema";

/**
 * Who may read a clinician's identity documents. PLAN.md 29.1.
 *
 * The clinician they belong to, and the back office. 🔴 W2-A01 / D9: the
 * founder opened verification to staff, and a reviewer who cannot open the
 * licence they are approving is approving a name. The inventory found exactly
 * that: staff shown the review card with every document a broken image.
 *
 * This is the rule for `/api/uploads/[id]`, which writes an audit row before
 * any byte leaves, so every staff read is on the record. The local-disk
 * fallback writes none, and `localUploadAllowed` keeps it the owner's.
 */
export function mayReadIdentity(
  actor: { userId: string; role: Role } | null,
  ownerUserId: string,
): boolean {
  if (!actor) return false;
  if (actor.userId === ownerUserId) return true;
  return (BACK_OFFICE_ROLES as readonly string[]).includes(actor.role);
}
