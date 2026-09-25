import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { dbFor } from "@/lib/db";
import { regionOfPerson } from "@/lib/db/directory";
import { qualified } from "@/lib/db/qualified";
import { doorFor, type SessionDoor } from "@/lib/sessions/doors";
import {
  manualPayments,
  noteAddenda,
  patients,
  sessionNotes,
  sessions,
  users,
  type NoteProvenance,
} from "@/lib/db/schema";



/**
 * Everything a patient may see about their own sessions. PLAN.md 15.3, 15.4, 15.8.
 *
 * ## 🔴 15.8 — the block is this module, not a screen
 *
 * §6: *a patient never sees a transcript or a clinical note, enforced
 * server-side.* A component that "just doesn't render" the note is one prop
 * away from rendering it, and the next person to build a patient screen will
 * reach for whatever query is nearest.
 *
 * So there is exactly one query a patient screen may use for sessions, it is
 * here, and **its select list is the enforcement**. It reaches
 * `session_notes` for one column — `patient_brief`, which is the passage the
 * model writes *to* the patient and which a clinician signs separately — and
 * for `patient_status`, which says whether that signature happened. It never
 * touches `content`, `soap`, `summary`, `talking_points`, `impressions`, or
 * `transcript_segments` at all.
 *
 * The sprint 15 verifier asserts this on the **shape of what comes back**, so
 * a widened select fails a check rather than shipping.
 *
 * ## The separate-table pattern, again
 *
 * Same reasoning as C41's patient identity and C58's assistant threads: the
 * guarantee comes from what is absent. A `PatientSession` has no field that
 * *could* hold a clinical sentence, so no screen can leak one by accident.
 */

/** 15.3 — the four groups a patient's own sessions fall into. */
export type SessionGroup = "today" | "upcoming" | "past_scheduled" | "past_instant";

export type PatientSession = {
  id: string;
  group: SessionGroup;
  /** The instant. Rendered by `lib/scheduling/tz.ts` in the reader's zone. */
  at: Date;
  therapistName: string;
  /** 🔴 W3 / P3: the summary on the card carries its signer's credentials. */
  therapistCredentials: string | null;
  /** 🔴 W3: "Book again" opens this clinician's own page. */
  therapistId: string;
  /** `video` or `in_person`. Not a clinical fact. */
  modality: string;
  priceCents: number;
  /**
   * 🔴 The currency the session was actually priced in.
   *
   * Its absence was a live defect the sprint-52 content seed exposed within a minute of there being
   * a priced session to look at: the list formatted every amount as USD, so a patient in Cairo who
   * paid 450 EGP read "$450" on their own record. `sessions.price_currency` has held the answer
   * since 46 and this row never carried it.
   */
  priceCurrency: string;
  paymentStatus: string;
  /**
   * The passage written **to** them, once their clinician has signed it.
   *
   * Null while unsigned — 8.x's rule: a draft is a machine's first attempt at
   * describing somebody's therapy, and it reaches the person it is about only
   * after the person who was in the room has read it.
   */
  brief: string | null;
  briefPending: boolean;
  /**
   * 🔴 W1-03 / P4: what their clinician added to the brief after releasing
   * it, oldest first. Only `kind = 'patient'` rows, which are written TO them
   * like the brief; a clinical addendum is never selected here.
   */
  briefAddenda: { by: string; at: Date; body: string }[];
  /**
   * 🔴 47.4 — which of their own sessions were transcribed.
   *
   * Null when there is no note yet. It is their record and it was their choice
   * that produced it, so this is shown whether or not a brief has been written:
   * "this session was not recorded" is a true and useful thing to know about a
   * session whose note is still being drafted.
   */
  provenance: NoteProvenance | null;
  /** 🔴 A cancelled session says so, and never "your summary is being written". */
  cancelled: boolean;
  /** What they still owe, after their benefit and with VAT. Null when nothing is owed. */
  owedCents: number | null;
  /** 🔴 Ruling 16: a booking still ahead, which they may cancel or move. */
  changeable: boolean;
};

/**
 * A patient's own sessions, grouped. 15.3.
 *
 * Scoped on `personId` — the identity, not one clinic's `patients` row — so
 * somebody seen by two therapists sees both, which is the whole point of the
 * person layer.
 */
export async function sessionsForPatient(personId: string): Promise<PatientSession[]> {
  /* 🔴 30.1 / C154 — the patient's own view, from the patient's own region. */
  const db = dbFor(await regionOfPerson(personId));

  const rows = await db
    .select({
      id: sessions.id,
      scheduledAt: sessions.scheduledAt,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      createdAt: sessions.createdAt,
      sessionType: sessions.sessionType,
      modality: sessions.modality,
      priceCents: sessions.priceCents,
      priceCurrency: sessions.priceCurrency,
      paymentStatus: sessions.paymentStatus,
      status: sessions.status,
      therapistId: users.id,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      therapistProfile: users.profile,

      /*
       * 🔴 The only two columns this module takes from `session_notes`, ever.
       *
       * `patient_brief` is written to the patient; `patient_status` says
       * whether their clinician has signed it. The clinical note lives in the
       * same row and is not selected — see the note at the top of this file.
       */
      brief: sql<string | null>`${sessionNotes.content} ->> 'patientBrief'`,
      // 47.4 — it is their record and their choice that produced it.
      provenance: sessionNotes.provenance,
      patientStatus: sessionNotes.patientStatus,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(users, eq(users.id, sessions.therapistId))
    /* W2-F01: the patient's one copy is on the session's primary note. */
    .leftJoin(
      sessionNotes,
      and(eq(sessionNotes.sessionId, sessions.id), eq(sessionNotes.isPrimary, true)),
    )
    .where(and(eq(patients.personId, personId), isNull(patients.deletedAt)))
    .orderBy(desc(sql`COALESCE(${sessions.scheduledAt}, ${sessions.createdAt})`))
    .limit(200);

  const now = Date.now();

  /* 🔴 W1-03: patient addenda only, for released copies only. */
  const released = rows.filter((row) => row.patientStatus === "approved").map((row) => row.id);
  const addenda = released.length
    ? await db
        .select({
          sessionId: noteAddenda.sessionId,
          by: noteAddenda.authorName,
          at: noteAddenda.createdAt,
          body: noteAddenda.body,
        })
        .from(noteAddenda)
        .where(and(inArray(noteAddenda.sessionId, released), eq(noteAddenda.kind, "patient")))
        .orderBy(asc(noteAddenda.createdAt))
    : [];

  /* 🔴 The pay page's figure for each unpaid one, never the list price. */
  const { patientOwesTotal } = await import("@/lib/billing/manual-entry");
  /*
   * 🔴 B49: side by side, not one after another. Each figure is five or six
   * round trips, and they were awaited in a loop, so a patient with a few
   * unpaid sessions waited for all of them in series before the list drew.
   */
  const unpaid = rows.filter(
    (row) => row.priceCents > 0 && row.paymentStatus === "pending" && row.status !== "cancelled",
  );
  const owed = new Map<string, number>(
    await Promise.all(unpaid.map(async (row) => [row.id, await patientOwesTotal(row.id)] as const)),
  );

  return rows.map((row) => {
    const at = row.scheduledAt ?? row.endedAt ?? row.startedAt ?? row.createdAt;
    const signed = row.patientStatus === "approved";

    return {
      id: row.id,
      provenance: row.provenance ?? null,
      group: groupOf({
        at,
        now,
        scheduled: row.scheduledAt !== null,
        fromRadar: row.sessionType === "radar",
        cancelled: row.status === "cancelled",
        finished: row.status === "completed" || row.endedAt !== null,
      }),
      at,
      therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
      therapistCredentials: row.therapistProfile?.credentials?.trim() || null,
      therapistId: row.therapistId,
      modality: row.modality,
      priceCents: row.priceCents,
      priceCurrency: row.priceCurrency,
      paymentStatus: row.paymentStatus,
      brief: signed ? row.brief : null,
      cancelled: row.status === "cancelled",
      owedCents: owed.get(row.id) ?? null,
      changeable:
        row.status === "scheduled" &&
        row.startedAt === null &&
        row.scheduledAt !== null &&
        row.scheduledAt.getTime() > now,
      briefPending:
        !signed && row.status !== "cancelled" && (at.getTime() < now || row.status === "completed" || row.endedAt !== null),
      briefAddenda: signed
        ? addenda
            .filter((line) => line.sessionId === row.id)
            .map(({ by, at: when, body }) => ({ by, at: when, body }))
        : [],
    };
  });
}

/**
 * 🔴 76.17 — THE SESSION THAT IS HAPPENING RIGHT NOW, if one is.
 *
 * ## Why it is a second query rather than a wider first one
 *
 * `sessionsForPatient` above is §6's enforcement and its select list is the
 * guarantee: a `PatientSession` has no field that could hold a clinical
 * sentence, so no screen can leak one. Widening it to carry a join token would
 * put a door key on the type every patient screen already renders, and would
 * move a verifier that watches its shape.
 *
 * This returns three things and touches `session_notes` not at all. There is
 * no note on a session that started ninety seconds ago anyway.
 *
 * ## What "right now" means, and it is not the booked time
 *
 * `in_progress` with a `startedAt` and no `endedAt`. A clinician six minutes
 * late has not opened a door, so a banner keyed on the clock would send
 * somebody into an empty room; `no-show-recovery.tsx` exists because that
 * happens on the other rail. The instant somebody pressed Start is the instant
 * there is somewhere to go.
 */
/**
 * 🔴 79.3 — THE SESSION THIS PERSON HAS OPEN, whether it has started or not.
 *
 * `liveSessionForPatient` answers "is a clinician in a room right now", which
 * is the banner. This answers the other question, and it is the one a founder
 * asked after paying for a session on production and going back to the app:
 * **where did it go?**
 *
 * Nowhere. The payment sheet lives on `/pay/:token`, the join link lives in an
 * email, and the app itself held neither. A person who paid and navigated away
 * had a receipt somewhere and no door anywhere.
 *
 * So this returns the open session and what the person has to DO about it, and
 * the chrome renders an orb from it on every patient screen. Two states,
 * because there are two things it can be:
 *
 *   `owes`  priced, unpaid. The orb opens the payment.
 *   `ready` paid or free. The orb IS the door.
 *
 * ## What it deliberately does not return
 *
 * Nothing clinical, and no therapist name. An orb sits on a screen other
 * people can read over a shoulder, so it carries a state and a link and
 * stops. The banner names the clinician because it appears once a session is
 * live and the person is about to see them anyway.
 *
 * ## Why the newest rather than a list
 *
 * A person with two unpaid sessions has one problem, not two, and an orb that
 * could mean either is worse than an orb that means the most recent. The
 * sessions tab is the list.
 */
export async function openSessionForPatient(
  personId: string,
): Promise<{ href: string; state: "owes" | "ready"; live: boolean } | null> {
  const db = dbFor(await regionOfPerson(personId));

  const [row] = await db
    .select({
      joinToken: sessions.joinToken,
      status: sessions.status,
      paymentStatus: sessions.paymentStatus,
      priceCents: sessions.priceCents,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .where(
      and(
        eq(patients.personId, personId),
        isNull(patients.deletedAt),
        /*
         * Not ended and not called off. A completed session has nothing to do
         * and a cancelled one is somebody else's problem to explain, which
         * `docs/LIFECYCLES.md` records as its own dead end.
         */
        inArray(sessions.status, ["scheduled", "in_progress"]),
        isNull(sessions.endedAt),
        isNotNull(sessions.joinToken),
      ),
    )
    .orderBy(desc(sessions.createdAt))
    .limit(1);

  if (!row?.joinToken) return null;

  const owes = row.priceCents > 0 && row.paymentStatus === "pending";

  return {
    href: `/join/${row.joinToken}`,
    state: owes ? "owes" : "ready",
    live: row.status === "in_progress",
  };
}

export async function liveSessionForPatient(
  personId: string,
): Promise<{ sessionId: string; href: string; therapistName: string } | null> {
  const db = dbFor(await regionOfPerson(personId));

  const [row] = await db
    .select({
      id: sessions.id,
      joinToken: sessions.joinToken,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .leftJoin(users, eq(users.id, sessions.therapistId))
    .where(
      and(
        eq(patients.personId, personId),
        isNull(patients.deletedAt),
        eq(sessions.status, "in_progress"),
        isNull(sessions.endedAt),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  /*
   * No token is no door. It is a real state rather than an error: an in-person
   * session has nothing to join, and a banner offering a link that goes nowhere
   * is worse than no banner.
   */
  if (!row?.joinToken) return null;

  return {
    sessionId: row.id,
    href: `/join/${row.joinToken}`,
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
  };
}

/**
 * 🔴 W2-P06 / W2-P14: WHAT A SESSION CARD OPENS, and what is still owed.
 *
 * A card on the sessions list had no link or button at all: no join, no pay,
 * no "we are checking your transfer", no summary. Billing listed only paid
 * rows, so an unpaid session and a transfer waiting on an operator were on no
 * screen but the orb, which shows only the newest.
 *
 * ## Why a second query and not a wider `sessionsForPatient`
 *
 * The reason `openSessionForPatient` gives: that function's select list is
 * §6's enforcement and `verify:sprint15` freezes its shape, and a join token is
 * a door key. So the doors come from here, keyed by session id, and carry a
 * state and a link and nothing clinical: a note's `patient_status` is read only
 * to know whether a signed summary exists to point at. The decision itself is
 * `doorFor`, pure, in `lib/sessions/doors.ts`.
 */
export type { SessionDoor };

export type SessionDoorRow = {
  sessionId: string;
  therapistName: string;
  at: Date;
  priceCents: number;
  priceCurrency: string;
  door: SessionDoor | null;
};

export async function sessionDoors(personId: string): Promise<SessionDoorRow[]> {
  const db = dbFor(await regionOfPerson(personId));

  const rows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      endedAt: sessions.endedAt,
      scheduledAt: sessions.scheduledAt,
      createdAt: sessions.createdAt,
      joinToken: sessions.joinToken,
      joinTokenExpiresAt: sessions.joinTokenExpiresAt,
      priceCents: sessions.priceCents,
      priceCurrency: sessions.priceCurrency,
      paymentStatus: sessions.paymentStatus,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,
      patientStatus: sessionNotes.patientStatus,
      transferSubmitted: sql<boolean>`EXISTS (
        SELECT 1 FROM ${manualPayments}
         WHERE ${manualPayments.purpose} = 'session'
           AND ${manualPayments.refId} = ${qualified(sessions.id)}
           AND ${manualPayments.state} = 'submitted')`,
    })
    .from(sessions)
    .innerJoin(patients, eq(patients.id, sessions.patientId))
    .innerJoin(users, eq(users.id, sessions.therapistId))
    /*
     * 🔴 P12: the PRIMARY note only, the same condition `sessionsForPatient`
     * above joins on. A session can hold several notes since W2-F01, and a
     * bare join on the session id listed it once per note, each copy with its
     * own door and, on the billing page, its own amount owed.
     */
    .leftJoin(
      sessionNotes,
      and(eq(sessionNotes.sessionId, sessions.id), eq(sessionNotes.isPrimary, true)),
    )
    .where(and(eq(patients.personId, personId), isNull(patients.deletedAt)))
    .orderBy(desc(sql`COALESCE(${sessions.scheduledAt}, ${sessions.createdAt})`))
    .limit(200);

  const now = Date.now();
  return rows.map((row) => ({
    sessionId: row.id,
    therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
    at: row.scheduledAt ?? row.createdAt,
    priceCents: row.priceCents,
    priceCurrency: row.priceCurrency,
    door: doorFor({
      status: row.status,
      endedAt: row.endedAt,
      joinToken: row.joinToken,
      joinTokenExpiresAt: row.joinTokenExpiresAt,
      priceCents: row.priceCents,
      paymentStatus: row.paymentStatus,
      transferSubmitted: Boolean(row.transferSubmitted),
      summarySigned: row.patientStatus === "approved",
      now,
    }),
  }));
}

/**
 * Which of 15.3's four lists a session belongs in.
 *
 * Pure and exported so the boundaries are testable. "Today" is the reader's
 * today — the caller passes a zone-bucketed comparison in; here it is the
 * same instant arithmetic the rest of the product uses, and the screen groups
 * by `dayKey` for the heading.
 */
export function groupOf(input: {
  at: Date;
  now: number;
  scheduled: boolean;
  fromRadar: boolean;
  /** A cancelled session is never coming up, whatever its date (walkthrough). */
  cancelled?: boolean;
  /**
   * 🔴 B65: nor is one that has ended. A session held early, before the hour
   * it was booked for, sat under "Today" after it finished while Past said
   * "No sessions yet": the booked hour decided and the status was never read.
   */
  finished?: boolean;
}): SessionGroup {
  const future = input.at.getTime() > input.now && !input.cancelled && !input.finished;

  if (future) {
    const withinDay = input.at.getTime() - input.now < 24 * 3_600_000;
    return withinDay ? "today" : "upcoming";
  }

  /*
   * A past session that was never scheduled came off the radar — somebody in
   * crisis who was seen within minutes. It is a different kind of thing from a
   * booked appointment and 15.3 lists it separately, because "past sessions"
   * that mixes them reads as a course of treatment somebody never had.
   */
  return input.fromRadar || !input.scheduled ? "past_instant" : "past_scheduled";
}
