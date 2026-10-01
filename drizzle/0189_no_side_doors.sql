-- DD-2 B2: NO SIDE DOORS. Additive and idempotent.
--
-- 1. The audit log's fixture door is gone. 0184 let any connection that ran
--    SET app.audit_fixtures = 'on' rewrite or delete audit rows. Only scripts
--    used it, to tidy their own fixtures; they now leave those rows (on a dev
--    branch, with the actor columns emptied as the fixtures are deleted).
-- 2. TRUNCATE is refused. Row triggers do not fire on TRUNCATE, so 0184 never
--    covered it; a statement-level BEFORE TRUNCATE trigger does.
--
-- Still open (a founder and operations decision, docs/DECISIONS.md): the app
-- and the migrations share the owner role, which can DROP or DISABLE these
-- triggers. The full fix is a separate restricted role for the app.
--
-- Safe to apply before the deploy: the running build issues none of the
-- refused statements, and no product code sets app.audit_fixtures.

CREATE OR REPLACE FUNCTION "audit_log_append_only"() RETURNS trigger AS $$
DECLARE
  untouched constant text[] := ARRAY[
    'organization_id', 'actor_user_id', 'actor_account_id',
    'actor_sponsor_user_id', 'actor_clinic_manager_id', 'partner_id'
  ];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."created_at" < now() - interval '2190 days' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_log is append only: a row is deleted only after six years'
      USING ERRCODE = '0A000';
  END IF;

  -- UPDATE: everything but the actor columns is unchanged, and each actor
  -- column is either unchanged or emptied (their foreign keys are ON DELETE SET NULL).
  IF (to_jsonb(NEW) - untouched) IS DISTINCT FROM (to_jsonb(OLD) - untouched)
     OR (NEW."organization_id" IS NOT NULL AND NEW."organization_id" IS DISTINCT FROM OLD."organization_id")
     OR (NEW."actor_user_id" IS NOT NULL AND NEW."actor_user_id" IS DISTINCT FROM OLD."actor_user_id")
     OR (NEW."actor_account_id" IS NOT NULL AND NEW."actor_account_id" IS DISTINCT FROM OLD."actor_account_id")
     OR (NEW."actor_sponsor_user_id" IS NOT NULL AND NEW."actor_sponsor_user_id" IS DISTINCT FROM OLD."actor_sponsor_user_id")
     OR (NEW."actor_clinic_manager_id" IS NOT NULL AND NEW."actor_clinic_manager_id" IS DISTINCT FROM OLD."actor_clinic_manager_id")
     OR (NEW."partner_id" IS NOT NULL AND NEW."partner_id" IS DISTINCT FROM OLD."partner_id") THEN
    RAISE EXCEPTION 'audit_log is append only: write a new row instead'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "audit_log_no_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append only: it cannot be truncated'
    USING ERRCODE = '0A000';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_no_truncate" ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_no_truncate"();
