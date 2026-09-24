import { NextResponse, type NextRequest } from "next/server";

import { csvCell } from "@/lib/csv";
import { publishedLedger } from "@/lib/data/sponsor-ledger";
import { getI18n } from "@/lib/i18n/server";
import { getSponsorActor } from "@/lib/sponsor-auth/session";
import { filterLedger, ledgerCsvRows, parseLedgerQuery, sortLedger } from "@/lib/sponsor/ledger";

export const dynamic = "force-dynamic";

/**
 * 🔴 W2-S10: THE COMPANY'S MONEY LEDGER AS A CSV, the rows on the page with the
 * same filters and sort, and no more: a week, a kind and four amounts, never a
 * name, a therapist or a specialty (the table has none to give).
 *
 * Behind the company's own login like every page here, answered 401 rather
 * than redirected, because a spreadsheet import does not follow a sign-in page.
 * Every cell goes through `csvCell` (W1-19), so nothing in it runs as a formula.
 */
export async function GET(request: NextRequest) {
  const actor = await getSponsorActor();
  if (!actor) return new NextResponse("Sign in first.", { status: 401 });

  const { t } = await getI18n();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const query = parseLedgerQuery(params);
  const { entries } = await publishedLedger(actor.sponsorId);

  const rows = ledgerCsvRows(
    sortLedger(filterLedger(entries, query), query),
    [
      t("sponsor.ledgerWeek"),
      t("sponsor.ledgerKind"),
      t("sponsor.ledgerPrice"),
      t("sponsor.ledgerCoverage"),
      t("sponsor.ledgerCovered"),
      t("sponsor.ledgerEmployee"),
    ],
    (kind) => (kind === "refund" ? t("sponsor.ledgerRefund") : t("sponsor.ledgerSession")),
  );
  const body = rows.map((line) => line.map(csvCell).join(",")).join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="session-money.csv"',
      "Cache-Control": "no-store",
    },
  });
}
