-- ============================================================
-- 006_sessions.sql
-- 24Therapy.ai — Sessions, Transcripts, Recordings, Reports
-- Also adds deferred FKs back to patient_files/life_events/relationships
-- ============================================================

-- ------------------------------------------------------------
-- sessions
-- ------------------------------------------------------------
CREATE TABLE sessions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  therapist_id            UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  patient_id              UUID         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_sessions_organization_id       ON sessions (organization_id);
CREATE INDEX idx_sessions_therapist_id          ON sessions (therapist_id);
CREATE INDEX idx_sessions_patient_id            ON sessions (patient_id);
CREATE INDEX idx_sessions_status                ON sessions (status);
CREATE INDEX idx_sessions_scheduled_at          ON sessions (scheduled_at);
CREATE INDEX idx_sessions_radar                 ON sessions (id) WHERE radar_session = TRUE;
CREATE INDEX idx_sessions_org_scheduled_desc    ON sessions (organization_id, scheduled_at DESC);
CREATE INDEX idx_sessions_radar_request_id      ON sessions (radar_request_id);

CREATE TRIGGER trg_sessions_updated_at
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

CREATE TRIGGER after_session_completed
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION update_patient_last_session();

-- ------------------------------------------------------------
-- session_participants
-- ------------------------------------------------------------
CREATE TABLE session_participants (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id         UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES users(id),
  role               VARCHAR(50) NOT NULL,
  display_name       VARCHAR(200),
  joined_at          TIMESTAMPTZ,
  left_at            TIMESTAMPTZ,
  duration_seconds   INTEGER,
  connection_quality JSONB,
  CONSTRAINT session_participants_role_check CHECK (
    role IN ('therapist','patient','observer','interpreter','family','supervisor')
  )
);

CREATE INDEX idx_session_participants_session_id ON session_participants (session_id);

-- ------------------------------------------------------------
-- session_notes
-- ------------------------------------------------------------
CREATE TABLE session_notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  therapist_id    UUID        NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  note_type       VARCHAR(50) NOT NULL DEFAULT 'during_session',
  content         TEXT,
  is_private      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_notes_type_check CHECK (
    note_type IN ('pre_session','during_session','post_session','quick_note')
  )
);

CREATE INDEX idx_session_notes_session_id ON session_notes (session_id);

CREATE TRIGGER trg_session_notes_updated_at
  BEFORE UPDATE ON session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- transcripts
-- ------------------------------------------------------------
CREATE TABLE transcripts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id            UUID         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_transcripts_session_id  ON transcripts (session_id);
CREATE INDEX idx_transcripts_patient_id  ON transcripts (patient_id);
CREATE INDEX idx_transcripts_status      ON transcripts (status);

CREATE TRIGGER trg_transcripts_updated_at
  BEFORE UPDATE ON transcripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- transcript_segments
-- ------------------------------------------------------------
CREATE TABLE transcript_segments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id   UUID        NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
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

CREATE INDEX idx_transcript_segments_transcript_id      ON transcript_segments (transcript_id);
CREATE INDEX idx_transcript_segments_session_id         ON transcript_segments (session_id);
CREATE INDEX idx_transcript_segments_transcript_seq     ON transcript_segments (transcript_id, sequence_number);
CREATE INDEX idx_transcript_segments_text_fts
  ON transcript_segments USING GIN (to_tsvector('english', text));

-- ------------------------------------------------------------
-- session_recordings
-- ------------------------------------------------------------
CREATE TABLE session_recordings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        UUID          NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  organization_id   UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recording_type    VARCHAR(20)   NOT NULL DEFAULT 'video',
  storage_url       VARCHAR(1000) NOT NULL,
  storage_provider  VARCHAR(50)   NOT NULL DEFAULT 'aws_s3',
  size_bytes        BIGINT,
  duration_seconds  INTEGER,
  format            VARCHAR(20),
  encryption_key_id VARCHAR(255),
  retention_until   DATE,
  downloaded_count  INTEGER       NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_recordings_session_id ON session_recordings (session_id);

-- ------------------------------------------------------------
-- session_reports
-- ------------------------------------------------------------
CREATE TABLE session_reports (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id         UUID         NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT,
  patient_id         UUID         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  therapist_id       UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type        VARCHAR(50)  NOT NULL DEFAULT 'clinical',
  title              VARCHAR(255),
  content            TEXT,
  structured_content JSONB,
  status             VARCHAR(50)  NOT NULL DEFAULT 'draft',
  storage_url        VARCHAR(1000),
  approved_by        UUID REFERENCES users(id),
  approved_at        TIMESTAMPTZ,
  sent_to_patient    BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT session_reports_status_check CHECK (
    status IN ('draft','approved','sent','archived')
  )
);

CREATE INDEX idx_session_reports_session_id  ON session_reports (session_id);
CREATE INDEX idx_session_reports_patient_id  ON session_reports (patient_id);

CREATE TRIGGER trg_session_reports_updated_at
  BEFORE UPDATE ON session_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Deferred FK constraints: patient_files, patient_life_events,
-- patient_relationships → sessions (tables created in 004, sessions
-- table now exists)
-- ------------------------------------------------------------
ALTER TABLE patient_files
  ADD CONSTRAINT fk_patient_files_session
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE patient_life_events
  ADD CONSTRAINT fk_life_events_session
  FOREIGN KEY (source_session_id) REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE patient_relationships
  ADD CONSTRAINT fk_relationships_session
  FOREIGN KEY (source_session_id) REFERENCES sessions(id) ON DELETE SET NULL;
