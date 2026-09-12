import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { getActor } from "@/lib/auth/session";
import {
  identityReadDecision,
  parseIdentityRef,
} from "@/lib/documents/identity-access";
import { log, ref, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only way identity document bytes reach anybody. PLAN.md 29.1, H14.
 *
 * A deliberate mirror of `/api/documents/[id]`, down to the order of the three
 * questions, because the two routes protect the same class of thing and the
 * day they diverge is the day one of them is weaker for no reason anybody
 * decided:
 *
 *   1. **Who is asking.** `getActor()`, and nothing else: there is no patient
 *      case here, because a patient has no business with a clinician's
 *      passport and inventing a branch for them would be inventing a door.
 *   2. **May they read it now.** The owning clinician, or a super admin. That
 *      is the whole list, and it lives in `identity-access.ts` so the
 *      local-disk route cannot answer differently.
 *   3. **Audited.** Before the bytes, never after. A read that streams and
 *      then fails to log is a read nobody can prove happened, and "who looked
 *      at my passport" is precisely the question this has to be able to answer.
 *
 * ## Why a 404 rather than a 403
 *
 * Same as the documents route and same as the avatar route: a 403 confirms
 * that a verification with that id exists and holds a document of that kind.
 * A stranger walking uuids should learn nothing from the difference between a
 * real reference and an invented one.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const reference = parseIdentityRef(id);
  if (!reference) return new NextResponse("Not found", { status: 404 });

  const actor = await getActor();
  const decision = await identityReadDecision({ ...reference, actor });
  if (!decision.allowed) return new NextResponse("Not found", { status: 404 });

  await audit({
    actor: { userId: actor!.userId, organizationId: actor!.organizationId },
    category: "admin",
    action: "identity_document.read",
    resourceType: "therapist_verification",
    resourceId: reference.verificationId,
    /*
     * Which document, and whose. A log line saying somebody opened "a
     * verification" cannot answer the question this exists for.
     */
    reason: `${reference.kind} of ${decision.ownerUserId}`,
  });

  try {
    /*
     * The local-disk fallback stores a same-origin path rather than an https
     * URL (see `lib/uploads.ts`). Handing that to `fetch` would ask the app to
     * call itself, so it is refused here and served by the catch-all route,
     * which now asks the same question this one does.
     */
    if (!decision.storedUrl.startsWith("https://")) {
      return NextResponse.redirect(new URL(decision.storedUrl, _request.url));
    }

    const upstream = await fetch(decision.storedUrl);
    if (!upstream.ok || !upstream.body) {
      log.warn("identity document fetch failed", {
        verification: ref(reference.verificationId),
        status: upstream.status,
      });
      return new NextResponse("Unavailable", { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        /*
         * `inline`, and a filename that names the KIND rather than the stored
         * path, which would put the blob secret into a download dialog and
         * undo the entire route.
         */
        "content-disposition": `inline; filename="${reference.kind}.jpg"`,
        // Never cached anywhere but the tab that asked.
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        // A stored file must never execute in our origin, whatever its type.
        "content-security-policy":
          "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    log.error("identity document stream failed", {
      verification: ref(reference.verificationId),
      reason: safeErrorMessage(error),
    });
    return new NextResponse("Unavailable", { status: 502 });
  }
}
