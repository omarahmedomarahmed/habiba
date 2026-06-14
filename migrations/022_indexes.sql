-- Migration 022: Missing FK Indexes
-- Adds indexes on all foreign key columns that were found without corresponding indexes
-- in the 2026-06-13 audit. Missing FK indexes cause full-table scans on every JOIN.

CREATE INDEX IF NOT EXISTS idx_organizations_plan_id
  ON organizations(plan_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_conversations_therapist_id
  ON conversations(therapist_id);

CREATE INDEX IF NOT EXISTS idx_patient_medications_medication_id
  ON patient_medications(medication_id);

CREATE INDEX IF NOT EXISTS idx_invoices_patient_id
  ON invoices(patient_id);

CREATE INDEX IF NOT EXISTS idx_sessions_radar_request_id
  ON sessions(radar_request_id);

CREATE INDEX IF NOT EXISTS idx_baa_records_organization_id
  ON baa_records(organization_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_patient_id
  ON assessment_results(patient_id);
