CREATE TABLE "chat_message_likes" (
	"tenant_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_likes_pk" PRIMARY KEY("tenant_id","message_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_muted_known";--> statement-breakpoint
ALTER TABLE "notification_reads" DROP CONSTRAINT "notification_reads_key_format";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_message_likes" ADD CONSTRAINT "chat_message_likes_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_likes" ADD CONSTRAINT "chat_message_likes_message_fk" FOREIGN KEY ("tenant_id","message_id") REFERENCES "public"."chat_messages"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_likes" ADD CONSTRAINT "chat_message_likes_user_fk" FOREIGN KEY ("tenant_id","user_id") REFERENCES "public"."users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_muted_known" CHECK ("notification_preferences"."muted" <@ array['surveys', 'reminders', 'announcements', 'mentions', 'comments', 'likes', 'friends']::text[]);--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_key_format" CHECK ("notification_reads"."key" ~ '^(announcement|survey|reminder|friend|friendok):[0-9a-f-]{36}$');