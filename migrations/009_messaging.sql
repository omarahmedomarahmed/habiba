-- ============================================================
-- 009_messaging.sql
-- 24Therapy.ai — Messaging, Notifications, Push, Queue
-- ============================================================

-- ------------------------------------------------------------
-- conversations
-- ------------------------------------------------------------
CREATE TABLE conversations (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID         NOT NULL REFERENCES organizations(id),
  type             VARCHAR(50)  NOT NULL DEFAULT 'patient_therapist',
  patient_id       UUID         REFERENCES patients(id),
  therapist_id     UUID         REFERENCES therapists(id),
  status           VARCHAR(50)  NOT NULL DEFAULT 'active',
  subject          VARCHAR(255),
  priority         VARCHAR(20)  NOT NULL DEFAULT 'normal',
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_organization_id ON conversations(organization_id);
CREATE INDEX idx_conversations_therapist_id    ON conversations(therapist_id);
CREATE INDEX idx_conversations_patient_id      ON conversations(patient_id);

CREATE UNIQUE INDEX idx_conversations_patient_therapist_active
  ON conversations(patient_id, therapist_id)
  WHERE status = 'active' AND type = 'patient_therapist';

-- ------------------------------------------------------------
-- messages
-- ------------------------------------------------------------
CREATE TABLE messages (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID         NOT NULL REFERENCES conversations(id),
  sender_id        UUID         NOT NULL REFERENCES users(id),
  content          TEXT         NOT NULL,
  content_type     VARCHAR(50)  NOT NULL DEFAULT 'text',
  message_type     VARCHAR(50)  NOT NULL DEFAULT 'text',
  file_url         TEXT,
  read             BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at          TIMESTAMPTZ,
  metadata         JSONB,
  encrypted        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_unread               ON messages(conversation_id, read) WHERE read = FALSE;
CREATE INDEX idx_messages_sender_id            ON messages(sender_id);
CREATE INDEX idx_messages_encrypted            ON messages(encrypted) WHERE encrypted = TRUE;

-- ------------------------------------------------------------
-- notification_templates
-- ------------------------------------------------------------
CREATE TABLE notification_templates (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key VARCHAR(100) NOT NULL UNIQUE,
  name         VARCHAR(255) NOT NULL,
  channel      VARCHAR(50)  NOT NULL,
  subject      VARCHAR(500),
  body_text    TEXT         NOT NULL,
  body_html    TEXT,
  variables    TEXT[]       NOT NULL DEFAULT '{}',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  language     VARCHAR(20)  NOT NULL DEFAULT 'en',
  version      INTEGER      NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
CREATE TABLE notifications (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID         REFERENCES organizations(id),
  user_id         UUID         NOT NULL REFERENCES users(id),
  template_key    VARCHAR(100) REFERENCES notification_templates(template_key),
  channel         VARCHAR(50)  NOT NULL,
  title           VARCHAR(500),
  body            TEXT         NOT NULL,
  action_url      TEXT,
  action_label    VARCHAR(100),
  read            BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  delivered       BOOLEAN      NOT NULL DEFAULT FALSE,
  delivered_at    TIMESTAMPTZ,
  status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
  priority        VARCHAR(20)  NOT NULL DEFAULT 'normal',
  metadata        JSONB,
  scheduled_for   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id         ON notifications(user_id);
CREATE INDEX idx_notifications_user_read        ON notifications(user_id, read);
CREATE INDEX idx_notifications_scheduled        ON notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notifications_created_desc     ON notifications(created_at DESC);

-- ------------------------------------------------------------
-- notification_preferences
-- ------------------------------------------------------------
CREATE TABLE notification_preferences (
  id                       UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID         NOT NULL UNIQUE REFERENCES users(id),
  in_app_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
  email_enabled            BOOLEAN      NOT NULL DEFAULT TRUE,
  email_session_reminders  BOOLEAN      NOT NULL DEFAULT TRUE,
  email_report_ready       BOOLEAN      NOT NULL DEFAULT TRUE,
  email_assessment_due     BOOLEAN      NOT NULL DEFAULT TRUE,
  email_payment_events     BOOLEAN      NOT NULL DEFAULT TRUE,
  email_marketing          BOOLEAN      NOT NULL DEFAULT TRUE,
  email_radar_matches      BOOLEAN      NOT NULL DEFAULT TRUE,
  email_risk_alerts        BOOLEAN      NOT NULL DEFAULT TRUE,
  sms_enabled              BOOLEAN      NOT NULL DEFAULT TRUE,
  sms_session_reminders    BOOLEAN      NOT NULL DEFAULT TRUE,
  sms_radar_matches        BOOLEAN      NOT NULL DEFAULT TRUE,
  sms_verification         BOOLEAN      NOT NULL DEFAULT TRUE,
  sms_security_alerts      BOOLEAN      NOT NULL DEFAULT TRUE,
  push_enabled             BOOLEAN      NOT NULL DEFAULT TRUE,
  push_token               TEXT,
  push_session_reminders   BOOLEAN      NOT NULL DEFAULT TRUE,
  push_messages            BOOLEAN      NOT NULL DEFAULT TRUE,
  push_radar               BOOLEAN      NOT NULL DEFAULT TRUE,
  quiet_hours_enabled      BOOLEAN      NOT NULL DEFAULT FALSE,
  quiet_start              TIME,
  quiet_end                TIME,
  timezone                 VARCHAR(100) NOT NULL DEFAULT 'UTC',
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- email_delivery_log
-- ------------------------------------------------------------
CREATE TABLE email_delivery_log (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id       UUID         REFERENCES notifications(id),
  recipient_email       VARCHAR(255) NOT NULL,
  provider              VARCHAR(50)  NOT NULL DEFAULT 'resend',
  provider_message_id   VARCHAR(255),
  status                VARCHAR(50)  NOT NULL DEFAULT 'sent',
  opened_at             TIMESTAMPTZ,
  clicked_at            TIMESTAMPTZ,
  bounced_at            TIMESTAMPTZ,
  bounce_type           VARCHAR(50),
  spam_at               TIMESTAMPTZ,
  error_code            VARCHAR(100),
  error_message         TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- push_devices
-- ------------------------------------------------------------
CREATE TABLE push_devices (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID         NOT NULL REFERENCES users(id),
  platform     VARCHAR(20)  NOT NULL,
  device_token TEXT         NOT NULL,
  device_name  VARCHAR(255),
  app_version  VARCHAR(50),
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_push_devices_user_token UNIQUE(user_id, device_token)
);

-- ------------------------------------------------------------
-- notification_queue
-- ------------------------------------------------------------
CREATE TABLE notification_queue (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID         NOT NULL REFERENCES notifications(id),
  priority        INTEGER      NOT NULL DEFAULT 5,
  attempts        INTEGER      NOT NULL DEFAULT 0,
  max_attempts    INTEGER      NOT NULL DEFAULT 3,
  next_attempt_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ,
  locked_by       VARCHAR(255),
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_workable
  ON notification_queue(next_attempt_at, priority)
  WHERE completed_at IS NULL AND failed_at IS NULL;

-- ------------------------------------------------------------
-- release_stale_notification_locks()
-- Releases queue rows locked for more than 10 minutes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_stale_notification_locks()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notification_queue
  SET locked_at       = NULL,
      locked_by       = NULL,
      next_attempt_at = NOW()
  WHERE locked_at < NOW() - INTERVAL '10 minutes'
    AND completed_at IS NULL
    AND failed_at    IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- enqueue_notification()
-- Creates a notification row + a notification_queue entry
-- in a single call.
-- Usage: SELECT enqueue_notification(
--   p_user_id, p_channel, p_title, p_body,
--   p_org_id, p_template_key, p_priority, p_scheduled_for
-- );
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id       UUID,
  p_channel       VARCHAR,
  p_title         VARCHAR,
  p_body          TEXT,
  p_org_id        UUID        DEFAULT NULL,
  p_template_key  VARCHAR     DEFAULT NULL,
  p_priority      INTEGER     DEFAULT 5,
  p_scheduled_for TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    organization_id,
    user_id,
    template_key,
    channel,
    title,
    body,
    status,
    scheduled_for
  ) VALUES (
    p_org_id,
    p_user_id,
    p_template_key,
    p_channel,
    p_title,
    p_body,
    'pending',
    p_scheduled_for
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO notification_queue (
    notification_id,
    priority,
    next_attempt_at
  ) VALUES (
    v_notification_id,
    p_priority,
    p_scheduled_for
  );

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;
