-- Arquivos: isolamento por tenant; registros nunca são apagados pelo runtime
-- (exclusão lógica via deleted_at, preservando a trilha).
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.files TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.files TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (deleted_at) ON public.files TO luumu_app;
