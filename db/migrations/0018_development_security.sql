-- Desenvolvimento: isolamento por tenant; escopo (próprio/equipe/empresa) é aplicado nos serviços.
-- Avaliações de competência são append-only (histórico da evolução).
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.competencies TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.position_competencies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.position_competencies TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.competency_assessments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.competency_assessments TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.pdis ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.pdis TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.pdi_goals ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.pdi_goals TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
ALTER TABLE public.pdi_actions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.pdi_actions TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON public.competencies TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, description, category, icon, archived_at, updated_at) ON public.competencies TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.position_competencies TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (expected_score) ON public.position_competencies TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.competency_assessments TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.pdis TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, status, period_start, period_end, updated_at) ON public.pdis TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.pdi_goals TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, description, competency_id, target_date, status, position, updated_at) ON public.pdi_goals TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.pdi_actions TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, description, type, owner_user_id, due_date, status, evidence, evidence_url, completed_at, updated_at) ON public.pdi_actions TO luumu_app;
