# The walk, step by step

On production, 2026-09-23 (UTC night of the 22nd). `DID / SAW / ROW`. Evidence (screenshots
before and after every action, and `BOARD.md`) is in `evidence/<position>/`, gitignored.
Snapshot taken first: `br-autumn-art-a6gk6knr`.

**Environment, not product:** Daily's websocket (`wss://*.wss.daily.co`) is refused through
this container's proxy (404 at handshake), so video never connects here. The recorder and
transcription run over ordinary HTTPS and work. Everything below that depends on video is
marked as such.

## Position 1 · `live` (seeded 23:22 UTC, `verify:demo` PASS 79)

| # | Promise | DID | SAW | ROW | Verdict |
|---|---|---|---|---|---|
| 1 | P2 | Patient A signed in at 390px, did not navigate | Amber banknote orb bottom right, SOS above it, on /patient, /patient/sessions, /patient/profile | - | **held** |
| 1 | P2 | Looked for the invitation in the app | Present on `/patient/notices` ("Your therapist has invited you to a session."); no link to that page anywhere, reached by typing the URL | - | **partly**: in the app, no door |
| 2 | T4 (signed in) | Tapped the orb | `/join/demo-live-now`: "Joining as Omar." | - | **held** |
| 2 | copy | same | Heading above it: "No account needed. Tell us what to call you" to a signed-in person | - | defect |
| 2 | E3 / task 116 | Pressed "Pay $60 and join" | Transfer sheet: "Send EGP 3,420, includes EGP 420 of VAT" = $68.40; only pounds shown | - | **broken**: shown $60, asked $68.40 |
| 2 | RA1 | Left, came back, orb, sheet again | Same payment, same amount | manual_payments beabb273 | **held** |
| 2 | - | Submitted reference LIVE-01 | "We are checking your transfer. Usually a few minutes." | beabb273 submitted, 6840 | - |
| 3 | A1 control | Patient reloaded before any confirm | Session not joinable; join page offers "Pay $60 and join" again with no mention of the pending transfer (invites paying twice) | - | control **held**; copy defect |
| 3 | A1 | Operator: /admin/transfers, Confirm | Row read "Patient / A company / A session" (no name; patient is enrolled nowhere), then "Nothing waiting" | beabb273 confirmed 23:27:32; ledger cash +6840, therapist_payable -5100, platform_revenue -900, vat_payable -840, **all entity=us** | **held**; Egyptian VAT booked to the US entity (MONEY finding, seen) |
| 4 | P2 | Patient reloaded | Orb teal with a door | - | **held** |
| 4 | P2 | Looked for a payment confirmation in the app | Not in `/patient/notices` | - | **broken** |
| 5 | - | Dr Omar signed in | Dashboard bar "Session with Omar Abdelgawad, EGP 3,420, Paid": his own name, and the patient's gross | - | defect |
| 5 | task 123 | Opened the video room | "Omar Ahmad is in the room, waiting for you to start" though he was not; DB `patient_joined_at` 23:25:51 = when he opened the page to pay; `recording_consent` NULL | session 540268c3 | **broken**: joined early; recording with no consent |
| 5 | task 123 | Started the session | Transcription running (live transcript, copilot prompts) before the patient was asked anything | transcript_segments 1..5 | **broken** |
| 6 | P1 | Patient, from home: orb, "Yes, you may record", "Go in" | Three taps to the room | - | **held** (3) |
| 6 | copy | same | "You can change these at any time during the session" beside "Recording cannot stop part-way" | - | defect (UX-16) |
| 7-8 | T2 | Two runs | **RETRACTED, untested.** Run 1: the speech began ~13s before Start, so the off-record phrases played before the toggle. Run 2: the selector `button[aria-pressed]` hit the English/Arabic switch, not "Off record"; the header still said "Recording". Neither run went off the record. Run 3 targets the button by its label | sessions 540268c3, 6994939e | untested so far |
| 8 | T1 | Ended the session | Draft note within seconds, from what was said (4am waking, wind-down on four nights, phone away an hour before bed), marked Draft | session_notes draft | **held** |
| 8 | provenance | same | "The whole session was captured and this note was drafted from it." | - | to recheck once off-record really runs |
| 9 | P3 | Patient opened the session before signing | "Your therapist is still writing your summary." No draft shown | - | **held** |
| 10 | - | Dr Omar signed and released | A full-screen "Turn on your alarm" modal covered the page until "Not now"; then "Signed", "Released" | - | defect (task 122 family) |
| 11 | P3 | Patient read the summary | Plain-language summary under "Omar Abdelgawad": no "Dr", no credentials, nothing saying who wrote it | - | **partly** |
| 11 | P2 | Notices | "Your session has started. The door is open." present | - | **held** for session start |
| 12 | T4 (stranger) | Dr Omar invited Laila; link opened signed out | "Your first name" asked | session 1d59e584 | **held** |

So far on `live`: held P1, T1, T4, A1, RA1 and P3 first half; partly P2, P3; broken E3 (task 116),
the payment confirmation half of P2, and task 123; T2 untested.
