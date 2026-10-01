import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { CONFIRM_FLAG, confirmationRefusal, isDestructive, type Allowed } from "../scripts/_production-confirm";

const HOST = "ep-wild-lake-a6tgm2r6-pooler.us-west-2.aws.neon.tech";
const SOURCE = readFileSync("scripts/on-production.ts", "utf8");

/** One allow-list entry's body, read from the source (the script runs when imported). */
function entry(name: string): string | null {
  const quoted = name.replace(/[:\-]/g, (c) => `\\${c}`);
  const match = SOURCE.match(new RegExp(`^\\s*"?${quoted}"?:\\s*\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)?)\\}`, "m"));
  return match?.[1] ?? null;
}

test("every command that deletes or rewrites production data is marked", () => {
  for (const name of ["seed:demo", "sim:clock", "age", "ship:content", "settings:reprice", "content:sync", "blobs:migrate-private"]) {
    const body = entry(name);
    assert.ok(body, `${name} is not on the allow-list`);
    assert.match(body!, /destroys:/, `${name} is not marked as destructive`);
  }
  for (const name of ["settings:seed", "db:migrate", "db:status", "verify:migrations", "baseline", "settings:show"]) {
    const body = entry(name);
    assert.ok(body, `${name} is not on the allow-list`);
    assert.doesNotMatch(body!, /destroys:/, `${name} should run without the confirmation`);
  }
  assert.match(entry("db:status")!, /writes: false/, "db:status only reads");
  assert.match(entry("blobs:migrate-private")!, /destroys: \{ onlyWith: "--apply" \}/);
});

test("a destructive command needs both the typed flag and CONFIRM_PRODUCTION naming the host", () => {
  const demo: Allowed = { writes: true, why: "", destroys: true };
  assert.match(confirmationRefusal(demo, [], undefined, HOST) ?? "", /flag.*and CONFIRM_PRODUCTION/);
  assert.match(confirmationRefusal(demo, [CONFIRM_FLAG], undefined, HOST) ?? "", /CONFIRM_PRODUCTION/);
  assert.match(confirmationRefusal(demo, [], HOST, HOST) ?? "", /flag/);
  assert.ok(confirmationRefusal(demo, [CONFIRM_FLAG], "ep-wild-lake-a6tgm2r6", HOST), "a partial host is not the host");
  assert.equal(confirmationRefusal(demo, ["--scenario=event", CONFIRM_FLAG], HOST, HOST), null);
});

test("a dry run is not destructive, and a move is only with --apply", () => {
  const sync: Allowed = { writes: true, why: "", destroys: { unless: ["--dry"] } };
  const move: Allowed = { writes: true, why: "", destroys: { onlyWith: "--apply" } };
  const seed: Allowed = { writes: true, why: "" };
  assert.equal(isDestructive(sync, ["home", "--dry"]), false);
  assert.equal(isDestructive(sync, ["home"]), true);
  assert.equal(isDestructive(move, []), false);
  assert.equal(isDestructive(move, ["--apply"]), true);
  assert.equal(confirmationRefusal(seed, [], undefined, HOST), null);
});

test("the refusal runs before the child, the flag is not forwarded, and the child does not inherit the confirmation", () => {
  assert.ok(SOURCE.indexOf("confirmationRefusal(entry, rest") < SOURCE.indexOf("spawnSync("), "the check is after the spawn");
  assert.match(SOURCE, /const forwarded = rest\.filter\(\(arg\) => arg !== CONFIRM_FLAG\);/);
  assert.match(SOURCE, /delete env\.CONFIRM_PRODUCTION;/);
  assert.match(SOURCE, /\["run", command, "--", \.\.\.forwarded\]/);
});

test("the build does not seed production settings", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  for (const name of ["prebuild", "build", "postbuild"]) {
    assert.doesNotMatch(pkg.scripts[name] ?? "", /settings|seed|migrate/, `${name} writes to a database`);
  }
});
