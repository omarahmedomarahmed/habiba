"use server";

import { revalidatePath } from "next/cache";

import type { SeatQuote, SeatState } from "@/components/billing/seat-manager";
import { audit } from "@/lib/audit";
import { formatUsd } from "@/lib/billing/plans";
import { applySeatChange, quoteSeatChange } from "@/lib/billing/seats";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";

/**
 * 🔴 W2-C02: THE PRACTICE'S SEATS, FROM THE PRACTICE'S PORTAL.
 *
 * W1-02 took the stepper away from seat clinicians because the seats are the
 * clinic's money. That left it on a page no clinic admin can open. These are
 * the same two acts as `app/(app)/billing/actions.ts`, over the same two
 * functions (`quoteSeatChange`, `applySeatChange`), with the clinic's
 * principal: there is no second seat writer, so the guarded count and the
 * proration invoice behave exactly as they do for a solo practice.
 *
 * `seats.manage` is never delegable: `requireClinicCapability` refuses it to
 * anybody but the clinic admin whatever a role says (63.7).
 */

export async function quoteClinicSeats(
  toSeats: number,
): Promise<{ quote?: SeatQuote; error?: string }> {
  const actor = await requireClinicCapability("seats.manage");

  const change = await quoteSeatChange({
    organizationId: actor.clinicOrganizationId,
    toSeats: Math.max(0, Math.floor(Number(toSeats) || 0)),
  });

  return {
    quote: {
      fromSeats: change.fromSeats,
      toSeats: change.toSeats,
      fromMonthlyLabel: formatUsd(change.fromMonthlyCents),
      toMonthlyLabel: formatUsd(change.toMonthlyCents),
      proratedLabel: formatUsd(Math.abs(change.proratedCents)),
      proratedCents: change.proratedCents,
      daysRemaining: change.daysRemaining,
    },
  };
}

export async function saveClinicSeats(fromSeats: number, toSeats: number): Promise<SeatState> {
  const actor = await requireClinicCapability("seats.manage");

  const result = await applySeatChange({
    organizationId: actor.clinicOrganizationId,
    fromSeats: Number(fromSeats) || 0,
    toSeats: Number(toSeats) || 0,
  });
  if (result.error) return { error: result.error };

  /* A seat is a bill. The practice's own manager did it, and says so. */
  await audit({
    actor: null,
    clinicManagerId: actor.clinicManagerId,
    category: "billing",
    action: "seats.changed",
    resourceType: "organization",
    resourceId: actor.clinicOrganizationId,
    reason: `${fromSeats} to ${toSeats}`,
  });

  revalidatePath("/clinic/seats");
  revalidatePath("/clinic/people");
  return { ok: true };
}
