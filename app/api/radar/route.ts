import { NextResponse } from "next/server";

import { listRadar } from "@/lib/data/radar";

export const dynamic = "force-dynamic";

/**
 * Who is available, right now. Public and unauthenticated on purpose — a person
 * in crisis must not have to log in to find out whether anyone is there.
 *
 * It returns only what a clinician chose to publish about themselves. There is
 * no id here that unlocks anything: booking goes through a server action that
 * re-reads availability and claims the slot in the database, so a scraped user
 * id buys nothing.
 */
export async function GET() {
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
