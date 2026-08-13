-- The CMS gains a language.
--
-- `content_pages` was unique on slug alone, which encodes the assumption that
-- a page is one thing. Every marketing page, every legal page and the whole
-- public site were therefore English-only at the database level — no amount of
-- interface translation reaches them, because their words are rows.
--
-- Uniqueness moves to (slug, locale). Existing rows become 'en', which is what
-- they always were.
--
-- Resolution falls back to English rather than 404ing, and that asymmetry is
-- deliberate. A missing Arabic page should show the English one, because a
-- patient looking for the crisis radar needs the page more than they need it
-- in their language. That is the opposite of the rule for interface strings,
-- where a silent English fallback is banned and enforced by the type system —
-- the difference is that a missing UI string is a bug somebody forgot, while a
-- missing CMS page is content nobody has written yet.

ALTER TABLE "content_pages" ADD COLUMN IF NOT EXISTS "locale" text NOT NULL DEFAULT 'en';

DROP INDEX IF EXISTS "content_pages_slug_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "content_pages_slug_locale_unique"
  ON "content_pages" ("slug", "locale");
