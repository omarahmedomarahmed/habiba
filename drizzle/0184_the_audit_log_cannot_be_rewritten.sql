-- 🔴 0184: THE AUDIT LOG CANNOT BE REWRITTEN, AND /hipaa CAN SAY SO. Additive.
--
-- /hipaa said "an append-only audit log" and nothing made it one: any UPDATE or
-- DELETE the application ran would have succeeded. This trigger makes it a fact
-- about the database rather than a habit of the code.
--
-- What it still lets through, and why each one is legitimate:
--
--   1. UPDATE that only empties an actor column (organization, clinician,
--      patient account, company user, clinic manager, partner). Every one of
--      those foreign keys is ON DELETE SET NULL, so deleting an account issues
--      exactly this UPDATE, and the row keeps what happened, to what, and when.
--      Nothing else on the row may change, and no column may be set to a value.
--   2. DELETE of a row older than the six-year retention period. That is the
--      daily `retention` job (app/api/cron/[job]/route.ts), which deletes on
--      the same `now() - interval '2190 days'` this trigger checks.
--   3. Anything inside a transaction that set `app.audit_fixtures` to `on`.
--      Only scripts do: the verifiers and the demo reset remove the rows their
--      own invented fixtures wrote. No file under app/ or lib/ sets it, and
--      tests/safety.test.ts fails if one ever does.
--
-- Safe to apply before the deploy (H16): the running build issues none of the
-- refused statements.

CREATE OR REPLACE FUNCTION "audit_log_append_only"() RETURNS trigger AS $$
DECLARE
  untouched constant text[] := ARRAY[
    'organization_id', 'actor_user_id', 'actor_account_id',
    'actor_sponsor_user_id', 'actor_clinic_manager_id', 'partner_id'
  ];
BEGIN
  IF coalesce(current_setting('app.audit_fixtures', true), '') = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."created_at" < now() - interval '2190 days' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_log is append only: a row is deleted only after six years'
      USING ERRCODE = '0A000';
  END IF;

  -- UPDATE: everything but the actor columns is unchanged, and each actor
  -- column is either unchanged or emptied.
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
DROP TRIGGER IF EXISTS "audit_log_no_rewrite" ON "audit_log";
--> statement-breakpoint
CREATE TRIGGER "audit_log_no_rewrite"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();
