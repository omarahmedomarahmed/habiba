-- 🔴 76.50 — WE TRIED TO TELL SOMEBODY, AND WHETHER IT LEFT THE BUILDING.
--
-- `notify()` sends on every channel that can carry a message and, when none
-- can, logs one line and returns `{ sent: false }`. Nothing durable was written
-- either way. So the product could not answer the question an operator actually
-- asks about a person who did not turn up:
--
--   "Were they ever told?"
--
-- The application log is not that answer. It expires, it is not queryable
-- beside the session it belongs to, and on the deployment where this matters
-- most it is a line in Vercel's runtime logs nobody will read in six months.
--
-- It became urgent because the simulation runs on production with the email
-- key deliberately OFF, so every one of sixty invented patients gets
-- `no channel available`. Without this table the run produces no evidence at
-- all about a whole half of the product, and "the message did not arrive" and
-- "we never tried" look identical afterwards.
--
-- 🔴 WHAT IT DELIBERATELY DOES NOT STORE: the body.
--
-- Every `kind` in `lib/notify/index.ts` is constrained to carry no clinical
-- content, and this table is not the place to start hoarding message text. §6
-- and C128 both point the same way: what is needed is that an attempt happened,
-- to whom, on which channels, and what came of it. The words are reconstructible
-- from the kind, and the kind is what an operator reasons about.
--
-- The recipient is a REFERENCE rather than an address, for the same reason
-- `audit_log` names patients by reference: a table of who we emailed is a
-- mailing list with a clinical implication attached to it.
CREATE TABLE IF NOT EXISTS "delivery_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  -- The `Message["kind"]` this was. Not constrained to an enum on purpose: the
  -- union grows most sprints and a CHECK here would be a second copy of it that
  -- goes stale, which is H24's shape.
  "kind" text NOT NULL,

  -- 🔴 WHICH HANDLES EXISTED, not what they were. Two booleans answer "could we
  -- have reached them at all", which is the question, without storing an address.
  "had_phone" boolean DEFAULT false NOT NULL,
  "had_email" boolean DEFAULT false NOT NULL,

  -- Channels that actually accepted it. Empty array is the honest record of a
  -- message that went nowhere.
  "channels" jsonb DEFAULT '[]'::jsonb NOT NULL,

  -- `notify()`'s own reason, verbatim, when nothing sent. Null when something did.
  "reason" text,

  -- Who it was about, when the caller knows. Nullable because several kinds are
  -- sent to somebody who has no row anywhere yet: a sponsor contact proving a
  -- domain, a person being invited to claim a record they have not claimed.
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- The two questions asked of it: what happened lately, and what never left.
CREATE INDEX IF NOT EXISTS "delivery_attempts_when_idx"
  ON "delivery_attempts" ("created_at" DESC);

CREATE INDEX IF NOT EXISTS "delivery_attempts_unsent_idx"
  ON "delivery_attempts" ("created_at" DESC)
  WHERE "reason" IS NOT NULL;
