CREATE TABLE "home_banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"cta_label" text,
	"cta_url" text,
	"theme" text DEFAULT 'purple' NOT NULL,
	"illustration" text,
	"image_file_id" uuid,
	"active" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "home_banners_cta_pair" CHECK (("home_banners"."cta_label" is null) = ("home_banners"."cta_url" is null)),
	CONSTRAINT "home_banners_cta_url_safe" CHECK ("home_banners"."cta_url" is null or "home_banners"."cta_url" ~ '^/[a-z0-9]' or "home_banners"."cta_url" like 'https://%'),
	CONSTRAINT "home_banners_period" CHECK ("home_banners"."ends_at" is null or "home_banners"."starts_at" is null or "home_banners"."ends_at" > "home_banners"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_image_fk" FOREIGN KEY ("tenant_id","image_file_id") REFERENCES "public"."files"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_created_by_fk" FOREIGN KEY ("tenant_id","created_by") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "home_banners_tenant_active_idx" ON "home_banners" USING btree ("tenant_id","active","position");