-- 🔴 0150: A PRACTICE PAYS ITS OWN BILL.
--
-- An Egyptian clinic could not pay its bill from its portal: the manual rail
-- had payers for a clinician, a patient, a company and a guest session, and
-- none for a clinic principal, so the button said "write to us". The
-- organisation itself is now a payer, identified by organization_id alone.
-- Additive (H16).
ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_payer_kind_valid;
--> statement-breakpoint
ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_payer_kind_valid
    CHECK (payer_kind IN ('user', 'patient', 'sponsor', 'session', 'organization'));
--> statement-breakpoint
ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_kind_matches_id;
--> statement-breakpoint
ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_kind_matches_id
    CHECK (
      (payer_kind = 'user' AND patient_account_id IS NULL AND sponsor_id IS NULL)
      OR (payer_kind = 'patient' AND user_id IS NULL AND sponsor_id IS NULL)
      OR (payer_kind = 'sponsor' AND user_id IS NULL AND patient_account_id IS NULL)
      OR (
        payer_kind = 'session'
        AND user_id IS NULL
        AND patient_account_id IS NULL
        AND sponsor_id IS NULL
        AND ref_id IS NOT NULL
      )
      OR (
        payer_kind = 'organization'
        AND user_id IS NULL
        AND patient_account_id IS NULL
        AND sponsor_id IS NULL
        AND organization_id IS NOT NULL
      )
    );
