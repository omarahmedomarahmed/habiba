CREATE TABLE IF NOT EXISTS "assistant_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "assistant_threads_user_idx" ON "assistant_threads" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assistant_messages_thread_idx" ON "assistant_messages" USING btree ("thread_id","created_at");--> statement-breakpoint

-- 10.5's allowance query. Partial on the role: an assistant reply is not a
-- spent message, and counting replies would halve everybody's quota.
CREATE INDEX IF NOT EXISTS "assistant_messages_quota_idx" ON "assistant_messages" USING btree ("user_id","created_at") WHERE "role" = 'therapist';
