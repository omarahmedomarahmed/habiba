import { NextResponse } from "next/server";

import { launchClinician } from "@/lib/partner/launch";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 42.3 / 55.9 — POST /api/partner/v1/launch
 *
 * The embedded widget's door. A partner's server names one of its clinicians and gets back a
 * short-lived single-use URL for that clinician's BROWSER to open.
 *
 * 🔴 NO COOKIE IS SET HERE, and the first version of this route thought one was. The response
 * to this request goes to the partner's server, so a `Set-Cookie` on it would have put the
 * clinician's session in somebody else's HTTP client and left the clinician with none. The
 * cookie is set by `GET /api/partner/launch`, on the clinician's own navigation, which is the
 * only response that reaches them. See the header of `lib/partner/launch.ts`.
 *
 * 🔴 The URL opens a TOP-LEVEL WINDOW rather than an iframe: `X-Frame-Options: DENY` is sent on
 * every response and the session cookie is `sameSite: "lax"`, so a frame would neither render
 * nor carry a cookie. Both are deliberate and neither is relaxed per partner.
 *
 * ## 🔴 IT MINTS AN ORDINARY SESSION, AND THAT IS THE WHOLE DESIGN
 *
 * *So every existing screen works unchanged and the audit names the partner. There stays
 * exactly one way to be signed in.* A second credential for embedded clinicians would mean
 * every guard in the product growing an "or a partner launch" branch, and the day one
 * forgets is the day a widget reaches a screen it should not.
 *
 * 🔴 42.5 — no video by default. The launch targets are an allow list of four screens and
 * none of them is a room: a partner embedding us has their own video, and launching a
 * clinician into ours would put two video products on one screen and make the patient's
 * consent question arrive in the wrong one.
 *
 * 🔴 There is NO SCOPE for this, deliberately. Every key may launch, because a launch
 * grants nothing a clinician did not already have: it signs in a clinician who exists and
 * is verified, and everything they can then do is what they could do anyway. A scope here
 * would suggest launching is a privilege over the patient's data, and it is not.
 */
export async function POST(request: Request) {
  /*
   * `record:read` is the scope asked for, and the reason is not the one it looks like: a
   * partner with no data-plane scope at all has no use for an embedded clinician, and
   * requiring the narrowest real scope keeps "every key may launch" from meaning "a key
   * with no scopes at all may launch", which would make a revoked-down key still useful.
   */
  const guard = await withKey(request, "record:read");
  if ("response" in guard) return guard.response;

  let body: { clinician?: unknown; target?: unknown };
  try {
    body = (await request.json()) as { clinician?: unknown; target?: unknown };
  } catch {
    return fail("Send JSON.", 400);
  }

  if (typeof body.clinician !== "string") return fail("Send a clinician email.", 400);

  const result = await launchClinician({
    key: guard.key,
    clinicianEmail: body.clinician,
    target: typeof body.target === "string" ? body.target : undefined,
  });

  if ("error" in result) return fail(result.error, result.status);

  /* 🔴 An absolute, single-use URL that expires in two minutes. Open it in a new window. */
  return NextResponse.json({ url: result.url });
}
