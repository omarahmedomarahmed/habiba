# Session audio, and why every session is about a minute

Every consented session is transcribed from real speech, by the real transcriber, into a real
note. An agent cannot speak, so Chromium plays a synthesised conversation as its microphone.

## The files

`npm run sim:speech` writes `.sim-audio/` (git ignores the folder). A file on disk is never
synthesised again. `scripts/sim-speech.mts` holds the text. Each conversation comes three ways:
`<name>.wav` with both voices, and `<name>-t.wav` / `<name>-p.wav` with one side each, the other
side's turns replaced by silence of the same length.

| Conversation | Length | Language | Played in | What it proves |
|---|---|---|---|---|
| `first-en` | 73 s | English | First sessions, English patients | Transcript, note, homework suggestion |
| `follow-up-en` | 54 s | English | Every later session of the same patient | The copilot connects two sessions, homework review |
| `ar-first` | 58 s | Arabic | Arabic patients (`P1`, and `P5` once) | Arabic transcript and note, Arabic patient screens |
| `risk-en` | 56 s | English | One session in round 4 (`T2` with `P3`) | Risk flag on the note, the crisis follow-up, messages kept in the outbox |

## How a browser is given one

```
chromium --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
         --use-file-for-fake-audio-capture=.sim-audio/first-en-t.wav \
         --autoplay-policy=no-user-gesture-required
```

and the context is created with `permissions: ["camera", "microphone"]`. `scripts/demo-full.mts`
is the working example. The flag belongs to the whole browser, so each person in a session gets
their own browser, not just their own context.

| Session | Therapist's browser plays | Patient's browser plays | Why |
|---|---|---|---|
| Online (`TH8`, `TH9`) | `<name>.wav` in this run (the network here carries no WebSocket, so video never connects and only the therapist side records); `<name>-t.wav` on a normal network | nothing in this run; `<name>-p.wav` on a normal network | The room records two tracks: the therapist's microphone as "You" and the patient's video track as "Them" (`TH8.4`). One side each is what a real call sounds like, and it tests the speaker labels |
| In person (`TH6`, `TH7`) | `<name>.wav` | nobody joins | One microphone in one room hears both voices, which is the case the speaker guessing exists for |
| Declined consent | nothing | nothing | No transcript, no note from audio, no AI fee: that is the test |

The two browsers start their files a few seconds apart, so the turns may overlap slightly. The
transcript is still two real speakers; judge the labels, not the timing.

## Why about a minute, not fifty

Chromium loops the file. A session left running for fifty minutes would transcribe the same
minute fifty times, cost fifty times as much, and prove nothing more. The therapist agent presses
**End session** once the file has played through once, about 75 seconds after both sides are in
the room (`TH8.6` for online, `TH6` for in person).

There is no minimum length. A short session is billed exactly like a full one: the platform fee
per session, and the AI fee only when the patient said yes to recording (`TE1`). A transcript
under about 80 characters cannot make a note (`TE4`), which each file clears with room to spare.
If a screen or ledger row bills a short session differently, that is a finding.

## Cost

Synthesis for all four files cost a few cents once. Transcription and notes are product
spending, recorded in `ai_request_logs`, and `npm run on:production -- spend` reads them.
Report both numbers at the end of the run.

Transcription quality from synthesised speech is a best case: clean audio, no room noise. Say
"on synthesised audio" whenever the run reports it.
