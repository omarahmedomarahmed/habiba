-- 0079 — one foreign key on one column. PLAN.md 55.4, C265. Additive.
--
-- 🔴 0078 LEFT TWO CONTRADICTORY FOREIGN KEYS ON THE SAME COLUMN, AND MY VERIFICATION OF 0078
-- SAID IT WAS CORRECT.
--
-- After 0078, production carried both of these on `enrolment_attestations.answered_by_key_id`:
--
--   enrolment_attestations_key_fk                    ON DELETE SET NULL   (0075 line 324)
--   enrolment_attestations_answered_by_key_id_fkey   ON DELETE RESTRICT   (0078)
--
-- 0078 was written to replace SET NULL with RESTRICT, because the CHECK
-- `enrolment_attestations_answer_names_key` forbids an answered row from having a null key, so
-- SET NULL made deleting a key attempt a write the row refuses. It did the DROP by drizzle's
-- DEFAULT constraint name, which nothing had ever created: 0075 named its constraint by hand.
-- So the DROP was a no-op on a name that did not exist, the ADD created a brand new constraint,
-- and 0075's original survived beside it.
--
-- 🔴 THERE IS NO LIVE HOLE, AND THAT IS WHAT MAKES IT WORTH FIXING NOW.
--
-- Postgres enforces every foreign key on a column, so RESTRICT wins and the effective behaviour
-- is what 0078 intended. What the schema now carries is two rules that disagree, and the next
-- reader is invited to delete the "redundant" one. If they delete the RESTRICT, SET NULL becomes
-- live again and the FK/CHECK contradiction 0078 exists to prevent returns, silently, at the
-- moment somebody deletes a key.
--
-- 🔴 AND THE VERIFICATION THAT MISSED IT IS THE §6 FAMILY INSIDE A MIGRATION WRITTEN TO CLOSE
-- ANOTHER INSTANCE OF IT.
--
-- My check read `pg_get_constraintdef` for the name I expected to find, got
-- `ON DELETE RESTRICT`, and reported the migration correct. That is the presence of the right
-- thing WITHOUT the absence of the wrong one: exactly the pairing this project has now failed on
-- often enough to have a name for. A constraint check must ask what rules exist ON THE COLUMN,
-- never whether one particular name has the definition it should.
--
-- `verify:sprint43` asserts the count: exactly one foreign key on that column, and it reads
-- `pg_constraint` by conrelid and conkey rather than by conname.

ALTER TABLE "enrolment_attestations" DROP CONSTRAINT IF EXISTS "enrolment_attestations_key_fk";

-- 🔴 And the one that stays is asserted here as well as dropped-if-wrong above, so a database
-- that somehow has neither ends up with the right one rather than with none.
--
-- IF NOT EXISTS is not available for ADD CONSTRAINT, so this is a conditional block: on a
-- database where 0078 already created it, this does nothing; on one where it did not, it
-- creates it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname = 'enrolment_attestations'
       AND c.contype = 'f'
       AND c.conkey = ARRAY[(
         SELECT attnum FROM pg_attribute
          WHERE attrelid = t.oid AND attname = 'answered_by_key_id'
       )]::smallint[]
  ) THEN
    ALTER TABLE "enrolment_attestations"
      ADD CONSTRAINT "enrolment_attestations_answered_by_key_id_fkey"
      FOREIGN KEY ("answered_by_key_id") REFERENCES "partner_api_keys"("id")
      ON DELETE RESTRICT;
  END IF;
END $$;
