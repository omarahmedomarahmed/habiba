# DOCS digest

Reader: documents only. Sources read in full: docs/VALUE-STATEMENTS.md, FINANCIAL-PLAN.md (527 lines), INVENTORY.md (1531), BRAND.md (69), LOGO-BRIEF.md (206), EMAIL-DNS.md (125), DAILY-HOSTS.md (129), content-backup/README.md; both content-backup JSONs skimmed for structure and claims. Today is 2026-09-22.

---

## 1. FINANCIAL-PLAN

Frame: $20,000 of capital, Egypt, six-month beta, cohort model (`npm run plan`, `/admin/financial-model`). Claimed label split: **2 MEASURED, 20 DECIDED, 12 GUESS** (held by `PROVENANCE` in `lib/finance/plans.ts`, counted by `verify:plan`).

### Every number, with label

**Currency**
- 50 EGP = $1. GUESS (ran 47 to 52 in 2025; operator setting on `/admin/settings`, "edited daily").

**One session**
- Patient pays therapist 1,000 EGP / $20. DECIDED ("founders' benchmark", flagged as top of the Cairo range, not the middle). Called the most load-bearing number.
- Our cut, paid sessions only: 15% = 150 EGP / $3. DECIDED.
- Room fee, every session (paid, free, radar, invite, in person): 50 EGP / $1. DECIDED.
- Note fee, where patient consented: 150 EGP / $3. DECIDED.
- Consent-to-record rate: 70%. GUESS.
- Metered therapist pays $4/session ($1 if consent declined). Subscriber pays neither metered fee; 15% cut still taken (the "sprint 75 settlement").

**Plans**
- Solo unlimited: 4,000 EGP / $80 per month. DECIDED ("exactly 20 metered sessions").
- Solo metered: 200 EGP / $4 per session. DECIDED.
- Clinic seat: 3,600 EGP / $72 per month, minimum two seats. DECIDED ("ten per cent under solo").
- Company or university: $0 subscription; funds a pot; we take the cut. DECIDED.
- Price history: was $100 until sprint 75 (break-even 25 sessions).
- Cost per 50-minute session ~$0.62 (AI plus video). Flat-plan loss thresholds: $100 loses past 162, $80 past 130, $60 past 97. Heavy full-time load ~120 sessions/month (6/day x 5 days).

**Customer behaviour (all GUESS)**
- Company (1,000 staff): 1 clinician, 20 patients, 1.5 sessions each, 30 sessions/month, 3-month ramp. Assumes 5% enrol, 40% of those active monthly.
- Clinic: 2.5 clinicians, 10 patients each, 2.5 sessions each, 62/month, 3-month ramp. `verify:plan` holds clinic average between 2 and 3 clinicians.
- Solo: 1 clinician, 8 patients, 2.5 sessions, 20/month, 2-month ramp.

**Acquisition target (DECIDED, "not a forecast")**: 7 companies, 9 clinics, 14 therapists in three months; 3.3 accounts/month per seller x 3 sellers.

**Offer (DECIDED)**: month 1 free, months 2 and 3 at 50%, month 4 on full price, read off each customer's own age. Joiners after month 3: one free month then full. No grandfathering, no second offer. Companies/universities: $100 welcome pot credit (was $200, halved deliberately); true cost $85 (fee returns). At 10% coverage $100 = ~50 sponsored sessions; at 100% = 5.

**Churn (all GUESS)**: while discounted / cliff month / steady after. Company 0% / 33% / 3%. Clinic 2% / 25% / 4%. Solo 3% / 40% / 6%.
Churn sensitivity: x0.3 cash M6 $7,279; x1 $7,526; x1.4 $7,668, all break even month 5. More churn is slightly better (cancelled clinicians slide onto metered).

**Team (DECIDED)**: founder product/eng $500, founder clinical/ops $500, sales companies $500, sales clinics $500, founder selling full time $0 (already paid), marketing $500, support (transfer queue) $500, support (transfer queue) $500. Total $3,500/month from month 1. Contractors; formal contracts would add 15 to 20%.

**Marketing**: three videos 30,000 EGP / $600 one-off month 1 (GUESS, 10,000 EGP each); ads Meta and TikTok 30,000 EGP / $600 per month (DECIDED); three influencer therapists 20,000 EGP / $400 per month (DECIDED). "$1,000 a month total".

**Other**: hosting $120/month, tools/accounting/insurance $150/month, formation and legal $1,200 one-off month 1.

**MEASURED (the only two)**: AI fixed per session $0.01317; AI per audio minute $0.00407 (live OpenAI API, 2026-09-14, $0.37 of spend, `evals/physics.json`). Derived: 50-minute session AI $0.2167.

**Unknowables printed by `npm run plan`**: willingness to pay 4,000 EGP; cliff churn (assumed 40% solo); call-centre enrolment (5%, then 40% active); card/wallet processing cost (assumed 3%); company renewal after credit (assumed two in three).

### The six-month tables (reported)

| M | Co | Clinics | Ther | Clinicians | Patients | Sessions | Subs | Given away | Cut+room | Note | Revenue | Out | Net | Cash |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3.0 | 2.0 | 3.0 | 11 | 49 | 102 | 0 | 600 | 305 | 0 | 305 | 6,952 | -6,647 | 13,353 |
| 2 | 5.0 | 5.0 | 7.9 | 25 | 154 | 332 | 293 | 1,233 | 997 | 0 | 1,290 | 5,365 | -4,075 | 9,278 |
| 3 | 7.0 | 8.9 | 13.7 | 43 | 316 | 689 | 744 | 1,944 | 2,068 | 0 | 2,812 | 5,825 | -3,013 | 6,265 |
| 4 | 8.9 | 11.7 | 19.2 | 57 | 476 | 1,052 | 1,409 | 2,053 | 3,235 | 166 | 4,810 | 6,299 | -1,489 | 4,776 |
| 5 | 10.7 | 14.3 | 24.2 | 71 | 627 | 1,392 | 2,175 | 1,592 | 4,437 | 549 | 7,161 | 6,747 | +414 | 5,189 |
| 6 | 12.4 | 16.7 | 28.8 | 83 | 757 | 1,685 | 2,940 | 1,020 | 5,532 | 1,002 | 9,474 | 7,137 | +2,337 | 7,526 |

Money-out columns (AI/Video/Cards/Credit/People/Marketing/Other): M1 15/41/71/255/3,500/1,600/1,470; M2 50/133/241/170/3,500/1,000/270; M3 105/276/505/170; M4 160/421/779/170; M5 211/557/1,040/170; M6 256/674/1,268/170 (People 3,500, Marketing 1,000, Other 270 from M2).
Gross margin: -25%, 54%, 62%, 68%, 72%, 75%. Burn starts $6,647. Break-even month 5. Six-month revenue $25,852, spend $38,325, end cash $7,526. M6 run rate $9,474 = $113,688 ARR. CAC $200/account over six months (was $220 in the deleted three-month scenario), $188 over eighteen. LTV example: clinic $144/month x 24 = $3,456. "Above 3:1 is the usual bar... clears it comfortably, on assumed churn."
Month 18: revenue $24,816/month, cash $119,292, 29 companies, 39 clinics, 66 therapists, 193 clinicians, 4,342 sessions/month. At M18: OpenAI $659, Daily video $1,737, card/wallet $3,273 per month.
Session-price sensitivity (break-even, M6 cash): $10 M6 $1,224; $15 M6 $4,375; $20 M5 $7,526; $25 M5 $10,678.
Angel pitch at M6: $9,474/month revenue, 75% GM, two positive months, $7,526 banked, "58 accounts of which 45 pay a subscription", measured unit cost. Growth: "40 to 80% month on month early, about 6% by month 18".

### Arithmetic I checked

Holds: fee conversions (50/150/200/3,600/4,000 EGP at 50:1); 80/4 = 20; 72 = 0.9 x 80; AI 0.01317 + 50 x 0.00407 = 0.2167; 15 sessions: 300 - 45 - 80 = 175, screen 255; $100 credit = 50 / 5 sessions; 85% of 100; company 1,000 x 5% x 40% = 20 patients x 1.5 = 30; clinic 2.5 x 10 x 2.5 = 62.5; payroll 7 x 500 = 3,500; every revenue row (subs + cut + note); every net row (revenue - out); cash chain (within $1 rounding: M5 computes 5,190, M6 7,527); six-month totals 25,852 / 38,325; ARR 9,474 x 12; gross margins M1 and M6 (COGS = AI + video + cards + credit); credit line ($255 = 3 x 85, $170 = 2 x 85); marketing $6,600 = 1,600 + 5 x 1,000; other $1,470 = 1,200 + 270; M18 clinicians 29 + 97.5 + 66 = 192.5; video per session ~$0.40 so $0.62 total holds.

Does not add up, or is loosely stated:
1. **"$7,526 is about six weeks of payroll."** Payroll is $3,500/month, so $7,526 is ~9.3 weeks of payroll (or ~4.6 weeks of total M6 spend of $7,137). Neither is six weeks.
2. **"Halving the session price... leaves the company with five days of payroll."** $1,224 against $3,500/month payroll is ~10.5 days. "Costs six months of buffer" is also garbled: the difference is ~$6,300 of cash, not six months.
3. **The $80 break-even of "exactly 20 sessions" ignores the doc's own 70% consent guess.** Expected metered bill is 0.7 x $4 + 0.3 x $1 = $3.10/session (the doc uses exactly this to get "25 metered sessions bill about $77"). So the real solo break-even is ~25.8 sessions, and a "typical" 20-session therapist pays ~$62 metered vs $80 subscribed: the same flaw the doc says killed the $100 price.
4. **Loss thresholds are ceilings, not rounded:** 100/0.62 = 161.3 (doc 162), 80/0.62 = 129.0 (doc 130). Fine but inconsistent with "past".
5. **"$1,000 a month total... covering production, cast, ads and sponsorships"** while the $600 video production sits outside it (M1 marketing $1,600).
6. **Cards line vs no gateway.** The plan models a 3% card/wallet cost that reaches $3,273/month at M18 (13% of revenue), while Part 6 and the team section say there is no card gateway in Egypt and every payment is a checked bank transfer. The cost line models a rail that does not exist; the 3% base is not reproducible from sessions x $20 (M1: 3% of 102 x $20 = $61, table $71).
7. **"58 accounts of which 45 pay a subscription."** 12.4 + 16.7 + 28.8 = 57.9 and clinics + therapists = 45.5, but by M6 the first cohorts have hit the cliff and some have slid to metered, so "45 pay a subscription" overcounts unless churned-to-metered accounts were removed (the doc says they are not removed in the six-month window).
8. **Growth "40 to 80% month on month early"**: accounts go 8 to 17.9 (+124%) to 29.6 (+65%); revenue grows 323% then 118%. The quoted band understates month 2.
9. Team table lists "Support, the transfer queue" twice (two hires, identical rows); fine but reads as a duplicate.
10. CAC $200 is not reproducible from the doc: 2 paid sellers x $500 x 6 + $6,600 = $12,600; over 58 net accounts that is $217. Needs gross wins (~63) to reach $200.

### Forbidden-claim check

- **Forbidden claim 1 (paid sessions cover the platform fee):** not stated. Nearest line: "A therapist who works at all pays for this out of what they earned through it" (Part 2, "promise underneath"). That is netting (T3) and allowed, but it is one edit away from the forbidden claim; at 15 sessions the cut is $45 against an $80 fee, and the doc itself shows that.
- **Forbidden claim 2 (forecast of clinician earnings): at risk.** "At a $20 session, 15 sessions earns $300, we take $45, they pay $80, and they keep $175. Their earnings screen shows $255" is a worked clinician take-home figure. Framed as arithmetic, but if lifted onto a page it is an earnings forecast. Also "this same plan forecasts a typical therapist doing 20" sessions (at $20 = $400 gross) and the LTV line "plus far more in our cut of their sessions". Keep these internal only.

### Part 6 build status (as the doc states it)
Sponsor joining code and server-rendered QR at `/sponsor/code`: built. Poster: browser print only, no PDF. Company logo on poster: not built. Patient invites therapist: built (invite codes). Invite therapist by email/phone: partial. Automatic free-month/50% billing: **not built, applied by hand**. Card payments in Egypt: **no gateway**, bank transfer plus operator confirm.

---

## 2. INVENTORY

Generated by `npm run inventory` from source. Header: **125 pages, 570 controls, 0 with nothing attached** (no control flagged unwired or dead; every page shows "N wired, 0 not"). Title still says "The admin side, as it is" and "32 pages" (the admin count) though it now covers every route group. It reads source only: it cannot see correctness, real data or capability gating.

Totals by group (pages / controls): admin 32 / 153; therapist app 24 / 192; patient 24 / 108; public 19 / 44; sponsor 11 / 30; clinic 9 / 31; partner 6 / 12. Sum 125 / 570 (verified).

Control count in brackets.

**Public `(public)`, 19**
`/` (5, CMS blocks, title "(untitled)"), `/[slug]` (5, CMS pages, presumably serves /for-patients, /pricing, /security, /contact), `/radar` (9, Crisis Radar, SOS orb, tel links), `/t/[id]` (4, public clinician page, SOS orb), `/for-therapists` (3, session demo, pricing tiers, link /signup), `/for-clinics` (1), `/for-companies` (2, CTA /sponsor/apply), `/integrations` (3), `/integrations/[slug]` (1), `/developers` (0), `/verify` (1, check a record extract), `/verify/[code]` (0, no loads listed), `/design` (1, UI reference), `/design/patient` (2), `/design/patient/sample` (3), `/design/company` (2), `/design/company/sample` (0), `/design/clinic` (2), `/design/clinic/sample` (0).

**Patient `(patient)`, 24**
`/patient` (17, all links: account, browse, radar, consent, homework, assessments, sessions, claim, profile, journal, summary), `/patient/login` (7, password and six-digit code), `/patient/signup` (2), `/patient/forgot-password` (9), `/patient/invite/[token]` (3, no auth), `/patient/claim` (8, claim a record with handle code), `/patient/consent` (8, who can read your history: yes for a day, yes until, no, cancel), `/patient/account` (11, name, photo, change number, sign out), `/patient/billing` (0), `/patient/benefit` (5, employer benefit), `/patient/browse` (3), `/patient/t/[id]` (1), `/patient/radar` (5), `/patient/sessions` (2), `/patient/summary` (1), `/patient/profile` (2), `/patient/journal` (5, dictate), `/patient/homework` (6), `/patient/assessments` (2), `/patient/assessments/[id]` (3), `/patient/messages` (2, check-in mute switch), `/patient/notices` (2), `/patient/record` (2, export a copy), `/patient/residency` (2, where record is kept, withdraw).

**Therapist app `(app)`, 24**
`/dashboard` (5), `/sessions` (2), `/sessions/new` (3), `/sessions/[id]` (15, note review, risk assessment, cancel, approval, source token issue/revoke, voices unbind), `/patients` (7, add patient, duplicate detection), `/patients/import` (4, file preview/commit), `/patients/[id]` (30, the densest page: editor, record access, invite to session, add to history, copilot, provenance), `/patients/[id]/documents` (16, diagnoses, assessments, homework, standing profile), `/patients/[id]/evidence` (1), `/copilot` (2), `/copilot/[patientId]` (21, voice, read aloud, copy prompt), `/assistant` (7, chat threads), `/notes` (1), `/on-call` (17, radar console, availability, practice location on Google Maps, turn on), `/bookings` (8, calendar, publish, withdraw), `/connect` (6, invite code, history ask), `/billing` (5, plan card, seat manager, ledger), `/earnings` (9, payout destination, withdrawal request), `/onboarding` (4, verification), `/settings` (15, profile, password, payments, timezone, assistant prefs, link to `/admin`), `/settings/codes` (5, QR wall codes), `/settings/integrations` (3, meeting accounts via `/api/meetings/connect/<provider>`), `/settings/records` (4, EHR vendor connect), `/support` (2, raise ticket).

**Clinic `(clinic)`, 9**
`/clinic` (3, "This week" schedule, CSV export, week nav), `/clinic/people` (5, invite, remove, revoke), `/clinic/team` (8, roles and staff, `requireClinicCapability`), `/clinic/bills` (1, CSV export), `/clinic/earnings` (0, `requireClinicCapability`), `/clinic/records` (4, EHR), `/clinic/apply` (2), `/clinic/join/[token]` (6), `/clinic/sign-in` (2).

**Sponsor / company `(sponsor)`, 11**
`/sponsor` (0, spend heatmap from `weeklySpend`), `/sponsor/pot` (14, coverage percent, top up, payment popup), `/sponsor/pot/[txn]` (0, invoice), `/sponsor/people` (2, roster, remove), `/sponsor/code` (3, print, rotate), `/sponsor/settings` (4, join gates), `/sponsor/domains` (2), `/sponsor/domains/confirm/[id]` (0, no loads/auth listed), `/sponsor/integrations` (1, revoke), `/sponsor/apply` (2), `/sponsor/sign-in` (2).

**Partner / developer `(partner)`, 6**
`/partner` (4, API keys), `/partner/webhooks` (4), `/partner/deliveries` (0), `/partner/usage` (0), `/partner/apply` (2), `/partner/sign-in` (2).

**Admin / console `(admin)`, 32**
`/admin` (0), `/admin/transfers` (9, confirm, reject and tell them, I have this in the bank, evidence), `/admin/payouts` (11, take on, approve, sent, confirm, reject), `/admin/vault` (2, discount invoice, refund payment), `/admin/numbers` (6, number-change approvals, send code), `/admin/support` (11, take, wait, extend, move to WhatsApp, close), `/admin/verifications` (1), `/admin/therapists` (1), `/admin/therapists/[id]` (4, send their record), `/admin/patients/[id]` (1, back to transfers), `/admin/clinics` (5), `/admin/sponsors` (8, open pot, add portal user), `/admin/sponsors/[id]` (1), `/admin/partners` (5), `/admin/benefits` (0, paused benefits), `/admin/radar` (9, reports, DEMO, Ban), `/admin/radar/investigate/[id]` (1), `/admin/taxonomy` (2, radar lists), `/admin/ratings` (0), `/admin/checkins` (0, loads only `requireRole`), `/admin/announce` (0), `/admin/content` (3), `/admin/content/[id]` (1), `/admin/strings` (15, locales, machine translate, publish), `/admin/settings` (21, pricing, session, copilot, payouts, country, transfer fields, back-office users, mail check, video check), `/admin/financial-model` (8), `/admin/actuals` (16, capital, payroll, other costs), `/admin/usage` (2), `/admin/usage/sessions` (0), `/admin/errors` (0), `/admin/audit` (0), `/admin/tv` (10, Total View, `requireManager`, elevated key gate).

**Routes referenced elsewhere but absent from the inventory** (the generator evidently scans only these seven groups; a redesign route list must add them): `/login`, `/signup`, `/forgot-password` (linked from `/patient/forgot-password`), `/staff/sign-in`, `/join/[token]` (T4), the live video room (sessions link "openRoom" to `/sessions/<id>`, room page not listed), `/contact`, `/pricing`, `/security`, `/for-patients` (probably `/[slug]`), and route handlers `/clinic/export`, `/api/meetings/connect/<provider>`.

**Flags from the inventory**
- 0 controls unwired, but **126 "(unlabelled)" control entries** (icon buttons, inline links): an accessibility and redesign item.
- Label/target mismatch on `/` and `/[slug]`: `blocks.email` goes to `tel:` and `blocks.hours` goes to `mailto:`. Looks like swapped labels.
- `/patient` has `home.openProfile` pointing to both `/patient/claim` and `/patient/profile`; `/patient/claim` has two labels to `/patient`.
- Titles resolved from not-found branches: `/integrations/[slug]` "Not found", `/t/[id]` "Clinician not found", `/` and `/verify/[code]` "(untitled)", `/[slug]` "page.title".
- Pages with 0 controls that are likely read-only or thin: `/admin`, `/admin/checkins` (no data loader at all), `/admin/announce` (loads recipients, 0 controls: sender form not detected), `/patient/billing`, `/sponsor`, `/clinic/earnings`, `/partner/usage`, `/partner/deliveries`.
- Therapist `/settings` links to `/admin` (openAdmin).
- `/admin/patients/[id]` and `/admin/sponsors/[id]` both hard "Back" to `/admin/transfers`.
- Per-type item lists are deduplicated, so listed items are often fewer than the count (e.g. `/admin/settings` form 16, 12 listed).

---

## 3. BRAND (actually "24T logo pack") and LOGO-BRIEF

**BRAND.md** is the logo pack, not a brand book. Mark "24T": vector traced from supplied artwork (mean deviation 0.40px, worst 1.03px vs 1254px source), one closed contour, proportion fixed 2.348:1 (`viewBox 0 0 1000 425.948`), stroke 20.4% of height, round caps/joins. Clear space 0.20 x height; minimum 20px tall on screen, 6mm in print. Never recolour outside three inks, outline, shadow, stretch, rotate, mirror, separate 24 from T, set on photo/pattern, or go below 20px. In RTL the mark moves to the other edge, never mirrored. Files: `svg/24T-{navy,teal,white}.svg`, PNGs at 1024/512/256/128/64, app icons 512/180/32 (navy tile, reversed mark, 21.9% radius), favicon.ico 16/32/48. App icon is a stand-in "until the square `24` variation exists".
Inks: `navy-500` #0A2342 (identity), `teal-500` #2EC4B6 ("Crisis Radar only, on radar-void", 2.19:1 on white so never on light), `white`. Grounds: `slate-50` #F8FAFC, `navy-600` #091E39, `radar-void` #04101F.

**LOGO-BRIEF.md**: design system lives at artifact `https://claude.ai/artifact/Afso8BsBSLy992W1zYhk3B`, "verified 2026-09-19" (61 colour values, radii, control sizes, type scale, Lucide, motion, RTL). Brief says the blue is gone and the artifact predates the change; `app/globals.css` is the authority. Six-value table: `navy-500` #0A2342 identity; `brand-500` #2EC4B6 primary button and every focus ring; `teal-500` #2EC4B6; `navy-600` #091E39 session room; `radar-void` #04101F; `white`. Old `brand-500` #1F5EFF "carried 215 class names". Icons: `lucide-react` 0.469 in 127 files, 24px grid, 2px stroke, fill none, round caps. Type: no licensed typeface, system stack (SF, Segoe, Roboto); wordmark may be drawn and outlined; header 56px, nav 15px. Brand name stays Latin inside Arabic. Reserved state colours: `red-600`, `emerald-600`, `amber-500` (amber = "awaiting confirmation" badge on payments queue). Gradient direction: `brand-500` top left to `teal-500` bottom right ("the page's own wash"). Variations asked: `24` (512 square, legible 16px, central 80%), `24T` (~3:1, 44px bar, 20px min), `24Therapy` (horizontal and stacked, RTL). Do-not list: medical cross, brain, speech-bubble heart, pastel, swoosh, baked shadow. Company framing: "the clinical record layer above whatever a therapist already uses. Not a scribe, not an EHR." Tone: precise, quiet, institutional. Launch Egypt, Arabic and English.

**Colour claims now stale or contradictory (brand-500 is #2EC4B6):**
1. BRAND.md line 18: "`brand-500` `#1F5EFF` is the interactive colour and is never the mark." Stale value; and now brand-500 equals the mark's teal, so "never the mark" is false in effect.
2. BRAND.md: teal "Crisis Radar only" and "never on a light ground (2.19:1 on white)". Buttons and every focus ring are now that exact teal on light grounds. **Contrast problem:** a 2.19:1 focus ring fails WCAG 1.4.11 (3:1 for UI components); white text on #2EC4B6 is also ~2.2:1, failing 4.5:1 for button labels. Either the rule or the token is wrong.
3. LOGO-BRIEF gradient `brand-500` to `teal-500` is now teal to teal: no gradient. Any "page wash" built on it has collapsed.
4. The design-system artifact (verified 2026-09-19) still describes blue buttons; the brief says so itself. Every preview (`Button`, `Badge`, `PageHeader`) there is stale.
5. LOGO-BRIEF "brand and teal agree at 500 by construction... brand free to be re-cut when a contrast measurement says it must be": that measurement (2.19:1) already exists in BRAND.md.
6. BRAND.md delivers a `24T` pack from "supplied artwork" while LOGO-BRIEF still commissions all three variations; the `24` square and `24Therapy` wordmark status is unclear (brief possibly superseded for 24T).
7. Counts "215 class names", "127 files", "lucide 0.469" are dated snapshots.

---

## 4. EMAIL-DNS and DAILY-HOSTS

**EMAIL-DNS** (domain `24therapy.app`; gate `npm run verify:email-dns` queries live DNS)
- SPF root: `v=spf1 include:zohomail.com ~all` (Zoho mailboxes). SPF `send.24therapy.app`: `v=spf1 include:amazonses.com ~all` (Resend via SES). DKIM `zmail._domainkey` and `resend._domainkey` published. DMARC `v=DMARC1; p=none; rua=<founder inbox>; sp=none; adkim=r; aspf=r`, added 2026-09-22, no `ruf` on purpose. From: `noreply@24therapy.app`.
- **Time-bound: `verify:email-dns` accepts `p=none` until 2026-10-06 and fails after.** That is 14 days from today. Plan: read reports a fortnight, confirm only Zoho and Resend, then `p=quarantine`, then `p=reject`; keep `~all` until clean then `-all`.
- `aspf=r` is load-bearing: `aspf=s` would fail SPF alignment on all transactional mail (resets, session invitations).
- Internal contradictions (the file was only partly rewritten):
  - Line 30 says "while SPF still does not name Resend"; the next section says "There is no SPF gap, and this file said there was".
  - "What to add" section 1 still calls DMARC "the one that is missing" and recommends `rua=mailto:dmarc@24therapy.app; fo=1`, which differs from the published record (founder inbox, no `fo`).
  - Section 1 says the gate "fails the policy line while it is still p=none" vs the top: fine until 2026-10-06.
  - Section 2 advises replacing the root SPF to name Resend, contradicting the finding that Resend lives on `send.` and root needs nothing.
  - DMARC reports going to one founder's personal inbox is a single point of failure for the fortnight review.

**DAILY-HOSTS** (video CSP; `npm run audit:daily-hosts [-- --write]`, enforced by `verify:csp`)
- `@daily-co/daily-js` 0.91.0 is a ~200KB loader; it pulls `c.daily.co/call-machine/.../call-machine-object-bundle.js` (1775KB).
- Allowed: `*.daily.co` (script via `strict-dynamic`, connect, media, frame), `*.pluot.blue` (production signalling and region lookup, first branch not fallback), `*.dailywebrtc.com`, `*.dailywebrtc.net` (connect https/wss), `daily.co`. Noted not fetched: `*.pluot.co`, `pluot.tv`, `*.google.com` STUN.
- Blocked on purpose: Daily's Sentry `o77906.ingest.sentry.io`; WebAssembly (no `'wasm-unsafe-eval'`), so Banuba background blur/virtual background and Daily noise cancellation cannot work if enabled; no `webrtc` directive. `worker-src 'self' blob:` set.
- **Time-bound:** any daily-js version bump fails `verify:csp` until the audit is rerun and the diff reviewed; a new host is a policy decision.

---

## 5. Stale / Suspect

**Likely stale**
1. BRAND.md `brand-500 #1F5EFF` and "teal Crisis Radar only" (see section 3).
2. Design-system artifact Afso8BsBSLy992W1zYhk3B (blue era).
3. EMAIL-DNS "What to add" section and the line-30 SPF claim.
4. INVENTORY title "The admin side" / "32 pages".
5. Content backups are pre-rewrite snapshots (2026-09-21): home had five `hero` blocks since replaced by one `audiences` block (task 137); for-patients went 11 to 9 sections. Staging locales (`en-x-staging`, `ar-x-staging`) were not updated and have already drifted (staging home lacks company/clinic heroes and the competitor table; staging for-patients lacks the two walkthroughs; hero `demo: none`). No gate compares them.
6. FINANCIAL-PLAN "Cards" cost line vs no gateway.
7. Competitor table `checkedOn 2026-09-19` with third-party prices (SimplePractice from $49 + ~$35 AI add-on; TherapyNotes ~$69 + ~$40; Upheal ~$1/session capped ~$69; Mentalyc ~$20 to $70; Lyra enterprise). Ages fast and is a public factual claim about competitors.

**Would matter if false (public claims in the backups and plan)**
1. Home CTA **"Your first session is free"** vs the plan's offer (first **month** free, then 50%, 50%). Different offer; and Part 6 says discounts are applied by hand.
2. Competitor row "A flat plan with **no per-session fee**": a 15% cut is still taken on every paid session for subscribers.
3. Home: "Every dot is a **verified** clinician" vs C1 which expects a verification *state* on the row (unverified may appear).
4. Home: "Patients need no account... No password, no app" and for-patients hero "nothing in it asks you for an account" vs FAQ "you need one to keep your history" (consistent only if read carefully).
5. Home: "email the patient a plain-language summary" vs P2 "nothing is only in an email".
6. for-patients: "Take the access back and the assistant stops... that same second" (T5 proves "next question").
7. for-patients FAQ: no-show after five minutes, replacement at same or lower price or money back, difference as credit. Operationally hard on a manual transfer rail.
8. for-patients FAQ: "the rate you were shown is the rate you are charged" while the plan says the rate is "edited daily" by an operator.
9. Home: "Risk language is scanned for, in Arabic and English... alert written to the database before anyone is notified".
10. Home: "We check your licence against the register before you see a patient."
11. Home: "Every read of a chart is written to an append-only audit log. No transcript text ever reaches application logs."
12. `/sponsor` renders a **weekly spend heatmap** (`weeklySpend`): E1 promises "never who and never when". Weekly granularity at a small company (1 to 2 people on a pot in the demo positions) can reveal when someone went.
13. `/sponsor/people` "Who is on your list" is a named roster with a Remove button: E1 "never who they are" holds only if the roster is enrolment, not usage; E4 says 0% must not remove, but a remove control exists.
14. `/clinic` "This week" schedule plus `/clinic/export?what=schedule` CSV: C2 promises no patient name and no caseload count on any clinic screen; a schedule export is the obvious place for both.
15. FINANCIAL-PLAN "7 companies, 9 clinics, 14 therapists" in Q1 depends on a founder selling full time; the doc itself calls it the assumption most likely to be wrong.
16. VALUE-STATEMENTS lists a shared demo password in the repo (`Demo2026!Therapy`) for production accounts including the platform admin `omar@24therapy.app` and real Gmail addresses; worth confirming these are demo-only accounts on production.

---

## 6. Capabilities not covered by any of the 25 value statements

From INVENTORY, the plan and the published pages:
- Therapist: live transcription with per-speaker tracks and voice binding; SOAP note plus summary, talking points, observations, impressions, follow-up; in-session **risk-language scanning and alerts** (Arabic and English); in-session copilot prompts ("at most two"); therapist **Assistant** chat (`/assistant`); diagnoses, evidence panel, standing profile/beliefs; assessments/questionnaires; homework "steps"; patient CSV **import**; **bookings calendar** and availability publishing; Crisis Radar on-call console with practice location; **licence verification/onboarding**; public verified page `/t/[id]` and **QR wall codes**; **meeting-account integrations**; **EHR "record system" connections** (therapist and clinic); earnings **withdrawals** and payout destinations; support tickets; plan choice (unlimited vs metered, seats).
- Patient: **record claim** by phone plus two questions; journal with dictation; homework check-off; questionnaires; check-in messages and mute; notices feed; **record export** emailed with signer licences, and third-party **`/verify` of an extract**; **data residency** screen with withdraw; browse/categories; employer benefit activation and primary benefit; account number change (with admin approval queue); no-show replacement or refund; FX rate locked at payment; price shown with tax.
- Clinic: team roles and capabilities, clinic staff invites, CSV exports, weekly schedule, application flow.
- Company: joining code and QR poster, code rotation and attempt tracking, **email-domain verification**, join gates/fields, integrations, pot top-up and invoices, coverage percent editing, $100 welcome credit.
- Partner/developer platform: API keys, webhooks, deliveries, usage metering and billing, apply flow, `/developers`, `/integrations` catalogue.
- Admin: payouts queue, vault discounts/refunds, number-change approvals, support queue with WhatsApp handoff, radar moderation (reports, ban, investigate), ratings, taxonomy, verifications review, CMS content and strings with machine translation, financial model and actuals, usage and per-session cost, errors, announcements, paused benefits, check-ins, Total View (`/admin/tv`) behind an elevated key.
- Platform/ops: DMARC/SPF/DKIM posture, video CSP and blocked third-party telemetry, content backup and byte-identical sync (`content:sync`), bilingual RTL.
