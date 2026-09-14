# Audit 06: The Partner

Scope: the only machine principal, the only traffic that originates outside our
infrastructure. `app/(partner)/**`, `app/api/partner/**`, `app/api/cron/[job]/route.ts`,
`lib/partner-auth/**`, `lib/partner/**`, `lib/data/partner-admin.ts`, and the eight
`partner_*` tables in `lib/db/schema.ts`. Cross-checked against `PLAN.md` sections 42,
55, and 61, and against `scripts/verify-sprint55.ts` and `scripts/_reachability.ts`.

The partner plane is unusually well commented: nearly every function carries a note
explaining the exact attack it was built to resist. That is a good sign and also a
trap for an auditor, because a comment describing intent is not evidence the intent
holds everywhere it needs to. Several of the findings below are cases where the
documented defence exists in one function of a pair and is missing from its sibling.

## Findings

### F1. The session writeback endpoint does not check the clinician belongs to the calling partner

| Field | Detail |
|---|---|
| What | `writeBackSession` looks up a clinician by email with no check that the clinician's organisation is billed through the calling partner, unlike its sibling functions which all enforce this. |
| Where | `lib/partner/api.ts:237-248` (the clinician `select`, no `organizations` join, no `eq(organizations.partnerId, ...)`, no `eq(organizations.billingMode, "partner_billed")`). Compare `lib/partner/launch.ts:124-136`, which performs exactly this join and check, and whose own comment at `lib/partner/launch.ts:105-123` explains why it is there: an earlier version of `launchClinician` had this same gap and "any key with `record:read` could therefore name ANY verified clinician in the product." `whoMayRead` (`lib/partner/api.ts:188-189`) enforces the identical pair of conditions. `writeBackSession` (`lib/partner/api.ts:224`) is the one function in the file missing it. |
| Who is harmed | Any clinician anywhere in the product, and their patient. If a partner's key can resolve a subject to a `personId` (see F3), `writeBackSession` only additionally requires that the named clinician exist, be verified, and already have a `patients` row for that person in their own organisation (`lib/partner/api.ts:266-275`). Nothing requires that clinician's organisation to have any relationship to the calling partner. Partner B could name a clinician who has never heard of Partner B and write a fabricated "completed session" into that clinician's chart for a shared patient, source-attributed as `partner_platform` (`lib/partner/writeback.ts:139-146`, `provisionedByUserId` set to that clinician). |
| Severity | blocker |
| Already known? | No C-number covers this exact gap. It is the same defect class `launch.ts`'s own comment names as already found and fixed once in this file's neighbour (`lib/partner/launch.ts:105-123`), and C277 ("a partner's clinician holds a grant exactly like any other clinician... never a special case") is the standing rule this violates. This is the sibling fix that did not get made. |

### F2. Note delivery does not check the note's clinician holds any grant connected to the calling partner

| Field | Detail |
|---|---|
| What | `deliverableNote` authorises a note purely on (a) the note being approved anywhere in the product and (b) the patient's person being linked, at any point, ever, to this partner's `partner_subjects`. It never checks who wrote the note, whether that clinician's organisation has any relationship to this partner, or whether a live grant exists. |
| Where | `lib/partner/api.ts:322-394`. The `WHERE` clause (`lib/partner/api.ts:350-365`) is three conditions on `sessionNotes` plus `eq(partnerSubjects.partnerId, input.key.partnerId)` (`lib/partner/api.ts:364`). There is no `historyGrants` join and no `organizations.partnerId` / `billingMode` check anywhere in the function, unlike `whoMayRead` (`lib/partner/api.ts:172-191`), which requires `eq(historyGrants.status, "granted")`, `isNull(historyGrants.revokedAt)`, `eq(organizations.partnerId, ...)` and `eq(organizations.billingMode, "partner_billed")` together. |
| Who is harmed | A patient. `partner_subjects` has no `revokedAt` or `deletedAt` column (`lib/db/schema.ts:6627-6645`) and no function in this codebase unlinks one once `personId` is set. So a link made for one referral, one session, one year ago, is permanent, and this function grants the partner every approved note that patient's chart ever accumulates from any clinician afterward, including a clinician the patient booked privately off the public radar with no connection to the partner at all. That is the opposite of "a partner's clinician holds a grant exactly like any other clinician" (C277): here the partner needs no grant of its own clinician at all, only a person-level link that was never scoped to an engagement and cannot be revoked. |
| Severity | blocker |
| Already known? | No matching C-number. C277 is the ruling this contradicts. `deliverableNote`'s own comment (`lib/partner/api.ts:358-363`) claims the join "is the scope, in the query" and stops there, arguing only against a session-id-guessing attack, not against the case where the partner legitimately holds a stale, unrevocable link to a person who has since moved on to unrelated care. |

### F3. The only function that can create or link a `partner_subjects` row is never called, so the entire record-facing half of the partner API is unreachable

| Field | Detail |
|---|---|
| What | `upsertSubject` is the sole writer to `partner_subjects` (the table `resolveSubject` reads). It has exactly one caller in the whole repository: its own definition. No route, no server action, and no other library function calls it. |
| Where | `lib/partner/api.ts:431-459` defines it. `grep -r "upsertSubject("` across the repository returns only that definition line. `app/(patient)/**` has zero references to anything partner-related at all (checked by name, case-insensitive). The three routes that depend on a resolved subject all call `resolveSubject` (`lib/partner/api.ts:403-419`), which only reads: `GET /api/partner/v1/subjects/[ref]/readers` (`app/api/partner/v1/subjects/[ref]/readers/route.ts:38`, via `whoMayRead`), `POST /api/partner/v1/sessions` (`app/api/partner/v1/sessions/route.ts:55-62`, via `writeBackSession`), and note delivery's own scope join (`lib/partner/api.ts:349`, via a direct join rather than `resolveSubject`, but still dependent on a `partner_subjects` row existing). Since no row can ever be created, every one of these will return "No such subject" or an equivalent refusal forever, on every partner, in production, today. |
| Who is harmed | Nobody is harmed by a missing feature, but this is a "does the screen tell the truth" defect at scale: sprint 55's own acceptance line (`PLAN.md:3417-3419`) reads "a developer... calls each of the seven use cases against the sandbox," and three of five documented use cases (55.6, 55.7, 55.8) cannot actually be completed by any partner today, sandbox or live, because there is no way for a patient's `personId` to ever reach a `partner_subjects` row. A partner who builds against `/developers` (`app/(public)/developers/page.tsx`) and follows the documented flow will find `POST /v1/sessions` and `GET /v1/subjects/.../readers` permanently return 404 regardless of what they send. |
| Severity | blocker |
| Already known? | Not tracked anywhere I could find. It is also invisible to the two verifiers built to police exactly this area, which is worth naming per the house rule about checks that measure the wrong thing: `scripts/verify-sprint55.ts` never calls `upsertSubject` or inserts a row into `partner_subjects` (confirmed: zero occurrences of `partner_subjects` or `INSERT INTO partner_subjects` anywhere in that file); every check in it reads function source as text and asserts regexes against it (e.g. `lib/partner/api.ts`'s query shape checked via `/approvedAt/.test(deliverable)` at `scripts/verify-sprint55.ts:656-668`), which proves the code contains the right words and proves nothing about whether any caller ever reaches it. `scripts/_reachability.ts` (C335, C356) would not catch it either: `upsertSubject` is a plain exported library function, not a server action and not an API route, and C335's own ruling scopes `verify:reachable` to exactly those two categories plus pages. This is a fourth shape of the same family C335 was written to close, sitting just outside where C335 looked. |

### F4. Webhook delivery is never queued, so a registered partner webhook never fires

| Field | Detail |
|---|---|
| What | `queueWebhook` is the only function that inserts into `partner_webhook_deliveries`. It has exactly one caller in the repository: its own definition. Nothing in the product calls it when a session completes, a note is approved, a grant is revoked, or a record is claimed, the four events `WEBHOOK_EVENTS` names (`lib/db/schema.ts:6555-6560`). |
| Where | `lib/partner/webhooks.ts:98-122` defines `queueWebhook`. `grep -rn "queueWebhook"` across the repository returns only that definition, `scripts/verify-sprint55.ts` (which checks the function's *signature*, not that anything calls it, at `scripts/verify-sprint55.ts:535-545`), and a doc comment in `app/(partner)/partner/webhooks/actions.ts:18`. The cron job that drains the queue (`deliverPending`, called from `app/api/cron/[job]/route.ts:246-247`) runs on schedule against a table nothing ever populates. |
| Who is harmed | A partner. The webhooks UI is fully built and functional: registering an endpoint (`app/(partner)/partner/webhooks/actions.ts:21-38`), listing it (`app/(partner)/partner/webhooks/page.tsx`), and reading a delivery log (`app/(partner)/partner/deliveries/page.tsx`) all work correctly against the schema. A partner who registers for `note.approved` so they know when to call `GET /v1/notes/[sessionId]` (exactly the flow `/developers` documents, `app/(public)/developers/page.tsx:120-125`) will never be told, because nothing ever queues that event. This is a promise the product makes to an external company that the code does not keep. |
| Severity | major |
| Already known? | No matching C-number. Sprint 55's acceptance line ("a verifier proves... no webhook carries a word of content") is true but incomplete: it proves the shape is safe and never asks whether a webhook fires at all. |

### F5. The public developer docs send the wrong field name for session writeback

| Field | Detail |
|---|---|
| What | The `/developers` page's example body for session writeback uses `subjectRef`. The route reads `subject`. A partner who copies the documented example gets a 400 on their first call. |
| Where | Doc: `app/(public)/developers/page.tsx:105` (`"subjectRef": "YOUR-REF"`). Route: `app/api/partner/v1/sessions/route.ts:36-53` (`const ref = body.subject;`, and the 400 path fires when `typeof ref !== "string"`, which it will be, since `body.subjectRef` is what was sent and `body.subject` is `undefined`). |
| Who is harmed | A prospective partner, at the exact moment sprint 55 says matters most: `/developers` is deliberately public and unauthenticated (`app/(public)/developers/page.tsx:41-44`, "a docs page behind a sign-in is a docs page nobody evaluating us can read") specifically so an evaluator's first experience of the API is this page. |
| Severity | major |
| Already known? | Not tracked. C149 ("a docs page that documents a route somebody intends to write" is the named failure) is the closest ruling, and 55.12's own text says `verify:sprint55` "asserts that every path printed here resolves to a route file on disk" (`app/(public)/developers/page.tsx:29-32`); it checks the path exists, not that the example body matches what the handler reads. Same failure family as C149, one field deeper than the check looks. |

### F6. The public developer docs describe the wrong response shape for "who may read"

| Field | Detail |
|---|---|
| What | The `/developers` example for the readers endpoint shows `{ "readers": [ { "clinicianId": "...", "grantedAt": "..." } ] }`. The route returns `{ clinicians: [ { email, verified } ] }`. Both the top-level key and every field inside each item differ from what a partner following the docs would code against. |
| Where | Doc: `app/(public)/developers/page.tsx:85-87`. Actual shape: `lib/partner/api.ts:205-210` (`return { clinicians: rows.map((row) => ({ email: row.email, verified: row.verified })) }`), returned unchanged by `app/api/partner/v1/subjects/[ref]/readers/route.ts:38-41`. |
| Who is harmed | Same as F5: a prospective partner building against the public docs. This mismatch is worse than F5 because the request succeeds (200) and silently returns a shape the partner's parser was not written for, rather than failing loudly. |
| Severity | major |
| Already known? | Not tracked. Same family as F5. |

### F7. The per-IP throttle protecting every partner pre-auth endpoint trusts a caller-supplied header

| Field | Detail |
|---|---|
| What | `clientIp()` takes the first comma-separated entry of the `x-forwarded-for` request header with no check of how many hops are trusted. If the platform in front of this app appends the real client address to an existing header rather than replacing it (the common behaviour for a reverse proxy, and the one AWS ALB and nginx both default to), a caller can prepend an arbitrary address of their choosing and `clientIp()` returns that address instead of theirs. |
| Where | `lib/request.ts:15-24` (`const forwarded = hdrs.get("x-forwarded-for"); if (forwarded) return forwarded.split(",")[0]!.trim();`), consumed by `callerKey()` at `lib/rate-limit.ts:206-209`, which every partner pre-auth limiter uses: the 240/minute IP gate in front of `authenticateKey` (`lib/partner/route.ts:42-47`, whose own comment says its job is "an attacker with no key cannot make us do database work at machine speed"), the partner sign-in throttle (`app/(partner)/partner/sign-in/actions.ts:23`, 8 per 15 minutes), the partner apply throttle (`app/(partner)/partner/apply/actions.ts:19`, 5 per hour), and the launch-redemption throttle (`app/api/partner/launch/route.ts:50`, 20 per minute). |
| Who is harmed | Us. If this holds, every one of those "protect us from an unauthenticated attacker" limiters can be defeated by rotating a header value on each request, which is free. The most consequential is the 240/minute gate in front of `authenticateKey`'s database lookup, since that is the one explicitly built to stop a keyless attacker from running the platform at machine speed. |
| Severity | major, marked as hypothesis: I could not run a request against the live deployment to confirm whether Vercel's edge appends to or replaces an inbound `x-forwarded-for` header, so I cannot confirm the header is attacker-reachable in this specific deployment. The code pattern itself, taking the first entry of a header with no configured trusted-hop count, is the defect regardless of what any one platform currently does with it. |
| Already known? | Not tracked in `PLAN.md` or `HAZARDS.md` (searched both for `x-forwarded-for`, `spoof`, and `trust proxy`; no hits). This is not partner-specific, it is used by every `callerKey()` caller in the product, but every partner pre-auth surface inherits it and none has an independent defence. |

## Attacks I tried and could not break

- **Enumerating referred patients through `partner_subjects` directly.** `scripts/_reachability.ts:120-121` names this table as the one deliberate exemption from ever getting a screen, and I could not find a route, export, admin screen, or CSV that lists it. `components/partner/chrome.tsx:19-22` states in the navigation component itself that there is no subjects tab and names the reason. I searched every route under `app/api/partner/**` (all seven) and found none that returns a list rather than a single lookup. Given F3, this control is currently moot rather than tested, since nothing populates the table it protects, but the control itself, as written, is real.
- **C285's finding, whether 55.5 still reads the soft column.** `clinicianVerification` (`lib/partner/api.ts:52-111`) and `launchClinician`/`redeemLaunch` (`lib/partner/launch.ts:98-227`) all call `verifiedFlag()` (`lib/data/verified.ts:46-48`), which is `EXISTS (SELECT 1 FROM therapist_verifications v WHERE v.user_id = users.id AND v.state = 'approved')`, the same predicate the database's own grant trigger uses. `grep -rn "verificationStatus" lib/partner` returns nothing. C285 is fixed on this surface.
- **A revoked or suspended API key working anywhere.** `authenticateKey` (`lib/partner/keys.ts:157-178`) has `isNull(partnerApiKeys.revokedAt)`, `isNull(partnerApiKeys.suspendedAt)`, and `eq(partners.state, "active")` all in the same `WHERE` clause, so there is one code path and no branch that could forget one of the three. `revokeKey` (`lib/partner/keys.ts:285-299`) scopes the update to `partnerId`, so a borrowed key id from another partner's row revokes nothing.
- **Timing leaking whether a key hash exists.** `authenticateKey` does the lookup by hash (so a timing difference there would only ever leak "a row with this hash exists," not "this specific key is correct"), then re-compares with `timingSafeEqual` (`lib/partner/keys.ts:195-199`). I could not find a second comparison anywhere in the auth path that skips this.
- **An itemised, per-session, or per-patient monetary figure leaking through the partner API.** There is no partner-facing billing screen at all (`components/partner/chrome.tsx:31-36` lists four tabs: keys, webhooks, deliveries, docs). None of the five API use cases returns a price: `writeBackSession` hard-codes `priceCents: 0` on the written session (`lib/partner/writeback.ts:122-124`) with a comment explaining why. I read all seven partner routes and found no field in any response that carries a monetary amount.
- **Aggregate-only billing being defeated by a count.** Not applicable in the same shape as the clinic's C263 (there is no partner invoice at all to itemise), so there is nothing here for C263's rule to be defeated in.
- **The employment endpoint used as a directory.** `verifyEmployment` (`lib/partner/employment.ts:87-213`) requires a live, unanswered `enrolment_attestations` row and consumes it atomically on read (`lib/partner/keys.ts` pattern repeated at `lib/partner/employment.ts:132-143`). I could not find a route or export that lists, searches, or pages `enrolments` or `enrolment_attestations` for a partner.
- **A revoked key still logged or leaked in an error, a webhook payload, or a log line.** `mintKey`'s log line only carries `partner` and `environment` (`lib/partner/keys.ts:118`). `MintedKey.raw` is typed as "returned once" (`lib/partner/keys.ts:64-69`) and I found no second read of `keyHash` anywhere that could compare against something other than a fresh hash of caller input. Webhook bodies are a three-field literal (`lib/partner/webhooks.ts:162-166`) with no key material in it.

## Sprint 61 (HR and student system connectors): attacking the plan, not the code

Nothing under this ticket is built (`grep -r "lib/hr"` and `grep -rn "hrConnector"` both return nothing), so every point below is a plan-level finding against `PLAN.md`, marked as such.

| Field | Detail |
|---|---|
| What | Sprint 61's tickets specify the data-shape rules for HR connectors (C321's sequential provisional-then-confirm flow, C350's per-person session cap) in detail, but specify no credential-security model for the connector's own authentication *to* each sponsor's HR system: no storage mechanism, no scoping, no rotation, and no revocation path analogous to `partner_api_keys`. |
| Where | `PLAN.md:4005-4011` (tickets 61.8 to 61.10) and the sprint's own accept line at `PLAN.md:4017-4020`. None of the twelve tickets 61.1 to 61.12 (`PLAN.md:3990-4015`) names where a per-sponsor HR credential lives, whether it is sealed the way `partner_webhooks.secretSealed` is (`lib/db/schema.ts:6572-6573`), or what happens to enrolment when a sponsor's HR system is compromised and a hostile actor holds whatever we call out with. |
| Who is harmed | Every sponsor's employees or students, and 24Therapy's own exposure. C265 exists specifically because a credential able to answer "does this person work here" is an identity oracle when it is a key we hand OUT to a partner. An HR connector's credential is the mirror image, a secret 24Therapy holds to call INTO a third party's system, and it gets no equivalent treatment in the plan. |
| Severity | major (plan-level; blocks sprint 61 acceptance, not a live defect) |
| Already known? | Not tracked under any C-number. C265 is the closest ruling and does not cover this direction of the relationship. |

| Field | Detail |
|---|---|
| What | C350 bounds exposure per fake identity ("N sessions before the code lands... one session of exposure per fake identity instead of unbounded," `PLAN.md:322`) but nothing in sprint 61 bounds how many distinct provisional identities a single compromised HR connector credential can create in a given window. The only backstop that exists is C239's per-sponsor pot overdraft ceiling (`PLAN.md:211`), which trips only after real session cost and therapist payout have already been incurred across however many fake identities it took to reach it. |
| Where | `PLAN.md:4005-4009` (61.8, 61.9). Neither ticket, nor C321 (`PLAN.md:293`) nor C350 (`PLAN.md:322`) themselves, mentions a velocity or volume limit on provisional enrolments, comparable to C265's 60-calls-per-minute-then-suspend rule for partner API keys (`lib/partner/keys.ts:57-58`). |
| Who is harmed | The sponsor whose pot pays for it, and the therapists who ran sessions with people who turn out never to confirm a mailbox. A compromised HR credential could enrol many identities in parallel, each independently within its own "N sessions" allowance, before the sponsor-level overdraft (a financial trip-wire, not a rate limit) ever engages. |
| Severity | major (plan-level) |
| Already known? | Not tracked as its own concern; it is a gap in C350's own bound rather than a restatement of it, since C350 explicitly bounds the per-identity case and is silent on the per-connector case. |

| Field | Detail |
|---|---|
| What | 61.10's "connectors for the common systems first, behind one interface, so the second one is configuration rather than a sprint" (`PLAN.md:4010-4011`) motivates the interface purely as an engineering-effort saving. It does not restate, at the interface boundary, C255's shape rule (one identifier in, one boolean and a timestamp out, never a listing, never a sync, never a store). Several of the named HR platforms (`PLAN.md:227`, C255's own list: Workday, SuccessFactors, BambooHR, Oracle HCM, Personio, Zoho People) are naturally push- or sync-first in their own APIs, and a connector author working from "behind one interface" with no explicit shape constraint written into the interface itself could reach for the vendor's native webhook or SCIM push to make integration easier, which is exactly the roster C255 was three designs removing. |
| Where | `PLAN.md:4010-4011`, read against C255's ruling at `PLAN.md:227`. |
| Who is harmed | Every enrolled person at every sponsor using a future connector, if a second or third connector author treats "behind one interface" as a licence to accept whatever shape the vendor prefers to send, since C255's rule is stated once, three sprints earlier, and not repeated where the connectors themselves are specified. |
| Severity | major (plan-level) |
| Already known? | C255 is the ruling; this is a gap in how firmly 61.10 re-binds a later implementer to it, not a new concern about the same shape of harm C255 already named. |

## What I could not verify

- Whether Vercel's edge actually appends to or replaces an inbound `x-forwarded-for` header for this specific project (F7). I have no way to send a live request against the deployed app from this environment, so this is marked a hypothesis on the code pattern rather than a confirmed live exploit.
- Whether an admin console (outside `app/(partner)/**` and `app/api/partner/**`, which is my assigned scope) has its own path to insert or link a `partner_subjects` row, which would change F3's severity from "the feature is entirely dead" to "the feature can only be reached by an operator, not self-serve." I read `lib/data/partner-admin.ts` in full and found no such function there, but I did not read the entire `app/(admin)/**` tree, which was outside my assigned surfaces.
- Whether `deliverPending`'s retry behaviour (`lib/partner/webhooks.ts:131-216`) would re-send an event whose underlying access had since been revoked, since I could not construct a real delivery to observe given F4: nothing ever queues one. I read the code and can say what it would do if a row existed (send an opaque id with no re-check of current authorisation state at delivery time), but I did not verify this against a live queued row.
- Whether the 240-per-minute pre-auth throttle in `withKey` (`lib/partner/route.ts:42-47`) is a meaningful defence in practice, given the `/24` network bucketing in `lib/rate-limit.ts:190-195`: I could not determine how large a partner's own outbound IP range typically is, so I cannot say whether a legitimate high-volume partner sharing a NAT gateway with other tenants of the same network could be starved by this shared bucket, or whether that has ever happened.
- Live behaviour of `npm run verify:reachable`, `verify:principals`, and `verify:claims` against this codebase. The audit brief lists these as safe to run; I did not run them and instead read the relevant verifier source directly, so my claims about what they do and do not catch (F3, F4) are based on reading `scripts/verify-sprint55.ts` and `scripts/_reachability.ts`, not on an observed pass/fail.
