-- ============================================================
-- 008_ai.sql
-- 24Therapy.ai — AI: Session Notes, Summaries, Intelligence,
--                Memory (vector), Prompts, Model Registry, Logs
-- ============================================================

-- ------------------------------------------------------------
-- ai_session_notes
-- ------------------------------------------------------------
CREATE TABLE ai_session_notes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id           UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id           UUID         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  therapist_id         UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_format          VARCHAR(20)  NOT NULL DEFAULT 'soap',
  structured_content   JSONB        NOT NULL,
  raw_content          TEXT,
  status               VARCHAR(50)  NOT NULL DEFAULT 'draft',
  version              INTEGER      NOT NULL DEFAULT 1,
  therapist_edits      JSONB        NOT NULL DEFAULT '{}',
  edit_distance        INTEGER,
  edit_percentage      NUMERIC(5,2),
  approved_by          UUID REFERENCES users(id),
  approved_at          TIMESTAMPTZ,
  ai_model_used        VARCHAR(100),
  prompt_version       VARCHAR(50),
  generation_latency_ms INTEGER,
  token_count          INTEGER,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_session_notes_format_check CHECK (
    note_format IN ('soap','dap','birp','narrative','custom')
  ),
  CONSTRAINT ai_session_notes_status_check CHECK (
    status IN ('draft','pending_review','approved','rejected','archived')
  )
);

CREATE INDEX idx_ai_session_notes_session_id        ON ai_session_notes (session_id);
CREATE INDEX idx_ai_session_notes_patient_id        ON ai_session_notes (patient_id);
CREATE INDEX idx_ai_session_notes_status_therapist  ON ai_session_notes (status, therapist_id);

CREATE TRIGGER trg_ai_session_notes_updated_at
  BEFORE UPDATE ON ai_session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- ai_session_summaries
-- ------------------------------------------------------------
CREATE TABLE ai_session_summaries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id            UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  therapist_id          UUID        NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_type          VARCHAR(30) NOT NULL DEFAULT 'brief',
  content               TEXT        NOT NULL,
  key_themes            TEXT[]      NOT NULL DEFAULT '{}',
  action_items          JSONB       NOT NULL DEFAULT '[]',
  follow_up_suggestions JSONB       NOT NULL DEFAULT '[]',
  next_session_prep     TEXT,
  status                VARCHAR(30) NOT NULL DEFAULT 'draft',
  approved_by           UUID REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_session_summaries_session_id ON ai_session_summaries (session_id);
CREATE INDEX idx_ai_session_summaries_patient_id ON ai_session_summaries (patient_id);

-- ------------------------------------------------------------
-- session_intelligence
-- ------------------------------------------------------------
CREATE TABLE session_intelligence (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id                UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id                UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  therapist_id              UUID        NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  themes_detected           TEXT[]      NOT NULL DEFAULT '{}',
  symptoms_mentioned        TEXT[]      NOT NULL DEFAULT '{}',
  goals_mentioned           TEXT[]      NOT NULL DEFAULT '{}',
  stressors_mentioned       TEXT[]      NOT NULL DEFAULT '{}',
  life_events_mentioned     TEXT[]      NOT NULL DEFAULT '{}',
  medication_mentions       TEXT[]      NOT NULL DEFAULT '{}',
  risk_indicators           TEXT[]      NOT NULL DEFAULT '{}',
  protective_factors        TEXT[]      NOT NULL DEFAULT '{}',
  session_timeline          JSONB       NOT NULL DEFAULT '[]',
  emotional_arc             JSONB       NOT NULL DEFAULT '{}',
  key_quotes                JSONB       NOT NULL DEFAULT '[]',
  therapist_interventions   TEXT[]      NOT NULL DEFAULT '{}',
  session_quality_score     NUMERIC(3,2),
  processing_model          VARCHAR(100),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_intelligence_session_key UNIQUE (session_id)
);

CREATE INDEX idx_session_intelligence_session_id ON session_intelligence (session_id);
CREATE INDEX idx_session_intelligence_patient_id ON session_intelligence (patient_id);

CREATE TRIGGER trg_session_intelligence_updated_at
  BEFORE UPDATE ON session_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- patient_memory
-- ------------------------------------------------------------
CREATE TABLE patient_memory (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id        UUID REFERENCES therapists(id) ON DELETE SET NULL,
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  memory_type         VARCHAR(50)  NOT NULL,
  title               VARCHAR(500) NOT NULL,
  content             TEXT         NOT NULL,
  context             JSONB        NOT NULL DEFAULT '{}',
  confidence_score    NUMERIC(3,2),
  source_session_id   UUID REFERENCES sessions(id) ON DELETE SET NULL,
  source_segment_ids  UUID[]       NOT NULL DEFAULT '{}',
  status              VARCHAR(30)  NOT NULL DEFAULT 'active',
  reviewed_by         UUID REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  version             INTEGER      NOT NULL DEFAULT 1,
  superseded_by       UUID REFERENCES patient_memory(id) ON DELETE SET NULL,
  embedding           vector(1536),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_memory_type_check CHECK (
    memory_type IN (
      'symptom','goal','relationship','life_event','medication','risk',
      'treatment','strength','protective_factor','preference','belief',
      'behavior','trigger','coping','general'
    )
  ),
  CONSTRAINT patient_memory_status_check CHECK (
    status IN ('active','archived','superseded','rejected','pending_review')
  )
);

CREATE INDEX idx_patient_memory_patient_id       ON patient_memory (patient_id);
CREATE INDEX idx_patient_memory_type_patient      ON patient_memory (memory_type, patient_id);
CREATE INDEX idx_patient_memory_status_patient    ON patient_memory (status, patient_id);
CREATE INDEX idx_patient_memory_source_session    ON patient_memory (source_session_id);

-- IVFFlat ANN index for cosine similarity search on embeddings
CREATE INDEX idx_memory_embedding
  ON patient_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TRIGGER trg_patient_memory_updated_at
  BEFORE UPDATE ON patient_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- patient_memory_history
-- ------------------------------------------------------------
CREATE TABLE patient_memory_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id        UUID        NOT NULL REFERENCES patient_memory(id) ON DELETE CASCADE,
  patient_id       UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  previous_content TEXT,
  new_content      TEXT,
  previous_status  VARCHAR(30),
  new_status       VARCHAR(30),
  change_type      VARCHAR(50),
  change_reason    TEXT,
  changed_by       UUID REFERENCES users(id),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_memory_history_memory_id ON patient_memory_history (memory_id);

-- ------------------------------------------------------------
-- prompt_registry
-- ------------------------------------------------------------
CREATE TABLE prompt_registry (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(100) NOT NULL,
  version             VARCHAR(20)  NOT NULL,
  full_key            VARCHAR(150) NOT NULL,
  description         TEXT,
  template            TEXT         NOT NULL,
  variables           JSONB        NOT NULL DEFAULT '[]',
  output_schema       JSONB,
  owner               VARCHAR(100),
  status              VARCHAR(30)  NOT NULL DEFAULT 'draft',
  performance_metrics JSONB        NOT NULL DEFAULT '{}',
  ab_test_group       VARCHAR(20),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  activated_at        TIMESTAMPTZ,
  deprecated_at       TIMESTAMPTZ,
  CONSTRAINT prompt_registry_full_key_key UNIQUE (full_key),
  CONSTRAINT prompt_registry_status_check CHECK (
    status IN ('draft','testing','active','deprecated')
  )
);

CREATE INDEX idx_prompt_registry_name_status ON prompt_registry (name, status);
CREATE INDEX idx_prompt_registry_full_key    ON prompt_registry (full_key);

-- ------------------------------------------------------------
-- ai_model_registry
-- ------------------------------------------------------------
CREATE TABLE ai_model_registry (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider              VARCHAR(50)  NOT NULL,
  model_id              VARCHAR(100) NOT NULL,
  model_type            VARCHAR(50)  NOT NULL,
  display_name          VARCHAR(100),
  cost_per_1k_input     NUMERIC(10,6),
  cost_per_1k_output    NUMERIC(10,6),
  context_window        INTEGER,
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  is_default            BOOLEAN      NOT NULL DEFAULT FALSE,
  use_cases             TEXT[]       NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ai_request_logs
-- ------------------------------------------------------------
CREATE TABLE ai_request_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  patient_id      UUID REFERENCES patients(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES sessions(id) ON DELETE SET NULL,
  request_type    VARCHAR(50),
  agent_type      VARCHAR(50),
  model_id        VARCHAR(100),
  prompt_version  VARCHAR(50),
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(10,6),
  latency_ms      INTEGER,
  status          VARCHAR(20),
  cache_hit       BOOLEAN      NOT NULL DEFAULT FALSE,
  error_code      VARCHAR(50),
  error_message   TEXT,
  request_id      VARCHAR(100),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_request_logs_org_created    ON ai_request_logs (organization_id, created_at DESC);
CREATE INDEX idx_ai_request_logs_session_id     ON ai_request_logs (session_id);
CREATE INDEX idx_ai_request_logs_created_desc   ON ai_request_logs (created_at DESC);
CREATE INDEX idx_ai_request_logs_type_status    ON ai_request_logs (request_type, status);

-- ------------------------------------------------------------
-- copilot_suggestion_logs
-- ------------------------------------------------------------
CREATE TABLE copilot_suggestion_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id        UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  suggestion_type     VARCHAR(50),
  suggestion_content  TEXT         NOT NULL,
  context_snapshot    TEXT,
  was_acted_upon      BOOLEAN,
  therapist_rating    SMALLINT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_copilot_suggestion_logs_session_id ON copilot_suggestion_logs (session_id);
