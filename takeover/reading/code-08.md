# Slice 08: app-other (patient, clinic, sponsor, partner, auth, public incl. /design, root files)

Per-page redesign fields used below: **Screen** (what it is for), **Next** (what a person does next), **Empty** (empty state), **RTL** (Arabic/RTL handling), **Promise**.

## Files

### app/(auth)/forgot-password/page.tsx (23 lines)
- For: clinician password reset request, inside `AuthShell who="therapist" kind="signin"`.
- Decides: nothing; renders `ForgotPasswordForm` (components/auth/forms).
- Assumes: `AuthShell` chrome, `tauth.*` and `auth.therapist.*` dictionary keys.
- Promises: none.
- Notes: Screen: request a reset email. Next: check email. Empty: n/a. RTL: all copy through `t()`; `metadata.title` "Reset password" is English only. Only for clinicians (patient has its own at /patient/forgot-password).

### app/(auth)/layout.tsx (21 lines)
- For: pass-through layout (returns children). Comment (task 154) explains chrome moved to `components/auth/auth-shell.tsx` and the language switch moved into the site header the shell renders.
- Decides: nothing.
- Assumes: every (auth) page renders `AuthShell` or `QuietAuthShell` itself.
- Promises: none.
- Notes: RTL: html dir is set in root layout, not here.

### app/(auth)/login/page.tsx (55 lines)
- For: clinician sign in at `/login`.
- Decides: notice text from `?reset`, `?changed`, `?expired` (lines 11 to 32); passes `next` to `SignInForm`.
- Assumes: `/session-expired` has already revoked the session (comment line 14); `SignInForm` validates `next`.
- Promises: none directly (the entry for T1..T5 testers).
- Notes: Screen: sign in. Next: `/forgot-password` link. RTL: the three `NOTICES` strings (lines 12 to 17) are hardcoded English, shown to an Arabic reader untranslated. `next` open-redirect handling lives in `SignInForm` / action, not visible here.

### app/(auth)/reset-password/page.tsx (49 lines)
- For: set a new password from an emailed token.
- Decides: no token, show "Link not valid" plus "Request a new link" (lines 20 to 35); else `ResetPasswordForm token`.
- Assumes: token checked by the form's action.
- Promises: none.
- Notes: RTL: "Link not valid", "This reset link is missing its token...", "Request a new link" (lines 25, 26, 31) hardcoded English. Expired/used token path is inside the form action (not in slice).

### app/(auth)/signup/page.tsx (57 lines)
- For: clinician signup, the only signup that creates an account on the spot (comment lines 13 to 22). A switcher (in `AuthShell kind="signup"`) shows the four account kinds so a clinic owner does not create a personal account.
- Decides: terms/privacy sentence split on `{terms}` / `{privacy}` placeholders (lines 36 to 50).
- Assumes: `SignUpForm`.
- Promises: none. `metadata.description` "Your first session is free." is a claim (English only).
- Notes: RTL: body via `t()`; metadata English.

### app/(auth)/staff/sign-in/page.tsx (41 lines)
- For: staff console door `/staff/sign-in`, noindex/nofollow, linked from nowhere (comment lines 7 to 21, `verify:sprint21r`).
- Decides: passes `next` to `StaffSignInForm`.
- Assumes: `QuietAuthShell` (no switcher).
- Promises: A5 entry point.
- Notes: `QuietAuthShell title=""` (line 35) renders an empty `<h1>` (components/auth/auth-shell.tsx:216): an empty heading for screen readers. RTL: form component only; page has no text.

### app/(clinic)/clinic/apply/actions.ts (45 lines)
- For: server action `apply` for the practice enquiry at `/clinic/apply`.
- Decides: rate limit 5 per hour per caller key "clinic-apply" (line 20); splits `intendedClinicians` textarea by newline (lines 37 to 40); calls `applyToClinic`.
- Assumes: `applyToClinic` (lib/data/clinic-admin) creates a HELD `organizations` row only (comment lines 12 to 14).
- Promises: none directly (precondition for C1..C5).
- Notes: error strings English ("Too many attempts. Try again later.").

### app/(clinic)/clinic/apply/page.tsx (55 lines)
- For: public enquiry page for a practice. Screen: say who you are, your licence and your intended clinicians. Next: submit, wait for an operator. Empty: n/a.
- Decides: shows `SeesWhat` table (can: schedule, bills, team; cannot: note, risk, built) BEFORE any call (C267, C261, 54.9, 65.11).
- Assumes: `ClinicApplyForm`, `SeesWhat` primitive; `lib/routing.ts` lists it open.
- Promises: C2 is contradicted in the buyer's own table: `clinic.apply.seesSchedule` tells the buyer they see the schedule, which (see /clinic) carries patient names.
- Notes: RTL: all via `t()`; metadata title English. `force-dynamic`.

### app/(clinic)/clinic/bills/page.tsx (135 lines)
- For: the practice's bills. Screen: one aggregated card per month (platform fee, AI fee, total, session count or "suppressed"). Next: optional CSV export (capability `export`). Empty: `clinic.billsEmpty` card.
- Decides: session COUNT withheld below the activity floor, money never (C262, lines 106 to 110); no per-session lines (C263); export link only if `actor.capabilities.includes("export")` (line 81).
- Assumes: `clinicBills` (lib/data/clinic.ts:630) groups `invoices` with `session_id IS NOT NULL` by month; `requireClinic` (not a capability check; `clinicBills` itself `refuseWithout(actor,"bills.read")` so a staff member without it gets a thrown error, not a redirect).
- Promises: C3 partly. One bill per practice: yes (tenancy is `invoices.organization_id`). "Priced per seat, the seats on it are the seats filled": NOT on this screen. `clinicBills` reads only per-session invoices (`i.session_id IS NOT NULL`, lib/data/clinic.ts:664); no seat count, no seat price, no seat line anywhere in the clinic portal. C4 (bill lower by one seat) cannot be seen here at all.
- Notes: RTL: `Intl` with `ar-EG` for money, `formatDate` for month; month label renders a full date (comment lines 52 to 58 accepts that). Currency hardcoded USD. Page uses `requireClinic` not `requireClinicCapability("bills.read")`, so a receptionist without bills.read who types the URL gets the error boundary rather than a redirect (compare earnings page which uses `requireClinicCapability`).

### app/(clinic)/clinic/earnings/page.tsx (111 lines)
- For: what each clinician on the practice earned, plus their withdrawals (date, status, amount; no account number). Screen: combined total card, one card per clinician. Next: nothing (read only by design, 63.15). Empty: `clinic.earn.empty`.
- Decides: `requireClinicCapability("earnings.read")` (line 35); combined figure is a sum of rows on page (line 68); withdrawals list without method or account (comment 27 to 33).
- Assumes: `clinicEarnings` (lib/data/clinic) scopes to the clinic and to `therapistIds` assignments.
- Promises: C5 kept on this screen (earnings per clinician, no patients). T3 not shown here (no owed half).
- Notes: RTL: `withdrawal.status` (line 91) rendered raw (English enum like `pending`/`paid`) to an Arabic reader. Currency USD hardcoded.

### app/(clinic)/clinic/export/route.ts (71 lines)
- For: GET `/clinic/export?what=bills|schedule`, CSV download.
- Decides: `getClinicActor` or 401 (line 29); any `what` other than "bills" exports the SCHEDULE (line 36 to 53); schedule window fixed at now minus 90 days to now plus 90 days (lines 51 to 52); any throw becomes a bodyless 403 (line 69).
- Assumes: `exportBills`/`exportSchedule` (lib/data/clinic-export) check the `export` capability and watermark with `actor.email`.
- Promises: C2 broken by design here too: the schedule CSV carries patient names (first name plus initial) and times for 180 days per export, taken out of the building.
- Notes: comment line 49 "the screen this mirrors shows one week at a time" while the export is 26 weeks: the export is 26x the screen. A missing or misspelt `what` silently exports the schedule rather than refusing.

### app/(clinic)/clinic/join/[token]/actions.ts (83 lines)
- For: invited clinician accepts: `accept` (new account, unverified) and `joinWithAccount` (existing clinician moves onto the clinic seat).
- Decides: rate limit 10 per 15 min (lines 23, 61); on `joinWithAccount` success, cancels the clinician's own subscription at period end via `lib/billing/stripe.cancelSubscription` (lines 72 to 80), failure logged not surfaced.
- Assumes: DB refuses acceptance when `terms_shown_at` is null (C261); `acceptInvitation` sets `unverified` (C267).
- Promises: C1 precondition: joining makes them `unverified`, so they are NOT on the radar the same hour; they must pass verification (C267). C1's "on the radar the same hour" is only true for an already verified clinician using `joinWithAccount`.
- Notes: the subscription cancel is on Stripe; for an Egyptian clinician on the manual rail, `cancelSubscription` behaviour unknown from here (Suspect). A failure means a subscription renews once more and the clinician is double billed (seat plus own plan) with only a log line; nobody is told.

### app/(clinic)/clinic/join/[token]/page.tsx (67 lines)
- For: the invited clinician's landing. Screen: "join <clinic>", form, "you verify yourself". Next: set a password or sign in with an existing account. Empty/expired: `clinic.join.expired` card with no link anywhere (dead end: no "ask the practice to resend", no link to /login).
- Decides: `resolveInvitation(token)` stamps `terms_shown_at` on render (comment 21 to 28).
- Assumes: open route in `lib/routing.ts`.
- Promises: C1 (partial, see actions).
- Notes: RTL via `t()`. A GET that writes (`terms_shown_at` stamped on render): a link preview bot or mail scanner stamps it too, so "proof we said it" is proof a URL was fetched.

### app/(clinic)/clinic/page.tsx (291 lines)
- For: the practice's week. Screen: the rota for a UTC Monday-anchored week: one row per session with PATIENT NAME (first name plus last initial, via `shortenForClinic`, lib/data/clinic.ts:388), clinician full name, time, and "cancelled" badge; two summary figures (sessions booked, distinct clinicians on the rota); a usage card (weekly sessions and spend by invoice week, floor suppressed). Next: prev/next week, CSV export. Empty: `clinic.scheduleEmpty` (and figures hidden, comment 162 to 173).
- Decides: week anchoring (lines 50 to 58, invalid `?week` falls back to now); `onTheRota` distinct clinicians (line 116); "nothing to pay" for zero spend with sessions (line 273).
- Assumes: `clinicSchedule` (select list has no consent column, comment 31 to 33), `clinicUsage` with `applyActivityFloor`.
- Promises: **C2 broken as written.** Line 201 renders `row.patientName` beside `row.therapistName` on every row; comment lines 22 to 27 (C260) defend it ("The line is money"). With names and clinician on each row across a week, a caseload per clinician is countable by eye, so "no caseload count on any row" is kept only literally (no number printed). E2-style attendance: a `cancelled` badge per named patient (line 206) is an attendance signal about a named patient to the employer of their clinician. This settles MAP contradiction 1: README is right, C2 is wrong.
- Notes: RTL: labels via `t()`, dates via `formatDateTime/formatDate` with locale; `row.status` "cancelled" rendered raw English (line 208). Week boundary UTC, so an Egyptian evening session (after 22:00 Cairo on Sunday) lands in the next week. `hoursBooked` label is a count of sessions, not hours (check dictionary).

