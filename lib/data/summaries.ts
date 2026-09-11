import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { auditPhi } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";
import { dbFor } from "@/lib/db";
import { regionOfPerson } from "@/lib/db/directory";
import { clinicalSummaries, therapistVerifications, users } from "@/lib/db/schema";
import { fullName } from "@/lib/utils";



/**
 * The clinical summary the patient owns. PLAN.md 26.1 to 26.4, C111.
 *
 * ## 🔴 Append only, and what that buys
 *
 * There is no update function in this module and there cannot be one: the
 * database refuses an UPDATE or a DELETE on the table outright. Every change
 * is a new version, stamped with the clinician who approved it.
 *
 * That single decision settles three requirements at once:
 *
 *   - **26.1** therapist B never overwrites therapist A, and the patient sees
 *     both with authors;
 *   - **26.2** revoking a clinician cannot retract a version the patient has
 *     already read, because nothing here can retract anything;
 *   - and the export (26.9) can stamp each version with a real author and a
 *     real date instead of "last edited by".
 *
 * ## What the copy may contain
 *
 * 26.4: the same constraints as `patientBrief`. No diagnosis, no differential,
 * no risk language, no other clinician's words. That is checked rather than
 * trusted, in `summaryProblem` below, because the summary is written by a
 * model and approved by a person under time pressure.
 */

/**
 * Phrases that do not belong in a document written *to* a patient.
 *
 * Deliberately about the shapes of clinical writing rather than a list of
 * diagnoses: "patient presents with" and "differential" are the tells that a
 * professional note has leaked into the patient's copy, and no list of
 * disorders would catch them. A real diagnosis belongs on the diagnoses list,
 * where it carries the sentence it came from and a clinician's confirmation.
 */
const CLINICAL_REGISTER = [
  "patient presents",
  "presents with",
  "differential",
  "rule out",
  "r/o ",
  "provisional diagnosis",
  "diagnosis of",
  "diagnosed with",
  "meets criteria",
  "dsm-5",
  "dsm-iv",
  "icd-10",
  "risk of harm",
  "risk to self",
  "risk to others",
  "suicidal ideation",
  "si/hi",
  "affect was",
  "mood was labile",
  "guarded",
  "poor insight",
  "prognosis",
  "comorbid",
] as const;

export function summaryProblem(body: string): string | null {
  const text = body.trim();
  if (text.length < 20) return "A summary needs to say something. Write a few sentences.";
  if (text.length > 8000) return "That is too long for a summary.";

  const haystack = text.toLowerCase();
  const found = CLINICAL_REGISTER.filter((phrase) => haystack.includes(phrase));
  if (found.length > 0) {
    return `This reads like a clinical note rather than something written to the patient: "${found[0]}". Rewrite it in the words you would use out loud.`;
  }
  return null;
}

export type SummaryVersion = {
  id: string;
  version: number;
  body: string;
  approvedByName: string;
  approvedByCredentials: string | null;
  approvedByLicenseBody: string | null;
  approvedByLicenseNumber: string | null;
  approvedAt: Date;
  sessionId: string | null;
};

/**
 * Every version, newest first. This is what the patient sees.
 *
 * 🔴 26.2 — there is no grant check here, and that is the ruling rather than an
 * omission. The reader is the person the summary is about; a clinician losing
 * access does not un-write what somebody already holds.
 */
export async function summariesForPerson(personId: string): Promise<SummaryVersion[]> {
  /*
   * 🔴 30.1 / C154 — routed on the PERSON, which is the whole point.
   *
   * The clinical summary is the portability argument: it follows somebody
   * between clinicians. Routing it on whichever practice is currently asking
   * would put an Egyptian patient's summary in a different country depending
   * on who opened it, which is not a residency guarantee at all.
   */
  const db = dbFor(await regionOfPerson(personId));

  return db
    .select({
      id: clinicalSummaries.id,
      version: clinicalSummaries.version,
      body: clinicalSummaries.body,
      approvedByName: clinicalSummaries.approvedByName,
      approvedByCredentials: clinicalSummaries.approvedByCredentials,
      approvedByLicenseBody: clinicalSummaries.approvedByLicenseBody,
      approvedByLicenseNumber: clinicalSummaries.approvedByLicenseNumber,
      approvedAt: clinicalSummaries.approvedAt,
      sessionId: clinicalSummaries.sessionId,
    })
    .from(clinicalSummaries)
    .where(eq(clinicalSummaries.personId, personId))
    .orderBy(desc(clinicalSummaries.version))
    .limit(200);
}

export type PublishResult = { ok: true; version: number } | { ok: false; error: string };

/**
 * Publish a new version.
 *
 * The version number is computed inside the INSERT rather than read and then
 * written, so two clinicians approving at the same moment collide on the
 * unique index instead of silently producing two version 3s. The loser retries
 * once and lands on 4.
 */
export async function publishSummary(
  actor: Actor,
  input: { personId: string; body: string; sessionId?: string | null },
): Promise<PublishResult> {
  const db = dbFor(await regionOfPerson(input.personId));

  const problem = summaryProblem(input.body);
  if (problem) return { ok: false, error: problem };

  const [author] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      profile: users.profile,
      licenseBody: therapistVerifications.licenseBody,
      licenseNumber: therapistVerifications.licenseNumber,
    })
    .from(users)
    .leftJoin(therapistVerifications, eq(therapistVerifications.userId, users.id))
    .where(eq(users.id, actor.userId))
    .limit(1);

  const body = input.body.trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const [row] = await db
        .insert(clinicalSummaries)
        .values({
          personId: input.personId,
          version: sql<number>`(
            SELECT COALESCE(MAX(s.version), 0) + 1
            FROM ${clinicalSummaries} s
            WHERE s.person_id = ${input.personId}
          )`,
          body,
          approvedByUserId: actor.userId,
          approvedByName: fullName(author?.firstName, author?.lastName, "A clinician"),
          approvedByCredentials: author?.profile?.credentials ?? null,
          approvedByLicenseBody: author?.licenseBody ?? null,
          approvedByLicenseNumber: author?.licenseNumber ?? null,
          organizationId: actor.organizationId,
          sessionId: input.sessionId ?? null,
        })
        .returning({ version: clinicalSummaries.version });

      await auditPhi(actor, "summary.publish", {
        resourceType: "person",
        resourceId: input.personId,
        patientId: null,
      });

      return { ok: true, version: row!.version };
    } catch (error) {
      if (!String((error as Error).message).includes("clinical_summaries_person_version")) {
        throw error;
      }
    }
  }

  return { ok: false, error: "Two people approved at once. Try again." };
}

/** What a clinician holding a grant may read, newest first. Same rows. */
export async function latestSummary(personId: string): Promise<SummaryVersion | null> {
  const [row] = await summariesForPerson(personId);
  return row ?? null;
}

/** Used by the export and by the verification page: how many versions exist. */
export async function summaryCount(personId: string): Promise<number> {
  const db = dbFor(await regionOfPerson(personId));

  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(clinicalSummaries)
    .where(and(eq(clinicalSummaries.personId, personId)));
  return Number(row?.n ?? 0);
}
