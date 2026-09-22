# Slice 09: admin

(Working order: entries are appended as read; final pass reorders into slice order.)

## Files

### app/(admin)/admin/actions.ts (965 lines)
- For: the console's general server actions: suspend/verify user, save CMS page, invoice discount/edit/void, patient refund, release held earnings, ledger adjust, upcoming discount, patient export email, taxonomy, radar suspension/offline/profile edit, resolve report, send every email template.
- Decides: EVERY action here is `requireRole("super_admin")` (founder only), incl. `decideTherapistVerification` :289, so a `staff`/`manager` cannot approve a clinician even though the Verifications link is shown to every back office role (layout.tsx:122).
  - `decideTherapistVerification` :289 refuses reject with empty note (:297, "They see this word for word"), stores `trimmed` via `decideVerification`, emails it verbatim (:349/:350) after `after()`. Idempotency: `decideVerification` returns falsy when already reviewed, "Somebody already reviewed this one." (:308). Undo: none here; `verifyUser` :59 can set status directly (verified/rejected/pending) with NO reason and no email.
  - `verifyUser` :59: sets `users.verification_status` directly via `setVerification`, no reason, audited without reason. MAP says `users.verification_status` is derived (trigger 0083); a direct write here either fights the trigger or is overwritten. See Suspect.
  - `applyInvoiceDiscount` :154: no reason required (passed through, could be empty), audited with reason. Idempotency depends on `discountInvoice` (lib/billing/service).
  - `editInvoice` :371: requires reason (:379). Paid invoice cannot be re-priced (:397) or reopened (:409), but CAN be voided (`status: "void"` sets `paidAt=null` :413) with no ledger reversal and no refund: voiding a paid invoice erases the paid timestamp while money has moved. Comment :367 says "A paid invoice can only be voided"; nothing posts a reversing ledger leg. Stored reason is only in audit (`JSON.stringify(patch)` + reason).
  - `refundPatient` :442: reason required, delegates idempotency to `refundSessionPayment` (lib/billing/connect). Stripe-path refund, not the manual EGP rail.
  - `releaseTherapistEarnings` :481: no reason; audited after success; "nothing held" is returned as error (:489). Idempotent in effect (second call moves 0).
  - `adjustLedger` :512: reason required by `postAdjustment` presumably (not checked here; reason trimmed into audit :533). No undo other than posting the opposite adjustment.
  - `applyUpcomingDiscount` :541: no validation at all here (amount, reason) before `setUpcomingDiscount`; audited.
  - `emailPatientRecordToPatient` :575: reason >= 8 chars; causes an export link to be emailed to the patient; the admin never sees the record. Audit written only AFTER a successful send (:604), so a created-but-unsent export token is not audited (:602 returns error first). Comment :571 says "The clinician is told, in the same breath" but nothing in this function tells the clinician; `clinicianName: "your therapist"` is hardcoded (:597). See Stale/Suspect.
  - `setRadarSuspension` :703 reason >= 4 when suspending, emails the clinician the reason verbatim (:746); release needs no reason.
  - `resolveReport` :817 no check that the report is still open (re-resolving overwrites resolver/resolution silently).
  - `sendEveryTemplate` :886: one typed address, audited before sending.
  - `emailTherapist` :192 / `announceToAllTherapists` :232: staff can email clinicians; founder only. No path here to email a patient a claim link (task 105): the only patient-directed send is the record export.
- Assumes: `requireRole` redirects on refusal (lib/auth/guard.ts:77); `audit()` routes non-uuid resourceId into resource_key (lib/audit.ts:129), so `${kind}:${code}` at :642 is safe.
- Promises: A2 partly (verification double decide refused; refunds/discounts delegated). A3 (for clinicians, not payers): reject reason required and sent verbatim. A5: refusal is a redirect, not audited (see guard notes).
- Notes: `suspendUser` :45 has no reason and no email to the suspended person.

### app/(admin)/layout.tsx (265 lines)
- For: console shell and nav; admits any BACK_OFFICE role (staff, manager, super_admin) via `requireStaff()` :49.
- Decides: nav filtering by role. Everyone: Overview, Support, Numbers, Verifications, Radar control, Payouts, Transfers. Manager+: Ratings, Audit log, Usage and cost, Errors. Owner (super_admin) only: Clinicians, Vault, Sponsors, Paused benefits, Clinics, Partners, Check-ins, Radar lists, Announce, Site content, Settings, Strings, Financial model, Actuals. Not linked at all: /admin/tv (Total View), /admin/patients/[id], /admin/usage/sessions (subpage), /admin/radar/investigate/[id], /admin/content/[id], /admin/therapists/[id], /admin/sponsors/[id].
- Assumes: every page runs its own guard (comment :44).
- Promises: A5 partly: nav hides doors, but refusal behaviour is `redirect("/dashboard")` in `requireRole` (lib/auth/guard.ts:77) with no audit row.
- Notes: Header "Back to portal" links /dashboard (:79) for all roles; for a staff/manager that goes to the clinician (app) layout, which redirects anyone not "cleared" (only super_admin or approved clinician, lib/data/verification.ts:167) to /onboarding, whose page calls `ensureVerification(actor)` (app/(app)/onboarding/page.tsx:31) and only bounces super_admin (:28). So a refused staff member lands on "Verify your practice" and may have a verification row created for them. Pages that show "Verifications" badge to staff while every decision action is super_admin only: see verifications/page.

### components/admin/gate.tsx (168 lines)
- For: two key unlock screen for "Total View" (/admin/tv), plus first time key setup.
- Decides: both keys required (`submitKeys`); second key write once from UI (button disabled once set :116), "changes only in the database". Claims "read-only and every read is recorded" (:29): check tv/actions.ts.
- Assumes: tv/actions.ts `configureKey`, `submitKeys`.
- Promises: A5 (every read written down) claimed here.
- Notes: page not in nav.

### app/(admin)/admin/actuals/actions.ts (179 lines)
- For: founder payroll, capital and other-cost editing for the company's own actuals.
- Decides: all `requireRole("super_admin")`. Dollars to cents once (`centsFromDollars` :31, rejects negative/non-finite). Employees never deleted, only ended (:89); capital can be removed (:144); other cost 0 = removed (:177).
- Assumes: lib/data/payroll.ts and lib/data/capital.ts audit (comment :154 "the audit log says what it was") and re-assert the role; no audit call in this file.
- Promises: none of the 25 (internal books). A5: role gate is redirect.
- Notes: not customer money.

### app/(admin)/admin/actuals/page.tsx (144 lines)
- For: company actuals board pack: position card, month table, payroll editor, bank editor.
- Decides: `requireRole("super_admin")` :49; default date computed on server in UTC (:66).
- Assumes: lib/data/actuals `monthlyActuals`, NOT_MEASURED_HERE.
- Promises: none.
- Notes: owner-only in nav (layout.tsx:236), matches guard.

### app/(admin)/admin/announce/page.tsx (54 lines)
- For: compose one email to every active clinician; lists every recipient name and email.
- Decides: `requireRole("super_admin")` :13. Warns when RESEND key absent (:25).
- Promises: none. Task 105: this is clinicians only; no patient/claim-link send.

### app/(admin)/admin/audit/page.tsx (115 lines)
- For: last 200 audit rows, filterable by category.
- Decides: `requireRole("super_admin")` :19.
- Promises: A5 "every read is written down": this screen exists, but see Broken: nav shows it to managers (layout.tsx:202 `isManager`) while the page is super_admin, so a manager is redirected to /dashboard (then /onboarding) with no explanation, the exact defect layout.tsx:221-229 says 76.53 fixed for two other pages.
- Notes: Actor label handles clinician/staff (users.email), sponsor, clinic; a PATIENT actor (`actorAccountId`, lib/audit.ts:110) is not selected by `listAuditLog` (lib/data/admin.ts:193) so a patient's own act (e.g. revoking a grant) renders as "system" (:74). Comment :59 says "four principals ... four possible actors" and handles three. Reason, resource type and resource id are selected (partly) but not shown; no paging past 200, no search, no date filter; the reason text an operator typed (rejection, refund) is not visible here.

### app/(admin)/admin/benefits/actions.ts (55 lines)
- For: `liftPause` :38, the C247 one-step reversal of a paused sponsor benefit.
- Decides: super_admin; audited with enrolment id only, no sponsor (:34). No reason required. Not guarded against an enrolment that is not paused: `unpause` (lib/data/enrolment-verify.ts:305) unconditionally sets `pausedAt=null, lastVerifiedAt=now`, so calling it on a live enrolment silently resets its re-verification clock. No undo (no re-pause control).
- Promises: E4-adjacent; grants money (restarts employer funding). A2: re-press harmless except clock reset.

### app/(admin)/admin/benefits/page.tsx (71 lines)
- For: queue of paused benefits, longest wait first. A "stuck people" screen (tasks 163 to 167 candidate): people whose funding stopped because a re-verification went unanswered.
- Decides: super_admin :38; days paused computed server side.
- Assumes: `pausedBenefits()` (lib/data/enrolment-verify.ts:341) joins enrolments + people + sponsors: returns person first/last name, personal email, sponsor name.
- Promises: E1/E2 not touched (admin only), but this IS a join of sponsor to named person on a staff screen; comment :31 argues it is not a sponsor surface. No session data in the join.

### app/(admin)/admin/checkins/page.tsx (83 lines)
- For: check-in mute rate against the halt threshold, six counts.
- Decides: super_admin :34; halted when rate >= settings.checkins.muteRateHalt (:39). Read only; the threshold is edited on /admin/settings.
- Promises: none. No patient words shown (:18).

### app/(admin)/admin/clinics/actions.ts (110 lines)
- For: clinic state, billing region, first manager creation.
- Decides: super_admin all; `setState` validates against CLINIC_STATES :31; `setRegion` validated by `isRegion`, refusal on outstanding invoice lives in `setClinicRegion` (comment in clinic-manager.tsx:146); `addManager` operator sets the password in clear (:94).
- Promises: C1 adjacent (activation). A5 audited (no reason text).
- Notes: no verification action by design (:20).

### app/(admin)/admin/clinics/page.tsx (45 lines)
- For: list of practices with clinician COUNT, managers, contact.
- Decides: super_admin :20; own read `clinicsForAdmin`.
- Promises: C2 respected on this admin screen (count only).

### app/(admin)/admin/content/[id]/page.tsx (42 lines)
- For: CMS page editor host. super_admin :14; notFound on bad id.

### app/(admin)/admin/content/page.tsx (102 lines)
- For: list of CMS pages with status; link to /design UI reference.
- Decides: super_admin :14.
- Notes: empty-state tells operator to `npm run db:seed` (:61); HAZARDS H28/H49 say published rows win and ship:content is a reseed: this editor is the non-destructive path.

### app/(admin)/admin/errors/page.tsx (100 lines)
- For: server errors grouped by fingerprint (last 200 rows), stack visible.
- Decides: `requireRole("super_admin")` :24.
- Notes: nav shows it to managers (layout.tsx:214 `isManager`) but the page is super_admin: a manager is bounced. Same for /admin/usage (check). Says messages have addresses stripped.

### components/admin/paused-benefits.tsx (118 lines)
- For: rows of paused benefit with name, sponsor, email, days-paused badge, "Cannot self-serve" for id_number, "Lift the pause" button.
- Decides: button disabled only for the row in flight (:100); no confirm step; no reason field.
- Notes: comment :42 "No sessions, no notes, no spend, no pot" holds for the query.

### components/admin/clinic-manager.tsx (212 lines)
- For: per clinic card: state buttons, region buttons, manager list, add manager form.
- Decides: state change result DISCARDED (`void (await setState(...))` :136), so a refused state change shows nothing. Region errors are shown (:165). Password field is `type="text"` (:187).
- Notes: no confirm on state changes (activate/suspend with one click).

