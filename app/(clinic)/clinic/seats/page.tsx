import type { Metadata } from "next";

import { SeatManager } from "@/components/billing/seat-manager";
import { ClinicHead, Ring } from "@/components/clinic/ui";
import { Card } from "@/components/clinician/kit";
import { currentSeatBill, seatsFor } from "@/lib/billing/seats";
import { requireClinicCapability } from "@/lib/clinic-auth/guard";
import { clinicInvitations } from "@/lib/data/clinic";
import { getI18n } from "@/lib/i18n/server";

import { quoteClinicSeats, saveClinicSeats } from "./actions";
import { Money } from "@/components/ui/money";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.seats"), robots: { index: false } };
}
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
      <ClinicHead title={t("clinic.nav.seats")} />
      {/* Filled against bought, as a ring: the gap is what the practice pays for and nobody uses. */}
      <Card className="flex items-center gap-5 p-5">
        <Ring size={96} stroke={10} value={bill.seats > 0 ? filled.length / bill.seats : 0}>
          <span className="text-[26px] leading-none font-bold tabular-nums text-navy-700" dir="ltr">
            {filled.length}/{bill.seats}
          </span>
        </Ring>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-navy-700">
            {t("clinic.seatsFilled", { filled: filled.length, invited })}
          </p>
        </div>
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
