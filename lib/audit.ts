import "server-only";

import { db } from "@/lib/db";
import { auditLog, type AuditCategory } from "@/lib/db/schema";
import { clientIp, clientUserAgent } from "@/lib/request";
import type { Actor } from "@/lib/auth/session";

type AuditInput = {
  actor: Pick<Actor, "userId" | "organizationId"> | null;
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
export async function audit(input: AuditInput): Promise<void> {
  const [ip, ua] = await Promise.all([clientIp(), clientUserAgent()]);

  await db.insert(auditLog).values({
    organizationId: input.actor?.organizationId ?? null,
    actorUserId: input.actor?.userId ?? null,
    category: input.category,
    action: input.action,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
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
