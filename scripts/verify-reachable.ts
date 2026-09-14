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
import { loadSurfaces, serverActions, unwiredActions, apiRoutes, uncalledRoutes, routePath, pages, unlinkedPages, pagePath } from "./_surfaces";
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

const PAGES_BY_DESIGN: Record<string, string> = {};

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

  check(
    "🔴 58.4 no allowlist entry has stopped being an orphan",
    staleRoutes.length === 0 && stalePages.length === 0 && staleActions.length === 0,
    [...staleRoutes, ...stalePages, ...staleActions].join(" · ") || "every exemption still earns its place",
  );

  check(
    "58.4 …and every exemption carries a reason somebody can act on",
    [
      ...Object.values(ROUTES_BY_DESIGN),
      ...Object.values(PAGES_BY_DESIGN),
      ...Object.values(ACTIONS_BY_DESIGN),
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
  const known = actions.find((a) => a.name === "subscribeTo");
  check(
    "🔴 58.5 CONTROL a REAL wired action is not reported",
    known !== undefined && !unwired.some((a) => a.name === "subscribeTo"),
    known ? `${known.file}#subscribeTo is called from a screen` : "subscribeTo not found at all",
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
