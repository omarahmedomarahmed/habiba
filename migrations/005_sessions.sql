-- ============================================================
-- 24Therapy MVP schema — sessions, transcripts
-- Generated fresh for the MVP database reset (docs/PRODUCT_MVP.md).
-- Runs in order via scripts/migrate.js on every backend deploy.
-- ============================================================

-- ============================================================
-- 006_sessions.sql
-- 24Therapy.ai — Sessions, Transcripts, Recordings, Reports
-- Also adds deferred FKs back to patient_files/life_events/relationships
-- ============================================================

-- ------------------------------------------------------------
-- sessions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  therapist_id            UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  patient_id              UUID         REFERENCES patients(id) ON DELETE RESTRICT,  -- nullable: guest / link-based sessions
  -- Guest / link-based join (no patient account required)
  join_token              UUID         UNIQUE DEFAULT gen_random_uuid(),
  join_name               VARCHAR(255),
  started_by_patient_at   TIMESTAMPTZ,
  patient_email           VARCHAR(255),
  patient_name_guest      VARCHAR(255),
  -- AI auto-generation output
  follow_up_recommendation TEXT,
  ai_insights             JSONB        DEFAULT '{}',
  auto_generate_note      BOOLEAN      DEFAULT TRUE,
  session_type            VARCHAR(50)  NOT NULL DEFAULT 'standard',
  modality                VARCHAR(50)  NOT NULL DEFAULT 'video',
  status                  VARCHAR(50)  NOT NULL DEFAULT 'scheduled',
  scheduled_at            TIMESTAMPTZ,
  started_at              TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  duration_minutes        INTEGER,
  session_number          INTEGER,
  title                   VARCHAR(255),
  radar_session           BOOLEAN      NOT NULL DEFAULT FALSE,
  radar_request_id        UUID,
  recording_enabled       BOOLEAN      NOT NULL DEFAULT FALSE,
  scribe_enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
  video_room_id           VARCHAR(255),
  video_room_url          VARCHAR(1000),
  pre_session_notes       TEXT,
  post_session_quick_note TEXT,
  cancellation_reason     TEXT,
  cancelled_by            UUID REFERENCES users(id),
  cancelled_at            TIMESTAMPTZ,
  no_show                 BOOLEAN      NOT NULL DEFAULT FALSE,
  billing_status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
  fee_charged             NUMERIC(10,2),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT sessions_type_check CHECK (
    session_type IN ('standard','radar','group','phone','in_person','intake','follow_up')
  ),
  CONSTRAINT sessions_modality_check CHECK (
    modality IN ('video','audio_only','phone','in_person')
  ),
  CONSTRAINT sessions_status_check CHECK (
    status IN ('scheduled','waiting','in_progress','completed','cancelled','no_show','rescheduled')
  ),
  CONSTRAINT sessions_billing_status_check CHECK (
    billing_status IN ('pending','processing','paid','failed','refunded','waived','not_applicable')
  )
);


CREATE INDEX IF NOT EXISTS idx_sessions_organization_id       ON sessions (organization_id);

CREATE INDEX IF NOT EXISTS idx_sessions_therapist_id          ON sessions (therapist_id);

CREATE INDEX IF NOT EXISTS idx_sessions_patient_id            ON sessions (patient_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status                ON sessions (status);

CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at          ON sessions (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_sessions_radar                 ON sessions (id) WHERE radar_session = TRUE;

CREATE INDEX IF NOT EXISTS idx_sessions_org_scheduled_desc    ON sessions (organization_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_radar_request_id      ON sessions (radar_request_id);


CREATE OR REPLACE TRIGGER trg_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- Function + trigger: update patients.last_session_at and total_sessions
-- on session completion
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_patient_last_session()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE patients
    SET
      last_session_at = COALESCE(NEW.ended_at, NOW()),
      total_sessions  = total_sessions + 1,
      updated_at      = NOW()
    WHERE id = NEW.patient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE TRIGGER after_session_completed
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_patient_last_session();


-- ------------------------------------------------------------
-- transcripts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transcripts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id            UUID         REFERENCES patients(id) ON DELETE RESTRICT,
  therapist_id          UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status                VARCHAR(50)  NOT NULL DEFAULT 'processing',
  language              VARCHAR(10)  NOT NULL DEFAULT 'en',
  word_count            INTEGER,
  segment_count         INTEGER,
  duration_seconds      INTEGER,
  storage_url           VARCHAR(1000),
  processing_model      VARCHAR(100),
  processing_started    TIMESTAMPTZ,
  processing_completed  TIMESTAMPTZ,
  error_message         TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT transcripts_session_id_key UNIQUE (session_id),
  CONSTRAINT transcripts_status_check CHECK (
    status IN ('pending','processing','completed','failed','partial')
  )
);


CREATE INDEX IF NOT EXISTS idx_transcripts_session_id  ON transcripts (session_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_patient_id  ON transcripts (patient_id);

CREATE INDEX IF NOT EXISTS idx_transcripts_status      ON transcripts (status);


CREATE OR REPLACE TRIGGER trg_transcripts_updated_at
  BEFORE UPDATE ON transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- transcript_segments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transcript_segments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id   UUID        NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id      UUID        REFERENCES patients(id) ON DELETE RESTRICT,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  speaker         VARCHAR(20) NOT NULL DEFAULT 'unknown',
  speaker_label   VARCHAR(100),
  start_time_ms   INTEGER     NOT NULL,
  end_time_ms     INTEGER     NOT NULL,
  text            TEXT        NOT NULL,
  confidence      NUMERIC(4,3),
  is_edited       BOOLEAN     NOT NULL DEFAULT FALSE,
  edited_text     TEXT,
  sequence_number INTEGER     NOT NULL,
  CONSTRAINT transcript_segments_speaker_check CHECK (
    speaker IN ('therapist','patient','family','interpreter','unknown')
  )
);


CREATE INDEX IF NOT EXISTS idx_transcript_segments_transcript_id      ON transcript_segments (transcript_id);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_session_id         ON transcript_segments (session_id);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_transcript_seq     ON transcript_segments (transcript_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_text_fts
  ON transcript_segments USING GIN (to_tsvector('english', text));

-- Performance indexes (former migration 033) and join-token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_join_token ON sessions (join_token);
CREATE INDEX IF NOT EXISTS idx_sessions_no_patient ON sessions (organization_id) WHERE patient_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_scheduled ON sessions (therapist_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_org_status_scheduled ON sessions (organization_id, status, scheduled_at DESC);
