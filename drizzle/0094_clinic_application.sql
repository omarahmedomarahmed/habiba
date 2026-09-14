-- 🔴 63.18 — A CLINIC-ADMIN-FIRST SIGNUP PATH: details, licence, names, approval.
--
-- 54.3 already refuses a self-serve route to an ACTIVE clinic, and that stays: an
-- enquiry produces a held row and a phone call, because a self-serve path to a
-- tenancy containing clinical records is a self-serve path to clinical records.
--
-- What is missing is what the operator on that call has to ask for anyway. Three
-- columns, so the answers arrive with the application instead of in an email thread
-- nobody can find later.
--
-- Additive (H16). Nothing here rewrites an existing row.

-- The practice's own registration, which is the thing that makes it a practice
-- rather than somebody with a company name.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS registration_number text;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS registration_authority text;

-- 🔴 NAMES ONLY, AND THE COLUMN'S TYPE IS THE RULING.
--
-- C267 says the clinic's word is not evidence: every clinician verifies themselves
-- with us, personally, exactly as a solo one does. So this holds the names a practice
-- expects to bring and NOTHING that could be read as a credential — no licence
-- number, no registration body, no specialty, no email.
--
-- A text array rather than a jsonb of objects, so there is no shape for one to be
-- added to. Somebody wanting to record a licence here would have to change the column
-- type, which is a line in a migration somebody reviews rather than a key in a blob.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS intended_clinicians text[] NOT NULL DEFAULT '{}';

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_intended_clinicians_bounded;
ALTER TABLE organizations ADD CONSTRAINT organizations_intended_clinicians_bounded
  CHECK (cardinality(intended_clinicians) <= 100)
  NOT VALID;
ALTER TABLE organizations VALIDATE CONSTRAINT organizations_intended_clinicians_bounded;

COMMENT ON COLUMN organizations.intended_clinicians IS
  'C267 / 63.18. The names a practice said it intends to bring, taken at application time so the operator on the call is not starting from nothing. Names only: a text[] has no shape for a licence number, and the clinic''s word about a credential is not evidence in any case.';

COMMENT ON COLUMN organizations.registration_number IS
  '63.18. The practice''s own registration, asked for at application rather than on the call. Unverified by us: it is what they typed, and the operator checks it.';
