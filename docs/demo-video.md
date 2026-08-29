# The demo video

Two scripts, run in order. The first gathers evidence from the running
product; the second cuts it into a film.

```bash
npx tsx scripts/demo-video.mts     # drive the real site, capture stills + screen recording
npx tsx scripts/demo-edit.mts      # composite the edit and encode it
```

Both write to `demo-output/`, which is gitignored — it regenerates in about
three minutes.

| File | What it is |
| --- | --- |
| `24therapy-demo-edit.webm` | **The deliverable.** 1920×1080, 71s, VP9. Titles, mockup frame, camera moves, punch-ins, four cut styles. |
| `24therapy-demo.webm` | The raw screen recording, 1440×900, with a visible cursor. Evidence, not a film. |
| `01-home-globe.png` … `10-patient-room.png` | One 2880×1800 still per beat, in order |
| `frames/` | Single frames rendered for review — see *Reviewing the edit* |

Every frame of the film is a screenshot of the running product. The only
synthetic pixels are the window frame around the screenshots and the words on
top of them. Nothing depicts a feature that does not exist.

## The cut

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
