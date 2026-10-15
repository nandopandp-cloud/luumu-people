-- =============================================================================
-- 0043 — Senha provisória: a aplicação liga (importação/gestão) e desliga (ao
-- trocar ou redefinir a senha) o aviso de troca obrigatória.
-- =============================================================================
GRANT UPDATE (must_change_password) ON public.users TO luumu_app;
