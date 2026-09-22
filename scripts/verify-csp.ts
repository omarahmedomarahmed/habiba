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
import { contentSecurityPolicy } from "../lib/security/csp";
import { readSource, reporter } from "./_verify";

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
   * 🔴 CONTROL — the reader has to be able to find a directive that is absent
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

  finish("csp");
}

main();
