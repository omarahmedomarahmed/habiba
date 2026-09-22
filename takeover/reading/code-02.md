# Slice 02: data-a-f

## Files

### lib/data/actuals.ts (640 lines)
- For: `/admin/actuals`, the company's measured monthly result (revenue, spend, bank, held-for-others, runway). super_admin only, never clinical.
- Decides: `monthlyActuals` (229) builds the month range from six sources, earliest wins (`monthRange` 473); revenue is `-SUM` of `platform_revenue` split by `ref_type` (`ledgerByMonth` 567, 593 to 609); completed sessions only (`activityByMonth` 540); AI cost rounded once (309, `CENTS_PER_MICRO = 1000`, consistent with H13: 1000 units per cent); `oursCents = bank - held` (356); burn over trailing three months, null when profitable (`positionFrom` 425 to 432); runway floors negative "ours" at zero (432).
- Assumes: ledger sign convention (positive = debit) from `lib/billing/ledger.ts`; `capitalByMonth` returns a CUMULATIVE figure per month (it is used as "capital in by end of month" at 329); `payrollByMonth` in `lib/data/payroll.ts`.
- Promises: none of P1..A5 directly. Reads `sessions` counts only (no names). Not clinical.
- Notes: `monthRange` counts FORWARD from the first month and stops at `maxMonths` (496), so once the business is older than 36 months the page shows the first 36 and never the current month, while the running cash also stops accumulating. Ledger months outside the range are silently dropped from every total. `NOT_MEASURED_HERE` (57) is printed on the page; its payroll text hardcodes "two of the seven on the payroll are founders drawing the same $500" (70), a data claim frozen in source.

### lib/data/admin-team.ts (80 lines)
- For: `createBackOfficeUser`, minting `staff` / `manager` accounts in our own org (slug `24therapy`).
- Decides: role enum closed to staff|manager (53), super_admin not creatable (comment 28), org looked up by slug (57), password through `validatePassword` (50). Any insert failure is reported as "already an account with that email" (74 to 76), which hides every other failure (a CHECK, a missing column).
- Assumes: caller is behind `requireRole("super_admin")` (not checked here); `users.email` unique.
- Promises: A5 (role is a list): serves it by making non-founder accounts exist. No audit written in this function; caller must.
- Notes: logs email via `ref()` (hashed ref), fine.

### lib/data/admin.ts (468 lines)
- For: cross-organisation admin reads (stats, clinician list, one clinician in full, audit log, AI usage) plus `setUserStatus` and `setVerification`.
- Decides: header (35) says every function must be behind `requireRole("super_admin")`; nothing in the file checks it. `therapistPatients` (291) returns patient names, emails, phones for a clinician; `therapistSessions` (343) patient names and session times; `therapistCopilotUsage` (373) counts only; `listAuditLog` (193) deliberately does not join patients, joins the three actor tables (users, sponsor_users, clinic_managers). AI cost from `cost_microcents / 1000` rounded once (74, 417, 447).
- Assumes: callers audit. Checked: `app/(admin)/admin/therapists/[id]/page.tsx:40,48` does `requireRole("super_admin")` then a `break_glass` audit before reads; `app/(admin)/admin/actions.ts:45,59` audits suspend and verify.
- Promises: A5 (every read written down): kept for the one-clinician page. Not a sponsor/clinic surface.
- Notes: `platformStats.clinicians` (50) counts every `users` row including staff, managers and super_admins, labelled clinicians. `listClinicians` (101) and `therapistOverview` (259) left-join `subscriptions` on organisation, so an organisation with more than one subscription row duplicates the clinician row. `setVerification` (146) writes `users.verification_status` first; migration `drizzle/0083_verification_one_truth.sql:108 to 121` forces that column to the derived value on every update, so the first write is a no-op and the comment "written to both places" (132 to 139) is stale. It sets `reviewedAt` even for "pending" / "unverified" (178), so an admin resetting to pending looks reviewed.

### lib/data/assessments.ts (598 lines)
- For: questionnaires (PHQ-9 style instruments): publish, assign, answer with per-answer timing, score, band for clinician only.
- Decides: `publishInstrument` (82) refuses `licence = 'licensed'` (94, also DB `instruments_free_only`) and a translated instrument nobody reviewed (108). `ownedAssignment` (182) scopes patient calls to `patients.person_id`. `recordAnswer` (199) refuses a completed assignment, a question or value not on the instrument (229 to 235), clamps timing to 5 minutes or null (169, 237). `completeAssignment` (290) sums whatever answers exist and freezes. `bandFor` (330) separate so a patient screen never gets a band. `historyForPerson` (462) returns score and date only.
- Assumes: the clinician caller has checked access (`app/(app)/patients/[id]/assessments/actions.ts:27` `gate` does `getPatient` plus `accessFor != revoked`); patient callers pass `personId` from the session (`app/(patient)/patient/assessments/actions.ts:28,51`).
- Promises: P3 in spirit (no machine verdict to a patient: score without band). T5 not applicable (not copilot).
- Notes: `completeAssignment` does not check that every question was answered (298 to 303): a PHQ-9 finished after three answers freezes a low score on the chart with status completed, and `finishAssessment` only checks for null. `assignInstrument` (125) does not check the `sessionId` belongs to this patient. The comment at 282 says a score must keep meaning what it meant on the day, but the clinician's `pollAssessment` and `timingsFor` (`app/(app)/patients/[id]/assessments/actions.ts:102,141`) band and label questions with `instrumentByKey`, the LATEST published version, not the version the assignment names (`instrumentVersion`, 141).

### lib/data/capital.ts (326 lines)
- For: capital contributions and typed-in other costs for `/admin/actuals`. super_admin only.
- Decides: `mustBeFounder` (82) throws unless `actor.role === "super_admin"` on every read and write. `capitalByMonth` (132) is cumulative and adds pre-range money (159 to 166). `setOtherCost` (262) one figure per kind per month, zero deletes (291), audits old and new amounts. `removeCapital` (225) hard deletes, audited with both figures.
- Assumes: `audit()` tolerates a non-uuid `resourceId` (318 passes `kind:month`); it does: `lib/audit.ts:129,130` routes non-uuid to `resourceKey` (H6 handled).
- Promises: A5 (every write written down): kept here.
- Notes: the pre-range block (151 to 166) says `monthRange` starts at the first thing in the product; `lib/data/actuals.ts:480` now includes `capital_contributions` in that range, so `before` is always zero except under the 36-month cap. Harmless, stale reasoning.

### lib/data/challenge.ts (653 lines)
- For: §3b match route: "have you seen Dr X?" then "what first name did you give them?", 3 attempts per (account, record), hint costs one, clinician release.
- Decides: `openChallenges` (131) only on a VERIFIED phone/email (153 to 155), skips claimed people (201), rejected/verified claims and spent budgets. `answerSeen` (243) no is final (status rejected). `answerName` (318) compares against `patients.first_name` only (378), counts failures atomically on `claim_attempts` (386), locks at 3 (401). `nameHint` (452) refused on the last attempt (482). `challengePassed` (531) needs `name_confirmed_at`. `releaseLock` (577) zeroes the budget, stamps `released_at`, expires the locked claim.
- Assumes: `nameMatches` in `./name-match`; callers put `accountId` from the session; `releaseLock` caller does the tenancy check via `getPatient` (comment 567).
- Promises: none of the 25 directly (claiming is under P4's "patient decides").
- Notes: see Broken for the re-lock after release, and the left join that can resurrect a rejected record. `challengePassed` is exported and has NO caller anywhere in app/components/lib (grep): the gate "every screen consults before rendering anything about a record" (511) is consulted by nobody. The consent step after the challenge is `verifyClaim`/ClaimFlow in claims.ts, which does not check it either.

### lib/data/checkins.ts (287 lines)
- For: the unprompted check-in channel (email/WhatsApp to patients), mutes, replies, admin counts.
- Decides: candidates are people with a non-deleted `patient_accounts` row (`candidates` 46, inner join 58), muted flag, last check-in via DISTINCT ON (73). `muteRate` (117) returns 0 on empty. `unmute` (189) uses DB `now()`. `checkinStats` (245) six integers only. No `lib/ai` import (header 12).
- Assumes: that an account row means the person claimed and consented (comment 39 to 41); the query does not check `people.claimed_at` or any consent flag, only that an account exists for that person id.
- Promises: none. Check-ins are Unclaimed (a), and their crisis routing is Unclaimed too (MAP Unclaimed 5).
- Notes: `candidates(limit = 500)` has no ORDER BY (66): past 500 accounts the same arbitrary subset is considered every run and the rest are never checked in on. Locale is hardcoded "en" (98), so an Arabic reader gets English check-ins. `muteRate` counts one person twice if they have two accounts (only one live account per person is allowed by `patient_accounts_person_unique`, so fine).

### lib/data/claims.ts (693 lines)
- For: §3 claiming: sprint 6 email/phone match route with a 6-digit code, and the clinician's invite link route; account follows the claimed record (22R).
- Decides: `suggestionsFor` (94) filters claimed and self. `startClaim` (200) refuses claimed people, one pending claim per (account, person, NULL patient), code hashed, 30 min TTL (61). `verifyClaim` (296) checks code hash, expiry, account; transaction marks verified, stamps `people.claimed_at` guarded on NULL (354 to 361), expires other pending claims, `bindAccountToPerson` (148) re-points the account only if its own person has no clinical rows. `applyClaimDecision` outside the tx (392); webhook `notifyRecordClaimed` (409). `issueInvite` (442) 24 random bytes, hash stored, 30 days. `redeemInvite` (545) single use via conditional UPDATE, checks `took` (580). `revokeInvite` scoped to issuer.
- Assumes: `app/(patient)/patient/claim/actions.ts:97` `sendClaimCode(personId)` passes a client-supplied personId and sends the code to `actor.email` (119), i.e. to the claimer's own already-verified inbox.
- Promises: P4 ("the patient decides who may read the history"): step 7 default off is kept (no default parameter, 300; `components/patient/claim-flow.tsx:45` unchecked). The mis-claim protection behind P4 is broken (see Broken).
- Notes: `verifyClaim` ignores the result of the `people` update (354): if somebody else claimed the person between code and confirm, the claim still goes verified, the account is re-pointed and the grant decision is re-applied. `patient_accounts_person_unique` (`drizzle/0034_patient_accounts.sql:61`) makes the re-point fail and roll back when the winner's account already sits on that person, so the race only lands when the winner's account was "kept" on its own person. `redeemInvite` does not expire other pending `person_claims` on the person (verifyClaim does, 370). No attempt limit on wrong codes in `verifyClaim`; `startClaim` can re-issue freely. Header (43) still describes the match route as "show a redacted name", which `challenge.ts:63` says was "one question too generous"; ClaimFlow still shows it (`components/patient/claim-flow.tsx:179`).

