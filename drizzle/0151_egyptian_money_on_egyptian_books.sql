-- 🔴 0151: EGYPTIAN MONEY ON THE EGYPTIAN BOOKS.
--
-- Every ledger leg defaulted to the `us` entity, so a transfer from Cairo
-- came in on the US books and the manual payout that paid it out (which
-- names `eg`) left the Egyptian books short. `journal()` now resolves one
-- entity per transaction; this moves the transactions already posted.
--
-- A whole transaction moves or none of it, so each entity still nets to
-- zero, and an entity transfer is never touched: it names both sides itself.
WITH egyptian AS (
  SELECT DISTINCT l.txn_id
    FROM ledger_entries l
    LEFT JOIN organizations o ON o.id = l.organization_id
    LEFT JOIN sponsors s ON l.ref_type = 'sponsor' AND s.id = l.ref_id
   WHERE l.txn_kind <> 'entity_transfer'
     AND (o.region = 'eg' OR s.entity = 'eg')
)
UPDATE ledger_entries
   SET entity = 'eg'
 WHERE txn_id IN (SELECT txn_id FROM egyptian)
   AND txn_kind <> 'entity_transfer'
   AND entity <> 'eg';
