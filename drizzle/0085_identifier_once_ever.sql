-- 🔴 C246, actually enforced. "One identifier may be used once, ever."
--
-- `enrolments_identifier_unique` is a GLOBAL unique index on identifier_hash and
-- its own comment in 0072 says why: "Not per sponsor: an identifier that crossed
-- one gate must not cross another."
--
-- `hashIdentifier(sponsorId, value)` puts the sponsor id INSIDE the hash. So the
-- same guessed student number at two different sponsors produces two different
-- hashes and the global index never fires. The index states the ruling and the
-- hash function makes it unenforceable, which is the C377 shape again: a
-- protection described in one place and absent in another.
--
-- The attack it leaves open is the one C246 names. Somebody walks past one
-- printed QR, invents a plausible id, gets funded therapy. They walk past a
-- second organisation's QR and invent the SAME id, and are funded from a second
-- pot, because to the database those are unrelated rows.
--
-- 🔴 WHY A SECOND COLUMN RATHER THAN CHANGING THE HASH.
--
-- We deliberately never stored the plaintext identifier (C245), so the existing
-- hashes cannot be recomputed. Changing `hashIdentifier` in place would mean new
-- rows and old rows hash differently and the index would stop catching reuse
-- against everything already enrolled. A second column, unique where present,
-- protects every future enrolment and is honest about not reaching backwards.
ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS identifier_hash_global text;

-- Partial, so historical rows with no global hash do not collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS enrolments_identifier_global_unique
  ON enrolments (identifier_hash_global)
  WHERE identifier_hash_global IS NOT NULL;

COMMENT ON COLUMN enrolments.identifier_hash_global IS
  'C246. The identifier hashed WITHOUT the sponsor id, so the same value cannot be used at two sponsors. identifier_hash keeps the sponsor in it and stays the per-sponsor key. Null on rows enrolled before 0085, which cannot be backfilled because the plaintext was never stored.';
