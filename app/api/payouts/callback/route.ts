import { NextResponse } from "next/server";

import { payoutProvider } from "@/lib/billing/gateway";
import { applyPayoutEvent } from "@/lib/billing/payouts";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 64.1: the payouts provider's signed result. Verified before anything is
 * read, applied once, and answered 200 only after the ledger is written; the
 * same shape as the gateway's callback beside it.
 */
export async function POST(request: Request) {
  const provider = payoutProvider();
  if (!provider) return NextResponse.json({ error: "not_configured" }, { status: 404 });

  const rawBody = await request.text();
  const event = await provider.verifyCallback({ rawBody, headers: request.headers });
  if (!event) {
    log.warn("payouts callback rejected", { provider: provider.name });
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const result = await applyPayoutEvent(provider.name, event);
    /* A send we could not book is answered as a failure, so the provider retries it. */
    if (result.applied === "unapplied") return NextResponse.json({ error: "retry" }, { status: 409 });
    return NextResponse.json({ received: true, applied: result.applied });
  } catch (error) {
    log.error("payouts callback failed", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
