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

### app/(patient)/error.tsx (63 lines)
- For: route-level error boundary for the patient group, keeps the SOS orb and the reader's language (comment 9 to 27: the only boundary used to be global-error, which dropped the orb).
- Decides: logs only `error.digest` (line 44); renders `t("error.title")`, body, retry, `<SosOrb />` with no `phone` prop.
- Assumes: `SosOrb` works without the reader's phone (falls back to some default line).
- Promises: P5 kept on failure (orb present, not behind money).
- Notes: RTL via `useT`. The orb here has no `phone`, so it cannot pick the reader's national crisis line the way the chrome does (layout passes `actor.phone`); on an error the line shown may be the wrong country (check `components/patient/sos-orb.tsx` default).

### app/(patient)/layout.tsx (84 lines)
- For: the patient shell. Asks `optionalPatient()` once; when signed in, asks `liveSessionForPatient` and `openSessionForPatient` on EVERY render (force-dynamic, lines 51, 69 to 74).
- Decides: `nav` only when signed in (C184); orb gets `openSession` (79.3: "open" = any session at all, "live" = clinician in the room); `SessionStarted` banner when live; `LanguageCorner` on every screen.
- Assumes: `PatientChrome` (components/patient/chrome.tsx:80 to 81) renders `SessionOrb` then `SosOrb`; SessionOrb is `z-[60]` (session-orb.tsx:63), SosOrb `z-[70]` (sos-orb.tsx:163), so SOS stacks above the payment orb.
- Promises: **P2**: the orb is in the chrome for every page in this group; its state type is `"owes" | "ready"` (chrome.tsx:40), so "money owed" is only expressed for an OPEN SESSION. Money owed that is not tied to an open session (a rejected transfer, an outstanding bill after the session closed) draws no orb. Partly kept. **P5**: kept structurally (z-70 over z-60); the error boundary keeps it too. The radar and the live session are outside this group (comment 10 to 12) and need their own orb (not in slice).
- Notes: RTL: `LanguageCorner` fixed pill; clinic removed the same pill for covering content, patient keeps it.

### app/(patient)/patient/account/actions.ts (159 lines)
- For: `askToChangeNumber` (request to staff queue, 20.13), `saveOwnName`, `saveOwnPhoto`, `removeOwnPhoto`.
- Decides: name 1 to 80 chars (lines 82 to 83); edits `people` never `patients` (comment 69 to 71); photo uploaded before old one deleted (line 132).
- Assumes: `lib/data/challenge.ts` never compares against `people.firstName` (C114; comment 61 to 67 says the two must change together).
- Promises: none of the 25 directly.
- Notes: pinned to default region (30.1 not routed). English error strings.

### app/(patient)/patient/account/page.tsx (188 lines)
- For: "Account" tab. Screen: name heading, identity editor, change-number request, phone/email/timezone, links to consent, billing, own documents, and Sign out. Next: any of those doors. Empty: email "not added" with nudge.
- Decides: billing link lives here now (Option A, line 131 to 135); sign-out form without JS (line 178).
- Assumes: `lockUntil` for the 90-day phone lock.
- Promises: P4 door ("who can see", links /patient/consent). P2 n/a.
- Notes: RTL: `lockedUntilLabel` is `toISOString().slice(0,10)` (line 85), raw ISO date, the bidi defect the clinic page fixed. H1 is `firstName lastName` with no `t()` (fine). Two `getI18n` calls avoided here; fine.

### app/(patient)/patient/assessments/[id]/page.tsx (57 lines)
- For: answering one assigned questionnaire. Screen: title, body, questionnaire. Next: answer each item, finish. Empty: 404 when not theirs.
- Decides: `assignmentForAnswering(id, personId)` person-scoped, `notFound()` (line 35).
- Assumes: `recordAnswer` re-checks per answer.
- Promises: none of the 25 (Unclaimed: instruments). C113 (machine never tells a person what is wrong with them) kept: no score or band.
- Notes: RTL via `t()`; instrument text comes with `assignment.questions` (localised in lib).

### app/(patient)/patient/assessments/actions.ts (59 lines)
- For: `answerQuestion`, `finishAssessment`.
- Decides: person from session (line 28); finish returns no score (C113).
- Assumes: `completeAssignment` freezes the score.
- Promises: none.
- Notes: English error "That assessment could not be finished."

### app/(patient)/patient/assessments/page.tsx (131 lines)
- For: open questionnaires and own history (number and date, no band). Next: Start. Empty: `passess.none` / `passess.historyNone`.
- Decides: instrument name by locale with English fallback (line 51); score unstyled (comment 116 to 120).
- Assumes: `historyForPerson` never selects a band.
- Promises: none of the 25.
- Notes: RTL: dates via `formatDate` with patient timezone and locale; good.

### app/(patient)/patient/benefit/actions.ts (132 lines)
- For: `checkCode` (resolve an enrolment code to sponsor name and field shapes), `activateBenefit` (enrol), `confirmCode` (53.19 proof code), `choosePrimary` (C249), `askAboutEmployer` (constant answer, C349).
- Decides: person from session everywhere; `askAboutEmployer` returns one constant message so it is not an oracle (lines 111 to 132).
- Assumes: `enrol` checks identifier shape and domain, never a list of people (C227); `confirmEnrolmentCode` scopes by person in WHERE.
- Promises: E4/E5 adjacent (enrolment). E1: enrolment reveals nothing to sponsor beyond counts (not visible here).
- Notes: `checkCode` returns sponsor name for any valid code to any signed-in patient: acceptable (poster is public), per comment.

### app/(patient)/patient/benefit/page.tsx (66 lines)
- For: the patient's own benefits. Screen: title, body, `BenefitForm` listing enrolments (sponsor name, primary, paused, verified) and a code entry; `AskAboutEmployer`. Next: enter a code, confirm, choose primary. Empty: in `BenefitForm` (not in slice).
- Decides: passes `paused` and `verified` only (lines 46 to 53). No pot balance, no coverage percentage, no "pot is empty" state, no "cover was removed" state is passed to the form.
- Assumes: `myBenefits` (lib/data/enrolment).
- Promises: **E5 cannot be kept on this page**: nothing here knows whether the pot is empty, so the benefit screen cannot say "ask HR"; wherever E5's sentence lives it is at booking/payment time (not in slice, check `app/pay` or the booking sheet). **E4**: coverage 0% is not represented (no coverage figure passed), so this page neither says "removed" nor says "you now pay the whole price". Revoked/removed enrolment: only `paused`. Partly: E4 kept by omission, E5 absent here.
- Notes: RTL via `t()`; metadata "Your benefit" English only (by design a non-therapy word, 53.2).

### app/(patient)/patient/billing/page.tsx (222 lines)
- For: what the patient paid, split three ways (therapist fee, VAT, platform share), in presented currency where it differed; credit balance. Next: none. Empty: `pbilling.none`.
- Decides: only `status = 'paid'` rows (line 87), last 50; a pot-funded row (`fundingSource === "pot"`) renders `pbilling.covered` and no split (lines 149 to 179).
- Assumes: one `session_payments` row per session (unique on `session_id`, lib/billing/pot.ts:561), which for a pot session carries `coverage_bps`, `sponsor_share_cents`, `patient_share_cents` (schema 2245 to 2247).
- Promises: **E3 broken on this screen for any partial cover.** The query never selects `patientShareCents`/`sponsorShareCents`/`coverageBps`; `lib/billing/pot.ts:559` writes `fundingSource: "pot"` on the single row even when the patient owes a share (e.g. the `money` position at 10 per cent cover). So a patient who paid 90 per cent of a session reads "Covered" with no amount. A1/A3: pending, rejected or part-paid manual transfers never appear here (only `paid`), so the billing screen cannot carry an operator's rejection sentence. P2: payment confirmations are not listed as notices here.
- Notes: RTL: lines 126 to 127 hardcoded English "It comes off your next session automatically, and it lasts until"; line 163 hardcoded " · charged at X EGP to the USD". Two `getI18n()` calls (lines 50, 52). The "therapist fee" row shows `grossCents` which includes the platform fee (schema 2253: net = gross minus fee), so the three lines do not sum to the headline and "therapist fee" overstates what the therapist got (Suspect, depends on dictionary wording). Pinned to default region.

### app/(patient)/patient/browse/page.tsx (109 lines)
- For: search therapists by text, category chips with counts. Next: open a `TherapistCard`. Empty: no query shows categories; no matches `browse.nothingMatched`; no categories `browse.none`.
- Decides: plain GET form (comment 18 to 23).
- Assumes: `search`, `categories` (lib/data/discover), `TherapistCard`.
- Promises: P1 path (browse is not the radar; three taps is from radar).
- Notes: RTL: `start-3.5`, `ps-10`/`pe-4` logical properties used. Category `label` localisation depends on lib.

### app/(patient)/patient/claim/actions.ts (206 lines)
- For: the claim flow: `mySuggestions` (records matching a PROVEN handle), `sendClaimCode(personId, channel)`, `confirmClaim`, `declineClaim`, `acceptInvite`.
- Decides: suggestions only for verified phone/email (lines 76 to 78, C121); code sent through `notify` to the CALLER's own email/phone (lines 117 to 124); body names nobody (lines 128 to 134); `therapistKeepsAccess` explicit.
- Assumes: `startClaim` (lib/data/claims.ts:200) and `verifyClaim` (:296) check the person is theirs to claim.
- Promises: P4 ("the patient decides who may read"), grant default OFF on claim.
- Notes: **see Broken**: `sendClaimCode` takes `personId` from the client (line 98) and `startClaim` checks only that the person exists and is unclaimed (claims.ts:206 to 216); it never re-checks that the person matched this account's proven handle. The code goes to the caller's own inbox (line 119), so it proves nothing about the record. `verifyClaim` checks claim id, account, code, expiry only (claims.ts:311 to 319). Anybody signed in who holds an unclaimed person's uuid can take the record. English strings lines 127, 133, 148.

### app/(patient)/patient/claim/challenge-actions.ts (72 lines)
- For: the two challenge answers `saySeen`, `sayName`.
- Decides: `sayName` throttled 12 per hour per caller (line 51) plus per-claim count in `answerName`; both audited as `phi_access` (lines 25, 61).
- Assumes: `answerSeen`/`answerName` check that `patientId` belongs to an open challenge for this account.
- Promises: P4 identity step.
- Notes: `saySeen` has no rate limit; `patientId` from client, trust is in lib/data/challenge.

### app/(patient)/patient/claim/page.tsx (117 lines)
- For: "Your records": challenge questions first, then email-matching `ClaimFlow`. Next: prove handle, answer, confirm. Empty: `pclaim.nothingTitle/Body` (only once a handle is proven; unproven shows `ProveHandle`).
- Decides: `proven` gate (line 77); nothing matched on unproven handle.
- Assumes: `openChallenges`.
- Promises: P4 entry.
- Notes: RTL: `"your number"` English fallback (line 100).

### app/(patient)/patient/consent/actions.ts (176 lines)
- For: `answerRequest` (grant or reject a clinician's request, preset reasons only), `revoke`, `inviteMyTherapist` (6-character code), `cancelInvite`, `askPreviousTherapist` (C108), `unlinkPlatform` (cut a partner subject link, webhook `subject.unlinked`).
- Decides: person from session; free-text rejection reasons dropped (lines 34 to 40); revoke "effective on the next read" (line 49); unlink tells the partner best effort (lines 167 to 172).
- Assumes: `decideGrant`/`revokeGrant` match both person and grant id.
- Promises: **P4** (patient decides who may read) and **T5** (revoked grant stops the copilot on the next question): revoke is here and takes effect on next read per lib; T5's copilot side is not in this slice. Kept as far as this slice shows.
- Notes: `expiresOn` is `toISOString().slice(0,10)` (line 88), raw ISO to an Arabic reader.

### app/(patient)/patient/consent/page.tsx (192 lines)
- For: "Who can read your history". Screen: `SeesWhat` rules (may read, may keep, may ask again; never before, never after, never why), pending requests and grants (`ConsentList`), linked platforms, invite-a-therapist code, ask-previous-therapist. Next: approve/decline/revoke, make a code, ask. Empty: `LinkedPlatforms` renders nothing when none; others in components.
- Decides: live invites filtered by not revoked and not expired (lines 84 to 86); `awaitingAnswer` matched by comparing a therapist's full NAME string to `invite.redeemedBy` (line 162), so two clinicians with the same name, or a name format difference, gives a wrong "look above".
- Assumes: `grantsForPerson`, `pendingRequestsFor`, sessions join for clinicians seen (limit 20).
- Promises: P4 and T5 (the grant and revoke surface). Versions and authors of the record are NOT here (see /patient/record).
- Notes: STALE comment line 187: "the `SeesWhat` above now carries it as `consent.canKeep`"; the key used is `consent.mayKeep` (line 119). RTL: `linkedLabel` and `expiresOn` raw ISO (lines 149, 158); fallback `"A therapist"` English (line 171). Date objects (`requestedAt`, `expiresAt`, `decidedAt`, `revokedAt`) passed to a client component, the C84 hydration pattern other pages avoid.

### app/(patient)/patient/forgot-password/page.tsx (34 lines)
- For: patient reset (code over WhatsApp, per comment 14 to 17). Next: `PatientResetForm`, or the clinician reset link. Empty: n/a.
- Decides: nothing.
- Assumes: `PatientResetForm` explains when the channel is off.
- Promises: none. Note: WhatsApp "not wired up" per claim/actions.ts:92 to 95; if reset relies on WhatsApp, a patient with no working channel is stuck (Suspect, check `components/patient/reset-form`).
- Notes: RTL via `t()`; not wrapped in `AuthShell` unlike login/signup, so looks different from the door it came from.

### app/(patient)/patient/homework/actions.ts (41 lines)
- For: `answerStep(itemId, done|skipped, note)`.
- Decides: person from session; skipped equal to done (comment 17 to 19).
- Assumes: `closeStep` scopes on person.
- Promises: none of the 25.
- Notes: none.

### app/(patient)/patient/homework/page.tsx (63 lines)
- For: "What to try": open steps only, link to assessments when some are waiting. Next: mark a step done or skipped. Empty: in `PatientSteps`.
- Decides: `openStepsFor` returns open items only (no completion rate).
- Promises: none.
- Notes: RTL via `t()`.

### app/(patient)/patient/invite/[token]/page.tsx (111 lines)
- For: the clinician-handed invite link to claim a record (the only route for most patients, comment 16 to 18). Screen: used/expired card; signed out: therapist's name and two buttons (create account with `?invite=`, sign in with `?next=`); signed in: `InviteFlow` with redacted name. Next: claim with a keep-access choice.
- Decides: signed-out view shows THERAPIST name only (13.8, lines 57 to 72).
- Assumes: `resolveInvite(token)`; single use.
- Promises: P4 (claim), P2 (in-app arrival of an invitation: this is the in-app half).
- Notes: Empty/used state (`pinvite.usedTitle`) has no link at all (no "open the app", no "ask your therapist"): a dead end; home page comment (page.tsx:79 to 85) says a successful claim now lands on `/patient?claimed=...`, so a used link only reaches people who reopen it. Signed in, whoever holds the forwarded link sees the redacted name and can claim the record (no identity step, by design, comment 20 to 23).

### app/(patient)/patient/journal/actions.ts (46 lines)
- For: `addJournal`.
- Decides: returns only saved or not; nothing about the crisis scan (C123, comment 13 to 24).
- Assumes: `writeJournal` scans and may alert a grant holder.
- Promises: P5-adjacent (no implied watch). Unclaimed: journal crisis scan alerts a clinician (MAP Unclaimed 5); whether the patient is told their entries are machine-scanned depends on `journal.body` copy (not checked).
- Notes: none.

### app/(patient)/patient/journal/page.tsx (102 lines)
- For: private journal with a named list of who can read it. Next: write; link to "who can read". Empty: no entries shows nothing below the writer.
- Decides: readers = granted grants, named (lines 47 to 49).
- Promises: P4 (readers named).
- Notes: RTL: " · spoken" hardcoded English (line 90); `"A therapist"` English fallback (line 49). `listSeparator(locale)` used for names (good).

### app/(patient)/patient/login/page.tsx (63 lines)
- For: patient door: password form, reset link, "or", code sign-in (offered to everybody, C119).
- Decides: nothing.
- Promises: P1 (entry), P2.
- Notes: RTL via `t()`. No `next` param handling visible here; `/patient/login?next=/patient/invite/...` from the invite page depends on `PatientAuthForm` reading `next` (Suspect, check component).

### app/(patient)/patient/messages/actions.ts (28 lines)
- For: `setCheckins(on)` mute/unmute check-in messages, `via: "screen"`.
- Promises: none.

### app/(patient)/patient/messages/page.tsx (79 lines)
- For: check-in messages setting. Screen: `SeesWhat` (a worrying reply shows help and tells the therapist; nothing else read, nothing given to a computer), switch, how to stop. Next: toggle.
- Decides: `mutedOn` formatted in UTC (line 73), not the patient's zone.
- Promises: none of the 25 (Unclaimed: check-ins, crisis routing of replies).
- Notes: comment line 39 says "Check-ins is reached from the account screen"; the account page (app/(patient)/patient/account/page.tsx) has no link to `/patient/messages`, and a grep of app/ and components/ finds no link to it anywhere. A screen with no door. Uses `<div>` not `<main>` unlike siblings.

### app/(patient)/patient/notices/actions.ts (27 lines)
- For: `dismiss(noticeId)`; no delete (C231).
- Promises: P2.

### app/(patient)/patient/notices/page.tsx (60 lines)
- For: the patient's own notification log ("What has happened"): benefit ended, etc., by `messageKey`, dismissed entries kept.
- Decides: date in patient timezone.
- Assumes: `noticesFor` (lib/data/notices) is the only reader; comment line 33 "Dismissing takes an entry out of the main view".
- Promises: **P2 partly broken**: this is the in-app log that P2 relies on, and nothing links to `/patient/notices` (grep of app, components, lib for the path finds only this route and its own actions), and `noticesFor` has no other caller, so there is no "main view" the comment refers to. A notice written here is visible only to somebody who types the URL.
- Notes: RTL: messages by key, so translatable.

### app/(patient)/patient/page.tsx (489 lines)
- For: patient Home. Screen: claimed banner, avatar and greeting, search link, live count banner (radarCount; zero says so and points at browse), pending access requests card, next homework step, open assessments, explore rail, category grid, top-rated rail with the rating bar, session list (four groups), link to all sessions, record card (claimed or not, files attached count), links to journal, summary, who can read, get a copy.
- Decides: live banner only when `radarCount() > 0` (line 211); explore rail empty says so (line 340); categories hidden when empty (line 358); attached count separate query (lines 142 to 146).
- Assumes: `sessionsForPatient` select list enforces §6 (15.8).
- Promises: **P1**: from Home, the live banner is one tap to `/patient/radar`; from there two more to be in a session only if the radar console books in one tap (not in slice). **P2**: no notice list, no payment confirmation, no benefit state on Home; session state is in the list and the chrome orb. **P4**: links to summary and consent. **P5**: orb from chrome.
- Notes: Empty: every rail has an empty state except categories. No link to `/patient/notices`, `/patient/benefit`, `/patient/messages`, `/patient/residency` from Home. RTL via `t()`; `"+"` for 9+ is a Latin glyph (fine). Pinned to default region.

### app/(patient)/patient/profile/actions.ts (54 lines)
- For: `flagOwnContent` (document, chunk, diagnosis): a flag never edits (8.8). Comment records `addOwnFile`/`addOwnNote` deleted (26.5).
- Decides: `targetId` from client, `raiseFlag` must check it belongs to `personId` (not in slice).
- Promises: P4-adjacent (record stays as written).

### app/(patient)/patient/profile/page.tsx (145 lines)
- For: "Your profile": documents on their record with who added each (provenance), confirmed diagnoses with the source sentence, flag rules. Next: open a document, flag. Empty: in `OwnProfilePanel`; diagnoses card hidden when none.
- Decides: only `status === "confirmed"` diagnoses (line 100); "added by you" vs clinician name, fallback "your therapist".
- Promises: P4 (author on each item). P3: a diagnosis reaches the patient only when confirmed; source sentence shown.
- Notes: RTL: watermark string `"· your own record"` hardcoded English (line 97). Dates passed as ISO strings to the client (formatted there).

### app/(patient)/patient/radar/page.tsx (39 lines)
- For: the radar inside the app chrome (bottom bar and orb kept). Next: pick somebody free now.
- Decides: `listRadar()` server side, console polls `/api/radar`.
- Promises: **P1** (the radar is tap one), P5 (orb present because inside the patient group). Note the layout comment (app/(patient)/layout.tsx:10 to 12) says the radar is NOT in this route group; `/patient/radar` is, so that comment is about the public `/radar` only.
- Notes: hardcoded colour `bg-[#04101f]` (not a token); no `getI18n`, metadata English.

### app/(patient)/patient/record/actions.ts (33 lines)
- For: `exportMyRecord` to the account's own email only (C128).
- Decides: address never from the form.
- Promises: P4 (portability). Returns `verificationCode` to the screen (line 32), so the export's second factor is shown on the same device that requested it.

### app/(patient)/patient/record/page.tsx (106 lines)
- For: "A copy of your record": export, plus the practice visibility disclosure (C327) when a clinic pays for their sessions: "they see: <name as the practice reads it>", when, that they pay; never notes, journal, diagnosis, what was said.
- Decides: rendering stamps `clinic_visibility_shown_at` (line 38).
- Promises: P4 (export). **C2 contradiction confirmed from the patient side**: the patient is told the practice sees their name (`pclinic.theySee` plus `asTheySeeIt`, line 79) and when (`pclinic.andWhenValue`). The record's versions and authors are NOT on this page (they are on /patient/summary).
- Notes: RTL: `practices.join(", ")` uses a Latin comma (use `listSeparator`). A GET that writes (stamp on render).

### app/(patient)/patient/residency/actions.ts (37 lines)
- For: agree/withdraw cross-border record holding, locale stored with consent.
- Notes: `getLocale().then(...).catch(() => "en")` defaults to English on failure: the record could claim they read English wording.

### app/(patient)/patient/residency/page.tsx (45 lines)
- For: where the record is kept, cross-border consent. Next: agree or withdraw.
- Notes: two `getI18n()` calls. No link to `/patient/residency` anywhere in app/ or components/ (grep); comment "a person can come back and check" has no door (Unclaimed c). Not one of the 25.

### app/(patient)/patient/sessions/page.tsx (92 lines)
- For: all sessions, tabs all/upcoming/past via `?tab=`. Empty: in `PatientSessionList`.
- Decides: groups today/upcoming vs past_scheduled/past_instant.
- Promises: **P3**: the list shows `brief` only once signed and `psessions.writing` while `briefPending` (components/patient/session-list.tsx:138 to 147), so "still writing" is here, not on /patient/summary. P2 (session states in app).
- Notes: `getI18n()` called twice (line 46 and 51, second unused). RTL via `t()`.

### app/(patient)/patient/signup/page.tsx (49 lines)
- For: patient signup; with `?invite=` pre-fills and LOCKS the phone and names the therapist.
- Promises: P4 entry, T4-adjacent.
- Notes: an invalid invite token silently falls back to plain signup with no message.

### app/(patient)/patient/summary/page.tsx (96 lines)
- For: the clinical summary: every version, each with approver name, credentials, version number, date, body, licence body and number. Next: none. Empty: `psummary.none` "Nothing has been written yet."
- Decides: no access check beyond being the person (26.2); `summariesForPerson` returns approved versions.
- Promises: **P3 kept** here (name plus credentials plus licence on each version; nothing unsigned rendered, assuming `summariesForPerson` filters to approved). **P4 kept** (every version, author named). Empty state does not say "your therapist is still writing" (that sentence lives in the sessions list), so a patient opening Summary straight after a session reads "Nothing has been written yet."
- Notes: RTL via `t()` and `formatDate` in patient zone.

### app/(patient)/patient/t/[id]/page.tsx (46 lines)
- For: a clinician's profile inside the app (same body as public `/t/:id`), with back control. Next: book. Empty: 404.
- Promises: P1 path, P5 (orb kept).

### app/(patient)/sessions/[id]/recovery-actions.ts (182 lines)
- For: the patient side of a therapist no-show: `offerReplacements`, `takeReplacement`, `takeRefund`. UNAUTHENTICATED by design: the session id is the capability (comment 34 to 40).
- Decides: `offerReplacements` rate limited 20 per hour, records `noShowAt` and `recoveryOfferedAt` for any session with `startedAt` null (lines 79 to 84); `takeReplacement` and `takeRefund` have no rate limit and no caller check.
- Assumes: the five-minute wait lives in the CLIENT (components/session/no-show-recovery.tsx:65 `waitMinutes < 5`); `reassignSession` and `refundNoShow` (lib/data/recovery.ts:175, 296 to 301) refuse only `startedAt IS NOT NULL` or an existing outcome.
- Promises: money (refund in full including fee), and P4/§6 (who holds the record).
- Notes: **see Broken**: none of the three checks the scheduled time. With a session uuid, anybody can (a) stamp a no-show on a session scheduled next week, lowering the clinician's reliability score (`reliabilityFor` counts `noShowAt`), (b) cancel and fully refund it, (c) reassign it to ANY non-deleted user whose `sessionRateCents` is at or below the price, including an unverified clinician with no rate (`rate = 0`), and lib/data/recovery.ts:160 to 165 says reassigning "is the same act as granting somebody full read on its transcript, its note and the patient's chart". Notification bodies English only (lines 124 to 125, 172 to 173). `takeRefund` notification promises "refunded in full" even when `refundSessionPayment` failed (recovery.ts:332 to 339 logs and still returns ok).

### app/(public)/[slug]/page.tsx (56 lines)
- For: every CMS page other than home (`/for-patients`, `/pricing`, `/security`, `/features`, legal pages...), rendered by `BlockRenderer` from `getPublicPage(slug)`.
- Decides: `revalidate = false` (refresh on publish only, comment 8 to 15); prerenders `DEFAULT_PAGES` slugs except home; `layout === "document"` gets an article wrapper.
- Assumes: `lib/content/service` serves the published `content_pages` row when one exists, else `defaults.ts` (authored content wins, H28); locale chosen inside the service.
- Promises: this is the page that CARRIES the `where` phrases for P3 and P4 ("You never talk to the AI", "It moves with you" on `/for-patients`), A5 (`/security`), T3 (`/pricing`). The phrases live in `lib/content/defaults.ts` only (grep); the published rows may differ (H28, MAP Suspect 8), so which page says what is decided by data, not by this file.
- Notes: RTL: `BlockRenderer` and service handle locale; `/ar/...` paths come from middleware. Empty: 404.

### app/(public)/contact/actions.ts (80 lines)
- For: public contact form `submitContact`: honeypot `website` (answers as success, line 37 to 40), `fileTicket` (clinical-material handling), optional attachment after ticket, returns reference and hours to due.
- Decides: `entity` from form, `eg` or `us` (line 52).
- Promises: none of the 25.
- Notes: honeypot returns reference "RECEIVED": a real human who autofills a hidden field (password managers do fill hidden fields named `website`) is told their message was received when it was dropped. Suspect, low.

### app/(public)/design/clinic/page.tsx (404 lines)
- For: design review of the clinic portal as three wireframed arrangements (task 139). STRUCTURE (to be rewritten): hero (eyebrow "Design review · clinic", h1, intro, link to `/design/clinic/sample`, a "Chosen: Option A · The desk" banner naming `components/clinic/chrome.tsx`, a three-row table Option / The idea / What it costs); then five `Compare` rows, each with three `PickWide` columns (A desk rail of six: This week, Clinicians, Bills, Earnings, Team, Records; B three: Week, People, Money; C two: People, Money): (1) What you land on, (2) Your clinicians and what a row may say, (3) Seats and the bill they move, (4) What the clinicians earned, (5) Your staff and who can do what; then "What has to be built underneath" list (seats do not bill, staff cannot be removed, no password reset, mockups follow).
- Components: `Block`, `Compare`, `Fill`, `Head`, `PickWide` from `components/design/wire`; `Link`.
- Decides: nothing (static, `noindex, nofollow`).
- Promises: **records C3/C4 as broken, in the product's own words** (comment lines 21 to 32, list lines 375 to 380): `organizations.seats` is written only from `app/(app)/billing/actions.ts:295` (therapist portal), so `takeSeat`/`releaseSeat` in the clinic portal "move the practice's bill by zero"; `seats.manage` gates nothing. Also: "A staff member cannot be removed. There is no remove action in the codebase, and no way to change a role" (line 383) and "No password reset" for the clinic portal (line 387). Consistent with what I read in app/(clinic)/clinic/team/actions.ts (no remove) and sign-in (no reset link).
- Notes: all English, exempt from i18n ratchet. Wireframe rows draw the rota WITHOUT patient names ("Mon 30 · Dr Nour · in person"), and B's rota says "No patient names on this screen" (line 159), while the built Option A shows names.

### app/(public)/design/clinic/sample/page.tsx (185 lines)
- For: the three clinic options drawn in real palette. STRUCTURE: `SampleIntro` (links to wireframes, patient and company samples); a three-column grid of `PortalOption` A/B/C, each a `Console` (browser frame with rail): A = `ConsoleHead` "This week", three `Stat`s (Seats 3 / $216 a month; Hours 6; Next bill 1 Apr), `Table` When/Clinician/Patient from `CLINIC_WEEK`; B = `WeekStrip` (local component, five day tiles with dot counts) plus the same table; C = `WeekStrip` plus `Table` Clinician/Licence/Earned from `CLINIC_TEAM` with `NO_CASELOAD` note; then "What is the same in all three" list.
- Components: `Console`, `ConsoleHead`, `PortalOption`, `SampleIntro`, `Stat`, `Table`, `Verified` (portal-kit), fixtures `CLINIC_TEAM`, `CLINIC_WEEK` (lib/marketing/fixtures), local `money` formatter.
- Promises: C2: the sample rota has a Patient column (line 45 `one.patient`, lines 119 and 137), and the "same in all three" list says "The rota shows a name and a time, because that is what the practice pays for" (line 171), i.e. this page accepts patient names, contrary to C2. C3: "Seats 3, $216 a month", "one bill, whole practice" is drawn but not built (see clinic/page.tsx).
- Notes: English only.

### app/(public)/design/company/page.tsx (401 lines)
- For: design review of the sponsor portal (task 138). STRUCTURE: hero (h1, intro "Eleven screens today", link to `/design/company/sample`, "Chosen: Option A · The desk" naming `components/sponsor/chrome.tsx`, option table A desk / B two questions / C one board); five `Compare` rows of three `PickWide`: (1) What you land on, (2) The pot and when it runs out, (3) Your people, (4) What you will never see, (5) Setting it up (code, domain, HR); then "Three things that are broken underneath" (expired pot still pays; no password reset; every demo-console button is a span).
- Components: imports `Block, Chips, Compare, Fill, Head, Option, Browser, PickWide` from components/design/wire (`Chips`, `Option`, `Browser` imported and unused).
- Promises: E1/E2: wireframes include "Sessions · week of 2 March · minus $630" ledger rows (line 188) and "runs out 31 March at this rate" (dates by week of spend), and "22 of 41 have used it" (take-up count, allowed by E1). Records **"An expired pot still pays. ... the row that funds a session never checks it and no sweep exists"** (lines 375 to 378) and **no password reset on the sponsor portal** (lines 381 to 385).
- Notes: carries the phrase "What you will never see" (line 270), one of the VALUE-STATEMENTS `where` phrases (E2), on a noindex design page as well as in `lib/content/defaults.ts`.

### app/(public)/design/company/sample/page.tsx (154 lines)
- For: the three sponsor options drawn properly. STRUCTURE: `SampleIntro`; three `PortalOption` columns, each a `Console`: A rail (Overview, Pot, People, Domains, Integrations, Settings, Billing) with `Pot`, three `Stat`s (Joined 63 of 240; Used it 40 this month; Code NILE), `Table` Clinician/Paid from `COMPANY_PAID` with the `WALL` note; B rail Money/People with loud `Pot`, Stats This month $1,880 40 sessions / Last month $1,640 36 sessions, Clinician/Paid table; C no rail, loud Pot, Stats Joined/Used/Per person $47, roster table Name/Cover/Since with `Verified`; "same in all three" list.
- Components: `Console, ConsoleHead, PortalOption, Pot, SampleIntro, Stat, Table, Verified`; fixture `COMPANY_PAID`.
- Promises: E1/E2 at risk in the proposal: a "Clinician / Paid" table (spend per named clinician) plus "Used it 40 this month" lets a small company infer who saw whom (one employee known to see Dr X). Monthly session counts ("40 sessions", "36 sessions") are "when" at month grain. Whether the built `/sponsor` does this: see sponsor notes.
- Notes: rail in A lists "Billing", which is not a sponsor route in this slice.

### app/(public)/design/page.tsx (283 lines)
- For: `/design`, the internal UI reference ("Internal", `noindex, nofollow`), organised by audience. STRUCTURE: header (eyebrow "Internal", h1 "UI reference", intro sentence, nav of three review links: `/design/patient`, `/design/company`, `/design/clinic`); Section 01 "The frames" (two `DeviceFrame`s: browser with path `/admin/actuals`, phone); Audience 02 "The therapist" (`ComponentShowcase` for transcript, note, risk, copilot, profile, plus `TherapistSplitDemo` "fee split"); Audience 03 "The patient" (`ComponentShowcase` for patient-app, patient-sessions, homework, journal, summary); Audience 04 "The company" (`CompanyDemo`); Audience 05 "The clinic" (`ClinicDemo`); Section 06 "Not placed in an audience" (any `CONTENT_DEMOS` name not in the two lists, excluding "none"); Section 07 "The grid, and the rule about counts" (four items two by two, six items two by three using `Tile`). Local components: `Section`, `Audience`, `Labelled`, `Tile` (no body field by design).
- Components: `ComponentShowcase` (components/demo/component-showcase), `DeviceFrame` (components/demo/device-frame), `ClinicDemo`, `CompanyDemo`, `TherapistSplitDemo` (components/public/audience-demos), `getDemoContent` (lib/content/demo), `CONTENT_DEMOS` (lib/db/schema).
- Decides: which demos sit in which audience row (lines 36 to 50).
- Promises: none directly; note line 164 "a practice sees schedules and bills and never a word of clinical content" (schedules carry patient names, see C2).
- Notes: STALE: section 07 "six items · two by three" renders `THERAPIST.slice(0, 6)`, and `THERAPIST` has five entries (line 36), so the six-item grid shows five tiles. No partner audience row although comment line 16 says "a company, a clinic and a partner had no demonstrable screen". English only.

### app/(public)/design/patient/page.tsx (772 lines)
- For: the patient app wireframed three ways (task 134). STRUCTURE: hero (h1 "drawn three ways, before anybody builds one", link to `/design/patient/sample`, "Chosen: Option A · Four tabs" naming `components/patient/bottom-nav.tsx`, option table A four tabs / B three tabs / C two surfaces, note that `/for-patients` mockups render the same components); twelve `Compare` rows, each three columns (`Option`+`Phone` in row 1, `Pick` elsewhere), each column a phone wireframe ending in `<Orb />` and `<Tabs>`: (1) The shell, (2) The first day with nothing in it, (3) Your sessions, (4) Finding somebody, (5) Booking one of them, (6) Joining a session with no account (`/join/[token]`; A three steps, B name plus recording consent on one screen, C consent asked inside the room), (7) Your record and who can read it, (8) What you have paid, (9) Your details and the Edit gate, (10) Steps and the journal, (11) Claiming a record, (12) While a session is running; then "What is the same in all three" list (SOS orb every screen, radar one press, details read only until Edit, price with tax, no empty state bigger than a row, no screen types to a model).
- Components: `Block, Chips, Cols, Compare, Empty, Fill, Head, Option, Orb, Phone, Pick, Tabs` from components/design/wire (`Cols` imported, unused); `Link`.
- Promises: P5 (orb in every wireframe), P1 (radar one press), P3 ("summary ready" rows), P4 (row 7). Row 8 option A says "You pay the therapist, never us" (line 522), which does not match the manual-transfer rail or the billing screen's "platform share" line. Row 11 records "today it loops without ever completing" about the claim path (line 657).
- Notes: "Chosen: Option A · Four tabs ... Home, Sessions, Therapists, Profile" while the built bar is Home, Sessions, lifted radar, Therapists, You (components/patient/bottom-nav.tsx:59 to 65) and billing moved to account: the chosen column is not exactly what shipped. Row 9 says "Today these fields are always editable and the app offers to change your number unprompted": matches app/(patient)/patient/account/page.tsx (IdentityEditor and ChangeNumber always shown). English only.

### app/(public)/design/patient/sample/page.tsx (101 lines)
- For: the three patient options drawn in the real frame. STRUCTURE: hero with links (wireframes, company, clinic); three `SampleRow`s (A Four tabs, B Three tabs one button, C Now and You) each rendering `OptionA/B/C`; "same in all three" list ("The SOS control is on every screen", "Nothing on any of these screens types to a model").
- Components: `OptionA`, `OptionB`, `OptionC`, `SampleRow` from ./samples.
- Notes: the list claims SOS on every screen; none of the three drawn options draws an SOS orb (samples.tsx has none and `DeviceFrame` has no SOS, grep). Link text "all twelve screens" matches the 12 Compare rows.

### app/(public)/design/patient/sample/samples.tsx (378 lines)
- For: client component file with the three option screens. STRUCTURE: shared pieces `Screen`, `Bar` (title, sub, bell icon), `NextSession` (teal card "Tomorrow, 18:00", Dr Nour Demo, "Open the room"), `SectionLabel`, `StepRow`, `RecordRow` ("Who can read your record" with count), `FreeChip`; `DOTS` from `RADAR_DEMO`; `OptionA` (phone with five tabs Home, Sessions, lifted Now, Therapists, You; free-now shelf, steps, record), `OptionB` (three tabs; steps, journal/summary tiles, record, sticky "Find someone now" button with "3 clinicians free this minute"), `OptionC` (two tabs Now/You; dark `#04101f` with `WorldRadar`, list of `RADAR_DEMO` clinicians with price and minutes, one navy row for tomorrow's session); `SampleRow` layout.
- Components: `DeviceFrame`, `WorldRadar` (components/radar/world-radar), lucide icons, `RADAR_DEMO` fixture, `cn`.
- Notes: comment 42 to 50 explains the i18n exemption for `app/(public)/`. No SOS orb drawn (see above). `"use client"` for a static page because `WorldRadar`/`DeviceFrame` need it. Hardcoded `#04101f`.

### app/(public)/design/portal-kit.tsx (286 lines)
- For: shared desk-screen kit for the clinic and company samples (not a route). Exports `Console` (browser window with optional rail), `ConsoleHead`, `Pot` (hardcoded $4,120 of $10,000, "Runs out 4 March", "40 sessions this month, at the rate you are going"), `Stat`, `Table` (with a note row stating what is not a column), `Verified` (verified/pending/none labels "Verified", "In review", "Not sent"), `PortalOption`, `SampleIntro`.
- Promises: E1 at risk in the proposal: `Pot` draws a run-out date and a monthly session count; E1's "balance is a published figure rather than a live one" is not represented.
- Notes: comment line 12 to 15 relies on `app/(public)/design/` being exempt from the i18n ratchet. Hardcoded English.

### app/(public)/developers/page.tsx (317 lines)
- For: public API docs for integrators. Screen: title and body, three use cases (readers and launch, recording a session that happened elsewhere, reading an approved note), the numbered integration flow (consent, media, transcript, note read, note approve, summary), mid-session consent box, copilot and memory box, the monthly limit box, widget, absences, four kept promises, keys and rate note, "Get started" to `PARTNER_APPLY`.
- Decides: nothing (static text plus `PARTNER_LAUNCH_TARGETS`).
- Promises: P3/T1 restated for partners (note is 404 while a draft, line 116). T5-like copilot answers with citations (line 216).
- Notes: STALE: `metadata.description` (line 12) and `devs.body` ("Five things you can do with our API") say five use cases; the page renders three since two were removed 2026-09-14 (comment 56 to 70). The comment line 29 to 32 says `verify:sprint55` resolves every printed path; the example bodies here (`clinicianEmail`, `externalMeetingId`, `offset_seconds`) disagree with the payload examples on `/integrations` (`clinicianRef`, `modality`, `scope`, `askedBy`), so one of the two is wrong. RTL: body via `t()`; code samples LTR inside `pre` (fine).

### app/(public)/for-clinics/page.tsx (100 lines)
- For: the clinic audience page. Screen: `AudienceHero` with `ClinicDemo` (the real clinic console), four Q and A, a "not yet" card linking `/integrations`. Next: `CLINIC_APPLY` or contact.
- Decides: CTA goes to `/clinic/apply` (fixed, comment 50 to 57).
- Promises: C1 to C5 are sold here via dictionary keys `marketing.clinics.*` (not read). The design review (design/clinic/page.tsx:31) says "Seats you buy" is the headline here while seats do not bill from the clinic portal.
- Notes: CTA label is `t("marketing.companies.cta")` ("Talk to us", line 63), a company key reused; harmless text but a key-coupling a translator will not expect. RTL via `t()`.

### app/(public)/for-companies/page.tsx (115 lines)
- For: the employer page. Screen: hero with `CompanyDemo` (renders `SpendHeatmap`, the real sponsor component), `SeesWhat` (can: count, spend, a weekly figure never a daily one; cannot: an individual, attendance, anything clinical), a three-step `FlowStrip`, CTAs to `/sponsor/apply` and contact.
- Promises: E1 (weekly figure is the granularity sold, `sponsor.apply.seesWeekly` "A weekly figure, never a daily one"), E2 ("never attendance"). Note E1's `where` card and "What you will never see" are in CMS defaults, not here.
- Notes: RTL via `t()`. `metadata.description` English only.

### app/(public)/for-therapists/page.tsx (165 lines)
- For: the clinician page. Screen: hero with `SessionDemo`, six feature bands with real components on fixtures (transcript, note, risk, copilot, patient sessions, radar), also-included list, `PricingTiers only={["payg","practice"]}`, close with signup/login.
- Promises: T1 (hero description line 14 "drafted by the time you stand up"), T5 (copilot demo), T3 (pricing tiers).
- Notes: comment 34 to 45 records two known defects kept off the page: the calendar shows an empty month (task 140) and the room has a 547px empty column for in-person sessions (task 136). RTL via `t()`.

### app/(public)/integrations/[slug]/page.tsx (86 lines)
- For: one integration: state, name, what it does today, what it does not do, "waiting on". Empty: 404.
- Notes: RTL: all headings hardcoded English ("All integrations", "What it does today", "What it does not do", "Waiting on ... We do not publish dates ..."). `generateMetadata` title English. Registry text (lib/integrations/registry) English.

### app/(public)/integrations/page.tsx (379 lines)
- For: integrations as a documentation page: what connects today (live/partial/planned), HR vendors, EHR vendors, get started, authentication, methods table, payload examples, use cases.
- Decides: `METHODS` list typed here (lines 73 to 82).
- Promises: E2-adjacent ("We never receive a name, a department..." for HR, line 140).
- Notes: RTL: the whole page is hardcoded English, the exemption `for-companies/page.tsx:43 to 47` calls out by name. Contradictions inside the product: "There is no self-serve key" (line 168) vs lib/partner/keys.ts:108 to 113 "A SANDBOX KEY IS SELF-SERVE"; "Nothing is signed with a shared secret" (line 199) vs webhook signing secrets (app/(partner)/partner/webhooks/actions.ts:37); comment line 49 "`/developers` ... is generated from the same constants the API uses" while `/developers` is hand-typed strings; payload shapes differ from `/developers` (see there). Comment 47 to 52 warns that two endpoint lists drift, and this page holds the second list.

### app/(public)/layout.tsx (47 lines)
- For: public chrome (`SiteHeader`, `SiteFooter`) and `hreflang` alternates from `x-pathname`.
- Promises: none.
- Notes: the design pages under this layout get the marketing header and footer.

### app/(public)/page.tsx (26 lines)
- For: `/`, the CMS home rendered from `getPublicPage("home")`.
- Promises: this is where the `where` phrases for P1 ("Somebody who is free now"), T1 (how-it-works card), T2 (room card), C1/C2 ("Seats and the people on them"), C3/C5 ("One set of books"), E1 ("The pot, and what is left in it") and E2 ("What you will never see") are rendered; all seven phrases exist in `lib/content/defaults.ts` only (grep of app, components, lib); published rows may differ (H28). Of these, the clinic card promises C2 "no caseload count" beside a portal that shows names (see /clinic).
- Notes: `revalidate = false`; `notFound()` if the home row is missing, so a missing CMS row 404s the front door.

### app/(public)/radar/actions.ts (449 lines)
- For: public radar: `reserveForViewing` (tab hold), `releaseViewing`, `bookFromRadar` (guest session now), `emailDirections` (walk-in directions).
- Decides: four throttles on booking (6 per 15 min per network, global 60 per minute, per clinician 3 per 15 min, one hold per network) lines 146 to 196; availability re-read from `listRadar(viewer)` not the form (line 167); session created, then conditional claim; the previous hold from the same network is released UNLESS paid or patient already joined (lines 287 to 318, a production incident written up in 244 to 286); no video room means booking abandoned and claim released (lines 336 to 351); free sessions go straight to `joinUrl`, paid ones to `/pay/<joinToken>`.
- Assumes: the pot is charged on the join page when the patient identifies (lib/data/sessions.ts:346 to 359), because a radar session has no patient row.
- Promises: **P1**: radar to room is: tap clinician (sheet), give a name, submit; free sessions land in the room; a PAID session goes to `/pay` (choose country, then for Egypt a bank transfer an operator confirms, A1), so P1's three taps hold only for a free clinician. **P5**: error copy tells the reader to call the local emergency number (lines 153, 161). E5 path starts here (pot applied at join).
- Notes: RTL: every error string is English (lines 122 to 227, 349); `"minute" + (retryAfter > 60 ? "s" : "")` pluralises on seconds, so 61 to 119 seconds prints "Try again in 2 minutes" and exactly 60 prints "1 minute"; fine, but 1 to 60 rounds to 1. A signed-in patient booking from `/patient/radar` books as a GUEST (form carries only name, email, viewer), so the session is not on their record until the join page links it (handled there per sessions.ts comment).

### app/(public)/radar/page.tsx (58 lines)
- For: the public crisis radar, full bleed, per request. Screen: `RadarConsole`, `RadarSafetyLine`, `SosOrb` with country from locale. Next: pick a clinician. Empty: in `RadarConsole`.
- Promises: P1 (the front door), P5 (orb here "most of all", comment 43 to 54).
- Notes: RTL: `SosOrb` country from locale, not the reader's number (anonymous). Metadata English. Hardcoded `#04101f`.

### app/(public)/t/[id]/book/actions.ts (178 lines)
- For: `book` an hour from a public profile, unauthenticated: throttles per caller (6/h), per slot (12/h), per clinician (40/h); name plus email or phone required; phone to E.164 with explicit country; hold then book; confirmation via `notify` with link `/sessions/<sessionId>`.
- Decides: `formatWhenWithCaveat(result.startsAt, zone, "en")` (line 152): the confirmation AND the on-screen `booked.when` are always English.
- Promises: P2 (the in-app half: booking returns `confirmationSent` and channel so the screen can say whether anything was sent, comment 139 to 144). T4-adjacent.
- Notes: the confirmation link is `/sessions/<sessionId>` (line 160), i.e. the SESSION UUID travels in email and WhatsApp; that uuid is the capability `app/(patient)/sessions/[id]/recovery-actions.ts` accepts to record a no-show, cancel and refund, or reassign the session (see Broken). RTL: all strings English.

### app/(public)/t/[id]/page.tsx (72 lines)
- For: a clinician's public shareable profile, indexable, with SOS orb. Next: book or talk now. Empty: 404 / "Clinician not found".
- Promises: P1, P5.
- Notes: metadata strings English ("takes sessions on 24Therapy", "Clinician").

### app/(public)/verify/[code]/page.tsx (21 lines)
- For: `/verify/<code>` redirects to `/verify?code=`.
- Notes: none.

### app/(public)/verify/page.tsx (103 lines)
- For: public check of a record extract code: produced on, sessions, signed notes, summary versions; no name, no clinician.
- Decides: `verifyExtract(code)`; GET form.
- Promises: P4-adjacent (portable record can be checked by a third party without identifying the person).
- Notes: RTL: entirely hardcoded English, and `issuedAt.toISOString().slice(0,10)` raw ISO (line 75). No rate limit visible on an unauthenticated lookup (12-character space, low risk).

### app/(sponsor)/layout.tsx (90 lines)
- For: sponsor shell `SponsorChrome`, no crisis orb (comment 21 to 27); a `PendingBar` for a signed-in sponsor's pending bank transfer (76.4).
- Decides: `bare` on exact `SPONSOR_SIGN_IN`; pending payment read on every render.
- Promises: A1/A3 (the payer sees their transfer is in the queue; whether a rejection sentence reaches this bar is inside `pendingPaymentFor`, not in slice).
- Notes: RTL: language switch in the rail (comment 49 to 56).

### app/(sponsor)/sponsor/apply/actions.ts (37 lines)
- For: corporate enquiry; HELD account only; kind company or university; 5 per hour.
- Notes: English errors.

### app/(sponsor)/sponsor/apply/page.tsx (58 lines)
- For: corporate door. Screen: title, form, `SeesWhat` (can: a count, spend, a weekly figure never daily; cannot: an individual, attendance, anything clinical). Next: submit.
- Promises: E1, E2 said before the sale.
- Notes: RTL via `t()`, metadata English.

### app/(sponsor)/sponsor/code/actions.ts (36 lines)
- For: `replaceCode` (rotate the joining code), admin, audited.
- Promises: none of the 25.

### app/(sponsor)/sponsor/code/page.tsx (94 lines)
- For: the joining code, a server-made QR of `/patient/benefit?code=XXXX`, the poster line, and the attempts count on the code (53.19 spike). Next: print, rotate (admin). Empty: `sponsor.codeNone`.
- Decides: `attemptsOnCode` reads the raw `rate_limits.count` for the code (lib/data/sponsors.ts:356 to 366), no activity floor.
- Promises: **E1 "never when" at risk**: the attempts counter is live and unsuppressed; an HR admin reloading the page watches it go from 3 to 4 while a known employee stands at the poster. It counts enrolment attempts, not sessions, but it is exactly the "who and when" signal about somebody trying to get therapy. Suspect.
- Notes: RTL: poster line localised; QR itself fine.

### app/(sponsor)/sponsor/domains/actions.ts (144 lines)
- For: `addSponsorDomain` (admin; returns DNS token), `checkDnsRecord` (live TXT lookup against the per-domain token, scoped by the sponsor's own list), `confirmDomainMailbox(domainId, token)` (NO session: HMAC token is the authorisation, constant time).
- Promises: none of the 25 (domain proof gates the joining code, C318).
- Notes: English error strings.

### app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx (49 lines)
- For: the mailbox proof link clicked by an IT contact who "may have no account here at all" (comment 12 to 24). Renders `ConfirmDomain`.
- Notes: **Broken, see there**: the path is under `/sponsor`, and `lib/routing.ts:299` lists only `SPONSOR_APPLY` as open for the sponsor principal; `routeDecision` (lib/routing.ts:371 to 385) redirects any unsigned request under the prefix to `/sponsor/sign-in`. The link is built at lib/data/sponsor-domains.ts:112. An IT contact without a sponsor cookie lands on the sign-in page and cannot complete the proof; a sponsor whose IT contact is not the portal admin can never issue a code. Hardcoded English title/subtitle.

### app/(sponsor)/sponsor/domains/page.tsx (65 lines)
- For: domains with two proofs each (mailbox, DNS) plus by-agreement, and `domainProblem` computed server side. Next: add domain, check DNS. Empty: in `DomainList`.
- Notes: RTL: `PageHeader` title and subtitle hardcoded English ("Your domains", "Two proofs for each one..."). Only screen in the portal not through `t()` besides confirm.

### app/(sponsor)/sponsor/integrations/actions.ts (115 lines)
- For: HR connection: `setVerification` (on/off, off revokes every key), `mintHrKey` (raw key once, prefix in audit), `revokeHrKey`. All `requireSponsorAdmin`; sponsor id from session only.
- Promises: E2-adjacent (employment verification answers one question about one person, C227).

### app/(sponsor)/sponsor/integrations/page.tsx (79 lines)
- For: HR connection screen: enabled, HR system, keys with last success, delivery log (event, status, attempts, error, time), failed attempt count.
- Promises: E2: delivery rows are HR webhook events (employment checks), timestamped to the minute (`formatDateTime`). If an event is emitted when a specific employee enrols, the delivery timestamp is "somebody enrolled at 10:42"; Suspect, depends on `deliveriesFor` event types (lib/data/sponsor-integrations).
- Notes: `suspendedReason ?? "Suspended"` English fallback.

### app/(sponsor)/sponsor/page.tsx (255 lines)
- For: sponsor overview. Screen: pot card (published balance or "suppressed", expiry, a bar and a runway/percent line, all suppressed with the balance), two side cards "spent total" and "sessions total", "no pot" card, weekly spend heatmap (hidden entirely under the headcount floor), why-weekly note. Next: the rail (pot, people, code...). Empty: `sponsor.noPot`, `sponsor.suppressed`.
- Decides: `potBalance` (published, C377) for the balance; headcount floor gates the weekly series before it is fetched (lines 76 to 77); derived figures suppressed with the balance (lines 97 to 105).
- Assumes: `potTotals` (lib/billing/pot.ts:997 to 1016) is a LIVE `SUM` and `COUNT` over `ledger_entries` with no floor.
- Promises: **E1 broken**: the "spent total" (line 198) and "sessions total" (line 205) cards are live and unsuppressed and sit beside a balance that is carefully published in batches. A sponsor reading the overview on Monday and Tuesday sees sessions go from 11 to 12 and spend rise by one session's sponsor share: that is when, and what one session cost, which is exactly the differencing attack the C377 comment (lines 51 to 60) says the published balance exists to stop. `usedPercent` mixes the published balance with the live spend (line 104), so it drifts too, though it is suppressed when the balance is. E2: no name, time or attendance on the screen (kept).
- Notes: RTL: money via `Intl` with ar-EG, dates via `formatDate`. The overdraft/negative case has no wording here: a published negative balance renders as a negative currency figure.

### app/(sponsor)/sponsor/people/actions.ts (74 lines)
- For: `endBenefit(enrolmentId, reason)`, the sponsor's only individual power; admin; fixed reasons; audited with enrolment id, not the patient.
- Promises: E4 is about coverage, not this; removal ends funding and badge only (C234). Patient side reads "your benefit has ended" with no employer named (notices page comment).

### app/(sponsor)/sponsor/people/page.tsx (72 lines)
- For: roster: name, last verified (the sponsor's cycle date, same for everybody, C256), paused; count; verify cycle note. Next: remove (admin). Empty: in `RosterList`.
- Promises: E1 ("how many people", yes; never who used it: the roster is who ENROLLED, not who used it; kept). E2 kept: no session, no date of joining. **E4**: coverage is not shown per person, so at 0% the employee stays on this list with no "removed" state (kept by construction on this screen).
- Notes: RTL via `t()` and `formatDate`.

### app/(sponsor)/sponsor/pot/[txn]/page.tsx (148 lines)
- For: printable VAT invoice for one top-up (server rendered, browser prints). Refuses with "not yet" when legal name, address or tax id missing.
- Decides: `invoiceFor(sponsorId, txn)` scoped by session sponsor.
- Promises: E2 kept (no person, session or date beyond the top-up's own).
- Notes: RTL: money formatted `en-US` always (line 68) even for Arabic, unlike every other sponsor screen.

### app/(sponsor)/sponsor/pot/actions.ts (316 lines)
- For: `addToPot` (card rail, `topUpPot`), `setCoveragePercent` (increase immediate, decrease after notice days, message localised), `declarePotTransfer` (Egyptian manual rail: min and max, VAT added server side, optional proof upload, `declarePaid` with the sponsor id as ref so one live claim per company), `openPotPayment` (opens a cart with credit and VAT line items).
- Decides: amount in whole units converted once (lines 28, 170); `sponsorNeedsTransfer` rechecked (line 236).
- Promises: **E3**: the asymmetry (decrease waits) lives in `setCoverage`, not here; whether a BOOKED session keeps its old share depends on when the split is frozen: schema says "as it stood at booking" (lib/db/schema.ts:2226 to 2232) but lib/billing/pot.ts:541 to 543 writes `coverageBps` when the pot PAYS; if payment happens after booking, a decrease between the two reprices (Suspect, pot.ts owner). **E4**: `percent` is only checked `Number.isFinite` here (line 83); 0 is accepted and the message then says the employee pays 100 per cent (`coverageNow` with `100 - percent`), no "removed" wording (kept here). A1: transfer is a claim, an operator credits (kept by shape). A2: one live claim per company via unique index (kept here).
- Notes: RTL: error strings English (lines 29, 83, 171, 192, 203, 237). Proof upload `userId: actor.sponsorUserId` under kind `receipt`.

### app/(sponsor)/sponsor/pot/page.tsx (274 lines)
- For: the pot. Screen: published balance as a `Meter` against the last top-up with expiry (or the suppressed card), `CoverageForm` (the coverage slider, admin, with pending change and date), the payment popup for the Egyptian rail with a stepper ladder, or the card `TopUpForm`, or read-only terms for a viewer, "no pot" card when terms missing, invoice history. Next: top up, change coverage, open an invoice.
- Decides: forms only when terms exist (C233); one rail per sponsor.
- Promises: **E1**: balance published (kept on this page). **E3/E4**: the slider is `CoverageForm` (component not in slice), fed `balanceUsd` from the published balance, 0 when suppressed (line 178), so any runway maths in the slider on a suppressed pot starts from $0. Negative balance: `potBalance` returns `overdraftCents` and this page never reads it; a negative published balance renders as a negative figure in `Meter` with `fraction > 1` and no words about overdraft or who covers it (no negative-balance wording exists in this slice).
- Notes: RTL: dates `formatDate`, money ar-EG. `viewerName: actor.email` shown as the payer name in the popup.

### app/(sponsor)/sponsor/settings/actions.ts (97 lines)
- For: `addGate` (identifier kind), `dropGate`, `setPublicListing` (C236, unlisted default). Admin, audited.
- Notes: `dropGate` audits even when `removeIdentifierField` removed nothing (no result checked).

### app/(sponsor)/sponsor/settings/page.tsx (63 lines)
- For: "How people join": gates and public listing (admin) or a read-only list (viewer); verify cycle note.
- Promises: none of the 25.
- Notes: RTL via `t()`.

### app/(sponsor)/sponsor/sign-in/actions.ts (44 lines)
- For: `signInSponsor` 8 per 15 min on the way in; `signOutSponsor`.
- Notes: no password reset anywhere in the sponsor group (matches design/company/page.tsx:381 to 385).

### app/(sponsor)/sponsor/sign-in/page.tsx (38 lines)
- For: sponsor door, `AuthShell who="company"`, no forgot link.
- Notes: RTL via `t()`.

### app/global-error.tsx (57 lines)
- For: last-resort boundary replacing the root layout; own `<html lang="en">`, inline styles, "Something went wrong", "Try again".
- Promises: P5 not kept on this path: no SOS orb. Patient routes have their own boundary with the orb (app/(patient)/error.tsx); `/radar`, `/t/[id]`, `/join`, `/pay` (public patient-facing doors outside the patient group) fall through to this one on an unhandled throw and lose the orb.
- Notes: RTL: hardcoded English and `lang="en"` with no `dir`; an Arabic reader gets English LTR. Hex colours inline (documented reason, lines 40 to 43).

### app/globals.css (397 lines)
- For: design tokens (Tailwind v4 `@theme`): navy ramp desaturated at the light end, `brand-*` = the mark's teal (500 #2ec4b6, navy ink on it), `teal-*` reserved for radar/live files (enforced by `verify-palette`), system font stack, radii; base layer (page texture of two washes plus a dot grid, suppressed when `[data-surface="room"]` is present; 16px inputs; focus ring brand-700; reduced-motion kills animation); utilities (`safe-bottom`, `safe-top`, `tap-target` 44px, `no-scrollbar`, `text-balance`, `live-dot`, `fill-rule` with an RTL origin flip, `animate-fade-rise`, `wave-bar`, `radar-sweep`, `radar-ping`).
- Promises: none.
- Notes for the redesign: no dark-mode tokens; no Arabic typeface in `--font-sans` (system fallback only); `fill-rule` is the only RTL-aware rule in the file. STALE numbers: line 64 says the teal buttons "now carry navy at 7.71:1" while the ramp table (line 136) and line 122 say navy on #2ec4b6 is 7.27:1; line 62 "hover state went to 600, which is 3.22:1" while the table gives 600 on white 3.34 (brand-600 is #1f9d92, teal-600 #23a094: two different 600s).

### app/layout.tsx (92 lines)
- For: root layout: `lang` and `dir` from `getLocale()`/`dirFor` on `<html>` (server, never client-toggled), `I18nProvider` with admin overrides (failure swallowed), `SimulationBanner`.
- Promises: RTL foundation for every page.
- Notes: default `metadata` title "24Therapy, your session notes, written for you" and description "Record a therapy session on your phone and walk away with a SOAP note, clinical insights and a report you can send to your patient" (lines 10 to 14): English only, not localised for `/ar`, and "a report you can send to your patient" sits awkwardly against P3 (a patient receives only a signed summary/brief). `robots: index true` default; pages opt out one by one.

### app/manifest.ts (36 lines)
- For: PWA manifest, `start_url: /patient`, standalone, portrait.
- Notes: English only name/description; a clinician who adds the site to a home screen lands on the patient app. Description "Your sessions, your notes" (a patient never sees a clinical note, §6) is loose wording.

### app/not-found.tsx (30 lines)
- For: localised 404 with a Home button. RTL via `t()`.
- Notes: renders outside every route-group layout, so inside the patient app a 404 has no orb and no nav.

### app/robots.ts (62 lines)
- For: robots rules. `SIMULATION_RUNNING` (lib/env.ts:159, `process.env.SIMULATION_RUNNING === "1"`) disallows everything; otherwise allow `/` and disallow `/join/`, `/dashboard`, `/sessions`, `/patients`, `/notes`, `/copilot`, `/on-call`, `/billing`, `/settings`, `/admin`, `/api/`, `/login`, `/signup`, `/reset-password`, `/forgot-password`.
- Promises: none directly.
- Notes: the comment (lines 8 to 15) says "Everything behind a login ... must not be" crawled, but the list omits `/patient`, `/clinic`, `/sponsor`, `/partner`, `/staff`, `/design`, `/pay/` (a token URL, like `/join/`), `/records/`, `/feedback/`, `/verify`. Each page has `noindex` in metadata, so this is belt-without-braces rather than a leak; `/pay/<joinToken>` crawled is the same class as `/join/` the comment calls out.

### app/sitemap.ts (53 lines)
- For: sitemap: `/`, `/radar`, and every published CMS slug, once per locale with alternates. `revalidate = 3600`.
- Notes: the hand-built public pages (`/for-clinics`, `/for-companies`, `/for-therapists`, `/developers`, `/integrations`, `/integrations/*`, `/verify`) are not CMS rows and never appear in the sitemap. `revalidate = 3600` is the hourly database touch that app/(public)/[slug]/page.tsx:8 to 15 removed from pages for keeping the database awake (only when a crawler asks, so minor).

## Stale

1. app/(partner)/partner/actions.ts:35 to 39: "`mintKey` refuses `employment:verify` without one". lib/partner/keys.ts:94 to 106 says that check was removed 2026-09-14; `sponsorId` is still accepted and written (keys.ts:151) for no purpose.
2. app/(partner)/partner/actions.ts:81 to 94: comment says "Who raised it, and when ... has to come from a row"; the audit row has `actor: null` and no partner-user id, so it records which partner, not who.
3. app/(patient)/patient/consent/page.tsx:187: "`SeesWhat` above now carries it as `consent.canKeep`"; the key rendered is `consent.mayKeep` (line 119).
4. app/(patient)/patient/messages/page.tsx:39: "Check-ins is reached from the account screen"; the account page has no link to `/patient/messages` and nothing else links to it.
5. app/(patient)/patient/notices/page.tsx:33: "Dismissing takes an entry out of the main view"; there is no main view, `noticesFor` has one caller (this page) and nothing links here.
6. app/(patient)/layout.tsx:10 to 12: "the radar and the live session ... are not in this route group"; `/patient/radar` IS in the group (only the public `/radar` is not).
7. app/(clinic)/clinic/export/route.ts:46 to 50: "the screen this mirrors shows one week at a time"; the export window is 180 days.
8. app/(public)/developers/page.tsx:12 and `devs.body` (lib/i18n/messages.ts:2209): "Five things you can do"; three use cases render since two were deleted (comment 56 to 70).
9. app/(public)/integrations/page.tsx:49 to 50: "`/developers` holds every endpoint ... generated from the same constants the API uses"; `/developers` is hand-typed strings, and the two pages' payload examples disagree.
10. app/(public)/integrations/page.tsx:168: "There is no self-serve key"; lib/partner/keys.ts:108 to 113 "A SANDBOX KEY IS SELF-SERVE". Line 199 "Nothing is signed with a shared secret"; webhooks hand the partner a signing secret (app/(partner)/partner/webhooks/actions.ts:37).
11. app/(public)/design/page.tsx:200 to 206: "six items · two by three" renders `THERAPIST.slice(0, 6)` of a five-item list.
12. app/(public)/design/patient/page.tsx:94 to 99: "Chosen: Option A · Four tabs ... Home, Sessions, Therapists, Profile"; shipped bar is Home, Sessions, lifted radar, Therapists, You (components/patient/bottom-nav.tsx:59 to 65).
13. app/(public)/design/patient/sample/page.tsx:85 and samples.tsx: "The SOS control is on every screen" in all three options; none of the three drawn options draws one.
14. app/globals.css:62 and 64: 3.22:1 and 7.71:1; the computed table in the same file gives 3.34 and 7.27.
15. app/(public)/design/*/page.tsx imports unused: company/page.tsx imports `Chips`, `Option`, `Browser`; patient/page.tsx imports `Cols` (dead imports).
16. app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx:12 to 24 "NO GUARD": the page has no guard of its own but the router guards it (see Broken 5); the comment describes a door that is shut.
17. app/(public)/design/clinic/page.tsx:159: wireframe B "No patient names on this screen"; the chosen and built Option A shows patient names.

## Suspect

1. lib/data/clinic.ts:653 to 667 (rendered by app/(clinic)/clinic/bills/page.tsx:125): `SUM(i.amount_cents - i.discount_cents)` over `invoices LEFT JOIN invoice_lines` counts each invoice once PER LINE. An invoice with a platform line and an AI line doubles its total. scripts/verify-sprint54.ts:588 to 592 asserts platform + ai === total, which only catches this if its fixture invoice has two non-zero lines. Owner: lib/data/clinic.ts reader.
2. app/(sponsor)/sponsor/pot/actions.ts and lib/billing/pot.ts:541 to 543: E3 says the share is frozen at BOOKING (schema comment lib/db/schema.ts:2226 to 2232); pot.ts writes `coverageBps` when the pot PAYS. If payment is later than booking, a coverage decrease in between reprices a booked session. The notice window in `setCoverage` may cover it. Owner: lib/billing/pot.ts.
3. app/(sponsor)/sponsor/code/page.tsx:52: `attemptsOnCode` is a live, unsuppressed counter of enrolment attempts; watched on refresh it says when somebody tried to join. E1 "never when".
4. app/(sponsor)/sponsor/integrations/page.tsx:68 to 76: HR webhook deliveries timestamped to the minute; if an event fires per enrolment or per employment check triggered by one person, it dates an individual's enrolment. Owner: lib/data/sponsor-integrations.
5. app/(clinic)/clinic/records/page.tsx:52 to 62: filing log shows each signed note's approving clinician and time (up to 100), which is notes per clinician (a caseload proxy, C2) and `lastError` raw from a hospital server may quote patient identifiers.
6. app/(clinic)/clinic/team/actions.ts:112 to 118: `inviteStaff` takes the new staff member's PASSWORD from the admin's form, so an admin knows a colleague's password; no reset or forced change is visible. design/clinic/page.tsx:324 and 383 say staff cannot be removed or have a role changed either.
7. app/(clinic)/clinic/join/[token]/actions.ts:72 to 80: a failed `cancelSubscription` (Stripe) only logs; the clinician is billed for their own plan and the seat, nobody is told. For an Egyptian clinician on the manual rail, `lib/billing/stripe.cancelSubscription` may be the wrong function entirely.
8. app/(clinic)/clinic/join/[token]/page.tsx:38 and app/(patient)/patient/record/page.tsx:38: a GET render stamps `terms_shown_at` / `clinic_visibility_shown_at`; link previewers and mail scanners stamp them too, so "proof we said it" is proof a URL was fetched.
9. app/(clinic)/clinic/records/actions.ts:27 to 35: `fhirBaseUrl` from the form is fetched server side by `beginConnection` (SSRF surface; check lib/data/ehr validation). Same shape: partner webhook URLs (lib/partner/webhooks).
10. app/(clinic)/clinic/people/actions.ts:62: a clinician job invitation uses `notify` kind `claim.invite` (the patient claim kind); the in-app rendering or template for that kind may describe a record claim.
11. app/(patient)/patient/billing/page.tsx:181 to 189: "therapist fee" shows `grossCents`, which includes the platform fee (therapist net = gross minus fee, schema 2253), so the three lines do not sum to the headline.
12. app/(patient)/patient/login/page.tsx and app/(patient)/patient/invite/[token]/page.tsx:95: the invite sends `?next=/patient/invite/<token>`; whether `PatientAuthForm` honours `next` is not visible in this slice.
13. app/(patient)/patient/forgot-password/page.tsx: reset code "goes over WhatsApp"; claim/actions.ts:92 to 95 says WhatsApp is not wired. A patient with no email may have no working reset.
14. app/(patient)/error.tsx:60: `<SosOrb />` with no phone or country; the default line shown on an error may be the wrong country.
15. app/(public)/contact/actions.ts:37 to 40: a filled honeypot returns a fake reference "RECEIVED"; a password manager or autofill that fills a hidden `website` field silently drops a real message that may be clinical.
16. app/(patient)/patient/residency/actions.ts:21: locale falls back to "en" on error, so the consent record can claim English wording was read.

## Broken

1. **Anybody holding a session id can take over, cancel-and-refund, or no-show any session that has not started.** app/(patient)/sessions/[id]/recovery-actions.ts:55 to 182 is unauthenticated by design ("the session id is the capability"); the five-minute wait lives only in the client (components/session/no-show-recovery.tsx:65). Server side, `reassignSession` and `refundNoShow` refuse only `startedAt IS NOT NULL` or an existing outcome (lib/data/recovery.ts:175 to 180, 296 to 301), and `offerReplacements` stamps `noShowAt` on any unstarted session (recovery-actions.ts:79). So a week before a booked session: `takeRefund` cancels it and refunds it; `takeReplacement(sessionId, anyUserId)` moves it to any non-deleted user whose rate is at or below the price, including an unverified clinician with no rate, and lib/data/recovery.ts:160 to 165 says that "is the same act as granting somebody full read on its transcript, its note and the patient's chart"; `offerReplacements` lowers the real clinician's reliability score. The id is not secret: the booking confirmation sends `/sessions/<sessionId>` by email/WhatsApp (app/(public)/t/[id]/book/actions.ts:160). A person would see: their appointment cancelled, or a stranger in their clinician's place. Grep found no scheduled-time check in either file.
2. **Claiming somebody else's record needs only their person uuid.** app/(patient)/patient/claim/actions.ts:97 to 160 takes `personId` from the client; `startClaim` (lib/data/claims.ts:200 to 216) checks only that the person exists and is unclaimed; the code is sent to the CALLER's own email/phone (actions.ts:119); `verifyClaim` (claims.ts:304 to 320) checks claim, account, code, expiry. Nothing re-checks that the person matched this account's proven handle (that check lives only in `mySuggestions`, actions.ts:76 to 85). Exploit needs an unclaimed person's uuid; the outcome is ownership of their therapy record and the grant decision.
3. **Sponsor overview shows live spend and live session count beside the published balance** (E1). app/(sponsor)/sponsor/page.tsx:195 to 207 renders `potTotals` (lib/billing/pot.ts:997 to 1016, live SUM and COUNT, no floor). Two visits a day apart give the date and the sponsor share of one session, the exact differencing the C377 comment on lines 51 to 60 says publishing the balance prevents.
4. **The clinic portal shows patient names and a cancelled badge per patient** (C2 as written). app/(clinic)/clinic/page.tsx:201, 206 to 210; export of 180 days of the same as CSV, app/(clinic)/clinic/export/route.ts:42 to 53. Deliberate (C260, `clinic.scheduleBody` "a name and a time, because you pay for the hour"; the patient is told on /patient/record), so this is the promise and README disagreeing, settled in README's favour: C2's "no patient name on any screen" is false.
5. **The sponsor's domain mailbox proof link cannot be opened by the person it is sent to.** Link built at lib/data/sponsor-domains.ts:112 as `/sponsor/domains/confirm/<id>?t=`; lib/routing.ts:299 opens only `/sponsor/apply` inside `/sponsor`; `routeDecision` (lib/routing.ts:371 to 385) redirects an unsigned visitor to `/sponsor/sign-in`. The page's own comment says the clicker "may have no account here at all". A company whose IT contact is not a portal admin can never finish domain proof, so never issues a joining code. A person would see: the sign-in page.
6. **Patient billing says "Covered" for a partly covered session.** app/(patient)/patient/billing/page.tsx:79, 149 to 179 branch on `fundingSource === "pot"` and never select `patientShareCents`; lib/billing/pot.ts:541 to 559 writes one row per session with `fundingSource: "pot"` and `patientShareCents = gross - sponsorShare`. At 10 per cent cover (the `money` position) the patient paid 90 per cent and reads "Covered" with no amount. No app/(patient) file reads the patient share (grep).
7. **The in-app notice log has no door** (P2). /patient/notices is linked from nowhere and `noticesFor` has no other caller (grep of app, components, lib). Same for /patient/messages and /patient/residency (screens with no door).
8. **Clinic seats never move the clinic bill** (C3, C4). The clinic bills screen reads only per-session invoices (`i.session_id IS NOT NULL`, lib/data/clinic.ts:664), shows no seat; `organizations.seats` is written only from the therapist portal (app/(app)/billing/actions.ts:295, recorded by app/(public)/design/clinic/page.tsx:21 to 32 and 375 to 380). Removing a clinician (app/(clinic)/clinic/people/actions.ts:114) shows no bill effect.
9. **Every partner admin sees the names of all our active sponsor companies.** app/(partner)/partner/page.tsx:41 calls `sponsorChoices()` (lib/data/partner-admin.ts:258 to 264, every `state = 'active'` sponsor), for a scope that is no longer a partner scope (lib/partner/keys.ts:94 to 106). C319/C349 treat "which companies buy therapy for staff" as a fact a company publishes or not; this lists all of them to third parties.

## Looks broken, is handled

1. A signed-in patient booking from `/patient/radar` books as a guest (app/(public)/radar/actions.ts:117 to 206, no patient id) so no pot is applied at booking: handled at the join page, which links the person and charges the pot (lib/data/sessions.ts:346 to 359).
2. The radar hold releases "the previous booking from this network" (app/(public)/radar/actions.ts:239 to 243), which on CGNAT is somebody else's: guarded twice so a paid or joined session is never cancelled (lines 287 to 318).
3. `/patient/claim` could reveal that a stranger's number is in therapy: suggestions only on a PROVEN handle (claim/actions.ts:61 to 78; claim/page.tsx:77 to 81).
4. The sponsor balance moving per session: `potBalance` publishes only after `activityFloor` sessions (lib/data/sponsors.ts:241 to 266), used by both sponsor pages; but see Broken 3 for the cards beside it.
5. The clinic invoice could tie an AI fee to a named patient's consent: bills are summed by month and kind with no session id (lib/data/clinic.ts:636 to 667), and the schedule select has no consent column (app/(clinic)/clinic/page.tsx:29 to 33).
6. A crashed patient page used to lose the SOS orb: app/(patient)/error.tsx now keeps it (only global-error still drops it, see its entry).
7. Partner deliveries could resolve to a patient: the subject id is opaque and never resolved (app/(partner)/partner/deliveries/page.tsx:22 to 26, 73 to 76).
8. The clinic "earnings" page could let a manager move a colleague's money: `requestPayout` needs a clinician `Actor` nothing in the clinic group can produce (app/(clinic)/clinic/earnings/page.tsx:21 to 25).
9. Sponsor coverage decrease applying instantly: asymmetry is in `setCoverage` with a notice window (pot/actions.ts:71 to 74, message 131 to 137); see Suspect 2 for the booking-time question.

## Unclaimed

(a) worth selling, nothing advertises it
- app/(patient)/sessions/[id]/recovery-actions.ts: a no-show is rescued in the moment: a replacement clinician at or below the paid price with the difference as credit, or a full refund including our fee (once it is locked down, see Broken 1).
- app/(patient)/patient/consent/actions.ts:113 to 130: "ask my previous therapist to add my history", with a guaranteed answer (C108).
- app/(patient)/patient/consent/actions.ts:154 to 176: a patient can cut a partner platform's link to them (C277).
- app/(public)/verify/page.tsx: a third party can check a record extract's authenticity without learning who it is about.
- app/(patient)/patient/assessments: questionnaires with the patient's own score history, no bands (C113).
- app/(patient)/patient/messages: check-ins with an opt-out screen and crisis routing of replies.
- app/(clinic)/clinic/records: EHR connection and note write-back for a practice.

(b) nobody should have it, a hole
- Session id as a capability for reassignment and refund with no time bound (Broken 1).
- Claim by person uuid (Broken 2).
- Partner admin sees every sponsor's name (Broken 9).
- Sponsor attempts counter live (Suspect 3).
- Clinic admin sets staff passwords (Suspect 6).
- Clinic filing log, notes per clinician with times (Suspect 5).

(c) half built, a lifecycle with no way out or a screen with no door
- /patient/notices, /patient/messages, /patient/residency: no links (Broken 7).
- Clinic and sponsor and partner portals: no password reset (sign-in pages have no link; design pages confirm "no route, no link").
- Clinic staff: no remove, no role change (design/clinic/page.tsx:382 to 384; no action in team/actions.ts).
- Clinic seats: `quoteSeatChange`/`applySeatChange` reachable only from the clinician portal (Broken 8).
- Sponsor domain mailbox proof: link redirected to sign-in (Broken 5).
- /clinic/join/[token] expired state and /patient/invite/[token] used state: a sentence and no link anywhere.
- Expired pot still pays (recorded at app/(public)/design/company/page.tsx:375 to 378; not verifiable from this slice).

## Promise evidence

- P1: radar is one tap from Home when anybody is live (app/(patient)/patient/page.tsx:211 to 227), then sheet, name, submit (app/(public)/radar/actions.ts). Free clinician: plausibly three. Paid clinician: `/pay` then a bank transfer an operator confirms. Verdict: partly (free sessions only).
- P2: orb in the chrome on every patient page, state `owes | ready` only for an OPEN session (app/(patient)/layout.tsx:69 to 80, components/patient/chrome.tsx:40); session-started banner live; invitation lands in app (/patient/invite). Payment confirmations and notices: the notice log has no door (Broken 7), billing lists only `paid`. Verdict: partly.
- P3: /patient/summary shows only approved versions with name, credentials, licence (summary/page.tsx:63 to 88); "still writing" lives in the sessions list (`psessions.writing`), not on Summary, whose empty state says "Nothing has been written yet". Verdict: kept, with the empty-state wording gap.
- P4: every version with its author (summary/page.tsx); provenance per document (profile/page.tsx:73 to 78); grants, revoke, invite code, ask-back (consent/*). Undermined by Broken 2 (claim by uuid) and Broken 1 (reassignment hands the chart to another clinician). Verdict: partly.
- P5: SOS z-70 above session orb z-60 (components/patient/sos-orb.tsx:163, session-orb.tsx:63); patient error boundary keeps it; public /radar and /t/[id] draw it; global-error and not-found do not. Verdict: kept in the app, partly outside it.
- T3: clinic earnings show earnings and withdrawals, no owed half (app/(clinic)/clinic/earnings/page.tsx). Cannot tell from here for the clinician's own screen.
- T4: /patient/signup locks the invited phone and names the therapist (signup/page.tsx:18 to 46). Cannot tell the join page from here.
- T5: revoke is one tap, "effective on the next read" (consent/actions.ts:49 to 63); copilot side not in slice. Cannot tell fully.
- C1: invited clinician joins `unverified` (join/[token]/actions.ts:11 to 16), so "on the radar the same hour" holds only for an already verified clinician; verification state is on the people row. Verdict: partly.
- C2: patient names on /clinic and in the CSV export; filing log per clinician. Verdict: broken (by design, C260).
- C3: one aggregated bill per month per practice, yes; priced per seat, no. Verdict: partly.
- C4: seat release does not move the bill (design/clinic/page.tsx:21 to 32). Verdict: broken.
- C5: earnings per clinician, no patients (earnings/page.tsx). Verdict: kept.
- E1: balance published (C377) but live spent and sessions cards beside it (Broken 3); roster is enrolment, not use. Verdict: broken.
- E2: no screen in the sponsor group renders a patient name beside a session, a session time or attendance; roster names are enrolled people with the cycle date only. Verdict: kept, subject to Suspects 3 and 4.
- E3: decrease waits a notice window (pot/actions.ts:71 to 74); share frozen at pay time rather than booking (Suspect 2); patient billing hides the patient's share (Broken 6). Verdict: partly.
- E4: 0% accepted, message says employee pays 100 per cent, roster unchanged, benefit page shows no coverage at all. Verdict: kept on these screens.
- E5: the patient benefit page has no empty-pot or "ask HR" state; the sentence, if anywhere, is at pay/join time (not in slice). Verdict: cannot tell from here; absent where a patient would look for their benefit.
- A1: sponsor transfer is a declared claim an operator credits (pot/actions.ts:141 to 269). Kept on this side.
- A2: one live sponsor top-up claim per company (pot/actions.ts:242 to 247). Kept on this side.
- A3: sponsor `PendingBar` (layout); patient billing shows only paid rows, so a patient's rejected transfer sentence is not on /patient/billing. Cannot tell for the pay page.
- A5: /staff/sign-in exists, unlinked (auth/staff/sign-in/page.tsx). Cannot tell further.

Public `where` phrases (VALUE-STATEMENTS): all of "Somebody who is free now" (P1), "You never talk to the AI" (P3, T5), "It moves with you" (P4), "Seats and the people on them" (C1, C2), "One set of books" (C3, C5), "The pot, and what is left in it" (E1) and "What you will never see" (E2) occur in source only in `lib/content/defaults.ts` (plus "What you will never see" in app/(public)/design/company/page.tsx:270). They reach `/` through app/(public)/page.tsx and `/for-patients` through app/(public)/[slug]/page.tsx, both `BlockRenderer` over the published CMS row, so the live wording is data, not code (H28). None of the hand-built pages (for-clinics, for-companies, for-therapists, developers, integrations) carries any of them.

RTL summary for the redesign: `dir` is set on `<html>` from the request (app/layout.tsx:78) and most screens use logical properties and `t()`. Hardcoded English remains in: auth login notices and reset-password invalid state; patient billing credit and FX lines, journal " · spoken", profile watermark, claim "your number", consent "A therapist", recovery and booking notifications (booking `when` forced to "en"); partner usage labels (raw ISO); every server-action error string in every portal; sponsor domains pages; the whole of /integrations, /integrations/[slug], /verify, /design/*, global-error. Raw ISO dates (the bidi defect the clinic and sponsor pages fixed) remain in patient account lock date, consent codes and linked platforms, partner usage, /verify.

## Coverage

| File | Lines | Status |
|---|---|---|
| app/(auth)/forgot-password/page.tsx | 23 | read |
| app/(auth)/layout.tsx | 21 | read |
| app/(auth)/login/page.tsx | 55 | read |
| app/(auth)/reset-password/page.tsx | 49 | read |
| app/(auth)/signup/page.tsx | 57 | read |
| app/(auth)/staff/sign-in/page.tsx | 41 | read |
| app/(clinic)/clinic/apply/actions.ts | 45 | read |
| app/(clinic)/clinic/apply/page.tsx | 55 | read |
| app/(clinic)/clinic/bills/page.tsx | 135 | read |
| app/(clinic)/clinic/earnings/page.tsx | 111 | read |
| app/(clinic)/clinic/export/route.ts | 71 | read |
| app/(clinic)/clinic/join/[token]/actions.ts | 83 | read |
| app/(clinic)/clinic/join/[token]/page.tsx | 67 | read |
| app/(clinic)/clinic/page.tsx | 291 | read |
| app/(clinic)/clinic/people/actions.ts | 142 | read |
| app/(clinic)/clinic/people/page.tsx | 72 | read |
| app/(clinic)/clinic/records/actions.ts | 110 | read |
| app/(clinic)/clinic/records/page.tsx | 81 | read |
| app/(clinic)/clinic/sign-in/actions.ts | 41 | read |
| app/(clinic)/clinic/sign-in/page.tsx | 32 | read |
| app/(clinic)/clinic/team/actions.ts | 203 | read |
| app/(clinic)/clinic/team/page.tsx | 64 | read |
| app/(clinic)/layout.tsx | 67 | read |
| app/(partner)/layout.tsx | 53 | read |
| app/(partner)/partner/actions.ts | 98 | read |
| app/(partner)/partner/apply/actions.ts | 32 | read |
| app/(partner)/partner/apply/page.tsx | 52 | read |
| app/(partner)/partner/deliveries/page.tsx | 95 | read |
| app/(partner)/partner/page.tsx | 68 | read |
| app/(partner)/partner/sign-in/actions.ts | 42 | read |
| app/(partner)/partner/sign-in/page.tsx | 38 | read |
| app/(partner)/partner/usage/page.tsx | 63 | read |
| app/(partner)/partner/webhooks/actions.ts | 44 | read |
| app/(partner)/partner/webhooks/page.tsx | 39 | read |
| app/(patient)/error.tsx | 63 | read |
| app/(patient)/layout.tsx | 84 | read |
| app/(patient)/patient/account/actions.ts | 159 | read |
| app/(patient)/patient/account/page.tsx | 188 | read |
| app/(patient)/patient/assessments/[id]/page.tsx | 57 | read |
| app/(patient)/patient/assessments/actions.ts | 59 | read |
| app/(patient)/patient/assessments/page.tsx | 131 | read |
| app/(patient)/patient/benefit/actions.ts | 132 | read |
| app/(patient)/patient/benefit/page.tsx | 66 | read |
| app/(patient)/patient/billing/page.tsx | 222 | read |
| app/(patient)/patient/browse/page.tsx | 109 | read |
| app/(patient)/patient/claim/actions.ts | 206 | read |
| app/(patient)/patient/claim/challenge-actions.ts | 72 | read |
| app/(patient)/patient/claim/page.tsx | 117 | read |
| app/(patient)/patient/consent/actions.ts | 176 | read |
| app/(patient)/patient/consent/page.tsx | 192 | read |
| app/(patient)/patient/forgot-password/page.tsx | 34 | read |
| app/(patient)/patient/homework/actions.ts | 41 | read |
| app/(patient)/patient/homework/page.tsx | 63 | read |
| app/(patient)/patient/invite/[token]/page.tsx | 111 | read |
| app/(patient)/patient/journal/actions.ts | 46 | read |
| app/(patient)/patient/journal/page.tsx | 102 | read |
| app/(patient)/patient/login/page.tsx | 63 | read |
| app/(patient)/patient/messages/actions.ts | 28 | read |
| app/(patient)/patient/messages/page.tsx | 79 | read |
| app/(patient)/patient/notices/actions.ts | 27 | read |
| app/(patient)/patient/notices/page.tsx | 60 | read |
| app/(patient)/patient/page.tsx | 489 | read |
| app/(patient)/patient/profile/actions.ts | 54 | read |
| app/(patient)/patient/profile/page.tsx | 145 | read |
| app/(patient)/patient/radar/page.tsx | 39 | read |
| app/(patient)/patient/record/actions.ts | 33 | read |
| app/(patient)/patient/record/page.tsx | 106 | read |
| app/(patient)/patient/residency/actions.ts | 37 | read |
| app/(patient)/patient/residency/page.tsx | 45 | read |
| app/(patient)/patient/sessions/page.tsx | 92 | read |
| app/(patient)/patient/signup/page.tsx | 49 | read |
| app/(patient)/patient/summary/page.tsx | 96 | read |
| app/(patient)/patient/t/[id]/page.tsx | 46 | read |
| app/(patient)/sessions/[id]/recovery-actions.ts | 182 | read |
| app/(public)/[slug]/page.tsx | 56 | read |
| app/(public)/contact/actions.ts | 80 | read |
| app/(public)/design/clinic/page.tsx | 404 | read |
| app/(public)/design/clinic/sample/page.tsx | 185 | read |
| app/(public)/design/company/page.tsx | 401 | read |
| app/(public)/design/company/sample/page.tsx | 154 | read |
| app/(public)/design/page.tsx | 283 | read |
| app/(public)/design/patient/page.tsx | 772 | read |
| app/(public)/design/patient/sample/page.tsx | 101 | read |
| app/(public)/design/patient/sample/samples.tsx | 378 | read |
| app/(public)/design/portal-kit.tsx | 286 | read |
| app/(public)/developers/page.tsx | 317 | read |
| app/(public)/for-clinics/page.tsx | 100 | read |
| app/(public)/for-companies/page.tsx | 115 | read |
| app/(public)/for-therapists/page.tsx | 165 | read |
| app/(public)/integrations/[slug]/page.tsx | 86 | read |
| app/(public)/integrations/page.tsx | 379 | read |
| app/(public)/layout.tsx | 47 | read |
| app/(public)/page.tsx | 26 | read |
| app/(public)/radar/actions.ts | 449 | read |
| app/(public)/radar/page.tsx | 58 | read |
| app/(public)/t/[id]/book/actions.ts | 178 | read |
| app/(public)/t/[id]/page.tsx | 72 | read |
| app/(public)/verify/[code]/page.tsx | 21 | read |
| app/(public)/verify/page.tsx | 103 | read |
| app/(sponsor)/layout.tsx | 90 | read |
| app/(sponsor)/sponsor/apply/actions.ts | 37 | read |
| app/(sponsor)/sponsor/apply/page.tsx | 58 | read |
| app/(sponsor)/sponsor/code/actions.ts | 36 | read |
| app/(sponsor)/sponsor/code/page.tsx | 94 | read |
| app/(sponsor)/sponsor/domains/actions.ts | 144 | read |
| app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx | 49 | read |
| app/(sponsor)/sponsor/domains/page.tsx | 65 | read |
| app/(sponsor)/sponsor/integrations/actions.ts | 115 | read |
| app/(sponsor)/sponsor/integrations/page.tsx | 79 | read |
| app/(sponsor)/sponsor/page.tsx | 255 | read |
| app/(sponsor)/sponsor/people/actions.ts | 74 | read |
| app/(sponsor)/sponsor/people/page.tsx | 71 | read |
| app/(sponsor)/sponsor/pot/[txn]/page.tsx | 148 | read |
| app/(sponsor)/sponsor/pot/actions.ts | 316 | read |
| app/(sponsor)/sponsor/pot/page.tsx | 274 | read |
| app/(sponsor)/sponsor/settings/actions.ts | 97 | read |
| app/(sponsor)/sponsor/settings/page.tsx | 63 | read |
| app/(sponsor)/sponsor/sign-in/actions.ts | 44 | read |
| app/(sponsor)/sponsor/sign-in/page.tsx | 38 | read |
| app/global-error.tsx | 57 | read |
| app/globals.css | 397 | read |
| app/layout.tsx | 92 | read |
| app/manifest.ts | 36 | read |
| app/not-found.tsx | 30 | read |
| app/robots.ts | 62 | read |
| app/sitemap.ts | 53 | read |

126 files, 14,730 lines, all read. No real secrets seen (only the fake `sk_live_...` placeholder in app/(public)/integrations/page.tsx:195).
