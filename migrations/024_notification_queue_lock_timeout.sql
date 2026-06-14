-- Migration 024: Notification queue stale lock release
-- Notifications that crash while processing keep their locked_at set forever,
-- preventing any retry. This function clears locks older than 10 minutes so
-- the queue processor can pick them up again on the next cycle.

CREATE OR REPLACE FUNCTION release_stale_notification_locks()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE notification_queue
  SET locked_at   = NULL,
      locked_by   = NULL,
      attempts    = attempts + 1
  WHERE locked_at < NOW() - INTERVAL '10 minutes'
    AND completed_at IS NULL;
$$;
