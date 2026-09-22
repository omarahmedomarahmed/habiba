# Slice 03: data-g-z

## Files

### lib/data/grants.ts (611 lines)
- For: history grants (consent) between a person and a therapist: read access state, request, decide, revoke, apply claim decision.
- Decides: `accessFor` (107) scopes patient row to actor org and, unless super_admin, to `patients.therapistId = actor.userId`; missing row = `no_relationship`. `liveGrantRow` (69) newest pending/granted row; expiry decided in `lib/access/state.ts`. Unlock (156-157) needs a diagnosis AND a typed/dictated person document (`hasWrittenHistory` 195). `requestAccess` (251): refuses unclaimed, already granted, already pending; note 1..500 chars; rate limit 2/day per (therapist, patient) (56, 279); insert with ON CONFLICT DO NOTHING on partial unique index (307-316). `decideGrant` (345): conditional update on status pending and personId (389-390); 24h grant writes expiry at decision time (376-379); catches trigger 0060 "verification is not approved" and explains (394-403); on grant, `notifyPatientOfGrant` best effort (425-433). `revokeGrant` (447): update granted to revoked, audits, then `notifyGrantRevoked` partner webhook (493-497). `applyClaimDecision` (512): yes creates open grants to every therapist holding a non-deleted patient row for this person; no audits `grant.withheld_at_claim`.
- Assumes: migration 0060 trigger `history_grants_require_verified` (BEFORE INSERT OR UPDATE, raises when status granted and therapist not approved); partial unique index on (person_id, therapist_user_id) where status in pending/granted; `lib/access/state.ts` for states and capabilities.
- Promises: T5 partly (see Promise evidence: revocation degrades, does not stop the copilot). P4 "patient decides who may read the history" kept for the live profile.
- Notes: module pinned to default region (37). `grantCounts` (605) is unscoped, for admin/verifier. `revokeGrant` cannot cancel a pending request (only `decideGrant` rejected can). Rejection reason stored only if `isRejectionReason` (381), otherwise dropped silently to null while audit keeps the raw string (414).

### lib/data/homework.ts (355 lines)
- For: homework steps: patient sees one next step and open list; clinician sees trend and full list; clinician assigns/withdraws.
- Decides: `nextStepFor` (67) oldest open item plus `othersWaiting` capped at 9 (83). `openStepsFor` (93) open only, 50 max, never done/skipped. `closeStep` (122) only the person, conditional on status open and personId. `homeworkTrend` (186) counts plus skip streak over last 20 closures; completionRate null when nothing closed. `assignStep` (244) title 1..200. `withdrawStep` (293) deletes, only open and only by the assigning clinician. `draftedStepsFor` (320) reads `session_notes.content.patientSteps`. `personForSession` (344).
- Assumes: callers check access. `listHomework`, `homeworkTrend`, `draftedStepsFor`, `personForSession` take ids with no actor and no scope.
- Promises: none of the 25 directly.
- Notes: `listHomework` (225) returns every item for the PERSON across every clinician, including the patient's own `patientNote`. Its only caller, app/(app)/patients/[id]/documents/page.tsx:97, renders it with no grant check (only `canAssign` depends on state, :282). See Suspect.

### lib/data/instrument-seeds.ts (139 lines)
- For: the shipped PHQ-9 and GAD-7 content (verbatim wording, bands, attribution).
- Decides: locales `["en"]` only (81, 122) so the drafted Arabic cannot publish; bands are clinician-facing only (103-106).
- Assumes: 0070 constraints `instruments_free_only`, `instruments_translation_reviewed`; `bandFor` elsewhere.
- Promises: none.
- Notes: item 9 (self harm) explicitly not an alert (92-99). Pure data, no DB.

### lib/data/journals.ts (291 lines)
- For: patient journals: write (with crisis scan), read own, clinician read, copilot context.
- Decides: `writeJournal` (86) 1..20000 chars, routed by person region; `scanForCrisisLanguage` sets riskLevel high; audit `journal.write`; alert best effort (133). `alertGrantHolders` (156) notifies therapists with status granted AND `expiresAt >= now` (171); notification does not quote the entry (189-191). `journalsForClinician` (203) caller must check grant. `journalContext` (244) excludes entries after `before` (room opened, C211), omits riskLevel from the model.
- Assumes: `lib/crisis/alerts.ts` scanner; grant check by callers (documents page gates on `capabilities.patientFiles`, app/(app)/patients/[id]/documents/page.tsx:86-87).
- Promises: P5 not affected (button path is elsewhere). Crisis alerting is Unclaimed.
- Notes: page never says anyone is watching (32-38). See Broken: open grants never alerted; link goes nowhere.

### lib/data/meeting-connections.ts (196 lines)
- For: a clinician's connected Zoom/Meet/Teams accounts (OAuth tokens sealed at rest).
- Decides: `listConnections` (36) no credential in the shape. `saveConnection` (66) seals before write, revokes the prior live row for that provider first (83). `revokeConnection` (118) clears the sealed tokens, keeps the row. `accessTokenFor` (159) the single decrypt; expired returns null (187), undecryptable returns null (191-195).
- Assumes: `TOKEN_ENCRYPTION_KEY`; constraints `meeting_connections_live_unique`, `meeting_connections_revoked_is_empty`; `verify:sprint41` checks no component imports `accessTokenFor`.
- Promises: none. External meeting recording is Unclaimed (a).
- Notes: revoke then insert is not a transaction (83-93): if the insert fails the old connection is already gone. `accessTokenFor` has no ORDER BY but the live-unique index makes one row. No refresh path here (comment 180-186); an expired token silently means no meeting.

### lib/data/memory.ts (67 lines)
- For: read the person's rolling profile and observation timeline (writer is lib/ai/profile.ts).
- Decides: `profileFor` (28), `timelineFor` (38, oldest first, 200 cap), `isStale` (61) compares counts.
- Assumes: caller enforces access. It does not (see Broken, documents page).
- Promises: P4 exposure via caller.
- Notes: no update path by design (23-25). `isStale` is called with `documents: all.length` (every document, not the visible subset) at documents/page.tsx:223.

### lib/data/name-match.ts (52 lines)
- For: pure name comparison for claiming a record (13.6).
- Decides: NFKD, strip Latin and Arabic combining marks, lower-case, collapse whitespace (32-39); empty offering never matches (48-52).
- Assumes: used by lib/data/challenge.ts.
- Promises: P4 indirectly (who reaches a record).
- Notes: exact match only. Hamza-on-alef folds (NFKD splits U+0623 into alef plus U+0654, which is in the stripped range), but tatweel (U+0640), alef maksura vs ya, and ta marbuta vs ha are not folded, so common Egyptian spelling variants of one name are a miss. A near miss is sent to an invite link by design.

### lib/data/notices.ts (111 lines)
- For: the patient's in-app notice log (`patient_notifications`), keyed by message key, no prose, no sponsor id.
- Decides: `noticesFor` (57) all notices incl. dismissed, 200 cap, on controlDb. `undismissedCount` (79). `dismissNotice` (100) stamps, scoped to person in the WHERE, idempotent.
- Assumes: writers in lib/notify/index.ts, lib/data/enrolment.ts, enrolment-verify.ts, sponsors.ts; message keys exist in lib/i18n/messages.
- Promises: P2 partly: this is the in-app half, but see Stale (the badge function has no caller). E1/E2: no sponsor id on the row (30-31), kept.
- Notes: patient notices live on controlDb (control plane) although they are about a person; every other person-owned table routes by region. Deliberate or not, it is the one person table in this slice on the control plane besides meeting connections.

### lib/data/notifications.ts (69 lines)
- For: the clinician's `notifications` table: unread list, mark read.
- Decides: `unreadNotifications` (31), `markSessionNotificationsRead` (48) matches `action_url LIKE %sessionId%` (59), `markAllRead` (64).
- Assumes: writers (crisis alerter, radar, journals, grants) use an action URL containing the session id when session-bound.
- Promises: none directly.
- Notes: reads on the default-region pool (18); lib/data/journals.ts:162/185 WRITES crisis notifications through `dbFor(regionOfPerson)`. Today `eg` falls back to the US URL (lib/db/region.ts:27-33) so they meet; the day `DATABASE_URL_EG` is set, an Egyptian patient's journal alert lands in Cairo and the clinician's banner reads Virginia.

### lib/data/partner-admin.ts (341 lines)
- For: everything that changes a partner (EHR integrator): enquiry, state, first user, sign-in check, admin lists, production approval.
- Decides: `applyToPartner` (44) creates a HELD partner, no user, no key. `setPartnerState` (101) no side effects on clinicians. `createPartnerUser` (123) password >= 12, unique email across partners, one message either way. `checkPartnerPassword` (161) constant work; held/suspended get the same "do not match" (191-193). `sponsorChoices` (258) active sponsors, name and id only, shown on the partner's own screen. `approveForProduction` (286) refuses without documents URL, contact name, phone; DB `partners_approval_pair`. `withdrawApproval` (333) stops new live keys, keeps existing.
- Assumes: `getPartnerActor`/`authenticateKey` read `partners.state` in their WHERE; audit written by app/(admin)/admin/partners/actions.ts (46, 78, 105, 130).
- Promises: A5 (audit) kept via the caller. E2: `sponsorChoices` lists every active sponsor's name to any partner operator; a partner therefore learns the full list of our corporate customers (see Unclaimed (b)).
- Notes: `applyToPartner` is open to strangers with no rate limit visible here (caller may limit). `checkPartnerPassword` runs a full `verifyPassword` for a held partner but returns early for no user after a hash; both paths do one hash, so timing holds.

### lib/data/partner-links.ts (101 lines)
- For: the patient's view of which partner platforms can identify them, and cutting a link.
- Decides: `linkedPartners` (49) live links, partner name and date only. `unlinkPartner` (78) person id as a WHERE condition; `resolveSubject` in lib/partner/api.ts filters `revoked_at` so it is immediate.
- Assumes: caller app/(patient)/patient/consent/actions.ts:154 queues `subject.unlinked`.
- Promises: P4 (patient decides) kept for partner write-back.
- Notes: no `audit()` on unlink here or in the caller (consent/actions.ts:154-176); a consent withdrawal leaves only a log line. The caller's comment says telling the partner is "best effort" but `queueWebhook` is awaited with no catch (consent/actions.ts:167-171).

### lib/data/patient-import.ts (328 lines)
- For: a clinician imports their own caseload from a CSV: pure parse and preview, then one `createPatient` per row.
- Decides: only four columns cross (`COLUMNS` 68-73); every other column is named in `ignoredColumns` (205-207). `parseImport` (176) requires a name and a phone column, phone through `toE164` with a country (227), duplicates within the file refused (234-237), bad email dropped not refused (246-248). `importPatients` (269) skips numbers already on the caseload (`patientPhonesOnCaseload`, scope is caseload not org), collects failures, one `patient.import` audit with counts only (308-314).
- Assumes: app/(app)/patients/import/actions.ts:76-113 re-validates the JSON rows that come back from the form (E.164 regex, lengths). `createPatient` writes the org and therapist from the actor.
- Promises: none of the 25. Unclaimed (a): migration from another platform.
- Notes: the header alias `name` maps to firstName (69), so a single "Name" column puts the full name in first name. No row cap in the parser; the commit action caps at 2000. `AN_IMPORT_CARRIES_NO_CLINICAL_TEXT` (328) is a constant for a verifier, not enforcement.

### lib/data/patient-view.ts (318 lines)
- For: the only session queries a patient screen may use: own sessions grouped, the open-session orb, the live banner.
- Decides: `sessionsForPatient` (88) routed by person region; select list is the enforcement: only `content->>'patientBrief'`, `provenance`, `patientStatus` from notes (107-117); brief shown only when `patientStatus = 'approved'` (131, 148); `briefPending` when unsigned and in the past (149). `openSessionForPatient` (208) newest scheduled/in_progress, not ended, with a join token; `owes` when price > 0 and payment pending (241). `liveSessionForPatient` (250) in_progress, not ended. `groupOf` (298) future within 24h is "today"; past unscheduled or radar is "past_instant".
- Assumes: `patient_status` is set only by a clinician's signature; `sessions.join_token` present for joinable sessions.
- Promises: P3 partly: nothing unsigned reaches the patient (kept), "still writing" state exists (`briefPending`), but the row carries the therapist's name only, no credentials (143). P2 partly: `openSessionForPatient` is the orb's source. P4: sessions across all clinicians shown to the person (kept).
- Notes: see Suspect for stale doors and cancelled sessions. `groupOf` "today" is "next 24 hours", not the reader's calendar day, and a session earlier today is "past".

### lib/data/patients.ts (313 lines)
- For: clinician caseload reads and writes on `patients`.
- Decides: `scope` (23) org plus own caseload unless super_admin. `patientsWithPhone` (43) and `patientPhonesOnCaseload` (70) caseload-scoped so a duplicate check is not a lookup oracle. `listPatients` (83) with completed session count (correlated subquery fixed, 92-111). `getPatient` (119) audits `patient.read`. `getPatientHistory` (137) sessions on this patient row incl. note content and off-record seconds. `createPatient` (180) E.164 required; person created best effort (213). `updatePatient` (238) allowlisted fields; diagnosis change refused unless `capabilities.diagnosisChanges` (272-278). No delete (295-304).
- Assumes: migration 0042 phone rule for `source = 'therapist'`; `ensurePersonForPatient` in people.ts.
- Promises: P4 (diagnosis change gated on grant) kept.
- Notes: `updatePatient` writes `phone` with no E.164 check (257), unlike `createPatient`. `getPatientHistory` returns `sessionNotes.content` whole, i.e. the full clinical note, including sessions another therapist ran on this same patient row.

<!-- FILES-END -->

## Stale
- lib/data/notices.ts:78 `undismissedCount` says "Drives the badge". It has no caller anywhere in the repo. Whatever badge the patient chrome draws, it is not this.
- lib/data/notifications.ts:21-29 header says rows "never marked read by anything" is fixed. `markAllRead` (64) has no caller in the repo, and `markSessionNotificationsRead` only clears URLs containing a session id (room page and session page). Any notification not tied to a session (journal crisis alert `/people/<id>`, grant notices) is still permanent on the dashboard, which is the exact failure the header describes.

## Suspect
- lib/data/grants.ts:493-497 `revokeGrant` awaits `notifyGrantRevoked` with no catch. The comment says a partner we failed to reach must never mean a live grant, and that holds (revocation committed first), but if the webhook queue insert throws, the patient's revoke action errors after it succeeded, so the patient sees a failure for a revocation that took effect. Check `lib/partner/webhooks.ts` for an internal catch.


## Broken
- Revocation does not reach the standing profile. app/(app)/patients/[id]/documents/page.tsx:95-99 and :208-283 render `profileFor` and `timelineFor` (lib/data/memory.ts:28, :38) and `listHomework`/`homeworkTrend` (lib/data/homework.ts:225, :186) with no check of `access.capabilities`, while files and journals on the same page are gated on `patientFiles` (:86-87, :139). The profile is person-level and is built by lib/ai/profile.ts:105-184 `gather` from EVERY patient row for the person (all clinicians' sessions, notes, transcript segments, all documents). `capabilitiesFor("revoked")` says `liveProfile: false` (lib/access/state.ts:13, 167-176). So a clinician the patient revoked, or one who never held a grant but shares the person, still reads a machine summary of other clinicians' sessions and notes, the observation timeline, and every other clinician's homework with the patient's own notes. Breaks P4 ("the patient decides who may read the history") and T5's revocation.
- lib/data/grants.ts:536-573 `applyClaimDecision`, called after the claim commits (lib/data/claims.ts:392 and :606), inserts `status: "granted"` for every clinician holding a record. Trigger 0060 (drizzle/0060_portability.sql:28) raises for any holder whose verification is not approved, and unlike `decideGrant` (394-403) there is no catch here. So a patient who answers "yes, my therapist keeps access" when any holder is unverified (the demo cast includes a clinician still applying) gets an exception after their claim has already committed: the claim screen errors, holders after the failing one in the loop get no grant, the `grant.kept_at_claim` audit is never written, and `notifyRecordClaimed` (claims.ts:410, :613) never runs. The claim itself stands.

- lib/data/journals.ts:167-172 `alertGrantHolders` filters `gte(historyGrants.expiresAt, now)`. An `open` grant has `expiresAt` NULL (grants.ts:376-379 writes null for any shape but 24h; `applyClaimDecision` grants.ts:557-565 never sets it), and `NULL >= now` is not true, so every clinician on an open-ended grant, which is the default shape and the only shape a claim creates, is never told a journal matched crisis language. Only 24h grant holders are alerted. `lib/access/state.ts:66` treats null as live; this query does the opposite. Crisis alerting silently reaches nobody in the common case.
- lib/data/journals.ts:191 the crisis notification's `actionUrl` is `/people/${personId}`. No `app/**/people/[...]` page exists for a clinician (only `app/(clinic)/clinic/people/page.tsx` and `app/(sponsor)/sponsor/people/page.tsx`), and nothing rewrites `/people/`. A clinician who does get the alert taps into a 404. The route would also need a patient id, not a person id.

## Looks broken, is handled
- lib/data/partner-admin.ts:101, :286, :333 change a partner's state and production approval with no `audit()` call. The admin actions audit every one: app/(admin)/admin/partners/actions.ts:46, :78, :105, :130.

## Unclaimed

## Promise evidence
- T5: `revokeGrant` (grants.ts:447) is effective immediately because `accessFor` reads the row each time and app/(app)/copilot/actions.ts:55 calls it per question. BUT `capabilitiesFor("revoked")` in lib/access/state.ts:167-176 returns `copilot: true` (over the therapist's own material). So a revoked grant does not stop the copilot on the next question; it narrows what it may read. The promise text ("a revoked grant stops it on the next question") and the code disagree by design. Verdict: partly (immediacy kept; "stops" broken unless the promise means "stops reading the person's record"). Whether the copilot context really drops live profile/files on revoke is in lib/ai/case-copilot.ts, outside this slice.

## Coverage
