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

## Position 3 · `continuity` (seeded 04:08 UTC, `verify:demo` PASS 78)

| # | Promise | DID | SAW | ROW | Verdict |
|---|---|---|---|---|---|
| 1 | P4 | Tarek /patient/summary | "Dr Sara Demo, Clinical psychologist, Version 2" and "Dr Omar Abdelgawad, Psychotherapist, Version 1", first unchanged; neither names the practice | - | **held** (practice not shown) |
| 2 | stale / hidden | Tarek /patient/consent | "Nobody has asked to read your history"; Kareem "Expired, Cannot read". PROVE-IT says a request from Kareem is waiting. DB: Kareem's seeded request exists (`requested`, shape `summary`) and the patient screen does not show it | history_grants | **broken**: a pending request the patient cannot see; PROVE-IT step 2 stale against the seed |
| 2 | P4 | Tarek made a code (RP8-8FT), Kareem entered it at /connect ("Tarek has been asked"), Tarek saw "Asked on 23 Sept... Yes for 24 hours / Yes until I change my mind / No thanks", granted | grant `granted`, `open` | history_grants | **held** (the code route works; dates shown as raw ISO "2026-10-23") |
| 3 | T5 | Kareem opened the copilot on Tarek | 404 "We could not find that page": Tarek's record at Nile Practice belongs to Sara, and the copilot opens only a clinician's own charts | patient d2fe1979 | **broken as walked**: no screen where a second clinician in the same practice can use a grant |
| 3 | T5 | Deviation: Sara (who holds her own grant) asked "What seems to trigger his sleep trouble?" | Answer about middle-insomnia and anticipatory review anxiety with [S1:4] [S1:5] linked to "18 Sept 2026 0:24 / 0:32" | - | **held** (citations attached) |
| 4-5 | T5 | Tarek pressed "Stop their access" on Sara; Sara reopened the copilot and asked again, timed | Within 4.7s: "This person has not granted you access to their profile... not their live profile, their files, or their current diagnosis". The copilot still answered: "The transcripts do not cover that. No source, treat with care" from her own sessions | grant revoked 04:14:42 | **partly**: scope narrowed at once; the copilot does not stop, while `/for-patients` says "Take it back and it stops that second" |
| 6 | P4 | - | Not walked as written (Sara was the one revoked in the deviation); Kareem's open grant untouched | - | untested as written |
| 7 | C2, C5 | Clinic screens | Covered by the clinic assessment on `live`: first name plus last initial with times and clinician on /clinic and the CSV; earnings per clinician present | - | C2 **broken** as worded, C5 **held** |
| 8 | - | Dr Omar, Laila's chart, "Create an invite link" then "Issue a new one" (link shown once, "We store only a fingerprint") | link captured | - | - |
| 9 | claim | Stranger opened the link signed out | "Omar Abdelgawad has invited you to take ownership of the record they keep for you. Create an account or sign in." | - | - |
| 9 | privacy | Create an account | Sign-up shows "Phone +201000000002. The number your therapist sent this invite to." to whoever holds the link | - | **broken**: record data shown before any handle is proven (README safety invariant 5) |
| 9 | claim | Signed up (first name, a password, no code sent anywhere) | Straight to "Take ownership of your record. L•••• D••• keeps notes under this name... This is me, claim it". **No questions.** Pressed it: "That record is yours now" | people.claimed_at 04:19:07; account phone +201000000002 **phone_verified_at NULL**, email NULL | **broken**: PROVE-IT's "two questions before letting anybody in" never asked; a record owned by an unverified account |
| 10 | - | Operator finding Laila stuck | Not possible: the stranger got in at step 9 | - | untested |

On `continuity`: held P4 (versions, the code route), T5 citations, C5; partly T5 revoke; broken the hidden
pending request, the Kareem copilot path, C2, claim identity (no questions, unverified owner) and the phone
number shown to the link holder.

## Position 4 · `crisis` (seeded 04:20 UTC, `verify:demo` PASS 80)

| # | Promise | DID | SAW | ROW | Verdict |
|---|---|---|---|---|---|
| 0 | A5 | Support (`staff.demo`) signed in at /staff/sign-in | Landed on `/onboarding`, the clinician "Verify your practice" screen | audit: `auth signin` only | defect (ID-8, seen) |
| 2 | P5 | Patient A: orb, /pay/<token> with EGP 3,420 on screen; checked the element under the SOS orb's centre, tapped it | The SOS orb itself is on top (z 70); "Help now. These are phone numbers, not a chat... 105, Egypt, press 1 for Arabic, then 1 for mental health", `tel:105`, above the payment details | - | **held** on the payment page |
| 2 | P5 | /patient/radar booking sheet | Headless: crash page without WebGL ("Something went wrong... The SOS button still works"); with WebGL, Dr Omar appeared for ~1 minute then dropped while his on-call page stayed open, so no sheet could be opened | - | **inconclusive live**; two verifiers found in code the sheet (z 100) above SOS (z 70), UX-26, CLIN-38. Stop-condition level if true |
| 3 | A3, task 124 | Mariam looked on /patient, sessions, notices, benefit, billing, account | No trace of a rejection anywhere, no orb | manual_payments 67663f75 rejected, reason verbatim stored, **ref_id NULL** | **broken**: never told. The seeded rejection is attached to nothing, so the only surface that shows reasons (the sheet for the same item) can never show it; PROVE-IT calls it "the most favourable form", it is the one form that is invisible |
| 4 | A3 | Operator: transfers, vault, support, overview | No mention of the rejection, no "seen", no "tell them again", no age | - | **no** to all three of PROVE-IT's questions |
| 5 | lifecycle | Dr Yasmin /onboarding | "Somebody is checking your documents, usually within a working day. Sessions unlock when you are approved." | - | **partly**: says what and how long, but LIFECYCLES promises 2 working days, and she can do nothing meanwhile |
| 6 | A5 | Support opened /admin/actuals, /admin/benefits, /admin/radar, /admin/tv, /admin/errors, /admin | All to `/onboarding` ("Finish verification"), errors to `/dashboard`; even `/admin` (support's own home) bounces. Allowed pages (/admin/transfers, support, verifications, payouts) open only by typed URL | audit_log for staff.demo: `auth signin` only | **broken**: redirected to the wrong product, refusals not recorded, support has no door into its own console |
| 7 | task 105 | Operator /admin/support, ticket SUP-DEMO-01 from Laila | Actions: Take it on, Waiting on them, Extend once, Moved to WhatsApp, "Close and send the link"; that link is a support-reply page plus a six-digit code (`lib/data/support.ts` closeTicket), not a claim link | - | **confirmed**: the console cannot give her a new claim link |

On `crisis`: held P5 on the payment page; partly Dr Yasmin's wait; broken A3/task 124, A5, task 105;
the radar-sheet-over-SOS case inconclusive live and confirmed in code.

## Position 5 · `growth` (seeded 04:30 UTC, `verify:demo` PASS 78)

| # | Promise | DID | SAW | ROW | Verdict |
|---|---|---|---|---|---|
| 0 | - | Company sign-in | First attempt "Something went wrong. The page could not be displayed."; second worked | - | intermittent, not reproduced |
| 1 | E5 | Company /sponsor, /sponsor/pot | "-$25", "You have used 113% of what you have put in", under a green "Your pot top-up... Paid"; no sentence saying what a negative balance means or that the next booking will not be covered; "We do not publish a figure for a period with very little activity" directly under live "Sessions paid for 5" | pot -2500 | **broken** by PROVE-IT's own test (a minus sign and no sentence) |
| 2 | E5, CV9 | Mariam booked Dr Sara against the empty pot | "Booked with Sara... We could not send you a confirmation"; pay sheet "Send EGP 4,275" (full price + VAT); no mention of employer or HR anywhere; /patient/benefit says "Activate your benefit. Enter the code your employer gave you" to an enrolled patient | session 0d43c1c0, no pot payment, pot stays -2500 | **partly**: pot takes nothing and the ordinary link is offered; "ask HR" absent; benefit page misleads |
| 3-4 | E4 | Company coverage slider to 0, Save | "Changing to 0% on 23 Oct 2026. Anybody who has already booked keeps the percentage they agreed to."; roster keeps Mariam | - | **partly**: kept on the list, nothing says removed; "owes the whole price" not observable for 30 days |
| 4 | privacy copy | Mariam /patient/benefit | "Your sessions are paid for by Habiba Holdings" and "Activate your benefit" on one screen; "That you are on the list. The date beside it is the same for everybody." and "Whether you booked, when... Not a date, not a count." | - | **broken**: the patient is promised what the company portal breaks (per-person dates, live counts) |
| 5-6 | - | Company top-up: "Send at least $100", "HOW MUCH TO ADD $100, EGP 5,000, Covers about 8 sessions at your coverage rate"; reference TOPUP-01; operator Confirm | pot -2500 -> 7500 | manual_payments TOPUP-01 confirmed | held; the "8 sessions" estimate is about 4x wrong at 60% of $75 (about 2) |
| 7 | PL7, C3 | Clinic /clinic/people | Dr Yasmin already on the practice ("Verification in progress"); no seat control, no quote anywhere; bill "6 sessions, platform fee $0.00, AI fee $0.00, total $0.00", no seat line | - | **untestable as written, and C3 broken**: nothing per seat exists |
| 8 | - | Operator /admin/verifications, Approve on Dr Yasmin (submitted 14 Aug, about 40 days, promise 2 working days, nothing flags the age) | "Nothing waiting" | - | held; the queue has no clock |
| 9 | C1 | Yasmin signed in (dashboard unlocked, her payment bar shows "Session with Sara Demo, EGP 4,275", a colleague's patient's payment); "Go on the radar", then "Turn the alarm on and go live" | Hangs at "Turning it on..." waiting for a test ring that never finishes in a headless browser; public radar "Nobody... on shift" | - | **untested (environment)**; design question: a device that cannot play sound cannot go on the radar |
| 10 | C4 | Clinic "Remove from the practice" on Dr Kareem (confirm text: "They move to their own practice now, and any meeting account they connected here is disconnected."), confirmed | Kareem gone from the list | - | - |
| 11 | C4 | Kareem signed in | Not suspended; billing "Pay as you go, Yours"; **/patients "0 on your caseload. No patients yet."** | Kareem's new solo org has 0 patients; Nadia still at Nile Practice | **broken**: he loses his patient on release |
| 12 | C3, C4 | Clinic /clinic/bills after release | No seat line before or after | - | **broken** (MONEY-8, seen) |
| 13 | RR9 | Pot topped to $75; Omar Ahmad (on the roster) booked: **not funded** by the pot; Mariam booked once (pot $75 -> $30); then Mariam in two browsers confirmed Thu 16:00 and 17:00 19 ms apart | Both screens "Booked with Sara" | 17:00 funded 4500; 16:00 no pot payment; pot -1500, inside the 5000 bound | **held**; the unfunded booker is told nothing different; an enrolled employee not covered is a separate defect |

On `growth`: held RR9, the pot refusing a spend past its bound, and the verification approval; partly E4,
E5; broken the negative-balance wording, C3, C4 (patient lost), the benefit-page privacy copy; C1 and PL7
untested.
