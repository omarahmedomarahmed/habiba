import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/guard";
import { radarCommandView } from "@/lib/data/radar-admin";

export const dynamic = "force-dynamic";

/**
 * The live feed behind the command deck.
 *
 * Authenticated on every request through `requireRole`, not once when the page
 * loaded — a polling endpoint that trusts the page that opened it is an
 * endpoint that keeps serving after a session is revoked.
 */
export async function GET() {
  await requireRole("super_admin");

  return NextResponse.json(await radarCommandView(), {
    headers: { "Cache-Control": "no-store, private" },
  });
}
