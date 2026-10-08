# Banco de dados

PostgreSQL 17 (Neon em preview/produção; PGlite, o Postgres em WASM, em desenvolvimento e testes). Schema em `src/server/db/schema`, migrations versionadas em `db/migrations`.

## Convenções

- PK `uuid` (`gen_random_uuid()`); tabelas e colunas em `snake_case` e inglês.
- Todo dado de empresa tem `tenant_id NOT NULL` e **RLS**.
- **FKs compostas** `(tenant_id, id)`: o banco recusa referências que cruzem empresas, mesmo que a aplicação erre.
- Históricos não são sobrescritos: lotação e gestor têm vigência (`valid_from`/`valid_to`); papéis revogados recebem `revoked_at`.
- `CHECK` constraints garantem regras de domínio (k ∈ {5, 7, 10}, hierarquia de áreas, e-mail minúsculo, sem autoatribuição de papel…).
- JSON só para configuração livre (`organizations.settings`, `audit_logs.metadata`), nunca para relacionamentos.

## Entidades da Fase 1

| Domínio | Tabelas |
|---|---|
| Tenant | `organizations` |
| Identidade e autenticação | `users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits`, `login_throttles` |
| Estrutura | `business_units` (unidades/localidades), `org_units` (diretoria → área → subárea), `positions` (cargos), `job_levels` (níveis) |
| Colaborador | `employee_profiles` (dados de RH), `employment_assignments` (lotação com vigência), `manager_relationships` (gestor com vigência), `org_tags`, `user_org_tags`, `profile_field_policies` |
| Acesso | `permissions` (catálogo), `roles`, `role_permissions`, `user_roles` (com escopo) |
| Plataforma | `audit_logs`, `feature_flags`, `feature_flag_overrides` |

Identidade (`users`) e dados de RH (`employee_profiles`) ficam separados: o Better Auth só enxerga a primeira.

## Roles de banco

| Role | Uso | Acesso |
|---|---|---|
| dona do schema (ex.: `neondb_owner`) | migrations, seed, provisionamento (CLI) | total |
| `luumu_app` | runtime da aplicação | dados de negócio, **sempre** filtrados por `app.current_tenant_id()`; grants por coluna |
| `luumu_auth` | runtime do Better Auth | só tabelas de autenticação + leitura de `users` |
| `luumu_app_login` (NOINHERIT) | login de produção da aplicação | nenhum privilégio próprio; vira `luumu_app` via `SET LOCAL ROLE` dentro de `withTenant()` |
| `luumu_auth_login` | login de produção do Better Auth | herda `luumu_auth` |

Imutáveis para o runtime: `id`, `tenant_id`, `created_at`, `user_id`. Sem `DELETE` em histórico (`employment_assignments`, `manager_relationships`, `user_roles`) e em `audit_logs`, que ainda tem um trigger que rejeita `UPDATE`/`DELETE`/`TRUNCATE`, inclusive para o dono do schema.

## Migrations

```bash
# 1. altere o schema em src/server/db/schema
pnpm db:generate            # gera db/migrations/NNNN_*.sql
# 2. tabela nova? crie uma migration de segurança com RLS + policy + grants:
pnpm drizzle-kit generate --custom --name <nome>_security
# 3. teste: o schema-security.test.ts falha se faltar RLS/policy
pnpm test
```

Toda tabela nova **precisa** de RLS habilitada, policy de isolamento (se tiver `tenant_id`) e grants explícitos. Sem isso a role de runtime não tem acesso algum (fail closed) e os testes de introspecção falham.

- Em desenvolvimento, o PGlite aplica as migrations ao iniciar.
- No Neon, use `pnpm db:migrate` ou o workflow **Migrations (Neon)** no GitHub Actions.
- Nunca altere o banco manualmente.

## Seed

`src/server/db/seed/data.ts` é a única fonte de dados demonstrativos: duas empresas fictícias em domínios `.example` (RFC 2606). A Aurora tem cerca de 50 pessoas e uma área de **3 pessoas**, para os testes de k-anonimato. A Horizonte existe para os testes de isolamento. O seed recusa rodar em produção. `syncCatalog()` (permissões e feature flags) roda em todo ambiente, junto com as migrations.
