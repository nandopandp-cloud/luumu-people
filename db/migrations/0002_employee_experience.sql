CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"theme" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "achievements_tenant_key_key" UNIQUE("tenant_id","key")
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text,
	"category" text NOT NULL,
	"theme" text DEFAULT 'purple' NOT NULL,
	"illustration" text DEFAULT 'megaphone' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_published_has_date" CHECK ("announcements"."status" <> 'published' or "announcements"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'course' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"mandatory" boolean DEFAULT false NOT NULL,
	"theme" text DEFAULT 'purple' NOT NULL,
	"illustration" text DEFAULT 'book' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "courses_duration_positive" CHECK ("courses"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"progress_pct" smallint DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'self' NOT NULL,
	"due_date" date,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_course_key" UNIQUE("user_id","course_id"),
	CONSTRAINT "enrollments_progress_range" CHECK ("enrollments"."progress_pct" between 0 and 100),
	CONSTRAINT "enrollments_status_progress" CHECK (("enrollments"."status" = 'completed') = ("enrollments"."progress_pct" = 100) and ("enrollments"."status" <> 'not_started' or "enrollments"."progress_pct" = 0))
);
--> statement-breakpoint
CREATE TABLE "learning_path_courses" (
	"tenant_id" uuid NOT NULL,
	"path_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "learning_path_courses_pkey" PRIMARY KEY("path_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "learning_paths" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"theme" text DEFAULT 'purple' NOT NULL,
	"illustration" text DEFAULT 'compass' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_paths_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"duration_minutes" integer,
	"featured" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"checkin_date" date NOT NULL,
	"mood" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mood_checkins_user_date_key" UNIQUE("user_id","checkin_date"),
	CONSTRAINT "mood_checkins_mood_range" CHECK ("mood_checkins"."mood" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"achievement_id" uuid NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_pkey" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_path_fk" FOREIGN KEY ("tenant_id","path_id") REFERENCES "public"."learning_paths"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_checkins" ADD CONSTRAINT "mood_checkins_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_fk" FOREIGN KEY ("tenant_id","achievement_id") REFERENCES "public"."achievements"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_feed_idx" ON "announcements" USING btree ("tenant_id","status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "courses_tenant_status_idx" ON "courses" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "enrollments_user_status_idx" ON "enrollments" USING btree ("tenant_id","user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_path_courses_position_key" ON "learning_path_courses" USING btree ("path_id","position");--> statement-breakpoint
CREATE INDEX "learning_path_courses_course_idx" ON "learning_path_courses" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "learning_paths_tenant_status_idx" ON "learning_paths" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "library_items_feed_idx" ON "library_items" USING btree ("tenant_id","status","featured");