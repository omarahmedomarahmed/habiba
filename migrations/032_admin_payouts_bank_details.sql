-- Migration 032 — Bank details on therapists + payout request enhancements
-- Session 24: therapist wallet payout method storage and admin payout processing

-- Bank details on therapists
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS payout_method VARCHAR(10) DEFAULT 'ach';
ALTER TABLE therapists ADD COLUMN IF NOT EXISTS bank_details JSONB;

-- Enforce valid payout methods (added separately so IF NOT EXISTS column add stays clean)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'therapists_payout_method_check'
  ) THEN
    ALTER TABLE therapists
      ADD CONSTRAINT therapists_payout_method_check
      CHECK (payout_method IS NULL OR payout_method IN ('ach', 'wire', 'swift'));
  END IF;
END$$;

-- Payout request enhancements (processed_at / processed_by already exist in 031)
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS method VARCHAR(10);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS notes TEXT;
