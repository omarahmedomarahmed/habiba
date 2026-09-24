import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_ATTEMPTS, retryWaitMinutes } from "../lib/partner/retry";

/** 🔴 W2-X03: a failed delivery backs off over about three days, then stops. */

test("the first retry is minutes away, not a day", () => {
  assert.equal(retryWaitMinutes(1), 5);
});

test("each wait is at least as long as the one before", () => {
  let previous = 0;
  for (let n = 1; n < MAX_ATTEMPTS; n++) {
    const wait = retryWaitMinutes(n)!;
    assert.ok(wait >= previous, `wait ${n} is ${wait}, after ${previous}`);
    previous = wait;
  }
});

test("the retries span about three days", () => {
  let total = 0;
  for (let n = 1; n < MAX_ATTEMPTS; n++) total += retryWaitMinutes(n)!;
  const days = total / 60 / 24;
  assert.ok(days >= 2.5 && days <= 3.5, `${days.toFixed(2)} days`);
});

test("after the last try there is no next one: the delivery has failed", () => {
  assert.equal(retryWaitMinutes(MAX_ATTEMPTS), null);
  assert.equal(retryWaitMinutes(MAX_ATTEMPTS + 3), null);
});
