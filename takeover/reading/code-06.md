# Slice 06: lib-rest

## Files

### lib/access/state.ts (252 lines)
- For: pure arithmetic deciding what a therapist may see about a patient (five access states, capability set per state).
- Decides: `ACCESS_STATES` (23-29): no_relationship, unclaimed_bare, unclaimed_documented, granted, revoked. `isLiveGrant` (64-68) granted AND not expired, compared at read time not by cron. `accessStateFor` (87-97): no row -> no_relationship; unclaimed -> documented or bare; claimed -> live grant ? granted : revoked (so a claimed record with a pending or rejected grant is "revoked", i.e. degraded). `isGated` (119-121) only unclaimed_bare is gated, always on. `capabilitiesFor` (128-211): revoked keeps copilot=true over own material, liveProfile/files/diagnosis false; no_relationship all false including no request-access button. `REJECTION_REASONS` (243-247) three presets, no free text.
- Assumes: callers pass `documented` as diagnosis AND typed/dictated history; callers actually scope the copilot to own material when state is revoked (copilot=true in revoked relies on the retrieval layer filtering, not this file).
- Promises: T5 (copilot only while patient allows). Here `revoked` still has `copilot: true` (174). T5 says "a revoked grant stops it on the next question". That is only kept if lib/ai scopes a revoked therapist's copilot to their own transcripts and notes; this file does not stop the copilot. P4 (patient decides readers) partly.
- Notes: comment 99-118 says `gateActiveFrom` date removed; the gate is unconditional. `explain()` strings are English-only, hard-coded (not i18n) at 214-230.

### lib/alarm.ts (453 lines)
- For: client-only singleton AudioContext alarm for the clinician portal (soft, ring, urgent, cancel tones), title flashing, notification permission.
- Decides: `armAlarm` (175-209) awaits resume raced against 1.5s/300ms; state locked/ready/blocked. `startRinging` (377-398) no timeout by design. `REMEMBER_KEY` "24t.alarm.armed" in localStorage (49).
- Assumes: called from a user gesture; `tests/alarm.test.ts` asserts clock moved.
- Promises: none directly (supports P1 indirectly: clinician noticing a paid patient).
- Notes: no server code, no data. `flashTitle` text is passed by caller.

### lib/audit.ts (158 lines)
- For: the single audit-log writer, `audit()` and `auditPhi()`.
- Decides: exactly one actor among four slots: clinician/staff `actor` (users), `patientAccountId`, `sponsorUserId`, `clinicManagerId` (86-95); a clinic manager's row may never name a patient (103-105); non-uuid resourceId goes to `resource_key` (129-130, fixes H6 centrally). Awaited and allowed to throw (57-65).
- Assumes: `audit_log` columns actor_user_id, actor_account_id, actor_sponsor_user_id, actor_clinic_manager_id, resource_key exist (0086). `clientIp`/`clientUserAgent` from lib/request.
- Promises: A5 ("every read is written down") depends on callers. Serves it structurally.
- Notes: there is NO slot for the partner (EHR) principal. A partner act cannot be audited through this function except as a clinician `actor` or with no actor at all (both null is allowed: `actors.length > 1` only refuses two). Staff console users are `Actor`s (users table). Region pinned to default (17), counted by verify:sprint30. H6 in HAZARDS.md is effectively handled here (129-130) but HAZARDS still lists H6 as "live".

### lib/auth/actions.ts (424 lines)
- For: server actions for the clinician AND staff principal: signUp, signIn (two audiences), signOut, requestPasswordReset, resetPassword, changePassword.
- Decides: `signUp` (63-149) creates org + user role "therapist" (never from form, 109-112) + payg subscription in one tx; org slug CSPRNG suffix (40-51). `signIn` (170-295): per-connection limiter `consume(callerKey("login"), 20, 15min)` (186); per-account lockout 5 failures -> 15 min (33-34, 229-241); audience check after password (250-262): staff door refuses non back-office, practice door refuses back-office, no session minted; back-office lands on `/admin` or a `next` starting `/admin` (282-285); clinician lands on `next` if it starts with "/" and not "//" else /dashboard, or /onboarding if not cleared (287-294). `requestPasswordReset` (312-341) 1 hour sha256-hashed token in `auth_tokens`, always ok. `resetPassword` (343-391) single use, revokes all sessions. `changePassword` (393-424) revokes all sessions.
- Assumes: `BACK_OFFICE_ROLES` in schema; `lib/data/verification` `isCleared`/`practiceState`; `sendPasswordReset` in lib/mail.
- Promises: A5 partly (signin/signout/reset audited under category auth). Staff and clinicians are one principal family: same table, same cookie (see session.ts).
- Notes: account enumeration leaks before the password is checked: a locked account answers "Too many attempts" (219-221) and a suspended one "This account has been suspended" (223-225) while an unknown address gets the generic sentence. `requestPasswordReset` has no rate limit and no audit (312-341): anyone can make the product send unlimited reset emails to any clinician or staff address. `next` check (293) accepts `/\evil.example` (starts with "/" not "//"), which browsers treat as protocol-relative: an open redirect after sign-in. All user-facing strings here are English literals, not i18n.

### lib/auth/doors.ts (80 lines)
- For: the four self-serve sign-in/sign-up doors (therapist, patient, company, clinic) shared by header menu and auth shell.
- Decides: `doors()` (46-74): company and clinic signup point at APPLY routes (no self signup); partner and staff deliberately absent (15-20). `otherWay()` (77-80).
- Assumes: `lib/routing` constants; i18n keys nav.signInAs.*, nav.applyAs.*.
- Promises: none directly.
- Notes: clean.

### lib/auth/guard.ts (170 lines)
- For: the clinician/staff authorization boundary: requireUser, requireRole, requireVerified, *Api variants, assertSameOrigin, requireStaff, requireManager.
- Decides: `requireRole` (75-79) allowlist over closed union, refusal is `redirect("/dashboard")` with no audit row. `bounceToLogin` (46-65) cookie present -> /session-expired, else /login or /staff/sign-in for /admin paths. `requireStaff` = BACK_OFFICE_ROLES, `requireManager` = MANAGER_ROLES (154-170). `assertSameOrigin` (121-138) missing Origin refused only in production.
- Assumes: middleware sets `x-pathname`; `/session-expired` route handler clears the cookie.
- Promises: A5 ("a role is a list, not a rank" kept by the allowlist; "redirected rather than shown an error" kept; "the refusal is on the record" NOT done here: `requireRole` writes no audit). See lib/console/gate.ts for whether the console has its own audited refusal.
- Notes: a staff user refused a manager page is sent to `/dashboard`, which is the clinician app, not the console (77). Whether `/dashboard` then bounces a back-office role to /admin is decided in the app shell, not here.

### lib/auth/password.ts (62 lines)
- For: scrypt hashing (N=16384,r=8,p=1, 64 byte key), verify with timingSafeEqual, 10..200 char policy.
- Decides: `verifyPassword` reads N/r/p from the stored hash (32-35), so a stored hash dictates cost (a tampered row with huge N could DoS, but only a DB writer can plant it). `validatePassword` (57-62).
- Assumes: nothing.
- Promises: none.
- Notes: shared by several principals (grep shows sponsor/clinic/patient use their own checks in lib/data; not verified here).

### lib/auth/session.ts (231 lines)
- For: clinician AND staff console sessions: cookie `24t_session` (22), table `auth_sessions`, `Actor` type.
- Decides: token 32 random bytes, only sha256 stored (73-75, 81-86); idle 2h sliding (34), absolute 12h (36), lastSeen touched at most once a minute (38, 168-173); `getActor` (110-186) joins users + organizations, refuses revoked, idle, absolute-expired, non-active or deleted users. Cookie httpOnly, secure in production, SameSite lax, path "/" (89-97). `revokeAllSessionsForUser`, `purgeExpiredSessions`.
- Assumes: `organizations.region`; role on users.
- Promises: A5 structural only.
- Notes: staff console and clinicians share ONE cookie name and ONE session table; the only separation between the "staff" principal and the "therapist" principal is `users.role` at sign-in time (actions.ts 250-262) and `requireStaff` per page. So the brief's "six principals, six cookies" is five cookies: staff is a role on the clinician principal. A back-office user's Actor passes `requireUser`, so every clinician page that only calls `requireUser` (not `requireVerified`) is reachable to a staff cookie; what they see there is their own org's data (staff users have an organizationId). A second query (156-164) re-reads absoluteExpiresAt although the comment says "in the same read" (155). Minor wasted round trip, not a defect.

### lib/brand.ts (13 lines)
- For: `BRAND = "24Therapy"` constant, deliberately not a dictionary key.
- Decides/Assumes/Promises: none.
- Notes: none.

### lib/clinic-auth/capabilities.ts (186 lines)
- For: closed capability vocabulary for clinic staff and custom roles.
- Decides: `CLINIC_CAPABILITIES` (32-51): schedule.read, people.read, bills.read, earnings.read, reports.read, team.manage, seats.manage, clinicians.manage, export. `NEVER_DELEGABLE` seats.manage + clinicians.manage (73). `THERAPIST_SCOPED` schedule/earnings/reports (92-96). `parseCapabilities` drops unknown on read (115-124); `roleProblem` refuses unknown, overreach and undelegatable on write (135-174). `can` (184-186).
- Assumes: `lib/data/clinic.ts` enforces per query (`refuseWithout`, `scopeToAssigned`), a DB CHECK refuses undelegatable in stored roles (claimed at guard.ts 49-50, not verified here).
- Promises: C2 depends on it: `schedule.read` is documented as "names and appointment times, never a note" (33). That is patient names shown in the clinic portal, which contradicts C2 ("Nowhere in the clinic portal is ... a patient name"). Settles MAP contradiction 1 in README's favour at the vocabulary level; the rendered schedule is outside this slice. C5 (earnings.read) kept at vocabulary level.
- Notes: "role is a list, not a rank" is honoured for clinic staff too.

### lib/clinic-auth/guard.ts (102 lines)
- For: clinic principal page guards.
- Decides: `requireClinic` redirect to CLINIC_SIGN_IN; `requireClinicAdmin` non-admin -> redirect /clinic; `requireClinicCapability` refuses undelegatable to non-admin and any capability not held -> redirect /clinic (71-80); `assignedTherapists` null for admin or unscoped capability, array (possibly empty) otherwise (95-102).
- Assumes: data layer re-checks.
- Promises: A5-style (refusal redirects) for clinic, but no refusal is audited here.
- Notes: none.

### lib/clinic-auth/session.ts (248 lines)
- For: clinic manager / clinic staff session: cookie `CLINIC_COOKIE` (from lib/routing), table `clinic_auth_sessions`, `ClinicActor`.
- Decides: idle 30 min, absolute 8h (62-63); `getClinicActor` (145-236) all conditions in WHERE incl. manager not deleted, org not deleted, org.kind='clinic', clinicState='active' (168-179); admin capabilities derived, deleted role -> none, else parsed (203-208); therapistIds null for admin, assignments otherwise (216-224). Property spelled `clinicOrganizationId` (74) so it cannot be passed as an Actor.
- Assumes: `clinic_staff_assignments`, `clinic_roles.capabilities` jsonb.
- Promises: C2 structurally (no userId, no Role).
- Notes: lastSeen written on every request (184-187), no throttle unlike auth/session.ts.

### lib/clinic-auth/switch.ts (138 lines)
- For: switching between the clinician principal and the linked clinic manager principal (C352), revoke-then-mint, audited.
- Decides: `leaveClinicPrincipal` (50-95): linked user must exist and not be deleted, revokes all this manager's clinic sessions (via lib/data/clinic-team `revokeClinicSessionsFor`), audits `principal.switch` with clinicManagerId. `enterClinicPrincipal` (105-138): link read from manager row keyed on userId, audits; caller revokes clinician sessions.
- Assumes: callers `app/(app)/switch-principal/actions.ts:26-41` (revokeAllSessionsForUser then createClinicSession, correct order) and `app/(clinic)/clinic/team/actions.ts:191-203` (leave, revokeClinicSession, createSession, redirect "/").
- Promises: none of the 25 (C352 ruling).
- Notes: the ruling "never both live in one browser" is kept only on the switch path. `signInClinic` (`app/(clinic)/clinic/sign-in/actions.ts:18-36`) mints a clinic session without revoking a live `24t_session`, and `signIn` (lib/auth/actions.ts) mints a clinician session without revoking a clinic cookie, so a linked human can hold both principals at once by using the two sign-in doors. Each guard reads only its own cookie, so this is a breach of C352, not a data leak between principals. Comment at 66-69 says the clinician "must still be ... theirs", but only `deletedAt` is checked, not that the user is still in this clinic's organization. `enterClinicPrincipal` does not check clinicState; harmless because `getClinicActor` refuses a non-active clinic (so the user ends signed out of both). `switchToClinician` lands on "/" (marketing home), not /dashboard.

### lib/console/board.ts (406 lines)
- For: the founders' business board (nine independent count queries) rendered on `/admin/tv` above the elevated console.
- Decides: `windows()` rolling 7 and 30 days (60-64). `moneyBoard` paid/due invoice sums + AI spend (75-117). `companiesBoard` sponsors + pot balance + "sessions this month" via enrolments (122-172). `clinicsBoard`, `therapistsBoard` (plan vs metered split, 207-240), `sessionsBoard`, `aiBoard`, `paymentsBoard` (manual_payments queue and oldest wait, 301-317), `patientsBoard`, `activityBoard` (audit by category and actor kind, 352-378). `wholeBoard` Promise.all.
- Assumes: callers guard: `app/(admin)/admin/tv/board-actions.ts` uses `requireManager` on every action; page uses requireManager then elevated().
- Promises: E1 (admin side lists spend without names: kept here, only counts). A4 (paymentsBoard shows waiting and oldest wait; overpayments not surfaced here).
- Notes: AI spend unit error. `micro()` (101) and `aiCents`/`weekCents`/`monthCents` (238, 286-287) divide `cost_microcents` by 1,000,000 and call the result cents. `cost_microcents` is thousandths of a cent (HAZARDS H13; `lib/ai/client.ts:171` `costCents = microcents/1000`; `lib/data/vault.ts:66` divides by 1000). `components/admin/board.tsx:264-268,387,439-440` renders these with `usd(...)` as cents. So the board shows model spend 1000 times too small and "net" (inMonth minus AI) overstated. `companiesBoard.covered` (149-158) counts every session created this month by any person with an active enrolment, not sessions the pot paid for (pot-trace.ts 111-118 makes exactly this point about itself and filters `fundingSource = 'pot'`); a person with two active enrolments is counted under both. `activityBoard` "unattributed" (369) counts patient and clinic manager actors as unattributed because it only tests actor_user_id and actor_sponsor_user_id; "staff" (367) counts every clinician act too (actor_user_id is clinician or staff).

### lib/console/gate.ts (169 lines)
- For: the two-key elevation gate for the live console (`/admin/tv`): key slots a and b in `console_keys`, grant stored on `auth_sessions.elevated_until` for 20 minutes.
- Decides: `setKey` (56-86) slot b write-once from the app, slot a rotatable, audited `console.key.set`. `unlock` (94-134) limiter 5 per hour per connection, both hashes always verified, denial audited `console.unlock.denied`, grant audited `console.unlock`. `elevated` (149-162) = `requireRole("super_admin")` + live grant on this session. `requireElevated` throws.
- Assumes: callers in `app/(admin)/admin/tv/actions.ts` gate with `requireRole("super_admin")`.
- Promises: A5: the unlock is on the record; the READS made while elevated are not (see reads.ts). A super_admin who is not elevated is shown the Gate component, a manager is redirected to /dashboard by `requireRole` without an audit row.
- Notes: whoever sets both slots holds both keys; the two-key rule is only two people if two people set them, which nothing enforces (`updatedBy` is recorded, not compared). `relock` is not audited.

### lib/console/history.ts (155 lines)
- For: one clinician's session and note history as CSV, for a formal records request (mailed from `/admin/tv`).
- Decides: `buildClinicianHistory` (29-137): up to 5000 sessions with patient name and email (or guest name/email), price, payment, consent, note status; transcripts excluded (24-27). `csvCell` guards formula injection (151-155).
- Assumes: caller `mailClinicianHistory` requires elevation, a 20+ char reason, audits it, and notifies the clinician (`app/(admin)/admin/tv/actions.ts:79-132`).
- Promises: A5 kept for this export (audited with reason and recipient).
- Notes: the CSV carries every patient's name and email to an arbitrary external address typed by the operator (`to` is any valid address). Patients are not notified, only the clinician (actions.ts 123-129). That is a disclosure of patient identities and session dates on a "request about a clinician"; the comment argues transcripts are out of scope but names are in. Unclaimed (b)-ish: a capability no promise mentions.

### lib/console/pot-trace.ts (172 lines)
- For: admin reconciliation of where a sponsor's pot money went, one row per pot-funded session, patient as a reference only.
- Decides: `potTrace` (76-140) joins session_payments -> sessions -> patients -> enrolments by personId, filtered to sponsorId and `fundingSource='pot'`, rows with sponsor share > 0; `patientRef` is the first 8 chars of the SESSION id (129) and `patientHref` always null (130). `potSpendAgrees` (151-162) compares to `potTotals` from lib/billing/pot, falls back to itself on error (157, 160) which reports "agrees" when the ledger read failed.
- Assumes: `payFromPot` writes fundingSource 'pot' and no payer identity (C243).
- Promises: E1 (admin side, no names) kept. Also a query joining sponsor tables to sessions (priority 1): it is admin-only (`app/(admin)/admin/sponsors/[id]/page.tsx:9`), and it exposes session timestamps (`at`) and clinician names per sponsor, which is who-and-when minus the patient name. Not reachable from the sponsor portal in this slice.
- Notes: comment 46-50 says the reference "LINKS to their own admin page", but `patientHref` is hard null (130) and the reference is a session prefix, not a patient reference. Stale comment. If one person has enrolments with two sponsors (employer change, simulation P5), a pot session is listed under both sponsors (join on personId with no enrolment-period or pot-id condition), so `potSpendAgrees` can report disagreement for the second employer. The `.catch(() => null)` at 157 turns a failed ledger read into `agrees: true`.

### lib/console/reads.ts (406 lines)
- For: the elevated live console reads, unscoped by organisation: live sessions, radar, timeline, people by email, copilot conversations, sessions per person, one session in full with transcript and risks, counts, audit stream, clinician roster.
- Decides: nothing is written. `timeline` (111-199) UNION of session start/end, note sign, summary release, first 140 chars of every copilot message, risk level and recommended action, rating comment. `peopleByEmail` (211-254) patient names, emails, clinicians, session and copilot counts, parameterised LIKE. `sessionDetail` (312-346) full note + up to 2000 transcript segments + risks. `radarNow` lists every `demo=true` radar row regardless of last seen (86).
- Assumes: `app/(admin)/admin/tv/page.tsx:33-37` requireManager then `elevated()` (super_admin + live key grant).
- Promises: A5 broken for these reads: `app/(admin)/admin/tv/page.tsx` renders transcripts, notes, copilot content, patient names and emails for any person or session named in the query string and calls `audit()` nowhere; only the unlock is recorded. P4 ("the patient decides who may read the history") is not true for our own super_admin while elevated. Contradicts `lib/auth/guard.ts:145-153` ("no screen behind this guard queries a clinical table").
- Notes: `radarNow` treats `demo` as a decision (always shown), relevant to MAP suspect 2. `clinicianRoster.patientCount` is a caseload count, admin only (C2 is about the clinic portal, so not a breach).

### lib/content/defaults-ar.ts (815 lines)
- For: shipped Arabic public pages (home, for-patients, features, pricing, contact) and an Arabic competitors table. Legal pages deliberately absent (18-23), fall back to English.
- Decides: nothing executable; data only. Seeded into `content_pages` by db:seed / ship:content; served only when no row exists or the DB is down (see service.ts).
- Assumes: `content:sync` compares block TYPES between locales (comment 407-409).
- Promises: copy for P1 (305 "three taps"), P3/T5 (506 "take it back and it stops that second"), E1/E2 (317, 323), C1/C2 (329 "no caseload count"), C3/C5 (335), T1/T2 (293-299).
- Notes: 
  - The Arabic competitors table states DIFFERENT competitor prices from the English one under the same `checkedOn: "2026-09-19"`: TherapyNotes "from $59" (82) vs English "about $69" (defaults.ts:82); Upheal "limited free plan, paid from about $79 a month" (120) vs English "about $1 a session, capped near $69"; Mentalyc "from about $39" (158) vs English "$20 to $70". Same table, two sets of facts about rivals by language.
  - AR SimplePractice "ours" row types our own prices into copy: "one dollar for the room and three for AI per session" (48). English deliberately writes no figure (C60). If platform_settings has moved, the Arabic page is wrong and nothing reads it.
  - AR contact `companies.address` for both entities is an operator instruction, "set the registered address from admin panel, content, contact" (794, 802), which would render as the address to a public visitor. English leaves it "" (defaults.ts:992,1002).
  - AR for-patients promises a licence number of the signer on every note and export (424, 564). defaults.ts:757-760 says the public page does not print a licence number "so this line must not promise one"; the export may, not verifiable here.
  - AR features page has 3 blocks (hero, showcase, features) where English has 7 (faq, second showcase, cta, crisis missing). AR contact block order differs from English (two extra prose blocks, no features). If `content:sync` compares types, these two pages mismatch.
  - AR adds claims English does not make: difference refunded as credit when the replacement is cheaper (556); AI fees added only when the patient turns AI on (700).
  - No English pasted as Arabic found; product names and Latin brand kept by design. Arabic is Egyptian colloquial in demos, MSA here.

### lib/content/defaults.ts (1282 lines)
- For: shipped English public pages: home, for-patients, features, pricing, contact, privacy, terms, hipaa (Compliance), security; shared COMPETITORS block; `findDefaultPage`.
- Decides: nothing executable. Used as CMS seed and as fallback when DB unavailable (service.ts 218) or when no row exists for a slug.
- Assumes: authored rows win (H28); pricing figures come from `platform_settings` via the `pricing` block.
- Promises: this is where several promises are "said": P1 (343), P3 (613-615), P4 (507-508), T1/T2 (331, 337), T5 (608-609), C1/C2 (367), C3/C5 (373), E1/E2 (355, 361), A5 (1237-1238 "A role is a list, not a rank"; 1232-1233 "Every read is written down").
- Notes (claims contradicted by code or by other pages, as shipped defaults; published rows may differ):
  - Features FAQ "Is a BAA included? Yes, on every plan" (790-791) and privacy "Each of these is a subprocessor covered by a business associate agreement" (1074) contradict the hipaa page "none of them is signed yet ... do not put protected health information into this product" (1178-1183).
  - hipaa "sessions expire after 30 minutes of inactivity and 8 hours absolute" (1193) is false for clinicians and staff: `lib/auth/session.ts:34,36` is 2 hours idle, 12 hours absolute (30/8 is the clinic manager's, `lib/clinic-auth/session.ts:62-63`).
  - hipaa "Clinicians cannot delete a patient or a session" (1193) vs privacy "Clinicians can export or delete a patient record ... Deletion removes the chart, its sessions, transcripts and notes" (1084). The two pages contradict each other.
  - security "Every read is written down" (1232-1233) and hipaa "Every read and write of clinical data is recorded" (1193): the elevated console reads transcripts, notes and copilot content without writing an audit row (see reads.ts). "every clinical query is scoped to one practice" (1238, 1256): lib/console/reads.ts is unscoped by design.
  - for-patients "Take it back and it stops that second" (609) vs `lib/access/state.ts:167-176` revoked keeps `copilot: true`.
  - for-patients "Nothing is deleted and nothing expires" (533) vs MAP unclaimed 6 (retention cron) and grants that expire.
  - features FAQ "For in-person sessions they do not touch the software at all" (775): so in-person recording consent cannot come from the patient's own device; relevant to task 123. hipaa "Patients are asked to agree to being recorded before they enter the room" (1193) cannot be true of an in-person session where the patient never touches the software.
  - home radar card "Pick one, say what to call you, and you are in a session" (282) with A1 "nothing is granted before a person confirms": for a paid session on the Egyptian manual-transfer rail these cannot both hold. P1 is only three taps for a free or card session.
  - "Your first session is free" (417, 821, 834, 891): a therapist-side claim; check lib/billing.
  - contact hours "09:00-18:00 UTC" and "10:00-19:00 Cairo" (995, 1004).
  - security page does not mention the partner principal or clinic staff.

### lib/content/demo.ts (570 lines)
- For: the words inside the live marketing demo components (transcript, brief, homework, observations, summary versions, journal, SOAP note, copilot prompts and asks with citations, risk phrase), English and Arabic floors, overridable by a `content_pages` row with slug `demo`.
- Decides: `getDemoContent` (443-480) exact locale row, then English row, then the language floor; any error returns the floor. `fromBlocks` (489-570) maps CMS blocks by heading; note, copilot, copilotAsks, riskIndicator and patientSessions are never CMS-editable (529-550); summary version numbers positional (555-561); a transcript line is "patient" only if the item title contains "patient" (515-517).
- Assumes: `components/demo/fixtures.ts` DEMO_NOTE/DEMO_TRANSCRIPT.
- Promises: P3/T5 demonstration (citations on every ask, 75-79); nothing clinical read.
- Notes: comment 231 says "There is no `demo` row in `content_pages` and there never has been" (a state claim, undated). If an Arabic `demo` row is ever missing but an English one exists, Arabic readers get the English CMS demo rather than the Arabic floor (472), the opposite of 455's intent. Arabic demo dates use Eastern Arabic digits (272 "١٢ مارس") while defaults-ar.ts:15-16 says Western digits are kept deliberately. Arabic demo mixes the patient's grammatical gender (masculine SOAP "يفيد المريض" 342, feminine homework 283, masculine patientSteps 369-371). Harmless demo copy.

### lib/content/honesty.ts (130 lines)
- For: refusing two claims in CMS content: "paid sessions cover our fee" and earnings forecasts.
- Decides: `FEE_CLAIMS` five regexes (46-52), `EARNINGS_CLAIMS` seven regexes (64-72), `readableStrings` skips type/icon/demo/slug/backgroundImage/ctaHref (87), `honestyProblems` first hit per rule (96-116), `honestyMessage` (126-130).
- Assumes: callers `app/(admin)/admin/actions.ts:110` (savePage) and `scripts/verify-sprint28.ts:44,72` (published rows), `scripts/verify-prove.ts:179`.
- Promises: T3 (netting is the true version). The two forbidden claims hold for ENGLISH only.
- Notes: every pattern is English. An Arabic row (`ar` locale) is scanned with English regexes, so an Arabic fee or earnings claim passes both savePage and verify:sprint28. Money pattern `(make|earn)\s+[$£€]\s?\d` (68) has no EGP/جنيه/LE form, so "earn EGP 20,000 a month" in English also passes, in a product launching in Egypt. The i18n dictionary (admin-published message overrides, see lib/i18n) is not scanned by this at all; only `content_pages` blocks are. What third claim should be refused: a compliance claim, "BAA included / covered by a business associate agreement / HIPAA compliant", which the shipped defaults already make (defaults.ts:791, 1074) while the hipaa page says none is signed (defaults.ts:1178-1183). Second candidate: any response-time promise attached to "24/7" or to the crisis path (MAP invariants list "24/7 never a response-time promise" as load-bearing, and nothing in this file enforces it).

### lib/content/registry.ts (64 lines)
- For: shipped content per locale (`CONTENT_DEFAULTS` en + ar), `localesWithDefaults`, `defaultsFor` (no English substitution), `localesForSlug`.
- Decides: legal pages are English-only by absence (55-58).
- Assumes: `LOCALES` in lib/i18n/config.
- Promises: none.
- Notes: comment 23-27 says `getPublicPage` falls back to English, true; but when the DB is down `readPage` falls back to `findDefaultPage` which reads English `DEFAULT_PAGES` only (service.ts:218), never `DEFAULT_PAGES_AR`, so the Arabic defaults are only a seed, never a runtime fallback.

### lib/content/sanitise.ts (226 lines)
- For: whitelisting CMS block shapes before `savePage` writes them (moved out of a "use server" file).
- Decides: `RULES` (82-131) keyed by every ContentBlock type, asserted equal to the schema union by verify:sprint17 via `SANITISER_BLOCK_TYPES` (139). Strings capped 8000 (top level) / 4000 (items); `backgroundImage` through `safeImageUrl`; unknown type or missing items array rejects the whole save (164, 192).
- Assumes: renderer escapes text (React).
- Promises: none.
- Notes: `ctaHref`, panel `href`, competitor and vendor `logo` pass as unchecked strings (84, 90, 121, 127). React escapes attribute values, and React 19 blocks `javascript:` hrefs, so this is admin-to-visitor only; `logo` is fine in an `<img src>` but not if ever used in CSS `url()`. Lines 220-226 are a dangling docstring "Discount an issued invoice ... A full discount settles the invoice" with no function under it (stale, moved code left its comment).

### lib/content/service.ts (407 lines)
- For: the CMS read path: `getPublicPage`, `getPublicNav`, `getFooterLinks`, `publishedSlugs`, admin `listAllPages`, `getPageById`; `unstable_cache` with tag `cms`, 1800 s TTL, `CACHE_VERSION = "v4"`.
- Decides: defaults vs published rows (163-227): requested-locale published row, else English row; a found draft returns null (page 404s); only when NO row exists for the slug, or the DB is unavailable, is `findDefaultPage` (English) served. So authored rows win forever (H28) and the Arabic defaults are never a runtime fallback. `readNav` excludes `-x-staging` locales (262); `readFooter` does not (318) and relies on staging rows having no nav_label. `publishedSlugs` en only.
- Assumes: `revalidateTag(CMS_TAG)` on every publish.
- Promises: none directly; this is how every "where we say it" citation reaches a visitor.
- Notes: a published English page whose Arabic row is a DRAFT serves English to Arabic readers (197-201), fine. An Arabic reader of a slug with no row at all and DB up gets English defaults. Cache TTL rationale (86-121) is a dated measurement, fine.

### lib/content/url.ts (31 lines)
- For: `safeImageUrl`: same-origin paths or absolute http(s), rejecting quotes, parens, backslash, whitespace, angle brackets.
- Decides: as above; applied at save and render.
- Assumes: CSP img-src allows the resulting host (lib/security/csp.ts).
- Promises: none.
- Notes: http (not only https) is accepted (26), which a production CSP may block as mixed content; harmless.

### lib/crypto/secretbox.ts (135 lines)
- For: the one reversible primitive: AES-256-GCM seal/open for OAuth refresh tokens (Zoom, EHR), key from `TOKEN_ENCRYPTION_KEY` read live on every call.
- Decides: key must be exactly 32 bytes base64 (71-75); `encryptSecret` throws with no key (fails closed, 92-96); format `v1.iv.tag.body` base64url; `decryptSecret` throws on any mismatch (119-135). `secretsConfigured` (80-88).
- Assumes: key rotation is not supported (single VERSION, no key id): rotating the key makes every stored token undecryptable.
- Promises: none of the 25.
- Notes: sound. No AAD binding the ciphertext to its row, so a sealed token could be copied between rows by a DB writer; low risk.

### lib/env.ts (397 lines)
- For: boot guard and the typed `env` object; `features` derived flags; `SIMULATION_RUNNING`.
- Decides: `REQUIRED_IN_PRODUCTION` DATABASE_URL, OPENAI_API_KEY, STRIPE_WEBHOOK_SECRET, APP_URL, CRON_SECRET, BLOB_READ_WRITE_TOKEN (31-76); RECOMMENDED DAILY_API_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY, EMAIL_FROM (79-84). Branch/database cross-check: simulation branch must use endpoint `ep-empty-queen-a62vlkkp`, and no other branch may (195-220). AUTH_SECRET non-placeholder and >= 32 chars in production (224-236). `assertEnv` skipped during `next build` (251), runs at module load (265). `SIMULATION_RUNNING = process.env.SIMULATION_RUNNING === "1"` (159). Dev fallbacks for DATABASE_URL and AUTH_SECRET (291, 296).
- Assumes: `VERCEL_GIT_COMMIT_REF` present on Vercel; `inspectEnv` exercised by tests/safety.test.ts.
- Promises: none directly; guards P5-adjacent crons by requiring CRON_SECRET (57).
- Notes: comment 222 says AUTH_SECRET "is checked in every environment", but the check sits inside `if (isProd)` (225); stale comment. AUTH_SECRET is not a session key (sessions are random tokens) but it salts sponsor eligibility hashes (`lib/data/enrolment.ts:100,128`), the sponsor domain mailbox HMAC (`lib/data/sponsor-domains.ts:187`) and the rate-limit bucket keys (`lib/rate-limit.ts:47`); rotating it silently breaks enrolment matching, nothing here says so. CRON_SECRET has no strength check (any non-empty value boots). The simulation cross-check reads only DATABASE_URL; `DATABASE_URL_DIRECT` and any regional URLs are not checked. No secret values in this file other than dev placeholders (296) and a Neon endpoint id (162), which is not a credential.

### lib/feedback-options.ts (38 lines)
- For: the patient rating tags (therapist and service) and RTL language codes.
- Decides: THERAPIST_TAGS (14-25), SERVICE_TAGS (27-35), RTL_LANGUAGE_CODES (38).
- Assumes: rendered through i18n somewhere, or English only (these are English literals; if shown raw to an Arabic reader they are English pasted into an Arabic screen, not verifiable from here).
- Promises: none.
- Notes: none.

### lib/geo.ts (298 lines)
- For: coarse radar geography: land mask, equirectangular projection, country table, flags, ICU country names, radar language and specialty allowlists.
- Decides: `countryName` uses `Intl.DisplayNames` with explicit locale (ar-AE / en-GB) (150-171); `countryPoint` uppercases (202-206), unknown codes land at (-30, 20) in the Atlantic. RADAR_LANGUAGES 25 (209-235), RADAR_SPECIALTIES 18 incl. "Suicidal thoughts", "Self-harm" (279-298).
- Assumes: `lib/countries.json`.
- Promises: P1 (radar filters).
- Notes: comment 240-244 says "where no single flag is defensible the entry is a neutral globe", yet English gets the US flag and Arabic the Egyptian flag (247, 254). Specialty and language labels are English literals (i18n handled elsewhere or not).

### lib/geocode.ts (144 lines)
- For: server-side Nominatim geocoding of a clinician's typed address, coordinate paste parser, Google Maps directions link.
- Decides: `geocode` 10 s timeout, 5 results, User-Agent identifies us (37-99); `parseCoordinates` (109-119); `directionsUrl` prefers coordinates (128-144).
- Assumes: caller confirms the hit with the clinician before publishing (17-21).
- Promises: none.
- Notes: sends the clinician's practice address to OpenStreetMap (a third party) on save; no subprocessor list mentions it (defaults.ts hipaa page lists Vercel, Neon, OpenAI, Daily, Stripe, Resend). geo.ts:8-11 says "a clinician's precise location is not ours to publish", while this publishes an in-person address's exact coordinates by design (in-person is opt-in).

### lib/globe.ts (137 lines)
- For: orthographic projection maths for the radar globe (project, visible, ringPath, shortestTurn, ease, zoomForBounds, spread).
- Decides: pure maths.
- Assumes: nothing.
- Promises: none.
- Notes: none.

### lib/i18n/authoring.ts (413 lines)
- For: admin writes to interface strings and languages: saveString (draft by default), publishString (one at a time), clearString (delete row), saveLanguage (completeness gate), draftTranslations (machine drafts), approveDrafts, editorRows.
- Decides: unknown key refused (70-72), empty value refused (73-75); every write audited (`string.saved`, `string.published`, `string.cleared`, `language.saved`, `strings.machine_drafted`, `strings.approved`); a language goes public only at 100% (216-223); machine drafts never overwrite a published row (`setWhere status='draft'`, 328); `approveDrafts` refuses a batch containing any safety key (359-365) but a batch of exactly one safety key passes.
- Assumes: callers are admin actions that already checked the role (this file takes an `Actor` and does not check it); `lib/ai/translate`.
- Promises: A5 (audited writes) kept here. P5 depends on crisis copy not being corrupted: see strings.ts on the safety prefix list.
- Notes: `actor as never` (101, 149, 177, 250, 332, 380) defeats the type check on the audit actor. `saveString` accepts an explicit `status: "published"` (66), so a caller can publish a human edit of a safety string in one step; whether an admin action passes it is outside this slice. Neither CMS honesty rules nor any claim check runs on these overrides: an admin override can reintroduce "HIPAA BAA included" or an earnings forecast in either language and nothing refuses it.

### lib/i18n/client.tsx (106 lines)
- For: client `I18nProvider`, `useT`, `useLocale`; layers published overrides (only the edited keys) over the bundled dictionary.
- Decides: resolution override, then dictionary, then English (80); outside a provider, English (96-102).
- Assumes: root layout passes `overridesFor(locale)`.
- Promises: none.
- Notes: fine.

### lib/i18n/config.ts (117 lines)
- For: `LOCALES = ["en","ar"]`, cookie `24t_locale`, RTL, Intl tags (`ar-AE-u-nu-latn`, en-US money, en-GB dates), list separator.
- Decides: Western digits in Arabic through Intl (52-63).
- Assumes: nothing.
- Promises: none.
- Notes: the Western-digits rule is applied by Intl only; several Arabic dictionary strings hard-code Eastern Arabic digits (messages.ts 4096 "٢٤:١٠", 4103 "١٨", 4218 "[ ٠٧ ]", 4468 "٢٤ ساعة", 4817 "٣٠ دقيقة"), and demo.ts observations do the same. Cosmetic, but it contradicts the stated rule (52-58) for times and counts.

### lib/i18n/messages.ts (7055 lines)
- For: the complete English (`en`, 22-3911) and Arabic (`ar`, 3924-7053) dictionaries; `MessageKey`; `DICTIONARIES`.
- Decides: `ar: Record<MessageKey, string>` (3924) makes a missing Arabic key a type error. Read in full: no key found missing in Arabic (type-enforced), and no English sentence pasted as an Arabic value. Latin-only Arabic values are only brand or product names (Google Meet, Zoom, Microsoft Teams, 4927-4929; "you@example.com" 4728; "ahmed@example.com" 6078).
- Assumes: `lib/i18n/strings.ts` overrides layered on top.
- Promises: this file carries the words for many promises. Contradictions between keys and with code, compactly:
  - Recording consent, three incompatible stories on one surface: "jconsent.changeAnyTime" "You can change these at any time during the session" (1151) and "jconsent.cannotUndo" "Recording cannot stop part-way. Ask your therapist to end the session" (1152) on the same consent screen; "consent.point.changeMind" "Ask your therapist to stop at any point" (99); "portal.new.consentStop" "Can stop it at any point in the session" (2014) and "troom.offRecordPatient" "Stop recording" (3877, the patient's own button since 48.10). `jconsent.cannotUndo` is stale. Arabic mirrors all of them (4783-4784, 3971, 5440, 7041).
  - In-person consent: "ft.also3" "In-person sessions, recorded on one device with consent taken first" (448) and "portal.new.consentAsked" "Is asked before anything is captured" (2013) vs "portal.dash.startBlurb" "In person or video, recording begins straight away" (1290), "tnew.inPersonBody" "Record from this device" (2755), "tnew.consent"/"troom.consentFirst" "Confirm your patient has consented" (2780, 3451): in person the only consent is the clinician's own attestation. Relevant to task 123.
  - Consent to AI and consent to recording are the same act in copy: "tplan.confirmDownMeter" "The AI fee comes back, charged only when a patient agrees to be recorded" (3739), "note.origin.patientTranscript" "You turned the AI on for this session" (3845). Settles MAP contradiction 3 at the copy level: one flag.
  - C2 is contradicted by the product's own disclosed design: "clinic.join.sees.names" "Each patient's first name and last initial" (2105), "pclinic.theySee" "Your name, to them:" (2037) with "the day and time of each appointment" (2039), "clinic.scheduleBody" "a name and a time, because you pay for the hour" (1739), "auth.clinic.p3" "See the rota and move a patient between your own clinicians" (491). The clinic portal shows patient names by design, disclosed to both patient and clinician. C2 as written in VALUE-STATEMENTS is false by intent, and README's "names and appointment times" is the truth. Also two different name formats promised: "first name and last initial" (clinician told) vs "Your name" (patient told).
  - Residency: "residency.home" "In {country}, where it belongs. Nothing crosses a border." (691, Arabic 4414) vs "marketing.clinics.a4" "On infrastructure in the United States. Egyptian data staying in Egypt is designed and not live." (2004) and lib/audit.ts pinned to the default region. The patient is told something the clinic page denies.
  - "marketing.clinics.a1" "Who can see a patient's chart? The clinician treating them. Not ... us, and there is no administrative override." (1998) vs lib/console/reads.ts + `/admin/tv` (super_admin reads transcripts, notes, copilot text, unaudited).
  - "pricing.feature.baa" "HIPAA BAA included" (185, Arabic 4035) vs defaults.ts hipaa page "none of them is signed yet". A dictionary string, so honesty.ts and savePage never see it.
  - Stripe copy on an Egyptian manual rail: "join.privateNotePaid" (80), "pbook.noAccount" "Stripe takes the payment" (1237), "pay.stripeNote" (1951), "tpay.*" (2661-2683) coexist with "tpay.egRail" "We collect by bank transfer here and pay you by hand" (2686) and "transfer.*" (1842-1861). Which renders depends on region logic outside this slice.
  - P1 vs A1: "crisis.noAccountLine" and "pat.noAccount" "No account, no card, no form. A first name and you are in." (215, 3285) cannot be true for a paid radar session on the manual transfer rail, where A1 says nothing starts before an operator confirms.
  - E1/E2 edge: "dpo.neverWhoWent" "You see the therapists you paid and what you paid them" (3399) and "auth.company.p2" "the take-up" (485): the sponsor sees clinician names per spend. With few enrolled staff and a known therapist, that is who went. "sponsor.neverIndividual" "Any individual, ever" (1473) sits beside "sponsor.roster" "Who is on your list" and "benefit.theySeeName" "That you are on the list" (1432, 1389): the sponsor sees named enrolees. Consistent with E1 (who used it vs who is enrolled) only if the roster never marks use.
  - Copilot allowance, two models: "portal.copilot.credits" "Each session earns {count} copilot questions ... rolling over for {months} months" (2576) vs "tcop.exhaustedBody" "Pay as you go includes {limit} copilot messages per patient per month" (2939). One is stale.
  - Refunds on a manual rail: "tshow.refundedBody" "The full amount is on its way back, including our fee" (3076) and "prating.neverJoined" (1210). Who sends a bank-transfer refund, and when, is not in this slice.
  - "pexport.onItsWay" "Nobody here read it" (1023) and "contact.kept" are fine; "dfl.consentWhy3" "Every read is written into an audit log you can ask for" (3333) conflicts with the unaudited console reads.
  - "devs.promise4Body" "A read of a record appears in the patient's own access log ... naming your platform" (2236): lib/audit.ts has no partner actor slot; check lib/partner.
- Arabic translation defects (not missing keys):
  - "portal.book.body" Arabic says the opposite of English: "على ملفك وخارج الرادار" = "on your profile and OFF the radar" (5713) vs "on your profile and the radar" (2379).
  - "portal.nav.hintRadar" "اتّصل واحجز" ("call and book", 6054) and "portal.dash.radarOffBody" "اتّصل ..." (5868) render "go online" as "call".
  - Register switches between MSA and Egyptian colloquial inside one screen: pop.cancel* (5335-5338), tpay.eg* (5996-6000), tattr.* (6546-6552), tplan.confirm* (6965-6973), pinv.sent (5810) are colloquial while their neighbours are MSA; the file header (17) says MSA for a Gulf reader.
  - "apartner.neverMints" Arabic (5147) carries an extra sentence not in English (2635), about employment keys being identity queries "aimed at our patients". Divergent content, not an error of translation only.
- Notes: comment 1490 says "C227 removed the roster" while `sponsor.roster*` keys remain (1432-1433, 1565-1566); either the keys are dead or the roster came back.

### lib/i18n/paths.ts (158 lines)
- For: URL-prefixed Arabic for public pages (`/ar/...` rewritten, header `x-locale`), `splitLocale`, `localisedPath`, `isLocalisable` (PUBLIC_PREFIXES), `alternatesFor`.
- Decides: only public marketing paths get a prefix (83-126); private areas never get a second URL (76-81).
- Assumes: middleware rewrites and deletes any client `x-locale` header (server.ts 56-63).
- Promises: none.
- Notes: `alternatesFor` builds hreflang for every locale regardless of `isLocalisable` (144-158), the exact defect the 97-110 comment describes; it is safe only while every caller is a localisable page.

### lib/i18n/server.ts (131 lines)
- For: `getLocale` (URL header, cookie, Accept-Language, English), `format`, `translator`, `getI18n` (overrides via stringsFor, falls back to dictionary).
- Decides: order as above (40-77); Accept-Language only detects Arabic (74).
- Assumes: middleware strips client-sent `x-locale`.
- Promises: none.
- Notes: comment 28-39 says a language turned off keeps serving readers with that cookie; `getLocale` does not consult `publicLanguages` at all, so this is true trivially (and a disabled shipped locale would still be served to anyone with the URL prefix).

### lib/i18n/strings.ts (304 lines)
- For: runtime override layer (`ui_strings`), safety prefixes, completeness, languages list.
- Decides: `SAFETY_PREFIXES = ["crisis.", "consent.", "recording.", "risk."]` (57); `stringsFor` override, dictionary, English, logs untranslated (156-183); `languages()` English can never be turned off (232); `completeness` counts machine drafts as missing (280-304).
- Assumes: `revalidateTag("ui-strings")` on writes.
- Promises: P5 (crisis copy protected from bulk machine publication) partly.
- Notes: the safety prefix list misses most consent, recording and emergency strings in the dictionary: `jconsent.*` (the actual join consent screen, 1144-1152), `portal.new.consent*` (2012-2016), `proom.recording*` (3891-3892), `room.recording`/`room.knowRecording` (118, 127), `troom.consentFirst`, `troom.offRecordPatient*`, `tnew.consent`, `feedback.emergency` (149), `urgent.footer` (508), `radar.appearWhenOnline`/`radar.nobodyYetBody` (emergency number sentences, 306, 1174), `error.body` ("The SOS button still works", 730), `tshow.*` (refund). A machine translation of any of these can be bulk-approved by `approveDrafts`. `recording.` matches no key in messages.ts at all (no key starts with it): an exemption covering nothing.

### lib/lifecycle/machines.ts (515 lines)
- For: declared state machines (states, kind, exit, promise, transitions with actor), anchored to schema constants, checked by `scripts/verify-machines.ts`.
- Decides, every state and way out:
  - payout (payout_requests, 151-177): requested (working, 3 days) -> approved | rejected (staff); approved (2 days) -> sent (staff); sent (5 days) -> confirmed (clinician); confirmed success; rejected dead-end "a corrected request can be made". NO arrow out of `sent` for a transfer that bounces or never lands; `twd.fullNameHint` itself says a mismatched name "bounces". A bounced payout sits in `sent` forever with only a promise. Comment 130-149 specifies a clinic-endorsement state that does not exist.
  - session (183-208): scheduled -> in_progress (clinician), -> cancelled ("either side cancels" but `by: "patient"` only); in_progress -> completed (clinician), -> cancelled (time, abandoned). No no-show / reassignment path (the product has one: `tshow.*` refund or reassign), no clinician-cancel actor, no completed -> refunded.
  - invoice (222-253): due -> paid (clinician), failed (system), waived, void (staff), included (system); failed -> paid | void. `due` promises "the allowance before service is interrupted" but no time arrow moves it; payer is always "clinician" although clinics pay invoices too.
  - payment (payments, 259-283): pending -> paid | failed (staff, "an operator confirms the transfer"); paid -> refunded (staff). failed dead-end "another attempt can be made".
  - verification (289-310): draft -> submitted (clinician) -> approved | rejected (staff); rejected -> submitted. `approved` is terminal: no revocation, suspension or licence expiry arrow, so a clinician found to be unlicensed has no modelled way off `approved`.
  - claim (patient_claims, 316-348): pending -> verified (patient), rejected (clinician), expired (time), locked (system); locked -> pending (time).
  - grant (350-374): entity "benefit_grants", anchor GRANT_STATUSES, all transitions by "company" ("the employer approves/refuses/ends cover"). There is no `benefit_grants` table anywhere in lib (grep: only this file); `GRANT_STATUSES` (schema.ts:4299) belongs to `historyGrants`, the patient's grant of record access to a clinician. So the machine that should describe P4/T5 consent (patient grants, clinician asks, patient revokes, time expires it via `expiresAt`) describes an employer workflow that does not exist, and the verifier passes because only the state names are anchored.
  - sponsor (380-419): held -> active (staff); active -> suspended (staff) -> active (staff); active -> closed (company). `held` has no way out except approval: an applicant we decline, or never call, stays `held` forever with promise "until we have called them" (no length). No suspended -> closed.
  - renewal (subscription_renewals, 421-446): due -> paid (clinician), lapsed (time), void (staff); lapsed -> paid. `lapsed` is blocked with no promise.
  - presence (therapist_radar, 452-476): offline <-> online (clinician), online -> pending (patient), pending -> in_session (clinician) | online (time), in_session -> online (clinician), online -> offline (time). No admin suspension state although `suspendedUntil` exists (torb.suspended, reads.ts 78).
  - slot (availability_slots, 478-501): open -> held (patient) -> booked (patient) | open (time); open <-> blocked (clinician); booked -> open (patient cancels). No clinician cancel of a booked hour (`tav.cancelAppointment` exists in the dictionary).
- Assumes: verify:machines checks anchors and exits.
- Promises: A1/A3/A4 depend on the manual transfer lifecycle, which is NOT declared: `manual_payments` with `MANUAL_PAYMENT_STATES` awaiting_proof, submitted, confirmed, rejected (schema.ts:8846-8851) has no machine, so "every stopped person has a way out" is not checked for the Egyptian rail (task 124, rejected transfer dead end). Also undeclared: enrolments (active, paused, removed), clinic state (organizations.clinicState held/active/...), record-access grants (see above), support tickets, withdrawals on the Egyptian rail.
- Notes: kinds and exits are prose; nothing verifies an exit is a real button.

### lib/logger.ts (57 lines)
- For: structured console logging with UUIDs truncated to 8 chars; `ref`, `safeErrorMessage`.
- Decides: messages and field values scrubbed of full UUIDs only (27-29); debug suppressed in production.
- Assumes: callers never pass names, emails, transcript text as fields.
- Promises: none.
- Notes: only UUIDs are scrubbed; an email, phone or name passed as a field value is logged verbatim. `lib/i18n/strings.ts:91` logs `String(error)` of a DB error, which can contain a query with values.

### lib/marketing/fixtures.ts (272 lines)
- For: synthetic constants for marketing demos (spend curve, pot, clinic seats, note, patient brief, clinic team, clinic week, clinic bill, company paid, company code, radar demo clinicians, patient bills).
- Decides: no imports, no queries (21-29).
- Assumes: components render them.
- Promises: C2: `CLINIC_WEEK` (158-171) puts patient names ("Mariam A.", "Omar S.") on the marketing demo of the clinic portal, i.e. the public site itself shows the clinic seeing patient names. E1: `COMPANY_PAID` (206-211) shows the sponsor which therapists were paid and how much.
- Notes: comment 199-204 says `lib/data/sponsors.ts:96` "holds no therapist and no count" and in the same breath that "A company sees what it paid a clinician"; the roster select at `lib/data/sponsors.ts:95-107` in fact returns enrolees' first and last names to the sponsor. RADAR_DEMO prices 50 minutes (263-265) while the product prices 30 minutes (`radar.fromPrice` "for 30 minutes", `tpay.rateLabel`).

### lib/observability/errors.ts (195 lines)
- For: our own error log (`error_events`), path and text scrubbing, FNV-1a fingerprint, 10-minute dedupe, 30-day retention.
- Decides: `scrubPath` replaces uuids, 20+ char tokens, numbers (45-59); `scrubText` removes emails and uuids only (65-70); never throws (155-163).
- Assumes: `/admin/errors` guarded by the admin layout.
- Promises: none.
- Notes: comment 26-27 says errors live "under the same access control and the same retention rules as the record it came from"; they are readable by any back-office role on /admin/errors and kept 30 days, not the record's rules. A stack or message containing a patient's words or name (not email/uuid) is stored verbatim up to 4000 chars.

### lib/partner-auth/guard.ts (44 lines)
- For: partner (EHR / integrator developer) portal guards.
- Decides: `requirePartner` redirect to PARTNER_SIGN_IN; `requirePartnerAdmin` non-admin -> redirect /partner (40-44).
- Assumes: data layer; `authenticateKey` for API keys (not here).
- Promises: none of the 25.
- Notes: refusal not audited.

### lib/partner-auth/session.ts (144 lines)
- For: partner developer session: cookie `PARTNER_COOKIE`, table `partner_auth_sessions`, `PartnerActor` (no organisation id of any spelling).
- Decides: idle 30 min, absolute 8h (54-55); all conditions in WHERE incl. `partners.state = 'active'` (111-121); lastSeen written every request (126-129).
- Assumes: API keys authenticate separately and read the same partner state.
- Promises: none.
- Notes: a `held` partner cannot sign in (119), yet `dev.apply.sentBody` tells an applicant "Your account is open and has no keys yet" (messages.ts 2172). No audit slot for partner users in lib/audit.ts, so nothing a partner developer does in the portal can be attributed in audit_log.

### lib/patient-auth/actions.ts (291 lines)
- For: patient sign-up, sign-in (password, either handle), sign-out. Cookie and table via session.ts.
- Decides: phone required, E.164 via `toE164` (78-87); password optional, shared policy if given (109-112); signup limited 5 per hour per connection (116); existing email or phone refused (128-151); new `people` row always, never auto-linked (153-181); after signup, redirect to the invite page if a token rode along, else /patient/claim (206-207); sign-in limited 10 per 15 min per connection (232), one failure message (282).
- Assumes: `patient_accounts` unique handles; `lib/data/people.normaliseEmail`.
- Promises: P2/P4 indirectly (claim flow entry).
- Notes: the timing equaliser does not equalise. `INVALID` (277) is a bcrypt-shaped string; `verifyPassword` returns false immediately for anything not starting `scrypt$` (lib/auth/password.ts:29-30) without running scrypt. So "no account" and "account with no password" answer in microseconds while an account with a password costs a full scrypt: the response time tells anybody with a phone list which numbers hold a password-protected patient account, the exact disclosure 266-276 says it prevents. Sign-up enumeration: an existing phone or email gets "We could not create that account. Try signing in instead." (150), which says in words that the handle is registered; comment 143-148 claims it matches the wrong-password wording, it does not. Patient sign-in and sign-up write no audit row.

### lib/patient-auth/code-signin.ts (228 lines)
- For: passwordless patient sign-in: six-digit code to the handle typed.
- Decides: code 6 digits CSPRNG, sha256 stored, 15 min, purpose `handle_verify` (63-68, 120-126); sent only to the handle typed (129-141); per-connection limits 5 requests / 10 confirms per 15 min (105, 158); wrong codes counted, token burned past RESET_CODE_ATTEMPTS (186-200); success marks the channel's handle verified and signs in (207-224).
- Assumes: `notify`; DB CHECK bounds attempts.
- Promises: none.
- Notes: the request path does a DB insert and a notify only when the account exists (116-144), so "every path returns the same sentence" (46-49) is true of the words and false of the timing. Shares `purpose: "handle_verify"` with handle.ts, so a code issued by a signed-in patient's handle verification can be used here to sign in and vice versa (same table, same purpose, latest token wins); harmless because both go to the account's own handle, but it means requesting a sign-in code silently invalidates an in-flight verification code.

### lib/patient-auth/guard.ts (32 lines)
- For: `requirePatient` (redirect /patient/login), `optionalPatient`.
- Decides: as named.
- Assumes: data layer scopes by personId and grants.
- Promises: none.
- Notes: none.

### lib/patient-auth/handle.ts (202 lines)
- For: proving a signed-in patient's handle before the claim screen reveals whether any clinician holds a record for them (§6, C121).
- Decides: `requestHandleCode` (77-127) chooses `channel = account.phone ? "whatsapp" : "email"` (104) and calls `notify({ email: account.email, phone: account.phone })` (114-122); `confirmHandleCode` (130-202) marks `phoneVerifiedAt` when `row.channel === "whatsapp"` (187-191).
- Assumes: `notify` sends on one channel.
- Promises: privacy wall on record existence (priority 1), and P4's claim flow.
- Notes: BROKEN. `notify` sends on EVERY channel that can carry the message (lib/notify/index.ts:268-286, 318-340), so the code goes to the account's email as well as (or, while WhatsApp is not approved, instead of) the phone, but the token is recorded as `channel: "whatsapp"`. Typing it back marks the PHONE verified. The comment at 178-182 states the opposite rule. So: sign up with a stranger's phone number (only refused if that number already has a patient account, and the target here is an unclaimed record a clinician keeps) plus your own email, request the code, read it in your inbox, confirm, and the account now has a "verified" phone; the claim screen then says whether a therapist keeps notes for that number and shows initials, which is the leak 37-42 describes as closed. With WhatsApp still unapproved (54-56), email is the only channel that delivers, so this is the normal path, not an edge.

### lib/patient-auth/reset.ts (265 lines)
- For: patient password reset by six-digit code (WhatsApp plus email).
- Decides: request limited 5 per 15 min per connection (121), code to both handles on the account (151-159), channel recorded but not used for verification; confirm limited 10 per 15 min (184); attempts bounded (212-233); success rehashes, revokes all patient sessions, audits `patient.password.reset` with `actor: null` (235-262).
- Assumes: DB CHECK `patient_auth_tokens_attempts_bounded`.
- Promises: none.
- Notes: timing differs between account and no account on request (139-166), same as code-signin. Sending the reset code to both handles is correct here because both belong to the account; but the account's phone may be unverified (a stranger's number typed at sign-up), so a reset code can be delivered by WhatsApp to a person who is not the account holder, once WhatsApp is live.

### lib/patient-auth/session.ts (210 lines)
- For: patient session: cookie `PATIENT_COOKIE` (re-exported from lib/routing), table `patient_auth_sessions`, `PatientActor` (no organisationId).
- Decides: idle 4h, absolute 7 days, touch throttled 1 min (46-48); all conditions in WHERE (153-161); `revokeAllPatientSessions` (200-210).
- Assumes: routing's PATIENT_COOKIE shared with middleware.
- Promises: none.
- Notes: heading "A shorter window" (29) introduces a longer one (4h/7d vs 2h/12h); stale wording. Comment 25-27: a clinician and a patient may be signed in in one browser at once, by design.

### lib/phone/e164.ts (185 lines)
- For: local numbers to E.164 with a required country; display helpers.
- Decides: "+" kept as given, "00" stripped, else country required, trunk zero dropped, own-code-without-plus detected, length 8..15 (74-119). `countryFromLocale` maps bare "ar" to EG (182-183).
- Assumes: 26 countries in DIALLING_CODES.
- Promises: none.
- Notes: a number with a leading "+" is accepted with any country code on earth even though `DIALLING_CODES` exists to say where "we cannot send messages" (135); `toE164` never consults the table for "+" input. The own-code heuristic (99-101) misreads a national number that happens to start with the country code digits (e.g. an Egyptian `20...` landline typed without trunk zero); rare.

### lib/rate-limit.ts (330 lines)
- For: DB-backed fixed-window limiter (`consume`), `refund`, holds (`takeHold`, `releaseHold`), `/24` or `/64` bucketing, `globalCeiling`, purge.
- Decides: one atomic UPSERT using Postgres `now()` (114-156); subjects salted-hashed with AUTH_SECRET (45-51); `SIMULATION_RUNNING` multiplies EVERY non-`global:` limit by 25 (97, 110-111).
- Assumes: `clientIp` is trustworthy (see request.ts); `rate_limits` table.
- Promises: none directly.
- Notes (SIMULATION_RUNNING): the 25x applies to every caller of `consume`, not only sign-in: clinician sign-in 20 -> 500 per 15 min, console two-key unlock 5 -> 125 per hour (lib/console/gate.ts:99), patient sign-in 10 -> 250, patient code confirm 10 -> 250 per 15 min, reset and code requests 5 -> 125 per 15 min (strangers' phones buzz 25 times more), clinic sign-in 8 -> 200. `lib/env.ts:117-158` says the flag is set on the production deployment for the duration of the run and that "a flag that changes how production behaves is a flag somebody leaves on"; the violet strip announces it, but nothing announces that every brute-force limit, including the console elevation, is 25 times wider. HAZARDS H50 describes only the sign-in half. `purgeExpiredLimits` (304-310) compares against Node's `new Date()`, the two-clock mistake 116-134 and 215-227 fixed everywhere else; with a skewed DB clock it can delete a live hold or window early.

### lib/regulators.ts (240 lines)
- For: suggested regulators per country and document-slot requirements for clinician verification, with admin overrides.
- Decides: `regulatorsFor` (138-145), `documentRequirements` field-by-field override (159-186), dictionary keys per slot/country (197-240); idFront, licence, headshot required, idBack optional.
- Assumes: onboarding form renders labelKey via i18n.
- Promises: supports "Verified" badges (C1 "verification state on the row").
- Notes: `regulatorsFromConstants` and `keyFor` do not uppercase the country (148, 208) while overrides do (142, 163): a lowercase 'eg' gets no regulators and "Government ID" labels. Same shape as the bug geo.ts:189-201 describes; migration 0114 may make it unreachable.

### lib/request.ts (33 lines)
- For: `clientIp` (first X-Forwarded-For value, else X-Real-IP) and `clientUserAgent` for audit rows and the limiter.
- Decides: first XFF entry (18-19).
- Assumes: the platform overwrites X-Forwarded-For with the real client address (Vercel does; a different proxy or a direct origin hit would not).
- Promises: A5 (IP on audit rows).
- Notes: if the deployment is ever reached other than through Vercel's edge, the first XFF entry is attacker-chosen and every per-network limit in the product is bypassed by rotating a header.

### lib/routing.ts (407 lines)
- For: the principal table used by middleware: cookies, prefixes, doors, homes, open routes; `ownerOf`, `routeDecision`, segment-boundary `isUnder`.
- Decides: cookies `24t_session` (clinician AND staff), `24t_patient`, `24t_sponsor`, `24t_clinic`, `24t_partner` (15-20, 99, 117, 138). Staff owns `/admin` with the clinician cookie (237-244); clinician owns PROTECTED_PREFIXES (34-49) with `/support` open (276); patient `/patient` with `/patient/invite` open; sponsor, clinic, partner each own their prefix with apply (and clinic join) open. `routeDecision` (371-396): owned path + own cookie absent -> that principal's sign-in with next; own cookie present at own door -> home unless `expired`.
- Assumes: every page runs its own guard (not the boundary, 206-210).
- Promises: priority 5, cross-principal cookies. Each prefix is gated only by its own principal's cookie; no other principal's cookie is ever consulted for it, so a sponsor, clinic or partner cookie cannot open a clinician, patient or staff route at the edge, and the guards read only their own cookie. The one shared cookie is clinician/staff, by design (197-205): a staff account is a clinician-cookie holder and passes middleware on every clinician prefix; what it reaches there depends on `requireUser` (role unchecked) vs `requireVerified`.
- Notes: counts "six principals" but five cookies (212). A signed-in staff member who opens `/login` is sent to `/dashboard` (clinician home), not `/admin`, because `/login` belongs to the clinician row.

### lib/scheduling/hours.ts (135 lines)
- For: bookable-hour arithmetic: whole hours, holds, radar auto-offline, booking warnings.
- Decides: `isWholeHour` in UTC (9-11); `HOLD_MS` 10 minutes (36); `OFFLINE_BEFORE_MS` 15 min (47); `WARN_BEFORE_MS` 10 min (56); `isBookable` treats an expired hold as open (72-77); `shouldAutoOffline` whole booked hour plus 15 min before (87-96).
- Assumes: DB enforces whole hours too.
- Promises: none directly.
- Notes: `nextHour` (21-26) has two identical branches: dead conditional. `isWholeHour` in UTC makes a whole local hour in a half-hour-offset zone (India +05:30) unbookable; not Egypt. The 10-minute hold is justified by "3-D Secure and a mistyped card" (33-35); on the Egyptian manual transfer rail a payment takes "usually within a few hours" (messages.ts `bar.eta`), so a slot held for a transferring patient lapses long before an operator confirms (A1), and the slot machine's held -> booked "the payment completes" cannot happen in time. Whether booking on that rail uses holds at all is outside this slice.

### lib/scheduling/tz.ts (349 lines)
- For: zone-bound formatting, day bucketing, local-hour to UTC with DST gap detection, quiet hours 22:00-07:00.
- Decides: `resolveZone` reader, clinician, UTC (40-47); every formatter requires a zone; `zonedHourToUtc` two-pass, null in a spring-forward gap (258-280); `isQuietHour` (346-349).
- Assumes: Intl IANA data.
- Promises: P2 (reminders at sane hours).
- Notes: `formatWhenWithCaveat` appends English literals ", your therapist's time zone" and ". We do not have your time zone, so this is UTC" (184-185) to a date formatted in Arabic: English pasted into Arabic output. `formatTime` always en-GB (101-111), fine (Western digits).

### lib/scheduling/use-reader-zone.ts (44 lines)
- For: client hook returning the browser zone after mount (null first render).
- Decides: as above.
- Assumes: nothing.
- Promises: none.
- Notes: none.

### lib/security/csp.ts (265 lines)
- For: the Content Security Policy as data, and whether it is enforcing.
- Decides: `script-src 'self' 'nonce-…' 'strict-dynamic'`, plus `'unsafe-eval'` only when `isVideoRoom` (`/sessions/:id/room`) (151-183); `style-src 'self' 'unsafe-inline'` (199); `img-src 'self' data: blob: https:` (208); `font-src 'self' data:`; `media-src 'self' blob: https://*.daily.co`; `connect-src 'self'` + `https://*.daily.co`, `wss://*.daily.co`, `https|wss://*.pluot.blue`, `https|wss://*.dailywebrtc.com`, `https|wss://*.dailywebrtc.net` (77-100, 216); `worker-src 'self' blob:`; `frame-src 'self' https://*.daily.co`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `manifest-src 'self'`; `upgrade-insecure-requests`. Daily's Sentry deliberately blocked (65-69). `CSP_ENFORCE=0` switches to report-only (261-265); no report-uri/report-to, so report-only mode reports to nobody.
- Assumes: middleware mints a per-request nonce and sets the policy on request and response; `verify:csp` pins daily-js version against docs/DAILY-HOSTS.md.
- Promises: none of the 25 directly; protects every promise from script injection.
- Notes: the room relaxation is chosen per DOCUMENT request in middleware, but next.config.ts:112-119 explains that a clinician reaches the room by client-side navigation and so keeps the policy of the first document loaded. By the same mechanism, a clinician who navigates dashboard -> new session -> room client-side is still under the strict policy without `'unsafe-eval'`, so daily-js's `Function(...)` compile (156-166) is refused and the call never connects. Either the room link forces a full load (outside this slice) or video is broken on the common path. `connect-src` does not include the OpenAI or Blob hosts, so nothing in the browser may talk to them (good); `img-src https:` lets any stored blob or radar photo URL load.

### lib/sponsor-auth/guard.ts (44 lines)
- For: sponsor portal guards.
- Decides: `requireSponsor` redirect to SPONSOR_SIGN_IN (25-29); `requireSponsorAdmin` non-admin -> /sponsor (40-44), the only individual-level power being ending someone's funding.
- Assumes: data layer (`lib/data/sponsors.ts`) holds the wall.
- Promises: E1/E2 structurally (no organisationId on the actor).
- Notes: refusals not audited.

### lib/sponsor-auth/session.ts (150 lines)
- For: sponsor session: cookie `24t_sponsor`, table `sponsor_auth_sessions`, `SponsorActor`.
- Decides: idle 30 min, absolute 8h (37-38); WHERE includes user not deleted and `sponsors.state = 'active'` (110-120); lastSeen written each request.
- Assumes: nothing on the patient side reads sponsor state (85-88).
- Promises: E2 structurally; P5 (sponsor suspension never touches a patient).
- Notes: a `held` sponsor cannot sign in at all (118), while lib/lifecycle/machines.ts:386-390 says the held state's screen is "the company portal, with every page saying what is waiting" and `sponsor.apply.sentBody` tells the applicant "Your account is open". The held applicant has no portal and no screen: they wait for a phone call with nothing to open.

### lib/uploads.ts (315 lines)
- For: Vercel Blob uploads (credential, headshot, support, avatar, receipt), local-disk dev fallback, receipt undeletability, `documentUrl`.
- Decides: images only 8 MB for credentials (30, 39, 67-74), avatars 2 MB (58), support and receipts images or PDF 25 MB (77-107); path `kind/userId/label-<24 random bytes>.ext` (167-172); every blob `access: "public"`, cache 3600 s for headshots else 0 (190-195); receipts cannot be deleted, malformed URL counts as undeletable (235-270); `documentUrl` returns the stored https URL unchanged (306-313).
- Assumes: nobody leaks a URL; callers audit opens.
- Promises: H14 (blob URLs are secrets, not access control). A1/A4 evidence (receipts kept). A5 ("every read written down") is not achievable for documents: whoever has a URL has the file, with no record.
- Notes: comment says "The random 32-byte path prefix is the access control" (20) and "32 random bytes" (143); the code uses `randomBytes(24)` (168): stale. The prefix is not a prefix either, it is a suffix after the user id. Support attachments ("a patient photographing a prescription ... has sent us a medical record", 42-46) and bank-transfer receipts (names, account numbers) are public blobs whose URL is the only protection; the avatar comment says reads go "through an authenticated route rather than the storage URL" (55-57), but `documentUrl` hands out the storage URL itself, so no route stands between reader and file. The dictionary promise "Everything you open is recorded against your name" (messages.ts `tdl.newTab`) can only record the click that revealed the URL, never a reopening or a forward. The userId in the path is by design (169-171). HEIC is allowed for credentials yet "only formats a browser will render" (33): most browsers do not render HEIC, so an operator reviewing a licence may see nothing.

### lib/utils.ts (177 lines)
- For: `cn`, `initials`, `fullName`, `formatDuration`, zone- and locale-required date formatters, `relativeDay` with dictionary keys.
- Decides: all formatters require zone and locale, null zone = UTC (73-176).
- Assumes: lib/scheduling/tz, lib/i18n/config.
- Promises: none.
- Notes: `fullName` default fallback "Unnamed" is an English literal (15).

### lib/viewer.ts (34 lines)
- For: per-tab anonymous viewer id in sessionStorage for radar booking holds.
- Decides: `viewerId()` (19-34), not a credential by design.
- Assumes: atomic claim elsewhere decides the booking.
- Promises: P1 (booking flow).
- Notes: none.

### instrumentation.ts (43 lines)
- For: Next `onRequestError` hook to `recordError` (path, method, digest only; no body, query, headers, cookies).
- Decides: as above.
- Assumes: lib/observability/errors.
- Promises: none.
- Notes: none.

### middleware.ts (197 lines)
- For: locale prefix handling, the principal redirect table, CSP nonce and header, `x-pathname`.
- Decides: `/ar/<non-public>` redirected to the unprefixed path and the locale cookie set (58-69); `/en/*` redirected (71-75); five cookie presences fed to `routeDecision` (91-98), with `?expired=1` as the loop breaker (97); nonce `btoa(randomUUID())` per request on request and response (135-160); client-sent `x-locale` deleted (171); matcher excludes `_next`, images, favicon and all of `/api/` (191-196).
- Assumes: every page runs its own guard; the edge knows only cookie presence (16-28).
- Promises: priority 5: no cookie of one principal is consulted for another principal's prefix (see lib/routing.ts); staff and clinician share `24t_session`.
- Notes: `?expired=1` on ANY URL disables the "signed in at your own door" redirect for that request (routing.ts:391); harmless (it only lets a signed-in person see their own sign-in form). `/api/*` is wholly outside middleware, so every route handler must authenticate itself; not verifiable from this slice. Comment 193-194 names only the Stripe webhook and transcribe endpoint as reasons, while the exclusion covers every API route.

### mock-run.ts (4 lines)
- For: starts `tests/mock-openai` on port 8899 for local e2e runs.
- Decides/Assumes/Promises: none.
- Notes: a root-level scratch runner outside `scripts/`; not referenced by package scripts as far as this slice shows (not checked). Candidate dead file.

### next.config.ts (139 lines)
- For: security headers (nosniff, strict-origin-when-cross-origin, X-Frame-Options DENY, HSTS 2 years preload), one Permissions-Policy (camera, microphone, display-capture for self and *.daily.co; geolocation and payment none), `X-Robots-Tag noindex` on /admin, server action body 2 MB, single-process build, `distDir` from NEXT_DIST_DIR.
- Decides: as above.
- Assumes: CSP set in middleware, not here.
- Promises: none.
- Notes: the argument at 112-119 (policies attach to the document, client navigation inherits them) is the reason the per-route CSP relaxation in csp.ts is suspect. Server action body limit 2 MB (59) while uploads allow 8 MB credentials and 25 MB receipts and support files: any upload that goes through a server action above 2 MB fails before `uploadProblem` can say why, unless those uploads use a route handler (outside this slice). A receipt screenshot "6 MB" is exactly the case uploads.ts:93-96 says must not be refused.

## Stale

1. lib/audit.ts vs HAZARDS.md H6: H6 is marked "live" but `audit()` routes non-uuid ids to `resource_key` centrally (lib/audit.ts:129-130).
2. lib/auth/session.ts:155 "Absolute cap is checked in the same read" then does a second query (156-164).
3. lib/env.ts:222 "AUTH_SECRET is checked in every environment"; the check is inside `if (isProd)` (225).
4. lib/content/sanitise.ts:220-226 docstring "Discount an issued invoice ... A full discount settles the invoice" with no function beneath it.
5. lib/content/defaults.ts:1193 hipaa page "sessions expire after 30 minutes of inactivity and 8 hours absolute"; clinician/staff sessions are 2h / 12h (lib/auth/session.ts:34,36).
6. lib/console/pot-trace.ts:46-50 says the patient reference "LINKS to their own admin page"; `patientHref` is hard-coded null (130) and the reference is a session id prefix (129).
7. lib/i18n/strings.ts:57 `SAFETY_PREFIXES` includes "recording."; no key in messages.ts starts with "recording." (grep: 0). An exemption covering nothing, while the real recording keys (`room.recording`, `proom.recording*`, `jconsent.*`) are unprotected.
8. lib/i18n/messages.ts:1152 "jconsent.cannotUndo" ("Recording cannot stop part-way") predates 48.10, which gave the patient a Stop recording button ("troom.offRecordPatient", 3877).
9. lib/i18n/messages.ts:1490 "C227 removed the roster" while `sponsor.roster*` keys (1432-1433, 1565-1566) and `lib/data/sponsors.ts:92-107 roster()` exist.
10. lib/i18n/messages.ts:2576 vs 2939: two copilot allowance models ("earns N per session, rolls over" vs "N per patient per month"); one is stale.
11. lib/lifecycle/machines.ts:350-374 `grant` machine names entity `benefit_grants`, which does not exist; GRANT_STATUSES belongs to `historyGrants` (record access).
12. lib/lifecycle/machines.ts:386-390 sponsor `held` screen "the company portal"; a held sponsor cannot sign in (lib/sponsor-auth/session.ts:118).
13. lib/lifecycle/machines.ts:130-149 specifies a clinic-endorsement payout state that does not exist (the comment says so; still a spec living in a verifier's input).
14. lib/patient-auth/session.ts:29 "A shorter window" introducing longer limits (4h/7d vs 2h/12h).
15. lib/patient-auth/actions.ts:143-148 "Deliberately the same wording as a wrong password on sign-in"; it is not (150 vs 282) and it names the fix ("Try signing in instead").
16. lib/patient-auth/actions.ts:266-276 and 213-216 claim equal timing; `verifyPassword` returns early on the fake hash (see Broken).
17. lib/patient-auth/handle.ts:178-182 "A code that arrived by email proves the address, not the number"; the code records `whatsapp` whenever a phone exists and notify also emails it (see Broken).
18. lib/uploads.ts:20 and 143 "32-byte"/"32 random bytes"; code is `randomBytes(24)` (168). 55-57 avatar "read goes through an authenticated route"; `documentUrl` returns the storage URL.
19. lib/scheduling/hours.ts:21-26 `nextHour` has two identical branches.
20. lib/observability/errors.ts:26-27 "same access control and the same retention rules as the record"; errors are 30-day and staff-readable.
21. lib/auth/guard.ts:145-153 "no screen behind this guard queries a clinical table"; `/admin/tv` behind requireManager + elevation reads transcripts, notes, copilot content (lib/console/reads.ts).
22. lib/marketing/fixtures.ts:199-204 describes `lib/data/sponsors.ts:96` as holding "no therapist and no count" while the same comment says the company sees what it paid each clinician.
23. lib/content/demo.ts:231 "There is no `demo` row in `content_pages` and there never has been": undated state claim.
24. lib/geo.ts:240-244 "neutral globe where no single flag is defensible" while English=US flag, Arabic=Egypt flag.
25. lib/i18n/config.ts:52-58 Western digits for times and counts; several Arabic strings hard-code Eastern digits (messages.ts 4096, 4103, 4218, 4468, 4817; demo.ts 272-277).
26. middleware.ts:193-194 matcher comment names two API reasons; the exclusion is all of `/api/`.
27. lib/rate-limit.ts:304-310 `purgeExpiredLimits` still uses Node `new Date()`, the two-clock defect fixed everywhere else in the file (116-134).
28. mock-run.ts: referenced by nothing outside takeover/ (grep). Dead root-level file.

## Suspect

1. lib/security/csp.ts:130-182 + middleware.ts:141 + next.config.ts:112-119: the `'unsafe-eval'` needed by daily-js is attached only to a document request for `/sessions/:id/room`; next.config's own comment says the room is normally reached by client-side navigation, which keeps the first document's (strict) policy. If so, Daily's `Function()` is blocked and the clinician's call cannot connect. Answer: how the room is linked (full load or `<Link>`), and a live room walk.
2. lib/access/state.ts:167-176: revoked state keeps `copilot: true`. T5 "a revoked grant stops it on the next question" and the patient copy "Take it back and it stops that second" (defaults.ts:609, messages ar 506) hold only if lib/ai scopes a revoked clinician's copilot to their own material. Answer in lib/ai/case-copilot.ts.
3. lib/request.ts:18-19: first X-Forwarded-For entry is trusted. Safe on Vercel (which overwrites it); a bypass of every limiter if the origin is ever reachable directly.
4. lib/rate-limit.ts:97-111: while SIMULATION_RUNNING=1 every limit is 25x, including the console two-key unlock (125/hour) and patient code confirmations. Whether it is still set on production is not in the code.
5. lib/scheduling/hours.ts:36 hold of 10 minutes vs manual transfer confirmation "within a few hours": a slot held for an Egyptian patient paying by transfer lapses before A1's confirmation. Answer in lib/data/booking and the pay flow.
6. lib/console/board.ts:149-158 and lib/console/pot-trace.ts:106-120: joins sessions to sponsors through `enrolments.personId` with no enrolment period or pot id, so a person who changed employer is attributed to both (the simulation's P5 does exactly this).
7. lib/content/honesty.ts: savePage runs English regexes on Arabic rows; an Arabic fee or earnings claim cannot be refused. Also `(make|earn)\s+[$£€]` misses EGP.
8. lib/i18n/authoring.ts:66 `saveString` accepts `status: "published"` from the caller; whether an admin action passes it (publishing a safety string edit in one step) is in app/(admin).
9. lib/i18n/messages.ts:2236 "devs.promise4Body": a partner read "appears in the patient's own access log ... naming your platform"; lib/audit.ts has no partner actor slot. Answer in lib/partner and lib/data/portability.
10. lib/auth/session.ts + lib/routing.ts: a staff (back-office) cookie passes `requireUser`; every clinician page guarded only by `requireUser` renders for a staff account. What `/dashboard` shows a back-office role is in app/(app)/layout.
11. lib/clinic-auth/guard.ts:49-50 claims a DB CHECK refuses undelegatable capabilities in stored roles; not visible here (lib/db/schema, drizzle/).
12. lib/uploads.ts:39: HEIC accepted for licence photos but not renderable in most browsers; operator verification may see a broken image.
13. lib/content/service.ts:308-319 `readFooter` has no `-x-staging` filter (readNav does); safe only while staging rows carry no nav_label.
14. lib/marketing/fixtures.ts:263-265 prices 50-minute radar sessions; the product prices 30 minutes (`radar.fromPrice`, `tpay.rateLabel`).
15. lib/i18n/messages.ts:1210, 3055-3078: patient self-service refunds on no-show ("Refund me in full", "including our fee"); on the manual rail who pays it back and when is not in this slice, and machines.ts has no session/payment arrow for it.
16. lib/content/defaults.ts:417,821,834,891 "Your first session is free"; check lib/billing for the first-free rule.

## Broken

1. STAFF SIGN-IN HAS NO SECOND FACTOR (coordinator's question). `/staff/sign-in` posts to `signIn` in lib/auth/actions.ts:170-295 with `audience: "staff"`: email + password, a per-/24 limiter (20 per 15 min, 500 while SIMULATION_RUNNING) and a 5-failure lockout. Nothing else: no TOTP, no email code, no device check, no IP allowlist (grep of lib and app for totp/mfa/two-factor finds none in any auth path). The two-key elevation (lib/console/gate.ts) guards only the live console reads on `/admin/tv`; every other /admin screen (transfers Confirm/Reject, sponsors, clinics, strings, content publishing) is password-only. With `Demo2026!Therapy` published in docs/VALUE-STATEMENTS.md:253 for `omar@24therapy.app` (a platform admin on production), anyone who reads the repo can sign in to the production staff console and confirm money (A1/A2), publish copy, or open the elevation gate screen. The lockout does not help (the password is right the first time).
2. lib/patient-auth/handle.ts:104,114-122,187-191 with lib/notify/index.ts:268-340: the handle code is sent on every channel but recorded as `whatsapp` whenever the account has a phone, so receiving it by EMAIL marks the PHONE verified. Sign up with a stranger's number and your own email, confirm from your inbox, and the claim screen tells you whether a clinician keeps notes for that number, with initials. The disclosure handle.ts exists to close (37-42) is open, and while WhatsApp is unapproved email is the only working channel. Priority 1.
3. /admin/tv reads are unaudited: `app/(admin)/admin/tv/page.tsx:41-65` renders `sessionDetail` (note + transcript + risks), `conversationFor` (copilot text), `peopleByEmail` (names, emails) from lib/console/reads.ts and writes no audit row; only unlock/deny are recorded (lib/console/gate.ts:110-132). Breaks A5 "every read is written down", the /security page claim (defaults.ts:1232-1233), `marketing.clinics.a1` "not us, and there is no administrative override", and `dfl.consentWhy3`.
4. lib/console/board.ts:101, 238, 286-287 divide `cost_microcents` by 1,000,000 and label the result cents; the unit is thousandths of a cent (H13; lib/ai/client.ts:171 and lib/data/vault.ts:66 divide by 1000). `components/admin/board.tsx:264-268,387,439-440` show it with `usd()`: model spend on the founders' board is 1000x too small and "in minus AI" is overstated.
5. lib/patient-auth/actions.ts:277-280: the "timing-equal" path verifies against a bcrypt-shaped string that `verifyPassword` rejects without running scrypt (lib/auth/password.ts:29-30). No account / no password answers fast, a real password account answers after a full scrypt: a phone-number oracle for "has a patient account with a password". Sign-up also says so in words ("Try signing in instead", 150).
6. Receipts larger than 2 MB cannot be submitted: next.config.ts:59 caps Server Action bodies at 2 MB, receipts are uploaded through server actions (`app/pay/[token]/actions.ts:1,213`, `app/(app)/billing/actions.ts:208`, `app/(sponsor)/sponsor/pot/actions.ts:221`), while lib/uploads.ts:93-107 promises 25 MB precisely so "your screenshot is 6 MB" never blocks a payment. The payer sees a framework error, not `receiptUploadProblem`'s sentence. A1/A3 path.
7. lib/i18n/messages.ts, three contradictory consent stories on the consent surface itself: "jconsent.changeAnyTime" vs "jconsent.cannotUndo" (1151-1152) on the same screen, vs "portal.new.consentStop" (2014) and the patient's own Stop button (3877). A patient is told on the join screen that recording cannot be stopped part-way. Priority 3.
8. lib/i18n/messages.ts:5713 Arabic "portal.book.body" says the published hours are bookable "on your profile and OFF the radar"; English says "and the radar".
9. lib/content/defaults-ar.ts:794, 802: the Arabic contact page's two entity addresses are an admin instruction ("set the registered address from admin, content, contact"), rendered to the public if the block shows `address`.
10. lib/content/defaults-ar.ts:82,120,158 vs defaults.ts:82,120,158: the competitor table states different rival prices in Arabic and English under the same `checkedOn` date; defaults-ar.ts:48 also types our own per-session prices into copy (C60).
11. lib/lifecycle/machines.ts: the manual-transfer lifecycle (`manual_payments`, awaiting_proof/submitted/confirmed/rejected) is not declared, so verify:machines' "every stopped person has a way out" never examines the Egyptian rail (task 124's dead end); and `payout.sent` has no way out for a bounced transfer.
12. lib/clinic-auth/switch.ts + `app/(clinic)/clinic/sign-in/actions.ts:18-36` + lib/auth/actions.ts:264: C352 "never one session carrying both capability sets" holds only on the switch path; signing in at both doors leaves a linked human with a live clinician cookie and a live clinic cookie at once.
13. lib/auth/actions.ts:293: `next` accepting `/\host` is an open redirect after clinician sign-in (browsers normalise `/\` to `//`).
14. lib/auth/actions.ts:312-341: clinician/staff password reset has no rate limit (patient reset has one): unlimited reset emails to any address, unaudited.
15. lib/scheduling/tz.ts:184-185: English caveat sentences appended to Arabic-formatted dates.

## Looks broken, is handled

1. Staff and clinicians share one cookie and one session table (lib/auth/session.ts:22, lib/routing.ts:197-205). Handled for /admin: the staff door refuses a non-back-office account after the password (lib/auth/actions.ts:252-256) and `requireStaff` allowlists roles on every admin page (lib/auth/guard.ts:154-157); the practice door refuses back-office accounts (257-262). The residual is Suspect 10.
2. A clinic manager carries the real organisation id, so clinical queries could be scoped by it. Handled by spelling it `clinicOrganizationId` and giving the type no `userId`/`Role` (lib/clinic-auth/session.ts:65-108), and by audit refusing a clinic-manager row that names a patient (lib/audit.ts:103-105).
3. `sql.raw` in lib/rate-limit.ts:112,228 looks like H7; the only value is `Math.floor` of a number the code supplies, never data.
4. lib/content/url.ts accepts any https image into a CSS `url()` under `style-src 'unsafe-inline'`; the character blacklist (18) plus re-validation at render keeps the value inside the declaration, and csp.ts:192-197 accepts the beacon risk explicitly.
5. lib/auth/password.ts:32-35 lets a stored hash choose scrypt cost; only a DB writer can plant one, and `maxmem` is fixed (50).
6. Middleware only sees cookie presence (middleware.ts:16-28); every guard re-reads its own session table with revocation, idle and absolute checks in the WHERE (clinic, sponsor, partner, patient session files).
7. Receipts could be deleted by a future cleanup; handled by `isUndeletable` throwing (lib/uploads.ts:235-270) with a malformed URL counted as undeletable.
8. `x-locale` could be forged by a client to change a page's language; middleware deletes it before setting (middleware.ts:171), and server.ts reads it first.

## Unclaimed

(a) worth selling, nothing advertises it:
- Clinic staff custom roles with a closed capability vocabulary, therapist-scoped assistants, undelegatable money and membership (lib/clinic-auth/capabilities.ts:32-105). No promise; C1-C5 talk only about the manager.
- Switching between clinician and practice principals in one click, revoking the side left (lib/clinic-auth/switch.ts).
- Machine translation of the whole interface into a new language, gated at 100% human approval, with safety strings protected (lib/i18n/authoring.ts, strings.ts).
- DST-correct scheduling with gap detection and quiet hours for reminders (lib/scheduling/tz.ts:258-349).
(b) nobody should have it, a hole:
- A super_admin with the two console keys reads any person's transcripts, notes, copilot conversations and risk flags across all organisations, unaudited (lib/console/reads.ts; /admin/tv).
- An operator can mail a clinician's full session history, with every patient's name and email, to any external address typed in a box, telling only the clinician (lib/console/history.ts; app/(admin)/admin/tv/actions.ts:79-132).
- Anyone can learn whether a phone number has a record with a clinician via the handle-verification channel bug (lib/patient-auth/handle.ts; Broken 2).
- An admin can override any interface string in either language, including "HIPAA BAA included", with no claim check (lib/i18n/authoring.ts).
- The sponsor sees enrolees by first and last name (lib/data/sponsors.ts:95-107 via fixtures comment) and which therapists its pot paid (lib/marketing/fixtures.ts:206-211, `dpo.neverWhoWent`).
(c) half built:
- Payout `sent` with no failure arrow; clinic endorsement state specified and absent (lib/lifecycle/machines.ts:130-176).
- Sponsor `held` and partner `held`: no portal, no screen, no rejection path (lib/sponsor-auth/session.ts:118, lib/partner-auth/session.ts:119, machines.ts:385-419).
- Verification `approved` has no revocation arrow (machines.ts:289-310).
- Record-access grants have no declared machine (machines.ts:350-374 describes a table that does not exist).
- WhatsApp codes for patients (sign-in, handle proof, reset) all say "incomplete until Meta approves"; phone-only patients have no way to recover or prove a handle (lib/patient-auth/*.ts headers).
- Egypt payment gateway env keys exist and are empty on purpose (lib/env.ts:308-321).

## Promise evidence

- P1 (three taps): lib/content/defaults.ts:282,343 and messages `pat.noAccount`/`crisis.noAccountLine` promise a session from a first name; A1 and the 10-minute hold (lib/scheduling/hours.ts:36) make that false for a paid session on the manual rail. Verdict: partly (free or card sessions only), cannot tell the tap count from here.
- P2 (nothing only in email): lib/notify/index.ts writes the in-app notice first (read for Broken 2). Verdict: cannot tell from here.
- P3 (nothing machine-written unsigned): copy only here (messages `psessions.writing`, `prating.stillWriting`, `tappr.*`). Verdict: cannot tell from here.
- P4 (one record, patient decides readers): lib/access/state.ts grant arithmetic; broken at the edges by the console's unaudited cross-organisation reads (lib/console/reads.ts) and the handle-proof hole (lib/patient-auth/handle.ts). Verdict: partly.
- P5 (crisis never depends on money): sponsor suspension touches no patient (lib/sponsor-auth/session.ts:85-88); crisis strings protected only under `crisis.` prefix (lib/i18n/strings.ts:57); emergency sentences under other prefixes are not. Verdict: partly (the SOS itself is outside this slice).
- T1, T2: copy only (messages `ft.f1`, `ft.f2`). Cannot tell.
- T3 (netting): lib/content/honesty.ts refuses the fee claim in English CMS rows only. Verdict: kept for English CMS, not for Arabic rows or dictionary overrides.
- T4: not in this slice.
- T5: lib/access/state.ts:167-176 keeps copilot on revoke (Suspect 2). Cannot tell; at risk.
- C1: regulators and verification labels (lib/regulators.ts). Cannot tell.
- C2 (no patient name, no caseload count in clinic portal): contradicted by design: `schedule.read` "names and appointment times" (lib/clinic-auth/capabilities.ts:33), `clinic.join.sees.names` "first name and last initial", `pclinic.theySee` "Your name", `clinic.scheduleBody` (messages 1739, 2037, 2105), and the marketing demo shows names (lib/marketing/fixtures.ts:158-171). No caseload count: kept in fixtures (126-136). Verdict: broken as written (names shown, disclosed); the promise, not the code, is wrong.
- C3, C4, C5: copy only; `earnings.read` capability exists (capabilities.ts:39). Cannot tell.
- E1 (never who, never when): admin board and pot trace are counts and references (lib/console/board.ts, pot-trace.ts); sponsor sees enrolee names and therapists paid (Unclaimed b). Verdict: partly (who is enrolled and which clinicians were paid are visible).
- E2: sponsor actor has no organisationId (lib/sponsor-auth/session.ts:40-48). Kept structurally.
- E3, E4, E5: copy only (`sponsor.coverageFrom`, `benefit.*`). Cannot tell.
- A1 (nothing granted before a person confirms): receipts > 2 MB cannot be submitted at all (Broken 6); staff Confirm reachable with the published password (Broken 1). Verdict: at risk.
- A2, A3, A4: `paymentsBoard` shows the queue and oldest wait (lib/console/board.ts:301-317); no manual-payment machine (Broken 11). Cannot tell from here.
- A5 (role is a list, refusals redirect, on the record): lists not ranks: kept (lib/auth/guard.ts:67-79, clinic capabilities). Refusal redirects: kept (requireRole, requireClinicCapability, requireSponsorAdmin, requirePartnerAdmin all redirect). Refusal on the record: broken, none of these guards writes an audit row; only the console key denial is recorded (lib/console/gate.ts:110-115). "Every read is written down": broken for /admin/tv (Broken 3) and for blob documents (lib/uploads.ts, H14).

## Coverage

| File | Lines | Status |
|---|---|---|
| lib/access/state.ts | 252 | read |
| lib/alarm.ts | 453 | read |
| lib/audit.ts | 158 | read |
| lib/auth/actions.ts | 424 | read |
| lib/auth/doors.ts | 80 | read |
| lib/auth/guard.ts | 170 | read |
| lib/auth/password.ts | 62 | read |
| lib/auth/session.ts | 231 | read |
| lib/brand.ts | 13 | read |
| lib/clinic-auth/capabilities.ts | 186 | read |
| lib/clinic-auth/guard.ts | 102 | read |
| lib/clinic-auth/session.ts | 248 | read |
| lib/clinic-auth/switch.ts | 138 | read |
| lib/console/board.ts | 406 | read |
| lib/console/gate.ts | 169 | read |
| lib/console/history.ts | 155 | read |
| lib/console/pot-trace.ts | 172 | read |
| lib/console/reads.ts | 406 | read |
| lib/content/defaults-ar.ts | 815 | read |
| lib/content/defaults.ts | 1282 | read |
| lib/content/demo.ts | 570 | read |
| lib/content/honesty.ts | 130 | read |
| lib/content/registry.ts | 64 | read |
| lib/content/sanitise.ts | 226 | read |
| lib/content/service.ts | 407 | read |
| lib/content/url.ts | 31 | read |
| lib/crypto/secretbox.ts | 135 | read |
| lib/env.ts | 397 | read |
| lib/feedback-options.ts | 38 | read |
| lib/geo.ts | 298 | read |
| lib/geocode.ts | 144 | read |
| lib/globe.ts | 137 | read |
| lib/i18n/authoring.ts | 413 | read |
| lib/i18n/client.tsx | 106 | read |
| lib/i18n/config.ts | 117 | read |
| lib/i18n/messages.ts | 7055 | read |
| lib/i18n/paths.ts | 158 | read |
| lib/i18n/server.ts | 131 | read |
| lib/i18n/strings.ts | 304 | read |
| lib/lifecycle/machines.ts | 515 | read |
| lib/logger.ts | 57 | read |
| lib/marketing/fixtures.ts | 272 | read |
| lib/observability/errors.ts | 195 | read |
| lib/partner-auth/guard.ts | 44 | read |
| lib/partner-auth/session.ts | 144 | read |
| lib/patient-auth/actions.ts | 291 | read |
| lib/patient-auth/code-signin.ts | 228 | read |
| lib/patient-auth/guard.ts | 32 | read |
| lib/patient-auth/handle.ts | 202 | read |
| lib/patient-auth/reset.ts | 265 | read |
| lib/patient-auth/session.ts | 210 | read |
| lib/phone/e164.ts | 185 | read |
| lib/rate-limit.ts | 330 | read |
| lib/regulators.ts | 240 | read |
| lib/request.ts | 33 | read |
| lib/routing.ts | 407 | read |
| lib/scheduling/hours.ts | 135 | read |
| lib/scheduling/tz.ts | 349 | read |
| lib/scheduling/use-reader-zone.ts | 44 | read |
| lib/security/csp.ts | 265 | read |
| lib/sponsor-auth/guard.ts | 44 | read |
| lib/sponsor-auth/session.ts | 150 | read |
| lib/uploads.ts | 315 | read |
| lib/utils.ts | 177 | read |
| lib/viewer.ts | 34 | read |
| instrumentation.ts | 43 | read |
| middleware.ts | 197 | read |
| mock-run.ts | 4 | read |
| next.config.ts | 139 | read |
| Total (69 files) | 22329 | read |
