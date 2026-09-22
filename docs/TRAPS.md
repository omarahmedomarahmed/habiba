# Traps

Every one of these was walked into more than once. That is the reason this file
exists: each was already written down somewhere before it was repeated, and a
rule a person has to remember is a rule that holds until the person is tired.

**Each trap here has a check in `scripts/verify-traps.ts`.** `npm run
verify:traps` fails if this file describes a trap nothing enforces, so the
register and the enforcement cannot drift apart. That is itself the lesson: the
palette was a comment for months, and became true the day something read it.

---

## The shape they all share

A checker reports on something ADJACENT to what it claims to check, and the
report reads the same either way. A green line that means "clean" and a green
line that means "I looked at nothing" are the same green line.

So the question to ask of any new check is not *is this rule right*. It is:
**if the thing I am checking were completely broken, would this line go red?**
If you cannot answer yes, the check needs a control before it needs anything
else.

---

### T1 · A checker reads source with its comments in

**The trap.** This codebase documents a defect by naming it. A comment says
`text-slate-500 on navy is 3.2:1, which is under the floor`. Any scanner
hunting for `slate-500` matches that sentence.

**What it costs.** A file gets cleaned up and the gate still calls it dirty. The
cheapest way to pass becomes deleting the explanation rather than the defect, so
the gate rewards destroying the record it depends on. In the other direction it
is worse: a comment mentioning `/api/cron` made an orphaned API route look
called, and hid a second route that genuinely had no caller.

**Where it has happened.** `uncalledExports` (whose own header says the rule had
been forgotten eight times by the time it was written), the route and page
scanners in `_surfaces.ts`, `verify-palette.ts` on the day it was written,
`verify-raw-sql.ts`, `verify-sprint31.ts`.

**The rule.** Strip comments before any scan of source, without exception. Use
`readSource` from `scripts/_verify.ts`, which does it and preserves line
numbers so nothing that reports a line shifts.

**Enforced by `verify:sprint37l2` (C205), not by `verify:traps`,** and the
reason is the best illustration of this trap in the file.

`verify-csp.ts` was written during this audit, by somebody who had just spent
an hour fixing five instances of T1, and it shipped with T1 in it. It read
`middleware.ts` with `stripCommentsKeepingLines` wrapped around the call, which
is correct behaviour, and `verify:traps` passed it because the detector asked
whether the file mentions a stripper anywhere. C205 asks the stricter question,
whether a literal `.ts` path appears inside a `readFileSync` at all, and caught
it on the next full pass.

Two checkers for one property is worse than one: the weaker gives cover to what
the stronger would refuse, and nobody can tell which was consulted. So
`verify:traps` stopped re-implementing it and now asserts that C205 is still
there and still wired. It keeps one check of its own, for the shape C205 cannot
see: a scanner that WALKS a directory of source rather than naming a file.

---

### T2 · A checker with nothing proving it can fail

**The trap.** Three absences in a row pass just as happily against a scanner
that matched nothing at all.

**What it costs.** Every instrument here has produced a green line while looking
at nothing: a crawler measuring a modal instead of the page behind it, a crawler
walking nine pages signed out and reporting them fine, a counter that silently
stopped counting at twenty-nine, an audit returning "no failures" from a page
that rendered nothing at all.

**The rule.** Every check gets a CONTROL: a planted offender the rule must
catch, and where the rule could fire on everything, a known-good example it must
leave alone. Both halves, because a control that only proves the rule fires
passes against a rule that fires on everything.

**Ratchet.** 19 of 101 verifiers still have none. The number may only fall.

---

### T3 · A list of the product's own routes, typed by hand

**The trap.** A hand typed list of routes is wrong the week after it is written.

**What it costs.** `verify-contrast.ts` held one and walked nine therapist pages
it had never loaded, while reporting `/earnings` as fine without ever visiting
it. `verify-served.ts` held a list of four and warmed four routes for a crawler
that walks a hundred and twenty five, which produced three consecutive passes
blaming three different sets of perfectly good screens.

**The rule.** Derive from `inventory.routes()`. Adding a page adds it
everywhere; deleting one removes it everywhere; nobody has to remember either.

---

### T4 · A report that truncates and drops the line saying it truncated

**The trap.** A checker puts its total on its LAST line, so a slice from the
front removes exactly the number that would reveal the slice.

**What it costs.** `gates.ts` cut each failing gate's output to twelve lines.
`verifiers.ts` runs seventy-nine scripts and prints "N of 79 failed" last. Six
verifiers failed, four were shown, and the two survivors appeared a pass later
looking like new breakage, which cost an hour of attributing them to work that
had nothing to do with them.

**The rule.** Keep the first N and the last line, and say how many were left out
and which command prints all of it.

---

### T5 · A dependency that downloads the rest of itself

**The trap.** The package in `node_modules` is read as though it were the thing
that runs. For a loader, it is not.

**What it costs.** The Content Security Policy was written from
`@daily-co/daily-js`, which names exactly one host, `daily.co`. That package is
a 200KB loader; on join it appends a `<script>` for a 1.8MB bundle, and the
production signalling API named in that bundle is `https://prod-ks.pluot.blue`,
a host the installed package never mentions. Not a fallback: the first branch
of `getAPIBaseURL` under `isProduction`. The policy would have refused it, and
the symptom is a clinician sitting in a room that never connects, with the
explanation in a console nobody in production has open. Every local check was
green, because everything local was correct.

**Where else it has the same shape.** A lockfile that carries a critical CVE
while every version constraint in `package.json` reads clean. A CDN script tag
audited by its URL. Anything whose real behaviour arrives after install.

**The rule.** Audit the artifact that runs, pin the audit to a version, and
fail when the version moves past the audit. `npm run audit:daily-hosts` fetches
the bundle and writes what it found into `docs/DAILY-HOSTS.md`, classified: a
host with no decision written against it is `unclassified`, and that is a
failure rather than a default.

**Enforced by `verify:csp`, and `verify:traps` asserts that enforcement is
still wired,** for the reason T1 gives: two checkers for one property is worse
than one.

---

### T6 · A script that runs when it is imported

**The trap.** Every script here calls `main()` at module scope. So `import { x }
from "./that-script"` does not read a value out of it, it RUNS it, and the
importer is usually a verifier reading the thing that script just changed.

**What it costs.** `verify-demo.ts` imported the cast list from
`scripts/seed-demo.ts` and wiped the database it was in the middle of reading,
then reported the pot at zero because it had just deleted it. Against dev that
is five seconds. Against production it is a command documented as read-only, on
the read half of the `on:production` allow-list, emptying the founders'
database the first time anybody ran it there.

It happened again the day `verify:prove` was written, with a guard that was
supposed to prevent exactly this. `prove.ts` held both the document builder and
the writer, and ran the writer only when
`process.argv[1]?.endsWith("prove.ts")`. **`scripts/verify-prove.ts` also ends
with `prove.ts`.** So the gate's import rewrote the file a moment before the
gate compared it, and the staleness check reported `current` on anything. A
check that cannot fail is the whole of T2, arrived at from a new direction.

**The rule.** Anything two scripts share lives in a file with a leading
underscore, no `main()`, and no side effect: `_cast.ts`, `_demo-cast.ts`,
`_gates.ts`, `_value-statements.ts`, `_prove-doc.ts`. A suffix guard is not a
substitute, because suffixes are not unique and the one that collides is the one
nobody thought of.

**Enforced by `verify:traps`:** no script may guard a side effect on what
`process.argv[1]` ends with.

---

## Traps recorded but not yet checkable

These have the same shape and no cheap static test. They are here so the
question gets asked in review.

**A check bound to a syntax rather than a property.** `verify:sprint77` asserted
`| "patient-app"` appeared in the schema, which was the hero's own inline union
of demo names. A later sprint deleted that union deliberately, because the hero
carrying its own list was the defect. The check went red for the improvement it
wanted. Ask: *if somebody improved this code, would my check still pass?*

**A check that reads one of the N files that implement a thing.**
`verify:sprint28` read `component-showcase.tsx` and not `blocks.tsx`, so six
perfectly drawable demos looked undrawable, and the gap had been papered over
with a hand typed exemption for two of them. Ask: *is this the only place that
does this?*

**A check looking for an answer in the wrong medium.** `verify:sprint18` looked
for the word "help" in editable marketing copy. The question it was asking is
answered by a component, whose words come from the dictionary, so the copy could
never contain them. `verify:claims` asked a two word label to carry a
disclosure that lives in its sibling field. Ask: *where does the product
actually answer this?*

**A gate measuring the harness instead of the product.** `verify:contrast`
reported `/billing` as a 500, then twelve other pages, then one, on the same
commit, while a browser opened every one by hand. The server log said `GET
/favicon.ico 200 in 11170ms`: a static file taking eleven seconds because the
container was running `next dev` and Chromium at once. It now asks the server
log whether the product answered, and says which. It stays red either way,
because going green is the red line explained away and calling it a product
failure is how people stop reading the pass.
