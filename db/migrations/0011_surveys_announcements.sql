CREATE TABLE "survey_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_on" date,
	CONSTRAINT "survey_invitations_survey_user_key" UNIQUE("survey_id","user_id"),
	CONSTRAINT "survey_invitations_completed_has_date" CHECK (("survey_invitations"."status" = 'completed') = ("survey_invitations"."completed_on" is not null))
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "survey_questions_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "survey_questions_options_by_type" CHECK (("survey_questions"."type" = 'choice') = ("survey_questions"."options" is not null))
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'custom' NOT NULL,
	"anonymity_mode" text DEFAULT 'anonymous' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"anonymity_k" integer DEFAULT 5 NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"closes_at" timestamp with time zone,
	"launched_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surveys_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "surveys_k_check" CHECK ("surveys"."anonymity_k" in (5, 7, 10)),
	CONSTRAINT "surveys_launched_has_dates" CHECK ("surveys"."status" = 'draft' or ("surveys"."launched_at" is not null and "surveys"."closes_at" is not null)),
	CONSTRAINT "surveys_closed_has_date" CHECK ("surveys"."status" <> 'closed' or "surveys"."closed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_survey_fk" FOREIGN KEY ("tenant_id","survey_id") REFERENCES "public"."surveys"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_invitations" ADD CONSTRAINT "survey_invitations_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_fk" FOREIGN KEY ("tenant_id","survey_id") REFERENCES "public"."surveys"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_invitations_user_idx" ON "survey_invitations" USING btree ("tenant_id","user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_questions_position_key" ON "survey_questions" USING btree ("survey_id","position");--> statement-breakpoint
CREATE INDEX "surveys_tenant_status_idx" ON "surveys" USING btree ("tenant_id","status");