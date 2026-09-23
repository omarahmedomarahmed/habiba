# Admin console inventory (code-derived)

Source of truth: `app/(admin)/**`, `components/admin/**`, the server actions they import and the `lib/**` functions behind them. Docs and comments were used only to find code; every claim below was checked against a code path. Roles come from `lib/db/schema.ts` (`ROLES`, `BACK_OFFICE_ROLES = staff, manager, super_admin`, `MANAGER_ROLES = manager, super_admin`) and `lib/auth/guard.ts` (`requireRole` redirects to `/dashboard` on refusal, `requireStaff`, `requireManager`). Nothing here was run.

## 1. Summary

The console is 32 pages under `/admin` behind one shell (`app/(admin)/layout.tsx`, `requireStaff`). Fundamentally an admin can: confirm or reject bank transfers on the Egyptian manual rail and credit money that arrived with no claim; move manual payouts through claim, approve, sent, confirmed; approve or reject clinician licences; approve, code and refuse patient phone number changes; work two support queues; ban, release or force offline clinicians on the Crisis Radar and resolve patient reports (with a break glass transcript read); refund Stripe session payments, discount, re-price or void invoices, release held Stripe earnings and post manual ledger adjustments; activate sponsors, clinics and partners, open sponsor pots, mint enrolment codes and create their portal users; lift paused employee benefits; edit the CMS, UI strings, radar lists and every priced setting; email one or all clinicians; add staff or manager accounts; read the audit log, errors, usage and ratings; keep company payroll, capital and a financial model; and, behind a two key gate, read any session's transcript, note, risks and copilot messages and email records out (`/admin/tv`). The role split is almost binary in practice: `staff` and `manager` can only complete work on **/admin/transfers**, **/admin/numbers**, **/admin/support** (plus read `/admin/patients/[id]`, `/admin/sponsors/[id]`, `/admin/payouts`, `/admin/verifications`); every other page and every action on payouts and verifications is `requireRole("super_admin")`. The nav promises more than the guards allow: staff and managers are shown Overview, Radar control, Ratings, Audit log, Usage and Errors and are bounced (via `/dashboard` to `/onboarding`) when they click them, and a staff sign in lands on `/admin`, which is itself super_admin only. `manager` adds only the support queue health card; `/admin/tv` is `requireManager` but its gate calls `requireRole("super_admin")`.

## 2. The table

Role key: **staff+** = staff, manager, super_admin (`requireStaff`). **mgr+** = manager, super_admin. **SA** = super_admin only. "Bounce" = `requireRole` redirect to `/dashboard`, which for a back office account redirects again to `/onboarding` (`app/(app)/layout.tsx`).

### Shell (every page)
`app/(admin)/layout.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Header and nav | Badges: waiting transfers (`waitingCount`), verifications (`pendingReviewCount`), open reports (`countOpenReports`), open+waiting tickets (`ticketCounts`), number changes (`openChanges(200).length`) | Links. Shown to staff+: Overview, Support, Numbers, Verifications, Radar control, Payouts, Transfers. mgr+: Ratings, Audit log, Usage and cost, Errors. SA: Clinicians, Vault, Sponsors, Paused benefits, Clinics, Partners, Check-ins, Radar lists, Announce, Site content, Settings, Strings, Financial model, Actuals. "Back to portal" to `/dashboard` | A5: "A role is a list, not a rank"; the layout comment says nobody should be shown a door that bounces them | Six links bounce the roles they are shown to: Overview and Radar control (staff, manager), Ratings, Audit log, Usage and cost, Errors (manager). `/admin/tv` is in no nav. Refusals are not audited (`requireRole` just redirects), so A5's "the refusal is on the record" is false. No `loading.tsx` or `error.tsx` anywhere under `(admin)`. Staff sign in lands on `/admin` (`lib/auth/actions.ts` `signIn`), which bounces them |

### /admin (Overview)
`app/(admin)/admin/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Stat row | Practices, Clinicians, Patient charts, Sessions (30d) from `platformStats` | Nothing | Operator overview | SA only, yet it is the landing page for every back office sign in and the header logo target: staff and managers bounce |
| AI usage card | Calls, Cost, Errors (30d) from `platformStats`; bar chart from `aiUsageByDay(14)` | Nothing | Model cost is the scaling expense | Card says "last 30 days", chart is 14 days. No empty state when chart has no rows |
| Billing card | Collected, Outstanding (30d) from `platformStats` | Nothing | Operational cash view | Says "Stripe is the ledger of record" but the manual rail has no Stripe; nothing links to `/admin/vault` |

### /admin/support
`app/(admin)/admin/support/page.tsx`, `components/admin/support-queue.tsx`, `app/(admin)/admin/support/actions.ts`, `lib/data/support.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| How the queues are doing | Open, waiting on them, overdue, nobody owns, per audience (`queueHealth`) | Nothing. mgr+ only (page checks `actor.role`) | 20.8: managers see throughput, staff do not | None beyond no drill down |
| Queue tabs | Patients / Therapists counts (`queueFor("patient")`, `queueFor("therapist")`), oldest deadline first | Switch tab | Two queues, two jobs | Capped at 100 per queue, no search by reference |
| Ticket card | Age or "waiting on them", reference, name, topic, locale, extended, on WhatsApp, has context, owner | "Take it on" (`takeTicket`, staff+, audited). "Waiting on them" + note (`waitOnThem`). "Extend once" + reason (`extend`). "Moved to WhatsApp" (`moveToWhatsapp`). "Close and send the link" + summary (`close`, audited; emails a link and code, reply readable only after auth) | 18R.4: ticket text is clinical, read is `phi_access` audited in `readTicket` | **Nobody can read what the person wrote**: card says "Open it to read what they wrote" but no button calls `openTicket` (the action exists, unused). **A ticket moved to WhatsApp can never be closed**: `closeTicket` requires `whatsappSummary` of 20+ chars and nothing in the product writes that column. No reply other than the close summary. Wait, extend and WhatsApp have no `audit()` call. No reassign or reopen |

### /admin/numbers
`app/(admin)/admin/numbers/page.tsx`, `components/admin/number-queue.tsx`, `app/(admin)/admin/numbers/actions.ts`, `lib/data/phone-change.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Rule card | "A confirmed number is locked for 90 days" (`LOCK_DAYS`) | Nothing | 20.16: the phone is the identity a patient record hangs on | None |
| Change row | Age, status, code expiry, old to new number, patient's reason (`openChanges`) | "Approve" + "How did you check?" (`approve` to `approveChange`, staff+, audited with the note). Then "Send the code to the new number" (`sendCode` to `sendChangeCode`, SMS/WhatsApp to new number, 24h). "Refuse" + reason (`refuse` to `refuseChange`) | Approval moves nothing; only the patient entering the code does (`completeChange`) | `sendChangeCode` and `refuseChange` are not audited. Refusal sends no notice to the patient. Same person may approve and send code (no second pair of eyes). No history view (`changeHistory` exists, no screen). Resend is allowed repeatedly with no rate limit |

### /admin/verifications
`app/(admin)/admin/verifications/page.tsx`, `components/admin/verification-review.tsx`, `app/(admin)/admin/actions.ts:decideTherapistVerification`, `lib/data/verification.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Tabs | Waiting / Approved / Rejected (`reviewQueue(bucket)`) | Switch tab (links) | "Nobody meets a patient until someone here has read their licence" | Page is staff+, but see below |
| Review card | Name, email, practice, country, regulator, licence no., expiry, languages, specialties, ID front/back, licence doc, headshot thumbnails (`identityDocumentPath`), prior rejections | Open a document in a new tab | Licence check before practising (`requireVerified`) | **Staff and managers see broken images**: `identityReadDecision` allows only the owner or `super_admin`. No licence expiry enforcement anywhere (`licenseExpiry` is display only) |
| Decision panel | "Turned down once. Rejecting again deletes their documents" warning (C351) | Note field, "Approve" / "Reject" or "Reject and clear" (`decideTherapistVerification`, **SA**; reject needs a note; audited; emails the clinician) | Reason is emailed verbatim; second rejection clears documents | **Staff see the buttons but the action is SA only**, so pressing them bounces them out of the console. No confirm before the destructive "Reject and clear". No way to revoke an approval from here (only `/admin/therapists/[id]` Reject) |

### /admin/radar (Radar control)
`app/(admin)/admin/radar/page.tsx`, `components/admin/radar-command.tsx`, `components/admin/report-queue.tsx`, `app/api/admin/radar/route.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Live stats and globe | Online, Being booked, In session, Countries, Our cut 30d, Open reports (`radarCommandView`), polled every 3s from `/api/admin/radar` (SA) | Nothing | Crisis Radar is the P1 promise ("somebody who is free now") | Nav shows it to staff and managers; page is SA: bounce. Poll failures are swallowed silently (last picture kept, no stale warning) |
| Filters and table | Search, language, country, All/live/suspended/flagged; per clinician: where, state, heartbeat lapsed, open reports, rating, 30d sessions, our cut, DEMO badge | Filter; click name to open detail | Stale heartbeat = patients sent to an absent clinician | Table has no pagination; DEMO rows are mixed into live ones |
| Row controls | Suspended until date | "Ban" then reason + "24h" / "3 days" / "Until released" (`setRadarSuspension`, SA, audited, emails clinician). "Release" (`setRadarSuspension(…,0)`). Power icon "Take them off the board now" (`forceRadarOffline`, SA, audited) | Radar ban is separate from account suspension, own patients unaffected | Reason is effectively optional: client sends "Administrator action" when blank, which passes the 4 char check and is emailed as the reason. Release and force offline have no confirm and no reason. `forceRadarOffline` nulls `pendingSessionId` and `reservedBy`, silently dropping a patient mid booking; its result is ignored (no error shown) |
| Detail drawer | Rate, payouts connected, sessions, gross, our cut, walk-ins, last seen, languages | Edit Headline, Country code, Region, City, "Save" (`editRadarProfile`, SA, audited) | Support corrections (phone number in a headline) | No validation (country is first two letters of anything); result ignored, "saved" shown even on failure |
| Report tabs | Open / actioned / dismissed (`openReports`) | Switch tab | Patients' complaints about sessions | Copy says "A no-show has already been refunded", untrue for bank transfer payers (see section 4) |
| Report card | Kind, clinician, session date, duration, patient's words, reply-to email | "Open the session record" (link to investigate). Note + "Actioned" / "No action needed" (`resolveReport`, SA, note of 4+ chars, audited) | Decision with a name on it | "Actioned" does nothing by itself (no link to ban or refund). `resolveReport` has no status guard (re-resolvable by direct call). No way to contact the patient from here |

### /admin/radar/investigate/[id]
`app/(admin)/admin/radar/investigate/[id]/page.tsx`, `lib/data/radar-admin.ts:investigate`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Warning and report | "You are reading a therapy transcript", report kind, clinician, patient's words, reply-to | "Radar control" back link | Break glass read, audited as `phi_access` `break_glass.investigate` on every load | Any report of any kind (including a no-show) unlocks the full transcript; no reason typed by the reader, no second approver, no time limit |
| Periods with no recording | Gaps in transcript (off record minutes) | Nothing | T2: off record minutes are a fact | None |
| Transcript | Every line with speaker | Nothing | Evidence for a conduct report | Cannot resolve the report from here (must go back) |

### /admin/payouts
`app/(admin)/admin/payouts/page.tsx`, `components/admin/payout-queue.tsx`, `app/(admin)/admin/payouts/actions.ts`, `lib/billing/payouts.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Books card | "The books balance" or red; Cash, Held for clinicians, Out of balance, Unbalanced entries, cash by entity, paying out of an entity that never collected (`reconcile`) | Nothing | 16.8: money held is money owed, checked | No link to the unbalanced entries (only on `/admin/vault`, SA) |
| Manual queue | Age (overdue red), clinician, status, entity, "Two people" flag, owned, USD to EGP amount, InstaPay or wallet, identifier, account name (`manualQueue`) | "Take it on" (`takeOn`), "Approve" (`approve`), proof link + "Mark sent" (`markSent`, posts ledger, notifies), "Confirm arrival" (`confirm`), reason + "Reject" (`reject`, notifies). **All SA**, all audited | T3 netting; 16.3d: not the payee, not the last editor of details, above threshold a different owner | **Page is staff+, every button is SA**: staff see a queue they cannot work and are bounced on click. Two person rule therefore needs two super_admins. **"Mark sent" is not idempotent**: `markPayoutSent` reads status, posts `postManualPayout` to the ledger, then does the guarded `move`; two concurrent clicks post the ledger twice. Proof is a free text URL, not an upload. No confirm on Mark sent. A `sent` payout cannot be rejected or reversed (bounced transfer is stuck). `claimPayout` overwrites an existing owner server side |
| Automated tab | Last 50 Stripe `earningsTransfers` | Nothing | Record, not a task | No failed transfer highlighting |

### /admin/transfers
`app/(admin)/admin/transfers/page.tsx`, `components/admin/transfer-queue.tsx`, `components/admin/receipt-modal.tsx`, `components/admin/open-carts.tsx`, `app/(admin)/admin/transfers/actions.ts`, `lib/billing/manual.ts`, `lib/billing/manual-grants.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Queue tabs | All / Patient / Therapist / Clinic / Company counts, "Somebody is on a spinner for each" (`queue()`: state `submitted`, oldest first, limit 200) | Switch tab | A1: nothing is granted before a person confirms | No search by reference or amount, which is how an operator matches a bank line. Limit 200 with no paging |
| Transfer row | Payer (linked to profile), what it pays for, amount sent (EGP formatted), settles USD, minutes waiting (red after 15), reference, proof or "none uploaded" | "Confirm" (`confirm` to `confirmPayment` + `grantFor`, staff+, audited). "Reject" then "Why…" + "Reject and tell them" (`reject`, 10+ chars, audited). "View the evidence" opens modal. Payer link to `/admin/sponsors/[id]`, `/admin/therapists/[id]` or `/admin/patients/[id]` | A2: guarded `WHERE state='submitted'`, so double Confirm moves money once. A3: reason stored on the row and shown to the payer | Row "Confirm" has no confirm step and does not require opening the evidence; works with "none uploaded". **Clinician payer link bounces staff** (`/admin/therapists/[id]` is SA). **Grant failure is stuck**: `confirmPayment` leaves the row `confirmed` and returns "Tell an engineer"; no screen re-runs `grantFor`. Rejection sends no notice; payer sees it only when they reopen the pay sheet |
| Receipt modal and route | Image or PDF streamed via `/admin/transfers/receipt/[id]` (staff+, audited open/download), reference, what they sent, settles, what they said it covers | "Approve this payment" (`confirm`), "Reject" then "Reject with this reason" (`reject`), "Back", download | 76.57: receipt bytes never leave via an unaudited URL | Modal enables reject at 5 chars but the server needs 10: operator gets an error after typing. "Approve this payment" stays enabled when the receipt is missing or unreadable (only a warning) |
| Opened and never submitted (collapsed) | Payer, what, settles, opened date (`openCarts()`: state `awaiting_proof`, newest first) | "I have this in the bank" then note + "Credit without proof" (`confirmUnclaimed` to `confirmWithoutProof`, 10+ chars, audited as `payment.confirmed_without_proof`), "Cancel" | A4: money with no claim must be a decision, never silently kept | No discard for an abandoned cart; carts never expire (no cron), and every open cart blocks editing bank details (`detailsLockedBy`). **A4 overpayment half is missing**: an overpaid subscription is only `log.warn` in `grantSubscription`, never shown here. An unmatchable bank line with no cart has no place to go |

### /admin/patients/[id]
`app/(admin)/admin/patients/[id]/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Header | Patient account email, "Payments only." | Nothing | C243: a payments page must not become a record of who is seeing whom | Reached only from a transfer row; no search |
| Transfers | Last 50 `manualPayments` for the account: settles, sent, date, reference, session id prefix, reject reason, state | "Back" to `/admin/transfers` | Payer history when a line does not match | Read only: no refund, no re-grant, no retry. Guest (session) payers have no page at all. Sent amount printed as raw minor units (`{p.amountCents} {currency}`), unlike the sponsor page |

### /admin/sponsors/[id] (Company)
`app/(admin)/admin/sponsors/[id]/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Pot, Ledger, Contact cards | Pot balance and coverage (`sponsorPots`), ledger balance (`ledgerPotBalance`) with "Out by" drift, contact | Nothing | E1: spend visible, never who | staff+ page, but no action to fix drift is available to anyone except SA ledger adjust on `/admin/vault` |
| Refund terms | `potTerms.refundPolicy` or "No terms agreed" | Nothing | C233: no balance without terms | Terms cannot be edited after the pot opens (no action exists) |
| Transfers | Last 50 manual payments for the sponsor | Nothing | Top-up history | Read only |
| Where the pot went | Patient reference (not name), date, clinician, coverage, sponsor share (`potTrace`), agrees check (`potSpendAgrees`) | "Back" | E1, C227: register of who is in therapy must not exist | No refund of unspent pot, no expiry processing, no close |

### /admin/therapists (Clinicians)
`app/(admin)/admin/therapists/page.tsx`, `components/admin/clinician-row.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Clinician rows | Name, email, practice, Admin badge, plan, verification, suspended, session count (`listClinicians`) | Row link to detail. "Verify" (`verifyUser(id,"verified")`, SA, audited). "Suspend" / "Reinstate" (`suspendUser`, SA, audited; disabled for super_admin rows) | Account level controls | "Verify" skips document review, no reason, no email, no confirm. Suspend has no confirm, no reason, clinician not told. Results ignored: UI flips state even if the call failed. No search, no paging |

### /admin/therapists/[id] (Clinician)
`app/(admin)/admin/therapists/[id]/page.tsx`, `components/admin/therapist-panel.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Header, stats, notice | Status, verification, plan, Stripe connected; Completed sessions, Patients, Copilot questions, Contribution; "You cannot read clinical content here" | "All clinicians" link. Page load audited `break_glass` `admin.therapist.view` | Money in both directions per clinician | SA only, but transfers queue links staff here |
| Patients tab | Patient names, emails, phones, source, sessions, copilot messages, last session (`therapistPatients`) | "Send their record" + reason + "Send" (`emailPatientRecordToPatient`, SA, 8+ chars, audited) | 20.9: the admin causes the record to be sent and never sees it; `requestPatientExport` notifies the owning clinician in app | Shows patient names, emails and phones to the operator (one `break_glass` row per page view, not per patient) |
| Sessions tab | When, status, modality, note status, duration, segments, price, payment status, report sent (`therapistSessions`) | Nothing | Operational view | No refund or recovery action per session |
| Copilot tab | Per patient thread counts and corrections (`therapistCopilotUsage`) | Nothing | Allowance usage | None |
| Billing tab | Earned net, our fees, paid sessions, rate; invoices; session payments (`listInvoices`, `earningsSummary`, `recentPayments`) | Per invoice: reason, Discount "Apply" (`applyInvoiceDiscount`), Re-price "Set" (`editInvoice` amount, not when paid), Description "Save" (`editInvoice`), "Credit next renewal" (`applyUpcomingDiscount`), "Void" (`editInvoice` status void). All SA, audited | Paid invoices only voided, never re-priced | Void has no confirm. `applyUpcomingDiscount` has no reason or amount validation server side and overwrites any existing credit. No refund button on payments here (only on `/admin/vault`). No manual payout or manual transfer history for this clinician |
| Manage tab | Credentials, licence | "Verify", "Reject" (`verifyUser`), "Suspend account" / "Reinstate" (`suspendUser`); Subject + Message + "Send email" (`emailTherapist`, audited) | Direct operator control | Reject has no reason and sends nothing (unlike `decideTherapistVerification`). No confirm on Suspend. No radar ban from here |

### /admin/ratings
`app/(admin)/admin/ratings/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Summary | Therapist average, 24Therapy average, rated sessions, unhappy with us (`allRatings`) | Nothing | Quality signal | Nav shows to managers, page is SA: bounce |
| Rating list | Clinician, stars, tags, comment, "never rated" note (limit 200) | Nothing | "What patients said, without who said it" | No filter, no link to the clinician or a report, no action on a low rating |

### /admin/vault
`app/(admin)/admin/vault/page.tsx`, `components/admin/held-balances.tsx`, `ledger-adjust.tsx`, `vault-invoice-row.tsx`, `vault-payment-row.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Held balances | Per clinician held amount, Stripe state badge, out of balance (`heldBalances`, `trialBalance`) | "Release" per row when an account exists (`releaseTherapistEarnings`, SA, audited, Stripe only) | Money we hold for clinicians | Egyptian (manual rail) clinicians can only be paid via `/admin/payouts`; no link |
| Liability cards | Held for clinicians, Unspent sponsor pots, VAT not remitted (`trialBalance`) | Nothing | Liabilities before results | No VAT remittance action or record |
| Renewals that do not reconcile | Counts from `reconcileRenewals` | Nothing | 59.15: someone is owed a month | Counts only, no list, no fix action |
| Unbalanced transactions | Kind, txn id, delta (`unbalancedTransactions`) | Nothing | Ledger integrity | No drill down |
| Adjust the books by hand | Organisation, Account, Amount, Reason | "Post the adjustment" (`adjustLedger`, SA, reason 8+ chars client side, audited, balanced pair via `postAdjustment`) | The escape hatch; cannot unbalance the ledger | No confirm; server does not re-check reason length; organisation select defaults to the first org |
| Ledger all time | Collected, model spend, gross margin, outstanding, Connect fees, GMV (`ledgerSummary`) | Nothing | GMV kept apart from revenue | None |
| Income and spend by month | 6 months bars plus table (`monthlyLedger`) | Nothing | C349 figures printed | None |
| Traction and unit economics | Signups, activated, active, sessions, paying practices, MRR, ARPU, revenue/cost/contribution per session (`tractionMetrics`) | Nothing | Board numbers | None |
| Model spend by purpose | 30d by kind (`costByKind`) | Nothing | Cost control | Duplicates `/admin/usage` |
| Per clinician | Plan, sessions, AI calls, spend, paid us, margin (`therapistEconomics`) | Nothing | Unit economics | None |
| Invoices | Last 200 (`allInvoices`) | Discount icon then amount + reason: "Discount this invoice" (`applyInvoiceDiscount`), "Credit their next renewal" (`applyUpcomingDiscount`), Cancel. SA, audited | Everyday billing correction | Reason not required on either (server passes blank). No confirm |
| Session payments | Last 200 (`allSessionPayments`): gross, to them, our cut, status | Refund icon then reason + "Refund $X" (`refundPatient` to `refundSessionPayment`, SA, reason required, audited; pot payments go back to the pot) | Refund authority kept from the clinician who owes it | **Bank transfer payments cannot be refunded**: manual grants write `capture: "platform"` with no Stripe intent, so the action returns "That payment has no Stripe charge to refund". No confirm. No partial refund |

### /admin/sponsors
`app/(admin)/admin/sponsors/page.tsx`, `components/admin/sponsor-manager.tsx`, `app/(admin)/admin/sponsors/actions.ts`, `lib/data/sponsor-admin.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Drift banner | Pot table vs ledger per sponsor (`reconcilePots`) "Take no top up until explained" | Nothing | Pot integrity | Advisory only: `/admin/transfers` still lets staff confirm a top up for that sponsor |
| Sponsor row and contact | Name, kind, state, listed publicly, contact, best time | "Open"/"Close" disclosure | 53.5: signups are held until someone talks to them | No link to `/admin/sponsors/[id]` from this list |
| State and entity | Current state; billed from entity | One click to each other state: held, active, suspended, closed (`activate`, SA, audited); each entity (`setEntity`, SA, audited) | Activating starts the re-verification clock | No confirm, no reason for suspend or close; `activate` result is voided (errors hidden) |
| Enrolment code | Live code, attempts, spike flag (`liveCode`, `attemptsOnCode`) | "Mint a code" / "Rotate code" (`mintCode`, SA, audited) | Guessing attack on codes | Rotate has no confirm; old code dies instantly for anyone mid signup |
| Pot | "Pot open, with terms." or form: Refund and expiry terms, Unspent money expires, Overdraft, Welcome credit | "Open the pot" (`openTheirPot`, SA, audited) | C233: terms before money | Once open: no edit of terms, expiry, overdraft or coverage, no close, no refund of unspent balance |
| Portal users | Existing users and roles | Email, name, password (plain text input), viewer/admin, create (`addPortalUser`, SA, audited) | Company self service | Operator types the customer's password in clear; no remove, disable or reset |

### /admin/benefits (Paused benefits)
`app/(admin)/admin/benefits/page.tsx`, `components/admin/paused-benefits.tsx`, `app/(admin)/admin/benefits/actions.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Paused queue | Name, email, sponsor, days paused (red at 30), "Cannot self-serve" for id_number (`pausedBenefits`), empty state | "Lift the pause" (`liftPause` to `unpause`, SA, audited by enrolment id) | C247: reversible by us in one step | No reason captured, no confirm, employee not told it was lifted. No way to re-send the verification code from here |

### /admin/clinics
`app/(admin)/admin/clinics/page.tsx`, `components/admin/clinic-manager.tsx`, `app/(admin)/admin/clinics/actions.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Clinic row and contact | Name, state, clinician count, contact (`clinicsForAdmin`), empty state | Open/close | Activating a clinic opens an org that will hold charts | None |
| State and region | Other states and other regions as buttons | One click state change (`setState` to `setClinicState`, SA, audited). Region (`setRegion`, SA, audited, refused while an invoice is outstanding) | Region decides billing rail and entity | State result is voided (errors hidden). No confirm or reason for suspend/close; no statement of what closing does to clinicians and patients |
| Managers | Email and role list | Email, name, password (text), viewer/admin, create (`addManager`, SA, audited) | Practice portal access | Operator sets the password in clear; no remove, disable, reset |

### /admin/partners
`app/(admin)/admin/partners/page.tsx`, `components/admin/partner-manager.tsx`, `app/(admin)/admin/partners/actions.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Partner row | Name, state, key count, contact, intent (`allPartners`, `keyCountFor`) | Open/close | C265: an employment key is an identity oracle | No key list or per key revoke |
| Production approval | Approved date or "Not approved", documents link | "Approve for production" (`approveProduction`, refused without documents) / "Withdraw approval" (`withdrawProduction`). SA, audited | Keys may reach a real person's session | No confirm; withdrawing revokes no keys (stated on screen) |
| State | Other states as buttons | One click state change (`setState` to `setPartnerState`, SA, audited; non active state blocks keys at auth) | Kill switch | Result voided, no confirm, no reason |
| Portal users | Users | Email, name, password (text), developer/admin, "Create" (`addUser`, SA, audited) | Partner portal access | Password in clear; no remove or reset |

### /admin/checkins
`app/(admin)/admin/checkins/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Mute rate | Rate vs `settings.checkins.muteRateHalt`, "The channel is halted" (`muteRate`) | Nothing | C97: measure the mute rate | Copy says "Every number is yours to change", but no admin screen edits `settings.checkins` and no action resumes a halted channel |
| Counts | Sent, delivered, replies, crisis routed, muted, unmuted (`checkinStats`) | Nothing | Six counts, nobody's words | None |

### /admin/taxonomy (Radar lists)
`app/(admin)/admin/taxonomy/page.tsx`, `components/admin/taxonomy-editor.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Countries | Built in list with on/off (`taxonomy("country")`) | Toggle (`setTaxonomyState`, SA, audited). No add ("a code change. Ask.") | Closing a country hides its clinicians from `/radar` (read filter) and shows them an in-portal banner | Toggle has no confirm or reason despite taking a whole country off the radar |
| Languages | List with on/off, custom entries | Filter, toggle, "Delete" custom (`removeTaxonomy`), add (`addTaxonomy`). SA, audited | What patients filter by | Delete has no confirm |
| Specialties | Same | Same | Same | Same |

### /admin/announce
`app/(admin)/admin/announce/page.tsx`, `components/admin/announcement.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Composer | RESEND_API_KEY warning when unset | Subject, Message, "Type N to confirm", send (`announceToAllTherapists`, SA, audited before sending, sequential in `after()`) | One email to every active clinician | Result says ok before any send happens; delivery count never reported back; no test send to self |
| Recipients | Every active clinician name and email (`allTherapistRecipients`) | Nothing | Who it reaches | None |

### /admin/content (Site content)
`app/(admin)/admin/content/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| UI reference | Link to `/design` | Open in new tab | Block vocabulary | None |
| Page list | Title, slug, updated, status (`listAllPages`) | Edit link, view live link | Every public page | Locale is not shown although rows exist per locale; same title appears once per locale with no way to tell them apart |

### /admin/content/[id] (Edit page)
`app/(admin)/admin/content/[id]/page.tsx`, `components/admin/page-editor.tsx`, `app/(admin)/admin/actions.ts:savePage`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Page meta | Title, meta description, status | Edit fields | SEO and tab title | None |
| Blocks | Eyebrow, heading, body, background image, icon, live component, button label/link, items | Edit text and selects | No HTML accepted (`sanitiseBlocks`) | Cannot add, remove or reorder blocks (only `content:sync` script can add one) |
| Save bar | Status | "Save draft" / "Publish" (`savePage`, SA, honesty check refuses two banned claims, audited, `revalidateTag(CMS_TAG)`) | 28.2/28.3: never claim paid sessions cover the fee or forecast earnings | **"Save draft" on a live page takes it down**: `readPage` returns null for a draft row, so the public page 404s. No version history or undo, no preview |

### /admin/settings
`app/(admin)/admin/settings/page.tsx`, `components/admin/settings-editor.tsx`, `transfer-fields-editor.tsx`, `mail-check.tsx`, `video-check.tsx`, `app/(admin)/admin/settings/actions.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Margin per session | Revenue, model cost, margin, margin % (`tractionMetrics`) | Nothing | Pricing sanity | None |
| Warnings | Countries with no rail (`hasNoRail`), enabled countries with no crisis line (`countriesMissingACrisisLine`), what the Egyptian rail needs (`whatTheRailNeeds`) | Nothing (fix below) | P5: crisis path never depends on money | None |
| Pricing | Tiers: monthly, AI rate, unlock threshold; credit expiry | Save (`savePricing`, SA, audited, revalidates `/pricing`) | Every price the product charges | No confirm; applies instantly to all; no history or rollback |
| Session | Platform fee, our cut %, lowest and highest price | Save (`saveSession`, SA, audited) | Platform fee makes the AI fee safe | Same |
| Copilot | Per patient per session, unclaimed patient, general chat per month | Save (`saveCopilot`, SA, audited) | Allowances | Same |
| Payouts | Collection provider, payout methods, two people above, alert after hours, EGP rate, EGP spread, netting | Save (`savePayouts`, SA, audited) | 16.3d threshold, T3 netting | EGP rate is typed by hand ("checked daily" by a person) |
| Team | First, last, email, password, role staff or manager | Add (`addBackOfficeUser` to `createBackOfficeUser`, SA, audited) | Five pages need a staff account to be tested | No list of team members, no remove, no role change, no password reset; super_admin only via script |
| Transfer fields | Bank fields shown to payers, cards coming soon, in flight count | Add a field, reorder Down, Remove, save (`saveTransferFields`, SA, audited, refused while any payment is `awaiting_proof` or `submitted`) | Nobody transfers to an account nobody checks | Abandoned carts never expire and admin cannot discard them, so the lock can be permanent |
| Mail check | Roster of 14 templates by audience | Address + send (`sendEveryTemplate`, SA, audited, paced) | Transactional email rots unseen | None |
| Video check | Video provider health (`videoHealth`) | Nothing | "No video session can start until this is fixed" | Read only; no retry |
| Countries | Per country: name, VAT, currency, crisis line label and tel, collection provider, payout methods, entity, regulators, ID labels, sample image, enabled | Save (`saveCountry`, SA, audited, validates crisis line both or neither) | Crisis line and VAT per country | No confirm on disabling a country; no add country |

### /admin/strings
`app/(admin)/admin/strings/page.tsx`, `components/admin/strings-editor.tsx`, `app/(admin)/admin/strings/actions.ts`, `lib/i18n/authoring.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Language panels | Percent complete, missing, drafts, machine drafts (`completeness`) | Authoring and "Offered to readers" checkboxes, "Save language" (`saveLocale`, refused below 100%). "Draft N strings" (`machineTranslate` to `draftTranslations`, AI). SA, audited in lib | 21.12/21.13: a language goes public only when complete | No add language form visible beyond existing rows |
| Language switch | Codes | Links `?locale=` | Default is `ar` | None |
| Strings table | Key, English, shipped, override, status, safety flag, search | "Save draft" (`saveOne`), "Publish" / "Publish this safety string" (`publishOne`), "Approve N drafts" (`approve`, refuses bulk with safety strings), "Clear the override and restore the shipped wording" (`clearOne`). SA, audited in lib | Crisis, consent and recording strings are approved one at a time | No diff view for machine drafts; no confirm on bulk approve |

### /admin/audit
`app/(admin)/admin/audit/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Filter chips | All, phi access, auth, admin, billing, break glass | Filter by category | Compliance | Nav shows to managers, page is SA: bounce. No chips for `clinical` and `audit_log` categories |
| Entries | Time, category, action, actor (user, sponsor or practice), org, patient id prefix (`listAuditLog`, limit 200) | Nothing | Append only, patients as references | No search by actor, resource or date; no paging past 200; `reason` and `resourceId` are not shown |

### /admin/usage
`app/(admin)/admin/usage/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Recording consent | Sessions, granted, declined, never asked (`consentRate(30)`) | Nothing | C209: the patient switches the AI fee on | Nav shows to managers, page is SA: bounce |
| Stats and margin sentence | Cost per session, sessions with AI, model spend, our fees, gross margin % | Nothing | "The figure that decides the business" | None |
| Where the money goes | Kind, model, calls, errors, spend (`usageByKind`) | Nothing | Cost control | None |
| Per clinician | Sessions, audio, calls, cost (red when underwater), patients paid, our fee (`usageByTherapist`) | "Every session" link; clinician name links to filtered sessions | The top one decides whether unlimited works | No empty state for this table |

### /admin/usage/sessions
`app/(admin)/admin/usage/sessions/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Stats | With spend, cheapest, median, dearest (`sessionCosts(30)`) | "Everyone" / "Usage" back link | Distribution of cost | Filtered to a clinician with no sessions, the header says "Everyone." |
| Every session | When, clinician, modality, minutes (50 cap badge), audio, calls, cost, patient paid, our fee | Nothing | The row behind every sum | No paging |

### /admin/errors
`app/(admin)/admin/errors/page.tsx`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Grouped errors | Count, method and route, first and last seen, message, digest, stack (`recentErrors(200)`) | Expand stack | "Nowhere at all to answer what is broken" before this | Nav shows to managers, page is SA: bounce. No resolve or mute, no filter |

### /admin/financial-model
`app/(admin)/admin/financial-model/page.tsx`, `components/admin/financial-model.tsx`, `components/admin/plan-tables.tsx`, `app/(admin)/admin/financial-model/actions.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Provenance | Measured vs assumed split, benchmark source (`latestBenchmark`) | Nothing | Caveats before charts | None |
| Operating plan tables | `PLANS` with provenance counts | Nothing | The plan before the theory | Static from code |
| Model | Scenario buttons, edited assumptions, hires, 36 month outputs | Pick scenario, edit values, "Add someone", "Remove", "Reset" (client only) | Forecast | Edits are lost on reload unless saved |
| Save and measure | Save as name; Measure and freeze label | "Save" (`saveScenarioAction`, SA, audited; upserts, so a reused name silently overwrites). "Measure" (`takeBenchmarkAction`, SA, audited) | Reproducible snapshots | No delete or list of saved scenarios beyond buttons; overwrite without warning |

### /admin/actuals
`app/(admin)/admin/actuals/page.tsx`, `position-card.tsx`, `actuals-table.tsx`, `payroll-editor.tsx`, `bank-editor.tsx`, `app/(admin)/admin/actuals/actions.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Against the forecast | Months of trading, first month in the black (`monthlyActuals`) | "The forecast" link | Actuals vs model | None |
| Position | Ours to spend, In the bank, Burning, Runway | Nothing | Runway | None |
| Month table | Earned vs spent per month, not measured list | Nothing | Company result | None |
| Payroll | Employees, salary, this month total (`listEmployees`, `payrollByMonth`) | Salary + From + "Save" (`setSalaryAction`), "Last month paid" + "They left" (`endEmploymentAction`), "Return", add Name/Job/Queue/Salary/From + "Add" (`addEmployeeAction`). SA, audited in `lib/data/payroll.ts` | Company payroll, never clinical | No confirm on "They left" |
| Bank | Capital lines and other costs (`listCapital`, `listOtherCosts`) | "Remove" capital (`removeCapitalAction`, hard delete, audited), Whose money/Amount/When/Note + "Record it" (`addCapitalAction`), Month/Dollars/Note + "Save" (`setOtherCostAction`). SA | What is in the bank | "Remove" is a one click hard delete with no confirm |

### /admin/tv (Total View)
`app/(admin)/admin/tv/page.tsx`, `components/admin/gate.tsx`, `components/admin/board.tsx`, `components/admin/total-view.tsx`, `app/(admin)/admin/tv/actions.ts`, `lib/console/gate.ts`, `lib/console/reads.ts`

| Section | What they see | What they can do | Why it matters | Gaps |
|---|---|---|---|---|
| Gate | "Total View", First key, Second key; or "Set the keys" | "Open" (`submitKeys` to `unlock`, SA, 5 tries/hour, 20 minute grant, audited). "Save" key (`configureKey`, SA, audited; slot b sealed once set, slot a always changeable) | Two key elevation | Page is `requireManager` but `elevated()` calls `requireRole("super_admin")`: managers bounce. One super_admin can set both keys, and can reset key a at will, so it is not two person control. Not in nav |
| The board | Money, Companies, Clinics, Clinicians, Sessions, What the models cost, The transfer queue, People, Everything that happened (`wholeBoard`) | Per section refresh (`refresh*` in `board-actions.ts`, mgr+) | Whole company at a glance | Refresh actions allow managers, page does not |
| Now | Live sessions: person, email, clinician, recording on or off, segments, last activity (`liveSessions`); radar now (`radarNow`) | Click a session to open detail | Live oversight | Patient names and emails shown to the operator |
| Timeline | Events in window (`timeline`) | Hours buttons | What happened | None |
| People | Search by email (`peopleByEmail`); person: sessions, copilot conversation (`conversationFor`, full `copilotMessages` content) | "Email their record to them" (`mailRecordToPerson`, elevated, audited) | Records requests | **Reading a person's copilot conversation is not audited** (only the unlock is). Record email has no reason field, exports only the first `patientIds[0]`, and BCCs the operator (`copyTo: actor.email`) with the export link |
| Clinicians | Roster: status, verification, sessions, patients, last login (`clinicianRoster`) | To + "Reason and authority" (20+ chars) + "Send" (`mailClinicianHistory`, elevated, audited, CSV of session and note history to any address, clinician notified in app) | Formal records requests | Sends to any typed address on one person's judgement; no second approver |
| Audit | Last 120 audit rows with reason (`auditStream`) | Nothing | Oversight | None |
| Session detail | Transcript, note content, patient status, consent, risk flags (`sessionDetail`) | "Close" (`close` to `relock`) | Break glass reading | **Not audited per read**: `sessionDetail` and the page write no audit row, unlike `/admin/radar/investigate/[id]`. No reason required per session |

## 3. Can do with no screen

Scripts (`package.json`, `scripts/`), all requiring shell and database credentials:

- `npm run grant:admin` (`scripts/grant-admin.ts`): create a super_admin. The console cannot create, list, demote or remove any back office account except adding staff or manager.
- `settings:seed | show | rails | reprice | check | compare` (`scripts/settings.ts`): `reprice` overwrites all pricing and moves every therapist to PAYG; `rails`, `check`, `compare` inspect settings. The console cannot edit `settings.checkins` at all.
- `demo:seed` / `demo:purge` (`scripts/demo.ts`): create or delete demo clinicians who appear on the public radar (`therapist_radar.demo`). `seed:demo -- --scenario=…` and `verify:demo` (via `on:production`): the five value statement positions. The only demo trace in the console is the DEMO badge on `/admin/radar` and `/admin/tv`.
- `db:reset --i-mean-it` (`scripts/reset.ts`), `db:seed`, `simulate:seed`, `age` (moves a wave's timestamps back), `baseline`, `on:production` (the allowlisted door to production).
- `republish` (`scripts/republish.ts`), `ship:content`, `content:sync` (`scripts/sync-blocks.ts`): push built in CMS content over live rows; `content:sync` is the only way to add a block to a published page.
- `backfill-diarise` (re-attribute old transcripts), `whatsapp:check` (send one real WhatsApp), `mail:preview`, `spend`, `forecast`, `plan`, `check:live`, `survey:live`, `probe`.

Code with no screen:

- `openTicket` in `app/(admin)/admin/support/actions.ts`: reading a ticket's text, never called.
- `postEntityTransfer` (`lib/billing/ledger.ts`): record cash moving between the US and EG entities; only `scripts/verify-sprint16.ts` calls it.
- `traceHeld`, `recentLedger`, `ledgerForTherapist` (`lib/billing/ledger.ts`): per clinician ledger trace, no page.
- `changeHistory` (`lib/data/phone-change.ts`): full record of a number change "for an audit or a dispute", no page.
- Re-running `grantFor` (`lib/billing/manual-grants.ts`) after a failed grant: the comment says "an operator can re-run a grant"; there is no action.
- `alertAgedPayouts`, `pauseUnverified`, `reconcilePots`, `lapseOverdue`, `reconcileRenewals`, `releaseAllHeldEarnings`, `refundNoShow` (via `app/api/cron/[job]/route.ts` and patient flows): automated only, with no console view of what they did or failed to do.

## 4. Stuck with no console

- **Bank transfer confirmed but grant failed.** `confirmPayment` leaves the row `confirmed` and returns "Tell an engineer". The session stays unpaid, the pot or subscription uncredited; nothing lists or retries it.
- **Bank transfer confirmed for a session that was cancelled meanwhile.** `grantSession` only `log.warn`s and returns; no `session_payments` row, money kept, no refund path.
- **Any refund of bank transfer money.** Manual grants record `capture: "platform"` with no Stripe intent, so `refundSessionPayment` refuses ("no Stripe charge"). This includes the automatic no-show refund: `refundNoShow` marks the session `refunded` and only `log.error`s the failure, while `/admin/radar` tells the operator no-shows are already refunded.
- **Overpaid subscription on the rail.** `grantSubscription` logs "left money over" and nothing else. No credit balance, no screen (A4 promises it appears on `/admin/transfers`).
- **Abandoned carts (`awaiting_proof`).** Never expire; only the payer can cancel their own. They block `saveTransferFields` indefinitely.
- **Payout marked `sent` that never arrives or bounces.** Only "Confirm arrival" is offered; `rejectPayout` accepts only `requested` or `approved`. The ledger has already posted the payout.
- **Payout above the two person threshold with one super_admin available.** Staff cannot take it on (SA action), so it waits.
- **Support ticket moved to WhatsApp.** Cannot be closed (`whatsappSummary` never written). Every ticket's content is unreadable in the console.
- **Staff or manager working verifications or payouts.** The queue renders; every decision bounces them. Out of hours these queues stop.
- **Licence expiry.** No check, no queue; an approved clinician with an expired licence stays cleared.
- **Check-in channel halted by mute rate.** No control to resume or retune it in the console.
- **Pot after opening.** Terms, expiry, overdraft cannot change; unspent money cannot be refunded; expiry is not processed by any admin act.
- **Sponsor, clinic, partner portal accounts.** No disable, remove or password reset from the console.
- **Back office accounts.** No list, deactivate or role change; a leaver keeps access until someone edits the database.
- **Patient record claims and history requests** (`lib/data/claims.ts`, `lib/data/portability.ts`): an expired or failed claim, or an unanswered history ask, has no admin view.
- **Content page saved as draft.** Public page 404s until republished; no draft over published.

## 5. Should exist in the redesign

1. **Make the role matrix true.** One source (a table of route to allowed roles) that drives both the nav and `requireRole`; send back office bounces to an "not yours" page inside `/admin`, audited. Reason: six nav links bounce the roles shown them, staff land on `/admin` which bounces to `/onboarding`, and A5 claims refusals are recorded.
2. **Decide who works payouts and verifications, then wire it.** Either move `takeOn/approve/markSent/confirm/reject` and `decideTherapistVerification` (and `identityReadDecision`) to staff, or hide the queues from staff. Reason: the pages are `requireStaff`, the actions are `requireRole("super_admin")`, and the two person payout rule needs a second person.
3. **Idempotent payout send.** Move the status transition before `postManualPayout` in one transaction, or key the journal by `refId`. Reason: `markPayoutSent` can double post the ledger.
4. **A manual rail exceptions queue on `/admin/transfers`.** Rows for: confirmed but grant failed (with "Retry grant"), confirmed for a cancelled session, overpayments, unmatched bank lines, and abandoned carts (with "Discard"). Reason: all five are only `log.*` today, and A4 promises they are "work".
5. **Refunds for bank transfer money.** A refund that records an outbound transfer (like the payout rail) and reverses the ledger. Reason: `refundSessionPayment` cannot refund `capture: "platform"` rows, so no-show refunds silently fail for every Egyptian patient.
6. **Payout "did not arrive" state.** Allow `sent` to move to a failed state that reverses `postManualPayout`. Reason: `rejectPayout` refuses `sent`.
7. **Read and reply to support tickets.** A ticket view calling `openTicket` (audited `phi_access`), a reply field, and a WhatsApp summary field. Reason: `openTicket` is unused and `closeTicket` blocks on `whatsappSummary`.
8. **Audit every Total View read and require a reason per session.** Match `/admin/radar/investigate/[id]`. Reason: `sessionDetail` and `conversationFor` expose transcripts, notes, risks and copilot messages without an audit row; the record email BCCs the operator.
9. **Real two person elevation.** Two keys held by two named people, neither resettable by the other. Reason: `setKey` lets any super_admin reset slot a and set both on first use.
10. **Confirm plus reason for every destructive or customer visible act.** Suspend, Reject (therapist page), Void, Release, Force offline, taxonomy toggles, sponsor/clinic/partner state, Rotate code, Lift the pause, Remove capital, Delete language. Reason: all are one click today, several without any reason and several with results discarded (`void (await …)`).
11. **Server side reason validation matching the UI.** Transfer reject (modal 5 vs server 10), `applyInvoiceDiscount` and `applyUpcomingDiscount` (no reason check), `adjustLedger` (client only), radar ban default "Administrator action".
12. **Team management.** List, deactivate, change role, reset password for back office, clinic, sponsor and partner users; never type a customer's password in clear. Reason: only create actions exist.
13. **Licence expiry queue.** Clinicians whose `licenseExpiry` has passed or is near, with re-verify. Reason: the field is display only.
14. **Pot lifecycle.** Edit terms and expiry, close, refund unspent, process expiry. Reason: `openPot` is the only pot action.
15. **CMS draft over published and history.** Save a draft without unpublishing; show locale; add, remove and reorder blocks. Reason: `readPage` returns null for drafts and blocks can only be added by `content:sync`.
16. **Check-in settings editor and resume.** Reason: the page promises "every number is yours to change" and nothing edits `settings.checkins`.
17. **Search and paging on every queue and log.** Transfers by reference and amount, audit by actor, resource and date, with `reason` shown. Reason: all lists are hard capped (200 or 100) with no search.
18. **Loading and error boundaries for `(admin)`.** Reason: none exist; a failed loader drops the operator to the global error page mid queue.
