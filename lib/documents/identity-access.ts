import "server-only";

import { eq } from "drizzle-orm";

import type { Actor } from "@/lib/auth/session";
import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { therapistVerifications } from "@/lib/db/schema";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/documents/identity-access.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * May this person read this identity document, right now? PLAN.md 29.1.
 *
 * ## 🔴 Why these were the last files still protected by a URL
 *
 * H14 is that **a blob URL is a secret, not access control**, and sprint 8
 * acted on it for clinical documents: `person_documents.blob_url` never leaves
 * the server, and every read comes back through `/api/documents/<id>` to be
 * checked and recorded. Identity documents were left behind, and they are the
 * worst possible thing to leave behind: a passport page and a licence, for a
 * real named person, sitting on a URL that works forever, for anybody who ever
 * saw it, with no audit trail and no way to revoke it.
 *
 * They were reached through exactly the two screens you would expect — the
 * clinician's own onboarding page and the admin review queue — and both put
 * the raw URL into the HTML, which is where a URL stops being a secret: a
 * screenshot, a forwarded browser tab, a support ticket with the page pasted
 * in. This closes that.
 *
 * ## Who may read one
 *
 * Two answers, and no third:
 *
 *   - **The clinician it is about.** They uploaded it and must be able to see
 *     which file they sent, or the onboarding screen cannot tell them.
 *   - **A super admin**, because reviewing these is the entire verification
 *     process and refusing it would mean no clinician could ever be approved.
 *
 * Not a manager, not a colleague in the same organisation, not a staff member
 * on the support queue. Organisation membership is the wrong boundary here:
 * a passport is not practice data, and 20.9 already draws the line that the
 * back office does not touch clinical material. This draws the same line
 * around identity material, in the other direction.
 *
 * ## Why it is a module rather than a check in the route
 *
 * The same reason `documentReadDecision` is: two copies of a consent check is
 * two chances for them to disagree, and the one that disagrees in the
 * permissive direction is the one nobody notices. The local-disk fallback
 * route calls this too.
 */

/** The four columns, named. A kind that is not one of these does not resolve. */
export const IDENTITY_KINDS = ["idFront", "idBack", "licenseDoc", "headshot"] as const;
export type IdentityKind = (typeof IDENTITY_KINDS)[number];

const COLUMN = {
  idFront: therapistVerifications.idFrontUrl,
  idBack: therapistVerifications.idBackUrl,
  licenseDoc: therapistVerifications.licenseDocUrl,
  headshot: therapistVerifications.headshotUrl,
} as const;

export const IDENTITY_LABEL: Record<IdentityKind, string> = {
  idFront: "ID, front",
  idBack: "ID, back",
  licenseDoc: "Licence",
  /*
   * 🔴 Not "(public)", which is what the admin queue called it until sprint 29.
   *
   * The headshot a patient sees is `therapist_radar.photo_url`, set by the
   * clinician on their own radar screen. THIS one is uploaded for verification
   * and published nowhere. A reviewer told it was public would reasonably
   * treat it more casually than the passport beside it, which is the opposite
   * of true.
   */
  headshot: "Headshot",
};

/**
 * The reference that appears in a page. PLAN.md 29.1.
 *
 * Deliberately built from the verification id and the kind rather than being a
 * per-file id: there is no per-file row to have an id, and inventing a table
 * to hold one would be schema for the sake of a URL shape. The verification id
 * is a uuid and carries no authority on its own, which is the whole point:
 * this route authorises on every request rather than trusting the string.
 */
export function identityDocumentPath(verificationId: string, kind: IdentityKind): string {
  return `/api/uploads/${verificationId}.${kind}`;
}

export function parseIdentityRef(
  id: string,
): { verificationId: string; kind: IdentityKind } | null {
  const dot = id.lastIndexOf(".");
  if (dot < 1) return null;

  const verificationId = id.slice(0, dot);
  const kind = id.slice(dot + 1);

  if (!/^[0-9a-f-]{36}$/i.test(verificationId)) return null;
  if (!IDENTITY_KINDS.includes(kind as IdentityKind)) return null;

  return { verificationId, kind: kind as IdentityKind };
}

export type IdentityDecision =
  | { allowed: false }
  | { allowed: true; storedUrl: string; ownerUserId: string; organizationId: string };

export async function identityReadDecision(input: {
  verificationId: string;
  kind: IdentityKind;
  actor: Actor | null;
}): Promise<IdentityDecision> {
  if (!input.actor) return { allowed: false };

  const [row] = await db
    .select({
      ownerUserId: therapistVerifications.userId,
      organizationId: therapistVerifications.organizationId,
      storedUrl: COLUMN[input.kind],
    })
    .from(therapistVerifications)
    .where(eq(therapistVerifications.id, input.verificationId))
    .limit(1);

  if (!row?.storedUrl) return { allowed: false };

  const isOwner = row.ownerUserId === input.actor.userId;
  const isAdmin = input.actor.role === "super_admin";

  if (!isOwner && !isAdmin) return { allowed: false };

  return {
    allowed: true,
    storedUrl: row.storedUrl,
    ownerUserId: row.ownerUserId,
    organizationId: row.organizationId,
  };
}

/**
 * The same question about a stored PATH, for the local-disk fallback.
 *
 * That route existed so a checkout with no Blob token could run the onboarding
 * flow, and it asked one question: are you signed in. Which meant any
 * clinician on that deployment could read any other clinician's passport by
 * walking a path. It is development-only and it was still wrong, and a
 * development-only hole is the one that gets copied into the real thing.
 *
 * The stored path is `<kind>/<userId>/<label>-<secret>.<ext>`, so the owner is
 * in the path and can be checked without a query.
 */
export function localUploadAllowed(path: string, actor: Actor | null): boolean {
  if (!actor) return false;
  if (actor.role === "super_admin") return true;

  const owner = path.split("/")[1];
  return Boolean(owner) && owner === actor.userId;
}
