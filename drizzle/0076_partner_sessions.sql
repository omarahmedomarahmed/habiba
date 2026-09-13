-- 0076 — a session held on a partner's platform. PLAN.md 55.7, 42.3. Additive.
--
-- 🔴 THIS EXISTS BECAUSE 0075 WAS ALREADY APPLIED, AND THAT IS THE DISCIPLINE.
--
-- The partner plane needed one more value in an enum that 0064 protects with a CHECK, and
-- 0075 had already run. Editing an applied migration is the H1/H16 failure this repository
-- verifies against `information_schema` precisely because `db:migrate` prints success
-- either way. So: forward, in its own file, exactly as 0073 was to 0072.
--
-- 🔴 AND IT IS THE THIRD SPRINT RUNNING THAT THIS PATTERN HAS COME UP.
--
-- `SESSION_SOURCE_KINDS` in schema.ts gained a value; this is where the database learns
-- about it. Sprint 56 shipped an enum extended in TypeScript whose CHECK was not, which
-- made a whole verifier check structurally dead while it read green, and only a CONTROL
-- assertion found it.

ALTER TABLE "session_sources" DROP CONSTRAINT IF EXISTS "session_sources_kind";
ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_kind"
  CHECK ("kind" IN (
    '24t_room', 'google_meet', 'zoom', 'teams', 'in_person', 'upload', 'partner_platform'
  )) NOT VALID;
ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_kind";

-- 🔴 AND THE SECOND CONSTRAINT, which is the one a careless extension would have missed.
--
-- `session_sources_external_is_provisioned` says an external meeting names who made it and
-- when, and anything else has all three columns null. A new external kind that is not in
-- its IN list falls into the ELSE branch, which would have refused every partner session
-- for carrying the partner's own meeting id — a constraint violation at the moment a
-- customer's first writeback arrived, which is the worst possible time to find it.
--
-- `provisioned_by_user_id` is the CLINICIAN who held it. The partner's platform created
-- the meeting, on that clinician's behalf, and naming the clinician keeps the column's
-- meaning intact: who is answerable for this hour existing.
ALTER TABLE "session_sources" DROP CONSTRAINT IF EXISTS "session_sources_external_is_provisioned";
ALTER TABLE "session_sources"
  ADD CONSTRAINT "session_sources_external_is_provisioned"
  CHECK (
    CASE WHEN "kind" IN ('google_meet', 'zoom', 'teams', 'partner_platform')
      THEN "external_meeting_id" IS NOT NULL
        AND "provisioned_at" IS NOT NULL
        AND "provisioned_by_user_id" IS NOT NULL
      ELSE "external_meeting_id" IS NULL
        AND "provisioned_at" IS NULL
        AND "provisioned_by_user_id" IS NULL
    END
  ) NOT VALID;
ALTER TABLE "session_sources" VALIDATE CONSTRAINT "session_sources_external_is_provisioned";
