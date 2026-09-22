/**
 * The Content Security Policy, as data, with the reason for every relaxation.
 *
 * ## What this is for
 *
 * Every other security header this product sends is one line and one decision.
 * A CSP is thirteen decisions, and the difference between a good one and a
 * decorative one is whether anybody had to argue for each line. So each
 * directive below carries what it allows and why, and `verify:csp` asserts the
 * shape rather than the string, so a future relaxation is a deliberate edit
 * that fails a gate rather than a quiet one.
 *
 * ## 🔴 WHY THIS PRODUCT CAN AFFORD A STRICT ONE
 *
 * The audit that produced this found no third-party scripts, no external font
 * host, no analytics, no tag manager and one `dangerouslySetInnerHTML` (a QR
 * code the server generates from a server-minted eight character code). That
 * is unusual and it is worth a lot: it means `script-src` can be a nonce and
 * nothing else, which is the only configuration that actually stops an
 * injected `<script>` from running.
 *
 * The one thing it does NOT stop, and nothing does, is a compromised
 * dependency executing inside our own bundle. `strict-dynamic` deliberately
 * trusts what our trusted scripts load, because Next's chunk loader is such a
 * script. That is the accepted limit and it is stated rather than implied.
 */

/**
 * 🔴 The video room is the only third party the BROWSER talks to.
 *
 * `@daily-co/daily-js` runs in call-object mode rather than as a prebuilt
 * iframe, which is a deliberate choice made for the clinical record: prebuilt
 * does not hand you per-participant media tracks, so a session recorded
 * through it captures the clinician and not the patient.
 *
 * The consequence for this file is that Daily's signalling is a direct
 * connection from the page, so `connect-src` has to name it over both https
 * and wss, and its workers and media need `blob:`.
 *
 * ## 🔴 AND THE HOSTS ARE NOT THE ONES ON THE TIN
 *
 * The package in `node_modules` is a 200KB loader. The product is a 1.8MB
 * bundle it DOWNLOADS at join time, from
 * `https://c.daily.co/call-machine/versioned/<version>/static/`, and the hosts
 * that matter are named in the part that was never installed.
 *
 * The first version of this policy was written by reading the installed
 * package, found only `daily.co`, and would have blocked every call in
 * production. The downloaded bundle says, in as many words:
 *
 *     getAPIBaseURL = (e) => { if (isProduction(e)) return "https://prod-ks.pluot.blue"; … }
 *
 * `pluot.blue` is Daily's own infrastructure, from before the company was
 * called Daily, and in production it is the signalling API, not a fallback,
 * not a test path, the first branch. A policy naming only `*.daily.co` sends a
 * clinician into a room that cannot connect, with a console error nobody in
 * production ever reads.
 *
 * `docs/DAILY-HOSTS.md` is the audit, `npm run audit:daily-hosts` re-runs it,
 * and `verify:csp` fails when the installed version moves past the audited one
 * so that the re-run is not something anybody has to remember.
 *
 * ## What stays blocked on purpose
 *
 * **Daily's Sentry** (`o77906.ingest.sentry.io`). The SDK reports its own
 * errors to a Sentry we do not control, with whatever context it attaches. The
 * transport is a `fetch` whose rejection the SDK swallows, so blocking it costs
 * a console line and nothing else. Consultation data does not leave here to buy
 * somebody else a stack trace.
 *
 * **WebAssembly** (no `'wasm-unsafe-eval'`). The only wasm in the bundle is
 * Banuba, the background-blur and virtual-background engine, which this product
 * does not turn on. If background effects or Daily's noise cancellation are
 * ever enabled, `script-src` needs `'wasm-unsafe-eval'` and this comment is
 * where you found that out.
 */
const DAILY = "https://*.daily.co";
const DAILY_SOCKET = "wss://*.daily.co";

/**
 * 🔴 Daily's signalling API and its alternate media domains.
 *
 * `pluot.blue` carries the production signalling API and the region lookup.
 * `dailywebrtc.com` and `.net` are the alternates the SDK swaps in when a room
 * URL is served from one of them; they are Daily's own list, read out of the
 * installed package by `verify:csp`, so an upgrade that adds a fourth goes red
 * rather than quiet.
 *
 * Nothing here widens the threat model. `*.daily.co` already serves a SCRIPT
 * into this origin under `strict-dynamic`; a host that may additionally open a
 * socket is strictly less trusted than one that may run code.
 */
const DAILY_INFRA = [
  "https://*.pluot.blue",
  "wss://*.pluot.blue",
  "https://*.dailywebrtc.com",
  "wss://*.dailywebrtc.com",
  "https://*.dailywebrtc.net",
  "wss://*.dailywebrtc.net",
];

export type CspOptions = {
  /** Per-request, per-response. Never reused, never guessable. */
  nonce: string;
  /**
   * 🔴 THE CLINICIAN'S ROOM, AND THE ONE RELAXATION IN THIS FILE.
   *
   * `isVideoRoom` below decides this from the path. Everything else gets the
   * strict policy.
   */
  videoRoom?: boolean;
};

/**
 * 🔴 WHICH PATHS RUN DAILY'S CODE IN OUR OWN ORIGIN.
 *
 * Exactly one, and the asymmetry is the point:
 *
 *   - the CLINICIAN at `/sessions/:id/room` runs daily-js in call-object mode,
 *     so Daily's client executes inside this origin and our `script-src`
 *     governs it;
 *   - the PATIENT at `/join/:token` gets an IFRAME on `*.daily.co`, which is a
 *     separate origin running under its own policy. Ours reaches it only
 *     through `frame-src`, which already allows the host.
 *
 * So the relaxation costs one route rather than the product. `verify:csp`
 * asserts that only one component imports daily-js and only one page renders
 * it, which is what stops this quietly becoming two.
 */
export function isVideoRoom(pathname: string): boolean {
  return /^\/sessions\/[^/]+\/room\/?$/.test(pathname);
}

export function contentSecurityPolicy({ nonce, videoRoom = false }: CspOptions): string {
  const directives: Record<string, string[]> = {
    /* Nothing loads from anywhere unless a directive below says otherwise. */
    "default-src": ["'self'"],

    /*
     * 🔴 THE ONE THAT MATTERS. A nonce and `strict-dynamic`, no host list.
     *
     * An injected `<script>` has no nonce, so it does not run, and adding a
     * host to an allow-list cannot accidentally re-enable it. `strict-dynamic`
     * is what lets Next's own bootstrap load the chunks it needs: a script we
     * trusted may load more, and nothing else may.
     *
     * There is no `'unsafe-inline'` and no `'unsafe-eval'` here, and if either
     * ever appears this policy has stopped being a control and become a
     * decoration. `verify:csp` fails on both.
     */
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      /*
       * 🔴 `'unsafe-eval'`, ON THE CLINICIAN'S ROOM ALONE, AND HERE IS THE PROOF.
       *
       * `@daily-co/daily-js` downloads its 1.8MB call machine as TEXT and
       * compiles it with the Function constructor. From the installed package:
       *
       *     Function('"use strict";' + i)(...)
       *
       * That is `unsafe-eval` by definition. It is not a fallback we can avoid
       * and it is not something a setting turns off: it is how the SDK loads
       * the thing that holds the call.
       *
       * This was found the expensive way. The first audit of this dependency
       * grepped for `eval(` and `new Function` and reported neither, which was
       * true and useless, because `Function(...)` without `new` is the same
       * capability. What caught it was a live session and a console. Recorded
       * in `docs/TRAPS.md` and in `docs/DAILY-HOSTS.md`.
       *
       * What it costs, stated rather than waved at: an injected `<script>`
       * still cannot run, because it carries no nonce and `strict-dynamic`
       * trusts only what a trusted script loads. What opens is the narrower
       * hole of a script we DO trust being made to compile attacker-controlled
       * text. Every other directive stays enforcing on this route.
       *
       * The alternative was report-only on the whole product, which is no
       * policy at all, so this is the trade and it is one route wide.
       */
      ...(videoRoom ? ["'unsafe-eval'"] : []),
    ],

    /*
     * 🔴 `'unsafe-inline'` FOR STYLES, AND THIS IS THE HONEST WEAK SPOT.
     *
     * React writes the `style` attribute for every inline style in the tree,
     * and a nonce cannot cover a style ATTRIBUTE, only a `<style>` element. The
     * hero backgrounds alone are `style={{ backgroundImage: url(...) }}`.
     *
     * What this costs is bounded and worth naming: CSS injection can restyle
     * and can exfiltrate through a background image URL, but it cannot execute.
     * The value that reaches those declarations goes through
     * `lib/content/url.ts`, which REJECTS rather than escapes anything with a
     * quote, a parenthesis, a backslash or whitespace, and is applied both on
     * save and at render.
     */
    "style-src": ["'self'", "'unsafe-inline'"],

    /*
     * `https:` because an administrator may set any absolute image URL as a
     * section background, validated by `lib/content/url.ts`. An image cannot
     * execute; the cost of the breadth is that a background could beacon to a
     * third party, which is a thing an administrator can already do.
     * `blob:` is object URLs: the avatar preview before an upload finishes.
     */
    "img-src": ["'self'", "data:", "blob:", "https:"],

    /* `next/font` self hosts and there is no external font host. */
    "font-src": ["'self'", "data:"],

    /* Recorded audio played back from an object URL, and Daily's media. */
    "media-src": ["'self'", "blob:", DAILY],

    "connect-src": ["'self'", DAILY, DAILY_SOCKET, ...DAILY_INFRA],

    /* Daily builds its workers from blobs. */
    "worker-src": ["'self'", "blob:"],

    /*
     * No frames of our own, and Daily only if call-object mode ever falls back.
     * Kept narrow rather than removed, because a room that silently refuses to
     * load is a clinician sitting in an empty call.
     */
    "frame-src": ["'self'", DAILY],

    /* 🔴 The modern form of X-Frame-Options, which is also still sent. */
    "frame-ancestors": ["'none'"],

    /* No Flash, no applets, no `<object>`. There is no reason for any. */
    "object-src": ["'none'"],

    /* An injected `<base>` can redirect every relative URL on the page. */
    "base-uri": ["'self'"],

    /* A form cannot be made to post a session elsewhere. */
    "form-action": ["'self'"],

    "manifest-src": ["'self'"],
  };

  const rendered = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return `${rendered}; upgrade-insecure-requests`;
}

/**
 * 🔴 WHICH HEADER NAME, and why it is not a coin flip.
 *
 * A CSP that white screens the product is worse than none, because the next
 * person to try one inherits the story rather than the policy. Report-only is
 * how you find out what breaks without finding out in front of a patient.
 *
 * `CSP_ENFORCE=0` puts it back into report-only without a deploy of code.
 * There is no third state: it is enforcing unless somebody deliberately turned
 * that off, so a forgotten environment variable fails safe rather than open.
 */
export function cspHeaderName(): "content-security-policy" | "content-security-policy-report-only" {
  return process.env.CSP_ENFORCE === "0"
    ? "content-security-policy-report-only"
    : "content-security-policy";
}
