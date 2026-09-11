import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import { acrossRegions, dbFor } from "@/lib/db";
import { regionOfOrganization, regionOfPatient } from "@/lib/db/directory";
import {
  EXTERNAL_SOURCE_KINDS,
  sessionSources,
  sessions,
  type SessionSource,
  type SessionSourceKind,
} from "@/lib/db/schema";
import { mintIngestToken } from "@/lib/ingest/token";

/**
 * Reading and writing a session's source. PLAN.md 36.1, 36.2.
 *
 * 🔴 Routed on the patient, then the organisation (C154), like every clinical
 * read since the seam. A session source is not itself clinical, but it is the
 * key to a session's audio, and a key that lives in a different country from
 * the chart it opens is a key nobody can reason about.
 *
 * ## 36.3 — no bots ship in this sprint
 *
 * Nothing here calls a provider, creates a meeting or joins one. `provisioned`
 * is the shape sprint 41 will fill: a row that says *we made this meeting, on
 * this date, through this clinician's connection*. Until 41 there is one
 * writer of external kinds and it is a test.
 */

async function regionFor(patientId: string | null, organizationId: string) {
  return patientId ? regionOfPatient(patientId) : regionOfOrganization(organizationId);
}

export type SourceInput = {
  sessionId: string;
  organizationId: string;
  patientId: string | null;
  kind: SessionSourceKind;
  /** 🔴 Required for an external kind. The database refuses the row without it. */
  provisioned?: { externalMeetingId: string; byUserId: string; at?: Date };
};

/**
 * Record where a session's audio will come from.
 *
 * One per session, enforced by a unique index rather than by asking first: a
 * second source is a second place audio could arrive from, which is 41.7's
 * "bot in the wrong meeting" with the catch removed.
 */
export async function setSessionSource(input: SourceInput): Promise<SessionSource> {
  const db = dbFor(await regionFor(input.patientId, input.organizationId));

  const external = EXTERNAL_SOURCE_KINDS.includes(input.kind);
  if (external && !input.provisioned) {
    /*
     * The database would refuse this anyway. It is refused here too so the
     * error a developer meets says what the rule is rather than naming a
     * constraint: an external meeting exists because we made it.
     */
    throw new Error(
      `a ${input.kind} source must say which meeting we created and who we created it for`,
    );
  }

  const [row] = await db
    .insert(sessionSources)
    .values({
      sessionId: input.sessionId,
      organizationId: input.organizationId,
      kind: input.kind,
      externalMeetingId: external ? input.provisioned!.externalMeetingId : null,
      provisionedAt: external ? (input.provisioned!.at ?? new Date()) : null,
      provisionedByUserId: external ? input.provisioned!.byUserId : null,
    })
    .returning();

  return row!;
}

export async function sourceFor(
  sessionId: string,
  organizationId: string,
  patientId: string | null = null,
): Promise<SessionSource | null> {
  const db = dbFor(await regionFor(patientId, organizationId));

  const [row] = await db
    .select()
    .from(sessionSources)
    .where(
      and(
        eq(sessionSources.sessionId, sessionId),
        eq(sessionSources.organizationId, organizationId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Mint the session's ingestion token. Returned once, stored as a hash.
 *
 * 🔴 Audited on the way out. A credential that lets something upload audio into
 * a clinical record is exactly the kind of thing that must be answerable a year
 * later: who asked for it, for which session, and when.
 */
export async function issueIngestToken(
  actor: { userId: string; organizationId: string },
  sessionId: string,
  patientId: string | null = null,
  ttlHours = 6,
): Promise<{ token: string; expiresAt: Date }> {
  const db = dbFor(await regionFor(patientId, actor.organizationId));

  const minted = mintIngestToken(sessionId, ttlHours);

  const updated = await db
    .update(sessionSources)
    .set({
      ingestTokenHash: minted.hash,
      ingestTokenExpiresAt: minted.expiresAt,
      /* Minting a new one un-revokes nothing: revocation is per token, and a
         fresh hash makes every older token a mismatch by construction. */
      ingestTokenRevokedAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessionSources.sessionId, sessionId),
        eq(sessionSources.organizationId, actor.organizationId),
      ),
    )
    .returning({ id: sessionSources.id });

  if (updated.length === 0) {
    throw new Error("that session has no source to issue a token for");
  }

  await audit({
    actor,
    category: "clinical",
    action: "session.ingest_token.issue",
    resourceType: "session",
    resourceId: sessionId,
  });

  return { token: minted.token, expiresAt: minted.expiresAt };
}

export async function revokeIngestToken(
  actor: { userId: string; organizationId: string },
  sessionId: string,
  patientId: string | null = null,
): Promise<void> {
  const db = dbFor(await regionFor(patientId, actor.organizationId));

  await db
    .update(sessionSources)
    .set({ ingestTokenRevokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(sessionSources.sessionId, sessionId),
        eq(sessionSources.organizationId, actor.organizationId),
      ),
    );

  await audit({
    actor,
    category: "clinical",
    action: "session.ingest_token.revoke",
    resourceType: "session",
    resourceId: sessionId,
  });
}

/**
 * 🔴 The lookup the route makes, and the only one it may make.
 *
 * Keyed on the **session id from the URL**, never on the token's hash. Looking
 * a token up by hash across the table would find the right row and silently
 * accept a token minted for a different session, which is the failure the
 * whole design is arranged against. The hash comparison happens afterwards, in
 * `ingestDecision`, against the row this session already owns.
 */
export async function sourceForIngest(sessionId: string): Promise<
  | {
      source: {
        sessionId: string;
        ingestTokenHash: string | null;
        ingestTokenExpiresAt: Date | null;
        ingestTokenRevokedAt: Date | null;
      };
      session: {
        id: string;
        status: string;
        organizationId: string;
        therapistId: string;
        patientId: string | null;
        transcriptLanguage: string | null;
      };
    }
  | null
> {
  /*
   * 🔴 30.1 — ROUTED, and this is the one call in the product with nothing to
   * route ON.
   *
   * A bot presents a session id and no person, so the region cannot be
   * resolved before the row is read. The honest answer is not a pin: it is
   * `acrossRegions`, which asks every region and is exactly the fan-out C155
   * shipped for a caseload that spans them. Today both regions are one pool so
   * it is one query; the day Cairo is live it is two, and the session is found
   * wherever it lives rather than wherever the default is.
   */
  const rows = await acrossRegions((db) =>
    db
      .select({
        sessionId: sessionSources.sessionId,
        ingestTokenHash: sessionSources.ingestTokenHash,
        ingestTokenExpiresAt: sessionSources.ingestTokenExpiresAt,
        ingestTokenRevokedAt: sessionSources.ingestTokenRevokedAt,
        id: sessions.id,
        status: sessions.status,
        organizationId: sessions.organizationId,
        therapistId: sessions.therapistId,
        patientId: sessions.patientId,
        transcriptLanguage: sessions.transcriptLanguage,
      })
      .from(sessionSources)
      .innerJoin(sessions, eq(sessions.id, sessionSources.sessionId))
      .where(eq(sessionSources.sessionId, sessionId))
      .limit(1),
  );

  const row = rows[0];

  if (!row) return null;

  return {
    source: {
      sessionId: row.sessionId,
      ingestTokenHash: row.ingestTokenHash,
      ingestTokenExpiresAt: row.ingestTokenExpiresAt,
      ingestTokenRevokedAt: row.ingestTokenRevokedAt,
    },
    session: {
      id: row.id,
      status: row.status,
      organizationId: row.organizationId,
      therapistId: row.therapistId,
      patientId: row.patientId,
      transcriptLanguage: row.transcriptLanguage,
    },
  };
}

/** Count a successful use, so a token that is being replayed is visible. */
export async function recordIngestUse(
  sessionId: string,
  organizationId: string,
  patientId: string | null,
): Promise<void> {
  const db = dbFor(await regionFor(patientId, organizationId));

  await db
    .update(sessionSources)
    .set({ ingestUses: sql`${sessionSources.ingestUses} + 1`, ingestLastUsedAt: new Date() })
    .where(eq(sessionSources.sessionId, sessionId));
}
