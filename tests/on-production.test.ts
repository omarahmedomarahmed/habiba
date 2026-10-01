import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ALLOWED, CONFIRM_FLAG, confirmationRefusal, isDestructive } from "../scripts/on-production";

const HOST = "ep-wild-lake-a6tgm2r6-pooler.us-west-2.aws.neon.tech";

test("every command that deletes or rewrites production data is marked", () => {
  for (const name of ["seed:demo", "sim:clock", "age", "ship:content", "settings:reprice", "content:sync", "blobs:migrate-private"]) {
    assert.ok(ALLOWED[name]?.destroys, `${name} is not marked as destructive`);
  }
  for (const name of ["settings:seed", "db:migrate", "db:status", "verify:migrations", "baseline", "settings:show"]) {
    assert.equal(ALLOWED[name]?.destroys, undefined, `${name} should run without the confirmation`);
  }
  assert.equal(ALLOWED["db:status"]?.writes, false, "db:status only reads");
});

test("a destructive command needs both the typed flag and CONFIRM_PRODUCTION naming the host", () => {
  const demo = ALLOWED["seed:demo"]!;
  assert.match(confirmationRefusal(demo, [], undefined, HOST) ?? "", /flag.*and CONFIRM_PRODUCTION/);
  assert.match(confirmationRefusal(demo, [CONFIRM_FLAG], undefined, HOST) ?? "", /CONFIRM_PRODUCTION/);
  assert.match(confirmationRefusal(demo, [], HOST, HOST) ?? "", /flag/);
  assert.ok(confirmationRefusal(demo, [CONFIRM_FLAG], "ep-wild-lake-a6tgm2r6", HOST), "a partial host is not the host");
  assert.equal(confirmationRefusal(demo, ["--scenario=event", CONFIRM_FLAG], HOST, HOST), null);
});

test("a dry run is not destructive, and the blob move is only with --apply", () => {
  assert.equal(isDestructive(ALLOWED["content:sync"]!, ["home", "--dry"]), false);
  assert.equal(isDestructive(ALLOWED["content:sync"]!, ["home"]), true);
  assert.equal(isDestructive(ALLOWED["sim:clock"]!, ["--show"]), false);
  assert.equal(isDestructive(ALLOWED["blobs:migrate-private"]!, []), false);
  assert.equal(isDestructive(ALLOWED["blobs:migrate-private"]!, ["--apply"]), true);
  assert.equal(confirmationRefusal(ALLOWED["settings:seed"]!, [], undefined, HOST), null);
});

test("the flag is not forwarded to the command, and the child does not inherit the confirmation", () => {
  const source = readFileSync("scripts/on-production.ts", "utf8");
  assert.match(source, /const forwarded = rest\.filter\(\(arg\) => arg !== CONFIRM_FLAG\);/);
  assert.match(source, /delete env\.CONFIRM_PRODUCTION;/);
  assert.match(source, /\["run", command, "--", \.\.\.forwarded\]/);
});

test("the build does not seed production settings", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  for (const name of ["prebuild", "build", "postbuild"]) {
    assert.doesNotMatch(pkg.scripts[name] ?? "", /settings|seed|migrate/, `${name} writes to a database`);
  }
});
