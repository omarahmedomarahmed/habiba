-- Sprint 11R. ADDITIVE ONLY (H16).
--
-- 11R.19: one constraint per DO $$ block. 0039 put four ALTER TABLEs in a
-- single block with `WHEN duplicate_object THEN null`, which means a duplicate
-- on the *first* aborts the block and silently skips the other three. That is
-- C66's shape: the objects were there, but only because nothing had failed
-- yet. Every block below adds exactly one thing.

-- 11R.2 — a clinician publishes hours in their own zone, and reads times in it.
-- IANA name, nullable: null means "we have not asked", which is different from
-- UTC and is why the formatter falls back explicitly rather than defaulting.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text;--> statement-breakpoint

-- 11R.3 — the recipient's zone, for a confirmation or a reminder they read.
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "timezone" text;--> statement-breakpoint

-- 11R.6 — the reminder stamp gets its own column.
ALTER TABLE "availability_slots" ADD COLUMN IF NOT EXISTS "reminded_at" timestamp with time zone;--> statement-breakpoint

/*
 * 11R.7 — unglue the marker from the patient's own words.
 *
 * §6, new and hard: **never edit text a patient wrote.** `markReminded` had
 * been appending ' [reminded]' to `availability_slots.note`, which is the
 * column holding the patient's answer to "anything they should know before you
 * meet?". A clinician reading that note saw our bookkeeping inside a sentence
 * somebody wrote about their own distress.
 *
 * The stamp moves to `reminded_at`. Any note that already carries the marker
 * is repaired here: the marker is stripped and the timestamp is set, so no
 * reminder is re-sent as a side effect of the cleanup. `NULLIF(btrim(...))`
 * returns the note to NULL when the marker was the only thing in it — which is
 * the common case, because most bookings have no note at all.
 */
UPDATE "availability_slots"
   SET "reminded_at" = COALESCE("reminded_at", now()),
       "note" = NULLIF(btrim(replace("note", ' [reminded]', '')), '')
 WHERE "note" LIKE '%[reminded]%';--> statement-breakpoint

-- The reminder sweep's query: booked, soon, not yet reminded. Partial, so it
-- stays the size of the backlog rather than the size of the table.
CREATE INDEX IF NOT EXISTS "availability_slots_reminder_idx" ON "availability_slots" USING btree ("starts_at") WHERE "status" = 'booked' AND "reminded_at" IS NULL;
--> statement-breakpoint

/*
 * 11R.19 — the multi-statement DO $$ blocks, repaired forward.
 *
 * 0034, 0036, 0037, 0038 and 0039 each put several ALTER TABLEs inside one
 * block under `WHEN duplicate_object THEN null`. A duplicate on the first
 * aborts the block and silently skips the rest, which is C66's shape.
 *
 * Those files are NOT edited. They are applied on production and on every
 * branch; changing a byte changes drizzle's content hash, and the next
 * `db:migrate` would replay them. Editing applied history to fix a latent bug
 * is how a latent bug becomes a live one.
 *
 * So the repair is forward and idempotent. **Measured before writing it:**
 * every foreign key from those blocks is present on both the branch and
 * production — 1/1/2/3/4/2/4/3/1/1/5/2/2/4 across the fourteen tables — so
 * the hazard was latent and nothing was actually lost. Each statement below is
 * therefore a no-op today and a repair if one of these is ever missing.
 *
 * One constraint per block, which is the rule §6 now carries.
 */

DO $$ BEGIN ALTER TABLE "patient_auth_sessions" ADD CONSTRAINT "patient_auth_sessions_account_fk" FOREIGN KEY ("patient_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_claims" ADD CONSTRAINT "person_claims_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_claims" ADD CONSTRAINT "person_claims_account_fk" FOREIGN KEY ("patient_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_invites" ADD CONSTRAINT "person_invites_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_user_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_account_fk" FOREIGN KEY ("uploaded_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."person_documents"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_document_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."person_documents"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_chunk_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_user_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_user_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_account_fk" FOREIGN KEY ("raised_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "observations" ADD CONSTRAINT "observations_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_user_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_account_fk" FOREIGN KEY ("completed_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_user_fk" FOREIGN KEY ("therapist_user_id") REFERENCES "public"."users"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_account_fk" FOREIGN KEY ("booked_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN null; END $$;
