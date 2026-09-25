-- 🔴 0178: A PARTNER AND A COMPANY CAN SAY WHAT THEY ARE WRITING ABOUT. Additive.
--
-- The contact form's topics were a patient's and a clinician's plus "Something else",
-- so an integrator or an employer asking about cover had to file under the catch-all
-- that is read last (B33). Two topics join the list: `a_partnership` and `a_company`.
-- The constraint is widened, never narrowed, so every row already written still passes
-- and the running deployment keeps working while this is applied first (H16).
--
-- ⚠️ The topic list below is the whole list as of 0048. A later migration that changes
-- the same constraint must carry all nine.

ALTER TABLE "support_tickets" DROP CONSTRAINT IF EXISTS "support_tickets_topic_known";
--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_topic_known"
  CHECK ("topic" IN (
    'account', 'billing', 'my_record', 'a_session',
    'a_therapist', 'joining_as_a_therapist', 'something_else',
    'a_partnership', 'a_company'
  ));
