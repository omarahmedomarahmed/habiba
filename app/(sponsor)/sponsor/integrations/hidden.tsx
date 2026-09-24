import { SponsorIntegrations } from "@/components/sponsor/integrations";
import { getI18n } from "@/lib/i18n/server";
import {
  deliveriesFor,
  failedAttemptsFor,
  HR_SYSTEMS,
  integrationFor,
} from "@/lib/data/sponsor-integrations";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import { formatDateTime } from "@/lib/utils";

/**
 * W1-21: OUT OF REACH, KEPT. This was the page at /sponsor/integrations, which
 * now redirects to /sponsor, and the tab is gone from the nav (FIX-PLAN D4).
 * Nothing in enrolment reads the switch, the steps described the call in the
 * wrong direction, and `failedAttemptsFor` counts unanswered attestations,
 * which are written only after a successful enrolment: a weekly count of real
 * joiners (E1, "never when"). Do not route to this again until that counter
 * counts something else.
 *
 * The sponsor's HR connection. PLAN.md 66.1 to 66.12, C227, C246, C265.
 *
 * ## 🔴 66.1 — A PAGE, NOT A ROW IN SETTINGS
 *
 * *Connecting an HR system is a project somebody schedules, not a toggle they flip
 * while looking for something else.* A settings row gets flipped by whoever is in
 * settings that afternoon; a page with six steps on it gets opened by the person who
 * came to do this.
 *
 * ## 🔴 AND EVERYTHING HERE IS READ BY AN HR ADMIN, NOT BY US
 *
 * The indicator, the delivery log and the spike count are all facts somebody on their
 * side can act on and we cannot: whether their code went on a public poster, whether
 * their endpoint is returning 500s, whether their key rotation landed. We stop being
 * the only people who can see what happened.
 */
export default async function SponsorIntegrationsPage() {
  const actor = await requireSponsor();
  const { locale } = await getI18n();

  const [integration, deliveries, failedAttempts] = await Promise.all([
    integrationFor(actor.sponsorId),
    deliveriesFor(actor.sponsorId),
    /* 🔴 66.11 — a NUMBER. See `failedAttemptsFor` for why not a list. */
    failedAttemptsFor(actor.sponsorId),
  ]);

  /*
   * 🔴 Formatted here, on the server, in the reader's language and a fixed zone.
   * C84: a `Date` handed to a client component renders one string on the server pass
   * and another after hydration.
   */
  const when = (at: Date | null) => (at ? formatDateTime(at, "UTC", locale) : null);

  return (
    <SponsorIntegrations
      canManage={actor.role === "admin"}
      enabled={integration.enabled}
      hrSystem={integration.hrSystem}
      systems={HR_SYSTEMS.map((system) => ({ key: system.key, name: system.name }))}
      failedAttempts={failedAttempts}
      keys={integration.keys.map((key) => ({
        id: key.id,
        label: key.label,
        prefix: key.prefix,
        /* 🔴 66.7 — the indicator reads a SUCCESS, never a use. */
        lastSuccessAt: when(key.lastSuccessAt),
        suspendedReason: key.suspendedAt ? (key.suspendedReason ?? "Suspended") : null,
        revoked: Boolean(key.revokedAt),
      }))}
      deliveries={deliveries.map((delivery) => ({
        id: delivery.id,
        event: delivery.event,
        status: delivery.lastStatus,
        attempts: delivery.attempts,
        error: delivery.lastError,
        at: when(delivery.createdAt) ?? "",
        delivered: Boolean(delivery.deliveredAt),
      }))}
    />
  );
}
