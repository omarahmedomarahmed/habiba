import { NextResponse, type NextRequest } from "next/server";

import { csvCell } from "@/lib/csv";
import { publishedLedger } from "@/lib/data/sponsor-ledger";
import { enrolledCount } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { getSponsorActor } from "@/lib/sponsor-auth/session";
import { filterPeriods, ledgerCsvRows, parseLedgerQuery, privacyFloor, sortPeriods } from "@/lib/sponsor/ledger";

export const dynamic = "force-dynamic";

/**
 * 🔴 W2-S10 / F7: THE COMPANY'S MONEY LEDGER AS A CSV, the periods on the page
 * with the same filters and sort, and no more: a period, its sessions and its
 * spend. Never a row per session, a price or an employee share.
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
  const [headcount, settings] = await Promise.all([enrolledCount(actor.sponsorId), getSettings()]);
  /* 🔴 K6: the same headcount gate as the screen, and nothing is read under it. */
  const under = headcount < privacyFloor(settings.sponsor.activityFloor);
  const ledger = under ? null : await publishedLedger(actor.sponsorId);
  const periods = ledger ? (query.by === "month" ? ledger.months : ledger.weeks) : [];

  const rows = ledgerCsvRows(sortPeriods(filterPeriods(periods, query), query), [
    t("sponsor.ledgerPeriod"),
    t("sponsor.sessionsTotal"),
    t("sponsor.spentTotal"),
  ]);
  const body = rows.map((line) => line.map(csvCell).join(",")).join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pot-spend-by-period.csv"',
      "Cache-Control": "no-store",
    },
  });
}
