-- W1-27: a no-show that ends cancelled or with a refund owed says so on the row.
--
-- W1-12 made `refundNoShow` honest about money: it returns `cancelled` when
-- nothing was paid and `refund_owed` when money was taken and could not go back
-- by itself. Neither was written, because this CHECK (0046) allowed only
-- reassigned, refunded and abandoned. So the session carried no outcome, the
-- patient's screen had to guess from the payment row, and a second press found
-- nothing to stop it but the status.
--
-- Widened, not replaced: every existing row holds one of the original three or
-- NULL, so VALIDATE is a scan that cannot fail, and it runs so the CHECK stays
-- asserted rather than left NOT VALID.
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_recovery_outcome_known";

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_recovery_outcome_known"
  CHECK ("recovery_outcome" IS NULL OR "recovery_outcome" IN
    ('reassigned', 'refunded', 'abandoned', 'cancelled', 'refund_owed'))
  NOT VALID;

ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_recovery_outcome_known";
