CREATE TABLE "connection_suggestion_dismissals" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"dismissed_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connection_suggestion_dismissals_pk" PRIMARY KEY("tenant_id","user_id","dismissed_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"follower_id" uuid NOT NULL,
	"followee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_pair_key" UNIQUE("tenant_id","follower_id","followee_id"),
	CONSTRAINT "user_follows_not_self" CHECK ("user_follows"."follower_id" <> "user_follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "user_interests" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"interest_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_interests_pk" PRIMARY KEY("tenant_id","user_id","interest_key"),
	CONSTRAINT "user_interests_key_format" CHECK ("user_interests"."interest_key" ~ '^[a-z][a-z-]{1,31}$')
);
--> statement-breakpoint
ALTER TABLE "notification_reads" DROP CONSTRAINT "notification_reads_key_format";--> statement-breakpoint
ALTER TABLE "connection_suggestion_dismissals" ADD CONSTRAINT "connection_suggestion_dismissals_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_suggestion_dismissals" ADD CONSTRAINT "connection_suggestion_dismissals_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_suggestion_dismissals" ADD CONSTRAINT "connection_suggestion_dismissals_dismissed_fk" FOREIGN KEY ("tenant_id","dismissed_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_fk" FOREIGN KEY ("tenant_id","follower_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followee_fk" FOREIGN KEY ("tenant_id","followee_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_follows_followee_idx" ON "user_follows" USING btree ("tenant_id","followee_id");--> statement-breakpoint
CREATE INDEX "user_interests_key_idx" ON "user_interests" USING btree ("tenant_id","interest_key");--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_key_format" CHECK ("notification_reads"."key" ~ '^(announcement|survey|reminder|friend|friendok|follow):[0-9a-f-]{36}$');