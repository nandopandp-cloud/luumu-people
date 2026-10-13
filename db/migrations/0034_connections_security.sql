-- =============================================================================
-- 0034 — Conexões: interesses do perfil, seguir e sugestões dispensadas.
-- Interesses e "quem segue quem" são visíveis na empresa (afinidades e
-- contagem de seguidores); cada pessoa grava e apaga só os próprios.
-- Sugestões dispensadas: estritamente pessoais.
-- =============================================================================
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.user_interests TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_interest_insert ON public.user_interests AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_interest_delete ON public.user_interests AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.user_interests TO luumu_app;
--> statement-breakpoint

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.user_follows TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_follow_insert ON public.user_follows AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (follower_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_follow_delete ON public.user_follows AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (follower_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.user_follows TO luumu_app;
--> statement-breakpoint

ALTER TABLE public.connection_suggestion_dismissals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.connection_suggestion_dismissals TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_rows_only ON public.connection_suggestion_dismissals AS RESTRICTIVE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.connection_suggestion_dismissals TO luumu_app;
