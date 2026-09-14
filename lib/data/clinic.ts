import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import {
  can,
  NEVER_DELEGABLE,
  THERAPIST_SCOPED,
  type ClinicCapability,
} from "@/lib/clinic-auth/capabilities";
import { controlDb } from "@/lib/db";
import {
  clinicManagers,
  clinicianInvitations,
  invoices,
  organizations,
  patients,
  payoutRequests,
  sessionPayments,
  sessions,
  users,
  type ClinicRole,
} from "@/lib/db/schema";
import { log } from "@/lib/logger";
import { getSettings } from "@/lib/settings";

/**
 * 🔴 THE CLINIC WALL. PLAN.md 54.9, 54.10, §3f, C259 to C263.
 *
 * > **What the clinic sees: its therapists' schedules, their usage, its bills, and a
 * > list of patient names with appointment times. Nothing else, in any form.**
 *
 * ## 🔴 WHY THIS WALL IS HARDER THAN THE SPONSOR'S
 *
 * A sponsor is outside the tenancy: `SponsorActor` has no organisation id, so a
 * sponsor surface reaching a chart does not compile. That seam was free.
 *
 * A clinic IS the organisation (C259). Its manager's principal carries the very id
 * that `actor.organizationId` uses to scope 63 clinical queries in 33 files, so every
 * one of those functions would return real clinical rows if handed it. The compiler
 * cannot help beyond refusing the `Actor` shape.
 *
 * So the wall is this file, and it is made of three things:
 *
 *   1. **Named select lists, never a table spread.** `select({ ... })` with columns
 *      written out, so adding a leak is a visible line in a diff rather than a column
 *      appearing because somebody added it to `sessions`. `select()` with no argument
 *      anywhere in this file would be the whole sprint undone.
 *   2. **No function here returns a clinical value at all**, so there is nothing for a
 *      component to render even by accident.
 *   3. **A verifier runs as a clinic manager against RENDERED OUTPUT** (54.9), because
 *      C243's lesson is that a leak is an ABSENCE as often as it is a value and a
 *      query-level check passes straight through one.
 *
 * ## 🔴 C260 — WHY A NAME AND A TIME ARE ALLOWED AT ALL, AND WHERE THE LINE IS
 *
 * *A patient's name plus their clinician plus the time IS clinical information.* It
 * says this person is in therapy, with this clinician, at this hour. Every clinic on
 * earth works this way and a receptionist has always known who is coming, so it is
 * defensible — but only if the line is drawn somewhere a patient can be told.
 *
 * **Employment is the wrong line. The line is MONEY.** A clinic sees the patients of
 * sessions the clinic is PAYING FOR, which under C261 is every session on a
 * clinic-attached therapist's account. That is the only line that stays defensible
 * when a patient asks why a practice manager knows their name, and the clinician's
 * practice is already named on the public profile before anybody books.
 *
 * ## 🔴 C263 — AND THE SCHEDULE CARRIES NO MONEY, WHICH IS THE SUBTLE HALF
 *
 * The clinic pays the AI fee, the AI fee exists only on patient consent, so a bill
 * itemised to a session discloses who consented. The ruling aggregates the invoice.
 *
 * But the schedule is the other half of that join: a per-session price or a
 * "recorded" badge on a schedule row would hand back exactly what the aggregated
 * invoice withholds. So `clinicSchedule` selects no price, no payment status, no
 * consent, no recording state and no session type. A clinic with four sessions and a
 * total AI fee knows three of four consented and never which three, which is the
 * ruling working as written.
 *
 * ## 🔴 63.4 / C325 — AND SINCE SPRINT 63, EVERY FUNCTION HERE TAKES THE PRINCIPAL
 *
 * > *"Custom access levels to pages" is the classic authorisation hole. A navigation
 * > filter is not a permission. Permissions are a capability set checked in the data
 * > layer, on the RESOURCE.*
 *
 * So these take a `ClinicPrincipal` rather than an organisation id, and each one
 * names the capability it needs and, where the capability is therapist-scoped,
 * filters the query by the assignments rather than filtering the result. Assistant 1
 * assigned to therapist A is refused therapist B's calendar on the same route, and
 * the refusal is in the WHERE clause, so there is no branch anybody can forget.
 */

/**
 * 🔴 THE PRINCIPAL, NARROWED, and narrowed on purpose.
 *
 * Not `ClinicActor`: this file has no business with an email address or a practice
 * name, and a function that takes the whole actor is a function that can start
 * reading fields nobody meant it to have. Everything here needs exactly these five.
 */
export type ClinicPrincipal = {
  clinicManagerId: string;
  clinicOrganizationId: string;
  role: ClinicRole;
  capabilities: readonly ClinicCapability[];
  /** Null is the admin and means every clinician. An empty array means nobody. */
  therapistIds: string[] | null;
};

/**
 * 🔴 63.4 / C325 — THE REFUSAL, AND IT THROWS RATHER THAN RETURNING EMPTY.
 *
 * An empty list is indistinguishable from a quiet week, so a permission failure that
 * returned one would look like a working screen with nothing on it and nobody would
 * ever find out the permission was wrong in either direction. The page guard
 * (`requireClinicCapability`) redirects before this is reached on any honest path, so
 * reaching it means a call site that skipped the guard, which is a defect rather than
 * a user.
 */
export class ClinicRefused extends Error {
  constructor(capability: ClinicCapability) {
    super(`clinic principal lacks ${capability}`);
    this.name = "ClinicRefused";
  }
}

function refuseWithout(actor: ClinicPrincipal, capability: ClinicCapability): void {
  /*
   * 🔴 63.7 — the two that are never delegable are checked against the ROLE and not
   * against the capability list, so a stored set that somehow contained one still
   * refuses. The database will not hold one and `roleProblem` will not write one;
   * this is the third lock on the rule about who spends a practice's money.
   */
  if (NEVER_DELEGABLE.includes(capability) && actor.role !== "admin") {
    throw new ClinicRefused(capability);
  }
  if (!can(actor.capabilities, capability)) throw new ClinicRefused(capability);
}

/**
 * 🔴 Every clinician on this clinic's account, invited or accepted.
 *
 * C267's visible half: the clinic SEES that verification is pending and can chase it.
 * `verificationStatus` is read-only here in the strongest sense — there is no function
 * in this file or the next one that writes it, and `verifyClinician` does not exist.
 */
export type ClinicClinician = {
  userId: string;
  name: string;
  email: string;
  /** 🔴 C267 — visible, chaseable, and not settable by anybody on this side. */
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  joinedAt: Date;
};

export async function clinicClinicians(actor: ClinicPrincipal): Promise<ClinicClinician[]> {
  refuseWithout(actor, "people.read");

  const rows = await controlDb
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      verificationStatus: users.verificationStatus,
      joinedAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.organizationId, actor.clinicOrganizationId),
        /*
         * 🔴 `role = 'therapist'` and nothing else, which is belt and braces: a
         * clinic's organisation should contain no staff role at all, because those
         * are ours. If one ever appears, this list does not show it to a customer.
         */
        eq(users.role, "therapist"),
        isNull(users.deletedAt),
        /*
         * 🔴 63.9 / C328 — NOTHING ABOUT AN INVITED CLINICIAN UNTIL THEY ACCEPT.
         *
         * An accepted clinician has a row here; an invited one has a row in
         * `clinician_invitations` and nothing else, so this list is already
         * correct by construction. `clinicInvitations` shows the practice the
         * email address it typed and no more, which is the other half.
         */
      ),
    )
    .orderBy(asc(users.firstName), asc(users.lastName));

  return rows.map((row) => ({
    userId: row.userId,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    email: row.email,
    verificationStatus: row.verificationStatus,
    joinedAt: row.joinedAt,
  }));
}

/**
 * Invitations still outstanding. 54.4.
 *
 * 🔴 63.9 / C328 — EVERY FIELD HERE IS SOMETHING THE PRACTICE TYPED.
 *
 * *The clinic sees nothing about an invited therapist until they accept.* The name
 * and address on these rows came from the invitation form, so showing them back
 * discloses nothing the practice did not already know. What is deliberately absent
 * is everything that would come from the PERSON: no verification status, no
 * account, no calendar, no radar standing, no earnings. Those appear when they
 * accept, and the acceptance screen enumerates them first.
 */
export async function clinicInvitations(actor: ClinicPrincipal) {
  refuseWithout(actor, "people.read");

  return controlDb
    .select({
      id: clinicianInvitations.id,
      email: clinicianInvitations.email,
      firstName: clinicianInvitations.firstName,
      lastName: clinicianInvitations.lastName,
      state: clinicianInvitations.state,
      expiresAt: clinicianInvitations.expiresAt,
      createdAt: clinicianInvitations.createdAt,
    })
    .from(clinicianInvitations)
    .where(eq(clinicianInvitations.organizationId, actor.clinicOrganizationId))
    .orderBy(desc(clinicianInvitations.createdAt))
    .limit(200);
}

/**
 * 🔴 THE SCHEDULE. A NAME, A CLINICIAN AND A TIME. NOTHING ELSE, IN ANY FORM.
 *
 * Read the select list rather than this paragraph. What is absent from it is the
 * sprint: no note, no transcript, no journal, no summary, no risk, no diagnosis, no
 * evidence, no copilot, no price, no payment status, no consent, no recording state,
 * no session type, no join token and no feedback token.
 *
 * 🔴 `status` IS here, and it is the one judgement call in this function. A practice
 * manager scheduling a room needs to know whether an appointment is still on;
 * "cancelled" is an administrative fact about a booking rather than a clinical one,
 * and a schedule that shows cancelled hours as booked is a schedule nobody can use.
 * `no_show_at` is deliberately NOT here: whether somebody turned up is clinical, and
 * a pattern of missed appointments across a caseload is a clinical picture.
 */
export type ClinicScheduleRow = {
  sessionId: string;
  /**
   * 🔴 63.12 / C327 — FIRST NAME AND LAST INITIAL, and the patient is told.
   *
   * *A calendar is a treatment record.* In a two-therapist practice "Sarah
   * Mahmoud, Tuesdays 3pm, six months" identifies a person and discloses that
   * they are in therapy. The founder's own first-name-plus-initial is kept, and
   * what makes it defensible rather than a fig leaf is the disclosure: the
   * patient is told, on their record page and with a label on the radar card,
   * that clinic administrative staff can see this much.
   *
   * A disclosed leak is a trade. An undisclosed one is a breach.
   */
  patientName: string;
  therapistName: string;
  scheduledAt: Date | null;
  status: string;
};

/**
 * 🔴 63.12 / C327 — THE SHORTENING, PURE AND EXPORTED SO IT CAN BE TESTED.
 *
 * Exported because a rule about what a whole principal may see should be provable
 * without a database, and because `verify:sprint63` asserts it against surnames
 * that break a naive implementation: a single-word name, a name that is already
 * one letter, a hyphenated surname, an Arabic surname with no Latin initial.
 *
 * 🔴 A NAME WE CANNOT SHORTEN IS SHOWN AS ITS FIRST PART ALONE, never in full.
 * "van der Berg" with a rule that took the first character of the last WORD would
 * print "Sarah B", which is correct; a rule that gave up and printed the whole
 * thing on anything unusual would leak exactly the names that are most
 * identifying.
 */
export function shortenForClinic(first: string | null, last: string | null): string {
  const given = (first ?? "").trim();
  const family = (last ?? "").trim();

  if (!given && !family) return "";
  if (!family) return given;

  /*
   * The first CHARACTER, not the first byte and not a `[A-Z]` match: an Arabic or
   * accented surname has an initial too, and a regular expression over Latin
   * letters would silently return the given name alone for a whole alphabet.
   */
  const initial = [...family][0] ?? "";
  if (!given) return initial;
  return `${given} ${initial}`;
}

export async function clinicSchedule(input: {
  actor: ClinicPrincipal;
  from: Date;
  to: Date;
}): Promise<ClinicScheduleRow[]> {
  refuseWithout(input.actor, "schedule.read");

  /*
   * 🔴 63.4 / C325 — THE SCOPE IS IN THE WHERE CLAUSE, NOT IN A FILTER AFTERWARDS.
   *
   * Assistant 1 assigned to therapist A is refused therapist B's calendar on the
   * same route, and the refusal happens in the database: rows for an unassigned
   * clinician are never selected, so there is nothing for a later `.filter` to
   * miss and nothing in memory to leak through a log line or an error.
   *
   * `null` is the admin and means no restriction. An empty array means NOBODY, and
   * `inArray(x, [])` is false for every row, which is the behaviour we want and
   * the reason this does not special-case it into "no filter".
   */
  const scope = scopeToAssigned(input.actor, "schedule.read");

  const rows = await controlDb
    .select({
      sessionId: sessions.id,
      patientFirst: patients.firstName,
      patientLast: patients.lastName,
      guestName: sessions.guestName,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      scheduledAt: sessions.scheduledAt,
      status: sessions.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.therapistId))
    .leftJoin(patients, eq(patients.id, sessions.patientId))
    .where(
      and(
        eq(sessions.organizationId, input.actor.clinicOrganizationId),
        gte(sessions.scheduledAt, input.from),
        lt(sessions.scheduledAt, input.to),
        ...(scope === null ? [] : [inArray(sessions.therapistId, scope)]),
      ),
    )
    .orderBy(asc(sessions.scheduledAt))
    .limit(500);

  /*
   * 🔴 63.12 / C327 — EVERY CLINIC-STAFF READ OF A CALENDAR IS AUDITED.
   *
   * The ruling says so in as many words, and it is the second half of what makes
   * the disclosure a trade rather than a shrug: the patient is told who can see
   * this, and there is a record of each time somebody did.
   *
   * One row for the read, not one per patient. A row per name would put a list of
   * patients into the audit log to record that somebody looked at a list of
   * patients, which is the same data twice with a worse retention story.
   */
  const { audit } = await import("@/lib/audit");
  await audit({
    actor: null,
    clinicManagerId: input.actor.clinicManagerId,
    /*
     * 🔴 `phi_access` and not `admin`, which is the honest category for it.
     *
     * A calendar is a treatment record: it says this person is in therapy, with
     * this clinician, at this hour. Filing a clinic-staff calendar read under
     * "admin" would put it in the bucket an operator reads for product events
     * rather than the one a privacy regulator reads for "who looked", and the
     * whole reason the read is audited is that a regulator might ask.
     */
    category: "phi_access",
    action: "clinic.schedule.read",
    resourceType: "organization",
    resourceId: input.actor.clinicOrganizationId,
    reason: `${rows.length} appointments, ${input.from.toISOString().slice(0, 10)} to ${input.to.toISOString().slice(0, 10)}`,
  });

  return rows.map((row) => ({
    sessionId: row.sessionId,
    /*
     * A patient row, or the name a guest typed on a join link, or nothing.
     *
     * 🔴 The fallback is a placeholder rather than an email or a token. A session
     * booked from a public link before the person named themselves has no name to
     * show, and showing the guest email instead would hand the clinic a contact
     * detail for somebody who never dealt with them.
     *
     * 🔴 And a GUEST NAME IS SHORTENED THE SAME WAY. It is a name somebody typed
     * into a join link rather than a name on a record, which makes it no less
     * theirs: a rule that applied C327 to patients and not to guests would show
     * the practice the full name of the people it knows least about.
     */
    patientName:
      shortenForClinic(row.patientFirst, row.patientLast) ||
      shortenForClinic(...splitGuestName(row.guestName)),
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
    scheduledAt: row.scheduledAt,
    status: row.status,
  }));
}

/** A typed-in name is one string. Split once, on the first space. */
function splitGuestName(name: string | null): [string | null, string | null] {
  const value = (name ?? "").trim();
  if (!value) return [null, null];
  const at = value.indexOf(" ");
  if (at === -1) return [value, null];
  return [value.slice(0, at), value.slice(at + 1)];
}

/**
 * 🔴 63.4 / C325 — WHICH CLINICIANS THIS READ MAY TOUCH.
 *
 * Null means every clinician in the practice, which is the admin. An array means
 * exactly those, and an EMPTY array means none: a staff member with no assignments
 * sees nothing under a scoped capability, which is the safe direction for an empty
 * list to point.
 *
 * The difference between null and `[]` is the whole of this function, and getting
 * it backwards is the hole: `inArray(column, [])` matches nothing, while treating
 * `[]` as "no filter" would show an unassigned assistant the entire practice.
 */
function scopeToAssigned(
  actor: ClinicPrincipal,
  capability: ClinicCapability,
): string[] | null {
  if (actor.role === "admin") return null;
  if (!THERAPIST_SCOPED.includes(capability)) return null;
  return actor.therapistIds ?? [];
}

/**
 * 🔴 63.14 / 63.15 — EARNINGS, PER THERAPIST AND COMBINED, AND NOTHING THAT MOVES MONEY.
 *
 * > *A therapist withdraws their own earnings. The clinic sees the LOG and can never
 * > withdraw on their behalf.*
 *
 * ## 🔴 WHAT IS ABSENT FROM THE SELECT LIST IS THE TICKET
 *
 * No `identifier`, no `account_name`, no `method_id`, no `payout_method`. A practice
 * reading a bank account number off this screen is a practice that can be
 * social-engineered into changing one, and the whole ruling is that the money route
 * belongs to the person the money belongs to. What is here is a date, an amount and a
 * state, which is what "the clinic sees the log" means and no more.
 *
 * ## 🔴 AND THERE IS NO WRITE ANYWHERE NEAR THIS
 *
 * `requestPayout` takes a therapist's own `Actor`, which a `ClinicPrincipal` is not
 * and cannot be cast to, so "the clinic can never withdraw on their behalf" is the
 * type system rather than this paragraph.
 *
 * ## 🔴 C262's FLOOR DOES NOT APPLY HERE, and the difference is worth stating
 *
 * Usage and bills are suppressed under an activity floor because a small session
 * count is a statement about a patient. An earnings total is a statement about the
 * CLINICIAN, who is the practice's own colleague and whose figure the practice is
 * paying out of its own billing. Suppressing it would withhold from an employer a
 * number about their own employee that the employee can see themselves.
 */
export type ClinicEarnings = {
  userId: string;
  name: string;
  earnedCents: number;
  withdrawals: { requestedAt: Date; amountCents: number; status: string }[];
};

export async function clinicEarnings(actor: ClinicPrincipal): Promise<ClinicEarnings[]> {
  refuseWithout(actor, "earnings.read");

  const scope = scopeToAssigned(actor, "earnings.read");

  const people = await controlDb
    .select({ userId: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(
      and(
        eq(users.organizationId, actor.clinicOrganizationId),
        eq(users.role, "therapist"),
        isNull(users.deletedAt),
        ...(scope === null ? [] : [inArray(users.id, scope)]),
      ),
    )
    .orderBy(asc(users.firstName));

  if (people.length === 0) return [];

  const ids = people.map((person) => person.userId);

  /*
   * 🔴 63.16 / C331 — SCOPED TO THIS ORGANISATION, WHICH IS WHAT MAKES DEPARTURE WORK.
   *
   * A clinician who leaves is reparented to a new solo organisation, so their future
   * payouts carry that id and stop appearing here the moment they go. The rows for
   * work they did AT the practice keep the practice's id and stay: the clinic keeps
   * the financial record permanently and loses every live view instantly, which is
   * the ruling, achieved by a WHERE clause rather than by a departure routine that
   * has to remember to run.
   */
  const paid = await controlDb
    .select({
      therapistId: payoutRequests.therapistId,
      requestedAt: payoutRequests.requestedAt,
      amountCents: payoutRequests.amountCents,
      status: payoutRequests.status,
    })
    .from(payoutRequests)
    .where(
      and(
        eq(payoutRequests.organizationId, actor.clinicOrganizationId),
        inArray(payoutRequests.therapistId, ids),
      ),
    )
    .orderBy(desc(payoutRequests.requestedAt))
    .limit(500);

  const earned = await controlDb
    .select({
      therapistId: sessions.therapistId,
      cents: sql<number>`COALESCE(SUM(${sessionPayments.therapistNetCents}), 0)::int`,
    })
    .from(sessionPayments)
    .innerJoin(sessions, eq(sessions.id, sessionPayments.sessionId))
    .where(
      and(
        eq(sessions.organizationId, actor.clinicOrganizationId),
        inArray(sessions.therapistId, ids),
      ),
    )
    .groupBy(sessions.therapistId);

  const earnedBy = new Map(earned.map((row) => [row.therapistId, Number(row.cents)]));

  return people.map((person) => ({
    userId: person.userId,
    name: [person.firstName, person.lastName].filter(Boolean).join(" "),
    earnedCents: earnedBy.get(person.userId) ?? 0,
    withdrawals: paid
      .filter((row) => row.therapistId === person.userId)
      .map((row) => ({
        requestedAt: row.requestedAt,
        amountCents: row.amountCents,
        status: row.status,
      })),
  }));
}

/**
 * 🔴 54.10 / C262 — USAGE, UNDER THE SAME FLOOR AS C229, THROUGH THE SAME CODE PATH.
 *
 * *A three-therapist clinic is C229 again wearing a different coat.* Usage broken down
 * by therapist, in a practice with three of them, in a week with four sessions, is a
 * statement about individuals — and the individuals are now the clinic's own
 * employees, which is a different harm from a sponsor's but not a smaller one.
 *
 * So this imports `applyActivityFloor` from `lib/data/sponsors.ts` and reads
 * `settings.sponsor.activityFloor`. Not a copy, not a second setting, not a similar
 * number: the same function and the same figure, which is what C262 asks for in so
 * many words. The setting keeps its sponsor name because renaming it would fork the
 * very thing being shared.
 */
export type ClinicUsageWeek = {
  weekStart: Date;
  /** 🔴 null means SUPPRESSED, and it is not zero. See `applyActivityFloor`. */
  sessions: number | null;
  spendCents: number | null;
};

export async function clinicUsage(actor: ClinicPrincipal): Promise<ClinicUsageWeek[]> {
  refuseWithout(actor, "reports.read");

  const settings = await getSettings();
  const { applyActivityFloor } = await import("./sponsors");

  /*
   * Grouped by week IN SQL, for the same reason `weeklySpend` is: no daily row exists
   * anywhere in the pipeline to leak, so there is none in a variable, a log or a
   * debugger.
   *
   * 🔴 And grouped for the WHOLE CLINIC, never per therapist. A per-therapist
   * breakdown is precisely what C262 rules out, so there is no `group by therapist_id`
   * here and no argument that would produce one.
   */
  const rows = await controlDb.execute(sql`
    SELECT date_trunc('week', i.issued_at) AS week_start,
           COUNT(DISTINCT i.session_id)::int AS sessions,
           SUM(i.amount_cents - i.discount_cents)::int AS spend_cents
      FROM invoices i
     WHERE i.organization_id = ${actor.clinicOrganizationId}
       AND i.session_id IS NOT NULL
     GROUP BY 1
     ORDER BY 1 ASC`);

  const weeks = (
    rows.rows as { week_start: string; sessions: number; spend_cents: number }[]
  ).map((row) => ({
    weekStart: new Date(row.week_start),
    sessions: Number(row.sessions),
    spendCents: Number(row.spend_cents),
  }));

  return applyActivityFloor(weeks, settings.sponsor.activityFloor);
}

/**
 * 🔴 54.8 / C263 — THE BILL, AGGREGATED, AND NEVER ITEMISED TO A SESSION.
 *
 * > *Dr Salma has four patients this week and the clinic's invoice shows three AI
 * > fees. In a caseload that small, set beside the schedule the clinic can already
 * > see, that is a named patient's consent decision reaching their clinician's
 * > employer. Consent is the most protected choice in this product and the billing
 * > line gives it away.*
 *
 * So: a total platform fee, a total AI fee, a session count, a period. The itemised
 * breakdown stays with the therapist, whose own patients they are.
 *
 * 🔴 `session_id` IS NOT SELECTED and `invoice_lines` IS NOT JOINED. Those are the two
 * ways this leaks and both are absent rather than filtered. A practice manager
 * reconciling an invoice cannot tie a line to a session, which is a genuine accounting
 * inconvenience and the correct trade.
 *
 * 🔴 The C262 floor applies here too, on the SESSION COUNT rather than the money. A
 * month with one session and a bill for it is one patient's consent decision divided
 * by one, so the count is withheld below the floor and the total is not: a practice
 * has to be able to pay its bill.
 */
export type ClinicBill = {
  periodStart: Date;
  /** 🔴 Withheld below the C262 floor. Null is suppressed, not zero. */
  sessions: number | null;
  platformFeeCents: number;
  aiFeeCents: number;
  totalCents: number;
};

export async function clinicBills(actor: ClinicPrincipal): Promise<ClinicBill[]> {
  refuseWithout(actor, "bills.read");

  const settings = await getSettings();
  const floor = settings.sponsor.activityFloor;

  /*
   * 🔴 The line KINDS are summed, never listed.
   *
   * `invoice_lines` carries a kind per line and this sums by kind across the month,
   * so the query returns two figures and a count. There is no shape of result here
   * that could be rendered as a list of sessions, because the grouping threw the
   * session away before the rows left the database.
   *
   * 🔴 THE KINDS ARE `platform` AND `ai`, NOT `platform_fee` AND `ai_fee`.
   *
   * The first draft of this guessed the longer names, and a raw-SQL `CASE` over a
   * value that never matches sums to zero rather than failing: the clinic's bill would
   * have shown a correct total with both fee lines reading $0.00, which looks like a
   * free month rather than a bug. `verify:sprint54` posts a real invoice with real
   * lines and asserts both figures are non-zero, because typecheck cannot see inside
   * a SQL string and neither can a reader who trusts one.
   */
  const rows = await controlDb.execute(sql`
    SELECT date_trunc('month', i.issued_at)                               AS period_start,
           COUNT(DISTINCT i.session_id)::int                              AS sessions,
           COALESCE(SUM(CASE WHEN l.kind = 'platform'
                             THEN l.amount_cents ELSE 0 END), 0)::int      AS platform_fee_cents,
           COALESCE(SUM(CASE WHEN l.kind = 'ai'
                             THEN l.amount_cents ELSE 0 END), 0)::int      AS ai_fee_cents,
           SUM(i.amount_cents - i.discount_cents)::int                     AS total_cents
      FROM invoices i
      LEFT JOIN invoice_lines l ON l.invoice_id = i.id
     WHERE i.organization_id = ${actor.clinicOrganizationId}
       AND i.session_id IS NOT NULL
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT 24`);

  return (
    rows.rows as {
      period_start: string;
      sessions: number;
      platform_fee_cents: number;
      ai_fee_cents: number;
      total_cents: number;
    }[]
  ).map((row) => ({
    periodStart: new Date(row.period_start),
    /* 🔴 C262 — the count is withheld below the floor; the money never is. */
    sessions: Number(row.sessions) < floor ? null : Number(row.sessions),
    platformFeeCents: Number(row.platform_fee_cents),
    aiFeeCents: Number(row.ai_fee_cents),
    totalCents: Number(row.total_cents),
  }));
}

/**
 * 🔴 THE ENFORCEMENT THAT IS AN ABSENCE, STATED SO A VERIFIER CAN FIND IT.
 *
 * There is no `clinicNotes`, `clinicTranscript`, `clinicSummary`, `clinicRisk`,
 * `clinicDiagnoses`, `clinicJournals`, `clinicCopilot` or `clinicPatient` in this
 * module, and there never will be. 54.9 is a list of things a clinic never sees in any
 * form, and the way to never render one is for no function to return one.
 *
 * The same construction as `ATTENDANCE_IS_NEVER_CONFIRMED` in the sponsor wall, and
 * for the same reason: a rule enforced by the absence of code is invisible to a
 * reader and to a verifier unless something says so out loud.
 */
export const CLINIC_SEES_NO_CLINICAL_CONTENT = true;

/*
 * 🔴 `clinicManagersFor` AND `getClinic` ARE GONE, 2026-09-14, and the removal is
 * the sprint rather than tidying.
 *
 * Both were read by the ADMIN console with a bare organisation id. Sprint 63 made
 * every function in this file take a `ClinicPrincipal` and check a capability on the
 * resource, and a `super_admin` is not one: the back office now reads through
 * `clinicsForAdmin` in `lib/data/clinic-admin.ts`, with its own select list, behind
 * `requireRole`.
 *
 * Leaving these here taking an id would have left a door into the wall that needs no
 * principal, which is the door somebody walks through next time.
 */
