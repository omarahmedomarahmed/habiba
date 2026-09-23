# Patient inventory (somebody in therapy)

Derived from code on 2026-09-23. Evidence is the code path (page, component, server action, `lib/data`), not comments or docs. English labels are quoted from `lib/i18n/messages.ts` (`en`); a label in quotes with no key beside it is a hard coded English literal in the component. "Signed in" means `lib/patient-auth/guard.ts:requirePatient` resolved a row in `patient_auth_sessions` (4 h idle, 7 days absolute). "Value" quotes `docs/VALUE-STATEMENTS.md` (P1 to P5, T4, E3 to E5, A3) or the `/for-patients` CMS row in `docs/content-backup/for-patients-production-2026-09-21.json` (marked FP).

## 1. Summary

The patient can reach **36 routes**: 24 under `app/(patient)/patient/**` (3 open auth pages, 1 open invite page, 20 signed in) and 12 outside it that a patient lands on (`/join/[token]`, `/pay/[token]`, `/feedback/[token]`, `/j/[code]`, `/support/[token]`, `/records/[token]` with its `data.json`, the public `/radar`, `/t/[id]`, `/verify`, `/contact`, plus `/session-expired` and `/sessions/[id]/room`, which are clinician routes a patient can be sent to by mistake). Fundamentally a patient can: find a verified therapist (search by area or language, live radar with filters) and start an instant session or book a calendar hour; join a video room by link, answer the recording question, stop recording, share their profile, report abuse, and minimise the call; pay by card (Stripe checkout with VAT and FX) or by declared bank transfer; rate a session and receive a signed plain-language summary; own a record (claim one a therapist keeps, by phone match plus two questions or by invite link), read every signed summary version with author and licence, read documents and flag them, write a journal (typed or dictated), tick off agreed steps, answer questionnaires; decide who may read their history (answer requests, revoke, generate an invite code, ask an old therapist, unlink partner platforms); activate an employer benefit; see paid sessions and credit; request an emailed export; mute check-in messages; consent to cross-border storage; and reach an SOS sheet on almost every screen. The biggest structural fact: **sessions a signed-in patient books by themselves are not attached to their account** (`bookFromRadar`, `book`, `joinByToken` all create a new `patients` row and a new `people` row), so the signed-in app mostly shows sessions a clinician created against a record the patient has already claimed.

## 2. The table

### Patient shell (every page in `app/(patient)`)
`app/(patient)/layout.tsx`, `app/(patient)/error.tsx`, `components/patient/chrome.tsx`, `components/patient/bottom-nav.tsx`, `components/patient/session-orb.tsx`, `components/patient/session-started.tsx`, `components/patient/sos-orb.tsx`, `components/i18n/language-corner.tsx`

| Section | What they see (data shown, from which loader) | What they can do (every button/form/link, and the server action or route it calls, file:function) | Value it delivers | Gaps |
| --- | --- | --- | --- | --- |
| Bottom nav (signed in only) | Tabs "Home", "Sessions", centre globe "Find someone now", "Therapists", "You" (`tab.*`) | Links `/patient`, `/patient/sessions`, `/patient/radar`, `/patient/browse`, `/patient/account` | P1 (radar one tap from anywhere) | No tab or link for Notices, Messages, Residency, Benefit, Billing (Billing only via You). No unread badge (`lib/data/notices.ts:undismissedCount` is never called) |
| Session-started banner | Red card "Your session has started", "{name} is in the room", "Go in" (`lib/data/patient-view.ts:liveSessionForPatient`, status `in_progress`) | Link to `/join/{joinToken}` | P2 ("a session starting ... appear[s] in the app itself") | Only for sessions whose `patients.personId` is this person, so never for radar or self-booked sessions (see Gap A in section 4) |
| Session orb | Floating button: "Pay for your session" (amber, owes) or "Open your session" / "Your session has started. Join now" (`patient-view.ts:openSessionForPatient`, newest open session only) | Link to `/join/{joinToken}` | P2 ("the session orb on every screen while money is owed or a door is open") | Shows only the newest open session (`limit(1)`); a second unpaid session is unreachable from the orb. Same person-link limitation as the banner |
| SOS orb and "Help now" sheet | Draggable red "SOS" (position saved in localStorage `24t_sos`); sheet: "Help now", "These are phone numbers, not a chat", one country tile, "Anywhere else, call your local emergency number..." (`lib/crisis/line.ts:lineForNumber`, from the account phone) | Tap opens sheet; `tel:` link to 988 (US) or 105 (EG, with "Press 1 for Arabic..."); Close | P5 ("the SOS button is reachable, on top, and dials without passing anything about money") | Only US and EG numbers exist (`CRISIS_LINES`); layout passes no `country` and no admin-configured line, so any other phone (Gulf, UK) gets no number at all. z-index 70 sits under the radar booking sheet (z-100) |
| Language corner | EN / AR switch, top end corner | `components/i18n/language-switch` | none stated | none |
| Error boundary | "Something went wrong" copy (`error.*`), SOS orb kept | "Try again" (`reset`) | P5 | No `loading.tsx` anywhere in the product: every force-dynamic page shows nothing until the server finishes. Global `app/not-found.tsx` has no SOS orb, so `/patient/t/[bad]`, `/patient/assessments/[bad]`, `/pay/[bad]` drop the crisis path |
| Session expiry | After 4 h idle or a revoked session the cookie stays (7 day `maxAge`) | none | none stated | **Redirect loop**: `requirePatient` sends to `/patient/login`, middleware (`lib/routing.ts:routeDecision`) sends a cookie holder at their door back to `/patient`. The clinician side escapes via `/session-expired`; the patient side has no equivalent |

### /radar (public entry)
`app/(public)/radar/page.tsx`, `components/radar/radar-console.tsx`, `components/radar/filters.tsx`, `components/radar/booking-sheet.tsx`, `app/(public)/radar/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Globe / list | Everyone on shift (`lib/data/radar.ts:listRadar`, refreshed from `GET /api/radar` every few seconds), count "{count} free", status per clinician | "Map" / "List" toggle; drag globe, tap a country to filter; tap a clinician opens booking sheet | FP "A live map of clinicians who are online right now" | none |
| Filters | Language, specialty, country, "Narrow it down", "{count} filters on" | Filter controls; "Show everyone" clears | FP "Filter by language or by what you need help with" | none |
| Empty state | "Nobody matching that is on shift", "{count} other clinicians are available right now." | "Show everyone" | none stated | When nobody at all is online it still says "0 other clinicians are available" and offers only "Show everyone": no link to browse or book an hour, a dead end at the moment of need |
| Booking sheet (dialog) | Name, credentials, status pill, headline, Speaks / Works with / Based in ("Not listed", "Not shared" English), "Held for you · {n}s" countdown (60 s, renewed every 20 s), price "30 minutes, starting now" in USD | `reserveForViewing` / `releaseViewing`; form "Your first name", "Email" (optional) then "Start now" or "Pay $X and start now" to `radar/actions.ts:bookFromRadar` (creates session via `lib/data/sessions.ts:createRadarSession`, Daily room, redirects to `/pay/{token}` or `/join/{token}?booked=1`); "See their full profile" to `/t/{id}`; Close / Escape | P1 | Signed-in patient is asked their name again and the session is created with `guestName` only, never linked to their account. "No account needed. Stripe takes the payment" is false where the Egyptian transfer rail applies ("Card payments coming soon"). No tax shown here, though the home page promises "see the price with the tax on it". Sheet covers the SOS orb. "Held for you", button labels, "Connecting…" are English literals |
| Walk-in block (only if clinician has a practice) | "Accepts walk-in visits", practice name and address | "Get directions" (Google Maps); "Email me the address" then "Send" to `radar/actions.ts:emailDirections` | none stated | none |
| Safety line and SOS | "Not an emergency service..." strip; SOS orb with country from locale only (`crisisCountryFor`) | SOS sheet | P5 | English locale gives `null` country, so an English reader, even in the US, sees no number in the SOS sheet |

### /t/[id] (public therapist page) and /patient/t/[id] (signed-in copy)
`app/(public)/t/[id]/page.tsx`, `app/(patient)/patient/t/[id]/page.tsx`, `components/radar/therapist-page.tsx`, `components/radar/public-profile.tsx`, `components/scheduling/booking-calendar.tsx`, `app/(public)/t/[id]/book/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Back (patient copy only) | "Back" | `PatientBack` (history back or `/patient`) | none stated | Public copy has no back link |
| Profile header | Initials tile, name, credentials, "{avg} from {n} rated sessions" (English plural), availability pill ("Available now", "Someone is booking them", "In a session", "Not on shift", English), headline, bio, Speaks / Works with / Based in / Walk-ins (`lib/data/radar.ts:publicProfile`, polled every 5 s via `/api/radar/profile/[id]`) | none | none stated | Availability pill and rating line are English only; photo is never shown here (initials only) though cards show it |
| Instant session | "30 minutes, starting now", price "$X" or "Free" | "Start a session now" (enabled only when online) opens the same booking sheet; disabled states "Not on shift right now", "With someone else right now" | P1 | Same unlinked-session problem. English literals. Two lengths for one price on one page ("30 minutes" here, "One hour" below) |
| Verification | "Licence checked with {body}, {when}" or "Licence and identity checked by 24Therapy, {when}", "We checked their documents. We do not rate their clinical work." | none | none stated | none |
| Reliability (only when rate known) | "Turned up to X% of N booked sessions." (`lib/data/recovery.ts:reliabilityFor`) | none | none stated | English only |
| Price | "One hour" + `PriceTag` (USD and EGP via `egpRateMicro`) | none | FP "The price is shown in both, at the rate of the day" | Both currencies only here, not on the sheet or join page |
| Book an hour (`BookingCalendar`) | Up to 10 days of open slots in reader time zone (`lib/data/scheduling.ts:openHours`); empty: "No times on the calendar" + "{name} has not published any hours yet..." | Pick a slot; "Your first name", "Email", "Phone or WhatsApp", note; "Confirm" to `t/[id]/book/actions.ts:book` (`holdSlot`, `bookSlot`, `notify` booking.confirmed); "Pick another time" | FP "Pick an hour that suits you and you will get a reminder before it" | Signed-in patient must retype name and contact; `findOrCreatePatient` matches only by email for that therapist, else a new unclaimed person. Confirmation link is `/sessions/{id}`, a clinician-only route that bounces a patient to `/login`. No in-app notice written (P2). Success text "Booked with..." and error strings English; empty-state never links to the radar it mentions |
| Copy link | "Copy this page's link" / "Link copied" | Clipboard write | none stated | On `/patient/t/[id]` it copies a signed-in URL, so a friend gets a login wall. English |

### /j/[code] (poster QR)
`app/j/[code]/page.tsx`, `lib/data/therapist-codes.ts:resolveCode`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Live code | "You are joining" card: therapist name, credentials, practice name; "Create your account" + paragraph about owning the record | `PatientAuthForm mode="signup"` to `lib/patient-auth/actions.ts:patientSignUp`; "Sign in" link `/patient/login` | FP "Your record is yours to claim" | The code is not passed to signup, so the new account is not connected to that therapist at all. A signed-in reader still sees "Create your account". Whole page English only |
| Revoked / unknown code | "This code is no longer in use" / "We do not know that code" with guidance | "Create an account anyway" to `/patient/signup` | none stated | English only |
| SOS | SOS orb (phone if signed in, else locale) | SOS sheet | P5 | as shell |

### /patient/login
`app/(patient)/patient/login/page.tsx`, `components/auth/auth-shell.tsx`, `components/patient/auth-form.tsx`, `components/patient/code-signin-form.tsx`, `lib/patient-auth/code-signin.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Door switcher and promise | "Which are you?"; "Your sessions", "Sign in to see your notes, your homework and who can read your record."; promise "A therapist now, or an hour that suits you." with three points | Links to the other doors; "No account yet? Create one" to `/patient/signup` | none stated | p1 "be in a session in under a minute" and p3 "Book an hour with the same therapist next week" (see section 4) |
| Password form | "Phone number or email", "Password", "Sign in"; "Forgot your password?" | `patientSignIn` then `redirect("/patient")`; link `/patient/forgot-password` | none stated | Ignores `?next=` (set by middleware and by `/patient/invite`), so every sign-in lands on Home |
| Code form | "Sign in with a code instead", "Send me a code", then "Enter your code", "Six-digit code" | `requestSignInCode` (phone goes to WhatsApp, `@` goes to email), `signInWithCode`, then `router.replace("/patient")` | none stated | "WhatsApp codes are not switched on yet" when WhatsApp is not configured, and a phone-only account has no email (Gap B), so a patient who signed up without a password has no way in |

### /patient/signup
`app/(patient)/patient/signup/page.tsx`, `components/patient/auth-form.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Header | "Create your account"; with `?invite=` "{name} invited you..." (`lib/data/claims.ts:resolveInvite`) | "Already have an account? Sign in" | none stated | none |
| Form | "First name", "Last name (optional)", "Phone" (required, "Phone or WhatsApp"), "Password (optional)" with "Leave it empty and sign in with a code instead.", hidden time zone | "Create an account" to `patientSignUp` then redirect `/patient/invite/{token}` or `/patient/claim` | FP "Your record is yours to claim" | **No email field**, and nothing else ever writes `patient_accounts.email`. Optional password plus WhatsApp-only codes can lock the new account out |

### /patient/forgot-password
`app/(patient)/patient/forgot-password/page.tsx`, `components/patient/reset-form.tsx`, `lib/patient-auth/reset.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Request | "Get back into your account", "Phone number or email" | "Send me a code" to `requestPatientReset`; "Back to sign in" | none stated | Phone goes to WhatsApp only |
| Complete | "Six-digit code", "New password" (10+), "Set my new password"; "WhatsApp codes are not switched on yet... tell us" | `completePatientReset` (revokes all sessions); "Ask for another code"; "tell us" to `/contact` | none stated | When WhatsApp is off the only route back is a contact form ticket |
| Done | "Password changed", "You have been signed out everywhere else." | "Sign in" link | none stated | none |
| Therapist hint | "Are you a therapist? Reset your practice password" | Link `/forgot-password` | none stated | none |

### /patient/invite/[token] (open route)
`app/(patient)/patient/invite/[token]/page.tsx`, `components/patient/invite-flow.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Invalid | "This link is no longer valid", "Used, expired, or taken back..." | none | none stated | Dead end: no link to sign in, home or support |
| Signed out | "Your therapist sent you this", "{name} has invited you...", "we will bring you straight back here" | "Create an account" to `/patient/signup?invite=`; "Sign in" to `/patient/login?next=/patient/invite/{token}` | P4 | "Sign in" loses the invite (sign-in ignores `next`), contradicting "we will bring you straight back here" |
| Signed in | "Take ownership of your record", masked name, "Let this therapist keep seeing my profile" checkbox | "This is me, claim it" to `claim/actions.ts:acceptInvite` (`lib/data/claims.ts:redeemInvite`) | P4 | No "This is not me" on this path |
| Done | "That record is yours now", kept / dropped sentence | "Go to my sessions" links to `/patient` (Home, not Sessions) | none stated | Label and target disagree |

### /patient (Home)
`app/(patient)/patient/page.tsx`, `components/patient/explore-rail.tsx`, `components/patient/category-grid.tsx`, `components/patient/therapist-card.tsx`, `components/patient/session-list.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Claimed banner (only `?claimed=kept|dropped`) | "That record is yours now" + kept / dropped sentence | none | P4 | none |
| Header | Avatar (`/api/patient/avatar/[personId]`), "Hello, {name}", "Your record is yours" or "You have not claimed your record yet" (`people.claimedAt`) | Avatar links `/patient/account` | none stated | none |
| Search bar | "What do you need help with?" | Link `/patient/browse` (not a field) | none stated | Looks like an input, is a link |
| Radar card | If `radarCount() > 0`: "Find someone now", "{count} therapists free at this moment"; else "Nobody is online right now", "Book a session with someone instead" | Link `/patient/radar` or `/patient/browse` | P1 | none |
| Access requests (only when pending) | Amber "Somebody asked to read your history", count (`lib/data/grants.ts:pendingRequestsFor`) | "Answer now" to `/patient/consent` | FP "Nothing about you moves until you answer" | none |
| Next step (only when open homework) | "To try before your next session", step title and detail (`lib/data/homework.ts:nextStepFor`) | "Open it" / "Open this and {n} more" to `/patient/homework` | FP "The steps you agreed, not homework marked out of ten" | none |
| Questionnaire (only when assigned) | "A few questions", "Your therapist asked you to answer these..." (`lib/data/assessments.ts:openAssignmentsForPerson`) | "Start" to `/patient/assessments` | none stated | none |
| Therapists here | Horizontal rail of 10 (`lib/data/discover.ts:exploreTherapists`, online first then a daily shuffle), "Free now" chip; empty "No therapist is listed yet" | Card links `/patient/t/{id}`; "See everyone" to `/patient/browse` | none stated | none |
| Areas | Up to 8 specialties that listed therapists actually hold (`discover.ts:categories`) | Tile links `/patient/browse?q={code}` | none stated | none |
| Rated highest | Therapists with at least 5 rated sessions (`discover.ts:topRated`), "Nobody has 5 rated sessions yet" | Card links `/patient/t/{id}` | none stated | none |
| Your sessions (inline) | `PatientSessionList` grouped Today / Booked / Past appointments / When you needed someone (`patient-view.ts:sessionsForPatient`); empty "No sessions yet" | "Your sessions" link to `/patient/sessions` | P3 | Cards are not tappable (see /patient/sessions) |
| Your record card | "Your record", badge "Yours" / "Not claimed yet", count of therapist files attached | "Have records to claim?" / "Claim another record" to `/patient/claim`; "Open your profile" to `/patient/profile` | P4 | none |
| Shortcut rows | "Your journal", "Your clinical summary", "Who can read your history", "Get a copy of everything" | Links `/patient/journal`, `/patient/summary`, `/patient/consent`, `/patient/record` | none stated | No row for notices, messages, residency, benefit, billing |

### /patient/browse
`app/(patient)/patient/browse/page.tsx`, `lib/data/discover.ts:search`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Search | "Find a therapist", field "Anxiety, sleep, a language…" | GET form to `/patient/browse?q=` | FP "A therapist who speaks your first language" | Matches specialties, languages and headline only, never a therapist's name. Queries under 2 characters return nothing and show "Nobody has listed that yet" |
| Results | `TherapistCard` list (photo, "Free now", "Demo account", headline, rating) up to 20 | Card links `/patient/t/{id}` | none stated | No price, language or availability filter on results |
| No match | "Nobody has listed that yet. Try an area below, or open the radar." | none | none stated | Mentions the radar with no link |
| Areas | "What do you want help with?" chips with counts | Chip links `/patient/browse?q={code}` | none stated | none |
| Nothing listed | "Nobody has been listed yet. The radar shows who is free right now." | none | none stated | No link |

### /patient/radar
`app/(patient)/patient/radar/page.tsx` (same `RadarConsole` as `/radar`, inside the patient chrome)

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Radar console | As `/radar` (globe/list, filters, empty state, booking sheet, walk-in) | As `/radar` | P1 | Same gaps: booking sheet asks the signed-in patient their name, creates an unlinked guest session, covers the SOS orb. Tap count from Home to room is 1 (tab) + 1 (clinician) + typing a name + 1 ("Start now") + consent radio + "Go in" for a free session, more for a paid one, so P1 ("three taps") fails in code |
| Safety line | "Not an emergency service..." | none | P5 | none |

### /patient/sessions
`app/(patient)/patient/sessions/page.tsx`, `components/patient/session-list.tsx`, `components/notes/provenance-client.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Tabs | "All", "Upcoming", "Past" | Links `/patient/sessions?tab=` | none stated | An empty tab shows the generic "No sessions yet" copy |
| Session card | Therapist name, time in account zone, price or "Free" (`sessionsForPatient`, up to 200) | none: the card has no link or button | FP "Your sessions, in your own app" | No join, pay, cancel, reschedule, rebook, rate or "open summary" action. Cancelled sessions are listed (no status filter, no cancelled label). Payment status is not shown. "Today" means "within 24 hours" |
| Provenance badge (past only) | "You turned the AI on for this session" / "Part of this session was not recorded" / "This session was not recorded" | none | T2 wording surfaced to patient | none |
| Brief (only when note approved) | `patientBrief` text | none | P3 ("Before they sign it, the app says they are still writing it") | Brief shown without the signer's name or credentials (P3 asks for both). "Your therapist is still writing your summary." also appears on cancelled or never-held sessions |

### /join/[token] (patient side of the room)
`app/join/[token]/page.tsx`, `components/join/join-flow.tsx`, `components/join/patient-room.tsx`, `components/join/consent-controls.tsx`, `components/session/no-show-recovery.tsx`, `app/join/[token]/actions.ts`, `app/(patient)/sessions/[id]/recovery-actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Shell | Logo, language switch, footer "If you need urgent help...", patient chrome with a "Session" tab (always passed `live`) | Leaving via a nav tab opens "Leave your session?" sheet: "Stay" / "Leave anyway" | none stated | The sheet says "Your therapist is still there" even before anyone has joined. A signed-out guest also gets the four patient tabs, each of which bounces to a sign-in page. SOS country from locale only |
| Checkout return | `?checkout=` runs `lib/billing/stripe.ts:confirmCheckout`; `?checkout=cancelled` releases the radar claim; "Payment cancelled. Nothing was charged." (English) | none | none stated | English literal |
| Dead link | "This link is no longer active", "Links last 12 hours..."; if a feedback token exists, redirect to `/feedback/{token}` | none | none stated | No link to Home or radar |
| Join form | "Join your session", price tile "This session" (when owed), "Your first name" or "Joining as {name}." (only when the session's patient row belongs to the signed-in person), "Email for your receipt" (paid), privacy note | "Join session" / "Pay {amount} and join" to `actions.ts:submitJoin` (`joinByToken`, `lib/billing/pot.ts:payFromPot`, then `/pay/{token}` or the consent gate) | T4 ("opened by the patient it belongs to, says 'Joining as …' and asks nothing") | `joinByToken` creates a new `patients` row (and person) for any session without one, never the signed-in person's. `payFromPot` result is ignored, so an empty pot shows no "ask HR" line (E5) |
| Payment received | Spinner "Payment received", "Taking you into your session…" | Auto `resumeAfterPayment` | none stated | none |
| Recording consent gate | "One question before you go in", "May your therapist record this session?", three points, "Say no and the session happens exactly the same." | Radio "Yes, you may record" / "No, please do not record"; "Go in" to `answerConsent` (saves consent, dispatches or withdraws the meeting bot, mints a Daily token) | FP "Recording is asked for, not assumed" | Asked again on every join even when already answered |
| Room: video | Daily iframe (or "Waiting for your therapist" / "This is an audio session"), "Check your browser has permission..." | Camera and mic only inside the iframe; "Minimise" (live) to `setSessionMinimised` | none stated | No leave or end button of the product's own. On phones the side panel stacks under a 3:4 video, so consent and trouble controls are below the fold |
| Room: recording strip (live) | "Recording, for your therapist's notes" or "Recording has stopped" | "Stop recording" to `actions.ts:stopRecording` (sets declined, withdraws bot) | T2, FP "you can stop it at any point" | The Your choices card below says "Recording cannot stop part-way", contradicting this button |
| Room: Your choices | "Record this session", "Share my profile" with "On" or "Turn on" | "Turn on" to `actions.ts:turnOnConsent` | P4 (patient decides) | Turning recording on mid-session does not call `sendBotForConsent` (the gate does). No way to turn profile share off |
| Room: clock (live, not running stage) | "About N minutes left..." or "This session has ended" | none | none stated | English plural literal |
| Room: who you are with | Initials, name, credentials or "Licensed clinician", languages, "{n} min so far", "We checked their licence and their ID..." | none | none stated | Elapsed text English |
| Room: summary and rating | Before live: "A written summary, afterwards" + English sentence. Live: "How easy was it to find someone?", 5 stars, "Where shall we send your summary?" | "Save" to `actions.ts:rateOnArrival` | none stated | Asks a signed-in patient for an email again. English literals |
| Room: "Do not close this tab." card, Good to know | Rating promise, "Anonymous...", recording and summary facts, not-an-emergency | none | none stated | "You get a plain-language summary" by email only (P2) |
| Room: trouble box | "Something is wrong, tell 24Therapy" | Opens textarea; "Send" to `app/feedback/[token]/actions.ts:reportSession` kind `abuse`; "Cancel" | none stated | **Broken**: it passes the join token, but `lib/data/feedback.ts:fileReport` looks up `sessions.feedbackToken`, so it returns "This link is no longer valid" and nothing is saved; the UI ignores the result and shows "Sent to 24Therapy". "Send" / "Sending…" English |
| Minimised bubble | Round video, timer, red dot when recording, "Still on" | Tap "Back to your session" | none stated | none |
| Ended | "The session has ended", "One minute of feedback, and your summary arrives by email." | "Rate the session and get my summary" to `/feedback/{token}` | P2 contradicted ("arrives by email") | No link to `/patient/summary` or `/patient/sessions` for a signed-in patient |
| No-show recovery (booked session, past start, not started) | "Joining shortly"; after 5 min: "Somebody else can see you now" list (name, headline, price) or "Nobody is free right now"; done "You are in good hands" / "You have been refunded" + credit | Tap a replacement to `recovery-actions.ts:takeReplacement`; "None of these, refund me instead" / "Refund me in full" to `takeRefund`; `offerReplacements` on mount | FP "After five minutes you are offered somebody else at the same price or less, or your money back" | Rendered below `JoinFlow`, so once the patient has joined, the fixed full-screen room (z-50) hides it. It only checks once on mount, so a page opened at minute 3 never offers anything. The three actions take a bare `sessionId` with no patient or token check |

### /pay/[token]
`app/pay/[token]/page.tsx`, `components/pay/pay-flow.tsx`, `components/billing/payment-popup.tsx`, `components/billing/pay-by-transfer.tsx`, `app/pay/[token]/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Guard | Free or paid sessions redirect to `/join/{token}?booked=1`; bad token gives global 404 | none | none stated | 404 has no SOS orb |
| Card path: country | "Pay for your session", "With {name}. You will not be charged until..." (English), "Where are you paying from?" select | Choose country to `actions.ts:priceFor` (`getCountrySettings`, `fx.ts:quoteFor`) | E3 ("A price somebody was shown is a price they are owed") | Not prefilled from `people.preferredCountry`. Unsupported country: "We cannot take payments in that country yet. Ask your therapist for a free link." |
| Card path: breakdown | Session, "VAT (x%)" with "Paid to the tax authority in {country}, not to us.", Total, "Converted from ... held for an hour", "Indicative rate..." | none | FP "the rate you were shown is the rate you are charged" | "VAT (..)" label English |
| Card path: payer | "Your first name" (prefilled with `guestName`), "Email for your receipt (optional)" | "Pay {amount}" to `actions.ts:startPayment` (`lib/billing/connect.ts:createSessionPaymentCheckout`) then Stripe | none stated | Signed-in patient's name and email are not used |
| Transfer path (org needs transfer) | Payment popup "Patient payment", lines incl. "Your benefit paid" and "VAT", bank or InstaPay details, "Card payments coming soon." | `openSessionPayment` (opens a cart); "Put the reference here" and "Or attach the receipt" then "Submit" to `actions.ts:declareSessionTransfer`; "Minimise"; "Cancel this payment" / "Yes, cancel it" / "Keep it" | A1, A3 | none |
| Transfer: submitted | "We are checking your transfer", "Usually a few minutes.", "You can close this page..."; later "Track your payment" | none | A1 | No push when confirmed except an in-app notice `pnotice.paymentConfirmed` on a page nothing links to |
| Transfer: rejected | "We could not confirm that transfer", operator's reason verbatim, "Send the reference again below, or reply to us." | Resubmit | A3 ("the payer reads it verbatim") | "reply to us" has no in-app reply |
| Chrome | SOS orb (country EG when transfer rail, else by locale), language corner | SOS sheet | P5 | No patient nav or back link on this page |

### /feedback/[token]
`app/feedback/[token]/page.tsx`, `components/feedback/rating-form.tsx`, `app/feedback/[token]/actions.ts`, `lib/data/feedback.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Expired | "This link has expired", "Links stay open three days. Ask your therapist to send your summary again." | Logo link `/` | none stated | Signed-in patient not pointed to `/patient/summary` |
| Rating form | Date, "One minute, and your summary is yours", "How was your session with {name}?" + stars + tags, "And the session itself?" + stars, "And 24Therapy itself?" + stars + tags (hidden if rated in the room), "Anything else? Optional", "Where shall we send your summary?" | "Send me my summary" to `actions.ts:rateSession` (`submitFeedback`, `releaseBrief`) | none stated | **The patient's own summary is gated behind rating the therapist, the session, the app and giving an email** (`ready` requires all). Tag chips are English only (`lib/feedback-options.ts`). Several prompts and the button are English literals |
| Done | "Thank you", "Your summary is below..." / "{name} is still writing it up..." / "Keep this link...", summary card (`PatientBriefCard`), "Written for you..." | none | P3 (brief only when note `approved`) | Summary card has no clinician name or credentials (P3) |
| Report box | "They never joined, I want my money back" (paid only), "Report something that happened in this session" | Opens form; "Refund me" (kind `no_show`: refund, radar suspension, email to clinician) or "Send to 24Therapy" (kind `abuse`); optional reply email; "Cancel" | none stated | `no_show` refunds with no check that the clinician really missed it (report alone triggers refund and suspension). Result sentences English |
| Make it mine (signed out only) | "Do you want to see this yourself?" | "Make it mine" to `/patient/signup` | P4 | Signup does not carry this session, so the new account does not get it |

### /sessions/[id]/room and /session-expired (clinician routes a patient can hit)
`app/(room)/sessions/[id]/room/page.tsx`, `app/session-expired/route.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Room page | Clinician `SessionRoom` behind `requireUser` | none for a patient | none stated | The patient's room is `/join/[token]`. But booking confirmations (`book`) and the reassignment email link to `/sessions/{id}`, which middleware sends to the clinician `/login` |
| Session expired | Destroys the clinician session, redirects to `/login?expired=1` | none | none stated | Clinician only; nothing equivalent exists for patients (see shell row) |

### /patient/summary
`app/(patient)/patient/summary/page.tsx`, `lib/data/summaries.ts:summariesForPerson`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Header | "Your clinical summary", "Your therapists write it, version by version, each under its author's name." | "Back" | P4 | none |
| Versions | Each version: approver name, credentials, "Version {n} · {date}", body, licence body and number | none | P3 ("carries a clinician's name and credentials"), P4 ("Every version stays, under its author's name") | No download or share of a single version |
| Empty | "Nothing has been written yet." | none | none stated | none |

### /patient/profile
`app/(patient)/patient/profile/page.tsx`, `components/documents/own-profile-panel.tsx`, `components/documents/document-list.tsx`, `app/(patient)/patient/profile/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Journal nudge | "Want to say how things have been?" | Link `/patient/journal` | none stated | none |
| Documents | List (`lib/data/documents.ts:listDocuments`), "Added by {name}" / "You added this", watermark "{name} · your own record" (English); empty "Nothing here yet. Letters, prescriptions, scans..." | "Open" (new tab via `/api/uploads`, "Everything you open is recorded against your name"); "Read aloud" (`POST /api/documents/[id]/speak`); "Flag" then "Not about me" / "This is outdated" / "This is wrong" to `actions.ts:flagOwnContent` | FP "One record, however many therapists" | **No upload**: the empty state invites letters and scans, account says "Anything you have uploaded", but only clinicians can add documents (`addUploadedDocument` is called only from `app/(app)`). No way to withdraw a flag |
| Diagnoses (only confirmed) | Label, code, source sentence, "Flagging something wrong" can/cannot box | none | none stated | The box explains flagging but there is no Flag button on a diagnosis, though `flagOwnContent` accepts `diagnosis` |

### /patient/journal
`app/(patient)/patient/journal/page.tsx`, `components/patient/journal-writer.tsx`, `app/(patient)/patient/journal/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Who can open this | "Nobody..." or "These therapists can read your journal: {names}." (granted grants) | "Who can read your history" link `/patient/consent` | FP "a therapist you have given access to can read it. Nobody else" | none |
| Writer | "How has it been?" | "Save this" to `actions.ts:addJournal`; "Say it instead" / "Stop" (browser SpeechRecognition) | FP "You write or say whatever you want to keep" | Dictation missing where the browser lacks SpeechRecognition (iOS Safari, Firefox) and the button simply does not appear |
| Entries | Date and time, " · spoken" (English), body (`lib/data/journals.ts:journalsForPerson`, 100) | none | none stated | No edit, delete or search. No empty state for the list |

### /patient/homework
`app/(patient)/patient/homework/page.tsx`, `components/homework/patient-steps.tsx`, `app/(patient)/patient/homework/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Steps | "What to try", open steps (`homework.ts:openStepsFor`); empty "Nothing to do right now" | "I did this" / "I could not do this one", optional note, confirm to `actions.ts:answerStep` (`closeStep`); "Back" | FP "Nobody scores you" | Closed steps vanish: no history for the patient (`listHomework` is clinician only) |
| Questionnaire link (only when assigned) | "A few questions" | Link `/patient/assessments` | none stated | none |

### /patient/assessments
`app/(patient)/patient/assessments/page.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Open | Instrument name per assignment; empty "Nothing to answer right now" | "Start" to `/patient/assessments/{id}` | none stated | none |
| History | "What you have answered before", name, date, "Your total" (`assessments.ts:historyForPerson`) | none | none stated | Raw total with no meaning or trend |

### /patient/assessments/[id]
`app/(patient)/patient/assessments/[id]/page.tsx`, `components/assessments/patient-questionnaire.tsx`, `app/(patient)/patient/assessments/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Question | "Question {n} of {total}", "Over the last two weeks...", options, "Where these questions come from" | Tap option to `answerQuestion` (saves timing); "Go back"; last answer to `finishAssessment` | none stated | No crisis response when an answer signals self-harm: `lib/data/assessments.ts` has no risk path and the screen moves on |
| Done | "That is all of them", "Your therapist will see your answers before your next session." | none | none stated | No onward link |

### /patient/consent
`app/(patient)/patient/consent/page.tsx`, `components/patient/consent-list.tsx`, `components/patient/linked-platforms.tsx`, `components/patient/invite-therapist.tsx`, `components/patient/ask-history.tsx`, `app/(patient)/patient/consent/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Rules box | "A therapist you allow" can / cannot lists | none | FP "You are never asked why, and they are never told why" | none |
| Requests | "Waiting for your answer", therapist, note, date (`grants.ts:pendingRequestsFor`); empty "Nobody has asked to read your history." | "Yes, for 24 hours" / "Yes, until I change my mind" / "No thanks" (optional reason, "Decline") to `actions.ts:answerRequest` (`decideGrant`) | P4 ("the patient decides who may read the history") | none |
| Who has access | Grants with "Can read" / "Cannot read", "Until {date}", "You ended this on {date}", "Expired"; empty "Nobody can..." | "Stop their access" to `actions.ts:revoke` (`revokeGrant`) | T5, FP "Taking it back costs one tap" | none |
| Platforms (only when linked) | "Platforms that can identify you", "Connected {date}", what ending does and does not | "End this" to `actions.ts:unlinkPlatform` (`unlinkPartner`, webhook `subject.unlinked`) | none stated | No screen shows what a partner was told the person consented to (`coverageSentence`) |
| Invite a therapist | Three steps, live codes "Good until {date}", "Used by {name}..." | "Invite a therapist" to `inviteMyTherapist` (`createInvite`); "Cancel it" to `cancelInvite` | FP "You generate a code and read it to your therapist" | none |
| Ask an old therapist | Can / cannot box, past asks: "Waiting...", "They added what they hold...", "They said no. In their words: ..." | Select "Which therapist" (only clinicians with a session linked to this person), note, "Ask them" to `askPreviousTherapist` (`askForHistory`) | none stated | A therapist seen only via radar or self-booking never appears in the list. "Leave you without an answer" is listed as a cannot, but no deadline or chaser exists |

### /patient/claim
`app/(patient)/patient/claim/page.tsx`, `components/patient/prove-handle.tsx`, `components/patient/claim-challenge.tsx`, `components/patient/claim-flow.tsx`, `app/(patient)/patient/claim/actions.ts`, `app/(patient)/patient/claim/challenge-actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Header | "Have you seen a therapist before?" | "Back" | none stated | none |
| Prove handle (only when neither phone nor email verified) | "First, is this number yours?" | "Send me a code" to `lib/patient-auth/handle.ts:requestHandleCode`; "Six-digit code", "Check the code" to `confirmHandleCode` | FP "proving a phone number is not proving a person" | WhatsApp only for a phone; "WhatsApp codes are not on yet. Ask your therapist for an invite link." ends the path. Fallback handle text "your number" is English |
| Challenge (per phone match) | "One question", "Have you seen {name} before?" then first-name question | "Yes" / "No, I have not" to `challenge-actions.ts:saySeen`; "First name" + "Confirm" to `sayName` (12 per hour) | FP "We ask you two questions first" | none |
| Suggestions | "A therapist keeps notes for someone with your email address / phone number, under the name:" initials | "Yes, send me a code" to `sendClaimCode(personId, "email")`; code + "Let this therapist keep seeing my profile" + "Claim this record" to `confirmClaim`; "This is not me" to `declineClaim`; "Skip for now" to `/patient` | P4 | Code is always requested on the email channel; a phone-only account depends on the WhatsApp fallback |
| Done | "That record is yours now" | "Go to my sessions" links `/patient` | none stated | Label and target disagree |
| Nothing | "Nothing to claim yet", "Nobody has written you down under this number or address." | none | none stated | none |

### /patient/record
`app/(patient)/patient/record/page.tsx`, `components/patient/export-record.tsx`, `app/(patient)/patient/record/actions.ts`, `lib/data/export.ts:requestOwnExport`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Export | "Your whole record", "A copy of everything", contents list, "Emailed to {email} and nowhere else..." | "Email me my record" to `actions.ts:exportMyRecord`; on success "On its way to {email}", "The cover page carries code {code}" | FP "Ask for a copy of your record and it is emailed to you" | Without an email: "Add an email to get your record" links `/patient/account`, which has no email field (Gap B). No in-app download |
| Practice visibility (only when a clinic pays) | "What {practice} can see", can (name as they see it, appointment times, that they pay) / cannot | none (marks shown via `markClinicVisibilityShown`) | C2 as seen by patient | Only reachable through this export page |

### /records/[token] and /records/[token]/data.json
`app/records/[token]/route.ts`, `app/records/[token]/data.json/route.ts`, `lib/data/export.ts:openExport`, `renderExportHtml`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Extract | Static HTML of the whole record (3-day link) | Link to `data.json` download | FP "A copy you can keep" | English only; no SOS; standalone HTML with no way back into the app |
| Expired | "This link is no longer active", "Ask your therapist to send it again" | none | none stated | Wrong advice: the patient can re-request it from `/patient/record` |

### /verify
`app/(public)/verify/page.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Check a code | "Check a record extract", field "XXXX-XXXX-XXXX" | "Check it" (GET, `verifyExtract`) | none stated | English only |
| Result | Produced on, sessions, signed notes, summary versions; or "We do not recognise that code." | none | none stated | none |

### /patient/account
`app/(patient)/patient/account/page.tsx`, `components/patient/identity-editor.tsx`, `components/patient/change-number.tsx`, `app/(patient)/patient/account/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Identity | Name, avatar, "Not public. You, and a therapist who already has a record for you." | "Add a photo" / "Change your photo" to `saveOwnPhoto`; "Remove it" to `removeOwnPhoto`; "First name", "Last name", "Save your name" to `saveOwnName` | none stated | none |
| Change number | "Your number", "How we know it is you, so changing it takes a person and a day." or "Locked until {date}" (`phone-change.ts:lockUntil`, 90 days) | "New number", "Country", "Why are you changing it?", "You may call or message the new number..." then "Ask to change it" to `askToChangeNumber` (`requestPhoneChange`) | none stated | After an operator approves, "Nothing changes until you enter the code we send the new number", but no screen accepts that code (`completeChange` has no caller) |
| Details | Phone, Email ("Not added"), Time zone ("Not set") | none | none stated | Email cannot be added and time zone cannot be changed anywhere; the amber note "Another way to sign in, and the only way to receive your record." has no control |
| Links | "Who can see your record", "What you have paid", "Your own documents" | Links `/patient/consent`, `/patient/billing`, `/patient/profile` | none stated | No link to notices, messages, residency, benefit |
| Sign out | "Sign out" | `lib/patient-auth/actions.ts:patientSignOut` | none stated | No "sign out everywhere", no delete account, no language preference |

### /patient/billing
`app/(patient)/patient/billing/page.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Credit (only when credit live) | "$X in credit", reason, "It comes off your next session automatically, and it lasts until {date}." (English) | none | FP "the difference comes back to you as credit" | English sentence |
| Paid sessions | Therapist, amount in the presented currency or "Covered", date, "charged at x to the y" (English), breakdown "Your therapist's fee", "VAT, paid to the government", "24Therapy's share of the fee" (`session_payments` status `paid`, 50) | none | FP "You pay the therapist for the session" | Account link promises "anything still open": unpaid and pending-transfer sessions are not listed. No receipt download. No Back button. Radar sessions never appear |
| Empty | "Nothing paid yet" | none | none stated | none |
| You paid / therapist is paid | Before/after explainer | none | none stated | none |

### /patient/benefit
`app/(patient)/patient/benefit/page.tsx`, `components/patient/benefit-form.tsx`, `app/(patient)/patient/benefit/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Entry | "Activate your benefit" | "Back" | none stated | No in-app link to this page. The sponsor QR encodes `/patient/benefit?code=`, but the page ignores `code` and middleware drops the query on the sign-in bounce |
| Current benefits | Per enrolment: "Your sessions are paid for by {name}", "Waiting for the code you were sent.", or "Your benefit is paused" + body | "The code we sent you" + "Confirm" to `confirmCode`; "Use this one" to `choosePrimary` (only with two) | E4 | Paused text says "Enter your work address again and we will send a new code" but no address field or resend button exists. No coverage percentage shown |
| Activate | "The code from your organisation" then "What {name} asks for" | "Activate" to `checkCode`, then "Activate" to `activateBenefit` (`enrol`) | E1 (from the patient side) | none |
| What they see | "That you are on the list...", "Whether you booked, when, or with whom...", "Only the payment changes..." | none | E1, E2, E4 | none |
| Ask about employer | "Not sure whether your employer offers this?", domain field | "Ask" (English) to `askAboutEmployer` (`employerLookup`) | none stated | none |

### /patient/notices
`app/(patient)/patient/notices/page.tsx`, `components/patient/notices.tsx`, `app/(patient)/patient/notices/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Current | Undismissed notices with date (`lib/data/notices.ts:noticesFor`); empty "Nothing to tell you." | "Dismiss" to `actions.ts:dismiss` | P2 ("An invitation, a payment confirmation and a session starting each appear in the app itself") | **Orphan**: nothing links here. Notices carry no link to the thing they describe. Keys `pnotice.accessRequested` and `pnotice.benefitPaused` are never written; booking confirmations and grant-started messages are sent without a notice |
| Earlier | Dismissed notices | none | none stated | none |

### /patient/messages
`app/(patient)/patient/messages/page.tsx`, `components/patient/checkin-switch.tsx`, `app/(patient)/patient/messages/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Rules | "Your reply to a check-in" can / cannot | none | none stated | **Orphan**: nothing links here |
| Switch | "Send them" / "Do not send them", "Turned off {date}" (date in UTC) | `actions.ts:setCheckins` (`mute` / `unmute`) | none stated | The check-in messages and the patient's replies are never shown in-app |

### /patient/residency
`app/(patient)/patient/residency/page.tsx`, `components/patient/residency-notice.tsx`, `app/(patient)/patient/residency/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Notice | Home region and serving region, "In {country}, where it belongs..." or the cross-border wording (`lib/data/residency.ts:residencyFor`) | "I understand, and I agree" to `agreeToCrossBorder`; "Withdraw that" to `withdrawCrossBorder` | none stated | **Orphan** and not enforced: nothing links here, and outside this page's own `residencyFor` nothing reads `crossBorderConsents` |

### /contact (CMS page, patient support entry)
`app/(public)/[slug]/page.tsx`, `components/public/contact-form.tsx`, `app/(public)/contact/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Contact form | Name, email, country, phone, topic, entity, message, attachment | Submit to `contact/actions.ts:submitContact` (`lib/data/support.ts:fileTicket`, `attachToTicket`), shows reference and hours | none stated | Only linked from the reset form. Signed-in patients get no prefill and no in-app support entry |

### /support/[token]
`app/support/[token]/page.tsx`, `components/support/ticket-reader.tsx`, `app/support/[token]/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Code gate | "Your message to us", explanation (English), "Your six-digit code" | Submit to `actions.ts:openTicket` (`readByToken`, audited) | none stated | English only |
| Ticket | "Reference ...", "What you wrote", events "Our reply" / "Update" with UTC time | none | none stated | Read only: no reply box ("write to us again and mention the reference") |

## 3. Can do with no screen

Capabilities that exist in server actions, API routes or `lib/data` that a patient could use, but no page exposes (or the only page is unreachable).

| Capability | Where | Why it has no screen |
| --- | --- | --- |
| Finish a phone number change with the code sent to the new number | `lib/data/phone-change.ts:completeChange` | No caller anywhere (patient or admin). Every approved change stalls |
| Flag a diagnosis or a document chunk | `app/(patient)/patient/profile/actions.ts:flagOwnContent` (`targetType: "diagnosis" \| "chunk"`) | Only documents have a Flag button |
| Withdraw a flag they raised | `lib/data/documents.ts:withdrawFlag` (accepts `byAccountId`) | No patient action wraps it |
| Unread count for notices | `lib/data/notices.ts:undismissedCount` | Never called; no badge |
| Sign out every device | `lib/patient-auth/session.ts:revokeAllPatientSessions` | Only runs inside a password reset |
| Report "other" about a session | `app/feedback/[token]/actions.ts:reportSession` (`kind: "other"`) | UI offers only `no_show` and `abuse` |
| Report abuse from inside the room | `app/feedback/[token]/actions.ts:reportSession` | The room's button exists but sends the join token, which `fileReport` cannot match, so in practice this capability has no working screen during a session |
| See their own homework history and trend | `lib/data/homework.ts:listHomework`, `homeworkTrend` | Rendered only on clinician `/patients/[id]/documents` |
| See past check-ins and their replies | `lib/data/checkins.ts:recordReply`, `lastCheckinFor` | No patient read of either |
| Know why the benefit did not pay | `lib/billing/pot.ts:payFromPot` returns `{ paid, reason }` | `app/join/[token]/actions.ts:submitJoin` discards the result |
| Trigger a no-show refund or reassign any session | `app/(patient)/sessions/[id]/recovery-actions.ts:offerReplacements`, `takeReplacement`, `takeRefund` | Exposed via `NoShowRecovery`, but they take a bare `sessionId` with no `requirePatient` or join-token check, so they are callable by anyone who has an id |
| Cross-border storage consent | `app/(patient)/patient/residency/actions.ts:agreeToCrossBorder`, `withdrawCrossBorder` | Page exists but is unlinked |
| Mute check-ins | `app/(patient)/patient/messages/actions.ts:setCheckins` | Page exists but is unlinked (reply "stop" is the only other way) |
| Read in-app notices | `app/(patient)/patient/notices/actions.ts:dismiss`, `lib/data/notices.ts:noticesFor` | Page exists but is unlinked |
| Activate a benefit | `app/(patient)/patient/benefit/actions.ts:*` | Page reachable only by typing the URL or the sponsor QR |
| Email-address sign-in and export | `lib/patient-auth/code-signin.ts:requestSignInCode` (email channel), `lib/data/export.ts:requestOwnExport` | Both need `patient_accounts.email`, which no patient flow writes |

## 4. Promised but not built

| Promise (where) | What the code does |
| --- | --- |
| P1 "Three taps from opening it to being in a session" (VALUE-STATEMENTS) | Home, radar, clinician, type a first name, "Start now", pick a consent radio, "Go in": at least five taps plus typing for a free session; a paid one adds country, name, "Pay", Stripe |
| P2 "Nothing the product tells you is only in an email" | Booking confirmation (`t/[id]/book/actions.ts:book`), grant started (`portability.ts:notifyPatientOfGrant`), old therapist answered (`portability.ts` answer notify) and "your summary arrives by email" (`room.endedBody`) send no in-app notice; the notices page that does exist has no link |
| P3 "The summary after a session carries a clinician's name and credentials" | True on `/patient/summary`; false on the session card brief (`session-list.tsx`) and the `/feedback` summary card, which show no signer |
| P5 "SOS ... reachable, on top, and dials" | Hidden under the radar booking sheet (z-100 over z-70); dials only for +1 and +20 phones, or an Arabic locale; nothing for anyone else |
| E5 "the patient's screen says who to ask" when the pot runs out | No such text on `/join` or `/pay`; the pot reason is discarded |
| T4 "opened by the patient it belongs to, says 'Joining as …'" | Only when the session already has a `patients` row linked to that person; radar and self-booked sessions always ask the name |
| FP "Once you claim your record you have your own screens: the sessions you have booked, the ones you found on the radar, and the note your therapist wrote to you after each" | Radar (`createRadarSession` + `joinByToken`) and calendar (`findOrCreatePatient`) sessions create a new person, so they never reach `/patient/sessions`, `/patient/billing`, the orb or the summary |
| FP "Ask for a copy of your record and it is emailed to you" / "A copy you can keep" | Needs an email the patient can never add (signup has no email field; account has none) |
| FP "Pick an hour that suits you and you will get a reminder before it" | Reminders exist (cron `reminders`), but the confirmation's "Open your session" link points to the clinician route `/sessions/{id}` |
| FP "After five minutes you are offered somebody else ... or your money back" | Built, but invisible once the patient has joined (room overlay) and never re-checked after mount |
| FP "Recording ... you can stop it at any point" vs in-room "Recording cannot stop part-way" (`jconsent.cannotUndo`) | Code stops it (`stopRecording`); the copy on the same screen contradicts it |
| FP "The price is shown in both, at the rate of the day" | Both currencies only on the therapist page's hour price; the instant sheet and `/join` show USD only |
| Home CMS "see the price with the tax on it, and go in" | Tax appears only on `/pay` after choosing a country |
| `crisis.noAccountLine` "No account, no card, no form. You give a first name and you are in a session." | Paid sessions need country, name and card or a bank transfer |
| `pbook.noAccount` / `join.privateNotePaid` "Stripe takes the payment" | False wherever the Egyptian transfer rail applies ("Card payments coming soon.") |
| `auth.patient.p3` "Book an hour with the same therapist next week" | No rebook from a session; the patient must find the therapist again in browse |
| `auth.patient.p1` "be in a session in under a minute" | See P1 |
| `paccount.billingBody` "Every session you paid for, and anything still open" | Only `status = paid` rows are listed |
| `paccount.addEmailBody` "Another way to sign in, and the only way to receive your record." | No control to add one |
| `pnumber.requestedBody` "Nothing changes until you enter the code we send the new number." | No screen to enter it (`completeChange` unused) |
| `benefit.resendPrompt` "Enter your work address again and we will send a new code." | No address field or resend action on the page |
| `pinvite.signedOut` "we will bring you straight back here" | True for "Create an account"; false for "Sign in" (`patientSignIn` ignores `next`) |
| `pprofile.empty` / `paccount.ownDocumentsBody` "Anything you have uploaded" | Patients cannot upload |
| `pprofile.flag*` box under diagnoses | No Flag control on a diagnosis |
| `consent.askCannotIgnore` "Leave you without an answer" | No deadline, reminder or escalation on an ask |
| `room.tellUsBody` "This goes straight to 24Therapy" and `room.sentToUsBody` "Someone will read this today" | The in-room report is never stored (join token passed where a feedback token is required) and the error is swallowed |
| `/records/[token]` expired page "Ask your therapist to send it again" | The patient can request it themselves |

## 5. Should exist in the redesign (proposals)

These are proposals, not findings. Each is tied to a reason in the code or the value statements.

1. **Attach every session to the signed-in person.** Proposal: when `optionalPatient()` is present, `bookFromRadar`, `book` and `joinByToken` should use (or create) a `patients` row for that `personId`. Reason: section 4 row "Once you claim your record..."; P2, T4 and E5 all depend on it.
2. **Add email to signup and account, with verification.** Reason: export, email sign-in and the claim code all require `patient_accounts.email`, and nothing writes it.
3. **Patient session-expired route** mirroring `/session-expired` that clears `24t_patient` and returns to `/patient/login?next=`. Reason: redirect loop in the shell row.
4. **Honour `next` after patient sign-in** (password and code). Reason: `/patient/invite` sign-in path and the sponsor QR both lose their destination.
5. **A session detail screen** (`/patient/sessions/[id]`): join, pay, pending-transfer status, cancel or ask to reschedule, signed summary with signer and licence, rate, rebook the same therapist, receipt. Reason: session cards have no actions; `auth.patient.p3`; P3.
6. **An inbox reached from the shell** (bell with `undismissedCount`) that merges notices, check-ins and support replies, each notice linking to its screen. Reason: P2; three orphan pages; notices with no link.
7. **One "You" hub** listing Account, Billing, Benefit, Notices, Messages, Residency, Record, Documents. Reason: four pages are unreachable today.
8. **Instant booking without retyping for signed-in patients**: prefill name, skip the name field, remember country and pay method (`people.preferredCountry` exists). Reason: P1 tap count.
9. **Radar empty state with a way forward**: "Book the first free hour" (next open slots across clinicians) and the SOS line. Reason: the empty radar is a dead end; FP "if nobody is, you can book the first hour that suits you".
10. **No-show recovery inside the room**, polled, and secured by the join token. Reason: it is hidden under the overlay today and its actions are unauthenticated.
11. **Release the summary without a rating gate**; keep rating optional after. Reason: `/feedback` makes the patient rate three things and give an email to see their own summary.
12. **SOS for every supported country** using admin-configured lines (`crisisLine(country, configured)` already supports it) and the reader's country, and keep it above every sheet. Reason: P5; only US and EG exist.
13. **Crisis response inside questionnaires** when an item signals risk. Reason: PHQ-style items are served with no risk path.
14. **Unpaid and pending payments on Billing**, with receipts. Reason: `paccount.billingBody` promises "anything still open".
15. **Benefit status on join and pay** ("Covered by {sponsor}" or "Your benefit did not cover this, ask your HR contact"). Reason: E5 and the discarded `payFromPot` reason.
16. **Patient document upload** into their own profile. Reason: the empty state and account copy promise it; `addUploadedDocument` already accepts `byAccountId`.
17. **Phone change completion screen** (enter the code). Reason: `completeChange` is unused.
18. **In-app support**: a signed-in "Get help" that files a ticket with the account attached and shows replies with a reply box. Reason: `/contact` is only linked from the reset form and `/support/[token]` is read only.
19. **Consistent session length and price** across radar sheet, therapist page and join ("30 minutes" vs "One hour", USD vs both currencies, tax shown before commit). Reason: section 4 price rows; E3.
20. **Translate the remaining English literals** in `public-profile.tsx`, `booking-calendar.tsx`, `booking-sheet.tsx`, `patient-room.tsx`, `rating-form.tsx`, `lib/feedback-options.ts`, `app/j/[code]/page.tsx`, `/verify`, `/support/[token]`, `/records/[token]`, billing and journal fragments. Reason: the product sells "Arabic and English throughout".
21. **Loading and not-found states in the patient shell** that keep the SOS orb. Reason: no `loading.tsx` exists and the global 404 drops SOS.
