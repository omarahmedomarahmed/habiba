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

### app/(clinic)/clinic/people/actions.ts (142 lines)
- For: `invite`, `cancelInvitation`, `remove` for clinicians on the practice.
- Decides: `requireClinicAdmin` on all three (lines 28, 96, 115); invite link is RETURNED to the manager because mail domain is unverified and `notify` reports `sent:false` (comment 50 to 54); notification uses `kind: "claim.invite"` (line 62) for a job invitation; each act audited with `clinicManagerId`, `actor: null` (0086).
- Assumes: `inviteClinician`, `removeClinician` (moves them to own practice and disconnects meeting accounts, C266), `revokeInvitation`.
- Promises: C1 (seat add = invite), C4 (release = `remove`): nothing in this action touches `organizations.seats` or the seat bill; `removeClinician` calls `releaseSeat` (per verify-sprint62), and design/clinic/page.tsx:25 says those move the bill by zero (see there). No quote before remove, nobody told what the bill becomes. P2: the clinician is notified through `notify` (in-app plus email) best effort.
- Notes: invitation body text is English only (lines 63, 64). `notify` kind `claim.invite` reuses the patient claim kind, so in-app notice rendering may label it wrongly (Suspect).

### app/(clinic)/clinic/people/page.tsx (72 lines)
- For: the clinician list: name, email, verification status, future billable-from date for a seat whose period has not started (62.6). Screen: list plus invite form (admin only). Next: invite, cancel invitation, remove. Empty: in `ClinicPeopleList` (not in slice).
- Decides: `canManage = actor.role === "admin"` (line 54); waiting-seat date formatted server side (lines 45 to 50); only `state === "sent"` invitations shown (line 63), so expired/declined invitations vanish without trace.
- Assumes: `clinicClinicians` checks `people.read`; `seatsFor` (lib/billing/seats.ts:181).
- Promises: C1 partly: verification state IS on the row (`verificationStatus`). C2: no caseload count here (kept). C3/C4: no seat price, no bill figure on the people screen, so removing somebody shows no effect on the bill.
- Notes: RTL: only dates localised here; rest in component. Page uses `requireClinic`; `clinicClinicians` throws without `people.read` (error boundary instead of redirect).

### app/(clinic)/clinic/records/actions.ts (110 lines)
- For: EHR (SMART on FHIR) connect `begin` and `disconnect` for the practice.
- Decides: `requireClinicAdmin` (lines 25, 91); PKCE verifier sealed via `putPending`, redirect to hospital's authorize URL; audits before redirect (line 49).
- Assumes: `/api/ehr/callback` does the token exchange; `beginConnection` validates `fhirBaseUrl`.
- Promises: none of the 25 (Unclaimed: EHR).
- Notes: `vendor` cast from form without validation (line 27, `as EhrVendor`); `beginConnection` presumably validates. `fhirBaseUrl` is user supplied and fetched server side by `beginConnection` (SSRF surface, Suspect, lib/data/ehr).

### app/(clinic)/clinic/records/page.tsx (81 lines)
- For: the practice's record-system (EHR) connection and filing log. Screen: `RecordsPanel isClinic` with connections, last 100 filings (state, last error, response status, APPROVING CLINICIAN NAME, created time), and `filers` count. Next: connect/disconnect (admin). Empty: in panel.
- Decides: `onClinicPlan={true}` by construction (comment 38 to 46).
- Assumes: `writebacksFor` (lib/data/ehr.ts:344) joins users for approver name, no patient column.
- Promises: C2 partly broken: the filing log is one row per signed note with clinician name and timestamp, so notes per clinician (a caseload proxy) and when each was filed are on screen. `lastError` is raw text from the hospital server and could carry patient identifiers (Suspect).
- Notes: page uses `requireClinic`, not a capability; any clinic staff principal with any role reaches the note filing log. Layout `mx-auto max-w-2xl px-4 py-8` differs from the other clinic pages (own padding inside chrome). RTL: dates localised; `state`, `vendor`, `lastError` raw.

### app/(clinic)/clinic/sign-in/actions.ts (41 lines)
- For: `signInClinic` and `signOutClinic`.
- Decides: rate limit 8 per 15 min on every attempt (line 22); `createClinicSession`, redirect `/clinic`. Sign-out redirects to `/clinic/sign-in`.
- Assumes: `checkClinicPassword` returns a generic error.
- Promises: A5-adjacent (separate cookie per principal).
- Notes: no `next` parameter, always lands on `/clinic` (a receptionist without `schedule.read` lands on a page whose query throws: Suspect, check `clinicSchedule` refuseWithout).

### app/(clinic)/clinic/sign-in/page.tsx (32 lines)
- For: the clinic door, `AuthShell who="clinic"`. Next: sign in. RTL via `t()`.
- Decides: nothing.
- Assumes: separate clinic cookie (comment 13 to 16).
- Promises: none.
- Notes: no forgot-password link rendered here (none passed as `belowForm`); a clinic manager who forgets a password has no self-service path visible on this page (check `ClinicSignInForm`).

### app/(clinic)/clinic/team/actions.ts (203 lines)
- For: custom roles (`saveRole`, `deleteRole`), `inviteStaff`, `saveAssignments`, `switchToClinician`.
- Decides: roles and staff need `requireClinicAdmin` (lines 36, 84, 107); assignments need `team.manage` (line 150); role changes audited with capability list in `reason` (line 76); `switchToClinician` revokes clinic sessions THEN creates a clinician session (C352, lines 191 to 203).
- Assumes: `leaveClinicPrincipal` returns the linked `userId`.
- Promises: A5-like for clinics (roles as lists, audited). Not one of the 25 (Unclaimed: clinic staff principal).
- Notes: `inviteStaff` sets the staff member's password from the form (line 116): the admin chooses and therefore knows another person's password; no invitation or forced reset visible here (Suspect/hole). `saveAssignments` accepts arbitrary `clinicManagerId` and `userIds`; tenancy check is in `setAssignments` (not in slice). `switchToClinician` if `leaveClinicPrincipal` errors, redirect `/clinic` silently.

### app/(clinic)/clinic/team/page.tsx (64 lines)
- For: staff and roles screen. Screen: roles with capabilities, staff with role and assignments. Next: add role, add staff, assign clinicians. Empty: in `ClinicTeam`.
- Decides: `requireClinicCapability("team.manage")` (line 31); clinicians list only with `people.read` (line 41).
- Assumes: `DELEGABLE` capabilities list.
- Promises: none of the 25.
- Notes: RTL: none here; all in component.

### app/(clinic)/layout.tsx (67 lines)
- For: clinic shell `ClinicChrome`; no crisis orb by design (comment 22 to 26).
- Decides: `bare` only on exact path `CLINIC_SIGN_IN` via `x-pathname` header (line 54); nav shown iff actor.
- Assumes: middleware sets `x-pathname`; `ClinicChrome` hides nav items by capability.
- Promises: C2 structural (no import path to clinical components, comment 18 to 20).
- Notes: `/clinic/apply` and `/clinic/join/[token]` are NOT bare, so a stranger sees the clinic desk chrome with no nav (comment 36 to 44 says only the sign-in brings site header). RTL: language switch lives in chrome rail.

### app/(partner)/layout.tsx (53 lines)
- For: partner (EHR / integrator developer) shell `PartnerChrome`; no crisis orb (comment 22 to 26).
- Decides: `bare` on exact `PARTNER_SIGN_IN` via `x-pathname` (line 44); `LanguageCorner` on every non-door screen (line 49).
- Assumes: middleware header `x-pathname`.
- Promises: none of the 25 (partner has no audience in the 25).
- Notes: RTL: `LanguageCorner` here is the floating corner pill that the clinic layout (app/(clinic)/layout.tsx:45 to 52) removed for sitting on top of page content; partner still has it. Inconsistent with clinic and sponsor.

### app/(partner)/partner/actions.ts (98 lines)
- For: `createKey`, `revoke`, `saveLimit` (monthly session cap).
- Decides: `requirePartnerAdmin` on all (lines 26, 54, 71); partner id from actor not form; raw key returned once (line 50); limit change audited (lines 86 to 94) with `actor: null` and no partner-user id (who raised it is NOT recorded, only which partner).
- Assumes: `mintKey` (lib/partner/keys.ts:80) validates scopes, refuses `live` unless `partners.approved_at`.
- Promises: none of the 25.
- Notes: STALE comment lines 35 to 39: "`mintKey` refuses `employment:verify` without one". lib/partner/keys.ts:94 to 106 says that check was removed 2026-09-14 because `employment:verify` is no longer a partner scope. The form still sends `sponsorId` and `mintKey` still writes it (keys.ts:151), so a partner key can be tagged with any sponsor's id for no purpose. Audit on `saveLimit` names no human, contradicting its own comment "Who raised it, and when ... has to come from a row" (line 83).

### app/(partner)/partner/apply/actions.ts (32 lines)
- For: integrator enquiry `apply`, creates a HELD `partners` row.
- Decides: 5 per hour rate limit (line 19).
- Assumes: `applyToPartner`.
- Promises: none.
- Notes: English error string.

### app/(partner)/partner/apply/page.tsx (52 lines)
- For: integrator's door. Screen: title, body, form, three sentences (grant is the patient's, webhooks carry no content, keys note). Next: submit. Empty: n/a.
- Decides: nothing.
- Assumes: `PartnerApplyForm`.
- Promises: T5/P4-adjacent sentence `devs.useCase3Body` (patient can revoke and leave, C277).
- Notes: comment 36 to 44 records employment verification moved to the sponsor. RTL via `t()`, metadata English.

### app/(partner)/partner/deliveries/page.tsx (95 lines)
- For: webhook delivery log. Screen: per delivery: event name, delivered/pending, HTTP status, attempts, opaque subject uuid, URL, created time, last error. Next: none (debug). Empty: `dev.deliveriesEmpty`.
- Decides: `requirePartner` (any partner user, line 32); subject id never resolved to a name (comment 22 to 26).
- Assumes: `deliveriesFor` scopes to `actor.partnerId`.
- Promises: none of the 25. Privacy: an event log of session events keyed by opaque id with timestamps is a per-session timeline; acceptable for an EHR partner of the clinician, not a sponsor path.
- Notes: RTL: `delivery.lastError` raw. `lastStatus` numeric.

### app/(partner)/partner/page.tsx (68 lines)
- For: developer home = key list. Screen: keys with label, prefix, scopes, environment, SPONSOR NAME, last used, suspended/revoked. Next: mint (admin), revoke (admin). Empty: in `KeyList`.
- Decides: `requirePartner`; `sponsorChoices()` fetched for partner admins (line 41).
- Assumes: `sponsorChoices` (lib/data/partner-admin.ts:258) returns id and name of EVERY active sponsor.
- Promises: E1/E2-adjacent: **every partner admin is shown the names of all our active sponsor companies** (the list of employers who fund staff therapy) in a dropdown, for a scope (`employment:verify`) that is no longer a partner scope (lib/partner/keys.ts:94 to 106). Not a patient name, but a customer list disclosed to third parties for no remaining purpose. See Broken.
- Notes: RTL: dates via `formatDate`; scope and environment strings raw.

### app/(partner)/partner/sign-in/actions.ts (42 lines)
- For: `signInPartner`, `signOutPartner`.
- Decides: 8 per 15 min on every attempt (line 23); redirect `/partner`.
- Assumes: `checkPartnerPassword`.
- Promises: none.
- Notes: English errors.

### app/(partner)/partner/sign-in/page.tsx (38 lines)
- For: partner door, `QuietAuthShell` with link to apply.
- Decides: nothing.
- Assumes: separate cookie.
- Promises: none.
- Notes: RTL via `t()`. No forgot-password link.

### app/(partner)/partner/usage/page.tsx (63 lines)
- For: monthly session limit, used, projected, stopped, last month's bill. Next: admin changes limit. Empty: `lastMonth` null when no sessions.
- Decides: last month computed in UTC (lines 37 to 39); `periodLabel` and bill label are `toISOString().slice(0,7)` (lines 50, 54).
- Assumes: `usageFor`, `billFor` (same function the cron posts from).
- Promises: none of the 25.
- Notes: RTL: `YYYY-MM` labels are raw ISO strings, the exact bidi-reordering defect the clinic page comment (app/(clinic)/clinic/page.tsx:79 to 90) fixed there and did not fix here. No `getI18n` on this page at all.

### app/(partner)/partner/webhooks/actions.ts (44 lines)
- For: `addWebhook` (returns secret once), `disable`.
- Decides: `requirePartnerAdmin`; events cast from form (`as WebhookEvent[]`, line 27), validation in `registerWebhook`.
- Assumes: `registerWebhook` refuses to store a secret with no sealing key.
- Promises: none.
- Notes: partner-supplied URL receives server-side POSTs (SSRF surface lives in lib/partner/webhooks, not in slice).

### app/(partner)/partner/webhooks/page.tsx (39 lines)
- For: endpoint list. Next: add/disable (admin). Empty: in `WebhookList`.
- Decides: `webhooksFor` never selects `secret_sealed` (comment 14 to 16).
- Assumes: component.
- Promises: none.
- Notes: RTL via `t()` for title only.

