-- 🔴 SPRINT 66 — `employment:verify` CAME HOME.
--
-- It was a partner scope: a third party held a key and asked us about a company's
-- staff. The company is right here, signed in, and it is their staff. The
-- organisation an identity question is about should be the portal somebody is signed
-- into, not a field on a form.
--
-- ## 🔴 ONE KEY TABLE, NOT TWO, AND THAT IS THE DECISION IN THIS FILE
--
-- The tempting build is `sponsor_api_keys`. It would mean a second hash comparison, a
-- second rate limiter, a second suspension mechanism and a second place for C265's
-- four defences to be almost right. `authenticate_key` already reads `sponsor_id` and
-- already suspends on an abnormal rate; what it cannot do is find a row whose
-- `partner_id` is null, because the column is NOT NULL and the query inner-joins
-- `partners`.
--
-- So: the column becomes nullable, a CHECK requires exactly one owner, and every
-- existing row keeps a partner. Additive (H16): dropping a NOT NULL never fails and
-- never rewrites.

ALTER TABLE partner_api_keys ALTER COLUMN partner_id DROP NOT NULL;

-- 🔴 A KEY HAS AN OWNER. The constraint is that, and not "exactly one".
--
-- "Exactly one" is the rule this wanted to be and it is not the rule the table can
-- hold: `sponsor_id` has meant "the one organisation a PARTNER's key may ask about"
-- since C265, so a partner key with a sponsor beside it is a shape that already
-- exists in this column and was correct when it was written.
--
-- What must never exist is a key nobody owns. `authenticate_key` would refuse one
-- anyway, by failing its join; this makes it unstorable, which is the difference
-- between a query that happens to filter it and a row that cannot be written.
--
-- 🔴 WHICH KIND A KEY IS, IS THEN A PROPERTY OF `partner_id` BEING NULL, and
-- `mintSponsorKey` is the only thing that writes such a row. There is no form field
-- naming an organisation anywhere in the sponsor portal, so there is no way to name
-- the wrong one: 66.4's "structural rather than a CHECK" is that absence.
ALTER TABLE partner_api_keys DROP CONSTRAINT IF EXISTS partner_api_keys_one_owner;
ALTER TABLE partner_api_keys ADD CONSTRAINT partner_api_keys_one_owner
  CHECK (partner_id IS NOT NULL OR sponsor_id IS NOT NULL)
  NOT VALID;
ALTER TABLE partner_api_keys VALIDATE CONSTRAINT partner_api_keys_one_owner;

COMMENT ON COLUMN partner_api_keys.partner_id IS
  'C265 / 66.4. Null for a key a SPONSOR minted from their own portal, which carries sponsor_id instead. A key with no partner is a sponsor''s own. One key table rather than two, so C265''s four defences have one implementation rather than two that are almost the same.';

-- 🔴 66.7 — CONNECTED MEANS A CALL SUCCEEDED, WITH A TIMESTAMP.
--
-- *Not a green dot that means "we saved your settings".*
--
-- `last_used_at` already exists and is stamped by the limiter on every authenticated
-- call, including the ones that then fail on a scope or an attestation. That is the
-- wrong signal for this indicator: it would go green for a key that has never
-- successfully answered anything.
ALTER TABLE partner_api_keys ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

COMMENT ON COLUMN partner_api_keys.last_success_at IS
  '66.7. When this key last got a real answer, as distinct from last_used_at which is stamped on every authenticated call including the ones that fail. An indicator built on last_used_at goes green for a key that has never successfully answered anything.';

-- 🔴 66.2 — "ENABLE EMPLOYMENT VERIFICATION" IS OFF BY DEFAULT.
--
-- C227's whole design removed the roster. This is the one thing that touches
-- employment, so it is a deliberate act with a time on it rather than a capability
-- that exists because an account does.
--
-- 🔴 AND THE HR SYSTEM THEY NAMED, because 66.5 changes the steps to match it and a
-- support conversation that starts with "which HR system" has already lost.
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS employment_verification_enabled_at timestamptz;
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS hr_system text;

COMMENT ON COLUMN sponsors.employment_verification_enabled_at IS
  '66.2. Off by default and on only by a deliberate act, because C227 removed the roster and this is the one thing that touches employment. Null is off.';
