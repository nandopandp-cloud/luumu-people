-- Aulas, módulos, progresso e certificados: isolamento por tenant.
-- Progresso e certificados: só INSERT (histórico de aprendizagem não é reescrito).
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.course_modules TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.lessons TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.lesson_progress TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.certificates TO luumu_app USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.course_modules TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (title, position, updated_at) ON public.course_modules TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.lessons TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (module_id, title, type, position, duration_minutes, body, video_url, external_url, file_id, updated_at) ON public.lessons TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.lesson_progress TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.certificates TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (category, cover_file_id) ON public.courses TO luumu_app;
