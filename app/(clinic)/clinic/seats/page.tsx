import type { Metadata } from "next";

import { SeatManager } from "@/components/billing/seat-manager";
import { Card } from "@/components/ui";
import { currentSeatBill, seatsFor } from "@/lib/billing/seats";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicInvitations } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";

import { quoteClinicSeats, saveClinicSeats } from "./actions";
import { Money } from "@/components/ui/money";

export const metadata: Metadata = { title: "Seats", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * 🔴 W2-C02: the practice's seats, bought against filled. PLAN.md 62.1 to
 * 62.4, C3, C4.
 *
 * Bought is `organizations.seats`, which is what the bill is priced on.
 * Filled is the live `clinic_seats` rows, one per clinician on the account.
 * The two drifted because nothing tied them, which is why inviting and
 * removing a clinician now quote and apply the change too; this page is
 * where the admin sees both numbers and changes the first by hand.
 */
export default async function ClinicSeatsPage() {
  const actor = await requireClinicCapability("seats.manage");
  const { t } = await getI18n();

  const [bill, filled, invitations] = await Promise.all([
    currentSeatBill(actor.clinicOrganizationId),
    seatsFor(actor.clinicOrganizationId),
    clinicInvitations(actor),
  ]);
  const now = Date.now();
  const invited = invitations.filter(
    (row) => row.state === "sent" && row.expiresAt.getTime() > now,
  ).length;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-slate-700">
          {t("clinic.seatsFilled", { filled: filled.length, invited })}
        </p>
      </Card>
      <SeatManager
        seats={bill.seats}
        monthlyLabel={<Money cents={bill.monthlyCents} />}
        quoteSeats={quoteClinicSeats}
        saveSeats={saveClinicSeats}
      />
    </div>
  );
}
