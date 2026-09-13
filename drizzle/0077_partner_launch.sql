-- 0077 — the launch token. PLAN.md 42.3, 55.9. Additive.
--
-- 🔴 THIS TABLE EXISTS BECAUSE THE FIRST DESIGN OF THE LAUNCH COULD NOT WORK.
--
-- `POST /api/partner/v1/launch` is called by the PARTNER'S SERVER. The first version of
-- `lib/partner/launch.ts` minted an `auth_sessions` row and called `cookies().set()`, which
-- attaches `Set-Cookie` to the response of the request being handled — and that response goes
-- back to the partner's server. The partner's server would have held the clinician's session
-- cookie, and the clinician's browser would never have received one: a 200, a URL that lands
-- on a sign-in form, and a live session credential sitting in somebody else's HTTP client.
--
-- Nothing would have errored. That is the shape of it: an endpoint returning success, a row in
-- `auth_sessions` with the right `partner_id` and `created_via`, and a launch that never signs
-- anybody in. Every check about the row, the audit entry and the response body passes.
--
-- So a launch is two steps, which is also how SMART on FHIR does it and what sprint 43 will
-- need: the server call mints a short single-use token and returns a URL, and the clinician's
-- BROWSER opens that URL, where the cookie is set on the response to their own navigation.
--
-- 🔴 SINGLE USE, ENFORCED BY A CONDITIONAL UPDATE IN THE APPLICATION, and the column is here
-- to make that possible: `used_at IS NULL` in a WHERE is what makes two browsers racing on one
-- URL produce one session and one refusal. A check-then-write would produce two sessions and
-- no error anywhere.
--
-- 🔴 NO CHECK CONSTRAINT ON `target`, and that is considered rather than skipped. The allow
-- list is four paths in one function and the column is written only by it; a CHECK repeating
-- those four strings would be a second list to keep in step, and the first thing that happens
-- when a fifth screen is added is that somebody edits the function and not the constraint. The
-- constraint that matters is that the value is resolved BEFORE it is stored, which is a shape
-- in the code rather than a rule in the database.

CREATE TABLE IF NOT EXISTS "partner_launch_tokens" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "user_id"    uuid NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
  -- 42.7 — which key asked, so the audit can say "their server, on behalf of Dr X".
  -- SET NULL rather than CASCADE: a revoked key must not delete the record that it launched.
  "key_id"     uuid REFERENCES "partner_api_keys"("id")  ON DELETE SET NULL,

  "token_hash" text NOT NULL,
  -- Already resolved through the allow list. Never a caller's string.
  "target"     text NOT NULL,

  "expires_at" timestamptz NOT NULL,
  -- Stamped by a conditional UPDATE. A used token opens nothing.
  "used_at"    timestamptz,

  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- 🔴 UNIQUE on the hash, so the conditional UPDATE matches at most one row whatever else is
-- true. Without it, a hash collision or a duplicated insert would make "claim the token" a
-- statement that could touch two rows and return two sessions.
CREATE UNIQUE INDEX IF NOT EXISTS "partner_launch_tokens_hash_unique"
  ON "partner_launch_tokens" ("token_hash");

-- For the sweep that clears expired rows. Two minutes each, so there are many of them.
CREATE INDEX IF NOT EXISTS "partner_launch_tokens_expiry_idx"
  ON "partner_launch_tokens" ("expires_at");
