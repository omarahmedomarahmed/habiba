-- Sprint 36 — session sources, and a third door on ingestion.
--
-- Design only: no bots ship in this sprint (36.3). What ships is the SHAPE,
-- and the shape is chosen so that sprint 41's hard rule is cheap rather than
-- remembered.

-- 🔴 36.1 / 41.1 — one row per session, and it cannot describe a meeting we
-- did not create.
--
-- The rule 41 has to keep is: *the bot joins meetings 24Therapy created for a
-- session. Nothing else. Ever.* A table that can represent a meeting somebody
-- pasted in turns that rule back into a convention, so this one cannot:
--
--   - There is **no column for a link somebody typed.** No `meeting_url` a
--     clinician can paste, no invite text, nothing free-form that resolves to
--     a room. `external_meeting_id` is a provider's id for a meeting, and the
--     only code that may write one is the code that made it.
--   - There is **no column that could hold a calendar** (C132). No
--     `calendar_event_id`, no `ics_uid`, no `organizer_email`. A reader who
--     wanted to join meetings from a diary would have to add a column, in a
--     migration, with their name on it. `verify:sprint36` scans for that
--     shape and proves the scan is not blind.
--   - An external kind must carry `provisioned_at` and `provisioned_by_user_id`
--     — "we made this, on this date, through this clinician's connection" —
--     enforced by CHECK rather than by the caller remembering.
--
-- 🔴 The residual, named rather than claimed away: nothing in the database can
-- tell whether `provisioned_at` was set by the meeting-creating code path or
-- by a future caller that lies. What the schema removes is every *easy* way to
-- represent a foreign meeting, and every column that would make reading a
-- calendar convenient. Sprint 41 owns the one writer.
CREATE TABLE IF NOT EXISTS "session_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,

  -- 24t_room · google_meet · zoom · teams · in_person · upload
  "kind" text NOT NULL,

  -- Set only for a meeting WE created inside a clinician's connected account.
  "external_meeting_id" text,
  "provisioned_at" timestamp with time zone,
  "provisioned_by_user_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,

  -- 🔴 36.2 — the third door, scoped to exactly one session.
  --
  -- Hashed, never stored in the clear, expiring, revocable, and counted. It
  -- lives here rather than in its own table because a token that can ingest
  -- must belong to a source, and a source cannot describe a foreign meeting:
  -- token -> source -> a meeting we created. One chain, checked by the
  -- database, instead of three rules in three files.
  "ingest_token_hash" text,
  "ingest_token_expires_at" timestamp with time zone,
  "ingest_token_revoked_at" timestamp with time zone,
  "ingest_uses" integer DEFAULT 0 NOT NULL,
  "ingest_last_used_at" timestamp with time zone,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One source per session. A session with two sources is a session whose audio
-- could arrive from two places, which is 41.7's "bot in the wrong meeting"
-- with the safety catch removed.
CREATE UNIQUE INDEX IF NOT EXISTS "session_sources_session_unique"
  ON "session_sources" ("session_id");

CREATE INDEX IF NOT EXISTS "session_sources_org_idx"
  ON "session_sources" ("organization_id", "created_at");

-- A token is looked up by its hash, on every chunk of audio.
CREATE UNIQUE INDEX IF NOT EXISTS "session_sources_ingest_token_unique"
  ON "session_sources" ("ingest_token_hash")
  WHERE "ingest_token_hash" IS NOT NULL;

ALTER TABLE "session_sources" DROP CONSTRAINT IF EXISTS "session_sources_kind";
ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_kind"
  CHECK ("kind" IN ('24t_room', 'google_meet', 'zoom', 'teams', 'in_person', 'upload')) NOT VALID;
ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_kind";

-- 🔴 An external meeting says who made it and when, or it is not a row.
ALTER TABLE "session_sources" DROP CONSTRAINT IF EXISTS "session_sources_external_is_provisioned";
ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_external_is_provisioned"
  CHECK (
    CASE WHEN "kind" IN ('google_meet', 'zoom', 'teams')
      THEN "external_meeting_id" IS NOT NULL
        AND "provisioned_at" IS NOT NULL
        AND "provisioned_by_user_id" IS NOT NULL
      ELSE "external_meeting_id" IS NULL
        AND "provisioned_at" IS NULL
        AND "provisioned_by_user_id" IS NULL
    END
  ) NOT VALID;
ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_external_is_provisioned";

-- A token is a hash and an expiry together, or neither.
ALTER TABLE "session_sources" DROP CONSTRAINT IF EXISTS "session_sources_token_pair";
ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_token_pair"
  CHECK (("ingest_token_hash" IS NULL) = ("ingest_token_expires_at" IS NULL)) NOT VALID;
ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_token_pair";

-- 🔴 The token is a HASH. A column holding something that looks like the token
-- itself is the mistake this forecloses: 64 hex characters, nothing else.
ALTER TABLE "session_sources" DROP CONSTRAINT IF EXISTS "session_sources_token_is_hashed";
ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_token_is_hashed"
  CHECK ("ingest_token_hash" IS NULL OR "ingest_token_hash" ~ '^[0-9a-f]{64}$') NOT VALID;
ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_token_is_hashed";

-- 🔴 A source is never re-pointed at a different meeting.
--
-- 41.7 makes "the bot in the wrong meeting" a hard stop. The cheapest version
-- of that is for the row to be unable to change which meeting it describes
-- after anybody has relied on it: the kind, the session and the meeting id are
-- fixed at insert. Everything about the TOKEN stays mutable, because minting,
-- expiring and revoking are the normal life of the thing.
CREATE OR REPLACE FUNCTION "session_sources_identity_is_fixed"() RETURNS trigger AS $$
BEGIN
  IF NEW."session_id" IS DISTINCT FROM OLD."session_id"
     OR NEW."kind" IS DISTINCT FROM OLD."kind"
     OR NEW."external_meeting_id" IS DISTINCT FROM OLD."external_meeting_id"
     OR NEW."provisioned_by_user_id" IS DISTINCT FROM OLD."provisioned_by_user_id" THEN
    RAISE EXCEPTION 'a session source cannot be re-pointed at another meeting: delete it and create one'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "session_sources_no_repoint" ON "session_sources";
CREATE TRIGGER "session_sources_no_repoint"
  BEFORE UPDATE ON "session_sources"
  FOR EACH ROW EXECUTE FUNCTION "session_sources_identity_is_fixed"();
