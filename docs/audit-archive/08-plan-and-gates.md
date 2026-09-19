# Audit 08: the plan and the gates

Beat: the four verification scripts that everything else trusts, and sprints
58 to 64 of PLAN.md. I ran all four commands myself. I did not touch the
database and I did not write code.

```
npm run verify:reachable   -> PASS, 13/13
npm run verify:principals  -> PASS, 12/12
npm run verify:claims      -> PASS, 16/16
npm run typecheck          -> clean, no errors
```

All four claims in the brief are true as far as they go: the checks exist,
they run without a database, and they currently pass. The question this file
answers is narrower and worse: would each one catch the specific defect it
was written to catch, and does its own control prove that.

---

## PART ONE: THE GATES

### 1. `verify:reachable` / `scripts/_surfaces.ts`

**Finding A: an uncalled route can hide behind a sibling that shares its
truncated path.**

`routePath()` (`scripts/_surfaces.ts:180-185`) turns a route file into a path
by cutting at the first dynamic segment. `app/api/documents/[id]/route.ts`
and `app/api/documents/[id]/speak/route.ts` both truncate to the identical
string `/api/documents`. `uncalledRoutes()` (`scripts/_surfaces.ts:199-221`)
then asks only whether that string appears anywhere as an unanchored
substring in some other file, via `.body.get(f)!.includes(path)`. This is
not a hypothetical: `components/documents/document-list.tsx:131` calls
`` `/api/documents/${document.id}/speak` `` and `components/documents/document-list.tsx:261`
calls `` `/api/documents/${document.id}` ``. Both template literals contain
the substring `/api/documents`, so both route files are marked "called" by
the same evidence. If the base route (`[id]/route.ts`) lost its only real
caller tomorrow, this check could not tell, because the `/speak` sibling's
own genuine caller keeps the shared string present. The same collision
exists for `app/api/uploads/[id]/route.ts` and
`app/api/uploads/[...path]/route.ts`, which both truncate to `/api/uploads`.
Compare `unlinkedPages()` a few lines below, which anchors its match on a
following quote, slash or `${` for exactly this reason; `uncalledRoutes()`
never got the same anchor.

| Field | Detail |
|---|---|
| What | `uncalledRoutes()` cannot distinguish two routes whose paths truncate to the same stem at the first dynamic segment, because its match is an unanchored substring rather than an anchored one |
| Where | `scripts/_surfaces.ts:180-185` (truncation), `scripts/_surfaces.ts:199-221` (unanchored match), demonstrated live at `components/documents/document-list.tsx:131` and `:261` |
| Who is harmed | Nobody today; both routes currently have real callers. The harm is to whoever relies on 58.2 to catch a route that goes dead later, in this pair or the `/api/uploads` pair, or in any future route that shares a stem with a sibling |
| Severity | major |
| Already known? | Not a specific PLAN.md concern. Same family as C362-C365 (the gate's own recorded history of measuring the wrong thing), but this exact defect is not one of them and is genuinely new |

**Finding B: 58.5's own acceptance criterion asks for three planted
offenders; the script has one.**

PLAN.md's own sprint text is explicit: "58.5 CONTROL: a planted orphan
action, a planted orphan route and a planted orphan page are each CAUGHT.
Three absences in a row pass just as happily against a scanner that reads
nothing." (`PLAN.md:3820-3822`). Reading `scripts/verify-reachable.ts:152-205`,
the CONTROL section builds exactly one planted file, `lib/_verify58-control.ts`,
and exercises it only through `serverActions()` / `unwiredActions()`. There is
no planted orphan route and no planted orphan page anywhere in the file. The
58.2 (routes) and 58.3 (pages) absence checks are therefore proved by nothing
but themselves: if `uncalledRoutes()` or `unlinkedPages()` were silently
broken so that they matched nothing at all, both checks would report "0
uncalled routes" / "0 unlinked pages" and pass exactly as cleanly as they do
now. This is the house lesson from the brief, applied to the gate itself:
"An absence proves nothing without a control." Sprint 58's own summary calls
this **BUILT AND GREEN**; it is green against an acceptance criterion the
build did not fully meet.

| Field | Detail |
|---|---|
| What | The script has a planted-offender control for the action check (58.1) but none for the route check (58.2) or the page check (58.3), though the sprint's own acceptance text (58.5) requires all three |
| Where | `scripts/verify-reachable.ts:152-205` (the only CONTROL section); `PLAN.md:3820-3822` (the acceptance text that names three) |
| Who is harmed | Whoever ships on the strength of "13/13 passing." The 58.2 and 58.3 results are unverified claims wearing the same green checkmark as the verified ones |
| Severity | blocker. This is foundational trust infrastructure that does not meet its own written specification, and Finding A shows the untested half already has a real gap in it |
| Already known? | Genuinely new. Not a PLAN.md C-number; it is a gap between the sprint's acceptance text and what was actually built |

**Finding C: `unwiredActions()` proves a call by text search, not by a call
site.**

`scripts/_surfaces.ts:163-175`: an action is "wired" the moment its name
matches `\bname\b` anywhere in a file that reaches a page, including a
comment, a JSDoc reference, an unrelated identifier, or a string. I could not
find a live instance of this being exploited in the current codebase, so I
am marking this a hypothesis with a proven mechanism rather than a live
finding: a genuinely orphaned action named, say, `sendWelcomeEmail`, with a
comment reading `// TODO: call sendWelcomeEmail from the onboarding page` in
a file that reaches a page, would be reported wired. The check that exists
for `subscribeTo` (a real call site) does not distinguish itself from this
case, because nothing in the function looks for a call expression.

| Field | Detail |
|---|---|
| What | The wiring check matches the action's name as text anywhere in a reachable file, not as a call site, so a comment or unrelated mention would satisfy it |
| Where | `scripts/_surfaces.ts:163-175` |
| Who is harmed | Hypothesis, mechanism proven by reading the code; no live instance found. If exploited, harm mirrors C358 (a patient who cannot reach a real action because the gate believes it wired) |
| Severity | minor, given no live instance |
| Already known? | Same family as C362-C365, not itself ruled on |

### 2. `verify:principals` / `scripts/verify-principals.ts`

**Finding D: the forward graph is blind to dynamic `import()`, which is the
dominant way this codebase reaches `lib/data/*`.**

`buildForwardGraph()` (`scripts/verify-principals.ts:254-303`) resolves
imports with one regex: `/(^|\n)\s*import(\s+type)?[^;]*?from\s+["']@\/([^"']+)["']/g`
(line 278). This anchors on `import` occurring right after a line start,
which only matches static `import ... from "@/..."` statements. It does not,
and cannot, match `const { x } = await import("@/lib/data/y")`, because the
token `import` there is preceded by `await ` on the same line, never at the
start of one. I grepped the whole tree for this exact pattern and found it
is not a rare style. It is the primary way this codebase lazy-loads
`lib/data/*`:

```
app/api/cron/[job]/route.ts:136   await import("@/lib/data/feedback")
app/api/cron/[job]/route.ts:159   await import("@/lib/data/sessions")
app/api/cron/[job]/route.ts:218   await import("@/lib/data/enrolment-verify")
app/api/cron/[job]/route.ts:498   await import("@/lib/data/scheduling")
app/api/cron/[job]/route.ts:532   await import("@/lib/data/documents")
app/(app)/sessions/actions.ts:166 await import("@/lib/data/session-sources")
app/(patient)/patient/claim/actions.ts:195 await import("@/lib/data/claims")
lib/data/export.ts:476-479        import("@/lib/data/summaries").then(...), three more
```
and roughly sixty more call sites across `lib/data`, `lib/ai`, `app/(app)`,
`app/(patient)`, `app/(admin)`. Every one of these is an edge into a
`clinical: true` module (sessions, feedback, claims, documents, summaries,
diagnoses, journals, session-risk...) that `modulesFrom()` never sees,
because the regex that builds `importsOf` never matches the line it is on.
`app/api/cron/[job]/route.ts` is a genuine `entryPoints()` member (a
`route.tsx?` file, not an action, so the graph does not stop at its edge on
purpose), and five of its clinical reads are wired this way. Today that
route is exempted from the "unguarded" branch by `cronSecret` capability
auth, so this specific file does not currently surface a false clean. But
the mechanism generalizes to any future entry point, and sprint 63 is
explicitly the sprint whose whole purpose is to add a new, narrower
principal (clinic staff) and prove it cannot reach clinical data "by the
58.6 matrix, not by a comment" (PLAN.md 63.11). If that page is written the
way this codebase already writes nearly every other clinical read, with
`await import("@/lib/data/sessions")` rather than a static import, the
matrix will not see the edge at all, and 58.6 will report the entry
unguarded-but-clean or simply invisible rather than a breach.

| Field | Detail |
|---|---|
| What | The principal-scoping forward graph only follows static `import ... from` statements and is structurally blind to dynamic `await import(...)`, which is the codebase's own dominant pattern for reaching `lib/data/*` |
| Where | `scripts/verify-principals.ts:278` (the regex), demonstrated against ~70 real call sites including `app/api/cron/[job]/route.ts:136,159,218,498,532` |
| Who is harmed | A patient, if a future entry point (most plausibly the sprint 63 clinic-staff portal) reaches a clinical module this way: the check would not flag the breach at all, silently |
| Severity | blocker |
| Already known? | This is the concrete answer to PLAN.md's own C366 question, addressed in Part Two below: the module-scope check that replaced the 415-by-7 matrix is weaker than the matrix in exactly this way |

**Finding E: the guard-detection and capability-auth checks are also plain
text search, over the whole file, not tied to an actual call.**

`guardsIn()` (`scripts/verify-principals.ts:226-228`) matches
`\bguardName\s*\(` anywhere in the source. `hasCapabilityAuth()`
(`scripts/verify-principals.ts:231-233`) matches a bare `\bname\b` with no
`(` requirement at all. Neither distinguishes a real call from a comment,
dead code, or an unrelated local variable. This is the mechanism that
decides whether an entry point counts as authenticated at all before the
breach loop even runs (`scripts/verify-principals.ts:350-375`). A page whose
only mention of `requireRole(` is inside a commented-out block, or whose
only mention of `cronSecret` is a stray import alias, would be treated as
guarded by that principal, or exempted as capability-authenticated, with
zero actual enforcement. I found no live instance of this being exploited;
it is a structural property of the detection method, provable by reading
the two functions, not by a planted file (the brief bans writing code).

| Field | Detail |
|---|---|
| What | Guard and capability-auth detection is unscoped text search over the entire file body, so a comment mentioning a guard name would satisfy the check with no real authentication behind it |
| Where | `scripts/verify-principals.ts:226-233`, feeding `principalsOf()` at lines 236-241 and the breach loop at 350-375 |
| Who is harmed | Hypothesis, mechanism proven by reading the code. If exploited, a patient's clinical data reached by a page that only appears guarded |
| Severity | major |
| Already known? | Not a specific concern. Adjacent to C365 (capability auth modelled at all), but this is a different gap: capability auth is modelled correctly in shape, the match itself just is not tied to a real call |

**Finding F: the one "breach" control does not exercise the breach-detection
code at all.**

`scripts/verify-principals.ts:453-458`:
```
const wouldBreach = !["patient"].some((p) => SCOPE["copilot"]!.who.includes(p));
check("...the rule WOULD refuse a patient reaching the clinician copilot", wouldBreach, ...);
```
This reads the `SCOPE` configuration table directly and asks whether
"patient" is absent from `copilot`'s allow-list, the same table the real
check reads from. It never constructs an entry point, never calls
`principalsOf()`, `modulesFrom()`, or pushes into the actual `breaches` array
(lines 372-373). If the real breach loop had an inverted condition, say
`allowed = !who.some(...)`, or if `breaches.push` were deleted entirely,
this control would still report PASS, because it never runs that code. It
proves the data in `SCOPE` is shaped a certain way, which nobody disputes; it
does not prove the enforcement logic that reads `SCOPE` actually enforces
anything.

| Field | Detail |
|---|---|
| What | The only control asserting that a bad-principal breach WOULD be caught checks a static fact about the `SCOPE` table, not the actual breach-detection loop, and would pass unchanged against a broken loop |
| Where | `scripts/verify-principals.ts:453-458` |
| Who is harmed | Whoever trusts 58.6's 12/12 as proof the breach loop works. It is proof the config table is shaped correctly, a different and much weaker claim |
| Severity | major |
| Already known? | Genuinely new |

**Finding G: no staleness check for the one exemption list this file owns.**

`knownUnguarded` (`scripts/verify-principals.ts:391-396`) is currently
empty, with a comment explaining what a future entry would mean. Unlike
`verify-reachable.ts`'s 58.4 (`ACTIONS_BY_DESIGN` / `ROUTES_BY_DESIGN` /
`PAGES_BY_DESIGN`, each checked for staleness), there is no equivalent
mechanism here that would fail if an entry in `knownUnguarded` stopped being
necessary. Currently harmless because the set is empty; the house lesson
that a stale exemption "reads as coverage" applies the moment the first
entry is added, and nothing in this file would catch it going stale.

| Field | Detail |
|---|---|
| What | `knownUnguarded` has no staleness check, unlike every other allowlist in this repository's reachability family |
| Where | `scripts/verify-principals.ts:391-396` |
| Who is harmed | Nobody today (the set is empty). Whoever adds the first entry inherits a gate with no memory of whether it still earns its place |
| Severity | minor |
| Already known? | Genuinely new |

### 3. `verify:claims`

**Finding H: the response-time and performance word lists can be evaded by
plain paraphrase.**

`A_DURATION` (`scripts/verify-claims.ts:72-79`) only fires on "in/within/
under/next N seconds/minutes/hours", "minutes rather than", or "right away"
(plus two Arabic equivalents). "Our therapists typically reply the same
day", "get matched instantly", "immediate support", "a clinician is on hand
right now" and "quick response" all promise the same thing invariant 14
forbids and none would match. `ABSOLUTE` (line 122-123) and `PERFORMANCE`
(line 134-135) are similarly fixed word lists: "nothing gets past our
detector", "our clinicians are infallible", "a flawless record" and
"bulletproof accuracy" carry no word from either list and would pass. I
checked the current live copy through the harness and it is clean today
(all 16 checks pass); this is a gap in the instrument's coverage, not a live
defect on the site.

**Finding I: the 40-character proximity window can be defeated by inserting
filler.**

`NEAR = 40` (`scripts/verify-claims.ts:102`) requires an absolute word and a
performance word within 40 characters of each other. A sentence like "Our
detector, built and audited over three careful years by clinicians who take
this seriously, never misses a risk signal" separates "never" and "misses"
by well over 40 characters and would not be flagged, while saying exactly
the same false thing the planted control (`PLANTED_ABSOLUTE`) is built to
catch.

| Field | Detail |
|---|---|
| What | Both banned-sentence detectors are closed word lists with a fixed proximity window, so a paraphrase using a synonym, or the same words spaced further apart, evades detection entirely |
| Where | `scripts/verify-claims.ts:69-79` (duration list), `:102` (NEAR window), `:122-123` (absolute list), `:134-135` (performance list) |
| Who is harmed | Hypothesis, verified clean today by running the tool. If a future marketing edit uses any of the phrasings above, a patient in distress reads an unkept promise and no gate stops it before publish |
| Severity | major |
| Already known? | Not a specific concern; this is the same shape of gap sprint 57 itself was created to close (a gate that counts the wrong thing), applied recursively to the gate sprint 57 built |

### 4. `scripts/_reachability.ts` (tables to screens)

I looked for the fourth candidate the brief names, a table reached only
through a raw `sql\`\`` query. `_reachability.ts:87` matches
`\b${ident}\b` where `ident` is the Drizzle export name (camelCase, e.g.
`sessionRisk`), never the underlying snake_case table name a raw SQL string
would use (`session_risk`). A holder file that reads a table exclusively via
`sql\`select * from session_risk\`` and never imports the Drizzle
identifier would not be recognised as a holder at all, and the table would
be reported an orphan even if a real screen reads it this way. I found two
files using raw `sql\`` outside `lib/data` (`app/(patient)/patient/billing/page.tsx`,
`app/join/[token]/actions.ts`), but could not confirm within this audit's
time budget whether either one reads a table by name this way rather than
via a bound Drizzle query; I am marking the mechanism a hypothesis, not a
finding, because I did not verify a live case.

| Field | Detail |
|---|---|
| What | The table-to-screen scanner matches the Drizzle TypeScript identifier, never the underlying SQL table name, so a raw `sql`` query naming a table by its snake_case name would be invisible to it in both directions (false orphan, or a genuinely unreachable table hidden behind an unrelated identifier match) |
| Where | `scripts/_reachability.ts:87` |
| Who is harmed | I could not determine; marking this a hypothesis with the mechanism shown, not a confirmed finding |
| Severity | minor, pending confirmation |
| Already known? | Genuinely new, not investigated by C179 or the sprint 51 rewrite that produced this file |

---

## PART TWO: THE PLAN, SPRINTS 58-64

### The eight rulings

| Concern | Verdict | Reason |
|---|---|---|
| C311 (coverage frozen at booking, never re-read) | INCOMPLETE | The ruling's own text says "never re-read." C344, ruled in the same sprint, says an increase MAY apply to unstarted bookings. Those two sentences contradict each other read in isolation. C311 needs to say "frozen, except that C344 permits a later increase to apply" or an engineer implementing C311 alone builds a stricter freeze than C344 requires |
| C312 (VAT on the patient's share only) | WRONG for the cross-entity case | `lib/billing/pot.ts:193-203` reasons that pot money bears zero VAT because "the taxable supply was the top-up." That is only true where the top-up was itself a VAT event. This product has a US entity and (per sprint 64) an Egyptian one, and the US has no VAT. A US-entity sponsor's top-up is not a taxable supply anywhere; nothing is "already taxed" when C312 says it is. If that sponsor's pot then pays part of a session for a patient in a VAT country, the patient's share is taxed (correctly) and the sponsor's share is taxed nowhere at all, a real leak of VAT revenue that C312's stated reasoning does not survive |
| C313 (therapist paid full price, whatever the split) | RIGHT | Sound reasoning against a discrimination mechanism, and the arithmetic (85% of gross regardless of who funded it) is internally consistent with C312 and C314 as written |
| C314 (no destination charge on a partial split) | INCOMPLETE, cost understated | `lib/billing/connect.ts:402-427` records that `capture: "platform"` (holding a patient's money and paying it out later) was deliberately closed because it is money transmission requiring roughly 48 US state licences with bonds from $50k, plus Central Bank licensing in Egypt and the UAE, and the fallback that used it applied automatically to exactly the newest, least-equipped clinicians. C314 reopens the identical mechanism, `capture: "platform"` plus `releaseHeldEarnings`, this time deliberately and for every partially sponsored session rather than as an onboarding gap. Its own "what it costs" line names only operational cost ("more money we hold and more payout queue"); it does not re-examine whether the licensing exposure 1.8 shut down is now reopened at much greater and permanent volume. This needs an explicit legal answer, not an operational one, before sprint 60 ships |
| C323 (retroactive, not marginal, seat pricing) | INCOMPLETE | The arithmetic for 2, 3, 4 and 5 seats checks out exactly as PLAN.md 4024-4031 states ($179, $270, $360, $400), and the +$91 jump from 2 to 3 is real and correctly flagged. But the table gives the 1-2 band as a flat "included" price, not a per-seat rate, while the 3-4 and 5+ bands are stated as literal per-seat rates. Nothing in the plan says explicitly whether 1 seat also costs $179 (the same as 2) or something else; a naive implementation deriving a per-seat number from "179 / 2 seats" for the first band would charge a solo therapist $89.50 instead of $179, undercharging by half. 20 seats extrapolates cleanly to $1,600 at the stated $80/seat rate, with no further volume tier defined for a large clinic, which is a real gap worth naming even if not a bug |
| C324 (clinic staff never a `users` row) | RIGHT | The reasoning (staff/manager in ROLES is our own back office, one mistake from a clinical grant) is sound and the seventh-principal design mirrors the existing sponsor/partner pattern, which the codebase already knows how to build correctly |
| C352 (two principals, cookie names which is active) | INCOMPLETE | The ruling never says how the cookie's claim is verified server-side. "The cookie names which is active" is the entire mechanism standing between a clinician session and a clinic-management session, which is the exact leak C324 and C352 exist to prevent. If the cookie is a plain client-readable value rather than one checked against an authoritative, signed, server-held session record, a tampered cookie could claim the wrong active principal. The ruling needs to specify that the active-principal claim is authenticated server-side against the linked principal rows, not merely read off the cookie |
| C366 (module-scope check replaces the 415-by-7 matrix) | The replacement is measurably weaker | Part One, Findings D, E and F above are the direct answer. The forward graph is blind to `await import(...)`, which is this codebase's own dominant pattern for reaching `lib/data/*`; guard and capability-auth detection is unscoped text search rather than call-site detection; and the one control meant to prove a breach would be caught never runs the breach-detection code at all. The 415-by-7 matrix would have been unmaintainable, which C366 correctly diagnoses, but its replacement has not yet earned the trust sprint 63 is about to place in it: "proved by the 58.6 matrix, not by a comment" (PLAN.md 63.11) is not true against a page written with a dynamic import, which is exactly how this codebase already writes nearly every other clinical read |

### What is missing from the plan entirely

| Missing | Why it matters given sprints 59-64 specifically |
|---|---|
| Tax reporting on payouts | I searched PLAN.md for 1099, W-9, W-8 and "tax report" and found nothing. Sprint 59 builds multi-currency, multi-entity payouts (US and Egyptian); sprint 62 adds seat billing; sprint 64 adds a whole second payout rail. None of it mentions US 1099-NEC contractor reporting, W-9 collection, or the Egyptian equivalent for the entity paying Egyptian therapists. This is a compliance obligation that grows in scope with every one of these sprints and is named nowhere |
| Disaster recovery, backup policy | No RPO, RTO, or backup policy appears anywhere in PLAN.md. HAZARDS.md H10 mentions Neon's paid point-in-time-restore feature only as a cost to avoid during a bulk load, not as part of a recovery plan. A clinical documentation platform holding notes, transcripts and risk assessments across two jurisdictions has no stated answer to "the database is gone, now what" |
| Data protection regulator, as distinct from a money regulator | PLAN.md §3c reasons carefully about which cross-border payment flows a financial regulator would look at first (PLAN.md around line 603) and tells the team to take that to counsel before sprint 16. No equivalent paragraph exists for a health-data regulator: cross-border transfer of an Egyptian patient's clinical data to US-hosted infrastructure (Neon, OpenAI), breach notification obligations, or a data processing agreement with a sponsor who is contractually promised they will never see clinical content. For a clinical platform, a health-data authority is at least as likely as a financial one to be the first regulator to ask a question, and the plan's regulator-first instinct was never pointed at it |
| What happens to a patient's continuity of care when a sponsor's enrolment is removed, not merely lowered | C345 (0% coverage) covers the money going to zero while the roster keeps the person. It does not cover `enrolments.removedAt` being set entirely, the scenario where the employment relationship itself ends. Sprint 61 builds re-verification and pause mechanics for the FUNDING side; nothing in sprints 59-61 states what a patient is told about their existing therapist relationship, in-progress treatment, or their own session history when the sponsor relationship, not just the percentage, ends |
| Accessibility as a named requirement, rather than an incidental per-component assertion | Individual components (the orb, the SOS button) have had their accessible names tested in past sprints, but no WCAG level or accessibility requirement is named anywhere in PLAN.md as a standing rule. Sprint 62's seat slider, sprint 60's coverage-percentage stepper, and sprint 63's role-capability manager are all new interactive controls with acceptance criteria that never mention keyboard operability, contrast, or screen-reader labelling |
| A named rate limit on the new sprint 60 coverage-change and sprint 62 seat-change endpoints | Rate limiting is applied ad hoc elsewhere in the plan (C265 on employment verification, C246 on enrolment codes) and seat removal is discouraged economically rather than rate-limited (62.5, "never refunded, or a clinic cycles seats weekly"). Whether that economic disincentive is sufficient against an automated actor cycling coverage percentage or seat count to probe pricing or billing edges is not examined |

I looked specifically for a therapist's death and did NOT find it missing:
C272 already rules on a dormant caseload and is a reasonable answer. What
sprints 62-63 do not address is whether that same mechanism covers a
clinic-employed therapist or a clinic admin, where ownership of a seat and
of earnings adds a second party's interest to the dormancy question; that is
a narrower gap than the topic itself being absent.

---

## PART THREE: THE DOCUMENTATION

**Finding J: README.md describes a second payment rail that does not exist
in the code.**

`README.md:88`: "Two entities, two rails: USD through Stripe, EGP through a
local provider." Read as a present-tense description of the stack, this is
not true. `lib/settings/defs.ts:811` sets `collectionProvider: "paymob"` for
Egypt, but "paymob" appears exactly twice in the entire repository
(`lib/settings/defs.ts:344` and `:811`), both as a plain string label in a
settings row, never as an API client, an adapter, or a call site. The only
payment-collection code that actually creates a charge,
`lib/billing/connect.ts`, is Stripe end to end; its own comment at line 30
notes "not routed yet: this call site has no entity in hand." PLAN.md's own
sprint 64, titled "The Egyptian rail," is marked `BLOCKED ON PAPERWORK` and
states plainly that it "needs a licensed Egyptian entity, a merchant account
and a signed gateway contract" that do not yet exist (`PLAN.md:4111-4114`).
Today there is one working collection rail. README.md states two as current
fact.

| Field | Detail |
|---|---|
| What | README.md's stack description states a second, EGP payment collection rail exists today; no such integration exists anywhere in the code, and PLAN.md's own sprint 64 confirms it is unbuilt and blocked on an unsigned contract |
| Where | `README.md:88`; contradicted by `lib/settings/defs.ts:811` (label only), `lib/billing/connect.ts:30` (comment admitting it), and `PLAN.md:4111-4114` (sprint 64 status) |
| Who is harmed | A new contributor reading README.md before their first commit, who would reasonably assume the second rail exists and build against it, or a founder relaying this description outward |
| Severity | major |
| Already known? | Not a PLAN.md concern; a README accuracy gap the plan itself contradicts |

**Finding K: the scheduled-jobs table in README.md lists three jobs; five
exist.**

`README.md:207-214` names `/api/cron/crisis`, `/api/cron/billing` and
`/api/cron/retention`. `vercel.json` schedules five: those three, plus
`/api/cron/extract` and `/api/cron/reminders`. Both of the missing ones are
real, implemented handlers, not placeholders: `app/api/cron/[job]/route.ts:409`
defines `async reminders()` and `:531` defines `async extract()`, the latter
calling `extractPending()` from `lib/data/documents`.

| Field | Detail |
|---|---|
| What | README.md's scheduled-jobs table omits two of the five cron jobs actually configured and implemented |
| Where | `README.md:207-214`, versus `vercel.json` (five entries) and `app/api/cron/[job]/route.ts:409` (`reminders`), `:531` (`extract`) |
| Who is harmed | Anyone using README.md to understand what runs on a schedule, for example while reasoning about the retention job's scope or debugging a missed reminder |
| Severity | minor |
| Already known? | Genuinely new |

---

## What I could not verify

- Whether the substring collision in Finding A currently masks a real dead
  route anywhere beyond the two pairs I found (`/api/documents`,
  `/api/uploads`). I checked those two because they were visible from the
  route listing; I did not exhaustively check every route pair for a shared
  truncated stem.
- Whether the dynamic-import blind spot in Finding D has already produced a
  live principal breach in the code as it stands today. I confirmed the
  mechanism and the volume of call sites; I did not trace every one back to
  its entry point's declared principal, which would be needed to say a
  specific breach exists now rather than that one could be introduced
  unnoticed.
- Whether the raw-`sql`` blind spot in `_reachability.ts` (item 4, Part One)
  is live anywhere. I found two files using raw `sql`` outside `lib/data`
  but did not determine whether either reads a table this way.
- Whether C312's VAT gap (Part Two) is already realized in any built code:
  sprint 60 is not built yet, so I checked the ruling's stated reasoning
  against `pot.ts`'s current single-rate (100% coverage) logic, not against
  a partial-coverage implementation that does not exist to read.
- Whether C352's cookie-integrity gap is answered somewhere sprint 63's
  detailed design has not yet been written down; PLAN.md's ruling text is
  what I audited, and sprint 63 itself is not built.
- I did not read PLAN.md end to end. I read §2's rows for C303 to C366,
  §3e, §6 where cited by those rows, sprints 58 to 64 in full, and the
  specific ruling context needed for each item in this file. A defect
  sitting in an untouched section of the other 4,300 lines would not appear
  here.
