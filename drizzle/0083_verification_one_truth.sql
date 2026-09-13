-- 0083 — C285. One source of truth for whether a clinician is verified. Additive.
--
-- 🔴 THE CLAIM THIS WHOLE PRODUCT RESTS ON HAD TWO ANSWERS.
--
-- `users.verification_status` is read by twenty files. `therapist_verifications.state` is what the
-- database enforces: `history_grants_require_verified()` refuses a clinical grant to anybody whose
-- verification is not `approved`, which is C106's invariant. Production today says one user verified
-- and zero verifications approved, so the two disagree on a live row.
--
-- Where that disagreement surfaces:
--
--   * lib/data/radar.ts:521      a clinician shown as verified on the public radar a patient chooses
--                                from
--   * lib/data/clinic.ts:97      a clinician shown as verified inside a clinic's own portal
--   * lib/partner/api.ts:89      🔴 55.5's answer to a partner asking whether we have verified this
--                                clinician — an assertion to an external commercial party
--   * lib/partner/launch.ts:139  whether a partner may launch that clinician into a session at all
--
-- The partner case is the sharp one. "Only certified therapists" is the claim the product rests on,
-- and it was being answered from a column nothing enforced.
--
-- ## 🔴 AND THE PREVIOUS FIX RESOLVED IT THE WRONG WAY, ON PURPOSE, WITH A REASON
--
-- `lib/data/verification.ts` already carries a note about this exact divergence. Its fix was to
-- write both columns and, on read, to resolve a disagreement IN THE CLINICIAN'S FAVOUR:
--
--     if (row.mirror === "verified") return "approved";
--
-- so the soft column won. The reasoning was humane and wrong: a clinician should not be locked out
-- by a stale mirror. But the same line says a clinician who was never approved is cleared to see
-- patients as long as somebody once wrote "verified" onto their user row. A tie-break that favours
-- access is a tie-break that favours the unverified.
--
-- ## THE RULE
--
-- `therapist_verifications.state` is the only source of truth. `users.verification_status` stays —
-- twenty files read it and rewriting all twenty would be twenty chances to miss one — but it stops
-- being a fact anybody writes and becomes a DERIVED column the database maintains. Application code
-- cannot set it, cannot diverge from it, and does not have to remember to mirror anything.
--
-- Three pieces:
--
--   1. `derived_verification_status(user)` — the mapping, in one place.
--   2. A trigger on `therapist_verifications` that pushes any change onto the user row.
--   3. A trigger on `users` that FORCES the column to the derived value on every insert and update.
--
-- 🔴 Piece 3 FORCES rather than RAISES, and the difference is deliberate. A trigger that raised
-- would make every unrelated UPDATE on a legacy divergent row fail — renaming a clinician would
-- error about a column the caller never touched, which is the same "error names the wrong table"
-- shape 0082 existed to remove. Forcing means the column is a materialised answer to a question the
-- other table owns: writes to it are not refused, they are irrelevant.

-- ---------------------------------------------------------------------------
-- 1. The mapping, once.

CREATE OR REPLACE FUNCTION public.derived_verification_status(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        -- 🔴 Approved wins outright: this is the state the grant trigger reads.
        WHEN bool_or(v.state = 'approved')  THEN 'verified'
        WHEN bool_or(v.state = 'rejected')  THEN 'rejected'
        WHEN bool_or(v.state = 'submitted') THEN 'pending'
        ELSE 'unverified'
      END
      FROM therapist_verifications v
      WHERE v.user_id = p_user_id
    ),
    -- No submission at all is not the same as a rejected one, and both read as not verified.
    'unverified'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. A change to the truth reaches the derived column immediately.

CREATE OR REPLACE FUNCTION public.sync_user_verification_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target uuid;
BEGIN
  target := COALESCE(NEW.user_id, OLD.user_id);

  UPDATE users
     SET verification_status = public.derived_verification_status(target),
         updated_at = now()
   WHERE id = target
     AND verification_status IS DISTINCT FROM public.derived_verification_status(target);

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS therapist_verifications_sync_user ON therapist_verifications;
CREATE TRIGGER therapist_verifications_sync_user
AFTER INSERT OR UPDATE OR DELETE ON therapist_verifications
FOR EACH ROW EXECUTE FUNCTION public.sync_user_verification_status();

-- ---------------------------------------------------------------------------
-- 3. 🔴 And nothing else can set it, on any row, from any code path.

CREATE OR REPLACE FUNCTION public.force_derived_verification_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.verification_status := public.derived_verification_status(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_verification_status_derived ON users;
CREATE TRIGGER users_verification_status_derived
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION public.force_derived_verification_status();

-- ---------------------------------------------------------------------------
-- 🔴 4. THE RECONCILIATION, AND IT CHANGES LIVE DATA. READ THIS BEFORE APPLYING.
--
-- Every existing user row is set to the derived value. On production that means the ONE row
-- currently reading `verified` with no approved verification stops reading verified.
--
-- 🔴 The other direction was available and is worse. Writing an `approved` row into
-- `therapist_verifications` for anybody currently marked verified would preserve every screen
-- exactly as it looks today — and it would MANUFACTURE A CREDENTIALING RECORD for a review that
-- never happened. That is the same defect one layer down: inventing the evidence to keep the display
-- honest. The claim is "only certified therapists"; a certification the product wrote for itself is
-- not one.
--
-- A clinician verified through the real flow is unaffected: `setVerification` writes the
-- `approved` row, so their derived value is `verified` and this statement is a no-op for them.

UPDATE users
   SET verification_status = public.derived_verification_status(id)
 WHERE verification_status IS DISTINCT FROM public.derived_verification_status(id);
