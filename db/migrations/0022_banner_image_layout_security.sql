-- =============================================================================
-- 0022 — Banner só de imagem: a coluna nova `layout` entra nos grants por coluna
-- (RLS e policy da tabela seguem as de 0014).
-- =============================================================================
GRANT UPDATE (layout) ON public.home_banners TO luumu_app;
