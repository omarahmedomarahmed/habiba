import { NextResponse } from "next/server";

import { handleWebhook } from "@/lib/billing/stripe";
import { log, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook.
 *
 * `await request.text()` gives the exact raw body Stripe signed. Worth being
 * explicit about, because the previous implementation read `req.rawBody` from a
 * NestJS app that was never constructed with `rawBody: true` — so the value was
 * always `undefined`, every signature check threw, and payment confirmation had
 * silently never worked in production.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    await handleWebhook(rawBody, signature);
    return NextResponse.json({ received: true });
  } catch (error) {
    // A 400 tells Stripe to retry. Verification failures are logged without the
    // body, which can contain customer identifiers.
    log.warn("stripe webhook rejected", { reason: safeErrorMessage(error) });
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
}
