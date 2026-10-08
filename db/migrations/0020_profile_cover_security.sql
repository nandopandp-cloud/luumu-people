-- Capa do perfil: a própria pessoa altera; coluna nova precisa de grant explícito de UPDATE.
GRANT UPDATE (profile_cover) ON public.users TO luumu_app;
