import { NextResponse } from "next/server";

import { publicProfile } from "@/lib/data/radar";
import { callerKey, consume } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One clinician's live state, for their public profile page.
 *
 * Separate from `/api/radar` because that endpoint answers "who is reachable",
 * and this one has to answer "is this particular person reachable" — including
 * when the answer is no. A profile whose availability line went blank the
 * moment its owner logged off would be worse than one that says "offline".
 *
 * Limited per network, not per profile: the cost of abuse is a database read
 * per poll, and somebody hammering ten profiles is the same problem as
 * somebody hammering one. The ceiling is set well above the page's own five
 * second cadence so a household behind one address never trips it.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const verdict = await consume(await callerKey("radar-profile"), 240, 60);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "slow_down" },
      { status: 429, headers: { "retry-after": String(verdict.retryAfter) } },
    );
  }

  const viewer = new URL(request.url).searchParams.get("v");
  const profile = await publicProfile(id, viewer);
  if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ profile });
}
