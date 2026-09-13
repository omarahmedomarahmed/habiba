/**
 * 🔴 43.4 — WHAT A SHADOW COPY HOLDS, AND FOR HOW LONG. THE DECISION, WRITTEN DOWN.
 *
 * > *In an EHR the chart is THEIR system of record, not ours.*
 *
 * The ticket asks for a judgement rather than a feature, so this file is the judgement, in the
 * place the schema and the verifier both read it from. A decision recorded only in a commit
 * message is a decision the next integration does not inherit.
 *
 * ## 🔴 THE ONE SENTENCE
 *
 * **We hold what we produced and what the patient gave us directly. We hold nothing their
 * system is the record for. Anything we read from their chart to do a job is used in that
 * request and never stored.**
 *
 * Everything below follows from that sentence, and the sentence is the thing to argue with.
 *
 * ## 🔴 WHY NOT THE TWO OBVIOUS ANSWERS
 *
 * **"Hold nothing: file the note and delete."** This is the answer that sounds most respectful
 * of the hospital and it breaks the one promise this product makes. §7 and C277: a patient can
 * claim their record and leave, *including leaving the institution*. If everything we hold dies
 * with the encounter, then a patient treated at a connected hospital has no record with us to
 * claim, and their portability becomes the hospital's to grant. It also deletes the transcript
 * that is the evidence for the note we generated, so "who approved this text" becomes
 * unanswerable the moment somebody asks.
 *
 * **"Hold everything, for ever."** Then we ARE a second system of record. The hospital has a
 * duplicate chart it does not govern: its retention schedule, its deletion requests and its
 * legal holds do not reach us, and `lib/integrations/registry.ts` has to keep telling a clinic
 * that we are *a second place to look* for ever. That is the sentence this sprint is supposed to
 * retire.
 *
 * ## 🔴 SO THE LINE IS DRAWN ON WHO PRODUCED THE DATUM, NOT ON WHAT KIND OF DATUM IT IS
 *
 * `WE_HOLD` is what exists because we were in the room or because the patient typed it on our
 * screen. Nobody else has it and nobody else can reproduce it.
 *
 * `THEIRS_NEVER_OURS` is what their chart is the record for. Every item on that list is
 * something a FHIR integration stores BY DEFAULT, because `Patient.read` returns the whole
 * resource and the obvious move is to persist what you fetched. So the schema is written with
 * nowhere to put it: `ehr_launches` has no demographic column, and `readThrough` returns its
 * result to the caller without a write. The same technique as `queueWebhook` in sprint 55 —
 * enforce the rule with the shape of the thing rather than with a reviewer noticing.
 *
 * ## 🔴 THE ONE ITEM ON THE LINE, AND WHY IT FALLS THE WAY IT DOES
 *
 * A **display name**. It is demographic data and their chart is its record, so by the sentence
 * above we should not hold it. We hold it anyway, and the reason is wrong-patient risk: a
 * schedule row, a note header and a consent prompt with no name on them are unsafe in a way
 * that no privacy gain offsets. A clinician about to record a session has to be able to see who
 * they are about to record.
 *
 * So: the display name, and NOTHING else. No date of birth, no MRN we would resolve on, no
 * address, no insurance, no next of kin, no problem list. The exception is one field wide and it
 * is named as an exception rather than smuggled in as "basic demographics".
 *
 * ## 🔴 TWO CLOCKS, BECAUSE THEY ANSWER TO DIFFERENT PEOPLE
 *
 * **What we produced follows OUR retention**, because the person it answers to is the patient.
 * Deleting a transcript on the hospital's schedule would make the patient's own record
 * disposable by their employer's IT department, which is C234's shape one layer up: their
 * institution, their funding and their record are three different things.
 *
 * **The LINK dies with the connection.** `ehr_launches.fhir_patient_id` is the mapping from
 * their patient to ours, and when a hospital disconnects we must stop being able to resolve
 * their identifiers. That is the half that actually matters, and it is a severing rather than a
 * deletion: the clinical record stays, held for the patient, no longer resolvable to the
 * hospital's chart.
 *
 * A consequence worth stating out loud, because it looks like a bug the first time somebody
 * meets it: after a disconnection our record of that patient is an orphan with a name and a
 * history and no link to the hospital. That is correct. It is the patient's record, and it was
 * never the hospital's to take away.
 *
 * **What we read through is never stored, so it has no clock.**
 */

/**
 * 🔴 What we hold, because we produced it or the patient gave it to us directly.
 *
 * Each entry names the table, so this list can be checked against the schema rather than
 * believed. `verify:sprint43` asserts that every table named here exists and that no table in
 * `THEIRS_NEVER_OURS` has a column on `ehr_launches`.
 */
export const WE_HOLD = [
  {
    what: "the transcript",
    table: "transcript_segments",
    why: "We recorded it, under a consent we recorded (C214). It is the evidence for the note we generated, and without it 'who approved this text' is unanswerable.",
  },
  {
    what: "the note, its drafts and its approval trail",
    table: "session_notes",
    why: "A DocumentReference in their chart is the note. The trail that a named human approved that exact wording is §7's first hard rule and their EHR has no field for it.",
  },
  {
    what: "the session itself",
    table: "sessions",
    why: "When it happened, how long, with whom, in which modality. Ours because we ran it.",
  },
  {
    what: "assessment responses",
    table: "assessment_responses",
    why: "The patient answered on our screens. C278: this is the structured data a transcript cannot produce.",
  },
  {
    what: "the patient's own journal",
    table: "journals",
    why: "Theirs. Never the clinician's, never the institution's, and C123 promises no watcher.",
  },
  {
    what: "the display name",
    table: "patients",
    why: "THE ONE EXCEPTION, named as one. Demographic data their chart is the record for, held because a schedule row or a consent prompt with no name on it is a wrong-patient risk that no privacy gain offsets.",
  },
] as const;

/**
 * 🔴 What their system is the record for. We read it when a job needs it and store none of it.
 *
 * Every one of these is what a FHIR integration stores by default: `Patient.read` returns the
 * whole resource, `Condition.search` returns the problem list, and persisting what you fetched
 * is one line. So the enforcement is structural — there is no column for any of it — and this
 * list is what `verify:sprint43` sweeps the EHR schema against.
 */
export const THEIRS_NEVER_OURS = [
  "date of birth",
  "medical record number",
  "address",
  "insurance or payer membership",
  "next of kin or emergency contact",
  "the problem list and diagnoses",
  "medications",
  "allergies",
  "encounters we were not in",
  "results, labs and imaging",
] as const;

/**
 * 🔴 The column names a shadow copy would grow, for a verifier to sweep the schema for.
 *
 * Written as fragments rather than exact names, because the failure is somebody adding
 * `patient_dob` or `mrn` or `payer_id` to `ehr_launches` because it was right there in the
 * resource. A sweep on fragments catches the spelling nobody predicted.
 */
export const FORBIDDEN_COLUMN_FRAGMENTS = [
  "dob",
  "birth",
  "mrn",
  "ssn",
  "address",
  "postal",
  "insurance",
  "payer",
  "diagnosis",
  "condition",
  "medication",
  "allergy",
  "problem",
  "kin",
  "emergency_contact",
] as const;

/**
 * 🔴 The two clocks, as the code that decides them.
 *
 * `severed` is what a disconnection does to the mapping. `retained` is what the patient's own
 * record follows. They are different values on purpose and the comment above says why.
 */
export const RETENTION = {
  /** The mapping from their patient id to ours. Severed the moment a connection is revoked. */
  linkOutlivesConnection: false,
  /** What we produced. Follows the patient's retention, not the institution's. */
  clinicalRecordOutlivesConnection: true,
  /** Anything fetched from their FHIR server to answer one request. Never written. */
  readThroughIsStored: false,
} as const;

/**
 * 🔴 THE DECISION, STATED SO A VERIFIER CAN FIND IT.
 *
 * The pattern sprints 41, 53 and 55 all ended up using: a rule that lives in the shape of the
 * code is invisible to a reader unless something says so out loud, and invisible to a checker
 * unless it is a value.
 */
export const THEIR_CHART_IS_THE_RECORD = true;
