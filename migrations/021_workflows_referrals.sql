-- ============================================================
-- 021 — Workflow engine tables + referrals
-- clinical_workflows / workflow_tasks were referenced by
-- backend/src/modules/workflows since session 10 but never created
-- (every INSERT was .catch()-swallowed). referrals had no table at all.
-- Column sets match exactly what workflows.service.ts already writes.
-- ============================================================

CREATE TABLE IF NOT EXISTS clinical_workflows (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  therapist_id     UUID REFERENCES therapists(id),
  patient_id       UUID REFERENCES patients(id),
  workflow_type    VARCHAR(50) NOT NULL,
  template_id      VARCHAR(100),
  title            VARCHAR(255),
  status           VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, cancelled
  context          JSONB DEFAULT '{}',
  session_id       UUID REFERENCES sessions(id),
  triggered_by     VARCHAR(50) DEFAULT 'system',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflows_org       ON clinical_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflows_therapist ON clinical_workflows(therapist_id);
CREATE INDEX IF NOT EXISTS idx_workflows_patient   ON clinical_workflows(patient_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status    ON clinical_workflows(status);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id          UUID NOT NULL REFERENCES clinical_workflows(id) ON DELETE CASCADE,
  organization_id      UUID NOT NULL REFERENCES organizations(id),
  task_order           INTEGER NOT NULL DEFAULT 1,
  name                 VARCHAR(255) NOT NULL,
  task_type            VARCHAR(50),
  status               VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending, completed, skipped
  is_required          BOOLEAN DEFAULT true,
  metadata             JSONB DEFAULT '{}',
  result               JSONB,
  due_date             DATE,
  assigned_to_patient  BOOLEAN DEFAULT false,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow ON workflow_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_org      ON workflow_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_patient  ON workflow_tasks(organization_id, assigned_to_patient, status);

CREATE TABLE IF NOT EXISTS referrals (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id          UUID NOT NULL REFERENCES organizations(id),
  patient_id               UUID NOT NULL REFERENCES patients(id),
  therapist_id             UUID NOT NULL REFERENCES therapists(id),
  referred_to_name         VARCHAR(255) NOT NULL,
  referred_to_email        VARCHAR(255),
  referred_to_organization VARCHAR(255),
  specialty                VARCHAR(100),
  reason                   TEXT,
  urgency                  VARCHAR(20) DEFAULT 'routine',  -- routine, urgent, emergency
  status                   VARCHAR(20) DEFAULT 'draft',    -- draft, sent, accepted, declined
  letter_content           TEXT,
  sent_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_org       ON referrals(organization_id);
CREATE INDEX IF NOT EXISTS idx_referrals_therapist ON referrals(therapist_id);
CREATE INDEX IF NOT EXISTS idx_referrals_patient   ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status    ON referrals(status);
