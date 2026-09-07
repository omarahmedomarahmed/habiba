import "server-only";

import { db } from "@/lib/db";
import { auditLog, type AuditCategory } from "@/lib/db/schema";
import { clientIp, clientUserAgent } from "@/lib/request";
import type { Actor } from "@/lib/auth/session";

type AuditInput = {
  actor: Pick<Actor, "userId" | "organizationId"> | null;
  /**
   * The patient who did it. PLAN.md 7.6.
   *
   * A patient has no `Actor` and no organisation — see C41 — so they cannot be
   * passed as one. Set this instead, with `actor: null`. Exactly one of the two
   * is ever set: "who revoked this grant?" must not be answerable only by
   * guessing which table the id belongs to.
   */
  patientAccountId?: string | null;
  category: AuditCategory;
  /** Verb-ish and stable, e.g. "session.read", "note.approve". */
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  patientId?: string | null;
  reason?: string | null;
};

/**
 * Write an audit record.
 *
 * This is awaited and it is allowed to throw. The old implementation wrapped
 * every insert in `.catch(() => null)`, and three of its writers named columns
 * that did not exist — so for months the system believed it was logging PHI
 * access and was in fact logging nothing. An audit trail that fails silently is
 * worse than no audit trail, because you plan around it.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID.test(value);
}

export async function audit(input: AuditInput): Promise<void> {
  const [ip, ua] = await Promise.all([clientIp(), clientUserAgent()]);

  if (input.actor && input.patientAccountId) {
    // Not a defensive check for something that cannot happen — it is the
    // invariant the column split exists to hold. A row naming both actors
    // would make every "who did this" query ambiguous.
    throw new Error("audit: an action has one actor, not both a clinician and a patient");
  }

  await db.insert(auditLog).values({
    organizationId: input.actor?.organizationId ?? null,
    actorUserId: input.actor?.userId ?? null,
    actorAccountId: input.patientAccountId ?? null,
    category: input.category,
    action: input.action,
    resourceType: input.resourceType ?? null,
    /*
     * 🔴 A UUID goes in the UUID column; anything else goes in `resource_key`.
     *
     * `resource_id` is typed `uuid`, and Postgres refuses `"pricing"` or
     * `"common.continue:ar"` outright — which, because this function is
     * deliberately allowed to throw, took the whole action down with it. The
     * taxonomy editor had been failing that way since sprint 1: every save
     * wrote its row and then threw at the audit, so the admin saw an error and
     * the change looked lost.
     *
     * Routing here rather than at ~30 call sites means the next person to
     * audit a non-row resource cannot reintroduce it.
     */
    resourceId: isUuid(input.resourceId) ? input.resourceId : null,
    resourceKey: isUuid(input.resourceId) ? null : (input.resourceId ?? null),
    patientId: input.patientId ?? null,
    reason: input.reason ?? null,
    ipAddress: ip,
    userAgent: ua,
  });
}

/**
 * Convenience wrapper for the common case: someone read or wrote clinical data.
 * Called from the data layer, not from a route-matching interceptor — the old
 * regex-on-the-URL approach missed four whole modules and recorded session IDs
 * in the patient_id column, which makes "who read patient X's chart?"
 * unanswerable.
 */
export async function auditPhi(
  actor: Pick<Actor, "userId" | "organizationId">,
  action: string,
  opts: { resourceType: string; resourceId?: string | null; patientId?: string | null },
): Promise<void> {
  await audit({
    actor,
    category: "phi_access",
    action,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId ?? null,
    patientId: opts.patientId ?? null,
  });
}
