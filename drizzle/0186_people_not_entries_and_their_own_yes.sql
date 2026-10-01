-- 🔴 0186: PEOPLE, NOT ENTRIES; AND THEIR OWN YES. Additive. Findings F7 and F6 of the
-- independent due diligence.
--
-- F7: a company's money view reported a period once it held five ENTRIES, and five entries
-- can be one person. `sponsor_money_entries.person_tag` is a digest keyed by the server
-- secret, written with each new entry, so the view can count DIFFERENT people before it
-- reports a period. It joins to nothing and the company view never returns it. Older rows
-- stay null and are counted as one person between them, the safe direction.
--
-- F6: a partner key could sign in any clinician on its bill knowing only their email, and a
-- partner could vouch for its patient's recording consent. `clinician_partner_approvals` is
-- the clinician's own approval of a partner (revocable). `partner_consents.source` says
-- whose answer a row is: only `patient` (their own, signed in here) and `sandbox` (a test
-- subject, nobody) open a recording; a partner's vouched yes is `partner` and opens nothing.
-- Every existing row is `partner` except those on sandbox sessions, which are backfilled.
-- Every live launched session is ended: they were minted unrestricted for an hour.
--
-- Safe to apply before the deploy (H16): the running build reads none of the new columns,
-- writes `partner_consents` without `source` (the default applies), and writes
-- `sponsor_money_entries` without `person_tag` (null).

ALTER TABLE "sponsor_money_entries" ADD COLUMN IF NOT EXISTS "person_tag" text;
--> statement-breakpoint
ALTER TABLE "partner_consents" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'partner' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "partner_consents" ADD CONSTRAINT "partner_consents_source"
    CHECK ("source" IN ('partner', 'patient', 'sandbox'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
UPDATE "partner_consents" c SET "source" = 'sandbox'
  FROM "partner_sessions" s
 WHERE s."partner_id" = c."partner_id"
   AND s."external_session_ref" = c."external_session_ref"
   AND s."environment" = 'sandbox'
   AND c."source" = 'partner';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clinician_partner_approvals" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "partner_id" uuid NOT NULL REFERENCES "partners"("id") ON DELETE CASCADE,
  "approved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "clinician_partner_approvals_user_id_partner_id_pk" PRIMARY KEY ("user_id", "partner_id")
);
--> statement-breakpoint
UPDATE "auth_sessions" SET "revoked_at" = now()
 WHERE "created_via" = 'partner_launch' AND "revoked_at" IS NULL;
