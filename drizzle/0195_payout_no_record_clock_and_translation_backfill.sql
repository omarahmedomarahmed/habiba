-- 0195: HOW LONG A PAYOUT HAS FOUND NOTHING AT THE PROVIDER, AND THE TRANSLATIONS 0191 HID.
--
-- 1. `payout_requests.provider_no_record_since`: when re-checks of a payout left `unknown`
--    started finding nothing (no record, or a provider that cannot be asked). The hourly
--    job raises it on /admin/errors after 72 hours. Nullable, nothing backfilled.
--
-- 2. 0191 hid every translation written before it, because it had no source hash. Before
--    0191 a translation was only ever written in the same statement as the note's content
--    (the draft insert or a regeneration), and every later edit of the content sets
--    `updated_at` (signing and releasing do not touch it). So a note whose `updated_at`
--    still equals its `created_at` was never written after the insert that wrote its
--    translation: the translation is of the words that stand, and it is stamped here.
--    A note touched after creation may have been edited after its translation, and no
--    timestamp says otherwise, so it stays hidden until it is translated again on signing.
--
-- Safe to apply before the deploy (H16): an added nullable column, and a stamp only the
-- 0191 reader looks at. Running it twice changes nothing.

ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "provider_no_record_since" timestamp with time zone;
--> statement-breakpoint
UPDATE "session_notes"
   SET "content_en_source" = md5("content"::text)
 WHERE "content_en" IS NOT NULL
   AND "content_en_source" IS NULL
   AND "updated_at" = "created_at";
