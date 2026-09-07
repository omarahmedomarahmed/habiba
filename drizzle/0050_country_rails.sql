-- Sprint 20R — 20.2–20.5, the country settings an administrator can actually
-- edit. Additive: nine nullable-or-defaulted columns on one table, nothing
-- backfilled. Every existing row keeps behaving exactly as it did, because
-- `lib/regulators.ts` remains the fallback for any field left empty.

ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "collection_provider" text;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "payout_methods" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "entity" text DEFAULT 'us' NOT NULL;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "regulators" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "id_label_front" text;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "id_label_back" text;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "licence_label" text;
ALTER TABLE "country_settings"
  ADD COLUMN IF NOT EXISTS "sample_image_url" text;

DO $$
BEGIN
  ALTER TABLE "country_settings"
    ADD CONSTRAINT "country_settings_entity_known"
    CHECK ("entity" IN ('us', 'eg')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- VAT is a percentage, not a licence to charge anything. 10,000bps is the
-- whole payment; a country configured above that is a typo with a tax office
-- on the other end of it.
DO $$
BEGIN
  ALTER TABLE "country_settings"
    ADD CONSTRAINT "country_settings_vat_sane"
    CHECK ("vat_bps" >= 0 AND "vat_bps" <= 5000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
