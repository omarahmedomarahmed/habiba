import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BACKGROUND_HEADER, isUserActivity } from "../lib/auth/activity";

/* DD-2 B2.5: which requests are a person, and so move the idle clock. */

const headers = (values: Record<string, string>) => new Headers(values);
const tree = (root: unknown[]) => encodeURIComponent(JSON.stringify(root));
const source = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");

test("a page opened, a link followed and a form sent are activity", () => {
  assert.equal(isUserActivity(headers({})), true);
  assert.equal(isUserActivity(headers({ "sec-fetch-mode": "navigate" })), true);
  assert.equal(isUserActivity(headers({ "next-action": "abc123" })), true);
  /* A client navigation: the tree is sent, the root is not marked for a refetch. */
  assert.equal(isUserActivity(headers({ rsc: "1", "next-router-state-tree": tree(["", {}, null, null, true]) })), true);
  /* A keep-alive the note editor sends because somebody typed carries no background mark. */
  assert.equal(isUserActivity(headers({ "content-type": "application/json" })), true);
});

test("polls, keep-alives, prefetches and self-refreshing pages are not", () => {
  assert.equal(isUserActivity(headers({ [BACKGROUND_HEADER]: "1" })), false);
  assert.equal(isUserActivity(headers({ rsc: "1", "next-router-prefetch": "1" })), false);
  assert.equal(isUserActivity(headers({ "sec-purpose": "prefetch;prerender" })), false);
  assert.equal(isUserActivity(headers({ purpose: "prefetch" })), false);
  /* router.refresh() sends the whole tree with the root marked "refetch". */
  assert.equal(isUserActivity(headers({ rsc: "1", "next-router-state-tree": tree(["", {}, null, "refetch", true]) })), false);
});

test("a malformed tree is not a reason to stop counting a person", () => {
  assert.equal(isUserActivity(headers({ rsc: "1", "next-router-state-tree": "%E0%A4%A" })), true);
  assert.equal(isUserActivity(headers({ [BACKGROUND_HEADER]: "0" })), true);
});

test("the room and the polls are marked, and only a live session keeps a sign in alive", () => {
  const room = source("components/session/session-room.tsx");
  assert.doesNotMatch(room, /await fetch\(`\/api\/sessions/, "a room request still counts as the clinician");
  assert.match(room, /backgroundFetch\(`\/api\/sessions\/\$\{props\.sessionId\}\/state/);
  for (const path of ["components/copilot/chat.tsx", "components/admin/radar-command.tsx"]) {
    assert.match(source(path), /backgroundFetch\(/, path);
  }
  const state = source("app/api/sessions/[id]/state/route.ts");
  assert.match(state, /if \(row\.status === "in_progress"\) await keepSessionAlive\(\)/);

  const session = source("lib/auth/session.ts");
  assert.match(session, /touch: isUserActivity\(await headers\(\)\)/);
  assert.match(session, /if \(touch && now\.getTime\(\) - row\.lastSeenAt\.getTime\(\) > TOUCH_THROTTLE_MS\)/);
  for (const path of ["lib/patient-auth/session.ts", "lib/clinic-auth/session.ts", "lib/sponsor-auth/session.ts", "lib/partner-auth/session.ts"]) {
    assert.match(source(path), /isUserActivity\(await headers\(\)\)/, path);
  }

  const review = source("components/session/note-review.tsx");
  assert.match(review, /if \(Date\.now\(\) - typedAt\.current > KEEP_ALIVE_MS\) return;/, "the note editor pings whether or not anybody typed");
});
