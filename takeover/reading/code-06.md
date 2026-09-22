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

