# Fix everything first: the plan and the tracker

Written 2026-09-23 from a full read of `takeover/inventory/*.md` (137 pages and surfaces, six
user types) against `docs/VALUE-STATEMENTS.md`, the code, and `takeover/design/RESEARCH-2.md`.
The founder's instruction: fix every bug and hole before the redesign starts.

## Rules every fix follows

1. **Confirm before fixing.** The inventory is six agents' reading of the code. Each item is
   first reproduced: a failing test, a failing verifier check, or a code path quoted in the
   commit. An item that does not reproduce is closed as "not a defect" with the reason.
2. **A test that fails without the fix.** Added to `tests/*.test.ts` or the matching
   `scripts/verify-*.ts`, and shown failing on the old code before it is shown passing.
3. **Never weaken a gate** to get green. A gate that encodes the defect is corrected in the
   same commit, with the reason.
4. **The prose ratchet holds.** Words added to a portal are paid for by words cut, and most
   waves cut more than they add, because a false promise is usually deleted rather than built.
5. **Production only through the door.** Migrations first with
   `npm run on:production -- db:migrate`, then `main`. Full gates (35) green before every
   deploy. The founder's instruction to fix everything is the say-so for these deploys.

Severity, as in `takeover/NEW-TASKS.md`: **S1** privacy, safety or legal position of a patient;
**S2** money lost or misstated; **S3** somebody stuck; **S4** says something untrue.

## Decisions taken as defaults (reversible, each stated in the report)

| # | Decision | Default taken | Why |
|---|---|---|---|
| D1 | Names on the company people list (founder's decision 4) | **Kept as decided.** Recommendation to the founder: replace the list with a floored count and a one-person lookup used only to end a benefit | E1 and E2 are the source of truth and say "never who"; research (RESEARCH-2 section 4) finds no benefit vendor showing enrolled names |
| D2 | Patient names at the clinic | **Founder's decision, 2026-09-23: the clinic sees first name and last initial on each clinician's calendar and patient list.** C2 and C5 rewritten to match | A per-clinician patient list reveals caseload size, so the homepage sentence "no caseload count on any of them" (`lib/content/defaults.ts` and its published CMS row) goes in the same release as the list |
| D3 | US company card top-up | **Card rail switched off** until a real charge exists (Wave 4 builds Stripe checkout for top-ups) | It credits money nobody paid (task 220) |
| D4 | Company HR integration tab | **Hidden** until rebuilt | Does nothing, copy describes the reverse, its counter leaks enrolment timing |
| D5 | Company public listing toggle | **Removed** | Nothing reads it |
| D6 | Partner record layer (readers, write-back, note delivery, launch, three webhook events) | **Taken out of the docs and the webhook form** until a linking path exists; end-session is built | Unreachable in production; documenting it is S4 |
| D7 | Note formats | **Founder's decision, 2026-09-23: any format, all included in the session price, all saved on the patient's history.** Built as W2-F01 right after W1-03 | Makes `ft.f2` "in the format you work in" true |
| D8 | "HIPAA BAA included" | **Claim removed** | No BAA exists; a legal claim we cannot back |
| D10 | Company reporting floor (`activityFloor`, today 5) | **Unchanged, raised with the founder** | RESEARCH-2 section 4: published norms run from about 5 to 10; 10 recommended, applied to derived figures too |
| D11 | Egypt data protection law 151/2020 regulations (grace period ends about 31 October 2026) | **Legal work, raised with the founder**, not a code change | Health data needs explicit consent, a licence and a DPO; audio or notes sent abroad for AI need a cross-border licence |
| D9 | Staff working payouts and verifications | **Buttons shown only to who can press them**; nav and guards made to agree. Whether staff get that authority is the founder's call | Money authority is not mine to grant |

## Wave 1: harm (S1 and S2). Deploy as soon as green.

| ID | Sev | What | Fix | Proof |
|---|---|---|---|---|
| W1-01 | S2 | US card top-up credits the pot with no charge (task 220) | `addToPot` refuses on the card rail; the form says how to pay instead; `topUpPot` only callable from a confirmed payment path | test: card-rail top-up leaves balance and ledger unchanged |
| W1-02 | S2 | Seat clinicians can change clinic seats, plan, invoices payment, EHR (task 221) | Every org-level billing and records action requires a solo org owner or a clinic manager capability; the controls are hidden from seat clinicians | test per action: seat clinician refused |
| W1-03 | S1 | Signed notes can be rewritten, earlier text lost (task 222); same for the patient copy | Signed note and released brief lock; changes become addenda (author, time, text) kept forever and shown in order | test: saveNote on a signed note refuses; addendum appended |
| W1-04 | S2 | Payout "Mark sent" can post twice (task 224) | Guarded status move first, ledger post inside the same transaction, keyed by the payout | test: two concurrent calls, one ledger entry |
| W1-05 | S1 | Clinician muted in video without the patient's yes (task 225) | Done on the branch (`da98d4a`) | tests/consent.test.ts |
| W1-06 | S1 | Off-record press ignores a failed write: screen says off record while the server records | Await the result; on failure revert the pill and say so | test on the action result handling |
| W1-07 | S2 | No-show recovery actions take a bare session id: anyone can refund or reassign | Require the join token (patient's own link) or the patient's session | test: call without token refused |
| W1-08 | S2 | A no-show report alone triggers refund and radar suspension | Refund only when the room shows the clinician never joined; otherwise route to the admin report queue | test both branches |
| W1-09 | S1 | SOS: only US and Egypt numbers, none for English locale, hidden under the booking sheet, missing on 404 | Every configured country line, fall back to the reader's country, always above sheets, SOS on not-found pages | test on `lineForNumber` and a z-order check in the walk |
| W1-10 | S1 | A questionnaire answer signalling self-harm is ignored | Risk items trigger an in-screen crisis response (numbers, "talk to someone now") and flag the clinician | test on the risk rule |
| W1-11 | S1 | In-room "Something is wrong" report is never saved, screen says sent | Resolve the session by join token; show the real result | test: report from room stored |
| W1-12 | S2 | Bank-transfer money cannot be refunded; the no-show job marks it refunded anyway | Never mark refunded without a refund; a manual refund enters an operator queue as an outbound transfer with ledger reversal | test: manual-rail refund creates queue row, status honest |
| W1-13 | S2 | Clinician cancels a paid booking: patient not told, not refunded | Cancel takes a reason, notifies the patient in app and by message, and refunds (card) or queues (transfer) | test |
| W1-14 | S1 | Total View reads (transcript, note, copilot) not audited; record email BCCs the operator | Audit every read with a typed reason; no BCC | test: read writes phi_access row |
| W1-15 | S1 | Clinic sees patients only as first name and last initial (D2), and every sentence says so | Rota and CSV use `shortenForClinic` everywhere, no full name, phone or email; wall, apply, join and the patient's "what {practice} can see" agree | verifier |
| W1-16 | S1 | Expired licences stay cleared | Nightly job: expired licence goes off the radar, clinician told, operator queue; renewal re-review | test |
| W1-17 | S1 | Partner audio before the consent offset is transcribed; withdrawal keeps the transcript | Trim before the offset server side; withdrawal purges | test |
| W1-18 | S1 | Partner copilot ignores consent state and revocation (dormant only because nothing ends a session) | Consent and revocation checked before any material is read | test |
| W1-19 | S2 | Spreadsheet formula injection in clinic exports | Escape `= + - @` leading cells | test |
| W1-20 | S1 | Company pot-empty email fires per booking and reveals when someone booked | One alert per period, no timing; low-balance warning instead | test |
| W1-21 | S1 | Company HR tab counter shows real enrolments in the last 7 days (D4) | Tab hidden | verifier |
| W1-22 | S2 | Clinic and company records disconnect revokes every connection with no confirm | Admin-only, confirm, revoke the chosen connection | test |
| W1-23 | S1 | A clinician can edit licence fields after approval with no review | Licence fields editable only through re-verification | test |
| W1-24 | S1 | Partner note draft has the consent coverage sentence pasted into the clinical text (RESEARCH-2 section 3: consent written into charts by the AI is the pattern behind the 2025 scribe lawsuits) | Consent and coverage stored and returned as their own fields, never inside note text | test |
| W1-25 | S1 | Egypt's 105 line is reported as not 24/7 (RESEARCH-2 section 1); SOS offers it alone | 123 and 112 always shown with it, emergency number first outside its hours; same on the website samples | test on the line list |

## Wave 2: stuck (S3). Every dead end gets a way forward.

**Patient**
- W2-P01 Session-expired redirect loop (patient route like the clinician's `/session-expired`).
- W2-P02 Sign-in honours `next` (password and code), so invites and the benefit QR come back.
- W2-P03 Add an email to signup and account, verified by code (export, email sign-in, claim codes need it).
- W2-P04 Sessions a signed-in patient books (radar, calendar, join) attach to their own person (task 223).
- W2-P05 Booking confirmations and reassignment links point to the patient's own session screen, not `/sessions/{id}`.
- W2-P06 A session card opens something: join, pay, pending transfer, summary.
- W2-P07 Phone change can be finished: a screen to enter the code (`completeChange`).
- W2-P08 Benefit page reads `?code=`; paused benefit can resend its code.
- W2-P09 Notices, messages, residency and benefit reachable from the app (a bell with the unread count, and the You page).
- W2-P10 The summary is released without a rating gate; rating stays optional.
- W2-P11 No-show recovery shows inside the room and re-checks while waiting.
- W2-P12 Radar with nobody free offers the first bookable hour, not a dead end.
- W2-P13 `/j/[code]` connects the new account to that therapist.
- W2-P14 Billing lists unpaid and pending sessions, not only paid ones.
- W2-P15 E5: when the pot does not pay, the pay and join screens say who to ask.
- W2-P16 Invalid invite link, `/records` expired page and similar dead ends get a way back.

**Note formats (founder's decision, 2026-09-23)**
- W2-F01 Notes in any format, included in the session price, all on the patient's history:
  - Formats: SOAP, DAP, BIRP, GIRP, PIE, SIRP, narrative, and the therapist's own templates (named sections, each with a short guide the draft follows). Each format is data (a key, a label, ordered sections), so a new one needs no code.
  - A default format per therapist in Settings; each session's note is drafted in it, from the transcript, in the session's language, exactly as SOAP is today. "Write it yourself" (no recording) opens the chosen format's empty sections.
  - "Also write it as..." on the session page drafts the same session in another format. Each format is its own document with the same lifecycle as today's note: draft, signed, then locked with addenda (W1-03).
  - Included in the price: any number of formats for a session adds nothing to any invoice; the session's one AI line (`sessionLines`) is unchanged. Test: a second and third format leave the invoice lines identical.
  - Saved on the patient's history: the clinician's patient page lists every note of every session, grouped by session, with format, draft or signed, author and time; the copilot, export, record-system filing (`lib/ehr/file-note.ts`) and partner draft read the signed notes of any format, not only SOAP.
  - The patient's plain-language copy stays one per session, from whichever note was signed first.
  - Existing SOAP notes keep working untouched (SOAP becomes one format among the rest).

**Clinician**
- W2-T01 Support reachable while unverified, and linked from the portal.
- W2-T02 Applicant status: what is under review, edit before review, update a renewed licence after approval.
- W2-T03 "Writing your note" forever on sessions that will never have one.
- W2-T04 Redraft the note after voice or line corrections.
- W2-T05 Removing a clinician from a clinic: they are told, keep sight of their own patients and sessions.
- W2-T06 Notifications list (non-crisis kinds are fetched and thrown away today).
- W2-T07 Same destinations on desktop and mobile; orphan pages linked (`/support`, `/settings/records`, own `/t/[id]`).
- W2-T08 Clinic join "done" state leads somewhere.

**Clinic**
- W2-C01 Pages check capabilities and redirect instead of crashing; home renders for every role; usage scoped.
- W2-C02 Seats managed in the clinic portal by an admin; inviting and removing a clinician quotes and applies the seat change.
- W2-C03 Bills include seat invoices, with paid state and a pay action.
- W2-C04 Staff lifecycle: invite link instead of a typed password, remove, change role, sign out everywhere.
- W2-C05 Password reset for clinic managers and staff.
- W2-C06 Records: callback result shown; export matches the visible range.
- W2-C07 Apply and join pages get a header and a done state that leads somewhere.
- W2-C08 Each clinician's patient list in the clinic portal, first name and last initial only (D2), with the homepage "no caseload count" sentence removed in the same release.

**Company**
- W2-S01 Domain mailbox confirm link opens without a portal login.
- W2-S02 Balance republished on every top-up (the company's own act reveals nobody).
- W2-S03 First joining code can be created by the company; print without the portal chrome.
- W2-S04 Irreversible actions (end benefit, replace code, remove field, revoke key) get Cancel and a final confirm, and success messages.
- W2-S05 Forgot and change password; invite and remove users with roles.
- W2-S06 Identifier setup with presets and a test box; warn when a domain gate names an unproved domain.
- W2-S07 Verify-cycle screen and job read the same number.
- W2-S08 Pot expiry enforced, or the promise removed (default: enforced with warning).
- W2-S09 Enquiry follow-through: staff and applicant notified, duplicates caught, entity by country.

**Partner**
- W2-X01 Rate limit throttles instead of permanently suspending a key.
- W2-X02 End-session endpoint so copilot and memory have material (after W1-18).
- W2-X03 Webhooks delivered by a frequent job with backoff, a Failed state, Redeliver and Send test.
- W2-X04 Key rotate, confirm on revoke, audit on mint and revoke.
- W2-X05 Billing on first audio, not on consent; 80 and 90 per cent alerts reset monthly with an absolute link.
- W2-X06 Password reset and colleagues; sign-in linked from `/developers`.

**Admin**
- W2-A01 One role table drives nav and guards; staff land on a page they can use; refusals audited (A5).
- W2-A02 Support tickets can be read (audited), replied to, and a WhatsApp ticket closed.
- W2-A03 Transfers exceptions: grant failed (retry), paid for a cancelled session, overpayment, abandoned cart (discard, expiry).
- W2-A04 A payout marked sent can be marked "did not arrive", reversing the ledger.
- W2-A05 Confirm and a reason on every destructive or customer-visible act; server checks the same reason length as the screen.
- W2-A06 Team management for back office, clinic, company and partner users; no operator ever types a customer's password.
- W2-A07 CMS: saving a draft never takes a live page down.
- W2-A08 Check-in settings editable and a halted channel resumable.
- W2-A09 Search and paging on transfers, audit, errors and the radar table.
- W2-A10 Radar: ban reason required, force-offline tells the patient mid-booking, investigate asks a reason.
- W2-A11 Sponsor invoice numbers unique per issuer; a welcome credit is not "Paid".

## Wave 3: says something untrue (S4), and the whole product in both languages

- Every row in the six "Promised but not built" lists is either built above or its copy is
  corrected. The list is walked row by row and each row closed with the commit that closed it.
- Every hard-coded English literal named in the inventories moves to `lib/i18n/messages.ts`
  with its Arabic.
- `loading.tsx`, `error.tsx` and a not-found that keeps the SOS orb, in every route group.

## Wave 4: what the product promises and has never had (the bridge into the redesign)

Stripe checkout for company top-ups (D3), patient document upload, homework history,
in-app support with replies, earnings netting held minus owed (T3), two-step sign-in for
clinicians and the console, the partner linking path (D6), note formats (D7). Each is built in
the new design rather than twice.

## Status

Updated as each item lands: `open`, `confirmed`, `fixed <commit>`, `not a defect <why>`, `live <deploy>`.

| ID | Status |
|---|---|
| W1-05 | fixed da98d4a, not yet live |
