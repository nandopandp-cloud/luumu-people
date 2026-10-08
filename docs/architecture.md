# Arquitetura

## Visão geral

Uma aplicação **Next.js 16 (App Router, Cache Components)** na Vercel, com **PostgreSQL no Neon**. A API e a interface vivem no mesmo deploy, mas o domínio é independente do framework: os route handlers e as páginas são camadas finas sobre serviços em `src/server/modules`.

```
Navegador
  │  cookie de sessão HttpOnly (mesma origem)
  ▼
Next.js (Vercel, região gru1)
  ├─ proxy.ts ............. checagem otimista: sem cookie → /entrar (não é autorização)
  ├─ app/(colaborador) .... experiência do colaborador
  ├─ app/gestao ........... ambiente de gestão (itens filtrados por permissão)
  ├─ app/api/auth ......... Better Auth (login, sessão, senha)
  └─ app/api/v1 ........... API REST → defineRoute() → serviços
                                   │
                    ┌──────────────┴──────────────┐
          withTenant(): SET LOCAL ROLE luumu_app   Better Auth (luumu_auth)
                        SET LOCAL app.tenant_id
                    │                              │
                    ▼                              ▼
              PostgreSQL (Neon, sa-east-1) — RLS em todas as tabelas
```

A RFC 0001 propunha uma API NestJS separada. Com a decisão por Next na Vercel, a API passou a ser route handlers no mesmo projeto. As garantias que a separação traria (isolamento de tenant, menor privilégio, cofre de pesquisas) estão no **banco**: roles distintas, RLS, grants por coluna e, na Fase 4, um schema `survey_vault` acessível só por funções `SECURITY DEFINER`.

## Estrutura de pastas

```
src/
  app/                    rotas (camada fina): páginas, layouts, route handlers
    (auth)/               login, recuperação e redefinição de senha
    (colaborador)/        início, cursos, trilhas, desenvolvimento, pesquisas…
    gestao/               dashboard, usuários, auditoria e módulos futuros
    api/auth/             Better Auth
    api/v1/               API REST da plataforma
  design-system/          tokens (globals.css) e componentes reutilizáveis
  features/<domínio>/     componentes de UI específicos de um domínio
  lib/                    utilitários de cliente (api-client, auth-client, format)
  server/                 tudo que só roda no servidor ("server-only")
    env.ts                variáveis de ambiente validadas (Zod)
    dal.ts                acesso à sessão em Server Components
    auth/                 Better Auth, sessão/ator, senha, bloqueio por conta
    authz/                catálogo de permissões, papéis de sistema, motor de políticas
    db/                   schema Drizzle, cliente, withTenant, migrations, seed
    http/                 defineRoute, erros (problem+json), rate limit
    audit/                trilha de auditoria
    modules/<domínio>/    serviços e schemas de entrada (people, access, audit…)
    observability/        logger com redação
db/migrations/            SQL versionado (drizzle-kit + migrations de segurança)
scripts/                  CLI: migrations, seed, provisionamento, marca
tests/                    integração, unitários, e2e, suporte
```

## Regras de dependência (verificadas pelo ESLint)

1. Módulos **não** importam `@/server/db/client`: todo acesso a dados passa por `withTenant()`.
2. `src/design-system` e `src/lib` **não** importam `@/server/*`.
3. Arquivos de servidor importam `"server-only"`.
4. Páginas e route handlers não contêm regra de negócio: chamam serviços.

## Fluxo de uma requisição à API

1. `defineRoute()` valida a origem nas mutações (CSRF), resolve a sessão (401), checa a permissão declarada (403) e aplica o rate limit.
2. Remove qualquer `tenant_id`/`tenantId` do input e valida com Zod estrito (400).
3. O serviço confere o **escopo** sobre o recurso específico com `can()`. Fora do escopo, responde 404 para não revelar que o recurso existe.
4. O serviço acessa o banco com `withTenant()`, e a RLS filtra pelo tenant da sessão.
5. Ações sensíveis gravam auditoria na mesma transação.

## Server Components e Cache Components

- A leitura de sessão acontece dentro de `<Suspense>`. O restante da página (sidebar, títulos) entra no *static shell* pré-renderizado.
- **Nunca** usar `use cache` com dados de tenant sem incluir o tenant/usuário na chave, e nunca com dados sensíveis: chaves de cache ficam em texto puro.
- Páginas chamam os mesmos serviços da API, com a mesma autorização.

## Os dois ambientes

| | Colaborador | Gestão |
|---|---|---|
| Rotas | `/inicio`, `/meus-cursos`, … | `/gestao/**` |
| Navegação | fixa (sidebar + barra inferior no mobile) | filtrada por permissão (sidebar + gaveta no mobile) |
| Acesso | todo usuário ativo | `management.access`; cada página exige a própria permissão |

A troca entre os ambientes fica no menu da conta, para quem tem acesso aos dois.
