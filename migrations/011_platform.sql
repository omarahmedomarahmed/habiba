-- ============================================================
-- 24Therapy MVP schema — PHI audit, audit log, break-glass, platform config/events
-- Generated fresh for the MVP database reset (docs/PRODUCT_MVP.md).
-- Runs in order via scripts/migrate.js on every backend deploy.
-- ============================================================

-- ============================================================
-- 013_audit_compliance.sql
-- 24Therapy — Audit, Compliance, HIPAA Safeguards
-- Tables: audit_log (append-only + RLS), data_subject_requests,
--         security_incidents, data_retention_policies,
--         phi_access_log, access_violations, baa_records,
--         compliance_checklist
-- ============================================================

-- ------------------------------------------------------------
-- audit_log  (append-only; RLS blocks UPDATE/DELETE)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
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


ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;


CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created  ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created   ON audit_log (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource      ON audit_log (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action        ON audit_log (action);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_desc  ON audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address    ON audit_log (ip_address);


-- ------------------------------------------------------------
-- phi_access_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS phi_access_log (
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


CREATE INDEX IF NOT EXISTS idx_phi_access_log_patient_created ON phi_access_log (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_phi_access_log_user_created    ON phi_access_log (user_id, created_at DESC);


-- ------------------------------------------------------------
-- break_glass_access  (HIPAA §164.312(a)(2)(ii) emergency)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS break_glass_access (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  UUID        NOT NULL REFERENCES users(id),
  target_user_id UUID        REFERENCES users(id),
  reason         TEXT        NOT NULL,
  ip_address     VARCHAR(45),
  user_agent     TEXT,
  accessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resources      JSONB       NOT NULL DEFAULT '[]',
  acknowledged   BOOLEAN     NOT NULL DEFAULT FALSE
);


CREATE INDEX IF NOT EXISTS idx_break_glass_access_admin_user_id ON break_glass_access (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_break_glass_access_accessed_at   ON break_glass_access (accessed_at DESC);

-- ------------------------------------------------------------
-- platform_config — admin-editable key/value settings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_config (
  key         VARCHAR(100)  PRIMARY KEY,
  value       TEXT,
  updated_by  UUID          REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- platform_events — product analytics event sink
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_events (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type      VARCHAR(100)  NOT NULL,
  event_name      VARCHAR(150),
  entity_type     VARCHAR(100),
  entity_id       UUID,
  properties      JSONB         DEFAULT '{}',
  session_id      UUID,
  patient_id      UUID,
  therapist_id    UUID,
  user_id         UUID,
  organization_id UUID,
  occurred_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  source          VARCHAR(50),
  platform        VARCHAR(50),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_events_org_time ON platform_events (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_type     ON platform_events (event_type, occurred_at DESC);

-- ------------------------------------------------------------
-- system_notifications — admin broadcast messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_notifications (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR(255)  NOT NULL,
  message          TEXT          NOT NULL,
  target_audience  VARCHAR(50)   NOT NULL DEFAULT 'all',
  priority         VARCHAR(20)   NOT NULL DEFAULT 'normal',
  created_by       UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
