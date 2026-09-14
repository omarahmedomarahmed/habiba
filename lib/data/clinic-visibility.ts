import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import { organizations, patients, users } from "@/lib/db/schema";

import { shortenForClinic } from "./clinic";

/**
 * 🔴 63.12 / 63.13 / C327 / C354 — WHAT THE PRACTICE CAN SEE, TOLD TO THE PATIENT.
 *
 * > *A calendar is a treatment record. In a two-therapist clinic "Sarah M., Tuesdays
 * > 3pm, six months" identifies a person and discloses that they are in therapy.
 * > Keep the founder's first name plus last initial AND DISCLOSE IT.*
 * >
 * > *A disclosed leak is a trade; an undisclosed one is a breach.*
 *
 * ## 🔴 C354 — NO WALL, AND THAT IS A RULING RATHER THAN A UI PREFERENCE
 *
 * *A disclosure wall in front of somebody in crisis is the wrong trade.* So this
 * never blocks anything and never demands an acknowledgement. It produces the facts
 * for a small label on a radar card and a section on the patient's own record page,
 * always available. A patient in distress is informed rather than interrogated.
 *
 * ## 🔴 AND IT SHOWS THEM THEIR OWN NAME AS THE PRACTICE SEES IT
 *
 * Through `shortenForClinic`, the same function the clinic's schedule renders with,
 * rather than a sentence describing the rule. "They see: Sarah M." is a disclosure
 * somebody can check; "we show your first name and last initial" is a policy somebody
 * has to trust.
 */

export type ClinicVisibility = {
  /** The practices that can see anything at all. Empty means nobody can. */
  practices: string[];
  /** Their own name exactly as a practice manager reads it on a schedule row. */
  asTheySeeIt: string;
};

/**
 * Which practices can see this person's appointments, and what they read.
 *
 * 🔴 A CLINIC, NOT AN ORGANISATION. A solo therapist's practice is an
 * `organizations` row too, and it has no administrative staff at all: there is
 * nobody there but the clinician the patient chose. Disclosing "your therapist's
 * practice can see your name" about a practice of one would be alarming and untrue,
 * so `kind = 'clinic'` is in the WHERE clause.
 */
export async function clinicVisibilityFor(personId: string): Promise<ClinicVisibility> {
  const rows = await controlDb
    .select({
      practice: organizations.name,
      firstName: patients.firstName,
      lastName: patients.lastName,
    })
    .from(patients)
    .innerJoin(organizations, eq(organizations.id, patients.organizationId))
    .where(
      and(
        eq(patients.personId, personId),
        eq(organizations.kind, "clinic"),
        isNull(organizations.deletedAt),
      ),
    );

  if (rows.length === 0) return { practices: [], asTheySeeIt: "" };

  const first = rows[0]!;

  return {
    practices: [...new Set(rows.map((row) => row.practice))],
    asTheySeeIt: shortenForClinic(first.firstName, first.lastName),
  };
}

/**
 * 🔴 C327 — STAMPED WHEN THE DISCLOSURE IS RENDERED, and guarded so the first time
 * stays the first time.
 *
 * The same shape `clinician_invitations.terms_shown_at` uses and the same disclaimer:
 * it is not proof anybody read it, it is proof we said it, in a column an auditor can
 * read. Guarded on the column being null so a second render does not move the date
 * and rewrite when this happened.
 *
 * Every row for this person, because the disclosure covers every practice at once and
 * a per-practice stamp would record that we told them about one of two.
 */
export async function markClinicVisibilityShown(personId: string): Promise<void> {
  await controlDb
    .update(patients)
    .set({ clinicVisibilityShownAt: new Date(), updatedAt: new Date() })
    .where(and(eq(patients.personId, personId), sql`clinic_visibility_shown_at IS NULL`));
}

/**
 * 🔴 63.13 / C354 — THE LABEL ON A RADAR CARD, and it is one word rather than a wall.
 *
 * A patient choosing a therapist in distress needs to know that this clinician works
 * inside a practice, because that is the fact that decides whether administrative
 * staff will see their name. It is a label beside the clinician, not a dialog and not
 * a step, and the full sentence is a tap away on their record page.
 *
 * Takes the clinician ids a screen is about to render, and answers for all of them in
 * one query rather than one per card.
 */
export async function clinicAffiliations(
  userIds: string[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(userIds)].filter(Boolean).slice(0, 200);
  if (wanted.length === 0) return new Map();

  const rows = await controlDb
    .select({ userId: users.id, practice: organizations.name })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.organizationId))
    .where(
      and(
        inArray(users.id, wanted),
        eq(organizations.kind, "clinic"),
        isNull(organizations.deletedAt),
      ),
    );

  return new Map(rows.map((row) => [row.userId, row.practice]));
}
