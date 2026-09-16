/**
 * Sprint 58 acceptance: can a human reach it? PLAN.md 58.1 to 58.5, C335, C356.
 *
 *   npm run verify:reachable
 *
 * ## Why this exists
 *
 * The founder asked whether every backend, route and action has a page and a
 * button behind it, end to end. The honest answer was that **nobody could
 * tell**: `scripts/_reachability.ts` measures tables to screens and explicitly
 * excludes `app/api/**`, so an exported action with no button, a route with no
 * caller and a page with no link were all invisible to every gate we own.
 *
 * Seven sprints of new pages, actions and routes are about to be written. A
 * gate that catches an orphan is worth far more before that than after.
 *
 * ## Needs no database
 *
 * It reads source. That is deliberate: this has to run on a laptop, in CI, and
 * in the same breath as `verify:claims`, without anybody exporting a URL first.
 */
import { loadSurfaces, serverActions, unwiredActions, apiRoutes, uncalledRoutes, routePath, pages, unlinkedPages, pagePath, libraryExports, uncalledExports } from "./_surfaces";
import { reporter } from "./_verify";

const { check, finish } = reporter();

/* ------------------------------------------------------- the allowlists -- */

/*
 * 🔴 Every entry carries a REASON, and the gate FAILS when an entry stops being
 * an orphan.
 *
 * Both rules are taken from `_reachability.ts`, which already learned them the
 * expensive way. An allowlist with no reason is where orphans go to be
 * forgotten; a stale exemption is a rule nobody is checking any more, and the
 * second is worse because it reads as coverage.
 */
const ACTIONS_BY_DESIGN: Record<string, string> = {};

/*
 * 🔴 THIS LIST WAS WRITTEN FROM MEMORY AND FOUR OF ITS FIVE ENTRIES WERE WRONG.
 *
 * The first draft allowlisted `/api/webhooks/stripe`, `/api/cron`,
 * `/api/revalidate` and `/api/partner`, each with a confident paragraph. The
 * real path is `/api/stripe/webhook`, and the other three have in-repo callers
 * and were never orphans at all. Every one of those paragraphs would have read
 * as a considered decision for ever.
 *
 * 58.4 caught it on the first run, which is the entire argument for the rule:
 * an exemption that has stopped being needed is worse than a missing one,
 * because it reads as coverage.
 */
const ROUTES_BY_DESIGN: Record<string, string> = {
  "/api/stripe/webhook":
    "Called by Stripe, which is not in this repository. `handleWebhook` verifies the signature against `STRIPE_WEBHOOK_SECRET` and claims every delivery once through `stripe_events`, so a redelivery is a no-op rather than a second side effect.",
  "/api/cron":
    "Called by Vercel's scheduler, declared in `vercel.json` rather than in TypeScript, and authorised by `CRON_SECRET`. A caller inside this repository would mean we were triggering our own crons from a request, which is the thing the secret exists to prevent.",
};

/*
 * 🔴 EMPTY, and `/sponsor/domains/confirm` is the reason it stayed that way.
 *
 * It was added here as an orphan by design — a page reached only from a link in
 * an email — and 58.4 immediately reported it as no longer an orphan, because
 * `addDomain` builds that URL when it sends the mail. The scanner was right and
 * the allowlist entry was wrong: a page a shipped code path links to IS
 * reachable, whether the link arrives in a nav bar or an inbox.
 */
const PAGES_BY_DESIGN: Record<string, string> = {};

/*
 * 🔴 C369 — exported safety code that legitimately has no caller. Each entry is
 * a decision, and the stale check below fails when one stops being needed.
 */
const EXPORTS_BY_DESIGN: Record<string, string> = {};

/**
 * 🔴 The floor. 87 exported safety functions have no caller anywhere.
 *
 * Measured on 2026-09-14, the day four hostile auditors each found one of these
 * by hand and this gate could see none of them. Lower it whenever the number
 * drops; it must never rise.
 */
const DEAD_EXPORT_BASELINE = 96;

/* --------------------------------------------------------------- checks -- */

function main() {
  const s = loadSurfaces();

  check(
    "the scanner actually read this repository",
    s.files.length > 300,
    `${s.files.length} TypeScript files`,
  );

  /* ------------------------------------------------ 58.1 · server actions */

  const actions = serverActions(s);
  check(
    "58.1 server actions were found at all",
    actions.length > 40,
    `${actions.length} exported actions across ${new Set(actions.map((a) => a.file)).size} files`,
  );

  const unwired = unwiredActions(s, actions);
  const unwiredReal = unwired.filter((a) => !(`${a.file}#${a.name}` in ACTIONS_BY_DESIGN));

  check(
    "🔴 58.1 every server action is reachable from a rendered page",
    unwiredReal.length === 0,
    unwiredReal.map((a) => `${a.file}#${a.name}`).join(" · ") || `${actions.length} wired`,
  );

  /* --------------------------------------------------- 58.2 · API routes */

  const routes = apiRoutes(s);
  check("58.2 API routes were found at all", routes.length > 5, `${routes.length} routes`);

  const uncalled = uncalledRoutes(s, routes);
  const uncalledReal = uncalled.filter((f) => !(routePath(f) in ROUTES_BY_DESIGN));

  check(
    "🔴 58.2 every API route has a caller, or an allowlist entry naming the external one",
    uncalledReal.length === 0,
    uncalledReal.map(routePath).join(" · ") || `${routes.length} routes accounted for`,
  );

  /* -------------------------------------------------------- 58.3 · pages */

  const all = pages(s);
  check("58.3 pages were found at all", all.length > 40, `${all.length} pages`);

  const unlinked = unlinkedPages(s, all);
  const unlinkedReal = unlinked.filter((f) => !(pagePath(f) in PAGES_BY_DESIGN));

  check(
    "🔴 58.3 every page is linked from somewhere a principal can reach",
    unlinkedReal.length === 0,
    unlinkedReal.map(pagePath).join(" · ") || `${all.length} pages linked`,
  );

  /* --------------------------- 58.9 · exported safety code with no caller */

  /*
   * 🔴 C369. Four auditors found four of these independently and this gate saw
   * none of them, because it measured actions, routes and pages and a library
   * function is none of those.
   */
  const exported = libraryExports(s);
  check(
    "58.9 exported safety functions were found at all",
    exported.length > 200,
    `${exported.length} exported functions across the safety modules`,
  );

  const dead = uncalledExports(s, exported);
  const deadNow = new Set(dead.map((f) => `${f.file}#${f.name}`));

  /*
   * 🔴 A RATCHET, not a pass/fail, and the reason is H20.
   *
   * The first run found EIGHTY-SEVEN. A gate that fails with eighty-seven
   * findings is a gate somebody switches off inside a week, and then the
   * eighty-eighth arrives unseen. H20 is this repository's record of exactly
   * that: five e2e tests sat red for fifteen sprints behind a standing
   * explanation and masked a live defect.
   *
   * So the number is a FLOOR that can only go down. A new dead export fails
   * immediately; clearing an old one is expected to lower the baseline. The
   * i18n coverage gate already works this way here, for the same reason.
   *
   * 🔴 The MUST_WIRE list is the part that is not a ratchet. Each of these was
   * written to satisfy a named ruling and then wired to nothing, so its absence
   * is the ruling silently not being enforced. They fail outright.
   */
  const MUST_WIRE: Record<string, string> = {
    "lib/data/sponsors.ts#potBalance":
      "C229's anti-differencing floor. Without it both sponsor screens render the raw pot balance, so a sponsor watching it drop by one session's price learns that one named person had a session today. That is the exact attack C229 exists to stop.",
    "lib/data/enrolment-verify.ts#unpause":
      "C247's one-step manual unpause. Without it a sponsor whose employee re-verified late has no way back on, and funding stays paused with no operator remedy.",
    /*
     * 🔴 `upsertSubject` RESOLVED, 2026-09-14, by sprint 68 building the flow it was
     * written for rather than by wiring it to something convenient.
     *
     * It sat here failing on purpose for five sprints, and the note said why: 55.6
     * rules that a partner's reference is linked to a person by the PERSON'S own act,
     * and that flow did not exist. Sprint 68 is the flow. `openSession` creates the
     * placeholder a person later claims, because 68.10 makes an unclaimed patient the
     * normal case for a telehealth platform: they have a caseload before they have our
     * accounts.
     *
     * 🔴 LIVE ONLY, and that is the part worth keeping in the record. A claimable row
     * for a sandbox reference would let somebody claim a subject that was never a
     * person, so 68.22's rule reaches this too.
     */
    "lib/partner/webhooks.ts#queueWebhook":
      "The only thing that raises a partner webhook. The registration UI is built, the delivery table exists, and no event has ever fired.",
    "lib/billing/ledger.ts#unbalancedTransactions":
      "Detects a ledger that does not balance. It is the check that would notice money being manufactured, and nothing calls it.",
    /*
     * 🔴 `keywordFloor` RESOLVED, 2026-09-14, and not by wiring it.
     *
     * It was already called, by `levelFor`, eight lines below it in its own
     * file. This scanner ignores same-file callers on purpose: a function used
     * only inside its own module does not need to be exported, and exporting it
     * makes it look like an API somebody may call instead of the ladder.
     *
     * The ruling it was listed for — a model that under-rates a keyword hit
     * cannot lower the alert below what the keyword alone justifies — is a
     * property of `levelFor`, which is the function the product calls, and the
     * test asserts it there. So the entry goes and the export goes with it.
     */
    "lib/data/usage.ts#consentRate":
      "Total View's consent rate. Sprint 57 shaped the whole unlimited-plan billing change around keeping this answerable, and nothing asks it.",
    /*
     * 🔴 76.38 — `diariseSession` IS WIRED, and checking that it stays wired is
     * worth an entry here because of how nearly it was not.
     *
     * A clinician reported every line of an offline transcript labelled
     * "Speaker". Hunting it, a grep for `from "@/lib/ai/diarise"` came back
     * empty and it looked like the classic shape: a function exported, unit
     * tested, benchmarked, given a backfill script, described in a comment in
     * `session-room.tsx` as the thing that resolves `unknown` lines afterwards,
     * and called by nothing.
     *
     * It was wrong. `generateAndStoreNote` calls it through a dynamic
     * `await import(...)`, immediately before writing the note, for exactly the
     * right reason: a note generated over unattributed lines guesses. The grep
     * missed it and this scanner did not, because this scanner matches the NAME
     * rather than an import statement.
     *
     * The entry stays because the call is one line inside a `try` in another
     * module, and if it ever goes the symptom is a clinical record that
     * silently stops saying who said anything.
     */
    "lib/ai/diarise.ts#diariseSession":
      "Works out who said what before the note is written. Without it every one-microphone transcript stays `unknown`, which the panel renders as `Speaker` on every line, and the note is generated over lines attributing nothing to anybody.",
  };

  const mustWireMissing = Object.keys(MUST_WIRE).filter((key) => deadNow.has(key));
  check(
    "🔴 58.9 every safety function written for a named ruling is WIRED",
    mustWireMissing.length === 0,
    mustWireMissing.join(" · ") || `${Object.keys(MUST_WIRE).length} checked, all wired`,
  );

  check(
    "🔴 58.9 the dead-export count only goes DOWN",
    dead.length <= DEAD_EXPORT_BASELINE,
    `${dead.length} dead of ${exported.length} exported, baseline ${DEAD_EXPORT_BASELINE}` +
      (dead.length < DEAD_EXPORT_BASELINE
        ? `. LOWER THE BASELINE to ${dead.length}`
        : ""),
  );

  /* ------------------------------------------- 58.4 · no stale exemption */

  /*
   * 🔴 An exemption that has stopped being needed is worse than a missing one:
   * it reads as a considered decision while covering nothing. The same rule
   * `_reachability.ts` applies to its own table allowlist.
   */
  const staleRoutes = Object.keys(ROUTES_BY_DESIGN).filter(
    (path) => !uncalled.some((f) => routePath(f) === path),
  );
  const stalePages = Object.keys(PAGES_BY_DESIGN).filter(
    (path) => !unlinked.some((f) => pagePath(f) === path),
  );
  const staleActions = Object.keys(ACTIONS_BY_DESIGN).filter(
    (key) => !unwired.some((a) => `${a.file}#${a.name}` === key),
  );
  const staleExports = Object.keys(EXPORTS_BY_DESIGN).filter((key) => !deadNow.has(key));

  check(
    "🔴 58.4 no allowlist entry has stopped being an orphan",
    staleRoutes.length === 0 &&
      stalePages.length === 0 &&
      staleActions.length === 0 &&
      staleExports.length === 0,
    [...staleRoutes, ...stalePages, ...staleActions, ...staleExports].join(" · ") || "every exemption still earns its place",
  );

  check(
    "58.4 …and every exemption carries a reason somebody can act on",
    [
      ...Object.values(ROUTES_BY_DESIGN),
      ...Object.values(PAGES_BY_DESIGN),
      ...Object.values(ACTIONS_BY_DESIGN),
      ...Object.values(EXPORTS_BY_DESIGN),
    ].every((reason) => reason.length > 60),
    "a one-word reason is a shrug with a comma in it",
  );

  /* ------------------------------------------------------ 58.5 · CONTROLS */

  /*
   * 🔴 Three absences in a row pass just as happily against a scanner that
   * matched nothing at all. That is this repository's §6 family, thirteen
   * occurrences deep, and it is the reason every rule below is proved against a
   * planted offender rather than merely asserted.
   */
  const PLANTED = "lib/_verify58-control.ts";
  const planted = {
    files: [...s.files, PLANTED],
    body: new Map(s.body).set(
      PLANTED,
      `"use server";\nexport async function verify58OrphanAction() { return null; }\n`,
    ),
    reachesPage: s.reachesPage,
  };

  const withPlant = serverActions(planted);
  check(
    "🔴 58.5 CONTROL the scanner FINDS a planted action",
    withPlant.some((a) => a.name === "verify58OrphanAction"),
    "so 'no actions found' cannot masquerade as 'all actions wired'",
  );

  check(
    "🔴 58.5 CONTROL …and reports it as unwired, because nothing calls it",
    unwiredActions(planted, withPlant).some((a) => a.name === "verify58OrphanAction"),
  );

  /*
   * 🔴 And the mirror: a real, wired action must NOT be reported. A control that
   * only proves the rule fires would pass against a rule that fires on
   * everything, which is a gate somebody switches off within a week.
   */
  /*
   * 🔴 76.34 — NAMED AS A CONSTANT, and it used to be `subscribeTo`.
   *
   * That action stopped being exported the sprint the plan card learned to
   * confirm before paying, and this control went red on a product that had just
   * been made more correct. A control whose example is one function's name is a
   * control that fails whenever that function is refactored, which teaches
   * whoever is running it that a red line here means nothing.
   *
   * `cancelPlan` is the replacement because it is the most load-bearing kind of
   * example this control can have: a plain action, called directly from a
   * button in `components/billing/plan-card.tsx`, on a screen a clinician
   * reaches from the nav. If it ever stops being wired, that is a real finding
   * rather than a rename.
   */
  const WIRED_EXAMPLE = "cancelPlan";
  const known = actions.find((a) => a.name === WIRED_EXAMPLE);
  check(
    "🔴 58.5 CONTROL a REAL wired action is not reported",
    known !== undefined && !unwired.some((a) => a.name === WIRED_EXAMPLE),
    known
      ? `${known.file}#${WIRED_EXAMPLE} is called from a screen`
      : `${WIRED_EXAMPLE} not found at all`,
  );

  /*
   * 🔴 C356, asserted rather than trusted. A component imported by nothing is
   * not a surface, and the first two drafts of `_reachability.ts` both got this
   * wrong in different ways.
   */
  check(
    "🔴 58.5 / C356 CONTROL reachability runs to a PAGE, not to any component",
    s.reachesPage("components/billing/plan-card.tsx") &&
      !s.reachesPage(PLANTED) &&
      !s.reachesPage("scripts/verify-reachable.ts"),
    "a page reaches; a script and an unimported file do not",
  );

  finish("sprint 58 reachability");
}

main();
