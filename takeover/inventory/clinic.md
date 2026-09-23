# Clinic inventory (the person who runs a practice)

Derived from code on 2026-09-23. Evidence is the code path, not comments. "Admin" means `clinic_managers.role = 'admin'`; "staff" means a clinic manager row holding a custom role. Capabilities are the closed list in `lib/clinic-auth/capabilities.ts`: `schedule.read`, `people.read`, `bills.read`, `earnings.read`, `reports.read`, `team.manage`, `seats.manage`, `clinicians.manage`, `export`.

## 1. Summary

The clinic has **9 pages in `app/(clinic)`** (6 signed in: `/clinic`, `/clinic/people`, `/clinic/bills`, `/clinic/earnings`, `/clinic/team`, `/clinic/records`; 3 open: `/clinic/sign-in`, `/clinic/apply`, `/clinic/join/[token]`, the last one used by the invited clinician rather than the manager), **1 file route** (`GET /clinic/export`), and **3 surfaces elsewhere** that act for the clinic (`/for-clinics`, the seat manager on the clinician's `/billing`, the "switch to clinic" button in the clinician header). A clinic cannot sign itself up: `/clinic/apply` only creates a held row, and an operator activates the practice and creates the manager in `/admin/clinics`. Once in, the manager can: read a weekly rota with patient first name and last initial, read aggregated monthly bills and weekly spend, read per-clinician lifetime earnings and withdrawal logs, invite and remove clinicians, create up to two custom staff roles and add staff with a password the admin types, scope staff to clinicians, connect or disconnect a FHIR record system, export the rota and bills as CSV, and switch to a linked clinician account. They cannot see notes, transcripts, risk, consent state or caseload counts, cannot verify clinicians, cannot move money, and (from this portal) cannot buy or release seats or pay a bill.

## 2. The table

### Shell (every signed-in clinic page)
`app/(clinic)/layout.tsx`, `components/clinic/chrome.tsx`, `components/portal/desk.tsx`, `lib/clinic-auth/session.ts`

| Section | What they see (data shown, from which loader) | What they can do (every button/form/link, and the server action or route it calls, file:function) | Value it delivers | Gaps |
| --- | --- | --- | --- | --- |
| Rail / mobile tab bar | Clinic name (`getClinicActor`). Tabs filtered by capability: This week (`schedule.read`), Your clinicians (`people.read`), Your bills (`bills.read`), Earnings (`earnings.read`), Your team (`team.manage`), Your record system (`team.manage`) | Links to the six pages | none stated | Hiding a tab is the only courtesy: `/clinic/people`, `/clinic/bills`, `/clinic/records` use `requireClinic`, so a staff member who types the URL gets a thrown `ClinicRefused` (no `error.tsx` in the group) instead of a redirect. Records tab needs `team.manage` but the page needs nothing. No tab for `reports.read` or seats |
| Rail actions | "Switch to your clinician account" (only when `linkedUserId`), "Sign out", language switch | `app/(clinic)/clinic/team/actions.ts:switchToClinician` (`lib/clinic-auth/switch.ts:leaveClinicPrincipal`, revoke clinic sessions, `createSession`, redirect `/`); `app/(clinic)/clinic/sign-in/actions.ts:signOutClinic` | none stated | Switch failure silently redirects to `/clinic` with no message |
| "This portal will never show you" wall | Three lines: note/transcript/journal/summary, risk flag/diagnosis, "Not a setting: it is not built" | none | C2 (partly) | Omits that patient names ARE shown on `/clinic`; reader is not told |
| Session rules | 30 min idle, 8 h absolute; only resolves for an organisation of kind `clinic` with `clinic_state = active` | none | none stated | No password change or reset for managers or staff anywhere in the product |

### /clinic/sign-in
`app/(clinic)/clinic/sign-in/page.tsx`, `components/auth/auth-shell.tsx`, `components/clinic/sign-in-form.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Door switcher | "Which are you" with four doors; "I run a clinic" marked current (`lib/auth/doors.ts:doors`) | Links to `/login`, `/patient/login`, `/sponsor/sign-in` | none stated | none |
| Promise column | "Your therapists, your seats, your billing." and three points: seat prorated the day they join or leave; one bill for the clinic; "See the rota and move a patient between your own clinicians" | none | C3 | p1 contradicted (join/leave never changes the seat count); p3 has no code at all |
| Sign-in form | Email address, Password, "Sign in" | `sign-in/actions.ts:signInClinic` (rate 8 per 15 min per caller) then `lib/data/clinic-admin.ts:checkClinicPassword`, `createClinicSession`, redirect `/clinic` | none stated | No "forgot password" (`belowForm` not passed). A held or suspended practice is told "email and password do not match". Error strings and "Working…" are hard coded English |
| Footer link | "No account? Create one" | Link to `/clinic/apply` | none stated | none |

### /clinic/apply
`app/(clinic)/clinic/apply/page.tsx`, `components/clinic/apply-form.tsx`, `app/(clinic)/clinic/apply/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Header | "Bring your practice to 24Therapy", "Nothing is set up until we have spoken." | none | none stated | Rendered in the Desk with `nav=false`: no site header, logo, back link or language switch |
| Enquiry form | Practice name, Who should we speak to, Email address, Phone number, registration number, Who issued it, clinicians (one per line) | "Ask us to call" to `apply/actions.ts:apply` (5 per hour) then `clinic-admin.ts:applyToClinic` (held `organizations` row only) | none stated | No confirmation email, no status page, no expected call time. Errors English only |
| Success state | "Thank you. We will call you." | none | none stated | Dead end: no link anywhere |
| Sees / cannot table | Can: appointments (name and time), one total per period, team. Cannot: notes, risk, "not built". Plus `clinic.cannotVerify` | none | C2 (says names are shown, which contradicts C2's wording) | none |

### /clinic ("This week")
`app/(clinic)/clinic/page.tsx`, loaders `lib/data/clinic.ts:clinicSchedule`, `clinicUsage`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Header and export | "Who is coming, and when"; "a name and a time, because you pay for the hour"; watermark sentence | "Download as a spreadsheet" (only with `export`) to `GET /clinic/export?what=schedule` | none stated | Watermark says the file "shows nothing this screen does not", but the export is a fixed 90 days back and 90 forward while the screen shows one week |
| Week navigation | "Week of {date}", Monday anchored in UTC | "Earlier" and "Later" links to `/clinic?week=YYYY-MM-DD` | none stated | No "this week" reset, no date picker; an invalid `week` silently falls back |
| Summary tiles (only when rows exist) | "Booked this week" (row count), "Clinicians on the rota" (distinct therapist names) | none | none stated | none |
| Rota list | Per session: patient first name and last initial (`shortenForClinic`, guest names shortened too), clinician full name, time in UTC, "cancelled" chip. Scoped to assigned clinicians for staff. Every read writes a `phi_access` audit row. Max 500 rows | none (rows are deliberately not links) | C2 and C5 contradicted: a patient name per clinician per hour is on screen | Times only in UTC with no zone label. Status chip prints the raw English enum. No loading state. Empty: "No appointments this week." |
| "Sessions and spend, by week" | Last 12 weeks from `clinicUsage`: session count and spend, "Nothing to pay" for a zero, "Not enough activity to report yet" below the activity floor | none | C3 (partly) | `clinicUsage` requires `reports.read` but the page runs it for anyone: a role with `schedule.read` and not `reports.read` crashes the whole page, and `/clinic` is where every refused capability redirects, so that staff member has no working home. Not scoped to assigned clinicians (staff see practice-wide spend) |

### /clinic/people ("Your clinicians")
`app/(clinic)/clinic/people/page.tsx`, `components/clinic/people-list.tsx`, `app/(clinic)/clinic/people/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Clinician list | Name, email, verification chip (Verified / Verification in progress / Has not started / not accepted) from `clinicClinicians`; "This seat is not billed until {date}" from `lib/billing/seats.ts:seatsFor` | none (status is a word, never a control) | C1 (verification state on the row: kept) | No radar or availability state, no session price, no join date (`joinedAt` loaded, unused). Page uses `requireClinic`, not `people.read`. Empty: "Nobody has joined yet." |
| Remove (admin only) | Confirm text: they move to their own practice, meeting accounts disconnected | "Remove from the practice" then red "Remove from the practice" to `people/actions.ts:remove` then `clinic-admin.ts:removeClinician` (new solo org, release `clinic_seats` row, revoke meeting connections, audit) | C4 contradicted | No Cancel once confirming. `organizations.seats` (what the seat bill is priced on) is not changed, so the next bill does not drop |
| Pending invitations | Name or email, "Invited, not yet accepted" (state `sent` only) | "Cancel the invitation" to `cancelInvitation` then `revokeInvitation` | none stated | Expiry (14 days) not shown and not filtered, no resend, errors from cancel are discarded |
| Invite form (admin only) | "Invite a clinician": First name, Last name, Email address, Phone number | "Send the invitation" to `invite` then `inviteClinician`, `lib/notify:notify`, audit; shows the raw join link | C1 | Email/SMS body is hard coded English. No seat or cost shown before committing the practice to pay. Admin check is `role === 'admin'`; `clinicians.manage` is never checked anywhere |
| Verification note | "Only the clinician can complete their own verification..." | none | none stated | none |

### /clinic/bills ("Your bills")
`app/(clinic)/clinic/bills/page.tsx`, loader `lib/data/clinic.ts:clinicBills`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Header and export | "A total for the period, never a line per session..." | "Download as a spreadsheet" (only with `export`) to `/clinic/export?what=bills` | C3 | Page uses `requireClinic`, not `bills.read` (direct URL crashes for staff without it) |
| Monthly bill cards | Up to 24 months: period (printed as a full date), session count or "Not enough activity" below the floor, Platform fee, AI fee, Total | none | C3 contradicted | Only invoices with a `session_id`: seat invoices (`lib/billing/service.ts:billSeatProration`, kind `subscription`) never appear. No due/paid state, no pay button, no invoice document. Empty: "Nothing billed yet." |

### /clinic/earnings
`app/(clinic)/clinic/earnings/page.tsx` (`requireClinicCapability("earnings.read")`), loader `clinicEarnings`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Combined | Sum of the rows below | none | C5 | Lifetime only, no period |
| Per clinician | Name, earned (sum of `therapist_net_cents` for sessions in this org, all time), withdrawals: date, raw status, amount; or "No withdrawals yet." Scoped for staff | none | C5 (earnings: kept) | No held versus paid split, no period filter, status is the raw English enum, no export |
| Footnote | "There is no route by which a practice can move a clinician's money." | none | none stated | none |

### /clinic/team ("Your team")
`app/(clinic)/clinic/team/page.tsx` (`requireClinicCapability("team.manage")`), `components/clinic/team.tsx`, `app/(clinic)/clinic/team/actions.ts`, `lib/data/clinic-team.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Roles | Role name and capability labels (`rolesFor`); "You have no roles yet..." | Admin: "Change" (opens form), "Remove" to `deleteRole` then `removeRole` (audit) | none stated | Remove has no confirmation although everyone holding the role loses all access |
| Role form (admin, fewer than 2 roles or editing) | "What is this role called", "What it can do": 7 checkboxes (See who is coming and when, See the clinician list, See the practice's bills, See earnings totals, See activity reports, Manage this team, Export what they can see); amber note that seats and inviting stay with you | "Add this role" / "Save this role" to `saveRole` (30 per 15 min) then `createRole` / `updateRole` (audit); "Cancel" | none stated | Hard cap of two roles |
| People (staff) | Name or email, "Runs the practice" / role name / "No role yet"; admin line "They see every clinician here" (`staffFor`) | Per staff: "Whose work they cover" checkboxes, "Save" to `saveAssignments` (`team.manage`) then `setAssignments` (audit); "Saved." | none stated | Picker hidden entirely when the viewer lacks `people.read` (no sentence says why). No remove staff, no change of a staff member's role, no disable, no sign-out-everywhere |
| Add staff (admin, at least one role) | Email address, Their name, Password, Their role | "Add them" to `inviteStaff` then `addStaff` (audit) | none stated | The admin types the staff member's password: no invite link, no reset, password shared out of band |

### /clinic/records ("Your record system")
`app/(clinic)/clinic/records/page.tsx`, `components/ehr/records-panel.tsx`, `app/(clinic)/clinic/records/actions.ts`, `app/api/ehr/callback/route.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Live connections | "Connected to {tenant}", "Connected {date}", last successful call or "has not answered yet", vendor error text (`connectionsFor`); "{count} clinicians file through this connection" (`filersOn`) | "Disconnect" to `records/actions.ts:disconnect` then `revokeConnectionsFor` (audit) | none stated | No confirmation; revokes every connection (the posted `connectionId` is ignored). Empty: "No record system is connected." |
| What we hold | Three sentences on what is filed, kept, severed | none | none stated | none |
| Connect | Not configured warning, or "Connect Epic" then form: Which system (Epic and other `EHR_VENDORS`), FHIR base URL, per-vendor caveats | "Continue" to `begin` then `beginConnection`, audit, redirect to vendor, back via `/api/ehr/callback` to `/clinic/records?ehr=...` | none stated | The `?ehr=connected/refused/expired/mismatch` result is never read, so the outcome is invisible |
| Recent filings | State (Filed / Filing / Refused), time, HTTP status, approving clinician's name, error (`writebacksFor`) | none | none stated | Page gated by `requireClinic` only: any staff member sees clinician names and raw vendor errors, and sees Connect/Disconnect controls whose admin-only actions silently redirect them to `/clinic` |
| Disconnected history | "Disconnected {date}", "Why: {reason}" (reason stored as English) | none | none stated | none |

### /clinic/join/[token] (seen by the invited clinician, part of the clinic's onboarding)
`app/(clinic)/clinic/join/[token]/page.tsx`, `components/clinic/join-form.tsx`, `app/(clinic)/clinic/join/[token]/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Invalid link | "That invitation is no longer valid. Ask the practice for a new one." (`resolveInvitation` null; rendering stamps `terms_shown_at`) | none | none stated | No header, logo or language switch |
| New account form | "{name} has invited you"; First name, Last name, Password; "What {name} will be able to see" (6 items) and never (4 items); no-private-patients and keep-solo notes | "Set my password and join" to `accept` (10 per 15 min) then `acceptInvitation` (unverified user in the clinic org, `takeSeat`) | C1 | "Until then this invitation does nothing" is false: they join the practice and take a seat at once. The list promises the practice sees radar standing and prices; no clinic screen shows either |
| Existing account form | "I already have an account" toggle; Email, Password; same lists | "Sign in and join" to `joinWithAccount` then `joinWithExistingAccount`, then `cancelSubscription` at period end; "I am new here" toggles back | C4 (seat billable from their own period end) | Gateway failure is only logged |
| Done | "You are in. Verify your licence next." | none | none stated | Dead end: no link to `/login` or verification |

### GET /clinic/export (file route)
`app/(clinic)/clinic/export/route.ts`, `lib/data/clinic-export.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| CSV download | Watermark rows (exported by, at, clinic) then `When,Who,Clinician,State` or `Period,Sessions,Platform fee,AI fee,Total` | `what=bills` to `exportBills`, anything else to `exportSchedule` (90 days either side); 401 without session, 403 without `export` or the read; audit row | none stated | Headers English only; no spreadsheet formula escaping on names; window not chosen by the user |

### /billing seat manager (clinician portal, the only seat control)
`app/(app)/billing/page.tsx`, `components/billing/seat-manager.tsx`, `app/(app)/billing/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Seat manager | Seat count and monthly price (`currentSeatBill`, from `organizations.seats`), shown when seats > 0 | Stepper to `quoteSeats` (quote) then confirm to `saveSeats` then `lib/billing/seats.ts:applySeatChange` (proration invoice or upcoming discount) | C3, C4 | Guarded by `requireUser` only: any clinician on a clinic account can change the practice's seats, contradicting "seats.manage never delegable". A manager with no linked clinician account cannot change seats at all |

### Clinician header "switch to clinic"
`app/(app)/layout.tsx`, `app/(app)/switch-principal/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Building icon | Shown when a `clinic_managers` row links to this user | `switchToClinic` then `enterClinicPrincipal`, revoke all clinician sessions, `createClinicSession`, redirect `/clinic` | none stated | Icon only (title/aria label), easy to miss on mobile |

### /for-clinics (public)
`app/(public)/for-clinics/page.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Hero | "Several clinicians, one practice, one set of books", `ClinicDemo` | "Talk to us" to `/clinic/apply`; "Contact" to `/contact` | C3 | none |
| Four questions | Who sees a chart, leaving, data export ("clinic-level export ... is not built"), hosting | none | none stated | Says no clinic export; a CSV export exists |
| What is not here yet | "Pushing a note into the record system you already use ... not built" | Link to `/integrations` | none stated | Contradicted: `/clinic/records` connects and files notes |

### Privacy boundaries (what the code stops a clinic seeing)

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| No clinical reads | `ClinicActor` has no `userId`/`organizationId`, so no clinical loader accepts it; `lib/data/clinic.ts` has no note, transcript, risk, diagnosis or copilot function | none | C2 | Enforced by absence; nothing on screen tells a patient-facing reader |
| Names shortened | Patient and guest names cut to first name and last initial; patient is told on `/patient/record` (`lib/data/clinic-visibility.ts`) | none | C2 contradicted (a name is still shown) | none |
| No consent or AI-per-session leak | Bills aggregated by month, no `session_id`, no `invoice_lines` join; schedule has no consent or no-show column | none | none stated | none |
| Activity floor | Weekly usage and monthly session counts suppressed below `settings.sponsor.activityFloor` | none | none stated | Bills still show AI fee totals in a suppressed month |
| Money route hidden | Withdrawals show date, amount, status only; no account numbers; no withdraw action exists for a clinic principal | none | C5 | none |
| Scoped staff | `schedule.read`, `earnings.read`, `reports.read` narrowed to assigned clinicians in SQL | none | none stated | `clinicUsage` ignores the scope |

## 3. Can do with no screen

- Change the practice's seat count and trigger a proration invoice: `app/(app)/billing/actions.ts:quoteSeats`, `saveSeats`, reachable only from the clinician portal, not the clinic portal.
- Export 180 days of rota (90 back, 90 forward) via `GET /clinic/export?what=schedule`, far more than the one week the screen shows.
- `reports.read`: a capability that can be granted to a role; its only effect is the usage card on `/clinic`. No reports page exists.
- `seats.manage` and `clinicians.manage`: in the vocabulary and the labels, checked by no function. Membership writes check `role === 'admin'` instead.
- Invitation `expiresAt` and `createdAt`, clinician `joinedAt`: loaded by `clinicInvitations` / `clinicClinicians`, never rendered.
- `lib/billing/seats.ts:currentSeatBill` and `quoteSeatChange`: priced seat data with no clinic-portal screen.
- `lib/data/clinic-team.ts:revokeClinicSessionsFor`: ends a manager's sessions; only reached through the switch, never offered as "sign this staff member out".

## 4. Promised but not built (or contradicted)

- **C1** "Add a clinician and they are on the radar the same hour": invitees are created `unverified` and the radar requires verification (`lib/data/radar.ts` uses `isVerifiedClinician`); the portal has no radar column.
- **C2** "No patient name on any screen": `/clinic` and the schedule CSV show patient first name and last initial per clinician and hour.
- **C3** "One invoice, priced per seat": no code raises a recurring per-seat charge; `/clinic/bills` shows per-session platform and AI fees and excludes seat invoices.
- **C4** "Release a seat and the next bill is lower by one": `removeClinician` releases the `clinic_seats` row but leaves `organizations.seats`, which prices the bill, unchanged.
- **C5** "each clinician's patients are not" visible: the rota shows them.
- `auth.clinic.p1` "prorated the day they join or leave": joining or leaving never calls `applySeatChange`.
- `auth.clinic.p3` "move a patient between your own clinicians": no code.
- Join page "{name} will be able to see whether you are on the radar" and "what you charge": no clinic screen shows either.
- `clinic.join.verifyFirst` "Until then this invitation does nothing": acceptance joins the org and takes a seat before verification.
- `clinic.exportWatermark` "shows nothing this screen does not": the export window is wider than the screen.
- `seats.manage` "NEVER delegable": any seated clinician can change seats from `/billing`.
- `/for-clinics` says record-system filing and clinic export are not built; both exist (the page understates the product).

## 5. Should exist in the redesign

1. **A seats page inside the clinic portal, admin only** (`seats.manage` actually checked), showing seats bought versus seats filled, and moving `saveSeats` out of the clinician portal. Reason: C3, C4 and the `requireUser` hole in `app/(app)/billing/actions.ts`.
2. **Tie seat count to membership**: inviting or removing a clinician quotes and applies the seat change in the same flow. Reason: C4 and `auth.clinic.p1` are contradicted today.
3. **One bills page that includes seat invoices and payment state, with a pay action.** Reason: `clinicBills` filters `session_id IS NOT NULL`, and nothing in the clinic portal can pay.
4. **Decide the name rule and make C2 and the screen agree**, either drop names from the rota or rewrite C2 and the wall. Reason: the most visible promise is contradicted on the home page.
5. **A capability-safe home**: `/clinic` must render for any role (skip `clinicUsage` without `reports.read`, scope it), and pages must use `requireClinicCapability` so direct URLs redirect instead of crashing. Reason: `ClinicRefused` thrown on `/clinic`, `/clinic/people`, `/clinic/bills`, `/clinic/records`.
6. **Staff lifecycle**: invite link instead of an admin-typed password, remove staff, change role, reset password, sign out everywhere. Reason: `addStaff` takes a password and no remove function exists.
7. **Password reset for clinic managers.** Reason: none exists for `clinic_managers`.
8. **Clinician row detail that matches the join-page promise**: radar state, price, seat billing date, invitation expiry and resend. Reason: join page lists these; `expiresAt` and `joinedAt` are loaded and unused.
9. **Records page for admins only, with confirmation and callback result.** Reason: `requireClinic` gate, unconfirmed disconnect of every connection, unread `?ehr=` result.
10. **Export chooser that exports exactly the visible range**, with formula-safe cells. Reason: `clinic.exportWatermark` promise and `clinic-export.ts:cell`.
11. **Earnings by period with held versus paid**. Reason: `clinicEarnings` is lifetime only.
12. **Onboarding status for an applicant practice** (applied, call booked, active) and a real header on `/clinic/apply` and `/clinic/join`. Reason: both render with no navigation or language switch, and the done states are dead ends.
13. **Localise the hard coded strings**: server action errors, "Working…", invite message, CSV headers, status enums, UTC-only times. Reason: every one is English regardless of locale.
