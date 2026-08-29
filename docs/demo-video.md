# The demo videos

Two films, from the same machinery.

| File | What it is |
| --- | --- |
| `24therapy-demo-edit.webm` | **The pitch cut.** 71s. The patient's ninety seconds — homepage to session. |
| `24therapy-product-tour.webm` | **The walkthrough.** 150s, seven chapters. The whole product, all four people in it. |

```bash
npx tsx scripts/demo-speech.mts     # once — synthesises the session audio (costs a few cents)
npx tsx scripts/demo-video.mts      # the patient's flow: stills + a screen recording
npx tsx scripts/demo-full.mts       # everything else: clinician, operator, session, note, money
npx tsx scripts/demo-edit.mts                    # cuts the pitch film
DEMO_FILM=tour npx tsx scripts/demo-edit.mts     # cuts the walkthrough
```

## The clinical text is not illustrated

`demo-speech.mts` synthesises a two-voice first session with OpenAI TTS and
writes it as a WAV. Chromium is then launched with
`--use-file-for-fake-audio-capture` pointed at that file, so the browser's
microphone *is* that conversation. Which means, in the film:

- the transcript was transcribed from audio, during the session;
- the SOAP note was written from that transcript;
- the copilot's answers were written from that note, and cite timestamps that
  exist in it.

Nothing clinical on screen is a fixture. The one thing that is not real is the
camera feed — there is nobody in front of a camera.

## What a run writes

Real rows: a clinician account, verification documents, a session, a note, a
rating, audit entries — and a clinician who appears on the public radar until
the script takes them offline at the end. It prints every id it created so the
account can be found and removed. Point `DEMO_BASE` carefully.

## The walkthrough, chapter by chapter

| Chapter | What it covers |
| --- | --- |
| I — A clinician arrives | Signup, the country-aware verification form, four documents |
| II — Somebody actually checks | The operator's queue, the documents side by side, approval |
| III — Going on the radar | Rate and practice, the alarm permission, "you are about to be visible to people in crisis" |
| IV — A patient arrives | The sixty-second hold, and the alarm ringing on the clinician's caseload page |
| V — The session | Consent, recording, the live transcript |
| VI — The note writes itself | Generation, the SOAP note, the patient's rating, signing it |
| VII — Afterwards | The copilot with citations, billing, the operator's view of the account |

## The pitch cut, beat by beat

| Time | Scene | On screen |
| --- | --- | --- |
| 0:00 | Title | *Talk to a real therapist in the next sixty seconds.* |
| 0:04 | Homepage | The live board. Focus ring lands on the online count. |
| 0:10 | **Punch-in** | "A live count, not a claim" |
| 0:14 | Language filter | Split layout — copy left, product right |
| 0:19 | Full radar | The globe, mid-rotation |
| 0:24 | Booking sheet | Focus ring lands on the hold timer |
| 0:30 | **Punch-in** | "Sixty seconds, held" |
| 0:34 | The form | "A first name. That is the form." |
| 0:39 | Statement | *One question before you go in.* |
| 0:42 | Consent | Focus ring lands on the two answers |
| 0:48 | **Punch-in** | "Saying no changes nothing else" |
| 0:52 | The room | "And you are in" |
| 0:57 | **Punch-in** | "The rating is anonymous" |
| 1:02 | Statement | *Meanwhile, the session documents itself.* + three lines |
| 1:06 | Outro | Logo, URL, honest status line |

Cuts alternate `punch → push → dissolve → wipe` and back. The bottom hairline
is a progress bar, so a viewer always knows how much is left.

## Adding a voice

The film is deliberately silent — it reads on autoplay in a feed or on a
landing page with the sound off, which is where most of these get watched.
If you want narration, the on-screen titles are already the script: read them
plus a sentence each, against the timings above.

Loom, Descript, CapCut and iMovie all import webm. Drop it on a timeline,
record over it, export.

## If you need mp4

There is no full ffmpeg in the build environment — Playwright's bundled copy
is a stripped webm muxer with no encoders — so the film is encoded by
Chromium's own VP9 encoder through `MediaRecorder`. Everywhere that matters
takes webm directly: YouTube, Vimeo, Loom, Slack, Notion, Google Drive, and
every browser except Safari.

For mp4, on a machine with a real ffmpeg:

```bash
ffmpeg -i 24therapy-demo-edit.webm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -an 24therapy-demo.mp4
```

## Changing the edit

`TIMELINE` at the top of `scripts/demo-edit.mts` is the edit decision list —
scene order, durations, copy, which still, where the camera pushes, and which
rectangle each punch-in frames. Editing it is the whole interface; the
rendering below it rarely needs touching.

`focus` (the ring on a shot) and `crop` (what the following punch-in frames)
are in image-normalised coordinates, 0–1 of the still, so they survive a
re-shoot at a different resolution.

### Reviewing the edit

A `MediaRecorder` webm carries no seek index, so seeking the finished file
lands on frame zero every time. Render frames from the source instead:

```bash
DEMO_STILLS=1.8,11,30.5,60.5 npx tsx scripts/demo-edit.mts
```

That writes `demo-output/frames/tNNN.N.png` and skips encoding entirely. It is
the fast loop — a frame takes a second, a full render takes 71.

## Re-shooting the source

`scripts/demo-video.mts` drives the live site, so it breaks loudly when the
product changes rather than recording something wrong quietly. Two things it
does that a test would not, and both should survive any edit:

- **A cursor.** Playwright moves the mouse without drawing one, so an
  unmodified recording is a screen that changes by itself.
- **Pacing.** Every step holds long enough to read what changed. The holds
  feel too long to whoever already knows what happens next. Leave them.

It picks whichever clinician is showing as available rather than naming one.
An earlier version named a therapist, the previous run booked her — a real
row, in the real database — and the next run opened her sheet to "They are in
a session at the moment", producing a silent half-recording that stopped at
beat five. The board is live data, so the script has to read it.

Resolution is configurable, and the defaults are load-bearing:

```bash
DEMO_WIDTH=1440 DEMO_HEIGHT=900 DEMO_SCALE=2 DEMO_BASE=http://localhost:3100 npx tsx scripts/demo-video.mts
```

Stills come out at twice the viewport because the punch-ins magnify them
roughly 2–3×; the screen recording ignores `DEMO_SCALE` because
`recordVideo` captures CSS pixels.
