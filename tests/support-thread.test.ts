import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { senderThread } from "../lib/support/sender-thread";

/**
 * Board 588: the reply page led with the internal close summary under "Our
 * reply" and put the real answer below it under "Update", and kept "Enter the
 * code we sent you" after the code was accepted.
 */
test("board 588 the sender reads our answers oldest first, the close after them, and no bookkeeping", () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 8, 26, 2, minute));
  const thread = senderThread([
    { kind: "closed", actorUserId: "op", note: "Answered: first documents deleted.", createdAt: at(30) },
    { kind: "replied", actorUserId: null, note: "They replied, the clock restarts", createdAt: at(20) },
    { kind: "replied", actorUserId: "op", note: "Your documents were deleted after the second review.", createdAt: at(10) },
    { kind: "claimed", actorUserId: "op", note: null, createdAt: at(5) },
  ]);
  assert.deepEqual(
    thread.map((entry) => [entry.kind, entry.note]),
    [
      ["reply", "Your documents were deleted after the second review."],
      ["closed", "Answered: first documents deleted."],
    ],
  );
});

test("board 588 the code prompt is part of the code form, not the page", () => {
  assert.doesNotMatch(readFileSync("app/support/[token]/page.tsx", "utf8"), /t\("ttk\.body"\)/);
  assert.match(readFileSync("components/support/ticket-reader.tsx", "utf8"), /t\("ttk\.body"\)/);
});
