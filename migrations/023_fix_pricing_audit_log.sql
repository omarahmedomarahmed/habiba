-- Migration 023: Fix pricing_audit_log column name mismatch
-- Migration 015 created the table with column `action` (VARCHAR 50).
-- Migrations 020 and 021 both INSERT using column name `change_type`.
-- This migration renames `action` → `change_type` so all INSERTs succeed.

ALTER TABLE pricing_audit_log
  RENAME COLUMN action TO change_type;
