ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_id_key" UNIQUE("tenant_id","id");--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_code_unique" UNIQUE("code"),
	CONSTRAINT "certificates_user_course_key" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "course_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_modules_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_progress_pkey" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"position" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"body" text,
	"video_url" text,
	"external_url" text,
	"file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessons_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "lessons_duration_positive" CHECK ("lessons"."duration_minutes" > 0),
	CONSTRAINT "lessons_content_by_type" CHECK (("lessons"."type" = 'article' and "lessons"."body" is not null) or ("lessons"."type" = 'video' and "lessons"."video_url" is not null) or ("lessons"."type" = 'pdf' and "lessons"."file_id" is not null) or ("lessons"."type" = 'link' and "lessons"."external_url" like 'https://%'))
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "cover_file_id" uuid;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_fk" FOREIGN KEY ("tenant_id","lesson_id") REFERENCES "public"."lessons"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_fk" FOREIGN KEY ("tenant_id","course_id") REFERENCES "public"."courses"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_fk" FOREIGN KEY ("tenant_id","module_id") REFERENCES "public"."course_modules"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_file_fk" FOREIGN KEY ("tenant_id","file_id") REFERENCES "public"."files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_modules_position_key" ON "course_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "lesson_progress_user_completed_idx" ON "lesson_progress" USING btree ("tenant_id","user_id","completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lessons_position_key" ON "lessons" USING btree ("course_id","position");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_file_fk" FOREIGN KEY ("tenant_id","cover_file_id") REFERENCES "public"."files"("tenant_id","id") ON DELETE no action ON UPDATE no action;
