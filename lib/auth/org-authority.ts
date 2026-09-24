import type { OrganizationKind } from "@/lib/db/schema";

/**
 * 🔴 W1-02: may this clinician act on their organisation's account?
 *
 * Only when the organisation is their own solo practice. A clinic seat
 * clinician's session carries the CLINIC's id, so seats, plan, bills and the
 * records connection would otherwise be theirs to change. A clinic's account
 * is run from the clinic portal. An organisation we could not read is refused.
 *
 * Pure, and outside `guard.ts`, so a test can ask it without a request.
 */
export function mayRunOrgAccount(kind: OrganizationKind | null | undefined): boolean {
  return kind === "solo";
}
