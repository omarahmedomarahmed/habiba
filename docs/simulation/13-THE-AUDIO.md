# Where the audio comes from, and the budget line nobody costed

Sixty-two sessions. **286 minutes of audio.** Every note in this run is generated from a real
transcription of real audio by the real model, because that is the only way the cost per session
this run produces means anything.

An agent cannot speak. This document is how the audio exists anyway, and it was written because
the other twelve documents did not say, which would have been discovered in wave 1 by an agent
improvising.

## The mechanism already exists and has been in use since sprint 32

`evals/suites/speech.ts` synthesises every one of its cases from a written script:

```ts
const spoken = await openai().audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice,
  input: script,
  response_format: "mp3",
});
```

and caches the result under `.evals-audio/`, which is git-ignored, so a re-run costs one
transcription rather than a synthesis and a transcription. Three files are sitting there now.

**So the run does the same thing.** `10-THE-STORY.md` already holds the script for every session
with its planted facts, which is exactly the `input` that call wants. Nothing new has to be
built.

## The three doors into a session, and which one to use

`app/api/sessions/[id]/transcribe/route.ts` takes chunks of roughly 8 seconds of 16 kHz mono
audio, up to 4 MB, and it has **three** ways in. Sprint 36 built the third on purpose:

| Door | Who it is for |
|---|---|
| Same-origin fetch + a clinician's cookie | The browser, during a live session |
| The same, from the patient's side | The patient's room |
| 🔴 **A session-scoped bearer token** | A machine. Built for partner platforms, and the right door here |

**Use the bearer token.** It is narrower than a clinician's session, it is audited through
`recordIngestUse`, it is rate-limited, and it is a real product surface rather than a way around
one. Feeding audio through it is *acting through the product*, which is rule 2.

An agent that wrote `transcript_segments` directly would break rule 2 and would also measure
nothing: no model call, no `ai_request_logs` row, no cost.

## 🔴 THE BUDGET LINE NOBODY COSTED, AND IT IS NOT SMALL

`npm run spend` sums `ai_request_logs`, which is **what the PRODUCT spent**. Synthesising the
audio is not a product call. It never lands in that table.

So the run has a second OpenAI cost, on the same key, that the budget guard cannot see:

| | |
|---|---|
| Transcription, product-side, measured | 286 minutes at 0.3 cents a minute ≈ **$0.86** |
| Notes and copilot, product-side, measured | the rest of the planned **≈ $4.80** |
| 🔴 **Synthesis, agent-side, INVISIBLE to `spend`** | 286 minutes of `gpt-4o-mini-tts` ≈ **$4 to $5** |

**That is most of a second budget.** `npm run spend` would report 30% of $10 used while the key
itself sat near 90%, and the first thing anybody would know about it is a session failing to
generate a note in wave 5 with the report half written.

This is the §6 family in its most expensive costume: an instrument that is correct about what it
measures and silent about what it does not.

### What to do about it, in this order

1. **Measure it on the first session, before the other sixty-one.** Synthesise one 3 minute
   script, read the cost off the OpenAI usage page, and multiply. An estimate in this document
   is worth less than one measurement, and the measurement costs about five cents.
2. **Report that number to the founder at the step 2 checkpoint**, beside `npm run spend`.
   Two numbers, always, because one of them is blind.
3. **If the two together pass $7**, stop and say so rather than deciding alone. `01-THE-CAST.md`
   says what to cut first, and the one thing never to cut is `P3` Mostafa's weekly cadence.

### And cache everything

Synthesis is the expensive half and it is deterministic. Key the cache by session id, keep it
under `.evals-audio/`, and **never re-synthesise a script that has already been spoken**. A
re-run of a wave costs a transcription and nothing else.

## Which sessions need audio, and which do not

**Not all sixty-two.** Audio costs money twice, so it goes where it buys something:

| | |
|---|---|
| A session where the patient consented to recording | **Audio.** The note, the copilot and the AI fee all ride on it |
| A session where the patient declined | **No audio, and that is the test.** C209: the AI fee is never charged when somebody declines, so a session with no transcript is a case the run has to produce |
| `P3` Mostafa's weekly sessions | **Audio, every one.** He is the top of the copilot exam's ladder and the record it is measured on |
| `P6` Ziad's three sessions | **Audio.** He is the thin record the exam measures Mostafa against, and thin means three, not zero |
| `L1`, the fifty minute session | **Audio, all fifty minutes.** It is the entire long end of the cost model and `physics` refuses to fit without it |

## The two voices problem, and the honest answer

A therapy session is two people. `openai().audio.speech.create` produces **one** voice.

Synthesise the clinician's lines and the patient's lines as separate clips with different voices
and concatenate them, and you get two speakers on one track, which is exactly what a real offline
session on one microphone sounds like. That is the case `lib/ai/diarise.ts` exists for, and the
one a clinician reported as *every line labelled "Speaker"* in sprint 76.

🔴 **So do not avoid it. It is a finding either way.** If diarisation attributes the turns, that
is the fix from 76.38 working on real audio for the first time. If it declines to guess and the
transcript reads `unknown`, that is C35 holding: a half-correct speaker label in a clinical record
is worse than none, and the panel now offers you / them / not sure on every line.

Either outcome is worth more than a clean single-voice track that tests nothing.

## What this document does not claim

The word error rate from synthesised speech is a **floor** and `evals/suites/speech.ts` says so
in its own header: clean studio speech, one speaker, no crosstalk, no radiator, no phone on a
coffee table. A real Cairo session is worse and nothing here says how much worse.

Report the run's transcription quality as *"on synthesised audio"*, every time, or somebody
reads it as a measurement of the product in the field.
