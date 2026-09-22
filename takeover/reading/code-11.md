# Slice 11: components-rest

## Files

### components/billing/bill-picker.tsx (206 lines)
- For: PAYG clinician picks which unpaid invoices one bank transfer covers, then opens `PaymentPopup`.
- Decides: holds ids only; figures come from server `quote(ids)` debounced 500ms (106-114), only after a change (`touched`, 91). All preselected (81). Frozen while live state is submitted/awaiting_proof (99). Picker hidden when one invoice (131). Empty selection shows `bill.pickOne` but `PaymentPopup` still renders with the last quoted figure (185-203).
- Assumes: server `quote` and `onOpen(ids)` recompute from stored rows; `PaymentPopup` storage key.
- Promises: A1 (nothing granted here), price shown = server figure.
- Notes: tokens `text-brand-800` link, `text-brand-700` checkbox, `text-rose-600` error. Invoice rows in USD via `Money`, sheet total in EGP.

### components/billing/earnings.tsx (210 lines)
- For: Stripe-connected clinician earnings card (available, clearing, held, this month, lifetime).
- Decides: not connected + held>0 shows "waiting" + finish setup (61-86); connected shows headline available or "-" when Stripe unreachable (123). Held gets its own amber row (151). Pay out now only when payoutsEnabled and available>0 (172).
- Assumes: `payOutNow`, `openPayoutDashboard` in app/(app)/settings/actions.
- Promises: T3 partly: footer `tearn.lifetimeSettled` states lifetime net, fees and "settled from earnings" (196-205); it is lifetime history, not the per-payout "held vs owed" halves T3 asks for.
- Notes: whole card is `bg-brand-500 text-navy-600` (teal ground, navy ink). Line 187 dashboard button is `bg-navy-600/10 ... text-white` on the teal ground: white on teal, about 2.2:1 (the exact thing globals.css:56-67 says the palette verifier forbids). Line 153 `text-amber-200` icon on teal, invisible. Line 136/140 `bg-white/10` tiles barely visible on teal. Error box `bg-black/20` (166).

### components/billing/ledger.tsx (509 lines)
- For: clinician's one chronological ledger (invoices out, patient payments in) plus a Stripe multi-invoice pay card.
- Decides: Stripe pay card only when `payable` (not Egyptian rail) and due>0 (170). Total for the button label is computed in the browser (115-117) as sum(max(0, amount-discount)); `payInvoices(ids)` charges server-side. History sorted on ISO `sortAt` (142). `PaymentDetail` shows gross, fee (platformFee - settledInvoice), bill settled, net (459-499): this IS the T3 netting presentation per payment.
- Assumes: `payInvoices` re-prices from rows; `patientName` from chart not payer (C243, 53-61).
- Promises: T3 kept per payment row (fee and "bill settled" lines, 468-478). Price shown vs charged: button label is browser arithmetic, charge is server; they agree only if server uses the same discount rule.
- Notes: Badge tones used: green, amber, slate, red, teal, brand. `Badge tone="teal"` in a non-radar file (palette rule says teal-* belongs to radar files; depends on how Badge maps teal, see ui/index). Mixes `formatUsd` (plain) and `Money` (USD with pounds on hover) on the same row. `−` minus sign literal.

### components/billing/pay-by-transfer.tsx (466 lines)
- For: the manual transfer rail UI for all payers: details, submitted (waiting), rejected, unconfigured.
- Decides: submitted state polls `router.refresh()` every 15s (202-206) and shows own receipt back (236-251). Rejected shows operator reason verbatim (267-269) with `transfer.rejectedBody`, and NO form or retry control in that state (258-273). Unconfigured says so (277-288). Amount posted as hidden `amount` = step.creditCents/100 only for pot (404); server recomputes tax. Submit instruction in a red bordered `role="alert"` box (376-381).
- Assumes: `submitProof` enforces reference-or-receipt; server builds `lines`, `amountLabel`, `taxNote`.
- Promises: A3 kept on this screen (verbatim reason). A1 (submitted is waiting, not granted).
- Notes: `role="alert"` on a static instruction re-announces on every render (H8 adjacent). Red used for an instruction although pending-bar.tsx:121-133 argues red is reserved for crisis. Tokens: amber-50/200/900 waiting, rose-50/200/900 rejected, `bg-brand-500 text-navy-600` submit.

### components/billing/payment-history.tsx (215 lines)
- For: therapist list of patient payments (net of gross) and payouts released.
- Decides: patient name from chart, card details removed (13-22, 92-98). Held chip when capture=platform (114).
- Promises: none directly; C243 sponsor anonymity toward therapist kept (no payer name/card).
- Notes: hardcoded English "Patient payments" (81), "A patient" (89), "of" (107), despite `useT`. Local `Chip` duplicates `Badge` from ui (189-215). Doc comment 46-50 still says "The card brand and last four are here" while the code removed them (Stale).

### components/billing/payment-popup.tsx (470 lines)
- For: the one payment sheet for patient, clinician, clinic, company; minimised as button or floating orb.
- Decides: holds no payment state; opens from `localStorage pay:<key>` read in effect (187-193); `onOpen` writes the awaiting_proof row server-side when the sheet opens (200-203, 213). Cancel (two taps) only in states none/awaiting_proof (231-232). Orb `fixed end-3 bottom-24 z-[60]` said to be below SOS (297-305). Sheet stops above bottom nav `pb-20` (351). Backdrop click closes (357-362). Card slot "coming soon" rendered disabled (431-435).
- Assumes: `cancelCart` WHERE state guard; `verify:rail` refuses import by therapist/admin surfaces (60-62); SOS orb z-index above 60 (P5).
- Promises: P5 depends on SOS z-index > 60 (not in slice). A1.
- Notes: cancel confirm button `bg-amber-600 text-white` (263), amber-600 with white is about 3.2:1, under 4.5. `onwardHref` link rendered whenever passed, regardless of live state (459).

### components/billing/pending-bar.tsx (216 lines)
- For: bar across every portal while a manual payment is open, submitted, or just confirmed.
- Decides: confirmed can be dismissed per payment in localStorage (83-114); open/submitted cannot be dismissed. Tapping writes `pay:<storageKey>` so the sheet opens on arrival (99-105). Colours: confirmed `bg-emerald-700 text-white`, open `bg-amber-500 text-amber-950`, submitted `bg-amber-300 text-amber-950` (146-150). Amount `shrink-0` so never truncated (172-175).
- Promises: P2 (in-app, not only email) for payments.
- Notes: comment 179-181 still says "red is unfinished business waiting on the payer", but 121-133 removed red (Stale). Second line `opacity-80` on amber-950 text fine.

### components/billing/plan-card.tsx (436 lines)
- For: clinician plan: PAYG vs monthly unlimited tiers, this month's spend, credit, held earnings, cancel/resume.
- Decides: PAYG = first tier with monthlyCents 0 (125). Tap selects, a separate "confirm and pay" spends (140, 359-429); confirm calls `upgradeAndPay(tier.key)` for BOTH up and down (390), then writes `pay:<key>` and reloads (404-408). C209 line "AI fee never charged when patient declines" (179).
- Assumes: `upgradeAndPay` handles a PAYG (downgrade) key; `cancelPlan`/`resumePlan`.
- Promises: T3 adjacent (held earnings tile, 216-219).
- Notes: PAYG card price shows global `platformFeeCents`, not `tier.unlockCents` (334); `unlockCents` is unused in the component. Current tier card is `border-brand-600 bg-brand-50`, "yours" pill `bg-brand-500 text-navy-600`. `Badge tone="teal"` for credit (184).

### components/billing/seat-manager.tsx (145 lines)
- For: seat slider with a server quote before the button (C323/C333/C351).
- Decides: every move calls `quoteSeats(next)` (52-63); Save calls `saveSeats(from, to)` (134). Removing seats: "does not refund this month ... smaller bill starts at renewal" (108-112).
- Assumes: `quoteSeats`/`saveSeats` in app/(app)/billing/actions recompute server-side and refuse a stale `from`.
- Promises: C3/C4 wording (lower bill at renewal). PL7 retroactive band step described in comment 28-36.
- Notes: ALL copy is hardcoded English (no `useT`). Quote sentence says "up from {from}" even when seats go down (96-98). Range `accent-brand-700`. Rapid slider drags fire one server quote per step with no debounce (52-62), and results can arrive out of order (last-resolved wins, not last-asked).

### components/billing/top-up-stepper.tsx (196 lines)
- For: company pot top-up amount chosen by stepping through server-built rungs (USD big, EGP small, VAT, total to send).
- Decides: state is an index starting at 0 (56); `onChoose(creditCents)` debounced 700ms on every change INCLUDING the first render (62-67). Empty ladder message (73-77).
- Assumes: `openPotPayment` saves the chosen credit as the open payment (app/(sponsor)/sponsor/pot/page.tsx:212).
- Notes: `topup.covers` "covers N sessions" at their own coverage rate (119-126). See Broken: the stepper never restores the saved figure and overwrites it with the floor.

### components/billing/withdraw.tsx (257 lines)
- For: manual payout rail from the clinician side: held, requested, sent, available; destination form; request; history with receipts.
- Decides: request form only when available>0 and a destination exists (167); max = available (177). Rejected payout reason shown (221-223).
- Promises: T3 partly: shows held/requested/sent/available, but no "owed" figure beside held, so the netting (owed out of earned) is not visible here.
- Notes: comment 14 "an English-only surface" while every string goes through `t()` (Stale); `formatUsd` imported unused (15). `ml-auto` (211) not logical property (RTL).

### components/brand/logo.tsx (143 lines)
- For: the inline SVG 24T mark.
- Decides: `ink` is one of navy #0A2342, teal #2EC4B6, white (30-34); viewBox is ink box plus 10 units clear space (68-76); min box height 21px (85, 111); `title=null` hides it from AT (118-120).
- Notes: no wordmark component by decision (129-143). Teal ink is 2.19:1 on white, for radar ground only.

### components/clinic/apply-form.tsx (113 lines)
- For: practice enquiry form (held row plus a phone call, never an active clinic).
- Decides: asks name, contact, email, phone, registration number/authority, free-text intended clinicians (45-89); no clinician count (22-25).
- Notes: pending label "Working…" hardcoded English (14).

### components/clinic/chrome.tsx (138 lines)
- For: clinic portal chrome; wraps `Desk` with tabs filtered by capability, switcher to clinician, sign out, and the "never" wall sentences.
- Decides: tabs overview(schedule.read), people, bills, earnings, team(team.manage), records(team.manage) (39-56); filter is courtesy, pages recheck with `requireClinicCapability` and `refuseWithout` (31-37). Switch revokes clinic sessions then signs in as clinician (101-108).
- Promises: C2: comment 20-21 says outright "The nearest thing is a NAME ON A SCHEDULE ROW", i.e. the clinic overview shows patient names (confirmed app/(clinic)/clinic/page.tsx:201 renders `row.patientName`). C2 broken by design.
- Notes: comment 14 says "THREE DESTINATIONS" and 48 "a fourth destination"; the list has six (Stale).

### components/clinic/join-form.tsx (239 lines)
- For: clinician accepting a clinic invitation, new account or existing account.
- Decides: renders `SeesWhat` with can = calendar, NAMES, radar, prices, earnings, withdrawals; cannot = notes, risk, copilot, consent (52-67). C261 no private patients sentence above the button (161-164, 216-219).
- Promises: C2 contradicted in the product's own disclosure: `clinic.join.sees.names` and comment 93 "They see each patient's name and appointment time and never a note". C5 kept (earnings).
- Notes: "Working…" hardcoded (15).

### components/clinic/people-list.tsx (248 lines)
- For: clinic's clinician list with verification word, seat-billable-from date, remove, invitations, invite form.
- Decides: verification is a word, never a control (23-30, 101-110); no caseload/session count/patient/earnings on a row (31-35). Remove needs a confirm tap (128-157). Invite link shown on screen because mail domain unverified (225-232).
- Promises: C1 partly (verification state on row, 102-110). C2 kept on this screen (no count). C4 (remove confirm text `clinic.removeConfirm`).
- Notes: verified pill `bg-brand-100 text-brand-800`, pending `bg-amber-100 text-amber-800`; remove `bg-red-600 text-white`. Comment 226-229 "our mail domain is not verified yet, so notify reports a failure" is a dated state claim. "Working…" hardcoded.

### components/clinic/sign-in-form.tsx (68 lines)
- For: clinic manager sign-in. No sign-up link, no clinician link (22-28).
- Notes: "Working…" hardcoded.

### components/clinic/team.tsx (392 lines)
- For: clinic staff (receptionist-type principals), up to two named roles with delegable capabilities, per-staff clinician assignment.
- Decides: role form shown while roles<2 or editing (161); `grantable` drawn, seats/clinicians-manage never delegable, said in amber note (193-196); staff invited with an admin-typed password (270-278); `AssignmentPicker` posts full set, replace semantics (314-392).
- Assumes: `createRole` refuses a third; `scopeToAssigned` null for admin.
- Notes: capability labels exhaustive by type (40-50). See Broken for the role editor. After a successful assignment save, `dirty` still compares against the stale `assigned` prop, so "Saved" (387) only shows if the page revalidates.

### components/demo/clinical-demo.tsx (236 lines)
- For: three marketing demos with controls: live transcript with off-record toggle, draft note with approve, risk banner that dismisses.
- Decides: uses REAL `TranscriptPanel`, `NoteCard`, `RiskBanner` from components/clinical (6-8) with fixtures; reduced motion shows all lines (63-73); off-record pauses the ticker (76). No phone number in the risk demo (C98, 201-205).
- Promises: T1 (draft until approved, `status` prop), T2 (off-record) as marketing claims.
- Notes: real components, fixtures only. Off-record in the demo only pauses arrival; it does not show a gap in the transcript (T2's proof is "a hole where the minute was").

### components/demo/component-showcase.tsx (165 lines)
- For: public-page switch from a demo name to a framed demo surface.
- Decides: transcript/note/risk -> clinical demos; copilot -> `SessionCopilot`; patient-sessions/homework/radar/patient-app/journal/summary -> `PatientApp`; profile -> dated observations list (19-117). Frame from `frameFor` (130-139).
- Notes: doc comment 12-17 "Every one of these is the component the clinician actually uses" is false for `PatientApp` and `SessionCopilot`, which are hand-built mockups (Stale). `profile` with no content renders an empty list.

### components/demo/device-frame.tsx (394 lines)
- For: browser or phone chrome around a demo; phone bar can be real buttons when `onTab` given.
- Decides: phone 300px, aspect 9:19.5 (203-207); lifted globe `bg-brand-500 text-navy-600`, no visible label (235-270); `frameFor` (385-394): self-framed set, phone for session-room only, TALL set, PATHS map.
- Notes: fallback TABS labels hardcoded English ("Sessions", "Steps", "Talk now", "Billing", "You") (165-171), and they are the OLD bar that patient-app.tsx:82-93 says is no longer the product's. PATHS maps `risk` to "/radar" (379), a clinician risk banner shown under a patient radar URL. Address bar hardcodes "24therapy.app". Chrome tokens: `bg-navy-600/700/800`, `border-slate-700/60`, `text-slate-300` on navy.

### components/demo/fixtures.ts (64 lines)
- For: invented transcript and SOAP note for demos.
- Notes: no real data. Note says "No risk indicators elicited" and the risk demo separately shows "want to die"; fine as separate demos.

### components/demo/flow-demo.tsx (601 lines)
- For: two step-by-step phone walkthroughs on the public site: claim a record, grant and revoke consent.
- Decides: hand-drawn screens (NOT real components) with local state; code screen fills digits by tapping (226-266); keep-access box starts empty and ticks (280-305); last step loops (474-482).
- Promises: P4 (patient decides who reads) as a marketing claim.
- Notes: claim step 1 "Not me" advances to the send-code screen exactly like "Yes" (196-198), so the demo shows "not me" leading into the claim. Consent step 2: pressing "No" advances to a screen that shows the therapist "CAN READ" (350-399); comment 346-348 says the next screen shows "the answer was taken", but step 3 is identical whatever was chosen. `NeverTile` (126-142) exists because `consent.neverWhy` alone reads as a feature. Tokens: primary `bg-brand-500 text-navy-600 hover:bg-brand-400`, danger `bg-red-50 text-red-700` and revoke `bg-red-600 text-white`, restart `bg-navy-500 text-white`.

### components/demo/patient-app.tsx (805 lines)
- For: a clickable five-tab patient phone mockup (Home, Sessions, Radar, Therapists, You) with a fake booking flow.
- Decides: all local state and fixtures (`RADAR_DEMO`, `PATIENT_BILLS` from lib/marketing/fixtures). Radar tab draws the flat `WorldRadar` on `bg-[#04101f]` (530-553), not `Globe`, by decision (521-525). Price sheet computes VAT in the browser at a hardcoded 14% (454) and formats `$` by hand (110-111).
- Promises: P1 as marketing (three taps: pick, see price, go in). P4 (Summary shows two authors).
- Notes: a mockup, not the real component. VAT 14% literal diverges from `country_settings` as the one tax source (payment-popup.tsx:427-429). `You` tab renders `consent.neverWhy` on its own beside a ShieldCheck (788-791), the exact misuse flow-demo.tsx:127-134 says reads as the opposite of the promise ("Make you explain why" shown as a feature). "Stop" in `You` is a dead `<span>` styled as a button (784-786), the defect flow-demo.tsx:144-151 says was fixed. `pat.noAccount` claims booking with no account. Tokens: brand-500 cards with navy ink, brand-50/700 pills, amber-50/700 due.

### components/demo/portal-demo.tsx (803 lines)
- For: clickable clinic and company console mockups for the homepage.
- Decides: `ClinicConsole` tabs week/people/earnings/bills (251-291); `CompanyConsole` overview/pot/code/settings (513-542). Uses real `SpendHeatmap` and `Meter` (26-27).
- Promises: C2 is contradicted in marketing: ClinicWeek table has a PATIENT column (320, 334, `row.patient`). E1/E2: CompanyOverview lists spend per named THERAPIST (`dpo.whereMoneyWent`, 600-637), while the comment at 624-628 itself says the real portal "cannot produce this column at all" (lib/data/sponsors.ts:96 "THE WALL", no therapist). CompanyPot lists weekly session deductions with dates (673-707), which is "when" at week grain, versus E1's published-every-five-sessions balance. CompanySettings shows "covered per year 12" and "cap per session $60" rows; whether the real coverage form has these is checked under sponsor/coverage-form.
- Notes: `Primary`/`Ghost` are spans styled as buttons (202-218), dead controls. Org names "Nile Practice", "Nile Holdings" literal. Shell sidebar `bg-brand-50 text-brand-800` active, org chip `bg-navy-500 text-white`. Many `text-[10px]`/`text-[11px] text-slate-600` labels (grey-thin).

### components/demo/session-copilot.tsx (381 lines)
- For: marketing mockup of the in-session copilot: nudges arrive one at a time, preset questions answered with citation chips.
- Decides: fixtures from `content.copilot` / `copilotAsks`; reduced motion shows all (84-114); preset questions only, free field disabled (237-270).
- Promises: T5 as marketing (answer carries source sentence, 368-378).
- Notes: a mockup, not the product component. `aria-live="polite"` on the thread (205); the hero also has a transcript panel, possible two polite regions (H8). `setTimeout` in `ask` not cleared on unmount (175). Tokens: nudge label `text-brand-800`, cite chip open `bg-brand-500 text-navy-600`, "you" bubble `bg-navy-500 text-white`.

### components/demo/session-demo.tsx (445 lines)
- For: the homepage hero: an in-person session room (recording strip, transcript), copilot while live, draft note after End.
- Decides: STATIC_LINES 4 on server; ticker 2.4s; auto-end 6s after last line; note after 1.8s (13-25, 170-207). Error boundary falls back to static (412-443). Labels passed in as strings (41-85).
- Promises: T1 (note arrives as draft), marketing only.
- Notes: comment 30-35 says a client component "cannot read the dictionary: getI18n is server-only", yet every other demo in this folder uses `useT()` from lib/i18n/client (Stale premise). The hero depicts an IN-PERSON session "Recording, both speakers" with no consent indicator, which is the exact path task 123 says records without consent. Disclaimer `text-slate-300` (353, 407) sits OUTSIDE the navy box, so on a light page it is about 1.5:1 (grey-thin). Uses `teal-*` (230, 285, 374), allowed for the session demo per globals.css:43-45.

### components/design/wire.tsx (372 lines)
- For: grey wireframe kit for the `/design` layout-comparison pages (choose a layout before building).
- Decides: primitives listed in the Design system inventory; `Block` draws at 0.62 of real height (154); `Empty` has "card" (today's ~100px card) and "line" (proposed one-row) sizes (194-239).
- Notes: "Option {A|B|C}" (121, 365) and "SOS" (294) are English literals in a kit whose own comment (208-217) says words must be props to keep the i18n ratchet honest. Tokens: navy-500 ink for titles/active, brand-700 accents, `bg-brand-500 text-navy-600` for teal blocks and CTAs, `bg-red-600 text-white` SOS, slate-100/300/500/600 greys, 8 to 11px text throughout.

### components/ehr/records-panel.tsx (375 lines)
- For: EHR (FHIR) records connection, shared by clinic portal and solo settings: connect, last success, disconnect, filings list, revoked history.
- Decides: not on clinic plan shows why and the portability export alternative (129-134); `!configured` names the missing half (229-240); disconnect is a plain submit with a clinician count sentence but no confirm step (188-210); filings show state, date, HTTP status, approving clinician, hospital's error text (302-355).
- Assumes: `actions.begin/disconnect` passed by the page; `ehr_writebacks` never holds note text (297-300); DB CHECK https-only on base URL (260).
- Promises: none of the 25 (EHR is unclaimed per MAP).
- Notes: on the CLINIC portal this renders `filing.lastError` and `connection.lastError` verbatim from a hospital server (183-185, 344-346); a FHIR OperationOutcome can quote a patient identifier or name, which would put it on the clinic portal (C2 exposure path, see Suspect). The Connect button always says Epic (290). "Working…" hardcoded (68). Live dot `bg-brand-500`.

### components/forms/phone-field.tsx (126 lines)
- For: phone input with a required country selector (E.164, C64).
- Decides: country names map (30-57) exported for the CSV importer; hint "We will read this as a X number" after blur (119-123).
- Notes: all English literals (placeholder 64, aria "Country" 85, hint 121, country names), no `useT`. Egypt listed first in the map but the select sorts by English name.

### components/forms/timezone-field.tsx (71 lines)
- For: time zone select, detected after mount via `useReaderZone` (C84).
- Notes: English literals "Time zone", "Detecting…", explanatory sentences (45, 57, 66-67). `Intl.supportedValuesOf` evaluated during render: on the server pass and in the browser the list can differ (Node vs browser ICU), a possible hydration mismatch the comment says it avoids.

### components/i18n/language-corner.tsx (45 lines)
- For: fixed top-end language switch on every signed-in screen.
- Notes: `fixed top-0 end-0 z-50` can sit over a page's own top-end controls (Desk header actions, payment sheet at z-50). English default by decision (19-25).

### components/i18n/language-switch.tsx (106 lines)
- For: language buttons, each named in its own language; pushes localised path or refreshes.
- Decides: `offered` from server else all LOCALES (84); path from server `x-pathname` because of rewrite (38-50); 44px targets (93-95).
- Notes: tokens slate-100 track, white active pill.

### components/marketing/state-dot.tsx (14 lines)
- For: integration state dot: live teal-500, partial amber-500, else slate-300.
- Notes: uses `teal-*` outside the radar files; globals.css:43-48 lists "the live state dot" among the eighteen files allowed, so this is the sanctioned one.

### components/memory/standing-profile.tsx (180 lines)
- For: server component: clinician's standing profile sections with refs, conflicts block above, dated timeline.
- Decides: conflicts amber block above profile (80-104); refs rendered not hidden (134-139); `getI18n()` server translator (62-67).
- Promises: P3/T1 adjacent (dated and cited). Read-only by design (21-24).

### components/money/price-tag.tsx (230 lines)
- For: `PriceTag` (USD figure, hover peek and press to toggle EGP at a server-given rate) and `EgpDisclosure` (C76, therapist absorbs FX on EGP settlement).
- Decides: no rate, no toggle (103-110); first render always USD (45-50); EGP computed with `convert(usdCents, rateMicro)` from props (92).
- Notes: aria-label English ("Show this price in ...", 138-140); `EgpDisclosure` entirely English (213-228). Comment 52-54 says `formatMoney` pins en-US "until 19.4", but `locale` is already a prop here (Stale). Peek `bg-navy-500 text-white`, focus `outline-brand-700`, dotted underline `decoration-slate-400` hover `decoration-brand-600`.

### components/nav/bottom-nav.tsx (294 lines)
- For: clinician portal bottom bar (below lg): Home, Sessions, raised Start (+), Patients, More sheet.
- Decides: MORE = copilot, assistant, notes, connect, on-call (crisis radar), earnings, billing, settings (54-105); hidden on `/room` (122); unverified clinician gets verify/billing/settings only (132-160); sheet closes on navigation (114).
- Notes: tokens: active `text-brand-700`, inactive `text-slate-500`, Start `bg-brand-500 text-navy-600 active:bg-brand-600`, sheet active tile `bg-brand-500 text-navy-600`, labels `text-[10px]`. `isActive` uses `startsWith`, so `/sessions/new` lights Sessions and `/notes` would match `/notes-x`.

### components/notes/provenance-client.tsx (35 lines)
- For: client twin of `PatientNoteOrigin` (same dictionary keys).
- Notes: `Badge tone="teal"` for transcript.

### components/notes/provenance.tsx (132 lines)
- For: `NoteOrigin` badge, `NoteOriginNote` explanation, `PatientNoteOrigin` for the patient: transcript / partial / clinician-written.
- Decides: partial explanation rounds missing minutes up, never 0 (95-101).
- Promises: T2 partly (partial shows off-record minutes in the long form only). P3.
- Notes: comment 32-37 (C213) says "partially recorded without a number is a badge nobody can act on", yet `NoteOrigin` takes `offRecordSeconds` and never uses it, so the list badge is exactly that numberless badge. `PatientNoteOrigin` tells the patient a recorded note came from "their choice" (117-120); for an in-person session recorded without consent (task 123) that sentence is false.

### components/partner/apply-form.tsx (85 lines)
- For: integrator (partner) enquiry: company, contact, email, phone, required "what do you want to build".
- Notes: no headcount asked, by decision (29-31). "Working…" hardcoded.

### components/partner/chrome.tsx (129 lines)
- For: partner portal header, tabs (keys, webhooks, deliveries, usage, docs), sign out, footer `dev.noContent`.
- Decides: no subjects tab ever (19-22); `usePathname() ?? "/partner"` (73).
- Notes: comment 13 "FOUR DESTINATIONS" but five tabs (Stale). Active tab `bg-slate-900 text-white` (not brand), a different nav idiom from `Desk`.

### components/partner/key-list.tsx (202 lines)
- For: partner API keys: list (prefix, scopes, env, sponsor, last used, suspended reason), revoke, mint form; raw key shown once.
- Decides: raw key only from the action's return (14-19, 79-87).
- Assumes: `createKey` reads `sponsorId` from the form (app/(partner)/partner/actions.ts:28), `mintKey` and DB CHECK `partner_api_keys_employment_needs_sponsor` refuse `employment:verify` without one.
- Notes: see Broken: there is no sponsor picker. `sponsors` prop is accepted and never used; comment 70-75 describes a picker that follows a checkbox and 183 a C265 sentence "beside the checkbox"; neither is rendered. Revoke is one tap, no confirm (132-140). "Working…" hardcoded.

### components/partner/sign-in-form.tsx (64 lines)
- For: partner sign-in, no sign-up link (22-24). "Working…" hardcoded.

### components/partner/usage-meter.tsx (219 lines)
- For: partner monthly session limit, used, projection, stop notice, last month's bill, limit form.
- Decides: bar colour red at >=90%, amber >=80%, else brand-500 (104-111); stop notice first (72-84); states "we never bill past it" (188-192).
- Notes: every string is hardcoded English, no `useT` (58-62, 75-81, 90, 121-136, 157, 167, 189-191, 199, 213). Dollar figures formatted by hand with `$` and `toFixed(2)` (157, 160). Progress bar `bg-red-500` at 90% uses red for money, against pending-bar.tsx:121-133's rule.

### components/partner/webhook-list.tsx (145 lines)
- For: partner webhook endpoints: list, disable, add form (url + events), secret shown once.
- Decides: events from `WEBHOOK_EVENTS` (session completed, note approved, grant revoked, record claimed per comment 14-20); https enforced server and DB (106-108).
- Notes: comment 22-26 says "the signing scheme is printed with it"; only the secret and `dev.secretOnce` render (52-58), so the scheme is printed only if that dictionary string carries it. Disable is one tap. `session.completed` to a partner is a session-time signal, fine inside a partner's own flow, see Unclaimed.

### components/pay/pay-flow.tsx (251 lines)
- For: `/pay/[token]` card-rail payment page: pick country, server prices it (session, VAT, total, rate), name and receipt email, redirect to a payment URL.
- Decides: price from `priceFor(token, country)` on the server every time (58-81); `startPayment({token, countryCode, name, email})` (86); the button shows `presentedTotalCents` (238). Static rate shows "indicative" (188-192). Name required, prefilled from `knownName` (50, 230).
- Assumes: `startPayment` recomputes rather than trusting the shown figure; `collectionProblem` refuses rails that cannot collect.
- Promises: E3/price shown = price charged: the shown figure is server-computed; charged figure depends on `startPayment` recomputing the same breakdown (not in slice).
- Notes: hardcoded English "With {name}. You will not be charged until you confirm on the next screen." (108-109) and "VAT" (163), "you@example.com" placeholder. Focus ring `focus:border-brand-600 focus:ring-brand-600/15`.

### components/portal/desk.tsx (251 lines)
- For: the one shell for clinic and sponsor portals ("the desk", Option A): left rail at lg (logo, org name, badge, sections, actions + language switch, NeverBar wall), header with pill row below lg, wall in footer below lg.
- Decides: `usePathname()` null means no router: falls back to `home` and does not render `LanguageSwitch` (120-141); active section `bg-navy-500 text-white` (167-169, 230-232); `shrink-0` pills (213-221).
- Promises: E2/C2 surface: the never-list is on screen at all times (37-47).
- Notes: both `<nav>` elements take `aria-label={never.label}`, so the navigation landmark is announced with the wall's heading ("never shows ...") rather than as navigation (159, 222). Rail `lg:w-60`, content `max-w-5xl`. Every string is a prop (62-67).

### components/public/audience-demos.tsx (96 lines)
- For: server-side wrappers: `CompanyDemo` and `ClinicDemo` (portal-demo consoles in a browser frame), `TherapistSplitDemo` (fee split bar).
- Decides: split demo uses a literal $60 session and 15% fee (82-83), formatted with `Intl` "en-US" (32-37).
- Promises: T3 adjacent. The split says "you keep $51, our fee $9 (15%)" with `tnew.vatOnTop`; it is a per-session split, not a claim that paid sessions cover the fee, and not an earnings forecast.
- Notes: comment 13-16 says `TherapistCard` is imported and 77-78 says "the percentages come from the fixtures"; neither is true in this file (price and 0.15 are literals here; no TherapistCard import) (Stale). If the platform fee changes, this demo keeps saying 15%.

### components/public/audience-hero.tsx (107 lines)
- For: navy hero band for the dedicated audience pages (eyebrow, h1, body, CTA, secondary, demo node).
- Notes: `text-white/85` body (79) by the 76.83 sweep; `<Link><Button>` nests a button in an anchor (82-98), invalid interactive nesting that repeats across public/*. Glow blobs `bg-brand-500/20`, `/15`.

### components/public/audience-page.tsx (254 lines)
- For: shared shape for the four audience pages: `FeatureBands` (alternating white/slate-50 bands, component required), `AlsoIncluded` (ruled list), `CostPanel`, `AudienceClose` (navy band with cross links).
- Decides: a feature gets a band only with a working component (21-32).
- Notes: `nav.notYou` in `text-white/60` on navy (238), below the 4.5 floor the neighbouring comment (audience-hero.tsx:73-78) sets for `white/65`. Comment 14-19 says `/for-patients` tiles "discard the body"; blocks.tsx `Features` now draws `item.body` (575-577) (Stale). Eyebrows `font-mono text-xs uppercase text-brand-700`, h2 `text-navy-500`.

### components/public/audience-rotator.tsx (305 lines)
- For: the homepage hero rotating through four audiences: fixed stem, one moving clause, one body line, a demo per audience; stops for good on any interaction; off-screen and reduced motion stop it.
- Decides: DWELL 6s (54); all four panels mounted, inactive `inert` + `aria-hidden` (287-301); body `aria-live` off until stopped (194).
- Notes: all four demos stay mounted and their own timers (session demo ticker, copilot nudges) keep running behind `inert` (performance, and hidden `aria-live` regions). Comment 42-45 says a screen reader reading the page gets all four headlines; 158-163 and 283-285 hide them (Stale). `role="tab"` buttons without `tabpanel`/`aria-controls`. Labels `text-white/60` (245). Clause `text-brand-300` on navy.

### components/public/blocks.tsx (1003 lines)
- For: the CMS block renderer for every public page: hero, audiences, howItWorks, features, showcase, faq, walkthrough, competitors, vendors, flow, seesWhat, cta, prose, pricing, crisis, companies, contact_form.
- Decides: blocks are data, no `dangerouslySetInnerHTML`; background images re-validated with `safeImageUrl` (32-39, 370, 710). `DemoFor` maps demo names to components (278-324). Radar hero branches to `RadarHero` (343-368). Crisis block: fixed destinations `/radar` and `/for-patients`, words editable (764-806). Companies: both entities always shown, international first (808-914). Pricing block renders `PricingTiers` (181-182).
- Assumes: `getDemoContent(locale)`, `getI18n`/`stringsFor`, `getCountries`.
- Promises: P1 marketing (radar hero), E2 marketing (seesWhat), P5 adjacent (crisis block needs no account).
- Notes: see Broken for `company-wall`. Hero's secondary button always links to `/login` (clinician door) whatever the audience (459-468). `Features` comment 545-556 says `item.body` is not drawn; the code draws it (575-577) (Stale). `<Link><Button>` nesting throughout. Crisis block `rose-*`.

### components/public/comparison.tsx (264 lines)
- For: us-versus-one-competitor tabs with rows that can concede; vendor grid with live/beta/planned status.
- Decides: the tick follows the sentence on conceded rows (122-131); no date, no "checked" line (184-193).
- Notes: vendor status renders the raw English word (250). Conceded tick `text-emerald-600`, ours `text-brand-700`. Tabs active `bg-navy-500 text-white`.

### components/public/contact-form.tsx (276 lines)
- For: public contact form: warning with radar link above the box, email or phone+country, topic, entity (US/EG), message, one attachment; reference shown on success.
- Decides: strings from server as props (40-50); honeypot (157-161); attachment kept like a clinical document, never read by a model (242-247).
- Notes: "Leave this empty" and "you@example.com" literals. Warning `rose-50/200/900`.

### components/public/docs-nav.tsx (76 lines)
- For: docs page left nav with IntersectionObserver highlight; scrolling strip on phone.
- Notes: active `bg-brand-50 text-brand-800`; `aria-current="true"`.

### components/public/how-it-works.tsx (77 lines)
- For: homepage "eight screens, two per person" grid.
- Notes: eyebrow hardcodes "[ 02 ]" (39) so the number is wrong if the CMS moves the block. Audience label alternates `text-navy-500` / `text-slate-600`.

### components/public/icons.tsx (89 lines)
- For: CMS icon allowlist (16 lucide icons) and `ContentIconMark` (brand / navy / light tones).
- Notes: tones `bg-brand-50 text-brand-700`, `bg-navy-50 text-navy-500`, `bg-white/10 text-white`; unknown name falls back to Sparkles.

### components/public/mobile-nav.tsx (143 lines)
- For: public header on phones: hamburger sheet with the four audience links, the radar CTA, and the sign-in doors with one-line explanations.
- Notes: the sheet has NO language switch, and `SiteHeader` hides `LanguageSwitch` below `sm` (site-chrome.tsx:109-113); see Broken. Radar CTA `bg-navy-500 text-white` with `bg-brand-400` live dot. Body scroll lock and Escape handled.

### components/public/pricing-tiers.tsx (579 lines)
- For: the pricing block (homepage compact, `/pricing` full, audience pages via `only`): three tier cards (PAYG, Practice, Clinic with a seat slider), comparison grid, seat ladder, standing promises.
- Decides: every figure from `getSettings()` (104, 136-137, 164-168, 217); EGP from the operator rate `egpRateMicro()` not `quoteFor` (46-71, 105); PAYG card price = `platformFeeCents` (253); seat figures from `seatMonthlyCents` over bands (166-196), the retroactive step computed (207-215); netting sentence only when `settings.payouts.netFeeFromHeldEarnings` (551-558).
- Promises: T3 kept in wording (`pricing.netting`: "While we hold your earnings the session fee comes out of them. Where Stripe pays you directly, we bill you instead.", lib/i18n/messages.ts:193). No sentence found claiming paid sessions cover the fee, and no earnings forecast, in the keys this file renders (checked `pricing.radarBody`, `pricing.netting`, `pricing.noFees`, `pricing.freeBody`, `pr2.body`, `pr2.seatBody`, `pricing.patientPaysNothing`, `pricing.seatsStep`).
- Notes: see Broken for "No seat fee". `pricing.radarBody` (messages.ts:191-192): "we take {percent}% of what that session paid you, and nothing else", while the same page's PAYG card charges a per-session platform fee and an AI fee for that same session (Suspect). `pricing.patientPaysNothing` "Your patient never pays us anything" (431; messages.ts:3800) while on the Egyptian rail the patient's transfer goes into our bank account and VAT is collected by us (Suspect wording). Featured card `border-2 border-brand-600 shadow-brand-500/10`; ticks `text-brand-500` on white (2.17:1, icon only). `<Link><Button>` nesting. `SEAT_MAX = 12` literal.

### components/public/seat-ladder.tsx (137 lines)
- For: seat band table plus a slider indexing server-computed monthly figures (C323, C353).
- Decides: no arithmetic in the client (19-33); slider starts at 3 (72).
- Notes: range `accent-brand-700`. Price shown equals `currentSeatBill` only if both call `seatMonthlyCents` with the same bands (claimed 31-32).

### components/public/seat-slider.tsx (64 lines)
- For: the slider inside the Clinic pricing card; indexes `monthlyByCount`.
- Notes: same rule as the ladder; starts at 3 seats (39-40).

### components/public/sign-in-menu.tsx (130 lines)
- For: header "Sign in" dropdown listing the doors from `lib/auth/doors.ts` (staff and partner deliberately absent, 30-37).
- Notes: `role="menu"` with links as `menuitem` but no arrow-key handling; focus moves to first item on open (68-71). Menu `w-72`, `text-navy-500` labels.

### components/public/site-chrome.tsx (259 lines)
- For: `SiteHeader` (logo, four audience links, language switch at sm+, sign-in menu, radar CTA, mobile nav), `SiteFooter` (audiences, CMS rows minus audience slugs, code pages, legal), `SiteChrome` wrapper for auth pages.
- Decides: radar CTA hardcoded so it cannot be unpublished (116-126); footer de-duplicates `for-patients` (179-187).
- Notes: header `sticky top-0 z-40 bg-white/85 backdrop-blur`, h-16. Footer text `text-xs text-slate-600` throughout.

### components/radar/booking-sheet.tsx (494 lines)
- For: the radar profile and booking sheet (portal into body): 60s hold with renewal, name, optional email, pay-or-start, walk-in address with directions.
- Decides: `reserveForViewing` on open, renewed every 20s, released on close unless submitted (98-119); countdown closes the sheet at 0 (122-136); `bookFromRadar` then redirects to `payUrl` or `joinUrl` (138-141); bookable only when online or reserved by you (86); crisis line is the shared `crisis.notEmergency` (337-350); walk-in block only for a confirmed, published practice (384-397).
- Assumes: RESERVATION_SECONDS = 60 on the server (35); `bookFromRadar` prices server-side.
- Promises: P1 (sheet to session: name, then pay/start), E3 adjacent.
- Notes: the button reads "Pay $X and start now" with `formatUsd(sessionRateCents)` (53-56) and the navy price box shows the same bare figure (306-311); VAT is added on the next screen (pay-flow.tsx:160-178), so the figure on the button is not the figure charged (see Suspect). The profile shows NO demo label although types.ts:63-73 says every card built from `RadarEntry` carries one. Hardcoded English: "Connecting…", "Pay … and start now", "Start now", "Held for you · Ns", "Not listed", "Not shared", "Free", aria "… profile" (53-56, 175, 210-217, 263, 309). Uses `teal-*` (allowed, radar folder): submit `bg-teal-500 text-navy-600`, hold panel teal-50/200/700/800/900, walk-in teal-50/200/300/500/700/900; `h-13` is not a default Tailwind v4 spacing issue (v4 allows it).

### components/radar/feedback-card.tsx (132 lines)
- For: server card showing a clinician their ratings, average, service rating, recent comments, publication threshold.
- Decides: public score only at `RATINGS_VISIBLE_AFTER` ratings (82-87); no names, only relative date (18-28).
- Notes: all prose hardcoded English (55-59, 73, 77, 84-85, 93). Empty-state copy states "your patient rates you to unlock their summary, so almost all of them do" (56): a patient's own session summary is gated behind rating the clinician (see Suspect). Stars `text-amber-500`/`fill-amber-400`.

### components/radar/filters.tsx (270 lines)
- For: radar filter chips (country chip set by the globe, region, language with flag, specialty), counts computed against the other filters.
- Decides: `matches` is the one match rule (22-29); options derived from who is on the radar now (31-42); dark and light tones.
- Notes: tokens light: active `border-teal-500 bg-teal-50 text-teal-800`, count `bg-teal-200 text-teal-900`; dark: `bg-teal-400/20 text-teal-100`, idle `bg-white/5 text-white/85`. Region/language/specialty values render as stored strings (English specialty names on an Arabic page).

### components/radar/globe.tsx (516 lines)
- For: the orthographic SVG globe (Natural Earth 110m, 40 kB) with drift, drag, wheel zoom, tap to filter a country, tap a dot to open a clinician.
- Decides: dot at confirmed practice pin else country centroid with a spiral offset; no country, no dot (81-112); drift only when idle 2.5s, no country selected, not reduced motion (167-174); taps hit-tested on pointerup because pointer capture swallows clicks (267-289); fly-to 620ms (185-214).
- Notes: redraws all ~170 country paths plus graticule EVERY animation frame even when nothing moves and under reduced motion (163-178): constant CPU on the phone the comment says it protects. Colours are hex literals, not tokens: ocean #123a63/#0A2342/#04101f, land #17547a/#14304e, hover #1c6f8c/#1b3a5c, selected #2EC4B6, stroke #5eead4, pending dot #fbbf24, busy #94a3b8. #17547a, #1c6f8c, #123a63 are saturated blues on a public page, which globals.css:82-84 says `.render/no-blue.mjs` fails above 35% saturation (see Suspect). Dot `<title>` and hover readout are English literals ("available now", "being booked", "in a session", "{n} online now, tap to filter", "Nobody here right now") (438, 464-465). No demo label on dots. An empty radar is a dark globe with no dots and no sentence on the globe itself; the "nobody" copy lives in the callers.

### components/radar/orb.tsx (333 lines)
- For: the clinician's floating radar control on every portal page: status dot, go online/off, rate, payouts warning, walk-ins toggle, link to /on-call.
- Decides: tone from suspended / in_session / pending(booked vs viewing) / online / off (96-106); only `booked` pulses (118-126); toggle absent in session and booked (194-215); walk-ins disabled until pin confirmed (253).
- Notes: `fixed end-3 bottom-24 z-50` on mobile, the same corner and bottom offset as the patient `PaymentPopup` orb (`end-3 bottom-24 z-[60]`); different apps, so no overlap between them, but the clinician's own payment popup orb is `minimised="button"` by default, fine. Red for "booked", "session" and "suspended", which pending-bar.tsx:121-133 reserves for crisis. Online button `bg-teal-500 text-navy-600`.

### components/radar/types.ts (80 lines)
- For: `RadarEntry`, the public shape of a radar clinician.
- Decides: only shopfront fields (1-7); `practice` null unless pin confirmed and walk-ins on (20-32); `clinicName` label for clinic-attached (33-50); `demo: boolean` shown on every card (62-73); `reservedByYou` (74-79).
- Promises: C1 adjacent; MAP suspect 2 ("demo is a label never a decision") is a type-level statement here.
- Notes: comment 65 "Every card built from this carries a label"; BookingSheet and Globe do not (checked), therapist-card to confirm.

### components/radar/practice-form.tsx (266 lines)
- For: clinician practice address: geocode search, pick a hit, confirm, walk-ins switch (off by default), save or remove.
- Decides: nothing saved until a hit is chosen and Save pressed (21-28, 84-102); walk-ins forced false without an address (95, 239).
- Notes: a picked hit is labelled `tprac.confirmed` (208-211) before Save is pressed, so the screen says "confirmed" for something not yet stored. Remove has no confirm (104-122). Tokens teal-50/200/600/700/900, `accent-brand-700`.

### components/radar/presence.tsx (786 lines)
- For: portal-wide clinician presence: heartbeat ping (5s live, 60s idle), booking detection, alarm (sound, notification, flashing title), orb, sound prompt, status pill, booking card.
- Decides: one `radarPing` does heartbeat + attention + status (246-275); ring on each change of state, only confirmed bookings repeat (277-339); ring cadence 1.4s waiting / 2.6s paying (53-56, 361-368); mute is per booking, resets on a new one (112-119, 321-323); title flashes while booked, even muted (370-384); sound prompt only when online or forced by a ringing booking (602-615).
- Assumes: server sweep takes a clinician offline ~90s after the last heartbeat (31-38, 264-265); `lib/alarm` owns the AudioContext.
- Promises: none of the 25 directly; P1's "somebody who is free now" depends on this heartbeat being honest.
- Notes: see Broken: the ping returns early whenever `document.visibilityState !== "visible"` (252) in BOTH live and idle modes. Booking card shows the patient's typed name to the clinician (331, 467), fine for the clinician. Title strings "🔴 PATIENT WAITING FOR YOU" / "🔔 Patient joining, open the room" are hardcoded English with emoji (382). `locale` read and unused in `SoundPrompt` and `StatusPill` (566, 713). Waiting card `bg-red-600 text-white`, go-in `bg-white text-red-700`; paying card `bg-navy-500`, open-room `bg-teal-500 text-navy-600`; pill `bg-navy-500/90`, sound-off chip `bg-red-600 hover:bg-red-400` (white on red-400 under 3:1 on hover).

### components/radar/public-profile.tsx (250 lines)
- For: a clinician's shareable public page body: name, credentials, rating, live availability line (5s poll), headline, bio, languages, specialties, place, walk-ins, price, start button, copy link, booking sheet.
- Decides: renders offline and says so (18-30); unknown status falls to "Not on shift" rather than crashing (191-216); start only when online (60, 140).
- Notes: no demo label rendered although `ProfileEntry` carries `demo` (types.ts:63-73). Price shown as `$${(cents/100).toFixed(0)}` (134): whole dollars, rounded, no VAT, not `formatUsd`/`PriceTag`. Hardcoded English throughout: "from N rated sessions", "Free", "Start a session now", "Not on shift right now", "With someone else right now", the leave-open sentence, "Link copied", "Copy this page's link", every availability label, "Practice" (88, 125, 134, 150-159, 169, 209-214).

### components/radar/public-radar.tsx (180 lines)
- For: the older full radar board (globe in a card, filters, grid of cards, booking sheet), 4s poll.
- Decides: online count is always unfiltered (87-89); globe gets the FILTERED list (99).
- Notes: hardcoded English "N therapists available now", "No one on the radar this minute", "Drag to spin · tap a country", "Showing X of Y", "N other clinicians are available right now" (116-121, 130, 146-147); the last says "0 other clinicians are available" when everybody is pending or in session. Ground `bg-[#04101f]` hex literal.

### components/radar/radar-console.tsx (410 lines)
- For: the radar "as a room": full-bleed globe or list view, left filter panel, right who-is-free panel, mobile bottom sheet with tabs, booking sheet; `RadarSafetyLine`.
- Decides: map is the default view (68-76); right panel only in map view (266-282); mobile sheet offers filters only in list view (296-301); 4s poll (54-97).
- Notes: see Broken for collapsed panels. `Panel` uses physical `left-4`/`right-4` (364-365) while the list view pads with logical `sm:ps-[20.5rem]` (168): in Arabic the filter panel stays on the physical left and the list padding moves to the right, so the panel covers the list. Hex grounds `#04101f`, `#071a2e`. Status chip text `text-white/85` fine; refresh spinner `text-white/30`.

### components/radar/radar-hero.tsx (293 lines)
- For: homepage hero where the globe is the background, with a live booking board (filters + dark cards), CTA to clinician signup and to full radar.
- Decides: client fetch every 4s because marketing pages are ISR-cached for an hour (46-48); strings from the server (78-88).
- Notes: English fallbacks "Crisis Radar", "Talk to a real therapist in the next sixty seconds", and "Every dot is a licensed clinician who is online this minute ... No account" (185, 189, 194) used when the CMS row lacks them; "every dot is a licensed clinician" is untrue while demo accounts and pending/in-session dots are drawn. Globe placed with physical `left-1/2 translate-x-[-28%]` (148, 151), so in Arabic the globe stays left while the text column moves to the right edge and the card column to the left, over the globe. `fromPrice` cheapest price excludes VAT (204-209). Primary CTA `bg-white text-navy-600` goes to `/signup` (clinician), the patient path is the board.

### components/radar/radar-list.tsx (165 lines)
- For: list view of the radar: avatar, name, status, credentials/city/country, every language, next open time, rating, price per 30 min.
- Decides: next open formatted in the reader's zone after mount (116-133); no rating below the bar (145-148).
- Notes: no demo label on rows. Low-contrast greys on navy: `text-white/30` (112, 147), `text-white/35` (118, 131) for "no languages", "no hours", "no rating", column labels: grey-thin text at about 1.9:1 to 2.2:1.

### components/radar/session-history.tsx (245 lines)
- For: clinician's radar session history: patient link, date, modality, copilot count, access state note, paid split (price, VAT, fee, received), their own bill.
- Decides: historical figures, not recomputed (38-43); access notes for gated/revoked/unclaimed/no record (45-60).
- Promises: T3 partly: shows fee and net per session and the clinician's own bill separately (227-239); does not show the bill netted out of the payment.

### components/radar/therapist-card.tsx (250 lines)
- For: `TherapistCard` (radar row, light/dark), `Avatar` (plain img, no-referrer), `StatusPill` (available / being booked / in session / held for you).
- Decides: walk-ins chip first, clinic label, DEMO label `radar.demoAccount` (118-134), two specialties plus count.
- Promises: MAP suspect 2: here `demo` is only a label (125-134), never a filter or ordering decision in this file.
- Notes: credentials fallback `radar.licensed` "Licensed clinician" (79) is printed for any entry without credentials, including a demo account. Rating `title` English (67). Tokens light: teal-100/800 available, amber-100/800 booked, slate-200/600 in session, brand-100/800 held-for-you; dark: `-400/20` fills with `-200/300` text. `text-[10px]` chips.

### components/radar/therapist-console.tsx (658 lines)
- For: the clinician's `/on-call` console: on-call switch over a `WorldRadar` with their own dot, rate and "you keep", payout-held note, country closed note, sound arming modal, alert toggles, radar profile form.
- Decides: unknown status counts as OFF (77-90); going online asks for sound once, and goes online even if sound fails (115-132, 295-307); alert preferences save on toggle (533-539).
- Notes: see Broken for "You keep" (221-223). `PING_MS` (30-31) is declared and never used; the comment at 95-100 says the poll lives in `RadarPresence` (dead constant). `WorldRadar` puts a clinician with no country in the mid-Atlantic (see world-radar), but this console only draws the dot when `props.country` is set (161). Tokens: switch `bg-teal-500 text-navy-600`, error `bg-red-500/15 text-red-200`, held `bg-amber-400/15 text-amber-200`, "you keep" `text-teal-300`.

### components/radar/therapist-page.tsx (144 lines)
- For: server body of `/t/:id` and `/patient/t/:id`: `PublicProfile`, verification line (regulator + month), reliability line, price with EGP toggle, booking calendar.
- Decides: operator EGP rate not `quoteFor` (31-42); verified month and year only (51-63); reliability hidden below five sessions (101-117); licence number never shown (84-86).
- Notes: see Broken: the same `sessionRateCents` is labelled `radar.oneHour` "One hour" here (128) and `radar.thirtyMinutes` "30 minutes, starting now" by `PublicProfile` a few lines above on the same page. "Turned up to X% of N booked sessions." and "Free" are English literals (113-114, 139).

### components/radar/world-radar.tsx (157 lines)
- For: the FLAT dot-matrix world with a sweeping beam, one dot per clinician at country level; used by the therapist console and the patient-app marketing mockup.
- Decides: country-level placement with golden-angle fan-out (62-82); `scale` multiplies radii only (44-58); sweep stops under reduced motion (123).
- Notes: a dot with no or unknown country is drawn at `countryPoint(null)` = `project(-30, 20)` (lib/geo.ts:202-205), the middle of the Atlantic, which globe.tsx:86-87 explicitly refuses ("a dot in the Atlantic is a claim about where someone is"). aria-label English ("N clinicians on the radar", 88). Hex literals #0A2342, #2EC4B6, #F59E0B, #64748B. Flat WorldRadar (demo, therapist console) vs orthographic Globe (public radar, hero, console): two different pictures of the same radar; `patient-app.tsx:521-525` chose the flat one for the marketing phone while the real patient app opens on the Globe.

### components/sessions/status-badge.tsx (52 lines)
- For: server `SessionBadge` (live / not started / cancelled / completed / writing / note failed / note ready) and `NoteBadge` (draft / summary held / approved).
- Promises: T1 ("draft" until signed, `NoteBadge` 48), P3 adjacent (`summaryHeld` when the patient still has nothing, 50).
- Notes: a live session is `tone="red"` (26), spending red on "live" (pending-bar.tsx:121-133 reserves red for crisis). `summaryHeld` uses `tone="teal"`.

### components/settings/meeting-accounts.tsx (156 lines)
- For: connect/disconnect Zoom/Meet/Teams-style meeting accounts for the recording bot (OAuth link, no key field).
- Decides: unavailable without `features.meetingBots` (56-73); each provider's may-be-blocked reason shown before connecting (99-109).
- Notes: nothing here says anything about consent from the other people in an external meeting; `portal.meet.neverCalendar` is about calendar access (141-147). See Unclaimed. Connect `bg-slate-900 text-white`.

### components/settings/payouts.tsx (527 lines)
- For: clinician payouts and pricing: identity + practice region (US or EG) at the top, Stripe flow strip or the EG manual payout method, rate with currency, split bar, auto-settle-from-earnings checkbox.
- Decides: EG region hides every Stripe control (238-266, 316); unsaved-region warning (176-185); split computed from `state.feeBps` (119-121); `autoSettle` checkbox shows amount owed now (480-498).
- Promises: T3: netting here is an opt-in per clinician (`autoSettleFromEarnings`, 484), so "what you owe comes out of what you earn" holds only when this box is ticked (and pricing-tiers.tsx:556 shows the netting sentence only when `netFeeFromHeldEarnings` is on). Partly kept.
- Notes: see Broken: split bar formats keep and fee with `formatUsd` even when the rate currency is EGP (469-471). Rate input prefix "E£"/"$" and placeholder "60" literals.

### components/settings/section.tsx (74 lines)
- For: `SettingsSection` (heading, why, anchor) and `SettingsNav` jump chips.
- Notes: headings `text-sm font-bold uppercase`, why `text-slate-500`.

### components/settings/settings-forms.tsx (162 lines)
- For: `ProfileForm` (name, credentials, licence type/state/number) and `PasswordForm` (+ sign out).
- Notes: licence number is editable here by the clinician after verification; whether a change re-triggers verification is server-side (see Suspect).

### components/settings/timezone-settings.tsx (134 lines)
- For: clinician time zone select with "time now in that zone".
- Notes: `useState(initial ?? detected ?? "UTC")` (42) runs once, when `detected` is still null (hook returns null until mounted), so a clinician with no saved zone sees UTC selected while the text beside it names their detected zone as the suggestion (115-117); pressing Save stores UTC. Comment 29-38 says "the suggestion simply appears", it appears only in the sentence.

### components/settings/wall-codes.tsx (139 lines)
- For: clinician wall (poster) codes: create with a label, list with server-rendered QR SVG, revoke by form.
- Notes: renders `entry.svg` with `dangerouslySetInnerHTML` (89-93); safe only if the SVG is generated server-side from the URL and never includes the free-text label (not in slice).

### components/simulation-banner.tsx (81 lines)
- For: violet strip on every page when on the simulation branch or when `SIMULATION_RUNNING` is set on production, naming the database endpoint.
- Decides: endpoint read back out of `env.databaseUrl` (60-70).
- Notes: prints the Neon endpoint id (not a secret per its comment 26-29; no credential visible). English literal "Simulation. Everybody here is invented." (77). `bg-violet-700 text-white`, a third hue outside navy/teal.

### components/sponsor/apply-form.tsx (101 lines)
- For: corporate/university enquiry (org, kind, contact, email, phone, best time).
- Notes: "Working…" hardcoded. Purchasing language only (30-34).

### components/sponsor/chrome.tsx (108 lines)
- For: sponsor portal chrome on `Desk`: overview, people, code, pot, domains, integrations, settings; never-bar (individual, attendance, clinical).
- Decides: viewer role gets a badge; the badge text is `t("sponsor.nav.overview")` (80), i.e. the word "Overview", not a "read only" label: a viewer's badge says nothing about being read-only.
- Notes: comment 11 "Five destinations" but seven tabs (Stale). Comment 14-16 says `lib/data/sponsors.ts` select has "no therapist", matching portal-demo.tsx:624-628 and contradicting the demo's per-therapist spend column.

### components/sponsor/code-card.tsx (116 lines)
- For: printable joining code poster (server QR data URI), failed-attempt count and spike note, rotate with confirm.
- Decides: counts only, no attempt list (35-42); rotate needs a second tap and does not unenrol (17-20).
- Promises: E1/E2 (no individual data in props). Rotate confirm `bg-red-600 text-white`.

### components/sponsor/confirm-domain.tsx (62 lines)
- For: mailbox half of domain proof, confirmed by a button press (not GET) (8-15).
- Notes: all copy hardcoded English (23-27, 35-38, 42-44, 58). The mailbox recipient is told "set up mental health cover for your people" (35), while code-card.tsx:12-16 rules every poster word must be a benefit word; this is an admin mailbox, so lower risk.

### components/sponsor/coverage-form.tsx (207 lines)
- For: sponsor coverage percentage in 5% steps, locked until Edit, "covers about N sessions" at the average price, pending reduction with its date, 0% is not removal.
- Decides: raise now, lower after `noticeDays` (160-165); booked sessions keep their percentage (74-79); 0% keeps people on the list (166-170).
- Promises: E3 (stated, 76-77, 163-164), E4 (stated, 166-170). Kept in wording; enforcement is in `setCoveragePercent`.
- Notes: all copy hardcoded English (60-65, 76-77, 92-94, 120-133, 146, 156, 161-174, 204). "covers about N sessions" divides by `sessionPriceUsd * draft/100` from settings' average, a projection of pot use, not of anybody's earnings. No "covered per year" or "cap per session" control exists here, though the marketing console shows both (portal-demo.tsx:756-760).

### components/sponsor/domain-list.tsx (190 lines)
- For: sponsor domains with two proofs (mailbox, DNS TXT), check-now, add domain.
- Notes: all copy hardcoded English. Check-now shows "Found it. This half is proved." whenever `checkDnsRecord` returns no `error` (125), regardless of any ok flag; correct only if the action always sets `error` on a miss (Suspect). `byAgreement` domains skip both proofs.

### components/sponsor/gate-settings.tsx (182 lines)
- For: what an employee must present to enrol (domain email or staff-number shape, max two), public listing toggle.
- Decides: only two identifier kinds, DB CHECK (24-31); weak-gate warning above the choice (32-38); shape hint cannot contain four digits or `@` (40-45, DB).
- Notes: the pattern field and the hint field both use label `sponsor.shapeHint` (142, 147), so two inputs carry the same label. "Working…" hardcoded. Drop gate is one tap, no confirm (106).

### components/sponsor/integrations.tsx (386 lines)
- For: HR employment-verification connection: never-sync sentence before the switch, system pick, on/off (off revokes keys), live indicator by last success, steps with an API snippet and a mint-once key, keys list, failed-attempt count, delivery log.
- Decides: live only after a successful call (83-84); failed attempts as a count only (309-326); delivery log has no names (379-380).
- Promises: E1/E2 surface.
- Notes: the delivery log lists each verification call with its time (357-373). One call happens when an employee enrols, so the log is a timestamped list of enrolment events; with a small staff and the roster's "last checked" date beside it, that is "when" for a named person (see Suspect). Snippet hardcodes host `https://24therapy.app` and a 2026-09-14 date (220-228).

### components/sponsor/roster-list.tsx (138 lines)
- For: sponsor roster: name, paused label, last-checked date, remove with a reason.
- Decides: four-column select, ordered by name, no join date (14-30); removal says funding ends and record does not (32-38).
- Promises: E1 partly: the roster shows NAMES of enrolled people (81) with a `lastChecked` date (88-90). E1 forbids who USED it; enrolment is not use, so kept as written, but the last-checked date is a per-person date (see Suspect with integrations).

### components/sponsor/sign-in-form.tsx (65 lines)
- For: sponsor sign-in, no sign-up link. "Working…" hardcoded.

### components/sponsor/spend-heatmap.tsx (105 lines)
- For: a year of weekly spend as five-step shaded cells; suppressed weeks hatched and labelled differently from zero.
- Decides: `null` suppressed vs `0` empty (8-19, 44-45); five steps not continuous (67-79); no session count prop (21-25).
- Promises: E1 kept here (spend only, suppression visible); the "published every five sessions" balance rule is upstream.
- Notes: cells are `div`s with `title`/`aria-label` only, not focusable; hatch uses hex literals. Shades slate-100, brand-100/200/400/600.

### components/sponsor/top-up-form.tsx (82 lines)
- For: card-rail pot top-up: free-text amount, refund terms and expiry above the button (C233).
- Notes: comment 29 names `EgpSettlement`; the component is `EgpDisclosure` in components/money/price-tag.tsx (Stale). Free-text amount field, the thing top-up-stepper.tsx:27-31 calls dangerous on the transfer rail (here only the card rail). "Working…" hardcoded.

### components/support/therapist-support.tsx (155 lines)
- For: clinician support ticket: topic, optional payout, optional session, message; list of own tickets.
- Notes: comment 17-19 lists topics "billing, payouts, a session, verification, the app"; `TOPICS` has billing, a_session, account, something_else (Stale). Ticket `row.status` printed as the raw enum (146), the defect the comment 22-23 says was fixed for topics.

### components/support/ticket-reader.tsx (86 lines)
- For: `/support/[token]` reader: six-digit code then the ticket and its events; same error for unknown token and wrong code (15-18).
- Notes: English literals "Checking…", "Read the reply", "Reference", "Our reply", "Update", "Your six-digit code" (24, 37, 47, 67).

### components/ui/index.tsx (235 lines)
- For: the base primitives: Button, Card, Field, Input, Textarea, Badge, EmptyState, PageHeader, Spinner (full list in Design system inventory).
- Decides: primary `bg-brand-500 text-navy-600 hover:bg-brand-400 active:bg-brand-600` (37-43); danger white on red-600 (34-35).
- Notes: `Badge tone="teal"` maps to `bg-brand-50 text-brand-700` (164), so "teal" is a brand alias here and teal-* is not used. Spinner aria-label "Loading" English (228). `h-13` custom size in `lg`.

### components/ui/money.tsx (133 lines)
- For: `Money`: a USD figure that reveals EGP on hover (450ms), focus or tap, fetched from the server `egpFor`.
- Decides: no conversion until asked; server formats pounds (24-40); non-USD currency shows no reveal (44-57).
- Notes: every USD figure becomes `role="button"` with `tabIndex=0` (117-118), so a ledger of forty prices is forty tab stops; the popup is `role="status"` (125), one live region per figure (H8). Uses physical `left-1/2 -translate-x-1/2` (126). Two EGP mechanisms coexist: `Money` asks the server; `PriceTag` (components/money/price-tag.tsx:92) computes pounds in the browser with `convert()` from a server rate, which is what this file's comment 30-36 says a browser must never do. The pounds sit behind an interaction, which visual/primitives.tsx:23-30 (65.23, "nothing hides behind an interaction") forbids for things a payer should see.

### components/visual/primitives.tsx (456 lines)
- For: the "visual vocabulary": StateBanner, FlowStrip, SeesWhat, Meter, Checklist, BeforeAfter, NeverBar, SplitBar, IconGrid.
- Decides: no accent prop, no collapse, logical properties (6-38); SplitBar widths are the real values, no minimum (370-393); Meter clamps 0..1 and turns amber at 75%, red at 90% (206-207).
- Notes: header says "Six primitives" (9); the file exports nine (Stale). `Meter` red at 90% is used for a pot's spent fraction (portal-demo.tsx:667), red for money. `NeverBar` and `SeesWhat` crosses `text-red-500`.

<!-- FILES-END -->

## Design system inventory (slice-specific)

<!-- DS-END -->

## Stale

<!-- STALE-END -->

## Suspect

<!-- SUSPECT-END -->

## Broken

- components/billing/top-up-stepper.tsx:56,62-67. The stepper starts at index 0 (the floor) on every mount and, 700ms later, calls `onChoose(floor)`, which `openPotPayment` saves as the company's open payment (app/(sponsor)/sponsor/pot/page.tsx:211-212; no initial-index prop exists, grep of callers). The comment at 44-48 says the point of `onChoose` is that a finance officer who picked $1,500 and came back tomorrow does not find it reset to the floor; that is exactly what happens, and the saved $1,500 is overwritten with the floor as soon as the sheet renders. If they then submit proof without re-stepping, the hidden `amount` (pay-by-transfer.tsx:404) is the floor while their bank sent $1,500: an operator sees an overpayment (A4 path) for a company that did everything right.
- components/billing/earnings.tsx:187. "Payout dashboard" button renders `text-white` on the `bg-brand-500` card (via `bg-navy-600/10`): white on teal, about 2.2:1, the combination app/globals.css:56-67 says is banned and verified. verify-palette misses it because it matches ground and `text-white` on the SAME line only (scripts/verify-palette.ts:232-235); here the teal ground is on the parent at line 115.
- components/billing/seat-manager.tsx:96-98. Removing seats reads "N seats costs $X a month, up from $Y" with X < Y.

- components/clinic/team.tsx:161-191. With one role, the "add role" form is already mounted. Pressing Edit sets `editing`; only the name Input is keyed (170), so it resets, but the capability checkboxes are uncontrolled `defaultChecked` inside the same mounted form and do NOT update. The admin sees the role's name with every box unticked (or the previous role's ticks); saving then posts an empty or wrong capability set and `saveRole` replaces the role's capabilities with it. With two roles the form mounts fresh on Edit and is correct, so the defect shows only in the 0/1 role state.
- C2 contradiction, by design: components/clinic/join-form.tsx:56 (`clinic.join.sees.names`) and chrome.tsx:20-21 state the practice sees patient names on the schedule; app/(clinic)/clinic/page.tsx:201 renders `row.patientName`. Promise C2 says "Nowhere in the clinic portal ... a patient name, on any screen". One of the two is false; the code shows names.

- components/partner/key-list.tsx:151-192. The mint form posts label, environment and scopes only; there is no `sponsorId` field, although `createKey` reads one (app/(partner)/partner/actions.ts:28) and `mintKey` plus the DB CHECK refuse `employment:verify` without it (actions.ts:36-38). A partner ticking `employment:verify` always gets a refusal and has no control that could satisfy it; the `sponsors` prop (64) is passed and unused, and the comments at 70-75 and 183 describe a picker that is not there. The employment-verification key cannot be minted from the portal.

- components/public/blocks.tsx:319. `DemoFor` maps the CMS demo name `company-wall` to `<CompanyDemo initial="people" />`, but `CompanyConsole` has no "people" tab (components/demo/portal-demo.tsx:513-539 renders only overview/pot/code/settings). Any block using `company-wall` draws a company console with no tab lit and an empty content pane.

- components/public/pricing-tiers.tsx:539 renders `pricing.noFees` = "Joining is free. No seat fee, no setup fee, no minimum." (lib/i18n/messages.ts:187-188; Arabic 4037-4038), and the compact variant renders `pricing.freeBody` = "No seat fee, no setup fee, no minimum ..." (messages.ts:170; rendered at 384). The same component, a few hundred pixels up, prices the Clinic tier per seat (`pr2.seatFrom`, seat ladder, `pricing.seatsStep`). This is H27's exact shape ("no subscription" false the hour a plan shipped), with "seat fee" instead of "subscription", on the pricing page itself.
- components/public/mobile-nav.tsx:99-137 with components/public/site-chrome.tsx:109-113. Below 640px the header hides `LanguageSwitch` and the mobile sheet does not contain one; no public layout renders `LanguageCorner` (grep of app/: only room, partner, patient, app, admin, pay). A visitor on a phone, the launch market's commonest width, has no control on the public site to change language.

- components/radar/presence.tsx:249-275. The heartbeat `tick` returns immediately when the tab is not visible, in live mode as well as idle (the comment at 41-43 describes the skip for the idle case only). An online clinician who switches to another tab stops heartbeating, and the server sweep takes them off the radar about ninety seconds later (the failure the header at 28-38 says this component exists to prevent). The same skipped ping is the only thing that detects a booking, so the background-tab notification that `notify` (206-214) is written for ("a clinician with the portal open behind their email client is exactly the person who needs telling") can never be triggered by a new booking while the tab is hidden.
- components/radar/therapist-console.tsx:221-223. "You keep" is computed in the browser as `rate - floor(rate * 1000 / 10000)`, a hardcoded 10% fee. The platform fee is a setting whose shipped default is 1500 bps, 15% (lib/settings/defs.ts:562) (`settings.session.platformFeeBps`, rendered as the cut on components/public/pricing-tiers.tsx:217 and hardcoded as 15% in components/public/audience-demos.tsx:83). The one screen where a clinician decides to go on call states a take-home figure computed at a rate that is not the configured one, and before VAT/netting.
- components/radar/therapist-page.tsx:128 with components/radar/public-profile.tsx:131-135. One price, two durations on one page: "30 minutes, starting now $X" in the profile card and "One hour $X" in the price row under it (lib/i18n/messages.ts:1156, 1158).
- components/radar/radar-console.tsx:360-366. A `Panel` is `absolute` with both `top-16` and `bottom-3`, so collapsing it (children removed at 393-395) leaves a full-height translucent box with only a header; the globe space the comment at 38-43 promises by collapsing is not freed.
- components/radar/world-radar.tsx:71 with lib/geo.ts:204. A clinician with no country is drawn in the mid-Atlantic (-30, 20).

- components/settings/payouts.tsx:469-471. With the rate currency set to EGP (432-441), the split bar labels "You keep" and the fee with `formatUsd`, so a 1,500 EGP rate reads "You keep $1,275, fee $225": a pound amount printed as dollars on the screen where the clinician decides whether the price is fair.

<!-- BROKEN-END -->

## Looks broken, is handled

<!-- HANDLED-END -->

## Unclaimed

<!-- UNCLAIMED-END -->

## Promise evidence

<!-- PROMISE-END -->

## Coverage

<!-- COVERAGE-END -->
