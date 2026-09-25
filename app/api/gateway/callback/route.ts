import { NextResponse } from "next/server";

import { collectionGateway } from "@/lib/billing/gateway";
import { applyGatewayEvent } from "@/lib/billing/gateway/session";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 64.1: the card gateway's signed result.
 *
 * The raw body is what the gateway signed, so it is read once as text and
 * handed to the adapter to verify. Anything that does not verify is answered
 * 400 and does nothing: a forged "paid" is not an event. A verified event is
 * applied once however often it arrives (`applyGatewayEvent` claims the attempt
 * in its WHERE), and answered 200 only after the books are written, so a
 * gateway that retries on anything else retries into an idempotent claim.
 */
export async function POST(request: Request) {
  const gateway = await collectionGateway();
  if (!gateway) return NextResponse.json({ error: "not_configured" }, { status: 404 });

  const rawBody = await request.text();
  /* The URL too: Paymob signs into the query string (`?hmac=`). */
  const event = await gateway.verifyCallback({ rawBody, headers: request.headers, url: request.url });
  if (!event) {
    log.warn("gateway callback rejected", { gateway: gateway.name });
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const result = await applyGatewayEvent(gateway.name, event);
    return NextResponse.json({ received: true, applied: result.applied });
  } catch (error) {
    log.error("gateway callback failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
