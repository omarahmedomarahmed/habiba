import { NextResponse } from "next/server";

import { listRadar } from "@/lib/data/radar";
import { callerKey, consume, globalCeiling } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Read limit.
 *
 * The homepage polls every 15s and the radar page every 15s, so a visitor with
 * both open is 8 requests a minute. Sixty is generous for a person and cheap to
 * enforce; the point is that the endpoint is public, uncached and hits the
 * database, so an unbounded scraper is free load on the one page that has to
 * stay up.
 */
const READS_PER_MINUTE = 60;

/**
 * And a ceiling for everyone together, because the per-network limit is only
 * as good as the attacker's address budget. Set well above real traffic: a
 * thousand reads a minute is roughly a hundred and twenty people with the page
 * open, which would be a very good day.
 */
const GLOBAL_READS_PER_MINUTE = 1000;

/**
 * Who is available, right now. Public and unauthenticated on purpose — a person
 * in crisis must not have to log in to find out whether anyone is there.
 *
 * It returns only what a clinician chose to publish about themselves. There is
 * no id here that unlocks anything: booking goes through a server action that
 * re-reads availability, throttles the caller and claims the slot in the
 * database, so a scraped user id buys nothing.
 */
export async function GET() {
  const verdict = await consume(await callerKey("radar:read"), READS_PER_MINUTE, 60);
  const ceiling = verdict.allowed ? await globalCeiling("radar:read", GLOBAL_READS_PER_MINUTE) : null;

  if (!verdict.allowed || (ceiling && !ceiling.allowed)) {
    const retryAfter = Math.max(verdict.retryAfter, ceiling?.retryAfter ?? 0) || 30;
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const therapists = await listRadar();

  return NextResponse.json(
    { therapists },
    {
      headers: {
        // Availability that is even ten seconds stale sends someone to a
        // clinician who is already busy.
        "Cache-Control": "no-store",
      },
    },
  );
}
