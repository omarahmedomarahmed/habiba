import { NextResponse } from "next/server";

import { authenticateKey } from "@/lib/partner/keys";
import { verifyEmployment } from "@/lib/partner/employment";
import { callerKey, consume } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 66.3 — POST /api/hr/v1/employment
 *
 * *Does this person work here?* One identifier, one boolean, one timestamp.
 *
 * ## 🔴 WHY IT IS UNDER `/api/hr` AND NOT `/api/partner/v1`
 *
 * The caller is the COMPANY, signed in to their own portal to mint the key, asking
 * about their own staff. A third party's API and a customer's own integration are two
 * different products with two different consent stories, and putting them under one
 * path would make "which of our APIs is this" a question somebody has to answer by
 * reading the scope list.
 *
 * It also keeps `verify:sprint55`'s pairing honest: that check asserts one partner
 * route per PARTNER scope, and this is neither.
 *
 * ## 🔴 C265 IS INHERITED, NOT RE-IMPLEMENTED
 *
 * `verifyEmployment` is the same function it was when a partner held the key, with
 * the same four defences:
 *
 *   1. The key's OWN sponsor, never one the caller names. There is no parameter.
 *   2. Only an identifier somebody typed into their own enrolment minutes ago.
 *   3. Claimed with a conditional UPDATE, so one attestation answers once.
 *   4. An abnormal rate SUSPENDS the key rather than refusing the call.
 *
 * Moving portals changed the door and nothing behind it, which is the whole of 66.3.
 *
 * ## 🔴 AND `withKey` IS NOT USED, DELIBERATELY
 *
 * `withKey` narrows to a `PartnerKey`, refusing a key with no partner, because every
 * route under `v1` works inside a partner's tenancy. This route is the opposite case,
 * so it authenticates directly and asserts the mirror condition: a key here must have
 * a SPONSOR and must not have a partner.
 */
export async function POST(request: Request) {
  /*
   * Per caller, before the key is read, for the reason `withKey` gives: an
   * unauthenticated caller must not be able to make us do database work at machine
   * speed, and no per-key limit can prevent that because they have no key.
   */
  const throttle = await consume(await callerKey("hr-api"), 240, 60);
  if (!throttle.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const authed = await authenticateKey(
    request.headers.get("authorization"),
    "employment:verify",
  );

  if ("failure" in authed) {
    return NextResponse.json({ error: authed.failure.error }, { status: authed.failure.status });
  }

  /*
   * 🔴 66.4 — A KEY HERE IS A SPONSOR'S OWN, AND THE MIRROR OF `withKey`'S CHECK.
   *
   * A partner's key carrying this scope would be the thing sprint 55 cut: a third
   * party asking us about a company's staff. It cannot exist, because the partner
   * portal's key form draws from `API_SCOPES` and this scope is not in it. Checked
   * anyway, in one line, at the only door that leads here.
   */
  if (authed.key.partnerId || !authed.key.sponsorId) {
    return NextResponse.json({ error: "That key is not valid." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  if (typeof body.identifier !== "string") {
    return NextResponse.json(
      {
        error:
          "Send identifier: the staff number or address the person typed into their own enrolment.",
      },
      { status: 400 },
    );
  }

  const result = await verifyEmployment({
    key: authed.key,
    identifier: body.identifier,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  /*
   * 🔴 66.7 — CONNECTED MEANS A CALL SUCCEEDED, AND THIS IS WHERE IT IS STAMPED.
   *
   * `lastUsedAt` is written by the limiter on every authenticated call including the
   * ones that then fail on a scope or an attestation, so an indicator built on it goes
   * green for a key that has never answered anything. This is stamped only here, past
   * every refusal, on the one line that returns an answer.
   */
  const { stampSuccess } = await import("@/lib/partner/keys");
  await stampSuccess(authed.key.keyId);

  return NextResponse.json({ active: result.active, as_of: result.asOf });
}
