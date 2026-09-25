-- 🔴 0163: ONE SESSION IS 50 MINUTES IN TOTAL (founder rulings 6 and 6b).
--
-- The clock ran 50 minutes and then a 10-minute countdown, so a session
-- stopped at 60 while every screen promised 50. The countdown is inside the
-- 50: 40 quiet minutes, then 10 counted down. A row somebody already changed
-- to anything but the old 50 + 10 is left as they set it.
UPDATE "platform_settings"
   SET "value" = jsonb_set("value", '{runningMinutes}', '40'::jsonb), "updated_at" = now()
 WHERE "key" = 'clock'
   AND ("value"->>'runningMinutes')::int = 50
   AND COALESCE(("value"->>'countdownMinutes')::int, 10) = 10;
