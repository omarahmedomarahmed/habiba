# Slice 15: scripts (part 4 of 4)

Legend used below for verifier traps: T1 = reads source with comments in (readFileSync on a .ts
path instead of `readSource`); T2 = no control; T3 = hand typed route list; T4 = truncated
output; T6 = runs main() on import / argv suffix guard. "Syntax" = asserts a spelling rather than
a property. "One of N" = reads one file of several that implement the thing. "Wrong medium" =
looks for the answer where the product does not give it.

## Files

### scripts/verify-sprint48.ts (359 lines)
- For: sprint 48 gate, the in-room copilot is free, bounded to the record before `startedAt`, and the free window ends with the session clock.
- Decides / checks:
  - 48.2 (l.69-130): reads the FIRST `copilot_threads` row (LIMIT 1) and the first session in that org, raw-inserts two `copilot_messages` (one with `sessionId`, one null) and asserts `checkQuota().used` moves only for the null one. Real DB rows, real function. Control present (between-sessions question still counts). Good.
  - 48.6 (l.145-202): raw-inserts an `in_progress` session for the first patient of that org, asserts `liveSessionForPatient` returns it, ages `startedAt` past `runningMinutes + countdownMinutes + 60` and asserts null. Both halves present. Fragile: if that patient already has a real in-progress session, `fresh?.id === freshId` may pick the other one.
  - 48.4 (l.217-244): SOURCE regexes on `lib/ai/case-copilot.ts` (`liveSince\?: Date \| null`, `buildPatientContext\(opts\.patientId, before\)`) and `lib/data/journals.ts` (`lt\(journals\.createdAt, opts\.before\)`). Syntax, not property: a rename of the parameter fails it; a bound applied wrongly elsewhere passes. `!/recordingConsent/` on case-copilot.ts only is an absence check with no control and is one of N (context assembly also lives in journals.ts / transcript readers, not scanned).
  - 48.5 (l.257-283): `troom.ask.bound` key present in ask-panel.tsx, and the English string says "only know what came before" and not "not being recorded". Reads the dictionary (right medium). Prompt carries "TIME BOUND THAT OVERRIDES EVERYTHING BELOW" (syntax).
  - 48.10 (l.287-324): patient can stop recording: `stopRecording` in patient-room.tsx and exported from app/join/[token]/actions.ts; the body (sliced from that export to END OF FILE, not to the function end) sets `recordingPausedAt: new Date()` and has no `delete(transcriptSegments)`. Because the slice runs to EOF, a later function in the file that deletes segments would fail it (false red), and the positive regex could be satisfied by a later function (false green).
  - 48.9: chat.tsx polls (`setInterval`, `copilot/live?patient=`, no `WebSocket`).
  - 48.7 (l.346-354): `indexOf("accessFor(actor, patientId)") < indexOf("checkQuota(actor, found.thread.id)")` in app/(app)/copilot/actions.ts. Ordering by first textual occurrence, syntax-bound.
- Reads: DB rows (threads, sessions, patients, copilot_messages), source via `readSource` (T1 clean), `lib/i18n/messages` en.
- Traps: T1 clean. T2: DB halves have controls; source absence checks do not. T3/T4 n/a. T6: bare `void main()` at l.359, fine as long as nothing imports it.
- Assumes: `required()` fixtures exist (a thread, a session, a patient in the same org). Writes via `writesTo()` so refuses production.
- Promises: T5 (copilot only while allowed, the 48.7 ordering). Kept as far as a textual order check can say. Checked separately: `app/(app)/copilot/actions.ts:115,150` sets `sessionId` from the server-derived `live?.id`, not client input, so the free path cannot be claimed by a client.
- Notes: the in-room message is attributed to ANY session in the org (l.71-79), not a live session for that patient; the test proves "a message with a sessionId is not counted", not "a question asked in a live room is not counted". The link from live room to sessionId is `copilot/actions.ts:115`, which this gate does not exercise.

### scripts/verify-sprint49.ts (404 lines)
- For: sprint 49 gate, AI cost ledger (cost_microcents not cost_cents), patient attribution column, rates in settings, platform bucket, consent rate, revenue split, and the corporate wall (C244).
- Decides / checks:
  - C279 (l.63-103): walks `lib/data`, `lib/console`, `lib/billing`, `app` (derived, not hand-typed; `sources.length > 200` is a width control) for `aiRequestLogs.costCents` via `readSource` (T1 clean). Control: at least 3 files read `costMicrocents`. Both halves present. Excludes any file whose path ENDS WITH `client.ts` (l.78): suffix match, so e.g. `lib/partner/api-client.ts` or any `*client.ts` in those roots is silently exempt. Trap T6's suffix shape applied to an exemption.
  - l.128-150: plants an ai_request_logs row costing 40 units with cost_cents 0 and asserts the columns disagree. Planted, so it is no longer vacuous (C284). Deletes by `model = PLANT`, not in a `finally`.
  - 49.14a: information_schema says `ai_request_logs.patient_id` is nullable uuid. The detail text claims ON DELETE SET NULL, which is not checked.
  - 49.14b: settings rates equal `__costing.TOKEN_RATES/AUDIO_RATES` shipped constants (compares to code, not a retyped number). Frozen-at-write asserted by regex on client.ts (syntax).
  - 49.14c: plants a null-org call, asserts `costByAccount` and `costByPatient` return a `PLATFORM_BUCKET` row and that its cost is at least 75,000. Control present.
  - 49.4: consent buckets sum to total; percent null only when total 0. Runs over whatever is in the DB (no plant); if total is 0 the arithmetic check is trivially true.
  - 49.5: revenue fields are `number` typed. Type check only, not a value check.
  - 49.11: `!/platformFeeCents \+ aiFeeCents|totalRevenue\s*=/` on usage.ts. Absence of one spelling; no control.
  - 49.13 / C244 (l.339-399): the corporate wall. Reads ONLY `lib/data/usage.ts`, `lib/data/admin.ts`, `lib/data/vault.ts` (hand-typed list of 3). A file fails if it mentions any of `sponsors|sponsorPots|sponsorSeats|enrolments|sponsorDomains` AND any of `sessions|patients|people` anywhere in the file (co-occurrence, not a join). Controls exist but test the regexes against two literal strings, not against the files.
- Reads: source (readSource), DB rows (planted), settings.
- Promises: E1/E2 (the wall). See Suspect: the wall check does not read the sponsor portal files at all.
- Notes: `sponsorSeats` does not exist in `lib/db/schema.ts` (the exports are `sponsors`, `sponsorUsers`, `sponsorAuthSessions`, `sponsorCodes`, `sponsorIdentifierFields`, `sponsorDomains`, `enrolments`, `sponsorPots`, `enrolmentVerifications`, `enrolmentAttestations`); the regex misses `sponsorCodes`, `sponsorIdentifierFields`, `enrolmentVerifications`, `enrolmentAttestations` and any pot ledger table.

