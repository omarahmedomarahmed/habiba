import "server-only";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { auditLog, type AuditCategory } from "@/lib/db/schema";
import { clientIp, clientUserAgent } from "@/lib/request";
import type { Actor } from "@/lib/auth/session";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/audit.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


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
  /**
   * 🔴 The sponsor portal user who did it. PLAN.md 53.22, C234, 0086.
   *
   * A `SponsorActor` has no `userId` and no `organizationId` on purpose, so it
   * cannot be passed as an `Actor` and the compiler says so. That seam is
   * right, and for four sprints its consequence was that the payer's acts went
   * unrecorded rather than recorded differently. This is the column they go in.
   */
  sponsorUserId?: string | null;
  /**
   * 🔴 The clinic manager who did it. PLAN.md 54.4, C266, 0086. Same story.
   *
   * 🔴 Never set alongside `patientId`. A clinic manager is inside the tenancy
   * and sees none of the clinical record, so a row naming one beside a patient
   * would be a record of a read that cannot happen. Enforced below.
   */
  clinicManagerId?: string | null;
  category: AuditCategory;
  /** Verb-ish and stable, e.g. "session.read", "note.approve". */
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  patientId?: string | null;
  reason?: string | null;
  /**
   * 🔴 Board 593: the organisation the act was ON, when that is not the
   * actor's own. An operator adjusting a practice's books belongs to
   * 24Therapy, and the row named 24Therapy for Dr Amira's practice, so the
   * audit screen said the adjustment was ours. Defaults to the actor's.
   */
  organizationId?: string | null;
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

/** Returns the row's id, for the one caller that hands it on as proof of a read (the investigation grant). */
export async function audit(input: AuditInput): Promise<string | null> {
  const [ip, ua] = await Promise.all([clientIp(), clientUserAgent()]);

  /*
   * Not a defensive check for something that cannot happen — it is the
   * invariant the column split exists to hold. A row naming two actors would
   * make every "who did this" query ambiguous.
   *
   * 🔴 Widened in 0086 from two actors to four. The original read
   * `input.actor && input.patientAccountId`, which was exhaustive when there
   * were two principals and silently permissive the moment there were four.
   * That is the same shape as the check it guards against: a rule that was
   * complete when written and became a rule about half the cases.
   */
  const actors = [
    input.actor ? "clinician" : null,
    input.patientAccountId ? "patient" : null,
    input.sponsorUserId ? "sponsor" : null,
    input.clinicManagerId ? "clinic" : null,
  ].filter(Boolean);

  if (actors.length > 1) {
    throw new Error(`audit: an action has one actor, not ${actors.join(" and ")}`);
  }

  /*
   * 🔴 A clinic manager is inside the tenancy and sees none of the clinical
   * record (C259 defence 3). A row naming one beside a patient would be a
   * record of a read that cannot happen, and the first person to read the log
   * would reasonably conclude it did.
   */
  if (input.clinicManagerId && input.patientId) {
    throw new Error("audit: a clinic manager's act never names a patient");
  }

  const [row] = await db.insert(auditLog).values({
    organizationId: input.organizationId ?? input.actor?.organizationId ?? null,
    actorUserId: input.actor?.userId ?? null,
    actorAccountId: input.patientAccountId ?? null,
    actorSponsorUserId: input.sponsorUserId ?? null,
    actorClinicManagerId: input.clinicManagerId ?? null,
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
  }).returning({ id: auditLog.id });
  return row?.id ?? null;
}

/**
 * 🔴 An investigation's grant: the break-glass row written when the reader gave
 * their reason, by this reader, for this session, within the window. The page
 * renders on it without writing another, so a reload is not a second read on
 * the record, and the reason never travels in a URL.
 */
export const INVESTIGATION_WINDOW_MINUTES = 15;

export async function investigationGrantHolds(input: {
  grantId: string | null | undefined;
  actorUserId: string;
  sessionId: string;
}): Promise<boolean> {
  if (!isUuid(input.grantId)) return false;
  const { and, eq, gt } = await import("drizzle-orm");
  const [row] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.id, input.grantId),
        eq(auditLog.action, "break_glass.investigate"),
        eq(auditLog.actorUserId, input.actorUserId),
        eq(auditLog.resourceId, input.sessionId),
        gt(auditLog.createdAt, new Date(Date.now() - INVESTIGATION_WINDOW_MINUTES * 60_000)),
      ),
    )
    .limit(1);
  return Boolean(row);
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
