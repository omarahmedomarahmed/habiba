# Verification: CLINICAL

Verifier: CLINICAL domain (recording consent and off the record, notes and summaries, the copilot,
crisis scanning and alerts, SOS, anonymous sessions, the in-session report). Read only; nothing run
against a database. Branch `claude/lucid-fermi-pwdz7f` at `8acf13b`.

Sources are the Broken (B), Suspect (S) and "Looks broken, is handled" (H) sections of
`takeover/reading/code-01.md` to `code-16.md` and the three digests.

## Recording consent and off the record

### CLIN-1 · Recording without consent: in person, patient stop, late decline, server never checks
- Verdict: CONFIRMED (carried in: MAP "Confirmed by the coordinator" item 4; not re-verified)
- Sources: code-03 B1, code-05 B1, code-07 B1 and B2, code-10 B1 and B3, code-10 S1, code-16 S12, MAP Suspect 5
- Promise: T2, P3 (and the legal basis for recording)
- Who is hurt and how: a patient seen in person is recorded and transcribed without ever being asked, and a patient who presses Stop or declines after the room opened is told recording stopped while the clinician's recorder keeps uploading.
- Evidence: MAP item 4 (`components/session/session-room.tsx:103`, `app/join/[token]/actions.ts:377,762`, `app/api/sessions/[id]/transcribe/route.ts`). Re-read while verifying neighbours: the transcribe route checks only `status === "in_progress"` (`route.ts:126`) on both the cookie and the ingest-token branch (`:73-93`); the room poll type (`session-room.tsx:372-378`) carries no pause or consent field.
- Severity: S1
- Fix sketch: as MAP item 4: the transcribe route refuses unless `recording_consent = 'granted'` and `recording_paused_at IS NULL`; the state poll carries the pause and the room mutes on it; in person gets a consent step before the mic opens. Proof: a route test posting a chunk to a session with consent null, and one with a pause stamp, both refused.
- Decision it came from: 41.2 and 48.10 put the pause stamp in the database for the patient's screen and the meeting bot, but the 24Therapy room kept its C370 client-side mute as the only enforcement.

### CLIN-2 · The clinician's "do not record" tick at creation is ignored by the room
- Verdict: CONFIRMED
- Sources: code-07 B1 (last part), code-10 B2
- Promise: T2
- Who is hurt and how: a clinician who unticks Record when creating the session (for a patient who said no by phone, say) still has the room record and transcribe the whole session on Start.
- Evidence: `app/(app)/sessions/actions.ts:247-252` stores the untick only as `recording_paused_at`. Every reader of that column (grep over app, lib, components): the meetings webhook (`app/api/meetings/transcript/[sessionId]/route.ts:103`), join actions, timeline, admin TV and console reads. None is the room page, `session-room.tsx` (initial mute is `recordingConsent === "declined"` only, `:103,109`) or the transcribe route. Patch looked for: none.
- Severity: S1
- Fix sketch: same server-side refusal as CLIN-1 covers it; also initialise `offRecord` from `recordingPausedAt` in the room page props. Proof: create a session with transcribe false, go live, post a chunk, expect refusal.
- Decision it came from: 41.2 ("the same switch the off-record button uses") assumed every consumer reads the switch; only the external-meeting path does.

### CLIN-3 · Pressing "Resume" in the room erases a patient's own Stop
- Verdict: CONFIRMED
- Sources: code-07 B1, code-10 B19
- Promise: T2
- Who is hurt and how: a patient taps Stop; the clinician, unaware, goes off record and back on; the stamp the patient set is cleared and recording resumes with no one having asked the patient again. The patient's strip keeps saying "stopped" (local latch) while the minimised orb's red dot says recording, so their two indicators disagree.
- Evidence: `setRecordingPaused(sessionId, false)` writes `recordingPausedAt: null` unconditionally (`app/(app)/sessions/actions.ts:615-630`), called from `toggleOffRecord` (`session-room.tsx:439-447`). The patient's `stopRecording` writes the same column (`app/join/[token]/actions.ts:760-763`). There is one column for three different people's decisions (clinician pause, clinician untick, patient stop/decline). Also `turnOnConsent` clears it (`actions.ts:702`) when recording has never started, which erases a clinician's creation-time untick.
- Severity: S1
- Fix sketch: separate the patient's withdrawal (e.g. `recording_withdrawn_at`, only cleared by a patient act) from the clinician's pause; the transcribe route refuses on either. Proof: patient stop, clinician toggle twice, chunk refused.
- Decision it came from: 41.2 and 48.10 reused one column as "the same switch".

### CLIN-4 · Note provenance badges an unconsented recording as "not recorded, the clinician's own account"
- Verdict: CONFIRMED
- Sources: code-05 B1 (provenance part), code-02 promise T1 row
- Promise: T1, T2, P3
- Who is hurt and how: after an in-person session recorded without consent (CLIN-1), the note drafted by the model from that transcript carries the badge "From the clinician's notes: Not recorded", and the patient's own screen says "This session was not recorded". The record states the opposite of what happened.
- Evidence: `lib/data/feedback.ts:519-523` returns `provenance: "clinician"` whenever consent is not `granted`, before looking at segments; `lib/ai/notes.ts:431-456` stores it; copy at `lib/i18n/messages.ts:3843-3847`. The function's own comment (`:497-503`) says segments are the evidence, yet the consent test runs first.
- Severity: S1
- Fix sketch: if segments exist and consent is not granted, store a distinct provenance (for example `unconsented`) and raise it to an operator; never badge it "not recorded". Better: CLIN-1's server refusal makes it unreachable. Proof: a unit over `noteProvenanceFor` with consent null and one segment.
- Decision it came from: 47.1/47.2 (C212, C213), which chose "consent is permission" and treated null as "never asked, so not recorded".

### CLIN-5 · Segment timestamps are invented, so an off-record minute leaves no trace
- Verdict: CONFIRMED
- Sources: code-05 B5, code-02 promise T2 row, code-10 S9
- Promise: T2
- Who is hurt and how: T2 promises "the transcript has a hole where the off-record minute was". No record ever says where or how long; the note is badged "From the recording" (whole session captured) for a session with minutes off record, and a patient's later complaint about that minute has no timeline to point to.
- Evidence: `app/api/sessions/[id]/transcribe/route.ts:178-179` sets `startMs = (seq-1)*8000`, `endMs = seq*8000`. `seq` rises only when a chunk is uploaded (`session-room.tsx:174`); a muted recorder emits nothing (`lib/audio/recorder.ts:201`) and a silent buffer is dropped too (`:250`). So consecutive segments always abut: `offRecordGaps` (`lib/data/feedback.ts:476-491`, gap over 20 s) can only fire when three or more uploaded chunks in a row transcribed to empty text, never because of off record. `offRecordSeconds` stays null and provenance stays `transcript`. Real chunks are 2 to 8 s (`recorder.ts:93-95`), so every derived duration (words per minute, pauses, citation `atSeconds`) is also wrong. Extra, found here: the room restarts `sequence` at the number of stored segments (`session-room.tsx:168`), but chunks that transcribed to empty consumed numbers without a row, so after a reload new chunks collide with existing `(session_id, sequence)` and are silently dropped by `onConflictDoNothing` (`lib/data/transcript.ts:102-104`) until the counter passes the old maximum: words lost after any room reload.
- Severity: S2
- Fix sketch: the client sends the chunk's real wall-clock start offset (from the session's `startedAt`), the route stores it; off record becomes a real gap. Seed the counter from the max stored sequence plus the number of empty chunks, or have the server assign sequence. Proof: a unit over a muted minute showing `offRecordGaps` returns one gap of about 60 s.
- Decision it came from: sprint 33 derived gaps "from the transcript's own timeline" to avoid bookkeeping, before chunks became pause-cut and before silence was dropped.

### CLIN-6 · The consent panel contradicts itself and goes stale
- Verdict: CONFIRMED
- Sources: code-06 B7, code-10 B18
- Promise: T2
- Who is hurt and how: on the join screen the patient reads "You can change these at any time during the session" and, a few lines lower in the same panel, "Recording cannot stop part-way. Ask your therapist to end the session", while a Stop button sits in the recording strip of the same room. Separately, the two switches show whatever consent was when the panel mounted, so a partner's later decline (couples) or a grant made elsewhere is never reflected.
- Evidence: `components/join/consent-controls.tsx:56` and `:89` render `jconsent.changeAnyTime` and `jconsent.cannotUndo` (`lib/i18n/messages.ts:1151-1152`, Arabic 4783-4784); the Stop control is `components/join/patient-room.tsx:343-357` (48.10). `useState({ recording, profileShare })` at `consent-controls.tsx:40` seeds once; the prop comes from the 5 s poll (`patient-room.tsx:272-276`).
- Severity: S3
- Fix sketch: delete `jconsent.cannotUndo` (48.10 made it false); derive `granted` from props with local optimistic override. Proof: render test with a changed prop.
- Decision it came from: 7.8 wrote the "cannot stop" line; 48.10 added the patient's Stop and did not retire it.

### CLIN-7 · External meeting bot: dispatched only on a grant, but on one person's grant
- Verdict: PARTLY
- Sources: code-05 S4, code-01 S (0071 bot not tied to consent), code-05 S5, code-07 H2
- Promise: T2 (and consent law for third parties)
- Who is hurt and how: the tie to consent holds: a bot is sent only when a grant actually lands (`app/join/[token]/actions.ts:400-439`) and the transcript webhook refuses any line when consent is not granted, paused, or the bot left (`app/api/meetings/transcript/[sessionId]/route.ts:103`). What holds as the reader said: in a couples or family Zoom where the second person joins Zoom directly, nobody asks them; the Zoom room is created with `waiting_room: false` and `join_before_host: true` (`lib/meetings/create.ts:125-126`), so anyone forwarded the link walks into a recorded meeting and sees only a participant named "24Therapy recorder".
- Evidence: as above; the couples rule (`actions.ts:333-399`, monotonic toward decline) works only for people who pass through our join link.
- Severity: S2
- Fix sketch: for a session with more than one expected participant, require each to consent on our page, or keep Zoom's waiting room on so the clinician admits people. Proof: the walk with two browsers, one joining Zoom directly.
- Decision it came from: 41.7 (couples rule on one column) and the create.ts note that a waiting room would hold a patient "who has done everything asked".

### CLIN-8 · Going off record near the end of a session ends it
- Verdict: CONFIRMED
- Sources: code-05 S6
- Promise: T2, P5 adjacent
- Who is hurt and how: after minute 50, if nothing new lands in the transcript for 90 seconds (the clinician went off record, or the patient is silent or crying), the server ends the session as abandoned, the room closes on both sides and the note is generated. A clinician who takes a hard moment off record in the last ten minutes loses the room.
- Evidence: `lib/session-clock.ts:122-136` (`silent` when elapsed is past running time and the last segment is older than `silenceSeconds`); `lastActivityAt` is the newest transcript segment's `created_at` (`lib/data/sessions.ts:465-468`), which off record never writes; `silenceSeconds: 90` (`lib/settings/defs.ts:570`); the state poll ends and finishes the session (`app/api/sessions/[id]/state/route.ts:76-87`). The comment at `session-clock.ts:114-121` guards only the case where the transcript never started.
- Severity: S2
- Fix sketch: silence counts only when no participant is connected (Daily presence) and never while `recording_paused_at` is set. Proof: unit over `sessionClock` with a pause flag.
- Decision it came from: the clock redesign (sprint 12) that defined "everybody left" as "nobody said anything".

### CLIN-9 · Fixtures and tests that encode or cannot catch the consent defect
- Verdict: CONFIRMED
- Sources: code-12 B2, code-12 B4, code-16 B2
- Promise: T2
- Who is hurt and how: nobody directly; the walk and the test suite show an in-person session with a transcript and no consent as normal, and the two consent tests cannot fail.
- Evidence: `scripts/seed-capture.ts:585-594` inserts `recording_consent` as SQL `true` into a text column (stored as the string `true`, neither granted nor declined); `scripts/seed.ts:378-420` seeds an in-person session with transcript and approved note and no consent; `tests/radar.test.ts:746-790` writes the consent columns with `db.update` and reads back what it wrote.
- Severity: S4
- Fix sketch: seed `'granted'` with a consent time, and have the consent tests call `submitJoin`/`recordConsent`. Proof: the tests go red with `recordConsent` stubbed out.
- Decision it came from: none recorded.

## Notes, drafts, signing and the patient's summary

### CLIN-10 · Regenerating a note after the patient's copy was released shows unreviewed model text as signed
- Verdict: CONFIRMED
- Sources: code-05 B8, code-07 S9, code-05 H4
- Promise: P3, T1
- Who is hurt and how: the patient's session list and feedback page show whatever `patientBrief` currently holds, labelled as approved. A regeneration after approval rewrites that text with fresh model output and leaves the approval in place, so a patient reads words no clinician read.
- Evidence: `regenerateNote` (`app/(app)/sessions/actions.ts:407-430`) checks only that the session is the clinician's, with no note status guard. `generateAndStoreNote`'s conflict path (`lib/ai/notes.ts:448-459`) rewrites `content` but not `status` or `patient_status`. Readers take the live field under the old approval: `lib/data/patient-view.ts:114,131,146`, `lib/data/feedback.ts:141,154`. The UI offers "Try again" only when `noteStatus` is failed or no note exists (`components/session/note-review.tsx:110-141`), so the reachable path is a direct server-action call or a regeneration that failed after approval; no DB trigger guards `session_notes` (only 13 triggers exist in `drizzle/`, none on notes).
- Severity: S2
- Fix sketch: `regenerateNote` refuses when `status = 'approved'` or `patient_status = 'approved'`, and the conflict update in `generateAndStoreNote` carries `WHERE session_notes.status = 'draft' AND patient_status = 'draft'`. Proof: approve both halves, call `regenerateNote`, expect a refusal.
- Decision it came from: the retry button (for failed generation) was written before sprint 0023 split the patient's signature from the chart's.

### CLIN-11 · Signed notes and released patient copies can be edited in place, with no version
- Verdict: CONFIRMED
- Sources: code-07 B6
- Promise: P3, P4 (spirit: "every version stays, under its author's name")
- Who is hurt and how: after the clinician signs the chart or releases the patient's copy, both stay editable; the text a patient already read (or received by email) silently changes, and the signed chart changes with its signature date left as it was.
- Evidence: `saveNote` and `savePatientNote` (`app/(app)/sessions/actions.ts:432-529`) update `session_notes.content` with no status condition; the UI offers Edit whatever the status (`components/session/note-review.tsx:349-352` and `449-452`); no trigger on `session_notes`. Contrast `clinical_summaries`, which is append-only by trigger (`drizzle/0059_summaries_and_journals.sql:63`). Only an audit row (`note.update`, `note.patient.update`) records that an edit happened, not what it was.
- Severity: S2
- Fix sketch: after approval, an edit creates an addendum or a new version (and clears the approval for the patient half so it must be re-released). Minimum: refuse `savePatientNote` once `patient_status = 'approved'`. Proof: approve, save, expect refusal.
- Decision it came from: none recorded; the two-signature split (0023) never touched the editors.

### CLIN-12 · The patient's email falls back to the clinician's summary
- Verdict: CONFIRMED
- Sources: code-05 B9
- Promise: P3
- Who is hurt and how: if the patient-facing brief is empty (the model returned none, which the normaliser allows, or the clinician cleared it to send nothing), the email sends the clinician-facing summary, written in clinical register and carrying the late-recording stamp, which nobody approved for the patient.
- Evidence: `lib/data/feedback.ts:642` `row.content?.patientBrief?.trim() || row.content?.summary?.trim()`; the stamp is prepended to `summary` at `lib/ai/notes.ts:412-416`; the brief defaults to `""` (`notes.ts:57`). The function's own header (`feedback.ts:598-605`) says it reads exactly three patient fields. The on-screen path uses `??` (`feedback.ts:154`), so it falls back only for notes that predate the brief field.
- Severity: S2
- Fix sketch: drop the fallback in `releaseBrief` (return false when the brief is empty), and the `??` fallback on the feedback page. Proof: a unit with an empty brief returns false and sends nothing.
- Decision it came from: the fallback was kept "for notes generated before the brief did" (`lib/mail.ts:239`), and copied one layer up.

### CLIN-13 · The after-session summary does not carry the clinician's credentials
- Verdict: PARTLY
- Sources: code-03 promise P3 rows (patient-view.ts:143, summaries.ts:183-186), code-07 S12, MAP P3 row
- Promise: P3 ("The summary after a session carries a clinician's name and credentials")
- Who is hurt and how: the patient reads their after-session summary on the sessions list, the feedback page and in email with, at most, the therapist's name on the row above it, and no credentials anywhere. The person-level summary at `/patient/summary` does carry name, credentials and licence.
- Evidence: kept: `lib/data/summaries.ts:183-186` snapshots name, `profile.credentials`, licence body and number into the append-only `clinical_summaries`, shown at `app/(patient)/patient/summary/page.tsx:65-67`. Not kept: `sessionsForPatient` selects only first and last name (`lib/data/patient-view.ts:104-105,143`); the feedback page shows "Written for you. Your therapist keeps a separate clinical note." under the brief (`components/feedback/rating-form.tsx:148-166`, `messages.ts:1197`) with no name; `releaseBrief` passes the name only (`feedback.ts:649`). Also: the credentials string is free text the clinician types in settings (`app/(app)/settings/actions.ts:55-61`), never checked against the verified licence; only the licence body and number come from the verification row.
- Severity: S2
- Fix sketch: put the approving clinician's name and credentials (snapshotted at `approvePatientNote`) under every brief: list, feedback page, email. Use the verified licence line, not the free-text field. Proof: the walk's P3 step on all three surfaces.
- Decision it came from: P3 was written against `clinical_summaries` (C127); the per-session brief predates it.

### CLIN-14 · "Still writing" forever for sessions that never happened
- Verdict: CONFIRMED
- Sources: code-03 S (sessionsForPatient no status filter), code-10 B11
- Promise: P3, T1
- Who is hurt and how: a patient's cancelled or no-show session shows "Your therapist is still writing your summary" for ever; on the clinician's side a cancelled session's page shows "writing your note" for ever with no way out.
- Evidence: `lib/data/patient-view.ts:124,148` has no status filter and sets `briefPending: !signed && at < now`. `components/session/note-review.tsx:110` shows the writing card when `!note && noteStatus !== "failed"`, which includes `none`; the session page renders it for every status other than scheduled or in progress (`app/(app)/sessions/[id]/page.tsx:66,186-247`). `noteStatus` is only ever written `generating`, `ready` or `failed` (grep), so a cancelled session keeps `none`. Also: a session stuck at `generating` (its `after()` finish died) polls for ever with no Try again (`note-review.tsx:99-102`).
- Severity: S3
- Fix sketch: `briefPending` only for `status = 'completed'`; note-review shows nothing (or "no note for a cancelled session") for `none`, and offers retry after a generating timeout. Proof: a cancelled session renders neither sentence.
- Decision it came from: none recorded.

### CLIN-15 · Signing discards a failed edit
- Verdict: WRONG
- Sources: code-10 B12
- Promise: T1
- Who is hurt and how: nobody in the way described. `saveNote` returns an error object only when the session is not found (`app/(app)/sessions/actions.ts:436-437`), and in that case `approveNote` fails the same way and the error is shown. A database failure makes `saveNote` throw, the `await` rejects, and `approveNote` never runs (`components/session/note-review.tsx:165-181`).
- Evidence: as above. The real residue: a thrown save leaves the button with no message (the transition rejects unhandled), unlike `handleApproveBrief` (`:198-209`) which checks. S4 at most.
- Severity: S4
- Fix sketch: check `saveNote`'s result as `handleApproveBrief` does and catch throws.
- Decision it came from: none.

### CLIN-16 · The patient's copy can be released before the chart is signed
- Verdict: HANDLED (by design)
- Sources: code-10 S2, code-10 H1
- Promise: P3
- Who is hurt and how: nobody. P3's "before they sign it" is about the patient's copy, and that has its own signature: the feedback page shows the brief only when `session_notes.patient_status = 'approved'` (`lib/data/feedback.ts:115,141`, aliased as `noteStatus`), the app list the same (`patient-view.ts:131`), the email the same (`feedback.ts:640`). The chart signature is deliberately separate (`app/(app)/sessions/actions.ts:455-462`, 0023).
- Evidence: as above.
- Severity: S4
- Fix sketch: none needed.
- Decision it came from: migration 0023 (patient note approval) and the comment at `actions.ts:455-462`.

### CLIN-17 · A guest must rate the clinician to see their own summary
- Verdict: PARTLY
- Sources: code-11 S (feedback-card "rates you to unlock their summary")
- Promise: P3 (none directly)
- Who is hurt and how: a radar or link guest with no account sees their approved summary only after submitting the rating form (which requires an email). A patient with an account sees it in the app without rating.
- Evidence: the brief is rendered only in the `done` branch of `components/feedback/rating-form.tsx:130-186`; `releaseBrief` needs `session_feedback.patient_email`, written by the rating (`feedback.ts:639`). The clinician-facing copy says so openly (`components/radar/feedback-card.tsx:55-56`). The app list is ungated (`patient-view.ts:146`).
- Severity: S3
- Fix sketch: show the approved brief on the feedback page before the rating, with the rating below it. Product decision for the founder.
- Decision it came from: the radar ratings design ("so almost all of them do").

### CLIN-18 · The patient's record export prints unsigned machine risk output
- Verdict: CONFIRMED
- Sources: code-02 B8
- Promise: P3
- Who is hurt and how: a patient who receives their record extract reads "risk noted: high" against a session, and the JSON carries the model or keyword scanner's `recommended_action`, an instruction to the clinician. Nobody signed either, and the keyword scanner is the one with the MAP item 2 defect. A session with two risk rows also appears twice.
- Evidence: `lib/data/export.ts:380-385` left-joins `risk_assessments`; `:575-576` copies level and action; `:678-680` prints the level in the HTML. The draft-note leak beside it was fixed (`:540-554`) and the risk fields were not. Risk rows are written unsigned by `lib/crisis/alerts.ts` (dedup 10 minutes per session, so two rows per session is normal).
- Severity: S2
- Fix sketch: drop `riskLevel`/`riskAction` from the patient extract (keep them in the clinician-to-clinician transfer, if any), and select one row per session. Proof: an export of a session with two risk rows shows one session and no risk words.
- Decision it came from: the export predates 35.x's risk rows; the C113 fix covered notes only.

## The copilot

### CLIN-19 · Copilot grant check and "capabilities absent means unrestricted"
- Verdict: HANDLED
- Sources: code-05 S10, code-12 S5, code-14 S1, code-06 S2, code-16 S9, code-10 S15, code-02 H3
- Promise: T5
- Who is hurt and how: nobody today. The one product caller recomputes the grant on every question and passes it down; the fail-open default is reachable only from a script.
- Evidence: `askCopilot` (`app/(app)/copilot/actions.ts:55-61`) calls `accessFor` per question before the quota and passes `capabilities: access.capabilities` (`:141`). Grep for `askPatientCopilot` finds no other product caller (the in-room ask panel calls the same action; the in-session suggestions in `lib/ai/copilot.ts` read only that session's segments). The fail-open reads are `lib/ai/case-copilot.ts` `documentsFor`/`journalsFor`/`profileFor` (`if (capabilities && ...)`), reached without capabilities only by `scripts/copilot-exam.ts:490-509`. Revoked keeps `copilot: true` by design (`lib/access/state.ts:157-176`) and then reads only this clinician's own sessions: profile, files and journals are withheld. Residual risk: the next caller that forgets the argument gets everything; the default should fail closed.
- Severity: S3 (latent)
- Fix sketch: make `capabilities` required in the type. Proof: the typecheck.
- Decision it came from: C210/C211 and the 26.x comment "an internal caller that did its own scoping".

### CLIN-20 · The copilot reads the oldest twelve sessions, not the latest
- Verdict: CONFIRMED
- Sources: code-05 B6
- Promise: T5
- Who is hurt and how: for a patient past twelve sessions, the copilot never sees anything recent. A clinician asking "what did we agree last week" gets an answer, with valid-looking citations, built only from sessions one to twelve.
- Evidence: `lib/ai/case-copilot.ts:268-277` `.orderBy(asc(sessions.createdAt)).limit(MAX_SESSIONS)` with `MAX_SESSIONS = 12` (`:59`). Each session is also cut to its first 220 segments in order (`:60`, `:293-297`), so the end of a long session is never read either. Compare `lib/ai/profile.ts:158-164`, which takes the newest eight and reverses them, the correct shape.
- Severity: S2
- Fix sketch: `orderBy(desc(createdAt)).limit(12)` then reverse for reading order, as profile.ts does. Proof: a thirteenth session's segment is citable.
- Decision it came from: none recorded; the ascending order predates the cap.

### CLIN-21 · Copilot citations can point at the wrong sentence
- Verdict: CONFIRMED
- Sources: code-05 B7
- Promise: T5 ("answers with the sentence it came from attached")
- Who is hurt and how: the copilot's prompt contains two numbering schemes that both look like `S2:14`. When the model cites a ref it read in the standing profile, the citation shown to the clinician is a different real sentence from a different session, presented as the verified source.
- Evidence: the profile numbers `S1..S8` over the newest eight sessions across every chart of the person (`lib/ai/profile.ts:140-196`, `MAX_SESSIONS = 8` at `:85`) and stores the refs with each section; the copilot pastes those sections with `Refs:` (`lib/ai/case-copilot.ts:480-484`) whenever `liveProfile` is allowed. The copilot's own index numbers `S1..S12` over this chart's oldest sessions (`:283-313`). `resolveCitations` (`:706-730`) resolves any ref present in its own index, so a profile ref that collides is accepted and the wrong segment attached.
- Severity: S2
- Fix sketch: key refs by session id (or a prefix per source, `P` for profile), and have `resolveCitations` resolve only refs from the copilot's own index namespace. Proof: a unit with a profile ref `S2:14` and a copilot index with a different `S2:14`, expecting no citation.
- Decision it came from: 9.x (profile refs) and the copilot index were built separately with the same key shape.

### CLIN-22 · In-room copilot answers show no source
- Verdict: CONFIRMED
- Sources: code-10 B10
- Promise: T5
- Who is hurt and how: in the live room the clinician sees the answer text with no citation and no "no source" badge. The citations are stored with the answer (`app/(app)/copilot/actions.ts:144-149`) and appear later in the full copilot chat, but not where the answer is read during the session.
- Evidence: `components/session/ask-panel.tsx:66-75` keeps only `result.answer?.content`; no `citation` reference in the file.
- Severity: S3
- Fix sketch: render `answer.citations` (quote and time) under each in-room answer, or a "no source" badge when empty. Proof: a render test.
- Decision it came from: 48.3 (the ask panel).

### CLIN-23 · "Prepare me, once per session" is bounded only in the browser
- Verdict: CONFIRMED
- Sources: code-10 S5
- Promise: none (cost)
- Who is hurt and how: the company. A reload re-offers it; and in a live session every question skips the quota anyway (`copilot/actions.ts:75-79`), so the only bound on in-room model spend is a React state flag.
- Evidence: `components/session/ask-panel.tsx:56,153-160` (`prepared` is `useState`); server has no per-session count.
- Severity: S4
- Fix sketch: count in-room questions per session server-side (C224's bound). Proof: a verifier asking N+1 times in one session.
- Decision it came from: C210 (in-room questions free) and C224.

### CLIN-24 · Copilot thread frozen to the first clinician
- Verdict: WRONG (not reachable today)
- Sources: code-02 S3
- Promise: T5
- Who is hurt and how: nobody today. The failure needs `patients.therapist_id` to change; grep finds no update of that column anywhere in `lib` or `app`. Session reassignment (`lib/data/recovery.ts:186-211`) moves a session, not the chart.
- Evidence: `lib/data/copilot.ts:31-38,47-66`; no writer of `patients.therapistId` after insert.
- Severity: S4
- Fix sketch: none now; revisit if charts ever move between clinicians.
- Decision it came from: none.

### CLIN-25 · A revoked clinician still reads the person's standing profile, timeline, homework and newest summary
- Verdict: CONFIRMED
- Sources: code-03 B (revocation does not reach the standing profile), code-07 B7
- Promise: P4 ("the patient decides who may read the history"), T5 (revocation)
- Who is hurt and how: after a patient revokes a clinician, that clinician's patient page still shows a machine summary built from every other clinician's sessions and notes, the observation timeline, all homework, and on the session page the latest summary another clinician wrote. The copilot withholds exactly this material for the same clinician, so the screen leaks what the copilot refuses.
- Evidence: `app/(app)/patients/[id]/documents/page.tsx:95-99` calls `profileFor`, `timelineFor`, `listHomework`, `homeworkTrend` with no capability check, while journals two lines up are gated on `patientFiles` (`:86-87`); `capabilitiesFor("revoked")` sets `liveProfile: false` (`lib/access/state.ts:167-176`); the profile is built from every chart of the person (`lib/ai/profile.ts:140-160`). `app/(app)/sessions/[id]/page.tsx:61-64` calls `latestSummary` with no grant check.
- Severity: S1 (privacy wall)
- Fix sketch: gate profile, timeline and homework on `access.capabilities.liveProfile` and the summary on a live grant, in the data functions (take an access argument) rather than the page. Proof: a revoked grant renders the empty states.
- Decision it came from: 9.1-9.5 (profile on the person) predate the four access states (7.7).

### CLIN-26 · Seeded copilot answers never render in the demo
- Verdict: CONFIRMED
- Sources: code-12 B1
- Promise: T5 (walk)
- Who is hurt and how: testers on the demo cast see each seeded copilot thread as a question with no answer, so the T5 walk starts from a broken-looking screen.
- Evidence: `scripts/seed-demo.ts:1146-1150` inserts `role 'assistant'`; the product reads only `therapist`, `copilot`, `correction` (`lib/data/copilot.ts:139,496`).
- Severity: S4
- Fix sketch: seed `role 'copilot'`. Proof: `verify:demo` counts rendered answers.
- Decision it came from: none.

## Crisis scanning and alerts

### CLIN-27 · The crisis filter silenced real disclosures ("he " inside "the ")
- Verdict: CONFIRMED, fixed on this branch (carried in: MAP "Confirmed by the coordinator" item 2)
- Sources: code-05 B4, code-05 H8, MAP item 2
- Promise: P5 adjacent; README safety invariant
- Who is hurt and how: until the fix ships, a patient who writes or says "The only way out is to kill myself" raises no alert, in a session, a journal or a check-in reply.
- Evidence: fix is commit `dbe66c6` (Latin suppression markers matched as whole words, `lib/crisis/fold.ts:94` `containsWords`). Re-run here under node 22 against the branch: `stillCounts` now ALERTS on "The thought of suicide will not leave me.", "Nothing matters. The only way out is to kill myself.", "Some days the urge to kill myself is strong.", "Sometimes the pain makes me want to die", "Another headache, I want to die", and still SUPPRESSES "My brother said he wants to kill himself". PRESENT markers keep substring matching (H8), which errs toward alerting.
- Severity: S1 until deployed
- Fix sketch: deploy the branch; production is still on the old matcher until then.
- Decision it came from: 35R (context suppression, C171).

### CLIN-28 · Check-in replies reach nobody, including crisis replies and "stop"
- Verdict: CONFIRMED (live only while the check-in channel is on; it ships off)
- Sources: code-05 B2, code-05 S2, code-14 S5
- Promise: P5 adjacent; unclaimed capability (MAP Unclaimed 5)
- Who is hurt and how: every check-in ends "Reply with the word stop and they end." A person who replies "stop" keeps receiving them; a person who replies "I want to die" to a message we sent unprompted reaches no human, sees nothing, and no alert is raised. If the handler were wired, a person with no clinician would be told "Your therapist has been notified and is here with you".
- Evidence: `handleReply` (`lib/checkins/receive.ts:59`) has no caller in `app` or `lib` (grep), and there is no inbound email or messaging route under `app/api` (listed: admin, copilot, cron, documents, ehr, hr, meetings, partner, patient, radar, revalidate, sessions, stripe, uploads). Check-ins are still sent by the cron (`app/api/cron/[job]/route.ts:346`) with the stop line appended (`lib/checkins/send.ts:124`, `messages.ts:2291`). The no-clinician wording is `lib/crisis/alerts.ts:505-508`, returned at `receive.ts:118-121` whatever `noClinician` is. The latent recipient choice orders by nullable `scheduledAt DESC` with no status filter (`receive.ts:172-181`), so a cancelled or future booking can be the one woken. The channel default is off (`lib/settings/defs.ts:664-665`); whether production has it on is a database question.
- Severity: S1 when the channel is on
- Fix sketch: until an inbound route exists, drop the "reply stop" line and add "replies are not read; for help now, press SOS or call {line}" to every check-in; keep the channel off. When wiring: fix the wording for `noClinician` and order by `COALESCE(started_at, scheduled_at) DESC NULLS LAST` over completed sessions. Proof: read `platform_settings.checkins.enabled` on production; a route test for the inbound handler.
- Decision it came from: 44.1/44.2 (C97) built the sender and the handler; the inbound channel (WhatsApp, pending Meta) was never built.

### CLIN-29 · The check-in "never the same message twice" rule never fires
- Verdict: CONFIRMED (proved by execution)
- Sources: code-05 B11
- Promise: none (44.1)
- Who is hurt and how: a person on check-ins gets the identical message twice in a row about one time in twelve, the exact failure 44.1 exists to prevent.
- Evidence: the stored body is `wording + "\n\n" + howToStop` (`lib/checkins/send.ts:124,147-152`), handed back as `lastBody` (`lib/data/checkins.ts:101`), and compared to the bare wording (`lib/checkins/wording.ts:68`). Ran `nextWording` 20,000 times with a stored body: repeat rate 0.084 (1 in 12, 12 wordings); with the bare wording: 0.
- Severity: S4
- Fix sketch: store the wording key or the bare wording, or strip the stop line before comparing. Proof: the same loop returns 0.
- Decision it came from: 44.1.

### CLIN-30 · Check-ins go to anyone who signed up, and the off switch has no door
- Verdict: PARTLY
- Sources: code-02 S9
- Promise: P2 adjacent
- Who is hurt and how: the candidate rule says "a claimed account" and argues that means the person agreed. In fact signing up creates a person of your own (`lib/data/claims.ts:99-106`), so every signed-up patient, including one who never had a session, is a candidate. The in-app switch to stop them lives on `/patient/messages`, which nothing links to (grep: only its own files import it). The unconsented-contacts case the comment worries about (people a clinician typed) is correctly excluded by the inner join.
- Evidence: `lib/data/checkins.ts:46-66` (inner join `patient_accounts`, no consent or session condition); `components/patient/checkin-switch.tsx` used only by `app/(patient)/patient/messages/page.tsx`. Channel default off (CLIN-28).
- Severity: S3
- Fix sketch: require at least one completed session, and link `/patient/messages` from the patient nav. Proof: a verifier counting candidates with no session.
- Decision it came from: 44.x and the C97 narrowing comment.

### CLIN-31 · Journal crisis alerts skip every open-ended grant holder
- Verdict: CONFIRMED
- Sources: code-03 B (alertGrantHolders)
- Promise: P5 adjacent; the home page's "risk language is scanned for ... alert written" claim (DOCS-digest 9)
- Who is hurt and how: a patient writes a journal entry with suicidal language. Their clinician holds an open grant (the default shape, and the only shape a claim creates), so the clinician is never told. Only holders of a 24-hour grant are alerted. Meanwhile the patient's own journal page tells them which therapists can read it.
- Evidence: `lib/data/journals.ts:166-175` filters `gte(historyGrants.expiresAt, now)`; open grants store `expiresAt: null` (`lib/data/grants.ts:376-379`; `applyClaimDecision` inserts `shape: "open"` with no expiry, `:557-566`); `NULL >= now` is not true. `isLiveGrant` treats null as live (`lib/access/state.ts:66-67`).
- Severity: S1
- Fix sketch: `or(isNull(expiresAt), gt(expiresAt, now))`, or reuse `isLiveGrant`. Proof: a journal write for a person with an open grant inserts one notification.
- Decision it came from: 26.7 / C123.

### CLIN-32 · The journal alert links to a page that does not exist
- Verdict: CONFIRMED
- Sources: code-03 B (actionUrl /people)
- Promise: P5 adjacent
- Who is hurt and how: a clinician who does receive the journal alert (24-hour grant holders only, CLIN-31) taps it and lands on a 404.
- Evidence: `lib/data/journals.ts:191` `actionUrl: /people/${personId}`; `app/(app)` has no `people` directory (listed: assistant, billing, bookings, connect, copilot, dashboard, earnings, notes, on-call, onboarding, patients, sessions, settings, support, switch-principal) and nothing rewrites `/people/`. The clinician route is `/patients/[id]` keyed by chart, not person.
- Severity: S2
- Fix sketch: resolve the holder's own chart id for the person and link `/patients/<chartId>/documents`. Proof: follow the link in a render test.
- Decision it came from: 26.7.

### CLIN-33 · "Before this session" risk history is the clinician's, not the patient's
- Verdict: CONFIRMED
- Sources: code-03 B (priorRiskFor)
- Promise: P5 adjacent
- Who is hurt and how: under a new alert, the clinician reads "Before this session" and sees the last five risk levels from any of their patients, presented as this patient's history (or a clean history for a patient who has one).
- Evidence: `lib/data/session-risk.ts:245-270` filters only `riskAssessments.therapistId = therapistId`, no patient or person condition, and reads every row for that clinician (no limit in SQL); called at `app/(app)/sessions/[id]/page.tsx:95-97`; rendered by `components/clinical/risk-assessment.tsx:156-173`.
- Severity: S2
- Fix sketch: filter by the session's `patient_id` (or the person across charts the clinician may read), order desc with a SQL limit. Proof: two patients with alerts, each page shows only its own.
- Decision it came from: 35.x ("has this happened before").

### CLIN-34 · The crisis re-delivery cron runs once a day, not every five minutes
- Verdict: CONFIRMED
- Sources: code-16 S14, code-16 vercel.json note, code-07 Stale 2, code-03 Stale (cron), MAP Stale 2, SIMULATION-digest (crisis retry)
- Promise: P5 adjacent; README "Scheduled jobs"
- Who is hurt and how: a crisis alert whose notification insert failed waits until 03:00 UTC for its retry, up to 24 hours; the README says every five minutes and the route's own comment says hourly. The same job is the backstop for the abandoned-patient sweep.
- Evidence: `vercel.json` `/api/cron/crisis` `0 3 * * *`; `README.md:350` "every 5 min"; `app/api/cron/[job]/route.ts:99-102` "An hour late is fine", `:120-124` "the single most safety-relevant scheduled job". Also found here: "delivery" is only an in-app `notifications` row (`lib/crisis/alerts.ts:405-417`, CLIN-35), so the retry retries a row insert, and a model-level "critical" arriving within ten minutes of a keyword "high" is deduplicated and only attaches its findings, leaving the level at "high" (`alerts.ts:365-377`, `lib/data/session-risk.ts:156-185` updates findings and source, not level).
- Severity: S2
- Fix sketch: schedule crisis at least every five minutes (Vercel allows it on the plan in use, to confirm), fix README; let a higher level update the deduplicated row's level. Proof: `vercel.json` diff; a unit on dedup with a higher level.
- Decision it came from: the Neon scale-to-zero cost argument in `route.ts:81-117`.

### CLIN-35 · A crisis alert is only a row in the clinician's in-app list
- Verdict: CONFIRMED
- Sources: code-05 S3
- Promise: P5 adjacent
- Who is hurt and how: a journal or session alert at 3am waits until the clinician next opens the app. No email, push or message is sent, and `delivered` means only that the row was written.
- Evidence: `lib/crisis/alerts.ts:398-412` and `:445-466` insert into `notifications` only; `lib/data/journals.ts:183-193` likewise. Grep for a clinician paging path on `kind: "crisis"` in `lib/notify`: none.
- Severity: S2
- Fix sketch: send crisis notifications through `notify()` on the clinician's channels (without the words), keep the row. Proof: `verify:notices` extended to crisis.
- Decision it came from: sprint 3 (alert seam) and the "never quote on a lock screen" rule.

### CLIN-36 · A risk suggestion card can be pushed off the room screen
- Verdict: CONFIRMED
- Sources: code-10 B9
- Promise: P5 adjacent
- Who is hurt and how: the copilot's risk card is documented as staying until dismissed, but three newer suggestions push it out of view and six delete it. The room's own crisis banner (from the transcript scan) is separate and does stay.
- Evidence: `components/session/copilot-toasts.tsx:28-30` (the promise), `:183` `[...fresh, ...current].slice(0, MAX_VISIBLE * 2)`, `:69` renders `slice(0, MAX_VISIBLE)` with no priority for `risk`.
- Severity: S3
- Fix sketch: sort risk cards first and never drop them in `mergeToasts`. Proof: a unit merging six suggestions over one risk card.
- Decision it came from: the toast redesign described in the file header.

## SOS (P5)

### CLIN-37 · The SOS button does nothing from a keyboard, and a shaky tap can miss
- Verdict: CONFIRMED
- Sources: code-10 B6
- Promise: P5 ("reachable, on top, and dials")
- Who is hurt and how: a person using a keyboard, switch control or screen reader focuses SOS and presses Enter or Space: nothing opens. A person whose finger moves even one pixel while pressing (a trembling hand) gets a "drag" and the sheet does not open either; the orb just moves.
- Evidence: `components/patient/sos-orb.tsx:141-160`: the sheet opens only in `onPointerUp` when `dragging` is false; there is no `onClick`, and a keyboard activation fires `click`, not pointer events. `onPointerMove` sets `dragging = true` on any move with the button down, no distance threshold (`:147-154`).
- Severity: S1 (the crisis button)
- Fix sketch: open on `onClick` (suppressed only after a real drag), and treat a move under about 10 px as a tap. Proof: a keyboard test (Enter opens the sheet) and a pointer test with a 3 px move.
- Decision it came from: the draggable orb (the position memory at `:95-112`).

### CLIN-38 · On the radar, the price sheet covers the SOS button
- Verdict: CONFIRMED
- Sources: code-10 B7, code-11 S (payment orb z-60), code-13 S (verify-rail z classes), code-10 H4 to H6
- Promise: P5
- Who is hurt and how: while a person looks at a clinician's price on the radar ("Pay {amount} and start now"), the crisis button is underneath the money screen. Inside the patient chrome everything money-related (payment orb and sheet at 50 to 65, the room at 50, the leave sheet at 60) does stay under SOS at 70, as the readers found.
- Evidence: `components/radar/booking-sheet.tsx:171-172` portals a `fixed inset-0 z-[100]` dialog to `body`; SOS is `z-[70]` (`sos-orb.tsx:162`), rendered on `/radar` (`app/(public)/radar/page.tsx:55`). The sheet is used by `public-radar.tsx`, `public-profile.tsx`, `radar-hero.tsx`, `radar-console.tsx`. `verify:rail` checks two class names in two files (`scripts/verify-rail.ts:1337-1345`), never the booking sheet, and cannot see a stacking context.
- Severity: S1
- Fix sketch: give SOS a layer above every dialog (for example `z-[300]`, portalled to body) or render an SOS button inside the booking sheet. Proof: a browser check on `/radar` with the sheet open that `elementFromPoint` at the orb's centre is the orb.
- Decision it came from: C235 expressed as z-index (the verify-rail comment), applied to the patient chrome only.

### CLIN-39 · SOS missing or blank on crash screens
- Verdict: PARTLY
- Sources: code-08 S14, code-08 H6
- Promise: P5
- Who is hurt and how: when the whole app crashes (`app/global-error.tsx`) there is no SOS at all. On a patient-area crash (`app/(patient)/error.tsx:60`) the orb is there but has no country or phone, so it shows the generic "call your local emergency number" sentence rather than a line. The reader's worry that it shows the wrong country is wrong: the orb has no default country (`sos-orb.tsx:125-138`).
- Evidence: `app/global-error.tsx` (57 lines) has no SOS, crisis or emergency reference; `error.tsx:60` `<SosOrb />`.
- Severity: S2
- Fix sketch: render the orb in `global-error.tsx`; pass `crisisCountryFor({ locale })` into the error-page orb. Proof: render both error pages.
- Decision it came from: C126 / the fix that kept the orb on `(patient)/error.tsx`.

### CLIN-40 · Any Arabic reader is given Egypt's crisis line
- Verdict: CONFIRMED
- Sources: code-05 S13
- Promise: P5
- Who is hurt and how: a person reading in Arabic on any public page (radar, profile, support, clinician page) with no known region gets Egypt's 105, which does not connect from Saudi Arabia, the Gulf or anywhere else.
- Evidence: `lib/crisis/line.ts:145-157` `if (locale?.startsWith("ar")) return "EG"` (comment: "Arabic is served in exactly one market"); callers `app/(public)/radar/page.tsx:55`, `app/support/[token]/page.tsx:50`, `app/(public)/t/[id]/page.tsx:69`. The file's own rule is "the wrong country's number is worse than none" (`:141-143`).
- Severity: S2
- Fix sketch: use the request's country (Vercel `x-vercel-ip-country`) before language, and fall back to the generic sentence rather than to EG. Proof: a unit with locale `ar` and country `SA` returns null.
- Decision it came from: C350 / 69.2 (Egypt 105).

## Anonymous sessions and the in-session report

### CLIN-41 · An anonymous session's record can never be found by the patient (task 117)
- Verdict: PARTLY
- Sources: code-03 S (task 117), code-05 promise note (task 117), THE-PLAN task 117
- Promise: P4 ("one record, however many therapists")
- Who is hurt and how: the part "no patient record" is not what the code does: a radar or link guest who types a name gets a chart and a person the moment they join (`lib/data/sessions.ts:843-884`, `ensurePersonForPatient` at `:879-884`), and the clinician's own new-session form refuses a session with no name (`app/(app)/sessions/actions.ts:103-105`). What does hold: that chart and person carry no email or phone (`joinByToken` inserts only the name, `:855-866`, although the radar booking stored `guestEmail` on the session, `:320`), and the email a patient gives when rating is written to `patients.email` only (`lib/data/feedback.ts:252-261`), never to `people`. Claim matching reads `people.email`/`people.phone` (`lib/data/people.ts:131-153`), so the patient can never find this record by signing up; only a clinician-issued invite reaches it. Every anonymous visit also makes a new person, so the AI profile starts empty each time.
- Evidence: as above; grep finds no `update(people)` that sets email or phone.
- Severity: S2
- Fix sketch: in `joinByToken` copy the session's `guestEmail` onto the chart and person; in `submitFeedback` write the email to the person when it has none. Then a later sign-up with that email is offered the record through the normal proven-handle claim. Proof: radar booking with an email, sign up with it, `suggestionsFor` returns the person.
- Decision it came from: C130 (honest guest copy), C121/C122 (claims only by proven handle).

### CLIN-42 · The in-session "tell us" report is silently dropped
- Verdict: CONFIRMED
- Sources: code-10 B4
- Promise: A5 adjacent; safety
- Who is hurt and how: a patient who reports their clinician from inside the live session (the "tell us" box) is shown "sent to us" and nothing is filed. Abuse reported at the moment it happens reaches nobody.
- Evidence: `components/join/patient-room.tsx:731-735` calls `reportSession({ token, kind: "abuse", ... })` with the room's `token`, which is the join token (the same prop feeds `stopRecording` and `setSessionMinimised`, both join-token actions, `:131,349`); it ignores the result and sets `sent`. `fileReport` looks the session up by `sessions.feedbackToken` (`lib/data/feedback.ts:344-353`), a different secret, and returns "This link is no longer valid." The only other caller (`components/feedback/rating-form.tsx:459`) passes the feedback token correctly.
- Severity: S1
- Fix sketch: a join-token report action that resolves with `resolveJoinToken` and files the same report; show the error when one comes back. Proof: submit from the room and count `session_reports` rows.
- Decision it came from: the two-token design (feedback token separate from join token, `feedback.ts:81-88`) after the room's report box was written.

### CLIN-43 · The feedback link falls back to the join token
- Verdict: HANDLED
- Sources: code-10 S13
- Promise: none
- Who is hurt and how: nobody in practice. `components/join/join-flow.tsx:217` links `/feedback/${feedbackToken ?? token}`, and the feedback page cannot resolve a join token; but every session creator mints a feedback token (`lib/data/sessions.ts:257,337`, `lib/data/scheduling.ts:462`) and `drizzle/0022_feedback_token.sql:22-24` backfilled old rows, so the fallback is dead code.
- Evidence: as above.
- Severity: S4
- Fix sketch: drop the fallback so a missing token shows an honest message rather than a dead link.
- Decision it came from: 0022 (two tokens).

## Around the clinical AI

### CLIN-44 · Consent and recording copy is outside the protected "safety strings"
- Verdict: CONFIRMED
- Sources: code-06 (lib/i18n/messages.ts notes: safety prefix list misses consent strings), code-06 promise P5 row
- Promise: T2, P5
- Who is hurt and how: the strings an admin can reword in one step without the safety rule (rewordable, never removable, no machine draft) are only those whose key starts `crisis.`, `consent.`, `recording.` or `risk.`. The actual join consent screen (`jconsent.*`), the room's recording notices (`room.recording`, `room.knowRecording`, `troom.consentFirst`, `proom.recording*`) and `feedback.emergency` do not start with those prefixes. Counted by execution: of 180 keys whose names mention consent, record, crisis, SOS, emergency or helpline, 102 are unprotected (some are unrelated "record" keys such as `precord.*`, but the consent screen and room notices are among them).
- Evidence: `lib/i18n/strings.ts:57` `SAFETY_PREFIXES = ["crisis.", "consent.", "recording.", "risk."]`; keys at `lib/i18n/messages.ts:1144-1152`, `2012-2016`, `3891-3892`.
- Severity: S3
- Fix sketch: add `jconsent.`, `proom.recording`, `troom.consent`, `room.recording`, `room.knowRecording`, `feedback.emergency` (or rename the keys under a protected prefix). Proof: `isSafetyKey("jconsent.recordDetail")` is true.
- Decision it came from: 21.7 (prefix list chosen so new strings are protected automatically; the consent screen's keys were named later under another prefix).

### CLIN-45 · The note-grounding eval scores the filter, and one fixture contradicts itself
- Verdict: CONFIRMED (proved by execution)
- Sources: code-16 S1, code-16 B1, code-16 S2
- Promise: T1 ("written from what was actually said")
- Who is hurt and how: the founders. The "another patient's facts leak into a note" number quoted for T1 is measured mostly on facts that never reach the model, and one Arabic case marks faithful notes as fabrications.
- Evidence: ran `factsForPrompt` (`lib/clinical/context.ts:66`) over `evals/cases.ts` exactly as `evals/suites/grounding.ts:44-68` does: 4 of 27 poison facts reach the model; 5 of 12 contradiction cases have their fact filtered out (sleep-and-work, grief-and-return-to-work, exams-arabic, panic-on-the-metro, chronic-pain), so they pass for free. `evals/cases/long-session.ts:137` lists `المستشفى` as never said while `:425` says it; `:208` forbids `المعادي` and `لوحدها`, said at `:232` and `:400`. The substring matching concern (S2) was not re-run here.
- Severity: S3
- Fix sketch: make poison and contradiction facts of kinds the filter passes (verified, non-diagnosis, allowed domains), assert in `tests/evals.test.ts` that every trap reaches the prompt and that no trap term occurs in its own transcript. Proof: the same count returns 27 of 27 and 12 of 12.
- Decision it came from: C167, C168, C170 (the filter) landed after the fixtures were written.

### CLIN-46 · The end-to-end "patient's name is never sent to the model" check may read the wrong request
- Verdict: UNTESTABLE HERE
- Sources: code-16 S4
- Promise: README invariant (de-identified note prompt)
- Who is hurt and how: if the note prompt did carry the name, this test could still pass, because it inspects the first chat request and `finishSession` calls the risk classifier and the diariser before the note (`lib/session-finish.ts`, steps risk then note; `lib/ai/notes.ts:386-398`).
- Evidence: `tests/e2e.test.ts:357-363` reads `mock.state.chatRequests[0]`; the mock records every chat call in order (`tests/mock-openai.ts:67`).
- Severity: S3
- Fix sketch: select the request by its system prompt. To settle: run `test:e2e` on a branch with a print of each request's first line and see which is at index 0.
- Decision it came from: none.

### CLIN-47 · The general assistant sends every patient's full name to the model provider
- Verdict: CONFIRMED
- Sources: code-05 S11
- Promise: README "patient never converses with a model" is not this; the de-identification policy of `lib/ai/notes.ts:81-89` is
- Who is hurt and how: every question a clinician asks the general assistant sends the names of their whole roster to OpenAI, while the note writer is careful never to send one name. No patient is told names go to a model provider.
- Evidence: `lib/ai/assistant.ts:169-183` builds `- ${row.name}, last seen ...` for every roster row into the prompt.
- Severity: S2
- Fix sketch: send chart ids or initials and map them back in the answer (as C59 "names to ids" already did elsewhere). Proof: a mock-provider test asserting no roster name in the request.
- Decision it came from: C58 (general copilot separate) and the "Names and dates only" block.

### CLIN-48 · Copilot voice and read-aloud spend is invisible and unmetered
- Verdict: PARTLY
- Sources: code-07 S5, code-07 S6
- Promise: none (cost)
- Who is hurt and how: the company. Text-to-speech on the copilot and documents has no rate limit and writes no cost row. Dictation (`copilot/voice`) works, contrary to the reader's worry: `sessionId: ""` fails the uuid insert inside `logUsage`, which catches and logs (`lib/ai/client.ts:158-180`), so the request succeeds and only its cost row is lost.
- Evidence: `app/api/copilot/voice/route.ts:38-45` (`sessionId: ""`), `aiRequestLogs.sessionId` is a uuid (`lib/db/schema.ts:1690`); `app/api/copilot/speak/route.ts` has no `logUsage` or `consume` call (grep).
- Severity: S4
- Fix sketch: pass `null` for the session id, and add `logUsage` plus a limiter to both speak routes. Proof: `ai_request_logs` gains a row per dictation.
- Decision it came from: none recorded.
