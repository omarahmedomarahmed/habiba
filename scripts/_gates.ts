/**
 * 🔴 76.31 — WHAT IS IN `npm run gates`, IN ONE PLACE, BECAUSE TWO FILES READ IT.
 *
 * `scripts/gates.ts` runs this list. `scripts/verifiers.ts` runs every OTHER
 * `verify:*` script in `package.json`, which means it has to know this one.
 *
 * ## Why it moved out of `gates.ts`
 *
 * `verifiers.ts` held its own hand-typed copy, and by the time anybody looked it
 * was stale by two entries: `verify:cycle` and `verify:money` had joined the
 * gates and nobody updated the second list, so both ran twice on every full
 * pass. Harmless, slow, and the shape of a worse bug: the same drift in the
 * other direction is a gate listed as covered by a pass that is not running it.
 *
 * A list two files must agree about belongs to neither of them. This is the
 * same reasoning `scripts/suites.ts` applies to the unit suites and
 * `verifiers.ts` applies to the verifiers: **discover, do not re-type.**
 */
export const GATES = [
  { name: "prose", script: "prose", why: "the screens got shorter" },
  { name: "claims", script: "verify:claims", why: "and no claim was dropped to do it" },
  /*
   * 🔴 79.1 — a message that leaves the building and lands nowhere it can be
   * found again. A clinician invited a patient on production and the patient's
   * app said nothing at all, because `notify()` and the in-app log were two
   * systems that almost nobody wired together.
   */
  {
    name: "notices",
    script: "verify:notices",
    why: "and what the product tells a person can be found again inside it",
  },
  {
    name: "principals",
    script: "verify:principals",
    why: "and nothing moved into a place it must not reach",
  },
  {
    name: "i18n",
    script: "verify:sprint37l",
    why: "and the Arabic half still exists",
  },
  /*
   * 🔴 C353 / C354 — the two gates sprint 69 had to write, and why they belong
   * in the pass that belongs to the product rather than to a sprint.
   *
   * `/pricing` answered 500 to every visitor for seven sprints. Six lines
   * passed a function to a client component, which is a runtime rule that
   * `tsc` cannot see, that `npm run build` never rendered, and that sixty
   * sprint verifiers had no reason to look for. The one gate that DID see it,
   * `verify:sprint21r`, reported it red and the red line was explained away
   * every time it was read.
   *
   *   - **boundary** — nothing hands a function across the client boundary.
   *     Cheap, source-only, and catches that defect's exact shape.
   *   - **renders** — and the stupid question nobody was asking: does every
   *     public page actually come back 200 with words on it. Needs a build, and
   *     says so rather than passing when there is not one.
   */
  {
    name: "boundary",
    script: "verify:boundary",
    why: "and nothing hands a function across the client boundary",
  },
  /*
   * 🔴 THE ONE PLACE THE COMPILER GIVES NO COVER.
   *
   * `failedAttemptsFor` asked `enrolment_attestations` for `consumed_at`. The
   * table has `answered_at` and never had the other. So `/sponsor/integrations`
   * threw on every render and was a hard 500 for every company admin, from the
   * day it shipped, on the second most important surface in the product.
   *
   * Twenty-eight gates passed over it, and so did `tsc`, because the name was
   * inside a `sql` template literal and Drizzle cannot type the inside of a
   * template string. Every other column reference in this codebase is checked
   * by the compiler. These are the only ones that are not, which makes them
   * the only ones worth a gate of their own.
   */
  {
    name: "raw sql",
    script: "verify:raw-sql",
    why: "and every column named in raw SQL is really on the table",
  },
  {
    name: "renders",
    script: "smoke",
    why: "and every public page still answers with a page",
  },
  /*
   * 🔴 C360 — the forecast still cannot charge anybody.
   *
   * It belongs in the product's pass rather than in sprint 71's, because the
   * property it holds is about the module graph and the module graph is what
   * next sprint changes. One import added to `lib/finance/` in six months turns
   * a board pack into a billing system, and nothing else in this repository
   * would notice.
   */
  {
    name: "finance",
    script: "verify:finance",
    why: "and the forecast still cannot move a price",
  },
  /*
   * 🔴 The plan is a different gate from the forecast, and both belong here.
   *
   * `verify:finance` guards the ENGINE: pure, reconciling, unable to bill. This
   * guards the PLAN: that the offer modelled is the offer somebody intends to
   * run, that a cohort is priced off its own age, and that every guess still
   * says it is one. An unlabelled number is how a plan becomes evidence for
   * something nobody measured.
   */
  {
    name: "plan",
    script: "verify:plan",
    why: "and the plan still says which numbers are guesses",
  },
  /*
   * 🔴 The Egyptian rail has no processor behind it. No webhook confirms the
   * money, no chargeback reverses it, and the row in `manual_payments` is the
   * only record that anybody checked anything. That makes its invariants the
   * kind that belong in the product's own pass rather than one sprint's.
   */
  {
    name: "rail",
    script: "verify:rail",
    why: "and nothing is granted before a person confirms it",
  },
  /*
   * 🔴 76.20 — AND THE RAIL HAS A BANK ACCOUNT TO POINT AT, which is DATA.
   *
   * Every other gate in this pass reads code, and settings are not code.
   * Production ran for weeks holding the pre-sprint-26 prices with all fourteen
   * of these green, because nothing in the pass had ever asked a database what
   * it was actually configured with. It was found by accident.
   *
   * The failing condition is deliberately narrow: no transfer fields, or a
   * missing country. Those are the two that stop the product working. A stale
   * price prints loudly and does not fail, because an operator changing a price
   * is somebody doing their job and a gate that cannot tell the two apart is
   * one people switch off.
   *
   * 🔴 IT READS AND NEVER WRITES, so it can be pointed at production, which is
   * the database that most needed asking.
   */
  {
    name: "settings",
    script: "settings:check",
    why: "and the rail it runs on has a bank account to point at",
  },
  /*
   * 🔴 76.42 — AND ALL THREE DATABASES ARE CONFIGURED THE SAME WAY.
   *
   * `settings:check` above asks ONE database whether it matches the code. Three
   * green runs of it do not mean three identical databases: every value an
   * operator changed on purpose reads as "differs from default" on all three
   * and says nothing about whether they differ from each other, and the values
   * with no code default at all — the bank account, which is the whole Egyptian
   * rail — it can only ask whether they exist.
   *
   * The first run of this found four real drifts. Production alone held the
   * stored FX rate; dev and the simulation carried the pre-audience shape of
   * the transfer fields, so the field a patient sees and the field a clinic
   * sees were the same field on two of three environments; the simulation
   * throttled the copilot to 4 messages a session where the product allows 10;
   * and production's ID-upload labels still carried the em dash this product
   * does not use, because `settings:seed` only ever inserts and the corrected
   * default never reached a row that already existed.
   *
   * 🔴 IT MATTERS MOST FOR THE SIMULATION. A six month run is evidence about
   * the product only if the product it ran on is the product. A simulation
   * priced off a stale table produces a P&L about a business nobody is
   * launching, and every number in it is internally consistent.
   *
   * 🔴 IT READS ON EVERY CONNECTION AND WRITES NOWHERE, which is why it can be
   * pointed at production and why it must be.
   */
  {
    name: "environments",
    script: "settings:compare",
    why: "and the three environments differ only where a named allowance says why",
  },
  /*
   * 🔴 76.22 — AND A WHOLE CYCLE OF MONEY ACTUALLY MOVES, on real rows.
   *
   * `verify:rail` above ends by admitting what it cannot do: it reads source,
   * it catches a posting being deleted, and it cannot catch one posting the
   * wrong number. Sprint 74 found three defects in the entitlement loop that
   * were all true of the source and false of the database.
   *
   * The sweep that added `sawRows` proved how far that reached: the board
   * reported zero collected and zero transfers on every branch we own, seeded
   * ones included, so the money half of this product had never been exercised
   * against rows anywhere. A cycle run once by hand proves the day it ran.
   *
   * Four payers, a rejection, and a trial balance, with everything deleted in a
   * `finally`.
   */
  {
    name: "cycle",
    script: "verify:cycle",
    why: "and a company, a patient and a clinician can all actually pay us",
  },
  /*
   * 🔴 76.33 — AND THE COVERED EMPLOYEE, WHOSE MONEY HAD THREE WAYS TO GO WRONG.
   *
   * `verify:cycle` above has a step headed "part covered by that pot" that
   * never called `payFromPot`. So the money path with the most moving parts in
   * this product — an employer pays half at booking, the patient pays the rest
   * on a rail with no processor behind it, and one row has to hold both — was
   * exercised by nothing, and three defects lived in it:
   *
   *   - the card rail QUOTED the full price while charging the share
   *   - the patient's transfer posted to no account at all, because the pot had
   *     already taken the one row per session the unique index allows
   *   - so the VAT they paid was recorded as zero, on tax we genuinely owe
   *
   * Sixteen scenarios, each one a sentence somebody could say about a real
   * person, each against rows through the product's own functions, with the
   * old wrong read planted as a control so the check cannot pass by measuring
   * the wrong thing.
   */
  {
    name: "edges",
    script: "verify:edges",
    why: "and a covered employee is charged once, for their half, with the tax recorded",
  },
  /*
   * 🔴 THE ONE GATE IN THIS PASS THAT WRITES.
   *
   * Every other line above reads files. All three defects sprint 74 found in
   * the entitlement loop were true of the source and false of the database: an
   * idempotency that leaned on a unique index the code could not trigger, a
   * sort that handed back a due obligation in place of a paid one, and an
   * `ON CONFLICT` about to meet its first null. Nothing that reads source could
   * have seen any of them.
   *
   * It writes to a throwaway organisation, asserts what comes back, and deletes
   * it in a `finally`. `writesTo()` refuses production by name.
   */
  {
    name: "entitlement",
    script: "verify:entitlement",
    why: "and paying for a plan actually puts you on it",
  },
  /*
   * 🔴 The board is the screen the founders run the company from, and a
   * dashboard is the easiest thing in a product to get wrong in a way nobody
   * notices: a wrong number and a right number look identical. This runs all
   * nine of its queries against a real database, checks that none of them
   * writes, and checks the one error that describes a richer company than we
   * have — counting invoiced money as collected.
   */
  {
    name: "board",
    script: "verify:board",
    why: "and the board a founder trusts is counting the right things",
  },
  /*
   * 🔴 76.53 — THE SECOND GATE IN THIS PASS THAT WRITES, and for the board's own
   * reason one line up.
   *
   * `/admin/actuals` is the only screen in this product that reports what the
   * COMPANY earned and spent, and every figure on it is a SQL aggregate with a
   * sign convention in it: a `-SUM` where `SUM` belonged turns a profitable
   * month into a loss of the same size, and both render beautifully. Nothing
   * that reads source could see that, and no unit test over a fake row could
   * either, because the query is the whole of the risk.
   *
   * It plants ledger legs in both directions, four model calls that each round
   * to zero in whole cents, and three employees sitting on the three month
   * boundaries the payroll arithmetic gets wrong. Everything is deleted in a
   * `finally`, and `writesTo()` refuses production by name.
   */
  {
    name: "actuals",
    script: "verify:actuals",
    why: "and the month the company lost money says so, with the wages in it",
  },
  /*
   * 🔴 76.57 — MONEY OUT, WHICH HAD NO GATE AT ALL.
   *
   * Every other rail had one. The one with the fewest safety nets in it did
   * not: no card network, no processor, no chargeback, no reconciliation file.
   * A clinician asks for their held earnings, a person approves it, a person
   * makes a bank transfer by hand and photographs having done so, and if any
   * step of that is wrong the only thing that notices is a clinician who has
   * not been paid.
   *
   * It plants an offender for each of the four refusals that are somebody's
   * money — over the balance, a second request in flight, approving one's own,
   * and marked sent with no receipt — because a check that only ever sees a
   * valid request proves nothing about the invalid one.
   *
   * It also carries the receipt-immutability rule, in both directions: a
   * receipt is refused and an onboarding document is not, because a guard that
   * refused every file would pass the first check while breaking the product.
   */
  {
    name: "payout",
    script: "verify:payout",
    why: "money out refuses the four things that are somebody else's money",
  },
  /*
   * 🔴 76.58 — THE LIMITER, AND THE THING THAT WOULD HAVE STOPPED THE RUN.
   *
   * Sign-in is twenty attempts per fifteen minutes bucketed by /24, which is
   * right for the public internet and impossible for twenty-eight agents
   * behind one egress address. The run would have stalled in wave 1 with every
   * agent reporting "too many attempts" as a product failure.
   *
   * It is widened by a multiplier while `SIMULATION_RUNNING=1`, and this gate
   * asserts BOTH halves — that the production default is untouched to the
   * attempt, and that the platform-wide `global:` ceiling is not widened even
   * then, because that is the one number that would notice a real attack.
   */
  {
    name: "limits",
    script: "verify:limits",
    why: "and a swarm behind one address is not mistaken for an attack on it",
  },
  /*
   * 🔴 76.60 — THE ONE NUMBER THE RUN EXISTS TO PRODUCE, AND ITS CONTROL.
   *
   * The six month run cannot measure a fifty minute session: the budget is ten
   * dollars and its own sessions are three and eight minutes. So it FITS the
   * two-term model over its rows and evaluates at fifty, a reach of more than
   * six times beyond its data, and that figure is what every margin in the
   * forecast rests on.
   *
   * 🔴 IT HAD NO CHECK. `08-THE-NUMBERS.md` asked a PERSON to hold the result
   * next to `evals/physics.json` and judge whether the difference was
   * "material". That is H20 one step earlier than this repository usually
   * finds it: not a check that fails and gets explained away, but a check that
   * was only ever a sentence. Found by the founder asking how the real cost
   * would be worked out, which is a question the tooling should have answered.
   *
   * This gate proves the instrument before the run needs it: that the
   * benchmark recomposes to its own stored answer, that it measured a session
   * as long as the one it certifies, that the detector flags a planted
   * offender in both directions and reads a zero benchmark as disagreement
   * rather than agreement. The comparison against a real run happens inside
   * `npm run physics`, which now exits non-zero when they diverge.
   */
  {
    name: "physics",
    script: "verify:physics",
    why: "and the fifty minute cost is checked against one that was actually measured",
  },
  /*
   * 🔴 THE THIRTY UNIT SUITES, AND THE REASON THEY ARE HERE IS EMBARRASSING.
   *
   * Sprint 75 repriced the product. `tests/seats.test.ts` went 7 red of 12 and
   * `tests/safety.test.ts` went 1 red of 55, every failure an assertion holding
   * a price the product no longer charges.
   *
   * They stayed red across two sprints of commits. Nothing printed it, because
   * this pass ran eleven verifiers and none of the thirty suites, so the only
   * way to see the failure was to type the one script nobody had a reason to
   * type.
   *
   * That is the quiet half of H20. The loud version is *a known-failing gate is
   * a gate nobody reads*; this is **an unrun gate is a gate nobody reads
   * either**, and it is the version that costs a sprint rather than an
   * afternoon. `scripts/suites.ts` discovers them from `package.json` rather
   * than listing them, so a suite added next sprint is run by a file nobody
   * edited.
   */
  {
    name: "suites",
    script: "suites",
    why: "and all thirty unit suites still agree with what we charge",
  },
  /*
   * 🔴 76.7 — every price a person reads can say what it is in pounds.
   *
   * It belongs in the product's own pass rather than a sprint's, because the
   * property is about every screen at once and every sprint adds screens. One
   * table shipped with a bare figure is a price with no answer, met by the one
   * person who had the question.
   */
  {
    name: "money",
    script: "verify:money",
    why: "and every dollar figure can say what it is in pounds",
  },
  /*
   * 🔴 76.30 — AND THE CHECKS THAT NEED A SERVER GET ONE.
   *
   * `verify:sprint31` holds sixteen checks that can only be answered by a
   * running product, and every one of them printed `deferred to a running
   * server` on every run anybody ever did, because nothing started one. The
   * summary line read `PASS (5 checks, 1 deferred)` and a reader takes the PASS.
   *
   * With a server there are twenty-one checks instead of five, including
   * whether a forged `x-locale` header can change a page and whether either
   * private path has a second, unguarded address. This boots the product, runs
   * them, treats a deferral as a FAILURE, and kills the server in a `finally`.
   *
   * H20's quiet half a third time: an unrun check is not a passing check.
   */
  /*
   * 🔴 76.35 — AND A MINIMISED SESSION IS STILL A SESSION.
   *
   * There are exactly two ways to break the orb, both of which look completely
   * reasonable in a diff: render the iframe in one branch and something else in
   * the other, which makes React tear the element down and end the call, or
   * hide it with `display: none`, which is how a browser decides a media
   * element is not in use. Neither produces a compile error, a runtime error or
   * a failing render. The orb appears, looks right, and the audio is gone.
   *
   * It is a source gate and says so: proving audio survived an app switch needs
   * a real room, two devices and a way to switch apps. What a gate can hold is
   * the property that decides it, with the obvious wrong version planted as a
   * control.
   */
  /*
   * 🔴 76.36 — AND A CLINICIAN WHO SAW SOMEBODY HAS A PATIENT.
   *
   * A therapist ran an offline session, typed a first name, recorded it,
   * generated the note and signed it. Their Patients tab said 0. Every line
   * involved was correct: `createSession` made a chart only when there was a
   * phone or an email, deliberately, under a long comment explaining a ruling
   * from sprint 52 made for good reasons.
   *
   * Nothing that reads source could have found it, because there was nothing
   * wrong with the source. Only asking a database how many patients a clinician
   * has after they have seen one can answer it, which is what this does, with
   * the constraint that caused the original ruling planted as a control so the
   * fix cannot quietly become a weakened rule.
   */
  {
    name: "caseload",
    script: "verify:caseload",
    why: "and a clinician who has seen somebody has a patient",
  },
  {
    name: "orb",
    script: "verify:orb",
    why: "and a session minimised into an orb is still connected",
  },
  /*
   * 🔴 76.40 — AND THE ONE BUTTON ON THE PROFILE THAT SPENDS SOMEBODY'S MONEY.
   *
   * A profile page is mostly presentation, and presentation is what a gate list
   * skips. The invitation on it is not: it creates a session, prices it and
   * bills for it. Every way that goes wrong compiles and renders — a session
   * with no join token, a price of nothing, a link sent to a walk-in who has no
   * phone — so it is answered by making one and reading the row back, with the
   * unreachable patient and the unpriced clinician planted as controls.
   *
   * It also holds the two properties that keep the rest of the page honest: the
   * headshot goes through the authenticated route rather than a storage URL
   * (C115), and both surfaces that render this patient's copilot load the one
   * thread rather than each making their own.
   */
  {
    name: "profile",
    script: "verify:profile",
    why: "and a clinician can invite their patient to a session that actually exists",
  },
  {
    name: "served",
    script: "verify:served",
    why: "and the checks that need a running product got one",
  },
  /*
   * 🔴 76.32 — AND THE MARKETING SITE RENDERS, IN BOTH LANGUAGES.
   *
   * `smoke` above asks whether a page answers 200. This renders the real
   * `BlockRenderer` against the staged rows and reads the HTML, which is the
   * only kind of check that catches a defect that is wrong only on screen:
   * C95 was an icon breaking to its own line, and nothing about the block, the
   * props or the import graph was wrong.
   *
   * It was in no pass at all. It does not begin with `verify:`, so
   * `verifiers.ts` never discovered it either, and it sat at
   * `PASS (18 checks, 1 deferred)` for fifty-four sprints with 37 English
   * passages counted on the Arabic pages under that one deferred line.
   *
   * Thirty-two of them were real and are now written. The other five were the
   * harness rendering client components without the provider the real page
   * has, so it was reporting English that no reader ever saw. Both halves were
   * invisible for the same reason: nothing ran it.
   */
  {
    name: "rendered",
    script: "render:check",
    why: "and the marketing site draws the right thing in both languages",
  },
  /*
   * 🔴 AND THE SEVENTY-NINE VERIFIERS THIS PASS WAS NOT RUNNING.
   *
   * `package.json` wires eighty-one `verify:*` scripts. This pass ran twelve.
   * So seventy-nine were reachable only by somebody typing their exact name,
   * and `verify:sprint1` had been RED among them since the reprice, asserting
   * the tier prices as the literal `"9900,17900"`.
   *
   * That is the third time in one day the same lesson arrived: the seats suite,
   * the safety suite, and now a whole shelf of sprint verifiers. **An unrun
   * gate is a gate nobody reads**, and the fix is never "remember to run it".
   * `scripts/verifiers.ts` discovers them from `package.json` and skips exactly
   * two things by name: everything already here, and `verify:synthetic`, which
   * is a property of a database rather than of the code and is correctly red on
   * a branch full of fixtures.
   */
  {
    name: "verifiers",
    script: "verifiers",
    why: "and the seventy-nine sprint verifiers nobody was running",
  },
  /*
   * 🔴 76.62 — AND THE DOCUMENTS, BECAUSE NOTHING HAD EVER READ THEM.
   *
   * Every gate above this one checks the product. The eighteen files the six
   * month run is DRIVEN by were checked by nobody, and a full read of them
   * found the runbook had rotted under the product: forty-one commands aged the
   * wrong database because they were written without the `on:production`
   * prefix, a governing rule said nothing runs against production eighty lines
   * after the same file said the run is on production, and every count in them
   * disagreed with something — eleven gates against twenty-seven, thirty edges
   * against forty-eight, two steps both numbered 15.
   *
   * None of that is a documentation problem. A command pointed at the wrong
   * database does not fail; it succeeds somewhere else, and the six month clock
   * would never have started with nothing saying so.
   *
   * `verify:runbook` derives every expectation from the code: the gate count
   * from this list, the production-only commands from the allow-list in
   * `on-production.ts`, the cron jobs from the route's own map, the edge count
   * by counting the rows in the file that defines them. A checker holding its
   * own copy of a number stops matching the day somebody tunes the real one
   * (H31, H25).
   */
  /*
   * 🔴 THE PALETTE WAS A COMMENT UNTIL SOMETHING READ IT.
   *
   * `app/globals.css` described a division of labour between `navy`, `brand`
   * and `teal` and it was true of that file alone. 277 class names had drifted
   * onto the wrong ramp, and eighteen buttons carried white ink on the mark's
   * own teal at 2.17:1, which is under what even large text needs.
   *
   * Neither is the kind of thing a person catches by looking, because each one
   * individually renders fine. Both are arithmetic, so a script does it.
   */
  {
    name: "palette",
    script: "verify:palette",
    why: "and every colour is on the ramp the palette assigns to its job",
  },
  /*
   * 🔴 A LIFECYCLE IS A CLAIM, AND A CLAIM CAN BE CHECKED.
   *
   * Every other gate here looks at code that exists. This one looks for code
   * that does not: a state with no arrow out, a rejection that ends the story,
   * a wait with no promise on it. Those are the three shapes of "stuck", and
   * none of them is visible to a crawler, because a crawler can only walk paths
   * the product already has.
   */
  {
    name: "machines",
    script: "verify:machines",
    why: "and no lifecycle has a state a person enters and cannot leave",
  },
  /*
   * 🔴 THE GATES THEMSELVES ARE CODE, AND NOTHING WAS CHECKING THEM.
   *
   * Thirty gates hold the product to its rules. What held the gates? A set of
   * conventions in comments, each learned expensively and each broken again
   * within a few sprints: strip comments before scanning source (broken five
   * times), give every check a control, derive a path list rather than typing
   * it, say when a report is truncated.
   *
   * `docs/TRAPS.md` is the prose and this is the enforcement, and the last
   * check in it fails if the document describes a trap this does not hold.
   */
  {
    name: "traps",
    script: "verify:traps",
    why: "and the checkers are still checking what they claim to",
  },
  /*
   * 🔴 A CSP DECAYS IN ONE DIRECTION AND THE HEADER NEVER STOPS BEING SENT.
   *
   * Something breaks, `'unsafe-inline'` goes into `script-src` to unbreak it,
   * and the policy keeps appearing in every security review while no longer
   * stopping an injected script. Nothing about the response looks different.
   *
   * It also holds the one line that is invisible everywhere else: middleware
   * setting the policy on the REQUEST headers, which is how Next learns the
   * nonce to stamp on its own scripts. Delete it and the product serves a
   * white page under a perfectly correct looking header.
   */
  {
    name: "csp",
    script: "verify:csp",
    why: "and the content policy still refuses a script we did not write",
  },
  {
    name: "runbook",
    script: "verify:runbook",
    why: "and the documents the run is driven by still match the product",
  },
  /*
   * 🔴 80.1 — AND A PROMISE NOBODY WALKS IS A FAILING GATE.
   *
   * Every gate above holds the product to a rule. This one holds it to a
   * SENTENCE: twenty-five things we say on pages a stranger can read, each with
   * a seeded position somebody can put the database into and a walk that ends
   * with a person having seen it or written down that they did not.
   *
   * It belongs in the product's own pass rather than one sprint's for the
   * reason `verify:runbook` does. The failure it exists for is silent: a
   * promise is added to `_value-statements.ts`, the walk is not extended, and
   * `docs/PROVE-IT.md` still reads as complete because nothing in it is wrong.
   * That is how every count in the simulation documents came to disagree with
   * something while all eighteen of them looked fine.
   *
   * It also runs the promises through `lib/content/honesty.ts`, the same
   * checker that refuses a claim at `savePage`. A promise we could not publish
   * is one we must not hand eight people and ask them to prove.
   */
  {
    name: "prove",
    script: "verify:prove",
    why: "and every promise we make has somebody walking it on a real device",
  },
] as const;
