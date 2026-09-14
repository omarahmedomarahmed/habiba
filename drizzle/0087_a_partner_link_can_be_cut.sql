-- 🔴 C277 SAYS "SCOPED, REVOCABLE, AND THE PATIENT CAN CLAIM THE RECORD AND
-- LEAVE". The grant is revocable. The LINK was not.
--
-- `partner_subjects` maps a partner's own reference ("P123") to a `people` row,
-- and 55.6 is careful about how it is created: the partner may make an unlinked
-- placeholder freely, and the person themselves has to sign in and confirm
-- before it points at anybody. That half is right.
--
-- The other half was missing entirely. Once confirmed, the row had no off
-- switch: no column, no function, no screen. A person who revoked every grant,
-- claimed their record and walked away was still, permanently, "P123" to that
-- partner.
--
-- 🔴 AND IT IS NOT A DEAD LINK. It is a standing capability.
--
-- `writeBackSession` needs the subject and a clinician, and asks about no
-- grant at all. So a partner could keep writing real sessions, with real times
-- and durations, into the chart of somebody who had revoked everything they
-- were ever asked to consent to. `deliverNote` is scoped through the same row.
-- Revoking a grant closed one door and left this one open.
--
-- 🔴 REVOKED, NOT DELETED, for the reason every other revocation here keeps its
-- row: "when did this stop" is a question somebody asks later, and a deleted
-- row answers it with silence. The unique index on (partner_id, external_ref)
-- stays as it is, so a partner cannot re-link the same reference by creating a
-- second row beside the revoked one. Re-linking means the person confirms
-- again, which is the whole point.
ALTER TABLE partner_subjects
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Who cut it. A patient account, because this is the patient's act and nobody
-- else's: there is deliberately no operator path and no partner path to this
-- column.
ALTER TABLE partner_subjects
  ADD COLUMN IF NOT EXISTS revoked_by_account_id uuid
    REFERENCES patient_accounts (id) ON DELETE SET NULL;

COMMENT ON COLUMN partner_subjects.revoked_at IS
  'C277. The person cut the link. resolveSubject filters on this, so every partner endpoint that resolves a subject stops answering at once. Revoked rather than deleted, because "when did this stop" is a question somebody asks later.';

COMMENT ON COLUMN partner_subjects.revoked_by_account_id IS
  'The patient account that cut it. Always a patient: there is no operator path and no partner path to this column, which is what makes the link the person''s to end.';

-- 🔴 AND THE CHECK, or the new event is a TypeScript value the database refuses.
--
-- `WEBHOOK_EVENTS` is a `const` array in the schema file and there is a CHECK in
-- 0075 holding the same four strings. Adding "subject.unlinked" to the array
-- alone compiles, typechecks, passes every scan that reads TypeScript, and then
-- throws on the first insert, in production, at the moment somebody cuts a link.
--
-- That is the shape sprint 55 already names in its own verifier about session
-- sources: "the half a careless enum extension would have missed". This is the
-- careless extension, caught before it shipped rather than after.
--
-- 🔴 VALIDATED, not left NOT VALID. A widening CHECK cannot fail against
-- existing rows, and 22.9 rules that an unvalidated constraint is a rule the
-- schema does not assert.
ALTER TABLE partner_webhook_deliveries DROP CONSTRAINT IF EXISTS partner_webhook_deliveries_event;
ALTER TABLE partner_webhook_deliveries ADD CONSTRAINT partner_webhook_deliveries_event
  CHECK ("event" IN ('session.completed', 'note.approved', 'grant.revoked', 'record.claimed', 'subject.unlinked'))
  NOT VALID;
ALTER TABLE partner_webhook_deliveries VALIDATE CONSTRAINT partner_webhook_deliveries_event;
