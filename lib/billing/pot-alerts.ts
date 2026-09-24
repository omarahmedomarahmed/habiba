import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { controlDb } from "@/lib/db";
import { auditLog, sponsorPots, sponsorUsers, sponsors } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";
import { notify } from "@/lib/notify";

import { topUpHistory } from "./invoice";

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
 * 🔴 **And it is not sent WHEN somebody books.** W1-20: this used to run from
 * `payFromPot`, so every booking that hit an empty pot mailed every admin, and
 * the email's arrival was itself the moment somebody tried to book (E1, "never
 * when"). It now runs from the daily billing job, once per pot per period, and
 * a period ends at the next top-up.
 *
 * ## Why it is a separate file
 *
 * `lib/billing/pot.ts` is the money. A module that both moves a balance and
 * sends messages is one you cannot test without a mail server, and C360's rule
 * about the forecast is the same fear pointed at a different file.
 */

/**
 * The low-balance warning, as a share of the last top-up.
 *
 * No setting holds this, and a fixed amount would be wrong in two currencies at
 * once (a pot is in dollars or in Egyptian pounds). A fifth of what the company
 * last put in is early enough to top up before the pot is empty and late
 * enough not to nag a pot that was simply spent as planned.
 */
const LOW_POT_SHARE = 0.2;

type PotAlert = "empty" | "low";

/** Pure, so the thresholds can be read without a database. */
function potAlertFor(balanceCents: number, lastTopUpCents: number): PotAlert | null {
  if (balanceCents <= 0) return "empty";
  if (lastTopUpCents > 0 && balanceCents < lastTopUpCents * LOW_POT_SHARE) return "low";
  return null;
}

/** The message. A balance and a verb: no name, no therapist, no time. */
function potAlertMessage(kind: PotAlert, sponsorName: string) {
  return kind === "empty"
    ? {
        kind: "sponsor.pot_empty" as const,
        subject: "Your therapy fund needs topping up",
        body: `${sponsorName}'s fund has run out, so sessions are no longer covered and your people are asked to pay for their own. Topping it up starts the cover again.`,
      }
    : {
        kind: "sponsor.pot_low" as const,
        subject: "Your therapy fund is running low",
        body: `${sponsorName}'s fund is below a fifth of your last top up. Top it up before it runs out, so your people's sessions stay covered.`,
      };
}

/**
 * The daily sweep: every active sponsor's pot, at most one alert of each kind
 * per pot until the next top-up.
 *
 * The record of an alert is its audit row. "Did we already tell them" is then
 * the same question as "what did we tell them, and when", and needs no column.
 */
export async function alertPots(): Promise<{ alerted: number }> {
  const pots = await controlDb
    .select({
      potId: sponsorPots.id,
      sponsorId: sponsorPots.sponsorId,
      balanceCents: sponsorPots.balanceCents,
      name: sponsors.name,
    })
    .from(sponsorPots)
    .innerJoin(sponsors, eq(sponsors.id, sponsorPots.sponsorId))
    .where(eq(sponsors.state, "active"));

  let alerted = 0;
  for (const pot of pots) {
    const [last] = await topUpHistory(pot.sponsorId);
    const kind = potAlertFor(pot.balanceCents, last?.amountCents ?? 0);
    if (!kind) continue;

    const action = `sponsor.pot_alert.${kind}`;
    const [already] = await controlDb
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, action),
          eq(auditLog.resourceId, pot.potId),
          gt(auditLog.createdAt, last?.at ?? new Date(0)),
        ),
      )
      .limit(1);
    if (already) continue;

    if (await tellAdmins(pot.sponsorId, pot.name, kind)) {
      await audit({
        actor: null,
        category: "billing",
        action,
        resourceType: "sponsor_pot",
        resourceId: pot.potId,
        reason: kind,
      });
      alerted += 1;
    }
  }

  return { alerted };
}

async function tellAdmins(sponsorId: string, name: string, kind: PotAlert): Promise<boolean> {
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
    log.warn("a pot needs topping up and the account has no admin to tell", {
      sponsor: ref(sponsorId),
    });
    return false;
  }

  const message = potAlertMessage(kind, name);
  for (const admin of admins) {
    await notify(
      { email: admin.email, phone: null, timezone: null },
      {
        ...message,
        link: { label: "Top up the fund", url: "/sponsor/pot" },
        variables: ["24Therapy", name],
      },
    );
  }

  log.info("sponsor told their pot needs topping up", {
    sponsor: ref(sponsorId),
    kind,
    admins: admins.length,
  });
  return true;
}
