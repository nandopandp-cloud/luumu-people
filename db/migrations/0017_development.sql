CREATE TABLE "competencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"icon" text DEFAULT 'target' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competencies_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "competency_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"source" text NOT NULL,
	"assessed_by" uuid NOT NULL,
	"note" text,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competency_assessments_score_range" CHECK ("competency_assessments"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "pdi_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pdi_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'pratica' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'not_started' NOT NULL,
	"evidence" text,
	"evidence_url" text,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdi_actions_done_has_date" CHECK (("pdi_actions"."status" = 'done') = ("pdi_actions"."completed_at" is not null)),
	CONSTRAINT "pdi_actions_evidence_url_https" CHECK ("pdi_actions"."evidence_url" is null or "pdi_actions"."evidence_url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "pdi_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pdi_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"competency_id" uuid,
	"target_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdi_goals_tenant_id_id_key" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "pdis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pdis_tenant_id_id_key" UNIQUE("tenant_id","id"),
	CONSTRAINT "pdis_period_range" CHECK ("pdis"."period_end" >= "pdis"."period_start")
);
--> statement-breakpoint
CREATE TABLE "position_competencies" (
	"tenant_id" uuid NOT NULL,
	"position_id" uuid NOT NULL,
	"competency_id" uuid NOT NULL,
	"expected_score" smallint NOT NULL,
	CONSTRAINT "position_competencies_pkey" PRIMARY KEY("position_id","competency_id"),
	CONSTRAINT "position_competencies_expected_range" CHECK ("position_competencies"."expected_score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_assessor_fk" FOREIGN KEY ("tenant_id","assessed_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_competency_fk" FOREIGN KEY ("tenant_id","competency_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_pdi_fk" FOREIGN KEY ("tenant_id","pdi_id") REFERENCES "public"."pdis"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_goal_fk" FOREIGN KEY ("tenant_id","goal_id") REFERENCES "public"."pdi_goals"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_owner_fk" FOREIGN KEY ("tenant_id","owner_user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_actions" ADD CONSTRAINT "pdi_actions_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_goals" ADD CONSTRAINT "pdi_goals_pdi_fk" FOREIGN KEY ("tenant_id","pdi_id") REFERENCES "public"."pdis"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdi_goals" ADD CONSTRAINT "pdi_goals_competency_fk" FOREIGN KEY ("tenant_id","competency_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdis" ADD CONSTRAINT "pdis_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_competencies" ADD CONSTRAINT "position_competencies_position_fk" FOREIGN KEY ("tenant_id","position_id") REFERENCES "public"."positions"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_competencies" ADD CONSTRAINT "position_competencies_competency_fk" FOREIGN KEY ("tenant_id","competency_id") REFERENCES "public"."competencies"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "competencies_tenant_name_key" ON "competencies" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "competency_assessments_latest_idx" ON "competency_assessments" USING btree ("tenant_id","user_id","competency_id","assessed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "pdi_actions_goal_idx" ON "pdi_actions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "pdi_actions_open_due_idx" ON "pdi_actions" USING btree ("tenant_id","due_date") WHERE "pdi_actions"."status" in ('not_started', 'in_progress');--> statement-breakpoint
CREATE INDEX "pdi_goals_pdi_idx" ON "pdi_goals" USING btree ("pdi_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pdis_one_active_per_user" ON "pdis" USING btree ("tenant_id","user_id") WHERE "pdis"."status" = 'active';