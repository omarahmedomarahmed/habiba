-- 30.1 / C118 — the region seam.
--
-- 🔴 This records where rows ALREADY are. It is not a backfill.
--
-- Every organisation and every person in this database is today served from
-- the US instance, because there is only one instance. `DEFAULT 'us'` on an
-- existing row is therefore a statement of fact rather than a guess about
-- missing data, which is the distinction the no-backfill rule is actually
-- about: we are not inventing history, we are writing down the present so the
-- next migration does not have to.
--
-- The column is on BOTH the organisation and the person, and that is
-- deliberate rather than redundant. A clinic belongs to a jurisdiction. A
-- patient also belongs to one, and they are not always the same jurisdiction:
-- an Egyptian patient seeing a clinician registered elsewhere is the ordinary
-- case on this product, not an edge. Routing on the clinic alone would put
-- that patient's record in the wrong country, which is the entire thing C118
-- exists to prevent.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "region" text DEFAULT 'us' NOT NULL;
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "region" text DEFAULT 'us' NOT NULL;

-- The allowlist, in the database rather than only in the union type. A region
-- string that no pool exists for is a row whose data has nowhere to live, and
-- the failure mode is a query silently going to the wrong country.
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_region_known";
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_region_known" CHECK ("region" IN ('us', 'eg')) NOT VALID;
ALTER TABLE "organizations" VALIDATE CONSTRAINT "organizations_region_known";

ALTER TABLE "people" DROP CONSTRAINT IF EXISTS "people_region_known";
ALTER TABLE "people"
  ADD CONSTRAINT "people_region_known" CHECK ("region" IN ('us', 'eg')) NOT VALID;
ALTER TABLE "people" VALIDATE CONSTRAINT "people_region_known";

CREATE INDEX IF NOT EXISTS "organizations_region_idx" ON "organizations" ("region");
CREATE INDEX IF NOT EXISTS "people_region_idx" ON "people" ("region");

-- 30.3 — the dated decision, and the consent that has to precede a transfer.
--
-- A record of processing is a legal artefact: what left the country, for whom,
-- under what basis, and on what date. It is a TABLE rather than a document,
-- because a document describing a transfer is written once and a transfer
-- happens every time somebody books a session.
CREATE TABLE IF NOT EXISTS "cross_border_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  -- Where the person's data belongs, and where it is actually being served.
  "home_region" text NOT NULL,
  "serving_region" text NOT NULL,
  -- 🔴 The exact wording they agreed to, frozen. Not a version number: a
  -- pointer to wording that can be edited later proves nothing about what
  -- somebody actually read.
  "wording" text NOT NULL,
  "locale" text NOT NULL,
  "agreed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "withdrawn_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "cross_border_consents_person_idx"
  ON "cross_border_consents" ("person_id", "agreed_at" DESC);

ALTER TABLE "cross_border_consents" DROP CONSTRAINT IF EXISTS "cross_border_consents_regions_known";
ALTER TABLE "cross_border_consents"
  ADD CONSTRAINT "cross_border_consents_regions_known"
  CHECK ("home_region" IN ('us', 'eg') AND "serving_region" IN ('us', 'eg')) NOT VALID;
ALTER TABLE "cross_border_consents" VALIDATE CONSTRAINT "cross_border_consents_regions_known";

-- 🔴 A consent row that records no crossing is not a consent to anything, and
-- storing one would let a screen claim agreement for a transfer nobody was
-- asked about.
ALTER TABLE "cross_border_consents" DROP CONSTRAINT IF EXISTS "cross_border_consents_actually_crosses";
ALTER TABLE "cross_border_consents"
  ADD CONSTRAINT "cross_border_consents_actually_crosses"
  CHECK ("home_region" <> "serving_region") NOT VALID;
ALTER TABLE "cross_border_consents" VALIDATE CONSTRAINT "cross_border_consents_actually_crosses";

ALTER TABLE "cross_border_consents" DROP CONSTRAINT IF EXISTS "cross_border_consents_wording_kept";
ALTER TABLE "cross_border_consents"
  ADD CONSTRAINT "cross_border_consents_wording_kept" CHECK (length(btrim("wording")) > 40) NOT VALID;
ALTER TABLE "cross_border_consents" VALIDATE CONSTRAINT "cross_border_consents_wording_kept";
