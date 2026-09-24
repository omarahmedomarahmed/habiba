-- W2-X01: a partner key is throttled now, never suspended for its rate.
--
-- Until W2-X01 the 61st call in a minute wrote `suspended_at` on the key, and
-- only an operator could clear it, so a partner key the old rule caught is still
-- dead today. This releases those keys and no others: a sponsor's key (no
-- partner_id) keeps C265's suspension, and a suspension written for any other
-- reason is left alone.
--
-- Data only, and safe to run twice.
UPDATE "partner_api_keys"
   SET "suspended_at" = NULL, "suspended_reason" = NULL
 WHERE "partner_id" IS NOT NULL
   AND "suspended_at" IS NOT NULL
   AND "suspended_reason" LIKE 'More than % calls in a minute.%';
