-- 🔴 0181: A VERIFIED CLINICIAN IS ON THE MAP WITHOUT OPENING /on-call FIRST. Additive, data only.
--
-- The patient's directory and the radar's offline dots read `therapist_radar`, and that row
-- was made only when a clinician first opened /on-call. A clinician approved and never on
-- that page was invisible to every patient. `decideVerification` now makes the row at
-- approval (`ensureRadarRowForApproved`); this does the same once for everybody approved
-- before that existed.
--
-- The row starts `offline`, so nobody is claimed to be online, and takes the country,
-- languages and specialties the clinician gave the reviewer, so the dot lands in their
-- country. An existing row is never touched: ON CONFLICT DO NOTHING. Idempotent, and safe
-- to apply before the deploy (H16): the running build simply reads more rows.

INSERT INTO "therapist_radar" ("user_id", "organization_id", "status", "country", "languages", "specialties")
SELECT u."id", u."organization_id", 'offline', v."country", v."languages", v."specialties"
  FROM "users" u
  JOIN "therapist_verifications" v ON v."user_id" = u."id" AND v."state" = 'approved'
 WHERE u."deleted_at" IS NULL
   AND NOT EXISTS (SELECT 1 FROM "therapist_radar" r WHERE r."user_id" = u."id")
ON CONFLICT ("user_id") DO NOTHING;
