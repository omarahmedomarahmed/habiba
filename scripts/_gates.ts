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
    why: "and production, dev and the simulation are configured identically",
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
] as const;
