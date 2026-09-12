import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { dbFor } from "@/lib/db";
import { regionOfPerson } from "@/lib/db/directory";
import { patients, sessionNotes, sessions, users, type NoteProvenance } from "@/lib/db/schema";



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
  /** `video` or `in_person`. Not a clinical fact. */
  modality: string;
  priceCents: number;
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
   * 🔴 47.4 — which of their own sessions were transcribed.
   *
   * Null when there is no note yet. It is their record and it was their choice
   * that produced it, so this is shown whether or not a brief has been written:
   * "this session was not recorded" is a true and useful thing to know about a
   * session whose note is still being drafted.
   */
  provenance: NoteProvenance | null;
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
      paymentStatus: sessions.paymentStatus,
      therapistFirst: users.firstName,
      therapistLast: users.lastName,

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
    .leftJoin(sessionNotes, eq(sessionNotes.sessionId, sessions.id))
    .where(and(eq(patients.personId, personId), isNull(patients.deletedAt)))
    .orderBy(desc(sql`COALESCE(${sessions.scheduledAt}, ${sessions.createdAt})`))
    .limit(200);

  const now = Date.now();

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
      }),
      at,
      therapistName: [row.therapistFirst, row.therapistLast].filter(Boolean).join(" "),
      modality: row.modality,
      priceCents: row.priceCents,
      paymentStatus: row.paymentStatus,
      brief: signed ? row.brief : null,
      briefPending: !signed && at.getTime() < now,
    };
  });
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
}): SessionGroup {
  const future = input.at.getTime() > input.now;

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
