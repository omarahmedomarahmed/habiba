import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { sponsorUsers, sponsors } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";

/**
 * 🔴 TELL A COMPANY THEIR POT IS EMPTY, WHICH NOTHING DID.
 *
 * `payFromPot` has computed `reason: "insufficient"` since the pot was built,
 * and every one of its three callers threw the return value away. So the meter
 * on `/sponsor/pot` went to zero, the employee was quietly asked to pay for a
 * benefit they had been promised, and the one person who could fix it in a
 * minute found out when somebody complained.
 *
 * ## What this may and may not say
 *
 * 🔴 **It names nobody.** C243: an employer never learns which of their staff
 * attended, and "your pot ran out while somebody was booking" would leak
 * exactly that if it carried a name, a time or a therapist. It carries a
 * balance and a verb.
 *
 * ## Why it is a separate file
 *
 * `lib/billing/pot.ts` is the money. A module that both moves a balance and
 * sends messages is one you cannot test without a mail server, and C360's rule
 * about the forecast is the same fear pointed at a different file.
 */
export async function alertSponsorPotEmpty(sponsorId: string): Promise<void> {
  const [sponsor] = await controlDb
    .select({ name: sponsors.name })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);

  if (!sponsor) return;

  /*
   * Admins only. A viewer can read the balance and cannot top it up, and a
   * message telling somebody about a problem they have no power to solve is a
   * message that trains people to ignore the sender.
   */
  const admins = await controlDb
    .select({ email: sponsorUsers.email })
    .from(sponsorUsers)
    .where(
      and(
        eq(sponsorUsers.sponsorId, sponsorId),
        eq(sponsorUsers.role, "admin"),
        isNull(sponsorUsers.deletedAt),
      ),
    );

  if (admins.length === 0) {
    log.warn("a pot ran dry and the account has no admin to tell", { sponsor: ref(sponsorId) });
    return;
  }

  for (const admin of admins) {
    await notify(
      { email: admin.email, phone: null, timezone: null },
      {
        kind: "sponsor.pot_empty",
        subject: "Your therapy fund needs topping up",
        body: `${sponsor.name}'s fund has run out, so we have stopped covering sessions and your people are being asked to pay for their own. Topping it up starts the cover again immediately.`,
        link: { label: "Top up the fund", url: "/sponsor/pot" },
        variables: ["24Therapy", sponsor.name],
      },
    );
  }

  log.info("sponsor told their pot is empty", {
    sponsor: ref(sponsorId),
    admins: admins.length,
  });
}
