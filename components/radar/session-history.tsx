import Link from "next/link";
import { ExternalLink, MessageSquare } from "lucide-react";

import { Badge, Card, EmptyState } from "@/components/ui";
import { formatUsd } from "@/lib/billing/plans";
import type { RadarSessionRow } from "@/lib/data/radar";
import { formatDate } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";

/*
 * 12.3 / C70 — the zone this screen prints its dates in.
 *
 * A **prop**, not `readerZone()`: this renders on the server, where the
 * browser's zone is not available and the server's own is UTC. The page passes
 * `actor.timezone`, so a clinician who has set one in Settings sees their own
 * days and one who has not is shown UTC rather than being quietly told the
 * wrong thing.
 */

/**
 * The clinician's own record of what each session was worth.
 *
 * PLAN.md 2.5: `/on-call` stays full radar control rather than a status
 * toggle. This is the history half — the price charged at the time, a link into
 * the patient record, and what the session cost them.
 *
 * ## Three numbers, never one
 *
 * §3 is explicit that the patient and the therapist each see the split as
 * separate lines with reasons. A single "you earned $25.50" hides both the fee
 * and the clinician's own session bill, and a clinician who discovers either on
 * a statement is a clinician who stops trusting the statement. So a paid
 * session shows what the patient paid, what we took, and what reached them.
 *
 * ## Everything here is historical
 *
 * None of it is recomputed from today's settings — see `radarSessionHistory`.
 * A clinician looking at March sees March's rates, even after an admin changes
 * them, because the alternative is a page that silently rewrites what somebody
 * was paid.
 */
/** The short phrase beside a session, or nothing when nothing is withheld. */
function accessNote(row: RadarSessionRow): MessageKey | null {
  if (row.accessGated) return "thist.gated";

  switch (row.accessState) {
    case "revoked":
      return "thist.revoked";
    case "unclaimed_bare":
      return "thist.unclaimed";
    case "no_relationship":
      return row.patientId ? null : "thist.noRecord";
    case "unclaimed_documented":
    case "granted":
      return null;
  }
}

export async function SessionHistory({
  rows,
  zone,
  locale,
}: {
  /** 37L.9 — the reader's language, a prop for the same reason the zone is. */
  locale: Locale;
  rows: RadarSessionRow[];
  /** The reader's own zone. 12.3. */
  zone: string | null;
}) {
  const { t } = await getI18n();

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          title={t("thist.none")}
          body={t("thist.noneBody")}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{t("thist.title")}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {t("thist.blurb")}
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.sessionId} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {/*
                    A link only when there is a record to link to. A join-link
                    patient has no `patients` row until somebody types a name,
                    and a link to a null id is a 404 dressed up as a feature.
                  */}
                  {row.patientId ? (
                    <Link
                      href={`/patients/${row.patientId}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {row.patientLabel}
                      <ExternalLink className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  ) : (
                    row.patientLabel
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDate(row.endedAt ?? row.startedAt ?? new Date(), zone, locale)} ·{" "}
                  {row.modality === "video" ? t("thist.video") : t("thist.inPerson")}
                  {row.copilotAsked > 0
                    ? ` · ${
                        row.copilotAsked === 1
                          ? t("thist.copilotOne")
                          : t("thist.copilotMany", { count: row.copilotAsked })
                      }`
                    : ""}
                </p>

                {/*
                  C27 — the access column 2.5 asked for.
                  ---------------------------------------
                  Sprint 2 left it out rather than filling it with a
                  placeholder that would read the same on every row, because
                  `history_grants` did not exist yet. It does now, so this
                  says which of §3's four states each session sits in.

                  Absent on `granted` and on a documented unclaimed record: a
                  badge on every row is a badge nobody reads, and those two are
                  the states where nothing is being withheld.
                */}
                {accessNote(row) ? (
                  <p className="mt-1 text-xs text-slate-500">{t(accessNote(row)!)}</p>
                ) : null}
              </div>

              <div className="shrink-0 text-end">
                {row.priceCents === 0 ? (
                  <Badge tone="slate">{t("thist.free")}</Badge>
                ) : row.paid ? (
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatUsd(row.paid.netCents)}
                  </p>
                ) : (
                  <Badge tone="amber">{t("thist.unpaid", { amount: formatUsd(row.priceCents) })}</Badge>
                )}
              </div>
            </div>

            {/*
              The split, spelled out. Only for a session that was actually paid
              for — showing a fee on a free link would be inventing a
              transaction.
            */}
            {row.paid ? (
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <div className="flex gap-1.5">
                  <dt>{t("thist.price")}</dt>
                  <dd className="tabular-nums text-slate-700">
                    {formatUsd(row.paid.grossCents)}
                  </dd>
                </div>
                {row.paid.vatCents > 0 ? (
                  /*
                    VAT is shown to the clinician and marked as not theirs.
                    §3: the patient pays it on top, and a refund returns our cut
                    but never the tax. A clinician who sees only "patient paid"
                    and "you received" will read the gap as our fee, and be
                    wrong by the size of the tax.
                  */
                  <div className="flex gap-1.5">
                    <dt>
                      {t("thist.vat", {
                        percent: (row.paid.vatBps / 100).toFixed(
                          row.paid.vatBps % 100 === 0 ? 0 : 1,
                        ),
                      })}
                    </dt>
                    <dd className="tabular-nums text-slate-700">
                      {formatUsd(row.paid.vatCents)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex gap-1.5">
                  <dt>
                    {row.paid.feeBps > 0
                      ? t("thist.tookPercent", { percent: (row.paid.feeBps / 100).toFixed(0) })
                      : t("thist.took")}
                  </dt>
                  <dd className="tabular-nums text-slate-700">{formatUsd(row.paid.feeCents)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>{t("thist.received")}</dt>
                  <dd className="tabular-nums text-slate-700">{formatUsd(row.paid.netCents)}</dd>
                </div>
                {row.paid.presentedCurrency && row.paid.presentedCurrency !== row.paid.currency ? (
                  <div className="basis-full text-slate-400">
                    {row.paid.payerCountry
                      ? t("thist.paidInFrom", {
                          currency: row.paid.presentedCurrency.toUpperCase(),
                          country: row.paid.payerCountry,
                        })
                      : t("thist.paidIn", {
                          currency: row.paid.presentedCurrency.toUpperCase(),
                        })}
                  </div>
                ) : null}
              </dl>
            ) : null}

            {/*
              The clinician's own bill, which is a separate transaction from the
              patient's and is easy to forget exists. A free session still costs
              them: the AI ran either way.
            */}
            {row.ownBill ? (
              <p className="mt-1.5 text-xs text-slate-500">
                {t("thist.ownBill")}{" "}
                <span className="tabular-nums text-slate-700">
                  {row.ownBill.amountCents === 0
                    ? row.ownBill.description
                    : formatUsd(row.ownBill.amountCents)}
                </span>
                {row.ownBill.status === "due" && row.ownBill.amountCents > 0
                  ? ` · ${t("thist.billUnpaid")}`
                  : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
