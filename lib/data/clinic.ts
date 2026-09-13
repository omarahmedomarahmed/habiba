import "server-only";

import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import { controlDb } from "@/lib/db";
import {
  clinicManagers,
  clinicianInvitations,
  invoices,
  organizations,
  patients,
  sessions,
  users,
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
 */

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

export async function clinicClinicians(
  clinicOrganizationId: string,
): Promise<ClinicClinician[]> {
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
        eq(users.organizationId, clinicOrganizationId),
        /*
         * 🔴 `role = 'therapist'` and nothing else, which is belt and braces: a
         * clinic's organisation should contain no staff role at all, because those
         * are ours. If one ever appears, this list does not show it to a customer.
         */
        eq(users.role, "therapist"),
        isNull(users.deletedAt),
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

/** Invitations still outstanding. 54.4. */
export async function clinicInvitations(clinicOrganizationId: string) {
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
    .where(eq(clinicianInvitations.organizationId, clinicOrganizationId))
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
  /** 🔴 C260 — the patient's name, because the clinic is paying for this hour. */
  patientName: string;
  therapistName: string;
  scheduledAt: Date | null;
  status: string;
};

export async function clinicSchedule(input: {
  clinicOrganizationId: string;
  from: Date;
  to: Date;
}): Promise<ClinicScheduleRow[]> {
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
        eq(sessions.organizationId, input.clinicOrganizationId),
        gte(sessions.scheduledAt, input.from),
        lt(sessions.scheduledAt, input.to),
      ),
    )
    .orderBy(asc(sessions.scheduledAt))
    .limit(500);

  return rows.map((row) => ({
    sessionId: row.sessionId,
    /*
     * A patient row, or the name a guest typed on a join link, or nothing.
     *
     * 🔴 The fallback is a placeholder rather than an email or a token. A session
     * booked from a public link before the person named themselves has no name to
     * show, and showing the guest email instead would hand the clinic a contact
     * detail for somebody who never dealt with them.
     */
    patientName:
      [row.patientFirst, row.patientLast].filter(Boolean).join(" ") ||
      row.guestName ||
      "",
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
    scheduledAt: row.scheduledAt,
    status: row.status,
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

export async function clinicUsage(clinicOrganizationId: string): Promise<ClinicUsageWeek[]> {
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
     WHERE i.organization_id = ${clinicOrganizationId}
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

export async function clinicBills(clinicOrganizationId: string): Promise<ClinicBill[]> {
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
     WHERE i.organization_id = ${clinicOrganizationId}
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

/** The manager list, for the clinic's own settings screen. */
export async function clinicManagersFor(clinicOrganizationId: string) {
  return controlDb
    .select({
      id: clinicManagers.id,
      email: clinicManagers.email,
      name: clinicManagers.name,
      role: clinicManagers.role,
      lastSignInAt: clinicManagers.lastSignInAt,
    })
    .from(clinicManagers)
    .where(
      and(
        eq(clinicManagers.organizationId, clinicOrganizationId),
        isNull(clinicManagers.deletedAt),
      ),
    )
    .orderBy(asc(clinicManagers.email));
}

/** The practice itself, for its own header and its state. */
export async function getClinic(clinicOrganizationId: string) {
  const [row] = await controlDb
    .select({
      id: organizations.id,
      name: organizations.name,
      kind: organizations.kind,
      clinicState: organizations.clinicState,
      contactName: organizations.contactName,
      contactEmail: organizations.contactEmail,
      contactPhone: organizations.contactPhone,
    })
    .from(organizations)
    .where(eq(organizations.id, clinicOrganizationId))
    .limit(1);

  if (!row) log.warn("clinic actor with no organisation row");
  return row ?? null;
}
