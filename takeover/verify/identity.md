# IDENTITY verdicts

Verifier: IDENTITY domain (principals, cookies, middleware, switching, staff roles and refusals,
patient sign-up and handle proof, sign-in oracles, rate limits, record claim, invite and join
tokens, clinic staff, partner launch, verification documents, CSP, uploads, env guards,
committed credentials and personal data). Read only; nothing touched a database or the network.
Pure functions were run under `node --import tsx` where noted. No secret value is copied here:
credentials are cited by file:line only.

Carried in from MAP "Confirmed by the coordinator": item 1 (published console password, no
second factor) and item 8 (record claim with no ownership check). Not re-verified.

### ID-1 · Staff console signs in with a published password and no second factor
- Verdict: CONFIRMED (MAP Confirmed 1, Suspect 18; carried, not re-verified)
- Sources: code-06 Broken 1, DOCS-digest Stale 16, MAP Suspect 18
- Promise: A1, A2, A5
- Who is hurt and how: anyone who reads the public repository can sign in to the production staff console as the platform admin and confirm transfers, approve payouts or publish copy.
- Evidence: `docs/VALUE-STATEMENTS.md:251-257` (password and admin address in a generated doc), `scripts/seed-demo.ts:259,328` (seeded as super_admin), `lib/auth/actions.ts:170-295` (email plus password only; grep of lib and app for totp/mfa/two-factor finds nothing). Only `/admin/tv` has a second key (`lib/console/gate.ts`).
- Severity: S1
- Fix sketch: rotate the production admin password now and stop printing it (`scripts/_value-statements.ts` generates the doc); add a second factor (emailed code at minimum) to the `audience: "staff"` branch of `signIn`. Proof: signing in at `/staff/sign-in` with the documented password on production fails.
- Decision it came from: the PROVE-IT walk design ("one password for all of them", VALUE-STATEMENTS generator) and seed:demo run on production 2026-09-20.

### ID-2 · Record claim: any signed-in patient can take an unclaimed record by its id, and the two-question challenge is never required
- Verdict: CONFIRMED (MAP Confirmed 8; carried, not re-verified)
- Sources: code-02 Broken 1, code-08 Broken 2, code-10 Suspect 8 (claim-flow email hard-wired), MAP Confirmed 8
- Promise: P4
- Who is hurt and how: a person's whole therapy record (every clinician's chart) can be bound to a stranger's account, and the stranger decides who may read it; the "is this really you" questions that stop a recycled number or a relative's handset are skipped.
- Evidence: `app/(patient)/patient/claim/actions.ts:97` (personId from the client), `lib/data/claims.ts:200` (`startClaim` checks only exists and unclaimed), code sent to the caller's own inbox (`claim/actions.ts:119`), `lib/data/challenge.ts:531` `challengePassed` has no caller; `components/patient/claim-flow.tsx:196` always asks for email.
- Severity: S1
- Fix sketch: `startClaim` refuses a person not returned by `suggestionsFor` for this account's proven handles (or reached by an invite token), and requires `challengePassed` for phone matches. Proof: a verifier that calls `sendClaimCode` with a foreign personId gets a refusal.
- Decision it came from: sprint 6 ClaimFlow (email match) kept beside sprint 13's challenge; C121 moved the proof to the list, not to the act.

### ID-3 · A handle code read in your email inbox marks your PHONE as proven, which reveals whether a stranger's number has a therapy record
- Verdict: CONFIRMED
- Sources: code-06 Broken 2, code-06 Stale 17, code-06 Unclaimed (b)
- Promise: P4 (privacy wall "nothing about a record before a handle is proven", C121)
- Who is hurt and how: someone signs up with a stranger's phone number and their own email, confirms the code that lands in their own inbox, and the claim screen then says whether a clinician keeps notes for that number and shows the person's initials. Anyone whose number is on a clinician's chart can be outed as being in therapy.
- Evidence: `lib/patient-auth/handle.ts:104` records `channel = "whatsapp"` whenever the account has a phone; `:114-122` calls `notify({ email, phone })`, and `notify` sends on every channel that can carry it (`lib/notify/index.ts:268-340`, order at `:413-417`), so the email always goes, and while WhatsApp is not configured it is the only one that goes; `:187-191` then sets `phoneVerifiedAt` because the row says whatsapp. The comment at `:178-182` states the opposite rule. `app/(patient)/patient/claim/actions.ts:76-84` and `lib/data/challenge.ts:153` then match on the "proven" phone. Patch checked: `lib/patient-auth/code-signin.ts:117-137` does this correctly (sends only to the handle typed), so the fix pattern exists in the sibling file; handle.ts was not given it.
- Severity: S1
- Fix sketch: in `requestHandleCode`, send only on the channel recorded: phone only when WhatsApp is configured and a phone exists, otherwise email only with `channel: "email"`. Proof: a verifier with a phone-and-email account and WhatsApp unconfigured confirms the code and reads `emailVerifiedAt` set, `phoneVerifiedAt` null.
- Decision it came from: 13R.12 "both, not one" in `notify` (email as an addition) landed after 25.14's handle proof, which assumed one channel.

### ID-4 · Patient sign-in answers 2000 times faster when a number has no password account, and sign-up says in words that a number is registered
- Verdict: CONFIRMED (proved by execution)
- Sources: code-06 Broken 5, code-06 Stale 15 and 16, code-06 file notes on `lib/patient-auth/code-signin.ts` and `reset.ts`
- Promise: none of the 25 (the privacy wall "which numbers are in therapy")
- Who is hurt and how: anyone with a list of phone numbers can learn which belong to a patient who set a password, by timing the sign-in form; the sign-up form tells them outright ("Try signing in instead") for any registered number or email.
- Evidence: `lib/patient-auth/actions.ts:277-280` verifies a missing account against a bcrypt-shaped string; `lib/auth/password.ts:29-30` returns false for anything not `scrypt$...` without hashing. Ran `verifyPassword` both ways (scratchpad `timing.mts`): fake hash 0.02 ms, real hash 45 ms per call. Sign-up: `lib/patient-auth/actions.ts:150` "We could not create that account. Try signing in instead." vs sign-in `:282`; the comment at `:143-148` claims they match. Lesser timing gaps: `code-signin.ts:116-144` and `reset.ts:139-166` insert and notify only when an account exists (the rate limits of 5 per 15 min per network bound these). Clinician door does equalise (`lib/auth/actions.ts:212-216` hashes when no user).
- Severity: S2
- Fix sketch: replace `INVALID` with a real `scrypt$` hash computed once at module load (as the clinician door effectively does); make the sign-up refusal the same sentence as the sign-in failure or, better, send a code to the handle instead of refusing. Proof: the timing script above shows both paths within a few ms.
- Decision it came from: 25.11 (password optional), which added the no-password branch and the fake hash.

### ID-5 · Clinician and staff sign-in says "locked" or "suspended" before checking the password
- Verdict: CONFIRMED
- Sources: code-06 file note on `lib/auth/actions.ts`
- Promise: none
- Who is hurt and how: anyone can learn that an address belongs to a clinician or staff member whose account is locked or suspended, without knowing the password; a suspended clinician's status leaks to strangers.
- Evidence: `lib/auth/actions.ts:219-225` return distinct sentences before `verifyPassword` at `:227`; the unknown-address branch returns the generic sentence (`:212-216`).
- Severity: S4
- Fix sketch: verify the password first and give the locked or suspended sentence only when it is right (or keep the generic sentence for both). Proof: an unknown address and a locked address with a wrong password get the same reply.
- Decision it came from: none visible.

### ID-6 · Open redirect after clinician sign-in (`next=/\host`)
- Verdict: CONFIRMED (code level; the final browser hop is UNTESTABLE HERE)
- Sources: code-06 Broken 13
- Promise: none
- Who is hurt and how: a phishing link to the real `/login` (or `/session-expired`) sends a clinician, after they type their real password, to a look-alike site that can ask them to "sign in again".
- Evidence: `lib/auth/actions.ts:293` accepts any `next` that starts with "/" and not "//"; ran it: `"/\\evil.example/x"` passes and `new URL(it, "https://24therapy.app")` resolves to `https://evil.example/x`. `next` arrives from the query string (`app/(auth)/login/page.tsx:51`, `components/auth/forms.tsx:88`) and is forwarded by `app/session-expired/route.ts:38` with the same test. Same test at `lib/auth/guard.ts:52`. The staff branch is safe (`:282-284` requires `/admin`).
- Severity: S3
- Fix sketch: one helper `safeNext(next)` that parses with `new URL(next, appUrl)` and accepts only when the origin equals `appUrl`; use it at all four sites. Proof: unit test with `/\x`, `/%5Cx`, `//x`, `https://x` all falling back to `/dashboard`. Walk: sign in via `/login?next=/%5Cexample.com` and watch where the browser lands.
- Decision it came from: none visible.

### ID-7 · Clinician and staff password reset has no rate limit and no audit
- Verdict: CONFIRMED
- Sources: code-06 Broken 14
- Promise: A5 ("every read is written down", in spirit)
- Who is hurt and how: anyone can make the product send unlimited reset emails to any clinician or staff address, from any network, and nothing records it; it also spends mail quota and can get the sending domain throttled.
- Evidence: `lib/auth/actions.ts:307-341` has no `consume` call and no `audit` (the file's limiter is used only at `:186`); only caller `components/auth/forms.tsx:243`. Patient reset is limited (`lib/patient-auth/reset.ts:121`).
- Severity: S3
- Fix sketch: `consume(callerKey("reset"), 5, 15*60)` plus a per-address limit, and an `auth` audit row when a token is issued. Proof: sixth request in a window is refused.
- Decision it came from: none visible.

### ID-8 · A5: a non-founder staff member is bounced to "Verify your practice", and no refusal is recorded anywhere
- Verdict: CONFIRMED
- Sources: code-09 Broken 1, code-09 Broken 11, code-06 file note on `lib/auth/guard.ts`, code-06 Promise evidence A5
- Promise: A5 ("refused and redirected rather than shown an error, and the refusal is on the record")
- Who is hurt and how: the demo "Support, not a founder" account (and every real support hire) signs in and lands on the clinician onboarding form asking for a licence; several links in their own console (Overview, the logo, Radar control, and for managers Ratings, Audit log, Usage, Errors) do the same. Nobody can later see that they were refused.
- Evidence: `lib/auth/actions.ts:282-284` sends every back-office role to `/admin`; `app/(admin)/admin/page.tsx:13` is `requireRole("super_admin")`; `lib/auth/guard.ts:75-78` refuses with `redirect("/dashboard")` and no audit; `app/(app)/layout.tsx:115-119` sends anybody not cleared to `/onboarding`; `lib/data/verification.ts:166-167` clears only super_admin or approved; `app/(app)/onboarding/page.tsx:28` bounces only super_admin. Nav: `app/(admin)/layout.tsx` shows Overview (`/admin`) and Radar (`/admin/radar`, page `requireRole("super_admin")`) to every role, and Ratings, Audit, Usage, Errors to managers while those pages require super_admin (`audit/page.tsx`, `usage/page.tsx:34`, `errors/page.tsx`, `ratings/page.tsx`). `transfers/page.tsx:150` links clinician payers to founder-only `/admin/therapists/<id>`. No guard in `lib/auth`, `lib/clinic-auth`, `lib/sponsor-auth`, `lib/partner-auth` writes an audit row (grep); only the console key denial is recorded (`lib/console/gate.ts:110-115`).
- Severity: S2
- Fix sketch: land non-founders on `/admin/support` (the first page `requireStaff` admits); give `requireRole` a staff-aware refusal that redirects to `/admin/support?refused=<path>` and writes `audit({category:"auth", action:"refused", resourceKey: path})`; hide nav items by the same role list the page uses (one table, read by both). Proof: the A5 walk with the support account ends on a console page with a sentence, and `/admin/audit` shows the refusal.
- Decision it came from: 20.8 to 20.10 (back office) and 76.53, which fixed one nav item (`isOwner` for financial model) and left the others.

### ID-9 · A staff account creates a clinician verification row when bounced to onboarding
- Verdict: PARTLY
- Sources: code-09 Suspect 6
- Promise: A5
- Who is hurt and how: nobody is harmed today; a support person's account quietly acquires a draft "clinician verification" row, which makes them look like an applicant in any count that reads the table.
- Evidence: `app/(app)/onboarding/page.tsx:26-33` calls `ensureVerification(actor)` for every non-super_admin; `lib/data/verification.ts:120-129` inserts `state: "draft"`. Handled part: `reviewQueue` shows only `submitted` by default (`verification.ts:173`), and trigger 0083 derives `users.verification_status` from the row (draft is not approved), so no access is granted.
- Severity: S4
- Fix sketch: onboarding redirects any back-office role to the console, not only super_admin (subsumed by ID-8's fix). Proof: signing in as staff creates no `therapist_verifications` row.
- Decision it came from: none visible.

### ID-10 · A staff cookie passes every clinician page that only calls `requireUser`
- Verdict: PARTLY
- Sources: code-06 Suspect 10, code-06 Looks handled 1
- Promise: A5
- Who is hurt and how: a support or manager account can open the clinician's Settings, Billing and Earnings pages for its own (platform) organisation and run their actions, such as changing a seat count; it cannot reach any patient screen.
- Evidence: one cookie and table for both (`lib/auth/session.ts:22`, `lib/routing.ts:197-205`). `app/(app)/layout.tsx:64` `OPEN_TO_UNVERIFIED = ["/onboarding","/settings","/billing","/earnings"]`; every other clinician page is redirected to onboarding for a non-cleared staff account (`:117`), and patient-facing actions use `requireVerified`. Handled part: the staff door refuses non-back-office accounts and the practice door refuses back-office accounts (`lib/auth/actions.ts:250-262`); `requireStaff` guards `/admin` (`lib/auth/guard.ts:154-157`). A super_admin is "cleared" and does reach the whole clinician app for its own org (by design, `verification.ts:163-167`).
- Severity: S4
- Fix sketch: `requireUser` (or the app layout) redirects back-office roles to `/admin` unless the path is on a short allow list. Proof: staff opening `/billing` lands in the console.
- Decision it came from: C94 / 21R.1 (two doors, one cookie).

### ID-11 · Total View reads of notes, transcripts and copilot conversations are not written down
- Verdict: CONFIRMED
- Sources: code-06 Broken 3, code-09 Broken 5, code-06 Unclaimed (b)
- Promise: A5 ("every read is written down"); `/security` copy
- Who is hurt and how: a founder with the two console keys can read any patient's notes, transcripts, copilot conversations and risk flags across every practice, and the audit log shows only that the console was unlocked, not whose record was opened.
- Evidence: `app/(admin)/admin/tv/page.tsx:33-66` loads `peopleByEmail`, `conversationFor`, `sessionsFor`, `sessionDetail` with no `audit` call; `lib/console/reads.ts` has none either (grep: `auditLog` appears only in the `auditStream` reader at `:366`). Only unlock and deny are audited (`lib/console/gate.ts:78,110,127`). Handled part: a manager never reaches clinical content, `elevated()` requires super_admin (`lib/console/gate.ts:150`, code-09 Handled 9).
- Severity: S1 (privacy wall and a public promise)
- Fix sketch: `auditPhi` with `category: "break_glass"` for each person or session opened (as `app/(admin)/admin/therapists/[id]/page.tsx:40-55` already does), written before the read. Proof: open a session in Total View, then find the row naming that session in `/admin/audit`.
- Decision it came from: 76.1 (business board on the same page) and the console gate sprint; the gate audits the key, not the reads.

### ID-12 · Console board refresh actions are reachable by a manager
- Verdict: WRONG
- Sources: code-09 Suspect 9
- Promise: none
- Who is hurt and how: nobody. The reader believed the page was founder only; it is manager and above, and the actions carry the same guard.
- Evidence: `app/(admin)/admin/tv/page.tsx:33` `requireManager()`; `app/(admin)/admin/tv/board-actions.ts:40-81` every action `requireManager()`. The clinical half of the page is behind `elevated()` which requires super_admin (`lib/console/gate.ts:150`).
- Severity: S4
- Fix sketch: none needed. If the founders want the business board founder-only, change both guards together.
- Decision it came from: 76.1.

### ID-13 · Signing in at both doors leaves the clinician and clinic-manager principals live together
- Verdict: CONFIRMED
- Sources: code-06 Broken 12, code-06 file note on `lib/clinic-auth/switch.ts`
- Promise: none of the 25 (ruling C352 "never one session carrying both capability sets")
- Who is hurt and how: a linked person who uses `/login` and `/clinic/sign-in` in one browser holds both the clinical and the management grant at once, which the ruling forbids; no data crosses between them because each guard reads only its own cookie.
- Evidence: `app/(clinic)/clinic/sign-in/actions.ts:18-36` mints a clinic session without touching `24t_session`; `lib/auth/actions.ts:264` mints a clinician session without touching the clinic cookie. The switch paths do revoke first (`app/(app)/switch-principal/actions.ts:26-41`, `app/(clinic)/clinic/team/actions.ts:191-203`, `lib/clinic-auth/switch.ts:80-81`). Reader's side note that `leaveClinicPrincipal` does not check the user is still in the clinic: not a defect, the linked user is the same human's own clinician account, reachable by their own password anyway.
- Severity: S3
- Fix sketch: in `signInClinic`, if the manager has `linkedUserId`, revoke that user's `auth_sessions`; in `signIn`, revoke clinic sessions of any manager linked to the user. Proof: sign in at both doors, the first cookie is dead.
- Decision it came from: C352 / C413, enforced on the switch path only.

### ID-14 · Clinic role editor saves the wrong capabilities when the practice has one role
- Verdict: CONFIRMED (React semantics; a browser walk would show it)
- Sources: code-11 Broken (components/clinic/team.tsx)
- Promise: none of the 25 (clinic staff, Unclaimed 3)
- Who is hurt and how: a practice admin with one custom role presses Edit, sees the boxes empty (or ticked from an abandoned "add" attempt), saves, and silently strips or changes what their receptionist can do.
- Evidence: `components/clinic/team.tsx:161` keeps the same `<form>` mounted while `roles.length < 2`; only the name input is keyed (`:170`); the checkboxes use `defaultChecked` with no key (`:180-187`), which React applies only at mount. `updateRole` replaces the stored list (`lib/data/clinic-team.ts:140`).
- Severity: S3
- Fix sketch: `key={editing?.id ?? "new"}` on the `<form>` (or the fieldset). Proof: with one role, Edit shows that role's ticks.
- Decision it came from: 63.3 (form hidden at two roles).

### ID-15 · Clinic staff: the admin types the colleague's password, staff cannot be removed, and no clinic principal can reset a password
- Verdict: CONFIRMED
- Sources: code-08 Suspect 6, code-08 file notes on clinic sign-in, sponsor sign-in and partner sign-in pages
- Promise: none of the 25
- Who is hurt and how: the practice owner knows every receptionist's password and can sign in as them; a receptionist who leaves cannot be taken off the team; a clinic manager, sponsor admin or partner developer who forgets a password has no way back in except calling us.
- Evidence: `app/(clinic)/clinic/team/actions.ts:106-117` passes the form's password to `addStaff` (`lib/data/clinic-team.ts:260-300`), no forced change (grep `mustChange`: none). No staff-removal function exists (`lib/data/clinic-team.ts` exports roles, `addStaff`, `setAssignments`, `revokeClinicSessionsFor` only; no caller removes a manager row). No reset route under `app/(clinic)`, `app/(sponsor)`, `app/(partner)` (sign-in pages render no forgot link). Handled part: a deleted role grants nothing (`lib/clinic-auth/session.ts:203-208`), so an admin can disable a leaver by deleting their role, but that disables everybody on the role.
- Severity: S2
- Fix sketch: invite staff by emailed link that sets their own password (the clinic join-token pattern already exists in `lib/data/clinic-admin.ts`); add `removeStaff` (soft delete plus `revokeClinicSessionsFor`); one shared reset-by-email for the three portals. Proof: a removed staff member's cookie stops working on the next request.
- Decision it came from: sprint 63 (clinic staff), design note at `app/(public)/design/clinic/page.tsx:324,383`.

### ID-16 · Clinic staff: never-delegable capabilities, role deletion fallback and assignment tenancy
- Verdict: HANDLED
- Sources: code-06 Suspect 11, code-01 Suspect (0093 role_id SET NULL; clinic_staff_assignments tenancy), code-01 file note on 0093
- Promise: none
- Who is hurt and how: nobody. The three holes the readers suspected are closed in code or schema.
- Evidence: DB CHECK `clinic_roles_never_delegable` exists and is validated (`drizzle/0093_clinic_staff.sql:59-66`), plus `refuseWithout` checks the role for the two never-delegable capabilities (`lib/data/clinic.ts:126-137`). Role deletion is soft (`lib/data/clinic-team.ts:183-195`), a deleted role grants nothing (`lib/clinic-auth/session.ts:203-208`), and a NULL `role_id` parses to no capabilities (`lib/clinic-auth/capabilities.ts:115-116`) on a manager whose built-in role is always `viewer` for staff (`clinic-team.ts:293`). Assignments: `setAssignments` checks the manager and every clinician belong to the practice (`clinic-team.ts:319-370`), and every scoped read also filters by the clinic's organisation (`lib/data/clinic.ts:333, 471`), so a clinician who leaves drops out.
- Severity: S4
- Fix sketch: none.
- Decision it came from: 63.3 to 63.7, C325, C331, C353.

### ID-17 · A clinic staff member without "schedule" lands on a crash page after signing in, and any staff member can open the note-filing log by URL
- Verdict: CONFIRMED
- Sources: code-08 file notes on `app/(clinic)/clinic/sign-in/actions.ts` and `records/page.tsx`, code-08 Suspect 5
- Promise: A5 ("refused screens redirect"), C2 in spirit
- Who is hurt and how: a receptionist given only "bills" signs in and sees "Something went wrong", with no way to reach the page they are allowed; any staff member, assigned or not, can type `/clinic/records` and read which clinician signed a note when, for every clinician in the practice.
- Evidence: sign-in always lands on `/clinic` (`app/(clinic)/clinic/sign-in/actions.ts:34`); `app/(clinic)/clinic/page.tsx:40,60` calls `clinicSchedule`, which throws `ClinicRefused` without `schedule.read` (`lib/data/clinic.ts:300`), and there is no clinic `error.tsx` (only `app/(patient)/error.tsx` and `app/global-error.tsx`). `app/(clinic)/clinic/records/page.tsx:24-29` uses `requireClinic` only and reads `writebacksFor(org)` unscoped, while the nav hides it behind `team.manage` (`components/clinic/chrome.tsx:55`). `/clinic/people` and `/clinic/bills` also use bare `requireClinic` and rely on the data layer throwing (`people/page.tsx:21`, `bills/page.tsx:40`), so they crash rather than redirect too.
- Severity: S2
- Fix sketch: land on the first tab the actor can open; page-level `requireClinicCapability` on every clinic page (as `earnings/page.tsx:35` does); `records` requires `team.manage`. Proof: a bills-only role signs in to `/clinic/bills`; `/clinic/records` redirects it.
- Decision it came from: 63 (capabilities) added after the 54 pages were written.

### ID-18 · SIMULATION_RUNNING widens every brute-force limit 25 times, including the console key unlock
- Verdict: PARTLY
- Sources: code-06 Suspect 4, code-06 file note on `lib/rate-limit.ts`, code-13 Suspect (verify-limits caching), SIMULATION-digest s1
- Promise: none directly (A1 and A5 through the console)
- Who is hurt and how: while the flag is on, a password guesser gets 500 tries per 15 minutes per network at the staff door, 125 per hour at the console's two-key unlock, and a stranger's phone can be sent 125 codes per 15 minutes; nothing on screen says the limits moved.
- Evidence: holds in code: `lib/rate-limit.ts:97,110-111` multiplies every non-`global:` key; `lib/env.ts:159` reads the flag; console unlock uses `consume(callerKey("console-unlock"), 5, 3600)` (`lib/console/gate.ts:99`), not exempt. Does not hold today: the flag also makes `robots.txt` disallow everything (`app/robots.ts:30-34`), and MAP "Live-site checks, 2026-09-22" fetched `Allow: /` from production, so the flag was off on production that day. The per-account lockout (5 failures, `lib/auth/actions.ts:227-240`) is not multiplied, which bounds guessing against one staff account. Side note: `purgeExpiredLimits` compares with Node's clock (`lib/rate-limit.ts:304-310`), the two-clock mistake fixed elsewhere in the file.
- Severity: S3 (S1 whenever the flag is set on production, given ID-1)
- Fix sketch: exempt `console-unlock`, `login`, `patient:*code*` and reset keys from the multiplier (a short deny list beside the `global:` exemption); show "limits widened" in the violet strip. Proof: `verify:limits` asserts the console key stays at 5 with the flag on.
- Decision it came from: 76.49 (simulation on production), HAZARDS H50.

### ID-19 · Every per-network limit trusts the first X-Forwarded-For entry
- Verdict: UNTESTABLE HERE
- Sources: code-06 Suspect 3, code-06 file note on `lib/request.ts`
- Promise: none
- Who is hurt and how: if the app is ever reachable other than through Vercel's edge, an attacker rotates one header and every sign-in, code and booking limit in the product stops applying.
- Evidence: `lib/request.ts` returns `x-forwarded-for.split(",")[0]`; `lib/rate-limit.ts:298-301` buckets on it. Safe only if the platform overwrites the header; Vercel documents that it does. The `unknown` fallback shares one bucket (`:292-297`), which fails safe.
- Severity: S3
- Fix sketch: prefer `x-vercel-forwarded-for` (or `request.ip`) when present; refuse to start in production without it. Walk: send a request with a forged `X-Forwarded-For` to production and see whether the audit row's IP is the forged one.
- Decision it came from: none visible.

### ID-20 · A partner API key is suspended at 60 calls a minute across all its live sessions
- Verdict: UNTESTABLE HERE
- Sources: code-05 Suspect 7
- Promise: none
- Who is hurt and how: a partner running more than a few live sessions at once could hit 60 calls a minute with audio uploads and transcript polls, and the key is then dead mid-session until one of us re-enables it.
- Evidence: `lib/partner/keys.ts:59` `CALLS_PER_MINUTE = 60`, `:318-334` suspends rather than refuses, per key, over every route using `withKey` (15 call sites under `app/api/partner/v1`, including `sessions/[ref]/media`). Whether real traffic reaches 60 depends on how an integrator batches (the media route accepts whole-file upload or streaming).
- Severity: S3
- Fix sketch: separate the oracle-shaped routes (lookups by identifier), which should suspend, from session-traffic routes, which should refuse the surplus or have a per-session budget. Walk: the D1 partner simulation with four concurrent sessions.
- Decision it came from: C265.

### ID-21 · A partner launch link is a bearer credential held by the partner's server and signs in as the clinician for an hour
- Verdict: CONFIRMED (as built; by design, with the reader's concern holding)
- Sources: code-05 Suspect 1, code-05 file note and Stale 17, code-07 Looks handled 1
- Promise: none of the 25 (the design constant `A_PARTNER_NEVER_READS_A_CHART`, `lib/partner/api.ts:513`)
- Who is hurt and how: a partner platform (or anything that logs the URL within two minutes) can open a full clinician session on its own clinicians' accounts, with that clinician's whole caseload, notes and transcripts, without the clinician being present.
- Evidence: `lib/partner/launch.ts:100-172` mints a two-minute single-use token for any clinician of this partner and returns the URL to the partner's server (`app/api/partner/v1/launch/route.ts:43-49`); `redeemLaunch` (`:177-265`) needs nothing but the token and sets the ordinary `24t_session` cookie for one hour. Handled part (code-07 Handled 1 is right): only a verified clinician at an organisation with this `partner_id` and `partner_billed` can be launched, re-checked at redemption (`:125-137`, `:210-223`); the landing target is an allow list; redemption is throttled and audited (`partner.launch`). The comment at `:65-67` ("no credential of ours in their hands") is not true of the URL.
- Severity: S2
- Fix sketch: bind redemption to the clinician: require an existing clinician session in that browser on first launch (a one-time "link this partner" consent), or send the clinician a one-tap confirm; at minimum limit the launched session to the target screen. Proof: a launch URL opened in a fresh browser with no clinician session lands on sign-in.
- Decision it came from: 42.3, 55.9.

### ID-22 · An approved clinician can replace their licence, ID and licence number and stay approved
- Verdict: CONFIRMED
- Sources: code-07 Broken 8, code-07 file note on onboarding actions, code-10 Suspect 6
- Promise: C1 (the verification state on the radar row)
- Who is hurt and how: after approval, a clinician (or someone holding their session) can swap the reviewed licence photo for another file or change the licence number, the reviewed file is deleted, and the radar keeps showing them as verified to people in crisis. Nobody reviews the change.
- Evidence: `app/(app)/onboarding/actions.ts:57` and `:117` refuse only `submitted`; `:131-141` writes the new file and deletes the previous; state stays `approved`; details saved at `:77-94` with no audit. Only the form locks (`components/onboarding/verification-form.tsx:153`). No trigger on `therapist_verifications` refuses it (0083 only derives `users.verification_status`). Handled part: `submitForReview` refuses an approved row (`actions.ts:165`), so code-10 Suspect 6 is HANDLED.
- Severity: S2
- Fix sketch: both actions refuse `approved` (a changed licence is a new application: move to `draft`, which drops them off the radar, and audit it). Proof: a direct action call on an approved account returns an error and the file is unchanged.
- Decision it came from: C351 (two-rejection purge) reworked these actions; the approved state was never considered.

### ID-23 · T4 and task 115: the join link and its resume
- Verdict: PARTLY
- Sources: code-07 Suspect 13 (task 115), code-07 file note on `app/join/[token]/page.tsx` (T4 verdict), code-03 Promise evidence T4
- Promise: T4
- Who is hurt and how: a signed-in patient opening an invitation for a chart that has not yet been claimed by their account is asked their name like a stranger instead of "Joining as"; they can still join.
- Evidence: task 115 HANDLED: `joinByToken` always writes `guestName` (`lib/data/sessions.ts:838-845`), so the resume condition at `app/join/[token]/page.tsx:190-194` holds after the first name. T4 holds only when a `patients` row for the session's patient carries the signed-in person (`page.tsx:114-125`); an invitation sent to an unclaimed chart, or to a second practice's chart, falls back to the form.
- Severity: S3
- Fix sketch: none needed for 115. For T4, the walk must use a claimed chart (the `live` position does); a signed-in patient on an unclaimed chart could be offered "Is this you? Claim it" rather than a bare form.
- Decision it came from: 79.2 (Joining as), task 109.

### ID-24 · Patient sign-in ignores `next`, so "Sign in" from an invite loses the invite
- Verdict: CONFIRMED
- Sources: code-08 Suspect 12
- Promise: P4 (the invite is the main way to claim a record), T4-adjacent
- Who is hurt and how: a patient who already has an account taps "Sign in" on their clinician's invite, signs in, and lands on the patient home with no sign of the invite; they have to find the email and open the link again.
- Evidence: `app/(patient)/patient/invite/[token]/page.tsx:95` links to `/patient/login?next=/patient/invite/<token>`; `app/(patient)/patient/login/page.tsx` reads no `next`; `components/patient/auth-form.tsx` carries only `inviteToken` (sign-up); `patientSignIn` always `redirect("/patient")` (`lib/patient-auth/actions.ts:288`), and the code sign-in form redirects to `/patient` too. Sign-up does honour the invite (`actions.ts:206-207`).
- Severity: S3
- Fix sketch: pass `next` through the login page to both forms, accept only paths under `/patient/` (with the ID-6 helper), redirect there. Proof: sign in from the invite page and land back on it.
- Decision it came from: 13.8 (invite page), 25.11 (code sign-in added without it).

### ID-25 · Clinician-side patient invite codes can be guessed without limit
- Verdict: CONFIRMED
- Sources: code-03 Suspect (portability.ts redeemInvite)
- Promise: P4
- Who is hurt and how: any signed-in clinician account, verified or not, can try codes in a loop; each hit returns the patient's first name and puts a request in that patient's consent list, which the patient may approve thinking it is their new therapist.
- Evidence: `lib/data/portability.ts:226-300` has no attempt count; caller `app/(app)/connect/actions.ts:30-32` only `requireUser`, no `consume`. Space 32^6 (about 1.07e9) against a few live codes per person, codes expire, so a hit is slow; but unmetered. Compare `requestAccess` limited to 2 a day (`lib/data/grants.ts:279`).
- Severity: S3
- Fix sketch: `consume(callerKey("invite-redeem"), 10, 3600)` plus a per-user daily cap. Proof: the eleventh wrong code in an hour is refused.
- Decision it came from: C107 / sprint 26 portability.

### ID-26 · Opening a clinic join link stamps "terms shown" even when a mail scanner opened it
- Verdict: CONFIRMED
- Sources: code-08 Suspect 8
- Promise: none of the 25 (C261 "proof we said it")
- Who is hurt and how: the record meant to prove a clinician was shown "the practice sees your patients' names" can be a link preview bot's fetch; in a dispute it proves less than it claims.
- Evidence: `lib/data/clinic-admin.ts:312-355` stamps `terms_shown_at` inside `resolveInvitation`, called by the page render (`app/(clinic)/clinic/join/[token]/page.tsx:21-38`); stamped only once (`isNull` at `:353`), so the first fetch wins. Same shape for `patients.clinic_visibility_shown_at` (`lib/data/clinic-visibility.ts:92`).
- Severity: S4
- Fix sketch: stamp in the accept action from a hidden field the page rendered (the moment of acceptance), keep the render stamp as "first opened". Proof: a HEAD or bot GET leaves the acceptance stamp null.
- Decision it came from: C261.

### ID-27 · A patient's "Open your session" email link lands on the clinician sign-in page
- Verdict: CONFIRMED (proved by running `routeDecision`)
- Sources: code-07 Suspect 1, MAP Confirmed 3 (the id travels in booking emails)
- Promise: P1, P2
- Who is hurt and how: a patient who booked from a clinician's public calendar, or was booked from `/bookings`, taps "Open your session" in the confirmation or reminder and is asked for a clinician's email and password; the join link they need is not in the message. The session id in that URL is also the capability MAP Confirmed 3 describes.
- Evidence: links built at `app/(public)/t/[id]/book/actions.ts:160`, `app/(app)/bookings/actions.ts:127`, `app/api/cron/[job]/route.ts:541`, all `${appUrl}/sessions/<id>`. `app/(patient)/sessions/[id]/` holds only `recovery-actions.ts`, no page, so the path resolves to the clinician route. Ran `routeDecision("/sessions/abc", {})` and with a patient cookie: both `{"kind":"redirect","to":"/login"}` (scratchpad `route.mts`).
- Severity: S2
- Fix sketch: send `/join/<joinToken>` (which `bookSlot` now mints, `lib/data/scheduling.ts:485`) instead of the session id. Proof: `verify:notices`-style check that no patient-bound `notify` link contains `/sessions/`.
- Decision it came from: 51.x calendar booking reused the clinician URL shape.

### ID-28 · The company's domain-proof link redirects the IT contact to the sponsor sign-in
- Verdict: CONFIRMED (proved by running `routeDecision`)
- Sources: code-08 Broken 5
- Promise: none of the 25 (blocks E1 to E5 for any company whose postmaster is not a portal admin)
- Who is hurt and how: the person who reads `postmaster@company` clicks the proof link and is asked to sign in to a portal they have no account on, so the company never finishes proving its domain and never gets a joining code.
- Evidence: link `lib/data/sponsor-domains.ts:112` `/sponsor/domains/confirm/<id>?t=`; `lib/routing.ts:298` opens only `SPONSOR_APPLY` inside `/sponsor`; `routeDecision("/sponsor/domains/confirm/abc", {})` returns a redirect to `/sponsor/sign-in`. The page's own comment (`app/(sponsor)/sponsor/domains/confirm/[id]/page.tsx:15-17`) says the clicker may have no account.
- Severity: S2
- Fix sketch: add `/sponsor/domains/confirm` to the sponsor principal's `openRoutes`; the page already checks the HMAC token. Proof: `routeDecision` returns pass for that path, and a control that `/sponsor/pot` still redirects.
- Decision it came from: 53.4 mailbox proof written after 53.5 fixed the open-route list.

### ID-29 · The video room's CSP relaxation is chosen per document, and the room is reached by client-side navigation
- Verdict: UNTESTABLE HERE (the concern holds in code)
- Sources: code-06 Suspect 1, code-06 file notes on `lib/security/csp.ts` and `next.config.ts`
- Promise: T1, T2 (a clinician whose call never connects has no session)
- Who is hurt and how: if the concern is right, a clinician who opens a session and then presses "Enter room" gets a room whose call never connects, because Daily's code is refused by the stricter policy of the page they came from; a full page reload would fix it, which nobody would guess.
- Evidence: `'unsafe-eval'` only when `isVideoRoom(pathname)` (`lib/security/csp.ts:128-183`, middleware `:141`); CSP binds to the document, as `next.config.ts:112-119` explains for Permissions-Policy. Every entry to the room is a `next/link`: `app/(app)/sessions/[id]/page.tsx:170`, `app/(app)/sessions/page.tsx:59`, `components/copilot/chat.tsx:321`, `components/radar/presence.tsx:506`. The room layout forces no reload (`app/(room)/layout.tsx`). The only daily-js user is `components/session/video-call.tsx:129` (`createCallObject`, runs in the page). CSP is enforcing unless `CSP_ENFORCE=0` (`csp.ts:261-265`).
- Severity: S1 if it reproduces (no session can be held), otherwise none
- Fix sketch: make the four room links plain `<a>` (full document load), or `window.location.assign` in the one room-entry handler. Walk: sign in as a clinician, open a session page, click Enter room, and read the console for a CSP `unsafe-eval` violation; then reload and compare.
- Decision it came from: TRAPS T5 / DAILY-HOSTS audit, which found `Function()` on a full page load.

### ID-30 · Every upload through a server action is capped at 2 MB, while receipts promise 25 MB and credentials 8 MB
- Verdict: CONFIRMED (code level; the exact error screen is UNTESTABLE HERE)
- Sources: code-06 Broken 6, code-06 file note on `next.config.ts`
- Promise: A1, A3 (a payer who cannot submit a receipt), C1 (a clinician who cannot upload a licence)
- Who is hurt and how: an Egyptian patient or company uploading a 3 MB phone screenshot of a bank transfer, or a clinician uploading a phone photo of their licence, gets a framework error instead of the product's sentence, and cannot finish paying or applying.
- Evidence: `next.config.ts:59` `serverActions: { bodySizeLimit: "2mb" }`; uploads go through server actions in `app/pay/[token]/actions.ts:202-219`, `app/(app)/billing/actions.ts:208`, `app/(sponsor)/sponsor/pot/actions.ts:221`, `app/(app)/onboarding/actions.ts:102-141` (called from `components/onboarding/verification-form.tsx:427`), and also patient documents, patient import, patient avatar and the contact form (grep of `instanceof File` in `app/**/actions.ts`). No client-side compression found (grep of `toBlob|compress|resize` in the upload components). `lib/uploads.ts:90-107` promises 25 MB "so your screenshot is 6 MB never blocks a payment".
- Severity: S2
- Fix sketch: raise `bodySizeLimit` to 26mb (or move uploads to a route handler / client-side Blob upload). Proof: submit a 6 MB image on `/pay/<token>` on a preview deployment.
- Decision it came from: 73.9 (receipts) never revisited the framework limit.

### ID-31 · Uploads: HEIC licence photos, blob URLs handed to browsers, and the two sibling upload routes
- Verdict: PARTLY
- Sources: code-06 Suspect 12, code-06 file note and Stale 18 on `lib/uploads.ts`, code-13 Suspect (sibling dynamic segments), code-09 Looks handled 6 and 7, code-07 file notes on `app/api/uploads/*`
- Promise: A5 ("every read is written down"), C1
- Who is hurt and how: an operator reviewing an iPhone licence photo sees a broken image; a payer's own receipt link is the raw public storage URL, readable by anyone it is forwarded to, with no record.
- Evidence: holds: `lib/uploads.ts:39` accepts HEIC for credentials and `components/admin/verification-review.tsx:84` renders it with `<img>` (Chrome and Firefox do not render HEIC). Every blob is `access: "public"` (`lib/uploads.ts:190-195`); the payer's receipt link is the raw `proofUrl` (`components/billing/pay-by-transfer.tsx:236-238`, `components/billing/withdraw.tsx:224-226`). Comment says 32 random bytes, code uses 24 (`:20, :143` vs `:168`), still unguessable. Handled: the operator's receipt view streams through an audited route (`app/(admin)/admin/transfers/receipt/[id]/route.ts:74`), identity documents go through `identityDocumentPath` to `app/api/uploads/[id]/route.ts` which audits before bytes (`app/(admin)/admin/verifications/page.tsx:138`). WRONG part: the sibling routes `app/api/uploads/[id]` and `app/api/uploads/[...path]` do not break the build; ran Next's own `getSortedRoutes` on both (sorts them, `[id]` first) with a control (`[id]` beside `[slug]` throws "different slug names").
- Severity: S3
- Fix sketch: convert HEIC to JPEG on upload (or refuse it with a sentence); serve the payer's receipt through a payer-scoped route. Proof: upload a HEIC on a preview and open the review screen.
- Decision it came from: H14 (blob URLs are secrets), 29.1.

### ID-32 · Environment guard: what `inspectEnv` does and does not refuse
- Verdict: PARTLY (proved by running `inspectEnv`)
- Sources: code-06 file note and Stale 3 on `lib/env.ts`, code-06 file note on `lib/security/csp.ts` (report-only reports to nobody)
- Promise: none directly
- Who is hurt and how: production boots with a one-character cron secret (the only lock on the crisis re-delivery and billing crons), and a `CSP_ENFORCE=0` left on switches off script protection with no warning and no report destination.
- Evidence: ran `inspectEnv` with production values: missing `CRON_SECRET` is an error, but `CRON_SECRET="x"` passes with no warning, and `CSP_ENFORCE=0` produces no problem at all (scratchpad `env.mts`, `env2.mts`). Handled: `DATABASE_URL`, `OPENAI_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN` required (`lib/env.ts:31-76`); `AUTH_SECRET` length and placeholder checked in production (`:224-236`; the comment at `:222` says "every environment", stale but harmless since Vercel previews run as production); the simulation branch and database must agree (`:195-220`). `app/api/revalidate/route.ts:57` compares the secret with an early-exit comparison and accepts it in the query string (code-07 file note).
- Severity: S3
- Fix sketch: `CRON_SECRET` and the revalidate secret at least 32 characters, compared with `timingSafeEqual`, header only; `CSP_ENFORCE=0` in production is a warn that the violet-strip style banner shows. Proof: `tests/safety.test.ts` gains the two cases above.
- Decision it came from: 76.43 (branch and database agree).

### ID-33 · Scripts and tests that write to whatever DATABASE_URL names, outside `writesTo()`
- Verdict: PARTLY
- Sources: code-16 Suspect 7, code-12 Suspect 9, code-12 Broken 3, code-13 Broken (unlabel-straddles, verify-migrations `--repair`), code-14 Broken 1, code-15 Broken 4, code-12 Looks handled 5
- Promise: none directly (every promise if production is written by mistake)
- Who is hurt and how: a person whose shell holds the production URL and runs one of these (a gate, a one-off script) writes test prices, deletes rows or re-passwords the super admin on production with no refusal.
- Evidence: no `writesTo` and no endpoint check in `scripts/unlabel-straddles.ts`, `scripts/verify-sprint5.ts`, `scripts/verify-sprint1.ts`, `scripts/verify-sprint2.ts` (they use `connect()` from `scripts/db.ts`, which has no guard), `.walkthrough2/q.ts` (grep counts 0). `scripts/seed.ts:126-131` skips `writesTo` for `--refresh-content` and then still creates the org and upserts a super_admin with `SEED_ADMIN_PASSWORD` when set (`:135-200`); `ship:content` runs exactly that mode (`scripts/ship-content.ts:61`). `writesTo` reads only `DATABASE_URL` (`scripts/_verify.ts:193-195`), so a regional URL is unchecked (latent: no `DATABASE_URL_EG` today). Handled: the `on:production` wrapper strips `I_MEAN_PRODUCTION` for read commands and `writesTo` needs both flag and opt-in (`scripts/_verify.ts:204-247`); most verifiers do refuse the production endpoint inline (code-14 Handled 4, code-15 Handled 4).
- Severity: S3
- Fix sketch: move the guard into `scripts/db.ts` `connect()` itself (refuse the production endpoint unless `writesTo` ran), and make `--refresh-content` return after the content loop. Proof: `connect()` with the production endpoint and no flag throws; a control with the dev endpoint passes.
- Decision it came from: HAZARDS "one command reaches production", C148, H26.

### ID-34 · Reads inside a partner-launched session are recorded as the clinician's own, although the developer page promises they name the platform
- Verdict: CONFIRMED
- Sources: code-06 Suspect 9, code-06 file notes on `lib/audit.ts` and `lib/partner-auth/session.ts`
- Promise: A5 ("every read is written down"), P4 (the patient's access log)
- Who is hurt and how: a patient reading their access log sees their clinician's name for a read a partner platform made through a launch; the developer page tells integrators the opposite.
- Evidence: `lib/i18n/messages.ts:2236` "A read of a record appears in the patient's own access log ... naming your platform". `lib/audit.ts:86-95` has actor slots for users, patient accounts, sponsor users and clinic managers only; `lib/auth/session.ts` never reads `auth_sessions.partner_id` or `created_via` into the `Actor` (grep: no match), so every `audit()` during a launched session carries only the clinician. The one trace is the `partner.launch` row at sign-in (`lib/partner/launch.ts:245-252`).
- Severity: S3
- Fix sketch: carry `partnerId` on `Actor` from the session row and write it into `audit_log` (a nullable `actor_partner_id`, or `reason`); or change the sentence. Proof: a read during a launched session produces an audit row naming the partner.
- Decision it came from: 42.7 (the session row remembers the partner) never reached the audit writer.

### ID-35 · Committed credentials (values not copied; file:line only)
- Verdict: CONFIRMED (inventory; whether each account exists on production is UNTESTABLE HERE)
- Sources: MAP Suspect 18 and 19, code-12 Suspect 14, code-16 Suspect 15, DOCS-digest Stale 16, SIMULATION-digest s5
- Promise: A1, A2, A5 through ID-1
- Who is hurt and how: every password below is readable by anyone with the repository; the first group opens production today (ID-1), the rest open whichever database their accounts were created on.
- Evidence (grep of `git ls-files` for password, token and key shapes, plus `postgres://user:pass@`, `sk_`, `whsec_`, `npg_`, `AKIA`, `ghp_`, JWT and blob-token shapes):
  - Production demo password (shared by all twelve demo logins, including the super_admin): `scripts/_demo-cast.ts:30` (source), `docs/VALUE-STATEMENTS.md:253`, `docs/DEMO-LOGINS.md:12`, `docs/PROVE-IT.md:55`, `docs/TAKEOVER.md:594`. Our own takeover notes repeat it: `takeover/MAP.md:154`, `takeover/reading/BRIEF.md:31`, `takeover/reading/DOCS-digest.md:206`, `takeover/reading/code-06.md:584`.
  - Simulation cast password: `scripts/_cast.ts:55`, `scripts/logins.ts:40`, `docs/simulation/12-THE-LOGINS.md:19`, `docs/simulation/01-THE-CAST.md:59`, `docs/simulation/02-THE-SWARM.md:134`, and copied into `takeover/reading/SIMULATION-digest.md:24`.
  - Walkthrough accounts, four passwords including a staff admin (`admin@24therapy.test`): `.walkthrough2/people.json:2,7,13,20`; literals in `.walkthrough/p25.mjs:12`, `.walkthrough/settings.mjs:5`, `.walkthrough2/f21-stranger.mjs:13`, `.walkthrough2/f21b.mjs:9`. The walkthrough targets `http://localhost:3000` only (grep of `.walkthrough2/*.mjs`); the staff admin is created by `scripts/screens-prep.ts:22-23`, `scripts/browser/shot.mjs:38-39`, `scripts/probe.ts:461-462,1307-1308`.
  - Seed and fixture fallbacks that become real passwords on any database they reach: `.env.example:64` (a realistic literal, not a placeholder) with `scripts/seed.ts:47`; `scripts/demo.ts:29`; `scripts/seed-capture.ts:49,59`; `scripts/capture-therapist-money.ts:40`; `scripts/capture-coverage.ts:81`; `scripts/seed-coverage.ts:97`; `scripts/probe/_probe.ts:48`; `scripts/shoot-room.ts:31`; `scripts/demo-full.mts:57`; `tests/e2e.test.ts:67`; `scripts/verify-payout.ts:84` (hashed on the spot for a planted user).
  - Fixed capability tokens: `scripts/seed-demo.ts:1284,1305` seed two join tokens as literals into the production demo positions, so anybody can open those sessions' `/join/` pages; `scripts/_tmp-owed.ts:9` and `scripts/capture-coverage.ts:65` hold a capture-branch join token.
  - Not credentials (checked): `.env.example:2` and `tests/safety.test.ts:230-271` placeholder database URLs; `lib/env.ts:291,296` dev fallbacks refused in production (`:224-236`); `.walkthrough2/up.sh:10` placeholder webhook secret; Neon endpoint ids at `lib/env.ts:162` and `scripts/_verify.ts` are hostnames, not secrets. No API key, Stripe key, Neon password, JWT or blob token found.
- Severity: S1 for the first group (ID-1), S3 for the rest
- Fix sketch: rotate production demo passwords and stop generating them into docs (print "ask the founder" instead); delete `.walkthrough2/people.json` and read walkthrough credentials from an ignored file; seed fixed join tokens only on branches (`seed-demo` generates random ones on production). Proof on production (read only, by the founder): `SELECT email FROM users WHERE email LIKE '%@24therapy.test' OR email LIKE '%@example.com'` returns only the documented demo cast, and the staff admin above is absent.
- Decision it came from: PROVE-IT "one password for all of them"; C147 (writesTo) did not cover fixtures.

### ID-36 · Real-looking personal data committed (values not copied; file:line only)
- Verdict: CONFIRMED (inventory)
- Sources: MAP Suspect 19, DOCS-digest Stale 16, SIMULATION-digest Stale 13, code-01 file note on 0033, code-16 Suspect 11
- Promise: none (the repo rule "invented people use reserved addresses", `docs/simulation/00-START` and `evals/cases.ts:8-14`)
- Who is hurt and how: four real Gmail inboxes (founders and family, per the docs) are published beside a shared password and tied to named demo roles such as "Patient, not enrolled"; some comments record which first names sat on which address in production data; valid Egyptian mobile numbers are written to production and would be messaged the day WhatsApp is switched on.
- Evidence:
  - Four distinct Gmail addresses, 40 lines: `docs/VALUE-STATEMENTS.md:260,261,265`; `docs/DEMO-LOGINS.md:26,27,31,64`; `docs/PROVE-IT.md:47,49,52`; `docs/TAKEOVER.md:283`; `scripts/_demo-cast.ts:43,44,45,97,103,127`; `scripts/seed-demo.ts:272,285,362,518,677,678,681`; `scripts/verify-demo.ts:150,154,178,359,374,471`; `scripts/verify-contrast.ts:168,184,212`; `scripts/demo-full.mts:60`; `scripts/logins.ts:254`; `scripts/pitch-deck.cjs:1189`.
  - Production data described in comments (an address and the first names on the charts that carried it, "measured on production"): `PLAN.md:98` (C39), `drizzle/0033_people.sql:40`, `lib/data/people.ts:116`, `lib/db/schema.ts:3770`. Also `takeover/reading/code-01.md:250` repeats one.
  - Phone numbers: a personal-looking Egyptian mobile as the usage example of a script that sends a real WhatsApp message, `scripts/whatsapp-check.ts:5,44`; the valid-shaped test mobile MAP Suspect 19 names, at `components/patient/patient-editor.tsx:37`, `.walkthrough2/people.json:18`, `scripts/verify-sprint37r.ts:83,101,102,238`, `scripts/verify-sprint12.ts:219`, `scripts/whatsapp-check.ts:61`, `tests/crisis-line.test.ts:34,37`, `PLAN.md:140,1415,1588,5142`; eighteen patterned but valid-shaped Egyptian mobile numbers seeded onto production by `scripts/seed-demo.ts` (from `:272` to `:701`), valid-shaped (Egypt has no reserved fiction range); simulation cast numbers at `scripts/_cast.ts:281-441` and `docs/simulation/12-THE-LOGINS.md:71-106`.
  - A crisis-disclosure sentence "verbatim from the branch database": `tests/attribution.test.ts:68-76`. Whether that branch session was a real person is UNTESTABLE HERE (ask the founder; if any branch ever held a founder's real test call, remove it).
- Severity: S2 (the Gmail addresses beside a published password; the rest S3)
- Fix sketch: move the demo cast to reserved `@example.com`/`.test` addresses on production and keep real inboxes in an ignored file; strip the production measurements from comments; replace valid-shaped mobiles with numbers the notifier refuses (add a deny list for the seeded range in `lib/notify/whatsapp.ts`). Proof: grep for `@gmail.com` and `+2010` outside test fixtures returns nothing.
- Decision it came from: DEMO-LOGINS "the email half of any promise must be walked on one of the five real inboxes".

### ID-37 · Principal boundaries at the edge: middleware, cookies, locale header, layout fail-open
- Verdict: HANDLED
- Sources: code-06 Looks handled 2, 6 and 8, code-07 Looks handled 4, code-06 file notes on `lib/routing.ts` and `middleware.ts`
- Promise: A5
- Who is hurt and how: nobody. A sponsor, clinic, partner or patient cookie cannot open another principal's route, and each guard re-reads its own session table.
- Evidence: `lib/routing.ts:371-396` consults only the owning principal's cookie; ran `routeDecision("/sessions/abc", { patient: true })` and it still redirects to `/login`; `/admin/tv` with no cookie goes to `/staff/sign-in`. Guards re-check revocation, idle and absolute expiry in the WHERE (`lib/auth/session.ts:110-186`, `lib/clinic-auth/session.ts:152-179`, `lib/sponsor-auth/session.ts:110-120`, `lib/partner-auth/session.ts:111-121`, `lib/patient-auth/session.ts:153-161`). The clinic principal carries `clinicOrganizationId` and no user id, and `audit` refuses a clinic row naming a patient (`lib/audit.ts:103-105`). `x-locale` deleted before set (`middleware.ts:171`). `app/(app)/layout.tsx:116-119` fails open without `x-pathname`, but patient-facing actions use `requireVerified`. `/api/*` is outside middleware by design and each handler authenticates itself (launch, uploads, transcribe routes checked). Residual: staff and clinicians share one cookie (ID-10), and "six principals" is five cookies (`lib/routing.ts:212`), which is Stale MAP 3's answer: the seventh (clinic staff) is built, on the clinic cookie.
- Severity: S4
- Fix sketch: none.
- Decision it came from: C230, C259, 21R.1.

