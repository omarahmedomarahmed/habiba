-- Sprint 11. ADDITIVE ONLY (H16): production runs the previous build until the
-- moment `main` is pushed, so nothing here may drop, rename or narrow anything
-- the running site reads. Every statement below adds.

CREATE TABLE IF NOT EXISTS "availability_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"held_until" timestamp with time zone,
	"session_id" uuid,
	"booked_by_account_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_user_fk" FOREIGN KEY ("therapist_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_account_fk" FOREIGN KEY ("booked_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

/*
 * 11.1 — whole hours only, 19:00 and never 19:15.
 *
 * A CHECK rather than a form validation, because a form only validates what a
 * form submits. This holds for a script, a backfill, an admin tool and
 * whatever the next sprint writes.
 *
 * The reason is not tidiness: a calendar carrying 19:00 and 19:15 is a
 * calendar where two patients can book overlapping hours, and the clinician
 * finds out when the second one joins the room.
 */
DO $$ BEGIN
 ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_whole_hour"
   CHECK (date_part('minute', "starts_at") = 0 AND date_part('second', "starts_at") = 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- One slot per hour per clinician. Double-booking becomes a database error
-- rather than a race: two patients pressing "book" on the same hour at the
-- same moment is the ordinary case, not the exotic one.
CREATE UNIQUE INDEX IF NOT EXISTS "availability_slots_hour_unique" ON "availability_slots" USING btree ("therapist_user_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "availability_slots_therapist_idx" ON "availability_slots" USING btree ("therapist_user_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "availability_slots_open_idx" ON "availability_slots" USING btree ("starts_at") WHERE "status" = 'open';--> statement-breakpoint

/*
 * 11.2 / C57 — when a session is *planned* for.
 *
 * Nullable, and deliberately not backfilled from `started_at`. Every existing
 * session came off the radar or a join link and was unplanned by definition;
 * writing a scheduled time onto them would invent appointments that nobody
 * made, and sprint 12's no-show recovery reads exactly the gap between
 * `scheduled_at` and `started_at` to decide whether somebody turned up.
 */
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_scheduled_idx" ON "sessions" USING btree ("scheduled_at") WHERE "scheduled_at" IS NOT NULL;
