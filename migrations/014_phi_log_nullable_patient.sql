-- ============================================================
-- 24Therapy MVP schema — phi_access_log.patient_id nullable
-- Not every PHI-route access is tied to a single patient (AI calls,
-- session actions before a patient is linked, cross-patient listings).
-- The NOT NULL made those audit inserts silently fail. HIPAA still
-- requires the access be logged — just without a patient_id.
-- ============================================================

ALTER TABLE phi_access_log ALTER COLUMN patient_id DROP NOT NULL;
