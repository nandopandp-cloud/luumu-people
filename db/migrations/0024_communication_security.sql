-- =============================================================================
-- 0024 — Comunicação: RLS por tenant, policies e grants por coluna das tabelas
-- de curtidas, comentários, anexos, eventos e links rápidos; público por área
-- nos comunicados. Quem vê cada comunicado (área) é decidido no serviço.
-- =============================================================================
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.announcement_reactions TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Curtir/descurtir só em nome próprio (a contagem lê as de todos).
CREATE POLICY own_reaction_insert ON public.announcement_reactions AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_reaction_delete ON public.announcement_reactions AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.announcement_reactions TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.announcement_comments TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Ninguém comenta em nome de outra pessoa.
CREATE POLICY own_comment_insert ON public.announcement_comments AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (author_id = app.current_user_id());
--> statement-breakpoint
-- Comentário não é editado nem apagado fisicamente: só marcado como removido.
GRANT SELECT, INSERT ON public.announcement_comments TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (deleted_at, deleted_by) ON public.announcement_comments TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.announcement_attachments TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.announcement_attachments TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, position) ON public.announcement_attachments TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.events TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.events TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, description, kind, mode, location, url, starts_at, ends_at, published, updated_at) ON public.events TO luumu_app;
--> statement-breakpoint
ALTER TABLE public.quick_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.quick_links TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.quick_links TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (label, url, icon, color, position, active, updated_at) ON public.quick_links TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (audience_org_unit_id) ON public.announcements TO luumu_app;
