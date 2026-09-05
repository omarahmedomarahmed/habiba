CREATE TABLE IF NOT EXISTS "person_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"uploaded_by_user_id" uuid,
	"uploaded_by_account_id" uuid,
	"organization_id" uuid,
	"document_date" timestamp with time zone,
	"blob_url" text,
	"mime_type" text,
	"byte_size" integer,
	"body" text,
	"extraction" text DEFAULT 'none' NOT NULL,
	"extraction_error" text,
	"extracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "person_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"code" text,
	"label" text NOT NULL,
	"source_sentence" text NOT NULL,
	"source_document_id" uuid,
	"source_chunk_id" uuid,
	"status" text DEFAULT 'proposed' NOT NULL,
	"confirmed_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "content_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"raised_by_user_id" uuid,
	"raised_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_user_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_account_fk" FOREIGN KEY ("uploaded_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_fk" FOREIGN KEY ("document_id") REFERENCES "public"."person_documents"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_document_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."person_documents"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_chunk_fk" FOREIGN KEY ("source_chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "person_diagnoses" ADD CONSTRAINT "person_diagnoses_user_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_user_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_account_fk" FOREIGN KEY ("raised_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- The D-number in `[D7:3]`, unique per person so a citation resolves to one
-- document or to none. Never to somebody else's.
CREATE UNIQUE INDEX IF NOT EXISTS "person_documents_ordinal_unique" ON "person_documents" USING btree ("person_id","ordinal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_documents_person_idx" ON "person_documents" USING btree ("person_id","created_at");--> statement-breakpoint
-- The worker's queue (H9). Partial, so it is the size of the backlog rather
-- than the size of the table.
CREATE INDEX IF NOT EXISTS "person_documents_pending_idx" ON "person_documents" USING btree ("created_at") WHERE "extraction" = 'pending';--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "document_chunks_sequence_unique" ON "document_chunks" USING btree ("document_id","sequence");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_chunks_person_idx" ON "document_chunks" USING btree ("person_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "person_diagnoses_person_idx" ON "person_diagnoses" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_diagnoses_document_idx" ON "person_diagnoses" USING btree ("source_document_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "content_flags_target_idx" ON "content_flags" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_flags_person_idx" ON "content_flags" USING btree ("person_id");
