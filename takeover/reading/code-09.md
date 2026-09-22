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

