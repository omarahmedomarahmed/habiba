# Clinical safety and the AI: audit

Scope actually read: `lib/ai/*` (client.ts, notes.ts, transcribe.ts, diarise.ts, copilot.ts,
case-copilot.ts, profile.ts, diagnoses.ts, assistant.ts), `lib/crisis/*` (alerts.ts,
context.ts, fold.ts, level.ts, line.ts), `lib/data/facts.ts`, `journals.ts`,
`session-risk.ts`, `diagnoses.ts`, `assessments.ts`, `instrument-seeds.ts`,
`lib/audio/recorder.ts`, `components/session/session-room.tsx` and siblings,
`app/(room)/**`, `app/api/sessions/[id]/transcribe/route.ts`,
`app/api/meetings/transcript/[sessionId]/route.ts`, `lib/content/defaults.ts` and
`defaults-ar.ts`, `lib/i18n/messages.ts`, `scripts/verify-claims.ts`,
`scripts/verify-sprint47.ts`, `scripts/verify-sprint48.ts`, `tests/safety.test.ts`,
`vercel.json`, `README.md`, `HAZARDS.md`, and the relevant slices of `PLAN.md`.

Each finding names the file and line I am reading, and where I am reasoning about a gap I
have not run live, I say so and mark it a hypothesis rather than a result.

---

## 1. The off-record toggle does not mute the recorder. Declined or paused consent is still transcribed, stored, and crisis-scanned.

This is the sharpest thing I found. The room's "off record" indicator and the actual audio
pipeline are two different pieces of state, and nothing keeps them in sync at the moment
that matters most: the start of a session where the patient already said no.

`components/session/session-room.tsx:81` sets `offRecord` from
`props.recordingConsent === "declined"`, so the UI (amber dot, muted mic icon, the clock bar,
the "off record" label) correctly shows a declined session as off record from the first
paint. But the object that actually captures audio is a `SessionRecorder`
(`lib/audio/recorder.ts:63`, `private muted = false;`), and its constructor takes no muted
option. `startLocalRecorder` (`session-room.tsx:183-215`) and `startRemoteRecorder`
(`:217-232`) both construct a fresh, unmuted recorder every time, and the effect that starts
them (`:267-271`) fires on `live` becoming true with no reference to `offRecord` at all. The
only place `setMuted` is ever called is `toggleOffRecord` (`:370-378`), which runs only when
a clinician manually presses the button *during* the session.

So: a patient declines consent at join. The therapist opens the room and presses Start. The
banner says off record. The recorder is not muted. `push()` in `lib/audio/recorder.ts:184`
buffers real audio, `flush()` encodes it to WAV and calls `onChunk`, `uploadChunk`
(`session-room.tsx:120-179`) POSTs it to `/api/sessions/[id]/transcribe`, which calls
`transcribeChunk` and `appendTranscriptSegment` (`lib/data/transcript.ts:53-122`) with no
consent check anywhere in that path (confirmed by reading the whole route,
`app/api/sessions/[id]/transcribe/route.ts:39-246`, and the whole writer,
`lib/data/transcript.ts`: neither references `recordingConsent` or `recordingPausedAt`).
The segment is permanently stored, run through `scanForCrisisLanguage`, and can raise a
crisis alert, on a session the patient was told would not be recorded.

The same gap reappears on a **reload of an already-live session**: `RoomPage`
(`app/(room)/sessions/[id]/room/page.tsx:72-94`) passes only `session.recordingConsent`
(the original join-time answer), never `recordingPausedAt` (the field a mid-session "off
record" tap actually sets). So a therapist who declared off record mid-session, then
refreshes the tab, loses that state entirely: `offRecord` re-derives from the *original*
consent answer on remount, brand-new unmuted recorders start, and the manually-declared
pause is silently gone.

For a video session there is a second, unmuted signal too: `VideoCall`'s `micMuted` effect
(`components/session/video-call.tsx:146-149`) only calls `setLocalAudio` when `micMuted`
*changes*, so it does nothing for an initially-true value if the Daily call has not joined
yet when the effect first runs. But this does not rescue the finding: `startRemoteRecorder`
records the **patient's** incoming track directly (`session-room.tsx:217-232`), which has
nothing to do with the therapist's outgoing mic state, and is exactly as unmuted-by-default
as the local one. In-person sessions have no video call at all, so this second signal never
applies there.

Compare this to the one place in the codebase that gets it right:
`app/api/meetings/transcript/[sessionId]/route.ts:103` refuses to process any audio unless
`recordingConsent === "granted" && !recordingPausedAt && !botLeftAt`, checked server-side, on
every payload. The external-meeting-bot path has a real gate. The primary, same-origin,
in-app recording path, which is how the large majority of sessions are presumably recorded,
has none.

| Field | Detail |
|---|---|
| What | A session that starts (or resumes after a reload) with recording declined or paused still has its real audio captured, uploaded, transcribed, permanently stored, and crisis-scanned, because the recorder defaults to unmuted and nothing threads the declined/paused state into it; only a manual in-session button press ever mutes it, and a page reload loses even that |
| Where | `components/session/session-room.tsx:81`, `:183-232`, `:267-271`, `:370-378`; `lib/audio/recorder.ts:63`, `:134-142`, `:184-206`; `app/(room)/sessions/[id]/room/page.tsx:72-94` (no `recordingPausedAt` passed); `app/api/sessions/[id]/transcribe/route.ts:39-246` and `lib/data/transcript.ts:53-122` (no server-side consent check at all, contrast `app/api/meetings/transcript/[sessionId]/route.ts:103`) |
| Who is harmed | The patient who declined or withdrew recording. Their words are captured, sent to a third-party transcription model, stored as a permanent `transcript_segments` row, and scanned for crisis language, under a UI that told them and their clinician it was off. A patient who withdrew consent specifically because of what they were about to say is the worst case this reaches |
| Severity | blocker. This is a live, structural gap in the exact promise §7 and C133 are built around ("declining consent still admits them to the session; the bot simply does not transcribe"), on the one recording path (in-app, same-origin) that is not the meeting-bot exception the plan already worried about |
| Already known? | C133 (sprint 41, ruled) is about the meeting-bot path only and is correctly enforced there. C211/48.4 (ruled, sprint 48) is about what the *copilot* reads, not about whether the *recorder* itself honours consent; its own verifier (`scripts/verify-sprint48.ts`) never touches `lib/audio/recorder.ts` or `session-room.tsx`. I searched PLAN.md for "setMuted", "offRecord" and "recordingPausedAt" together and found nothing addressing this specific gap. 48.10 (unbuilt: "the patient's own off-record button... Audio stops") is a *different*, not-yet-built feature and does not claim the existing clinician-side toggle already works this way. New |

---

## 2. Invariant 11 is only half built: the copilot's documents and standing profile are never bounded by `startedAt`, only the transcript and journals are.

C211's ruling is explicit: "the copilot reads the record as of `startedAt` and nothing after
it... One bound, no branch." Reading `lib/ai/case-copilot.ts` end to end, that is true of two
of the four things assembled into the prompt and false of the other two.

`askPatientCopilot` (`case-copilot.ts:454-493`) computes `before = opts.liveSince ?? null`
and threads it into `buildPatientContext(opts.patientId, before)` (`:491`, bound applied at
`:248-251`) and `journalsFor(opts.patientId, opts.capabilities, before)` (`:493`, bound
applied inside `journalContext` at `lib/data/journals.ts:269-271`). Both correctly exclude
anything created at or after the session's `startedAt`.

But two lines above and below it:

```
const documents = await documentsFor(opts.patientId, opts.capabilities);       // case-copilot.ts:492
const standingProfile = await profileFor(opts.patientId, opts.capabilities);   // case-copilot.ts:494
```

Neither call passes `before`. `documentsFor` (`case-copilot.ts:330-359`) does not even
*accept* a time parameter, and it calls `documentContext(row.personId)`
(`lib/data/documents.ts:370-373`), whose only option is `maxChars`. There is no `before` or
`createdAt` filter anywhere in that query (`lib/data/documents.ts:376-389`): it selects every
chunk of every document the person has, ordered by ordinal and sequence, full stop.
`profileFor` (`case-copilot.ts:413-450`) has the same shape and reads whatever
`personProfiles` currently holds for the person, again with no time bound, and by its own
comment is "built *from* the documents" so it inherits the same gap on top of its own.

This is a real path, not a theoretical one: a document can be added to a person's record
(uploaded by the patient, or by a clinician) while a session with a different, or the same,
clinician is live. Sprint 48's own accept criterion asks for a copilot that "answers about the
past" and refuses to answer about "what the patient just said" *in the room*, but nothing
stops it answering, mid-session, from a document somebody uploaded four minutes ago, or from
a standing profile regenerated in the background after the room opened.

The verifier that is supposed to prove this bound confirms the gap rather than closing it.
`scripts/verify-sprint48.ts:217-224` reads `lib/ai/case-copilot.ts` as text and asserts that
`liveSince` exists and is threaded into `buildPatientContext`, and its own comment says
exactly what it checked: *"one parameter, threaded through the transcript and the
journals."* Documents and the standing profile are never mentioned. This is the pattern the
brief asks me to watch for: a guard that proves the shape of the rule on the two sources
somebody remembered to wire it into, and reports the invariant closed.

| Field | Detail |
|---|---|
| What | The in-room copilot's document context and standing-profile context are not bounded by the session's `startedAt`, unlike its transcript and journal context, so a document uploaded or a profile regenerated after the room opens is immediately visible to a "records as of the start of the session" panel |
| Where | `lib/ai/case-copilot.ts:492` and `:494` (no `before` passed), `:330-359` (`documentsFor`, no time parameter in the signature at all), `:413-450` (`profileFor`, same gap); `lib/data/documents.ts:370-389` (`documentContext`, no time filter in the query or the `opts` type) |
| Who is harmed | The patient whose consent state (declined or withdrawn) is the whole reason this bound exists. A copilot that is supposed to know "only what came before this session" can, through a document or the standing profile, see material from during the session, which is precisely the side door C211's own text warns about for journals ("the live-session reading C211 forbids arriving through a side door") but did not close for documents |
| Severity | major. Narrower in practice than finding 1 (needs a document or profile change mid-session to matter), but it is a direct, code-verified gap in a ruling the plan states is closed with "no branch" |
| Already known? | C211 (ruled, sprint 48) claims this is done. `scripts/verify-sprint48.ts` proves only the transcript and journal halves, and its own comment names exactly those two, so the gap in documents and profile was never asserted against and never caught. This is the "ruling exists but was never fully built" case the brief asks me to distinguish from a wrong ruling |

---

## 3. A draft, unapproved note is included in full in the patient's own record export, with no approval check anywhere in the path.

`lib/data/export.ts` builds the object served by `openExport(token)` (`:273` onward, the
function a patient's emailed export link resolves to) and rendered by `renderExportHtml`
(`:624` onward). The session row selects `noteContent`, `noteStatus`, `noteApprovedAt` and
`noteApprovedBy` together (`:373-378`), and then:

```
note: row.noteContent ?? null,                                          // :537
...
noteSigned: row.noteStatus === "approved" ? row.noteApprovedAt : null,  // :552
signedBy: row.noteApprovedBy ? (signerOf.get(row.noteApprovedBy) ?? null) : null, // :554
```

Only the *signed* timestamp and the *signer's* name are conditioned on approval. The note
**content itself is not**. In the renderer, `session.note` is passed straight into
`noteSection(session.note, session.noteLanguage)` (`:666-673`) unconditionally; the only
thing that changes for an unsigned note is that the "note signed {date}" caption
(`:659`) does not appear. The full SOAP text, summary, observations and impressions of a
draft a clinician has not yet reviewed, edited, or approved, still with their name on it as
the author, is emailed to the patient (or to whoever they exported it to) indistinguishable
in substance from an approved one.

I searched for anything downstream that gates on `noteStatus` before this point and found
nothing: no test, no verifier (`grep` across `tests/` and `scripts/verify-sprint*.ts` for
`openExport`, `requestPatientExport`, `requestOwnExport` and `noteContent` together returns
nothing but a reference from `verify-principals.ts`, which checks the actor doing the export,
not the approval state of what it returns).

This is adjacent to, but distinct from, `audit/01-patient.md` finding 1a, which is about
whether a patient should see the note and transcript at all under Invariant 5 and §3f. That
finding stands regardless of this one. Mine is narrower and orthogonal: even accepting that
sprint 26.9 deliberately puts a patient's own **approved** notes in their export, nothing
stops an **unapproved** one going out too, which the product's own design language
(§7, "a note is a draft with the clinician's name on it until approved"; sprint 55.8, "note
delivery... never a draft, never model output nobody signed") says should never happen on any
surface.

| Field | Detail |
|---|---|
| What | `openExport`/`renderExportHtml` include a session's clinical note content in the patient's emailed record extract regardless of `sessionNotes.status`, so an unapproved draft note reaches the patient exactly as an approved one does, differing only by a missing "signed" caption |
| Where | `lib/data/export.ts:373-378` (both statuses selected), `:537` (`note` unconditioned), `:552-554` (only the caption and signer name are conditioned), `:659-673` (`renderExportHtml`, note rendered with no status check) |
| Who is harmed | The patient, who receives (and may forward, print or hand to a new therapist, a solicitor, or an employer per C127) a clinician's un-reviewed draft, phrased as though it were their finished clinical record; and the clinician, whose name sits on text they have not signed off, outside the workflow that is supposed to make every export "a record extract" backed by "the licence of whoever signed it" (26.9) |
| Severity | blocker. This is exactly the class of leak item 7 in the brief asks for, on the one surface (an emailed, forwardable export) where the damage cannot be recalled once sent |
| Already known? | PLAN.md C127/C128/C143 govern the export's honesty about what it is (an extract, not a certificate) and its delivery channel, and 26.9's own accept criterion lists "every approved note" as what belongs in the extract, which this contradicts. None of those concerns, nor 47.3/C212 (which added `noteProvenance` to the export, also present here unconditioned), address the approval gate specifically. New |

---

## 4. Invariant 12 (a journal may be cited, never concluded from) is enforced only at the structured evidence-layer write path. The free-text copilot answer, which reads the same journal text, has no equivalent structural bound.

`lib/data/facts.ts:127-160` is a genuinely good piece of engineering: `recordFact` refuses,
in application code *and* a database CHECK (`0068_journal_inference.sql`), to write a
`diagnosis` or `risk` domain fact whose evidence is a journal. The comment is explicit about
why a prompt-level bound is not enough: *"A future prompt change, a model swap, a jailbreak
or a well-meaning tweak all lift a prompt-level bound and none of them can lift this one."*

That protection covers exactly one surface: the structured `patient_clinical_facts` table,
which feeds notes and the evidence screen (`lib/ai/notes.ts` never references journals at
all, confirmed by grep, so the note-generation path is clean here).

It does not cover `askPatientCopilot` (`lib/ai/case-copilot.ts`). `journalsFor`
(`:369-387`) reads raw journal bodies and `askPatientCopilot` (`:570-572`) hands them
straight into the chat prompt: *"The patient's own journals, in their words. Attribute
anything you use to its date..."*. The only thing telling the model not to draw a diagnosis
or a risk level from that material is the general system instruction, "You do not diagnose
and you do not make decisions" (`:74`), and the citation machinery
(`resolveCitations`, `:663-689`) only checks that a `[S2:14]`-style reference resolves to a
real transcript segment; it does not, and structurally cannot, inspect whether the model's
free-text `answer` contains a diagnosis- or risk-shaped sentence grounded in a journal
quote. There is no equivalent of `CONCLUSION_DOMAINS` or `JournalInferenceError`
(`lib/data/facts.ts:127-137`) anywhere between the model's response and the clinician's
screen in `case-copilot.ts`.

So a clinician can ask the copilot something like "does anything in their journal suggest a
diagnosis" and the only thing stopping an answer is the model choosing to follow an
instruction it is free to ignore, exactly the failure mode C214's own writeup says a
database-level bound exists to survive. Whatever the model returns is stored verbatim in
`copilot_messages` (`app/(app)/copilot/actions.ts:144-151`) and is part of the record a
future clinician with "old chat" access reads (`lib/access/state.ts:44`, "never taken
away").

| Field | Detail |
|---|---|
| What | The bound C214 states must live in the evidence layer, not a prompt, is only implemented for the structured facts table (`recordFact`). The case-copilot chat surface reads the same raw journal text and relies solely on a general system-prompt instruction not to diagnose or conclude, with no structural check on the model's free-text answer |
| Where | `lib/data/facts.ts:127-160` (the real protection, scoped to `recordFact`); `lib/ai/case-copilot.ts:62-83` (`SYSTEM_PROMPT`, prompt-only), `:369-387` (`journalsFor`), `:570-572` (raw journal text injected into the prompt), `:606-634` (the model's `answer` is used and stored as-is, with no domain check) |
| Who is harmed | The patient whose journal produces the anchoring conclusion C214's own comment describes: "the first therapist that person ever meets is handed a conclusion drawn from a stranger's diary by a machine," specifically through the chat surface rather than the notes surface, which is the one the plan actually reasoned about and protected |
| Severity | major. The structured-facts protection is real and I do not want to understate it; this is a gap in a *second* surface reading the same sensitive material, not an absence of any protection at all |
| Already known? | C214 is ruled and built (`scripts/verify-sprint47.ts` proves the `recordFact` refusal against a planted journal). Its verifier never touches `case-copilot.ts` or `askPatientCopilot`, and PLAN.md's own text for C142 (sprint 26, "journals reach the copilot... incomplete until sprint 33") only ever discusses the citation *mechanism*, not the conclusion bound, for this exact code path. New, and specifically a gap the ruling's own stated reasoning (prompt bounds are not safe) should have flagged for itself |

---

## 5. Invariant 14's checker never reads the strings most of the app actually renders. Two live sentences match its own banned patterns and ship unflagged.

`scripts/verify-claims.ts` is a well-built checker: proximity-scoped, controlled with planted
offenders, and it explicitly closes exactly this class of gap for one of its other rules (the
subscription-denial check, `:284-310`, whose own control at `:305-310` exists *because* "the
first version of this file read only `DEFAULT_PAGES`", which is my finding, in miniature,
about a different rule in the same file).

But `scan(EN, "EN")` and `scan(AR, "AR")` (`:193-194`), which run `promisesAPerson` (C275,
Invariant 14) and `claimsPerfection`, are called only on `harvest(DEFAULT_PAGES, "en")` and
`harvest(DEFAULT_PAGES_AR, "ar")` (`:166-167`). `DICTIONARY_STRINGS`
(`:284-286`, built from `lib/i18n/messages.ts`'s `DICTIONARIES`, over 2,000 strings) is only
ever passed to the subscription-denial and monthly-mention checks (`:288-322`). The two
rules tied directly to Invariant 14 never see a single string from the dictionary, which is
the file that actually renders most of the live app's UI copy, independent of the CMS.

Two real, currently-shipped strings in `lib/i18n/messages.ts` match the exact regexes
`verify-claims.ts` itself uses to forbid this class of sentence:

- `"prating.stillWriting"` (`lib/i18n/messages.ts:940`), shown to a **patient** waiting on
  their summary: *"{name} is still writing up the session. Your summary will arrive by email
  as soon as it is approved, usually within the hour."* This promises how fast a person (the
  therapist, `{name}`) will finish and deliver something to the patient. It would not trip
  `A_PERSON` as written (the checker's word list is `therapist|clinician|counsell?or|
  somebody|someone|answer|reply|respond|reach`, and `{name}` is a placeholder, not a literal
  match) even if it were in the scanned corpus, which it is not.
- `"trad.bodyOff"` (`lib/i18n/messages.ts:2039`), shown to a **therapist** deciding whether
  to go on the on-demand radar: *"Go on call between appointments. Someone who needs help now
  finds you, pays you, and you are in the room in under a minute."* This one **does** match
  both halves of the checker's own rule (`A_PERSON` on "Someone", `A_DURATION` on "in under a
  minute") and would fail `verify:claims` today if the harvester reached it.

| Field | Detail |
|---|---|
| What | `verify-claims.ts`'s response-time and absolute-performance checks (Invariant 14 / C275) only scan `lib/content/defaults.ts` and `defaults-ar.ts`, never `lib/i18n/messages.ts`, even though the same file already fixed this exact gap for a different rule in the same run. Two live dictionary strings promise how fast a person answers, one of which matches the checker's own regex outright |
| Where | `scripts/verify-claims.ts:166-167` (harvester scope), `:193-194` (the two calls that matter never see `DICTIONARY_STRINGS`), contrast `:288` (`ALL_COPY` including the dictionary, used only by the subscription rule); `lib/i18n/messages.ts:940` (`prating.stillWriting`), `:2039` (`trad.bodyOff`) |
| Who is harmed | A patient reading `prating.stillWriting` right after a session, who is told their summary will arrive "usually within the hour," a promise about a person's turnaround with no operational mechanism I could find enforcing it; and, per C275's own stated concern, anyone reading `trad.bodyOff`'s framing of the radar as a service where "someone who needs help now... is in the room in under a minute," which is precisely the shape of claim C275 was written to ban |
| Severity | major. `verify:claims` is a real, working gate for the corpus it reads; this is the exact "check that passes by measuring the wrong thing" pattern named in the brief, on the invariant the brief asked me to find a fifth violation of |
| Already known? | C275 (ruled, sprint 57) and Invariant 14 are about the underlying rule, which the four page-default claims removed in sprint 57 correctly satisfy. Nothing in PLAN.md addresses the checker's dictionary coverage for these two specific rules (only for the unrelated subscription rule, at C291/sprint 57). New |

---

## 6. The crisis-alert retry job is documented at "every 5 min" and configured to run once a day.

`README.md:211` states plainly: *"`/api/cron/crisis` | every 5 min | Re-delivers crisis
alerts whose notification failed. The alert is written before anyone is notified."*
`vercel.json:2-5` schedules it `"0 3 * * *"`, once a day at 03:00 UTC. `billing` is likewise
documented as "every 30 min" (`README.md:212`) and configured `"5 3 * * *"`, also once a day.

The write-before-notify design (`lib/crisis/alerts.ts:238-311`) is real and correct: the
`riskAssessments` row is inserted as `pending` before the `notifications` insert is
attempted, and flipped to `delivered` only after. If that `notifications` insert throws (a
transient DB error, a pool exhaustion moment, anything), the alert sits `pending` and is
caught only by `sweepUndeliveredAlerts` (`:316-350`), invoked exclusively by the `crisis` cron
job (`app/api/cron/[job]/route.ts:126`). The code's own extensive comment
(`app/api/cron/[job]/route.ts:30-118`) explains the move to once daily was a deliberate,
reasoned cost decision (Neon bills for wake time, not work done), and separately argues the
*time-critical* piece (a patient waiting in an empty room) was moved to a client poll instead.
That argument is not made for the crisis-alert retry specifically; the file simply calls it
"a backstop" (`:104`) without discussing how long a clinician could go unnotified of a
detected risk disclosure if the first attempt silently fails.

Under the current schedule, a notification-insert failure at 03:01 UTC is not retried until
roughly 03:00 UTC the next day, which is very different from "every 5 min," and is a long
window for the one job the codebase itself calls "the single most safety-relevant scheduled
job in the system" (`app/api/cron/[job]/route.ts:124`).

| Field | Detail |
|---|---|
| What | The crisis-alert notification retry cron is documented as running every 5 minutes and is actually configured to run once a day, so a failed initial notification for a detected risk disclosure could go unretried for close to 24 hours rather than 5 minutes |
| Where | `README.md:211-212` (documented schedule); `vercel.json:2-9` (actual schedule, `"0 3 * * *"` and `"5 3 * * *"`); `app/api/cron/[job]/route.ts:126-127` (the only caller of `sweepUndeliveredAlerts`); `lib/crisis/alerts.ts:238-311` (the write-before-notify mechanism this cron is the backstop for) |
| Who is harmed | A patient whose crisis disclosure triggered a keyword match, where the first notification attempt to their therapist failed for any transient reason. The alert is safely persisted (the marketing claim about write-before-notify holds), but the promised prompt re-delivery does not, for up to a day |
| Severity | major. I am not calling this a blocker because the primary path (successful notification insert) is unaffected and the failure mode requires the initial insert to fail, which the code does not suggest is common; but the gap between documented and actual behaviour on the platform's single most safety-relevant job is exactly the kind of drift this audit exists to catch |
| Already known? | I found no PLAN.md concern discussing this specific documentation/configuration mismatch, or the safety implication of the daily cadence for notification retries specifically (the file's own comments discuss cost and the room-abandonment case, not this one). New |

---

## 7. Only the United States has a configured crisis line. Egypt, named repeatedly as the product's first market, has none.

`lib/crisis/line.ts:44-46`: `CRISIS_LINES` has exactly one entry, `US`. The file's own
comment (`:16-17`) names Egypt's real numbers ("Egypt's ambulance is 123 and its police 122")
and explains why they are not in the table: the author did not want to enter a number from
memory without it being "checked by a person." That is an honest, self-flagged gap
(`⚠️ Incomplete until the lines are configured`, `:23`), not a hidden one, and I want to be
fair about that. But the product's own copy and PLAN.md describe Egypt as the first market
repeatedly (C118, "this product's first market is Egypt"; C103; C154's "an Egyptian patient
seeing a clinician registered in the United States is the ordinary case on this product, not
an edge of it"), and the crisis line is exactly the surface where "first market" should mean
something. Today, an Egyptian patient in crisis, reached via `patientFacingCrisisMessage`
(`lib/crisis/alerts.ts:357-379`) or `crisisLine`/`lineForNumber` (`lib/crisis/line.ts:55-99`)
anywhere in the product, gets only "call your local emergency number," never a dialable
number, even though the developers plainly know what it is.

| Field | Detail |
|---|---|
| What | No Egyptian crisis line is configured anywhere in the product, despite Egypt being named repeatedly as the platform's first and primary market; an Egyptian patient in crisis is always shown the generic "call your local emergency number" message rather than a number |
| Where | `lib/crisis/line.ts:16-17` (Egypt's numbers named in a comment, not entered), `:44-46` (`CRISIS_LINES`, one entry), `:55-58` (`crisisLine`, returns null for Egypt), `lib/crisis/alerts.ts:357-379` (`patientFacingCrisisMessage`, falls back to the generic sentence) |
| Who is harmed | An Egyptian patient in acute crisis, in the market this product exists to serve first, who receives a true but non-specific instruction instead of an actual number they could dial immediately |
| Severity | major. I am not marking this a blocker because the fallback message is honest and still actionable ("call your local emergency number" is true everywhere), and the gap is self-documented rather than silently wrong, but it is a live, unresolved defect in the flagship market at a launch-relevant moment |
| Already known? | This is the exact situation C98/C125 already ruled on in general ("we never invent a number... where there is no verified line the copy says your local emergency number") and the code correctly implements that ruling's letter. What is new here is only the observation that, this far into build-out, with Egypt named as the first market repeatedly elsewhere in the same plan, the one entry that would matter most has still never been added. Not a new defect in the code's own terms, but worth surfacing given how much of the rest of the plan assumes Egypt is live |

---

## 8. The crisis phrase list has no coverage for Arabic written in Latin script (Arabizi), which is how a large share of Egyptian informal typing, including journals, actually happens.

`lib/crisis/alerts.ts:54-202` (`CRISIS_PHRASES`) contains English phrases and Arabic-script
phrases, and the fold/normalisation machinery (`lib/crisis/fold.ts`) is built to handle
diacritics and alternate Arabic letter forms within Arabic script. I read the full list and
found zero entries in transliterated Arabic (for example "3ayez amoot", "mesh 2ader akammel
hayati", using digits for the letters Arabic keyboards lack on a Latin layout), which is a
widely used, informal register for typed Arabic across Egypt, especially in exactly the
context C123 is written for: a patient typing a journal entry on their phone at 3am, where
the default keyboard and the fastest way to type is frequently Latin script with Arabic
grammar and vocabulary ("Franco-Arabic" or "Arabizi"). `fold()` only operates on Arabic
Unicode code points (`lib/crisis/fold.ts:40,52-59`) and would not normalise or match a
Latin-script rendering of the same words at all; there is no separate transliteration table
or mapping anywhere in `lib/crisis/`.

I want to be precise about what I can and cannot claim here. That the phrase list contains no
such entries is a direct fact from reading `CRISIS_PHRASES`, not a hypothesis. What I could
not verify (see the closing section) is how often this register actually appears in this
product's real typed journals versus transcribed speech, and what Whisper (the transcription
model behind spoken sessions) tends to output for code-switched or Arabizi speech, since I did
not run a live transcription. For **typed** journal entries specifically, the exposure is
direct: `writeJournal` (`lib/data/journals.ts:86-142`) scans the raw typed `body` through
`scanForCrisisLanguage` with no transliteration step, so an Arabizi crisis disclosure typed
into a journal would not match any phrase in the list, in either script.

| Field | Detail |
|---|---|
| What | The crisis phrase list has no entries and no normalisation path for Arabic written in Latin transliteration (Arabizi/Franco-Arabic), a common informal typing register in Egypt, so a crisis disclosure typed in that register in a journal would not be detected by the scanner at all |
| Where | `lib/crisis/alerts.ts:54-202` (the full phrase list, confirmed no transliterated entries), `lib/crisis/fold.ts:40,52-59` (`fold()` only normalises Arabic-script code points), `lib/data/journals.ts:86-142` (`writeJournal`, scans the raw typed body with no transliteration step) |
| Who is harmed | A patient who types their journal, or a same-language chat surface, in Arabizi rather than Arabic script, on the one surface (a 3am journal entry) C123's own text identifies as the highest-stakes crisis surface in the product |
| Severity | major, scoped specifically to typed text (journals); I could not verify the spoken-session exposure without running transcription, so I am not extending the same severity to that path without evidence |
| Already known? | C159 and C163 (both ruled, sprint 32) already found and fixed the list's blindness to formal Arabic script and then to Egyptian dialectal Arabic script, in each case by widening the same kind of list. Neither concern, nor any test I found in `tests/safety.test.ts`, mentions transliterated or Latin-script Arabic. New, and the same class of gap the list has already been caught missing twice |

---

## 9. Minor: `verify:claims`'s duration regex does not catch "after X minutes", which a real shipped sentence uses.

`A_DURATION` in `scripts/verify-claims.ts:72-79` matches `in/within/under/next` plus a unit,
"minutes rather than/not/instead of," and "right away," but not "after." A live sentence,
`lib/content/defaults.ts:379`: *"After five minutes you are offered somebody else at the same
price or less, or your money back."* contains an `A_PERSON` word ("somebody") and is,
in ordinary reading, a time-bound promise, but evades the scanner purely because it uses
"after" rather than one of the four covered prepositions. I am marking this minor rather than
major because, read in context (a no-show/refund policy for an already-scheduled session, not
a promise about how fast help arrives), it is a weaker fit for the harm Invariant 14 is
actually protecting against than findings 5's two sentences; but it is a clean, demonstrable
gap in the checker's own regex coverage, worth a line so it does not quietly become a bigger
one the next time somebody writes copy using "after" instead of "within."

| Field | Detail |
|---|---|
| What | `verify-claims.ts`'s `A_DURATION` pattern list does not include "after X minutes/hours," so a person-plus-duration sentence using that phrasing is not caught, even though the checker's stated intent is to catch the shape regardless of the exact wording |
| Where | `scripts/verify-claims.ts:72-79` (the pattern list); `lib/content/defaults.ts:379` (the sentence that demonstrates the gap) |
| Who is harmed | Nobody directly today, since the specific sentence found is a defensible no-show policy rather than a crisis-response promise; this is a gap in the guard, not a live harm |
| Severity | minor |
| Already known? | Not addressed anywhere in PLAN.md I could find. New, and narrow |

---

## What I tried to break and could not

- **Cross-therapist leakage through the copilot.** I traced `sessions.patientId` through to
  `patients.id`, which carries `therapistId`, and confirmed `getOrCreateThread`
  (`lib/data/copilot.ts:47-58`) scopes to `patients.therapistId = actor.userId`. Two
  therapists sharing one patient (multi-grant, per §3f) have separate `patients` rows and
  separate session sets; `buildPatientContext` cannot cross that boundary. Held.
- **Invented citations surviving to the screen.** `resolveCitations`
  (`lib/ai/case-copilot.ts:663-689`) only returns a citation whose `ref` resolves to a real
  entry in the `index` map built from that patient's own segments; `keepResolvableCitations`
  (used at `:625-627`) does the same for document markers. `tests/safety.test.ts:819` and
  `:851` test this directly. Held.
- **The write-before-notify crisis alert ordering.** `raiseCrisisAlert`
  (`lib/crisis/alerts.ts:238-311`) genuinely inserts the `riskAssessments` row as `pending`
  before attempting the `notifications` insert, matching the claim in README.md:211. Held
  (see finding 6 for the retry cadence, which is a separate concern from the ordering).
- **Instrument Arabic publishing without review.** `instruments_translation_reviewed`
  (`drizzle/0070_assessments.sql:66-73`) is a real database CHECK: a non-English locale
  cannot publish without `translation_reviewed_by` set, and `lib/data/instrument-seeds.ts`
  deliberately ships `locales: ["en"]` for both PHQ-9 and GAD-7 even though the Arabic text
  is drafted in the file. Held.
- **Patient item-9 (self-harm) answers on PHQ-9 becoming an automatic risk level.**
  `lib/data/instrument-seeds.ts:91-100`'s own comment states the intent and
  `facts_journal_never_concludes`/C214's sibling constraints are the mechanism named for
  assessments (C214 "in a second costume", `lib/data/assessments.ts:46`). I did not
  trace `lib/data/assessments.ts` end to end with the same depth as `facts.ts`, so I am
  recording this as checked-but-shallower rather than fully held; see below.
- **Document extraction from AI to diagnoses inferring from symptoms.** `lib/ai/diagnoses.ts`
  requires an exact, character-for-character `sourceSentence` present in the source passage
  (`verbatimIn`, referenced at `:33-36`) and a `NOT NULL` database column backs it. Held for
  the document-diagnosis path specifically (this is a different surface from the journal
  path in finding 4).

## What I could not verify

- **Whether Whisper actually produces Arabizi/Latin-script output for code-switched spoken
  Arabic**, or normalises it to Arabic script on its own. I read `lib/ai/transcribe.ts` and
  confirmed there is no post-processing transliteration step in this codebase either way, but
  I did not and could not run a live transcription call to observe the model's actual
  behaviour, so finding 8's severity is deliberately scoped to the typed-journal path, where
  I can show the exposure directly from the code.
- **How often a `notifications` insert actually fails in production**, which determines how
  often finding 6's daily retry cadence matters in practice. I have no access to production
  logs or error rates and did not attempt to reach any.
- **Whether `lib/data/assessments.ts` has the same structural (database-level) protection
  against a PHQ-9/GAD-7 score becoming a diagnosis or risk level that `lib/data/facts.ts` has
  for journals**, to the same depth I traced finding 4. `scripts/verify-sprint56.ts` names
  this check (`56.8 / C214`) and the comment at `lib/data/assessments.ts:46` claims the same
  mechanism, but I did not read the full data flow from an assessment response to a screen
  with the same rigour I gave the journal path, and I am not willing to call it either held
  or broken without that.
- **Whether the video-call `micMuted` effect timing gap I noted in finding 1** (the effect
  only fires on a value change, so it may miss applying an initially-true mute if the Daily
  call object is not yet ready) is reachable in practice, versus always resolved by some
  other render path I did not trace fully. I did not rely on it for the finding's core claim
  (the `SessionRecorder`'s own default-unmuted state, which is unambiguous from the source),
  but I am not certain of the exact behaviour of the Daily SDK integration without running it.
- **Whether the "five minutes... offered somebody else" no-show policy in finding 9 is
  actually honoured operationally** (i.e., whether a real mechanism enforces the five-minute
  window and the refund), versus being aspirational copy. I did not trace the scheduling/
  no-show code for this, since the finding is about the claims-checker's regex coverage, not
  about whether the underlying policy is real.
