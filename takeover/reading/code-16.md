# Slice 16: tests-evals

## Files

### evals/cases.ts (1164 lines)
- For: the hand-written synthetic fixtures for the note, risk and speech eval suites (PLAN 32.1).
- Decides: `SESSIONS` (16 note cases incl. FULL_LENGTH_SESSION: 10 en, 6 ar), each with `neverSaid` (trap terms that must not appear in a note), `stated` (facts, `|` alternates), `requiredSections` (CORE_SECTIONS excludes `soap.objective` on purpose, L100-119), `priorFacts`, `poisonFacts` (wrong-patient facts, values drawn from neverSaid, at least one `document` because C167 filters unverified AI rows, L61-76), `contradiction` {fact, mustSay, mustNotSay}. `RISK_CASES` (L885-1117): en/ar/arz(Arabizi) sentences with a hand label `risk`, half near misses; two KNOWN MISS rows kept deliberately (`en-news-overdose` L1080, `arz-film` L1114). `SPEECH_CASES` (L1143): 3 scripts synthesised with TTS voices for WER.
- Assumes: scorer in evals/metrics.ts does case-insensitive substring match; `Speaker` type from metrics.
- Promises: T1 (note from what was said, not invented) and the crisis-scanning capability (Unclaimed #5 in MAP). Evidence only; nothing here enforces anything.
- Notes: Comments state the numbers are an upper bound (synthetic, clean). `burnout-quiet-session` (L603-633) lists `work` and `sleep` in `neverSaid` while its own `priorFacts` holds "pacing, and saying no at work" (L627): in grounded mode a note that correctly cites the true prior fact is scored as a fabrication. Same shape risk wherever a neverSaid word is a substring of a true prior fact.

### evals/cases/diarisation.ts (333 lines)
- For: hand-built diarisation fixtures (PLAN 37.1-37.3): acoustic turns, transcript segment windows, gold labels derived from construction, and which segments a two-track capture "measured".
- Decides: 9 fixtures (clean-two, straddle, crosstalk, mostly-silence, couples-third-voice, group-five, track-dropout, evidence-disagrees, two-claim-therapist). Rules encoded as expectations: a half-and-half chunk is refused `contested`; room tone refused `silence`; a voice is named only if measured evidence proves it; no naming by elimination (L212-219, L295-298); ties leave a voice unnamed. `goldMatches` L312 compares per segment.
- Assumes: `lib/diarisation/align`, `turns`, `voices` types.
- Promises: P4/T1 indirectly (the right person's words in the right chart).
- Notes: `goldMatches` iterates gold only, so extra alignments beyond gold length are never reported (minor). Comment is honest that this is not a DER (gap 37.4).

### evals/cases/long-session.ts (603 lines)
- For: the single long (289 turns, counted: 289) bilingual Egyptian Arabic/English note case `cairo-long-session`.
- Decides: `stated` in Arabic with alternates (L105-114), `neverSaid` literal in Arabic and English (L131-140), priorFacts, poisonFacts (sertraline document verified, GAD ai), contradiction "lives alone in Maadi" with mustNotSay ["المعادي","بمفردها","لوحدها"] (L207-208).
- Promises: T1.
- Notes: THREE FIXTURE DEFECTS, see Broken: the transcript itself contains a `neverSaid` term and two `mustNotSay` terms.

### evals/coverage.ts (125 lines)
- For: the register of every module that calls a model, each either covered by a suite or named with a reason (PLAN 32.2). Read by `verify:sprint32`.
- Decides: `SURFACES` L31-98: measured: lib/ai/notes.ts + note-writer.ts (notes), lib/clinical/context.ts (grounding), lib/ai/diarise.ts (attribution), lib/ai/transcribe.ts (speech), lib/crisis/alerts.ts (risk), lib/ai/risk.ts (risk-model). Unmeasured (7): lib/ai/copilot.ts, lib/ai/case-copilot.ts, lib/partner/copilot.ts, lib/ai/assistant.ts, lib/ai/profile.ts, lib/ai/diagnoses.ts, lib/ai/translate.ts. `modelCallSites` L101 walks `lib` for `openai().chat|audio|responses|embeddings`, skipping lib/ai/client.ts.
- Assumes: every model call is written literally as `openai().x`; a call through another helper or `const c = openai(); c.chat` is invisible. Reads source WITH comments (T1): a comment quoting `openai().chat` would make a file look like a call site. `unmeasured()` count = 7 matches evals/unmeasured.json.
- Promises: T5 (case-copilot answer quality explicitly unmeasured, L63-67).
- Notes: skip list `entry.name !== "node_modules"` matches at every depth (H31 shape) but harmless under lib.

### evals/metrics.ts (340 lines)
- For: pure scorers: `normaliseWords` (Arabic alef/ta marbuta/ya folding, diacritics stripped), `wordErrorRate` (edit distance + traceback), `diarisationError` (refusals separate, gold-unknown lines excluded unless labelled), `noteText`, `claimScore`, `sectionCoverage`, `riskScore`, `pct`.
- Decides: `claimScore` L226-259: `has` is a SUBSTRING test over the space-joined normalised note (L230-231), not a word match. `stated` alternates split on `|`; `neverSaid` literal.
- Assumes: fixtures choose trap terms that never occur as substrings of legitimate words.
- Notes: substring matching produces false fabrications and false coverage. Examples from this slice: neverSaid `الأب` normalises to `الاب`, which is a substring of `الابن` (the son), and bereavement-arabic's own true prior fact is "الابن الأكبر في العائلة" (cases.ts L590, neverSaid L585). neverSaid `work` matches `homework`, `network`. stated `sam|tonight` is satisfied by any note containing `same`. stated `five|5` satisfied by `50`. See Suspect.

### evals/report.ts (198 lines)
- For: baseline read/write and the regression comparison for `npm run evals`.
- Decides: `compare` L163: WORSE when the wrong-way move exceeds `measurement.tolerance` (the tolerance from suite CODE, not the baseline's stored tolerance). `indeterminate` when spread > tolerance and move <= spread; still fails. `caseSetChanged` L153 compares only keys present in both.
- Notes: header L27-29 says each metric's band is "stated in the baseline where it can be argued with", but `compare` never reads `previous.tolerance`; a suite author can widen a band in code without touching baseline.json (Stale). `writeBaseline` writes evals/baseline.json.

### evals/run.ts (281 lines)
- For: the eval CLI (`npm run evals`, flags --suite, --offline, --repeat N, --record).
- Decides: without OPENAI_API_KEY every needsModel suite is silently dropped (L103) and the run can still print `evals: PASS` on the two offline suites (risk, and whatever else is offline: only `risk` is `needsModel:false`). Record refuses a partial run (L225). Case-set change fails the run (L239). A thrown suite exits 1 "INCOMPLETE" (L166-169).
- Assumes: suites return measurements in stable order across takes (`mean` indexes by position).
- Notes: `mean` L77 labels unioned details `run ${i+1}` using the index in the DEDUPLICATED set, not the take number, so "run 2" may be take 3. Minor. Header L21-24 says "Three of the four suites call the real models" while SUITES has six (five need a model): stale.

### evals/suites/attribution.ts (89 lines)
- For: runs shipped `attributeLines` (lib/ai/diarise.ts) over every SESSIONS transcript; gold = the fixture speaker per line.
- Measures: `attribution.der` (wrong over answered), `attribution.refused`, `attribution.straddles` (deterministic regex count, tolerance 0).
- Notes: value 1 when nothing answered (L59), so refusing everything is red. Comment "forty-line set" (L63) stale: with cairo-long-session the set is about 440 lines (baseline says the 281-line case alone).

### evals/suites/grounding.ts (216 lines)
- For: note generation with prior facts in three conditions: true facts, poisoned (other patient's facts), contradicted (PLAN 34.1).
- Measures: `grounding.unsupported`, `grounding.coverage`, `grounding.leak` (neverSaid hits in the poisoned note divided by count of POISON facts), `grounding.contradiction` (share of contradiction cases with no mustNotSay and every mustSay).
- Notes: `leak` numerator counts ANY neverSaid hit, not only poison values, and is divided by poison count, so it can exceed 1 and conflates fabrication with contamination (stated deliberately L119-125). Comments stale: "It is 0.0% against 18 planted terms" (L26-27), "with 9 poisoned facts, one leak is 11 points" (L185-187), "Five cases, so one is 20 points" (L204): the set now has 27 poison facts and 12 contradiction cases (my count from cases.ts + long-session). At 12 cases the 0.19 band is two cases, not "under one case". Baseline has contradiction 0.528 and leak 0.111 with spread 0.074 > tolerance 0.03.

### evals/suites/notes.ts (171 lines)
- For: the shipped note prompt (`noteFromTranscript`) over SESSIONS: unsupported planted terms, stated-fact coverage, required sections, language, and Arabic subsets.
- Promises: T1 (from what was actually said), P3 (patient's three fields scanned too, L67-73).
- Notes: stale comments: "an average across three cases" (L22), "One planted term in eighteen" (L112), "Fifteen facts across three cases" (L123), "One Arabic case, five facts" (L158): the set is 16 sessions, 6 Arabic.

### evals/suites/risk-model.ts (167 lines)
- For: `classifyRisk` (lib/ai/risk.ts) alone vs keyword floor (`scanForCrisisLanguage`) vs shipped combination via `levelFor`/`shouldAlert` (lib/crisis/level).
- Measures: model and combined sensitivity/specificity, combined per en and ar, `risk.model.unquoted`.
- Notes: Arabizi (`arz`, 11 positive) is not reported separately for the combined/shipped path (only en and ar filters, L77-78) although risk.ts insists Arabizi must be. Header "17 positives, 13 negatives" (L14-15) stale: 36 and 29 now.

### evals/suites/risk.ts (136 lines)
- For: keyword crisis scanner over RISK_CASES, offline, no model.
- Measures: overall sensitivity/specificity, en, ar, arz sensitivity, arz specificity. Tolerance 0.05.
- Notes: comment L88-90 "the scanner is a list of English phrases" stale (it carries Arabic, dialect and Arabizi per L104-106). Baseline: sensitivity 0.944, so the keyword floor misses 2 of 36 positives; the combined path is 1.0.

### evals/suites/speech.ts (131 lines)
- For: WER of `transcribeAudio` on TTS-synthesised audio (gpt-4o-mini-tts), with and without language hint; audio cached under `.evals-audio/`.
- Notes: 3 cases, one Arabic sentence. The report calls it a floor. Writes files to `.evals-audio/` (claimed git-ignored; not verified from this slice).

### tests/.hydration-zone.29342.ts (2 lines)
- For: a two-line script that prints `readerZone()` from lib/scheduling/tz. The `.29342` looks like a PID: a temp file a test writes and should delete (see hydration.test.tsx / timezones.test.ts entry).
- Notes: a leftover artifact committed to the repo. See Stale.

### tests/alarm.test.ts (245 lines)
- Exercises: lib/alarm.ts in real Chromium with the DEFAULT autoplay policy: locked and silent before a gesture; after a click the AudioContext clock moves; every oscillator note scheduled ahead of `currentTime`; urgent has more tones than ring; startRinging keeps going until stopRinging; a pre-gesture arm on reload does not swallow the next click; title flash restores.
- Can it fail: yes. Instruments `OscillatorNode.prototype.start` and compares `when` to `currentTime`; a regression to scheduling on a suspended context goes red. Needs a Chromium at /opt/pw-browsers or E2E_CHROMIUM, else Playwright default download.
- Promises: none directly (clinician hears a waiting patient; supports P1's "in a session" loop).

### tests/assistant.test.ts (144 lines)
- Exercises: lib/assistant/roster `linkRoster`, `mentionsIn` (10.3: a patient name becomes a link only if it matches a server-supplied roster entry; longest match; Unicode word boundaries for Arabic; names shorter than a floor ignored; stored mentions cannot resurrect an unmatched name).
- Can it fail: yes, each rule has a positive and negative case (T2 compliant).
- Notes: roster fixture uses "Omar Abdelgawad" and "حبيبة", the founders' names, as patient names. Harmless but see walkthrough notes on personal names.

### tests/attribution.test.ts (278 lines)
- Exercises: `planBatches` (H11: every segment covered, contiguous, batch <=120, ceiling <=40 batches), `straddlesTurnBoundary` (C35: question then answer in one chunk refused; runs of questions and multi-sentence lines not), `shouldCut` (recorder chunking at pause/floor/ceiling, 16k and 48k), descriptors `countWords`, `wordsPerMinute`, `pauseBeforeMs`.
- Can it fail: mostly yes. Two assertions cannot: L47 `assert.ok(450 - 160 > 0)` is a tautology; L266-278 "descriptors describe and never interpret" checks the names of three functions the test itself chose to import, so a new export called `moodScore` would never be seen.
- Notes: L69-76 says the straddle example is "verbatim from the branch database" and it is a crisis disclosure ("I wanna kill myself"); L83-87 Arabic lines likewise look recorded. evals/cases.ts L8-14 makes "nothing from a person" a rule. If the branch database held a real person's session, this is a real transcript fragment in git. See Suspect.

### tests/challenge.test.ts (65 lines)
- Exercises: lib/data/name-match `normaliseName`, `nameMatches` (PLAN 13.5-13.8: case, spaces, Latin accents, Arabic harakat stripped; Sara/Sarah, Ali/Aly, Mona/Mena differ; empty never matches).
- Can it fail: yes, both directions.
- Promises: P4 (a person reaches their own record, a stranger does not).
- Notes: does not test Arabic alef/ta marbuta variants (أحمد vs احمد, سارة vs ساره), which people type both ways; whether they match is untested.

### tests/checkins.test.ts (211 lines)
- Exercises: lib/checkins/policy `shouldSend`, `inQuietWindow`, `hourIn`, MIN_HOURS_BETWEEN=6; lib/checkins/wording `nextWording`, `isStopWord`, 12 wordings.
- Rules: quiet window wraps midnight; evaluated in patient timezone; unknown timezone treated as night; cadence floor 6h; mute-rate halt checked first and fires AT threshold; own mute, channel off, unreachable; no repeated wording; "I cannot stop crying" is not an opt-out, whole-message stop words in en and ar are.
- Can it fail: yes.
- Promises: none of the 25 (check-ins are Unclaimed).

### tests/clock.test.ts (182 lines)
- Exercises: lib/session-clock `sessionClock`, `capSeconds`, `formatRemaining`, DEFAULT_CLOCK_LIMITS (50 running, 10 countdown, hard stop at 60).
- Rules: same stage/remaining for both sides; silence ends a session only after the running time; no transcript (off record / declined recording) is never "abandoned"; parameterised ladder at other limits; zero countdown is a hard stop.
- Can it fail: yes.
- Promises: T2 (off record does not end the session, L123-138).
- Notes: a hard stop at 60 minutes regardless (`cap`) means a session in crisis at minute 60 is ended by the clock; the test asserts it as intended. Product question, not a test defect.

### tests/consent.test.ts (284 lines)
- Exercises: lib/access/state `accessStateFor`, `capabilitiesFor`, `explain`, `isLiveGrant`, `isGated`; lib/consent `lateRecordingStamp`; lib/settings/defs `parseGroup("copilot")`.
- Rules: no patient row = nothing even with a grant; unclaimed record cannot be granted (no liveProfile/patientFiles/request); no grant = revoked (default off); revoke stops new reading but keeps own transcripts, notes, old chat AND copilot; banner never accuses; grant expiry boundary exact; late-recording stamp threshold, zone, "not captured and do not exist"; copilot gate on for unclaimed_bare only.
- Can it fail: yes.
- Promises: T5 partly. The test asserts `revoked` keeps `copilot: true` (L111). T5 says a revoked grant stops the copilot "on the next question". This is consistent only if the copilot in `revoked` state reads the clinician's own material and not the patient's history; the test cannot tell. See Suspect.

### tests/coverage.test.ts (121 lines)
- Exercises: lib/settings/defs `coverageSplit`, `coverageNow` (sponsor/patient split).
- Rules: shares always sum to gross (swept 1..20000 cents step 7 x 0..100% step 5%, VAT 0 only); VAT on patient share only (C312); 0% leaves patient whole price (C345); 100% leaves 0 incl. tax; pending coverage applies by date with no job (C344); out-of-range clamped.
- Can it fail: yes, except L74: `3_333 % 500 === 0 ? 3_333 : 3_500` always yields 3_500 (dead ternary), and the "remainder lands on the patient's side" test only asserts |sponsor - exact| <= 1, so it would pass with the remainder on either side.
- Promises: E4 (arithmetic half only), E3 (not exercised: E3 is a booked session keeping its old split; `coverageNow` by date is a different rule).

### tests/crisis-line.test.ts (107 lines)
- Exercises: lib/crisis/line `lineForNumber`, `countryForNumber`, `crisisLine`; lib/phone/e164 `countryFromE164`.
- Rules: +20 gets 105 with menu steps in en and ar (verified 2026-09-14); +1 gets 988 no steps; SA/AE/GB/DE get null; national format refused; longest prefix; shared code answers only if countries agree; configured line wins without inheriting table steps.
- Can it fail: yes, with a control (L53-60) against a table that answers everybody.
- Promises: P5 (the number the SOS orb prints).
- Notes: H20-shaped change done right: L17-32 documents that the Egypt assertion was deliberately flipped from "no line" to "105" (C350).

### tests/diarisation.test.ts (326 lines)
- Exercises: lib/diarisation/turns (`normaliseTurns` discards/merges/sorts, `crosstalk`, `speakingTime`, `speechCoverage`, `voiceOrder`), lib/diarisation/align (`alignSegments`, `summarise`, share floor 0.75), lib/diarisation/voices (`rosterFor`, `tallyEvidence` needs 3 proofs, `bindVoices` ties = nobody, `resolveVoices`, `displayFor`, `speakerFor`), all against evals/cases/diarisation.ts fixtures.
- Can it fail: yes, and it pairs every refusal with an acceptance (C165): clean fixtures must refuse nothing (L110-119); an unnamed voice becomes named once it has its own evidence (L215-235).
- Promises: P4/T1 support: a partner's words are never put in the patient's chart by elimination (L198-213); a patient voice with no patient record is still "Speaker N" (L299-302).

### tests/documents-extract.test.ts (171 lines)
- Exercises: lib/documents/layout `columnCount`, `isInterleaved`, `linesOf`; lib/documents/extract `extractText` on real PDF bytes from tests/fixtures/make-pdf.ts; lib/documents/formats `readabilityOf`.
- Rules (C50): a two-column PDF extracts NOTHING (null -> "unsupported") rather than interleaved text; one bad page in ten makes the whole document unsupported; a short page is not judged; a left-margin label is not a gutter; no-text-layer PDF is unsupported; legacy .doc stored only.
- Can it fail: yes. Writes real files into `<repo>/.uploads/` and removes them after (L153-168), so it exercises the local-uploads read path.
- Notes: L171 `assert.ok(PAGE_HEIGHT > 0)` at module scope asserts nothing useful.

### tests/documents.test.ts (256 lines)
- Exercises: lib/documents/chunk (`chunkText` verbatim substrings, word and sentence boundaries incl. Arabic `؟`, deterministic numbering; `parseCitations`, `keepResolvableCitations` removes unresolvable `[D9:1]` and tidies spacing), lib/documents/formats (`documentProblem` 25 MB cap, accepted types, `searchabilityLabel` "Image, not searchable"), lib/ai/diagnoses (`verbatimIn` exact after whitespace reflow, case-sensitive, short strings refused; `parseRef`).
- Can it fail: yes. L115-117 "MIN_CHARS keeps a cut from producing a two-word citation" asserts only `0 < MIN_CHARS < MAX_CHARS`, not the behaviour it names.
- Promises: T5 (citations that resolve to real text; invented citations deleted, 8.5), P3 adjacent (a diagnosis only with a verbatim source sentence, 8.9).

### tests/e2e.test.ts (775 lines)
- For: the browser e2e of the clinical loop, run only through tests/run-e2e.sh (H21). 13 tests, sequential, sharing one therapist account created at run time (`e2e-<ts>@example.com`).
- Exercises, in order: home hero text; signup -> /onboarding gate and /sessions/new bounces back while unverified; DB-approved therapist reaches #guestName; walk-in session records audio from a fake mic, >=2 WAV chunks >20 KB uploaded; Off record: no upload in 11 s; End session -> note, sign via checkbox + "Publish what is ticked", prompt must not contain the patient's name, no "Send to patient" button; expired session lands on /login not a loop; notes list shows Approved; join by link with no account, consent question is a real gate; stranger books off the public radar (DB-inserted online row), consent step then room; priced session (DB-set 6000 cents) does not admit an unpaid patient; /api/radar flood returns 429 with Retry-After; therapist and patient in the same room, `[data-patient-joined]` shows the name, Daily iframe only if DAILY_API_KEY.
- Can it fail: yes, and H20 is its history: header L1-29 and L70-127 record five tests that asserted UI deliberately changed in sprints 41 (video toggle -> "Where" picker) and 47 (Approve -> Sign), sat red 15 sprints, and hid the walk-in `patients_phone_present` defect. They were rewritten (`signTheNote`, `chooseTheRoom`).
- Assumes: DATABASE_URL points at a writable non-production branch. It writes directly with no guard: `DELETE FROM rate_limits` (ALL rows, L193), inserts `therapist_verifications`, sets `users.verification_status = 'verified'` directly (L272-275), inserts `therapist_radar`, updates `users.session_rate_cents`, `sessions.price_cents/payment_status`, revokes `auth_sessions`. scripts/db.ts `connect()` has no production refusal. Leaves the user, sessions, notes behind (only the radar row is reset).
- Promises: T1 (note appears, says draft until signed: only the sign step is checked, not the "draft" wording), T2 partly (no upload while off record; does not check the transcript hole or the note), T4 partly (stranger join path; the signed-in patient "Joining as" path is not tested), P1 partly (radar to room, taps not counted), A1-adjacent (unpaid not admitted, but via a Stripe card path that fails because Stripe is unconfigured, not via the transfer rail), P3 partly (see Suspect on de-identification).
- Notes: see Stale and Suspect (duplicated comment L696-716; "the paid path is covered above" L493 while it is below; de-identification check reads `chatRequests[0]`, which is likely the diarise call, not the note call; direct write of a trigger-derived column).

### tests/evals.test.ts (194 lines)
- Exercises: evals/metrics.ts scorers against hand-computed numbers: `normaliseWords` (Arabic letters must SURVIVE, L37-50, the recorded vacuous-pass fix), `wordErrorRate` (sub/del/ins, empty hypothesis = 1.0), `diarisationError` (refusal not an error; labelling a gold-unknown line is), `claimScore`, `noteText`, `sectionCoverage`, `pct`, `riskScore` (both numbers move under alert-all and alert-none).
- Can it fail: yes.
- Notes: no test of `claimScore` against a substring false positive (e.g. `work` inside `homework`, `الاب` inside `الابن`), so the word-boundary defect in metrics.ts is not pinned either way. No test that a fixture's `neverSaid`/`mustNotSay` terms are absent from its own transcript, which would have caught the long-session defects.

### tests/facts.test.ts (219 lines)
- Exercises: lib/clinical/currency (`currencyOf` ages from effectiveAt, risk goes stale, diagnosis never does, default half-life 180; `ageLabel` en/ar; `priorityOf`/`maySupersede` clinician > document > patient > ai; `rankFacts` C166) and lib/clinical/context (`factsForPrompt`, `factsPrompt`).
- Rules pinned: C167 unverified AI facts never enter a prompt; C168 NO diagnosis is sent to the note generator; C170 `presentation`, `function`, `risk` never sent; disputed/unsupported/historical/stale never sent; rules precede facts in the prompt (H2).
- Can it fail: yes.
- Notes: these filters are what make the grounding eval mostly measure the filter rather than the model. See Suspect (grounding eval).

### tests/fixtures/make-pdf.ts (77 lines)
- For: builds a minimal valid one-page PDF from text placements (`makePdf`, `singleColumn`, `twoColumn`), used by documents-extract.test.ts.
- Notes: the two-column fixture pairs "Presenting concern" with "Sertraline 50mg daily", the exact interleave the extractor must refuse.

### tests/hydration.test.tsx (198 lines)
- Exercises: SSR/client hydration equality for `formatDate`, `formatDateTime`, `relativeDay`, `formatMoney` when the zone arrives as a prop, under TZ=UTC vs Africa/Cairo in separate child processes; control that reading `readerZone()` at render DOES differ; money identical under en-US and de-DE; `readerZone()` answers "UTC" on the server, never null.
- Can it fail: yes, and it has the control (T2).
- Notes: writes temp files INTO `tests/` (`.hydration-render.<pid>.tsx` L114, `.hydration-zone.<pid>.ts` L181) and removes them in `finally`; a run killed mid-test leaves them, which is exactly `tests/.hydration-zone.29342.ts`, now committed. `mkdtempSync` dir L113 is created and never used.

### tests/ingest.test.ts (234 lines)
- Exercises: lib/ingest/token `mintIngestToken` (si_ prefix, session id embedded, sha256 hex hash stored, hours expiry), `bearerFrom`, `sessionIdIn`, `ingestDecision` refusals (no_token, wrong_session both ways, no_source, not_issued, revoked before expiry, expired at the second, mismatch, malformed) and acceptance, repeated for many chunks; case-insensitive session id.
- Can it fail: yes, with the paired acceptance (C165).
- Notes: L142 passes `{ expiresAt }` cast `as never`, a key `sourceFor` does not use, so the "still valid a second before" half actually runs with the default one-hour expiry; it does not test the one-second boundary it names. Unclaimed capability: external meeting bot ingestion (MAP Unclaimed #1).

### tests/ledger.test.ts (421 lines)
- Exercises, against a REAL database via `dbFor(DEFAULT_REGION)`: lib/billing/ledger `journal` refuses unbalanced legs and writes nothing; destination charge books only the fee, no VAT liability; destination charge with VAT refused (C392); platform capture books gross+VAT as cash, VAT payable, held for therapist; invoice raised then settled from held earnings (netting: held falls by the bill, revenue recognised once); refund reverses held and VAT; write-off to platform_expense; bill paid by card is cash not revenue twice; platform-wide trial balance zero and no unbalanced transactions; entity transfer short arrival posts `fx_difference`, exact transfer posts no zero leg.
- Can it fail: yes. The platform-wide assertion L350-356 depends on everything else in the shared database (H29 shape): somebody else's broken row turns this red.
- Assumes: DATABASE_URL points at a writable non-production branch; nothing in the test or in lib/db refuses production. Creates org/user/invoices and deletes them in `after`.
- Promises: T3 (settle-from-held is the netting mechanism: kept at the ledger level), A2 not exercised (idempotency of confirm is elsewhere).
- Notes: the Egyptian manual-transfer rail (`manual_payments`) is not exercised here at all; only Stripe-shaped `destination`/`platform` captures.

### tests/locale-paths.test.ts (114 lines)
- Exercises: lib/i18n/paths `splitLocale`, `localisedPath` (idempotent), `isLocalisable`, `alternatesFor` hreflang.
- Rules: private paths (/patient, /dashboard, /notes, /admin, /login, /join, /api/documents) never get a second `/ar` URL (C153); `/article` and `/fr/pricing` are not locale prefixes.
- Can it fail: yes.

### tests/memory.test.ts (187 lines)
- Exercises: lib/ai/profile `keepCitedSections` (a section with any invented ref is dropped whole), `keepCitedConflicts` (two real refs required), `keepDatedObservations` (undated or absurd dates dropped; next-year allowed; sorted), `normaliseRef`; lib/data/memory `isStale`.
- Can it fail: yes.
- Promises: T5 (citations must resolve), P3-adjacent (machine text constrained before a clinician reads it).

### tests/money.test.ts (176 lines)
- Exercises: lib/billing/money `convert` (refund is exact negation, -0 case), `rateWithSpread`, `egpSettlement` (C76 disclosure fields), `crossingFor`, `holdsMoney`, `isCrossBorder`, `entityFor`, `payoutRailFor` (Egypt always manual), `collectionCurrencyFor`/`collectionRailFor` (patient country decides), `payoutCurrencyFor`.
- Can it fail: yes.
- Notes: L124-130 test is TITLED "no verification yet means no Connect payout on an assumption" and ASSERTS the opposite (`"connect"` for a null country). Title and assertion disagree: see Stale. `collectionRailFor("EG")` returns `local_egp` ("its own gateway" in ledger.test.ts L141-143), which reads as the pre-transfer-rail model (MAP contradiction 2).

### tests/mock-openai.ts (144 lines)
- For: HTTP stand-in for OpenAI used by e2e (`startMockOpenAi`): records transcription uploads (bytes, content-type) and chat requests (model, body); returns "Transcribed chunk N"; returns a diarise-shaped alternating `{turns}` when the system prompt contains "labelling the turns of a recorded therapy session"; otherwise returns a fixed SOAP NOTE.
- Notes: the fixed NOTE carries an `objective` section with observed affect ("Affect mildly constricted") which evals/cases.ts L100-111 says an audio-only session cannot support; harmless in a mock but it is the shape the product must not produce. Any other chat caller (risk classifier, copilot) also receives the note JSON. Because diarise and risk calls are recorded in the same `chatRequests` array, e2e's `chatRequests[0]` is not necessarily the note call.

### tests/patient-import.test.ts (177 lines)
- Exercises: lib/data/patient-import `parseImport`: quoted commas and doubled quotes, national numbers expanded by chosen country (C64), same digits under EG vs IT differ, international numbers keep their code, bad numbers refused with a reason, non-core columns (Notes, Diagnosis, Risk flag) NAMED as ignored and never imported, duplicate numbers reported, missing name/phone column refuses the file, bad email dropped not fatal, CRLF+BOM, spreadsheet line numbers.
- Can it fail: yes.
- Promises: P3/P4 adjacent (no clinical text enters a record without a clinician having written it).

### tests/people.test.ts (116 lines)
- Exercises: lib/data/people `assertClaimed` throws UnclaimedError for shared/merged/granted (5.5), message has no id, `isClaimed` treats epoch as claimed, `normaliseEmail`, `normalisePhone` (too short = null), `redactName` initials with bullets in Latin and Arabic.
- Can it fail: yes.
- Promises: P4 (an unclaimed record is nobody's to share).
- Notes: L110-116 title says "never reveals the length exactly by accident" while its comment says it DOES encode length; the assertion only checks the name is absent. Fixture names are the founders' (Habiba, Ahmed).

### tests/physics.test.ts (199 lines)
- Exercises: lib/finance/physics `fit` (two-term linear fit; refuses a single duration cluster and too few samples, with a control that accepts the realistic 3/8-minute spread), `costAt`, `naiveCostAt`: 50-minute cost vs naive extrapolation about 2x; whole-session composition lands near $0.036 at 4 min and $0.226 at 50 min; price change reprices without refitting.
- Can it fail: yes (constructed data).
- Notes: units are called microcents throughout but divided by 100,000 for dollars (L145, L151): that is H13's thousandths-of-a-cent unit, still named microcents (L100 "2,587.5 microcents" is 2.5875 cents). Budget figures tie to docs/simulation 00 and 03.

### tests/radar.test.ts (898 lines)
- Exercises, against a REAL database (`dbFor(DEFAULT_REGION)`, no production refusal): lib/data/radar `claimTherapist` (two concurrent claims, exactly one wins; pending cannot be reclaimed; expired claim claimable without sweep; stale release does not release another's claim; stale heartbeat refuses claim; `sweepRadar` takes offline; `listRadar` hides offline), reservations (holder can book, others cannot; reservation cannot displace a booking; release returns online; per-viewer `reservedByYou` from one cached board), `setOnline` stand-down (allowed while only viewed, refused with "booked you" when a session holds them, race never lets both succeed); lib/rate-limit `consume` exactly-N under concurrency, window rollover, `refund`, `takeHold`, `networkOf` /24 and /64, `subjectKey` hashes the IP; lib/data/sessions `completeSession` kills join token, keeps feedback token; lib/data/feedback `markAbandonedIfWaiting` exact deadline, idempotent, never for a started session; app/join/[token]/actions `checkJoinState` reports recording false after a refusal.
- Can it fail: mostly yes, genuinely concurrent. EXCEPT two consent tests that cannot fail: L746-783 "a patient who declines is not recorded, and the refusal is stored" and L816-837 "consent that was granted leaves the microphone alone" each WRITE the columns themselves with `db.update` and then read back what they wrote. Neither calls `submitJoin` or any product code. See Broken/Suspect.
- H20-shaped history done right: L588-617 records a test that asserted the join token reached feedback after the two-token design deliberately made that false; it was rewritten.
- Promises: P1 (radar booking integrity), T2-adjacent (refusal shows recording off on the patient's screen, L785-814: real), consent (task 123) only via checkJoinState.
- Notes: `after` deletes sessions, the user and the org but not the `therapist_radar`, `therapist_verifications` or `session_reports` rows it made; whether they cascade is not visible here. If not, an "online" "Radar Tester" row could survive on the public radar (the exact leak e2e.test.ts L549-551 worries about).

### tests/risk-level.test.ts (281 lines)
- Exercises: lib/crisis/level `levelFor` (keyword floor cannot be lowered by a model; model can raise; ladder ideation/plan/intent/means/timeframe; plan without ideation elevated; homicidal/psychosis critical; previous attempt moderate, no page; protective factors never subtract), `shouldAlert` (elevated and above), `atLeast`, `recommendedAction` en/ar; lib/ai/risk `traceable` (finding without a verbatim-ish quote dropped, unknown indicator dropped, confidence clamped, Arabic quote matched through folding); lib/crisis/context + fold (no marker folds to "", empty needle contains nothing, third party and resolved-past suppressed, present anywhere beats past, past tense alone never suppresses).
- Can it fail: yes, paired both ways (C165, C173).
- Promises: P5-adjacent (crisis detection; P5 itself is the button). Unclaimed #5 (journal scanning) rests on this.

### tests/routing.test.ts (436 lines)
- Exercises: lib/routing `routeDecision`, `ownerOf`, `PRINCIPALS`: patient paths never go to clinician login/dashboard whatever cookies; /patient vs /patients segment boundaries; sign-in pages bounce signed-in users home, `expired` lets a stale cookie see sign-in; reset and invite reachable signed out; admin to /staff/sign-in; table-driven C264 per principal (own prefixes, anonymous goes to that principal's door, another principal's cookie never admits and never changes the door, unread cookie treated as absent); C230 sponsor cookie reaches no clinical, staff or patient path; exactly six principals with distinct doors; no overlapping prefixes, with a planted-overlap control.
- Can it fail: yes. The control (L414-436) exercises a copy of `isUnder` defined in the test, not the production matcher.
- Promises: E2 (router half: sponsor cookie opens nothing clinical), A5 partly (refused screens redirect to the right door; "on the record" is not tested here), auth boundary priority 5.
- Notes: L302-310 says clinic and partner "carry no prefixes yet"; lib/routing.ts L304 and L321 give both CLINIC_PREFIXES and PARTNER_PREFIXES. Stale comment.

### tests/run-e2e.sh (71 lines)
- For: the e2e harness (H21): requires DATABASE_URL, sets NODE_ENV=production, fake AUTH_SECRET/OPENAI key (`sk-e2e-mock`)/STRIPE_WEBHOOK_SECRET/CRON_SECRET defaults, points OPENAI_BASE_URL at the mock on :8899, finds Chromium under /opt/pw-browsers, `next build`, kills any server already on :3100 with `pkill -f "next-server"`, starts `next start -p 3100`, waits, runs tests/e2e.test.ts.
- Assumes: DATABASE_URL is a disposable branch. Nothing here or in scripts/db.ts refuses the production endpoint, while e2e.test.ts deletes every `rate_limits` row and writes users, verifications, radar rows and sessions. No `writesTo()` guard (HAZARDS says 75 scripts carry one; this harness is not a script under scripts/).
- Notes: `pkill -f "next-server"` kills EVERY next-server on the machine, including a developer's or `verify:served`'s (H45/H46 shape, not self-kill). The default secrets are obvious placeholders, not real values. Also `next start` needs BLOB_READ_WRITE_TOKEN per HAZARDS ("refuses to boot without a blob token"); this script does not set one, so unless the caller's env has it, the app exits during startup. See Suspect.

### tests/safety.test.ts (1294 lines)
- Exercises (the "safety suite"): lib/crisis/alerts `scanForCrisisLanguage` (en phrasings, no false alarm on "killing my motivation"), `patientFacingCrisisMessage` (keys only helpline+message; no number without a country, C98; 988 for US; no risk/level words); lib/ai/notes `normaliseNote`, `isNoteEmpty`; lib/ai/transcribe `cleanTranscript`; lib/auth/password scrypt hash/verify/fail-closed/policy; lib/env `inspectEnv` (placeholder and short AUTH_SECRET refused; CRON_SECRET and BLOB token required; simulation branch must use the simulation endpoint and no other branch may); lib/billing/plans (`sessionLines`, `tierForSpend`, `entitledTier`, `tierByKey`, `quoteForSpend`); lib/settings/defs (`settingsProblem`, `parseGroup`, `platformFeeOn`, `sessionMoney`, `vatOn`, `presentedTotal`, `convertAtRate`, `collectionProblem`); lib/billing/connect `priceProblem`; lib/ai/client `__costing` (per-model transcription rates, unpriced model overstates, H13 units); lib/logger `ref`/`log.warn` scrub uuids; lib/ai/case-copilot `resolveCitations` drops invented refs; lib/observability/errors `scrubPath`.
- Pricing pinned: payg $1 platform + $3 AI (only when `aiConsented`), practice $80/mo, clinic $144/mo = 2 x $72 seat; $80 = 20 metered sessions; fee 15%; cap $500; subscribed session still raises both lines at zero; declined PAYG session still pays the $1; spend never reaches a subscription tier (with a planted ladder control); entitlement is the period paid for (past_due within period keeps plan; cancelled ends; retired keys grant nothing); a paid obligation outranks the Stripe mirror, due/lapsed/void grant nothing; unknown tier key bills full PAYG; platform fee zero refused; a named-but-unbuilt collection provider (Egypt `paymob`) refuses and points at "the free link".
- H20 notes in the file: L282-308 the tier test was rewritten after sprint 57 and "carried $99 and $179 for two sprints after the product was repriced ... because `npm run gates` did not run this file. It does now." L71-80 the 988-for-everyone assertion was deliberately changed (C98).
- Can it fail: mostly yes. Three tests CANNOT fail on any product change because they test arithmetic defined inside the test: L709-741 "two bookings racing cannot both spend the same pot money" (local `funds`/`debit`, never calls `payFromPot`); L832-856 "a sponsor cannot difference two balances down to one session" (local `publishable`; the only product value read is `activityFloor >= 2`); L1090 `assert.notEqual(r.presentedTotalCents, wrongOrder + 1, ...)` compares to an arbitrary off-by-one number. L800-830 "commission is denominated in the currency of the charge" only exercises `convertAtRate`, not the checkout that had the defect.
- Promises: P5-adjacent (patient crisis message), E1 (claims to test the differencing floor; see above, it does not test the product), E5/money (claims to test the pot race; does not), T3 not directly, A-series not exercised (no manual_payments here).
- Notes: four JSDoc blocks for C289, C377, C380, C381 are stacked at L659-708 with no test between them; each describes a test that appears later in a different order (layout stale, not wrong). L230 uses the production endpoint name `ep-wild-lake-a6tgm2r6` inside a fake `user:pass` URL: an identifier, not a secret.

### tests/scheduling.test.ts (142 lines)
- Exercises: lib/scheduling/hours `isWholeHour`, `floorToHour`, `nextHour`, `isBookable` (hold expiry compared not swept), `shouldAutoOffline` (15 min before and through the booked duration), `bookingWarning` (window, never for an hour in progress, rounds up, soonest wins).
- Can it fail: yes.
- Promises: P1-adjacent (radar does not offer a clinician about to be busy).

### tests/seats.test.ts (303 lines)
- Exercises: lib/settings/defs `seatMonthlyCents`, `seatChange`, `settingsProblem` over seat bands: one seat = solo $80; two = 2 x $72 = $144; retroactive not marginal (C323); 1->2 step is $64; each seat after the second is exactly $72; ladder never goes backwards and a backwards ladder is refused (with shipped-config control); proration on the whole monthly figure (62.3/C351); change day charged (62.4); reductions signed negative; public table rows derived from bands (62.10, arithmetic re-implemented in the test because the page cannot be imported); clinic never dearer than solo.
- H20 in the file: L23-33 seven of twelve tests went red on the sprint 75 reprice and stayed red because `npm run gates` did not run this file; now derived from settings with one literal anchor.
- Can it fail: yes.
- Promises: C3 (per-seat pricing arithmetic), C4 PARTLY: releasing a seat lowers the bill by exactly one seat ($72) only from 3+ seats. 2 -> 1 lowers it by $64 (L87-98 asserts the 1->2 step is $64), so "lower by exactly one seat" is false at the clinic minimum. Whether the clinician "lands on pay-as-you-go by themselves" is not tested here.

### tests/timezones.test.ts (328 lines)
- Exercises: lib/scheduling/tz (`formatTime`, `formatWhen` names the city, `formatWhenWithCaveat` says when it is not the reader's zone, `zonedHourToUtc` with Egypt DST and spring-forward gap refused, `dayKey`/`byDayIn` bucket by reader's day, `resolveZone` reader > clinician > UTC, `zoneLabel` city not offset, `isQuietHour` 22:00-07:00 in the reader's zone, `formatDay`/`formatCalendarDate` Arabic with Western digits, other session languages), lib/phone/e164 (`toE164` expands national numbers only with a country, no doubling, lengths, `e164Problem` explains, `isE164`, `countryFromLocale` suggests only).
- Can it fail: yes.
- Notes: two quiet-hour rules coexist: checkins policy (default 21:00-09:00, tests/checkins.test.ts) and scheduling `isQuietHour` 22:00-07:00. Different windows for different message types; not wrong, but two constants for one idea.

### tests/toasts.test.ts (77 lines)
- Exercises: components/session/copilot-toasts `mergeToasts`: stacks newest first, dedups case/space/punctuation incl. Arabic `؟`, drops empty, bounded at 6 keeping newest, keeps original arrival time, unique ids.
- Can it fail: yes.
- Notes: imports from a `components/` file into a node test, so that component module must stay importable without React rendering.

### tests/transcribe.test.ts (98 lines)
- Exercises: lib/ai/transcribe `normaliseLanguage` (null/""/auto -> null; region tags dropped; unsupported -> null), `chunkPrompt` (Arabic prompt in Arabic; unlisted falls back to English), `cleanTranscript` (Arabic and English subtitle artefacts dropped; "الحمد لله" and real speech kept).
- Can it fail: yes.
- Promises: T1 (the note is from what was said, in the language it was said).

### tests/transfer-rail.test.ts (193 lines)
- Exercises: lib/billing/pot `potTopUpMoney` (VAT on top, not carved out; zero-rate jurisdiction), lib/billing/manual `egpMinorFor` (1,000 EGP session = 1,140 EGP to send; tax in dollars then convert, with the other order shown; round once not per line), lib/db/schema `payableCents` (discount floors at zero), lib/settings `vatOn`.
- Can it fail: mostly yes. The "CONTROL" L178-193 computes `wrong` and `right` locally and never calls product code, so it controls nothing (it would pass if `grantPotTopUp` regressed). L154-174 sums `payableCents` locally, it does not exercise the picker it names.
- Promises: A1-A4 NOT exercised: no confirm, reject, idempotency or unmatched-line code is called. Only the pure pricing of the Egyptian rail.

### .walkthrough/lib.mjs (15 lines)
- For: first walkthrough's Playwright helpers: BASE localhost:3000, screenshots to docs/walkthrough (now git-ignored and deleted), Chromium at /opt/pw-browsers/chromium, phone viewport, `shot`, `text`.
- Notes: dead harness; the screenshot directory it writes to was deleted 2026-09-14 per .gitignore L47-52.

### .walkthrough/lib2.mjs (15 lines)
- For: `clearLimits()` runs `DELETE FROM rate_limits` (every row) against `process.env.DATABASE_URL` via neon, no guard of any kind; `signIn()` clears limits then signs in.
- Notes: an unguarded write that empties the production limiter if DATABASE_URL is production. See Suspect.

### .walkthrough/p25.mjs (19 lines)
- For: clears limits, opens /patient/login, signs in with phone +201001234567 and a literal walkthrough password (L12), opens /patient/claim to screenshot the "handle not proven" gate.
- Notes: literal credential for a local walkthrough account at L12 (not the demo password). See Secrets under Suspect.

### .walkthrough/run.sh (4 lines)
- For: runs a walkthrough script after `set -a; . ./.env.local; set +a` (L3).
- Notes: this is exactly the command HAZARDS H48 forbids: sourcing .env.local drops the four database URLs (unquoted `&`), so DATABASE_URL is empty and `clearLimits()` gets undefined. Stale and hazardous.

### .walkthrough/settings.mjs (10 lines)
- For: signs in as `yasmin@clinic.test` with a literal password (L5) and screenshots /settings.
- Notes: literal credential at L5.

### .walkthrough2/ar-check.mjs (19 lines)
- For: with the saved patient storage state and ar-EG locale, visits 14 /patient pages, prints the Arabic letter ratio, `dir`, horizontal overflow, and screenshots each.
- Notes: depends on `.walkthrough2/state-patient.json` (git-ignored, holds live session cookies).

### .walkthrough2/ar-dump.mjs (9 lines)
- For: dumps the first 700 chars of each patient page given on argv in Arabic.

### .walkthrough2/f1-therapist.mjs (20 lines)
- For: signs up the walkthrough therapist from people.json through /signup and saves browser state to state-therapist.json.

### .walkthrough2/f10-patient.mjs (15 lines)
- For: opens the patient invite link from invite.txt (git-ignored), prints fields/buttons, saves patient state.

### .walkthrough2/f11-signup.mjs (18 lines)
- For: from the invite link, follows "Create an account" to /patient/signup and lists the form.

### .walkthrough2/f12-create.mjs (19 lines)
- For: creates the patient account via `/patient/signup?invite=...` with people.json names and password, timezone Africa/Cairo; saves state.

### .walkthrough2/f13-claim.mjs (14 lines)
- For: patient opens the invite and presses "This is me, claim it"; saves state.
- Promises: P4 (claiming a record) walked.

### .walkthrough2/f14-session.mjs (10 lines)
- For: therapist opens /sessions/new and lists fields and buttons.

### .walkthrough2/f15-start.mjs (15 lines)
- For: therapist clicks a `Video` button (L8), picks patient "Layla Mansour", starts a session, writes the resulting URL to session-url.txt.
- Notes: the `Video` toggle was removed by design in sprint 41 (e2e.test.ts L112-124); this script is stale against the current UI.

### .walkthrough2/f16-room.mjs (18 lines)
- For: opens the session URL from session-url.txt with a fake microphone, starts, waits for 4 transcript lines, ends, screenshots.

### .walkthrough2/f17-approve.mjs (11 lines)
- For: clicks "Approve note" on the hardcoded session 7886c48f-... (L6-7) and lists /notes.
- Notes: "Approve note" was replaced by the Sign checkbox in sprints 26/47 (e2e.test.ts L70-90). Stale (H20 shape).

### .walkthrough2/f17b.mjs (10 lines)
- For: lists buttons on the hardcoded session page.

### .walkthrough2/f18-close.mjs (16 lines)
- For: ticks two checkboxes, fills the patient-facing text ("Layla decides who reads this."), presses "Publish what is ticked".
- Promises: P3 (signing and release) walked by hand.

### .walkthrough2/f19-claim-order.mjs (10 lines)
- For: patient opens /patient/claim and lists the form.

### .walkthrough2/f1b.mjs (17 lines)
- For: therapist sign-in with people.json credentials; saves state.

### .walkthrough2/f2-onboard.mjs (25 lines)
- For: fills /onboarding (country EG, regulator "Egyptian Ministry of Health", invented licence number, expiry, languages, specialties), saves, submits for verification.

### .walkthrough2/f20-code.mjs (11 lines)
- For: patient on /patient/claim presses "Send me a code".

### .walkthrough2/f21-stranger.mjs (17 lines)
- For: a stranger signs up at /patient/signup typing Layla's number (L9-13) to see whether the product hands over her record.
- Notes: literal password at L13. Promises: P4 negative case (a stranger with the same number must not get the record) walked.

### .walkthrough2/f21b.mjs (18 lines)
- For: same stranger attempt, prints any alert. Literal password at L9.

### .walkthrough2/f22-patient-tour.mjs (19 lines)
- For: screenshots 11 patient pages.

### .walkthrough2/f23-sos.mjs (13 lines)
- For: opens the SOS orb ("Get help now") on /patient.
- Promises: P5 (orb reachable) walked.

### .walkthrough2/f24-risk.mjs (24 lines)
- For: starts an IN-PERSON session for Layla (L8), presses Start session, waits 20 s, runs seed-risk.ts to write crisis transcript lines, ends the session, screenshots the risk panel.
- Notes: the walkthrough records an in-person session with no consent step visible in the script; relevant to task 123 (in-person recorded without consent). Cannot tell from here whether the product asked.

### .walkthrough2/f25-more.mjs (19 lines)
- For: therapist /settings/codes QR page, the evidence page of hardcoded patient 1602fb09-..., and the public /j/<code> landing.

### .walkthrough2/f26-qr.mjs (21 lines)
- For: creates a QR code labelled "Waiting room wall" and opens its public /j/ landing.

### .walkthrough2/f27-portability.mjs (13 lines)
- For: patient presses "Invite a therapist" on /patient/consent and prints any codes.

### .walkthrough2/f28-grant.mjs (18 lines)
- For: therapist enters a patient code on /connect ("Ask them"), then the patient's consent page shows the request.
- Notes: default code literal L6 is a one-time invite code from a past run, not a credential.

### .walkthrough2/f29-approve.mjs (15 lines)
- For: patient presses "Yes, until I change my mind"; therapist views evidence for the hardcoded patient.
- Promises: P4/T5 (patient decides who may read) walked.

### .walkthrough2/f3-submit.mjs (17 lines)
- For: presses "Submit for verification" and views the pending dashboard.

### .walkthrough2/f30-ask.mjs (18 lines)
- For: patient asks a clinician for their history with a reason; therapist sees the request on /connect.

### .walkthrough2/f31-decline.mjs (18 lines)
- For: therapist declines with a written reason; patient's consent page shows the decline.
- Promises: A3-shaped (a refusal carries a sentence the other side reads) for record requests, not money.

### .walkthrough2/f32-recheck.mjs (21 lines)
- For: re-checks that the SOS sheet no longer shows 988/United States for an Egyptian number, and that signed-out /patient/signup has no app chrome.
- Promises: P5 (crisis number correct for +20).

### .walkthrough2/f4-admin.mjs (19 lines)
- For: staff sign-in with people.json admin credentials, saves admin state, opens /admin/verifications.

### .walkthrough2/f5-approve.mjs (11 lines)
- For: admin presses the first "Approve" in the verification queue.

### .walkthrough2/f6-dash.mjs (10 lines)
- For: screenshots therapist dashboard, empty patients, sessions, notes.

### .walkthrough2/f7-patient.mjs (14 lines)
- For: opens "Add a patient" and lists the form fields.

### .walkthrough2/f8-add.mjs (20 lines)
- For: adds patient Layla Mansour with +20 1001234567 and her invented email.

### .walkthrough2/f9-invite.mjs (14 lines)
- For: opens Layla's chart and presses "Create an invite link".

### .walkthrough2/f9b.mjs (9 lines)
- For: on hardcoded patient 1602fb09-..., creates an invite and prints all input values.

### .walkthrough2/f9c.mjs (10 lines)
- For: prints the "Their own access" block and buttons on the hardcoded patient page.

### .walkthrough2/f9d.mjs (18 lines)
- For: presses "Issue a new one", extracts the /patient/invite/ link and writes it to invite.txt (git-ignored).

### .walkthrough2/lib.mjs (105 lines)
- For: walkthrough 2 helpers: BASE, SHOTS=docs/walkthrough-2 (git-ignored), PHONE/LAPTOP viewports, `browser`, `context`, `shot`, `text`, `anatomy` (counts headings, buttons, panels, words, dir, lang, horizontal overflow), `go`, `fill`, `click`, `log`.
- Notes: `mkdirSync(SHOTS)` runs at import (T6 shape: side effect on import, harmless).

### .walkthrough2/mock.ts (4 lines)
- For: starts tests/mock-openai on E2E_MOCK_PORT for the walkthrough server.

### .walkthrough2/peek.mjs (11 lines)
- For: signed-out page dump and optional screenshot for a path given on argv.

### .walkthrough2/probe.mjs (15 lines)
- For: lists fields and buttons of a therapist page given on argv.

### .walkthrough2/probe2.mjs (12 lines)
- For: inspects the computed style of the first `languages` checkbox on /onboarding (a hidden-input chip bug).

### .walkthrough2/probe3.mjs (20 lines)
- For: checks whether language/specialty chips on /onboarding stay checked after save and reload.

### .walkthrough2/probe4.mjs (13 lines)
- For: finds the floating button in the bottom-right corner of /dashboard and prints its HTML.

### .walkthrough2/probe5.mjs (9 lines)
- For: lists every link on the invite landing page.

### .walkthrough2/probe6.mjs (14 lines)
- For: finds the SOS button on /patient and prints position, visibility, z-index and pointer-events of every SOS element.
- Promises: P5 (is SOS on top and clickable) probed.

### .walkthrough2/probe7.mjs (16 lines)
- For: measures a large coloured block and nav overflow on /admin.

### .walkthrough2/probe8.mjs (11 lines)
- For: lists fields/buttons of any page for any saved state on argv.

### .walkthrough2/q.ts (9 lines)
- For: runs ANY SQL passed on the command line, via `sql.raw`, against `dbFor(DEFAULT_REGION)`.
- Notes: an unguarded arbitrary-SQL door (read or write) against whatever DATABASE_URL names; no `writesTo()` and no production refusal. Committed. See Suspect.

### .walkthrough2/re-signin.mjs (14 lines)
- For: patient sign-in by phone and password from people.json; saves state.

### .walkthrough2/routes.mjs (89 lines)
- For: hand-typed list of 71 routes with persona (out/therapist/patient/admin) for sweep.mjs, with `needs` ids filled from ids.json.
- Notes: a hand-typed route list (TRAPS T3). No sponsor, clinic, partner, staff-only or /join, /records, /feedback routes; admin list is 18 pages. Stale against the current product.

### .walkthrough2/seed-risk.ts (58 lines)
- For: "Walkthrough deviation W2": deletes a session's transcript segments and writes six crisis lines (better off without me, counting tablets) so `assessSessionRisk` has something to find, because transcription was mocked.
- Notes: unguarded DB write and delete via `dbFor(DEFAULT_REGION)`. Synthetic text.

### .walkthrough2/stub-docs.ts (39 lines)
- For: "Walkthrough deviation W1": writes `example.invalid` URLs into a therapist's verification document columns because blob storage was not configured.
- Notes: unguarded DB write. Honest in its header that the upload path was not walked.

### .walkthrough2/sweep.mjs (84 lines)
- For: every route in routes.mjs x 4 personas x en/ar x phone/wide: status, landing path, anatomy counts, console errors, first 160 chars; writes .walkthrough2/sweep.json (git-ignored) and screenshots.

### .walkthrough2/up.sh (25 lines)
- For: boots the walkthrough server: sources .env.local (L3, the H48 hazard), NODE_ENV=production, mock OpenAI key and placeholder secrets, `pkill -f "next-server"` and the mock, starts the mock and `next start -p 3000`.
- Notes: same H48 defect as .walkthrough/run.sh; the DATABASE_URL the server gets depends on the shell rather than the file. Placeholder secrets only, no real values.

### .walkthrough2 data files not on the slice list but asked about (read in full)
- `ids.json` (1 line): two UUIDs, a patient id and a session id from a local walkthrough database.
- `session-url.txt` (1 line, no trailing newline): `http://localhost:3000/sessions/<that session id>/room`. A localhost link, not a live public link.
- `people.json` (22 lines): four invented walkthrough personas (admin, two therapists, one patient) at `.test` domains with first/last names, an Egyptian test phone number and PLAINTEXT PASSWORDS for each (4 passwords, values not copied here). Not the documented demo password.
- Should they be committed in a public repo: ids.json and session-url.txt carry no personal data and no live link (localhost, local UUIDs): harmless but pointless. people.json holds no real person's data (`.test` domains, invented names, the same fake +20 100 123 4567 used throughout the tests) but does commit four working passwords for accounts that exist in whatever database the walkthrough ran against; if that was the shared dev branch, those accounts (including a staff admin) are signable with these passwords. Recommend removing people.json from git (the .gitignore already excludes state-*.json and invite.txt for the same reason, L39-43) and rotating or deleting those accounts. The storage-state files with cookies are correctly ignored and absent.

### postcss.config.mjs (7 lines)
- For: Tailwind v4 via `@tailwindcss/postcss`. Nothing else.

### public/audio-recorder.worklet.js (45 lines)
- For: the AudioWorklet that forwards raw mono Float32 frames to the main thread (which builds complete WAV chunks), replacing MediaRecorder timeslices whose chunks 2..N were undecodable.
- Decides: while `muted` (set by a port message), `process` emits NOTHING (L33-39): off record means no audio leaves the device, not audio discarded downstream.
- Promises: T2 (kept at this layer: while muted no frames are posted). Whether the main thread sets `muted` for every off-record path, and whether an in-person session ever arms this worklet without consent, is outside this slice.

### package.json (244 lines)
- For: the npm manifest. `engines.node` "22.x" (L7) while `.nvmrc` says 20 (see Stale). Dependencies include playwright as a RUNTIME dependency (L222), stripe, openai 4, drizzle-orm 0.38, next 15.5, resend, @vercel/blob, @daily-co/daily-js, unpdf, mammoth. `typescript` pinned exactly 5.8.2.
- Every npm script, grouped:
  - Build and app (6): dev, prebuild, build, start, lint (deliberately exits 1: "No linter is configured"), typecheck.
  - Gates and sweeps (6): gates, prose, i18n:count, verifiers, suites, inventory, lifecycles (7 with lifecycles; inventory and lifecycles are generators/sweeps).
  - Unit and DB tests (27): test (runs ONLY tests/safety.test.ts), test:db (radar, DB), test:alarm, test:e2e, test:ledger (DB), test:transfer-rail, test:physics, test:clock, test:toasts, test:transcribe, test:evals, test:facts, test:crisis-line, test:diarisation, test:risk, test:ingest, test:locale, test:attribution, test:people, test:routing, test:consent, test:documents, test:extract, test:hydration, test:challenge, test:money, test:memory, test:assistant, test:scheduling, test:timezones, test:coverage, test:seats, test:checkins, test:patient-import. There is no script that runs every file in tests/ at once; `npm test` is one file.
  - verify:sprintNN (60): 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 11r, 12, 13, 13r, 14, 15, 16, 17, 18, 18r, 19, 20, 21, 21r, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 35r, 36, 37, 37l, 37l2, 37r, 41, 43, 44, 45, 46, 47, 48, 49, 50, 51, 53, 54, 55, 56, 57, 59, 60, 61, 62, 63, 65, 66, 67, 68, 69, 76, 77 (no 3, 22, 23, 38-40, 42, 52, 58, 64, 70-75).
  - other verify:* (40): nul, actuals, cast, limits, payout, physics, runbook, demo, migrations, radar-place, palette, contrast, machines, traps, csp, email-dns, c285, claims, reachable, principals, synthetic, age, boundary, finance, plan, rail, raw-sql, cycle, served, caseload, orb, profile, edges, entitlement, board, money, notices, prove.
  - Seeds and DB writers (15): db:generate (drizzle-kit generate, which H19 says must never run without --custom, and this script has no --custom), db:migrate, db:seed, db:setup, db:reset, demo:seed, demo:purge, seed:coverage, seed:demo, simulate:seed, age, grant:admin, settings:seed, settings:reprice, ship:content, content:sync.
  - Settings and state (5): settings:show, settings:rails, settings:check, settings:compare, baseline.
  - Production and live (6): on:production, check:live, survey:live, smoke, render:check, audit:csp-enforced; plus whatsapp:check, audit:daily-hosts.
  - Evals, money and reports (13): evals, copilot:exam, benchmark:ai, physics, spend, forecast, plan, prove, logins, probe, screens, screens:prep, mail:preview, capture:payments, capture:coverage, capture:therapist.
- DB writes without a production guard (flag, from grepping each target for `writesTo`): `db:reset` (scripts/reset.ts TRUNCATEs every public table with only `--i-mean-it` plus a typed host, no production refusal, reset.ts L102-126); `grant:admin` (scripts/grant-admin.ts inserts/updates `users`, and says it "is allowed to touch production, on purpose", L28-30); `test:db`, `test:ledger`, `test:e2e` (tests write through lib/db or scripts/db with no refusal); `db:setup` L40 runs its 2nd and 3rd steps as bare `tsx` without `--env-file-if-exists`, so they use the shell's DATABASE_URL, not the file the first step used (a split-brain). `prebuild` runs `settings.ts seed` against whatever DATABASE_URL the BUILD has (production on Vercel), and `|| echo 'settings seed skipped'` swallows a failure: by design per HAZARDS (settings is one of the four allowed through), but it means every production deploy writes to the production database before `next build`.
- Notes: `db:generate` without `--custom` is the exact command H19 forbids, sitting in the manifest with no warning.

### vercel.json (25 lines)
- For: Vercel crons. Five, all UTC: `/api/cron/crisis` 03:00 daily; `/api/cron/billing` 03:05 daily; `/api/cron/retention` 03:10 daily; `/api/cron/extract` 03:15 daily; `/api/cron/reminders` hourly at :20.
- Notes: README lists 3 and TAKEOVER says six (MAP Stale #2); the file has five. The crisis cron runs ONCE A DAY: any crisis-alert re-delivery that depends on it is up to 24 hours late (safety.test.ts L166-170 calls it "the crisis alert sweeper").

### tsconfig.json (43 lines)
- For: strict TS, bundler resolution, `@/*` path alias, includes type dirs under `.next/d2`, `.next/served`, `.next/types`, `.next/build-probe`.
- Notes: `include: **/*.ts` covers `.walkthrough2/*.ts` and `tests/.hydration-zone.29342.ts`, so leftover harness files are typechecked with the product.

### .env.example (70 lines)
- For: environment template. Required: DATABASE_URL, AUTH_SECRET, OPENAI_API_KEY, STRIPE_WEBHOOK_SECRET, APP_URL. Recommended: DAILY_API_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY, EMAIL_FROM, CRON_SECRET. Per-environment: DATABASE_URL_PRODUCTION, DATABASE_URL_DEV, DATABASE_URL_SIMULATION (local only). SIMULATION_RUNNING. Optional: DATABASE_URL_DIRECT, DATABASE_SSL, SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN. Seed only: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_TEST_EMAIL, SEED_TEST_PASSWORD. Required: BLOB_READ_WRITE_TOKEN (L66-70).
- Secrets: all placeholders are obviously fake (`sk-...`, `whsec_...`, `user:pass@ep-xxx`) EXCEPT L64 `SEED_TEST_PASSWORD`, which carries a realistic-looking literal password for `test@24therapy.app` (a real domain). Value not copied. If seed.ts ever ran with it on a shared or production database, that account is signable. Report as a finding.
- Notes: CRON_SECRET sits under "Strongly recommended ... degrades without them" (L13) while lib/env makes it REQUIRED in production (safety.test.ts L164-183). Stale. No `ALLOW_LOCAL_UPLOADS` line although L69 tells the reader to set it.

### .nvmrc (2 lines)
- For: Node 20, plus a comment line "Reviewed: 2026-06-13". `package.json` engines says 22.x. One of them is wrong; Vercel follows engines.
- Notes: a comment line in .nvmrc is not a format nvm documents; nvm reads the first line, so harmless.

### drizzle/meta/_journal.json (817 lines)
- For: the migration ledger (H1, H16-H19).
- Checked: 116 entries, idx 0..115 contiguous, tags 0000..0115 contiguous with no duplicate numbers, every tag has a .sql file on disk and every .sql file is journaled (no H17 gap). `when` is STRICTLY increasing across all 116 (no H18 unreachable entry). Values are synthetic: 0000 = 2026-08-09, 0035..0101 step by 1 ms each ending 2026-09-16 23:06:40.067; 0102..0111 step 10,000 s from 2026-09-18 02:53; 0112..0114 on 2026-09-21 03:06 to 04:46:40; 0115 is exactly 1 s after 0114 (hand-adjusted, per H18). The latest `when` (2026-09-21 04:46:41 UTC) is before today, so no entry is "ahead of the wall clock" now. 68 consecutive gaps are 1 ms. All version 7, breakpoints true.

### .simulation-wave1.json (5 lines)
- For: marker that wave 1 of the simulation started 2026-09-16T23:46:10Z and was aged 180 days 15 seconds later.

### .simulation-wave2.json (5 lines)
- For: wave 2 started 2026-09-16T23:46:34Z, aged 30 days.
- Notes: both waves were run and aged within one minute of each other, 40 minutes after migration 0101's synthetic `when`. evals/production-baseline.json was recorded 2026-09-17T00:38 against production, AFTER these markers; H36 says the baseline describes production before the simulation. If these files describe a production run, the "before" snapshot was taken after. Cannot tell from here which database the waves ran on.

### evals/baseline.json (180 lines)
- For: the committed eval baseline, recorded 2026-09-16 over 16 sessions, 65 risk cases, 3 speech cases, 3 takes.
- Key figures: attribution.der 6.4% (all in cairo-long-session); grounding.contradiction 52.8%; grounding.leak 11.1% (spread 0.074 > tolerance 0.03, so noisier than its band); notes.unsupported 1.4%; notes.coverage 72.7%; notes.language 93.75% pinned (one English note tagged `es`, known, C169); risk.combined sensitivity 100% en and ar, specificity 86.2%; keyword floor sensitivity 94.4% (ar 90.9%, arz 100%, arz specificity 83.3%); speech WER 2.8%, Arabic 0%.
- Notes: the `whyRecorded76` paragraph states the previous baseline had been un-comparable since sprint 35R because credits ran out (H20 with a bill). `spread` is recorded only for model suites; the offline `risk.*` metrics carry none.

### evals/cases.json (7 lines)
- For: high-water mark of case-set sizes read by `verify:sprint35r` (fails when a set shrinks).
- Notes: says sessions 15, riskCases 48, measured 2026-09-14. The set is now 16 and 65 (baseline.json). As a floor it still holds, but the comment's claim to be "the high-water mark" is stale by 1 session and 17 risk cases.

### evals/physics.json (209 lines)
- For: measured token counts for note, risk, copilot, diarise at 3/8/20/50 minutes against the live API (2026-09-14), linear fits, session cost ($0.025 at 3 min, $0.217 at 50 min, naive extrapolation $0.423), benchmark spend $0.128.
- Notes: the note's fitted fixed input is ~995 tokens and 198/min; tests/physics.test.ts uses a different synthetic shape (1550 fixed, 200/min), which is fine because the test builds its own data. Transcription priced at $0.003/min.

### evals/production-baseline.json (126 lines)
- For: row counts of 118 production tables recorded 2026-09-17T00:38Z against host `ep-wild-lake-a6tgm2r6-pooler.us-west-2.aws.neon.tech`, snapshot `snap-old-sea-a60wgj3s`, for `npm run baseline -- check` after a simulation restore.
- Notes: H36 says this is now stale by design (migration 0111 and the seed happened since; `check` exits 1). Names the production host and snapshot id: identifiers, not credentials. Shows production then had 2 users, 1 session, 1 manual_payment, 28 content_pages, 0 sponsors.

### evals/prose.json (101 lines)
- For: per-portal ratchet of rendered prose words (`npm run prose`, `verify:sprint65`): `origin` (sprint 65, never written), `baseline` (current ceilings), `sinceOrigin` allowances (admin +378, public +1547, shared +256) and a long argued log per sprint.
- Notes: current baseline: shared 1575, patient 3943, public 5630, clinician 6484, sponsor 1057, admin 2942, clinic 1083, partner 1410, legal 1377, measured 2026-09-21. `origin.public` is 4083 while the comment says public origin was 5460 before `legal` split out (5460 - 1377 = 4083, consistent). The file records several failures of gates not being run (sprint 65 entry in _i18n-coverage.json, sprint 76c).

### evals/unmeasured.json (5 lines)
- For: high-water mark of model surfaces without an eval: 7, raised by sprint 68 (lib/partner/copilot.ts). Matches evals/coverage.ts (7 null suites).

### scripts/_i18n-coverage.json (37 lines)
- For: ratchet of English literals left in markup per surface (`verify:sprint37l`): patient 0, auth 4, portal 1, admin 753, shared 69; `directDictionaryReads` 0; a per-sprint argued log.
- Notes: records that the gate was not run between sprints 52 and 65 (L20) and that admin English is a decision (37L.3). The "floor, not a total" limitation (H23) is stated in L12.

### scripts/_region-pins.json (9 lines)
- For: ratchet of region-pinned call sites (`verify:sprint30`): 89 call sites in 84 files, measured 2026-09-17.
- Notes: records two commits that raised pins without raising the number, leaving verify:sprint30 red on main (sprint 48, 76b): the same H20 pattern.

