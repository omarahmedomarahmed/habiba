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
| 7-8 | T2 | Run 3, in person: "Off record" at audio ~60s, "Resume" at ~120s, off-record phrases at 86-97s, all in silence | Transcript goes from "...the breathing exercise" to "Back to your sleep"; no cat, zebra or umbrella; timestamps continue 32000 then 40000 with no visible gap; the note (1,447 chars) never mentions it | session 2f13d524, transcript_segments 1..8 | **held** (for the clinician's button; the patient's Stop is a separate path, found broken in code, MAP 4) |
| 7-8 | task 123 | same session, in person | `recording_consent` NULL throughout, recorded and transcribed; the note page says "From the clinician's notes. Not recorded. This is the clinician's own account" over a note drafted from the transcript | session 2f13d524 | **broken, proven on production**: unconsented recording, and the record says it was not recorded |
| 8 | T1 | Ended the session | Draft note within seconds, from what was said (4am waking, wind-down on four nights, phone away an hour before bed), marked Draft | session_notes draft | **held** |
| 8 | provenance | same | "The whole session was captured and this note was drafted from it." | - | to recheck once off-record really runs |
| 9 | P3 | Patient opened the session before signing | "Your therapist is still writing your summary." No draft shown | - | **held** |
| 10 | - | Dr Omar signed and released | A full-screen "Turn on your alarm" modal covered the page until "Not now"; then "Signed", "Released" | - | defect (task 122 family) |
| 11 | P3 | Patient read the summary | Plain-language summary under "Omar Abdelgawad": no "Dr", no credentials, nothing saying who wrote it | - | **partly** |
| 11 | P2 | Notices | "Your session has started. The door is open." present | - | **held** for session start |
| 12 | T4 (stranger) | Dr Omar invited Laila; link opened signed out | "Your first name" asked | session 1d59e584 | **held** |

On `live`: held P1, T1, T2, T4, A1, RA1 and P3 first half; partly P2, P3; broken E3 (task 116),
the payment confirmation half of P2, and task 123 (twice: video and in person).

## 🔴 STOP CONDITION HIT, 2026-09-22 23:49 UTC, during the screen assessment on `live`

`/sponsor/people` (company portal, signed in as Habiba Holdings) shows **"Mariam Demo"**, a
per-person "Last checked 22 Sept 2026" and "End their benefit", beside a sidebar reading "THIS
PORTAL WILL NEVER SHOW YOU: Any individual, ever". `/sponsor` shows live, unfloored "Sessions
paid for 6" and "Spent so far $270" (`potTotals`, `lib/billing/pot.ts:997`). One name plus a live
count is that person's attendance, and daily reloads date each new session. Screenshots:
`evidence/assess/assess-company/020`, `021`, `012`, `013`. Verified by the coordinator from the
screenshot. Per `docs/PROVE-IT.md` ("a patient's name, session time or attendance appearing
anywhere in the company portal ... Stop, screenshot, say so immediately") the walk is paused and
the founder told. No reseed until the founder decides.

Founder's decision, 2026-09-23: **record it and continue the walk.** Nobody real is affected; it
goes to the top of the report. The walk resumes with `money` once the screen assessors on `live`
have finished, so no reseed moves the database under them.

## Position 2 · `money` (seeded 03:53 UTC, `verify:demo` PASS 78)

| # | Promise | DID | SAW | ROW | Verdict |
|---|---|---|---|---|---|
| 1 | E1, E2 | Company: /sponsor, /sponsor/people | Roster names "Mariam Demo" and "Omar Ahmad" with per-person "Last checked" dates; overview shows published balance $2,555 beside live "Spent so far $45", "Sessions paid for 6" | - | **broken** (live counts date each session; see the stop condition above) |
| 2 | E1 | Operator: /admin/sponsors/<id> (no link to it from the sponsor list; opened by id) | Six funded sessions, each "2026-09-23 · Sara Demo · 10% of $75"; no patient named | sponsor 56b91bc0 | **held** for no patient name; date and clinician visible to any staff account (WALL-7) |
| 3 | CV1 | Mariam booked Thu 14:00 with Dr Sara from /patient/t/<sara> | Profile: "30 minutes, starting now $75" and "One hour $75". Booking sheet asked a signed-in patient first name, email and phone, country defaulting to US; no split shown; "Booked with Sara. We could not send you a confirmation, write this time down" | session b221a909 | **broken**: no price screen with the three numbers before booking; signed-in patient asked who she is |
| 3 | MONEY-6 | same | DB at booking: session_payment `paid`, coverage 10%, sponsor 750, patient 6750; ledger at booking: cash +7500 "captured by the platform", therapist_payable -6375, platform_revenue -1125, though only 750 came from the pot | ledger 03:57:58 | **broken, seen on production**: full price booked as cash and clinician earnings before the patient paid |
| 4 | CV2 | Orb "Pay for your session" to /join, then Pay | Join page "Pay $75 and join"; sheet "Send EGP 3,847.50", session 3,750, "Your benefit paid -375", VAT 472.50 | - | **broken**: $75 shown, $76.95 asked |
| 4 | CV1, CV4 | same | VAT 472.50 = 14% of her 3,375, never of the price, never zero | - | **held** |
| 5 | - | Company: coverage slider 10 -> 60, Save | "What you cover 60%" | - | - |
| 6 | E3 | Mariam reloaded the sheet | Still EGP 3,847.50 at 10% | - | **held** |
| 7 | - | Submitted SPLIT-01 | "We are checking your transfer" | manual_payments 9fe64671 | - |
| 8 | A2 | Two operator windows pressed Confirm 1 ms apart. **Coordinator error:** the first Confirm on the page belonged to the seeded unmatched line CIB-TRX-4471902, not SPLIT-01, so this confirmed the A4 fixture | Both screens: "Confirmed. They can carry on." | manual_payments 45a5243b confirmed once; exactly one set of legs (cash +6000, therapist_payable -5100, platform_revenue -900); one `transfer.confirm` audit row | **held** on the money; **partly** on the screen (the second window was told "Confirmed", not that it was already done). A4 fixture spent: redo on a fresh seed |
| 8 | - | Confirm on SPLIT-01 | "Nothing waiting" | ledger 04:01:50: only cash +945 and vat_payable -945 | the patient's 6750 share is never recorded when it arrives, because it was recorded as captured at booking (MONEY-6) |
| 9 | A4 (unmatched line) | - | Fixture CIB-TRX-4471902 was consumed by the coordinator's error in step 8 (it was an open cart for Laila's unpaid session; confirming it credited Dr Omar "+$51 Laila Demo paid you") | manual_payments 45a5243b | **untested here**: redo on a fresh seed |
| 10 | RA9 | Dr Omar, /billing: 8 invoices ticked by default ("You owe $32 across 8 invoices", the walk expects 9); unticked 4, Pay now | "Send EGP 800", the four listed at EGP 200 each | - | **held** |
| 11 | A4 (overpayment) | Looked for a field to say how much was sent | Only "reference" and a receipt upload. Submitted "OVER-01 sent EGP 1000" | - | the payer cannot state an amount |
| 12 | A4 | Operator: row "Omar Abdelgawad · A subscription" (it is four session invoices), EGP 800 settles $16; Confirm | "Nothing waiting" | 4 invoices paid, 4 due; **no ledger leg at all** for the EGP 800 received; the EGP 200 surplus recorded nowhere | **broken**: overpayment silently kept; invoice payments never reach the ledger (MONEY finding, seen) |
| 13 | A3 | Dr Omar paid the other 4 as NBE-99120; operator Reject opened a textarea (placeholder "No transfer found with that reference..."), filled the PROVE-IT sentence, "Reject and tell them" | "Nothing waiting" | - | - |
| 14 | A3 | Dr Omar looked on /dashboard, /billing, /earnings | Sentence verbatim on /billing only; nothing on the dashboard he lands on; no message sent | - | **partly**: verbatim where it is, but nothing leads him to it |
| 15 | T3 | Dr Omar /earnings | "Your held earnings pay your 24Therapy bills... cleared from it automatically" while $51 held and his invoices sat due until he paid by transfer; shows Held $51, no owed half, no difference; "We hold your share until Stripe verifies you" to an Egyptian clinician; "Requested $255" larger than held (the seed's raw-SQL payout) | - | **broken** |
| 16 | CV12 | Dr Sara /earnings | Held $446.25 = 7 x $63.75 (85% of the full $75): full-price basis holds. One of the seven is Mariam's Thursday session, not yet held and not yet paid, and it is already "Available now $446.25" | session b221a909 | CV12 **held**; MONEY-6 **broken**: withdrawable earnings for a session that has not happened |

On `money`: held CV1, CV4, E3, RA9, CV12, A2 (money); partly A2 (screen), A3; broken E1, CV2, A4
(overpayment), T3, MONEY-6; A4 (unmatched line) untested because of the coordinator's error.
