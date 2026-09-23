# What the company can do in 24Therapy

Read from the code at `cddd4a3f` (2026-09-23). Comments were not taken as evidence: every claim here comes from a code path someone can follow. "Company" means the sponsor (`sponsors` row, `SponsorActor`, cookie `24t_sponsor`). Roles are `admin` and `viewer` (`lib/sponsor-auth/guard.ts`: `requireSponsor`, `requireSponsorAdmin`).

## 1. Summary

The company portal has **11 pages** under `app/(sponsor)/sponsor/` plus one shared shell (`app/(sponsor)/layout.tsx`). Two pages are open to strangers: `/sponsor/apply` (the only sign-up) and `/sponsor/sign-in`. One is meant to be open but is not: `/sponsor/domains/confirm/[id]`. A company cannot make its own account. It sends an enquiry, and then an operator at `/admin/sponsors` has to activate it, open the pot with its terms, create every portal login and mint the first joining code. Once signed in, a company can do these things:

- Read a published (floored) pot balance, total spend, sessions paid for and a weekly spend heatmap.
- See the names of everyone enrolled, and end one person's funding.
- Print a joining code poster and replace the code.
- Set the percentage of each session it covers.
- Add money to the pot (by card for the US entity, by declared bank transfer for Egypt) and open invoices.
- Prove email domains.
- Choose what identifier employees must give (up to two).
- Toggle a public listing.
- Switch on an "HR integration" that mints API keys.

Only an admin can make changes. A viewer can read every page and change nothing.

The most serious problems:

- A US card top-up adds money to the pot without charging anything.
- The domain mailbox proof sits behind the sponsor login.
- The balance does not change after a top-up.
- The roster shows names, while the promises say the company will never know who people are.
- The HR integration does nothing, for three separate reasons.

## 2. The table

Legend for the Value column: E1 to E5 and A1 to A5 are rows in `docs/VALUE-STATEMENTS.md`.

### Shell (every signed-in page)
`app/(sponsor)/layout.tsx`, `components/sponsor/chrome.tsx`, `components/portal/desk.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Nav rail (desktop) / top bar with scrolling pills (mobile) | Organisation name (`getSponsorActor`), 7 tabs: Overview, Your list, Joining code, Your pot, Domains, Integrations, Settings | Links to the 7 routes | none stated | A viewer's badge reads "Overview" because `chrome.tsx` passes `t("sponsor.nav.overview")` as `badge`, so the role is never shown. No signed-in user name or email. No account, user or password page. |
| Sign out | Button "Sign out" | `<form action={signOutSponsor}>` in `sign-in/actions.ts` calls `revokeSponsorSession` and redirects to `/sponsor/sign-in` | none stated | none |
| Language switch | EN/AR switch in the rail | `LanguageSwitch` | none stated | Many strings on these pages are English literals (listed per row) |
| "This portal will never show you" wall | 3 lines: any individual, attendance, a note/transcript/diagnosis | none | E2 | Its first line, "Any individual, ever", is contradicted by `/sponsor/people`, which lists every enrolled person by name |
| Pending payment bar (conditional) | Pending top-up transfer and its stage (`pendingPaymentFor({kind:"sponsor"})` in `lib/billing/pending.ts`) | Link to `/sponsor/pot`, plus Dismiss and Reopen (`PendingBar`) | A1 | Only the Egyptian transfer rail ever produces one |
| Session and access boundary | none | `getSponsorActor`: sessions end after 30 min idle or 8 h. A sponsor in any state other than `active` cannot sign in (checked in the WHERE clause) | E2 (`SponsorActor` has no `organizationId`, so no clinical query can accept it) | No `loading.tsx` or `error.tsx` in `app/(sponsor)`, so a failed query falls through to `app/global-error.tsx`. The session expires silently to the sign-in page, with no "you were signed out" message. |

### /sponsor/sign-in
`app/(sponsor)/sponsor/sign-in/page.tsx`, `components/sponsor/sign-in-form.tsx`, `components/auth/auth-shell.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Promise panel | `auth.company.promise` and 3 points: "Add employees and set what a session costs the company", "Watch the pot, the spend and the take-up, month by month", "Nobody at the company ever sees a clinical note" | none | none stated | 2 of the 3 promises are false. The company cannot add employees, because employees enrol themselves. Reporting is weekly spend, never monthly, and never shows take-up. |
| Sign-in form | Email address, Password | "Sign in" calls `signInSponsor`, which rate-limits (8 per 15 min, `consume`), runs `checkSponsorPassword` (`lib/data/sponsor-admin.ts`), then `createSponsorSession` and redirects to `/sponsor`. The "no account yet" line in `AuthShell` links to `/sponsor/apply`. | none stated | No forgot-password link and no reset flow for sponsors anywhere. No password change. No MFA. Error strings are English literals. A held or suspended account gets "email and password do not match", so a company whose account is not yet active cannot tell why. |

### /sponsor/apply (company sign-up)
`app/(sponsor)/sponsor/apply/page.tsx`, `apply/actions.ts`, `components/sponsor/apply-form.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Enquiry form | Organisation name; What are you (A company / A university); Who should we speak to; Email address; Phone number; Best time to call | "Ask us to call" calls `apply` (rate limit 5 per hour), which runs `applyToSponsor` and inserts a `sponsors` row with state `held`, `entity: "us"`, unlisted | none stated | Nobody is told. `applyToSponsor` only writes a log line, sends no email to the applicant or to staff, and creates no admin task. `entity` is hard-coded to `us`, so an Egyptian company sits on the wrong rail until an operator changes it. Errors and "Working…" are English. There is no duplicate check, so every submission creates another held row. |
| Sent state | "Thank you. We will call you." and "Your account is open and nothing is active…" | none | none stated | Says "your account is open", but there are no credentials and no way to sign in. Gives no timeline and no reference. |
| "An employer here" can/cannot table | `SeesWhat`: can see how many are enrolled, total pot spend, a weekly figure. Cannot see any individual, attendance, clinical data | none | E1, E2 | The "cannot see any individual" line is untrue (see `/sponsor/people`). When signed out, the page renders inside `Desk` with `nav=false`: no logo, no site header, no language switch and no link back to the site or to sign-in. |

### /sponsor (Overview)
`app/(sponsor)/sponsor/page.tsx`, `components/sponsor/spend-heatmap.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Pot card | "Left in your pot": the published balance from `potBalance` (`lib/data/sponsors.ts`), or "Not enough activity to report yet". "Expires {date}" from `potTerms`. A bar and one line: for a company "You have used {percent}% of what you have put in", for a university "…lasts about {weeks} more weeks" | none (no link to top up) | E1 ("the balance is a published figure") | The balance does not move after a top-up. `potBalance` republishes only when pot-funded sessions reach `activityFloor` (5) since the last publication, and neither `topUpPot` nor `grantPotTopUp` resets it. A new company that has paid in sees "Not enough activity to report yet" until 5 sessions are spent. `potBalance` also writes to `sponsor_pots` while the page renders. Weeks-left averages only the weeks that had spend, so it overstates the burn rate. There is no call to action to top up. |
| Spent so far / Sessions paid for | `pot.published.spentCents` and `.sessions` (`potSpentThrough`), or "Too early to report" | none | E1 (spend and count) | E1 promises "how many people used it", but only a session count exists. No count of people is computed anywhere. |
| No pot card (conditional) | "Your pot is not open yet…" when `potTerms` is null | none | none stated | Shown together with "Not enough activity to report yet" on the balance: two different explanations for the same state. |
| Weekly spend heatmap | `weeklySpend(sponsorId, floor)`: spend grouped by week in SQL, passed through `applyActivityFloor`. Suppressed weeks are hatched. | Hover tooltip | E1, "weekly never daily" (`/for-companies`) | Not one number is shown: the tooltip on a reported week says only "Week of {date}", and there is no legend or axis. Weeks with no spend are missing from the SQL result, so the strip skips them without saying so. It covers all time, not a year. No export. |
| Headcount gate (conditional, privacy boundary) | If `roster().length < activityFloor`, "Not enough activity to report yet" and no series is fetched | none | E1 | The gate reuses `activityFloor` (a session count) as a headcount floor. The roster names on the next tab are not gated at all. |
| "Why weekly" footnote | `sponsor.whyWeekly` | none | E1 | none |

### /sponsor/people (Your list)
`app/(sponsor)/sponsor/people/page.tsx`, `people/actions.ts`, `components/sponsor/roster-list.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Header | "Who is on your list" and "{count} people" (`roster(sponsorId).length`) | none | apply page: "How many of your people are enrolled" | The count is not floored. |
| Roster rows | Full name of every active enrolment, sorted by first and last name, up to 2000 (`roster()`) | none | none stated | Privacy: this contradicts E1 ("never who they are"), the E2 walk ("if a patient name appears anywhere, the walk stops there") and `/for-companies` ("never learn who went"). Comparing the list on two visits shows who joined in between, which is the join date `roster()` avoids selecting. Silently cut off at 2000 rows. No search or export. Empty state: "Nobody has activated the benefit yet." |
| Privacy boundary | Not shown: join date, last-verified date, paused status, sessions, therapist (`page.tsx` maps only `enrolmentId` and `name`) | none | E2 | `roster()` still selects `lastVerifiedAt` and `pausedAt`. They are dropped only in the page. |
| End their benefit (admin only) | "End their benefit" opens the text "Their funding and badge end now…" and 4 reason buttons: They have left / They have graduated / The benefit has ended / An administrative correction | Tapping a reason calls `endBenefit(enrolmentId, reason)`, which runs `requireSponsorAdmin` and `removeFromRoster` (sets `removed_at`, clears `is_primary`, inserts `pnotice.benefitEnded`), then `audit("benefit.ended")` | none stated (C234) | One tap on a reason removes the person, with no final confirm. Once the panel is open there is no Cancel and no way to close it. No undo, and no re-add: the person has to re-enrol. No success message: the row just disappears. Errors are English ("Pick one of the reasons."). |
| Verify-cycle footnote | "We re-check each person every {months} months…" from `settings.sponsor.verifyCycleMonths` | none | none stated | The pause job `pauseUnverified` (`lib/data/enrolment-verify.ts`) reads `sponsors.verify_cycle_months`, a separate column, so the screen and the job can disagree. The company is never shown how many people are paused. |

### /sponsor/code (Joining code)
`app/(sponsor)/sponsor/code/page.tsx`, `code/actions.ts`, `components/sponsor/code-card.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Poster block | QR code generated on the server as a data URI (`/patient/benefit?code=…`), the code, and "Activate your benefit at {url} with the code {code}." (`liveCode`) | none | `/for-companies` step 2 "Your people enrol themselves" | none |
| No-code state | "You have no joining code yet." | none | none stated | Dead end. The company cannot make its first code: `replaceCode` is only reachable from `CodeCard`, which does not render without a code. Only the operator's `mintCode` (`app/(admin)/admin/sponsors/actions.ts`) can make one. |
| Attempts count | "{count} attempts on this code in the last seven days." Amber warning at 50 or more (`attemptsOnCode`, `SPIKE_THRESHOLD`) | none | none stated | The count includes successful enrolments, because every attempt on a live code is counted. A small weekly number read against changes in the roster points to individual joiners. |
| Print this | Button | `window.print()` | none stated | Only the attempts block and the button row are `print:hidden`, so the portal rail, header and wall print with the poster. No PNG or PDF download and no share link. |
| Replace this code (admin) | Tap once to show the warning text and a red "Replace this code" button | `replaceCode` calls `rotateCode` (revokes the old code, inserts a new one) and `audit("sponsor.code_rotated")` | none stated | No Cancel once the confirm step shows. No success message. Employees are not told, so old posters stop working without notice. |

### /sponsor/pot (Your pot)
`app/(sponsor)/sponsor/pot/page.tsx`, `pot/actions.ts`, `components/sponsor/coverage-form.tsx`, `components/sponsor/top-up-form.tsx`, `components/billing/payment-popup.tsx`, `pay-by-transfer.tsx`, `top-up-stepper.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Balance meter (or suppressed card) | The published `potBalance` "of {last top-up} last added" (`topUpHistory[0]`), "Unspent money expires on {date}" | none | E1 | The same stale-after-top-up fault as Overview. The meter compares a published (old) balance with a live last top-up. Expiry has no code behind it: `payFromPot` never reads `expiresAt`, and no job expires a pot. |
| What you cover (admin only) | "{n}% of a session. Your people pay the other {100-n}%", and a pending change banner "Changing to {p}% on {date}…" (`coverageFor`) | "Edit what you cover" opens a slider (0 to 100 in steps of 5), "Move it, then save". "Save" calls `setCoveragePercent`, which runs `setCoverage` (raising takes effect now; lowering waits `coverageNoticeDays`, 30) and `audit("coverage.set")`. "Cancel" closes it. | E3, E4 | The whole component is English literals. A viewer never sees the coverage percentage anywhere. "Covers about N sessions" uses the published balance (0 when suppressed) and `averageSessionCents` ($20), not real prices. Employees are not told about a coming reduction: no notification exists for it. |
| Bank-transfer rail (admin, Egyptian entity, terms set) | Payment sheet labelled "Company payment", bank details (`manualEntry`), a USD/EGP stepper with VAT and "Covers about {n} sessions" (`potTopUpLadder`) | Less and More (debounced `openPotPayment` then `openCart`), "Transfer this", then a reference and proof upload, then "Submit" calls `declarePotTransfer` (min and max check, `potTopUpMoney`, `uploadDocument`, `declarePaid`, audit). Close, Minimise. A rejection shows the operator's reason word for word. | A1, A3 | The refund and expiry terms are not shown on this rail, which contradicts C233 ("terms beside the button"). `onCancel` is not passed, so "Cancel this payment" never appears. A viewer on this rail sees no terms card. Error strings are English. |
| Card rail (admin, non-Egyptian entity, terms set) | "Add to your pot", minimum, Amount, and a refund and expiry box | "Add to the pot" calls `addToPot`, which runs `topUpPot` and `audit("pot.topped_up")` | none stated | Critical: no money is taken. `topUpPot` (`lib/billing/pot.ts`) posts a `cash` ledger leg and raises `balance_cents` straight away, with no Stripe or other charge anywhere on the path (the comment says a Stripe webhook calls it, and nothing does). No success message: `state.ok` is never rendered. "Working…" is English. |
| Viewer terms card (non-Egyptian) | Refund policy and expiry date | none | none stated | none |
| No pot card | "Your pot is not open yet…" | none | none stated | No action, and no way to ask for a pot to be opened. |
| Your invoices | One row per top-up: date and amount, linking to `/sponsor/pot/{txnId}` (`topUpHistory`) | Link | none stated | The amount is the net credit from the pot leg, while the invoice shows the cash paid, so they differ when VAT applies. An operator's welcome credit (`openPot`, `pot_topup` journal) shows as an invoice. There is no statement of spend, of pending or rejected transfers, or of expiry. The section is hidden when empty. |

### /sponsor/pot/[txn] (Invoice)
`app/(sponsor)/sponsor/pot/[txn]/page.tsx`, `lib/billing/invoice.ts`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Invoice document | Issuer legal name, address and tax number (`settings.invoice.entities`); number `{prefix}-{00001}`; date; "Billed to" and the organisation name; line "Prepayment for therapy sessions…"; VAT at the rate; "Paid" total (the cash leg) | Print from the browser only | none stated | Invoice numbers count per sponsor, so every customer gets `US-00001`, and the issuer's numbers are not unique. No buyer address or tax number. A welcome credit has no cash leg, so it renders as "Paid $X". Currency is always formatted `en-US`. No Print or Download button and no back link. |
| Missing details state | "We cannot issue this document yet. Ask us for it…" | none | none stated | With the default settings (legal name, address and tax ID blank) every invoice shows this. "Ask us" has no link or contact. |
| Scope boundary | 404 for another organisation's transaction (`invoiceFor` filters on `ref_id = sponsorId`) | none | none stated | none |

### /sponsor/domains (Domains)
`app/(sponsor)/sponsor/domains/page.tsx`, `domains/actions.ts`, `components/sponsor/domain-list.tsx`, `lib/data/sponsor-domains.ts`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Header | "Your domains", "Two proofs for each one…" | none | none stated | English literal |
| Domain card | Domain; two ticks ("Somebody at this domain answered our code", "The DNS record is published…") or "Proved by signed agreement"; status text from `domainProblem`, or "Proved. This domain can issue joining codes." (`domainsFor`) | none | none stated | Everything is English, including the `domainProblem` sentences. No remove-domain action. No "resend the email" action, even though the text says a code was emailed. The email goes only to `postmaster@{domain}`, and the company cannot choose another address. |
| TXT record and check | `_24therapy.{domain}` and its token | "Check the record now" (admin, until proved) calls `checkDnsRecord`, which runs `resolveTxt`, then `markDnsProved` and audit | none stated | none |
| Add a domain (admin) | Input with placeholder `acme.com` | "Add" calls `addSponsorDomain`, which runs `addDomain` (inserts, then `notify` to `postmaster@`) and audit | none stated | A domain already on another account gets a deliberately vague refusal, and nothing tells the company how to resolve it. |
| Empty state | "No domains yet" | none | none stated | The link between domains and joining is not stated. A `domain_email` gate crosses only for a proved domain (`lib/data/enrolment.ts`), yet `/sponsor/settings` accepts any domain, so an unproved one refuses every employee without saying why. |

### /sponsor/domains/confirm/[id]
`app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx`, `components/sponsor/confirm-domain.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Confirm card | "Somebody at your organisation asked us to set up mental health cover…" | "Yes, this mailbox is ours" calls `confirmDomainMailbox(id, token)`, which checks the HMAC (`mailboxTokenMatches`) and runs `markMailboxProved` | none stated | Broken. The path is under the `/sponsor` prefix and is not in `openRoutes` (`lib/routing.ts` lists only `SPONSOR_APPLY`), so `middleware.ts` sends any IT contact without a sponsor cookie to `/sponsor/sign-in`. The mailbox proof can only be completed by someone who already has a portal login. English only. |

### /sponsor/integrations
`app/(sponsor)/sponsor/integrations/page.tsx`, `integrations/actions.ts`, `components/sponsor/integrations.tsx`, `lib/data/sponsor-integrations.ts`, `app/api/hr/v1/employment/route.ts`, `lib/partner/employment.ts`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Header and "What this does not do" | `sint.*` copy: we never read or sync your directory | none | none stated | none |
| Employment verification switch | HR system list (Workday, BambooHR, HiBob, Personio, SAP SuccessFactors, Oracle HCM, Generic or other) | "Turn it on" / "Turn it off" (admin) calls `setVerification`, which runs `setEmploymentVerification` (turning it off revokes all keys) and audit | none stated | Turning it on changes nothing in enrolment: no code reads `employmentVerificationEnabledAt` apart from key minting. |
| Connected indicator | "Connected" when a key has `lastSuccessAt`, otherwise "Not connected yet" | none | none stated | none |
| Getting connected (4 steps) | Steps, a snippet `POST https://24therapy.app/api/hr/v1/employment` | "Generate the key" (admin) calls `mintHrKey`, which runs `mintSponsorKey`. The key is shown once. | none stated | The copy says the opposite of the code. Step 2 says "We send an identifier… your system replies", but in code their system must POST to us and we answer whether we fund that person (`verifyEmployment`). An attestation lives 10 minutes (`ATTESTATION_TTL_MINUTES`) and nothing tells their system one exists, so calls almost always get a 404. The answer never affects enrolment. The host in the snippet is hard-coded. |
| Your keys | Prefix; Revoked, suspended reason, last success or "Never used" | "Revoke" (admin) calls `revokeHrKey`, which runs `revokeSponsorKey` and audit | none stated | No confirm before revoking. No labels and no expiry. |
| "Enrolments that did not match, last seven days" (conditional) | Number from `failedAttemptsFor` | none | none stated | Mislabelled. It counts unanswered `enrolment_attestations`, and those are written only after a successful gate crossing, so it counts real enrolments. Without a working HR caller, that is every recent enrolment. As a small number it also exposes enrolment timing. |
| "What we sent you" log | `deliveriesFor` (webhooks with `sponsorId` and no partner) | none | none stated | Always empty. `registerWebhook` (`lib/partner/webhooks.ts`) requires a `partnerId`, and there is no sponsor webhook form, so the page always says "Nothing yet." |

### /sponsor/settings (How people join)
`app/(sponsor)/sponsor/settings/page.tsx`, `settings/actions.ts`, `components/sponsor/gate-settings.tsx`

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| Current fields (admin) | Kind label, domain, a warning to prefer proof (`identifierFields`) | "Remove" calls `dropGate`, which runs `removeIdentifierField` and audit | none stated | No confirm. Removing every field leaves a live code that nobody can get past, with no warning. |
| Add a field (admin, fewer than 2 fields) | Radio: "An email address on your domain" / "A staff or student number"; then "Your email domain", or a pattern input; "How would you describe a valid one" | "Add this" calls `addGate`, which runs `setIdentifierField` and audit | none stated | The staff-number pattern input has the same label as the hint ("How would you describe a valid one"), but `setIdentifierField` compiles it as a regex and the match is anchored. An HR person who types a description gets a gate that matches nobody. There is no test box. The domain is not checked against `/sponsor/domains`. "Working…" is English. |
| At-cap note | "You can ask for two things at most." | none | none stated | none |
| Viewer card | Raw domain, hint or kind key for each field | none | none stated | Shows internal kind keys such as `id_number` when there is no hint. |
| Public listing (admin) | "Can people find you without the code" | The button toggles and calls `setPublicListing(!listed)`, which runs `setListed` and audit | none stated | Does nothing. No public surface reads `listedPublicly` (only admin screens do), and `employerLookup` returns the same sentence for every domain. The button shows the current state ("Listed" / "Reachable only with your code"), not what pressing it will do. |
| Verify-cycle footnote | "We re-check each person every {months} months…" | none | none stated | Same mismatch between the screen and the job as on `/sponsor/people` |

### Context: what the employee sees because of the company (not company pages)

| Section | What they see | What they can do | Value | Gaps |
|---|---|---|---|---|
| `/patient/benefit` (`app/(patient)/patient/benefit/page.tsx`) | "Activate your benefit", what the organisation can and cannot see ("That you are on the list. The date beside it is the same for everybody."), "Your sessions are paid for by {name}", paused, "Which one pays" | `checkCode`, `activateBenefit`, `confirmCode`, `choosePrimary`, `askAboutEmployer` | E4 | "Paid for by {name}" appears even when coverage is 10% or 0%. It says the company sees a date, but the company sees no date now. |
| Booking and paying (`payFromPot` in `lib/billing/pot.ts`, `app/pay/[token]/page.tsx`) | A "Your benefit paid" line showing the covered amount, with the split fixed at booking | Pay the rest | E3 | E5 is not built. All three callers (`lib/data/sessions.ts`, `lib/data/scheduling.ts`, `app/join/[token]/actions.ts`) ignore `payFromPot`'s result, so an employee whose pot is empty or at 0% gets the ordinary pay link and is never told to ask HR. |
| Notices | `pnotice.benefitStarted`, `benefitEnded`, `benefitPaused`, `verifyNeeded`, with no employer named | none | E4 | none |

## 3. Can do with no screen

- **HR API**: `POST /api/hr/v1/employment` with a sponsor key (`app/api/hr/v1/employment/route.ts`). It answers only for an enrolment made in the last 10 minutes. The company has no way to learn when to call.
- **Pot-empty email**: `alertSponsorPotEmpty` (`lib/billing/pot-alerts.ts`) emails every admin, in English, "Your therapy fund needs topping up" with a link to `/sponsor/pot`. It fires on every booking that hits an empty pot, so admins can get repeated emails. It also reveals that someone tried to book at that moment, which undercuts E1's "never when". Nothing warns before the pot runs low.
- **Domain email**: `postmaster@{domain}` gets a confirm link, which is broken (see `/sponsor/domains/confirm/[id]`).
- **Things a company can only get by phoning us** (operator actions in `app/(admin)/admin/sponsors/actions.ts`): `activate` (`setSponsorState`); `setEntity`; `openTheirPot` (`openPot`: refund text, expiry, overdraft, welcome credit); `addPortalUser` (`createSponsorUser`: every login and password, admin or viewer); `mintCode` (the first joining code); confirming bank transfers (`grantPotTopUp`); proving a domain by agreement. A company cannot add or remove its own users, change roles, reset a password, edit its name or contacts, change its refund or expiry terms, or close its account.
- **Things that happen to their people with no company control or visibility**: `pauseUnverified` pauses unverified enrolments every cycle, and the company is never shown the count. The overdraft (`overdraftCents`) lets the pot go negative, and the company is never shown this. The `provisional` enrolment state is read by `payFromPot` but nothing ever sets it.
- **Audit trail**: every company write is audited (`benefit.ended`, `pot.topped_up`, `coverage.set`, `gate.*`, `listing.*`, `domain.*`, `sponsor.hr_key.*`, `sponsor.code_rotated`). The company cannot read any of it.

## 4. Promised but not built (or contradicted)

| Promise | Where | What the code does |
|---|---|---|
| "Never who they are" (E1), "Any individual, ever" (chrome), "never learn who went" (`/for-companies` title), "If a patient name appears anywhere, the walk stops there" (E2) | VALUE-STATEMENTS E1 and E2, `sponsor.neverIndividual`, `marketing.companies.title` | `/sponsor/people` lists the full name of every enrolled person |
| "How many people used it" | E1 | No count of people who used it is computed. Only an all-time session count exists. |
| The patient is told to ask HR when the pot runs out | E5 | The result of `payFromPot` is thrown away by every caller. The patient sees only the ordinary pay link. |
| "Add employees" | `auth.company.p1` on `/sponsor/sign-in` | No such action. Employees enrol themselves with the code. |
| "The spend and the take-up, month by month" | `auth.company.p2` | Weekly spend only, never monthly, no take-up figure |
| Public demo: "Joined … of N staff", "Used it … this month", "Where the money went" by therapist name with amounts, a pot ledger of top-ups and weekly debits, "Sessions covered per person, per year: 12", "Cap per session", "Share" | `CompanyConsole` in `components/demo/portal-demo.tsx`, shown on `/for-companies` | None of these exist. Per-therapist spend would also break C244. There is no headcount, no per-person cap, no annual limit and no ledger view. |
| Unspent money expires on a date | `sponsor.expiresOn` on `/sponsor/pot`, invoices, the top-up form | Nothing enforces expiry: `payFromPot` never reads `expiresAt`, and no job exists |
| Refund and expiry terms beside the top-up button (C233) | `top-up-form.tsx` docblock | True on the card rail. Missing on the Egyptian transfer rail, the only rail Egyptian companies have. |
| Money is paid before the pot is credited (A1: "Nothing is granted before a person confirms it") | A1 | The US card rail credits the pot with no payment and no confirmation (`topUpPot`) |
| The balance is a published figure (E1) | E1 | True, but the published balance never reflects a top-up until 5 more sessions have been spent |
| "We send an identifier… your system replies" | `sint.step2Body` | The reverse: their system calls us, and the answer changes nothing |
| "Every call is in the log below" | `sint.step4Body` | The log reads webhook deliveries, which a sponsor can never have |
| "Can people find you without the code: Listed" | `sponsor.listedBody` | No public search or picker reads `listedPublicly` |
| "Proved. This domain can issue joining codes." / the IT contact confirms with no account | `domain-list.tsx`, `confirm/[id]/page.tsx` | The confirm page is behind the sponsor login, so the mailbox half cannot be completed by the intended person |
| "A lot of these usually means your joining code has travelled" | `sint.attemptsBody` | The number counts successful enrolments, not failed matches |
| "Your sessions are paid for by {name}" | `benefit.active` (employee) | Shown at any coverage level, including 0% |

## 5. Should exist in the redesign

1. **Real payment on the card rail.** Charge before crediting, or remove the card rail until a charge exists. Reason: `topUpPot` credits for free, which breaks A1.
2. **A balance that reflects top-ups.** Publish the balance again on every top-up, since top-ups are the company's own acts and reveal nobody, while keeping the floor on spend. Reason: `potBalance` only moves on sessions, so E1 reads as broken to a payer.
3. **A decision on names, then make every surface agree.** Either the roster shows names and the promises say so (E1, E2, chrome, `/for-companies`, `/sponsor/apply`), or the roster becomes a floored count plus a lookup of one person, used only to end their benefit. Reason: the promises and `roster()` currently contradict each other.
4. **Open the domain confirm route.** Add `/sponsor/domains/confirm` to `openRoutes`, and give the company "Resend" and "Send to a different admin address". Reason: `lib/routing.ts` blocks the only intended user, and `domain_email` gates depend on this proof.
5. **Guided identifier setup.** Offer presets for staff numbers ("digits, length N", "starts with X"), a test box that runs the real `matchesGate`, and a warning when a domain gate names a domain that is not proved. Reason: the pattern and hint inputs share a label, and unproved domains fail silently.
6. **Rebuild the HR integration, or remove the tab.** Either push an event when an attestation is written (let a sponsor register a webhook) and let the answer gate enrolment, or hide the tab. Reason: `failedAttemptsFor` is mislabelled, the log can never fill, and `verifyEmployment` does not affect enrolment.
7. **Pot health warnings.** A low-balance threshold the company sets, one alert per period instead of one per booking, and an expiry warning. Reason: the only alert fires per booking once the pot is already empty, and it leaks timing.
8. **Enforce expiry, or stop promising it.** Reason: no code reads `expiresAt`.
9. **E5 for employees.** Pass `payFromPot`'s reason into the booking result, and show "your organisation's cover is not available right now; ask HR" on the pay page. Reason: E5 has no code.
10. **Self-serve account basics.** Forgot and reset password, change password, invite and remove users with roles, and edit organisation contacts. Reason: every one of these is operator-only today (`createSponsorUser`).
11. **Coverage visible to viewers, and employees told about reductions.** Show the percentage read-only to viewers, and send employees a notice when a reduction is scheduled. Reason: `CoverageForm` is admin-only, and E3's notice window has nobody to notify.
12. **Invoices a finance team can file.** Numbering unique per issuer, buyer details, a Print or Download button, and welcome credits excluded or marked as not paid. Reason: `invoiceFor` numbers per sponsor and treats a gift as paid.
13. **A spend statement.** A monthly or weekly floored statement with real numbers and a CSV export, with the heatmap labelled. Reason: the heatmap shows no figure at all, and finance cannot reconcile against it.
14. **A first-code action, and a printable poster page.** A "Create code" button, and a print layout without the portal chrome. Reason: `codeNone` is a dead end, and Print includes the chrome.
15. **Safer irreversible actions.** Cancel buttons and a final confirm on End their benefit, Replace this code, Remove field and Revoke key, plus success messages. Reason: `roster-list.tsx` and `code-card.tsx` have no cancel path, and several actions report nothing on success.
16. **Full Arabic.** Move `CoverageForm`, `DomainList`, `ConfirmDomain`, the domains header, `domainProblem`, every server action error, both emails and the "Working…"/"Saving…" labels to message keys. Reason: all of these are English literals on a bilingual product.
17. **Loading and error states for the group.** Add `loading.tsx` and `error.tsx` under `app/(sponsor)`. Reason: none exist.
18. **Remove or build the public-demo features.** Reason: `CompanyConsole` sells headcount, take-up, per-therapist spend and per-person caps that the portal does not have.
19. **Enquiry follow-through.** Notify staff and the applicant, detect duplicates, and ask for the country so the entity is right. Reason: `applyToSponsor` only logs, and it hard-codes `us`.
