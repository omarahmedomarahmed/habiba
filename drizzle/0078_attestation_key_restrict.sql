-- 0078 — an answered attestation keeps the key that answered it. PLAN.md 55.4, C265. Additive.
--
-- 🔴 A CONSTRAINT AND A FOREIGN-KEY ACTION THAT CONTRADICT EACH OTHER, FOUND BY A VERIFIER'S
-- OWN CLEANUP.
--
-- 0075 gave `enrolment_attestations` two rules that cannot both hold:
--
--   `enrolment_attestations_answer_names_key`  CHECK (answered_at IS NULL OR
--                                                    answered_by_key_id IS NOT NULL)
--   `answered_by_key_id` REFERENCES partner_api_keys(id) ON DELETE SET NULL
--
-- Deleting a key therefore tries to null a column that an answered row is forbidden to have
-- null, and Postgres refuses the DELETE with a check violation naming a table the operator was
-- not touching. `verify:sprint55` hit it in its own teardown: it inserted a key, answered an
-- attestation with it, and then could not clean up.
--
-- 🔴 WHICH RULE IS THE ONE WORTH KEEPING IS NOT A CLOSE CALL.
--
-- The CHECK is C265 in the schema: *every call audited*, and an answer nobody is answerable for
-- is the audit that is not one. So the CHECK stays and the FK action changes to RESTRICT, which
-- says the true thing out loud: a key that has answered a question about a person cannot be
-- erased, because the record of who asked is the point.
--
-- 🔴 AND IT CHANGES NOTHING IN PRODUCTION, WHICH IS WHY IT WAS INVISIBLE.
--
-- `revokeKey` sets `revoked_at`; there is no DELETE on `partner_api_keys` anywhere in the
-- product, and `partner_api_keys` is only reachable by cascade from `partners`, which has no
-- delete path either. So SET NULL was unreachable code in the schema, which is exactly how a
-- contradiction survives a review: nothing exercises it until somebody writes a test that
-- tidies up after itself.
--
-- 🔴 A CASCADE FROM `partners` WOULD NOW BE BLOCKED, and that is correct rather than awkward.
-- Deleting a partner row that has answered questions about real people should fail loudly. The
-- state for "this integrator is gone" is `state = 'closed'`, which 42.1 has always said.

ALTER TABLE "enrolment_attestations"
  DROP CONSTRAINT IF EXISTS "enrolment_attestations_answered_by_key_id_fkey";

ALTER TABLE "enrolment_attestations"
  ADD CONSTRAINT "enrolment_attestations_answered_by_key_id_fkey"
  FOREIGN KEY ("answered_by_key_id") REFERENCES "partner_api_keys"("id")
  ON DELETE RESTRICT;
