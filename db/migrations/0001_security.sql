-- =============================================================================
-- 0001_security — roles de banco, grants mínimos, RLS e trilha de auditoria.
--
-- Modelo:
--   luumu_app  → role de runtime da aplicação. Acesso SEMPRE filtrado por tenant
--                via RLS (app.current_tenant_id(), definido por SET LOCAL em cada
--                transação). Sem acesso às tabelas de autenticação.
--   luumu_auth → role de runtime do Better Auth. Acesso apenas às tabelas de
--                autenticação e leitura de users (login acontece antes de se
--                conhecer o tenant).
--   dona do schema (ex.: neondb_owner) → usada SOMENTE por migrations e seed.
--
-- Ambas as roles são NOLOGIN. Em produção, logins dedicados são membros delas
-- (scripts/db-provision-roles.ts). Nenhuma role de runtime é dona de tabelas,
-- portanto nenhuma escapa da RLS.
--
-- Regra de manutenção: toda nova tabela precisa de RLS + policy + grants
-- explícitos. tests/integration/schema-security.test.ts falha caso contrário.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luumu_app') THEN
    CREATE ROLE luumu_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luumu_auth') THEN
    CREATE ROLE luumu_auth NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS app;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO luumu_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO luumu_app, luumu_auth;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.current_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.tenant_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.current_tenant_id() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_tenant_id() TO luumu_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.reject_mutation() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION '% é somente-inserção', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION app.reject_mutation();
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- RLS em todas as tabelas
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.two_factors ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.login_throttles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.job_levels ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.employment_assignments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.manager_relationships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.org_tags ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.user_org_tags ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.profile_field_policies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Isolamento por tenant (luumu_app)
-- -----------------------------------------------------------------------------
CREATE POLICY tenant_isolation ON public.organizations TO luumu_app
  USING (id = app.current_tenant_id()) WITH CHECK (id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.users TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.business_units TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.org_units TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.positions TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.job_levels TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.employee_profiles TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.employment_assignments TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.manager_relationships TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.org_tags TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.user_org_tags TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.profile_field_policies TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.roles TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
-- Papéis de sistema não podem ser alterados nem removidos pela aplicação.
CREATE POLICY system_roles_immutable_update ON public.roles AS RESTRICTIVE FOR UPDATE TO luumu_app
  USING (NOT is_system);
--> statement-breakpoint
CREATE POLICY system_roles_immutable_delete ON public.roles AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (NOT is_system);
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.role_permissions TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY system_role_permissions_immutable_insert ON public.role_permissions AS RESTRICTIVE FOR INSERT TO luumu_app
  WITH CHECK (NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.is_system));
--> statement-breakpoint
CREATE POLICY system_role_permissions_immutable_delete ON public.role_permissions AS RESTRICTIVE FOR DELETE TO luumu_app
  USING (NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.is_system));
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.user_roles TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.audit_logs TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY read_all ON public.permissions FOR SELECT TO luumu_app USING (true);
--> statement-breakpoint
CREATE POLICY read_all ON public.feature_flags FOR SELECT TO luumu_app USING (true);
--> statement-breakpoint
CREATE POLICY read_global_or_tenant ON public.feature_flag_overrides FOR SELECT TO luumu_app
  USING (tenant_id IS NULL OR tenant_id = app.current_tenant_id());
--> statement-breakpoint
CREATE POLICY write_tenant ON public.feature_flag_overrides FOR ALL TO luumu_app
  USING (tenant_id = app.current_tenant_id()) WITH CHECK (tenant_id = app.current_tenant_id());
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Autenticação (luumu_auth)
-- -----------------------------------------------------------------------------
CREATE POLICY auth_runtime ON public.users TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_runtime ON public.sessions TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_runtime ON public.accounts TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_runtime ON public.verifications TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_runtime ON public.two_factors TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_runtime ON public.rate_limits TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY auth_runtime ON public.login_throttles TO luumu_auth USING (true) WITH CHECK (true);
--> statement-breakpoint

-- -----------------------------------------------------------------------------
-- Grants — mínimos e por coluna. Colunas ausentes (id, tenant_id, created_at…)
-- são imutáveis para o runtime.
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.organizations TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, anonymity_k, settings, updated_at) ON public.organizations TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.users TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, email, image, status, updated_at) ON public.users TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.business_units TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, code, city, state, archived_at, updated_at) ON public.business_units TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.org_units TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (parent_id, type, name, code, archived_at, updated_at) ON public.org_units TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.positions TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, code, is_managerial, archived_at, updated_at) ON public.positions TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.job_levels TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, rank, updated_at) ON public.job_levels TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.employee_profiles TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (employee_code, preferred_name, hire_date, contract_type, employment_status, phone, headline, updated_at) ON public.employee_profiles TO luumu_app;
--> statement-breakpoint
-- Histórico: só é possível encerrar a vigência, nunca reescrever o passado.
GRANT SELECT, INSERT ON public.employment_assignments TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (valid_to) ON public.employment_assignments TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.manager_relationships TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (valid_to) ON public.manager_relationships TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.org_tags TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, updated_at) ON public.org_tags TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.user_org_tags TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.profile_field_policies TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (editable_by_employee, updated_at) ON public.profile_field_policies TO luumu_app;
--> statement-breakpoint
GRANT SELECT ON public.permissions TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.roles TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (name, description, default_scope, updated_at) ON public.roles TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO luumu_app;
--> statement-breakpoint
-- Atribuições de papel: nunca apagadas; revogação é registrada.
GRANT SELECT, INSERT ON public.user_roles TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (revoked_at, revoked_by) ON public.user_roles TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON public.audit_logs TO luumu_app;
--> statement-breakpoint
GRANT SELECT ON public.feature_flags TO luumu_app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON public.feature_flag_overrides TO luumu_app;
--> statement-breakpoint
GRANT UPDATE (enabled, updated_by, updated_at) ON public.feature_flag_overrides TO luumu_app;
--> statement-breakpoint
GRANT SELECT ON public.users TO luumu_auth;
--> statement-breakpoint
GRANT UPDATE (email_verified, two_factor_enabled, updated_at) ON public.users TO luumu_auth;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions, public.accounts, public.verifications, public.two_factors, public.rate_limits, public.login_throttles TO luumu_auth;
