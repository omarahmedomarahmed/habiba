-- 🔴 66.8 / 66.9 — THE DELIVERY LOG, ON THE SPONSOR'S OWN PAGE.
--
-- > *Every webhook we sent them, the event, the response code, and the error when
-- > there was one. They debug their side without a support ticket, and we stop being
-- > the only people who can see what happened.*
--
-- `partner_webhooks` has one owner column and it is a partner. The same decision
-- 0097 made about keys applies here for the same reason: one delivery queue, one
-- retry policy, one payload rule, rather than two that are almost the same.
--
-- Additive (H16).

ALTER TABLE partner_webhooks ALTER COLUMN partner_id DROP NOT NULL;

ALTER TABLE partner_webhooks
  ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES sponsors (id) ON DELETE CASCADE;

-- A registration nobody owns delivers to nowhere and should not be storable.
ALTER TABLE partner_webhooks DROP CONSTRAINT IF EXISTS partner_webhooks_one_owner;
ALTER TABLE partner_webhooks ADD CONSTRAINT partner_webhooks_one_owner
  CHECK (partner_id IS NOT NULL OR sponsor_id IS NOT NULL)
  NOT VALID;
ALTER TABLE partner_webhooks VALIDATE CONSTRAINT partner_webhooks_one_owner;

CREATE INDEX IF NOT EXISTS partner_webhooks_sponsor_idx
  ON partner_webhooks (sponsor_id)
  WHERE sponsor_id IS NOT NULL;

COMMENT ON COLUMN partner_webhooks.sponsor_id IS
  '66.8. Set for a registration a SPONSOR made from their own integrations page, where partner_id is null. One webhook table rather than two, so the payload rule 42.4 put on every delivery has one implementation.';

-- 🔴 66.9 — AND THE PAYLOAD RULE IS ALREADY WHAT PROTECTS THIS.
--
-- `partner_webhook_deliveries` carries an event, a subject id and a status. There is
-- no column on it that could hold an employee's name, an identifier, or the thing a
-- call was about, and that was true before this sprint: 42.4 settled it.
--
-- What this comment records is that the absence is now doing a second job. A
-- connection log that named the person each call was about would rebuild the roster
-- C227 removed, inside the audit trail, one row at a time. The table cannot, because
-- there is nowhere to put it.
COMMENT ON TABLE partner_webhook_deliveries IS
  '42.4 / 66.9. An event and an id. There is no column here that could hold what a call was about, which is what stops a connection log rebuilding the staff roster C227 removed.';
