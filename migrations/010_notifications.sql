-- ============================================================
-- 24Therapy MVP schema — notifications, push devices
-- Generated fresh for the MVP database reset (docs/PRODUCT_MVP.md).
-- Runs in order via scripts/migrate.js on every backend deploy.
-- ============================================================


-- ------------------------------------------------------------
-- notification_templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_templates (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key VARCHAR(100) NOT NULL,
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
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_templates_key UNIQUE (template_key)
);


CREATE OR REPLACE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
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


CREATE INDEX IF NOT EXISTS idx_notifications_user_id           ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read         ON notifications (user_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_pending ON notifications (scheduled_for) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notifications_created_desc      ON notifications (created_at DESC);


-- ------------------------------------------------------------
-- notification_preferences
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                       UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID         NOT NULL REFERENCES users(id),
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
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id)
);


CREATE OR REPLACE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- push_devices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_devices (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  platform     VARCHAR(20) NOT NULL,
  device_token TEXT        NOT NULL,
  device_name  VARCHAR(255),
  app_version  VARCHAR(50),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_devices_user_token_key UNIQUE (user_id, device_token)
);


-- ------------------------------------------------------------
-- notification_queue
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_queue (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id  UUID        NOT NULL REFERENCES notifications(id),
  priority         INTEGER     NOT NULL DEFAULT 5,
  attempts         INTEGER     NOT NULL DEFAULT 0,
  max_attempts     INTEGER     NOT NULL DEFAULT 3,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at        TIMESTAMPTZ,
  locked_by        VARCHAR(255),
  completed_at     TIMESTAMPTZ,
  failed_at        TIMESTAMPTZ,
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_notification_queue_runnable
  ON notification_queue (next_attempt_at, priority)
  WHERE completed_at IS NULL AND failed_at IS NULL;


-- ------------------------------------------------------------
-- release_stale_notification_locks()
-- Called by the notifications cron every 10 minutes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION release_stale_notification_locks()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notification_queue
  SET    locked_at       = NULL,
         locked_by       = NULL,
         next_attempt_at = NOW()
  WHERE  locked_at < NOW() - INTERVAL '10 minutes'
    AND  completed_at IS NULL
    AND  failed_at    IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
