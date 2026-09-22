/**
 * Every host the video room actually talks to, read out of the bundle it
 * downloads rather than the package we installed.
 *
 *     npm run audit:daily-hosts           # print what the bundle names
 *     npm run audit:daily-hosts -- --write  # and update docs/DAILY-HOSTS.md
 *
 * ## 🔴 WHY THIS EXISTS
 *
 * `@daily-co/daily-js` in `node_modules` is a loader. At join time it appends
 * a `<script>` pointing at
 * `https://c.daily.co/call-machine/versioned/<version>/static/call-machine-object-bundle.js`,
 * and THAT is the product: 1.8MB, nine times the size of the package, and the
 * only place the hosts are written down.
 *
 * A content policy written from the installed package names `daily.co` and
 * blocks the production signalling API, which lives on `pluot.blue`. The room
 * then fails to connect with a console error, in front of a patient, on a
 * screen nobody is watching the console of.
 *
 * So this is not a one-off. It runs against whatever version is installed,
 * writes what it found into `docs/DAILY-HOSTS.md`, and `verify:csp` fails when
 * the installed version has moved past the audited one, which turns "somebody
 * should re-check this after an upgrade" into a red line.
 *
 * ## It needs the network
 *
 * Deliberately not a gate. A gate that fails when a CDN is slow teaches people
 * to ignore gates. The gate checks the RECORD; this writes it.
 */
import { readFileSync, writeFileSync } from "node:fs";

const PACKAGE = "node_modules/@daily-co/daily-js";
const DOC = "docs/DAILY-HOSTS.md";

/** Hosts every bundle mentions that are documentation, not destinations. */
const PROSE = new Set([
  "www.webrtc.org",
  "www.ietf.org",
  "www.w3.org",
  "github.com",
  "gist.github.com",
  "chromium.googlesource.com",
  "developer.mozilla.org",
  "redux.js.org",
  "www.shadertoy.com",
  "docs.banuba.com",
  "aomediacodec.github.io",
  "www.example.com",
  "dashboard.daily.co",
  "nonexistent.uri.you.know.daily.co",
]);

/** Fragments of minified identifiers that look like hostnames and are not. */
const NOT_A_HOST = /^[a-z]\.(cloud|dev|app|co|com|net|io)$/;

/**
 * 🔴 THE DECISION FOR EVERY WILDCARD THE BUNDLE NAMES.
 *
 * A host in the bundle with no entry here is written out as `unclassified` and
 * `verify:csp` fails on it. That is the whole point: an upgrade that introduces
 * a new Daily host cannot land as a quiet line in a diff, because nothing in
 * this file guesses. Somebody reads what it is for and writes it down.
 */
const DECIDED: Record<string, { allow: boolean; why: string }> = {
  "*.daily.co": { allow: true, why: "the bundle, geo lookup, rooms and media" },
  "daily.co": { allow: true, why: "the SDK's default domain" },
  "*.pluot.blue": { allow: true, why: "the production signalling API and region lookup" },
  "dailywebrtc.com": { allow: true, why: "an alternate room domain the SDK swaps in" },
  "dailywebrtc.net": { allow: true, why: "an alternate room domain the SDK swaps in" },
  "*.pluot.co": {
    allow: false,
    why: "compared against, never fetched: an origin fallback and the staging test",
  },
  "pluot.tv": { allow: false, why: "compared against in the legacy origin test, never fetched" },
  "*.google.com": {
    allow: false,
    why: "the default STUN server, which connect-src does not govern",
  },
};

export function installedVersion(): string {
  return JSON.parse(readFileSync(`${PACKAGE}/package.json`, "utf8")).version as string;
}

/**
 * Daily's own list of domains it will serve itself from, lifted out of the
 * installed loader. An upgrade that adds a fourth is a policy change.
 */
export function sdkDomains(): string[] {
  const source = readFileSync(`${PACKAGE}/dist/daily-iframe-esm.js`, "utf8");
  const found = source.match(/\["daily\.co"(?:,"[a-z0-9.-]+")+\]/);
  if (!found) throw new Error("the SDK's domain list is no longer an array literal of strings");
  return (JSON.parse(found[0]) as string[]).sort();
}

function bundleUrl(version = installedVersion()): string {
  return `https://c.daily.co/call-machine/versioned/${version}/static/call-machine-object-bundle.js`;
}

/** Every registrable-looking hostname in a blob of minified JavaScript. */
function hostsIn(source: string): string[] {
  const matches = source.match(/\b[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\b/g);
  const tlds = /\.(co|com|net|io|blue|org|dev|app|cloud|tv|me)$/;
  const hosts = new Set<string>();

  for (const candidate of matches ?? []) {
    if (!tlds.test(candidate)) continue;
    if (NOT_A_HOST.test(candidate)) continue;
    if (PROSE.has(candidate)) continue;
    hosts.add(candidate);
  }

  return [...hosts].sort();
}

/** The wildcard a host belongs under, which is what a policy can actually name. */
function wildcardFor(host: string): string {
  const parts = host.split(".");
  return parts.length > 2 ? `*.${parts.slice(-2).join(".")}` : host;
}

async function main() {
  const version = installedVersion();
  const url = bundleUrl(version);

  console.log(`daily-js ${version}`);
  console.log(`bundle   ${url}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`FAIL  the bundle for ${version} answered ${response.status}`);
    process.exit(1);
  }
  const bundle = await response.text();

  const hosts = hostsIn(bundle);
  const wildcards = [...new Set(hosts.map(wildcardFor))].sort();

  console.log("hosts named in the downloaded bundle");
  for (const host of hosts) console.log(`  ${host}`);

  const lines = wildcards.map((card) => {
    const decision = DECIDED[card];
    if (!decision) return `unclassified ${card}`;
    return `${decision.allow ? "allow" : "noted"} ${card} · ${decision.why}`;
  });

  console.log("\nwildcards, and the decision for each");
  for (const line of lines) console.log(`  ${line}`);

  console.log("\nthe SDK's own domain list");
  for (const domain of sdkDomains()) console.log(`  ${domain}`);

  const unclassified = lines.filter((line) => line.startsWith("unclassified "));
  if (unclassified.length > 0) {
    console.log(
      `\n🔴 ${unclassified.length} host(s) this audit has no decision for. Add each to DECIDED in this file with what it is for.`,
    );
  }

  if (!process.argv.includes("--write")) {
    console.log(`\nnot written. re-run with -- --write to update ${DOC}`);
    return;
  }

  const doc = readFileSync(DOC, "utf8");
  const block = [
    "```audited",
    `daily-js ${version}`,
    `bundle ${Math.round(bundle.length / 1024)}KB`,
    ...lines,
    "```",
  ].join("\n");

  const replaced = doc.replace(/```audited\n[\s\S]*?\n```/, block);
  if (replaced === doc) {
    console.error(`\nFAIL  ${DOC} has no \`\`\`audited block to replace`);
    process.exit(1);
  }

  writeFileSync(DOC, replaced);
  console.log(`\nwrote the audited block in ${DOC}`);
}

if (process.argv[1]?.endsWith("audit-daily-hosts.ts")) main();
