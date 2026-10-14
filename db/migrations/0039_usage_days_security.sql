-- =============================================================================
-- 0039 — Uso da plataforma por pessoa e dia (dashboard de gestão).
-- Cada pessoa grava só o próprio sinal de uso; a leitura é agregada no serviço
-- (relatórios da empresa toda). Sem DELETE: a linha some com o usuário (cascade).
-- =============================================================================
ALTER TABLE public.usage_days ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.usage_days TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_usage_insert ON public.usage_days AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_usage_update ON public.usage_days AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.usage_days TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (visits, active_seconds, last_seen_at) ON public.usage_days TO luumu_app;
