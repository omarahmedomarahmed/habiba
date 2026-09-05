import { NextResponse, type NextRequest } from "next/server";

import { ownerOf } from "@/lib/data/documents";
import { documentReadDecision } from "@/lib/documents/read-access";
import { audit } from "@/lib/audit";
import { getActor } from "@/lib/auth/session";
import { optionalPatient } from "@/lib/patient-auth/guard";
import { log, ref, safeErrorMessage } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only way document bytes reach anybody. PLAN.md 8.10.
 *
 * ## Why this route exists at all
 *
 * H14: **a blob URL is a secret, not access control.** Anyone holding one has
 * the file, forever, with no audit trail and no way to revoke it — which makes
 * it useless for a document whose access is supposed to end the moment a
 * patient taps "stop their access". So `person_documents.blob_url` never
 * leaves the server. The browser gets `/api/documents/<id>`, and every single
 * read comes back through here to be checked and recorded.
 *
 * ## Three checks, in order
 *
 *   1. **Who is asking.** A patient (their own record only) or a clinician.
 *   2. **May they read it now.** For a clinician, `accessFor` — which means a
 *      revoked grant stops the next byte, not the next session.
 *   3. **Audited.** Before the bytes, never after: a read that streams and
 *      then fails to log is a read nobody can prove happened.
 *
 * ## What the clinician keeps when revoked
 *
 * §3 leaves a revoked clinician "docs they uploaded" — so a document whose
 * `uploaded_by_user_id` is theirs stays readable even in the degraded state.
 * That exception is here rather than in `capabilities`, because it is a fact
 * about one document rather than about the relationship.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const document = await ownerOf(id);
  if (!document) return new NextResponse("Not found", { status: 404 });
  if (!document.blobUrl) {
    // A typed or dictated document has no file. Its text is rendered on the
    // page it belongs to; there is nothing to stream.
    return new NextResponse("Not a file", { status: 404 });
  }

  const decision = await documentReadDecision({
    personId: document.personId,
    uploadedByUserId: document.uploadedByUserId,
    actor: await getActor(),
    patient: await optionalPatient(),
  });
  if (!decision.allowed) return new NextResponse("Not found", { status: 404 });

  await audit({
    actor: decision.actor,
    patientAccountId: decision.patientAccountId,
    category: "phi_access",
    action: "document.read",
    resourceType: "person_document",
    resourceId: id,
  });

  try {
    const upstream = await fetch(document.blobUrl);
    if (!upstream.ok || !upstream.body) {
      log.warn("document fetch failed", { document: ref(id), status: upstream.status });
      return new NextResponse("Unavailable", { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "content-type": document.mimeType ?? "application/octet-stream",
        /*
         * `inline`, and a filename that is the title rather than the stored
         * path — which would leak the blob secret into a download dialog.
         */
        "content-disposition": `inline; filename="${safeFilename(document.title)}"`,
        // Never cached anywhere but the tab that asked. A shared cache holding
        // clinical bytes would outlive the consent that allowed the read.
        "cache-control": "private, no-store, max-age=0",
        "x-content-type-options": "nosniff",
        // A stored file must never execute in our origin, whatever its type.
        "content-security-policy":
          "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (error) {
    log.error("document stream failed", { document: ref(id), reason: safeErrorMessage(error) });
    return new NextResponse("Unavailable", { status: 502 });
  }
}

/** Quotes and newlines out of a header value; the rest is cosmetic. */
function safeFilename(title: string): string {
  return title.replace(/[^\w \-.]+/g, "_").slice(0, 80) || "document";
}
