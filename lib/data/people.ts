import "server-only";

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { dbFor} from "@/lib/db";
import { pinnedToDefaultRegion } from "@/lib/db/region";
import { isLiveGrant } from "@/lib/access/state";
import { historyGrants, patients, people, type Person } from "@/lib/db/schema";
import { log, ref } from "@/lib/logger";

/*
 * ⚠️ 30.1 — NOT ROUTED YET, and counted rather than hidden.
 *
 * `pinnedToDefaultRegion` returns the default region and registers this
 * module so `verify:sprint30` can print it. The alternative, `dbFor("us")`
 * with a comment, compiles and is indistinguishable from a decision, which
 * is the "seam by convention" this sprint exists to prevent.
 */
const db = dbFor(pinnedToDefaultRegion("lib/data/people.ts", "not routed yet: this call site has no entity in hand, so 30.x threads one"));


/**
 * The person layer, and the rule that guards it.
 *
 * `patients` is a therapist's file about somebody. `people` is the somebody.
 * Everything in this module exists to keep one distinction sharp: **an
 * unclaimed person is not an identity**, it is what one clinician happened to
 * type, and it may not be shared, granted or merged.
 */

/* ------------------------------------------------------------ normalising -- */

/** Lowercased and trimmed, or null. The form of an email we store and match on. */
export function normaliseEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Digits with a leading `+`, or null.
 *
 * Deliberately crude. Real E.164 needs to know the country to expand a local
 * number, and guessing that is how "01001234567" in Cairo becomes a number in
 * a different country. This strips formatting and nothing else, so two spellings
 * of the same number match and two different numbers never do.
 */
export function normalisePhone(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return `${plus ? "+" : ""}${digits}`;
}

/* ------------------------------------------------------------- the rule -- */

/**
 * Thrown when something tries to share, grant or merge an unclaimed person.
 *
 * A named error rather than a boolean so that a caller cannot accidentally
 * ignore it, and so the audit trail says which rule refused.
 */
export class UnclaimedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnclaimedError";
  }
}

/**
 * 5.5 — the server-side rule, in one place.
 *
 * §3: "Nothing unclaimed is ever shared, because there is nobody to ask." That
 * is a §6 hard rule, so it is enforced here rather than in each of the screens
 * that will eventually want to share something. Sprint 7's grants, sprint 8's
 * documents and any future merge all go through this function.
 *
 * It throws rather than returning false because every caller's correct
 * behaviour is identical — stop — and a boolean is a thing somebody forgets to
 * check.
 */
export function assertClaimed(person: Pick<Person, "id" | "claimedAt">, action: string): void {
  if (person.claimedAt === null) {
    log.warn("refused an action on an unclaimed person", {
      person: ref(person.id),
      action,
    });
    throw new UnclaimedError(
      `This record has not been claimed by the person it describes, so it cannot be ${action}. Only they can agree to that.`,
    );
  }
}

/** The same rule, for a caller that legitimately wants to branch rather than stop. */
export function isClaimed(person: Pick<Person, "claimedAt">): boolean {
  return person.claimedAt !== null;
}

/* ------------------------------------------------------------- matching -- */

export type MatchCandidate = {
  personId: string;
  firstName: string;
  lastName: string | null;
  /** What matched. Never more than the person signing up already knew. */
  matchedOn: "email" | "phone";
  claimed: boolean;
};

/**
 * 5.4 — who *might* be this person. Suggestions, never a decision.
 *
 * ## Why this only suggests
 *
 * Because an email is not a person. Measured on this database:
 * `omarabdelgawad001@gmail.com` is on two patients, one named "Omar" and one
 * named "Sam", in two different organisations — a shared family address, a
 * typo, or somebody who books for a relative. Auto-merging on that evidence
 * puts one person's trauma in another's file and a clinician treats them on it.
 *
 * So this function reads and returns. It never writes, and there is
 * deliberately no `mergePeople` in this module for it to call.
 *
 * ## What it does not return
 *
 * Nothing clinical, and no email or phone number. A stranger who signs up with
 * an address must not be able to harvest which clinicians hold a record for it
 * — the confirmation step in §3 shows a *redacted* name and asks them, which is
 * a question only the real person can answer.
 */
export async function findMatches(input: {
  email?: string | null;
  phone?: string | null;
}): Promise<MatchCandidate[]> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  if (!email && !phone) return [];

  const terms = [
    ...(email ? [eq(people.email, email)] : []),
    ...(phone ? [eq(people.phone, phone)] : []),
  ];

  const rows = await db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      email: people.email,
      phone: people.phone,
      claimedAt: people.claimedAt,
    })
    .from(people)
    .where(or(...terms))
    .limit(20);

  return rows.map((r) => ({
    personId: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    matchedOn: email && r.email === email ? "email" : "phone",
    claimed: r.claimedAt !== null,
  }));
}

/**
 * A name with everything but the initials removed — `H••••• A•••••`.
 *
 * §3 step 4: the person confirming a claim is shown this and asked whether it
 * is them. Redacted because they have not proved anything yet: a full name
 * would tell whoever typed an address exactly who that address belongs to in
 * our records, which is the leak the confirmation step exists to avoid.
 *
 * Pure, and works the same in Arabic — it counts characters rather than
 * assuming an alphabet.
 */
export function redactName(first: string, last: string | null): string {
  const mask = (part: string | null) => {
    const trimmed = part?.trim() ?? "";
    if (!trimmed) return "";
    return `${[...trimmed][0]}${"•".repeat(Math.max(1, [...trimmed].length - 1))}`;
  };
  return [mask(first), mask(last)].filter(Boolean).join(" ");
}

/* --------------------------------------------------------------- reading -- */

export async function getPerson(personId: string): Promise<Person | null> {
  const [row] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  return row ?? null;
}

/**
 * The person behind a patient row, or null if nobody has needed one yet.
 *
 * Read-only on purpose. `ensurePersonForPatient` writes, and a page render is
 * a GET: rendering a chart should not create identity rows for every patient a
 * clinician happens to open.
 */
/**
 * 🔴 79.4 — DOES THIS PERSON HAVE A PICTURE, asked BEFORE one is requested.
 *
 * `components/patient/avatar.tsx` takes `hasPhoto` rather than discovering it,
 * and its own comment says why: "a 404 per empty avatar in a caseload list is
 * a hundred requests to say nothing."
 *
 * The clinician's patient page disagreed with that in a comment of its own. It
 * hand-rolled an `<img>` and argued the route "answers 404 when the person has
 * no picture, which is why this can render unconditionally". Both comments
 * were confident and only one was right: a 404 on an `<img>` is not an empty
 * circle, it is a BROKEN IMAGE GLYPH, and it is a red line in the console of
 * every clinician looking at a patient who never uploaded a photo.
 *
 * Found by a founder reading the console during a live session.
 *
 * Returns false for a person with no row at all, which is the same answer for
 * the same reason: there is nothing to fetch.
 */
export async function hasAvatar(personId: string): Promise<boolean> {
  const [row] = await db
    .select({ avatarUrl: people.avatarUrl })
    .from(people)
    .where(eq(people.id, personId))
    .limit(1);
  return Boolean(row?.avatarUrl);
}

/**
 * 🔴 PE80 — may this clinician see this person's face?
 *
 * A patient row on their own caseload AND a live grant from the person. The
 * row alone is a record, not a relationship: a patient who claimed with "let
 * this therapist keep seeing my profile" unticked, or revoked later, leaves
 * the clinician their notes and takes the live profile away, and the photo is
 * part of the live profile (§3). It used to check the row only.
 */
export async function clinicianMaySeeFace(
  personId: string,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const [record] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.personId, personId),
        eq(patients.organizationId, organizationId),
        eq(patients.therapistId, userId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);
  if (!record) return false;

  const [grant] = await db
    .select({ status: historyGrants.status, expiresAt: historyGrants.expiresAt })
    .from(historyGrants)
    .where(and(eq(historyGrants.personId, personId), eq(historyGrants.therapistUserId, userId)))
    .orderBy(desc(historyGrants.createdAt))
    .limit(1);

  return isLiveGrant(grant ?? null, new Date());
}

export async function personIdForPatient(patientId: string): Promise<string | null> {
  const [row] = await db
    .select({ personId: patients.personId })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row?.personId ?? null;
}

/**
 * Ensure a patient has a person, creating one if it does not.
 *
 * Every patient created after the backfill needs this. It creates its **own**
 * person even when the email matches an existing one — the same rule as the
 * backfill, for the same reason. Linking them is a human decision made later.
 */
export async function ensurePersonForPatient(patientId: string): Promise<string | null> {
  const [patient] = await db
    .select({
      id: patients.id,
      personId: patients.personId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      email: patients.email,
      phone: patients.phone,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) return null;
  if (patient.personId) return patient.personId;

  const [created] = await db
    .insert(people)
    .values({
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: normaliseEmail(patient.email),
      phone: normalisePhone(patient.phone),
    })
    .returning({ id: people.id });

  if (!created) return null;

  /*
   * Conditional on `person_id IS NULL`, so two requests racing to create a
   * person for the same patient cannot both win. The loser's row is orphaned
   * rather than linked, which is a tidy-up rather than a patient with two
   * identities.
   */
  const [linked] = await db
    .update(patients)
    .set({ personId: created.id, updatedAt: new Date() })
    .where(and(eq(patients.id, patientId), isNull(patients.personId)))
    .returning({ personId: patients.personId });

  return linked?.personId ?? patient.personId ?? created.id;
}

/**
 * 🔴 W2-P04 / task 223: the clinician's file for a SIGNED-IN person, found or made.
 *
 * `bookFromRadar`, `book` and `joinByToken` each made a new `patients` row
 * and `ensurePersonForPatient` gave it a new person, so a session a signed-in
 * patient booked for themselves belonged to a stranger with their first name
 * and never reached their own app: not the sessions list, not the orb, not
 * billing, not the summary. The only bridge was a claim, which needs a proved
 * handle.
 *
 * Here the person is proved already, by their session cookie, so the row is
 * linked to it at birth. No address matching (C39's merge): the caller passes
 * the person from `optionalPatient()`, never from a form. One file per person
 * per clinician, reused on the next booking. Contact details are copied only
 * onto a new row and only when the caller has them from the booking form, so a
 * clinician learns what the patient typed to them and nothing from the account.
 *
 * It grants nothing. Reading history across clinicians is a grant, and a grant
 * is the patient's act (`lib/data/grants.ts`).
 */
export async function patientRowForPerson(input: {
  organizationId: string;
  therapistId: string;
  personId: string;
  email?: string | null;
  phone?: string | null;
  timezone?: string | null;
}): Promise<string | null> {
  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.organizationId, input.organizationId),
        eq(patients.therapistId, input.therapistId),
        eq(patients.personId, input.personId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [person] = await db
    .select({ firstName: people.firstName, lastName: people.lastName })
    .from(people)
    .where(eq(people.id, input.personId))
    .limit(1);
  if (!person) return null;

  const [created] = await db
    .insert(patients)
    .values({
      organizationId: input.organizationId,
      therapistId: input.therapistId,
      personId: input.personId,
      firstName: person.firstName,
      lastName: person.lastName,
      email: normaliseEmail(input.email),
      phone: input.phone?.trim() || null,
      timezone: input.timezone ?? null,
      source: "join_link",
    })
    .returning({ id: patients.id });

  return created?.id ?? null;
}

/** Remember where somebody pays from (C36 / 4.3). Their preference, on them. */
export async function savePaymentPreference(input: {
  personId: string;
  country: string;
  currency: string;
}): Promise<void> {
  await db
    .update(people)
    .set({
      preferredCountry: input.country.trim().toUpperCase().slice(0, 2),
      preferredCurrency: input.currency.trim().toLowerCase().slice(0, 3),
      updatedAt: new Date(),
    })
    .where(eq(people.id, input.personId));
}

/** How many people are claimed, for the admin view and for the verifier. */
export async function peopleCounts(): Promise<{
  total: number;
  claimed: number;
}> {
  const [row] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      claimed: sql<number>`COUNT(*) FILTER (WHERE ${people.claimedAt} IS NOT NULL)::int`,
    })
    .from(people);
  return { total: row?.total ?? 0, claimed: row?.claimed ?? 0 };
}
