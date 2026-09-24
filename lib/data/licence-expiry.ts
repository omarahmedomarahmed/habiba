import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { acrossRegions, dbFor } from "@/lib/db";
import { regionOfOrganization } from "@/lib/db/directory";
import { therapistRadar, therapistVerifications, users } from "@/lib/db/schema";
import { licenceStanding, licenceValidUntil } from "@/lib/licence";
import { log, safeErrorMessage } from "@/lib/logger";

/**
 * 🔴 W1-16: an expired licence stops clearing anybody.
 *
 * `license_expiry` was collected at onboarding and never read again, so a
 * clinician approved on a licence that lapsed was still on the radar, still
 * bookable, and still shown to patients as checked.
 *
 * Once a day, inside the `crisis` cron (a job of its own would cost a wake of
 * its own, for the reason at the top of `app/api/cron/[job]/route.ts`):
 *
 *   expired   state goes back to `submitted`, which is the operator's review
 *             queue, and `license_expired_at` says why. Everything that asks for
 *             `approved` stops answering yes: the radar, `openHours` and
 *             `holdSlot`, `requireVerified`, the partner flag, the grant
 *             trigger. The radar row is set offline so their own screen agrees.
 *             Sessions already booked are NOT cancelled; the notice says so,
 *             because a patient's appointment is a decision a person makes.
 *   expiring  within 30 days, one warning, stamped so it is sent once.
 *
 * Unreadable expiry text is left alone (`licenceStanding` says `unknown`).
 * Each write is conditional on the state it read, so two overlapping runs act
 * once.
 */
export async function sweepLicences(now = new Date()): Promise<{ expired: number; warned: number }> {
  const rows = await acrossRegions((db) =>
    db
      .select({
        id: therapistVerifications.id,
        userId: therapistVerifications.userId,
        organizationId: therapistVerifications.organizationId,
        expiry: therapistVerifications.licenseExpiry,
        warnedAt: therapistVerifications.licenseExpiryWarnedAt,
        email: users.email,
        timezone: users.timezone,
      })
      .from(therapistVerifications)
      .innerJoin(users, eq(users.id, therapistVerifications.userId))
      .where(
        and(
          eq(therapistVerifications.state, "approved"),
          isNotNull(therapistVerifications.licenseExpiry),
          isNull(therapistVerifications.licenseExpiredAt),
        ),
      ),
  );

  let expired = 0;
  let warned = 0;

  for (const row of rows) {
    const standing = licenceStanding(row.expiry, now);
    if (standing !== "expired" && (standing !== "expiring" || row.warnedAt)) continue;

    const db = dbFor(await regionOfOrganization(row.organizationId));

    if (standing === "expired") {
      const [landed] = await db
        .update(therapistVerifications)
        .set({ state: "submitted", submittedAt: now, licenseExpiredAt: now, updatedAt: now })
        .where(
          and(
            eq(therapistVerifications.id, row.id),
            eq(therapistVerifications.state, "approved"),
            isNull(therapistVerifications.licenseExpiredAt),
          ),
        )
        .returning({ id: therapistVerifications.id });
      if (!landed) continue;

      await db
        .update(therapistRadar)
        .set({ status: "offline", updatedAt: now })
        .where(eq(therapistRadar.userId, row.userId));

      await audit({
        actor: null,
        category: "auth",
        action: "verification.licence_expired",
        resourceType: "verification",
        resourceId: row.id,
        reason: `licence expiry ${row.expiry}`,
      });
      expired += 1;
    } else {
      const [landed] = await db
        .update(therapistVerifications)
        .set({ licenseExpiryWarnedAt: now, updatedAt: now })
        .where(
          and(
            eq(therapistVerifications.id, row.id),
            isNull(therapistVerifications.licenseExpiryWarnedAt),
          ),
        )
        .returning({ id: therapistVerifications.id });
      if (!landed) continue;
      warned += 1;
    }

    await tell(row, standing);
  }

  return { expired, warned };
}

/** The existing channel: `notify()`, email and WhatsApp both. */
async function tell(
  row: { expiry: string | null; email: string | null; timezone: string | null; organizationId: string },
  standing: "expired" | "expiring",
) {
  try {
    const { notify } = await import("@/lib/notify");
    const { stringsFor } = await import("@/lib/i18n/strings");
    const { t } = await stringsFor("en");
    const { env } = await import("@/lib/env");
    const date = licenceValidUntil(row.expiry);
    const last = date ? new Date(date.getTime() - 86_400_000).toISOString().slice(0, 10) : row.expiry ?? "";

    await notify(
      {
        email: row.email,
        // A clinician's number is not on their account, so this is email.
        phone: null,
        timezone: row.timezone,
        organizationId: row.organizationId,
      },
      {
        kind: standing === "expired" ? "licence.expired" : "licence.expiring",
        subject: t(standing === "expired" ? "tlic.expiredTitle" : "tlic.expiringTitle"),
        body: t(standing === "expired" ? "tlic.expiredBody" : "tlic.expiringBody", { date: last }),
        link: { label: t("tlic.update"), url: `${env.appUrl}/onboarding` },
      },
    );
  } catch (error) {
    // The state change above is the protection; a failed send is logged, not fatal.
    log.warn("licence notice not sent", { reason: safeErrorMessage(error) });
  }
}

/**
 * What the portal says about this clinician's licence, read from the row, so
 * the notice is there whether or not a message ever arrived.
 */
export async function licenceNotice(
  userId: string,
  organizationId: string,
  now = new Date(),
): Promise<{ kind: "expired" | "expiring"; date: string } | null> {
  const db = dbFor(await regionOfOrganization(organizationId));
  const [row] = await db
    .select({
      expiry: therapistVerifications.licenseExpiry,
      expiredAt: therapistVerifications.licenseExpiredAt,
      state: therapistVerifications.state,
    })
    .from(therapistVerifications)
    .where(eq(therapistVerifications.userId, userId))
    .limit(1);
  if (!row) return null;

  const until = licenceValidUntil(row.expiry);
  const date = until ? new Date(until.getTime() - 86_400_000).toISOString().slice(0, 10) : row.expiry ?? "";
  if (row.expiredAt) return { kind: "expired", date };
  if (row.state === "approved" && licenceStanding(row.expiry, now) === "expiring") {
    return { kind: "expiring", date };
  }
  return null;
}
