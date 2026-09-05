import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { audit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  contentFlags,
  documentChunks,
  people,
  personDocuments,
  type DocumentSource,
  type FlagReason,
  type FlagTarget,
  type PersonDocument,
} from "@/lib/db/schema";
import { chunkText, type DocumentRef } from "@/lib/documents/chunk";
import { documentProblem, extensionFor, readabilityOf } from "@/lib/documents/formats";
import { log, ref as logRef, safeErrorMessage } from "@/lib/logger";

/**
 * The personal profile: documents that belong to a person. PLAN.md 8.1–8.8.
 *
 * ## Nothing here checks consent
 *
 * Deliberately. `lib/data/grants.ts` decides who may read what, and a second
 * opinion about it in this module would be a second place for it to be wrong.
 * Every caller passes through `accessFor` first; the one exception is the
 * document *stream* (`app/api/documents/[id]`), which does its own check
 * because it is the only path that hands out bytes.
 *
 * ## Ordinals, not ids, and never reused
 *
 * `[D7:3]` is stable forever. The ordinal is allocated once, from a
 * `MAX(ordinal) + 1` inside the insert, and nothing renumbers. A deleted
 * document leaves a hole, which is correct: a citation to it should fail to
 * resolve rather than silently open the document that took its place.
 */

/* --------------------------------------------------------------- writing -- */

export type AddResult =
  { ok: true; documentId: string; ordinal: number } | { ok: false; error: string };

/**
 * Typed or dictated text. 8.1.
 *
 * Chunked inline because there is nothing to parse — the text is already ours,
 * and chunking a few kilobytes of prose is microseconds. H9 is about *long*
 * jobs; making a therapist wait for a background worker to index the paragraph
 * they just typed would be latency for its own sake.
 */
export async function addTextDocument(input: {
  personId: string;
  source: Extract<DocumentSource, "typed" | "dictated">;
  title: string;
  body: string;
  documentDate?: Date | null;
  byUserId?: string | null;
  byAccountId?: string | null;
  organizationId?: string | null;
}): Promise<AddResult> {
  const body = input.body.trim();
  if (!body) return { ok: false, error: "There is nothing written down yet." };
  if (!input.title.trim()) return { ok: false, error: "Give it a title." };

  const [document] = await db
    .insert(personDocuments)
    .values({
      personId: input.personId,
      ordinal: nextOrdinal(input.personId),
      source: input.source,
      title: input.title.trim(),
      body,
      documentDate: input.documentDate ?? null,
      uploadedByUserId: input.byUserId ?? null,
      uploadedByAccountId: input.byAccountId ?? null,
      organizationId: input.organizationId ?? null,
      // Text we already hold needs no extraction step at all.
      extraction: "none",
      extractedAt: new Date(),
    })
    .returning({ id: personDocuments.id, ordinal: personDocuments.ordinal });

  if (!document) return { ok: false, error: "That could not be saved. Try again." };

  await writeChunks(document.id, input.personId, body);
  await auditDocument("document.add", document.id, input);

  return { ok: true, documentId: document.id, ordinal: document.ordinal };
}

/**
 * An uploaded file. 8.2 / 8.4.
 *
 * Stored first, read later — or never. The row is written whatever happens to
 * the text, because a document we cannot index is still a document the person
 * owns and a clinician can look at.
 */
export async function addUploadedDocument(input: {
  personId: string;
  title: string;
  file: File;
  documentDate?: Date | null;
  byUserId?: string | null;
  byAccountId?: string | null;
  organizationId?: string | null;
}): Promise<AddResult> {
  const problem = documentProblem(input.file);
  if (problem) return { ok: false, error: problem };

  const stored = await storeBlob(input.personId, input.file);
  if ("error" in stored) return { ok: false, error: stored.error };

  const readable = readabilityOf(input.file.type);

  const [document] = await db
    .insert(personDocuments)
    .values({
      personId: input.personId,
      ordinal: nextOrdinal(input.personId),
      source: "upload",
      title: input.title.trim() || input.file.name || "Document",
      blobUrl: stored.url,
      mimeType: input.file.type,
      byteSize: input.file.size,
      documentDate: input.documentDate ?? null,
      uploadedByUserId: input.byUserId ?? null,
      uploadedByAccountId: input.byAccountId ?? null,
      organizationId: input.organizationId ?? null,
      /*
       * H9 — queued, not read here. Even a format we can parse goes to the
       * worker: a 25 MB file on a request handler is a timeout waiting for the
       * one document that matters.
       *
       * `unsupported` is written immediately for anything we will never read,
       * so the screen can say "image — not searchable" straight away rather
       * than showing a spinner that resolves into a disappointment.
       */
      extraction: readable === "readable" ? "pending" : "unsupported",
    })
    .returning({ id: personDocuments.id, ordinal: personDocuments.ordinal });

  if (!document) return { ok: false, error: "That could not be saved. Try again." };

  await auditDocument("document.add", document.id, input);
  return { ok: true, documentId: document.id, ordinal: document.ordinal };
}

/**
 * The next ordinal for this person, computed by the database inside the INSERT.
 *
 * A `SELECT MAX(...)` followed by an insert is a race: two uploads landing
 * together read the same maximum and both write it, and the unique index then
 * fails the second one. As a subquery the read happens under the same
 * statement, and the index is the backstop rather than the mechanism.
 */
function nextOrdinal(personId: string) {
  return sql<number>`(SELECT COALESCE(MAX(${personDocuments.ordinal}), 0) + 1 FROM ${personDocuments} WHERE ${personDocuments.personId} = ${personId})`;
}

async function storeBlob(
  personId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const { uploadsConfigured } = await import("@/lib/uploads");
  if (!uploadsConfigured()) {
    return { error: "File uploads are not configured on this deployment." };
  }

  // The person id is in the path for operability; the 24 random bytes are what
  // make the URL unguessable. H14: that opacity is not access control, which is
  // why the URL is never handed to a browser.
  const secret = randomBytes(24).toString("base64url");
  const path = `person-document/${personId}/${secret}.${extensionFor(file.type)}`;

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const { mkdir, writeFile } = await import("node:fs/promises");
      const { dirname, join } = await import("node:path");
      const target = join(process.cwd(), ".uploads", path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await file.arrayBuffer()));
      return { url: `/api/uploads/${path}` };
    }

    const { put } = await import("@vercel/blob");
    const blob = await put(path, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
      // Never cached at the edge: the bytes are clinical and every read is
      // supposed to pass through the audited route.
      cacheControlMaxAge: 0,
    });
    return { url: blob.url };
  } catch (error) {
    // Never log the path — for a clinical document it is the credential.
    log.error("document upload failed", { reason: safeErrorMessage(error) });
    return { error: "The upload did not go through. Try again." };
  }
}

/**
 * Replace a document's chunks. 8.3.
 *
 * Delete-then-insert rather than an upsert, so numbering is derived only from
 * the current text. Editing in place would leave a stale chunk 9 behind when a
 * re-extraction produces eight, and `[D7:9]` would then resolve to a passage
 * that is no longer in the document.
 */
export async function writeChunks(
  documentId: string,
  personId: string,
  text: string,
): Promise<number> {
  const chunks = chunkText(text);

  await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));
  if (chunks.length === 0) return 0;

  await db.insert(documentChunks).values(
    chunks.map((chunk) => ({
      documentId,
      personId,
      sequence: chunk.sequence,
      text: chunk.text,
    })),
  );

  return chunks.length;
}

/* --------------------------------------------------------------- reading -- */

export type DocumentListItem = {
  id: string;
  ordinal: number;
  title: string;
  source: DocumentSource;
  mimeType: string | null;
  byteSize: number | null;
  extraction: PersonDocument["extraction"];
  documentDate: Date | null;
  createdAt: Date;
  /** 8.7 — who put it here. A name, resolved by the caller. */
  uploadedByUserId: string | null;
  uploadedByAccountId: string | null;
  organizationId: string | null;
  flags: { id: string; reason: FlagReason; note: string | null }[];
};

export async function listDocuments(personId: string): Promise<DocumentListItem[]> {
  const rows = await db
    .select()
    .from(personDocuments)
    .where(eq(personDocuments.personId, personId))
    .orderBy(desc(personDocuments.createdAt));

  const flags = await liveFlags(personId);

  return rows.map((row) => ({
    id: row.id,
    ordinal: row.ordinal,
    title: row.title,
    source: row.source,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    extraction: row.extraction,
    documentDate: row.documentDate,
    createdAt: row.createdAt,
    uploadedByUserId: row.uploadedByUserId,
    uploadedByAccountId: row.uploadedByAccountId,
    organizationId: row.organizationId,
    flags: flags.filter((f) => f.targetType === "document" && f.targetId === row.id),
  }));
}

/** Every live flag for a person, in one query. */
export async function liveFlags(personId: string) {
  return db
    .select({
      id: contentFlags.id,
      targetType: contentFlags.targetType,
      targetId: contentFlags.targetId,
      reason: contentFlags.reason,
      note: contentFlags.note,
      raisedByAccountId: contentFlags.raisedByAccountId,
      raisedByUserId: contentFlags.raisedByUserId,
    })
    .from(contentFlags)
    .where(and(eq(contentFlags.personId, personId), isNull(contentFlags.withdrawnAt)));
}

/**
 * 8.6 — a citation, opened.
 *
 * Resolves `[D7:3]` against one person. Returns null rather than throwing when
 * it points at nothing: an unresolvable citation is a normal outcome (8.5) and
 * the caller's job is to discard it, not to fail.
 */
export async function resolveRef(
  personId: string,
  ref: DocumentRef,
): Promise<{
  documentId: string;
  ordinal: number;
  sequence: number;
  title: string;
  text: string;
  source: DocumentSource;
  documentDate: Date | null;
} | null> {
  const [row] = await db
    .select({
      documentId: personDocuments.id,
      ordinal: personDocuments.ordinal,
      title: personDocuments.title,
      source: personDocuments.source,
      documentDate: personDocuments.documentDate,
      sequence: documentChunks.sequence,
      text: documentChunks.text,
    })
    .from(documentChunks)
    .innerJoin(personDocuments, eq(personDocuments.id, documentChunks.documentId))
    .where(
      and(
        eq(personDocuments.personId, personId),
        eq(personDocuments.ordinal, ref.ordinal),
        eq(documentChunks.sequence, ref.sequence),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * The searchable text of a person's documents, laid out for a prompt.
 *
 * Every passage carries its own `[D7:3]` marker, so the model can cite by
 * copying rather than by counting — a model asked to compute a citation index
 * gets it wrong, and a wrong citation is the failure 8.5 exists to catch.
 *
 * Flagged material is *included and marked*, never removed. §3's flag says
 * "this is outdated", which is a fact the copilot needs in order to answer
 * well; deleting it would leave the copilot confidently quoting the same
 * outdated line from a transcript instead.
 */
export async function documentContext(
  personId: string,
  opts: { maxChars?: number } = {},
): Promise<{ text: string; documents: number; passages: number }> {
  const maxChars = opts.maxChars ?? 40_000;

  const rows = await db
    .select({
      ordinal: personDocuments.ordinal,
      title: personDocuments.title,
      documentDate: personDocuments.documentDate,
      createdAt: personDocuments.createdAt,
      chunkId: documentChunks.id,
      sequence: documentChunks.sequence,
      text: documentChunks.text,
    })
    .from(documentChunks)
    .innerJoin(personDocuments, eq(personDocuments.id, documentChunks.documentId))
    .where(eq(personDocuments.personId, personId))
    .orderBy(asc(personDocuments.ordinal), asc(documentChunks.sequence));

  if (rows.length === 0) return { text: "", documents: 0, passages: 0 };

  const flags = await liveFlags(personId);
  const flagged = new Map(
    flags.filter((f) => f.targetType === "chunk").map((f) => [f.targetId, f.reason]),
  );

  const parts: string[] = [];
  const seen = new Set<number>();
  let used = 0;
  let passages = 0;

  for (const row of rows) {
    if (!seen.has(row.ordinal)) {
      const date = (row.documentDate ?? row.createdAt).toISOString().slice(0, 10);
      parts.push(`\n=== D${row.ordinal} — ${row.title} (${date}) ===`);
      seen.add(row.ordinal);
    }

    const mark = flagged.get(row.chunkId);
    const line = `[D${row.ordinal}:${row.sequence}]${mark ? ` (FLAGGED AS ${mark.toUpperCase()} BY THE PATIENT)` : ""} ${row.text}`;

    if (used + line.length > maxChars) break;
    parts.push(line);
    used += line.length;
    passages += 1;
  }

  return { text: parts.join("\n"), documents: seen.size, passages };
}

/* ----------------------------------------------------------------- flags -- */

export async function raiseFlag(input: {
  personId: string;
  targetType: FlagTarget;
  targetId: string;
  reason: FlagReason;
  note?: string | null;
  byUserId?: string | null;
  byAccountId?: string | null;
}): Promise<{ ok: true; flagId: string } | { ok: false; error: string }> {
  /*
   * The target must belong to this person. Without this check a flag id from
   * one person's screen could be pointed at another person's document — which
   * would not leak the document, but would let a stranger attach "this is
   * wrong" to somebody else's clinical record.
   */
  const owned = await targetBelongsTo(input.personId, input.targetType, input.targetId);
  if (!owned) return { ok: false, error: "That is not part of this record." };

  const [flag] = await db
    .insert(contentFlags)
    .values({
      personId: input.personId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      note: input.note?.trim() || null,
      raisedByUserId: input.byUserId ?? null,
      raisedByAccountId: input.byAccountId ?? null,
    })
    .returning({ id: contentFlags.id });

  if (!flag) return { ok: false, error: "That could not be saved." };

  await audit({
    actor: input.byUserId ? { userId: input.byUserId, organizationId: "" } : null,
    patientAccountId: input.byUserId ? null : (input.byAccountId ?? null),
    category: "clinical",
    action: "content.flag",
    resourceType: input.targetType,
    resourceId: input.targetId,
    reason: input.reason,
  });

  return { ok: true, flagId: flag.id };
}

/** Only the person who raised a flag may withdraw it. */
export async function withdrawFlag(input: {
  flagId: string;
  byUserId?: string | null;
  byAccountId?: string | null;
}): Promise<boolean> {
  const withdrawn = await db
    .update(contentFlags)
    .set({ withdrawnAt: new Date() })
    .where(
      and(
        eq(contentFlags.id, input.flagId),
        isNull(contentFlags.withdrawnAt),
        input.byUserId
          ? eq(contentFlags.raisedByUserId, input.byUserId)
          : eq(contentFlags.raisedByAccountId, input.byAccountId ?? ""),
      ),
    )
    .returning({ id: contentFlags.id });

  return withdrawn.length > 0;
}

async function targetBelongsTo(
  personId: string,
  targetType: FlagTarget,
  targetId: string,
): Promise<boolean> {
  if (targetType === "document") {
    const [row] = await db
      .select({ id: personDocuments.id })
      .from(personDocuments)
      .where(and(eq(personDocuments.id, targetId), eq(personDocuments.personId, personId)))
      .limit(1);
    return Boolean(row);
  }

  if (targetType === "chunk") {
    const [row] = await db
      .select({ id: documentChunks.id })
      .from(documentChunks)
      .where(and(eq(documentChunks.id, targetId), eq(documentChunks.personId, personId)))
      .limit(1);
    return Boolean(row);
  }

  const { personDiagnoses } = await import("@/lib/db/schema");
  const [row] = await db
    .select({ id: personDiagnoses.id })
    .from(personDiagnoses)
    .where(and(eq(personDiagnoses.id, targetId), eq(personDiagnoses.personId, personId)))
    .limit(1);
  return Boolean(row);
}

/* ----------------------------------------------------------- the worker -- */

/**
 * Drain the extraction queue. H9 — called by the cron, never by a request.
 *
 * Bounded per run and resumable: it takes the oldest `pending` rows, works
 * them, and leaves the rest for the next tick. A job that tries to drain an
 * unbounded queue inside a 300-second function is a job that times out on the
 * day the queue is longest.
 */
export async function extractPending(limit = 20): Promise<{ done: number; failed: number }> {
  const pending = await db
    .select({
      id: personDocuments.id,
      personId: personDocuments.personId,
      blobUrl: personDocuments.blobUrl,
      mimeType: personDocuments.mimeType,
    })
    .from(personDocuments)
    .where(eq(personDocuments.extraction, "pending"))
    .orderBy(asc(personDocuments.createdAt))
    .limit(limit);

  let done = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const { extractText } = await import("@/lib/documents/extract");
      const text = await extractText({ blobUrl: row.blobUrl, mimeType: row.mimeType });

      if (text === null) {
        await db
          .update(personDocuments)
          .set({ extraction: "unsupported", extractedAt: new Date() })
          .where(eq(personDocuments.id, row.id));
        continue;
      }

      await writeChunks(row.id, row.personId, text);
      await db
        .update(personDocuments)
        .set({ extraction: "ready", extractedAt: new Date(), extractionError: null })
        .where(eq(personDocuments.id, row.id));
      done += 1;
    } catch (error) {
      failed += 1;
      await db
        .update(personDocuments)
        .set({
          extraction: "failed",
          extractedAt: new Date(),
          extractionError: safeErrorMessage(error).slice(0, 500),
        })
        .where(eq(personDocuments.id, row.id));
      log.warn("document extraction failed", { document: logRef(row.id) });
    }
  }

  return { done, failed };
}

/* ----------------------------------------------------------------- misc -- */

async function auditDocument(
  action: string,
  documentId: string,
  by: { byUserId?: string | null; byAccountId?: string | null; organizationId?: string | null },
) {
  await audit({
    actor: by.byUserId ? { userId: by.byUserId, organizationId: by.organizationId ?? "" } : null,
    patientAccountId: by.byUserId ? null : (by.byAccountId ?? null),
    category: "clinical",
    action,
    resourceType: "person_document",
    resourceId: documentId,
  });
}

/** For the verifier and the person's own screen. */
export async function documentCounts(personId: string) {
  const [row] = await db
    .select({
      documents: sql<number>`COUNT(*)::int`,
      searchable: sql<number>`COUNT(*) FILTER (WHERE extraction IN ('ready','none'))::int`,
      unsupported: sql<number>`COUNT(*) FILTER (WHERE extraction = 'unsupported')::int`,
    })
    .from(personDocuments)
    .where(eq(personDocuments.personId, personId));
  return row ?? { documents: 0, searchable: 0, unsupported: 0 };
}

/** Documents a clinician uploaded themselves — what §3 leaves them when revoked. */
export async function documentsUploadedBy(
  actor: Actor,
  personId: string,
): Promise<DocumentListItem[]> {
  const all = await listDocuments(personId);
  return all.filter((d) => d.uploadedByUserId === actor.userId);
}

export async function documentsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(personDocuments).where(inArray(personDocuments.id, ids));
}

/** The person behind a document, for the stream route's consent check. */
export async function ownerOf(documentId: string): Promise<{
  personId: string;
  claimed: boolean;
  blobUrl: string | null;
  mimeType: string | null;
  title: string;
  uploadedByUserId: string | null;
} | null> {
  const [row] = await db
    .select({
      personId: personDocuments.personId,
      claimedAt: people.claimedAt,
      blobUrl: personDocuments.blobUrl,
      mimeType: personDocuments.mimeType,
      title: personDocuments.title,
      uploadedByUserId: personDocuments.uploadedByUserId,
    })
    .from(personDocuments)
    .innerJoin(people, eq(people.id, personDocuments.personId))
    .where(eq(personDocuments.id, documentId))
    .limit(1);

  if (!row) return null;
  return { ...row, claimed: row.claimedAt !== null };
}
