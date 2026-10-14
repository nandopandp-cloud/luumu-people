CREATE TABLE "usage_days" (
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"visits" integer DEFAULT 1 NOT NULL,
	"active_seconds" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_days_pk" PRIMARY KEY("tenant_id","user_id","day"),
	CONSTRAINT "usage_days_counters" CHECK ("usage_days"."visits" >= 1 and "usage_days"."active_seconds" >= 0)
);
--> statement-breakpoint
ALTER TABLE "usage_days" ADD CONSTRAINT "usage_days_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_days" ADD CONSTRAINT "usage_days_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_days_tenant_day_idx" ON "usage_days" USING btree ("tenant_id","day");