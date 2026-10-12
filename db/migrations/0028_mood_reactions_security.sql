-- Sentimento do dia: visível para todas as pessoas do tenant (decisão de produto, out/2026).
-- Ler: qualquer pessoa da empresa (só tenant_isolation). Gravar e mudar: só o próprio registro.
DROP POLICY own_rows_only ON public.mood_checkins;
--> statement-breakpoint
CREATE POLICY own_mood_insert ON public.mood_checkins AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY own_mood_update ON public.mood_checkins AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT UPDATE (note) ON public.mood_checkins TO luumu_app;
--> statement-breakpoint

-- Modal do sentimento fechado sem resposta: registro estritamente pessoal.
ALTER TABLE public.mood_prompt_dismissals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.mood_prompt_dismissals TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY own_rows_only ON public.mood_prompt_dismissals AS RESTRICTIVE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.mood_prompt_dismissals TO luumu_app;
--> statement-breakpoint

-- Reações a comunicados: trocar de reação atualiza `kind`, só na própria linha.
CREATE POLICY own_reaction_update ON public.announcement_reactions AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
GRANT UPDATE (kind) ON public.announcement_reactions TO luumu_app;
