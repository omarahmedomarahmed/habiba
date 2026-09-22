# Slice 16: tests-evals

## Files

### evals/cases.ts (1164 lines)
- For: the hand-written synthetic fixtures for the note, risk and speech eval suites (PLAN 32.1).
- Decides: `SESSIONS` (15 note cases incl. FULL_LENGTH_SESSION: 9 en, 6 ar), each with `neverSaid` (trap terms that must not appear in a note), `stated` (facts, `|` alternates), `requiredSections` (CORE_SECTIONS excludes `soap.objective` on purpose, L100-119), `priorFacts`, `poisonFacts` (wrong-patient facts, values drawn from neverSaid, at least one `document` because C167 filters unverified AI rows, L61-76), `contradiction` {fact, mustSay, mustNotSay}. `RISK_CASES` (L885-1117): en/ar/arz(Arabizi) sentences with a hand label `risk`, half near misses; two KNOWN MISS rows kept deliberately (`en-news-overdose` L1080, `arz-film` L1114). `SPEECH_CASES` (L1143): 3 scripts synthesised with TTS voices for WER.
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

