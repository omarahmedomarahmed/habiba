# Slice 09: admin

The staff console: `app/(admin)` and `components/admin`, 86 files, 19,374 lines, every line read.

## Files

### app/(admin)/admin/actions.ts (965 lines)
- For: the console's general server actions: suspend/verify user, save CMS page, invoice discount/edit/void, patient refund, release held earnings, ledger adjust, upcoming discount, email a patient their record, taxonomy, radar suspension/offline/profile edit, resolve report, send every email template.
- Decides: EVERY action here is `requireRole("super_admin")` (founder only), including `decideTherapistVerification` :289, so a `staff`/`manager` cannot approve a clinician even though /admin/verifications is `requireStaff` and its nav badge is shown to every back office role (layout.tsx:122).
  - `decideTherapistVerification` :289: reject with empty note refused (:297, "They see this word for word"); stores `trimmed` via `decideVerification`; emails it verbatim (:349, :350) via `after()`. Idempotent: `decideVerification` returns falsy when already reviewed, "Somebody already reviewed this one." (:308). Audit reason carries the note plus rejection count and "documents cleared" (:323). Undo: none on this path.
  - `verifyUser` :59: a SECOND verification path. `setVerification` (lib/data/admin.ts:146-185) writes `users.verification_status` and upserts `therapist_verifications.state` (approved/rejected/submitted), so the 0083 trigger stays consistent, but it approves with no submitted document and rejects with no reason and no email. Audited without a reason.
  - `applyInvoiceDiscount` :154: reason not required (empty accepted), audited with it. Idempotency in `discountInvoice` (lib/billing/service).
  - `editInvoice` :371: reason required (:379). Paid invoice cannot be re-priced (:397) or reopened (:409) but CAN be voided: `status: "void"` sets `paidAt = null` (:413) with no ledger reversal and no refund. Reason stored only in the audit row (`JSON.stringify(patch)` + reason, :426).
  - `refundPatient` :442: reason required; idempotency and routing in `refundSessionPayment` (lib/billing/connect.ts:962-999): refuses non-paid, sends pot payments to `refundToPot`, refuses anything without a Stripe intent (so manual EGP transfers cannot be refunded).
  - `releaseTherapistEarnings` :481: no reason; second press returns "There is nothing held" (:489), idempotent in effect. Stripe only.
  - `adjustLedger` :512: posts a balanced pair via `postAdjustment`; reason length not checked here (client requires 8); undo is the opposite adjustment.
  - `applyUpcomingDiscount` :541: no validation of amount or reason here.
  - `emailPatientRecordToPatient` :575: reason >= 8 chars; emails the patient an export link; audit only after a successful send (:602-604), so an export token created but not mailed leaves no audit row. Comment :571 "The clinician is told, in the same breath": nothing here tells the clinician; `clinicianName: "your therapist"` hardcoded (:597).
  - `setRadarSuspension` :703: suspension needs a reason >= 4 (:724) emailed verbatim (:746); release needs none. (The UI defeats the reason rule: see radar-command.tsx.)
  - `resolveReport` :817: no check that the report is still open; re-resolving silently overwrites resolver and resolution.
  - `sendEveryTemplate` :886: one typed address, audited before sending, paced 150 ms with one retry.
  - `emailTherapist` :192 / `announceToAllTherapists` :232: clinicians only. No action anywhere in this file sends a patient a claim link (task 105).
- Assumes: `requireRole` redirects to /dashboard on refusal (lib/auth/guard.ts:77); `audit()` routes non-uuid ids to `resource_key` (lib/audit.ts:129), so `${kind}:${code}` (:642) is safe.
- Promises: A2 partly (verification double decide refused; refunds and discounts delegated). A3 applied to clinicians: kept on the verification path, bypassed by `verifyUser`. A5: refusals are redirects and unaudited.
- Notes: `suspendUser` :45 takes no reason and tells the suspended person nothing.

### app/(admin)/admin/actuals/actions.ts (179 lines)
- For: founder payroll, capital and other-cost editing for the company's own books.
- Decides: all super_admin; dollars to cents once (`centsFromDollars` :31); employees are ended never deleted (:89); capital can be removed (:144); a zero other-cost removes the month (:177).
- Assumes: lib/data/payroll.ts and lib/data/capital.ts audit and re-assert the role (comment :154); no audit call in this file.
- Promises: none of the 25.

### app/(admin)/admin/actuals/page.tsx (144 lines)
- For: actuals board pack: position card, month table, payroll editor, bank editor.
- Decides: super_admin :49; default date computed server side in UTC (:66); months for the cost editor come from the table (:136).
- Promises: none. Nav owner only (layout.tsx:236), matches the guard.

### app/(admin)/admin/announce/page.tsx (54 lines)
- For: one email to every active clinician; lists every recipient name and email.
- Decides: super_admin :13; warns when RESEND is not configured (:25).
- Promises: none. Task 105: clinicians only.

### app/(admin)/admin/audit/page.tsx (115 lines)
- For: last 200 audit rows, filter by category.
- Decides: super_admin :19. Nav shows "Audit log" to managers (layout.tsx:202), so a manager is bounced (see Broken).
- Promises: A5: partly. The list exists, but a PATIENT actor (`actorAccountId`, lib/audit.ts:110) is not selected by `listAuditLog` (lib/data/admin.ts:193-235), so a patient's own act renders as "system" (:74). Reason, resource and ip are not shown; no paging past 200, no search, no date filter. The operator's rejection or refund sentence is not visible here.
- Notes: comment :59 "four principals ... four possible actors" and the code labels three.

### app/(admin)/admin/benefits/actions.ts (55 lines)
- For: `liftPause` :38, C247's one-step reversal of a paused sponsor benefit.
- Decides: super_admin; no reason; audited with the enrolment id and no sponsor (:34). `unpause` (lib/data/enrolment-verify.ts:305) sets `pausedAt=null, lastVerifiedAt=now` unconditionally, so pressing it on a live enrolment resets the re-verification clock. No undo (no re-pause control).
- Promises: grants money (restarts employer funding). A2: re-press harmless except the clock reset.

### app/(admin)/admin/benefits/page.tsx (71 lines)
- For: queue of paused benefits, longest wait first. One of the console's "stuck people" screens (tasks 163 to 167): funding stopped because a re-verification went unanswered; `id_number` rows flagged "Cannot self-serve".
- Decides: super_admin :38.
- Assumes: `pausedBenefits()` (lib/data/enrolment-verify.ts:341-365) joins enrolments + people + sponsors: person name, personal email, sponsor name. No session table.
- Promises: E1/E2 are about sponsor surfaces and this is not one, but it is a sponsor-to-named-person join on a staff screen (comment :29-35 argues why that is acceptable).

### app/(admin)/admin/checkins/page.tsx (83 lines)
- For: check-in mute rate against the halt threshold, plus six counts.
- Decides: super_admin :34; halted when rate >= `settings.checkins.muteRateHalt` (:39). No reply text anywhere (:18).
- Promises: none.

### app/(admin)/admin/clinics/actions.ts (110 lines)
- For: clinic state, billing region, first manager creation.
- Decides: super_admin; state validated (:31); region validated, refusal while an invoice is outstanding lives in `setClinicRegion`; operator sets the manager's password (:94). Audited, no reason text.
- Promises: C1 adjacent (activation). Notes: comment :20-23 "the one path that exists" for verification is contradicted by `verifyUser` (actions.ts:59).

### app/(admin)/admin/clinics/page.tsx (45 lines)
- For: practices with clinician COUNT, managers, contact. super_admin :20; own read `clinicsForAdmin`.
- Promises: C2 respected here (count only).

### app/(admin)/admin/content/[id]/page.tsx (42 lines)
- For: CMS page editor host. super_admin :14; notFound on a bad id.

### app/(admin)/admin/content/page.tsx (102 lines)
- For: CMS page list with status and view/edit links; link to /design.
- Decides: super_admin :14.
- Notes: empty state tells the operator to run `npm run db:seed` (:61). Per HAZARDS H28/H49 this editor is the non-destructive way to change published rows.

### app/(admin)/admin/errors/page.tsx (100 lines)
- For: server errors grouped by fingerprint, last 200 rows, stacks.
- Decides: super_admin :24. Nav shows "Errors" to managers (layout.tsx:214): bounced.

### app/(admin)/admin/financial-model/actions.ts (115 lines)
- For: save a forecast scenario; take a unit-economics benchmark snapshot.
- Decides: super_admin; shipped slugs refused (:55); both audited with reason text.
- Promises: none.

### app/(admin)/admin/financial-model/page.tsx (130 lines)
- For: plan tables, 36 month forecast, provenance split.
- Decides: super_admin :45; fallback "cannot measure" list includes "card fees: Stripe is in test mode" (:59).
- Notes: `scenarios[0]!` (:64) throws if no scenarios (shipped ones are code).

### app/(admin)/admin/numbers/actions.ts (53 lines)
- For: patient phone-number change queue: approve (with a note), send the code to the new number, refuse (with a reason).
- Decides: `requireStaff()`. Nothing here changes an account (:13); validation and audit are in lib/data/phone-change.ts.

### app/(admin)/admin/numbers/page.tsx (60 lines)
- For: the number-change queue. A "stuck people" screen: a patient locked out of their record by a phone change waits here.
- Decides: requireStaff :20; `LOCK_DAYS` stated (:39).
- Notes: old and new phone numbers and the patient's own reason are visible to every staff role.

### app/(admin)/admin/page.tsx (104 lines)
- For: Overview: practices, clinicians, patient charts, sessions 30d; AI calls/cost/errors; collected/outstanding 30d.
- Decides: super_admin :13.
- Notes: this is where a staff/manager lands after sign-in (lib/auth/actions.ts:283), it is the header logo target (layout.tsx:76) and the first nav item for everybody (layout.tsx:98), so every non-founder is bounced on arrival (see Broken). Footer "Stripe is the ledger of record" (:88) is stale for the Egyptian manual rail.

### app/(admin)/admin/partners/actions.ts (141 lines)
- For: partner state, first portal user, approve/withdraw production.
- Decides: super_admin; no key minting (:23); approval carries the approver id (DB refuses otherwise, :96); withdraw revokes no keys (:119) and its result is not checked.
- Promises: none of the 25.

### app/(admin)/admin/partners/page.tsx (58 lines)
- For: partners with key COUNT, users, documents URL, approval time. super_admin :19.

### app/(admin)/admin/patients/[id]/page.tsx (122 lines)
- For: a patient's manual transfers only, linked from /admin/transfers. Title is the patient's email; up to 50 payments with state, reference, reject reason, session ref prefix.
- Decides: `requireStaff()` :49; direct `controlDb` query; the read is NOT audited.
- Promises: A3: shows the stored `rejectReason` (:107). A5 "every read is written down": not kept here.
- Notes: `sent {p.amountCents} {currency}` (:98) prints the raw minor-unit integer ("sent 150000 EGP"), the defect 76.28 fixed on /admin/sponsors/[id] and /admin/transfers but not here. Any row with a refId is labelled "session" (:104) whatever its purpose. A "Received without proof ..." note (open-carts) prints in the red rejection style (:107).

### app/(admin)/admin/payouts/actions.ts (129 lines)
- For: manual payout queue: take on, approve, mark sent (proof URL), confirm arrival, reject (reason).
- Decides: EVERY action super_admin (:27, :45, :70, :92, :110) while the page is `requireStaff` and the comment calls them "The 24/7 team's four buttons" (:18). Reject reason >= 5 chars, stored verbatim as `rejectedReason` and sent as the notification body (lib/billing/payouts.ts:445-478); this file's audit row omits the reason (:120). State moves are compare-and-set (lib/billing/payouts.ts:261-270), but `markPayoutSent` checks status by a READ, posts the ledger (`postManualPayout`, lib/billing/ledger.ts:705-736), and only then runs the conditional `move` (lib/billing/payouts.ts:362-393). Two concurrent presses can post two `manual_payout` transactions and move once; ledger_entries has only a plain index on (ref_type, ref_id) (drizzle/0024_ledger.sql:33). `duplicatePayouts` (lib/billing/ledger.ts:979-989) detects it afterwards. No undo (no un-send, no reopen).
- Promises: A2 partly. A3-for-clinicians kept.
- Notes: two-person rule (lib/billing/payouts.ts:326-334) needs a different owner; with founder-only actions that is two founders.

### app/(admin)/admin/payouts/page.tsx (130 lines)
- For: books-balance card (cash, held for clinicians, out of balance, unbalanced entries, cash by entity, unbacked entity), manual queue, last 50 Stripe transfers.
- Decides: requireStaff :40; nav shows it to everyone.
- Promises: T3 (held balance visible).

### app/(admin)/admin/radar/investigate/[id]/page.tsx (167 lines)
- For: break glass on one reported session: complaint text, reply-to email, clinician, off-record gaps (timings only), full transcript.
- Decides: super_admin :35; audit `phi_access / break_glass.investigate` with patientId, reason `Report <id>, <kind>`, written before render (:43) on every render.
- Promises: A5 kept here. T2 consistent (gaps as timings, "We have the timings, not the words" :114).
- Notes: operator types no justification. The link appears only for OPEN reports (report-queue.tsx:113) but the URL accepts any report id.

### app/(admin)/admin/radar/page.tsx (100 lines)
- For: Radar control: live board of every clinician, ban / force offline / edit profile, report queue (open, actioned, dismissed).
- Decides: super_admin :26. Nav shows "Radar control" with a red badge to every role (layout.tsx:130): bounced.
- Notes: copy :58 says a no-show "has already been refunded and the clinician suspended automatically" (not checkable from this slice).

### app/(admin)/admin/ratings/page.tsx (150 lines)
- For: every rating, therapist and service stars apart, comment, tags, clinician. No patient identity.
- Decides: super_admin :28. Nav shows "Ratings" to managers (layout.tsx:160): bounced.

### app/(admin)/admin/settings/actions.ts (506 lines)
- For: pricing tiers, session fee/cut/bounds, copilot allowances, manual rail (provider, payout methods, two-person threshold, alert hours, netting, EGP spread, EGP rate), one country (VAT, crisis line, entity, labels, money switch), Egyptian transfer details, add a staff/manager account.
- Decides: super_admin. Tier keys read from storage (:53); seat bands and partner price carried through (:95, :101); whole-object `settingsProblem` (:103). Platform fee > 0 (:149), cut 0..90 (:141). Payouts read-then-overlay (:228); EGP rate 1..1000 (:252); spread 0..10% (:264); a blank threshold becomes 0 ("every payout needs two people"). Crisis line both-or-neither and digits (:320, :326); currency derived from entity (lib/settings/defs.ts:1586). `saveTransferFields` refused while any payment is in flight (:402), audits labels not values (:456). `addBackOfficeUser` staff or manager only (:483); no control anywhere to disable one except `suspendUser`.
- Promises: T3 (netting :239), P5 adjacent (crisis line), A1/A4 indirectly (details lock).

### app/(admin)/admin/settings/page.tsx (235 lines)
- For: margin per session, countries with no rail, enabled countries with no crisis line, "Egypt has no payment rail yet" card, all settings editors, team, transfer details, mail check, video check, countries.
- Decides: super_admin :52; `maxDuration = 60`.

### app/(admin)/admin/sponsors/[id]/page.tsx (279 lines)
- For: one company for an operator holding its transfer: pot and coverage, ledger and drift, contact, refund terms or "No terms agreed", every transfer they sent including rejected ones with the reason, "Where the pot went", sessions-vs-ledger agreement.
- Decides: `requireStaff()` :43 (any back office role; the /admin/sponsors list is founder only). Read not audited.
- Assumes: `potTrace` (lib/console/pot-trace.ts:76-140) joins session_payments -> sessions -> patients -> enrolments (by personId, this sponsor) with users for the clinician, filtered to `fundingSource = 'pot'`.
- Promises: E1: the "no patient name" half is kept (the "patientRef" is `sessionId.slice(0,8)`, pot-trace.ts:129). The "never when" half is not, on this admin screen: every funded session is listed with its DATE and the CLINICIAN'S NAME (:241-243) under the employer's name, readable by any staff account. This is the sponsor x session join in the slice.

### app/(admin)/admin/sponsors/actions.ts (177 lines)
- For: sponsor state, billing entity, open pot with terms (+ overdraft, + welcome credit), add portal user, rotate joining code.
- Decides: super_admin. `activate` ignores `setSponsorState`'s result. `openTheirPot` converts overdraft and welcome credit with `Math.round(Number(x) * 100)` and no bound check (junk gives NaN) before `openPot`; audit omits the amounts (:117). Idempotency relies on `openPot` refusing a second pot.
- Promises: A1: the welcome credit is money granted by an operator with no transfer behind it (by design), unaudited as to amount.

### app/(admin)/admin/sponsors/page.tsx (118 lines)
- For: every sponsor: code and attempts this week (spike), ledger balance, users, contact; drift banner from `reconcilePots`.
- Decides: super_admin :36; no roster (:18).
- Promises: E1 kept here. Notes: no row links to /admin/sponsors/[id]; that page is reachable only from /admin/transfers.

### app/(admin)/admin/strings/actions.ts (121 lines)
- For: translation workspace: save draft, publish, clear, machine drafts, bulk approve, language switches.
- Decides: super_admin; publish separate from save (:40); audit delegated to lib/i18n/authoring.

### app/(admin)/admin/strings/page.tsx (80 lines)
- For: language panels and per-locale string table. super_admin :25; default locale "ar".

### app/(admin)/admin/support/actions.ts (116 lines)
- For: ticket buttons: take, open (audited read), waiting on them, extend once, moved to WhatsApp, close with summary (sends the person a link).
- Decides: requireStaff; no patient id (:21); claim and close audited here.
- Notes: `openTicket` (:46) has no caller in the console (the only other `openTicket` is app/support/[token]/actions.ts): staff cannot read a ticket.

### app/(admin)/admin/support/page.tsx (70 lines)
- For: patient and therapist queues; health card for managers. requireStaff :22; nav matches.

### app/(admin)/admin/taxonomy/page.tsx (84 lines)
- For: Radar lists: countries (switch), languages and specialties (add, switch, remove).
- Decides: super_admin :40; closing a country takes its clinicians off the radar and tells them (:25-27).

### app/(admin)/admin/therapists/[id]/page.tsx (227 lines)
- For: one clinician end to end.
- Decides: super_admin :40; `break_glass / admin.therapist.view` audit before the reads (:48).
- Promises: A5 kept. Shows the clinician's caseload BY NAME with email, sessions per patient with dates, copilot threads per named patient, payments by patient name (:154-210), which contradicts lib/auth/guard.ts:147-152 ("no screen behind this guard queries a clinical table") and the patients/[id] comment (:25-28). Founder only.

### app/(admin)/admin/therapists/page.tsx (45 lines)
- For: clinician list with Verify and Suspend. super_admin :12.
- Notes: subtitle :20 "an unverified clinician can still record sessions" is stale (`requireVerified`, lib/auth/guard.ts:92, and the (app) layout redirect).

### app/(admin)/admin/transfers/actions.ts (109 lines)
- For: the manual rail: `confirm`, `reject` (reason), `confirmUnclaimed` (credit an open cart without proof, reason).
- Decides: requireStaff (by design). Confirm is compare-and-set `submitted -> confirmed` (lib/billing/manual.ts:519-528); a second press gets "That payment is not waiting for a decision." If the grant throws, the row stays confirmed and this action returns the error BEFORE its audit call (:36); no console control re-runs a grant although lib/billing/manual.ts:480 says "an operator can re-run a grant". Reject: >= 10 chars, trimmed and stored verbatim (lib/billing/manual.ts:676-687), same text in the audit (:68). No rejection notice is sent (lib/billing/payment-notices.ts exports only submitted/confirmed); the payer sees the reason only when they reopen the transfer sheet (lib/billing/manual-entry.ts:350-352). Operator is told "Rejected, and they have been told why." (:72). No undo by design (:13).
- Promises: A1 kept. A2 kept for the row. A3 partly. A4 see page.

### app/(admin)/admin/transfers/page.tsx (228 lines)
- For: submitted queue (oldest first, 200 cap) and open carts (newest first, 200 cap) with payer names, types, profile links.
- Decides: requireStaff :35. Payer is "clinic" when the org has > 1 therapist (:137). Profile links: company /admin/sponsors/<id> (staff ok), clinician /admin/therapists/<id> (founder only: staff bounced), patient /admin/patients/<id> (staff ok), guest none.
- Promises: A4 BROKEN (see Broken). A1 kept. No tab or list for REJECTED payments, so a rejected payer who never comes back is nobody's work (task 124).
- Notes: proof URL is not sent to the client (:196-206).

### app/(admin)/admin/transfers/receipt/[id]/route.ts (140 lines)
- For: streams a receipt through the app so every look is audited.
- Decides: requireStaff :60 (a redirect, not an API error); 404 without proof; audit before the fetch (:87) with separate open/download actions; `no-store`.
- Promises: A5 kept for receipts.

### app/(admin)/admin/tv/actions.ts (132 lines)
- For: Total View key setup, unlock, relock; mail a patient their record (admin BCC); mail a clinician's history to any address (reason, clinician notified).
- Decides: key actions super_admin; the two disclosures need an elevated session (`requireElevated`, lib/console/gate.ts:165, itself super_admin). Clinician history: reason >= 20, audit with address and reason, in-app notice to the clinician (:123). Patient record: no reason, no clinician notice; audit even if mail failed.
- Promises: privacy wall BROKEN (see Broken): the founder is BCC'd the working record link.

### app/(admin)/admin/tv/board-actions.ts (88 lines)
- For: refresh the business board sections.
- Decides: `requireManager()` on all nine (:41-87), while the page is effectively founder only, so a manager can call them directly.

### app/(admin)/admin/tv/page.tsx (190 lines)
- For: Total View: business board, then behind two keys: live sessions with patient and clinician names, radar, 30 day timeline, people search with copilot conversations and sessions, session detail with the full note, transcript and risk flags, roster, audit stream.
- Decides: `requireManager()` :33 then `elevated()` :36, which calls `requireRole("super_admin")` (lib/console/gate.ts:150): a manager is redirected, not shown the gate. Grant per auth session, 20 min; unlock rate limited 5/hour; failed unlock audited.
- Promises: A5 BROKEN here: no read of a person, conversation, note or transcript is audited (only `console.unlock`, lib/console/gate.ts:127), while gate.tsx:29 says "every read is recorded". Not in nav.

### app/(admin)/admin/usage/page.tsx (286 lines)
- For: recording consent (granted / declined / never asked), cost per session, spend by kind/model, per clinician spend vs fee.
- Decides: super_admin :34. Nav shows it to managers (layout.tsx:213): bounced.

### app/(admin)/admin/usage/sessions/page.tsx (219 lines)
- For: every session in 30 days with time, clinician, modality, minutes, audio, calls, cost, paid, fee; filter by clinician. super_admin :44; no patient.

### app/(admin)/admin/vault/page.tsx (609 lines)
- For: founder money page: held balances + release, liability cards (held, pots, VAT), renewal reconciliation, unbalanced transactions, ledger adjust, ledger totals, monthly chart and table, traction, spend by purpose, per clinician economics, every invoice (discount / credit), every patient payment (refund).
- Decides: super_admin :29.
- Promises: T3 (held shown as a liability). E-walls: payment rows name clinician and org, never the payer (vault-payment-row.tsx:44-56).

### app/(admin)/admin/verifications/page.tsx (154 lines)
- For: clinician approval queue with ID, licence, headshot inline through the audited document route; tabs Waiting / Approved / Rejected; rejection counts.
- Decides: requireStaff :54: any staff member sees applicants' identity documents, but every decision is founder only (actions.ts:294), so non-founders are bounced on pressing Approve/Reject.
- Notes: comment :33 still describes the page as "super-admin only". No waiting-age marker for an applicant (the `crisis` position's "applicant who is waiting").

### app/(admin)/layout.tsx (265 lines)
- For: console shell and nav; admits staff, manager, super_admin via `requireStaff()` :49.
- Decides: nav by role. All roles: Overview, Support, Numbers, Verifications, Radar control, Payouts, Transfers. Manager+: Ratings, Audit log, Usage and cost, Errors. Founder: Clinicians, Vault, Sponsors, Paused benefits, Clinics, Partners, Check-ins, Radar lists, Announce, Site content, Settings, Strings, Financial model, Actuals. Unlinked: /admin/tv, /admin/patients/[id], /admin/sponsors/[id], /admin/therapists/[id], /admin/content/[id], /admin/radar/investigate/[id], /admin/usage/sessions.
- Promises: A5 broken in effect: the comment :46-48 says nobody is shown a door that will bounce them; eight doors do (see Broken). "Back to portal" (:79) sends a staff member into the clinician portal, which redirects them to /onboarding.

### components/admin/actuals-table.tsx (301 lines)
- For: month by month actuals with a "Not ours" toggle (VAT, owed to clinicians, pots) and a "Not counted" list. Microcents divided by 1e5 (H13 respected).

### components/admin/announcement.tsx (123 lines)
- For: clinician broadcast composer; typing the recipient count arms it (:25). No unsend.

### components/admin/bank-editor.tsx (331 lines)
- For: capital in (add / remove, no confirm on remove :195) and other costs by kind and month, naming months with nothing typed.

### components/admin/board.tsx (528 lines)
- For: nine business sections with refresh and manage links.
- Decides: read only. Companies table shows each company's sponsored "Sessions, 30d" (:304): a sponsor x session count on an admin screen; for a company with one enrolled person it is that person's attendance. Board actions are manager-callable (board-actions.ts).

### components/admin/clinic-manager.tsx (212 lines)
- For: clinic cards: state buttons, region buttons, managers, add manager (password `type="text"` :187).
- Decides: state result discarded (`void (await setState(...))` :136), so a refusal is invisible; no confirm.

### components/admin/clinician-row.tsx (88 lines)
- For: clinician row with Verify and Suspend.
- Decides: Verify calls `verifyUser(id, "verified")` with no document, reason or confirm (:62), UI flips regardless of result (:63); Suspend flips regardless (:79).

### components/admin/competitor-editor.tsx (201 lines)
- For: the `competitors` CMS block editor (rivals, rows, concede). No client validation.

### components/admin/financial-model.tsx (878 lines)
- For: interactive forecast with provenance badges (override becomes "assumed"), hires, run-out, save scenario / measure. Pure client; `scenarios[0]!` (:40).

### components/admin/gate.tsx (168 lines)
- For: Total View two-key unlock, and key setup (second key write-once from the UI, :116).
- Notes: claims "Everything past this point is read-only and every read is recorded" (:29): false (tv/page.tsx).

### components/admin/held-balances.tsx (161 lines)
- For: clinicians' held earnings with reason badge and "Release now" (only with a Stripe account). No reason, no confirm; idempotent in effect. An Egyptian manual-rail clinician gets no button.

### components/admin/ledger-adjust.tsx (148 lines)
- For: hand adjustment (organisation, account, signed dollars, reason >= 8).
- Decides: `therapistId: null` always (:131), so a clinician's payable cannot be adjusted from here. No confirm.

### components/admin/mail-check.tsx (137 lines)
- For: send every preview email to one address; roster by audience with "nothing, which is a gap".

### components/admin/number-queue.tsx (151 lines)
- For: number-change rows: old -> new phone, patient's reason verbatim, age, status, code expiry; Approve (note), Send code, Refuse (reason). No overdue colour.

### components/admin/open-carts.tsx (167 lines)
- For: collapsed "N opened and never submitted"; per cart "I have this in the bank" -> reason >= 10 -> "Credit without proof".
- Decides: `confirmUnclaimed` moves awaiting_proof -> submitted with `rejectReason = "Received without proof. <reason>"`, audits `payment.confirmed_without_proof`, then runs `confirmPayment` (lib/billing/manual.ts:596-659). Credits the cart's amount; the bank amount cannot be entered.
- Promises: A4 partly (remedy exists only when a cart exists). A2 compare-and-set.

### components/admin/page-editor.tsx (410 lines)
- For: structured CMS block editor with block guide; Save draft / Publish.
- Notes: CTA link free text; no scheme check found in lib/content/sanitise.ts (:84, :130); rendered by next/link (components/public/blocks.tsx:453, :735). Founder only.

### components/admin/partner-manager.tsx (260 lines)
- For: partner rows: key count, contact, intent, production approval with documents link, states, users, add user (password `type="text"`).
- Decides: state results discarded (:208); documents link opens the stored URL directly (:161), unaudited (H14).

### components/admin/paused-benefits.tsx (118 lines)
- For: paused rows: name, sponsor, personal email, days paused (red >= 30), "Cannot self-serve", "Lift the pause" (no reason, no confirm).

### components/admin/payout-queue.tsx (277 lines)
- For: Manual / Automated tabs; row: age (red overdue), clinician, status, entity, Two people, Owned, USD -> local amount, method, identifier, account name.
- Decides: Take it on, Approve (requested), Mark sent with proof URL text (approved), Confirm arrival (sent), Reject with reason (not when sent). No confirm dialogs. Proof is a typed URL, not an upload.

### components/admin/payroll-editor.tsx (253 lines)
- For: employees with dated salary history, "They left" / "Return". Internal books.

### components/admin/plan-tables.tsx (350 lines)
- For: Egypt operating plan with sliders on guesses only; totals card labels AI cost "OpenAI" (:281). Pure client.

### components/admin/position-card.tsx (151 lines)
- For: ours to spend, bank balance with held-for-others, burn, runway, capital, lowest point.
- Notes: comment :23 says the table "still says CASH"; the column is "Trading" (actuals-table.tsx:136).

### components/admin/radar-command.tsx (676 lines)
- For: operator radar: stats, globe (polls /api/admin/radar every 3 s), filters, table, force offline, Ban 24h / 3 days / "Until released" (3650 days), Release, profile editor.
- Decides: `act` sends `reason || "Administrator action"` (:455), so the server's reason rule (actions.ts:724) never fires from this UI. `forceRadarOffline` result ignored (:482); profile save always says "Saved." (:644).

### components/admin/receipt-modal.tsx (314 lines)
- For: evidence full size via our route, reference, amount sent, settles, lines, Approve / Reject / Download.
- Decides: reject armed at 5 chars (:261), server needs 10; Approve enabled with no proof or a broken image (:157 is a warning only).

### components/admin/report-queue.tsx (166 lines)
- For: report cards with the patient's words verbatim, reply-to email, break-glass link (open reports only), decision note, Actioned / No action needed.
- Notes: nothing tells the reporting patient the outcome.

### components/admin/settings-editor.tsx (678 lines)
- For: Pricing, Session, Copilot, Team (add staff/manager), Payouts (manual rail), Country editors.
- Notes: CountryEditor copy (:668) speaks of refusing card payments; Egypt has none. Comment :298 repeats the stale "board behind requireManager()".

### components/admin/sponsor-manager.tsx (331 lines)
- For: sponsor rows with contact, state, entity, code + attempts + rotate, open-pot form (terms, expiry, overdraft, welcome credit), users, add user.
- Decides: state and rotate results discarded (:173, :226); rotate has no confirm though it "kills every printed poster" (:209); password `type="text"` (:309); comment :291 "Admin can remove somebody" and there is no remove control.

### components/admin/strings-editor.tsx (358 lines)
- For: language panels, string table, save draft / publish per row, clear, bulk approve excluding safety strings (:192).

### components/admin/support-queue.tsx (287 lines)
- For: ticket cards: age/waiting, reference, name, topic, owner; Take, Waiting on them, Extend once, Moved to WhatsApp, Close and send the link.
- Decides: says "Open it to read what they wrote. That read is logged." (:226) with no open control.

### components/admin/taxonomy-editor.tsx (194 lines)
- For: chips per list; toggle (optimistic, rollback on error), add, delete. Closing a country is one click, no confirm.

### components/admin/therapist-panel.tsx (891 lines)
- For: clinician tabs: Patients (name, email, source, counts, last seen, Send their record), Sessions (date, patient, modality, minutes, line count, note status, price), Copilot (spend, threads per patient), Billing (earnings, invoices: discount / re-price / rename / credit next renewal / void; patient payments), Manage (Verify, Reject, Suspend, email the clinician).
- Decides: Void is enabled on a PAID invoice (:736) and accepted server side (actions.ts:408-414). Discount/re-price disabled when paid (:648, :677). Verify/Reject via `verifyUser` (:801, :810): no reason, no email. No confirm dialogs.

### components/admin/total-view.tsx (883 lines)
- For: Total View UI: now, timeline, people (sessions with summaries, copilot conversation content), clinicians (disclose a practice record to any address), audit, session detail (risks, full note, transcript).
- Decides: "Email their record to them" has no reason and no confirm (:555-569) and says "You are blind-copied" (:571). Header "Nothing here can be edited" (:181).

### components/admin/transfer-fields-editor.tsx (225 lines)
- For: Egyptian bank details payers see (label, value, hint, audiences, order), "card payments are coming".
- Decides: disabled while `inFlight > 0` (:57), and `inFlight` includes every open cart (lib/billing/manual.ts:709-714).

### components/admin/transfer-queue.tsx (390 lines)
- For: transfer rows by payer type: payer (linked), purpose, amount sent, settles, waiting minutes (red > 15), reference, evidence modal, Confirm, Reject with reason.
- Decides: row Confirm is one click with no dialog, enabled when no proof was uploaded (:249); reject armed at 10 chars (:375).

### components/admin/vault-invoice-row.tsx (176 lines)
- For: invoice row with discount / credit next renewal when not settled (:38). Optimistic "waived" guess (:140). No reason required.

### components/admin/vault-payment-row.tsx (154 lines)
- For: patient payment row (clinician, org, date, our cut, gross, net) with refund (reason).
- Decides: refund via `refundPatient`. Copy "Refunds <gross> to the patient" (:112) is wrong for pot-funded payments (money returns to the pot, lib/billing/connect.ts:988). Manual EGP payments cannot be refunded (connect.ts:993).

### components/admin/verification-review.tsx (178 lines)
- For: one applicant: licence, documents via the audited route, rejection-count banners (C351), note, Approve / Reject (or "Reject and clear").
- Decides: reason enforced server side and emailed verbatim; idempotent ("Somebody already reviewed this one.").

### components/admin/video-check.tsx (58 lines)
- For: creates, confirms and deletes a real video room on every render of /admin/settings.

## Console map (slice focus)

Refusal for every guard below is `redirect("/dashboard")` (lib/auth/guard.ts:77), which the clinician layout turns into /onboarding for a non-founder (app/(app)/layout.tsx:117-119, lib/data/verification.ts:167). No refusal is audited anywhere (only `console.unlock.denied`, lib/console/gate.ts:113).

| Page | Page guard / nav | Money or grant action | Action guard | Idempotent (A2) | Reason required, stored verbatim (A3) | Undo |
|---|---|---|---|---|---|---|
| /admin/transfers | staff / all | Confirm transfer | staff | yes, CAS on `submitted` | n/a | none |
| | | Reject transfer | staff | yes, CAS | >= 10 chars, verbatim on payment + audit; no notice sent | none |
| | | Credit without proof (open cart) | staff | yes, CAS on `awaiting_proof` | >= 10, stored as "Received without proof. ..." | none |
| /admin/payouts | staff / all | Take on, Approve, Mark sent, Confirm arrival | FOUNDER | CAS, except Mark sent posts ledger before CAS | n/a | none |
| | | Reject payout | FOUNDER | CAS | >= 5, verbatim, notified; not in audit | none |
| /admin/verifications | staff / all | Approve / Reject clinician | FOUNDER | yes | reject required, verbatim email | none |
| /admin/therapists/[id] | founder | Verify / Reject (`verifyUser`) | founder | upsert | NO reason, no email | flip back |
| | | Void invoice (incl. PAID) | founder | n/a | reason in audit only | none |
| | | Discount / credit next renewal | founder | service | no reason required | none |
| /admin/vault | founder | Release held balance | founder | yes (0 second time) | none | none |
| | | Refund patient payment | founder | service refuses non-paid | required, audit | none |
| | | Ledger adjustment | founder | no (each press posts) | >= 8 client side | opposite post |
| /admin/benefits | founder | Lift pause (restart funding) | founder | resets clock | none | none |
| /admin/sponsors | founder | Open pot + welcome credit | founder | via `openPot` | terms required; amount not audited | none |
| /admin/radar | founder / all | Ban from radar | founder | overwrite | UI substitutes "Administrator action" | Release |
| /admin/tv | manager then founder + 2 keys | Email patient record (founder BCC), disclose clinician history | founder, elevated | no | patient: none; clinician: >= 20 | none |

Stuck/blocked people screens (tasks 163 to 167): Paused benefits (founder), Numbers (staff), Support queues (staff, but tickets unreadable), Verifications queue (staff sees, founder decides, no waiting age), Transfers queue and open carts (staff), Payout queue with overdue marker (founder actions). None for: rejected transfers, guest payers, expired claim links, confirmed-but-ungranted payments, patients who filed a report.

Task 105: no console control sends a patient a claim link or a free email. Patient-directed sends are only the record export (therapist panel, Total View) and the support close link.

## Stale

1. app/(admin)/layout.tsx:46-48: "the nav is filtered by role so nobody is shown a door that will bounce them". Eight doors bounce (see Broken 1).
2. app/(admin)/layout.tsx:221-229: 76.53 fixed the manager-bounce defect for Financial model and Actuals; the same defect remains for Audit log (:202), Usage (:213), Errors (:214), Ratings (:160).
3. app/(admin)/admin/actions.ts:571-573: "The clinician is told, in the same breath." Nothing in `emailPatientRecordToPatient` tells the clinician.
4. app/(admin)/admin/actions.ts:566-569: "the admin causes the record to be sent and never sees it". True for this action, false for `mailRecordToPerson` (tv/actions.ts:51), which BCCs the admin.
5. app/(admin)/admin/actions.ts:618-624: switching an item off never hides working clinicians. False for countries (taxonomy/page.tsx:25-27).
6. app/(admin)/admin/audit/page.tsx:59-66: four principals, four actors. Patient actors are not selected and render as "system".
7. app/(admin)/admin/verifications/page.tsx:33: "This page is super-admin only" was true. The page is `requireStaff` (:54).
8. app/(admin)/admin/therapists/page.tsx:20: "an unverified clinician can still record sessions". `requireVerified` and the (app) layout redirect say otherwise.
9. app/(admin)/admin/settings/actions.ts:466-468 and components/admin/settings-editor.tsx:298-299: "Five admin pages are behind requireStaff() and /admin/tv is behind requireManager()". Seven pages plus the receipt route are requireStaff; /admin/tv is founder only in effect (lib/console/gate.ts:150).
10. app/(admin)/admin/tv/board-actions.ts:35: "the same guard as the page". The page is founder only; these are manager.
11. app/(admin)/admin/tv/actions.ts:33-35: the owning clinician "is notified exactly as they are for any other request". Nothing notifies them.
12. app/(admin)/admin/radar/page.tsx:17-19, components/admin/report-queue.tsx:115-120, app/(admin)/admin/radar/investigate/[id]/page.tsx:16: "the only route to a transcript in the entire admin console". /admin/tv shows any session's transcript and note (tv/page.tsx:155-184).
13. components/admin/gate.tsx:29: "every read is recorded". Only the unlock is.
14. components/admin/total-view.tsx:181: "Nothing here can be edited". It sends two kinds of disclosure email.
15. app/(admin)/admin/payouts/actions.ts:18: "The 24/7 team's four buttons". Every one is founder only.
16. app/(admin)/admin/transfers/actions.ts:72: "Rejected, and they have been told why." No notice is sent.
17. components/admin/support-queue.tsx:226: "Open it to read what they wrote." No open control exists.
18. components/admin/sponsor-manager.tsx:291: "Admin can remove somebody". No remove control.
19. app/(admin)/admin/clinics/actions.ts:20-23 and components/admin/clinic-manager.tsx:30-32: verification through /admin/verifications is "the one path that exists". `verifyUser` is a second, document-free path (clinician-row.tsx:62, therapist-panel.tsx:801).
20. app/(admin)/admin/page.tsx:88: "Stripe is the ledger of record". The Egyptian rail has no processor.
21. components/admin/position-card.tsx:23: the table "still says CASH". It says "Trading".
22. lib/console/pot-trace.ts:46-50, :59-62 (read for this slice): the patient reference "LINKS to their own admin page". `patientRef` is a session id prefix and `patientHref` is always null (:129-130).
23. app/(admin)/admin/settings/actions.ts:405 and transfer-fields-editor.tsx:79-80: "Clear the transfers queue first". Open carts count as in flight and the console cannot clear them.

## Suspect

1. lib/billing/payouts.ts:362-393 (called from payouts/actions.ts:73): `markPayoutSent` reads status, posts `postManualPayout` (lib/billing/ledger.ts:705), then runs the compare-and-set `move`. Two concurrent Mark sent presses post two cash-out transactions against one payout. Matters for A2. Detected by `duplicatePayouts` (ledger.ts:979); prevention would need a unique index or the post inside the CAS.
2. transfers/actions.ts:25-36 with lib/billing/manual.ts:530-545: a grant failure leaves the payment confirmed, no `transfer.confirm` audit, and no console control to re-run the grant. Whether `grantFor` (lib/billing/manual-grants.ts) is itself idempotent on a retry is not checkable from here. A person paid and got nothing, and the only record is a log line.
3. lib/console/pot-trace.ts:106-118: the pot trace joins enrolments by `personId` and sponsor, not by which pot paid. A person enrolled with two sponsors, or with two enrolment rows at one sponsor (removed and re-enrolled), would have each pot session listed under both sponsors or twice. Affects /admin/sponsors/[id] spend totals and `potSpendAgrees`.
4. lib/billing/cart.ts:93-102: opening a new cart DELETES the payer's older open carts. A payer who sent money against cart A and later reopened the sheet removes the only row that could match that bank line, so the line becomes unmatchable (A4).
5. components/admin/transfer-fields-editor.tsx:57 with lib/billing/manual.ts:709-714: open carts never expire and only the payer can cancel them, so the bank details may be locked indefinitely.
6. app/(app)/onboarding/page.tsx:28-31: a refused staff or manager lands here and `ensureVerification(actor)` runs for them. Whether that creates a `therapist_verifications` row for a staff account (and what it does to their `users.verification_status` via trigger 0083) needs lib/data/verification.ts.
7. app/(admin)/admin/sponsors/actions.ts:104-112: overdraft and welcome credit go to `openPot` as possibly NaN or unbounded; validation lives in lib/data/sponsor-admin.ts.
8. components/admin/page-editor.tsx:304-308 with lib/content/sanitise.ts:84,130: `ctaHref` has no scheme check that I found; a `javascript:` link would rely on React's own blocking. Founder only.
9. app/(admin)/admin/tv/board-actions.ts:40-88: nine server actions reachable by a manager although the page is founder only. They return the business board, including per-company sponsored session counts.
10. components/admin/video-check.tsx:30-31: a real provider room is created on every Settings render (cost, rate limits).
11. app/(admin)/admin/radar/page.tsx:58: "A no-show has already been refunded and the clinician suspended automatically." Check lib/data/feedback for an automatic refund, and whether it can double with a manual refund from /admin/vault.
12. app/(admin)/admin/actions.ts:817-849: `resolveReport` can re-resolve a closed report and overwrite who decided.
13. app/(admin)/admin/benefits/actions.ts:43 with lib/data/enrolment-verify.ts:305-312: lifting a pause on a live enrolment resets `lastVerifiedAt`, postponing its next re-verification.

## Broken

1. **Every non-founder is bounced on arrival, and the refusal is neither explained nor recorded (A5).** Staff sign-in sends a staff or manager to `/admin` (lib/auth/actions.ts:282-284); `/admin` is `requireRole("super_admin")` (app/(admin)/admin/page.tsx:13); refusal is `redirect("/dashboard")` (lib/auth/guard.ts:77); the clinician layout sends anybody not cleared to `/onboarding` (app/(app)/layout.tsx:117-119; `isCleared` is only super_admin or approved, lib/data/verification.ts:167); onboarding bounces only super_admin (app/(app)/onboarding/page.tsx:28). So the demo "Support, not a founder" account lands on "Verify your practice". Other nav doors that bounce: Overview and logo (all roles), Radar control (all, layout.tsx:130), Ratings, Audit log, Usage, Errors (managers, :160, :202, :213, :214). Pages that render for staff but whose every action is founder only: Payouts (payouts/actions.ts), Verifications (actions.ts:294). The A5 walk ("redirected rather than shown an error, and the refusal is on the record") fails on both halves: the redirect lands in the wrong portal and nothing is written.
2. **A paid invoice can be voided with no reversal.** therapist-panel.tsx:733-741 enables Void unless already void; `editInvoice` accepts `status: "void"` on a paid invoice and sets `paidAt = null` (actions.ts:408-414). No ledger leg, no refund. I found no guard in drizzle/*.sql or lib/billing.
3. **A4: money that arrives with no claim or more than the claim is not work on /admin/transfers.** No bank-line record, no field for the amount received, no overpayment state, no difference shown (transfers/page.tsx, transfer-queue.tsx, receipt-modal.tsx). Confirm credits the claimed `settlesCents`; `confirmUnclaimed` credits the cart's amount (lib/billing/manual.ts:596-659). A manual payment cannot be refunded (lib/billing/connect.ts:993). Nothing in lib/app/components/drizzle mentions overpayment except comments.
4. **The founder is blind-copied a live link to a patient's whole record.** components/admin/total-view.tsx:562 -> tv/actions.ts:37-65 sends `sendRecordExport` with `copyTo: actor.email`; lib/mail.ts:470 puts it in BCC of the same message whose link opens "every session, every note, and the transcript" (lib/mail.ts:453-455) and tells the patient "nobody at 24Therapy read it in order to send it to you" (:460). No reason required, clinician not told.
5. **Total View reads are not audited.** tv/page.tsx:41-66 loads people, copilot conversations, notes, transcripts and risk flags; no `audit` call there or in lib/console/reads.ts. Only the unlock is recorded (lib/console/gate.ts:127). Contradicts gate.tsx:29 and the A5 promise "every read is written down".
6. **A radar ban's reason rule is defeated by the UI.** radar-command.tsx:455 sends `reason || "Administrator action"`, so the server check at actions.ts:724 ("Give a reason. The clinician is shown it.") never fires; the clinician receives "Reason given: Administrator action" (actions.ts:746), possibly for "Until released" (3650 days).
7. **A clinician can be rejected with no sentence.** therapist-panel.tsx:806-813 calls `verifyUser(id, "rejected")` (actions.ts:59-75): no reason, no email, state set to rejected (lib/data/admin.ts:163-184). The verification path's own rule (actions.ts:297) is bypassed.
8. **Support tickets cannot be read in the console.** support-queue.tsx has no open control though :226 says to open it; `openTicket` (support/actions.ts:46) has no caller. Staff must close a ticket with "what was done" without reading it.
9. **A rejected transfer notifies nobody, and the operator is told it did.** transfers/actions.ts:72 says "they have been told why"; `rejectPayment` (lib/billing/manual.ts:670-694) sends nothing and payment-notices.ts has no rejection notice. The reason is visible only if the payer reopens the sheet (lib/billing/manual-entry.ts:350-352), which a guest has no account to do. Task 124 remains.
10. **/admin/patients/[id] prints raw minor units.** :98 `sent {p.amountCents} {currency}` shows "sent 150000 EGP"; the same bug was fixed on sponsors/[id] (:195-199) and transfers (page.tsx:185-191) by 76.28.
11. **Non-founder profile links bounce.** transfers/page.tsx:150 links a clinician payer to /admin/therapists/<id>, founder only; a staff member working the queue is sent to /onboarding.

## Looks broken, is handled

1. `audit()` with a non-uuid `resourceId` (taxonomy `${kind}:${code}` actions.ts:642, settings `"pricing"` settings/actions.ts:120, country code :358, team email :501) would 500 per HAZARDS H6; lib/audit.ts:129-130 routes non-uuids to `resource_key`.
2. `verifyUser` writing `users.verification_status` directly looks like it fights trigger 0083; `setVerification` also upserts `therapist_verifications.state` (lib/data/admin.ts:172-184), which the trigger derives from, so they agree. (The path is still a document-free approval: see Broken 7 and Stale 19.)
3. Double Confirm on a transfer: `confirmPayment` is compare-and-set on `state = 'submitted'` with the database clock (lib/billing/manual.ts:519-528); the second press gets an error. Pot top-up double credit is separately refused (comment lib/billing/manual.ts:493-517).
4. Country editor has a currency box with no `name`, so the form posts no currency and the action defaults `"usd"` (settings/actions.ts:334); `parseCountry` derives currency from the entity (lib/settings/defs.ts:1586-1601).
5. Vault refund of a pot-funded session would look like a Stripe refund of a payment with no charge; `refundSessionPayment` routes it to `refundToPot` (lib/billing/connect.ts:988), though only after the Stripe-configured check at :962 (Suspect-level).
6. Receipt images in a client modal would leak the blob URL; the modal uses `/admin/transfers/receipt/[id]`, which streams and audits (route.ts:87-139), and the page sends only `proofKind` (transfers/page.tsx:206).
7. Identity documents on /admin/verifications would expose blob URLs; they point at `identityDocumentPath` (verifications/page.tsx:135-139), an audited route outside this slice.
8. `rejectPayment` could create a rejection nobody understands; reason >= 10 chars is enforced here and, per its comment, by the database (lib/billing/manual.ts:665-677).
9. Total View for a manager: the page guard is `requireManager` (tv/page.tsx:33) but `elevated()` requires super_admin (lib/console/gate.ts:150), so a manager never reaches the clinical content.

## Unclaimed

(a) Worth selling, nothing advertises it:
1. Receipts streamed through the app with every look and every download audited separately (transfers/receipt/[id]/route.ts).
2. Two-person payout rule and "you edited these details, somebody else approves" (lib/billing/payouts.ts:315-334), shown as "Two people" in payout-queue.tsx.
3. Bank details locked while payments are in flight (settings/actions.ts:401-407).
4. Break-glass investigation that shows off-record gaps as timestamped facts (radar/investigate/[id]).
5. Books-balance and pot/renewal reconciliation on screen (payouts/page.tsx:66-98, sponsors/page.tsx:97-113, vault/page.tsx:164-211).

(b) Nobody should have it:
1. Total View (tv/page.tsx): founder with two keys reads any patient's copilot conversation, notes, transcripts and risk flags by name search, unaudited per read.
2. Founder BCC on a patient's record export (tv/actions.ts:51).
3. "Disclose their practice record" to any email address with a typed reason (total-view.tsx:675-725, tv/actions.ts:79).
4. Document-free clinician verification (clinician-row.tsx:62, therapist-panel.tsx:801).
5. Voiding a paid invoice (therapist-panel.tsx:736).
6. Staff role sees applicants' passports and IDs on a queue they cannot act on (verifications/page.tsx:54).
7. /admin/sponsors/[id] per-session dates and clinician names under an employer, to any staff (sponsors/[id]/page.tsx:241-243).

(c) Half built, a door with no room or a room with no door:
1. Support tickets with no reader (support-queue.tsx, support/actions.ts:46).
2. Payout queue shown to staff with founder-only buttons (payouts).
3. Verification queue shown to staff with founder-only decisions.
4. Open carts that nobody but the payer can clear, locking the bank details (transfer-fields-editor.tsx).
5. No list of rejected transfers, and no re-run for a failed grant.
6. /admin/sponsors/[id] reachable only from the transfer queue; no link from /admin/sponsors.
7. Adding a back office account exists (settings); removing or downgrading one does not.
8. `adjustLedger` accepts a clinician but the only screen passes `therapistId: null` (ledger-adjust.tsx:131).

## Promise evidence

- P2: Broken 9. A rejected transfer produces no in-app notice or email; the payer finds the reason only by reopening the transfer sheet. partly.
- E1: /admin/sponsors/<id> names no patient (sponsors/[id]/page.tsx:237-250, pot-trace.ts:129): kept. "Never when" on that admin page: broken, dates and clinicians per funded session (:241-243). /admin/sponsors list: kept. Board companies table shows sessions per company per 30 days (board.tsx:304). Verdict: partly.
- E2: not reachable from this slice (sponsor portal), but nothing in the console is reachable by a sponsor cookie; every page is behind `requireStaff` or stricter. cannot tell from here beyond that.
- T2: investigate page shows off-record gaps as timings with no words (radar/investigate/[id]/page.tsx:100-136). kept here. Total View transcript (total-view.tsx:832-850) shows whatever segments exist; cannot tell from here whether it can contain off-record text.
- T3: held balances shown as a liability (vault, payouts); netting toggle in settings (settings/actions.ts:239). kept as far as the console goes.
- A1: transfers grant only through `confirmPayment` after a person presses Confirm (transfers/actions.ts:25-34, lib/billing/manual.ts:519-546); the open-cart override also routes through it. Welcome credit and lift-pause are operator grants by design. kept.
- A2: transfer confirm and reject are compare-and-set: kept. Payout mark-sent posts the ledger before the compare-and-set (Suspect 1). Ledger adjustments are not idempotent. Verification decisions idempotent. Verdict: partly.
- A3: transfer rejection requires >= 10 chars and stores it verbatim on the payment and in the audit (lib/billing/manual.ts:675-687, transfers/actions.ts:68): kept. The payer reads it only on the transfer sheet, never for a guest, and is not notified (Broken 9). Payout rejections verbatim and notified. Clinician verification: verbatim on one path, absent on `verifyUser` (Broken 7). Radar bans: bypassed by the UI default (Broken 6). Verdict: partly.
- A4: broken (Broken 3; Suspect 4, 5).
- A5: "A role is a list, not a rank": `requireRole` is an allowlist (lib/auth/guard.ts:75-79) and the nav is role-filtered: kept. "Refused screens redirect": they redirect, to the wrong portal (Broken 1). "Refusal on the record": no. "Every read is written down": kept for break-glass, clinician overview, receipts; not for Total View, /admin/patients/[id], /admin/sponsors/[id], verification queue page views (document fetches are audited elsewhere). Verdict: broken.

## Coverage

| File | Lines | Status |
|---|---|---|
| app/(admin)/admin/actions.ts | 965 | read |
| app/(admin)/admin/actuals/actions.ts | 179 | read |
| app/(admin)/admin/actuals/page.tsx | 144 | read |
| app/(admin)/admin/announce/page.tsx | 54 | read |
| app/(admin)/admin/audit/page.tsx | 115 | read |
| app/(admin)/admin/benefits/actions.ts | 55 | read |
| app/(admin)/admin/benefits/page.tsx | 71 | read |
| app/(admin)/admin/checkins/page.tsx | 83 | read |
| app/(admin)/admin/clinics/actions.ts | 110 | read |
| app/(admin)/admin/clinics/page.tsx | 45 | read |
| app/(admin)/admin/content/[id]/page.tsx | 42 | read |
| app/(admin)/admin/content/page.tsx | 102 | read |
| app/(admin)/admin/errors/page.tsx | 100 | read |
| app/(admin)/admin/financial-model/actions.ts | 115 | read |
| app/(admin)/admin/financial-model/page.tsx | 130 | read |
| app/(admin)/admin/numbers/actions.ts | 53 | read |
| app/(admin)/admin/numbers/page.tsx | 60 | read |
| app/(admin)/admin/page.tsx | 104 | read |
| app/(admin)/admin/partners/actions.ts | 141 | read |
| app/(admin)/admin/partners/page.tsx | 58 | read |
| app/(admin)/admin/patients/[id]/page.tsx | 122 | read |
| app/(admin)/admin/payouts/actions.ts | 129 | read |
| app/(admin)/admin/payouts/page.tsx | 130 | read |
| app/(admin)/admin/radar/investigate/[id]/page.tsx | 167 | read |
| app/(admin)/admin/radar/page.tsx | 100 | read |
| app/(admin)/admin/ratings/page.tsx | 150 | read |
| app/(admin)/admin/settings/actions.ts | 506 | read |
| app/(admin)/admin/settings/page.tsx | 235 | read |
| app/(admin)/admin/sponsors/[id]/page.tsx | 279 | read |
| app/(admin)/admin/sponsors/actions.ts | 177 | read |
| app/(admin)/admin/sponsors/page.tsx | 118 | read |
| app/(admin)/admin/strings/actions.ts | 121 | read |
| app/(admin)/admin/strings/page.tsx | 80 | read |
| app/(admin)/admin/support/actions.ts | 116 | read |
| app/(admin)/admin/support/page.tsx | 70 | read |
| app/(admin)/admin/taxonomy/page.tsx | 84 | read |
| app/(admin)/admin/therapists/[id]/page.tsx | 227 | read |
| app/(admin)/admin/therapists/page.tsx | 45 | read |
| app/(admin)/admin/transfers/actions.ts | 109 | read |
| app/(admin)/admin/transfers/page.tsx | 228 | read |
| app/(admin)/admin/transfers/receipt/[id]/route.ts | 140 | read |
| app/(admin)/admin/tv/actions.ts | 132 | read |
| app/(admin)/admin/tv/board-actions.ts | 88 | read |
| app/(admin)/admin/tv/page.tsx | 190 | read |
| app/(admin)/admin/usage/page.tsx | 286 | read |
| app/(admin)/admin/usage/sessions/page.tsx | 219 | read |
| app/(admin)/admin/vault/page.tsx | 609 | read |
| app/(admin)/admin/verifications/page.tsx | 154 | read |
| app/(admin)/layout.tsx | 265 | read |
| components/admin/actuals-table.tsx | 301 | read |
| components/admin/announcement.tsx | 123 | read |
| components/admin/bank-editor.tsx | 331 | read |
| components/admin/board.tsx | 528 | read |
| components/admin/clinic-manager.tsx | 212 | read |
| components/admin/clinician-row.tsx | 88 | read |
| components/admin/competitor-editor.tsx | 201 | read |
| components/admin/financial-model.tsx | 878 | read |
| components/admin/gate.tsx | 168 | read |
| components/admin/held-balances.tsx | 161 | read |
| components/admin/ledger-adjust.tsx | 148 | read |
| components/admin/mail-check.tsx | 137 | read |
| components/admin/number-queue.tsx | 151 | read |
| components/admin/open-carts.tsx | 167 | read |
| components/admin/page-editor.tsx | 410 | read |
| components/admin/partner-manager.tsx | 260 | read |
| components/admin/paused-benefits.tsx | 118 | read |
| components/admin/payout-queue.tsx | 277 | read |
| components/admin/payroll-editor.tsx | 253 | read |
| components/admin/plan-tables.tsx | 350 | read |
| components/admin/position-card.tsx | 151 | read |
| components/admin/radar-command.tsx | 676 | read |
| components/admin/receipt-modal.tsx | 314 | read |
| components/admin/report-queue.tsx | 166 | read |
| components/admin/settings-editor.tsx | 678 | read |
| components/admin/sponsor-manager.tsx | 331 | read |
| components/admin/strings-editor.tsx | 358 | read |
| components/admin/support-queue.tsx | 287 | read |
| components/admin/taxonomy-editor.tsx | 194 | read |
| components/admin/therapist-panel.tsx | 891 | read |
| components/admin/total-view.tsx | 883 | read |
| components/admin/transfer-fields-editor.tsx | 225 | read |
| components/admin/transfer-queue.tsx | 390 | read |
| components/admin/vault-invoice-row.tsx | 176 | read |
| components/admin/vault-payment-row.tsx | 154 | read |
| components/admin/verification-review.tsx | 178 | read |
| components/admin/video-check.tsx | 58 | read |
