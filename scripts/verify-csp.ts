/**
 * The Content Security Policy is still a control, not a decoration.
 *
 *     npm run verify:csp
 *
 * ## What this is for
 *
 * A CSP decays in one direction. Something breaks, somebody adds
 * `'unsafe-inline'` to make it work, and the policy keeps being sent and keeps
 * being listed in the security review while no longer stopping the thing it
 * exists to stop. The header is still there, so nobody notices.
 *
 * So the shape is asserted rather than the string: a nonce and
 * `strict-dynamic` in `script-src`, neither unsafe keyword anywhere near it,
 * and the five directives that are cheap and absolute.
 *
 * ## 🔴 AND THE ONE THAT IS NOT ABOUT THE POLICY AT ALL
 *
 * `middleware.ts` has to set the policy on the REQUEST headers as well as the
 * response. Next reads it off the request to stamp the same nonce onto its own
 * bootstrap and chunk loading scripts. Delete that one line and every script
 * Next writes loses its nonce, so `script-src` refuses all of them and the
 * product serves a white page, with a perfectly correct looking header on it.
 *
 * That is the single most expensive mistake available here, it is one line,
 * and it is invisible to every other check in this repository.
 */
import { readFileSync } from "node:fs";

import { contentSecurityPolicy, isVideoRoom } from "../lib/security/csp";
import { installedVersion, sdkDomains } from "./audit-daily-hosts";
import { readSource, reporter } from "./_verify";
import { walk } from "./_i18n-coverage";

const { check, finish } = reporter();

const POLICY = contentSecurityPolicy({ nonce: "TESTNONCE" });

function directive(name: string): string[] {
  const found = POLICY.split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ? found.split(/\s+/).slice(1) : [];
}

function main() {
  /* ================================================================== */
  /*  The policy says what it claims to say                             */
  /* ================================================================== */

  const script = directive("script-src");

  check(
    "🔴 script-src is a nonce and strict-dynamic, not a host list",
    script.some((v) => v.startsWith("'nonce-")) && script.includes("'strict-dynamic'"),
    script.join(" ") || "no script-src at all",
  );

  /*
   * 🔴 THE TWO WORDS THAT TURN THIS OFF.
   *
   * `'unsafe-inline'` in `script-src` means an injected `<script>` runs, which
   * is the entire threat a CSP exists for. `'unsafe-eval'` means a string can
   * become code. Either one and the policy is a header rather than a control.
   *
   * Note this is checked on `script-src` alone. `style-src` carries
   * `'unsafe-inline'` deliberately, because React writes style ATTRIBUTES and
   * a nonce cannot cover one, and `lib/security/csp.ts` argues for it there.
   */
  check(
    "🔴 script-src contains neither unsafe keyword",
    !script.includes("'unsafe-inline'") && !script.includes("'unsafe-eval'"),
    script.filter((v) => v.startsWith("'unsafe")).join(" ") || "neither is present",
  );

  const absolutes: [string, string][] = [
    ["frame-ancestors", "'none'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["default-src", "'self'"],
  ];

  const wrong = absolutes.filter(([name, want]) => !directive(name).includes(want));

  check(
    "🔴 the five cheap absolutes are all set",
    wrong.length === 0,
    wrong.map(([n, w]) => `${n} is not ${w}`).join(" · ") ||
      absolutes.map(([n, w]) => `${n} ${w}`).join(" · "),
  );

  /*
   * 🔴 CONTROL. The reader has to be able to find a directive that is absent
   * and read one that is present, or every line above passes on an empty
   * string. Three absences in a row pass just as happily against a parser that
   * returns nothing for everything.
   */
  check(
    "🔴 CONTROL the directive reader finds what is there and misses what is not",
    directive("default-src").includes("'self'") &&
      directive("script-src-elem").length === 0 &&
      directive("connect-src").some((v) => v.includes("daily.co")),
    "default-src reads, an unset directive is empty, and the video host is found",
  );

  /* ================================================================== */
  /*  The wiring that makes the policy survivable                        */
  /* ================================================================== */

  const middleware = readSource("middleware.ts");

  check(
    "🔴 middleware puts the policy on the REQUEST headers, or every page is blank",
    /forwarded\.set\(\s*header\s*,\s*policy\s*\)/.test(middleware) &&
      /forwarded\.set\(\s*"x-nonce"/.test(middleware),
    "Next stamps its own scripts with the nonce it reads off the request",
  );

  check(
    "🔴 the nonce is minted per request from a real source of randomness",
    /crypto\.randomUUID\(\)/.test(middleware) && !/Math\.random/.test(middleware),
    "a nonce that repeats is an allow-list entry an attacker can read off the last page",
  );

  /*
   * 🔴 IT IS ENFORCING UNLESS SOMEBODY TURNED THAT OFF ON PURPOSE.
   *
   * A report-only policy that nobody ever promoted is the most common way a
   * CSP ends up doing nothing, because the header is present in every audit
   * and stops nothing at all. `CSP_ENFORCE=0` is the deliberate way back; a
   * missing variable fails safe.
   */
  const csp = readSource("lib/security/csp.ts");
  check(
    "🔴 report-only is opt IN, so a forgotten variable enforces rather than watches",
    /CSP_ENFORCE\s*===\s*"0"/.test(csp),
    "enforcing by default, report-only only when asked for by name",
  );

  /* ================================================================== */
  /*  The video room's hosts, which are not in the package we installed  */
  /* ================================================================== */

  /*
   * 🔴 THE POLICY WAS WRITTEN FROM THE WRONG FILE ONCE ALREADY.
   *
   * `@daily-co/daily-js` in `node_modules` is a loader. The client is a 1.8MB
   * bundle it downloads at join time, and the production signalling API named
   * in it is `https://prod-ks.pluot.blue`, a host the installed package never
   * mentions. A policy read off the package blocks it, and the symptom is a
   * clinician in a room that never connects.
   *
   * `docs/DAILY-HOSTS.md` carries the audit as data. These checks assert the
   * policy still matches it, and that the audit is not about an older version
   * than the one installed. See `npm run audit:daily-hosts`.
   */
  const audit = readFileSync("docs/DAILY-HOSTS.md", "utf8");
  const block = audit.match(/```audited\n([\s\S]*?)\n```/)?.[1] ?? "";
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const auditedVersion = lines.find((line) => line.startsWith("daily-js "))?.slice(9) ?? "";
  const allowed = lines.filter((l) => l.startsWith("allow ")).map((l) => l.split(" ")[1]);
  const unclassified = lines.filter((line) => line.startsWith("unclassified "));

  const connect = directive("connect-src");

  /*
   * A policy entry `https://*.daily.co` covers the bare `daily.co` too: the
   * SDK uses the bare name as a SUFFIX it builds hosts onto (`c.` + domain),
   * never as a host of its own, so the wildcard is what actually gets used.
   */
  const covered = (host: string, scheme: "https" | "wss") => {
    const bare = host.replace(/^\*\./, "");
    return connect.some((value) => {
      if (!value.startsWith(`${scheme}://`)) return false;
      const named = value.slice(scheme.length + 3);
      return named === host || named === `*.${bare}` || named === bare;
    });
  };

  const missing = allowed.filter((host) => !covered(host, "https") || !covered(host, "wss"));

  check(
    "🔴 every host the audited bundle needs is in connect-src, over https and wss",
    allowed.length > 0 && missing.length === 0,
    missing.length > 0
      ? `missing ${missing.join(" · ")}`
      : allowed.join(" · ") || "the audited block names no allowed host at all",
  );

  check(
    "🔴 the audit is of the version actually installed",
    auditedVersion === installedVersion(),
    auditedVersion === installedVersion()
      ? `daily-js ${auditedVersion}`
      : `docs/DAILY-HOSTS.md audited ${auditedVersion || "nothing"}, installed is ${installedVersion()}. Run: npm run audit:daily-hosts -- --write`,
  );

  check(
    "🔴 every host the bundle names has a decision written against it",
    unclassified.length === 0,
    unclassified.join(" · ") || "nothing in the bundle is undecided",
  );

  /*
   * The SDK's own list of domains it will serve itself from, lifted out of the
   * installed package rather than retyped. An upgrade that adds a fourth goes
   * red here rather than arriving as a quiet line in a lockfile diff.
   */
  const domains = sdkDomains();
  const uncoveredDomains = domains.filter((d) => !covered(d, "https") || !covered(d, "wss"));

  check(
    "🔴 the SDK's own domain list is covered, read out of the package not retyped",
    uncoveredDomains.length === 0,
    uncoveredDomains.length > 0 ? `missing ${uncoveredDomains.join(" · ")}` : domains.join(" · "),
  );

  /*
   * 🔴 CONTROL. The coverage test has to say no to something. Four "is it
   * covered" passes in a row read exactly the same against a matcher that
   * returns true for everything, which is the shape of every trap in
   * `docs/TRAPS.md`.
   */
  check(
    "🔴 CONTROL the coverage test refuses a host the policy does not name",
    covered("*.pluot.blue", "wss") && !covered("*.example.com", "https") && !covered("*.pluot.co", "https"),
    "the signalling host reads as covered, an unnamed host and a noted-but-blocked one do not",
  );

  /* ================================================================== */
  /*  The one relaxation, and the fence around it                        */
  /* ================================================================== */

  /*
   * 🔴 DAILY COMPILES ITS OWN CLIENT FROM A STRING.
   *
   * `@daily-co/daily-js` downloads the call machine as text and runs it
   * through the Function constructor, which is `unsafe-eval` by definition.
   * The first audit of this dependency grepped for `eval(` and `new Function`,
   * found neither, and said so. `Function(...)` without `new` is the same
   * capability, and what caught it was a live session and a console.
   *
   * So the room gets the keyword and nothing else does. These checks are the
   * fence: the exception may not grow a second token, and it may not grow a
   * second route.
   */
  const ROOM = contentSecurityPolicy({ nonce: "TESTNONCE", videoRoom: true });

  const roomScript = (ROOM.split(";").find((p) => p.trim().startsWith("script-src ")) ?? "")
    .trim()
    .split(/\s+/)
    .slice(1);

  check(
    "🔴 the video room is the ONLY place 'unsafe-eval' appears, and it does appear",
    roomScript.includes("'unsafe-eval'") && !POLICY.includes("'unsafe-eval'"),
    "Daily runs its client through the Function constructor; every other route refuses it",
  );

  /*
   * 🔴 AND THE EXCEPTION IS EXACTLY ONE TOKEN WIDE.
   *
   * A relaxation that is allowed to differ in "some" ways is one that grows.
   * The room's policy must be the strict policy plus `'unsafe-eval'` and
   * nothing else at all, compared as whole strings.
   */
  check(
    "🔴 …and the room's policy differs from the strict one by that token alone",
    ROOM.replace(" 'unsafe-eval'", "") === POLICY,
    "every other directive stays exactly as strict on the room as everywhere else",
  );

  /*
   * 🔴 ONE ROUTE, DERIVED RATHER THAN TRUSTED.
   *
   * The matcher is a literal in `lib/security/csp.ts` because middleware runs
   * on the edge and cannot read the file system. So the check is the other
   * way round: assert that daily-js is imported by exactly one component and
   * rendered by exactly one page. A second page that loads Daily goes red
   * here rather than silently running without the keyword it needs, or
   * silently getting one it should have had to argue for.
   */
  const importers = walk("app")
    .concat(walk("components"))
    .filter((file) => /\.tsx?$/.test(file))
    .filter((file) => /@daily-co\/daily-js/.test(readSource(file)));

  check(
    "🔴 exactly one component runs Daily inside our own origin",
    importers.length === 1 && importers[0] === "components/session/video-call.tsx",
    importers.join(" · ") || "nothing imports daily-js, which cannot be right",
  );

  const roomPages = walk("app")
    .filter((file) => file.endsWith("page.tsx"))
    .filter((file) => /components\/session\/session-room/.test(readSource(file)));

  check(
    "🔴 …and exactly one page renders it, the one the matcher covers",
    roomPages.length === 1 && roomPages[0] === "app/(room)/sessions/[id]/room/page.tsx",
    roomPages.join(" · ") || "no page renders the session room",
  );

  /*
   * 🔴 CONTROL. The matcher has to say no. A path test that returns true for
   * everything hands `'unsafe-eval'` to the whole product while every check
   * above still passes.
   */
  check(
    "🔴 CONTROL the route matcher accepts the room and refuses everything else",
    isVideoRoom("/sessions/abc-123/room") &&
      isVideoRoom("/sessions/abc-123/room/") &&
      !isVideoRoom("/sessions/abc-123") &&
      !isVideoRoom("/join/tok") &&
      !isVideoRoom("/") &&
      !isVideoRoom("/sessions/abc/room/extra"),
    "the clinician's room only, and not the patient's join page or anything above it",
  );

  finish("csp");
}

main();
