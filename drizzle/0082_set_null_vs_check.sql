-- 0082 — six foreign keys that contradict a CHECK on the same column. Additive.
--
-- 🔴 0078's DEFECT IS A FAMILY, AND THIS IS THE REST OF IT.
--
-- 0078 found one column where `ON DELETE SET NULL` disagreed with a CHECK that required the column
-- to be non-null: deleting the parent tried a write the child row forbids, and the DELETE failed
-- with a check violation naming a table the operator was not touching.
--
-- 0079 fixed the duplicate-foreign-key half of that story and added a whole-database audit for it.
-- That audit cannot see THIS shape, because the contradiction is between a foreign-key ACTION and a
-- CHECK rather than between two foreign keys. So sprint 52's seed hit a second instance —
-- `organizations.partner_id`, while trying to re-run an idempotent cast seed — and an audit written
-- for the new shape found six:
--
--   auth_sessions.partner_id                        vs auth_sessions_launch_names_partner
--   clinician_invitations.accepted_user_id          vs clinician_invitations_accepted_complete
--   instruments.translation_reviewed_by             vs instruments_translation_reviewed
--   organizations.partner_id                        vs organizations_partner_billed_names_partner
--   patient_clinical_facts.entered_by_user_id       vs clinical_facts_evidence_matches_kind
--   phone_change_requests.approved_by_user_id       vs phone_change_done_was_approved
--
-- Six, across six different sprints, each written by somebody who chose SET NULL because it is the
-- gentle default and then added a CHECK protecting the same column's meaning. Neither half is wrong
-- on its own. Together they make a DELETE that cannot succeed and whose error names the wrong table.
--
-- 🔴 NONE OF THEM IS REACHABLE TODAY, WHICH IS WHY ALL SIX SURVIVED.
--
-- The product soft-deletes: `users.deleted_at`, `partners.state = 'closed'`, and no hard DELETE on
-- any of these parents anywhere in the code. So SET NULL was unreachable in all six cases. That is
-- exactly how a contradiction survives a review: nothing exercises it until somebody writes a script
-- that tidies up after itself.
--
-- ## 🔴 WHICH RULE WINS, PER CASE, AND IT IS NOT THE SAME ANSWER EVERY TIME
--
-- Five become RESTRICT, because in each the CHECK is protecting a RECORD OF WHO DID SOMETHING and
-- that record is the point:
--
--   * `patient_clinical_facts.entered_by_user_id` is the sharpest. Sprint 47's honest record says a
--     clinician-entered fact names the clinician who entered it. A clinical fact whose author had
--     been nulled would be provenance quietly lost, which is the whole thing 47 exists to prevent.
--   * `clinician_invitations.accepted_user_id` — an accepted invitation names who accepted (54.5).
--   * `phone_change_requests.approved_by_user_id` — a completed change names who approved it.
--   * `instruments.translation_reviewed_by` — a published non-English instrument names its reviewer.
--   * `organizations.partner_id` — 42.6, and 42.1 already gives the right operational path for a
--     departing integrator: `partners.state = 'closed'`, not a DELETE.
--
-- 🔴 ONE becomes CASCADE instead, and the difference is worth stating.
--
-- `auth_sessions.partner_id` is not a record of who did something; it is a one-hour session that
-- exists only because a partner launched it (42.3, 55.9). RESTRICT there would mean a partner row
-- could not be removed while any launched session was still in the table, which is a foreign key
-- holding a company's row hostage to a credential that expires in an hour. The session should go
-- with the launch that made it.
--
-- The audit that found these is now a permanent check in `verify:sprint52`, beside 0079's, so the
-- next one is caught by a sweep rather than by a seed.

-- ---------------------------------------------------------------------------
-- Five RESTRICT: the CHECK is protecting a record of who did something.

ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_partner_id_fk";
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_partner_id_fk"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT;

ALTER TABLE "clinician_invitations" DROP CONSTRAINT IF EXISTS "clinician_invitations_accepted_user_id_fk";
ALTER TABLE "clinician_invitations"
  ADD CONSTRAINT "clinician_invitations_accepted_user_id_fk"
  FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "instruments" DROP CONSTRAINT IF EXISTS "instruments_translation_reviewed_by_fkey";
ALTER TABLE "instruments"
  ADD CONSTRAINT "instruments_translation_reviewed_by_fkey"
  FOREIGN KEY ("translation_reviewed_by") REFERENCES "users"("id") ON DELETE RESTRICT;

-- 🔴 The one that matters most: a clinical fact never loses the clinician who entered it.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "patient_clinical_facts_entered_by_user_id_fkey";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "patient_clinical_facts_entered_by_user_id_fkey"
  FOREIGN KEY ("entered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "phone_change_requests" DROP CONSTRAINT IF EXISTS "phone_change_approver_fk";
ALTER TABLE "phone_change_requests"
  ADD CONSTRAINT "phone_change_approver_fk"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 🔴 One CASCADE: a launched session exists only because of the launch that made it.

ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_partner_id_fk";
ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_partner_id_fk"
  FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE CASCADE;
