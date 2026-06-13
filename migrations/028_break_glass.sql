-- Migration 028: Emergency Access (Break-Glass)
-- HIPAA §164.312(a)(2)(ii) — Emergency Access Procedure
-- Provides an audited bypass mechanism for accessing patient records in
-- emergencies (e.g., system failure, patient crisis with unavailable therapist).

CREATE TABLE IF NOT EXISTS break_glass_access (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES users(id),
  target_user_id  UUID REFERENCES users(id),
  reason          TEXT NOT NULL,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resources       JSONB NOT NULL DEFAULT '[]',
  acknowledged    BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_break_glass_admin ON break_glass_access(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_break_glass_accessed_at ON break_glass_access(accessed_at DESC);

COMMENT ON TABLE break_glass_access IS
  'Emergency access log — every row is an audited PHI access bypass event. '
  'Review weekly; any unexplained entries require security officer review.';
