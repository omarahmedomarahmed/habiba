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

