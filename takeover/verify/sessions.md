# Verification: SESSIONS

Domain: the radar, scheduling and booking, the room, no-shows and automatic suspension, session
recovery, scheduled jobs. Verifier read the code directly; readers' claims are the starting
point, not the evidence. Written 2026-09-22.

Cross-cutting fact that several entries depend on, verified once here:

- `vercel.json` schedules five jobs: `crisis` 03:00 daily, `billing` 03:05 daily, `retention`
  03:10 daily, `extract` 03:15 daily, `reminders` at minute 20 of every hour. The route
  `app/api/cron/[job]/route.ts:120-609` defines six (`radar` is the sixth, reachable only by
  hand). So `sweepRadar`, `sweepAbandonedPatients` (the automatic no-show warn and suspend),
  `sweepUnratedSessions` and `sweepOverrunSessions` all run ONCE A DAY at 03:00 UTC, inside
  `crisis` (route.ts:126-172).

### SESS-1 · The radar sweep cancels every unpaid session at 03:00, including ones awaiting a bank transfer, and a later Confirm takes the money for a cancelled session
- Verdict: CONFIRMED
- Sources: code-03 Broken (sweepRadar cancels every unpaid priced session), code-03 Stale (manual-grants "not quietly revived"), code-06 Suspect 5 (hold vs transfer confirmation)
- Promise: A1, P1
- Who is hurt and how: a patient who books off the radar and pays by bank transfer (the only rail in Egypt) has their session cancelled and their join link destroyed at 03:00 UTC if the operator has not confirmed yet; when the operator then presses Confirm the money is booked as revenue for a session nobody can enter. Every paid calendar booking made before 03:00 and not yet paid is cancelled the same night, with no message.
- Evidence: `lib/data/radar.ts:1223-1234` cancels `status='scheduled' AND payment_status='pending' AND patient_joined_at IS NULL AND created_at < now()-10min`, sets `join_token` NULL, no `session_type` filter, no look at `manual_payments`. Radar bookings go straight to `/pay/<token>` (`app/(public)/radar/actions.ts:391`) and never call `joinByToken`, so `patient_joined_at` stays NULL while a transfer is pending; calendar bookings (`lib/data/scheduling.ts:442-489`) likewise. Paid-link invitees are usually spared only because `submitJoin` stamps `patient_joined_at` before the pay step (`app/join/[token]/actions.ts:174`, `lib/data/sessions.ts:873`). Patch checked: `grantSession` (`lib/billing/manual-grants.ts:78-97`) guards on `payment_status='pending'` only, so it flips a CANCELLED session to `paid` and posts the ledger legs (`:99+`); the comment "NOT quietly revived" is true of `status` only. The radar hold path (`app/(public)/radar/actions.ts:287-318`) was patched for exactly this shape after a production incident; the sweep was not.
- Severity: S1
- Fix sketch: restrict the sweep to `session_type='radar'` AND no open `manual_payments` row for the session (awaiting_proof or submitted), and never touch a session with a future `scheduled_at`; make `grantSession` require `status <> 'cancelled'` and route that case to the operator as "money for a cancelled session". Prove with a seeded radar session plus submitted transfer, run `sweepRadar`, assert status unchanged.
- Decision it came from: the sweep was written for abandoned Stripe checkouts (comment at radar.ts:1216-1222) before the manual rail existed; the rail (sprint 59/C357 era) never revisited it.

### SESS-2 · A paid calendar booking cancelled by the sweep leaves its hour stranded as "booked"
- Verdict: CONFIRMED
- Sources: new (found verifying SESS-1 and "cancellation stranding the hour"); related code-07 Stale 15
- Promise: none directly (P1 via the radar window)
- Who is hurt and how: after any cancellation that does not go through `cancelBooking`, the hour stays booked: nobody else can book it, the clinician is hidden from the radar from 15 minutes before it to its end, and the patient still gets a "your session is tomorrow" reminder for a session that no longer exists.
- Evidence: cancellations that do not touch `availability_slots`: `sweepRadar` (`lib/data/radar.ts:1223-1234`), `cancelSession` (`lib/data/sessions.ts:665-685`, called by `abandonSession`, `app/(app)/sessions/actions.ts:399-405`), no-show refund (`lib/data/recovery.ts:291`). `releaseUnconfirmedBookings` would free a stale hour but requires `sessions.status='scheduled'` (`lib/data/scheduling.ts:741`), so it never frees these. Reminders select on `availability_slots.status='booked'` only, never on the session's status (`scheduling.ts:859-866`, `900-907`). `reachable()` hides the clinician on `a.status='booked'` alone (`radar.ts:217-223`). Only `cancelBooking` (`scheduling.ts:560-602`) reopens the hour.
- Severity: S2
- Fix sketch: one `cancelSessionEverywhere` in the data layer that cancels the session and frees any slot pointing at it, used by all four paths; reminders join `sessions.status='scheduled'`. Prove by cancelling via each path and asserting the slot is `open`.
- Decision it came from: 11.2 made the slot and the session two rows; only the slot-first path was written to keep them in step.

### SESS-3 · A clinician cancelling a booked hour tells the patient nothing and refunds nothing
- Verdict: CONFIRMED
- Sources: new (found verifying the cancellation claims); code-07 Stale 15 is the adjacent comment
- Promise: P2
- Who is hurt and how: a patient whose appointment the clinician cancels is not messaged in the app or by email, and if they had already paid the money stays where it is; they find out by turning up.
- Evidence: `app/(app)/on-call/schedule-actions.ts:77-91` says "the patient is told" and calls only `cancelBooking` then `revalidatePath`; `cancelBooking` (`lib/data/scheduling.ts:560-602`) writes the slot, the session and an audit row and sends nothing, and never looks at `payment_status`. The patient-side branch (`by: "patient"`, `:578`) matches on `booked_by_account_id`, which neither caller of `bookSlot` sets (`app/(public)/t/[id]/book/actions.ts:121-128`, `app/(app)/bookings/actions.ts:99-106`), and no patient action calls it, so a patient cannot cancel at all.
- Severity: S2
- Fix sketch: `cancel()` notifies through `notify()` (in-app plus email) and, for a paid session, opens a refund work item; a patient cancel path keyed on the join token. Check: a verifier that cancels a booked paid hour and asserts one notification row and one refund work item.
- Decision it came from: unknown; the comment describes an intention that was never wired.

### SESS-4 · No reschedule anywhere
- Verdict: CONFIRMED
- Sources: brief scope item; code-07 Stale 15
- Promise: none
- Who is hurt and how: to move an appointment the clinician must cancel (which tells nobody, SESS-3) and the patient must book again; a paid session cannot be moved without the money being stranded.
- Evidence: `grep -ri reschedul app lib components` returns nothing. Messages tell the patient to "tell your therapist as early as you can" (`app/(public)/t/[id]/book/actions.ts:159`, `app/api/cron/[job]/route.ts:539`).
- Severity: S3
- Fix sketch: `moveBooking(slotId, newSlotId)` in `lib/data/scheduling.ts` that moves the session's `scheduled_at` and both slots in one transaction, keeping payment; notify the patient.
- Decision it came from: not decided; absent.

### SESS-5 · A calendar-booked patient is never given a way into the session or a way to pay
- Verdict: CONFIRMED
- Sources: code-07 Suspect 1 (patient links to `/sessions/<id>`), MAP confirmed 3 (the id travels in booking emails)
- Promise: P1, P2
- Who is hurt and how: somebody who books an hour from a clinician's public page is told "We have sent you a confirmation with the link to join", but the link opens the clinicians' sign-in page; for a paid hour there is no way to reach the pay page either, so the booking can only lapse.
- Evidence: confirmation link `${appUrl}/sessions/${sessionId}` (`app/(public)/t/[id]/book/actions.ts:160`), same in `invitePatient` (`app/(app)/bookings/actions.ts:127`) and the reminder (`app/api/cron/[job]/route.ts:541`). `/sessions` is a clinician prefix (`lib/routing.ts:33-48`); `app/(patient)/sessions/[id]/` has no page, only `recovery-actions.ts`, so the path resolves to `app/(app)/sessions/[id]/page.tsx` and `routeDecision` (`lib/routing.ts:371-396`) redirects an unsigned visitor to the clinician sign-in. `bookSlot` mints a join token (`scheduling.ts:485`) that no message ever carries. The booked screen (`components/scheduling/booking-calendar.tsx:91-105`) shows only the time.
- Severity: S2
- Fix sketch: send `/join/<joinToken>` in all three messages (the join page already handles pay-then-consent-then-room) and show it on the booked screen. Check: grep that no `notify` link builds `/sessions/${` for a patient recipient.
- Decision it came from: 11.7 confirmation predates 11.2's join token being minted on this path (the token comment at scheduling.ts:464-484 was added later and the links were not updated).

### SESS-6 · `bookSlot` writes a session without the fields its sibling paths set
- Verdict: PARTLY
- Sources: code-03 Broken (bookSlot prices in the wrong currency)
- Promise: E3 (price shown is price owed)
- Who is hurt and how: an Egyptian clinician priced at 450 pounds has every public calendar booking recorded as 450 dollars, which is what the patient's own sessions list shows ("$450"). The money actually charged is not changed by this omission, because every pay path ignores the stored currency anyway (SESS-7).
- Evidence: `lib/data/scheduling.ts:442-489` sets `priceCents` from `users.session_rate_cents` and omits `priceCurrency` (defaults `usd`, `lib/db/schema.ts:722`), `sessionType` (defaults `direct` though priced; `createSession` writes `paid_link`, `lib/data/sessions.ts:252`), `guestName` and `guestEmail`. `createSession` and `createRadarSession` copy `users.rate_currency` (`sessions.ts:267, 341`). The only reader of `sessions.price_currency` is `lib/data/patient-view.ts:102,146` (display). No DB default or trigger fills it.
- Severity: S3
- Fix sketch: `bookSlot` calls the same `rateCurrencyFor` and sets `sessionType: price > 0 ? "paid_link" : "direct"`; better, one `newSessionValues()` helper shared by the three insert sites. Check: a verifier that inserts through all three paths for an EGP clinician and compares the rows.
- Decision it came from: 16.5 (currency per session) was applied to the two paths that existed in `sessions.ts`; `bookSlot` lives in another file.

### SESS-7 · Every payment path treats a session's price as US dollars, whatever currency the clinician priced in
- Verdict: CONFIRMED
- Sources: new, found verifying SESS-6 (cross-domain: money)
- Promise: E3, A1
- Who is hurt and how: a clinician who sets their price as 450 Egyptian pounds (allowed, `app/(app)/settings/actions.ts:220-260`) has patients asked to pay 450 dollars converted into pounds, about fifty times the price, on the pay page and on the bank-transfer sheet.
- Evidence: settings store `session_rate_cents` in the typed currency with `rate_currency='egp'` (`settings/actions.ts:256-261`). The pay page computes `sessionMoney({ grossCents: owed.grossCents })` and converts with `quoteFor("usd", country.currency)` (`app/pay/[token]/actions.ts:95-114`); the transfer rail's `sessionTransferMoney` returns `settlesCents` from `priceCents` and `manualEntry` documents it as "in USD cents" (`lib/billing/manual-entry.ts:182-205, 226-229`). Neither reads `sessions.price_currency`. `grep priceCurrency lib app` finds only the two writers and `patient-view.ts`.
- Severity: S1
- Fix sketch: convert at session creation into a single settlement currency and store both, or make `sessionMoney`/`sessionTransferMoney` take `price_currency` and skip the USD step when it already matches. Check: money verifier with an EGP-priced clinician asserting the quoted pounds equal the typed pounds plus VAT.
- Decision it came from: 16.5 added per-session currency; 76.46 unblocked EGP pricing in production; the pay paths were never taught about either. For the money verifier to own; recorded here because the sessions domain surfaced it.

### SESS-8 · A clinician's heartbeat stops when their tab is hidden, so they drop off the radar in 90 seconds while their toggle says On
- Verdict: CONFIRMED
- Sources: code-11 Broken (presence.tsx:249-275), code-11 Promise evidence P1
- Promise: P1
- Who is hurt and how: a clinician who goes on the radar and then switches to another tab or app is silently taken off the public board 90 seconds later; patients see nobody, and the booking alarm (which rides the same ping) cannot fire for a booking made in that window.
- Evidence: `components/radar/presence.tsx:251-252` `tick` returns when `document.visibilityState !== "visible"`, in live mode too (the comment at 41-50 justifies the skip for the idle, offline case only). `radarPing` (`app/(app)/on-call/actions.ts:116-136`) is the only caller of `heartbeat` apart from `setOnline`; there is no service worker. `reachable()` requires `last_seen_at` within 90 s for everyone (`lib/data/radar.ts:59, 201`), so the drop happens at query time, not at the sweep. The component header (28-38) names this exact failure as the bug it exists to prevent.
- Severity: S2
- Fix sketch: skip only when `!active`; when active keep pinging hidden (browsers throttle to about once a minute, so also widen `HEARTBEAT_STALE_MS` to cover a throttled tab, or ping on `visibilitychange`). Check: a browser test that goes online, hides the page for 120 s and reads `/api/radar`.
- Decision it came from: the Neon billing rule at the top of `app/api/cron/[job]/route.ts` (wakes cost money), applied to the client poll without separating the live case.

### SESS-9 · "Go in now" is covered by a sound prompt that cannot be dismissed while the booking rings
- Verdict: CONFIRMED
- Sources: code-07 Broken 3, code-11 Suspect (z-index of presence card and sound prompt)
- Promise: P1
- Who is hurt and how: a clinician whose browser has blocked sound gets a full-screen box over the "Go in now" card the moment a patient books; its only button ("I will fix it in my browser") does nothing while the booking is live, so they cannot reach the patient from the screen and the patient is left waiting, which then feeds the automatic no-show and suspension (SESS-16).
- Evidence: `components/radar/presence.tsx:420-426` renders `SoundPrompt` with `forced={ringing}`; `:614-615` returns null only when `!forced`; `:617` `blocked` hides the enable button (`:652`); the remaining button calls `close()` which sets `dismissed`, ignored while `forced` (`:615`). The prompt is `fixed inset-0 z-[200]` portalled to body (`:619-620`); the booking card with the Go in link is `z-[60]` (`:454`). `blocked` is set when arming from a gesture fails (`lib/alarm.ts:177, 205`). Escape routes that remain: a browser notification click if permission was granted (`presence.tsx:232-235`), or typing the URL.
- Severity: S2
- Fix sketch: when forced, the prompt carries the Go in link itself and "not now" dismisses it for this booking; never cover the only action with a modal. Check: a browser test with autoplay blocked that books and clicks Go in.
- Decision it came from: "An unarmed alarm during an actual booking is not a suggestion" (`presence.tsx:423`).

### SESS-10 · The patient's "Go in" pill sits under the language switch on a phone
- Verdict: PARTLY
- Sources: code-10 Broken 8
- Promise: P1
- Who is hurt and how: on a 390px phone the language pill paints over the "Go in" label at the top corner; the patient can still get in, because the whole red strip is the link, but the word they are told to tap is under another control.
- Evidence: `components/patient/session-started.tsx:47-74` is one `<Link>` for the whole strip, "Go in" pill at the inline end, `mb-2` and no top margin; `app/(patient)/layout.tsx:79-80` renders `LanguageCorner` (`components/i18n/language-corner.tsx:34-43`, `fixed top-0 end-0 z-50 p-2`, pointer-events-auto pill) immediately before it. Overlap is from the code; exact geometry not measured.
- Severity: S3
- Fix sketch: give the strip a top offset equal to the corner's height, or render the switch inside the chrome's flow. Walk: at 390px with a live session, screenshot the top of `/patient`.
- Decision it came from: 75.3 (switch in the same corner of every screen) landed after 76.17 (the live strip).

### SESS-11 · One network can hold dozens of radar clinicians in "someone is booking them" indefinitely
- Verdict: CONFIRMED
- Sources: code-03 Broken (viewing holds have no bound)
- Promise: P1
- Who is hurt and how: a script, or one household's stuck tab, can keep clinicians showing as taken for as long as it likes; a real patient in crisis is told "Someone just started booking them" for every one of them.
- Evidence: `reserveTherapist` (`lib/data/radar.ts:714-753`) lets the holder renew its own reservation (`:742-746`) for another 60 s with no count of renewals and no per-caller cap on how many clinicians it holds. The only limit is `consume(callerKey("radar:view"), 60, 60)` (`app/(public)/radar/actions.ts:77`), 60 reservations a minute per network, each against any clinician; `viewer` is a browser-chosen string (`:70-83`). A held clinician is refused to everyone else (`actions.ts:172-174`; `claimTherapist` term 3, `radar.ts:1059-1069`). The booking path has per-clinician and per-hold limits (`actions.ts:189-196, 239-243`); the viewing path has neither.
- Severity: S2
- Fix sketch: cap total hold time per (viewer, clinician), for example three renewals, and allow one live viewing hold per caller network (reuse `takeHold` with key `radar:view-hold`). Check: a unit test renewing past the cap and a second clinician refused.
- Decision it came from: the reservation was added so a viewer is not told "someone else" about their own hold (comment at `radar.ts:64-71`); the renewal term was the fix for that, without a bound.

### SESS-12 · A suspended clinician can switch themselves on
- Verdict: HANDLED
- Sources: brief scope item
- Promise: none
- Who is hurt and how: nobody. The toggle succeeds and writes status `online`, but a suspended clinician is excluded from every board, reservation and claim, and their own screen shows the suspension.
- Evidence: `setOnline(true)` (`lib/data/radar.ts:896-1011`) never reads `suspended_until` and `toggleRadar` audits `radar.online` (`app/(app)/on-call/actions.ts:81-98`). Patch: `reachable()` refuses `suspended_until > now` (`radar.ts:181`), used by the board, `reserveTherapist` (`:735`) and `claimTherapist` (`:1080`); the directory's `listable` too (`lib/data/discover.ts:112`). `radarPing` returns the suspension (`on-call/actions.ts:133-134`) and `StatusPill` replaces the On pill with "suspended until" (`components/radar/presence.tsx:715-726`). Residue (S4): the audit log records `radar.online` for a suspended clinician and `/admin/tv` shows a teal live dot beside the Suspended badge (`components/admin/total-view.tsx:344-360`).
- Severity: S4
- Fix sketch: `setOnline` returns "You are off the radar until ..." when suspended, so the action and the audit tell the truth.
- Decision it came from: `drizzle/0012_radar_demo_ban.sql:8-11`, "a ban has to survive the clinician toggling themselves back on".

### SESS-13 · The admin Total View lists every demo clinician whatever their heartbeat (`lib/console/reads.ts:86`)
- Verdict: CONFIRMED
- Sources: code-13 Suspect (verify-radar-place misses reads.ts), code-13 Unclaimed (b), MAP Suspect 2
- Promise: none (internal)
- Who is hurt and how: only our own operator: the Radar card on `/admin/tv` always lists fixtures, and shows the raw `status` column rather than presence, so a clinician (demo or not) can sit there with a live teal dot for up to a day after they closed their laptop, because the sweep that corrects `status` runs daily.
- Evidence: `radarNow()` WHERE `or(eq(therapistRadar.demo, true), lastSeenAt within 15 min, suspendedUntil not null)` (`lib/console/reads.ts:84-90`); rendered with `row.status === "online"` as a live dot (`components/admin/total-view.tsx:341-363`), labelled "Fixture" (`:359`). Every other presence decision dropped the flag in 80.3 (`lib/data/radar.ts:182-201, 1242-1254`; `lib/data/radar-admin.ts:169`; `lib/data/discover.ts:88-111`). The gate that asserts this (`verify-radar-place`, `PRESENCE_FILES`) is a hand list of three files (per code-13).
- Severity: S4
- Fix sketch: drop the `demo` term; compute the dot from `last_seen_at` within `HEARTBEAT_STALE_MS`, not from `status`; add `lib/console/reads.ts` to the gate, or grep all of `lib` for `therapistRadar.demo` in a WHERE.
- Decision it came from: 80.3 ("a label, never a decision"); the console module was missed.

### SESS-14 · Four comments still say the demo flag exempts a clinician from the heartbeat
- Verdict: CONFIRMED
- Sources: code-01 Stale (0012 and schema.ts:1648-1656), code-12 Stale 11 (scripts/demo.ts:12-15 and seed-demo.ts:458-461)
- Promise: none
- Who is hurt and how: the next engineer, who reads four confident sentences that describe the opposite of the code and may "restore" the exemption.
- Evidence: `lib/db/schema.ts:1649-1656` ("Exempt from the heartbeat expiry ... set by `scripts/demo.ts` and by nothing else"; `scripts/seed-demo.ts` also sets it); `scripts/demo.ts:12-15`; `scripts/seed-demo.ts:458-461` ("`reachable()` exempts a demo row from the heartbeat"); `drizzle/0012_radar_demo_ban.sql:3-6` (a migration, history, leave it). Code: `lib/data/radar.ts:182-201`.
- Severity: S4
- Fix sketch: rewrite the three live comments to the 80.3 rule. A `verify:traps`-style check for the phrase "exempt from the heartbeat" outside migrations.
- Decision it came from: 80.3.

### SESS-15 · Seeded demo clinicians sit on the production radar, bookable by strangers, for ever
- Verdict: HANDLED
- Sources: code-12 Suspect 4
- Promise: P1
- Who is hurt and how: nobody on the live board: a demo clinician appears there only while somebody is signed in as them and their tab is visible, and the card says it is a demonstration account.
- Evidence: suspect premise is `reachable()` exempting demo rows; it does not (`lib/data/radar.ts:201`, heartbeat for everyone), and the sweep takes them offline (`:1236-1257`). The card label: `components/radar/therapist-card.tsx:125`. Residue outside this domain: they remain listed in the patient directory (`lib/data/discover.ts:88-111`, by design) with bookable hours if the seed publishes slots, which is a calendar booking against a fixture; the licence numbers are fabricated (code-12). Not settled here: whether `seed-demo` publishes open hours on production.
- Severity: S3 (residue)
- Fix sketch: seed no open hours for demo clinicians on production, or refuse `bookSlot` for a `demo` clinician outside `SIMULATION_RUNNING`.
- Decision it came from: founder ruling quoted at `radar.ts:191-194`.

### SESS-16 · A patient who opens their link early gets their clinician a no-show, then a suspension (task 122)
- Verdict: CONFIRMED
- Sources: code-02 Broken 4, code-07 Suspect 2, code-07 Broken 3 (the modal that feeds it)
- Promise: none directly (the clinician side of P1)
- Who is hurt and how: a patient who opens next Wednesday's invitation on Monday and types their name is recorded as "joined"; ten minutes later (on their own poll) or at the next 03:00 sweep, the clinician is recorded as a no-show, warned the first time, taken off the radar for 24 hours the second time and 72 hours the third, for a session that has not happened yet.
- Evidence: `joinByToken` stamps `patient_joined_at = now()` on every call with no look at `scheduled_at` (`lib/data/sessions.ts:843-877`); `submitJoin` calls it before the pay step (`app/join/[token]/actions.ts:174`). `sweepAbandonedPatients` (`lib/data/feedback.ts:796-886`) selects `patient_joined_at IS NOT NULL AND started_at IS NULL AND patient_joined_at < now()-10min AND status='scheduled'` with no `scheduled_at` term and no `session_type` term, inserts an `actioned` `no_show` report and escalates (`:856-859`). Triggered by the patient's own poll (`app/join/[token]/actions.ts:560-566` via `markAbandonedIfWaiting`, `feedback.ts:908-918`) and by the daily `crisis` cron (`app/api/cron/[job]/route.ts:136-137`). No patch in the join page (the recovery block keys on `scheduled_at`, `app/join/[token]/page.tsx:218`, but the sweep does not).
- Severity: S2
- Fix sketch: in the sweep, measure from `GREATEST(patient_joined_at, scheduled_at)` and require `scheduled_at IS NULL OR scheduled_at < now()-10min`. Check: unit test with `scheduled_at` tomorrow and `patient_joined_at` an hour ago returns no rows.
- Decision it came from: the sweep was written for radar sessions, which have no `scheduled_at` (the email still says "booked you on the Crisis Radar", SESS-18); 79.x pointed invitations and calendar bookings at the same join page.

### SESS-17 · The "hourly" backstops run once a day
- Verdict: CONFIRMED
- Sources: code-03 Stale (route.ts:95-101 hourly vs daily), code-07 Stale 1, 2, 3, 4, code-16 Stale 26, code-16 Suspect 14, MAP Stale 2
- Promise: P5-adjacent (crisis alert retry)
- Who is hurt and how: a crisis alert whose notification failed is retried up to 24 hours later, not within the hour; the automatic no-show backstop for a patient who closed the tab fires up to a day late; the radar status column, which the admin console reads, stays "online" up to a day after a clinician left.
- Evidence: `vercel.json:4-23` (five crons, only `reminders` hourly). `app/api/cron/[job]/route.ts:31` "Four jobs, three of them on a clock" (six jobs, five scheduled); `:81-84` "went to nothing at all" (five are live); `:99-102` "An hour late is fine"; `:337, 342` check-ins "HOURLY like the rest" inside `billing`, which is daily; two stacked docblocks at `:375-391` and the `extract` docblock above `reminders` at `:423-434`. `lib/data/timezone.ts:20-21` says the reminder cron "runs at 03:20" (it is hourly at :20). README says 3 crons (MAP Stale 2). `sweepUndeliveredAlerts` runs only inside `crisis` (`route.ts:126-127`).
- Severity: S2 (crisis retry), S4 (comments)
- Fix sketch: move `crisis` to hourly (the file's own Neon arithmetic at `:438-455` says an hourly wake costs about a cent a month at a zero idle timeout), or give `sweepUndeliveredAlerts` its own hourly entry; rewrite the header to match `vercel.json`; `verify:runbook` already reads `JOBS` and could also read `vercel.json` and assert the schedules the comments claim.
- Decision it came from: the Neon billing reasoning at `route.ts:33-118`, written when the idle timeout was five minutes; 11R.17 later records it as zero seconds, which removes the reason.

### SESS-18 · Automatic suspensions: the header, the email and the counting do not match the rule
- Verdict: CONFIRMED
- Sources: code-02 Stale 9, code-02 file notes (task 122, 72 h on the third, counts never decay, email always says Crisis Radar)
- Promise: none
- Who is hurt and how: a clinician missed from a calendar or invited session is told "A patient booked you on the Crisis Radar"; a clinician's no-shows never expire, so two in their first month and one two years later is an indefinite ban; staff reading the code are told the first no-show gets a day off when it gets a warning.
- Evidence: header `lib/data/feedback.ts:547-548` "A day for the first, three for the second, indefinite after that"; code: automatic path warns on the first (`prior === 0`), then `suspensionFor(prior-1)` gives 24 h on the second, 72 h on the third, 3650 days from the fourth (`:554-558, 856`). The patient-report path uses `suspensionFor(prior)` with no warning (`app/feedback/[token]/actions.ts:110-112`), so the same history gives different penalties by path. `countNoShows` has no time bound (`feedback.ts:560-572`). Email text fixed to "Crisis Radar" (`:879-880`). The report-path email signs off with the clinician's own name (`app/feedback/[token]/actions.ts:135`).
- Severity: S3
- Fix sketch: one `penaltyFor(therapistId)` used by both paths, counting the last 90 days; email names the session kind. Check: unit tests on the ladder.
- Decision it came from: task 122 (the three-day ban) and sprint 14; the warning step was added to the sweep only.

### SESS-19 · A "they did not join" report suspends the clinician and refunds with no check that anything was missed
- Verdict: CONFIRMED
- Sources: code-07 Broken 5, code-10 Broken 5, code-10 Suspect 10, code-09 Suspect 11, code-02 Suspect 12
- Promise: A1 (refunds and bans without a person), A4
- Who is hurt and how: anyone holding a session's feedback link (the patient, or whoever they forward it to) can press "They did not join" on a session that happened, and the clinician is suspended at once; pressing it three times (ten a network per ten minutes are allowed) is an indefinite ban. A patient who paid by bank transfer is told "Your payment has been refunded ... reaches your card in a few days" and nothing is refunded.
- Evidence: `fileReport` checks only that the feedback token exists (`lib/data/feedback.ts:338-371`), not session status, `started_at`, the 72-hour window `feedbackContext` uses, or an earlier report; no unique index on `session_reports(session_id, kind)` (code-07 cites drizzle/0013; the automatic sweep relies on "no report yet" in its own WHERE only, `feedback.ts:815, 825`). `reportSession` refunds only a `session_payments` row, swallows any error, then suspends (`app/feedback/[token]/actions.ts:76-121`); the manual rail writes `manual_payments`, not `session_payments`, so a transfer payer gets nothing back while the form says a card refund is on its way (`components/feedback/rating-form.tsx:464-467`). Refund audit names the clinician as the administrator (`actions.ts:103`). The final UPDATE marks every report on that session `actioned`, including an unrelated abuse report (`:114-121`). The admin page's "A no-show has already been refunded and the clinician suspended automatically" (`app/(admin)/admin/radar/page.tsx:57-58`) is false for the automatic sweep, which never refunds (`feedback.ts:834-883`), and for every transfer payer.
- Severity: S1 (money told refunded and kept; a person banned with no check)
- Fix sketch: accept `no_show` only when `started_at IS NULL` and `scheduled_at` (or `created_at` for radar) has passed, one per session (unique partial index); on the manual rail open a refund work item for an operator instead of claiming a card refund; the form's sentence comes from what actually happened. Check: action test on a completed session returns an error and writes nothing.
- Decision it came from: "making them wait for office hours to get their money back is the wrong answer" (`actions.ts:53-57`), written for the Stripe rail.

### SESS-20 · A radar patient left waiting has no recovery, no refund and no message
- Verdict: CONFIRMED
- Sources: code-02 Suspect 12 (no-show session stays scheduled and paid), new detail found verifying it
- Promise: P5-adjacent, A4
- Who is hurt and how: a stranger who pays off the radar and waits in an empty room is never offered the replacement or refund that sprint 14 built, because that offer only appears for sessions with a booked time; the automatic sweep suspends the clinician but leaves the patient's session "scheduled" and "paid", tells them nothing and gives nothing back.
- Evidence: the recovery block renders only when `session.scheduledAt` is set (`app/join/[token]/page.tsx:218`); `createRadarSession` never sets it (`lib/data/sessions.ts:324-344`). `waitMinutes` is computed once at server render (`page.tsx:223`) and the component's effect reads that prop (`components/session/no-show-recovery.tsx:64-72`), so even a scheduled patient who opened the page before minute five sees no offer until they reload. `sweepAbandonedPatients` writes a report and emails the clinician only (`lib/data/feedback.ts:834-883`). Feedback links are sent only for `completed` sessions (`feedback.ts:733`).
- Severity: S2
- Fix sketch: key the recovery on `COALESCE(scheduled_at, patient_joined_at)` and tick it on the client; when the sweep records an automatic no-show, cancel the session, open a refund (or transfer-refund work item) and notify the patient in-app.
- Decision it came from: sprint 14 designed recovery for calendar bookings; the radar, the case the sweep was written for, was left out.

### SESS-21 · Session recovery by bare id, open for future sessions
- Verdict: CONFIRMED (MAP Confirmed 3, carried in, not re-verified)
- Sources: code-03 Broken (no-show recovery enforces none of its preconditions), code-08 Broken 1
- Promise: A1
- Who is hurt and how: anyone holding a session id (it travels in booking emails) can, days before a session, cancel it with a refund, hand it and its record to any account, or mark a no-show against the clinician.
- Evidence: MAP Confirmed 3: `app/(patient)/sessions/[id]/recovery-actions.ts`, `lib/data/recovery.ts:175-180, 288-302, 352-357`. Additional, verified here: `refundNoShow` refunds only a `session_payments` row with `status='paid'` (`recovery.ts:307-323`), so on the transfer rail it cancels and reports "refunded" with nothing moved; its cancel does not free the calendar hour (SESS-2).
- Severity: S1
- Fix sketch: as MAP 3 (due-time condition in the data layer, verified taker); plus the manual-rail refund work item.
- Decision it came from: "the session id is the capability" (`recovery.ts:266-270`).

### SESS-22 · The clinician who rescues a patient is scored as a no-show too
- Verdict: CONFIRMED
- Sources: code-03 Broken (reliabilityFor penalises the replacement)
- Promise: none
- Who is hurt and how: a clinician who steps in for somebody who did not turn up has that session counted as their own no-show in the reliability figure shown once they pass five sessions.
- Evidence: `recordNoShow` stamps `no_show_at` on the session row (`lib/data/recovery.ts:352-357`); `reassignSession` moves the same row to the replacement (`:210-221`); `reliabilityFor` counts `no_show_at IS NOT NULL` where `therapist_id = user OR reassigned_from_user_id = user` (`:381-397`), which matches both people.
- Severity: S3
- Fix sketch: count a no-show for `COALESCE(reassigned_from_user_id, therapist_id) = user` only.
- Decision it came from: 14.7; the comment at `:390-392` states the intended rule and the SQL does not implement it.

### SESS-23 · The in-room "tell us" report is dropped while the patient is told it was sent
- Verdict: CONFIRMED
- Sources: code-10 Broken 4
- Promise: A5-adjacent (a report reaches a person)
- Who is hurt and how: a patient who reports their clinician from inside the session is shown "sent" and nothing is filed.
- Evidence: `components/join/patient-room.tsx:731-735` calls `reportSession({ token, kind: "abuse", ... })` and sets `sent` without reading the result; `token` is the join token (`components/join/join-flow.tsx:248`); `fileReport` looks up `sessions.feedback_token` (`lib/data/feedback.ts:351`) and returns "This link is no longer valid." The rating form uses the feedback token correctly (`components/feedback/rating-form.tsx:459`).
- Severity: S2
- Fix sketch: pass `feedbackToken` down (JoinFlow already has it, `join-flow.tsx:53`) and show the error when there is one.
- Decision it came from: the two-token split (sprint 12.2) after this component was written.

### SESS-24 · The feedback link falls back to the join token
- Verdict: HANDLED
- Sources: code-10 Suspect 13
- Promise: none
- Who is hurt and how: nobody; the fallback cannot be reached.
- Evidence: `components/join/join-flow.tsx:217` uses `feedbackToken ?? token`; `feedbackTokenForJoin` returns the row's token (`lib/data/feedback.ts:89-97`), and `sessions.feedback_token` is NOT NULL (`drizzle/0054_validate.sql:51`, CHECK in `drizzle/0042_sweep.sql:28-29`).
- Severity: S4
- Fix sketch: drop the fallback so a future null fails loudly.
- Decision it came from: 12.2.

### SESS-25 · Daily check-ins never reach anybody in Egypt, because the only run is inside their night
- Verdict: CONFIRMED (proved by execution)
- Sources: new, found verifying code-07 Stale 3 (check-ins "HOURLY like the rest" inside the daily `billing` job)
- Promise: none (unclaimed feature; crisis-adjacent because a check-in is how a reply reaches us)
- Who is hurt and how: the check-in messages a clinician switches on for a patient are never sent to a patient in Cairo, Riyadh, Dubai, London or New York; every run is skipped as "quiet hours" and the cron reports it as a normal skip.
- Evidence: `sweepCheckins` runs only inside `billing` (`app/api/cron/[job]/route.ts:346-347`), scheduled `5 3 * * *` (`vercel.json:9-10`). Default quiet window 21:00 to 09:00 in the patient's zone (`lib/settings/defs.ts:672-673`), enforced by `shouldSend` (`lib/checkins/policy.ts:121-126`). Ran `shouldSend` under node with the defaults at 03:05 UTC in January and July: `quiet_hours` for Africa/Cairo, Asia/Riyadh, Europe/London, America/New_York, Asia/Dubai; `send: true` only for Asia/Tokyo.
- Severity: S3
- Fix sketch: move `sweepCheckins` to the hourly `reminders` job (the cadence is already enforced per person, `policy.ts:128-133`). Check: the same node probe across 24 hourly runs yields one send per zone.
- Decision it came from: C97 put the cadence in settings on the assumption of an hourly cron; the cron went daily for Neon billing.

### SESS-26 · Room status contradictions the patient can see
- Verdict: PARTLY
- Sources: code-10 Broken 19 (strip latch), code-03 Suspect (orb has no time bound), code-03 Suspect (live banner unbounded), code-03 Suspect (briefPending for ever)
- Promise: P2, P3
- Who is hurt and how: (a) after the patient presses Stop recording, their strip says "stopped" for the rest of the session even if recording resumes, while the minimised view's red dot follows the server; (b) a session that never happened keeps an orb on every patient screen pointing at a link that has expired; (c) a cancelled or no-show session in the patient's list says the summary is "still being written" for ever.
- Evidence: (a) `components/join/patient-room.tsx:309-313, 345-351` local `stopped` latch, versus the poll-driven dot at `:208`. The deeper fact is MAP Confirmed 4b: the stop does not stop the clinician's recorder at all, so the strip is wrong in the other direction too. (b) `openSessionForPatient` (`lib/data/patient-view.ts:208-248`) filters `status IN (scheduled, in_progress)` and a non-null token but never `join_token_expires_at`, so an expired link is still offered; nothing cancels a free, never-started scheduled session (the only sweep that cancels, SESS-1, needs `payment_status='pending'`). (c) `sessionsForPatient` (`patient-view.ts:88-151`) has no status filter and sets `briefPending: !signed && at < now` (`:149`). Handled part: the live banner (`liveSessionForPatient`, `:250-288`) is bounded by `sweepOverrunSessions` (`lib/data/sessions.ts:547-577`) and the poll ladder, though the sweep is daily (SESS-17).
- Severity: S3
- Fix sketch: (a) drive the strip from the poll only; (b) add `join_token_expires_at > now()` and a `scheduled_at` horizon; (c) `briefPending` only for `status='completed'`.
- Decision it came from: 79.3 (the orb) and 48.10 (patient stop button).

### SESS-27 · Reload in the room (task 115)
- Verdict: HANDLED
- Sources: code-07 Suspect 13, code-07 file notes (task 115)
- Promise: T4
- Who is hurt and how: nobody for a patient who has given their name: a reload resumes rather than asking again.
- Evidence: resume needs `guestName` and a paid-or-free session and one of `checkout`, `booked=1` or `patient_joined_at` (`app/join/[token]/page.tsx:189-193`); `joinByToken` always writes `guestName` and `patient_joined_at` (`lib/data/sessions.ts:867-876`), including for sessions created on an existing chart with no guest name. Residue (S4): every resume re-stamps `patient_joined_at = now()` (`resumeAfterPayment`, `app/join/[token]/actions.ts:251`), which restarts the ten-minute abandonment clock of SESS-16 on each reload.
- Severity: S4
- Fix sketch: `COALESCE(patient_joined_at, now())` in `joinByToken`.
- Decision it came from: task 115.

### SESS-28 · The clinician's calendar shows counts, not appointments
- Verdict: CONFIRMED
- Sources: code-07 Broken 9, code-10 Suspect 3
- Promise: none
- Who is hurt and how: a clinician looking at their month or week sees "9 · 2 booked" per day and must tap each day to learn who and when; and sessions not made through a published hour (radar, the new-session form, paid links) never appear on it at all.
- Evidence: `components/scheduling/calendar.tsx:211-245` renders a count per day in every view (the comment at 231-235 says the day view is "one tap away"; the day view renders the same count cell); names only in the picked-day cards (`:299-327`). `myHours` reads `availability_slots` only (`lib/data/scheduling.ts:170-184`).
- Severity: S3
- Fix sketch: week and day views list booked hours with the name; merge `sessions` with a `scheduled_at` in the window into the same grid.
- Decision it came from: deliberate for the month view (the comment); the week and day views inherited it.

### SESS-29 · The public booking calendar shows only the first ten days that have hours
- Verdict: CONFIRMED
- Sources: code-10 Broken 15
- Promise: none
- Who is hurt and how: a patient looking at a clinician who publishes every day sees ten days of a three-week calendar with nothing saying more exist.
- Evidence: `openHours(id)` returns 21 days (`lib/data/scheduling.ts:195-197`, called from `components/radar/therapist-page.tsx:44`); `components/scheduling/booking-calendar.tsx:224` renders `days.slice(0, 10)` with no "more" control.
- Severity: S3
- Fix sketch: paginate by week, or say "showing the next ten days, more below".
- Decision it came from: unknown.

### SESS-30 · `/bookings` publishes hours in UTC for a clinician with no stored zone
- Verdict: CONFIRMED
- Sources: code-10 Broken 14
- Promise: none
- Who is hurt and how: a clinician in Cairo with no zone saved who opens 18:00 on `/bookings` publishes a 20:00 or 21:00 appointment; the page does print the zone, so it is visible.
- Evidence: `app/(app)/bookings/page.tsx:66` passes `actor.timezone ?? "UTC"`; `publishHours` converts with that zone (`lib/data/scheduling.ts:79-102`); `users.timezone` is nullable (`drizzle/0040_repair.sql:12`); `/on-call` adopts the browser zone instead (code-10). Zone label: `components/scheduling/calendar.tsx:196-198`.
- Severity: S3
- Fix sketch: the same browser-zone adoption `/on-call` does, or refuse to publish until a zone is saved.
- Decision it came from: 11R.2 (zone said out loud) without 12.x's required zone.

### SESS-31 · A calendar slot's length is unconstrained
- Verdict: PARTLY
- Sources: code-01 Suspect (0039 duration)
- Promise: none
- Who is hurt and how: nobody today: no code writes a duration, so every hour is 60 minutes.
- Evidence: `drizzle/0039*.sql:10` `duration_minutes integer DEFAULT 60 NOT NULL`, no CHECK; `grep durationMinutes lib app` finds only a reader (`lib/data/scheduling.ts:247`) and the radar window (`lib/data/radar.ts:222`).
- Severity: S4
- Fix sketch: CHECK `duration_minutes = 60` until variable lengths exist.
- Decision it came from: 11.1.

### SESS-32 · Withdrawing a held hour, and the calendar's withdraw control
- Verdict: HANDLED
- Sources: code-10 Suspect 4, code-10 Looks handled 3
- Promise: none
- Who is hurt and how: nobody; a patient mid-booking keeps their hour.
- Evidence: the bin shows on `held` rows (`components/scheduling/availability-editor.tsx:266-281`) but `withdrawHour` is conditional on `status='open'` (`lib/data/scheduling.ts:159`), used by both `app/(app)/on-call/schedule-actions.ts:65-72` and `app/(app)/bookings/actions.ts:46-53`. Residue (S4): the refusal message says "That hour is booked" for a held hour.
- Severity: S4
- Fix sketch: hide the bin for `held`.
- Decision it came from: 11.x.

### SESS-33 · Radar handled items the readers flagged
- Verdict: HANDLED
- Sources: code-03 Looks handled (reachable lacks verification), code-08 Looks handled 2 (hold releases a CGNAT neighbour's booking), code-08 Looks handled 1 (signed-in patient books as guest), code-01 Looks handled (0112/0114 status and country repairs), code-11 Looks handled (unknown status fails closed), code-07 Looks handled 5 (cron `job in JOBS`), code-06 Suspect 5 (slot hold 10 minutes vs transfer)
- Promise: P1
- Who is hurt and how: nobody, each is patched.
- Evidence: `bookFromRadar` re-reads `listRadar`, whose `queryBoard` requires approval and an open country (`app/(public)/radar/actions.ts:165-169`); the network hold refuses to cancel a paid or joined session, twice (`actions.ts:287-318`); the pot is charged at the join page (`lib/data/sessions.ts:346-359`, `app/join/[token]/actions.ts:192-193`); `job in JOBS` sits behind `CRON_SECRET` (`app/api/cron/[job]/route.ts:621-627`). The slot `HOLD_MS` of ten minutes (`lib/scheduling/hours.ts:36`) covers only the booking form: `bookSlot` turns the hold into `booked` immediately (`lib/data/scheduling.ts:500-516`), so a transfer is not racing it; the real transfer race is SESS-1 and the 24-hour release in `releaseUnconfirmedBookings` (`scheduling.ts:673, 718-797`).
- Severity: S4
- Fix sketch: none.
- Decision it came from: various (79.1, 80.3, 53.21).

### SESS-34 · An operator's radar ban can be given with no reason
- Verdict: CONFIRMED
- Sources: code-09 Broken 6
- Promise: A5-adjacent
- Who is hurt and how: a clinician banned from the radar, possibly for ten years, is told "Reason given: Administrator action".
- Evidence: `components/admin/radar-command.tsx:455` sends `reason || "Administrator action"`; the server rule `note.length < 4` ("Give a reason. The clinician is shown it.", `app/(admin)/admin/actions.ts:723-725`) therefore never fires.
- Severity: S3
- Fix sketch: send `reason` as typed and disable the ban buttons until it is at least a sentence.
- Decision it came from: the server rule; the UI default undoes it.

### SESS-35 · Arabic tells clinicians their hours are bookable "outside the radar"
- Verdict: CONFIRMED
- Sources: code-06 Broken 8
- Promise: none
- Who is hurt and how: an Arabic-reading clinician is told the opposite of the English.
- Evidence: `lib/i18n/messages.ts:2379` "on your profile and the radar"; `:5713` "على ملفك وخارج الرادار" ("on your profile and outside the radar").
- Severity: S4
- Fix sketch: "على ملفك وعلى الرادار".
- Decision it came from: translation.

## Summary table

| Id | Verdict | Severity |
|---|---|---|
| SESS-1 | CONFIRMED | S1 |
| SESS-2 | CONFIRMED | S2 |
| SESS-3 | CONFIRMED | S2 |
| SESS-4 | CONFIRMED | S3 |
| SESS-5 | CONFIRMED | S2 |
| SESS-6 | PARTLY | S3 |
| SESS-7 | CONFIRMED | S1 |
| SESS-8 | CONFIRMED | S2 |
| SESS-9 | CONFIRMED | S2 |
| SESS-10 | PARTLY | S3 |
| SESS-11 | CONFIRMED | S2 |
| SESS-12 | HANDLED | S4 |
| SESS-13 | CONFIRMED | S4 |
| SESS-14 | CONFIRMED | S4 |
| SESS-15 | HANDLED | S3 |
| SESS-16 | CONFIRMED | S2 |
| SESS-17 | CONFIRMED | S2 |
| SESS-18 | CONFIRMED | S3 |
| SESS-19 | CONFIRMED | S1 |
| SESS-20 | CONFIRMED | S2 |
| SESS-21 | CONFIRMED (MAP 3) | S1 |
| SESS-22 | CONFIRMED | S3 |
| SESS-23 | CONFIRMED | S2 |
| SESS-24 | HANDLED | S4 |
| SESS-25 | CONFIRMED | S3 |
| SESS-26 | PARTLY | S3 |
| SESS-27 | HANDLED | S4 |
| SESS-28 | CONFIRMED | S3 |
| SESS-29 | CONFIRMED | S3 |
| SESS-30 | CONFIRMED | S3 |
| SESS-31 | PARTLY | S4 |
| SESS-32 | HANDLED | S4 |
| SESS-33 | HANDLED | S4 |
| SESS-34 | CONFIRMED | S3 |
| SESS-35 | CONFIRMED | S4 |
