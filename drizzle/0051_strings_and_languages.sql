-- Sprint 21 — every string, every language. PLAN.md 21.1–21.19.
--
-- Additive: two new tables and nothing touched. Nothing is backfilled — the
-- shipped dictionary in `lib/i18n/messages.ts` remains the default for every
-- key, and a row here is an *override*. That is the whole design: clearing an
-- override restores the shipped wording rather than blanking a button (21.5),
-- which is only true if "no override" is the absence of a row.

CREATE TABLE IF NOT EXISTS "locales" (
  "code" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "native_name" text NOT NULL,
  "direction" text DEFAULT 'ltr' NOT NULL,
  "authoring_enabled" boolean DEFAULT true NOT NULL,
  "public_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "locales"
    ADD CONSTRAINT "locales_updated_by_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "locales"
    ADD CONSTRAINT "locales_direction_known"
    CHECK ("direction" IN ('ltr', 'rtl'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A code is a language tag, not a sentence. Two to five characters, lower
-- case, optionally with a region — enough for `en`, `ar`, `pt-br`.
DO $$
BEGIN
  ALTER TABLE "locales"
    ADD CONSTRAINT "locales_code_shaped"
    CHECK ("code" ~ '^[a-z]{2}(-[a-z]{2})?$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 21.13 — a language cannot be offered to readers unless it can be
-- authored. The two switches are independent in the useful direction only:
-- author without publishing is the point; publish without authoring is a
-- language nobody can fix.
DO $$
BEGIN
  ALTER TABLE "locales"
    ADD CONSTRAINT "locales_public_implies_authoring"
    CHECK (NOT "public_enabled" OR "authoring_enabled");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ui_strings" (
  "key" text NOT NULL,
  "locale" text NOT NULL,
  "value" text NOT NULL,
  "status" text DEFAULT 'published' NOT NULL,
  "source" text DEFAULT 'human' NOT NULL,
  "model" text,
  "updated_by" uuid,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "ui_strings_pkey" PRIMARY KEY ("key", "locale")
);

DO $$
BEGIN
  ALTER TABLE "ui_strings"
    ADD CONSTRAINT "ui_strings_updated_by_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ui_strings"
    ADD CONSTRAINT "ui_strings_status_known"
    CHECK ("status" IN ('draft', 'published'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ui_strings"
    ADD CONSTRAINT "ui_strings_source_known"
    CHECK ("source" IN ('human', 'machine'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 21.5 — an override is never empty. Clearing one deletes the row and the
-- shipped default returns; an empty string would be a blank button that looks
-- like a rendering bug and is actually somebody's edit.
DO $$
BEGIN
  ALTER TABLE "ui_strings"
    ADD CONSTRAINT "ui_strings_not_blank"
    CHECK (length(btrim("value")) > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 21.19 — a machine draft names its model. A draft nobody can attribute is
-- a draft nobody can recall when the model turns out to have been wrong.
DO $$
BEGIN
  ALTER TABLE "ui_strings"
    ADD CONSTRAINT "ui_strings_machine_attributed"
    CHECK ("source" <> 'machine' OR "model" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ui_strings_locale_idx" ON "ui_strings" ("locale", "status");
