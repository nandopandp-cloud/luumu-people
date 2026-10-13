ALTER TABLE "pdi_goals" ADD COLUMN "tags" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "pdis" ADD COLUMN "mentor_user_id" uuid;--> statement-breakpoint
ALTER TABLE "pdis" ADD COLUMN "mentor_note" text;--> statement-breakpoint
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_mentor_fk" FOREIGN KEY ("tenant_id","mentor_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_goals" ADD CONSTRAINT "pdi_goals_tags_max" CHECK (cardinality("pdi_goals"."tags") <= 5);--> statement-breakpoint
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_mentor_not_self" CHECK ("pdis"."mentor_user_id" is null or "pdis"."mentor_user_id" <> "pdis"."user_id");--> statement-breakpoint
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_mentor_note_length" CHECK (char_length("pdis"."mentor_note") <= 280);