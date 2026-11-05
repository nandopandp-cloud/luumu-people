CREATE TABLE "survey_audience_units" (
	"tenant_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"org_unit_id" uuid NOT NULL,
	CONSTRAINT "survey_audience_units_pkey" PRIMARY KEY("survey_id","org_unit_id")
);
--> statement-breakpoint
CREATE TABLE "survey_identified_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"survey_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_identified_responses_survey_user_key" UNIQUE("survey_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "employment_assignments" DROP CONSTRAINT "employment_assignments_valid_range";--> statement-breakpoint
ALTER TABLE "manager_relationships" DROP CONSTRAINT "manager_relationships_valid_range";--> statement-breakpoint
ALTER TABLE "surveys" ADD COLUMN "no_minimum" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "survey_audience_units" ADD CONSTRAINT "survey_audience_units_survey_fk" FOREIGN KEY ("tenant_id","survey_id") REFERENCES "public"."surveys"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_audience_units" ADD CONSTRAINT "survey_audience_units_org_unit_fk" FOREIGN KEY ("tenant_id","org_unit_id") REFERENCES "public"."org_units"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_identified_responses" ADD CONSTRAINT "survey_identified_responses_survey_fk" FOREIGN KEY ("tenant_id","survey_id") REFERENCES "public"."surveys"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_identified_responses" ADD CONSTRAINT "survey_identified_responses_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_identified_responses_tenant_survey_idx" ON "survey_identified_responses" USING btree ("tenant_id","survey_id");--> statement-breakpoint
ALTER TABLE "employment_assignments" ADD CONSTRAINT "employment_assignments_valid_range" CHECK ("employment_assignments"."valid_to" is null or "employment_assignments"."valid_to" >= "employment_assignments"."valid_from");--> statement-breakpoint
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_valid_range" CHECK ("manager_relationships"."valid_to" is null or "manager_relationships"."valid_to" >= "manager_relationships"."valid_from");--> statement-breakpoint
-- Público legado (uma área em surveys.audience_org_unit_id) passa para a tabela de público.
INSERT INTO "survey_audience_units" ("tenant_id", "survey_id", "org_unit_id")
  SELECT "tenant_id", "id", "audience_org_unit_id" FROM "surveys" WHERE "audience_org_unit_id" IS NOT NULL;
