-- Sprint 22.9 — the constraints stop being promises.
--
-- 🔴 `NOT VALID` was the right call and is the wrong resting state.
--
-- A `NOT VALID` CHECK binds every new write and skips the scan of the rows
-- already there. That is exactly what a deploy needs when a rule arrives after
-- the data — it is how 0042 and its successors could demand a phone number on
-- 66 patient rows that did not have one, without a migration that fails or a
-- backfill that invents numbers.
--
-- Leaving it that way for ever is a different thing. A `NOT VALID` constraint
-- records a rule the schema does not actually assert: the planner will not
-- rely on it, `information_schema` cannot tell you whether the data obeys it,
-- and the one honest answer to "is this true of every row?" is "nobody has
-- looked". 22.1 has just emptied every table, so both scans are free and there
-- is no reason left not to look.
--
-- Fifteen constraints, all of them, not the five 22.9 names: the argument does
-- not stop at 0042, and a launch that validates a third of the rules leaves
-- the same question open about the other two thirds.
--
-- Additive: `VALIDATE CONSTRAINT` changes no row and no definition. It takes a
-- SHARE UPDATE EXCLUSIVE lock, which does not block reads or writes.

ALTER TABLE "country_settings" VALIDATE CONSTRAINT "country_settings_entity_known";
ALTER TABLE "country_settings" VALIDATE CONSTRAINT "country_settings_vat_sane";
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_fx_complete";
ALTER TABLE "ledger_entries" VALIDATE CONSTRAINT "ledger_entries_entity_known";
ALTER TABLE "patient_accounts" VALIDATE CONSTRAINT "patient_accounts_phone_e164";
ALTER TABLE "patient_accounts" VALIDATE CONSTRAINT "patient_accounts_phone_present";
ALTER TABLE "patients" VALIDATE CONSTRAINT "patients_phone_e164";
ALTER TABLE "patients" VALIDATE CONSTRAINT "patients_phone_present";
ALTER TABLE "people" VALIDATE CONSTRAINT "people_phone_e164";
ALTER TABLE "session_payments" VALIDATE CONSTRAINT "session_payments_crossing_known";
ALTER TABLE "session_payments" VALIDATE CONSTRAINT "session_payments_entity_known";
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_feedback_token_present";
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_recovery_outcome_known";
ALTER TABLE "support_tickets" VALIDATE CONSTRAINT "support_tickets_audience_known";
ALTER TABLE "support_tickets" VALIDATE CONSTRAINT "support_tickets_whatsapp_summarised";

-- 🔴 And the one column where the CHECK was standing in for a column type.
--
-- Every session in the product is created by one of three functions and all
-- three mint a feedback token; the nullable column was a fact about the rows
-- that existed in August, not about the rule. `NOT NULL` says it where a
-- reader of the schema will see it, and where no future insert can miss it.
--
-- `patients_phone_present` stays a CHECK on purpose: it is conditional on
-- `source = 'therapist'` (§3b — a join-link patient may have only an address),
-- and a conditional rule cannot be a column type.
ALTER TABLE "sessions" ALTER COLUMN "feedback_token" SET NOT NULL;
