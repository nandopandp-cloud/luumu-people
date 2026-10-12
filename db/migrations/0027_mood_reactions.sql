CREATE TABLE "mood_prompt_dismissals" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_prompt_dismissals_pk" PRIMARY KEY("tenant_id","user_id","prompt_date")
);
--> statement-breakpoint
ALTER TABLE "mood_checkins" DROP CONSTRAINT "mood_checkins_mood_range";--> statement-breakpoint
-- Escala antiga 1..5 → nova 1..6: muito bem (5→6), bem (4→5), neutro → mais ou menos (3→4),
-- um pouco desanimado → não muito bem (2→3), não estou bem → mal (1→2).
UPDATE "mood_checkins" SET "mood" = "mood" + 1;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "announcement_reactions" ADD COLUMN "kind" text DEFAULT 'love' NOT NULL;--> statement-breakpoint
ALTER TABLE "mood_prompt_dismissals" ADD CONSTRAINT "mood_prompt_dismissals_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_note_len" CHECK (char_length("mood_checkins"."note") between 1 and 300);--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_mood_range" CHECK ("mood_checkins"."mood" between 1 and 6);--> statement-breakpoint
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_kind" CHECK ("announcement_reactions"."kind" in ('love', 'cheer', 'sad'));