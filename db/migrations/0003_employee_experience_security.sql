-- =============================================================================
-- 0003 — Segurança das tabelas da experiência do colaborador (Fase 2).
-- Mesmo modelo de 0001: RLS por tenant para luumu_app + grants por coluna.
-- Check-in de humor: além do tenant, só o PRÓPRIO usuário (app.current_user_id()).
-- =============================================================================
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_user_id() TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.announcements TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.courses TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.learning_paths TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.learning_path_courses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.learning_path_courses TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.enrollments TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.library_items TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.mood_checkins ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.mood_checkins TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.achievements TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.user_achievements TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Dado sensível: cada pessoa só enxerga e grava o próprio check-in.
CREATE POLICY own_rows_only ON public.mood_checkins AS RESTRICTIVE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.announcements TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, summary, body, category, theme, illustration, status, published_at, updated_at) ON public.announcements TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.courses TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, description, kind, duration_minutes, mandatory, theme, illustration, status, updated_at) ON public.courses TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.learning_paths TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, description, category, theme, illustration, featured, status, updated_at) ON public.learning_paths TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.learning_path_courses TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (position) ON public.learning_path_courses TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.enrollments TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (status, progress_pct, source, due_date, started_at, completed_at, updated_at) ON public.enrollments TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.library_items TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (type, title, summary, duration_minutes, featured, status, published_at, updated_at) ON public.library_items TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.mood_checkins TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (mood, updated_at) ON public.mood_checkins TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.achievements TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, description, icon, theme) ON public.achievements TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.user_achievements TO luumu_app;
