import { NextResponse } from "next/server";

import { AuthorizationError, requireUserApi } from "@/lib/auth/guard";
import { getRadarProfile, heartbeat, pendingBooking } from "@/lib/data/radar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type RadarPing = {
  attention: Awaited<ReturnType<typeof pendingBooking>>;
  status: "offline" | "online" | "pending" | "in_session";
  suspendedUntil: string | null;
  suspendedReason: string | null;
};

/**
 * One request: stay on the radar, and find out who is knocking. The
 * clinician's presence component polls it every few seconds.
 *
 * A route rather than a server action (review fix): an action cannot carry the
 * background header, so every ping counted as the clinician being at the
 * screen and the portal never idled out. The caller sends it with
 * `backgroundFetch`, so the idle clock only moves for what a person does.
 */
export async function POST() {
  try {
    const actor = await requireUserApi();
    await heartbeat(actor.userId);
    const [attention, profile] = await Promise.all([
      pendingBooking(actor.userId),
      getRadarProfile(actor.userId),
    ]);
    const body: RadarPing = {
      attention,
      status: (profile?.status ?? "offline") as RadarPing["status"],
      suspendedUntil: profile?.suspendedUntil?.toISOString() ?? null,
      suspendedReason: profile?.suspendedReason ?? null,
    };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
