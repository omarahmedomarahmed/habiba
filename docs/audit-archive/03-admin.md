# Admin and back office audit

Scope: `app/(admin)/**`, `components/admin/**`, `lib/data/admin.ts` and siblings,
`lib/auth/guard.ts`, `lib/audit.ts`, `lib/observability/**`, `lib/settings/defs.ts`,
`scripts/verify-reachable.ts`, `scripts/verify-principals.ts`, `scripts/_surfaces.ts`.

Every finding below was checked by reading the named file and line. Where I
could not point at a line I say so and mark it a hypothesis.

---

## 1. The sharpest finding: Total View is invisible to `verify:principals`

**What.** `scripts/verify-principals.ts` only ever counts a module as
"clinically reached" when the import specifier string starts with the literal
prefix `lib/data/` (`scripts/verify-principals.ts:291`,
`if (spec.startsWith("lib/data/")) out.add(...)`). `app/(admin)/admin/tv/page.tsx`
reads live session transcripts, clinical note content, risk levels and a
patient's copilot conversation directly from `lib/console/reads.ts`
(`sessionDetail`, `timeline`, `conversationFor`, called at
`app/(admin)/admin/tv/page.tsx:39-53`), and `lib/console/reads.ts` queries
`controlDb` (raw Drizzle) directly and contains zero imports from `lib/data/`
(confirmed by grep, 0 hits). So the entire Total View surface, the one place
in this product outside the break-glass investigation page that renders a raw
transcript and a risk assessment on one screen, is structurally outside what
the gate can ever see. The gate's own accept line ("every clinical read is
made by a principal declared for it") is false of this surface, and nothing
in `verify:principals` would ever print that.

**Where.** `scripts/verify-principals.ts:291` (the `lib/data/` prefix test),
`lib/console/reads.ts:9-14` (imports, no `lib/data/*`), `app/(admin)/admin/tv/page.tsx:6-18,39-53,142-173`
(the reads and the rendered transcript/note/risk fields).

**Who is harmed.** Every patient whose session is ever opened in Total View.
Today the page still requires `requireManager()` plus a live two-key elevation
grant that only `super_admin` can create (see finding 2), so there is no live
breach. The harm is that the one gate built specifically to catch "a page
reaches clinical data as a principal that may not" cannot see this page at
all, so a future loosening of its guard (a very plausible edit, see finding 2)
would ship silently green.

**Severity.** blocker. Not because data is exposed today, but because this is
exactly the class of defect sprint 58 exists to catch, and it does not catch
it on the one page in the whole admin portal built to show a transcript
outside the break-glass flow.

**Already known?** Not covered by any C-number I could find. C366 rules that
"every page or route that can reach a clinically-scoped data module must
authenticate as a principal declared for that module" and states the design
tradeoff (55 modules instead of 2,900 cells) but does not mention that the
scan is scoped to one directory prefix, or that `lib/console/` is a second,
parallel data-access namespace the gate never walks. This is a genuinely new
gap in the gate itself, not a restatement of C366.

---

## 2. `/admin/tv`'s declared guard is not the real one

**What.** The page's own top-level guard is `requireManager()`
(`app/(admin)/admin/tv/page.tsx:31`), which by `MANAGER_ROLES` admits
`manager` as well as `super_admin`. The very next line calls `elevated()`
(`app/(admin)/admin/tv/page.tsx:34`), and `elevated()` itself unconditionally
calls `requireRole("super_admin")` before it even checks the unlock grant
(`lib/console/gate.ts:161`). So a `manager` who is not `super_admin` is
redirected to `/dashboard` by `elevated()` on every visit, before ever seeing
the locked `Gate` screen. The page's declared boundary (manager and above)
is not the functional one (super_admin and above, plus a two-key unlock only
super_admin can grant via `submitKeys`, `app/(admin)/admin/tv/actions.ts:17`).

**Where.** `app/(admin)/admin/tv/page.tsx:31,34`, `lib/console/gate.ts:161-163`.

**Who is harmed.** Nobody today; the redundant check happens to fail closed.
The risk is forward-looking: a reader trusting the page's own `requireManager()`
line as documentation of who can reach Total View is misled, and anybody who
later "simplifies" `elevated()` by removing its inner `requireRole("super_admin")`
call, on the reasonable-looking assumption that the page guard already covers
it, would open the entire clinical surface in finding 1 to every manager,
silently, because verify:principals cannot see that module either.

**Severity.** major. A guard that says one thing and enforces another is
exactly the "check that passes by measuring the wrong thing" pattern this
codebase's own §6 family is about, now living in the newest, most sensitive
console page.

**Already known?** Not found in PLAN.md §2. C220 rules that Total View should
be "rebuilt as the operating picture of the company" but says nothing about
this guard mismatch. New finding.

---

## 3. Admin sets the initial password for clinic managers and sponsor users

**What.** `addManager` and `addPortalUser` let a `super_admin` type a raw
password into a form field, which is hashed and stored as that clinic
manager's or sponsor user's own login credential
(`app/(admin)/admin/clinics/actions.ts:48-77`, `lib/data/clinic-admin.ts:131-160`;
`app/(admin)/admin/sponsors/actions.ts:88-119`). Neither table
(`clinic_managers`, `sponsor_users`, `lib/db/schema.ts:5675-5698,6185-6204`) has
a "must change password" flag or any forced-rotation mechanism, so the admin
who created the account retains a working credential for that principal
indefinitely. This is not a hypothesis about what could go wrong: the
codebase's own reasoning against exactly this pattern is written down one
file over. `app/(admin)/admin/partners/actions.ts:9-30` explicitly refuses to
build the equivalent convenience for partner API keys, arguing "it would be a
working credential that existed in our hands, spoken aloud, before it existed
in theirs," and deliberately makes the partner mint their own key in their
own portal instead. That argument was not applied to the clinic or sponsor
password flow, which does the exact thing the partner file says is unsafe.

**Where.** `app/(admin)/admin/clinics/actions.ts:47-77`,
`lib/data/clinic-admin.ts:131-160`, `app/(admin)/admin/sponsors/actions.ts:86-119`,
contrasted with `app/(admin)/admin/partners/actions.ts:9-30`.

**Who is harmed.** Clinic managers and sponsor portal users. A clinic manager
sees patient names and appointment times for the whole practice (§3f); a
sponsor user sees the pot and the enrolled roster. An admin holding a working
credential for either can sign in as them, and every action taken that way is
attributed to the clinic manager's or sponsor user's own session, with no
distinguishing audit trail back to the admin. This is not the clinical
transcript impersonation INVARIANT 3 is written against, but it is the same
family of risk one level down the principal stack, and the codebase visibly
knows it for partners and did not apply the same reasoning here.

**Severity.** major.

**Already known?** Not found in PLAN.md §2 (searched C230, C259, C267, C233,
C237 for clinic/sponsor onboarding; none address credential custody). New
finding.

---

## 4. Role separation: staff can see the payout queue and the verification
   queue, and cannot act on either

**What.** PLAN.md §3d states plainly that staff's job is "the payout queue,
therapist ID verification, phone-change requests, patient support," and
sprint 20's own accept line is "a staff member can do every manual job in
this product without ever seeing a patient's account" (`PLAN.md:2078-2079`).
The pages are open to staff: `app/(admin)/admin/payouts/page.tsx:39` and
`app/(admin)/admin/verifications/page.tsx:54` both call `requireStaff()`. But
every action underneath both is `requireRole("super_admin")`:
`app/(admin)/admin/payouts/actions.ts:27,45,70,92,110` (takeOn, approve,
markSent, confirm, reject) and `app/(admin)/admin/actions.ts:371`
(`decideTherapistVerification`). A staff member who opens either queue and
clicks any button is bounced by `requireRole` to `/dashboard`, with no
explanation on screen. Of the four jobs §3d names for staff, only two
(phone-change actions, `app/(admin)/admin/numbers/actions.ts:21,33,44`, and
support-ticket actions, `app/(admin)/admin/support/actions.ts:28,52,64,79,97`)
are actually staff-executable end to end.

**Where.** `app/(admin)/admin/payouts/actions.ts:27,45,70,92,110`,
`app/(admin)/admin/actions.ts:371`, contrasted with
`app/(admin)/admin/payouts/page.tsx:39`, `app/(admin)/admin/verifications/page.tsx:54`.

**Who is harmed.** The staff role itself, functionally: it cannot do half its
named job. Operationally, either a `super_admin` has to personally process
every manual payout and every ID verification (which defeats the reason a
staff role exists), or these queues sit unworked by anyone who can see them.
`app/(admin)/admin/verifications/page.tsx:29-34` even carries a comment
noting the page guard used to be the real protection and was loosened for
staff viewing; the corresponding action was never loosened to match.

**Severity.** major. Not a data exposure; a verified break from the product's
own written accept criteria for sprint 20.

**Already known?** PLAN.md §2 has no C-number for this. The sprint 20 build
log (`PLAN.md:4182`) records a verifier that checked staff/manager pages for
clinical *reads*, which is a different property from staff being able to
*act*. This is genuinely new.

---

## 5. `verify:principals` cannot tell staff from manager from super_admin

**What.** The gate's own guard table collapses all three back-office roles
into one principal:

```
admin: ["requireRole", "requireStaff", "requireManager", "requireRoleApi"]
```

(`scripts/verify-principals.ts:52-59`), and `principalsOf`
(`scripts/verify-principals.ts:236-241`) returns the single string `"admin"`
whichever of those four functions a page calls. Every clinically-scoped
module that lists `"admin"` in its `who` array (`patients`, `sessions`,
`documents`, `journals`, and more, `scripts/verify-principals.ts:78-160`)
would be reported as correctly guarded whether the actual call site is
`requireRole("super_admin")` or `requireStaff()`. Attack 3 in my brief asked
me to find "a page or action guarded by `requireStaff` that should be
`requireRole('super_admin')`." I could not find a live instance among today's
admin pages (checked every `page.tsx` under `app/(admin)`; every one reaching
a clinical `lib/data/*` module uses `requireRole("super_admin")` directly,
listed in the grep below), but the gate that is supposed to make that
impossible cannot in fact make it impossible: this is the exact "same
observable as the guard" failure this repository names in C158 and repeats
against itself as a standing rule (`PLAN.md:4251`), now living inside the
newest gate.

**Where.** `scripts/verify-principals.ts:52-59,236-241`. Pages checked and
confirmed to use `requireRole("super_admin")` directly today:
`app/(admin)/admin/{page,audit,taxonomy,clinics,partners,sponsors,therapists,ratings,checkins,announce,content,radar,settings,strings,vault}/page.tsx`.

**Who is harmed.** Every patient and clinician, hypothetically: this is the
control that is supposed to catch a staff-reachable clinical module before
it ships, and it cannot distinguish the one guard that matters from the two
that should never reach clinical data.

**Severity.** major, as a gate defect (paired with finding 1, which shows the
same script also cannot see a whole directory of clinical reads).

**Already known?** C336 rules the general design ("one matrix... a function
with no entry FAILS THE BUILD") and C366 revises it to the module-scope
approach actually built. Neither ruling discusses collapsing staff, manager
and super_admin into one token. New finding.

---

## 6. The ledger escape hatch (`adjustLedger`)

Checked against the five specific questions in my brief.

| Question | Answer | Evidence |
|---|---|---|
| Genuinely super_admin only? | Yes | `app/(admin)/admin/actions.ts:581`, and the page itself `app/(admin)/admin/vault/page.tsx:27` |
| Can it post an unbalanced pair? | No | `journal()` sums every leg and throws `UnbalancedTransaction` on any nonzero delta (`lib/billing/ledger.ts:81-84`); `postAdjustment` always posts the balancing leg as `-amountCents` (`lib/billing/ledger.ts:559-564`), so a delta of zero is structural, not a convention |
| Reason required end to end? | Yes, but with a mismatch | Server: `postAdjustment` rejects `reason.trim().length < 5` (`lib/billing/ledger.ts:541`). Client: `ledger-adjust.tsx` disables the button below 8 characters (`components/admin/ledger-adjust.tsx:60-64`). Both enforce a minimum server side and client side, so this is not a bypass, but the two numbers disagree and a raw call to the action could post a 5-character reason the form itself would refuse |
| Can the amount overflow or be NaN? | NaN, no. Overflow, yes | `postAdjustment` checks `Number.isInteger(input.amountCents)` (`lib/billing/ledger.ts:542`), which rejects `NaN`. It does not check against Postgres's range for `amount_cents`, which is a plain `integer` column, int4, max 2,147,483,647 (`lib/db/schema.ts:2157`). A dollar amount above about $21.4 million passes every check in the action and the ledger function, then fails the `INSERT` with an unhandled Postgres out-of-range error, which nothing in `adjustLedger` or `LedgerAdjust`'s `onClick` catches |
| Audited with a uuid `resourceId`? | Yes | `resourceId: input.organizationId` (`app/(admin)/admin/actions.ts:594`), a real uuid from the `allOrganizations()` dropdown. Also, `lib/audit.ts:73-86` now routes any non-uuid `resourceId` into a separate `resourceKey` column rather than throwing, so HAZARDS H6 as literally described (a friendly string 500s the page) appears to be fixed at the `audit()` layer, not just avoided by callers being careful |

**What.** The one genuine gap: no upper bound on `amountCents` against the
column it is written to, so a mistyped amount (an extra zero, or a currency
unit mistake, dollars vs cents) crashes the action instead of showing an
error message.

**Where.** `lib/billing/ledger.ts:542-544` (the only bound check),
`lib/db/schema.ts:2157` (`integer("amount_cents")`).

**Who is harmed.** The operator, with a broken page instead of a clear
refusal. Not a data exposure.

**Severity.** minor. It is a crash-on-fat-finger, not an authorization or
integrity hole; the mechanisms that matter (role, balance, reason, audit) all
held.

**Already known?** C360 rules that the hatch needed a screen, which sprint 58
built. Neither C360 nor HAZARDS H6 mentions the integer overflow case. New,
minor finding.

---

## 7. Exports: `mailClinicianHistory` has no scope limit and no watermark

**What.** This console action (behind `requireElevated()`, i.e. super_admin
plus the two-key unlock) builds a CSV of one clinician's **entire caseload**
and emails it to any address the operator types, validated only by a shape
regex (`app/(admin)/admin/tv/actions.ts:88`). `buildClinicianHistory`
(`lib/console/history.ts:17-131`) includes, for every session the clinician
has ever run: the patient's full name, the patient's email, session price,
payment status, recording consent, and note/summary status. The function is
audited (`app/(admin)/admin/tv/actions.ts:107-114`) and the clinician is
notified (`:122-129`), which satisfies INVARIANT 7's two stated requirements.
What it does not have is any restriction on the destination address (no
domain allowlist, no requirement that it match an address already on file)
or any watermark inside the file itself identifying who pulled it and when,
unlike the rule PLAN.md is about to write for the much lower-privilege clinic
export in sprint 63: "every export is audited with the requesting user,
watermarked with their name and the timestamp" (C334, `PLAN.md:306`). This
admin surface carries names and emails for potentially hundreds of patients
in one file and has no equivalent standing rule at all.

**Where.** `app/(admin)/admin/tv/actions.ts:79-132`, `lib/console/history.ts:17-131`.

**Who is harmed.** Every patient in the clinician's caseload, in the
scenario where the address the operator types is wrong or the recipient is
not who they claim, which nothing here checks.

**Severity.** major, as a hypothesis: the mechanism is real and I read the
exact columns exported; whether the lack of a domain check or a watermark
is an accepted risk for a legal-disclosure path or an oversight is not
something I can determine from the code alone.

**Already known?** C334 rules watermarking and audit for clinic exports in
sprint 63. It does not mention this admin console export at all, which
today is the more sensitive of the two and has no equivalent ruling.

**INVARIANT 7 overall: I tried to find a send that skips the audit, skips the
notification, or is reachable by staff, and could not.** `requestPatientExport`
(`lib/data/export.ts:102`), `emailPatientRecordToPatient`
(`app/(admin)/admin/actions.ts:637`), and both `mailRecordToPerson` and
`mailClinicianHistory` (`app/(admin)/admin/tv/actions.ts`) are all reachable
only through `requireRole("super_admin")` or `requireElevated()` (which itself
requires super_admin), all call `audit()` or `auditPhi()`, and all notify the
owning clinician when they are not the one who pressed the button. The only
gap I found is the scope/watermark concern above, not a missing audit or a
staff-reachable path.

---

## 8. The settings rails

### 8a. A negative session price is silently discarded, and the form still says "Saved"

**What.** `saveSession` validates `feePercent`, `platformFee`, and checks
`Number.isFinite(min)` / `Number.isFinite(max)` but never checks that `min`
or `max` is non-negative (`app/(admin)/admin/settings/actions.ts:118-132`,
compare with `savePricing`, `saveCopilot`, `savePayouts` and `saveCountry` in
the same file, every one of which does check its numeric fields against
zero). `settingsProblem` only refuses when `maxPriceCents < minPriceCents`
(`lib/settings/defs.ts:708-710`), which is false for, say, min = -2000,
max = -1000 (max is not below min). The action then calls
`writeSettingsGroup`, which re-parses the value through `parseGroup`
(`lib/settings/index.ts:123`), whose `int()` helper for `minPriceCents` and
`maxPriceCents` silently falls back to the shipped default
(`lib/settings/defs.ts:540-541`, `min: 0`) rather than erroring, whenever the
value is out of range. The action never inspects the value `writeSettingsGroup`
returns, so it always reports `{ ok: "Saved." }`
(`app/(admin)/admin/settings/actions.ts:156`) regardless. **An admin who types
a negative minimum and maximum price sees a success message, and the figures
that actually get written to production are the hardcoded defaults ($5.00 /
$500.00, `lib/settings/defs.ts:312-313`), silently overwriting whatever was
configured before**, with no indication anything went wrong until somebody
reloads the page and notices the numbers changed.

**Where.** `app/(admin)/admin/settings/actions.ts:118-157`,
`lib/settings/defs.ts:536-541,707-710`, `lib/settings/index.ts:118-137`.

**Who is harmed.** Every patient and clinician priced by `platform_settings`,
if a real admin edit is silently reverted to stale defaults. Also the admin,
who is told a false "Saved."

**Severity.** major. This is the exact shape of C298 (a stale key list saves
defaults over a real edit, with a success toast) reproduced through a
different mechanism (an out-of-range fallback instead of a name mismatch),
in the same settings surface C298 was fixed in.

**Already known?** C298 rules the key-list version of this bug fixed. This is
a new instance of the same family, not a restatement: the code path and the
trigger (a negative number, not a renamed tier) are different.

### 8b. A country can be enabled with no rail

**What.** `saveCountry` writes `enabled: formData.get("enabled") === "on"`
with no cross-check against `hasNoRail` (`app/(admin)/admin/settings/actions.ts:240-292`).
`hasNoRail` itself (`lib/settings/defs.ts:785-787`) is read by nothing that
blocks radar placement or booking today; I confirmed this by reading every
caller and found only a display use. An admin can save a country today,
enabled, with an empty `collectionProvider` and empty `payoutMethods`, and
nothing in the save path refuses it.

**Where.** `app/(admin)/admin/settings/actions.ts:240-292`,
`lib/settings/defs.ts:785-787`.

**Who is harmed.** A clinician who signs up in that country, advertises on
radar, takes a booking, and then cannot be paid.

**Severity.** major, matching the existing ruling's severity.

**Already known? Yes: C357** (`PLAN.md:329`). "`hasNoRail` is a display, not
a gate, and that is true in production today... Ruling: a country with no
rail refuses radar placement and refuses booking... ruled, sprint 59." I
confirmed by reading the current code that the ruling has not been built yet
and the defect is exactly as described. Not new; the ruling is correct and
unbuilt.

### 8c. VAT ceiling: UI enforces 50%, the parser underneath allows 90%

**What.** `saveCountry` refuses a VAT percent outside 0-50
(`app/(admin)/admin/settings/actions.ts:250-252`), but `parseCountry`, the
function that re-parses whatever is read back from storage (and the only
thing standing between a stored value and every VAT calculation), bounds
`vatBps` to `{ min: 0, max: 9_000 }`, i.e. 0-90%
(`lib/settings/defs.ts:862`). The 50% ceiling exists only in the one admin
form; nothing enforces it at the storage or read layer.

**Where.** `app/(admin)/admin/settings/actions.ts:250-252`,
`lib/settings/defs.ts:862`.

**Who is harmed.** Nobody today, since the only write path is the form.
Latent risk: any other writer (a script, a future second admin surface)
inherits the 90% ceiling as the only real bound.

**Severity.** minor, hypothesis: I found no second writer today, so this is
a defense-in-depth gap rather than a live defect.

**Already known?** Not found in PLAN.md §2.

### 8d. Rails I tried to break and could not

I constructed and traced: a tier table with no free door (refused,
`lib/settings/defs.ts:722-724`, C289's fix); a tier with both a monthly price
and a credit threshold (refused, `:732-735`); a platform fee of zero
(refused, `:742-744`); a price cap below the floor via positive numbers
(refused, `:708-710`); negative pricing tier figures via `savePricing`
(refused at the action, `app/(admin)/admin/settings/actions.ts:66-72`);
negative copilot allowances (refused, `:171-173`); a negative payout
threshold or an EGP spread above 10% (refused, `:209-217`). All of these
held.

---

## 9. Audit log completeness

I picked five destructive or sensitive admin actions and checked each for an
audit row carrying actor, resource and reason.

| Action | Audited? | Where |
|---|---|---|
| `suspendUser` | Yes | `app/(admin)/admin/actions.ts:48-54` |
| `adjustLedger` | Yes | `app/(admin)/admin/actions.ts:589-596` |
| `decideTherapistVerification` | Yes | `app/(admin)/admin/actions.ts:389-395` |
| `approveChange` (phone number) | Yes | `lib/data/phone-change.ts:228-237` |
| `refuseChange` (phone number) | **No** | see below |

**What.** `refuseChange` (`lib/data/phone-change.ts:353-368`) updates
`phoneChangeRequests` to `status: "refused"` with the reason the patient will
read, but never calls `audit()`, and the `phoneChangeRequests` table has no
`refusedByUserId` column at all (`lib/db/schema.ts:4540-4590`, compare
`approvedByUserId` at `:4558`, which does exist). The action that calls it,
`app/(admin)/admin/numbers/actions.ts:43-53`, accepts `actorUserId` from the
authenticated staff member and passes it into `refuseChange`, but
`refuseChange`'s own signature never uses that field anywhere: it is not
written to the row and not passed to `audit()`. **There is no record anywhere
in this product of which staff member refused a given phone-number change
request.** PLAN.md 20.17 states the record should be "old number, new number,
reason, approver, time, and the verification itself"; for a refusal, "who
refused it" is the direct analogue of "approver" and it does not exist.

**Where.** `lib/data/phone-change.ts:353-368` (no audit call, `actorUserId`
accepted and discarded), `lib/db/schema.ts:4540-4590` (no such column).

**Who is harmed.** The patient whose request was refused, who cannot know or
later contest who made that call, and the product's own accountability claim
for a "manual money and identity process," which PLAN.md treats as load
bearing everywhere else (payouts, verification) but misses here.

**Severity.** major. This is the identity-change queue, the one PLAN.md
itself calls "the most dangerous thing a patient can ask for" (`PLAN.md:856-857`).

**Already known?** Not found in PLAN.md §2. Sprint 20's build log
(`PLAN.md:4182`) claims "20.16's hash, so a staff member reading the table
cannot finish the change they approved" as a proven property, but says
nothing about refusal attribution. New finding.

A second, smaller gap in the same file: `sendChangeCode`
(`lib/data/phone-change.ts:249-289`) also never calls `audit()`, only
`log.info` (`:287`), which is not the same durable, actor-attributed record
the rest of this flow relies on. Minor, informational rather than
destructive.

---

## 10. What the new gates would miss (attack on `verify-reachable` / `verify-principals`)

Both scripts work by regex and substring matching over raw file text
(`scripts/_surfaces.ts`), not by resolving the TypeScript module graph or
executing anything. Four concrete blind spots, each traced to the exact
mechanism:

1. **A comment mentioning a name is indistinguishable from a call to it.**
   `unwiredActions` (`scripts/_surfaces.ts:163-175`) considers an action
   "wired" the moment its bare name matches `\b${name}\b` in any file that
   reaches a page, full stop; it does not check that the match is a function
   call. `components/admin/ledger-adjust.tsx`'s own docstring names
   `adjustLedger` five times in prose before the file ever imports and calls
   it (`:10-40`), which happens to be true either way here, but the mechanism
   means a genuinely orphaned action mentioned only in a comment or a
   `// TODO: wire X up` note in a page-reaching file would read as reachable.

2. **`unwiredActions` cannot see a call from inside its own action's file.**
   The caller search explicitly excludes `action.file` itself
   (`scripts/_surfaces.ts:168`, `f !== action.file`). Two actions defined in
   the same `"use server"` module, where one calls the other as a plain
   function, are invisible to each other in this check: the gate would never
   see action B call action A inside the same file. This matters because A
   remains independently invocable as its own server-action RPC endpoint
   (Next.js exposes every exported async function of a `"use server"` file
   this way) whether or not B ever calls it. If A's own guard is weaker than
   what B checks before calling it, a raw request to A bypasses B entirely,
   and `verify:reachable` gives no signal either way, because it only asks
   whether the name is textually present somewhere reachable, never whether
   the function's own guard is the intended one.

3. **`verify:principals` proves "a declared principal reached this," never
   "the correct principal reached this."** Combines with findings 4 and 5:
   the matrix can only fail when an UNDECLARED principal reaches a module.
   A module whose `who` list is simply too generous (lists `"admin"` when it
   should list nothing, or lists a wider set than the spec intends) will
   pass forever, because nothing checks the declared list against the spec,
   only actual reads against the declared list.

4. **The scan is scoped to one directory (finding 1).** Any clinical read
   that goes through a file outside `lib/data/` is invisible to
   `verify:principals` by construction of its own prefix check, regardless
   of how sensitive the data is.

None of these four is a hypothetical shape borrowed from another codebase.
Each is the literal behavior of the code at the cited line, and finding 1
shows the fourth one is already true of a live, shipped admin page.

---

## What I could not verify

- Whether the lack of a domain restriction on `mailClinicianHistory`'s
  recipient address (finding 7) is a deliberate design for a legal-disclosure
  workflow or an oversight. I read the code and the comments; neither states
  an intended threat model for this specific field.
- Whether `saveSession`'s silent-default behavior (finding 8a) has already
  happened in production, i.e. whether the current stored `minPriceCents`/
  `maxPriceCents` differ from an admin's last intended edit. I did not query
  the database, per the rules of this audit.
- Whether any script outside `app/(admin)` (for example `scripts/settings.ts`,
  which I did not run) writes a country's VAT rate above 50% and would
  therefore exercise the 90% ceiling in finding 8c live. I read only the
  admin console's own write path.
- Whether `requireElevated()`'s two-key grant (`lib/console/gate.ts`) has
  ever been used against a manager account in a way that would have surfaced
  finding 2 in practice. I read the code path, not any log or database row.
- I did not check `lib/observability/errors.ts` or the taxonomy/support
  modules beyond the specific functions cited above; both `/admin/errors`
  and `/admin/usage` are correctly `requireRole("super_admin")`-gated and I
  found nothing else notable in the time available, but I did not read every
  function in either file line by line.
