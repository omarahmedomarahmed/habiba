-- Sprint 47 — a journal may never become a conclusion. C214, 47.6.
--
-- 🔴 Additive: a CHECK constraint on a table whose existing rows already
-- satisfy it. H16 holds.
--
-- ## Why this is in the database and not only in lib/data/facts.ts
--
-- facts.ts says it itself, at the top: "a rule enforced here survives until
-- the next call site forgets it". Every other invariant on this table is a
-- CHECK in 0062 for that reason, and this is the one where forgetting has the
-- worst consequence.
--
-- A patient on nobody's list writes journals at eleven at night. The moment
-- those become an evidence source, the first therapist that person ever meets
-- is handed a conclusion drawn from a stranger's diary by a machine, and
-- anchoring is the best documented failure mode in clinical judgement.
--
-- ## Why the condition is on the EVIDENCE and not on the source
--
-- `source_type` says who is asserting. `evidence_kind` says what they are
-- asserting it from. A clinician who reads a patient's journal and records a
-- diagnosis is exercising their own judgement about somebody they are
-- treating, which is theirs to exercise; a row whose EVIDENCE is the journal
-- is the machine drawing the conclusion. Those two are indistinguishable by
-- source alone, and only the second is forbidden.
--
-- ## What this does not touch
--
-- C123 is untouched. A journal is still scanned like a transcript,
-- journals.risk_level is still computed, and a clinician holding a grant is
-- still told when somebody writes "I want to die" at 3am. That is the ALERTING
-- path. This is the INFERENCE path. Reading them as one rule would switch off
-- the first, which is the one that keeps somebody alive.
--
-- NOT VALID is deliberately NOT used: there are no offending rows today, the
-- constraint is validated immediately, and "0 unvalidated constraints" stays
-- true of this database.
ALTER TABLE "patient_clinical_facts"
  DROP CONSTRAINT IF EXISTS "facts_journal_never_concludes";

ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "facts_journal_never_concludes"
  CHECK (
    "evidence_kind" <> 'journal'
    OR "domain" NOT IN ('diagnosis', 'risk')
  );
