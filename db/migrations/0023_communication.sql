ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_id_key" UNIQUE("tenant_id","id");--> statement-breakpoint
CREATE TABLE "announcement_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"file_id" uuid,
	"video_url" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_attachments_kind" CHECK (("announcement_attachments"."kind" = 'file' and "announcement_attachments"."file_id" is not null and "announcement_attachments"."video_url" is null) or ("announcement_attachments"."kind" = 'video' and "announcement_attachments"."video_url" is not null and "announcement_attachments"."file_id" is null)),
	CONSTRAINT "announcement_attachments_video_https" CHECK ("announcement_attachments"."video_url" is null or "announcement_attachments"."video_url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "announcement_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "announcement_comments_body_len" CHECK (char_length("announcement_comments"."body") between 1 and 1000),
	CONSTRAINT "announcement_comments_deleted_pair" CHECK (("announcement_comments"."deleted_at" is null) = ("announcement_comments"."deleted_by" is null))
);
--> statement-breakpoint
CREATE TABLE "announcement_reactions" (
	"tenant_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcement_reactions_pk" PRIMARY KEY("tenant_id","announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'evento' NOT NULL,
	"mode" text DEFAULT 'online' NOT NULL,
	"location" text,
	"url" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"published" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_period" CHECK ("events"."ends_at" is null or "events"."ends_at" > "events"."starts_at"),
	CONSTRAINT "events_url_https" CHECK ("events"."url" is null or "events"."url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "quick_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"icon" text DEFAULT 'link' NOT NULL,
	"color" text DEFAULT 'purple' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_links_url_safe" CHECK ("quick_links"."url" ~ '^/[a-z0-9]' or "quick_links"."url" like 'https://%')
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "audience_org_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_announcement_fk" FOREIGN KEY ("tenant_id","announcement_id") REFERENCES "public"."announcements"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_attachments" ADD CONSTRAINT "announcement_attachments_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_announcement_fk" FOREIGN KEY ("tenant_id","announcement_id") REFERENCES "public"."announcements"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_author_fk" FOREIGN KEY ("tenant_id","author_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_deleted_by_fk" FOREIGN KEY ("tenant_id","deleted_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_announcement_fk" FOREIGN KEY ("tenant_id","announcement_id") REFERENCES "public"."announcements"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reactions" ADD CONSTRAINT "announcement_reactions_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_attachments_announcement_idx" ON "announcement_attachments" USING btree ("tenant_id","announcement_id","position");--> statement-breakpoint
CREATE INDEX "announcement_comments_feed_idx" ON "announcement_comments" USING btree ("tenant_id","announcement_id","created_at");--> statement-breakpoint
CREATE INDEX "events_upcoming_idx" ON "events" USING btree ("tenant_id","published","starts_at");--> statement-breakpoint
CREATE INDEX "quick_links_tenant_position_idx" ON "quick_links" USING btree ("tenant_id","position");--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_audience_fk" FOREIGN KEY ("tenant_id","audience_org_unit_id") REFERENCES "public"."org_units"("tenant_id","id") ON DELETE no action ON UPDATE no action;
