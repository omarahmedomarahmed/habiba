# Every flow, as numbered steps

These are scripts, not casting. Each table is one flow; the `actor` column names the ROLE in
that flow (a patient, the clinician, a staff member). `02-THE-MONTH.md` says which cast member
plays each flow in which round, and `01-THE-CAST.md` says who they are.

**Step ids** are `<flow>.<n>` (`PA12.3`). The board (`05-THE-BOARD.md`) names every row by one,
and `npm run sim:board -- wait <id>` waits on one. The last column of each row says who else is
acting or waiting, which is what the board is for.

**Button and link texts** are the English strings the code renders. An Arabic-speaking cast
member sees the translation; if a label stays in English under Arabic, that is a finding.

**What the code does** names the function and file, so a failing step points straight at the
code to read. **What must be true after** is what the agent checks on screen, in the outbox
(`npm run on:production -- sim:inbox -- <address or phone>`) or in the money.

Written from a full read of the code on 2026-09-25 (`08-COVERAGE.md` lists every file read).

| Part | Flows | Who |
|---|---|---|
| A | `PA1` to `PA29` | Patients, on the phone-sized app |
| B | `TH1` to `TH20` | Therapists, solo and in a clinic |
| C | `CL1` to `CL11` | Clinic managers and their staff |
| D | `CO1` to `CO13` | Company HR |
| E | `AD1` to `AD20` | Our own staff and the founder, in the console |
| F | `PT1` onward | A partner developer |
| G | `WB1` onward | A visitor on the public website |


---

# A · Patients

### PA1 Sign up by phone (no email)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA1.1 | P1 | `/patient/signup` | Heading "Create your account"; fields "First name" (`firstName`, required), "Last name (optional)" (`lastName`), "Phone" (PhoneField `phone` + country select `phoneCountry`, note "This is how you sign in and how your therapist finds you."), "Email (optional)" (`email`), timezone field (`timezone`), "Password (optional)" (hint "Leave it empty and sign in with a code instead.") | Page `app/(patient)/patient/signup/page.tsx` renders `PatientAuthForm mode="signup"` (`components/patient/auth-form.tsx`) | Form visible, no session cookie | none |
| PA1.2 | P1 | same | Button "Create an account" (pending "Working…") | `patientSignUp` (`lib/patient-auth/actions.ts:49`): requires phone, `toE164` with country, first name; password only checked when present (`validatePassword`); rate limit `patient:signup` 5/hour/network (x25); refuses if any live account has that phone or email with "We could not create that account. Try signing in instead."; inserts `people` and `patient_accounts` (phone stored E.164, `phone_verified_at` null, `password_hash` null when empty); `createPatientSession` inserts `patient_auth_sessions` and sets cookie `24t_patient` (idle 4 h, absolute 7 days); redirects | Redirect to `/patient/claim` (or `/patient/invite/<token>` when an invite was carried). DB: one `people`, one `patient_accounts`, one `patient_auth_sessions`. No message is sent at signup | none |
| PA1.3 | P1 | `/patient/claim` | Card "First, is this number yours?" | See PA6 | Claim page says it has not looked yet | none |

### PA2 Sign in with password

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA2.1 | P1/P2 | `/patient/login` (optionally `?next=`) | Title "Your sessions"; "Phone number or email" (`handle`, hidden `handleCountry` from the browser locale), "Password"; button "Sign in"; link "Forgot your password?" | `patientSignIn` (`lib/patient-auth/actions.ts:246`): rate limit `patient:signin` 10/15 min; handle matched as E.164 phone or lower-cased email; bcrypt verify (dummy hash when no account or no password) | Success: cookie set, `applySavedLocale` switches the UI to the saved language, redirect to `patientLanding(next)` (only `/patient`, `/join`, `/pay`, `/feedback`, `/j` prefixes are honoured, `lib/routing.ts:112`). Failure text "That does not match an account. Check and try again." (same for no account, wrong password, no password) | none |

### PA3 Sign in with a code

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA3.1 | P1/P2 | `/patient/login` | Lower card "Sign in with a code instead": field "Phone number or email" (`handle`), button "Send me a code" | `requestSignInCode` (`lib/patient-auth/code-signin.ts:101`): rate limit `patient:code` 5/15 min; if the account exists inserts `patient_auth_tokens` (purpose `handle_verify`, 6 digits, 15 min, channel `email` when the handle contains "@" else `whatsapp`); `notify` kind `claim.code` to THAT handle only | Screen "Enter your code" / "If that number or address has an account, a six-digit code is coming. It expires in fifteen minutes."; amber "WhatsApp codes are not switched on yet. Sign in with your password instead." when WhatsApp is not configured. Outbox: email to an `@example.com` handle; WhatsApp only under the condition at the top | none |
| PA3.2 | P1/P2 | same | "Six-digit code" (`code`), button "Sign in" | `signInWithCode`: rate limit `patient:code-confirm` 10/15 min; newest unused unexpired `handle_verify` token; wrong code increments `attempts`, after 5 wrong the token is spent ("Too many wrong codes. Ask for a new one."); success stamps `phone_verified_at` (whatsapp) or `email_verified_at` (email) and signs in | Client `router.replace(next or /patient)`. The code sign-in also PROVES the handle, so `/patient/claim` stops showing the prove step | none |

### PA4 Forgot password

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA4.1 | P1/P2 | `/patient/login` then `/patient/forgot-password` | Link "Forgot your password?"; page title "Get back into your account"; field "Phone number or email"; button "Send me a code"; link "Back to sign in"; footer link "Reset your practice password" (clinician route) | `requestPatientReset` (`lib/patient-auth/reset.ts:109`): rate limit `patient:reset` 5/15 min; token purpose `password_reset`, 15 min; `notify` kind `password.reset_code` to BOTH the account email and phone | "Enter your code" screen; amber "WhatsApp codes are not switched on yet, so one may not arrive. If you are stuck, tell us ..." when not configured. Outbox: email copy for P2 | none |
| PA4.2 | P1/P2 | same | "Six-digit code", "New password" (hint on length), button "Set my new password"; link "Ask for another code" | `completePatientReset`: `validatePassword`; rate limit `patient:reset-confirm` 10/15 min; 5 wrong codes spend the token; writes `password_hash`; `revokeAllPatientSessions`; `audit` `patient.password.reset` | "Password changed" / "Signed out everywhere else. Sign in with your new password." plus button "Sign in". Every other browser of that patient is signed out on next request | Any other agent sharing that patient's login loses its session |

### PA5 Session expiry and sign out

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA5.1 | P1 | any `/patient/*` after 4 h idle or 7 days | none | `requirePatient` (`lib/patient-auth/guard.ts:21`) finds no live session; with a cookie still present redirects to `/patient/session-expired?next=...`; route `app/(patient)/patient/session-expired/route.ts` revokes the row, deletes the cookie, redirects to `/patient/login?expired=1&next=...` | Login page renders; after sign-in the patient lands back on `next` | none |
| PA5.2 | P1 | `/patient/account?tab=settings` | Button "Sign out" (plain form) | `patientSignOut` sets `revoked_at` on the session row, deletes the cookie | Redirect `/patient/login` | none |

### PA6 Prove the number, then claim a record by the two questions

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA6.0 | T1 | clinician side | T1 created a patient file with P1's phone number and first name | (clinician area) | `patients` row with `people.phone` = P1's E.164 and `people.claimed_at` null | T1 must do this BEFORE step 3 or the page shows "nothing to claim" |
| PA6.1 | P1 | `/patient/claim` | Title "Have you seen a therapist before?"; card "First, is this number yours?" / "We have not looked yet. First we check you can receive a message at {handle}."; button "Send me a code" | `requestHandleCode` (`lib/patient-auth/handle.ts:78`): rate limit `patient:handle` 5/15 min; token `handle_verify` 15 min to phone (whatsapp) or email; `notify` kind `claim.code` | "Six-digit code" field and "Check the code" button; "WhatsApp codes are not on yet. Ask your therapist for an invite link." when down | none |
| PA6.2 | P1 | same | "Six-digit code", "Check the code" | `confirmHandleCode`: stamps `phone_verified_at` (or email) | Page refreshes and now lists challenges (`openChallenges`, `lib/data/challenge.ts:131`) for unclaimed `people` rows whose phone/email equals the PROVEN handle | none |
| PA6.3 | P1 | same | "One question" / "Have you seen {T1 name} before?"; buttons "Confirm" (yes) and "No, I have not"; "Skip for now" | `saySeen` (`app/(patient)/patient/claim/challenge-actions.ts:20`) then `answerSeen`: inserts `person_claims` (route `match`, status `pending` or `rejected`); audit `claim.challenge.seen/declined` | A "no" closes that record for this account for ever | none |
| PA6.4 | P1 | same | "What first name did you give {name}?" field "First name" (hint "As you gave it to them. We will not show it to you."), button "Confirm" | `sayName`: rate limit `claim:name` 12/h; `answerName` compares to the CLINICIAN'S `patients.first_name` (case and space insensitive); wrong answers counted in `claim_attempts` per (account, record); 3 wrong locks (`person_claims.status = locked`) | Pass: "Your record is yours now." / "Next you will be asked what your therapist may still see."; `person_claims.name_confirmed_at` set | none |
| PA6.5 | P1 | `/patient/claim` (ClaimFlow, sprint 6 email route) | For P2 with a proven address: "A therapist keeps notes for someone with your email address, under the name:" redacted; buttons "Yes, send me a code", "This is not me"; then "Your code" field, checkbox "Let this therapist keep seeing my profile", "Claim this record" | `sendClaimCode` (`app/(patient)/patient/claim/actions.ts:60`) calls `startClaim` (30 min code) and `notify` kind `claim.code` with `prefers` channel; `confirmClaim` calls `verifyClaim`; `declineClaim` rejects | "That record is yours now" plus "Your therapist can still see your profile..." or "They keep their notes but no longer see your live profile. Reversible."; `people.claimed_at` set; `applyClaimDecision` creates open `history_grants` for every holding clinician only when kept | T1 sees the patient's live profile only if "keep" was ticked |

### PA7 Claim by the therapist's invite link

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA7.0 | T1 | clinician side | T1 issues an invite (`issueInvite`, 30 days) and sends it | outbox `claim.invite` | Link `/patient/invite/<token>` | T1 acts first |
| PA7.1 | P1 signed out | `/patient/invite/<token>` | "Your therapist sent you this" / "{T1} has invited you to take ownership of the record they keep for you."; buttons "Create an account" (to `/patient/signup?invite=<token>`) and "Sign in" (to `/patient/login?next=/patient/invite/<token>`) | `resolveInvite` (`lib/data/claims.ts:536`) | Dead or used token: "This link is no longer valid" plus "Home" | none |
| PA7.2 | P1 | `/patient/signup?invite=<token>` | Subtitle "{name} invited you. ..."; phone note "The number your therapist has for you." | `patientSignUp` checks `inviteFits` before creating anything: the typed phone must equal the invited phone, else "This link is for a different phone number. Sign up with the number your therapist has for you, or ask them for a new link." | Redirect back to `/patient/invite/<token>` | none |
| PA7.3 | P1 signed in | `/patient/invite/<token>` | "Take ownership of your record" / "{masked} keeps notes under this name..."; checkbox "Let this therapist keep seeing my profile" (default off); button "This is me, claim it" | `acceptInvite` then `redeemInvite` (`lib/data/claims.ts:625`): spends the invite, sets `people.claimed_at`, inserts `person_claims` (route `invite`, verified), `bindAccountToPerson` moves the account to the claimed person when the signup person has no `patients` rows, `applyClaimDecision`, partner webhook | Redirect `/patient?claimed=kept` or `?claimed=1`; home shows "That record is yours now" and "Your record" badge "Yours" | T1 keeps or loses live profile access per the checkbox |

### PA8 Clinic wall code (QR poster)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA8.0 | T1 | clinician side | T1's 8 character wall code exists (`therapist_codes`) | | | T1 acts first |
| PA8.1 | stranger | `/j/<CODE>` | "You are joining" plus T1 name and practice; heading "Create your account"; the signup form (PA1 fields); link "Sign in" under "Already have an account?" | `resolveCode` | Revoked: "This code is no longer in use"; unknown: "We do not know that code"; link "Create an account anyway" | none |
| PA8.2 | stranger | same | "Create an account" | `patientSignUp` with hidden `wallCode` calls `connectByCode` (`lib/data/therapist-codes.ts:174`), which creates or reuses a `patients` row for (T1, person) | Redirect `/patient/claim`; P1 now appears in T1's caseload as a file with the typed name | T1 sees a new patient |
| PA8.3 | P1 signed in | `/j/<CODE>` | Button "Join them" (pending "Working…") | `connectToTherapist` (`app/j/[code]/actions.ts:24`): rate limit `wall-code:connect` 10/15 min | Redirect `/patient`; failure "Not connected. Ask the desk for a current code." | T1 sees the patient |

### PA9 Home, browse and a therapist page

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA9.1 | P1 | `/patient` | "Hello, {name}"; search link "What do you want help with?"; live banner "Find someone now" (when `radarCount()` > 0) or "Nobody is online right now"; amber "Somebody asked to read your history" + "Answer now"; "To try before your next session" + "Open it"; assessments card + "Start"; "Therapists here" + "See everyone"; category grid; "Rated highest by patients"; session list; "Your record" card with "Do you have records to claim?" / "Claim another record" and "Open your profile"; links "Your journal", "Your clinical summary", "Who can read your history", "Get a copy of everything" | `app/(patient)/patient/page.tsx`: reads `pendingRequestsFor`, `nextStepFor`, `openAssignmentsForPerson`, `sessionsForPatient`, `sessionDoors`, `categories`, `topRated(4)`, `exploreTherapists(10)`, `radarCount` | Read only | none |
| PA9.2 | P1 | `/patient/browse?q=...` | Title "Find a therapist"; search input (placeholder "Anxiety, sleep, a language…", GET `q`); category chips; empty result "Nobody has listed that yet. Try an area below, or open the radar." | `search`, `categories` (`lib/data/discover`) | Cards link to `/patient/t/<id>` | none |
| PA9.3 | P1 | `/patient/t/<therapistId>` | Back control; therapist body (`components/radar/therapist-page.tsx`) with the booking calendar prefilled from the account (name, email, phone) | `publicProfile` 404s for an unknown or hidden clinician | See PA10 | none |
| PA9.4 | anyone | `/t/<therapistId>` | Same body plus SOS orb | `app/(public)/t/[id]/page.tsx` | Indexed page; "Book again" on past sessions links here | none |

### PA10 Book an hour from a profile

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA10.0 | T1 | clinician side | T1 published open hours with a price (`users.session_rate_cents`), place online / in person / either | | Slots shown under "Book a session" / "A session with {name} · {rate}" | T1 acts first |
| PA10.1 | P1 | `/patient/t/<T1>` or `/t/<T1>` | Tap a time; fields "Your first name", "Email", "Phone or WhatsApp" (with country), "Anything they should know before you meet? (optional)"; for an "either" hour radios "Online" / "In person" and "Where: {place}"; buttons "Confirm" (pending "Booking…", hardcoded English) and "Pick another time" | `book` (`app/(public)/t/[id]/book/actions.ts:28`): rate limits `book` 6/h per network, 12/h per slot, 40/h per therapist; needs email or phone; `holdSlot`; `bookSlot` (`lib/data/scheduling.ts:484`) creates `sessions` (status `scheduled`, `scheduled_at` = slot, `join_token`, `join_token_expires_at` = start + `bookingLinkHoursAfterStart` (4 h default), `feedback_token`, `price_cents`, `payment_status` `pending` or `not_required`), marks the slot `booked` with `booked_by_account_id`; then `payFromPot` and `holdWallet` (see PA13); `notify` kind `booking.confirmed` with link "Open your session" to `/join/<token>`, in-app notice `pnotice.booked` when signed in | "Booked with {name}" plus the time; "We have sent you a confirmation with the link to join." or "We could not send you a confirmation, so write this time down. Your therapist has it too." No pay link on screen: the patient pays from `/patient/sessions` ("Pay for your session") or the emailed join link. Outbox: email for an `@example.com` address | T1 sees the booking in their bookings/calendar. Unpaid priced bookings are released by the hourly `reminders` cron after 24 h (PA-timers) |
| PA10.2 | P1 | `/patient/sessions` | Card with "Pay for your session" (or "Join" when free/paid) and "Change or cancel" | `sessionDoors` / `doorFor` (`lib/sessions/doors.ts`): pay door `/pay/<token>` when priced and pending, "We are checking your transfer" when a transfer is submitted, join door `/join/<token>` otherwise | Owed amount on the card is `patientOwesTotal` (after benefit and wallet, with VAT), shown in USD | none |

### PA11 Crisis radar booking (find someone now)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA11.0 | T2 | clinician side | T2 is online on the radar | | P1 home shows "Find someone now" with a live count | T2 acts first |
| PA11.1 | P1 | `/patient/radar` (or public `/radar`) | Radar console ("Who is free", "Map"/"List", "Show everyone"); tap a clinician; booking sheet "Held for you · {seconds}s", "Your first name" (`name`), "Email" (optional, "Optional, for your receipt."); button "Start now" (free) or "Pay {amount} and start now" | `reserveForViewing` holds the clinician 10 min for this viewer; `bookFromRadar` (`app/(public)/radar/actions.ts:113`): limits `radar:book` 6/15 min per network, 3 claims per clinician per 15 min, global ceiling; `createRadarSession` (link lives `radarLinkHours`, 3 h default); `claimTherapist`; attaches the session to the signed-in person; `takeHold` per NETWORK releases and CANCELS this network's previous unpaid, unjoined radar session; builds a Daily room (refuses the booking if it cannot); `notifyIncomingBooking` (clinician alarm); signed in: `payFromPot` + `holdWallet` | Free or fully covered: redirect `/join/<token>?booked=1` and `markInSession`. Priced: redirect `/pay/<token>` | T2 hears the incoming booking alarm and must open the room |
| PA11.2 | P1 (signed in or not) | `/t/<T2>` or `/patient/t/<T2>` while T2 is online on the radar | Availability pill (online / being booked / in a session / off shift); button "Start now" (`tprofile.start`); "Copy link" | `PublicProfile` (`components/radar/public-profile.tsx`) polls `/api/radar/profile/<id>?v=<viewer>` every 5 s; "Start now" opens the same `BookingSheet` as the radar, so the booking runs `reserveForViewing` then `bookFromRadar` exactly as PA11.1 | Same result as PA11.1 (join or pay redirect). When T2 goes offline the button greys to the off-shift text within 5 s without a reload | T2 hears the incoming booking alarm |
| PA11.3 | P1 | `/radar` or `/patient/radar` | Chips under the globe: in-person, language, specialty, region (after tapping a country on the globe), each with a count; "Clear filters"; tapping a country on the globe sets the country chip | `RadarFilters` and `matches` (`components/radar/filters.tsx`): options only from who is on the radar now; counts ignore that chip's own selection | List and globe show only matching clinicians; the headline online count stays the unfiltered count; "Clear filters" restores all | At least two clinicians with different languages online |

### PA12 Pay on the transfer rail (practice region `eg`)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA12.1 | P1 | `/pay/<token>` | Title "Pay for your session" + therapist name; the payment sheet opens on arrival (or "Pay now" orb when minimised); "Send {EGP amount} · Session with {name}", bank details, optional lines (session price, "Your benefit paid" negative, "From your wallet" negative, VAT); fields "Put the reference here" (`reference`) and "Or attach the receipt" (`proof` file); button "Submit" (pending "Sending…") | Page (`app/pay/[token]/page.tsx`): `resolveJoinToken`; `organizationNeedsTransfer` (practice region `eg`); `patientOwesFor` (frozen pot share and wallet hold subtracted); `sessionTransferMoney` (VAT only if the rule says standard; healthcare exempt by default); `manualEntry`. Opening the sheet calls `openSessionPayment` which `openCart`s a `manual_payments` row (state `awaiting_proof`, amount in EGP at the operator rate, line items) | `manual_payments` row exists before submitting; nothing is sent to the payer yet | OP sees the open cart in the "open carts" list only |
| PA12.2 | P1 | same | "Submit" | `declareSessionTransfer` (`app/pay/[token]/actions.ts:185`): re-checks token, price, not paid, still `eg`; uploads the proof (`uploadDocument` kind `receipt`); recomputes the amount; `declarePaid` (`lib/billing/manual-entry.ts:370`) re-states and submits the row (`state = submitted`, `submitted_at`); `noticePaymentSubmitted` | Screen "We are checking your transfer" / "Usually a few minutes." / "You can close this page and come back."; card door becomes "We are checking your transfer"; the "Pay by card" button disappears. Message `payment.submitted` ONLY to `sessions.guest_email` (payer kind `session`), so nothing for a patient who never typed a receipt email | OP must confirm in the admin payments queue (matches by reference or amount) |
| PA12.3 | OP | admin queue | Confirm | `confirmPayment` then `claimSessionPaid` (`lib/billing/session-owed.ts:22`): `payment_status` pending to paid unless cancelled or refunded; `spendHold` spends any wallet hold; `noticePaymentConfirmed` (`payment.confirmed`, link to `/join/<token>`, again only to `guest_email`) | P1's open `/pay/<token>` page redirects itself to `/join/<token>?booked=1`; door becomes "Join" | T1's session becomes startable |
| PA12.3b | OP | admin queue | Reject with a reason | `rejectPayment`, `noticePaymentRejected` (`payment.rejected` to `guest_email`) | Pay page shows "We could not confirm that transfer" / "Send the reference again below, or reply to us." and the form again | P1 must resubmit |

### PA13 Money applied automatically: benefit pot, then wallet

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA13.1 | system | at every booking path (`bookSlot`, `bookFromRadar` when signed in, `submitJoin`, clinician `createSession`) | none | `payFromPot` (`lib/billing/pot.ts:268`): needs the person's ONE primary enrolment in state `active` or `provisional`, not removed, not paused, `last_verified_at` not null, sponsor `active`; pot not expired; provisional cap claimed by conditional UPDATE; coverage from `coverageNow`; conditional pot debit `balance + overdraft >= sponsorShare`; inserts `session_payments` (funding `pot`, frozen `sponsor_share_cents`/`patient_share_cents`, unique per session); full cover sets `payment_status = paid`; ledger + `recordMoneyEntry`. In-person sessions return `patient_must_confirm` unless called with the patient's own person id, and are capped at `potSessionsPerWeek` (2) | Fully covered: session is paid, card shows "Join", billing shows "Covered". Partly covered: session stays pending and owes only the patient share | SP's pot balance drops by the sponsor share; SP sees a nameless money entry |
| PA13.2 | system | same | none | `holdWallet` (`lib/billing/wallet.ts:131`): only if `rules.wallet.enabled`; draws credits oldest-expiring first into a `wallet_holds` row (one per session); when it covers everything the session is claimed paid and `markInSession` | Pay page and cards ask for less; lines show "From your wallet" | none |
| PA13.3 | P1 | `/pay/<token>` | Amber benefit note when a benefit should have paid and did not: "{name} did not cover this. Ask whoever runs your benefit there." or paused / unconfirmed variants | `benefitShortfall` (`lib/billing/pot.ts:202`) | Shown only when an enrolment exists and no sponsor share was frozen | SP may need to top up |

### PA14 Pay by card

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA14.1 | P2 | `/pay/<token>` for a NON-`eg` practice | `PayFlow`: "Where are you paying from?" select ("Choose your country…"), "Your first name", "Email for your receipt (optional)", total, button "Pay {amount}" | `priceFor` per country (`app/pay/[token]/actions.ts:54`; error "We cannot take payments in that country yet. ..."); `startPayment` then `createSessionPaymentCheckout` (Stripe hosted checkout) | Browser leaves to Stripe; back at `/join/<token>?checkout=<id>`, `confirmCheckout` settles | Real card processor: see Not testable |
| PA14.2 | P2 | `/pay/<token>` for an `eg` practice | Button "Pay by card" with lines "Card fee" and "Total by card" (fee 2.75% + 3 EGP default) | Shown only when `railIsReady()` (gateway configured; the fake gateway is refused on production, `lib/billing/gateway/index.ts`) and no transfer is submitted. `payByCard` refuses when a declared transfer exists, else `createGatewaySessionCheckout` and redirects; failure returns `?card=unavailable`: "The card page did not open. Pay by transfer." Back with `?gateway=<uuid>` runs `confirmGatewayReturn` | Paid session redirects to `/join/<token>?booked=1` | Paymob must be live on production |

### PA15 In-person sessions: pay before start

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA15.1 | P1 | `/pay/<token>`, in-person session with no time or starting under 2 h ("in the room") | Title "Pay for your session"; button "Use my company benefit"; button "Pay by card" (+ fee lines) or text "Card payments are not switched on yet. Pay your therapist directly." No transfer offered | `coverWithBenefit` (`app/pay/[token]/actions.ts:398`): signed out redirects to `/patient/login?next=/pay/<token>`; `payFromPot(session, {byPersonId})` then `holdWallet(session, {byPersonId})`; redirects to `/pay/<token>` or `?benefit=<reason>` | Covered in full: "Paid. Your session can start." / "Your therapist can see it now." Not covered: "Your benefit could not pay for this one. Pay by card, or pay your therapist directly." | T1's Start unlocks when paid |
| PA15.2 | P1 | `/pay/<token>`, in-person booked more than 2 h ahead on an `eg` practice | Same "Use my company benefit" button above the transfer sheet (PA12) | Same actions | Transfer allowed in advance | OP confirms |
| PA15.3 | system | hourly `reminders` cron | none | `sweepInPerson` (`lib/data/in-person.ts:24`): unpaid in-person with expired link cancelled and link nulled; paid but never started with expired link refunded (to the wallet by default) | Door disappears; refund in billing | T1 loses the booking |

### PA16 Join the room, consent to recording, room controls

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA16.1 | P1 | `/join/<token>` | "Join your session"; subtitle "No account needed. Just tell us what to call you." or "... then pay to enter."; "This session" + amount when owed; "Your first name" (`name`) or, when signed in as this session's patient, "Joining as {name}."; "Email for your receipt" (`email`, only when owed); button "Join session" or "Pay {amount} and join". For a BOOKED session the page follows the start ruling (`lib/sessions/start-window.ts`, `rules.start`, 15 and 5 by default): more than 15 minutes before, "Your session is booked for {time}." and no button; from 15 to 5 minutes before, "Your session is starting soon, at {time}." and no button (both with "Pay {amount} now" to `/pay/<token>` when owed); in the last 5 minutes the button reads "Join early" | `submitJoin` (`app/join/[token]/actions.ts:136`): rate limit `join` 10/10 min; before the booked session's "Join early" window it, `resumeAfterPayment`, `answerConsent` and `admit` all return "Your session has not opened yet..." and write nothing; `joinByToken` stores `guest_name`, `patient_joined_at`, attaches or creates the patient row (the signed-in person's own file), stores `guest_email` when empty; then `payFromPot`, `holdWallet`; priced and unpaid returns `payUrl` `/pay/<token>`, else `needsConsent` | Owed: browser goes to `/pay/<token>`. Otherwise the consent screen | none |
| PA16.2 | P1 | same | "One question before you go in"; "May your therapist record this session?"; radios "Yes, you may record" / "No, please do not record" (nothing preselected); button "Go in" (pending "Going in…") | `answerConsent` then `recordConsent`: conditional UPDATE (a grant never overwrites a decline); grant sets `recording_started_at` and dispatches the meeting bot (`sendBotForConsent`); decline sets `recording_paused_at` and withdraws any bot; then `admit`: refuses unpaid, forwards to a provisioned external meeting, or `ensureRoom` builds a Daily room and mints a non-owner meeting token | Room page: "Waiting for your therapist" / "This page updates by itself the moment they join. Keep it open."; failure "We could not open the room for this session. Your therapist has been told..." | T1 presses Start (clinician side) |
| PA16.3 | P1 | same, every 5 s | none | `checkJoinState` poll: live, recording, consent, clock; `markAbandonedIfWaiting` after 10 min waiting; `autoEndSession` when the clock cap passes | When T1 starts: "Your session has started"; recording line "Recording, for your therapist's notes" | T1's room; T1 is warned if P1 waits 10 min |
| PA16.4 | P1 | room | "Your choices": "Record this session" / "Share my profile" with "Turn on" | `turnOnConsent`: profile share granted once; recording granted only if it never started | Indicator changes on next poll | T1 sees consent change |
| PA16.5 | P1 | room | "Stop recording" ("Audio stops now. What was captured stays.") | `stopRecording`: sets `recording_paused_at`, sets `recording_consent = declined`, withdraws the bot | "Recording has stopped"; T1's Resume cannot restart it | T1 sees recording stopped |
| PA16.6 | P1 | room | "Minimise" / "Back to your session" | `setSessionMinimised` writes `patient_minimised_at` (only while `in_progress`) | T1 sees the patient stepped away | T1 |
| PA16.7 | P1 | room | "Rate 24Therapy" stars + "Where shall we send your summary?" email + button "Save" | `rateOnArrival(joinToken, ...)` then `recordArrival` looks the token up as a FEEDBACK token (bug, see PE list) | Screen says thanks regardless; nothing is stored | none |
| PA16.8 | P1 | room | "Something is wrong, tell 24Therapy": textarea "What is happening right now.", send | `reportFromRoom`: rate limit `report` 10/10 min; `fileReport` via join token (`session_reports` kind `abuse`, at least 10 characters) | "Sent to 24Therapy" / "Someone will read this today." | Admin reports queue |
| PA16.9 | P1 | room, bottom bar while live | Any tab: "Leave your session?" / "The session keeps running..." / "Leave anyway" / "Stay"; a "Session" tab returns | `components/patient/bottom-nav.tsx` | Session keeps running | none |
| PA16.10 | P1 | room end | "The session has ended" / "Rating is optional."; button "Open my summary" to `/feedback/<feedbackToken>` | Poll sees `ended` | See PA18 | T1 writes and approves the patient copy |

### PA17 No-show recovery (therapist does not come)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA17.0 | T1 | none | T1 does NOT press Start | | | T1 is the no-show |
| PA17.1 | P1 | `/join/<token>` waiting, 5+ min after `scheduled_at` | "Joining shortly" / "Your therapist has not joined yet..."; after 5 min "Somebody else can see you now" with replacement cards, or "Nobody is free right now" | `offerReplacements({token})` (`app/(patient)/sessions/[id]/recovery-actions.ts:107`): rate limit `recovery` 20/h; needs `scheduled_at` set, not started, `patient_joined_at` set, 5 min elapsed (`recoveryDue`); `recordNoShow` (hits T1's reliability) and `recovery_offered_at`; `replacementsFor` online clinicians not dearer than paid | Replacement list or none | T2 must be online on the radar |
| PA17.2 | P1 | same | Tap a replacement | `takeReplacement`: only an offered clinician; `reassignSession`; cheaper clinician credits the difference to the wallet (`creditWallet`); T2 emailed `booking.confirmed` with `/sessions/<id>` | "You are in good hands" / "They have been told and are joining now."; "They charge less, so {amount} is waiting as credit on your next session." | T2 gets an email and joins |
| PA17.3 | P1 | same | "Refund me in full" or "None of these, refund me instead" | `takeRefund` then `refundNoShow`; `notify` `booking.cancelled` + in-app `pnotice.noShow` | "You have been refunded" / "The full amount is on its way back, including our fee. We are sorry." or "We owe you a refund" (transfer rail, queued) or "Your session is cancelled" | Refund queue (OP) for transfer payments |

### PA18 Feedback, summary and reports

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA18.1 | P1 | `/feedback/<feedbackToken>` (also reached from a dead `/join/<token>`) | "Rate your therapist", "Rate the session", "Rate the service" stars; tags; comment; "Email me a copy (optional)"; button "Send" | `rateSession` (`app/feedback/[token]/actions.ts:12`): rate limit `feedback` 20/10 min; `submitFeedback` upserts `session_feedback`, writes the address to `patients.email` and `sessions.guest_email` when empty; `releaseBrief` emails the approved patient copy once (`sendSessionReport`) only if an address was given | "Thank you"; "Your summary is below. A copy is on its way." when approved; otherwise the note is pending. Signed-out readers see "Do you want to see this yourself?" + "Make it mine" (to `/patient/signup`) | T1 must approve the patient copy for the brief to show or be emailed |
| PA18.2 | P1 | same | "Report something that happened in this session"; "They did not join" path | `reportSession`: `fileReport`; for `no_show`, when `noShowProven` the payment is refunded (`refundSessionPayment`), T1 suspended from the radar (`suspensionFor`), T1 emailed | "Refunded. It reaches your card in a few days." or "We cannot confirm it yet. A person checks before any refund." | T1 suspended; admin sees the report actioned |
| PA18.3 | P1 | same after 72 h | none | `feedbackContext` returns null past `FEEDBACK_WINDOW_HOURS` 72 from `ended_at` | "This link has expired"; signed in: button "Your clinical summary" | none |
| PA18.4 | P1 | `/patient/sessions` (also the home session list and `/patient/account`) | read the card of a session whose patient copy T1 released | `components/patient/session-list.tsx` renders `PatientNoteOriginClient` (`components/notes/provenance-client.tsx`) from the note's provenance | Badge "note.origin.patientTranscript" (teal) for a recorded session, "note.origin.patientPartial" (amber) when T1 went off record, "note.origin.patientClinician" (slate) when T1 wrote it by hand | T1 released the copy (TH6.11) |

### PA19 Change or cancel a booking

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA19.1 | P1 | `/patient/sessions` | "Change or cancel" on a future scheduled, unstarted booking | `changeable` in `sessionsForPatient` | Link to `/patient/sessions/<id>/change` | none |
| PA19.2 | P1 | `/patient/sessions/<id>/change` | Title "Change or cancel"; status line "Nothing is paid yet, so nothing is owed." / "Free to cancel or move until {date}." / "Under {hours} hours to go: no refund unless your clinician agrees."; "Move to" select + "Move"; "Cancel session" then "Cancel it for good?" "Yes, cancel" / "Keep it" | `changeView` (`lib/data/booking-change.ts:541`) 404s for another person's session; window `patientCancelWindowHours` 24 | Move list only inside the window, same clinician, same place type, 28 days | none |
| PA19.3 | P1 | same | "Move" | `moveMyBooking` then `rescheduleBooking`: rate limit `booking-change` 20/h; one transaction of three conditional UPDATEs; new `scheduled_at`, new `join_token_expires_at`, `reschedule_count + 1`; `tellTherapist` (in-app notification, `booking.patient_moved`) | "Moved. Nothing more to pay." | T1 notified; sees the new hour |
| PA19.4 | P1 | same | "Yes, cancel" | `cancelMyBooking` then `patientCancel`: conditional UPDATE to `cancelled` (`cancelled_by = patient`); slot reopened; paid inside window: `refundSessionPayment` (pot share back to the pot, patient share by its rail, transfer to the manual refund queue); paid late: `late_cancel = held`; `tellTherapist` | "Cancelled." plus "Your money is on its way back." / "Refund owed. We send it by hand." / "No refund: under {hours} hours before. Your clinician may still refund it." | T1 may press agree late refund, which sends P1 `pnotice.lateRefunded` |

### PA20 History access: answer, revoke, invite, ask back, unlink

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA20.0 | T1 | clinician side | T1 requests access (`requestAccess`) or redeems P1's code | | Home shows "Somebody asked to read your history" | T1 acts first |
| PA20.1 | P1 | `/patient/consent` | Title "Who can read your history"; request card "Waiting for your answer"; buttons "Yes, for 24 hours", "Yes, until I change my mind", "No thanks" (then optional preset reason, "Decline", "Back") | `answerRequest` then `decideGrant` (`lib/data/grants.ts:345`): conditional on `pending` and the person; 24 h sets `expires_at`; refuses an unverified clinician with a sentence; granted sends `consent.granted` (`notifyPatientOfGrant`, in-app `pnotice.accessGranted`) | Grant listed under "Who has access" with "Until {date}" or "Until you change your mind" | T1 can read history from the next request |
| PA20.2 | P1 | same | "Stop their access" | `revoke` then `revokeGrant`: status `revoked`, `revoked_at`; partner webhook | "You ended this on {date}" | T1 loses read access at once |
| PA20.3 | P1 | same | "Invite a therapist" | `inviteMyTherapist` then `createInvite` (30 days) | Code shown with "Read it to your therapist. It works until {date}, once, ..."; "Cancel it" | Therapist redeems the code, creating a pending request |
| PA20.4 | P1 | same | "Show my therapist a QR code" | `inviteMyTherapistNow`: 10 minute single-use code, QR of `/connect?code=` | QR on screen | T1 scans it in `/connect` |
| PA20.5 | P1 | same | "Ask a therapist you saw before to add what they hold": "Which therapist" select, note, "Ask them" | `askPreviousTherapist` then `askForHistory` (clinician notification) | "Waiting. They have been told and can see it on their screen." then "They added what they hold..." or "They said no. In their words: ..." | T1 answers (`answerAsk`, sends `history.answered`) |
| PA20.6 | P1 | same | "Platforms that can identify you": "End this" | `unlinkPlatform` then `unlinkPartner`, `queueWebhook subject.unlinked` | Link gone | Partner receives a webhook |

### PA21 Journal, homework, assessments

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA21.1 | P1 | `/patient/journal` | "Your journal"; "Who can open this" with named readers or "Nobody. ..."; textarea "How has it been?" (`body`); "Say it instead" (browser SpeechRecognition, then "Stop"); button "Save this" | `addJournal` then `writeJournal`: 1 to 20,000 characters; `scanForCrisisLanguage`; on a match inserts a `crisis` notification for grant holders whose `expires_at >= now` | Entry listed with time (" · spoken" if dictated). No on-screen hint of the scan | T1 gets a crisis notification only when holding a 24 h grant (bug for open grants) |
| PA21.2 | P1 | `/patient/homework` | "What to try"; each step "I did this" / "I could not do this one", optional note "Anything you want to say about it? ..." | `answerStep` then `closeStep` | Step disappears; home card updates | T1 sees the outcome |
| PA21.3 | P1 | `/patient/assessments` then `/patient/assessments/<id>` | "A few questions"; "Start"; per question choices, "Continue", "Go back"; progress "Question {current} of {total}" | `answerQuestion` then `recordAnswer` (person-scoped); a PHQ-9 item 9 answer above 0 returns `risk` and inserts one `crisis` notification for the assigner and file holder; `finishAssessment` then `completeAssignment` | Risk: "Thank you for telling us" with crisis numbers and "Find someone online now". End: "That is all of them". History shows score and date only | T1 must have assigned it; T1 gets the crisis notification |

### PA22 Profile, summary, record export

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA22.1 | P1 | `/patient/profile` | "Your profile"; documents list; confirmed diagnoses with quote; "Flag" then "This is wrong" / "This is outdated" / "Not about me"; link "Want to say how things have been?" to the journal | `flagOwnContent` then `raiseFlag` | "Flagged"; record unchanged | T1 sees the flag |
| PA22.2 | P1 | `/patient/summary` | "Your clinical summary"; every version with author and "version n" line | `summariesForPerson` | "Nothing has been written yet." when none | T1 publishes summaries |
| PA22.3 | P2 | `/patient/record` | "Your whole record"; without a proved email: "Add an email to get your record" (to `/patient/account`); with one: button "Email me my record" | `exportMyRecord` then `requestOwnExport`: proved address only; limit 4/h per person; 72 h link; `notify` kind `record.export` email only | "On its way to {email}. Nobody here read it." and "The cover page carries code {code}..." Outbox: email with `/records/<token>` link | none |
| PA22.4 | anyone | `/verify` and `/verify/<code>` | Input "XXXX-XXXX-XXXX", button "Check it" (English only) | `verifyExtract`; `/verify/<code>` redirects to `/verify?code=` | "24Therapy produced a record extract with this code." with counts, or "We do not recognise that code." | none |
| PA22.5 | P1 | `/patient/profile` | On a searchable document: "tdl.readAloud" (then "tdl.reading") | `DocumentList.speak` POSTs `/api/documents/<id>/speak` (`app/api/documents/[id]/speak/route.ts`): `documentReadDecision` for the patient, text from `document_chunks` in order (or `body`), cut at 4000 chars, audit `document.speak` category phi_access, `gpt-4o-mini-tts` voice fable, MP3 back | Audio plays; the page never holds the text. One phi_access audit row per press. On failure see PE77 | none |
| PA22.6 | P1 (a patient of a clinic clinician, for example T5) | `/patient/record` | Card "What {practice} can see": left column "Your name, to them: {First L.}", "the day and time of each appointment", "That they are paying for your hour"; right column the four things never seen; lines "Not hidden behind a setting: it is not built." and "Prefer no practice saw your name? Book a therapist who works alone." | `clinicVisibilityFor` (lib/data/clinic-visibility.ts:50) lists organisations of kind `clinic` holding a `patients` row for this person; `shortenForClinic` builds the name; `markClinicVisibilityShown` stamps `patients.clinic_visibility_shown_at` only where null | Card present only when a clinic holds a file; the shortened name equals the row the clinic sees on `/clinic` (CL9.1); the stamp is set on first view and does not move on reload. A solo clinician's patient sees no card | T5 must hold P1's file inside a clinic organisation (CL3, TH20.2) |

### PA23 Account: overview, settings, email, number, language

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA23.1 | P1 | `/patient/account` | Tabs "Overview", "Past", "Billing", "Settings"; badge "{name} benefit" / "{name} benefit, paused" or "Add your employer benefit"; Overview "Upcoming" with "Join"/"Open", "Wallet" card (only when above zero), summary preview | reads `myBenefits`, `sessionsForPatient`, `sessionDoors`, `summariesForPerson`, `walletBalanceCents` | Read only | none |
| PA23.2 | P1 | `?tab=settings` | "Language" select (English / العربية) + "Save" | `savePatientLanguage` then `saveLocale`: writes `people.locale` and the cookie | UI and every later message in that language | none |
| PA23.3 | P1 | same | "First name", "Last name", "Save your name"; "Add a photo" / "Change your photo" / "Remove it" | `saveOwnName` (edits `people` only); `saveOwnPhoto` (2 MB image), `removeOwnPhoto` | "Saved" | none |
| PA23.4 | P1 | same | Email editor: "Email", "Send me a code"; then "Six-digit code", "Check the code" | `askForEmailCode` (5/15 min) then `issueEmailCode` (token bound to `code:address`, 15 min; nothing sent when the address is on another account); `confirmEmail` writes `email` and `email_verified_at` | "A code is on its way to {email}." then "Added. It signs you in and receives your record." Outbox: email | none |
| PA23.5 | P1 | same | "Your number" / "Ask to change it": "New number" (`newPhone`), "Country", "Why are you changing it?" (`reason`, min 10), checkbox "You may call or message the new number to check it is me." | `askToChangeNumber` then `requestPhoneChange`: refuses a number on another account; locked 90 days after verification except within 24 h of signup | "We have your request" / "Nothing changes until you enter the code we send the new number." | OP approves in the admin phone-change queue, which sends `phone.verify` to the NEW number (24 h) |
| PA23.6 | P1 | same | "Six-digit code", "Check the code" | `finishNumberChange` then `completeOwnChange` | "Number changed." | none |

### PA24 Billing, receipts, wallet

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA24.1 | P1 | `/patient/billing` (link "All payments and receipts") | "Billing"; credit card "{amount} in credit" / "Spent automatically on your next session."; "Still open" with "Pay for your session" or "We are checking your transfer"; paid rows with therapist fee, VAT, platform share, "Covered", "Refunded"; link "Receipt" | Reads `session_payments` (paid and refunded), `patient_credits`, `sessionDoors` + `patientOwesTotal` | Fully covered sessions show "Covered" and no receipt | none |
| PA24.2 | P1 | `/patient/billing/receipt/<paymentId>` | "Payment receipt"; switch link "العربية" / "English" (`?lang=`); "Print or save as PDF" | `receiptFor(personId, id)`: 404 for any payment not this person's | Printable receipt | none |

### PA25 Employer benefit enrolment

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA25.0 | SP | sponsor side | Active sponsor with a code, identifier fields (`domain_email` with a PROVED domain, `listed_email`, optional `id_number`), a funded pot | | | SP acts first |
| PA25.1 | P1 | `/patient/benefit` (or `?code=` from a QR) | "Activate your benefit"; "The code from your organisation"; button "Activate" | `checkCode` then `lookupCode` | Shows "Your email for {name}" (+ "Your employee ID" when required) | none |
| PA25.2 | P1 | same | Fill email (+ staff number); button "Activate" | `activateBenefit` then `enrol` (`lib/data/enrolment.ts`): 8 attempts/15 min per code; email must match a proved domain or the uploaded list, id must match its pattern; inserts `enrolments` (primary if first, `last_verified_at` null); `patient_notifications` `pnotice.benefitStarted`; `sendEnrolmentCode` to the work address (30 min, 5 tries) | "Waiting for the code you were sent." Outbox: the code at the work address (only if it is exactly `@example.com`) | none |
| PA25.3 | P1 | same | "The code we sent you", "Confirm" | `confirmCode` then `confirmEnrolmentCode` | "Your benefit from {name}" and "Covers {percent} of each session." Funding starts on the NEXT booking | SP sees the person on their roster, never sessions |
| PA25.4 | P1 | same | Paused: "Your benefit is paused" / re-enter address + "Send me a code" (or "Confirm" for id); several: "Use this one" | `reconfirmBenefit`, `choosePrimary` | Benefit resumes / primary switches | none |
| PA25.5 | P1 | same | "Not sure whether your employer offers this?" domain box | `askAboutEmployer` always the same answer | Constant message | none |

### PA26 Check-ins, notices, residency

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA26.1 | P1 | `/patient/messages` | "Messages asking how you are"; switch "Send them" / "Do not send them" | `setCheckins` then `mute(person, "screen")` / `unmute` | "Turned off {date}" | hourly `reminders` cron sends check-ins only to unmuted people |
| PA26.2 | P1 | `/patient/notices` (bell beside the language switch) | "What has happened"; each notice with "Dismiss"; "Earlier" | `dismiss` then `dismissNotice` (stamp only) | Bell count drops; dismissed stay listed under "Earlier" | none |
| PA26.3 | P1 | `/patient/residency` | "Where your record is kept"; when crossing: "Your record is kept in {serving}, not {home}", "I understand, and I agree", later "Withdraw that" | `agreeToCrossBorder` / `withdrawCrossBorder` | "You agreed to this on {date}." or "In {country}, where it belongs. Nothing crosses a border." | none |
| PA26.4 | system (hourly `reminders` cron) | `/api/cron/reminders` | none | `sweepCheckins` (`lib/checkins/send.ts`) runs `shouldSend` (`lib/checkins/policy.ts`) per person: channel on, mute rate under the halt, reachable, not muted, known timezone and outside quiet hours, at least `max(6, everyHours)` h since the last one; picks a wording different from the last (`nextWording`); `notify` kind `checkin.asking` with the line "Reply with the word stop and they end." | Outbox: one check-in to P1 in P1's saved language; a second cron run within the cadence sends nothing; a muted person (PA26.1) gets nothing | Admin sets cadence on /admin/checkins (AD18.5) |

### PA27 Crisis orb, session orb, live banner, language corner

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA27.1 | P1 | every patient page, `/pay`, `/join`, `/feedback`, `/j`, `/support`, `/t` | "SOS, get help now" orb; sheet "Help now" / "These are phone numbers, not a chat."; `tel:` links, "Likely open now"/"Likely closed now", "Your practice" | `SosOrb`, country from the reader's phone or locale; no server call | Nothing written | none |
| PA27.2 | P1 | every patient page | Session orb "Pay for your session" / "Open your session" / "Your session has started. Join now" | `openSessionForPatient` (newest open session) links to `/join/<token>` | none | none |
| PA27.3 | P1 | every patient page | Banner "Your session has started" / "{name} is in the room" + "Go in" | `liveSessionForPatient` (status `in_progress`) | Appears within one page load of T1 pressing Start | T1 presses Start (also sends `session.started`) |
| PA27.4 | anyone | every page | Language corner "English" / "العربية" | `setLocale` cookie only (does NOT write `people.locale`) | Page flips to Arabic, `dir` right to left | none |

### PA28 Link pages: support reply, welcome link, content pages

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA28.1 | P1 | `/support/<token>` from a `support.closed` message | "Your message to us"; "Your six-digit code"; "Read the reply" | `openTicket` then `readByToken`; audit `ticket.read_by_sender` | "Reference {ref}", "What you wrote", "Our reply"; wrong code or token: "That link or code is not right." | Support staff closed the ticket first (in-app `pnotice.supportReplied`) |
| PA28.2 | staff or sponsor invitee (not a patient) | `/welcome/<token>` | "Choose a new password"; "New password" (min 10); "Update password" | `chooseWelcomePassword` then `redeemAccountLink`; rate limit `welcome` 10/15 min | Redirect to that audience's sign-in; dead link "The link may be old, or the page has moved." | Clinic or sponsor admin sent the invite |
| PA28.3 | anyone | `/<slug>` | CMS page blocks | `getPublicPage`, cached until publish | 404 for unknown slug | none |

### PA29 Account deletion

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| PA29.1 | P1 | `/patient/account?tab=settings` | none: there is no delete, close or erase control anywhere on the patient side | `patient_accounts.deleted_at` is read everywhere and written by nothing reachable from these pages | Only "Sign out" exists | Record erasure goes through support |

---

# B · Therapists

### TH1 Sign up, sign in, sign out, password reset

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH1.1 | T1 | /signup | fields First name (`#firstName`), Last name (`#lastName`), Work email (`#email`), Password (`#password`, hint "At least 10 characters."); button "Create account" | `signUp` in `lib/auth/actions.ts`: validates, inserts `organizations` (name "Nadia X", random slug), `users` role `therapist`, `subscriptions` plan `payg` status `active`, creates the session cookie, audit `auth.signup`, redirects `/onboarding?welcome=1` | Page title "Verify your practice"; rows in organizations, users, subscriptions (trial_session_used false); no email sent | nobody |
| TH1.2 | T1 | /signup | same, with an existing email | returns "An account with that email already exists. Try signing in." | no new rows | nobody |
| TH1.3 | T1 | sidebar | icon button "Sign out" (aria-label) | `signOut`: destroys session, audit `auth.signout`, redirect `/login` | lands on /login "Welcome back" | nobody |
| TH1.4 | T1 | /login | Email, Password; button "Sign in" | `signIn`: per-connection limiter (20 per 15 min, x25 in simulation), 5 wrong passwords lock the account 15 min, redirects `/dashboard` if cleared else `/onboarding` | uncleared lands on /onboarding | nobody |
| TH1.5 | T1 | /login | link "Forgot password?" then /forgot-password field Email, button "Send reset link" | `requestPasswordReset`: inserts `auth_tokens` purpose `password_reset` (1 hour), sends reset email in the user's saved locale; always shows "Check your inbox" | outbox email to T1 with `/reset-password?token=...` | nobody |
| TH1.6 | T1 | /reset-password?token=... | field New password; button "Update password" | `resetPassword`: sets hash, marks token used, revokes every session, redirects `/login?reset=1` | notice "Your password has been updated. Sign in with your new password." Reusing the link gives "That reset link is invalid or has expired. Request a new one." | nobody |
| TH1.7 | T1 | /reset-password (no token) | button "Request a new link" | static page "Link not valid" | goes to /forgot-password | nobody |
| TH1.8 | T1 | any clinician page after 2 h idle (or 12 h absolute), cookie still in the browser | none | `requireUser` finds no live session; `bounceToLogin` (`lib/auth/guard.ts:69`) sees the cookie and redirects to `/session-expired?next=<path>`; `app/session-expired/route.ts` runs `destroyCurrentSession` and redirects to `/login?expired=1&next=<path>` (only a same-origin path is kept) | /login shows "tauth.noticeExpired"; signing in lands on `next` (`lib/auth/actions.ts:306`); an absolute or `//` next is dropped | none |

### TH2 Verification: submit, reject, resubmit, reject twice, approve, withdraw, licence change

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH2.1 | T1 | /onboarding | page "Verify your practice"; select "Country you practise in" (`#country`), "Regulator or licensing body" (`#licenseBody`, one-tap regulator chips), "Licence number" (`#licenseNumber`), "Licence expiry" (`#licenseExpiry`, placeholder 2028-04), chips "Languages you can work in", "What you work with"; button "Save details" | `ensureVerification` inserts `therapist_verifications` state `draft`; `saveVerificationDetails` then `writeVerificationDetails` (`lib/data/licence-change.ts`) writes the text fields | green "Saved"; "Nearly there" list shrinks to the documents | nobody |
| TH2.2 | T1 | /onboarding | four document slots, each button "Upload" (then "Replace"); hidden file input accepts only jpeg, png, webp, heic, max 8 MB | `uploadVerificationDocument(field)`: limiter 30 per 10 min per caller, `uploadDocument` kind `credential` (headshot kind `headshot`), writes `idFrontUrl` / `idBackUrl` / `licenseDocUrl` / `headshotUrl`, deletes the replaced blob, audit `verification.document.upload` | badge "uploaded"; when complete "Everything is here." | nobody |
| TH2.3 | T1 | /onboarding | button "Submit for verification" (disabled while anything is missing) | `submitForReview`: state `submitted`, `submittedAt`, clears `reviewNote`, audit `verification.submit` | card "With us for review" with the fields read back; links "Change something" and "Support" | A1 must open /admin/verifications |
| TH2.4 | T1 | /onboarding | link-button "Change something" | `withdrawFromReview`: state back to `draft` only while `submitted` and not a renewal | the form is editable again; must press "Submit for verification" again | A1 deciding at the same moment wins or loses the race (both guarded on `submitted`) |
| TH2.5 | A1 | /admin/verifications | Reject with a note (required: "Say what is wrong. They see this word for word.") | `decideTherapistVerification` then `decideVerification`: state `rejected`, `rejectionCount` 1, `reviewNote`; if the two-person switch is on, first reviewer only records a proposal | outbox email to T3 subject "We need something else from you", body contains the note | T3 waits |
| TH2.6 | T3 | /onboarding | red card "We could not verify you yet" with the note; re-upload one document ("Replace") | upload while `rejected` sets state back to `draft` (`onboarding/actions.ts` upload branch) | "Submit for verification" enabled again | nobody |
| TH2.7 | T3 | /onboarding | "Submit for verification" | state `submitted` again | "With us for review" | A1 or A2 reviews |
| TH2.8 | A2 | /admin/verifications | Reject again | `rejectionCount` 2 reaches `REJECTIONS_BEFORE_REAPPLYING`; the four blobs are deleted, URL columns nulled, `documentsClearedAt` set | outbox email subject "We need something else from you", body "This is the second time we have looked, so we have not kept the documents you sent..." | T3 waits |
| TH2.9 | T3 | /onboarding | "Submit for verification" | disabled because four documents are missing; if forced via the action it returns "We reviewed this twice and could not verify it, so we did not keep the documents. Upload them again..." | slots show "Upload" | nobody |
| TH2.10 | A1 | /admin/verifications | Approve | state `approved`, clears `licenseExpiredAt` and `licenseExpiryWarnedAt`; trigger 0083 mirrors `users.verification_status` | outbox email subject "You are verified on 24Therapy"; /onboarding says "You are verified"; sidebar gains Today, Schedule, Patients, Crisis Radar and "New session" | T1 may now create sessions |
| TH2.11 | T1 (approved) | /onboarding | LicenceChangeForm fields Regulator or licensing body, Licence number, Licence expiry, Credentials, Licence type, Licence state; button "Change licence" | `askLicenceChange` then `requestLicenceChange`: holds the change in `pendingLicence`, sets `recheckSubmittedAt`; stays `approved` | "Under review. You stay cleared." | A1 decides: email "Licence change approved." or "Licence change declined" |
| TH2.12 | T4 (approved) | layout banner on every page | link "Update licence" | `licenceNotice` reads `licenseExpiry` text vs real now | amber banner "Licence expires soon" / "Licence expired" | cron `retention` or `licences` (see Timers) |

### TH3 Settings: profile, language, time zone, price, note format, password

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH3.1 | T1 | /settings | section tabs "You", "Getting paid", "Your hours", "The copilot", "Security"; "Your details" form: First name, Last name, Credentials, Licence type, Licence state, Licence number; button "Save details" | `updateProfile` then `writeProfile` (licence fields go through review once approved, hint "Changes go through review.") | "Saved" | nobody |
| TH3.2 | T1 | /settings | card "Language": select, button "Save" | `saveMyLanguage` then `saveLocale`: writes `users.locale` and the locale cookie | portal re-renders in Arabic; every later email and WhatsApp to T1 uses Arabic (`wordsFor({userId})`) | nobody |
| TH3.3 | T1 | any page | top corner language switch buttons "English" / "العربية" | `setLocale` sets only the cookie; does NOT write `users.locale` | screen changes, emails do not | nobody |
| TH3.4 | T1 | /settings | "Your time zone": select "Time zone", button "Save" | `saveTimezone` then `writeTimezone`; unknown zone gives "We do not recognise that time zone." | "It is {time} in {place} right now." | reminders use it for quiet hours |
| TH3.5 | T1 | /settings (Getting paid) | "Where you practise" radio "Outside Egypt" / "Egypt"; "Your price per session" (`rateDollars`), "Currency" (`rateCurrency` usd or egp), checkbox "Pay my 24Therapy bill out of my earnings" (`autoSettle`); button "Save payment settings" | `updatePaymentSettings`: converts EGP at the operator rate, `priceProblem` against min 500 cents and max 50,000 cents, writes `sessionRateCents`, `rateEgpMinor`, `autoSettleFromEarnings`, then `organizations.region` (solo only) | "Saved"; region `eg` switches billing to the transfer rail (`organizationNeedsTransfer`) | nobody |
| TH3.6 | T1 | /settings (Getting paid, Egypt) | "How you would like to be paid": "Set it up" / "Change it" (links to /earnings payout form) | see TH15 | | |
| TH3.7 | T1 | /settings (The copilot) | "Note format" select, "Save changes"; "Your own format": Name, "Heading: what goes in it. One a line.", button "Add it"; "Remove" | `saveNoteFormat`, `addNoteTemplate`, `removeNoteTemplate` in `lib/data/note-formats.ts` | next note is drafted in that format | nobody |
| TH3.8 | T1 | /settings (The copilot) | AssistantPrefsSettings: "Answer in", "Read-aloud voice", button "Save" | `saveAssistantPrefs` | "Saved" | nobody |
| TH3.9 | T1 | /settings (Security) | "Current password", "New password", button "Change password"; button "Sign out" | `changePassword`: revokes all sessions, redirect `/login?changed=1` | "Password changed. Please sign in again." | nobody |
| TH3.10 | T1 | /settings | links "Open verification", "Open your codes", "Your public page" (`/t/<userId>`), "Meeting accounts", "Your record system" | navigation only | | |

### TH4 Availability, calendar, inviting a patient into an hour, reminders

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH4.1 | T1 | /bookings ("Your calendar") | day cells; "Open these hours": "From", "To", "Where" ("Online" / "At my practice" / "Either"); button "Open them" | `openHoursOn` (requireVerified) then `publishHours`: whole-hour `availability_slots` rows in T1's zone, past hours skipped, non-online needs a confirmed practice ("Add and confirm your practice address first, so patients know where to come.") | slots listed; patient booking page `/t/<T1 id>` shows them | P3 can book on the public page |
| TH4.2 | T1 | /bookings | on an open hour: select "Which patient", button "Invite them" | `invitePatient` then `bookSlot`: creates a `sessions` row (scheduledAt = slot, joinToken, priceCents = T1 rate, paymentStatus `pending` if rate greater than 0), `payFromPot`, `holdWallet`, then `notify` kind `booking.confirmed` | slot shows "Booked" with the name; outbox to P3: subject "A session with Nadia ..." body "Nadia ... has kept {when} for you." plus a join link; if no contact: "The hour is held for them, but we have no way to reach them..." | P3 opens the link later |
| TH4.3 | T1 | /bookings | on a booked hour: "Move to" select, button "Move" | `moveBookedHour` then `rescheduleBooking` by therapist | "Moved. The patient has been told."; outbox message to P3 | P3 |
| TH4.4 | T1 | /bookings | on an open hour: "Close this hour" | `closeHour` then `withdrawHour` (open only) | hour gone; a booked one gives "That hour is booked or already gone, so it stays on the calendar." | nobody |
| TH4.5 | T1 | /on-call | AvailabilityEditor "Hours people can book": From, Until, button "Publish"; per slot "Remove this hour" or, if booked, "Cancel this appointment" with "Reason for the patient (no clinical detail)" | `publish` / `withdraw` / `cancel` in `on-call/schedule-actions.ts`; cancel runs `cancelBooking` then `afterClinicianCancel` | patient outbox: subject "Your session is cancelled", body "Your clinician cancelled your session." and "Their reason: {reason}" plus refund line if paid | P3 |
| TH4.6 | cron | /api/cron/reminders | bearer CRON_SECRET | `bookingsNeedingReminder(20,24)` and `sameDayNeedingReminder` on real slot times, quiet hours held, `markReminded` | outbox to P3 "A reminder that your session with {therapist} is {when}." | slot must start 30 min to 24 h after the real now |
| TH4.7 | cron | /api/cron/reminders | bearer | `releaseUnconfirmedBookings`: paid booking still `pending` more than 24 h after creation and more than 2 h before start is freed | slot open again; outbox to P3 "Your session with {therapist} was not confirmed" | only after `age` moves the session `created_at` back |

### TH5 Patients: add, edit, record invite, import, access request

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH5.1 | T1 | /patients | button "Add a patient"; fields First name, "Last name (optional)", "Phone" (required), "Email (optional)"; submit "Add patient" | `addPatient`: `toE164`, duplicate check on caseload ("... is already on your caseload with that number..." with link "Open the record that already has this number" or tick "This is a different person who shares that phone..."), `createPatient`, redirect `/patients/<id>` | patient page "Not seen yet" | nobody |
| TH5.2 | T1 | /patients/[id] | PatientEditor: First name, Last name, Email, Phone, "Working diagnoses", "Treatment goals"; button "Save" | `savePatient` then `updatePatient` | "Saved" | nobody |
| TH5.3 | T1 | /patients/[id] | RecordAccess "Their own access": button "Create an invite link" | `createInviteLink` (requireVerified): `issueInvite`, notify kind `claim.invite` | one-time link shown with "Copy"; outbox to patient: subject "Nadia ... has invited you to 24Therapy" with `/patient/invite/<token>` | patient claims on the patient portal |
| TH5.4 | T1 | /patients/[id] | "Cancel that link", "Issue a new one" | `cancelInviteLink` then `revokeInvite` | | |
| TH5.5 | T1 | /patients/[id] | when the patient failed the claim check 3 times: field "Why, e.g. ...", button "Let them try again" | `releaseClaimLock` | "Released. Three more attempts, and it is on the record that you did it." | patient retries |
| TH5.6 | T1 | /patients/[id] | AccessBanner button "Ask for access", field "Why are you asking? They read this.", button "Send request" | `askForAccess` then `requestAccess` | "Asked. They see your note when they next sign in." | patient answers on /patient/consent |
| TH5.7 | T1 | /patients/import | file field, select "Which country are these numbers in"; button "Show me what is in it"; then "Add these {count} people" | `preview` (max 2 MB, needs a name column and a phone column), `commit` (max 2000 rows) then `importPatients`; sends nothing | "{count} added", "{count} were already here and were left alone." | nobody |
| TH5.8 | T1 | /patients | list rows link to `/patients/<id>`; link "Import from another platform" | read only | | |

### TH6 In-person session, paid directly, recorded with consent on the clinician screen

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH6.1 | T1 | /dashboard | card link "Start a session" (or sidebar "New session") | navigation | /sessions/new "New session" | |
| TH6.2 | T1 | /sessions/new | "Where": "In person" (default); checkbox "Transcribe this session" (default on); "Existing patient" select or "Patient first name" (`#guestName`), "Patient mobile number" (`#guestPhone`), "Patient email (optional)"; "How is this session paid?" radio "They pay me directly. Start now."; button "Start session now" | `startNewSession` (requireVerified): `createSession` inserts patient (source therapist, join_link or walk_in) and `sessions` (modality in_person, status scheduled, no joinToken, price 0, paymentStatus not_required), `payFromPot`, `holdWallet`; for a new patient with a phone `createInviteLink` sends the record invite; redirect `/sessions/<id>/room` | room shows banner "Recording waits for {name}'s yes." with buttons "Yes, you may record" / "No, do not record"; outbox record invite to P1 if phone given | P1 is physically "present": the therapist agent clicks for P1 |
| TH6.3 | T1 for P1 | /sessions/[id]/room | "Yes, you may record" | `answerInPersonConsent('granted')`: `recordingConsent` granted, version, `recordingStartedAt`, clears `recordingPausedAt` (only if consent was null) | banner disappears | |
| TH6.4 | T1 | /sessions/[id]/room | button "Start session" | `goLive` then `startSession`: status `in_progress`, `startedAt`; `noticeSessionStarted` only if a joinToken exists (none in person) | header "In person · 0:0x", pill "Live", clock bar; transcript empty title "Listening…" | fake audio device must be live |
| TH6.5 | T1 | room | (no click) | `SessionRecorder` records 8 s wav chunks and POSTs `/api/sessions/<id>/transcribe` (cookie door, same-origin); route checks `in_progress` and `mayRecord`, `transcribeChunk`, `appendTranscriptSegment` (unique on session + sequence), crisis phrase scan, copilot suggestions every few chunks | transcript lines appear with speaker "unknown" (one track); copilot toasts "Explore" / "Reflect" / "Pattern" / "Risk" | |
| TH6.6 | T1 | room | "Spoken": "Detect" / "English" / "العربية" | `setTranscriptLanguage` | next chunk pinned | |
| TH6.7 | T1 | room | "Off record" then "Resume" | `pressOffRecord` then `setRecordingPaused(true/false)`; resume only lands with consent granted | pill "Off record"; transcript title "Paused"; chunks refused with 409 `not_recording` while paused | |
| TH6.8 | T1 | room | button "End session" (no confirmation) after about 3 minutes | stops recorders, waits for in-flight uploads (max 5 s), `endSession` then `completeSession`: status completed, `endedAt`, `durationMinutes` = round(minutes, min 1), noteStatus `generating`, patient `lastSessionAt`; `after()` runs `finishSession`: delete video room, `releaseClaim`, `chargeForSession`, `settleInvoicesFromHeld`, `assessSessionRisk`, `generateAndStoreNote` | redirect `/sessions/<id>`: "Writing your note" (polls every 3 s), then the note | |
| TH6.9 | system | billing | | `chargeForSession`: lines platform 100 cents plus ai 300 cents (consent granted, PAYG); first completed session of the org gets an invoice `waived` "First session, on us"; otherwise credit, then net from held earnings, else invoice `due` "Completed session" | invoice row; /billing shows it; dashboard "One session this month" | |
| TH6.10 | T1 | /sessions/[id] | tabs "Clinical note" / "Their summary"; "Edit", "Save changes", "Redraft", "Sign the note" | `saveNote`, `regenerateNote` (only while both halves are draft), `approveNote` then `signNote` | "Signed. It stays in the chart." | |
| TH6.11 | T1 | /sessions/[id] | card "Before you close this session": ticks "Sign the clinical note", "Release {name}’s copy", textarea "Leave empty to publish nothing." under "Add a version to their clinical summary"; button "Publish what is ticked" | `approveSession`: `approveNote`, `approvePatientNote` (`releasePatientCopy`, then `releaseBrief` or `sweepUnratedSessions`), `publishSummary` | message like "Chart signed, their copy released, summary version 1 published."; outbox to P1 when released and rated, or a "summary ready" nudge | P1 rates at `/feedback/<token>` to pull the brief |
| TH6.12 | T1 | /sessions/[id] | after signing: "Add an addendum", field hint "Kept for good, with your name and time.", button "Add it" | `addNoteAddendum` then `addAddendum` | addendum listed "Nadia ..., {when}"; unsigned note gives "Sign it first." | |
| TH6.13 | T1 | /sessions/[id] | "Also write it as" select, "Write" | `alsoWriteNote` then `draftNoteInFormat` (awaited, no extra bill) | second note tab, badge "Draft" | |
| TH6.14 | T1 | /sessions/[id] | "Transcript" details: per line "You" / "Them" / "Not sure"; Voices panel "This is me" / "This is the patient" / "That is wrong, take the name off" | `attributeLine`, `nameVoice`, `unnameVoice` | lines relabelled; then "Redraft" follows the correction | |
| TH6.15 | T1 | /notes | rows link `/sessions/<id>?note=<noteId>`; subtitle "Everything approved" when done | read | dashboard "One note waiting for you" disappears | |
| TH6.16 | T1 (verified) at phone width | any clinician page | bottom bar: two primary items, raised "+" (aria "portal.dash.start"), remaining primaries, "More"; under the header the group tabs | `BottomNav` and `SectionTabs` (`components/nav/`), from `destinationsFor(cleared)` and `groupOf`; both return null on any path ending `/room`; the More sheet closes on navigation | "+" opens /sessions/new; the current group item is `aria-current="page"`; the bar is absent inside the room; an unverified T1 sees a flat bar with no "+" and no More | none |
| TH6.17 | T1 | `/sessions/[id]` after a session with "Off record" pressed for part of it (TH6.7) | read the note header | `NoteOriginNote` (`components/notes/provenance.tsx`): provenance transcript, partial or clinician; partial states minutes off record as ceil(seconds/60), minimum 1 | Amber badge "note.origin.partial" with the minutes line; a fully recorded session shows teal "note.origin.transcript"; "Write it yourself" (TH8.7) shows slate "note.origin.clinician"; `/patients/[id]` session rows carry the same badge (`NoteOrigin`) | none |
| TH6.18 | T1 | `/sessions/[id]` after an in-person session with consent, once the note is ready | "Transcript" details | Before the note is drafted `diariseSession` (`lib/ai/diarise.ts`, called from `lib/ai/notes.ts:379`) labels `unknown` lines as therapist or patient in batches of 120 and sets `speaker_inferred`; a line with a `?` followed by more words stays `unknown`; measured labels are never overwritten | Lines show "You"/"Them" with the tag "inferred"; question-plus-answer lines stay "Not sure"; a video session with both tracks is untouched | none |

### TH7 In-person session paid through 24Therapy (QR, pay link, fallback to direct)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH7.1 | T1 | /sessions/new | "In person"; "They pay through 24Therapy, card or company benefit, before we start"; "Price for this session" (max = T1 list price); "Start session now" | requires settings `rules.inPerson.payThroughUs`; price above list refused ("That is above your price per session. You can lower it, never raise it."); no list price: "Set your price per session in Settings first."; session gets joinToken, price, paymentStatus `pending`; redirect `/sessions/<id>/collect` | page "Waiting for payment": price, QR of `/pay/<token>`, "The patient scans this on their own phone and pays.", "Waiting for the payment…" (refresh every 5 s) | P5 opens `/pay/<token>` |
| TH7.2 | T1 | /sessions/[id]/collect | button "Send the pay link" | `sendPayLink`: notify kind `session.invite` subject "Pay for your session" | "Sent."; outbox to P5 with `/pay/<token>` | P5 pays by transfer (card is real money) |
| TH7.3 | T1 | /sessions/[id]/room | "Start session" before payment | `startSession` throws "The patient pays first. The session starts once the payment is in."; the room page itself redirects back to /collect while unpaid | error shown | |
| TH7.4 | P5 plus A1 | /pay/<token> then admin | patient declares transfer; A1 confirms | paymentStatus `paid` | collect page "Paid. You can start." and link "Start the session" | T1 waits on the collect page |
| TH7.5 | T1 | /sessions/[id]/collect | alternative: "They paid me directly" | `paidDirectly`: only if no payment started in the last hour; price 0, not_required, joinToken nulled; redirect to room | room opens; error otherwise "A payment through us has already started or arrived. Wait for it instead." | |

### TH8 Online session in the 24Therapy room, end to end

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH8.1 | T1 | /sessions/new | "Where": "The 24Therapy room" (card body "Send a join link"); "Transcribe this session"; Patient first name, mobile, "Patient email" (`#guestEmail`); optional "Ask the patient to pay before joining" plus "Price for this session" (EGP, min and max from settings); button "Start session now" | `createPrivateRoom` first (a failure returns "... Nobody has been invited. Start this session in person, or try again once it is fixed." and writes nothing); `createSession` (joinToken, expires in `sessionLinkHours` 12); room url saved; `sendSessionInvite` email in `after()`; record invite if phone; redirect room | room: "Waiting for your patient", button "Copy join link" (`data-join-url` holds `/join/<token>`); consent strip "Waiting for {name}'s yes on their screen." | outbox email to P2 with `/join/<token>` |
| TH8.2 | P2 | /join/<token> | name field, "Join session" (or "Pay {amount} and join"); then "May your therapist record this session?" "Yes, you may record" / "No, please do not record"; "Go in" | patient side sets `patientJoinedAt`, `recordingConsent` | therapist room polls `/api/sessions/<id>/state` every 5 s: strip "{name} is in the room, waiting for you to start." | P2 must be on /join before step 3 is meaningful |
| TH8.3 | T1 | room | "Start session" (this session was started on the spot, so no clock holds it; a BOOKED session's room shows "Booked for {time}" and no button until 15 minutes before, "Starting soon, at {time}" and no button until 5 minutes before, then "Join early", and `startSession` refuses an earlier start with "This session is booked for {time}. It can start from 5 minutes before."; there is no "Start now anyway") | as TH6 step 4; `noticeSessionStarted` sends kind `session.started` because a joinToken exists | outbox to P2 "Your session has started" (sent even when P2 is already in) | |
| TH8.4 | T1 plus P2 | room | fake audio on both browsers | two recorders: local (speaker therapist) and the remote Daily track (speaker patient) when video is configured; otherwise one local track | lines with "You" / "Them"; if Daily is not configured the video area says "Video is not configured" and only the local mic is transcribed | P2's fake wav is only heard through Daily |
| TH8.5 | T1 | room | "Ask the copilot" panel ("Free during a session"), "Prepare me" (once per session), field "What has changed since we started?", "Ask" | `askCopilot` with a live session: quota bypassed, message stamped with the session id | answer with citations | patient must have a chart (patientId) |
| TH8.6 | T1 | room | "End session" | as TH6 step 8 | note written | P2 lands on the patient end screen |
| TH8.7 | T1 | /sessions/[id] | if the note failed: "Try again" (consent granted) or "Write it yourself" | `regenerateNote` / `startOwnNote` (empty draft, provenance clinician) | | |
| TH8.8 | T1 | /sessions/[id] | SourcePanel (only while scheduled or in progress): "Issue a credential", "Revoke it" | `issueUploadCredential` then `issueIngestToken`; token shown once | the bearer door of `/api/sessions/<id>/transcribe` accepts audio with `Authorization: Bearer <token>` and answers `{accepted:true}` | a script can post wav chunks |
| TH8.9 | T1 | /sessions/[id] | while unfinished: "Open room"; "Cancel this session", reason field, "Yes, cancel it", "Back" | `abandonSession`: reason required ("Give the patient a short reason."), `cancelSession` (joinToken nulled, booked slot reopened), `afterClinicianCancel` (refund if paid), `releaseClaim`, redirect /sessions | status Cancelled; outbox "Your session is cancelled" with the reason | P2 |

### TH9 Invite a patient to a paid video session from the chart

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH9.1 | T1 | /patients/[id] | card "Invite them to a session"; button "Invite to a session" | `inviteToPaidSession` then `inviteToSession`: needs phone or email and a rate greater than 0 ("Set what a session costs in your settings first..."), creates a video session at the list rate, `ensureRoom`, notify kind `session.invite` | "Sent. They pay ..." with the link and "Copy"; outbox subject "Nadia ... has invited you to a session" link "Open my session" | P2 pays then joins |

### TH10 Copilot per patient

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH10.1 | T1 | /copilot | intro "Each session earns {count} copilot questions about that patient, rolling over for {months} months."; rows and "Start a conversation" list | `listThreads`, `listPatients` | | |
| TH10.2 | T1 | /copilot/[patientId] (also embedded on /patients/[id] "Ask about this patient", link "Open the thread") | field "Ask about {name}…", button "Ask"; prompt chips; "Dictate a question"; "Read aloud" | `askCopilot`: access capability check, `checkQuota` (earned = max(5, completed sessions in 12 months x 10) minus questions asked outside sessions), `askPatientCopilot`, messages stored; `/api/copilot/voice` and `/api/copilot/speak` for dictation and TTS | answer with citations "{who} · {date} at {time}"; "{count} left" | |
| TH10.3 | T1 | same | "Change how I answer": correction field, "Save correction"; "Remove: {line}"; "Answer in" "Your language" / "English" / Arabic | `correctCopilot`, `removeCorrection`, `setCopilotLanguage` | "Noted. I will read that before every answer about this patient from now on." | |
| TH10.4 | T1 | same | "Start this chat over", "Clear the chat" | `resetCopilot` | "{removed} messages cleared. I kept {kept} of my session notes and every transcript." | |
| TH10.5 | T1 | /assistant | "New chat", field "Ask about your week…", "Send", "Delete {title}"; first-use prompt "These are fine" / "Save" | `startThread`, `ask` (monthly allowance), `removeThread`, `savePrefs` | answer mentions patients by name only | |

### TH11 Homework, questionnaires, documents, evidence, diagnoses

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH11.1 | T1 | /patients/[id]/documents ("Profile") | "Between sessions": "Set a step", title field, detail field, "Set it"; drafted items "Set this"; "Withdraw this step" | `setStep` then `assignStep` (max 200 chars), `removeStep` (open and own only) | row in `homework_items`; NO message is sent to the patient | P1 sees it on the patient portal and closes it |
| TH11.2 | T1 | same | "Questionnaires": instrument select, "Ask them now" (in the room, needs a live session) or "Send for later"; "Refresh"; "How long each answer took" | `sendAssessment` then `assignInstrument`; `pollAssessment`; `timingsFor` | row in `assessment_assignments`; NO message sent | patient answers on their portal |
| TH11.3 | T1 | /patients/[id] ("Add to their history") and documents page | "Add a file" (image up to 8 MB) or "Write or dictate", "Title", "Save" | `uploadDocumentFile` / `addNote`, `extractPending(1)`, `regenerateProfile` | document row; standing profile rebuilt | |
| TH11.4 | T1 | documents page | "Read documents"; "That is what it says" | `proposeFromDocuments`, `decideDiagnosis` | "Confirmed" | |
| TH11.5 | T1 | /patients/[id]/evidence | per fact "This is right" / "I disagree" with "Why is this wrong?..." and "Record my disagreement" | `confirmFact` then `verifyFact`; `rejectFact` (reason at least 3 chars) then `disputeFact` | "you disagreed" | |
| TH11.6 | T1 | `/patients/[id]/documents` | On a searchable document: "tdl.readAloud"; on an upload "tdl.open" (image shown in a watermarked viewer, other types a link to `/api/documents/<id>`) | Same speak route as PA22.5 with the clinician as actor; the image comes from `/api/documents/<id>` | Audio plays, audit `document.speak`; the image carries the watermark line (who and when) | none |
| TH11.7 | T1 | same | "tdl.flag", then one of "tdl.outdated", "tdl.wrong", "tdl.notMine" | `DocumentPanel.onFlag` calls `flagContent(patientId, {targetType: "document", targetId, reason})` (`app/(app)/patients/[id]/documents/actions.ts`) | The card turns amber with a "Flagged: ..." badge; the document is unchanged | P1 sees nothing; flags raised by P1 (PA22.1) show on the same card |

### TH12 Notifications, support, messages to the clinician

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH12.1 | T1 | /notifications | "Mark all read"; per row "Open" | `readAll` then `markAllRead` | dots cleared | rows come from crisis alerts, patient cancellations, billing notices |
| TH12.2 | T1 | /dashboard | red card "A session raised a risk alert", link "Review the session" | opening the session calls `markSessionNotificationsRead` | card gone | crisis phrase in the fake audio (for example "suicide") |
| TH12.3 | T1 (even unverified) | /support | "What is this about?" topic, optional session and payout pickers, "What happened?", button "Send"; "Read the reply" with "Your six-digit code" | `raiseTicket` then `fileTicket` (3 per hour per caller, x25 in simulation), due in 24 h | "Reference {ref}"; "A named person answers within {hours} hours..." | back office answers |
| TH12.4 | T1 | `/sessions/[id]` of a session whose fake audio carried crisis wording (TE46) | read the risk card above the note | `RiskAssessment` (`components/clinical/risk-assessment.tsx`) from the stored assessment: level word (`risk.lvl.*`), source sentence ("risk.fromModel" or "risk.fromKeyword"), each finding with indicator badge, confidence to 2 places and the quote, protective factors under "risk.safetyPlan", earlier assessments under "risk.before", dropped unquoted findings counted | Card present with the level translated; every quote is text that appears in the transcript | TH6.8 `assessSessionRisk` ran in `after()` |

### TH13 Referral and handover to another therapist

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH13.1 | P1 | patient portal | patient issues a code for a therapist (invite-therapist) | `patient_invites` row, code like ABC-DEF | code shown to P1 | posts the code on the board |
| TH13.2 | T2 (verified or not) | /connect | "A patient gave you a code": field "Their code", button "Ask them" | `useInviteCode` then `redeemInvite`: marks the invite redeemed, inserts `history_grants` status `pending` (shape 24h if the code lived 1 hour or less, and then a patient row is made for T2) | "{name} has been asked. Nothing is shared until they say yes."; unverified T2 also sees "Your licence is still being checked, so access will not start until we approve you." | P1 approves on /patient/consent |
| TH13.3 | T1 | /connect | "People asking you for their own history": decline reason field, "I have added it" / "Decline, with that reason" | `answerHistoryAsk` then `answerAsk` | ask answered | the patient asked from their portal |
| TH13.4 | P3 plus system | /join/<token> (booked hour, T1 never starts) | after 5 minutes past `scheduledAt` the patient sees NoShowRecovery: "Somebody else can see you now" list, or "Refund me in full" | `reassignSession`: moves session to T2 when T2 rate is not above the price; unpaid session is repriced to T2 rate; paid session moves the payment, journals `session_repriced`, puts the difference in the patient wallet ("They charge less, so {amount} is waiting as credit on your next session.") | session.therapistId = T2, `reassignedFromUserId` = T1, `recoveryOutcome` reassigned | T2 must be online on the radar and cheaper; T2 then runs the session from /sessions |

### TH14 Plan and billing

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH14.1 | T1 | /billing | read: "Your first completed session is free." until the first charge | `billingSummary` | after TH6 the notice disappears | |
| TH14.2 | T1 | /billing | PlanCard "Stop counting sessions": tier cards "{amount} a month, unlimited"; confirm dialog "Move to {name}?" with "Confirm and pay" / "Not now" | `upgradeAndPay`: region eg gives `subscribeByTransfer` (renewal obligation due now plus invoice `due` "Practice, monthly"), then `openBillPayment` opens the transfer cart; region us gives a Stripe checkout | transfer details panel with "What this transfer covers", "Select all", "Clear"; outbox none | A1 confirms the transfer in the admin |
| TH14.3 | T1 | /billing | transfer form: reference field, proof upload (receipt image), submit | `declareBillTransfer` then `declarePaid` purpose subscription | pending bar across the portal (PendingBar) | A1 confirms; `settleOldestObligationByTransfer` |
| TH14.4 | T1 | /billing | "Cancel the plan" / "Keep my plan" | `cancelPlan` (manual renewal off, Stripe cancel at period end), `resumePlan` | "Your plan ends {date}" / "Renews {date}, {amount}" | |
| TH14.5 | T1 | /billing (card rail only) | ledger checkboxes, pay button | `payInvoices` then Stripe checkout | not on live (Stripe off) | |
| TH14.6 | T5 (clinic seat) | /billing | none | `requireOrgAccount` refuses | "Your clinic's account is run from the clinic portal."; dashboard hides the billing card | clinic admin pays |
| TH14.7 | T1 | `/billing` | tap any row of "tled.title" (history) | `BillingLedger` expands `InvoiceDetail` (id prefix, type, issued, period, amount, credit with reason, "tled.youPaid", settled, "tled.covered" usage: minutes transcribed, note written, translated, risk scans, copilot questions) or `PaymentDetail` (patient paid, our fee, bill settled, "tled.heldForYou" or "tled.intoStripe") | After TH6 the session invoice lists the transcribed minutes and "note written"; the first session reads "tled.free"; due invoices are NOT in the history list and, on the eg rail, the Stripe pay card is absent (`payable` false) | none |
| TH14.8 | T1 | any clinician page after A1 confirmed the plan transfer | pending bar in green with "bar.stateDone" and "bar.dismiss" | `PendingBar` (`components/billing/pending-bar.tsx`): confirmed stage is dismissible and remembered as `paid:<paymentId>` in localStorage; open and submitted stages cannot be dismissed and their link writes `pay:<storageKey>` so the sheet opens on arrival | Before confirmation: amber bar, "bar.openHint" (open) or "bar.eta" (submitted), "bar.reopen" opens /billing with the sheet already open. After confirmation and "Dismiss": bar gone in this browser only; a second agent browser still shows it | A1 confirms in /admin/transfers |

### TH15 Earnings and payout request

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH15.1 | T1 | /earnings | "Where your money goes": "Method" ("InstaPay bank transfer" / "Mobile wallet (EGP)"), "Account or wallet number", "Full name"; button "Save payout details" | `savePayoutDestination` then `savePayoutMethod` | method shown | |
| TH15.2 | T1 | /earnings | "Withdraw": "Amount (EGP)", button "Request" | `requestWithdrawal` then `requestPayout`: amount must be at most the held balance ("You can withdraw up to ... right now."), needs a method, one open request at a time ("You already have a withdrawal in progress. It is on the queue.") | "Your withdrawals": "Requested" | A1 approves, sends, marks arrived in /admin/payouts; statuses "Approved", "Sent", "Arrived" or "Not processed" |
| TH15.3 | system | billing cron | | held earnings pay session invoices first (`settleInvoicesFromHeld`, `netFeeFromEarnings`) | invoices status paid "Completed session · taken from your earnings" | paid sessions must exist (P5 paid through us, or a radar session) |
| TH15.4 | T1 | `/earnings` | read the patient payments card and, when Stripe released anything, "tph.released" | `PaymentHistory` (`components/billing/payment-history.tsx`): per payment the patient name from the chart (never the payer), net "of" gross, status chip, "tph.heldUntil" when captured on platform, "tph.billsSettled" when fees were netted, "tph.receipt" link | A pot-funded session shows the patient's name like any other (no employer name, no card digits); a netted fee shows the settled chip | P5 or a radar patient paid (TH15.3) |

### TH16 Crisis Radar (on call)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH16.1 | T1 | /on-call | "Your radar profile": "One line about how you work", "Photo URL", "Where you are based" (country), languages, specialties; button "Save radar profile" | `saveRadarSetup` then `saveRadarProfile` | "Saved" | |
| TH16.2 | T1 | /on-call | "Your practice": "Practice or clinic name", "Address", "Find", pick a hit, "Accept walk-in visits", "Save practice", "Remove" | `findPracticeLocation` (30 lookups per 5 min), `savePractice`, `toggleClinicVisits` | "Confirmed location" | |
| TH16.3 | T1 | /on-call | "Go on the radar" then alarm dialog "Turn the alarm on and go live" or "Go on the radar without sound" | `toggleRadar(true)` (requireVerified) then `setOnline`: refused by `radarProblem` if the country is closed, has no rail or no payout method | status "Live on the radar"; public /radar lists T1; heartbeat `radarPing` keeps `lastSeenAt` fresh | tab must stay open (90 s heartbeat) |
| TH16.4 | P4 | /radar | pick T1 card, name field `#radar-name`, "Start now" | `createRadarSession` (sessionType radar, link 3 h), `claimTherapist` (status pending 10 min), `notifyIncomingBooking` | T1 hears the alarm; presence card "Someone is booking you" then "{name} is waiting for you" with "Go in now" / "Open the room" | T1 |
| TH16.5 | T1 | room | as TH8 steps 3 to 6 | `markInSession` on start; `releaseClaim` on finish puts T1 back online | radar status In a session then Live | P4 rates the session (radar ratings on /on-call "Ratings") |
| TH16.6 | T1 | /on-call or orb | "Go offline" / "Go off the radar" | `setOnline(false)`; refused while pending or in session ("You are in a session. End it first.") | "Off the radar" | |
| TH16.7 | T1 | /on-call | "Session history" and "Ratings" cards | `radarSessionHistory`, `feedbackForTherapist` | price, "24Therapy took", "You received" per row | |

### TH17 Integrations, record systems, wall QR codes

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH17.1 | T1 | /settings/integrations | "Connect {name}" / "Disconnect" | `/api/meetings/connect/[provider]` (redirects back when `features.meetingBots` is off), `disconnectMeetingAccount` | on live without Recall keys: "Meeting recording is not switched on for this deployment." | |
| TH17.2 | T1 | /settings/records | "Which system", "The FHIR base URL their integration team gave you", "Continue"; "Disconnect", "Yes, disconnect" | `begin` then `beginConnection` then redirect to the vendor; `disconnect` | "This deployment cannot hold a connection yet. It needs {missing}." when `features.ehr` is off | |
| TH17.3 | T1 | /settings/codes | "What is this one for?", "Create a code"; "Revoke this code" | `newWallCode` (requireVerified) then `createCode`; `killWallCode` | code listed "Created {date}" / "Revoked {date}" | a patient scans `/j/<code>` |

### TH18 Cancellations around bookings

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH18.1 | P3 | patient portal | cancel a booked hour outside 24 h | `patientCancel`: free window, refund, slot reopened, `tellTherapist` (in-app notification plus email) | T1 outbox "A patient cancelled a booking" / "Cancelled in time: fully refunded, and the hour is open again." | |
| TH18.2 | P3 | patient portal | cancel inside 24 h of a paid booking | `lateCancel` = held, no refund | T1 outbox "Cancelled late: the payment stays with you. You can refund it in your bookings."; /bookings "Late cancellations" row | T1 decides |
| TH18.3 | T1 | /bookings | "Refund anyway" | `refundLateCancellation` then `agreeLateRefund` | "Refunded. The patient has been told."; P3 outbox "Your clinician agreed to refund your cancelled session." | |

### TH19 Public pages a therapist uses

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH19.1 | anyone | /verify, /verify/[code] | field "Extract code", button "Check it" | `verifyExtract`; /verify/[code] redirects to /verify?code= | "24Therapy produced a record extract with this code." or "We do not recognise that code." | a patient exported a record extract |
| TH19.2 | anyone | /radar | therapist cards, SOS orb | `listRadar`, `firstOpenHours` | online clinicians listed | |
| TH19.3 | anyone | /integrations, /integrations/[slug] | links only | static marketing | | |
| TH19.4 | T1 | /on-call | links "the public radar", "Your public page" | navigation | /t/<userId> shows hours and rate | |

### TH20 Clinic principal switch and clinic seat

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| TH20.1 | T1 who also manages a clinic | sidebar | icon button "Switch to your practice account" | `switchToClinic`: revokes all clinician sessions, creates a clinic session, redirect /clinic | clinician cookie invalid | only shown when `clinic_managers.linkedUserId` = T1 |
| TH20.2 | T5 | /sessions, /patients | same flows as T1 | sessions and patients scoped to organisation plus therapist; billing refused | T5 sees only their own caseload | clinic admin owns the bill |
| TH20.3 | T1 who also manages a clinic, phone width | any clinician page | "More", then "portal.nav.switchToClinic" | Same `switchToClinic` form as TH20.1, from the bottom sheet | Clinician cookie revoked, lands on /clinic | only when `clinic_managers.linkedUserId` = T1 |

---

# C · Clinics

### CL1 Practice enquiry, activation and the first manager's password

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL1.1 | practice contact (not signed in) | /clinic/apply | Fields "Practice name", "Who should we speak to", "Email address", "Phone number", "Your practice registration number, if you have one", "Who issued it", "The clinicians you expect to bring, one name per line"; button "Ask us to call" | `apply` (app/(clinic)/clinic/apply/actions.ts) calls `applyToClinic` (lib/data/clinic-admin.ts:53): inserts organizations row kind clinic, clinic_state held, seats 0, region eg. No email, no manager, no password. | Card "Thank you. We will call you." with a link to /for-clinics. Row listed on /admin/clinics as held. | Platform admin must activate it next. |
| CL1.2 | platform super_admin | /admin/clinics | set state to active (reason required) | `setState` (app/(admin)/admin/clinics/actions.ts:39) then `setClinicState`: clinic_state active; audit clinic.active | Invitations to this clinic now resolve; its managers can sign in. | Nobody at the clinic can do anything before this. |
| CL1.3 | platform super_admin | /admin/clinics | add manager: email, name, role admin | `addManager` then `createClinicManager` (password_hash null) and `emailAccountLink` (lib/auth/account-links.ts:180): account_links row, invite, 7 days; email "Your 24Therapy account" with button "Choose a password" to /welcome/<token> | sim_outbox holds the link for an @example.com address. | Manager reads it with sim:inbox. |
| CL1.4 | clinic admin | /welcome/<token> | choose a password | `redeemAccountLink` writes clinic_managers.password_hash; link spent | The link no longer works. | |
| CL1.5 | clinic admin | /clinic/sign-in | "Email address", "Password", button "Sign in"; link "Forgot password?" | `signInClinic` then `checkClinicPassword` (clinic-admin.ts:879): refuses unless kind clinic and state active; inserts clinic_auth_sessions, cookie 24t_clinic; sets last_sign_in_at | Lands on /clinic "Who is coming, and when". Rail groups: "This week", "Your clinicians" (tabs "Your clinicians", "Your team"), "Money" (tabs "Your bills", "Earnings", "Seats"), "Your record system". Button "Sign out". | |

### CL2 Clinic password reset (manager or staff)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL2.1 | manager or staff | /clinic/forgot-password | "Email address", button "Send reset link" | `requestReset` then `requestClinicReset` (lib/clinic-auth/tokens.ts:139): if the address exists, supersedes older unused reset tokens, inserts clinic_auth_tokens purpose password_reset, expires 1 hour; `sendPasswordReset` to /clinic/set-password?token=...; audit clinic.password.reset_requested | Always "Check your inbox" / "If an account exists, a reset link is on its way. It works once, for an hour." | Agent reads the mail with sim:inbox. |
| CL2.2 | same person | /clinic/set-password?token=... | "New password" (hint "At least 10 characters."), button "Update password" | `setPassword` then `setClinicPasswordByToken` (tokens.ts:97): validatePassword (10 to 200 chars), claims token, sets hash, revokes every clinic session of that manager; audit clinic.password.set | Redirect to /clinic/sign-in. Token spent. Old sessions dead. | |
| CL2.3 | same person | /clinic/set-password?token=bad | page render | `clinicTokenView` null | "That link is no longer valid." and link "Send reset link" | |

### CL3 Invite a clinician who is new to the platform (buys a seat when none is free)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL3.1 | clinic admin | /clinic/people | Card "Invite a clinician": "First name", "Last name", "Email address", "Phone number"; when no seat is free the line "No free seat: this adds one. {monthly} a month, {today} now." (hidden seatFrom and seatTo); button "Send the invitation" | `invite` (app/(clinic)/clinic/people/actions.ts:27), admin only. `inviteClinician` (clinic-admin.ts:217): refuses an address already a clinician here; revokes any earlier "sent" invitation for that email; inserts clinician_invitations, expires 14 days. If seatTo > seatFrom: `applySeatChange` (lib/billing/seats.ts:94): organizations.seats = seatTo guarded on the old count, then `billSeatProration` raises an invoice kind subscription, status due, "N seats from M, for the D days left of this month". `notify` kind claim.invite, subject "You have been invited to a practice on 24Therapy", link "Open the invitation" to /clinic/join/<token> (WhatsApp copy kept in outbox if a phone is given). Audits clinic.invited and seats.changed. | "Invitation sent. The link lasts fourteen days." plus "Their link, if you would rather send it yourself:" and the URL. Row "Invited, not yet accepted" with "Cancel the invitation". /clinic/seats reads "{filled} filled, {invited} invited". /clinic/bills Seats card shows the proration invoice as "Due". | Clinician receives the invitation. Seat prices: 1 seat $80 a month, 2 or more $72 each (lib/settings/defs.ts:862). |
| CL3.2 | invited clinician | /clinic/join/<token> | page render; heading "{clinic} has invited you"; fields "First name", "Last name", "Password"; who-sees-what table; button "Set my password and join"; link "I already have an account" | `resolveInvitation` (clinic-admin.ts:329) stamps terms_shown_at. On submit `accept` then `acceptInvitation` (:381): password at least 12 chars, invitation sent and not expired, terms shown, `hasFreeSeat`; inserts users (role therapist, verification unverified, organization = clinic); invitation accepted; `takeSeat` inserts clinic_seats (billable_from now) under an advisory lock; `createSession`; redirect /dashboard | New clinician signed in, sent on to licence verification. Admin's /clinic/people row shows the name, email and "Has not started verification". | Clinician must verify in the clinician portal; the practice cannot ("C267" line on screen). Platform verification staff approve it. |
| CL3.3 | clinic admin | /clinic/people | reload | `clinicClinicians`, `seatsFor`, `patientsByClinician` | Status words only: "Verified", "Verification in progress", "Has not started verification", "Verification was not accepted". No control. Folded "Patients" list shows first name and last initial once the clinician has patients. | |

### CL4 Invite accepted by somebody who already has a clinician account

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL4.1 | existing clinician | /clinic/join/<token> | "I already have an account", then "Email address", "Password", button "Sign in and join" ("I am new here" goes back) | `joinWithAccount` then `joinWithExistingAccount` (clinic-admin.ts:532): password checked; refused if their own practice has any patient row (:594); `hasFreeSeat`; invitation accepted; `takeSeat` with billable_from = their own subscriptions.current_period_end if in the future; users.organization_id and therapist_verifications move to the clinic; then `cancelSubscription` (Stripe, at period end, failure only logged); `createSession`; redirect /dashboard | /clinic/people row shows "This seat is not billed until {date}: they had already paid for their month." while billable_from is in the future. | Needs a clinician created earlier in another flow. |

### CL5 Cancel an invitation

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL5.1 | clinic admin | /clinic/people | "Cancel the invitation" on a pending row | `cancelInvitation` then `revokeInvitation` (clinic-admin.ts:289): state revoked where still sent; audit clinic.invitation_cancelled | Row gone; /clinic/join/<token> reads "That invitation is no longer valid. Ask the practice for a new one." A seat bought for it is NOT released (see CE16). | |

### CL6 Change the number of seats by hand

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL6.1 | clinic admin | /clinic/seats | Card "{filled} filled, {invited} invited"; card "Seats": "{count} seats, {monthly} a month."; range slider "Number of seats" | `quoteClinicSeats` then `quoteSeatChange` (seats.ts:53): period from subscriptions.current_period_end, or now plus 30 days when there is none | Quote "{count} seats: {to} a month, up from {from}." and "You pay {amount} now for the {days} days left this month." or "Removing seats refunds nothing this month; the smaller bill starts at renewal." or "Nothing to pay now. The new figure starts at renewal." | Staff never reach this page (seats.manage is never delegable). |
| CL6.2 | clinic admin | /clinic/seats | button "Change to {count} seats" | `saveClinicSeats` then `applySeatChange`: refuses below occupied seats, compare-and-set on organizations.seats; positive proration raises a due invoice; negative proration calls `setUpcomingDiscount` (overwrites subscriptions.upcoming_discount_cents); audit seats.changed | "Saved". New due invoice on /clinic/bills when seats went up. | |

### CL7 Remove a clinician from the practice

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL7.1 | clinic admin | /clinic/people | "Remove from the practice" on a row; confirm text "They move to their own practice now, and any meeting account they connected here is disconnected." and, when a seat comes free, "This frees a seat: {monthly} a month."; red "Remove from the practice" | `remove` then `removeClinician` (clinic-admin.ts:723): revokes the clinic's meeting connections for them; creates a solo organization with a payg subscription; releases their clinic_seats row; moves users and therapist_verifications to the solo org; in-app notification "You have left {clinic}"; email "You are no longer part of {clinic} on 24Therapy" in their language. If a seat was quoted, `applySeatChange` from bill.seats to bill.seats minus 1 (credit via setUpcomingDiscount). Audits clinic.clinician_removed and seats.changed | Row gone; seat count down one; sessions already run stay in the clinic's organization and on its rota and bills. | Clinician sees the notice and is now pay as you go. |

### CL8 Roles and delegated staff

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL8.1 | clinic admin | /clinic/team | Card "Roles": "What is this role called", checkboxes under "What it can do": "See who is coming and when", "See the clinician list", "See the practice's bills", "See earnings totals", "See activity reports", "Manage this team", "Export what they can see"; note "Buying seats and inviting clinicians stay with you: both commit the practice to money."; button "Add this role" | `saveRole` then `createRole` (lib/data/clinic-team.ts:86) via `roleProblem` (lib/clinic-auth/capabilities.ts:135): name 2 to 40 chars, at least one capability, none never-delegable; slot 1 or 2 only; audit clinic.role.create with the capabilities | Role listed with its capabilities, buttons "Change" and "Remove". Form disappears after two roles. | |
| CL8.2 | clinic admin | /clinic/team | Card "People": "Email address", "Their name", "Their role", button "Add them" (only once a role exists) | `inviteStaff` then `addStaff` (clinic-team.ts:270): clinic_managers row role viewer, role_id set, no password; `issueClinicToken` invite, 14 days; email "{clinic} has added you on 24Therapy", button "Choose your password", link /clinic/set-password?token=...; audit clinic.staff.add | Row with "Invited, no password yet", role dropdown, "New link", "Remove". The link is also shown to the admin. | Staff member reads sim_outbox. |
| CL8.3 | staff member | /clinic/set-password?token=... then /clinic/sign-in | "New password", "Update password"; then "Sign in" | as CL2 step 2; then `getClinicActor` builds capabilities from the role, and therapist_ids from clinic_staff_assignments | Staff lands on /clinic. Rail shows only groups whose first tab they hold. With no assignment they see empty rota, empty earnings, no usage. | Admin must assign clinicians next for scoped reads. |
| CL8.4 | clinic admin (or staff holding "Manage this team", not on their own row) | /clinic/team | under "Whose work they cover": one checkbox per clinician; "Save" | `saveAssignments` then `setAssignments` (clinic-team.ts:437): replaces the list; refuses own row for non-admins; audit clinic.assignments.set | "Saved." Staff now see those clinicians' rota rows, patients list, earnings and usage. | |
| CL8.5 | clinic admin | /clinic/team | role dropdown "Their role"; "Sign them out everywhere"; "New link" (only while no password); "Remove" then "Confirm" | `changeStaffRole`, `signOutStaff` (revokes clinic_auth_sessions), `reinviteStaff` (old token superseded), `removeStaff` (soft delete, assignments deleted, sessions revoked); each audited | Role change applies on the staff member's next request. Removed staff cannot sign in. | |
| CL8.6 | clinic admin | /clinic/team | "Change" on a role then "Save this role"; "Remove" on a role | `updateRole` or `removeRole` (soft delete) | A deleted role leaves its holders signed in with no capability at all. | |

### CL9 The week, usage and exports

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL9.1 | admin or staff with schedule.read | /clinic | "Earlier", "Later" (query ?week=YYYY-MM-DD), line "Times in {zone}" | `clinicSchedule` (lib/data/clinic.ts:309): sessions of this organization in the week, scoped to assigned clinicians for staff; patient shortened to first name and last initial; audit phi_access clinic.schedule.read on every view | Cards "Booked this week" and "Clinicians on the rota" (cancelled excluded); rows name, clinician, time, "Cancelled" badge only; no link. | Patients book with the clinic's clinicians in the clinician and patient flows. |
| CL9.2 | holder of reports.read | /clinic | card "Sessions and spend, by week" | `clinicUsage` (clinic.ts:642): invoices grouped by issued week, floor 5 with carry forward | Weeks under the floor read "Not enough activity to report yet". | |
| CL9.3 | holder of schedule.read and export | /clinic | link "Download as a spreadsheet" | GET /clinic/export?what=schedule&week=... (app/(clinic)/clinic/export/route.ts): `exportSchedule` (lib/data/clinic-export.ts) with watermark rows "Exported by ... at ..."; audit clinic.schedule.export | CSV columns When, Time zone, Who, Clinician, State. 401 when signed out, 403 without the capability. | |

### CL10 Bills and paying them

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL10.1 | holder of bills.read | /clinic/bills | read; link "Download as a spreadsheet" if export | `clinicBills` (clinic.ts:756): per month platform fee, AI fee, total, due, paid; session count withheld under 5; `clinicSeatBills` lists seat invoices | "{amount} due" when anything is due; month cards with "Due" or "Paid"; Seats card; "Nothing billed yet." when empty. | Session invoices appear when the clinic's clinicians complete sessions (chargeForSession, outside this area). |
| CL10.2 | clinic admin, eg practice | /clinic/bills | invoice picker "What this transfer covers" with "Select all" and "Clear"; "Pay now"; inside the sheet: bank details, "Put the reference here", "Or attach the receipt", "Submit"; "Cancel this payment" then "Yes, cancel it" | `openClinicBillPayment` opens a cart (lib/billing/cart.ts) with EGP amount; `declareClinicBillTransfer` (app/(clinic)/clinic/bills/actions.ts:128) uploads proof, `declarePaid` then `openManualPayment` and `submitProof`: manual_payments purpose subscription, payer organization, state submitted; audit clinic.bills.transfer_declared | Pending bar "Track your payment"; invoices still Due. | Operator must confirm in /admin/transfers; `grantSubscription` (lib/billing/manual-grants.ts:467) then marks due invoices paid oldest first while they fit. |
| CL10.3 | clinic admin, non-eg practice | /clinic/bills | "Pay {amount}" | `payClinicBills`: `createInvoiceCheckout` (Stripe) then redirect; on return ?checkout=<id> `confirmCheckout` | "Payment received, thank you." or "Checkout cancelled. Nothing was charged." | Needs Stripe on the deployment. |

### CL11 Earnings, records system, switching and signing out

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CL11.1 | holder of earnings.read | /clinic/earnings | read only | `clinicEarnings` (clinic.ts:541): sum of session_payments.therapist_net_cents per clinician in this org, payout_requests date, amount, state | "What your clinicians have earned", combined total, per-clinician withdrawals with states; no control that moves money. | Clinicians request payouts in their own portal. |
| CL11.2 | holder of team.manage (admin to act) | /clinic/records | "Connect {name}", "Which system", "The FHIR base URL their integration team gave you", "Continue"; "Disconnect" then "Yes, disconnect" | `begin` (records/actions.ts:24): `beginConnection`, audit records.connect_started, redirect to the vendor; `disconnect` revokes one connection by id | Staff see "Only the clinic admin can connect or disconnect a record system." | Needs a real EHR vendor. |
| CL11.3 | admin with a linked clinician account | any /clinic page | "Switch to your clinician account" | `switchToClinician` then `leaveClinicPrincipal` (lib/clinic-auth/switch.ts:50): revokes every clinic session, audit principal.switch, clinician session, redirect / | Clinic cookie gone, clinician signed in. | Only for a therapist who upgraded to a clinic. |
| CL11.4 | anyone signed in | any /clinic page | "Sign out" | `signOutClinic` revokes the session | Redirect /clinic/sign-in. | |

---

# D · Companies

### CO1 Company enquiry, activation, pot and first login

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO1.1 | company contact (not signed in) | /sponsor/apply | "Organisation name", "What are you" radios "A company" / "A university", country, "Who should we speak to", "Email address", "Phone number", "Best time to call"; button "Ask us to call" | `apply` then `applyToSponsor` (lib/data/sponsor-admin.ts:52): a repeat contact email only re-sends the acknowledgement; else inserts sponsors state held, entity eg, currency egp; mail "We have your enquiry" to the contact; `tellBackOffice` emails every back-office user "A company asked us to call" | "Thank you. We will call you." Row on /admin/sponsors as held. | Platform admin acts next. Back-office staff get a real email. |
| CO1.2 | platform super_admin | /admin/sponsors | activate (state active); open their pot: refund policy, expiry date, overdraft, welcome credit (max $100); add portal user (email, role admin) | `activate` then `setSponsorState` (sets verify_cycle_started_at); `openTheirPot` then `openPot` (sponsor-admin.ts:325): sponsor_pots row, welcome credit journaled as pot_topup and `publishTopUp`; `addPortalUser` then `createSponsorUser` and `emailAccountLink` to /welcome/<token>, 7 days | Company account active with a pot and terms. | Company admin waits for the mail. |
| CO1.3 | company admin | /welcome/<token> then /sponsor/sign-in | choose password; then "Email address", "Password", "Sign in"; link "Forgot your password?" | `redeemAccountLink`; `signInSponsor` then `checkSponsorPassword` (sponsor-admin.ts:649) refuses unless state active; sponsor_auth_sessions; cookie 24t_sponsor | Lands on /sponsor. Rail: "Overview", "Money", "Your list", "Joining code", "Your pot", "Domains", "Settings", "Team"; "Sign out". | |

### CO2 Company password reset

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO2.1 | company login | /sponsor/forgot-password | "Email address", "Email me a link" | `askForReset` then `requestSponsorReset` (lib/data/sponsor-users.ts:141): HMAC link bound to the current password hash, 1 hour, to /sponsor/set-password?t=... | "If that address has a login, the link is on its way." | |
| CO2.2 | same | /sponsor/set-password?t=... | "New password, twelve characters or more", "Save" | `setPasswordFromLink` then `setSponsorPassword` (:169): at least 12 chars; compare-and-set on the old hash; revokes all sessions | Redirect /sponsor/sign-in?set=1 showing "Password set. Sign in." | |

### CO3 Company team (logins)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO3.1 | company admin | /sponsor/team | "Email address", "Role" (Viewer or Admin), "Invite" | `inviteColleague` then `inviteSponsorUser` (sponsor-users.ts:95): sponsor_users row without password; mail "{org} invited you to its 24Therapy account" with a 7 day HMAC link to /sponsor/set-password?t=...; audit sponsor.user_invited | "Invite sent."; row marked "Invited". | Colleague sets a password as CO2 step 2. |
| CO3.2 | company admin | /sponsor/team | "Make viewer" / "Make admin"; "Remove" then confirm ("They can no longer sign in.") | `changeRole`, `removeColleague`: last admin cannot be demoted or removed; nobody removes themselves; removal revokes sessions | "Removed." | |
| CO3.3 | any login | /sponsor/team | "Change your password": "Password", "New password, twelve characters or more", "Save" | `changeOwnPassword`: checks current, revokes all sessions, new session for this browser | "Password changed." | |

### CO4 Joining code

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO4.1 | company admin | /sponsor/code | "Create a code" (only when none) | `createCode` then `mintFirstCode` (sponsor-admin.ts:501): 8 characters from a 32 letter alphabet | Code, QR for /patient/benefit?code=..., poster line, "Print this", "Replace this code", attempt counter. | Employees enrol with it on /patient/benefit. |
| CO4.2 | company admin | /sponsor/code | "Replace this code" then confirm ("The old code stops at once. Everybody enrolled stays enrolled.") | `replaceCode` then `rotateCode`: revokes live code, mints new | Old code refused to patients with "That code is not active...". | |

### CO5 Enrolment rules: work email domain, staff email list, employee ID

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO5.1 | company admin | /sponsor/settings | "What you ask people for": radios "An email address on your domain" (field "Your email domain"), "An email on our staff list", "Also an employee ID" (fields "Its shape" with "Digits only" or "Letters, then digits", "Starts with", "How many digits", "How would you describe a valid one"); button "Add this"; "Try one" checker; "Remove" per rule | `addGate` then `setIdentifierField` (sponsor-admin.ts:529): at most 3 rules; employee ID only beside an email rule; one list and one ID rule; `presetPattern` builds the regex. `dropGate` then `removeIdentifierField` | Rule listed. A domain rule on an unproved domain shows "Not proved yet: nobody can join with it." with a link to /sponsor/domains. | |
| CO5.2 | company admin | /sponsor/settings | Card "Staff list": "CSV file", "Or paste emails", "Upload list" | `uploadStaffList` then `parseEmailList` and `replaceEmailList` (lib/data/sponsor-email-list.ts:49): stores per-sponsor hashes; anybody not in the new upload gets removed_at now | "{count} on the list, {removed} off." and "{count} on the list, last uploaded {date}." | Dropped people keep the benefit 14 days, then the billing cron pauses them. |
| CO5.3 | employee (patient cast) | /patient/benefit?code=... | code, work email, optional employee ID | `enrol` (lib/data/enrolment.ts:240): gate check, proved domain required for domain rule; enrolments row with last_verified_at null; 6 digit code mailed, 30 minutes | Name appears on /sponsor/people "Who is on your list". | Patient side flow; one provisional session is covered before the code is confirmed. |

### CO6 Proving a work email domain

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO6.1 | company admin | /sponsor/domains | "Add a domain": domain input (placeholder acme.com), mailbox select (admin, administrator, hostmaster, postmaster, webmaster @), button "Add" | `addSponsorDomain` then `addDomain` (lib/data/sponsor-domains.ts:132): sponsor_domains row with a TXT token "24t-verify=..."; `sendDomainProof` mails "Confirm {domain} for your organisation's mental health cover" with "Confirm this domain" to /sponsor/domains/confirm/<id>?t=<hmac> | "Added. Publish the record above, and we will email a code to an address at that domain." Steps "Somebody at this domain answered our code" and "The DNS record is published and we can see it". | Someone reading that mailbox. |
| CO6.2 | mailbox holder (no login) | /sponsor/domains/confirm/<id>?t=... | "Yes, this mailbox is ours" | `confirmDomainMailbox` checks the HMAC, sets mailbox_proved_at | "Thank you. That half is done." | |
| CO6.3 | company admin | /sponsor/domains | "Send the code to" plus "Send" (resend); "Check the record now" | `resendDomainProof` (3 per hour); `checkDnsRecord` resolves TXT _24therapy.<domain> and sets dns_proved_at | "Proved. This domain can issue joining codes." only when both halves are done. | DNS cannot be published for example.com. |

### CO7 Pot top-up by bank transfer, receipt and ETA e-invoice

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO7.1 | company admin | /sponsor/pot | "Pay now" opens the sheet; stepper "How much to add" with "Less" and "More" ($100 to $5,000 in $50 steps), lines "Added to your pot", "VAT", "Transfer this", "Covers about {count} sessions at your coverage rate"; "Put the reference here", "Or attach the receipt", "Submit" | Choosing a step calls `openPotPayment` after 700 ms: `openCart` purpose pot_topup, amount in EGP incl. VAT. "Submit" calls `declarePotTransfer` (app/(sponsor)/sponsor/pot/actions.ts:113): min and max checks, `potTopUpMoney` with Egyptian VAT, `declarePaid` then manual_payments submitted; audit pot.transfer.declared | Pending bar on every sponsor page with "Track your payment". Balance unchanged. | Operator confirms in /admin/transfers. |
| CO7.2 | platform operator | /admin/transfers | confirm the payment | `confirmPayment` (lib/billing/manual.ts:515) then `grantPotTopUp` (manual-grants.ts, claim on granted_at): balance + net, ledger pot_topup (cash, vat_payable, sponsor_pot), `publishTopUp` adds net to the published balance, `openTopUpInvoice` creates an ETA document | Balance card shows the new figure; "Payment receipt" link under "Invoices" (/sponsor/pot/<txn>); "Tax invoices" row "Needs tax details" or "Being issued". | Reminders cron advances ETA documents. |
| CO7.3 | company admin | /sponsor/pot | "Tax details": "Registered name", "Tax number", "Governorate", "City", "Street", "Building", "Save" | `saveTaxDetails` then `saveCompanyTaxDetails` (lib/billing/eta/company.ts) and `advanceForCompany` | "Saved"; waiting documents move on; valid ones show "PDF" to /sponsor/pot/eta/<id>. | Needs ETA configured. |
| CO7.4 | any company login | /sponsor/pot/<txn> | read | `invoiceFor` (lib/billing/invoice.ts:59) scoped to this sponsor and a pot_topup with a cash leg | "Payment receipt", number, line, VAT at its rate, "Paid". A welcome credit (no cash leg) has no receipt. | |
| CO7.5 | company admin | every /sponsor page after CO7.2 | green pending bar, "bar.dismiss" | `app/(sponsor)/layout.tsx` renders `PendingBar` from `pendingPaymentFor({kind: "sponsor"})` only for a signed-in sponsor; dismiss stored per browser | Bar gone for this browser; the sign-in and apply doors never show it | Operator confirmed the top-up |

### CO8 Coverage percentage

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO8.1 | company admin | /sponsor/pot | Card "What you cover": "Edit what you cover", slider 0 to 100 step 5 ("Move it, then save"), "Save", "Cancel" | `setCoveragePercent` then `setCoverage` (lib/data/sponsors.ts:696): steps of 5 only; raise applies now; lower is stored as pending_coverage_bps with pending_coverage_from = now + 30 days; audit coverage.set | Raise: "Your people now pay {percent}% of a session." Lower: "Saved. Effective {date}; existing bookings keep their percentage." and "Changing to {percent}% on {date}." | Employees see the new split on their next booking. |

### CO9 The list of people: pause, resume, end

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO9.1 | company admin | /sponsor/people | "Pause" then confirm ("Sessions stop being covered until you resume. They are told, with no reason.") | `pauseTheirBenefit` then `pauseBenefit`: state paused; patient notice | Row badge "Paused". | Patient's next booking is not covered. |
| CO9.2 | company admin | /sponsor/people | "Resume" then confirm | `resumeBenefit`: state active; patient notice | "Resumed." | |
| CO9.3 | company admin | /sponsor/people | "End their benefit" opens "Why" with "They have left", "They have graduated", "The benefit has ended", "An administrative correction"; red "End their benefit"; "Cancel" | `endBenefit` then `removeFromRoster` (sponsors.ts:424): removed_at, state removed, not primary; patient notice "benefit ended"; audit benefit.ended | "{name}'s benefit has ended."; row gone. | |

### CO10 Overview, money ledger and published figures

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO10.1 | any company login | /sponsor | read | `potBalance` (sponsors.ts:244): returns the stored published balance; republishes (and writes) only when at least 5 new pot-funded sessions exist since the last publication; `roster`; `weeklySpend` only if the roster has 5 or more people | "Left in your pot" figure or "Not enough activity to report yet"; "Spent in total" and "Sessions in total" or "Too early to report"; heatmap or "Not enough activity to report yet"; expiry banner "Unspent money expires on {date}." | Sessions are booked by enrolled patients. |
| CO10.2 | any company login | /sponsor/ledger | "From", "To" (month), "Coverage", "Min", "Max"; "Filter", "Clear", "Download CSV"; column headers sort | `publishedLedger` (lib/data/sponsor-ledger.ts:34): entries up to the last ended week, in batches of at least 5, dated by week; `ledgerAnalytics` floors every aggregate | Rows: week, price, coverage, covered, employee share; refunds marked; GET /sponsor/ledger/export returns session-money.csv. | |

### CO11 Low pot, empty pot and expiry alerts

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO11.1 | operator | /api/cron/billing | fired by hand with the cron secret | `alertPots` (lib/billing/pot-alerts.ts:86): expiry warning inside 30 days (once per date); "empty" when the real balance is 0 or below; "low" when the published balance is under a fifth of the last top-up; once per pot per top-up | Every company admin gets "Your therapy fund needs topping up", "Your therapy fund is running low" or "Your fund expires {date}". Audit sponsor.pot_alert.* rows. | |

### CO12 Asking for unspent money back

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO12.1 | company admin (after at least one top-up) | /sponsor/pot | "Ask for unspent money back", "How much, and why", "Ask" | `askForMoneyBack` (pot/actions.ts:310): reason at least 5 chars, 1 per day; emails every back-office user; audit pot.return_asked | "Asked. We reply by email." | Operator one asks the return in /admin/sponsors/<id>, operator two sends it with a bank reference (`sendPotReturn`, lib/billing/pot-return.ts:73). |
| CO12.2 | company admin | /sponsor/pot | read | `potReturnsFor` | "Returned to you" list with "On its way" or "Sent"; balance and published balance drop by the net amount; ETA credit note row. | |

### CO13 Hidden integrations and viewer role

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| CO13.1 | any company login | /sponsor/integrations | open the URL | page redirects to /sponsor (the old page is hidden.tsx) | Lands on the overview. | |
| CO13.2 | company viewer | every /sponsor page | read | every write action calls `requireSponsorAdmin` | Viewer sees no coverage form, no top-up sheet, no remove or pause, no code create or rotate, no domain add, no rule editing (settings shows a read-only list), no invite. | |

---

# E · The console

### AD1 Founder sign-in with the emailed second step

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD1.1 | FA | /staff/sign-in | "Work email", "Password", button "Sign in" (hidden audience=staff) | `signIn` lib/auth/actions.ts:171. Rate limit 20 per 15 min per caller, lockout after 5 wrong passwords for 15 min. Creates a session, audits `signin`, redirects to /staff/second-step?next=/admin | auth_sessions row with second_factor_at null. Every guard treats it as signed out | nobody |
| AD1.2 | FA | /staff/second-step | button "Email me a code" (page title "One more step") | `sendSecondStepCode` lib/auth/second-step-actions.ts:40 then `emailSecondStepCode` lib/auth/second-factor.ts:268. Inserts staff_email_codes (hash, session bound, expires 10 min), sends email subject "Your 24Therapy console code" to the real founder inbox. Max 3 emails per 10 min. Shows "Sent." | one unused code row for this session | the human pastes the 6 digits to the lead agent |
| AD1.3 | FA | /staff/second-step | field "Code", button "Continue" | `verifySecondStep` then `passSecondStep` second-factor.ts:148. Spends the code in one UPDATE (used_at null, expires_at in future, same session), sets auth_sessions.second_factor_at, audits `second_factor.passed` reason email. Wrong code: audits `second_factor.failed`, shows "That code did not work." | redirect to /admin. Step valid 12 hours (totp.ts:32), session idle 2 h, absolute 12 h (session.ts:37) | nobody |
| AD1.4 | FA | /admin | read only: "Overview" tiles Practices, Clinicians, Patient charts, Sessions (30d), AI usage, Billing Collected and Outstanding | `platformStats`, `aiUsageByDay` lib/data/admin.ts | page renders | nobody |
| AD1.5 | FA | any console page | header link "Back to portal", currency switch | `setAdminCurrency` app/actions/admin-currency.ts sets cookie USD or EGP for a year | amounts render in the chosen currency | nobody |

### AD2 Founder invites staff, staff sign in and set up the second step

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD2.1 | FA | /admin/team | fields "First name", "Last name", "Email", "What they can reach" (Staff, the queues / Manager, the queues and their health), button "Invite them" | `inviteMember` team/actions.ts:16. `createBackOfficeUser` makes a user with an unusable password; `emailAccountLink` (lib/auth/account-links.ts) mints a 7 day invite link and emails "Your 24Therapy account" with button "Choose a password". Audits `team.member_invited` | users row role staff or manager. Shows "Link emailed." | S1 reads the link with sim:inbox |
| AD2.2 | S1 | /welcome/[token] | "New password" (10 chars or more), button "Update password" | redeems the account link once, sets the password | link used; a second use is refused | nobody |
| AD2.3 | S1 | /staff/sign-in then /staff/second-step | "Sign in", then "Email me a code", then "Code" and "Continue" | as AD1 steps 1 to 3; code goes to sim_outbox | S1 lands on /admin/transfers (landingFor) | nobody |
| AD2.4 | S1 | /admin/security | button "Set up an authenticator app", then "The code it shows" and "Turn it on" | `startEnrolment` / `finishEnrolment` security/actions.ts. Seals a TOTP secret; first valid code confirms it, stores 10 hashed recovery codes, audits `second_factor.enrolled`. Shows "Your recovery codes" once | after this the emailed code is refused ("Use your authenticator app, or a recovery code.") | optional; only if the agent can compute TOTP. Otherwise stay on "Your codes come by email." |
| AD2.5 | FA | /admin/team | "Save" on a role change, "Email a password link", "Deactivate" (confirm "Signs them out now."), "Reactivate", "Reset second step" | `changeRole`, `sendPasswordLink` (1 hour reset link), `setActive` (revokes all sessions), `resetMemberSecondFactor` (deletes app, recovery codes, email codes, nulls second_factor_at on live sessions). Each audited `team.*` or `second_factor.reset` | only staff and manager can be changed; FA cannot change or reset self ("Not your own. Another owner resets yours.") | the affected staff member must sign in again |
| AD2.6 | M1 | /admin/support | read the manager only card "How the queues are doing" | `queueHealth` only when role is manager or super_admin (support/page.tsx) | S1 does not see that card | nobody |

### AD3 A staff member at an owner page (refused screen)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD3.1 | S1 | types /admin/settings (or /admin/vault, /admin/radar, /admin/team, any OWNER row) | address bar | `requireRole("super_admin")` then `refuse` lib/auth/guard.ts:116 writes audit `access.refused` reason "staff at /admin/settings, needs super_admin", redirects to /admin/not-yours?from=%2Fadmin%2Fsettings | page shows "Not your role's page. Recorded." and link "Your work" back to /admin/transfers | FA later sees the row on /admin/audit filter "auth" |
| AD3.2 | S1 | /admin/transfers | open a transfer row whose payer is a clinician | `profileFor` hides the link to /admin/therapists/[id] for staff (transfers/page.tsx profileFor) | the payer name is plain text, no link that bounces | nobody |
| AD3.3 | FA | /admin/audit | chips "All", "phi access", "auth", "admin", "billing", "break glass", search box "Search", "Newer"/"Older" | `listAuditLog` read only, paged | the refusal row is visible with the staff email | nobody |

### AD4 Clinician verification: approve, reject with reason, second rejection clears documents

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD4.1 | S1 | /admin/verifications | tabs "Waiting", "Approved", "Rejected"; each card shows Regulator, Licence no., Expires, documents (image links to /api/uploads/<verification>.<kind>) | `reviewQueue(bucket)`; document images stream through the audited uploads route | card visible for T1 in Waiting | T1 has submitted from onboarding and is waiting on /onboarding |
| AD4.2 | S1 | /admin/verifications | field "Note to the clinician" (placeholder "Required to reject. They see this word for word"), button "Approve" | `decideTherapistVerification` admin/actions.ts:325. Refuses own ("Not your own."). With verifications switch off: `decideVerification` lib/data/verification.ts:253 sets state approved, reviewed_by, clears licence expiry stamps; DB trigger syncs users.verification_status. Audit `verification.approve`. Email to T1 "You are verified on 24Therapy" | badge "approved"; T1 can start sessions and go on the radar | T1 reads the email, leaves /onboarding |
| AD4.3 | S2 | /admin/verifications | same card (already decided) | UPDATE WHERE state submitted matches nothing | "Somebody already reviewed this one." | nobody |
| AD4.4 | S1 | /admin/verifications | note typed, button "Reject" | same action, approve false. Empty note refused "Say what is wrong. They see this word for word." rejection_count + 1 in the UPDATE. Audit `verification.reject` with "[rejection 1]". Email "We need something else from you" with the note | card under Rejected tab, "Note sent to them: ..." | T2 fixes and resubmits |
| AD4.5 | S1 | /admin/verifications | on the resubmitted card the button reads "Reject and clear" and the banner "Turned down once. Rejecting again deletes their documents and they start over." | second rejection: rejection_count reaches REJECTIONS_BEFORE_REAPPLYING (2), `deleteDocument` on all four files, columns nulled, documents_cleared_at set, email body `tmsg.unverified.cleared` | "Turned down 2 times. Documents not kept." T2 cannot resubmit without uploading again | T2 |
| AD4.6 | FA | /admin/settings | rules card, tick "Verifications" under approvals, "Save rules" | `saveRules` settings/actions.ts:558 writes group rules, audits `settings.rules` with a list of changed fields | switch on | S1 and S2 now need each other |
| AD4.7 | S1 then S2 | /admin/verifications | S1 "Approve"; S2 "Approve" on the same card | first press stores proposed_approve, proposed_by (verification.ts:301); badge "recorded: a second reviewer confirms"; audit `verification.propose_approve`. Second different reviewer with the same answer decides | decided only after S2 | T3 waits in onboarding until S2 acts |
| AD4.8 | FA | /admin/therapists | row button "Verify" (reason 10+ chars, "Why? It is audited.") | `verifyUser` admin/actions.ts:80 calls `setVerification` lib/data/admin.ts:149. See bug note in the summary: no four eyes, no email, no documents check | therapist_verifications state approved | T4 is never emailed |

### AD5 Manual transfer queue: a patient session payment

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD5.1 | S1 | /admin/transfers | nav badge "Transfers" (red count), filter chips "All", "Patient", "Therapist", "Clinic", "Company"; row shows payer, "A session", amount, "settles", "waiting N min" (red after 15 min), "Reference they gave", "Proof" | `queue` lib/billing/manual.ts:382 (state submitted, oldest first, search by reference or amount via "Search") | row for P1 visible | P1 is on a spinner on the payment screen for the session, and T1 waits in the room |
| AD5.2 | S1 | /admin/transfers | link "View the evidence" | opens ReceiptModal; the image or PDF is fetched from /admin/transfers/receipt/[id] (route.ts) which audits `transfer.receipt.opened` (or `transfer.receipt.downloaded` via "Download it instead") | audit row per open | nobody |
| AD5.3 | S1 | /admin/transfers (row or modal) | button "Confirm" on the row, or "Approve this payment" in the modal | `confirm` transfers/actions.ts:23 passes the amount and settles the operator saw. `confirmPayment` manual.ts:515 moves submitted to confirmed with decided_at now() WHERE amount and settles still match; `grantFor` manual-grants.ts:47 then `grantSession` claims the session paid and posts the settlement; `noticePaymentConfirmed` emails "Your session is paid for". Audit `transfer.confirm` | shows "Confirmed. They can carry on." Row leaves the queue; badge count drops | P1's spinner turns into the session link; T1 sees the patient join |
| AD5.4 | S2 | /admin/transfers (stale tab) | "Confirm" on the same row | UPDATE matches nothing | "It changed or was decided while you looked. Reload the queue and check the amount again." No second grant, no second ledger post | nobody |
| AD5.5 | S1 | /admin/transfers | "Reject", field "Why. They read this word for word." (placeholder "No transfer found with that reference. Check it and send again."), button "Reject and tell them" (enabled at 10 chars) | `reject` transfers/actions.ts:56 then `rejectPayment` manual.ts:724: state rejected, reject_reason stored, email "We could not match your transfer" with the reason. Audit `transfer.reject` | "Rejected, and they have been told why." | P2 sees the reason on the payment screen and can pay again (a new payment row) |
| AD5.6 | S1 | /admin/transfers | "Confirm" on a payment already rejected | state is rejected, not submitted | error; money does not move | nobody |
| AD5.7 | S1 | /admin/patients | search box "Search" (email, phone or name), row link | `patientAccounts` ilike search, paged | finds P1 | nobody |
| AD5.8 | S1 | /admin/patients/[id] | read only list "Transfers", link "Back" | reads manual_payments for that patient account | shows the confirmed and the rejected payment with the reason | nobody |

### AD6 Money that arrived with no claim, two people (open carts and approvals)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD6.1 | S1 | /admin/transfers | toggle "N opened and never submitted" then "Look" | `openCarts` manual.ts:432, state awaiting_proof, newest first | cart for G1 listed | G1 opened the pay sheet, sent money, never pressed Submit |
| AD6.2 | S1 | /admin/transfers | "I have this in the bank", field "What you saw in the bank. Stays on the payment.", button "Credit without proof" (enabled at 10 chars) | `confirmUnclaimed` transfers/actions.ts:92. With transferWithoutProof on, `secondPersonGate` lib/billing/approvals.ts:27 inserts pending_approvals kind transfer_without_proof with S1 as asker | "Asked. A second person completes it from the list of approvals." Card "Waiting for a second person" shows "Yours. Another admin completes it." to S1 | G1 still waits |
| AD6.3 | S1 | /admin/transfers | "Credit without proof" again on the same cart | gate finds the open request asked by S1 | "You asked for this one. A second person completes it." | nobody |
| AD6.4 | S2 | /admin/transfers | card "Waiting for a second person", row "Transfer with no proof", "Asked by S1 ...", button "Complete" | `completeApproval` approval-actions.ts:14 re-runs `confirmUnclaimed` with S1's reason; `confirmWithoutProof` manual.ts:650 moves the cart to submitted with reject_reason "Received without proof. <reason>", audits `payment.confirmed_without_proof`, then `confirmPayment` and the grant; `closeApproval` sets done | "Credited, and the payer has been told." | G1's session is paid, T1 can start |
| AD6.5 | S2 | /admin/transfers | "Decline" instead of Complete | `declineApproval` approval-actions.ts:38; `closeApproval` refuses the asker (DB check too) ; audit `approval.declined` | "Declined."; S1 pressing Decline gets "Only a second person can decline it." | nobody |
| AD6.6 | S1 | /admin/transfers | on a cart: "Discard" | `discardOpenCart` exception-actions.ts:66 deletes an awaiting_proof row; audit `transfer.cart_discarded` | cart gone; stops locking the bank details | nobody |
| AD6.7 | S1 | /admin/transfers | card "Needs a decision" (kinds "Not applied", "Bought nothing", "Overpaid"), "Retry", field "What you did" and "Done" | `retryException` re-runs the grant only for grant_failed on a confirmed row; `resolveTransferException` needs 10 chars ("Say what you did."). Audits `transfer.grant_retried` or `transfer.grant_retry_failed`, `transfer.exception_resolved` | exception closed with name and note | the payer is emailed only after a successful retry |

### AD7 Company pot: activate, open pot, top-up by transfer, ETA e-invoice

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD7.1 | FA | /admin/sponsors | card for C1's company, "Open", contact, "Best time to call" | `allSponsors`, `reconcilePots`; red banner "A pot disagrees with the ledger. No top-ups until explained." only on drift | company in state held | C1 filled the public enquiry and waits |
| AD7.2 | FA | /admin/sponsors | state button "active" (ConfirmWithReason, 10 chars) | `activate` sponsors/actions.ts:28 then `setSponsorState` lib/data/sponsor-admin.ts:199 sets state, starts verify cycle. Audit `sponsor.active` | state active. No email is sent by this step | C1 is not told by the console |
| AD7.3 | FA | /admin/sponsors | "Billed from" us or eg | `setEntity`, audit `sponsor.entity` | eg entity means ETA invoices and EGP | nobody |
| AD7.4 | FA | /admin/sponsors | "Add a portal user": "Email", "Name", viewer or admin, "Create" | `addPortalUser` creates the sponsor user and emails "Your 24Therapy account" link (7 days). Audit `sponsor.user_created` | C1 can set a password at /welcome/[token] | C1 reads sim_outbox |
| AD7.5 | FA | /admin/sponsors | "Mint a code" or "Rotate code" (reason) | `mintCode`, audit `sponsor.code_rotated`; shows "{count} refused attempts on this code in seven days." | employees enrol with the code | employees of C1 |
| AD7.6 | FA | /admin/sponsors | "Open their pot, with refund and expiry terms agreed.": "Refund and expiry terms", "Unspent money expires", "Overdraft allowed, in whole units", "Welcome credit, in whole units", button "Open the pot" | `openTheirPot` then `openPot` sponsor-admin.ts:325 (terms required, welcome credit capped at maxWelcomeCreditCents 10,000). Audit `sponsor.pot_opened` | "Pot open, with terms." | C1 can now top up |
| AD7.7 | S1 | /admin/transfers | row "Company" · "A pot top-up", "Confirm" | `grantPotTopUp` manual-grants.ts:598: one transaction claims granted_at, credits sponsor_pots net of VAT, journals cash, vat_payable, sponsor_pot; `publishTopUp`; for entity eg `openTopUpInvoice` (ETA). Email "Your payment is confirmed" | pot balance grows by net; ETA document row opened | C1 on the company billing page waits for the credit |
| AD7.8 | S1 | /admin/sponsors/[id] | read only cards "Pot", "Ledger" ("Agrees." or "Out by"), "Refund terms", "Transfers", "Where the pot went", link "Back" | `potTrace`, `potSpendAgrees`, `ledgerPotBalance` | Pot equals Ledger | nobody |
| AD7.9 | FA | /admin/settings | card "Egyptian e-invoices": list of what ETA still needs; issuer fields "Registered name", "Tax registration number" (9 digits), activity code, address, item code, "Save"; list of stuck documents and "Try again" | `saveEgyptIssuer` settings/actions.ts:479 then `advanceEtaDocuments`; `retryEtaDocuments` audits `eta.retry` | documents move from waiting toward submitted and valid, or say what they wait for | the hourly reminders cron also advances them |

### AD8 Money back to a company (pot return)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD8.1 | S1 | /admin/sponsors/[id] | "Return unused money": "Credit ($)", "Pounds to send", "Why" (10 chars), button "Ask" | `askPotReturn` sponsors/actions.ts then `requestPotReturn` lib/billing/pot-return.ts:28 (refused over the pot balance, one open per company). Audit `sponsor.pot_return_asked` | open return row | C1 asked by phone or email |
| AD8.2 | S1 or S2 | /admin/sponsors/[id] | "Bank reference", button "Sent" | `sendAskedReturn` then `sendPotReturn` pot-return.ts:73: row locked FOR UPDATE, pot debited only if it still holds the amount, ledger legs posted, credit note attempted. With potReturns switch on the asker is refused ("A second person sends what the first one asked for.") | history row state sent with reference | C1 sees the pot fall |
| AD8.3 | S1 | /admin/sponsors/[id] | "Cancel" | `cancelAskedReturn` then `cancelPotReturn` pot-return.ts:64 | state cancelled | nobody |

### AD9 Clinician payouts on the manual rail

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD9.1 | S1 | /admin/payouts | card "The books balance" (Cash, Held for clinicians, Out of balance, Unbalanced entries), payout rows | `reconcile`, `manualQueue` lib/billing/payouts.ts:1044 (requested, approved, sent; overdue after alertAfterHours) | T1's request listed | T1 requested a withdrawal on the earnings page |
| AD9.2 | S1 | /admin/payouts | "Take it on" | `takeOn` then `claimPayout` payouts.ts:993; refuses the payee and the last editor; audit `payout.claimed` | owner_user_id S1 | nobody |
| AD9.3 | S2 | /admin/payouts | "Approve" | `approvePayout` payouts.ts:452: four eyes (payee, editor, and above $500 a different owner when the payouts switch is on), 24 h cooldown after someone other than the clinician edited the details, and "We hold ... for them now, less than this request" check. Audit `payout.approved` | status approved | nobody |
| AD9.4 | S1 | /admin/payouts | "Bank reference or receipt link" (6 to 40 chars with 4+ digits, or https link), "Mark sent" | `markSent` then `markPayoutSent` payouts.ts:531 then `recordSent`: guarded move approved to sent with the ledger post in the same transaction; notify T1 "Your withdrawal is on its way". Approver may not send while the payouts switch is on ("You approved this one. A second person sends it.") | status sent, ledger debit once | T1 gets email and WhatsApp if configured |
| AD9.5 | S1 | /admin/payouts | "Confirm arrival" | `confirmPayout` payouts.ts:828 sent to confirmed | status confirmed | T1 may also confirm from their side |
| AD9.6 | S1 | /admin/payouts | on a sent row: "Reason the clinician reads", "Did not arrive" | `didNotArrive` then `markPayoutReturned` payouts.ts:860 (5 chars), reverses the ledger inside the move, notifies "Your withdrawal did not arrive" | status returned, balance back to T1 | T1 |
| AD9.7 | S1 | /admin/payouts | on requested or approved: reason, "Reject" | `rejectPayout` payouts.ts:930 (5 chars), refused while a provider is sending; notifies "We could not process your withdrawal" with the reason as body | status rejected | T1 may ask again |
| AD9.8 | S1 | /admin/payouts | "Send via provider" (only when a payouts provider is configured) | `sendViaProvider` payouts.ts:659 | badge "Provider sending" or "Provider failed" | on production likely hidden; see not testable |

### AD10 Refunds, including split (company plus employee) refunds

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD10.1 | FA | /admin/vault | "Patient payments" row icon "Refund this payment", field "Reason for the refund" (placeholder "Clinician never joined the room"), button "Refund $X" | `refundPatient` admin/actions.ts:565 then `refundSessionPayment` lib/billing/connect.ts:1136. Paid only. Pot funded: `refundSplit` returns the company share to the pot (`refundToPot`), then queues the employee share (rail queue). Card gateway: `refundThroughGateway`, else queued. Manual rail: `openRefundRequest` lib/billing/refunds.ts:106 with amount = what that payer paid minus wallet part. Audit `payment.refund` | refund_requests row status owed, or payment refunded at once for wallet only or gateway | P1 waits for the money; for a pot session C1 sees the pot credited back |
| AD10.2 | S1 | /admin/payouts | card "Refunds owed · N", "Take on" | `takeOnRefund` then `claimRefund` refunds.ts:255; audit `refund.claimed` | owner set | nobody |
| AD10.3 | S1 | /admin/payouts | "Method", "Account", "Account name", "Save destination" | `markRefundSentAction` then `markRefundSent` refunds.ts:268. With refunds switch on: saves payee_* with payee_set_by S1 and returns "Saved. A second person sends it."; audit `refund.destination_saved` | destination recorded, nothing sent | P1's details came from support |
| AD10.4 | S2 | /admin/payouts | "Receipt", "Mark sent" | same function: ceiling check "More than they paid.", four eyes against the opener and threshold, company share back first for pot rows, then one transaction: owed to sent, session_payments paid to refunded, reversal posted, session payment_status pending; wallet part returned after. Audit `refund.sent` | status sent. S1 pressing it gets "Needs a second person." | P1 |
| AD10.5 | S2 | /admin/payouts | "Arrived" | `confirmRefundAction` sent to confirmed | confirmed | nobody |
| AD10.6 | S1 then S2 | /admin/payouts | "Reason", "Ask to cancel"; then S2 "Cancel it" | `cancelRefund` refunds.ts:513: first press stores the ask ("Asked. A second person cancels it."), second person cancels. With refunds switch off one press cancels | cancelled with both names | nobody |
| AD10.7 | S1 | /admin/payouts | on a "Company share" row: "Return to pot" | `returnPotShareAction` then `returnPotShare` refunds.ts:192: retries `refundToPot`, closes the row confirmed, then finishes the rest of the refund. Errors "Company share not returned." or "Company share returned. The patient's part did not go; check the payment." | pot credited once | C1 |

### AD11 Vault: discounts, credits, ledger adjustments, held earnings

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD11.1 | FA | /admin/vault | invoice row icon "Discount this invoice", "Discount in dollars", "Reason", button "Discount this invoice" | `applyInvoiceDiscount` then `discountInvoice` lib/billing/service.ts (paid refused, discount capped at the amount, full discount sets waived). Audit `invoice.discount` | invoice payable lower or waived | T1 sees the bill change |
| AD11.2 | FA | /admin/vault | same panel, "Credit their next renewal" | `applyUpcomingDiscount`, audit `subscription.upcoming_discount` | credit on the organisation's next renewal | T1 |
| AD11.3 | FA | /admin/vault | "Adjust the books": "Organisation", "Account", "Clinician", "Amount ($)", "Reason", "Post the adjustment" | `adjustLedger` admin/actions.ts:638. With ledgerAdjustments on: pending_approvals row; shows "Asked. A second admin posts it." Card "Waiting for a second person" row "Ledger adjustment" with "Complete" and "Decline", both requireRole super_admin | nothing posted until a different super_admin completes | nobody can complete it: see edge AE21 |
| AD11.4 | FA | /admin/vault | held balances, "Release now" (reason) | `releaseTherapistEarnings` then `releaseHeldEarnings` (Stripe Connect). Audit `earnings.release` | "Released $X" or Stripe's reason | T1 |

### AD12 Clinic and partner applications

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD12.1 | FA | /admin/clinics | card "Open", state buttons held, active, suspended, closed (ConfirmWithReason) | `setState` clinics/actions.ts then `setClinicState` lib/data/clinic-admin.ts:136 (solo practices refused). Audit `clinic.active` | organizations.clinic_state active. No email | K1 applied from the public clinic page and waits |
| AD12.2 | FA | /admin/clinics | region select | `setRegion`, audit `clinic.region` | entity set | nobody |
| AD12.3 | FA | /admin/clinics | "Add a portal user": "Email address", "Name", role, "Create" | `addManager` creates the clinic manager, emails the invite link. Audit `clinic.manager_created` | K1 can set a password | K1 reads sim_outbox |
| AD12.4 | FA | /admin/partners | state buttons (ConfirmWithReason) | `setState` partners/actions.ts, audit `partner.<state>` | active partners may hold keys | R1 |
| AD12.5 | FA | /admin/partners | "Approve for production" | `approveProduction` then `approveForProduction` lib/data/partner-admin.ts:273 (refuses without documents). Audit `partner.approved_for_production` | "Approved for production <date>" | R1 can mint live keys |
| AD12.6 | FA | /admin/partners | "Withdraw approval" (reason) | `withdrawProduction`, audit `partner.approval_withdrawn` | no new live keys; existing keys untouched | R1 |
| AD12.7 | FA | /admin/partners | "Add a portal user", "Developer, reads only" or "Admin, may mint keys", "Create" | `addUser`, invite link email, audit `partner.user_created` | R1 account exists | R1 |

### AD13 Paused benefits

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD13.1 | FA | /admin/benefits | list "Paused benefits", button "Lift the pause" (reason) | `liftPause` benefits/actions.ts then `unpause`. Audit `benefit.pause_lifted` | employee's company funding restarts | employee of C1 who ignored the re-verification |

### AD14 Settings changes (all audited)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD14.1 | FA | /admin/settings | pricing tiers "Monthly ($, 0 = pay as you go)", "AI rate ($ per consented session)", "Unlocked by spending ($)", "Credits last (months)", "Save" | `savePricing` settings/actions.ts:34, audit `settings.pricing` | "Saved. Every page reading these figures changes on its next request." | clinicians see new prices on /pricing |
| AD14.2 | FA | /admin/settings | "Platform fee ($ per session)", "Our cut (%)", "Lowest price ($)", "Highest price ($)", "Save" | `saveSession`:132, audit `settings.session` | fee cannot be zero | nobody |
| AD14.3 | FA | /admin/settings | copilot allowances, "Save" | `saveCopilot`:179, audit `settings.copilot` | whole numbers only | nobody |
| AD14.4 | FA | /admin/settings | "Collection provider", "Payout methods", "Two people above ($)", "Alert after (hours)", "Pounds to the dollar, checked daily", "EGP conversion charge (%)", "Save" | `savePayouts`:209, re-derives EGP rates, audit `settings.payouts` with a list of changes | new threshold used by AD9 and AD10 | nobody |
| AD14.5 | FA | /admin/settings | rules card: approvals ticks "Payouts", "Refunds", "Company returns", "Verifications", "Transfer without proof", "Ledger adjustment", "Payout details wait (hours)", links, cancellation window, wallet, "Save rules" | `saveRules`:558, audit `settings.rules` reason lists each changed field; history table under the card | "Saved. N changed from now on; nothing already charged is rewritten." or "Nothing changed." | every queue re-reads the switch on the next press |
| AD14.6 | FA | /admin/settings | transfer details fields, "Tell them card payments are coming", "Save" | `saveTransferFields`:400 refused while any payment is awaiting_proof or submitted ("N payments are in flight against these details...") | audit `settings.transferFields` | payers see new bank details |
| AD14.7 | FA | /admin/settings | country card fields incl. "As the reader sees it", "What tel: dials" (crisis line), "Save EG" | `saveCountry`:294, audit `settings.country` | crisis line set; red card "no crisis line" disappears | patients in crisis see the number |
| AD14.8 | FA | /admin/settings | "Send them to" (use an @example.com address), "Send them all" | `sendEveryTemplate` admin/actions.ts:1107, audit `email.previewAll`, 14 preview emails paced 150 ms | all 14 in sim_outbox | nobody |
| AD14.9 | FA | /admin/settings | video check card | `videoHealth` read only, "Working." or "Not working." | nobody | nobody |

### AD15 Radar reports, bans and the transcript break glass

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD15.1 | FA | /admin/radar | live board (polls /api/admin/radar), stats "Online", "Being booked", "In session", filters "Name, email, city, practice" | `radarCommandView` | T1 visible | T1 is on the radar |
| AD15.2 | FA | /admin/radar | "Ban", "Reason. They see this", "24h", "3 days", "Until released" | `setRadarSuspension` admin/actions.ts:903 (10 chars), audit `radar.suspend`, email "You have been taken off the Crisis Radar" | T1 off the board for the period | T1 |
| AD15.3 | FA | /admin/radar | "Release" | same action hours 0, audit `radar.release` | T1 can go online | T1 |
| AD15.4 | FA | /admin/radar | power icon "Take them off the board now, without a ban" (reason) | `forceRadarOffline` then `forceOffline` cancels a booking in flight and tells the patient. Audit `radar.force_offline` | T1 offline | a patient mid booking is told |
| AD15.5 | FA | /admin/radar | profile "Headline", "Country code", region, city, "Save" | `editRadarProfile`, audit `radar.edit_profile` | "Saved." | T1 can change it back |
| AD15.6 | FA | /admin/radar | "Reports" tabs "open", "actioned", "dismissed"; link "Open the session record" | goes to /admin/radar/investigate/[id] | nobody | P1 filed a report after the session |
| AD15.7 | FA | /admin/radar/investigate/[id] | "You are reading a therapy transcript", field "Why? It is audited." (10 chars), "Continue" | reason in the query string `?why=`; each render audits `break_glass.investigate` category phi_access | transcript and recording gaps shown | nobody |
| AD15.8 | FA | /admin/radar | "What you decided, and why", "Actioned" or "No action needed" | `resolveReport` admin/actions.ts:1038 (4 chars), audit `report.actioned` or `report.dismissed` | report closed with FA's name | nobody |
| AD15.9 | FA | /admin/ratings | read only "Ratings", Therapists, 24Therapy, "Rated sessions" | `allRatings` | nobody | nobody |

### AD16 Clinician accounts from the owner's side

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD16.1 | FA | /admin/therapists | "Verify", "Suspend" or "Reinstate" (reason) | `verifyUser` (see AD4 step 8), `suspendUser` then `setUserStatus`; audits `user.suspend` or `user.reinstate` | suspended users cannot sign in ("This account has been suspended.") | T1 |
| AD16.2 | FA | /admin/therapists/[id] | page open | writes a break_glass audit row on every visit, shows identifiers only ("You cannot read clinical content here.") | audit row | nobody |
| AD16.3 | FA | /admin/therapists/[id] | "Send their record" with "Why this record is being sent" (8 chars), "Send" | `emailPatientRecordToPatient`: export link valid 72 h emailed to the patient, audit `patient.export_sent` | patient gets the link | P1; the clinician is told |
| AD16.4 | FA | /admin/therapists/[id] | invoice: "Reason (goes in the audit log)", "Discount ($)", rename "Save", "Void" | `applyInvoiceDiscount`, `editInvoice` admin/actions.ts:462 (paid cannot be re-priced or voided), ledger adjustment posted for due invoices | audit `invoice.edit` | T1 |
| AD16.5 | FA | /admin/therapists/[id] | "Email T1", subject, body, "Send email" | `emailTherapist`, audit `email.therapist` | "Sent" | T1 |

### AD17 Support and number change queues (staff)

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD17.1 | S1 | /admin/support | two queues (patient, therapist); "Read what they wrote"; "Take it on" | `openTicket` (readTicket), `takeTicket` then `claimTicket` (only if nobody owns it: "Somebody else has already taken that one."). Audit `ticket.claimed` | owner S1 | P1 filed a ticket at /support |
| AD17.2 | S1 | /admin/support | "What did you ask them?" then "Waiting on them"; "Why another day?" then "Extend once"; "Moved to WhatsApp" | `waitOnThem`, `extend` (due_at + 24 h, once), `moveToWhatsapp`. Audits `ticket.waiting`, `ticket.extended`, `ticket.moved_to_whatsapp` | due dates move | P1 |
| AD17.3 | S1 | /admin/support | "What was done. They read it signed in, never in email." then "Reply"; or summary (and "What was agreed on WhatsApp") then "Close and send the link" | `reply`, `close` then `closeTicket` sends a link and code, reply stays on site. Audit `ticket.replied`, `ticket.closed` | "Closed. They have a link and a code, the reply itself stays here." | P1 reads via the link |
| AD17.4 | S1 | /admin/numbers | "How did you check?", "Approve" | `approve` then `approveChange` (note required). Audit `phone_change.approved` | "Approved. Send the code when you are ready." | P1 asked to change phone |
| AD17.5 | S1 | /admin/numbers | "Send the code to the new number" | `sendCode`, code valid 24 h. Audit `phone_change.code_sent` | "Code sent to the new number. It lasts 24 hours." | P1 types the code on their side |
| AD17.6 | S1 | /admin/numbers | "Why not. They read this", "Refuse" | `refuse`, audit `phone_change.refused` | request closed | P1 |

### AD18 Announcements, content, strings, radar lists, check-ins

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD18.1 | FA | /admin/announce | "Subject", "Message", "Type N to confirm", "Send to N clinicians" | `announceToAllTherapists` admin/actions.ts:265, audit `email.announcement`, sends sequentially after the response to every active clinician | "Sending to N clinicians", "Write another" | every clinician, real ones included: see not testable |
| AD18.2 | FA | /admin/content then /admin/content/[id] | page list, "Edit"; editor fields "Page title", "Meta description", blocks; "Save draft", "Publish" | `savePage` admin/actions.ts:111: sanitised blocks, honesty check refuses forbidden claims, draft kept beside the live page, `revalidateTag`. Audit `content.save` | "Saved as draft" or "Published, live now" | public visitors |
| AD18.3 | FA | /admin/strings | locale links, "Save draft", "Publish" (or "Publish this safety string"), "Save language" | `saveOne`, `publishOne`, `clearOne`, `machineTranslate`, `approve`, `saveLocale` (lib/i18n/authoring.ts) | drafts invisible until published | readers of that language |
| AD18.4 | FA | /admin/taxonomy | per row "Off"/"On"/"Delete" with reason; "Add" | `setTaxonomyState`, `addTaxonomy`, `removeTaxonomy`; closing a country takes its clinicians off the radar | audit `taxonomy.*` | clinicians in that country |
| AD18.5 | FA | /admin/checkins | "Sending", "Hours between", "Quiet from (hour)", "Quiet until (hour)", "Halt above (%)", "Save"; "Resume" (reason) when halted | `saveCheckins` (audit `settings.checkins`), `resumeCheckins` resets measured_since (audit `checkins.resumed`) | mute rate card recalculated | patients receiving check-ins |

### AD19 Observation pages and the scheduled jobs panel

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD19.1 | FA | /admin/errors | card "Scheduled jobs": each job name, last clean run or "Never", amber badge with failed steps, red "Overdue"; "Alerts this week"; error groups with "Stack", "Search" | `jobHealth` lib/observability/heartbeat.ts:273 from cron_heartbeats; overdue when last success is older than 2 x interval (crisis and reminders 1 h, billing, retention, extract 24 h, any other job 24 h) | after each hand fired cron the job shows a fresh time | lead agent fires /api/cron/<job> |
| AD19.2 | FA | /admin/usage, /admin/usage/sessions | read only; link to sessions, "?therapist=" filter | `sessionCosts` etc. | nobody | nobody |
| AD19.3 | FA | /admin/tv | gate "Total View": "First key", "Second key", "Open"; "Set the keys" with "Value" | `submitKeys` unlocks for 20 minutes (auth_sessions.elevated_until); `configureKey` | board with Refresh buttons; person search; "Email their record to them", "Send" (need "Reason and authority") | the two keys must be known to FA |
| AD19.4 | FA | /admin/financial-model | sliders, "Save as", "Save", "Measure" | `saveScenarioAction` (audit `finance.scenario.save`), `takeBenchmarkAction` (audit `finance.benchmark.take`) | new scenario or benchmark | nobody |
| AD19.5 | FA | /admin/actuals | payroll "Add", "Save", "Return", "They left"; bank "Add", "Record it", "Remove", "Save" | `addEmployeeAction`, `setSalaryAction`, `endEmploymentAction`, `addCapitalAction`, `removeCapitalAction` (reason), `setOtherCostAction` | position card updates | nobody |
| AD19.6 | FA (TV gate open) | `/admin/tv` | Open a live or timeline session, type a reason (10+ chars), open | `openSession` then `readSession` (`lib/console/reads.ts`): reason under 10 chars returns `reason` and reads nothing; otherwise writes audit `phi_access` `console.read.session` with the reason, then returns note, transcript (up to 2000 lines) and risk rows | Transcript shown; one audit row per open under /admin/audit "phi access" | none |
| AD19.7 | FA (TV gate open) | `/admin/tv` person search | Search by email or name, open a person with a reason | `peopleByEmail` groups patient rows by email; `openPerson` then `readPerson` writes one phi_access audit row `console.read.person` per patient row, then returns every copilot message and session across clinicians | Conversation and sessions shown; audit rows equal the number of charts | none |
| AD19.8 | FA (TV gate open) | `/admin/tv` clinician card | "Send to" email, "Reason and authority" (20+ chars), send | `mailClinicianHistory` then `buildClinicianHistory` (`lib/console/history.ts`): CSV of up to 5000 sessions with patient name, patient email, price, consent and note status; `sendClinicianHistory` to the address with a copy to FA; audit `console.export.clinician`; in-app notification to the clinician "Your practice record was disclosed" (English only) | Outbox: CSV mail at the `@example.com` address and the copy; T1 sees the notification on /notifications | T1 is told |

### AD20 /dev pages

| step | actor | route | exact control | what the code does | what must be true after | who else acts or waits |
|---|---|---|---|---|---|---|
| AD20.1 | any | /dev/gateway/[ref] | "Pay" / "Decline" (sim.pay, sim.decline) | only when `simulatorOn("gateway")` (app/dev/simulator.ts) which is false when env.liveDeployment; otherwise 404 | on 24therapy.app it must 404 | nobody |
| AD20.2 | any | /dev/payouts | "Arrived" / "Failed" per sending payout; linked as "Simulator" from /admin/payouts only when on | calls the payouts callback with a fake signature | on 24therapy.app it must 404 | nobody |

---

# F · Partner developers

| step | actor | route | exact control | what the code does | what must be true after |
|---|---|---|---|---|---|
| PT1 | Prospect | /partner/apply | form fields name, contactName, contactEmail, contactPhone, intent; submit | `apply` (5 per hour per caller) -> `applyToPartner` inserts partners state held | partners row held; nobody is told (no notify in applyToPartner) |
| PT2 | super_admin | /admin/partners | set state active with a reason; "Add user" email + role | `setState`, `addUser` -> `createPartnerUser`, `emailAccountLink` (English link) | partner active; partner_users row with no password; link in sim_outbox |
| PT3 | Partner admin | account link, then /partner/sign-in | email, password (>= 12 chars) | `checkPartnerPassword` refuses a held or suspended partner with the same generic message; 8 attempts per 15 minutes | partner_auth_sessions row; /partner shows keys |
| PT4 | Partner admin | /partner | "Create key": label, scopes (checkboxes), environment sandbox | `createKey` -> `mintKey`; raw key shown once, prefix 24t_sk_test_ | partner_api_keys row with sha256 hash |
| PT5 | Partner admin | /partner | environment live | `mintKey` refuses unless partners.approved_at | Error "not approved for production yet" |
| PT6 | super_admin | /admin/partners | "Approve for production" | `approveForProduction` requires documents_url, contact name and phone | Always refused: nothing in the product writes partners.documents_url (ME50), so no live key can be minted without SQL |
| PT7 | Partner server | POST /api/partner/v1/consent (scope consent:write) | JSON session, subject, state given/withdrawn, answered_at, offset_seconds | IP bucket 240 per minute then key bucket 60 per minute; `recordConsent`, `openSession` (sandbox never billable; live checks the monthly limit), withdrawn purges material | 200 with recording_from_seconds and coverage; partner_sessions row; partner_subjects row for live |
| PT8 | Partner server | POST /api/partner/v1/sessions/<ref>/media (session:media) | audio/* body up to 25 MB, X-Audio-Start-Seconds | `mayAnswer` (404 unknown ref, 409 stopped, 403 no consent), 415 for video, 413 over size, `mayBillFirstAudio`, ingest, `billFirstAudio` on the first transcribed audio (live only) | accepted_bytes, transcript_ready; a live session becomes billable once |
| PT9 | Partner server | GET /api/partner/v1/sessions/<ref>/transcript (transcript:read); GET and POST .../note (note:review); GET and POST .../summary (summary:deliver); POST .../end (session:media) | JSON per route | Read or act on the partner session; end stamps ended_at once | Media after end is 409 |
| PT10 | Partner server | POST and PUT /api/partner/v1/copilot (copilot:chat); GET /subjects/<ref>/memory (memory:read) | JSON | Copilot and memory over the partner session | - |
| PT11 | Partner server | GET /api/partner/v1/subjects/<ref>/readers (record:read) | none | `whoMayRead`: live key only (403 "Use your live key"), clinicians of this partner with a granted history | Emails of permitted clinicians |
| PT12 | Partner server | POST /api/partner/v1/sessions (session:write) | subject, clinician, started_at, duration_minutes, meeting_id | `writeBackSession`: live key only, clinician must be of this partner and verified, idempotent on meeting_id | 201 with our session id; a completed free session in our record |
| PT12b | Partner server then patient phone | POST /api/partner/v1/subjects/<ref>/link (live key, session:write), then the patient opens /patient/link/[token] | the subject's reference | Board 932: the patient signs in and confirms; the person comes from the patient's own session, and only an empty, unrevoked subject can be filled, so a partner never names a person | The subject is linked; PT12 write-back for that subject answers 201 |
| PT13 | Partner server | GET /api/partner/v1/notes/<sessionId> (note:deliver) | none | `deliverableNote`: live only, approved note only | 200 note or 404 |
| PT14 | Partner server then clinician browser | POST /api/partner/v1/launch (record:read) then GET /api/partner/launch?token= | clinician email, target | Token single use, 120 seconds; redeem limited 20 per minute per caller | Redirect into the product, or /login?launch=expired |
| PT15 | Partner admin | /partner/webhooks | URL (https, public), events checkboxes; "Send test"; "Redeliver"; "Disable" | `registerWebhook` refuses http, private addresses, or missing WEBHOOK secret config; secret shown once | Deliveries appear on /partner/deliveries; hourly drain |
| PT16 | Partner admin | /partner/usage | monthly session limit number | `saveLimit` -> `setLimit` resets alerts; usage and projected shown; last month's bill (`closedMonthBill`) | At the limit a new live session returns stopped_reason and media is 409 |
| PT17 | Partner admin | /partner/team | invite email, name, role; remove | `inviteColleague` (sendPartnerInvite, 7 day link), `removeColleague` keeps at least one admin | Colleague row; removed user's sessions revoked |
| PT18 | Partner admin | /partner/sign-in, /partner/forgot, /partner/reset | email; token + password | `requestReset` always answers sent; 1 hour signed token; a used token dies because it signs the old password hash | Password set, all partner sessions revoked |
| PT19 | Partner admin | /partner | Revoke; Rotate with overlap 0, 24h or 7 days | `revokeKey`, `rotateKey` | Revoked key 401 at once; rotated key works until revoked_at |
| PT20 | Company HR system | POST /api/hr/v1/employment (employment:verify, sponsor-owned key) | identifier | 240 per minute per IP; a sponsor key over 60 per minute is SUSPENDED (not throttled) | active and as_of |
| PT21 | Partner admin or developer | any `/partner/*` page | Header button "Sign out" (`dev.signOut`) | `signOutPartner` form in `components/partner/chrome.tsx` | Back at `/partner/sign-in`; tabs gone; any `/partner` URL bounces to sign in |

---

# G · The public website

| step | actor | route | exact control | what the code does | what must be true after |
|---|---|---|---|---|---|
| WB1 | Visitor | / | none | CMS page "home" (static, revalidate false) with a live radar count (`radarCount`) | Count equals the /radar list size |
| WB2 | Visitor | /for-therapists, /for-clinics, /for-companies | links "Apply", "Contact", "Integrations" | Static marketing; /for-companies links /sponsor/apply and /contact | Links resolve |
| WB3 | Visitor | /pricing (CMS slug via app/(public)/[slug]) | none | `pricing` block reads platform_settings tiers at render; the page is cached and revalidated by the admin settings save (`revalidatePath("/pricing")`) and POST /api/revalidate (Bearer CRON_SECRET) | Figures equal settings.pricing; FAQ says first session free (matches the trial claim in chargeForSession) |
| WB4 | Visitor | /features, /for-patients, /contact, /privacy, /terms, /hipaa, /security | none | CMS pages | 200 |
| WB5 | Visitor | /contact | name, email or phone, country, topic, message, entity, optional attachment; hidden "website" honeypot | `submitContact` -> `fileTicket`; honeypot answers "RECEIVED" silently | support_tickets row with a reference and due hours |
| WB6 | Visitor | /t/[id] | public profile | `publicProfile`; 404 for an unknown or unverified clinician | Profile and open hours |
| WB7 | Visitor | /t/[id] "Book" | slot, name, email or phone (+country), note, timezone, place online/in person | Limits: 6 per hour per caller, 12 per hour per slot, 40 per hour per clinician; `holdSlot`, `bookSlot` (pot and wallet applied inside the booking path), booking.confirmed | Slot booked; patient message in the outbox; pay page if price > 0 |
| WB8 | Visitor | /radar | therapist card, name, email; "Book now" | 60 reads per minute (1000 global); `bookFromRadar`: 6 per 15 minutes per caller, 3 claims per clinician, global ceiling; creates a radar session, claims the clinician, cancels the caller's previous unpaid radar hold, creates the room; signed-in patients get pot then wallet | Join URL; clinician pending for 10 minutes |
| WB9 | Visitor | /radar "Email me directions" | email | 5 per 10 minutes; sendWalkInDirections | Outbox row |
| WB10 | Patient | /pay/[token] | country select; "Pay" (Stripe), "Pay by card" (Paymob), transfer reference + proof, "Use my benefit" | MO1, MO2, MO3, MO4, MO6 | Stage banner; money per MO rows |
| WB11 | Patient | /join/[token] | name, consent, rate on arrival, report | 5 second poll, consent, abandoned check, pot and wallet on join | Room |
| WB12 | Patient | /feedback/[token] | stars, report no_show/abuse/other | `rateSession`, `reportSession` (a no-show report can refund) | session_feedback row |
| WB13 | Visitor | /verify, /verify/[code] | code | Public licence check | Result page |
| WB14 | Visitor | /developers, /integrations, /integrations/[slug] | none | Static API documentation; the flow it lists matches PT7 to PT13; it says "No record read by a key" while record:read returns clinician emails | Links resolve |
| WB15 | Employee | /j/[code] | company code + identifier | `connectToTherapist` 10 per 15 minutes | Enrolment started |
| WB16 | New account holder | /welcome/[token] | password | 10 per 15 minutes | Password set |
| WB17 | Ticket owner | /support/[token] | access code | `openTicket` | Reply shown |
| WB18 | Patient | /records/[token], /records/[token]/data.json | none | Export download while the data_exports link lives | File or expired |
| WB19 | Staff | /design | internal | Not part of the public site | Not tested |
| WB20 | Visitor | `/sitemap.xml` | none | `app/sitemap.ts`: `/`, `/radar` and each published CMS slug except `home`, once per locale via `localisedPath`, each with the same `alternates` block the page declares; revalidate 3600 | Every listed URL returns 200; no `/join`, `/patient`, `/t/` or admin URL; an unpublished page drops out within an hour |
| WB21 | Visitor | `/robots.txt` | none | `app/robots.ts`: while `SIMULATION_RUNNING`, one rule `Disallow: /` and no sitemap line | During the month the file disallows everything; after the run it lists the disallow set and the sitemap URL |
| WB22 | Visitor | `/manifest.webmanifest` | none | `app/manifest.ts` | name 24Therapy, start_url `/patient`, display standalone, icons `/icon.png` and `/apple-icon.png` resolve |
| WB23 | Visitor | any public page, English and `/ar/...` | view source | `app/(public)/layout.tsx` `generateMetadata` adds `alternatesFor(x-pathname)`; site header and footer; `MoneyDisplayProvider primary="USD"` | `<link rel="alternate" hreflang=...>` for both languages on every public page; prices lead in USD here while signed-in screens lead in EGP |
| WB24 | Visitor | any unmatched URL, e.g. `/pay`, `/nothing-here` | none | `app/not-found.tsx` | 404 with "nf.title", "nf.body", button "nf.back" to `/`, SOS orb, in the reader's language |
| WB25 | Visitor | `/login`, `/signup`, `/patient/login`, `/patient/signup`, `/clinic/sign-in`, `/sponsor/sign-in` | "nav.whichAreYou" switcher; flip link "nav.createOne" / "nav.signIn"; "nav.notYou" line | `AuthShell` with `doors(t, kind)` and `otherWay` (`lib/auth/doors.ts`): signup doors are `/signup`, `/patient/signup`, `/sponsor/apply`, `/clinic/apply` | The current door is not a link (`aria-current="page"`); each other door and the flip link land on the matching page; staff and partner doors are never offered |
| WB26 | Visitor | `/`, `/for-therapists`, `/features` | Session demo "Play" / "Pause" / "End session" / "Replay"; transcript demo "go off record"; note demo "Approve" / "Back to draft"; risk demo dismiss and "Raise again"; copilot chips and citation chips | `SessionDemo`, `TranscriptDemo`, `NoteDemo`, `RiskDemo`, `SessionCopilot` (client only, nothing sent) | Every control works with no network request; with reduced motion the full transcript and note show at once; the labels follow the page language except the items in Bugs |
| WB27 | Visitor | `/` and `/for-patients` (patient-app block) | phone mockup tabs Home / Sessions / radar / Therapists / You; pick a radar card or map dot; "Talk now"; "See it" | `PatientApp` (`components/demo/patient-app.tsx`) with `RADAR_DEMO` and `PATIENT_BILLS` fixtures; books nothing | After "Talk now" the Sessions tab shows the booked card at the top; no request leaves the page |
| WB28 | Visitor | `/for-patients` (walkthrough blocks) | Claim and consent walkthrough: step rail, "dfl.back", "dfl.next", "dfl.restart", the in-phone buttons | `ClaimFlowDemo`, `ConsentFlowDemo` (`components/demo/flow-demo.tsx`) | Each rail step is reachable directly; the code step only enables "Check the code" after the six digits are tapped in order |
| WB29 | Visitor | `/for-clinics`, `/for-companies` | console mockup side tabs | `ClinicConsole`, `CompanyConsole` (`components/demo/portal-demo.tsx`) inside `DeviceFrame as="browser"` | Tabs switch; no per-clinician session count and no named session attendance appear |
| WB30 | Visitor | `/pricing`, `/t/<id>` | click a dotted price; hover or focus it | `PriceTag` (`components/money/price-tag.tsx`): starts in the page's primary currency, click toggles, hover shows the other figure in a tooltip; with no operator rate only USD and no button | Clicking flips USD and EGP; the EGP figure equals USD x the operator rate |
| WB31 | Visitor | any public page | Header "Sign in" menu (sm and wider) or the menu button sheet on a phone: "Which one are you?" with four doors and one line each | `SignInMenu` / `MobileNav` from `doors(t, "signin")` (`lib/auth/doors.ts`): `/login`, `/patient/login`, `/sponsor/sign-in`, `/clinic/sign-in`; Escape closes | Each door opens its sign-in page; no link to `/staff/sign-in` or `/partner/sign-in` anywhere in header or footer |
| WB32 | Visitor | `/` (home, when its hero is the radar) | Live board beside the globe: filter chips, therapist cards; "Full radar" to /radar; card tap | `RadarHero` polls `/api/radar` every 4 s (not cached with the page), shows "{count} online", "From {price}" of the cheapest bookable; a card opens `BookingSheet` on the home page itself | Booking from the home page behaves like WB8; the count updates within 4 s of T1 going online or offline |
| WB33 | Visitor (no locale cookie) | `/ar/pricing`, `/ar/for-companies`, `/ar/t/<T1>` | none | `middleware.ts:175-190` strips the prefix, deletes any client `x-locale` header and sets it from the path; `getLocale` (lib/i18n/server.ts:40) takes the URL first; `alternatesFor` (lib/i18n/paths.ts:144) writes canonical and hreflang | Arabic, `dir="rtl"`; `<link rel="canonical">` is the `/ar/...` URL; hreflang lists `x-default`, `en`, `ar`; no locale cookie is set, so `/pricing` afterwards is English | none |
| WB34 | Visitor or signed-in patient | `/ar/patient/journal`, `/ar/sessions`, `/en/pricing` | none | `middleware.ts:59-76`: a prefixed private path redirects to the unprefixed path and sets the locale cookie to `ar` for a year; `/en/...` redirects to the unprefixed path | `/ar/patient/journal` lands on `/patient/journal` (or login) in Arabic and later unprefixed pages stay Arabic; `/en/pricing` lands on `/pricing` | none |
| WB35 | Visitor, fresh browser with `Accept-Language: ar-EG` | `/` then `/pricing` | none | `getLocale` falls to the Accept-Language test (lib/i18n/server.ts:70-74) when there is no prefix and no cookie | Pages render in Arabic with no cookie written; choosing "English" in the corner switch then wins over the header | none |

---
