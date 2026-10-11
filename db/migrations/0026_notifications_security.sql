-- =============================================================================
-- 0026 — Notificações e interações em comentários: RLS por tenant + policies
-- RESTRICTIVE por pessoa (app.current_user_id()) + grants por coluna.
-- =============================================================================
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.comment_reactions TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Curtir/descurtir comentário só em nome próprio.
CREATE POLICY own_reaction_insert ON public.comment_reactions AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_reaction_delete ON public.comment_reactions AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.comment_reactions TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.notifications TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Lê quem recebe; quem causou só enxerga as que gerou (para desfazer uma curtida).
CREATE POLICY own_notification_select ON public.notifications AS RESTRICTIVE FOR SELECT TO luumu_app
  USING (recipient_id = app.current_user_id() OR actor_id = app.current_user_id());
--> statement-breakpoint
-- Ninguém cria notificação em nome de outra pessoa.
CREATE POLICY own_notification_insert ON public.notifications AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (actor_id = app.current_user_id());
--> statement-breakpoint
-- Só quem recebe marca como lida/não lida.
CREATE POLICY own_notification_update ON public.notifications AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (recipient_id = app.current_user_id()) WITH CHECK (recipient_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_notification_delete ON public.notifications AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (actor_id = app.current_user_id() OR recipient_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.notifications TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (read_at) ON public.notifications TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.notification_reads TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_rows_only ON public.notification_reads AS RESTRICTIVE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.notification_preferences TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_rows_only ON public.notification_preferences AS RESTRICTIVE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.notification_preferences TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (muted, updated_at) ON public.notification_preferences TO luumu_app;
