-- Sprint 21 — the audit log can name a resource that is not a row.
--
-- 🔴 A defect, not a feature. `audit_log.resource_id` is typed `uuid`, and
-- several callers pass a natural key: a settings group ("pricing"), a taxonomy
-- entry ("language:ar"), a string override ("common.continue:ar"). Postgres
-- refuses those outright, and because `audit()` is deliberately allowed to
-- throw — an audit trail that fails silently is worse than none — the whole
-- admin action failed with it. The taxonomy editor had been failing that way
-- since sprint 1.
--
-- Additive: one nullable column. `audit()` routes each value to whichever
-- column can hold it, so no existing row changes and no call site does either.

ALTER TABLE "audit_log"
  ADD COLUMN IF NOT EXISTS "resource_key" text;

CREATE INDEX IF NOT EXISTS "audit_log_resource_key_idx"
  ON "audit_log" ("resource_type", "resource_key");
