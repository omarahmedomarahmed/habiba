# Audit 05 — The clinic, and the seventh principal

Scope: `app/(clinic)/**`, `lib/clinic-auth/**`, `lib/data/clinic.ts`,
`lib/data/clinic-admin.ts`, `lib/db/schema.ts` (organizations, clinicManagers,
clinicAuthSessions, clinicianInvitations, subscriptions), `components/admin/clinic-manager.tsx`,
PLAN.md §3f, sprints 62 to 63, concerns C259 to C263, C323 to C334, C351 to C355.

Read in full: `lib/data/clinic.ts`, `lib/data/clinic-admin.ts`, `lib/clinic-auth/session.ts`,
`lib/clinic-auth/guard.ts`, every page and action under `app/(clinic)`,
`components/admin/clinic-manager.tsx`, `lib/audit.ts`, `lib/db/index.ts`, `lib/db/region.ts`,
`lib/auth/session.ts`, `lib/ehr/file-note.ts`, `lib/ehr/fhir.ts` (the relevant functions),
`lib/settings/defs.ts` (the pricing tiers), `lib/billing/stripe.ts` (the checkout comments),
`lib/billing/plans.ts`, `app/(admin)/admin/clinics/actions.ts`. Ran `npm run verify:principals`
and `npm run verify:reachable` (both read-only, both PASS) as a control on what those gates do
and do not check.

## Invariant 10, as it stands today

**Tried to break it. Could not, for clinical content.** `lib/data/clinic.ts` is a closed set of
seven functions (`clinicClinicians`, `clinicInvitations`, `clinicSchedule`, `clinicUsage`,
`clinicBills`, `clinicManagersFor`, `getClinic`), every one of them a named `select({...})` with
no `sessionNotes`, `transcriptSegments`, `sessionInsights`, `personDiagnoses` or copilot table
imported anywhere in the file (`lib/data/clinic.ts:1-16`, `368`). `lib/data/ehr.ts`, the module
`clinic/records` reads, is the same shape: `connectionsFor` (`lib/data/ehr.ts:262-277`) and
`writebacksFor` (`lib/data/ehr.ts:340-354`) select only connection metadata and filing state,
never note content.

The one place this could plausibly have leaked and did not: `ehrWritebacks.lastError`, exposed to
the clinic through `writebacksFor` and rendered on `/clinic/records`
(`app/(clinic)/clinic/records/page.tsx:39-44`). Its only writer is `lib/ehr/file-note.ts:211-217`,
and the string it writes comes from `fileDocumentReference` in `lib/ehr/fhir.ts:196-228`, which
returns only fixed, generic strings (`"That hospital refused the note (${response.status})."`,
`"That hospital's FHIR server could not be reached."`) — never anything derived from the note text
or the FHIR server's response body. Checked as a control: if this function instead echoed the
remote server's own error body (a common FHIR/REST pattern), a clinic's `lastError` column would
be a live channel for exactly the content invariant 10 exists to block. It does not, today.

That is the good news. The disclosure and audit findings below are not about clinical content
(notes, transcripts, copilots, risk) — they are about the one thing the plan explicitly *does*
allow the clinic to see (a patient's name and an appointment time), and about whether the
surrounding machinery (disclosure, audit, region routing) that the newest rulings promise
actually exists.

## Findings

### 1. The disclosure C327 requires does not exist anywhere a patient can see it

| Field | Detail |
|---|---|
| What | A patient booking with a clinic-affiliated therapist is never told that clinic staff can see their name and appointment time, and the fallback justification the plan relies on (their practice name is already shown on the public profile) is not built either |
| Where | No match for any clinic-disclosure string in `lib/i18n` outside the clinic app itself; `components/patient/therapist-card.tsx` and `lib/data/discover.ts` never select or render an organization/practice name at all |
| Who is harmed | A patient of a clinic-affiliated therapist, who books with no idea a third party (the practice manager) will see their name and the time, and who C327 itself says is entitled to be told |
| Severity | blocker |
| Already known? | C327 (PLAN.md:299) rules "**a disclosed leak is a trade; an undisclosed one is a breach**" and schedules the disclosure sentence for sprint 63 (63.12, PLAN.md:4089-4090). But the underlying visibility this discloses is not future work — `clinicSchedule` (`lib/data/clinic.ts:166-213`) has shipped since sprint 54 and is live now. By C327's own words, this is a breach today, not a gap to be closed later. C260 (PLAN.md:232) claimed the practice name on the public profile was the implicit notice; I checked and it is not rendered anywhere a patient sees before booking, so even the weaker, already-ruled justification is not actually true of the code. |

### 2. The schedule discloses the patient's full name, not first name plus last initial

| Field | Detail |
|---|---|
| What | `clinicSchedule` selects and renders the patient's full first and last name, not "first name plus last initial" |
| Where | `lib/data/clinic.ts:174-176` selects `patients.firstName` and `patients.lastName` in full; `lib/data/clinic.ts:205-209` joins them with no truncation (`[row.patientFirst, row.patientLast].filter(Boolean).join(" ")`); rendered as-is at `app/(clinic)/clinic/page.tsx:123` |
| Who is harmed | A patient at a small clinic, more identifiable by full name than the founder's own newer standard permits |
| Severity | major |
| Already known? | C260 (PLAN.md:232, sprint 54) only says "a name", so the code matches the ruling it was built under. C327 (PLAN.md:299, sprint 63, two days later) narrows this explicitly to "first name plus last initial", using the exact same two-therapist-clinic example ("Sarah M., Tuesdays 3pm, six months") this file's own docblock does not use. The ruling exists; sprint 63 has not built it, and the checklist (63.12, PLAN.md:4089-4090) frames it as new work for the "clinic staff" principal without naming that it also has to change `clinicSchedule`, which the existing `clinic_admin`/`viewer` roles already use today. |

### 3. PLAN.md contradicts itself about whether a clinic manager is a `users` row, and the code has already picked a side the plan does not acknowledge

| Field | Detail |
|---|---|
| What | C259 (sprint 54) rules a clinic manager is "a new kind of user inside" the organization; C324 (sprint 63) rules the opposite, "clinic staff must not be a `users` row... its own table and its own auth session", and presents this as new sprint-63 work. Neither concern references the other. The shipped code already built C324's answer, under C259's ruling. |
| Where | C259 text: PLAN.md:231 ("a clinic is the organization and a **clinic manager is a new kind of user inside it**"). §3f, the required reading for this audit, repeats the same claim at PLAN.md:948-949. C324 text: PLAN.md:296 ("**No role string, no shared table, no shared guard**"). What actually exists: `clinicManagers` (`lib/db/schema.ts:6185-6216`) and `clinicAuthSessions` (`lib/db/schema.ts:6221-6240`) are separate tables with their own cookie (`CLINIC_COOKIE`, `lib/routing.ts:117`), and `lib/db/schema.ts:6220` literally says "Own cookie, own table, shaped like the sponsor's" |
| Who is harmed | Nobody directly today (the code is the safer of the two rulings). The harm is to whoever builds sprint 63 next from the plan as written: they will read 63.1 ("clinic staff is its own principal, with its own table and its own auth session... never a `users` row") as a greenfield instruction, not notice it already exists as `clinicManagers`, and either duplicate the infrastructure (a second clinic-side principal table, a second cookie, a second guard family, sitting beside the first with no stated relationship) or spend the sprint confused about which of the two contradictory concerns to follow |
| Severity | major |
| Already known? | This is the contradiction itself: C259 and C324 are both "ruled" in PLAN.md and disagree. Neither concern is marked superseded. §3f, listed in this audit's own required reading, still carries the stale (C259) version. |

### 4. The audit trail cannot name a clinic manager as an actor, so C327's and C334's "audited" requirements cannot be satisfied by the code that exists to satisfy them

| Field | Detail |
|---|---|
| What | `audit()`'s input type only accepts `Pick<Actor, "userId" \| "organizationId">` or a `patientAccountId`. A `ClinicActor` (`clinicManagerId`, `clinicOrganizationId`) fits neither shape. Zero calls to `audit()` exist anywhere in `lib/data/clinic.ts`, `lib/data/clinic-admin.ts`, or `app/(clinic)/**`. The one clinic-triggered write that does reach an audited function (`disconnect()` calling `revokeConnectionsFor`) passes `actor: null`, so the row records that a record system was disconnected but not by whom |
| Where | `lib/audit.ts:20-21` (the type), `lib/audit.ts:65-68` (the insert, `actorUserId`/`actorAccountId` only); `lib/db/schema.ts:2295-2315` (`audit_log` has exactly two actor columns, `actor_user_id` and `actor_account_id`, with a comment explaining why a third kind of actor could not share either column); `lib/data/ehr.ts:170-177` (`actor: null` on the one clinic-reachable audited call); confirmed by grep that no clinic app file, and no sponsor or partner app file either, calls `audit()` at all, while `app/(admin)/admin/clinics/actions.ts:35-41` and `:67-73` show the admin side of the same features (activating a clinic, adding a manager) *is* audited, with the admin's own `userId` as actor |
| Who is harmed | Every patient C327 promises an audited read to, and every future export C334 promises to watermark with "the requesting user" — neither promise is satisfiable against the current schema without adding a way to name a clinic manager (and, by the same argument, a sponsor or partner user) as an actor |
| Severity | blocker |
| Already known? | C327 (PLAN.md:299): "Every clinic-staff read of a calendar is audited." C334 (PLAN.md:306): "every export is audited with the requesting user, watermarked with their name." 63.12 (PLAN.md:4089-4090) and 63.17 (PLAN.md:4101-4102) restate both as sprint-63 checklist items. None of the three mentions that the audit log's actor columns need to change first. This is a genuinely new finding: the schema comment at `lib/db/schema.ts:2306-2311` explains the two-column design in terms of clinicians versus patients and never anticipates a third or fourth kind of actor, even though `sponsor_users` and `partner_users` (the very tables C324 says to copy) have existed since sprints 53 and 55 with exactly the same gap. |

### 5. `clinicSchedule`, `clinicUsage` and `clinicBills` read patient, session and invoice rows through `controlDb`, which the codebase's own rule says is wrong, and which will silently misbehave the moment Egypt gets a database

| Field | Detail |
|---|---|
| What | Three clinic functions query `sessions`, `patients` and `invoices` — all patient-scoped, region-routed data under C118/C154 — via `controlDb` (the single, always-US control plane) instead of `dbFor(region)`, and without registering as a counted debt the way every other unrouted call site in the codebase does |
| Where | `lib/data/clinic.ts:171` (`clinicSchedule`, joins `sessions`, `users`, `patients`), `lib/data/clinic.ts:249` (`clinicUsage`, raw SQL against `invoices`), `lib/data/clinic.ts:322` (`clinicBills`, raw SQL against `invoices` and `invoice_lines`). `lib/db/index.ts:105-113` is the module's own docblock: "Use it \[`controlDb`\] for anything that is a fact about the PRODUCT rather than about a person... **If you are reaching for it to read somebody's sessions, notes, documents or payments, it is the wrong one.**" Compare `lib/data/sessions.ts:31`, which reads the same kind of data and instead calls `pinnedToDefaultRegion("lib/data/sessions.ts", "not routed yet...")`, registering itself in `regionPins()` so `verify:sprint30` can count it. `lib/data/clinic.ts` does not call `pinnedToDefaultRegion` at all — it is not even counted as debt |
| Who is harmed | An Egyptian clinic's practice manager, once `DATABASE_URL_EG` is set (sprint 64, the very next sprint after this one, and PLAN.md:4111 flags it as blocked only on paperwork, not on code). Their `/clinic` schedule, usage and bills pages would query the US control-plane database for `sessions`/`patients`/`invoices` that, post-cutover, live in the Egypt-resident database — returning an empty or wrong-country week to a paying customer with no error, since `controlDb` always resolves successfully, just to the wrong country's rows |
| Severity | major today (Egypt currently falls back to the US instance, so `controlDb` and `dbFor("eg")` are the same physical database and nothing is visibly wrong yet); becomes blocker the day sprint 64 sets `DATABASE_URL_EG` |
| Already known? | C118 (PLAN.md:1458) and C154 (PLAN.md:1494) rule the general principle and note "the clinic-shaped implementation would have served her record from Virginia while satisfying every check anybody wrote" — almost word for word the failure mode described here, but about clinician caseloads generally, not about this specific file. This exact call site is not named anywhere in PLAN.md's concerns list. Also worth noting: C154's ruling is that a chart resolves through the *patient's* region, not the organization's, so even a `dbFor`-correct version of `clinicSchedule` would need the `acrossRegions` fan-out (C155) to be right for a clinic with patients in more than one country — `clinicSchedule` is a single flat query and could not produce that today even after the `controlDb` bug is fixed. |

### 6. Sprint 63's dual-role fix (C352) proposes a shared-session model where a stronger one already ships

| Field | Detail |
|---|---|
| What | Today, a clinician session and a clinic-manager session are already fully independent: separate cookies (`24t_session` vs `24t_clinic`, `lib/routing.ts:15,117`), separate route groups with no shared layout (`app/(clinic)/layout.tsx:10-17` states this explicitly), separate guards, and `getClinicActor` re-derives `organizationId` fresh from the database on every request (`lib/clinic-auth/session.ts:106-146`; the equivalent for a clinician, `lib/auth/session.ts:123,137,177`). A dual-role human today can hold both cookies at once and each route group only ever honours its own. Sprint 63.2 instead proposes "two linked principal rows, and **the session cookie names which is ACTIVE**... switching is explicit and audited" — a single active-principal model that the current architecture does not have and does not need |
| Where | `lib/routing.ts:15,20,99,117,138` (five separate cookies for five separate portals today); `app/(clinic)/layout.tsx:10-17`; PLAN.md:4066-4068 (63.2); C352, PLAN.md:324 |
| Who is harmed | Hypothetical: nobody yet, since this is unbuilt. The risk is process, not a live defect: replacing a design that is safe because there is nothing to switch (two cookies, two independent checks) with a design that is safe only if a switch is implemented and audited correctly, introduces exactly the class of bug (a stale "active" pointer, a server action or webhook that runs outside any cookie context and has to pick a principal some other way) that C352 itself is written to prevent. The plan does not explain why the stronger, already-shipped separation needs replacing |
| Severity | major (plan-level; nothing to point at in running code because it is not built) |
| Already known? | C352 (PLAN.md:324) is the ruling this finding attacks directly: "one human with two principals in one session is how a clinical grant reaches a management screen." That is true of a *shared* session. It is not a description of what exists today, which is two unrelated sessions. The finding is that the plan does not name the current double-cookie architecture as an alternative, safer answer to the same problem it is trying to solve. |

### 7. Custom-role capabilities (C325, C326, C353) are never enumerated, so "subset of the admin's" cannot be checked

| Field | Detail |
|---|---|
| What | Sprint 63's checklist requires a "closed list in code" of capabilities (63.5) and a rule that a custom role's capabilities are a subset of the clinic admin's (63.6, C326), but PLAN.md never states what the capabilities actually are (there is no list of names anywhere in §3f, §4, or the sprint 63 block) |
| Where | PLAN.md:4069-4077 (63.3-63.6); C325 PLAN.md:297; C326 PLAN.md:298; C353 PLAN.md:325 |
| Who is harmed | Whoever builds this next, and after them, a clinic patient if the vocabulary that gets invented at build time turns out to have one capability that implies another (for example, a "manage calendar" capability that also happens to let the same code path read radar status, if the resource check for the first is written against the same table as the second without separating them) |
| Severity | major (a design gap that C326's own enforcement cannot close, because "subset of a set" is meaningless until the set's members and their real effects are named) |
| Already known? | New. C325/C326/C353 rule the *shape* of the mechanism (data-layer, resource-scoped, closed list, subset). None of the three, nor the sprint 63 checklist, names a single capability. |

### 8. Sprint 63.10 contradicts sprint 54's own reasoning (C267) about what the clinic sees before verification

| Field | Detail |
|---|---|
| What | 63.10 says "A therapist invited into a clinic must verify as a therapist first. **The invite is visible only after approval.**" C267 (sprint 54, already shipped) deliberately does the opposite: the clinic sees the invited clinician immediately on acceptance, with `verificationStatus` shown as `unverified`/`pending`, specifically **so the clinic can chase it** |
| Where | PLAN.md:4085-4086 (63.10); `lib/data/clinic.ts:73-86` (`ClinicClinician` type, comment: "the clinic SEES that verification is pending and can chase it... `verificationStatus` is read-only here in the strongest sense"); rendered today at `app/(clinic)/clinic/people/page.tsx:17-44` with `verificationStatus` shown on every row |
| Who is harmed | Nobody yet; this is a plan inconsistency, not a live leak. But if 63.10 is built literally, it silently removes a feature (chasing a slow verification) that C267 was written specifically to provide, and nothing in sprint 63 says that trade is intended |
| Severity | minor |
| Already known? | This is the contradiction itself. C267 is referenced from `lib/data/clinic.ts:75,83` and from PLAN.md's sprint 54 material; 63.10 does not cite or reconcile with it. |

### 9. The founder already has a subscription tier literally named "Clinic" at exactly the seat price sprint 62 is about to introduce

| Field | Detail |
|---|---|
| What | A solo therapist's own subscription ladder already has a tier with `key: "clinic"`, `name: "Clinic"`, `monthlyCents: 17900` ($179/month, unlimited, per therapist) — the same name and the same figure sprint 62 is about to use for "1 to 2 seats" on a multi-therapist `organizations.kind = "clinic"` tenancy. These are two unrelated concepts (an individual's subscription tier vs. an organization's seat count) sharing one string |
| Where | `lib/settings/defs.ts:305`; README.md:63-64 (the existing public pricing table already lists "Clinic — $179 a month — nothing" as a *personal* plan, alongside "Practice — $99 a month"); `lib/billing/stripe.ts:172-176` (the checkout function's own comment already warns that a crafted form post could target `tierKey: "clinic"` and get honoured, because "entitlement asks what the ROW says and the row would say clinic") |
| Who is harmed | Support, billing reconciliation, and anybody reading `subscriptions.tierKey = "clinic"` in the future and assuming it means "this org is a multi-seat clinic" when it means "this one therapist bought the $179 personal unlimited plan." A therapist who is *also* a member of a real `organizations.kind = "clinic"` tenancy (C261 forbids this on the same account, but nothing forbids it on their separate solo account) could hold a personal `tierKey: "clinic"` subscription and be a clinic-employed clinician at the same time, making "is this a clinic" ambiguous by string alone |
| Severity | major |
| Already known? | New. Not named in any of C323, C329 to C334, or C351/C355. |

### 10. The seat arithmetic checks out; two directions the plan never states

| Field | Detail |
|---|---|
| What | Computed the table at 1, 2, 3, 4, 5, 6 and 20 seats: 1 = $179, 2 = $179, 3 = $270, 4 = $360, 5 = $400, 6 = $480, 20 = $1,600. All match the retroactive reading C323 rules for and the two anchor points the founder gave (4 seats = $360, 5 seats = $400). The +$91 cliff at seat 3 (62.2) and the recompute-on-add rule (C351, 62.3) are both internally consistent. Two questions the plan does not answer: (a) does removing a seat that drops a clinic below a tier threshold (say 5 to 4) retroactively **raise** the remaining seats back to the higher per-seat rate for the rest of the period, the mirror image of C351's add-side recompute; and (b) 62.6/C355 defers a new seat's bill until the joining therapist's own subscription period ends — if that date differs from the clinic's own billing anniversary (routine, since the therapist's period started whenever they first subscribed), the clinic ends up with seats on different renewal dates, which is hard to reconcile with C351's promise of "the difference... as ONE figure" |
| Where | PLAN.md:4024-4032 (the table); C323 PLAN.md:295; C351 PLAN.md:323; C355 PLAN.md:327; 62.5 PLAN.md:4042-4043 (removal, silent on tier recompute); 62.6 PLAN.md:4044-4045 (deferred billing, silent on anniversary drift) |
| Who is harmed | A clinic that hits a discount tier briefly then drops below it (a, if the system re-raises pricing retroactively, this is a punitive surprise; if it does not, a clinic can buy one day at the top tier to lock in a lower rate for the rest of the period at minimal cost, since 62.5 says removal is never refunded, not that it reprices the rest). Any clinic with more than one seat whose members joined on different dates (b), whose monthly bill stops being the "one figure" the UI promises |
| Severity | minor (both are gaps in an unbuilt spec, not live defects) |
| Already known? | New for (a) and (b) specifically; C351 and C355 each address one side of a two-sided problem and neither states the other side. |

### 11. Leaving and rejoining a clinic issues a brand-new identity, which sprint 63's resource-scoped permissions (C325) will have to account for

| Field | Detail |
|---|---|
| What | `removeClinician` does not delete or archive a departing clinician's `users` row; it re-parents the *same* row to a freshly created solo `organizations` row (`kind: "solo"`). But `acceptInvitation`, the only path back into a clinic, always `INSERT`s a brand-new `users` row (there is no "rejoin" path that reuses an old id). So a therapist who leaves and later rejoins the same clinic becomes two disconnected `users.id` values over time |
| Where | `lib/data/clinic-admin.ts:448-534` (`removeClinician`, the `UPDATE users SET organization_id = solo.id` at line 527-530); `lib/data/clinic-admin.ts:373-416` (`acceptInvitation`, the `INSERT INTO users` at line 376-393); the existing-user check at `lib/data/clinic-admin.ts:199-211` only excludes an email already in the *same* clinic org, so a returning therapist's old solo-org email is free to be re-invited and re-created from scratch |
| Who is harmed | Nobody today (sprint 63's resource-scoped assignments do not exist yet to be stale). The risk is forward: 63.4's own example is "Assistant 1 assigned to therapist A is refused therapist B's calendar on the same route" — a resource assignment keyed on `users.id`. If a departed-and-rejoined therapist gets a new id, any assignment naming their old id becomes a permanently dangling row with no expiry and no obvious owner to clean it up, and an admin auditing "who can see this calendar" would have no way to tell a stale grant from a live one without cross-referencing departure history that this table does not carry |
| Severity | minor (hypothesis; the mechanism it would corrupt is not built) |
| Already known? | New. C266/C331 (departure) and C325 (resource-scoped capabilities) are both ruled but never cross-referenced against each other. |

### 12. Admin's manager-creation forms show the new password in plain text

| Field | Detail |
|---|---|
| What | The form an admin uses to set a clinic manager's first password renders it in an unmasked `<input type="text">`, not `type="password"` |
| Where | `components/admin/clinic-manager.tsx:146`. The identical pattern exists at `components/admin/partner-manager.tsx:167` and `components/admin/sponsor-manager.tsx:250`, so this is a consistent house convention across all three "manager" portals, not something unique to clinic |
| Who is harmed | An admin on a screen-shared call, or anyone glancing at the admin's screen, sees the password as it is typed. Low-severity because this is an internal operator tool (`requireRole("super_admin")`, `app/(admin)/admin/clinics/actions.ts:52`) and the same convention is used everywhere else in the product for this exact "read it aloud on the phone" workflow |
| Severity | minor |
| Already known? | Not found under any C-number. Flagged because `components/admin/clinic-manager.tsx` is explicitly in this audit's scope; noted as a systemic pattern rather than a clinic-specific defect. |

## Departure (C331) — what was checked and what remains open

Checked and clean: a departing clinician's `organizationId` is read fresh from `users` on every
request (`lib/auth/session.ts:123,137,177`), not cached in a session token, so there is no window
where an already-issued clinician session keeps acting under the old clinic's tenancy. All three
main clinic pages (`app/(clinic)/clinic/page.tsx:11`, `.../bills/page.tsx:10`,
`.../records/page.tsx:14`) declare `export const dynamic = "force-dynamic"`, so Next.js route
caching cannot serve a clinic manager a pre-departure page after `removeClinician` runs; the
`/clinic/people` action also calls `revalidatePath("/clinic/people")` explicitly
(`app/(clinic)/clinic/people/actions.ts:75,90`).

Could not verify: the departure ticket (63.16, C331) mentions "the clinic keeps the financial
record and loses every live view instantly," but exports (63.17), generated reports, and a
notification queue are all sprint-63 features that do not exist in the code yet, so there is
nothing to check them against. The specific risks the brief asks about — a report already
generated before departure, an export already downloaded, a queued notification email that still
names the departed clinician's upcoming slot — cannot be evaluated until those features exist.
Naming this gap rather than assuming it is fine either way.

## The invite (C328, 63.9) — what was checked

Checked: `inviteClinician` (`lib/data/clinic-admin.ts:179-240`) creates one `clinicianInvitations`
row and nothing else — no `users` row, no verification status, no caseload. `resolveInvitation`
(`lib/data/clinic-admin.ts:282-316`) and the invite screen
(`app/(clinic)/clinic/join/[token]/page.tsx`) expose only the clinic's name and whatever the
inviting admin typed (email, first/last name) back to the invitee — nothing about a colleague's
calendar or earnings, consistent with C328. `notify()`'s invite message
(`app/(clinic)/clinic/people/actions.ts:58-66`) names the practice and says nothing about therapy
or patients. No account-enumeration signal found: `inviteClinician` and `acceptInvitation` return
the same generic errors regardless of whether the target email is already known to the system
elsewhere. The one real inconsistency found is finding 8 above (63.10 vs C267), not a leak.

## What I could not verify

- **Sprint 62 and 63 code**, because neither is built. Every finding above about seats, custom
  roles, the dual-role switcher, exports, and departure reports is either a check of the arithmetic
  and rulings as written, or a hypothesis grounded in mechanics that do exist today (`removeClinician`,
  `acceptInvitation`, the cookie architecture). None of it is a runtime-tested defect, because there
  is no runtime yet.
- **Whether `verify:principals` or `verify:reachable` would catch any of findings 1, 2, 4, 5 or 9.**
  I ran both (read-only, both PASS) and read what they assert: `verify:principals` checks that every
  data module is declared and that no entry point reaches a clinical module through the wrong
  principal (an import-graph and reachability check); `verify:reachable` checks that every action,
  route and page has a caller. Neither inspects a select list's column choices, a disclosure sentence's
  existence, an audit call's presence, or which database client a function uses. That is not a flaw in
  those verifiers — it is not what they are for — but it means a clean run of both, which this codebase
  can currently produce, says nothing about any of the five findings above.
- **Whether the Stripe side of the existing "Clinic" $179/month solo tier (finding 9) has ever
  actually been sold to a customer**, versus existing only as a settings row nobody has purchased.
  I could not query the database and did not attempt to.
- **The exact behavior of `dbFor("eg")` under load once `DATABASE_URL_EG` is actually set** — I read
  the fallback logic in `lib/db/region.ts` and reasoned from it, but did not (and per the audit rules,
  must not) run anything against a database.
