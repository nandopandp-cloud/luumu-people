# Luumu People

Plataforma de experiência, desenvolvimento e inteligência de pessoas — comunicação interna, educação corporativa, pesquisas (com anonimato real), desenvolvimento e indicadores de G&G, para empresas e colaboradores.

> **Status:** Fase 1 (Foundation) concluída. Fase 2 em andamento — cursos, trilhas e comunicados entregues; biblioteca e conquistas a seguir. Fase 4 adiantada: pesquisas anônimas (builder, cofre, k-anonimato, resultados agregados). Roadmap em [docs/rfc/0001-arquitetura.md](docs/rfc/0001-arquitetura.md#13-roadmap-e-definition-of-done).

## Começando (sem instalar banco)

```bash
pnpm install
cp .env.example .env.local
# gere o segredo e cole em BETTER_AUTH_SECRET:
openssl rand -base64 48
pnpm dev
```

Abra http://localhost:3000. O banco local é um Postgres embarcado (PGlite, em `.data/pglite`) que se migra e se popula sozinho com dados **fictícios**. Senha de todas as contas demonstrativas: `Luumu@Demo2026`.

| Conta | Papel | O que dá para ver |
|---|---|---|
| `fernando.santos@aurora.example` | Colaborador | Experiência do colaborador |
| `carla.mendes@aurora.example` | Gestora (Produto) | Gestão limitada à própria equipe |
| `rafael.lima@aurora.example` | Editor | Gestão de conteúdo, sem dados de pessoas |
| `juliana.mendes@aurora.example` | G&G / People | Pessoas e indicadores da empresa |
| `paula.ribeiro@aurora.example` | Administradora | Tudo, incluindo papéis e auditoria |
| `sergio.tavares@horizonte.example` | Admin de **outra empresa** | Isolamento entre tenants |

Para recomeçar do zero: `pnpm db:reset-local`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm check` | Lint + tipos + testes (rode antes de abrir PR) |
| `pnpm test` | Testes unitários, de integração e de segurança (Postgres real via PGlite) |
| `pnpm test:e2e` | E2E + acessibilidade (Playwright + axe) |
| `pnpm db:generate` | Gera migration a partir do schema |
| `pnpm db:migrate` | Aplica migrations no Neon (`DATABASE_URL_MIGRATIONS`) |
| `pnpm db:seed` | Dados demonstrativos no Neon (dev/preview) |
| `pnpm db:provision-roles` | Cria os logins de runtime no Neon |
| `pnpm tenant:create` | Cria uma empresa real e o primeiro administrador |
| `pnpm org:import <arquivo.json>` | Importa áreas, cargos, níveis e pessoas de uma empresa |
| `pnpm content:seed --tenant <slug>` | Carrega o conteúdo de exemplo (comunicados, trilhas, biblioteca, conquistas) |
| `pnpm brand:build` | Regenera as variações da marca a partir do SVG oficial |

## Documentação

- [Arquitetura](docs/architecture.md) · [Banco de dados](docs/database.md) · [API](docs/api.md)
- [Segurança](docs/security.md) · [RBAC](docs/rbac.md) · [Pesquisas anônimas](docs/anonymous-surveys.md)
- [Ambiente](docs/environment.md) · [Deploy (Vercel + Neon)](docs/deployment.md) · [Testes](docs/testing.md)
- [Design system](docs/design-system.md)
- Decisões: [RFC 0001 — Arquitetura](docs/rfc/0001-arquitetura.md)

## Prioridades do projeto

Segurança → privacidade → anonimato → integridade dos dados → autorização → arquitetura → UX → performance → escalabilidade → estética. Nenhuma conveniência de implementação justifica inverter essa ordem.
