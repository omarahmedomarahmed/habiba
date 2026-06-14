-- ============================================================
-- 013_audit_compliance.sql
-- 24Therapy — Audit, Compliance, HIPAA Safeguards
-- Tables: audit_logs (append-only + RLS), data_subject_requests,
--         security_incidents, data_retention_policies,
--         phi_access_log, access_violations, baa_records,
--         compliance_checklist
-- ============================================================

-- ------------------------------------------------------------
-- audit_logs  (append-only; RLS blocks UPDATE/DELETE)
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID,
  user_email       VARCHAR(255),
  user_role        VARCHAR(100),
  organization_id  UUID,
  impersonated_by  UUID,
  action           VARCHAR(255) NOT NULL,
  resource_type    VARCHAR(100) NOT NULL,
  resource_id      UUID,
  old_value        JSONB,
  new_value        JSONB,
  ip_address       INET,
  user_agent       TEXT,
  request_id       UUID,
  http_method      VARCHAR(10),
  http_path        TEXT,
  session_context  TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_only ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (true);

CREATE INDEX idx_audit_logs_user_created  ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_org_created   ON audit_logs (organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource      ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_logs_action        ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_desc  ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_ip_address    ON audit_logs (ip_address);

-- ------------------------------------------------------------
-- create_audit_log()
-- Convenience function for NestJS interceptors / services
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_audit_log(
  p_user_id          UUID,
  p_user_email       VARCHAR,
  p_user_role        VARCHAR,
  p_organization_id  UUID,
  p_impersonated_by  UUID,
  p_action           VARCHAR,
  p_resource_type    VARCHAR,
  p_resource_id      UUID,
  p_old_value        JSONB    DEFAULT NULL,
  p_new_value        JSONB    DEFAULT NULL,
  p_ip_address       INET     DEFAULT NULL,
  p_user_agent       TEXT     DEFAULT NULL,
  p_request_id       UUID     DEFAULT NULL,
  p_http_method      VARCHAR  DEFAULT NULL,
  p_http_path        TEXT     DEFAULT NULL,
  p_session_context  TEXT     DEFAULT NULL,
  p_metadata         JSONB    DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id, user_email, user_role, organization_id, impersonated_by,
    action, resource_type, resource_id,
    old_value, new_value, ip_address, user_agent,
    request_id, http_method, http_path, session_context, metadata
  ) VALUES (
    p_user_id, p_user_email, p_user_role, p_organization_id, p_impersonated_by,
    p_action, p_resource_type, p_resource_id,
    p_old_value, p_new_value, p_ip_address, p_user_agent,
    p_request_id, p_http_method, p_http_path, p_session_context, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- data_subject_requests  (HIPAA §164.524 access requests)
-- ------------------------------------------------------------
CREATE TABLE data_subject_requests (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id),
  patient_id        UUID        REFERENCES patients(id),
  user_id           UUID        REFERENCES users(id),
  request_type      VARCHAR(100) NOT NULL,
  status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
  requested_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  due_by            TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  handled_by        UUID         REFERENCES users(id),
  notes             TEXT,
  rejection_reason  TEXT,
  export_url        TEXT,
  export_expires_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_data_subject_requests_updated_at
  BEFORE UPDATE ON data_subject_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- security_incidents
-- ------------------------------------------------------------
CREATE TABLE security_incidents (
  id                      UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID         REFERENCES organizations(id),
  incident_type           VARCHAR(100) NOT NULL,
  severity                VARCHAR(50)  NOT NULL DEFAULT 'medium',
  status                  VARCHAR(50)  NOT NULL DEFAULT 'open',
  description             TEXT         NOT NULL,
  affected_users          UUID[],
  affected_records        INTEGER,
  detected_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved_at             TIMESTAMPTZ,
  resolution              TEXT,
  reported_to_authorities BOOLEAN      NOT NULL DEFAULT FALSE,
  reported_at             TIMESTAMPTZ,
  metadata                JSONB,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_security_incidents_updated_at
  BEFORE UPDATE ON security_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- data_retention_policies
-- ------------------------------------------------------------
CREATE TABLE data_retention_policies (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        UUID        NOT NULL REFERENCES organizations(id),
  recordings_days        INTEGER     NOT NULL DEFAULT 730,
  transcripts_days       INTEGER     NOT NULL DEFAULT 1825,
  reports_days           INTEGER     NOT NULL DEFAULT 2555,
  assessments_days       INTEGER     NOT NULL DEFAULT 2555,
  messages_days          INTEGER     NOT NULL DEFAULT 1095,
  audit_logs_days        INTEGER     NOT NULL DEFAULT 2555,
  patient_data_days      INTEGER     NOT NULL DEFAULT 2555,
  allow_patient_deletion BOOLEAN     NOT NULL DEFAULT FALSE,
  auto_archive_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT data_retention_policies_org_unique UNIQUE (organization_id)
);

CREATE TRIGGER trg_data_retention_policies_updated_at
  BEFORE UPDATE ON data_retention_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- phi_access_log
-- ------------------------------------------------------------
CREATE TABLE phi_access_log (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID         NOT NULL,
  organization_id UUID         NOT NULL,
  patient_id      UUID         NOT NULL,
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID,
  access_type     VARCHAR(50)  NOT NULL,
  access_reason   VARCHAR(255),
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phi_access_log_patient_created ON phi_access_log (patient_id, created_at DESC);
CREATE INDEX idx_phi_access_log_user_created    ON phi_access_log (user_id, created_at DESC);

-- ------------------------------------------------------------
-- access_violations
-- ------------------------------------------------------------
CREATE TABLE access_violations (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID,
  organization_id     UUID,
  attempted_action    VARCHAR(255) NOT NULL,
  resource_type       VARCHAR(100),
  resource_id         UUID,
  required_permission VARCHAR(100),
  ip_address          INET,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_violations_user_created ON access_violations (user_id, created_at DESC);
CREATE INDEX idx_access_violations_ip_created   ON access_violations (ip_address, created_at DESC);

-- ------------------------------------------------------------
-- baa_records  (Business Associate Agreements — HIPAA §164.308)
-- ------------------------------------------------------------
CREATE TABLE baa_records (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID         REFERENCES organizations(id),
  vendor_name     VARCHAR(255) NOT NULL,
  vendor_type     VARCHAR(100),
  baa_signed      BOOLEAN      NOT NULL DEFAULT FALSE,
  signed_at       TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  document_url    TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_baa_records_organization_id ON baa_records (organization_id);

CREATE TRIGGER trg_baa_records_updated_at
  BEFORE UPDATE ON baa_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- compliance_checklist
-- ------------------------------------------------------------
CREATE TABLE compliance_checklist (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID         REFERENCES organizations(id),
  requirement       VARCHAR(255) NOT NULL,
  category          VARCHAR(100),
  status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
  evidence_url      TEXT,
  responsible_party VARCHAR(255),
  notes             TEXT,
  due_date          DATE,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_compliance_checklist_updated_at
  BEFORE UPDATE ON compliance_checklist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
