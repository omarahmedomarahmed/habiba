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

