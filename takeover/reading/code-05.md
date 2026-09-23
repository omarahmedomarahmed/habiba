# Slice 05: lib-clinical

## Files
### lib/ai/assistant.ts (486 lines)
- For: the general (non-case) copilot on a therapist's home screen: roster, threads, quota, voice prefs (PLAN 10.1 to 10.6).
- Decides: `buildRoster` (97) reads only patient names, lastSessionAt, a COUNT of draft notes (118) and MIN future scheduled_at (138), scoped to org and to `therapistId = actor` unless `super_admin` (149). `askAssistant` (201) sends roster + last 8 history turns to `MODELS.note`; mentions resolved after the answer by name-matching (257). `assistantAllowance` (290) counts therapist rows in the calendar month against `settings.copilot.generalMessagesPerMonth`. Threads scoped by userId on every read (339, 354, 412). Soft delete (412).
- Assumes: callers call `assistantAllowance` before `askAssistant` (the function itself does not check quota). `patients.therapistId` is the caseload boundary. `super_admin` here is the org-level clinician role.
- Promises: supports T5 by exclusion (no clinical content in this context). Patient never talks to it (clinician only).
- Notes: patient names ARE sent to the model provider here (roster block 169), while `notes.ts:81` makes a point of never sending the patient's name to the provider. Inconsistent de-identification policy; names reach OpenAI via this path on every question. `askAssistant` does not check quota; enforcement lives in the caller.

### lib/ai/case-copilot.ts (795 lines)
- For: the clinician's per-patient copilot (T5), with citation resolution and a live-session time bound.
- Decides: `buildSystemPrompt` (110) puts the live-session time bound (136) and the no-liveProfile access rule (161) above the therapist's standing instructions. `buildPatientContext` (231) reads sessions WHERE patientId (and startedAt < liveSince when live, 267), first note summary, up to 220 segments per session. `documentsFor` (366), `journalsFor` (406), `profileFor` (450) all return empty when `capabilities.liveProfile === false`. `resolveCitations` (706) drops any `S n:m` ref not in the index; `keepResolvableCitations` deletes unresolvable `[D n:m]` markers from the prose (668).
- Assumes: the CALLER computes `capabilities` fresh for each question and has already checked the clinician may open this patient (the function has no grant or caseload check of its own; `capabilities` is optional and absent means "no restriction", 373, 509). `patients.id` is per-clinician, so "one patient" means that clinician's patient row.
- Promises: T5 partly. Citation of source sentence: kept for session refs (quote is the stored segment text, 726) and document refs; NOT enforced that an answer has any citation at all (an answer with zero citations is returned as is). Journal material is cited by date in prose only and never resolved (613). "Revoke stops next question" depends entirely on callers passing a fresh `capabilities`; with liveProfile false the copilot still reads that clinician's own session transcripts (by design).
- Notes: see Broken (oldest 12 sessions) and Stale (profile bound).

### lib/ai/client.ts (300 lines)
- For: the one OpenAI gateway, model names, usage logging and cost estimation.
- Decides: `openai()` (91) throws `AiUnavailableError` with no key, no mock fallback. `logUsage` (156) writes metadata only and swallows DB failures at warn (177). Cost in thousandths of a cent (244), unpriced model priced at the dearest rate (77, 83). Rates from `platform_settings.aiRates`, falling back to shipped (227). `parseJson` (284) strips code fences and returns a typed fallback on failure (logs warn).
- Assumes: `getSettings` is cached. `aiRequestLogs` schema.
- Promises: none directly; supports honesty of cost figures.
- Notes: `ratesInForce` returns an EMPTY table if settings parse but have no rows, then `dearest*Rate` recurses to shipped: fine. `openaiBaseUrl` lets the whole pipeline point at another endpoint by env, which is also where clinical text goes; no allowlist.

### lib/ai/copilot.ts (162 lines)
- For: in-session suggestions, fired every 3 segments from the chunk upload response.
- Decides: `shouldRunCopilot` (56) every 3rd sequence; `generateCopilot` (60) sends the last 14 segments to gpt-4o-mini, at most 2 suggestions, 240 chars; failure returns [] (141).
- Assumes: caller checks consent/AI permission before calling; the function reads segments of the session id with no check at all.
- Promises: T2 indirectly: it reads only stored segments, so off-record audio never reaches it if it was never stored.
- Notes: a "risk" kind suggestion is shown to the clinician only; no crisis alert path is wired from here.

### lib/ai/diagnoses.ts (243 lines)
- For: extracting diagnoses explicitly written in uploaded documents (8.9) as `proposed` rows.
- Decides: `verbatimIn` (74) requires the source sentence, whitespace-normalised, to appear exactly in the cited passage (min 8 chars); `parseRef` (82); `proposeDiagnoses` (96) reads at most 120 passages ordered by document ordinal, writes `status: "proposed"`, skips an identical (label, chunk) proposal.
- Assumes: `person_diagnoses.source_sentence NOT NULL`; a human confirms elsewhere; caller checked access to the person.
- Promises: supports "journal cited never concluded" style discipline; P3 not touched (clinician-facing).
- Notes: `.limit(120)` ordered ascending means documents beyond the first 120 passages are never read, the same shape as H11 in diarise.ts. The error path logs but does not `logUsage` an error row (150), unlike every other call site.

### lib/ai/diarise.ts (502 lines)
- For: text-based speaker attribution when only one microphone was running (in-person, or a dropped patient track).
- Decides: `planBatches` (107) 120 per batch, max 40 batches; `straddlesTurnBoundary` (156) refuses a line with a question followed by more words; `attributeLines` (241) batches with 8 lines of context; `diariseSession` (347) only runs when some row is `unknown` and only writes rows that are currently `unknown` (462), marking `speakerInferred`.
- Assumes: `transcript_segments.speaker_inferred` column exists and the transcript panel renders it.
- Promises: T1 (the note is built from an attributed transcript).
- Notes: H11 is genuinely retired here (no LIMIT at 353). Beyond 4,800 segments it logs a warn and silently leaves the rest unknown (406).

### lib/ai/note-writer.ts (205 lines)
- For: the pure note generator (prompt + model call + coercion), no DB, so a partner-authenticated route can use it.
- Decides: SYSTEM_PROMPT (33) forbids names, forbids background as evidence, asks for patient-facing fields `patientBrief/Steps/Next`. `normaliseLanguage` (153) overrides the model's tag by script count. `normaliseNote` (175) caps steps at 4.
- Assumes: the transcript it is given already excludes off-record material; the prompt itself says nothing about off-record gaps.
- Promises: T1 (built from transcript). T2: the note is silent about the off-record minute only because the minute is absent from the transcript; nothing instructs the model not to infer or mention a gap. P3: the model writes the patient's copy; approval is elsewhere.
- Notes: none.

### lib/ai/notes.ts (523 lines)
- For: build note context, generate, translate, and store the draft note for a completed session.
- Decides: `buildContext` (93) omits the patient's name, sends modality, duration, `patients.clinical` diagnoses/goals and the evidence-layer facts block, plus up to 1,200 segments. `generateNoteContent` (176) throws `EmptyTranscriptError` under 80 characters. `generateAndStoreNote` (367): diarise first, generate, prepend `lateRecordingStamp` (412), stamp provenance and offRecordSeconds from `noteProvenanceFor` (431), upsert `session_notes` with `status: "draft"` on INSERT only (443) and an `onConflictDoUpdate` that rewrites content/language/contentEn/model/provenance but NOT status or patient_status (448), set `noteStatus: "ready"`, open the copilot thread, rebuild the profile. Any failure sets `noteStatus: "failed"` (512).
- Assumes: `noteProvenanceFor` (lib/data/feedback) measures off-record time; the in-person path records `recordingStartedAt`; nothing re-runs generation on a note that has been approved.
- Promises: T1 kept for generation (draft from transcript, `status: "draft"`). P3 at risk: see Broken (regeneration overwrites an approved patient copy). T2: provenance/offRecordSeconds recorded; the note content is not told about the gap.
- Notes: translation failure returns null quietly (211), fine. `patients.clinical` blob diagnoses are sent to the model as "Working diagnoses" alongside the rule that background must not name a diagnosis.

### lib/ai/profile.ts (434 lines)
- For: the rolling per-PERSON standing profile and observation timeline (9.1 to 9.4), rebuilt wholesale.
- Decides: `gather` (105) reads the first 60 document passages (by ordinal ASC) and the 8 most recent sessions across EVERY `patients` row sharing this `personId` (141 to 160), i.e. across clinicians and practices, 120 segments each plus each note's summary. `regenerateProfile` (218) upserts `person_profiles` and deletes/reinserts `observations`. `keepCitedSections` (337) drops a section if any ref is unknown; `keepCitedConflicts` (367) needs two real refs; `keepDatedObservations` (400) drops undated or implausible dates.
- Assumes: consumers gate the profile behind `capabilities.liveProfile` (case-copilot.ts:455). Called after every note (notes.ts:490).
- Promises: P4 in spirit (one record across clinicians). But it breaks the recording consent wording "Only your therapist can see it" (consent.ts:31): transcripts from clinician A's sessions become profile prose that clinician B's copilot reads. T5: see Broken (S-ref collision with the copilot).
- Notes: the S numbering (`S${number}` at 194) is local to this build (8 most recent sessions across all charts) and is stored in `sections[].refs`. The same `.limit` ASC shape as diagnoses: a person with more than 60 passages never has later documents in their profile. Error path does not `logUsage` an error row (264).

### lib/ai/risk.ts (179 lines)
- For: the model risk classifier: returns indicators with exact quotes, never a level (35.1).
- Decides: `traceable` (111) keeps a finding only when its normalised quote is in the normalised transcript (Arabic letter folding, punctuation stripped) and the indicator is in `RISK_INDICATORS`; `classifyRisk` (147) takes only a transcript string.
- Assumes: level computed by `levelFor` in lib/crisis/level.ts; caller logs usage.
- Promises: supports P5 indirectly (crisis detection), not money.
- Notes: the looser matcher (punctuation stripped, 3-char minimum) is much looser than diagnoses' verbatim rule; a 3 to 5 character "quote" such as a single word will match almost any transcript. The quote can be the clinician's own line; only the prompt forbids that.

### lib/ai/transcribe.ts (223 lines)
- For: transcribe one WAV chunk; language normalisation, anti-hallucination prompt and artefact filter.
- Decides: `transcribeAudio` (40), `transcribeChunk` (72) logs usage both ways and rethrows; `normaliseLanguage` (146); `cleanTranscript` (217) drops known stock phrases.
- Assumes: the caller has decided the chunk may be transcribed (no consent parameter exists at this layer).
- Promises: T1 input quality. Consent: none checked here.
- Notes: none.

### lib/ai/translate.ts (134 lines)
- For: machine translation of interface strings into drafts (21.16).
- Decides: `translateStrings` (45) drops any translation that lost a `{placeholder}` (109); returns a sentence on failure.
- Assumes: `draftTranslations` (caller) writes `status = 'draft'` and a human publishes.
- Promises: P3 adjacent: machine-written interface text (including crisis and consent strings, per the prompt at 33) reaches patients only after a human publishes; cannot tell from here whether publish requires review.
- Notes: error path does not `logUsage`.

### lib/assistant/roster.ts (125 lines)
- For: turn roster names in an assistant answer into links, server-side (10.3).
- Decides: `linkRoster` (41) longest name first, case-insensitive, Unicode word boundaries (104, 122); names shorter than 3 chars never link (43); `mentionsIn` (81) dedupes.
- Assumes: roster comes from `buildRoster` (caseload-scoped).
- Promises: none of the 25; a correct safety property (no link to a patient not on the roster).
- Notes: two patients with the same full name on one roster: the first in sort order wins every time, so a link can point to the wrong one of two same-named patients.

### lib/audio/recorder.ts (355 lines)
- For: the browser recorder: 16 kHz mono WAV chunks cut at pauses; one instance per audio source.
- Decides: `muted` option (66, 100) gates `push` (201); `setMuted` (150) flushes what was captured before the mute; `flush` (224) drops sub-second and silent chunks; `shouldCut` (276).
- Assumes: the CALLER passes the consent state as `muted`. Sequence numbers are assigned by the caller at upload.
- Promises: T2 (off record means the recorder captures nothing) is kept at the capture layer while `muted` is true. Consent (task 123): the default is still UNMUTED; see Stale and Broken.
- Notes: a muted recorder emits nothing, so no sequence number is consumed; combined with the server stamping startMs from sequence, off-record time leaves no gap in the timeline (see Broken).

### lib/checkins/policy.ts (149 lines)
- For: pure decision "may we send this person a check-in now" (44.1, C97).
- Decides: `shouldSend` (96): channel off, mute-rate halt, unreachable, muted, quiet hours in THEIR zone (unknown zone treated as quiet, 124), cadence clamped at `MIN_HOURS_BETWEEN = 6` (47, 130). `inQuietWindow` (89) handles wrap.
- Assumes: `lib/data/checkins.ts` measures mute rate and candidates.
- Promises: none of the 25 (unclaimed capability, see Unclaimed).
- Notes: a patient with no timezone is NEVER sent a check-in (always quiet_hours), silently; the sweep counts it as quiet_hours rather than as "no zone".

### lib/checkins/receive.ts (190 lines)
- For: handle a patient's reply to a check-in: crisis scan first, then stop word, then store.
- Decides: `handleReply` (59): no prior check-in, ignored (70). Crisis indicators, raise `level: "high"` alert on the most recent session's clinician (82), store with `crisisAlertRaised`, return the patient-facing crisis message and helpline (122). No session at all, warn log only (104). `mostRecentSessionFor` (158) orders by `sessions.scheduledAt DESC` across all charts of the person.
- Assumes: `raiseCrisisAlert` delivers; `patients.personId` links charts.
- Promises: P5: the crisis path here has no money condition (kept). But see Suspect: NULL `scheduledAt` sorts first under DESC in Postgres, and cancelled or future sessions are not excluded, so the alert can wake the wrong clinician (or one whose grant was revoked).
- Notes: a person who claimed a record and was never seen gets the helpline text and no human is alerted; only a log line (104). Nobody reads that log line by design (see notify findings).

### lib/checkins/send.ts (163 lines)
- For: the cron sweep that sends check-ins, reporting skips by reason.
- Decides: `sweepCheckins` (42): halt checked once (62, 66), per-person `shouldSend`, wording via admin-editable strings, body = wording + stop instruction (124), `notify` then `recordCheckin` with `delivered` (147).
- Assumes: `notify` returns `{sent, channel}` and never throws.
- Promises: P2 adjacent: a check-in exists only as email/WhatsApp; nothing in-app (P2 says nothing the product tells you is only in an email).
- Notes: see Broken for the no-repeat rule.

### lib/checkins/wording.ts (98 lines)
- For: pick one of 12 admin-editable wordings, never the last one; the exact-match stop words.
- Decides: `nextWording` (55) excludes the wording whose rendered text equals `lastBody`; `isStopWord` (89) whole-message match in English and Arabic.
- Assumes: `lastBody` is the rendered wording. It is not: see Broken.
- Promises: none.
- Notes: none.

### lib/clinical/context.ts (177 lines)
- For: which evidence-layer facts reach the note generator, and the "KNOWN BEFORE THIS SESSION" block (34.1).
- Decides: `factsForPrompt` (66): only active and current facts; unverified `ai` facts never (85, C167); no `diagnosis` domain (108, C168); no `presentation`, `function`, `risk` (137, C170). `factsPrompt` (150) puts the rules above the list.
- Assumes: the note generator's only diagnosis source is this block. It is not: see Broken (notes.ts sends `patients.clinical.diagnoses`).
- Promises: T1 (note from what was said, not from background).
- Notes: none beyond the contradiction.

### lib/clinical/currency.ts (224 lines)
- For: how old a fact may be before it stops being current; source priority ladder (33.2, 33.3, C166).
- Decides: `HALF_LIFE_DAYS` (26): risk 30, medication 90, presentation 60, function 90, goal 90, social 365, diagnosis and history never. `currencyOf` (86) ages from `effectiveAt`. `ageLabel` (106) en/ar. `SOURCE_PRIORITY` (145) clinician 1, document 2, patient 3, ai 4; `maySupersede` (159); `rankFacts` (205) current before stale, then priority, then newest.
- Assumes: DB CHECK ties `source_priority` to `source_type` (comment 132).
- Promises: none of the 25 directly.
- Notes: `ageLabel` Arabic plurals are ungrammatical for 1 and 2 (for example "منذ 1 أشهر"), cosmetic.

### lib/consent.ts (109 lines)
- For: the recording consent wording and version; the late-recording stamp (7.8).
- Decides: `RECORDING_CONSENT_VERSION` (15), `RECORDING_CONSENT` (27) wording, `isRecordingConsent` (43), `lateRecordingStamp` (77) returns a sentence when recording began at least 60 s after `startedAt`, else null (null also when either time is unknown).
- Assumes: the join form (app/join/[token]/actions.ts:373, 694) is the only writer of `recording_consent` and `recording_started_at`. There is no other writer anywhere (grep), so an in-person session never has consent asked or `recording_started_at` set.
- Promises: task 123 and T2. The wording promises "Only your therapist can see it" (31) and "the recording indicator turns amber" (32). Code: in-person sessions record with consent NULL (see Broken); transcripts feed the cross-clinician profile (profile.ts:141) and so reach other clinicians' copilots; audio and text go to OpenAI; meeting audio goes through a third-party bot. The wording is not kept.
- Notes: the file says the patient is asked "before they enter the room", which only exists for video join links. `lateRecordingStamp` can never fire for in-person sessions because `recordingStartedAt` is never written for them.

### lib/crisis/alerts.ts (511 lines)
- For: the crisis phrase lists (English, Arabic, Arabizi), the scan, alert write and delivery, the sweeper, and the patient-facing crisis message.
- Decides: `scanForCrisisLanguage` (326) two passes, each filtered by `stillCounts`. `raiseCrisisAlert` (359): 10-minute dedup per session (369), insert `risk_assessments` as `pending`, insert an in-app `notifications` row for the therapist, flip to `delivered` (405 to 417). `sweepUndeliveredAlerts` (437) retries pending rows, 50 at a time. `patientFacingCrisisMessage` (478) returns "Your therapist has been notified and is here with you" plus the configured or verified line, or "call your local emergency number".
- Assumes: the clinician opens the app. "Delivered" means a row exists in `notifications`; no email, push or WhatsApp is sent to a clinician from here.
- Promises: P5: nothing in this file consults money, a payment state or a subscription (kept here). But the delivery channel is in-app only; see Suspect.
- Notes: stale single-caller claim (Stale). The notification body says "in a live session" (410) even when raised from a check-in reply.

### lib/crisis/context.ts (327 lines)
- For: suppress a crisis match that is about someone else or explicitly resolved (35R, C171). The file calls itself the most dangerous file in the repository.
- Decides: `suppressedIn` (234): present marker anywhere in the sentence cancels suppression; past AND resolved suppresses; a THIRD_PARTY marker before the phrase suppresses unless `\bi\b`, `انا` or `نفسي` appears before it. `stillCounts` (275): a present marker anywhere in the text returns true; else any unsuppressed relevant sentence counts, unless it is past and a later sentence is resolved.
- Assumes: `contains` (fold.ts:74) is a plain substring test after folding. It has no word boundaries.
- Promises: P5 adjacent (the alert path). See Broken: `"he "`, `"her "`, `"his "`, `"she "`, `"they "` are matched as substrings, so "the " contains "he ", "other " contains "her ", "headache " contains "he ". "The thought of suicide will not leave" is suppressed as third party and raises nothing.
- Notes: the same substring behaviour makes PRESENT fire on "know" (contains "now") and "again" etc., which errs toward alerting (safe). Arabic `امي` ("my mother") is a substring of `ايامي` ("my days"); `عمي` of `عميق` ("deep").

### lib/crisis/fold.ts (153 lines)
- For: the single Arabic fold and the empty-needle-safe `contains`; the separate Arabizi fold.
- Decides: `fold` (52) lowercases, strips marks, unifies alef, ة to ه, ى to ي, hamza seats; `contains` (74) returns false on an empty folded needle; `foldsToNothing` (87); `foldArabizi` (124) private; `containsArabizi` (149).
- Assumes: callers want substring semantics. context.ts needs word boundaries for its pronoun markers and does not get them.
- Promises: P5 adjacent.
- Notes: `foldArabizi` turns non letters into spaces but `containsArabizi` is still a substring test on the folded string, so "an7ar" (I kill myself) matches inside longer words containing that run.

### lib/crisis/level.ts (209 lines)
- For: the deterministic risk ladder over classifier indicators, with the keyword floor (35.3).
- Decides: `keywordFloor` (99) any hit is `elevated`; `levelFor` (121) homicidal or psychosis critical; ideation+plan+(means or timeframe) critical; ideation+(plan or intent) high; ideation+(means or timeframe) high; ideation elevated; plan or intent elevated; self_harm, abuse elevated; previous_attempt moderate. `recommendedAction` (176); `shouldAlert` (207) at elevated or above.
- Assumes: `protective_factor` never read (kept).
- Promises: P5 adjacent (kept: no money input).
- Notes: none.

### lib/crisis/line.ts (256 lines)
- For: which crisis number to show: configured line from `country_settings`, verified fallback table (US 988, EG 105 with menu steps), or none.
- Decides: `crisisCountryFor` (145) region then Arabic locale implies EG; `crisisLine` (159) configured wins and keeps menu steps only when the number matches the verified one; `countriesMissingACrisisLine` (201); `lineForNumber` (226) longest-prefix on dialling codes; `countryForNumber` (252).
- Assumes: callers pass the configured line; `lineForNumber` never receives a configured line, so an operator-configured number for a country outside the table is never shown on the number-based path.
- Promises: P5 (the number dialled does not depend on money here: kept).
- Notes: Arabic locale maps to Egypt for anyone reading Arabic, including a Gulf reader (the translation prompt in lib/ai/translate.ts:35 says Arabic is addressed to a Gulf reader), who would be shown Egypt's 105.

### lib/diarisation/align.ts (182 lines)
- For: put acoustic turns and transcript chunks on one clock; assign a chunk to a voice or refuse with a reason (37.1).
- Decides: `alignSegments` (89): `no_window`, `silence` below `MIN_COVERAGE = 0.2` (69), `contested` below `MIN_SHARE = 0.75` (79), else `assigned`; speech is the union of turns (115, 136). `summarise` (172).
- Assumes: segment windows are real audio times. In production they are not: the transcribe route stamps every chunk as `(sequence-1)*8000` to `sequence*8000` (app/api/sessions/[id]/transcribe/route.ts:178) while chunks are 2 to 8 s, so any future alignment against real provider turns would align against fictional windows.
- Promises: none of the 25.
- Notes: pure and tested; no production caller supplies turns (provider not built, see provider.ts).

### lib/diarisation/provider.ts (62 lines)
- For: the type of the unbuilt acoustic diarisation provider (named gap 37.4).
- Decides: nothing; types only.
- Assumes: n/a.
- Promises: none.
- Notes: half built by design; stated as such.

### lib/diarisation/turns.ts (197 lines)
- For: turn arithmetic: normalise, merge same-voice fragments within 250 ms, speaking time, crosstalk, coverage, voice order.
- Decides: `normaliseTurns` (96), `crosstalk` (144), `speechCoverage` (176), `voiceOrder` (191).
- Assumes: provider turns.
- Promises: none.
- Notes: `crosstalk` `break` at 152 relies on sort by start; correct.

### lib/diarisation/voices.ts (263 lines)
- For: bind an acoustic voice to therapist or patient only by track evidence or an operator; otherwise "Speaker N" (37.2, 37.3).
- Decides: `tallyEvidence` (126) needs 3 measured chunks and 90% purity; `bindVoices` (174) no elimination, ties bind nobody; `displayFor` (224); `speakerFor` (242).
- Assumes: caller passes only `speaker_inferred = false` rows as evidence; migration 0065 CHECK.
- Promises: none of the 25.
- Notes: consumed by lib/data/session-voices.ts, whose `recordVoices`/`attachLines` have no production caller (grep), so the voices panel on /sessions/[id] can only ever be empty until a provider exists. Unclaimed (c).

### lib/documents/chunk.ts (172 lines)
- For: cut document text into citable passages; parse and keep only resolvable `[D n:m]` citations (8.3, 8.5).
- Decides: `chunkText` (39) prefers paragraph, then sentence (including `؟`), then space; 120 to 1,200 chars. `parseCitations` (109), `formatCitation` (128), `keepResolvableCitations` (145) deletes an unresolvable marker from the prose and tidies.
- Assumes: the same text always yields the same chunks (deterministic, so re-extraction keeps refs stable only if text is identical).
- Promises: T5 (document citations resolve or vanish): kept.
- Notes: deleting an invented citation leaves the claim it supported standing in the answer with no marker at all; the reader cannot tell a sentence that lost its citation from one that never had one.

### lib/documents/extract.ts (132 lines)
- For: extract text from a stored document (txt, md, csv, PDF via unpdf with a column check, docx via mammoth).
- Decides: `extractText` (37) null for unreadable types, interleaved PDFs (84), empty results, or >5% replacement characters (58). `fetchDocument` (120) reads `.uploads/` locally for `/api/uploads/` paths or fetches the stored URL.
- Assumes: `blobUrl` is always a value our own upload code wrote. `fetch(blobUrl)` would fetch any URL a writer stored (see partner media notes); `join(cwd, ".uploads", ...)` does not normalise `..`.
- Promises: T5 adjacent (what the copilot can cite).
- Notes: none.

### lib/documents/formats.ts (143 lines)
- For: what may be uploaded (25 MB), what is readable versus stored-only, and the searchability label (8.2, 8.4).
- Decides: `readabilityOf` (76), `documentProblem` (83), `searchabilityLabel` (102) (`none` is "Searchable" because `none` means typed or dictated text, schema.ts:4373), `isImage`, `extensionFor`.
- Assumes: schema meaning of `extraction`.
- Promises: none of the 25.
- Notes: none.

### lib/documents/identity-access.ts (192 lines)
- For: who may read a clinician's identity documents (29.1), and the local-disk fallback check.
- Decides: `identityReadDecision` (122) owner or `super_admin` (platform role, schema.ts:96) only. `parseIdentityRef` (103). `localUploadAllowed` (166): super_admin; `receipt/...` readable by any back-office role (187); otherwise the path owner segment must equal the user id.
- Assumes: stored paths follow `<kind>/<userId>/...`; `receipt/<sessionId>/...` for transfer receipts.
- Promises: A5 partly: the comment says every receipt read is audited (184); this function does not audit, the caller must. Cannot tell from here.
- Notes: a patient (separate principal) can never read their own uploaded receipt through this check; only back office can.

### lib/documents/layout.ts (148 lines)
- For: detect multi-column PDF pages so they are not extracted (C50).
- Decides: `linesOf` (74), `columnCount` (106) with a 12% gap touching the middle band on at least 40% of lines (min 8 lines), `isInterleaved` (146) any page.
- Assumes: unpdf item coordinates.
- Promises: T5 adjacent (no wrong passage behind a citation).
- Notes: right-to-left Arabic PDFs are sorted left to right (99); fine for the gap test, irrelevant to order because the text itself comes from unpdf.

### lib/documents/read-access.ts (92 lines)
- For: the single decision for reading a person's document (patient, or clinician under grant).
- Decides: `documentReadDecision` (37): a patient reads only their own person's documents; a clinician needs a non-deleted patient row for that person in their org and caseload (super_admin sees the org), then either uploaded it themselves (83) or `accessFor(...).capabilities.patientFiles` (89).
- Assumes: `lib/data/grants.accessFor` evaluates the grant at call time.
- Promises: P4 (patient decides who reads history) and T5's grant discipline for documents: kept at this layer, checked per request.
- Notes: a revoked clinician keeps documents they uploaded (by design, §3).

### lib/ehr/fhir.ts (239 lines)
- For: the FHIR R4 client: read a patient's display name; file an approved note as a `DocumentReference`. No DB import (43.4).
- Decides: `request` (48) refuses scheme or `..` paths, never passes a refusal body through; `readPatientName` (93) returns only a string; `fileDocumentReference` (141) LOINC 11488-4, author only when given (182), requires an id from body or Location (216).
- Assumes: callers supply a live token and the approved text.
- Promises: P3 analogue for charts (only approved text files): depends on the caller (file-note.ts).
- Notes: none.

### lib/ehr/file-note.ts (286 lines)
- For: file an approved note into the hospital chart, idempotently, with a pending receipt first.
- Decides: `fileNote` (74): note must be `approved` with `approvedAt` and `approvedBy` (103 to 105) in the caller's org; live connection; a non-severed launch for the patient (126); claim `ehr_writebacks` row with `onConflictDoNothing` (154); file with `authorReference: null` ALWAYS (205); record `refused` or `filed`; audit on success (264). `noteAsText` (52) sends SOAP only.
- Assumes: something calls it. Nothing does: the only references are scripts/verify-sprint43.ts and verify-sprint67.ts (grep). Writeback is unreachable from the product.
- Promises: P3/T1 adjacent. The header's "author is the clinician or nobody" is always nobody, which is the exact outcome the header calls the defect (a note in a chart with no human name on it).
- Notes: a `refused` row is never reset by anything (no other writer of `ehr_writebacks`), and a retry of a refused note returns "That note is already being filed." (178) forever. Only the approving clinician's `status` is checked; `patient_status` is irrelevant here (fine).

### lib/ehr/owner.ts (38 lines)
- For: says it decides who owns a records connection; actually only `whatIsMissing` (32).
- Decides: `whatIsMissing` names missing client id or sealing key.
- Assumes: n/a.
- Promises: none.
- Notes: see Stale: `ConnectionOwner` (19) is exported and used nowhere; the "one place both spellings meet ... pick the owner" function does not exist.

### lib/ehr/pending.ts (103 lines)
- For: carry the PKCE verifier and flow state across the OAuth redirect in a sealed, httpOnly, lax, 15-minute cookie.
- Decides: `putPending` (55), `takePending` (87) deletes the cookie on read whether or not it validates; org in the cookie is only for a mismatch check.
- Assumes: the callback re-derives the organisation from the live session (comment 28 to 36; cannot confirm from this slice).
- Promises: A5 adjacent (principal boundaries).
- Notes: none.

### lib/ehr/policy.ts (187 lines)
- For: the written decision of what we hold versus what the hospital's chart is the record for (43.4).
- Decides: constants `WE_HOLD`, `THEIRS_NEVER_OURS`, `FORBIDDEN_COLUMN_FRAGMENTS`, `RETENTION`.
- Assumes: verify:sprint43 sweeps the schema.
- Promises: P4 (the patient's record outlives the hospital connection).
- Notes: `WE_HOLD` says the transcript was recorded "under a consent we recorded (C214)" (90). Not true for any session whose consent is null (every in-person session, see Broken).

### lib/ehr/smart.ts (300 lines)
- For: SMART on FHIR discovery, PKCE, authorise URL, code and refresh exchange.
- Decides: `discover` (59) https only and same origin for both endpoints; `pkce` (134); `redirectUri` from `env.appUrl` (141); `authorizeUrl` (152) sets `aud`; `exchange` (193) refuses a grant that fails `scopesAreMinimal` (246).
- Assumes: `scopesAreMinimal` catches over-broad grants. It does not (see vendors.ts).
- Promises: none of the 25.
- Notes: a grant with an empty `scope` string is accepted without any check (246 `granted.length > 0`).

### lib/ehr/vendors.ts (130 lines)
- For: the vendors list and the requested scopes, and the scope guard.
- Decides: `REQUESTED_SCOPES` (80); `scopesAreMinimal` (110) refuses a `*`, a `user/` prefix, or a write regex `\.(write|c?ud?|\*)$` on anything but DocumentReference.
- Assumes: scopes are SMART v1 style.
- Promises: none of the 25.
- Notes: see Broken: explicit per-resource reads (`patient/Condition.read`, `patient/MedicationRequest.read`, all of `THEIRS_NEVER_OURS`) pass the guard, and SMART v2 write permissions such as `patient/Condition.c` or `patient/Observation.cruds` do not match the write regex and pass too.

### lib/ingest/token.ts (160 lines)
- For: the session-scoped bearer token that lets a meeting bot append audio to one session (36.2).
- Decides: `mintIngestToken` (51) `si_<sessionId>_<48 hex>`, 6 h; `hashIngestToken` sha256; `sessionIdIn` (72); `bearerFrom` (78); `ingestDecision` (106): no token, malformed, wrong session (URL vs token vs row), no source, not issued, revoked, expired, constant-time hash mismatch.
- Assumes: the transcribe route returns no clinical text on the token branch (it does: route.ts:206 to 216) and never runs the copilot (route.ts:198).
- Promises: none of the 25. Consent: a valid token appends audio with no consent check at all, same as the browser door (the route has none).
- Notes: none.

### lib/integrations/registry.ts (233 lines)
- For: the public integrations page's source of truth, with states that are "a fact about the code" (28.5, C149).
- Decides: `INTEGRATIONS` (52), `HR_VENDORS` (198), `EHR_VENDORS` (214), labels.
- Assumes: each `today` sentence is true.
- Promises: public claims. Two are false against the code (see Broken): in-person "The patient is asked for consent on the same screen, in their language" (71): nothing ever writes `recording_consent` for an in-person session; clinic systems "the note you approve is filed back" (147): `fileNote` has no caller.
- Notes: the record-extract entry says the extract is "emailed to the patient and to nobody else" (105); P2 concern if the app itself does not show it (outside slice).

### lib/mail-previews.ts (486 lines)
- For: the one list of every automated message, rendered by a script or sent from /admin/settings to one typed address.
- Decides: `previewMessages` (151) 25 entries grouped by audience; `previewRoster` (95) strips `send` for the client.
- Assumes: the header claim (143 to 145) that `sendNotification` copy is "lifted from those call sites rather than invented".
- Promises: E1/E2 (company messages carry no person: kept in the previews at 431 to 454). P2 context.
- Notes: see Stale: the "check-in" preview (370 to 379) says "No answer needed ... goes on your record and your therapist sees it ... turn these off in your account"; the real check-in (lib/checkins/send.ts:124) is one of twelve wordings plus "Reply with the word stop and they end." The "therapist message" row is labelled audience `patient` and "the clinician writes to them from the patient profile" (197 to 206), but `sendTherapistMessage` is 24Therapy writing to a clinician (mail.ts:319, footer "Sent by 24Therapy to the address on your clinician account"). The founder reads this list to learn who gets what.

### lib/mail.ts (601 lines)
- For: every email template and the Resend send; also the email channel behind `lib/notify`.
- Decides: `esc` (26) on every dynamic value; `send` (56) returns false and logs warn when no key, on rejection, or on throw. `sendSessionReport` (171) sends `patientBrief || summary` (242), steps, next line, per-language chrome (en, ar, fr, es). `sendRatingReminder` (278), `sendTherapistMessage` (319), `sendPasswordReset`, `sendClaimCode` (no clinical detail, 374), `sendSessionInvite` (392) with a `$` price and "Payment is handled securely by Stripe" (419), `sendRecordExport` (440) with optional `bcc: copyTo`, `sendClinicianHistory` (481) CSV attachment, `sendWalkInDirections` (529), `sendNotification` (576).
- Assumes: callers only send approved patient text; `releaseBrief` (lib/data/feedback.ts:643) is the caller for the report.
- Promises: P3 at risk (the summary fallback, see Broken). P2: every function returns a boolean and never throws; who reads the false is the caller. E2 not touched.
- Notes: `sendRecordExport` header (432 to 438) says it is "Sent to the patient, never to whoever pressed the button", and the body says "nobody at 24Therapy read it" (460), but `copyTo` exists and app/(admin)/admin/tv/actions.ts:51 passes the staff member's own address, so the operator receives a working link to the patient's entire record including transcripts. The invite text is false for the Egyptian manual transfer rail (Stripe, "$", "receipt by email").

### lib/meetings/create.ts (157 lines)
- For: create a Zoom meeting inside the clinician's own account (41.2); Meet and Teams refused by name.
- Decides: `createMeeting` (49) returns a reason instead of throwing; `createZoomMeeting` (112) `waiting_room: false`, `join_before_host: true`, `auto_recording: "none"`.
- Assumes: the topic passed is neutral (the caller's duty); the link is never handed to the patient (41.4).
- Promises: none of the 25 (unclaimed capability). Consent of others: `join_before_host: true` with no waiting room means anybody holding the raw join link enters without the host; the raw link is given to the therapist for their calendar (comment 26).
- Notes: none.

### lib/meetings/dispatch.ts (247 lines)
- For: dispatch the Recall bot only on the patient's consent, remove it on withdrawal or session end, hard stop on an unknown bot.
- Decides: `sendBotForConsent` (60) only for an external, provisioned source with no bot yet; claims `bot_id` conditionally and removes a racing second bot (125 to 140). `withdrawBot` (156) stamps `botLeftAt` before asking the provider. `assertOurBot` (207) audits and removes an unexpected bot.
- Assumes: `answerConsent` is the only caller (comment 52; outside slice). The consent that dispatches is ONE answer from the patient who used the join link.
- Promises: none of the 25. Consent of other participants: see Suspect: in a couples, family or group session held on Zoom, the bot joins on the single join-link patient's "yes"; nobody else in the meeting is asked, and the only notice is the participant name "24Therapy recorder" (108).
- Notes: `withdrawBot` returns early when no bot (170) and never writes `botStatus` for the "session_ended" reason if the bot had never joined (fine).

### lib/meetings/providers.ts (90 lines)
- For: Zoom, Meet, Teams OAuth endpoints and the meeting-only scope list (C132).
- Decides: `PROVIDERS` (44); `scopesAreMeetingOnly` (84) regex refuses calendar, recording, history, report, user:read, contacts, drive, mail.
- Assumes: a verifier calls the guard.
- Promises: none of the 25.
- Notes: Teams `OnlineMeetings.ReadWrite` is a delegated scope that can read the user's online meetings (their existing meetings), which is the "meeting history" the guard exists to refuse; it passes the regex because the word is not in it.

### lib/meetings/recall.ts (153 lines)
- For: the thin Recall.ai adapter: dispatch a bot, remove a bot.
- Decides: `dispatchBot` (46) refuses when `features.meetingBots` is off; posts `meeting_url`, `bot_name`, real-time transcription to our webhook; `removeBot` (136) `leave_call`.
- Assumes: the webhook is "Ours, signed." (56).
- Promises: none of the 25.
- Notes: see Stale/Suspect: nothing signs the webhook. The URL is `${appUrl}/api/meetings/transcript/${sessionId}` with no secret, and app/api/meetings/transcript/[sessionId]/route.ts contains no signature, secret or HMAC check (grep); it authenticates only by the `bot_id` in the JSON body matching the stored one. Audio and meeting text go to a third party (Recall.ai) using `meeting_captions`, i.e. the meeting platform's own captioning.

### lib/notify/email.ts (34 lines)
- For: the email channel adapter for `notify`, delegating to `sendNotification`.
- Decides: `sendNotificationEmail` (27).
- Assumes: lib/mail.ts escaping and footer.
- Promises: P2 context.
- Notes: the header records that DMARC is not published (25).

### lib/notify/index.ts (427 lines)
- For: the one seam every message to a person goes out through: in-app notice, WhatsApp and email, and a delivery-attempt row.
- Decides: `notify` (287): writes `patient_notifications` first when both `personId` and `message.notice` are given (301), swallowing failure at warn (311); tries WhatsApp (if configured, a phone, a template) then email (both, not either); records every attempt in `delivery_attempts` via `record` (379), which also swallows failure. Returns `{sent, channel, channels, reason}`. `reachable` (420), `emailConfigured` (425).
- Assumes: callers pass `personId` and `notice` for the message to land in the app; callers read `Delivery.reason` and show it.
- Promises: P2 partly: the in-app copy exists only for callers that pass both fields (`verify:notices` counts the rest). Who finds out about a failure: nobody is alerted. A failed send becomes (a) a `log.warn`/`log.info` line and (b) a `delivery_attempts` row with a reason; a failed in-app notice or a failed attempt row is only a `log.warn`. The reason recorded is wrong when the provider refused: a recipient with an email whose send Resend rejected is recorded as "no channel available" (355), indistinguishable from an unconfigured channel.
- Notes: crisis alerts do not go through `notify` at all (they write the clinician's in-app `notifications` table only, alerts.ts:406).

### lib/notify/whatsapp.ts (231 lines)
- For: WhatsApp via the Meta Cloud API with approved templates; off by default and never run against a live account (10 to 16).
- Decides: `TEMPLATES` (48) for booking, session started, summary ready, claim code and invite, session invite, password reset code, payment submitted and confirmed; `sendWhatsapp` (142) refuses no config, no template, wrong variable count, non E.164; throws only on transport failure.
- Assumes: Meta approves each template in `ar` (129).
- Promises: P2 (in practice email plus in-app). A3 not touched.
- Notes: `checkin.asking` has no template, so check-ins go by email only, while `notify`'s own header and policy.ts treat WhatsApp as the channel most Egyptian patients have (56 of 66 without email). `payout.*`, `record.export`, `consent.granted`, `sponsor.pot_empty` also have no template (fine for some by design).

### lib/partner/api.ts (513 lines)
- For: the partner API's subject-based functions: who may read, session writeback, deliver an approved note, resolve and link subjects (55.5 to 55.8, C277).
- Decides: `whoMayRead` (86) emails and verified flag of THIS partner's clinicians holding a live grant (scoped by `organizations.partner_id` and `billing_mode = partner_billed`, 142). `writeBackSession` (178) finds the clinician through the subject's own patient rows, scoped to the partner, refuses ambiguity (409) and unverified clinicians. `deliverableNote` (348) returns the full note content where status approved, approvedAt and approvedBy are set and the session's person is linked to ANY `partner_subjects` row of this partner. `resolveSubject` (429) excludes revoked links. `upsertSubject` (471).
- Assumes: every path to a person goes through `resolveSubject` (comment 441 to 452 says so).
- Promises: P3 (only approved notes leave): kept. P4 / T5 grant discipline: broken for notes (see Broken): `deliverableNote` does not use `resolveSubject`, has no `revokedAt` filter and no partner-clinician scope, and checks no patient grant.
- Notes: `A_PARTNER_NEVER_READS_A_CHART` (513) sits beside a function that returns SOAP, impressions and summary to a partner credential.

### lib/partner/billing.ts (192 lines)
- For: the partner's monthly bill from `partner_sessions.billable`, posted through the ledger.
- Decides: `billFor` (60) counts live, billable sessions created in the month times `settings.pricing.partnerSessionCents`; `postMonthlyBill` (124, private) idempotent on `refType partner_month` + `partnerId:YYYY-MM`; `billAllPartners` (171) bills the previous month.
- Assumes: the ledger `journal` balances; the price in settings at billing time is the price the partner was shown.
- Promises: E3-like (price shown is price owed): not guaranteed: a reprice between the month and the bill changes the bill for the closed month. Money posted to `therapist_receivable` (150) for a debt that is a partner's, which mislabels the account in every reconciliation.
- Notes: a check-then-journal race on the idempotency read (134) if two crons run at once; depends on whether the ledger has a unique index on ref (cannot tell from here).

### lib/partner/consent.ts (169 lines)
- For: the append-only consent log for sessions on a partner's platform, and the coverage sentence (68.1, 68.2).
- Decides: `recordConsent` (51) clamps future `answeredAt` to now and offset to 0..86,400; `recordingFrom` (101) last event by `answeredAt` wins, `given` returns its offset, else null; `coverageSentence` (135); `consentHistory` (148).
- Assumes: the partner's server reports the patient's answer truthfully; we never see the patient.
- Promises: T2 / consent analogue for partners: the boundary is enforced on what we are told, not on the audio (media.ts says so).
- Notes: given at 0, withdrawn at 10, given at 20 yields "from 20" and silently discards the consented first ten minutes (conservative).

### lib/partner/copilot.ts (174 lines)
- For: the copilot for a clinician on a partner's platform, reading only that partner's own ended sessions (68.7, 68.8).
- Decides: `askPartnerCopilot` (68) refuses with no material; citations kept only when the `[ref]` appears in the answer and is one we sent (124). `sessionMaterial` (149) 30 most recent ended sessions for (partner, subject), approved note else transcript.
- Assumes: the route checks `clinicianEnabled` and `mayAnswer`.
- Promises: T5 analogue (citations resolve).
- Notes: no `logUsage` call, so partner copilot model spend is absent from the cost ledger. `sessionMaterial` does not re-check the per-session consent boundary: an ended session whose consent was later withdrawn still feeds the copilot.

### lib/partner/draft.ts (109 lines)
- For: draft note and patient summary for a partner session using the same `noteFromTranscript`.
- Decides: `writeSessionNote` (39) SOAP as plain text; `writePatientSummary` (90) brief plus steps.
- Assumes: the summary is approved like the note.
- Promises: P3 analogue at risk: the summary is produced by a SEPARATE model call from the note (95), so the text the clinician approved as a note is not the generation the patient summary came from; see notes.ts.
- Notes: two model calls per session for the same transcript.

### lib/partner/employment.ts (226 lines)
- For: the sponsor's single-person employment verification step (C255, C265).
- Decides: `verifyEmployment` (87): key must carry a sponsor; sponsor active; atomically claims a live unanswered attestation (132); answers one boolean from active, unremoved, unpaused enrolment; audits both outcomes.
- Assumes: attestations are created only by the person's own enrolment.
- Promises: E1/E2 (the employer learns nothing about use): kept here; the answer is enrolment state, not usage.
- Notes: none.

### lib/partner/keys.ts (415 lines)
- For: minting, authenticating, rate-limiting and revoking partner and sponsor API keys.
- Decides: `mintKey` (80) scope list check, live keys need `partners.approvedAt`; sha256 hash. `authenticateKey` (211) hash lookup, active owner via left joins (283), constant-time compare, 60 calls/min per key SUSPENDS the key (318), scope check. `keysFor` (378), `revokeKey` (401), `stampSuccess` (172).
- Assumes: a human re-enables suspended keys.
- Promises: A5 adjacent.
- Notes: see Suspect: one key for a whole live integration and 60 calls a minute across every session it runs; `sponsorId` on `mintKey` is taken from the caller unchecked. Stale: `stampSuccess` comment (167 to 170) says `lastUsedAt` is written on calls that then fail on a scope; it is written only after the scope check passes (343).

### lib/partner/launch.ts (313 lines)
- For: a partner's server asks for a URL that signs one of its clinicians into our product (42.3, 55.9).
- Decides: `launchClinician` (99) clinician must be at an org with this `partner_id` and `partner_billed`, and verified; stores a 2-minute token hash and an allow-listed target; returns the URL to the partner's server. `redeemLaunch` (177) claims the token atomically, re-checks org and verification, inserts an `auth_sessions` row (1 h, `created_via partner_launch`), sets the ordinary session cookie, audits. `sweepExpiredLaunches` (306).
- Assumes: only the clinician's browser opens the URL.
- Promises: A5 / principal boundaries: see Suspect: the URL is a bearer credential held by the partner's server; whoever opens it within two minutes gets a full clinician session over that clinician's whole caseload. The clinician need not be present or consent to any given launch.
- Notes: none.

### lib/partner/media.ts (110 lines)
- For: transcribe partner audio chunks and append to `partner_sessions.transcript_text`.
- Decides: `ingestPartnerAudio` (39) uses `transcribeAudio` (no usage row), language detection, SQL append (89); `transcriptFor` (101).
- Assumes: the route passed `fromSeconds` from our consent log; nothing here uses `fromSeconds` at all (it is accepted and ignored).
- Promises: consent: the comment says the boundary "is not negotiable here", but the function does not read `input.fromSeconds`; the only enforcement is the route's `mayAnswer` null check.
- Notes: see Stale.

### lib/partner/notes.ts (180 lines)
- For: the partner draft, the clinician's approval of exact text, and summary delivery.
- Decides: `draftNote` (45) prepends the coverage sentence; `approveNote` (75) stores the clinician's text and a free-text `clinicianRef`, once; `deliverSummary` (131) requires `noteApprovedAt` only.
- Assumes: routes scope `partnerSessionId` to the calling partner (these functions take a bare id).
- Promises: P3 analogue partly: the note needs a named clinician, but the patient SUMMARY needs no approval of its own text; any text the partner posts (including our unreviewed `writePatientSummary` output) is delivered once the separate note is approved.
- Notes: "named clinician" is whatever string the partner sends.

### lib/partner/platform.ts (300 lines)
- For: open a partner session through the limit and consent gates; the `mayAnswer` gate; per-clinician opt-in.
- Decides: `openSession` (50): limit first, then consent; `billable` only when live, not stopped and consented; conflict path keeps `billable` (101); creates an unlinked subject for live sessions. `mayAnswer` (212) 404 / 409 stopped / 403 no consent. `enableClinician` (260), `clinicianEnabled` (284).
- Assumes: consent arrives before or during the session via recordConsent and a second `openSession` call.
- Promises: none of the 25 (partner is unclaimed).
- Notes: `billable` is decided at the FIRST open; a session opened before consent (billable false) and consented ten minutes later via a second open stays unbilled, since the conflict update leaves `billable` alone. A partner can get every session free by opening before consent. `partner_sessions.person_id` is selected (188) but nothing here writes it.

### lib/partner/route.ts (92 lines)
- For: `withKey`, the one guard for every partner route: per-IP 240/min, key auth, scope, non-null partner.
- Decides: `withKey` (46), `fail` (90).
- Assumes: every handler under app/api/partner/v1 calls it.
- Promises: A5 adjacent.
- Notes: none.

### lib/partner/usage.ts (283 lines)
- For: the partner's own monthly session limit, usage and projection, alerts at 80 and 90 per cent, stop stamp.
- Decides: `usageFor` (58) counts live billable sessions this month; `setLimit` (123) clears alerts and stop; `mayRun` (169) sandbox always, limit 0 means unlimited, else stop at `used >= limit`; `alertApproachingLimits` (202) claims each stamp conditionally then `notify`; `markStopped` (278).
- Assumes: `billable` is decided correctly at open (see platform.ts).
- Promises: none of the 25.
- Notes: the alert link is the relative path "/partner/usage" (261), which in an email is not a working link (every other caller passes `${env.appUrl}`). `stopped` in `usageFor` reads `limitRow.periodStart`, which `markStopped` never updates, so a stop recorded in a later month under an old periodStart reads as not stopped (display only; `mayRun` uses counts).

### lib/partner/webhooks.ts (373 lines)
- For: signed, content-free partner webhooks (event, id, time), queue and drain; grant-revoked and record-claimed emitters.
- Decides: `registerWebhook` (56) https and sealed secret; `queueWebhook` (101); `notifyGrantRevoked` (152) only the partner whose own clinician lost the grant; `notifyRecordClaimed` (202) every partner with a live link; `deliverPending` (228) HMAC over timestamp.body, 6 attempts; `deliveriesFor`, `webhooksFor`, `disableWebhook`.
- Assumes: the grant and claim code paths call the two emitters (outside slice; the header 128 to 142 says they were never called before).
- Promises: P4 adjacent (the patient can leave; the partner is told).
- Notes: `registerWebhook` accepts any https URL, including internal hosts, and the cron then POSTs to it (SSRF by a partner against our network, limited to a three-field body). No backoff between attempts: six attempts can be spent in six consecutive cron runs.

### lib/partner/writeback.ts (154 lines)
- For: write a completed session held on a partner's platform into our chart, source-attributed (55.7).
- Decides: `recordExternalSession` (46) validates duration and time, idempotency by (external meeting id, org, kind) via select-then-insert (87 to 99), inserts a completed video session with price 0 and a `feedbackToken` (121), and a `partner_platform` source row provisioned by the clinician.
- Assumes: a unique index backs the idempotency (the select-then-insert races otherwise; cannot confirm from here).
- Promises: P4 (the session appears in the patient's record, attributed).
- Notes: a `feedbackToken` is minted, so whatever sweeps feedback/rating reminders may email the patient about rating a session held on another platform (cannot confirm from here). `recording_consent` null is correct here and the file says so.

### lib/session-clock.ts (158 lines)
- For: the one session timeline (running, countdown, over) shared by both screens and the server.
- Decides: `capSeconds` (82); `sessionClock` (86): over at the cap, or "silent" when past running time AND the last transcript segment is older than `silenceSeconds` (123); `formatRemaining` (148).
- Assumes: `lastActivityAt` is the latest transcript segment.
- Promises: T2 interaction: see Suspect. Going off record after the running time (minute 50 by default) stops segments, so after `silenceSeconds` the server ends the session as abandoned. The comment (116 to 121) covers only a session that was off record from the start.
- Notes: `sessions.extendedAt` is documented dead (31 to 36).

### lib/session-finish.ts (128 lines)
- For: the one after-session routine for every way a session ends: delete room, release radar claim, charge, settle from held, session-level risk classifier, note.
- Decides: `finishSession` (38) runs five independently guarded steps, each failure only `log.error`.
- Assumes: `generateAndStoreNote` only has a transcript when recording was permitted. There is no consent check before the risk classifier or the note (task 123: an in-person session with consent NULL is transcribed, risk-classified by a model and written up).
- Promises: T1 (the note starts as soon as the session ends). P5: the risk step has no money condition (billing runs first but a billing failure does not stop the risk step).
- Notes: a failed step is a log line; nobody is shown it (for example a failed room delete leaves the room open until its 4 h expiry, and a failed charge leaves no invoice with no screen saying so).

### lib/sessions/started-notice.ts (125 lines)
- For: tell the patient the moment the clinician presses Start, with the join link, in app and by channel (76.17, 79.1).
- Decides: `noticeSessionStarted` (53) patient contact falling back to guest email; writes an in-app notice when there is a person; one WhatsApp variable; never throws.
- Assumes: `startSession` calls it only on the scheduled to started transition.
- Promises: P2 kept for patients with a person row; a guest gets email only (by design).
- Notes: none.

### lib/transcript/descriptors.ts (94 lines)
- For: words per minute and pause length, never emotion labels (3.3).
- Decides: `countWords` (49), `wordsPerMinute` (66) null when unknown, capped at 400; `pauseBeforeMs` (87).
- Assumes: segment durations and start times are real. They are not: the transcribe route stamps every chunk as exactly 8 s from its sequence number (route.ts:178), so wpm is words per 8 s and every pause is 0 unless a sequence number was skipped.
- Promises: none of the 25.
- Notes: the descriptors are computed from fictional timings (see Broken, T2 measurement).

### lib/video.ts (223 lines)
- For: Daily.co private rooms, meeting tokens, deletion, a health check.
- Decides: `createPrivateRoom` (69) random name, private, 4 h after the later of now or `liveAt`, eject at expiry, chat off, screenshare on; returns a reason on failure. `roomFailureText` (46), `videoHealth` (160), `createMeetingToken` (171) 120 min default, `deleteRoom` (205) swallows failure, `roomUrlWithToken` (219).
- Assumes: tokens are minted only for the two people in the session.
- Promises: P1 depends on it. No consent or recording here (recording is the app's own recorder).
- Notes: a room built for a session booked days ahead opens at creation time too (Daily has no not-before here); only the expiry moves.


## Stale

1. lib/ai/case-copilot.ts:354-365 and 456-457. The C373 header says the live-session time bound was missing from `documentsFor` and `profileFor` and implies both now take it. `profileFor` still ignores it (`void before;` at 457). A profile rebuilt during the live session reaches a copilot that says "I only know what came before this session".
2. lib/audio/recorder.ts:53-66 and 99. The comment says "The caller now has to say" and "Never assume consent: the caller states it". In fact `muted?: boolean` is optional and the default is still `options.muted ?? false` (100), so a caller that says nothing records. components/copilot/chat.tsx:211 omits it (dictation, harmless).
3. lib/crisis/alerts.ts:50-52 says the module "is imported by exactly one caller (`appendTranscriptSegment`)". It has four: lib/data/transcript.ts, lib/data/session-risk.ts, lib/data/journals.ts, lib/checkins/receive.ts.
4. lib/crisis/alerts.ts:410 says "detected in a live session". The same function is used for check-in replies (receive.ts:82), which happen outside any session.
5. lib/clinical/context.ts:88-108 (C168) says "the note generator is sent no diagnoses at all". lib/ai/notes.ts:113-115 still sends `patients.clinical.diagnoses` as "Working diagnoses". The filter only covers the evidence layer.
6. lib/consent.ts:2 says consent is asked "before they enter the room", and lib/ehr/policy.ts:90 says the transcript is held "under a consent we recorded (C214)". Neither is true for in-person sessions, which never get a consent write (see Broken 1).
7. lib/ehr/owner.ts:6-18 says the file picks the owning organisation "in one place" and "does nothing but pick the owner". Only `whatIsMissing` exists. `ConnectionOwner` (19) is used by nothing.
8. lib/ehr/file-note.ts:36-41 and 181-189 say the author is "the clinician or nobody". At 205 it is hard-coded to `authorReference: null`, so it is always nobody, which the same header calls the defect.
9. lib/ehr/smart.ts:185-191 says the scope re-check refuses a token that can read a whole chart. vendors.ts:106-117 only refuses a `*`, `user/` and v1-style writes. See Broken 9.
10. lib/integrations/registry.ts:71 (public copy) says in-person patients are "asked for consent on the same screen, in their language". No code does that. registry.ts:147 says "the note you approve is filed back". `fileNote` has no caller. The registry header (29-32) says each state is "a fact about the code".
11. lib/meetings/recall.ts:56 describes the webhook as "Ours, signed." Nothing signs it or checks a signature. app/api/meetings/transcript/[sessionId]/route.ts has no signature, secret or HMAC check (grep). The only check is the `bot_id` in the JSON body.
12. lib/mail.ts:432-438 says the record export is "Sent to the patient, never to whoever pressed the button", and the body (460) says "nobody at 24Therapy read it". Line 440 has a `copyTo` bcc, and app/(admin)/admin/tv/actions.ts:51 passes the staff member's own address.
13. lib/mail-previews.ts:143-145 says the `sendNotification` copy is "lifted from those call sites rather than invented". The check-in preview (370-379: "No answer needed ... turn these off in your account") does not match the real body (lib/checkins/send.ts:124: one of twelve wordings plus "Reply with the word stop and they end."). The "therapist message" row (197-206) is labelled audience `patient`, but `sendTherapistMessage` mails clinicians.
14. lib/partner/api.ts:441-452 says the `isNull(revokedAt)` in `resolveSubject` "closes whoMayRead, writeBackSession and deliverNote at once". `deliverableNote` never calls `resolveSubject`. See Broken 3.
15. lib/partner/media.ts:25-36 says "THE CONSENT BOUNDARY IS NOT NEGOTIABLE HERE". `ingestPartnerAudio` takes `fromSeconds` and never reads it.
16. lib/partner/keys.ts:167-170 says `lastUsedAt` is written on calls that then fail on a scope. It is written only after the scope check passes (343).
17. lib/partner/launch.ts:65-67 says a new window means "no credential of ours in their hands". The launch URL returned to the partner's server is that credential. See Suspect 1.
18. lib/session-clock.ts:116-121 says a clinician "working off record" has no last segment, so silence cannot end the session. That is true only if they are off record from the start. See Suspect 6.
19. lib/diarisation/align.ts and lib/transcript/descriptors.ts assume real segment windows. In production every window is `(seq-1)*8000` to `seq*8000` (see Broken 5).

## Suspect

1. lib/partner/launch.ts:99-164 and 177-265. The launch URL, a two-minute bearer token, is handed to the PARTNER'S SERVER. `redeemLaunch` needs nothing else. So the partner (or any log or proxy that sees the URL) can open it and hold an ordinary full clinician session for one hour. That session covers the clinician's whole caseload (targets include /patients and /notes). The clinician does not need to be present or agree. This matters because a partner is a third party, not a principal allowed into charts. The answer is in app/api/partner/launch (whether redemption requires the clinician's own prior session or a second factor). I found none here.
2. lib/checkins/receive.ts:158-181. The crisis alert for a check-in reply goes to the session ordered by `sessions.scheduledAt DESC`. `scheduledAt` is nullable (schema.ts:846), and Postgres sorts NULLS FIRST under DESC. No status filter is applied either. So a walk-in or unscheduled session, a cancelled one, or a future booking with a new clinician can win. The alert then wakes the wrong clinician, possibly one whose grant was revoked. This is moot today because the function has no caller (Broken 2), and live the moment it is wired.
3. lib/crisis/alerts.ts:405-417. Crisis "delivery" is one row in the clinician's in-app `notifications` table. No email, push or WhatsApp is sent from here, and `alertStatus = delivered` means only that the row was written. A journal or check-in alert at 3am waits until the clinician next opens the app. The sweeper retries only the insert. A clinician-side paging path, if one exists, would be outside this slice.
4. lib/meetings/dispatch.ts:60-143. The bot joins on one "yes" from the join-link patient. In a couples, family or group session on Zoom, nobody else in the meeting is asked. Their only notice is a participant named "24Therapy recorder" (108). create.ts:125-126 sets `waiting_room: false` and `join_before_host: true`, and the raw link goes to the therapist's calendar. Anyone forwarded that link walks into a recorded meeting unasked.
5. app/api/meetings/transcript/[sessionId]/route.ts, from recall.ts:109. The webhook URL is `appUrl/api/meetings/transcript/<sessionId>` with no secret. Anyone who knows a session id and the bot id can write transcript lines into a clinical record, and those lines then feed the note and the crisis scan. Recall bot ids appear in logs and the provider dashboard.
6. lib/session-clock.ts:122-134. After running time (default 50 min), going off record stops segments. After `silenceSeconds` the server ends the session as abandoned and `finishSession` runs (room deleted, note generated). This is T2 turned against the clinician. The value of `silenceSeconds` is in lib/settings/defs.ts.
7. lib/partner/keys.ts:59 and 318. One key gets 60 calls a minute across every session it runs, and going over SUSPENDS the key until a human re-enables it. Audio chunks, transcript polls and copilot questions from more than a handful of concurrent live sessions will kill a legitimate partner's whole integration mid-session. It depends on how the partner media route batches calls.
8. lib/partner/billing.ts:65 and 150. The price is read from settings when the month is billed, not when sessions ran (the E3 shape). The debt is also posted to `therapist_receivable`, which mislabels a partner's debt in reconciliation.
9. lib/partner/writeback.ts:87-126. Idempotency is select-then-insert, so a concurrent retry can write two sessions unless a unique index exists (not visible here). A `feedbackToken` is minted (121), so rating-reminder sweeps may email a patient about a session held on another platform.
10. lib/ai/case-copilot.ts:497-529. `askPatientCopilot` has no grant or caseload check of its own, and `capabilities` is optional ("absent means no restriction"). T5's "a revoked grant stops it on the next question" holds only if every caller recomputes `accessFor` per question. The callers are app/api/copilot and the in-session suggestion route.
11. lib/ai/assistant.ts:169-183 sends every roster patient's full name to OpenAI on every general-assistant question. lib/ai/notes.ts:81-89 takes pains never to send a name. The de-identification policy is inconsistent, and no patient was told names go to a model provider.
12. lib/partner/copilot.ts:149-174. The partner copilot reads ended sessions without re-checking the consent log, so a withdrawn consent does not stop later reading. It also never calls `logUsage`, so model spend on partner copilot questions is missing from every cost figure.
13. lib/crisis/line.ts:154. Any Arabic-locale reader with no region is shown Egypt's 105. lib/ai/translate.ts:35 says the Arabic copy is addressed to a Gulf reader. A Gulf patient gets a number that does not connect from their country.
14. lib/partner/webhooks.ts:56-63. A partner can register any https URL, including internal hosts, and our cron POSTs to it (SSRF, limited to a three-field body).
15. lib/meetings/providers.ts:66. Teams `OnlineMeetings.ReadWrite` can read the user's existing meetings, which is the "meeting history" the guard exists to refuse. It passes because the regex only looks for words.

## Broken

1. **Task 123: in-person sessions are recorded with no consent, and the note says they were not.** No in-person consent is ever asked. The only writers of `sessions.recording_consent` and `recording_started_at` are app/join/[token]/actions.ts:373, 384, 694 and 703 (grep). An in-person session has no join step, so consent stays NULL. components/session/session-room.tsx:103 and 109 initialise off-record only when consent is `"declined"`, so NULL means the recorder is built unmuted (lib/audio/recorder.ts:100 default false). app/api/sessions/[id]/transcribe/route.ts has no consent or off-record check at all; it checks only `status === in_progress` (126), and neither does lib/data/transcript.ts. The session is transcribed and model risk-classified (lib/session-finish.ts:100), and a note is generated from the transcript (lib/ai/notes.ts:367). Then lib/data/feedback.ts:519 `noteProvenanceFor` returns `provenance: "clinician"` for any consent other than `granted`, so a note written by a model from an unconsented recording is badged as clinician-written from memory. The public registry (lib/integrations/registry.ts:71) says the patient "is asked for consent on the same screen". Legal defect.
2. **Check-in replies go nowhere, including crisis replies.** lib/checkins/receive.ts:59 `handleReply` has no caller outside scripts/verify-sprint44.ts and tests (grep), and there is no inbound email or WhatsApp route under app/api. The cron still sends check-ins (app/api/cron/[job]/route.ts:346), and each one ends "Reply with the word stop and they end." (lib/i18n/messages.ts:2291, appended at lib/checkins/send.ts:124). A person who replies "stop" keeps getting them. A person who replies "I want to die" to an unprompted message from us reaches no human, is shown nothing, and no alert is raised. verify:sprint44 passes because it calls the function directly. If the function were wired, it would tell a person with no clinician "Your therapist has been notified" (alerts.ts:507, returned at receive.ts:122 even when `noClinician` is true).
3. **A partner key can read any approved note of a linked person, including after the patient cut the link, and including notes by clinicians unconnected to that partner.** lib/partner/api.ts:348-393 `deliverableNote` (route app/api/partner/v1/notes/[sessionId]/route.ts:39) joins `partner_subjects` on `person_id` with no `isNull(revokedAt)`, no `organizations.partner_id`/`billing_mode` scope and no patient grant check. It returns the whole `session_notes.content` (SOAP, impressions, summary). `whoMayRead` (142) and `writeBackSession` (257) were both fixed for exactly this "other therapist" shape; this function was not. The C277 promise that the patient can cut the link and leave is broken for the one endpoint that returns clinical text.
4. **Crisis context suppression misses real disclosures, in the file that calls itself the most dangerous in the repo.** lib/crisis/context.ts:71-76 lists `"he "`, `"her "`, `"his "`, `"she "`, `"they "` and `"their "` as third-party markers, and `contains` (lib/crisis/fold.ts:74) is a plain substring test. "the " contains "he ", "other " contains "her ", "headache " contains "he ". `suppressedIn` (257-261) then suppresses the match unless an "I" appears before the phrase. Example: "The thought of suicide will not leave." has no present marker, "the " comes before the phrase, and there is no "i", so it is suppressed as third party and nothing is raised. The same goes for "Sometimes the pain makes me want to die". tests/risk-level.test.ts has no case with "the" before a phrase. This is the one direction the file says it may never be wrong in.
5. **T2 cannot be seen in the data, and every segment timestamp is fiction.** app/api/sessions/[id]/transcribe/route.ts:178-179 stamps `startMs = (seq-1)*8000` and `endMs = seq*8000`. components/session/session-room.tsx:174 increments `seq` only when a chunk is uploaded, and a muted (off-record) recorder emits nothing (recorder.ts:201), so off-record time consumes no sequence numbers. Chunks are also 2 to 8 s (pause cutting), not 8. The result: `offRecordGaps` (lib/data/feedback.ts:476, gap > 20 s) never finds an off-record minute, `provenance` is never `partial` from going off record, and `offRecordSeconds` stays null. The note is badged "transcript" for a session that had off-record minutes. Citation `atSeconds` (case-copilot.ts:727), words per minute and pauses (descriptors.ts) are all wrong. The transcript has a hole in its content, but no record says where or how long.
6. **The copilot reads the OLDEST twelve sessions, not the latest.** lib/ai/case-copilot.ts:276-277: `.orderBy(asc(sessions.createdAt)).limit(12)`. For a patient past twelve sessions, the copilot never sees anything recent, and its answers carry valid-looking citations to old sessions. T5 is degraded without anyone noticing.
7. **Copilot citations can resolve to the wrong sentence.** profile.ts:171-197 numbers sessions `S1..S8` over the 8 most recent sessions across ALL of the person's charts, and stores those refs in `person_profiles.sections[].refs`. case-copilot.ts:480 pastes that profile, refs included, into the copilot prompt. The copilot's own index numbers `S1..S12` as this clinician's oldest-first sessions (283, 310). A model that copies "S2:14" from the profile is resolved by `resolveCitations` (706) against the copilot's index, so a DIFFERENT real segment is attached as the source. For T5 this is worse than no citation: a wrong source that looks verified.
8. **Regenerating a note after the patient's copy was approved puts unapproved model text on the patient's screen as signed.** lib/ai/notes.ts:448-459: the upsert conflict path rewrites `content` (including `patientBrief/Steps/Next`) but not `status` or `patient_status`. app/(app)/sessions/actions.ts:408 `regenerateNote` has no status guard. lib/data/patient-view.ts:114 and 131 read the live `content->>'patientBrief'` and call it signed when `patient_status = approved`. The UI shows "Try again" only when `noteStatus` is failed or there is no note (components/session/note-review.tsx:122), so it is reachable through a later failed run or a direct server-action call. This breaks P3.
9. **The patient email falls back to the clinician's summary.** lib/data/feedback.ts:643 (`releaseBrief`) and lib/mail.ts:242 send `patientBrief || summary`. `summary` is the clinician-facing field ("presented as guarded"), and it carries the late-recording stamp that notes.ts:414 prepends. The patient-copy editor (actions.ts:493) edits only the three patient fields, so a clinician who clears the brief to send nothing, or a model that returned an empty brief (which the prompt allows), sends clinical text nobody approved for the patient. feedback.ts:600-605 claims it reads exactly three patient fields. This breaks P3.
10. **The EHR scope guard admits a whole chart.** lib/ehr/vendors.ts:106-117 `scopesAreMinimal` passes `patient/Condition.read`, `patient/MedicationRequest.read`, `patient/AllergyIntolerance.read` (everything on `THEIRS_NEVER_OURS`), and SMART v2 writes such as `patient/Condition.c` or `.cruds` (the write regex needs a `u`). smart.ts:246 also accepts a grant with an empty scope string without checking it.
11. **The check-in no-repeat rule never fires.** lib/checkins/send.ts:124 stores `body = wording + "\n\n" + howToStop`, and lib/data/checkins.ts:101 hands that stored body back as `lastBody`. lib/checkins/wording.ts:68 compares it to the bare wording, which can never be equal. So the same message repeats about one time in twelve, the exact failure 44.1 names.
12. **Partner sessions opened before consent are never billed.** lib/partner/platform.ts:87 decides `billable` at the first open, and the conflict update (114-118) deliberately leaves it untouched. A session opened, then consented ten minutes later by a second open (the flow 68.2 describes), does all the work at billable = false. That is a free path for every session.
13. **A record-export email to the patient gives a staff member a working link to the patient's whole record.** app/(admin)/admin/tv/actions.ts:49-52 calls `sendRecordExport` with `copyTo: actor.email`, which becomes a bcc of the same private link (mail.ts:470) to the full record including transcripts. The email tells the patient nobody at 24Therapy read it. The act is audited, but the wording to the patient is false.
14. **The session invite promises Stripe to Egyptian payers.** lib/mail.ts:417-421 says "Payment is handled securely by Stripe and goes to your therapist. You will get a receipt by email.", with a `$` amount. Egypt has no processor: the payer makes a manual bank transfer to us (BRIEF). The first money sentence an Egyptian patient reads is false.

## Looks broken, is handled

1. lib/ai/copilot.ts:60 (in-session suggestions) reads a session's segments with no auth. It is handled at app/api/sessions/[id]/transcribe/route.ts:101-117 (clinician owns the session) and 198 (never on the bot token branch).
2. lib/ingest/token.ts lets a bot append audio without a person's session. The route (route.ts:206-216) returns no clinical text and no crisis flag on that branch. (It still appends with no consent check; see Broken 1.)
3. lib/meetings/dispatch.ts `withdrawBot` leaves `bot_id` in place, so `assertOurBot` still returns true for a withdrawn bot. That is handled in the webhook route, app/api/meetings/transcript/[sessionId]/route.ts:103, which refuses when consent is not granted, recording is paused or `botLeftAt` is set.
4. lib/ai/notes.ts writes a draft that a patient might see. It is handled by `patient_status` (default 'draft', drizzle/0023) and the separate `approvePatientNote` (actions.ts:547). This holds except in Broken 8 and 9.
5. lib/documents/formats.ts:108 labels extraction `none` as "Searchable". That is correct: `none` means typed or dictated text (schema.ts:4373).
6. lib/documents/identity-access.ts gives `super_admin` every passport. `super_admin` is our platform role, not a clinic owner (schema.ts:96-103).
7. lib/ai/diarise.ts, the H11 cap: genuinely retired, with no LIMIT at 353.
8. lib/crisis/context.ts PRESENT markers are also substring matches ("know" contains "now"). That errs toward alerting, which is the safe direction.

## Unclaimed

(a) Worth selling, nothing advertises it:
- The per-patient copilot with sentence-level citations to transcripts and documents (lib/ai/case-copilot.ts). T5 covers access, not the citation feature itself as a selling point on a screen.
- The dated observation timeline and the standing profile with conflicts surfaced between history and sessions (lib/ai/profile.ts:57-83, 367).
- Diagnoses extracted only when written verbatim, with the source sentence (lib/ai/diagnoses.ts).
- Arabic, Egyptian dialect and Arabizi crisis scanning (lib/crisis/alerts.ts:147-303). Nothing public says the scanner reads Franco-Arab.

(b) Nobody should have it, a hole:
- Crisis scanning of journals and check-in replies with alerts to a clinician (lib/crisis, lib/data/journals.ts, lib/checkins/receive.ts). Nothing the patient was promised covers "we scan what you write and tell a clinician" (MAP Unclaimed 5), and lib/ehr/policy.ts:110 says journals come with "no watcher".
- Partner launch: a third party's server can obtain a full clinician session on demand (lib/partner/launch.ts; Suspect 1).
- Partner note delivery of full SOAP to a partner credential, outside grant and revocation (Broken 3).
- The meeting bot records third parties in couples or group calls on one person's consent (lib/meetings/dispatch.ts; Suspect 4).
- An unscheduled check-in message stream (lib/checkins) with no working opt-out by reply (Broken 2). The only opt-out left is a screen switch the mail preview mentions.

(c) Half built:
- The EHR note writeback (lib/ehr/file-note.ts `fileNote`) has no caller. The connection flow exists, so a practice can connect, but no note ever files, and the writebacks list (lib/data/ehr.ts:347) is empty forever. A refused filing could never be retried anyway (file-note.ts:160-178).
- Acoustic diarisation (lib/diarisation/*): no provider, and lib/data/session-voices.ts `recordVoices`/`attachLines` have no caller, so the voices panel on /sessions/[id] is always empty.
- Check-ins: sent, never received (Broken 2). There is also no WhatsApp template for `checkin.asking` (lib/notify/whatsapp.ts:48), so they go only to the minority of patients with email.
- `sessions.extendedAt`, documented dead (lib/session-clock.ts:31-36).

## Promise evidence

- **P2** (nothing only in an email). Partly. lib/notify/index.ts:301 writes the in-app notice only when a caller passes both `personId` and `notice`. lib/sessions/started-notice.ts does. Check-ins (lib/checkins/send.ts:126), the session report (mail.ts:171), invites (mail.ts:392) and record exports exist only in email. Who finds out about a failed send: a `delivery_attempts` row, whose reason says "no channel available" even when the provider rejected (index.ts:355), plus log lines. Nobody is alerted.
- **P3** (nothing machine-written reaches you unsigned). Partly. Kept: `patient_status` gating and three-field editing (actions.ts:493, 547), partner and EHR notes needing an approved note. Broken: regeneration after approval (Broken 8), the summary fallback (Broken 9), and partner summaries needing no approval of their own text (lib/partner/notes.ts:131, draft.ts:90). Machine-translated interface strings are drafts (translate.ts), so they cannot be judged from here.
- **P4** (one record, versions, patient decides readers). Partly. lib/documents/read-access.ts checks the grant on every document read. The profile (profile.ts:141-160) merges transcripts across all of the person's clinicians into prose every liveProfile clinician reads, which contradicts the consent wording "Only your therapist can see it" (consent.ts:31). The partner note path ignores revocation (Broken 3).
- **P5** (crisis path never depends on money). Kept for money: nothing in lib/crisis, lib/checkins or lib/session-finish's risk step reads a payment, price or subscription. But the crisis path itself is weaker than the promise implies: in-app-only delivery (Suspect 3), check-in replies unrouted (Broken 2), suppression misses (Broken 4).
- **T1** (draft from transcript, says draft until signed). Kept at generation: `status: "draft"` on insert (notes.ts:443), built from segments. The in-person variant is built from an unconsented recording (Broken 1). The note context still receives diagnoses (Stale 5).
- **T2** (off record: nothing kept, note silent). Partly. The capture layer keeps nothing while muted (recorder.ts:201), and the note prompt only sees what was kept. But the hole is invisible in the data, and provenance never records it (Broken 5). Nothing tells the model not to speculate about a gap. Going off record late can end the session (Suspect 6). The server does not enforce off-record at all: the transcribe route accepts any chunk the browser sends.
- **T5** (only the chosen clinician, cites source sentence, revoke stops next question). Partly. Citations resolve or are dropped (case-copilot.ts:706, chunk.ts:145). Revocation depends on the caller (Suspect 10). Broken 6 and 7 (oldest sessions, cross-numbered refs) undermine "the sentence it came from".
- **E1/E2** (sponsor never learns who or when). Kept in slice: lib/partner/employment.ts answers one boolean about enrolment and never usage; the sponsor mail previews carry no person (mail-previews.ts:431-454).
- **E3-like** for partners: see Suspect 8.
- **A5** (every read written down). Partly. partner note delivery, who-may-read and writeback are audited (api.ts:147, 324, 404). EHR filing is audited (file-note.ts:264). Staff record export is audited, but the staff member gets a live link (Broken 13).
- **Task 117** (anonymous sessions and memory): nothing in this slice handles anonymous identity. The only related facts: `generateAndStoreNote` accepts `patientId: null` (guest sessions still get a note and an in-session copilot), and a guest session has no person, so no profile and no copilot thread memory beyond the session (`recordSessionNote` with null patientId, outside slice).

## Coverage

| File | Lines | Status |
|---|---|---|
| lib/ai/assistant.ts | 486 | read |
| lib/ai/case-copilot.ts | 795 | read |
| lib/ai/client.ts | 300 | read |
| lib/ai/copilot.ts | 162 | read |
| lib/ai/diagnoses.ts | 243 | read |
| lib/ai/diarise.ts | 502 | read |
| lib/ai/note-writer.ts | 205 | read |
| lib/ai/notes.ts | 523 | read |
| lib/ai/profile.ts | 434 | read |
| lib/ai/risk.ts | 179 | read |
| lib/ai/transcribe.ts | 223 | read |
| lib/ai/translate.ts | 134 | read |
| lib/assistant/roster.ts | 125 | read |
| lib/audio/recorder.ts | 355 | read |
| lib/checkins/policy.ts | 149 | read |
| lib/checkins/receive.ts | 190 | read |
| lib/checkins/send.ts | 163 | read |
| lib/checkins/wording.ts | 98 | read |
| lib/clinical/context.ts | 177 | read |
| lib/clinical/currency.ts | 224 | read |
| lib/consent.ts | 109 | read |
| lib/crisis/alerts.ts | 511 | read |
| lib/crisis/context.ts | 327 | read |
| lib/crisis/fold.ts | 153 | read |
| lib/crisis/level.ts | 209 | read |
| lib/crisis/line.ts | 256 | read |
| lib/diarisation/align.ts | 182 | read |
| lib/diarisation/provider.ts | 62 | read |
| lib/diarisation/turns.ts | 197 | read |
| lib/diarisation/voices.ts | 263 | read |
| lib/documents/chunk.ts | 172 | read |
| lib/documents/extract.ts | 132 | read |
| lib/documents/formats.ts | 143 | read |
| lib/documents/identity-access.ts | 192 | read |
| lib/documents/layout.ts | 148 | read |
| lib/documents/read-access.ts | 92 | read |
| lib/ehr/fhir.ts | 239 | read |
| lib/ehr/file-note.ts | 286 | read |
| lib/ehr/owner.ts | 38 | read |
| lib/ehr/pending.ts | 103 | read |
| lib/ehr/policy.ts | 187 | read |
| lib/ehr/smart.ts | 300 | read |
| lib/ehr/vendors.ts | 130 | read |
| lib/ingest/token.ts | 160 | read |
| lib/integrations/registry.ts | 233 | read |
| lib/mail-previews.ts | 486 | read |
| lib/mail.ts | 601 | read |
| lib/meetings/create.ts | 157 | read |
| lib/meetings/dispatch.ts | 247 | read |
| lib/meetings/providers.ts | 90 | read |
| lib/meetings/recall.ts | 153 | read |
| lib/notify/email.ts | 34 | read |
| lib/notify/index.ts | 427 | read |
| lib/notify/whatsapp.ts | 231 | read |
| lib/partner/api.ts | 513 | read |
| lib/partner/billing.ts | 192 | read |
| lib/partner/consent.ts | 169 | read |
| lib/partner/copilot.ts | 174 | read |
| lib/partner/draft.ts | 109 | read |
| lib/partner/employment.ts | 226 | read |
| lib/partner/keys.ts | 415 | read |
| lib/partner/launch.ts | 313 | read |
| lib/partner/media.ts | 110 | read |
| lib/partner/notes.ts | 180 | read |
| lib/partner/platform.ts | 300 | read |
| lib/partner/route.ts | 92 | read |
| lib/partner/usage.ts | 283 | read |
| lib/partner/webhooks.ts | 373 | read |
| lib/partner/writeback.ts | 154 | read |
| lib/session-clock.ts | 158 | read |
| lib/session-finish.ts | 128 | read |
| lib/sessions/started-notice.ts | 125 | read |
| lib/transcript/descriptors.ts | 94 | read |
| lib/video.ts | 223 | read |

74 files, 17,248 lines, all read.
