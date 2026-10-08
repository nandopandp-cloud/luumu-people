-- =============================================================================
-- 0014 — Banners da home: RLS por tenant + grants por coluna.
-- E conquistas ocultas por enquanto: a flag `gamification` passa a vir
-- desligada (a empresa pode religar com uma sobrescrita).
-- =============================================================================
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.home_banners TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.home_banners TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, subtitle, cta_label, cta_url, theme, illustration, image_file_id, active, starts_at, ends_at, position, updated_at) ON public.home_banners TO luumu_app;
--> statement-breakpoint
UPDATE public.feature_flags SET default_enabled = false, description = 'Conquistas, XP e níveis (oculto por enquanto)' WHERE key = 'gamification';
