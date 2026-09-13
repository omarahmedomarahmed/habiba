import { NextResponse } from "next/server";

import { verifyEmployment } from "@/lib/partner/employment";
import { fail, withKey } from "@/lib/partner/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 🔴 55.4 / C255 / C265 — POST /api/partner/v1/employment/verify
 *
 * *One person, one question, one boolean, one timestamp. Never a directory, never a list,
 * never a sync.*
 *
 * ## 🔴 WHY THIS IS A POST AND HAS NO GET
 *
 * A GET with the identifier in the path or the query would put a work email address into
 * every access log, proxy cache and browser history between the partner and us, and make
 * the endpoint trivially crawlable. A POST also means no route shape exists that could be
 * extended with a page parameter, which is the thing C255 is most worried about.
 *
 * ## 🔴 AND THERE IS NO ROUTE THAT LISTS ANYTHING
 *
 * `app/api/partner/v1/employment/` contains this one file. No `[sponsorId]`, no
 * `/employees`, no `/changes`. Where an HR API only offers a full listing we decline to
 * integrate in v1 rather than accept the dump, which is C255's stated cost.
 */
export async function POST(request: Request) {
  const guard = await withKey(request, "employment:verify");
  if ("response" in guard) return guard.response;

  let body: { identifier?: unknown };
  try {
    body = (await request.json()) as { identifier?: unknown };
  } catch {
    return fail("Send JSON.", 400);
  }

  if (typeof body.identifier !== "string") return fail("Send an identifier.", 400);

  /*
   * 🔴 The sponsor comes from the KEY, and there is no parameter that could override it.
   *
   * C265's opening sentence is that a key able to ask about any organisation is an
   * identity oracle pointed at our own patients. `verifyEmployment` takes no sponsor id
   * for that reason, so there is nothing for this handler to pass even if a caller sent
   * one.
   */
  const result = await verifyEmployment({ key: guard.key, identifier: body.identifier });

  if ("error" in result) return fail(result.error, result.status);

  return NextResponse.json(result);
}
