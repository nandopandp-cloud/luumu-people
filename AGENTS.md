<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Regras do projeto Luumu People

- Leia `docs/architecture.md`, `docs/security.md` e `docs/rbac.md` antes de mudar código de servidor.
- Dados de tenant: somente via `withTenant()`. Toda tabela nova precisa de RLS, policy e grants explícitos em uma migration de segurança.
- Rotas de API: sempre com `defineRoute()` e permissão declarada. Escopo checado no serviço com `can()`.
- Nunca criar permissão, endpoint, log ou export que exponha resposta individual de pesquisa anônima (`docs/anonymous-surveys.md`).
- Interface: apenas tokens do design system; sem dados fictícios em componentes (dados demonstrativos só em `src/server/db/seed/data.ts`).
- Antes de concluir: `pnpm check` e, para UI, `pnpm test:e2e`.
