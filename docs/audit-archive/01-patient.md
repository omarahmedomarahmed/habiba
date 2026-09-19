# Patient audit

Scope: `app/(patient)/**`, `app/join/[token]`, `app/pay/[token]`, `app/records/[token]`,
`app/feedback/[token]`, `app/(public)/t/[id]`, `app/(public)/verify`, `app/(public)/radar`,
`lib/data/patient-view.ts`, `claims.ts`, `people.ts`, `journals.ts`, `homework.ts`,
`assessments.ts`, `diagnoses.ts`, `portability.ts`, `notices.ts`, `recovery.ts`,
`lib/patient-auth/**`, `components/patient/**`.

Each finding names what I searched and what a real defect would have looked like, per the
brief's rule that an absence is not a finding without a control.

---

## 1. Invariant 5: a patient never sees a transcript or a clinical note

`lib/data/patient-view.ts` earns its own claim. `sessionsForPatient` selects exactly one
column off `session_notes` (`content ->> 'patientBrief'`), gated on `patientStatus ===
"approved"`. I read every join and every select in that file and found nothing reaching
`transcript_segments`, `risk_assessments`, `soap`, `impressions` or `summary`. That part of
the claim holds.

It does not hold everywhere a patient reaches their own record. Two other paths do exactly
what the file's own opening comment warns against ("one prop away from rendering it").

### 1a. The patient's own record export carries the full clinical note, the full transcript, and the risk assessment

| Field | Detail |
|---|---|
| What | `/records/[token]`, reached with no login, returns the raw `session_notes.content` (SOAP, observations, **impressions**), the full `transcript_segments` text for every session, and `risk_assessments.level` / `recommendedAction`, rendered directly into an HTML page the patient can save or hand to a third party |
| Where | `lib/data/export.ts:371` (`noteContent: sessionNotes.content`), `:380-381` (`riskLevel`, `riskAction` off `riskAssessments`), `:397-422` (full transcript assembled per session), `:558` (`transcript: transcripts.get(row.id)`), `:589-614` (`noteSection` renders Impressions, Assessment, Objective, Subjective, Plan), `:660-663` (risk level rendered as `risk noted: ${session.riskLevel}`), served by `app/records/[token]/route.ts` and `app/records/[token]/data.json/route.ts` |
| Who is harmed | The patient reading their own extract is not harmed by seeing their own note; the harm is that this directly contradicts §3f's own table (`Patient... Never sees: ... A transcript. A clinical note`, PLAN.md:934) and §6's Hard rule ("A patient never sees a transcript or clinical note, enforced server-side", PLAN.md:4234). Anyone this document is forwarded to (a solicitor, an employer, a new partner reading over a shoulder) now also sees a clinician's raw impressions and a risk assessment level, not a curated `patientBrief` |
| Severity | major. The note and transcript are at least a ruled, deliberate feature (26.9); the risk assessment is not |
| Already known? | PLAN.md §2 has C127 (the export is "a record extract, never a certificate") and C128 (email-only delivery). Neither addresses the transcript/note-vs-invariant-5 contradiction or the risk assessment specifically. Sprint 26.9's own accept list is "every session, every approved note, every summary version, diagnoses, journals, homework, dates and the clinician"; it does **not** list risk assessments. So the risk-level/action leak is new and goes beyond what sprint 26 itself ruled; the note/transcript contradiction with §3f (dated later, 2026-09-12) is a real tension in the spec that nobody has reconciled, also new |

### 1b. `listDiagnoses` returns unconfirmed and rejected AI-extracted diagnoses, with their source sentence; the patient's own profile page filters them out only in the render, not the query

| Field | Detail |
|---|---|
| What | The one function a patient screen calls for diagnoses returns every status (`proposed`, `confirmed`, `rejected`) and the raw `sourceSentence` an AI model extracted from a document, unconfirmed by any clinician. The screen that uses it filters to `status === "confirmed"` in JSX, not in the query |
| Where | `lib/data/diagnoses.ts:42-79` (`listDiagnoses`, no status filter in the `WHERE`), `app/(patient)/patient/profile/page.tsx:49` (fetches the unfiltered list), `:97` and `:104-106` (filters to confirmed only when rendering) |
| Who is harmed | The patient, if any future patient-facing code reuses `listDiagnoses` without repeating the same filter, or if the profile page's filter is ever dropped in a refactor. Today's render is safe because Next's server component does not serialize the unfiltered array to the client, so this is not yet a live leak, but it is the exact shape `patient-view.ts`'s own header comment warns about: "a component that just doesn't render the note is one prop away from rendering it" |
| Severity | major (latent, not live) |
| Already known? | Searched PLAN.md §2 for "proposed diagnos", "unconfirmed", found nothing matching. New |

---

## 2. Invariant 6: nothing unclaimed is ever shared

`lib/data/claims.ts` and `lib/data/people.ts` are careful about this everywhere I checked:
`findMatches` never returns email/phone, `suggestionsFor` filters already-claimed people,
`resolveInvite` returns a *redacted* name specifically because "whoever is holding this link
has not proved they are the person yet."

One field breaks that same threat model on the very next screen.

| Field | Detail |
|---|---|
| What | The invite-claim signup flow shows an unclaimed record's real phone number, in plain text, to anyone who opens the invite link, before they have proved anything. This is the same link `resolveInvite`'s own docstring says must not disclose a full name for exactly this reason, but the phone number is not redacted at all |
| Where | `lib/data/claims.ts:501-518` (`resolveInvite` returns `phone: row.phone` unredacted), `app/(patient)/patient/signup/page.tsx:53` (`lockedPhone={invited?.phone ?? null}`), `components/patient/auth-form.tsx:97-112` (renders it as visible text and a hidden form field, comment: "shown, readable, and not editable") |
| Who is harmed | The person the unclaimed record describes: a mental-health patient whose therapist generated an invite link that has since been forwarded, screenshotted, or opened by the wrong person (shared family phone, forwarded WhatsApp message, the exact scenario `resolveInvite`'s own comment is written to defend against for the name). That person's phone number, tied to a therapy record, is disclosed to whoever has the link |
| Severity | major |
| Already known? | PLAN.md 13.4 rules this feature in ("The link opens signup with the number pre-filled and locked") but the ruling never weighs the same forwarded-link threat the redacted-name decision on the same page is explicit about. Not a matching C-number found for the phone-specific leak. New |

---

## 3. Invariant 12: a journal may be cited and never concluded from

`lib/data/journals.ts` is disciplined here. `journalContext` (the function that reaches the
copilot) deliberately does not select `riskLevel`, with a comment explaining why: "The copilot
must reason from what the patient wrote, not from a keyword scanner's verdict about it."
`journalsForPerson` (the patient's own read) never selects `riskLevel` either. I could not
find a patient-facing surface that shows a conclusion drawn from a journal; the crisis alert
to a clinician (`alertGrantHolders`) explicitly does not quote the entry. I looked for this
specifically and found nothing to report here beyond what PLAN.md already documents at C123.

---

## 4. Token routes: `/join`, `/pay`, `/records`, `/feedback`, `/t/[id]`

| Route | Single use? | Expires? | Guessable? | What it unlocks |
|---|---|---|---|---|
| `/join/[token]` | No (must survive reload/reconnect) | 12h (guest) or 3h, `sessions.joinTokenExpiresAt` | No, 24 random bytes (`randomBytes(24)`, `lib/data/sessions.ts:222,305`) | One session's waiting room, video token, consent controls |
| `/pay/[token]` | N/A, reads the same join token | Same as join | Same | A Stripe checkout for one session; amount is recomputed server-side from `sessions.price_cents`, never trusted from the client (`app/pay/[token]/actions.ts:88-92`) |
| `/records/[token]` | No, `openCount` increments but token stays live until expiry or a newer export revokes it | 3 days (`EXPORT_TTL_HOURS`) | No, 32 random bytes, hashed at rest | The full record extract, see finding 1a |
| `/feedback/[token]` | No | 3 days per its own copy | No, 24 random bytes | A rating form and the post-session brief |
| `/t/[id]` | N/A, not a capability token, `id` is a public therapist id | N/A | N/A, deliberately public/indexed | A clinician's public profile, nothing patient-specific |

I tried to find a path where one of these could be replayed to reach *somebody else's* data
rather than the one session/record it was minted for, and could not: every one of `resolveJoinToken`,
`openExport` and `feedbackContext` (used by all the above) is looked up by the token's hash or
value alone and returns exactly one row scoped to that token. I did not find a way to enumerate
a second person's session from a valid token for a different session. This matches PLAN.md's own
C365, which already names this design ("capability auth is MODELLED... a list that has to be kept
honest") as a deliberate, ruled pattern. I am not raising a new finding on token design itself;
see finding 4 under Arabic below for a defect in these same routes.

---

## 5. Crisis paths: the radar and the SOS orb

I tried to find a login wall, a consent wall or an error blocking the SOS orb or the crisis
radar, by reading `components/patient/sos-orb.tsx` and every page that renders it
(`app/(public)/radar/page.tsx`, `app/(public)/t/[id]/page.tsx`, `app/join/[token]/page.tsx`,
`app/pay/[token]/page.tsx`, `app/feedback/[token]/page.tsx`, including its expired-link branch).
The orb is a plain `tel:` link with no fetch and no server action in its path, rendered
unconditionally (`dimmed`, never hidden) even over a live session, and it appears on the
expired-link and cancelled-payment branches of every page above, not only the happy path. I
could not break this. PLAN.md's C235 and C253 already rule and test that the crisis surface is
independent of billing state; the code matches the ruling everywhere I looked.

I also searched for a published promise about response speed (invariant 14): the radar's
metadata says "available this minute" and "no waiting list" (`app/(public)/radar/page.tsx:9-10`),
and a booking-sheet string says a released hold returns a clinician "to the radar within a
minute" (`components/radar/booking-sheet.tsx:344`), which is a claim about a system timeout, not
about how fast a person answers. I found no sentence promising a human response time on any
patient-facing surface I read. Tried and could not break.

---

## 6. The sponsored patient (sprint 60, not yet built)

`coverage_bps` does not exist anywhere in the codebase yet (`grep` across `lib`, `app`,
`components` returns nothing), so this is entirely an attack on the plan, not on shipped code,
per the brief's instruction to audit sprints 58-64 hostilely.

| Field | Detail |
|---|---|
| What | Sprint 60.16 specifies "a private label on the patient's own profile naming the sponsor and the percentage. Visible to them and to nobody else," but does not name which "profile" surface, nor forbid that label reaching a shared component, a cached page, or the record export |
| Where | PLAN.md:3971-3972 (60.16); the closest existing analogue is `app/(patient)/patient/profile/page.tsx`, today's "person's own record" page |
| Who is harmed | A therapist, if the label is added to a component the therapist's own patient-detail screen also renders (this codebase has already shipped and had to fix exactly this shape once: C243, `payerName ?? "Patient"` on the therapist's ledger disclosed sponsorship by omission, fixed in sprint 46 and confirmed still absent from `components/billing/ledger.tsx` and `lib/data/vault.ts` today). A third party the patient hands their record extract to, if sprint 60 adds the sponsor label to `lib/data/export.ts`'s `buildExport`, which is explicitly built to be "handed to a lawyer" (see finding 1a): a sponsor name and coverage percentage in that document identifies the patient's employer and that they sought mental health care, which is a disclosure the patient may not intend when forwarding "my record" |
| Severity | major, as a plan gap (hypothesis: no code exists to inspect) |
| Already known? | C243 documents the exact failure shape (a check for absence that passes because the leak is an absence) for money; nothing in §2 addresses the coverage label specifically for sprint 60. New, framed as a warning for the sprint 60 build rather than a defect in code that does not exist yet |

---

## 7. Sign out and account recovery

**Sign out.** Confirmed fixed, and I tried to break it rather than trust the comment.
`patientSignOut` (`lib/patient-auth/actions.ts:288-291`) calls `destroyPatientSession`, which
sets `revokedAt` on the `patient_auth_sessions` row in the database *and* deletes the cookie
(`lib/patient-auth/session.ts:187-197`). `getPatientActor` checks `isNull(revokedAt)` on every
read, so the old token cannot be replayed after sign-out even if somebody captured the cookie
value first. It is wired to a real button (`app/(patient)/patient/account/page.tsx:160-167`),
a plain form with no JavaScript. I could not find a way to keep a session alive after pressing
it. Matches C358's ruling.

**Password reset.** `completePatientReset` (`lib/patient-auth/reset.ts:253`) calls
`revokeAllPatientSessions` after a successful reset, which is exactly the account-takeover
defense that matters: a session an attacker opened before the legitimate owner reset the
password does not survive the reset.

**Phone change**, one gap:

| Field | Detail |
|---|---|
| What | `completeChange`, the function that moves `patient_accounts.phone` on a correct six-digit code, has no rate limit on wrong-code attempts. `completePatientReset` (password reset) and `verifyClaim` (record claim) both bound wrong guesses; this one does not |
| Where | `lib/data/phone-change.ts:299-350` (`completeChange`), contrast with `lib/patient-auth/reset.ts:184-190` (`consume(...patient:reset-confirm...)`) and `lib/data/claims.ts` (three-strike lock via `person_claims`) |
| Who is harmed | The patient, only if an attacker already has the `requestId` (an unguessable UUID minted server-side after a staff member has approved the request) and the phone-change flow has reached the `verifying` state. Real-world exposure is low because the code is never entered by the patient through a public form in this codebase today, only through `app/(admin)/admin/numbers/actions.ts`, which is staff-gated |
| Severity | minor |
| Already known? | Searched PLAN.md §2 for "phone change" concerns; found C75, C81, C87, C88, all about the claim flow's attempt budget, none about `completeChange`'s own rate limit. New |

---

## 8. Arabic: a patient surface that renders English

This is the strongest finding in this file. The i18n coverage ratchet that is supposed to make
this impossible measures the wrong surface for exactly the patient pages that matter most.

### 8a. The ratchet's own surface classifier cannot see these pages as "patient" pages

| Field | Detail |
|---|---|
| What | `surfaceOf()`, the function that decides which budget (`patient`: 0 tolerated English literals, `shared`: 80 tolerated) a file's English literals count against, classifies a file as `"patient"` only if its path contains the literal substring `"(patient)"`. But `/join/[token]`, `/pay/[token]`, `/feedback/[token]`, `/records/[token]`, `/(public)/t/[id]` and `/(public)/radar` are all, by the product's own deliberate architecture, **outside** the `(patient)` route group (documented in-repo: "the two screens a patient must never fall out of are not in that route group," PLAN.md build log, 2026-09-11, and `app/join/[token]/page.tsx:115` "It is not in the (patient) route group, because a join link has to work for somebody who has never signed in"). Every one of these files therefore falls through to the catch-all `"shared"` bucket, which tolerates 80 English literals, instead of the `"patient"` bucket, which tolerates zero |
| Where | `scripts/_i18n-coverage.ts:229` (`if (file.includes("(patient)")...) return "patient"`), `:232-233` (catch-all `return "shared"`) |
| Who is harmed | Every Arabic-reading patient who lands on the unauthenticated, no-login pages the product built specifically so a person who has never signed in, including someone arriving off the crisis radar, can reach them. This is exactly the same shape of defect as C362 (a skip list matched by name misses a whole directory) and H31, just in the classifier rather than the scanner |
| Severity | blocker. This is the gate that exists specifically to catch this, and it structurally cannot see the highest-stakes half of the patient surface |
| Already known? | Searched PLAN.md for "surfaceOf" and for the specific files below; no match. New |

### 8b. Concrete instances the classifier is hiding

| Field | Detail |
|---|---|
| What | The page every patient in the product lands on after every session, to rate it and read their brief, is hardcoded English with no translation call for almost all of its static text |
| Where | `app/feedback/[token]/page.tsx:37` ("This link has expired"), `:38-40` (expiry body text), `:92` ("Do you want to see this yourself?"), `:93-97` (body), `:102` ("Make it mine"). The file imports `getI18n` and calls `t()` exactly once, for `t("urgent.footer")`; every other string on the page is a plain string literal |
| Who is harmed | An Arabic-speaking patient (a majority of the Egyptian-entity user base this product explicitly serves), on the single screen the product describes as "where a patient lands after a session" |
| Severity | blocker |
| Already known? | New, and see 8a for why the ratchet did not catch it |

| Field | Detail |
|---|---|
| What | The "link is dead" state of the join page, reached whenever a session link has expired or the session finished, is hardcoded English, even though the same page renders a working `<LanguageSwitch />` in its header two lines above the `Shell` wrapper that contains it |
| Where | `app/join/[token]/page.tsx:81-85` |
| Who is harmed | An Arabic-speaking patient, including one who booked off the crisis radar and is returning to a session that has already ended |
| Severity | major |
| Already known? | New |

| Field | Detail |
|---|---|
| What | The expired-link page for a patient's own record extract is a fully hardcoded English HTML document with no locale handling of any kind, not even a call into the i18n system. It is also structurally invisible to the coverage scanner regardless of the classifier bug above, because the scanner only walks `.tsx` files and this is a `.ts` route handler building a raw HTML string |
| Where | `app/records/[token]/route.ts:42-66` (`gone()`) |
| Who is harmed | An Arabic-speaking patient whose record-extract link has expired |
| Severity | major |
| Already known? | New |

I also found `app/(public)/verify/page.tsx` fully hardcoded in English (the public
verification-code lookup page); lower severity since its audience is a third party checking a
code, not the patient themselves, but it is the same defect shape and worth naming: the
`(public)` exemption in `_i18n-coverage.ts`'s `EXEMPT` list says these routes are "CMS-driven:
the rows are already published in both languages," which is true of the marketing site's
`[slug]` pages and false of `/(public)/verify` and `/(public)/radar`, which are React
components with their own literal strings, not CMS rows. That exemption is matched by path
prefix (`"app/(public)/"`) rather than by whether a file is actually CMS-driven, so it silently
also waives the coverage check for `/(public)/t/[id]`, `/(public)/verify` and `/(public)/radar`
themselves, on top of the `surfaceOf` miscategorization above. I did not find hardcoded English
in `/(public)/t/[id]` or `/(public)/radar`'s own `.tsx` files (`TherapistPageBody`,
`RadarConsole` use `t()` where I sampled them), so I am not raising a finding there, but the
exemption is broader than its own stated reason and a future English literal added to either
file would not be caught by either mechanism.

---

## What I could not verify

- I did not run `verify:reachable`, `verify:principals`, `verify:claims` or the i18n coverage
  script against this checkout, per the brief's read-only instruction and because I was not
  confident `_i18n-coverage.ts`'s CLI entry point avoids a database import chain I hadn't fully
  traced. Finding 8a is therefore based on reading the classifier function's logic against the
  actual file paths in the repository, not on an observed failing gate run. Running
  `npx tsx scripts/_i18n-coverage.ts` (it takes no arguments and, by inspection, touches only
  the filesystem) would confirm the exact literal counts I hand-counted for 8b.
- I could not confirm from static reading alone whether `components/pay/pay-flow.tsx`,
  `components/feedback/rating-form.tsx` or `components/join/join-flow.tsx` (all client
  components rendering most of the *interactive* content on these same token routes) carry
  further hardcoded English; I sampled their host pages, not these components themselves, for
  time. Given 8a and 8b, I would not be surprised to find more there.
- I could not exercise the invite-phone-disclosure path (finding 2) against a running database
  to confirm the record I read matches what actually renders in a browser; I read the server
  component and the client component's JSX directly rather than rendering the page, per the
  ban on running anything that writes to the database.
- Finding 1a and 1b describe what the code selects and how today's one caller renders it. I did
  not exhaustively grep every file in the repository for a second, undiscovered caller of
  `listDiagnoses` or `buildExport` that might render the unfiltered data more dangerously; I
  checked with `grep -rn` for each function's name across `app/` and `lib/` and found the
  callers named above and no others as of this reading.
- Sprint 60 (the sponsored patient) has no code to read, so finding 6 is a hypothesis about the
  plan only, not a verified defect. I would need the sprint 60 build to check whether the
  private label actually reaches `lib/data/export.ts` or any therapist-facing component.
- I did not check `lib/data/assessments.ts`, `lib/data/portability.ts` or `lib/data/notices.ts`
  as deeply as the modules above; a pass over their patient-facing pages
  (`app/(patient)/patient/assessments/**`, `app/(patient)/patient/notices/**`) did not turn up a
  select list reaching clinical content, but I did not read every function in those three files
  line by line the way I did for `patient-view.ts`, `claims.ts`, `diagnoses.ts` and `export.ts`.
