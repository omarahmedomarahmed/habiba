-- 🔴 TWO WHOLE PRINCIPALS ACT AND NOTHING RECORDS IT.
--
-- `audit_log` has `actor_user_id` (a clinician or an operator) and
-- `actor_account_id` (a patient), and the table's own comment says "exactly one
-- of the two is set on any row". That sentence was written when there were two
-- principals. There are six.
--
-- A SPONSOR USER ends somebody's benefit (C234), changes the identifier gate,
-- tops up a pot, rotates the joining code and turns public listing on and off.
-- A CLINIC MANAGER invites a clinician, cancels an invitation, removes somebody
-- from the practice and connects a records account. Every one of those is
-- consequential and none of them is written down anywhere.
--
-- 🔴 AND THE CODE SAYS OTHERWISE, WHICH IS THE WORSE HALF.
--
-- `removeFromRoster` takes `bySponsorUserId` with the comment *"The sponsor
-- user who did it, for `audit`"*, and passes it to nothing. The admin sponsor
-- actions say every one of their acts is audited *"unlike the sponsor's own
-- acts, which carry a sponsor user id and no actor"*, which reads as a
-- description of two audited paths and is a description of one.
--
-- This is the C377 shape a fourth time: the protection is written down in one
-- place and absent from the one that would perform it. An audit trail you
-- believe in and do not have is worse than none, because you plan around it.
--
-- 🔴 TWO COLUMNS, NOT ONE SHARED ONE, for the reason the table already gives
-- about its first two: the ids point at different tables and one column could
-- carry a foreign key to neither. "Who ended this benefit" must not be
-- answerable only by guessing which table the id belongs to.
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_sponsor_user_id uuid REFERENCES sponsor_users (id) ON DELETE SET NULL;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS actor_clinic_manager_id uuid REFERENCES clinic_managers (id) ON DELETE SET NULL;

-- Both read the same way the operator reads the rest of the log: newest first,
-- for one actor, when somebody asks what a practice or a payer did.
CREATE INDEX IF NOT EXISTS audit_log_sponsor_actor_idx
  ON audit_log (actor_sponsor_user_id, created_at);

CREATE INDEX IF NOT EXISTS audit_log_clinic_actor_idx
  ON audit_log (actor_clinic_manager_id, created_at);

COMMENT ON COLUMN audit_log.actor_sponsor_user_id IS
  'The sponsor portal user who performed the act. Exactly one actor column is set on any row. Never joined to a session, a date or a therapist: C244 is about what a payer can see, and this column is about what a payer DID.';

COMMENT ON COLUMN audit_log.actor_clinic_manager_id IS
  'The clinic manager who performed the act. Exactly one actor column is set on any row. A clinic manager is inside the tenancy and sees none of the clinical record, so rows written here carry no patient_id.';
