import type { Metadata } from "next";

import { SponsorManager } from "@/components/admin/sponsor-manager";
import { requireStaff } from "@/lib/auth/guard";
import { ledgerPotBalance, reconcilePots } from "@/lib/billing/pot";
import { allSponsors, potTerms, sponsorUsersFor } from "@/lib/data/sponsor-admin";
import { attemptsOnCode, liveCode, SPIKE_THRESHOLD } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { Money } from "@/components/ui/money";
import { rich, slot } from "@/lib/i18n/rich";

export const metadata: Metadata = { title: "Sponsors", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Corporate accounts. PLAN.md 53.6, 53.16, C232, C233, C237.
 *
 * ## 🔴 WHAT IS NOT ON THIS PAGE
 *
 * Not who is enrolled. An operational screen about a commercial account has no
 * business listing the people an employer funds, because the first thing that
 * happens to such a list is that somebody screenshots it for the customer who
 * asked. `roster()` exists and is not called from here.
 *
 * ## 🔴 53.16 / C232 — the reconciliation is ON THE SCREEN, not in a log
 *
 * `reconcilePots` returns only the pots where the balance column and the ledger
 * disagree, so the normal state of this block is that it renders nothing. A
 * discrepancy is a red line at the top of the page an operator opens every week,
 * rather than a warning in a log nobody tails.
 *
 * That is what the redundancy between `sponsor_pots.balance_cents` and the ledger
 * is FOR: two numbers maintained by the same functions, so a crash between the
 * journal and the balance update is a figure somebody sees rather than a pot that
 * quietly over-spends for a month.
 */
export default async function AdminSponsorsPage() {
  /*
   * 🔴 B8: staff read this list, because it is the way to the sponsor page
   * where the top-ups queue is worked. Every act on it stays the owner's:
   * `sponsors/actions.ts` refuses anybody else, and the controls are not
   * rendered for them.
   */
  const actor = await requireStaff();
  const canManage = actor.role === "super_admin";
  const { t } = await getI18n();

  const [sponsors, drift] = await Promise.all([allSponsors(), reconcilePots()]);

  const fmt = (cents: number) => <Money cents={cents} />;

  const rows = await Promise.all(
    sponsors.map(async (sponsor) => {
      const [code, terms, users, balance] = await Promise.all([
        liveCode(sponsor.id),
        potTerms(sponsor.id),
        sponsorUsersFor(sponsor.id),
        ledgerPotBalance(sponsor.id),
      ]);

      /*
       * 🔴 53.19 — admin's half of the spike alert. A NUMBER, never names.
       *
       * The sponsor sees the same figure on their own code page, where the remedy is.
       * We see it here so that a pattern across several customers is visible to one
       * person, which is the thing no individual customer can notice.
       */
      const attempts = await attemptsOnCode(code);

      return {
        id: sponsor.id,
        name: sponsor.name,
        kind: sponsor.kind,
        state: sponsor.state,
        listedPublicly: sponsor.listedPublicly,
        entity: sponsor.entity,
        contactName: sponsor.contactName,
        contactEmail: sponsor.contactEmail,
        contactPhone: sponsor.contactPhone,
        contactBestTime: sponsor.contactBestTime,
        code,
        potOpen: terms !== null,
        potBalanceLabel: fmt(balance),
        attempts,
        spike: attempts >= SPIKE_THRESHOLD,
        users: users.map((user) => ({ id: user.id, email: user.email, role: user.role })),
      };
    }),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          {t("asponsor.title")}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t("asponsor.body")}</p>
      </div>

      {/* 🔴 53.16 / C232 — normally renders nothing, which is the point. */}
      {drift.length > 0 ? (
        <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
          <p className="text-sm font-semibold text-red-800">{t("asponsor.drift")}</p>
          <ul className="mt-2 space-y-1 text-xs text-red-700">
            {drift.map((row) => (
              <li key={row.sponsorId}>
                {rich(t("asponsor.driftRow", { id: row.sponsorId, table: slot(0), ledger: slot(1), delta: slot(2) }), [
                  fmt(row.tableCents),
                  fmt(row.ledgerCents),
                  fmt(row.deltaCents),
                ])}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage ? null : <p className="text-sm text-slate-600">{t("asponsor.ownerOnly")}</p>}

      <SponsorManager sponsors={rows} canManage={canManage} />
    </div>
  );
}
