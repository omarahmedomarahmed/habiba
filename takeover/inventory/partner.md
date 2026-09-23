# Partner inventory (an outside platform integrating by API)

Derived from code on 2026-09-23. Evidence is the code path, not comments. "Admin" means `partner_users.role = 'admin'`; any other role is read only. `docs/VALUE-STATEMENTS.md` has **no partner audience**, so the Value column cites the public promises on `/developers` (`devs.*` keys in `lib/i18n/messages.ts`) and otherwise says "none stated".

## 1. Summary

The partner has **6 portal pages** (`/partner` keys, `/partner/webhooks`, `/partner/deliveries`, `/partner/usage`, plus the open `/partner/sign-in` and `/partner/apply`), **1 public docs page** (`/developers`), **15 API method+route pairs under `/api/partner/v1`**, one browser redirect endpoint (`GET /api/partner/launch`), and one API route that refuses partner keys (`/api/hr/v1/employment`). Like the clinic, a partner cannot self-activate: `/partner/apply` creates a held row and an operator creates users and approves production in `/admin/partners`. Once active, a partner admin can mint and revoke sandbox keys (live keys after approval), register and disable HTTPS webhook endpoints, read a delivery log, and set a monthly session limit. By API the partner can post consent (with a mid-session offset), upload audio, read a transcript, get and approve a SOAP draft, get and deliver a patient summary, toggle and ask a copilot, and read "memory". The record-layer half of the API (readers, session write-back, note delivery, launch) and every webhook event depend on a subject being linked to a person and on a `partner_billed` organisation, and **no product code creates either**, so that half is unreachable outside seed scripts. The copilot and memory endpoints filter on `partner_sessions.ended_at`, which **nothing ever writes**, so they always return nothing.

## 2. The table

### Shell (every signed-in partner page)
`app/(partner)/layout.tsx`, `components/partner/chrome.tsx`, `lib/partner-auth/session.ts`

| Section | What they see (data shown, from which loader) | What they can do (every button/form/link, and the server action or route it calls, file:function) | Value it delivers | Gaps |
| --- | --- | --- | --- | --- |
| Header | Partner name (`getPartnerActor`), language corner on every page except sign-in | "Sign out" to `app/(partner)/partner/sign-in/actions.ts:signOutPartner` | none stated | No account, team or profile page; a partner cannot add a colleague or change a password |
| Tabs | Keys, Webhooks, Deliveries, Usage, Docs | Links to `/partner`, `/partner/webhooks`, `/partner/deliveries`, `/partner/usage`, `/developers` | none stated | "Docs" leaves the portal for the public site with no way back but the browser |
| Footer | `dev.noContent`: a delivery carries an event, an id and a timestamp | none | `devs.limitsBody` "No payload on a webhook" (kept) | none |
| Session rules | 30 min idle, 8 h absolute; partner `state` must be `active` | none | none stated | No password reset exists for partner users |

### /partner/sign-in
`app/(partner)/partner/sign-in/page.tsx`, `components/partner/sign-in-form.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Form | "Your developer account": Email address, Password | "Sign in" to `signInPartner` (8 per 15 min per caller) then `lib/data/partner-admin.ts:checkPartnerPassword`, `createPartnerSession`, redirect `/partner` | none stated | Page is linked from nowhere (not the site header, not `/developers`). A held or closed partner is told "email and password do not match". No forgot password. Errors and "Working…" English only |
| Apply link | "Build on 24Therapy" | Link to `/partner/apply` | none stated | none |

### /partner/apply
`app/(partner)/partner/apply/page.tsx`, `components/partner/apply-form.tsx`, `app/(partner)/partner/apply/actions.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Form | Company name, Who should we speak to, Email address, Phone number, What do you want to build | "Ask us to call" to `apply` (5 per hour) then `applyToPartner` (held `partners` row, no user) | none stated | No site header or back link; no confirmation email |
| Success | "Thank you. We will call you." and "Your account is open and has no keys yet." | none | none stated | False: the account is held and cannot sign in; no user exists yet |
| Info box | `devs.useCase3Body`, `dev.noContent`, `devs.keysNote` | none | `devs.keysNote` | keysNote says "no self-serve key"; see keys page |

### /partner ("Your keys")
`app/(partner)/partner/page.tsx`, `components/partner/key-list.tsx`, `app/(partner)/partner/actions.ts`, `lib/partner/keys.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| New key reveal | Prefix and the raw key once; "Copy this now..." | none (no copy button) | `devs.keysNote` "Keys are hashed" (kept) | Card does not name the key's label or environment |
| Key list | Label, prefix, Sandbox/Live, Revoked, Suspended, scopes, sponsor name, "Last used {date}" / "Never used", suspension reason (`keysFor`). Empty: "You have no keys yet." | Admin: "Revoke" to `actions.ts:revoke` then `revokeKey` | `devs.promise1` scopes named on the key (kept) | No confirmation, no audit row for revoke. No unsuspend: a suspended key stays suspended ("Ask us to re-enable it"). `devs.keysNote` says "rotatable": no rotate exists |
| Create a key (admin) | "Create a key" then: What is it for, Environment (Sandbox / Live), "What may it do": 10 scope checkboxes (`record:read`, `session:write`, `note:deliver`, `consent:write`, `session:media`, `transcript:read`, `note:review`, `copilot:chat`, `memory:read`, `summary:deliver`) | "Create the key" to `createKey` then `mintKey` (live refused until `partners.approvedAt`) | `devs.keysNote` contradicted ("issued after a call. There is no self-serve key") | Scopes shown as raw codes with no description. `sponsorChoices()` is queried for admins and never rendered; the action still accepts an unvalidated `sponsorId` form field. No audit row for mint. Orphan strings `dev.employmentScoped`, `dev.forOrganisation` |

### /partner/webhooks ("Your endpoints")
`app/(partner)/partner/webhooks/page.tsx`, `components/partner/webhook-list.tsx`, `app/(partner)/partner/webhooks/actions.ts`, `lib/partner/webhooks.ts`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Secret reveal | `whsec_...` once, and how to sign (`t=timestamp,v1=hmac`) | none | none stated | Does not name which endpoint it belongs to |
| Endpoint list | URL, subscribed events, "Revoked" when disabled (`webhooksFor`). Empty: "You have no endpoints yet." | Admin: "Disable" to `disable` then `disableWebhook` | none stated | No confirmation, no re-enable, no secret rotation, no "send a test", no audit. Disabled shows the word "Revoked" |
| Add an endpoint (admin) | HTTPS endpoint, "Which events": `session.completed`, `note.approved`, `grant.revoked`, `record.claimed`, `subject.unlinked` | "Add it" to `addWebhook` then `registerWebhook` (https only; refused if signing secrets are not configured) | `devs.useCase5Body` "A webhook tells you there is one" contradicted | `session.completed` and `note.approved` are emitted by no code. The other three only fire for a subject linked to a person, which nothing creates, so no event can fire in production |

### /partner/deliveries ("Recent deliveries")
`app/(partner)/partner/deliveries/page.tsx`, loader `lib/partner/webhooks.ts:deliveriesFor`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Delivery list | Last 100: event, Delivered / Pending, last HTTP status, "{count} attempts", subject id, URL, created time, last error. Empty: "Nothing delivered yet." | none | none stated | After 6 failed attempts the row still says "Pending" forever. No redeliver, no filter. The queue is drained by `deliverPending` inside the daily `billing` cron (03:05 UTC), so a delivery can be a day late and retries are a day apart |

### /partner/usage
`app/(partner)/partner/usage/page.tsx`, `components/partner/usage-meter.tsx`, loaders `lib/partner/usage.ts:usageFor`, `lib/partner/billing.ts:billFor`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Stop banner | "We have stopped at the limit you set." with what stops and that it is not billed (when `stoppedAt` in this period) | none | `devs.limitBody` (kept) | Entire page is hard coded English, ignores locale |
| This month | Used sessions, "of {limit} this month" or "no limit set", bar (amber at 80%, red at 90%), projection sentence | none | `devs.limitBody` | "Used" counts live sessions marked billable at consent time, before any audio is sent |
| Last month's bill | Month, "{n} sessions at $x each", total (only if sessions > 0) | none | `devs.limitBody` | No invoice list, no history beyond one month, no payment method, no pay action; dollars formatted with `toFixed` |
| Limit form (admin) | "Sessions a month" number input, 80/90% alert rule | "Save the limit" to `actions.ts:saveLimit` then `setLimit` (audit) | `devs.limitBody` "We alert your contact at 80% and again at 90%" | Alerts (`alertApproachingLimits`) run once a day and their stamps are only cleared when the limit is saved, so after the first month they never fire again. Alert link is the relative path `/partner/usage` |

### /developers (public docs)
`app/(public)/developers/page.tsx`

| Section | What they see | What they can do | Value | Gaps |
| --- | --- | --- | --- | --- |
| Title and body | "Build on the clinical record layer", "Five things you can do" | none | none stated | Three use cases follow, not five |
| Read a record under a grant | Example `GET .../readers` returning `{ "readers": [ { "clinicianId", "grantedAt" } ] }`, then launch | none | `devs.promise3` | Code returns `{ "clinicians": [ { "email", "verified" } ] }`. Unreachable in production (see API table) |
| Session writeback | Example body `subjectRef, clinicianEmail, startedAt, durationMinutes, externalMeetingId` | none | `devs.useCase4Body` | Code requires `subject, clinician, started_at, duration_minutes, meeting_id`; the example returns 400 |
| Note delivery | `note.approved` webhook then `GET .../notes/<sessionId>` | none | `devs.useCase5Body` | `note.approved` is never emitted |
| A session, end to end | Six numbered steps: consent, media, transcript, note GET, note POST, summary POST | none | `devs.flow.*` | Step 2 promises "by stream": no stream route. Step 3 promises "Diarised": transcript is plain concatenated text. "each one refuses until the one before": note approval does not require a draft |
| Consent during a session | Offset example with coverage sentence | none | `devs.midConsentBody` (kept for the note text) | Audio before the offset is not trimmed server side |
| Copilot box | PUT enable, POST ask, GET memory examples | none | `devs.copilotBody` | Always answers "no completed sessions" (see API table). "turns it on for themselves": the partner server flips it |
| Limit box | 409 example | none | `devs.limitBody` | none |
| Embedded widget | Launch opens our panel in a window | none | `devs.widgetBody` | It is the launch flow; no widget code exists, and launch is unreachable |
| No endpoint for / four promises | `devs.limitsBody`, `devs.promise1..4` | none | `devs.promise1..4` | promise4 "Every call is recorded with the key" is false (see below); limitsBody "No record read by a key" sits beside `/memory` returning approved notes |
| Keys and rate note | `devs.keysNote`, `devs.rateNote` ("Live keys are limited") | "Ask us for an account" to `/partner/apply` | none stated | The per-key limit applies to sandbox keys too. No link to `/partner/sign-in`. No auth header, error code, scope-to-route or signature verification reference |

### API routes

Rules common to every `/api/partner/v1/*` call (`lib/partner/route.ts:withKey`, `lib/partner/keys.ts:authenticateKey`):
1. Per caller IP: 240 calls per minute, else `429 {"error":"Too many requests."}`.
2. `Authorization: Bearer <key>`: missing is `401 No API key.`; unknown, revoked, suspended, or owner not `active` is `401 That key is not valid.`
3. Per key: 60 calls per minute; the 61st **permanently suspends the key** and returns `429`. Sandbox keys included. Only an operator can lift it.
4. Wrong scope: `403 This key does not hold <scope>.` (checked after the rate limit).
5. Monthly limit (`lib/partner/usage.ts:mayRun`) applies to live keys only; sandbox is never billed or capped.
6. All error strings are English.

| Route (method) | Auth | Takes | Returns | Rate / limit rules | Value | Gaps |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /api/partner/v1/consent` | `consent:write` | `session`, `subject`, `state` given/withdrawn, `answered_at`, `offset_seconds` | 200 `recording_from_seconds`, `coverage`, `stopped_reason`; 400 on bad input | Common; `mayRun` decides `stopped_reason`; live session marked billable here | `devs.flow.s1`, `devs.midConsentBody` | Billed at consent even if no audio ever arrives. Withdrawal does not delete stored transcript. Offset clamped 0 to 86400. Creates the `partner_subjects` row with `personId` null |
| `GET /api/partner/v1/consent?session=` | `consent:write` | `session` | `events[]` (state, answered_at, offset_seconds), max 100 | Common | none stated | Read behind a write scope |
| `POST /api/partner/v1/sessions/{ref}/media` | `session:media` | `audio/*` body, 25 MB max | `accepted_bytes`, `recording_from_seconds`, `transcript_ready`; 404 unknown session, 409 stopped, 403 no consent, 413 too big, 415 not audio | Common; no `mayRun` here | `devs.flow.s2` | No stream route. Transcribed synchronously in the request. `fromSeconds` is passed to `ingestPartnerAudio` and ignored. Re-posting appends the text again |
| `GET /api/partner/v1/sessions/{ref}/transcript` | `transcript:read` | none | `transcript` (plain text or null), `recording_from_seconds`, `coverage`, `source` | Common | `devs.flow.s3` | Not diarised, no timestamps, no speakers. No audit row |
| `GET /api/partner/v1/sessions/{ref}/note` | `note:review` | none | `draft` (coverage sentence prepended), `approved`, `approved_by`, `approved_at`, `coverage` | Common; model call not checked against the limit | `devs.flow.s4` | Draft written once on first GET and never refreshed after more audio. English coverage sentence is pasted into the clinical draft |
| `POST /api/partner/v1/sessions/{ref}/note` | `note:review` | `text` (10 to 50000 chars), `approved_by` | 200 `approved: true`; 409 if already approved | Common | `devs.flow.s5` | One approval only: no amendment. No `note.approved` webhook emitted |
| `GET /api/partner/v1/sessions/{ref}/summary` | `summary:deliver` | none | `draft` patient summary; 409 until the note is approved | Common; model call not checked against the limit | `devs.flow.s6` | Regenerated by the model on every call, never stored |
| `POST /api/partner/v1/sessions/{ref}/summary` | `summary:deliver` | `text` (10 to 20000 chars) | `delivered: true`; 409 before approval | Common | `devs.flow.s6` | Stored in `partner_sessions.summary_text` and read by nothing: no patient ever sees it |
| `PUT /api/partner/v1/copilot` | `copilot:chat` | `clinician` (your ref), `enabled` | echo of both | Common | `devs.copilotBody` | The clinician's "own opt-in" is set by the partner server with no clinician confirmation |
| `POST /api/partner/v1/copilot` | `copilot:chat` | `subject`, `clinician`, `question` (up to 2000 chars) | `answer`, `citations[]`; 403 clinician not enabled; 409 over limit | Common plus `mayRun` | `devs.copilotBody` | `sessionMaterial` requires `ended_at`, which is never written, so every answer is "There are no completed sessions". Ignores consent state and subject revocation. No audit |
| `GET /api/partner/v1/subjects/{ref}/memory` | `memory:read` | none | `sessions[]` (session, ended_at, approved note), `scope` sentence | Common | `devs.copilotBody` | Same `ended_at` filter: always empty |
| `GET /api/partner/v1/subjects/{ref}/readers` | `record:read` | none | `clinicians[]` (email, verified); 404 unknown subject; audited | Common | `devs.promise3`, `devs.useCase3Body` | Needs `partner_subjects.person_id` (never set) and a `partner_billed` org (never created): always 404 or empty. Shape differs from docs |
| `POST /api/partner/v1/sessions` | `session:write` | `subject`, `clinician`, `started_at`, `duration_minutes`, `meeting_id` | 201 `sessionId`; 404 no subject; 403 not their patient or unverified; 409 ambiguous; 400 bad time | Common | `devs.useCase4Body` | Unreachable for the same two reasons. Docs field names are wrong |
| `GET /api/partner/v1/notes/{sessionId}` | `note:deliver` | our session id | `content`, `approvedAt`, `language`; 404 otherwise; audited | Common | `devs.useCase5Body` | Needs a linked subject: unreachable. The partner has no way to learn our session id except from write-back, also unreachable |
| `POST /api/partner/v1/launch` | `record:read` | `clinician` email, `target` (dashboard, patients, sessions, notes) | `url` (single use, 120 s) | Common | `devs.widgetBody` | Needs a verified clinician in a `partner_billed` org: unreachable. Sandbox keys can launch. Launch reuses the `record:read` scope |
| `GET /api/partner/launch?token=` | Launch token, no key | `token` | 303 to the target with a 1 h clinician session; failure to `/login?launch=expired` or `throttled` | 20 per minute per caller | `devs.widgetBody` | `/login` never reads `launch=`, so the failure is unexplained |
| `POST /api/hr/v1/employment` | `employment:verify` | `identifier` | `active`, `as_of` | 240 per minute per IP plus per key | none stated | Refuses every partner key with 401: sponsor keys only. Listed so nobody assumes partners can use it |

## 3. Can do with no screen

- Every API route above: nothing in the portal shows a partner's sessions, consents, transcripts, notes, summaries, copilot usage or subjects. The only window on API activity is "Last used" per key and the usage count.
- `consent:write` doubles as a read (`GET /consent`).
- Toggle any clinician ref's copilot opt-in (`PUT /copilot`).
- Post an unvalidated `sponsorId` with `createKey` (the form no longer offers it; the action still stores it).
- Launch-token sweep and monthly ledger posting (`sweepExpiredLaunches`, `billAllPartners`) run for the partner with no screen: the monthly bill is a ledger journal only, no invoice row, no document.
- `lastSuccessAt` on keys is stamped only by the HR route and shown nowhere.

## 4. Promised but not built (or contradicted)

- `devs.useCase5Body` and the note-delivery example: `note.approved` and `session.completed` are never queued.
- `devs.promise3`, `devs.useCase3Body`, launch, write-back, note delivery, `grant.revoked`, `record.claimed`, `subject.unlinked`: all require `partner_subjects.person_id` and a `partner_billed` organisation; `upsertSubject` is only ever called with `personId: null` and only `scripts/seed-capture.ts` writes `partner_billed`.
- `devs.copilotBody` "asks about a patient from the sessions you ran": `partner_sessions.ended_at` is never written, so copilot and memory have no material. There is also no "end session" endpoint.
- `devs.flow.s2` "by upload or by stream": upload only.
- `devs.flow.s3` "Diarised": plain text.
- `devs.flow.s6` "Deliver the summary to your patient": the delivered summary is stored and never shown to anyone.
- `devs.promise4` "Every call is recorded with the key that made it": only readers, write-back, note delivery and launch write audit rows; consent, media, transcript, note, summary, copilot, memory, key mint/revoke and webhook changes do not.
- `devs.keysNote` "rotatable" and "no self-serve key": no rotate; an approved admin self-mints live keys.
- `devs.rateNote` "Live keys are limited": sandbox keys are suspended the same way.
- `devs.limitBody` "We do not bill for a session we did not do": billable is set at consent, before audio or any model work.
- `devs.limitBody` "alert at 80% and again at 90%": stamps are not reset each month.
- `dev.apply.sentBody` "Your account is open": it is held.
- `/developers` "Five things": three are shown.
- Docs examples for `readers` and `POST /sessions` do not match the code.
- `devs.widgetBody` "embedded widget": no widget; the launch window is the whole of it, and it is unreachable.

## 5. Should exist in the redesign

1. **A way to link a subject to a person and to put a practice on `partner_billed`** (operator screen or patient-consented claim), or remove the record-layer half from the docs. Reason: readers, write-back, note delivery, launch and all webhooks are dead without it.
2. **An "end session" call that sets `ended_at`**, or drop the filter. Reason: copilot and memory always return nothing.
3. **Emit `note.approved` and `session.completed`, or remove them from `WEBHOOK_EVENTS`.** Reason: the schema comment itself says a scope or event must arrive with its code.
4. **Deliver webhooks from a frequent job with backoff, show "Failed" after the last attempt, and add Redeliver and Send test.** Reason: daily drain in the billing cron, permanent "Pending".
5. **A sessions screen**: per session ref, consent history, coverage, transcript present, draft/approved/summary state, billable flag. Reason: the whole integration runs with no screen; "Last used" is the only signal.
6. **Key lifecycle**: scope descriptions, rotate, unsuspend request, confirmation on revoke, audit rows on mint/revoke. Reason: `devs.keysNote` promises rotation; suspension is permanent; `devs.promise4`.
7. **Team and account page**: add colleagues, roles, password reset. Reason: only operators can create partner users; no reset exists.
8. **Billing page with invoices and history**, and bill on work done (first audio) rather than on consent. Reason: `billFor` shows one month; `devs.limitBody`.
9. **Monthly reset of the 80/90% alert stamps and an absolute link.** Reason: `alertApproachingLimits`.
10. **Generated API reference from the route files** (fields, scopes, errors, rate rules, signature check), with a link to `/partner/sign-in`. Reason: two examples on `/developers` are wrong and sign-in is unlinked.
11. **Server-side consent enforcement on audio** (trim before the offset) and purge on withdrawal. Reason: `ingestPartnerAudio` ignores `fromSeconds`.
12. **Copilot opt-in confirmed by the clinician, not the partner server.** Reason: `devs.copilotBody` "turns it on for themselves".
13. **Localise `/partner/usage` and every API error and coverage sentence.** Reason: the usage page and `coverageSentence` are English only.
