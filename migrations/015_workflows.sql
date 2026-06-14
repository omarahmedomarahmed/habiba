-- ============================================================
-- 015_workflows.sql
-- 24Therapy — Clinical Workflows, Tasks, Referrals,
--             Feature Flags, Break-Glass Access
-- ============================================================

-- ------------------------------------------------------------
-- clinical_workflows
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_workflows (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id),
  therapist_id    UUID        REFERENCES therapists(id),
  patient_id      UUID        REFERENCES patients(id),
  workflow_type   VARCHAR(50) NOT NULL,
  template_id     VARCHAR(100),
  title           VARCHAR(255),
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',
  context         JSONB       NOT NULL DEFAULT '{}',
  session_id      UUID        REFERENCES sessions(id),
  triggered_by    VARCHAR(50) NOT NULL DEFAULT 'system',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_clinical_workflows_organization_id ON clinical_workflows (organization_id);
CREATE INDEX IF NOT EXISTS idx_clinical_workflows_therapist_id    ON clinical_workflows (therapist_id);
CREATE INDEX IF NOT EXISTS idx_clinical_workflows_patient_id      ON clinical_workflows (patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_workflows_status          ON clinical_workflows (status);

CREATE OR REPLACE TRIGGER trg_clinical_workflows_updated_at
  BEFORE UPDATE ON clinical_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- workflow_tasks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id         UUID        NOT NULL REFERENCES clinical_workflows(id) ON DELETE CASCADE,
  organization_id     UUID        NOT NULL REFERENCES organizations(id),
  task_order          INTEGER     NOT NULL DEFAULT 1,
  name                VARCHAR(255) NOT NULL,
  task_type           VARCHAR(50),
  status              VARCHAR(30) NOT NULL DEFAULT 'pending',
  is_required         BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata            JSONB       NOT NULL DEFAULT '{}',
  result              JSONB,
  due_date            DATE,
  assigned_to_patient BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow_id     ON workflow_tasks (workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_organization_id ON workflow_tasks (organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_patient_status  ON workflow_tasks (organization_id, assigned_to_patient, status);

-- ------------------------------------------------------------
-- referrals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          UUID        NOT NULL REFERENCES organizations(id),
  patient_id               UUID        NOT NULL REFERENCES patients(id),
  therapist_id             UUID        NOT NULL REFERENCES therapists(id),
  referred_to_name         VARCHAR(255) NOT NULL,
  referred_to_email        VARCHAR(255),
  referred_to_organization VARCHAR(255),
  specialty                VARCHAR(100),
  reason                   TEXT,
  urgency                  VARCHAR(20) NOT NULL DEFAULT 'routine',
  status                   VARCHAR(20) NOT NULL DEFAULT 'draft',
  letter_content           TEXT,
  sent_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_organization_id ON referrals (organization_id);
CREATE INDEX IF NOT EXISTS idx_referrals_therapist_id    ON referrals (therapist_id);
CREATE INDEX IF NOT EXISTS idx_referrals_patient_id      ON referrals (patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status          ON referrals (status);

CREATE OR REPLACE TRIGGER trg_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- feature_flags
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feature_flags (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  rollout_pct SMALLINT    NOT NULL DEFAULT 0
                          CHECK (rollout_pct BETWEEN 0 AND 100),
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  category    VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feature_flags_key_unique UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key     ON feature_flags (key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags (enabled);

CREATE OR REPLACE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
