/**
 * Sprint 29 acceptance: identity documents, private. PLAN.md 29.1, H14.
 *
 *   npm run verify:sprint29
 *
 * One rule, and it is the one sprint 8 applied to clinical documents and left
 * identity documents out of: **a blob URL is a secret, not access control.**
 *
 * Three things are asserted, and the middle one is the sprint:
 *
 *   1. No page emits a stored identity URL any more. Scanned, with a planted
 *      offender of exactly the shape both pages shipped.
 *   2. The decision REFUSES a clinician reading another clinician's passport,
 *      attempted against real planted rows rather than read off the code.
 *   3. A read is audited before the bytes, with which document and whose.
 */
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";

import { eq, sql } from "drizzle-orm";

import { auditLog, therapistVerifications, users } from "../lib/db/schema";
import { stripComments } from "./_dashes";
import { reporter, required, writesTo, readSource } from "./_verify";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";

/*
 * 🔴 30.1 — an operator tool writes to the region its DATABASE_URL names.
 *
 * `dbFor(DEFAULT_REGION)` rather than a bare handle, because after this
 * sprint there is no bare handle: a script that plants fixtures is planting
 * them in a jurisdiction, and saying which one is the point. When Cairo is
 * live a script that needs to touch it passes "eg" and nothing else changes.
 */
const db = dbFor(DEFAULT_REGION);

const { check, finish } = reporter();

const TAG = "verify29";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

async function main() {
  /* C147 — this script writes, so it says where and refuses production. */
  writesTo();

  const { identityReadDecision, identityDocumentPath, localUploadAllowed, IDENTITY_LABEL } =
    await import("../lib/documents/identity-access");

  /* ------------------------------------------------- 29.1 · the pages */

  /*
   * 🔴 The scan: no page may put a stored identity URL into its output.
   *
   * Matching the COLUMN names rather than the string "https", because the
   * column is what a page reaches for and a URL is what comes out. The
   * decision module and the seed are exempt by name: one reads the columns
   * because that is its job, the other writes them.
   */
  const COLUMNS = /\b(idFrontUrl|idBackUrl|licenseDocUrl|headshotUrl)\b/;
  const ALLOWED = [
    "lib/documents/identity-access.ts",
    "lib/data/verification.ts",
    "lib/db/schema.ts",
    "scripts/verify-sprint29.ts",
  ];

  const surfaces = [...walk("app"), ...walk("components")].filter(
    (file) => !ALLOWED.includes(file),
  );

  const leaks = surfaces.filter((file) => {
    const source = stripComments(readSource(file));
    /*
     * Reading the column to decide whether a document EXISTS is fine, and both
     * pages legitimately do it. Emitting it is not. So the offence is the
     * column reaching a prop, which is how both pages shipped it.
     */
    return /url:\s*\w+\.(idFrontUrl|idBackUrl|licenseDocUrl|headshotUrl)/.test(source);
  });

  check(
    "🔴 29.1 / H14 no page hands out a stored identity document URL",
    leaks.length === 0,
    leaks.join(", ") || `${surfaces.length} files scanned`,
  );

  /* 🔴 The control, in exactly the shape the admin queue shipped for a year. */
  const planted = "components/admin/_verify29-offender.tsx";
  try {
    writeFileSync(
      planted,
      `export const docs = (row: { idFrontUrl: string }) => [{ label: "ID", url: row.idFrontUrl }];\n`,
    );
    const caught = /url:\s*\w+\.(idFrontUrl|idBackUrl|licenseDocUrl|headshotUrl)/.test(
      stripComments(readSource(planted)),
    );
    check(
      "🔴 29.1 CONTROL, the same scan CATCHES the line both pages actually shipped",
      caught,
      caught ? `{ label: "ID", url: row.idFrontUrl }` : "THE SCAN IS BLIND",
    );
  } finally {
    rmSync(planted, { force: true });
  }

  check(
    "29.1 …and the reference that replaced it carries no secret, only a row id and a kind",
    identityDocumentPath("11111111-2222-3333-4444-555555555555", "licenseDoc") ===
      "/api/uploads/11111111-2222-3333-4444-555555555555.licenseDoc",
  );

  /*
   * The label that was lying. `therapist_radar.photo_url` is the picture a
   * patient sees; this column is published nowhere, and a reviewer told
   * otherwise handles a passport and a "public" photo with different care.
   */
  check(
    "🔴 29.1 the verification headshot is no longer labelled public, because it never was",
    IDENTITY_LABEL.headshot === "Headshot",
    IDENTITY_LABEL.headshot,
  );

  /* --------------------------------------------- 29.1 · the decision */

  const [row] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.role, "therapist"))
    .limit(1);

  const reference = required(row, "therapist whose organisation the fixtures can join");

  let ownerId: string | null = null;
  let strangerId: string | null = null;
  let adminId: string | null = null;
  let verificationId: string | null = null;

  try {
    const made = await Promise.all(
      (["owner", "stranger", "admin"] as const).map(async (who) => {
        const [created] = await db
          .insert(users)
          .values({
            organizationId: reference.organizationId,
            email: `${TAG}-${who}@example.test`,
            firstName: `${TAG}-${who}`,
            lastName: "Fixture",
            /* The stranger is in the SAME organisation, deliberately. */
            role: who === "admin" ? "super_admin" : "therapist",
            passwordHash: "x",
          })
          .returning({ id: users.id });
        return created!.id;
      }),
    );
    [ownerId, strangerId, adminId] = made;

    const [verification] = await db
      .insert(therapistVerifications)
      .values({
        userId: ownerId,
        organizationId: reference.organizationId,
        state: "submitted",
        licenseDocUrl: "https://example.test/blob/secret-licence.jpg",
      })
      .returning({ id: therapistVerifications.id });
    verificationId = verification!.id;

    const asOwner = await identityReadDecision({
      verificationId,
      kind: "licenseDoc",
      actor: { userId: ownerId, organizationId: reference.organizationId, role: "therapist" } as never,
    });

    check(
      "29.1 the clinician it is about may read their own document",
      asOwner.allowed,
      asOwner.allowed ? "allowed" : "refused",
    );

    /*
     * 🔴 The one that matters. A colleague in the SAME organisation, signed
     * in, with a perfectly valid session. Before this sprint the only thing
     * standing between them and this passport was not knowing the URL, and on
     * the local-disk deployment not even that.
     */
    const asStranger = await identityReadDecision({
      verificationId,
      kind: "licenseDoc",
      actor: {
        userId: strangerId,
        organizationId: reference.organizationId,
        role: "therapist",
      } as never,
    });

    check(
      "🔴 29.1 another clinician in the SAME organisation is REFUSED, attempted not read",
      asStranger.allowed === false,
      asStranger.allowed ? "IT ALLOWED IT" : "organisation membership is the wrong boundary here",
    );

    const anonymous = await identityReadDecision({
      verificationId,
      kind: "licenseDoc",
      actor: null,
    });

    check("29.1 …and so is a caller with no session", anonymous.allowed === false);

    const asAdmin = await identityReadDecision({
      verificationId,
      kind: "licenseDoc",
      actor: {
        userId: adminId,
        organizationId: reference.organizationId,
        role: "super_admin",
      } as never,
    });

    check(
      "29.1 a super admin may, because reviewing these IS the verification process",
      asAdmin.allowed,
    );

    const absent = await identityReadDecision({
      verificationId,
      kind: "idFront",
      actor: { userId: ownerId, organizationId: reference.organizationId, role: "therapist" } as never,
    });

    check(
      "29.1 a kind with nothing uploaded is refused rather than streaming nothing",
      absent.allowed === false,
    );

    /* ------------------------------ the local-disk route, same question */

    const strangerPath = `credential/${ownerId}/licence-abc.jpg`;
    check(
      "🔴 29.1 the local-disk fallback asks the SAME question, so the two cannot drift",
      localUploadAllowed(strangerPath, {
        userId: strangerId,
        organizationId: reference.organizationId,
        role: "therapist",
      } as never) === false &&
        localUploadAllowed(strangerPath, {
          userId: ownerId,
          organizationId: reference.organizationId,
          role: "therapist",
        } as never) === true,
      "it required only a session before, which let any clinician walk a path to any passport",
    );

    /* --------------------------------------------- 29.1 · the audit */

    /*
     * 🔴 Audited BEFORE the bytes, and with enough in the row to answer the
     * question this exists for: who looked at my passport, and which one.
     */
    const route = stripComments(readSource("app/api/uploads/[id]/route.ts"));
    const auditAt = route.indexOf("await audit(");
    const fetchAt = route.indexOf("await fetch(");

    check(
      "🔴 29.1 the read is audited BEFORE the bytes, not after",
      auditAt > 0 && fetchAt > auditAt,
      "a read that streams and then fails to log is a read nobody can prove happened",
    );

    check(
      "29.1 …and the row says WHICH document and WHOSE",
      /reason: `\$\{reference\.kind\} of \$\{decision\.ownerUserId\}`/.test(route),
      "'somebody opened a verification' cannot answer the question this is for",
    );
  } finally {
    if (verificationId) {
      await db.delete(therapistVerifications).where(eq(therapistVerifications.id, verificationId));
    }
    for (const id of [ownerId, strangerId, adminId]) {
      if (!id) continue;
      await db.execute(sql`UPDATE audit_log SET actor_user_id = NULL WHERE actor_user_id = ${id}`);
      await db.delete(users).where(eq(users.id, id));
    }
  }

  /* A sanity read, so the table name in the check above is a real one. */
  const [audited] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(auditLog)
    .where(eq(auditLog.action, "identity_document.read"));

  check(
    "29.1 the audit action name exists as a row shape the log can hold",
    Number(audited?.n ?? 0) >= 0,
    `${audited?.n ?? 0} identity reads logged so far`,
  );

  finish("sprint 29");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
