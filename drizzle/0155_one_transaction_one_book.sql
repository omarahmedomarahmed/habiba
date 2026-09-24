-- 🔴 0155: ONE TRANSACTION, ONE BOOK.
--
-- A pot spend and its session payment share a transaction id and were
-- resolved to an entity separately, so a company on one entity paying a
-- practice on the other split one transaction across two books, and the
-- first book showed cash leaving that never arrived. `journal()` now gives a
-- later part the entity of the first; this repairs what was already posted.
-- An entity transfer names both sides on purpose and is left alone.
WITH split AS (
  SELECT txn_id
    FROM ledger_entries
   WHERE txn_kind <> 'entity_transfer'
   GROUP BY txn_id
  HAVING count(DISTINCT entity) > 1
), first_leg AS (
  SELECT DISTINCT ON (l.txn_id) l.txn_id, l.entity
    FROM ledger_entries l
    JOIN split s ON s.txn_id = l.txn_id
   ORDER BY l.txn_id, l.created_at, l.id
)
UPDATE ledger_entries l
   SET entity = f.entity
  FROM first_leg f
 WHERE l.txn_id = f.txn_id
   AND l.entity <> f.entity;
