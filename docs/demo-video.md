# Making the demo video

`npx tsx scripts/demo-video.mts` drives a real browser through the real product
and writes everything below into `demo-output/`. Nothing in it is mocked — the
clinicians are rows in the database and the board is the live radar.

```
DEMO_BASE=https://habiba-zeta.vercel.app npx tsx scripts/demo-video.mts
```

| File | What it is |
| --- | --- |
| `24therapy-demo.webm` | 1280×800 screen recording of the whole run, with a visible cursor |
| `01-home-globe.png` … `10-patient-room.png` | One still per beat, in order |

## The shot list

The recording already has the pacing. What it does not have is a voice. Below
is the script, timed against the beats — read it over the webm and you have a
demo video. Total runs about 75 seconds, which is the right length for an
accelerator application or a cold email.

| # | Still | On screen | Say this |
| --- | --- | --- | --- |
| 1 | `01-home-globe` | Homepage, globe drawing, "8 therapists online right now" | "This is the homepage. Not a landing page — a live board of licensed therapists who are online right now." |
| 2 | `02-home-clinicians` | Scrolled to the clinician cards | "Every card is a real clinician with a heartbeat behind it. Price and length are on the card, before you click anything." |
| 3 | `03-filter-arabic` | Arabic language filter active | "Filter by language first, because language is the first thing that rules a therapist out. The whole product runs in Arabic too, right to left." |
| 4 | `04-radar-board` | `/radar`, full board | "The full board. Countries, languages, and what you need help with." |
| 5 | `05-booking-sheet` | Layla Mansour's sheet, "Held for you · 59s" | "Pick someone and they are held for you for sixty seconds. They go busy for everyone else while you decide, and are released if you walk away." |
| 6 | `06-booking-name` | First name typed | "A first name. That is the entire form. No account, no insurance, no waiting list." |
| 7 | `07-join-arrived` | Arrived at the session URL | "One click and you are through." |
| 8 | `08-consent-question` | "May your therapist record this session?" | "One question before you go in. Recording is opt-in, and saying no changes nothing — the session runs exactly the same and the therapist writes their own notes." |
| 9 | `09-consent-chosen` | Answer selected | "Answered once, stored with the exact wording they agreed to." |
| 10 | `10-patient-room` | Session room, "Do not close this tab." | "And you are in. The loudest thing on the screen is the one instruction that matters — because the rating and the written summary both live on the other side of this session ending. The rating is anonymous. The therapist sees the stars and the words, never who wrote them." |

## Three ways to finish it

| Route | Effort | When to use it |
| --- | --- | --- |
| Ship the webm as-is | none | Email, Notion, an application form. YouTube, Vimeo, Loom, Slack, Google Drive and Notion all accept webm directly. |
| Narrate over it | ~20 min | Anything a human will watch. Record the script above in one take; the beats are already paced for it. |
| Stills as a slideshow | ~30 min | When you need captions instead of a voice, or an mp4 with no video editor. |

### Narrating over the recording

Loom, Descript, CapCut and iMovie all import webm. Drop the file on the
timeline, record voice-over against it, export mp4. Do not re-cut the timing —
the holds in `demo-video.mts` are already longer than they feel, deliberately,
so a viewer who has never seen the product can follow.

### Building it from the stills instead

Ten stills, seven seconds each, cross-faded. This is the route that needs no
editor at all:

```bash
cd demo-output
ffmpeg -framerate 1/7 -pattern_type glob -i '*.png' \
  -vf "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2,format=yuv420p" \
  -c:v libx264 -r 30 24therapy-slides.mp4
```

Add the voice-over as a second pass:

```bash
ffmpeg -i 24therapy-slides.mp4 -i voiceover.m4a -c:v copy -c:a aac -shortest 24therapy-demo.mp4
```

## Why there is no mp4 in the output

Playwright records webm and nothing else, and the ffmpeg it bundles is a
stripped build with the webm muxer only — no h264 encoder — so it cannot
convert its own output. Every platform that matters takes webm. If you
specifically need mp4, install a full ffmpeg locally and:

```bash
ffmpeg -i 24therapy-demo.webm -c:v libx264 -crf 20 -preset slow -an 24therapy-demo.mp4
```

## Re-shooting it

Change the flow in `scripts/demo-video.mts` and run it again. The script pins
its selectors to what is actually on the page (`#radar-name`, the clinician's
name on the card, the consent option text), so a copy change will break the
run loudly rather than record a wrong video quietly.

Two things it does that a test would not, and both should survive any edit:

- **A cursor.** Playwright moves the mouse without drawing one, so an
  unmodified recording is a screen that changes by itself. The injected dot
  makes it read as a person using the product.
- **Pacing.** Every step holds long enough to read what changed. Those holds
  feel too long to whoever already knows what happens next. Leave them.
