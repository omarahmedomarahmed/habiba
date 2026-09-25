# Session audio, and why every session is about a minute

Every consented session is transcribed from real speech, by the real transcriber, into a real
note. An agent cannot speak, so Chromium plays a synthesised conversation as its microphone.

## The files

`npm run sim:speech` writes `.sim-audio/<name>.wav` (git ignores the folder). A file on disk is
never synthesised again. `scripts/sim-speech.mts` holds the text.

| File | Length | Language | Played in | What it proves |
|---|---|---|---|---|
| `first-en.wav` | 62 s | English | First sessions, English patients | Transcript, note, homework suggestion |
| `follow-up-en.wav` | 56 s | English | Every later session of the same patient | The copilot connects two sessions, homework review |
| `ar-first.wav` | 58 s | Arabic | Arabic patients (`P1`, and `P5` once) | Arabic transcript and note, Arabic patient screens |
| `risk-en.wav` | 54 s | English | One session in round 4 | Risk flag on the note, the crisis follow-up, messages kept in the outbox |

## How a browser is given one

```
chromium --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
         --use-file-for-fake-audio-capture=.sim-audio/first-en.wav \
         --autoplay-policy=no-user-gesture-required
```

and the context is created with `permissions: ["camera", "microphone"]`. `scripts/demo-full.mts`
is the working example.

| Session | Whose browser plays the file | Whose browser is silent |
|---|---|---|
| Online | The therapist's. One track carrying both voices is what one microphone in a room hears | The patient's: `--use-fake-device-for-media-stream` with no file, so the transcript is not doubled |
| In person | The therapist's, the only device in the room | Nobody else joins |
| Declined consent | Nobody plays a file | Both. No transcript, no note from audio, no AI fee: that is the test |

## Why about a minute, not fifty

Chromium loops the file. A session left running for fifty minutes would transcribe the same
minute fifty times, cost fifty times as much, and prove nothing more. The therapist agent presses
**End session** once the file has played through once, about 75 seconds after both sides are in
the room. `03-THE-FLOWS.md` gives the exact step.

The session length the product bills is the booked length, not the minutes spoken, so a short
session is billed like a full one. If a screen or ledger row says otherwise, that is a finding.

## Cost

Synthesis for all four files cost a few cents once. Transcription and notes are product
spending, recorded in `ai_request_logs`, and `npm run on:production -- spend` reads them.
Report both numbers at the end of the run.

Transcription quality from synthesised speech is a best case: clean audio, no room noise. Say
"on synthesised audio" whenever the run reports it.
