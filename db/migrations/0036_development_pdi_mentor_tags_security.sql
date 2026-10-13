-- =============================================================================
-- 0036 — PDI: mentoria do ciclo e etiquetas dos objetivos.
-- Colunas novas em tabelas que já têm RLS (0018): só os grants de UPDATE por
-- coluna. Quem pode alterar (a liderança no escopo) é decidido no serviço,
-- como nas demais colunas do PDI.
-- =============================================================================
GRANT UPDATE (mentor_user_id, mentor_note) ON public.pdis TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (tags) ON public.pdi_goals TO luumu_app;
