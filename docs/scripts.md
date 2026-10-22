# Scripts e operações

Ferramentas de linha de comando em `scripts/`. Rodam com a role **dona do schema** (`DATABASE_URL_MIGRATIONS`, via `scripts/_db.ts`) quando mexem no banco, por isso são só para CLI e GitHub Actions, **nunca** para a Vercel. Os que não têm atalho no `package.json` rodam com `pnpm tsx scripts/<arquivo>`.

Regras para todos:

- Scripts destrutivos rodam em **simulação** por padrão; só alteram algo com `--apply`.
- Arquivos com dados reais de pessoas (planilhas, JSON de importação, backups) ficam **fora do repositório**.
- Antes de qualquer limpeza em produção: `backup-database.mts` e, de preferência, um branch no Neon.

## Banco

| Comando | Script | O que faz |
|---|---|---|
| `pnpm db:generate` | drizzle-kit | gera a migration a partir do schema em `src/server/db/schema`. Tabela nova pede também a migration de segurança ([database.md](database.md#migrations)) |
| `pnpm db:migrate` | `db-migrate.mts` | aplica as migrations no Neon e sincroniza o catálogo (permissões, feature flags) |
| `pnpm db:provision-roles` | `db-provision-roles.mts` | cria/atualiza os logins de runtime `luumu_app_login` (NOINHERIT) e `luumu_auth_login`. Crie-os por este script, não pelo console do Neon |
| `pnpm db:seed` | `db-seed.mts` | dados **demonstrativos** (empresas fictícias). Recusa rodar em produção |
| `pnpm db:reset-local` | — | apaga o PGlite local (`.data/pglite`); no próximo `pnpm dev` ele é migrado e semeado de novo |
| `pnpm tsx scripts/backup-database.mts <arquivo.json>` | `backup-database.mts` | backup lógico de todas as tabelas (`public`, `app` e o cofre `survey_vault`) numa leitura consistente. O arquivo contém dados pessoais |

## Empresas e pessoas

| Comando | Script | O que faz |
|---|---|---|
| `pnpm tenant:create --slug … --name … --admin-email … --admin-name …` | `create-tenant.mts` | cria uma empresa real e o primeiro Administrador, com senha temporária exibida uma vez |
| `pnpm tsx scripts/org-from-spreadsheet.mts organograma.csv --tenant … --out …` | `org-from-spreadsheet.mts` | converte o organograma (CSV: nome, área, cargo, hierarquia, gestor, e-mail) no JSON de importação |
| `pnpm org:import <estrutura.json>` | `import-structure.mts` | importa áreas, cargos, níveis e pessoas de uma empresa. Idempotente; pessoas novas recebem senha provisória (`IMPORT_PASSWORD`) e trocam no primeiro acesso |
| `pnpm tsx scripts/purge-demo-people.mts --tenant … --keep <e-mail>` | `purge-demo-people.mts` | remove pessoas e conteúdo de **demonstração** de uma empresa, mantendo as contas de `--keep`. `--reset-development` também limpa PDIs, avaliações e histórico encerrado. Simulação sem `--apply` |

Fluxo para colocar uma empresa real no ar: [deployment.md](deployment.md#importar-pessoas-reais-substituindo-dados-de-demonstração).

## Conteúdo

| Comando | Script | O que faz |
|---|---|---|
| `pnpm content:seed --tenant <slug>` | `seed-content.mts` | carrega o conteúdo de exemplo (comunicados, trilhas, cursos, biblioteca, conquistas) numa empresa existente. Idempotente |

## Arquivos

| Comando | Script | O que faz |
|---|---|---|
| `pnpm tsx scripts/purge-orphan-files.mts` | `purge-orphan-files.mts` | libera espaço no Vercel Blob: remove o conteúdo de arquivos apagados ou que nenhuma tabela referencia há mais de `--grace-days` (padrão 2). O registro em `files` fica como trilha. Simulação sem `--apply` |

## Marca e e-mail

| Comando | Script | O que faz |
|---|---|---|
| `pnpm brand:build` | `brand-split.mjs` | gera `public/brand/*` a partir do SVG oficial em `brand/`, sem redesenhar ([design-system.md](design-system.md#marca)) |
| `pnpm tsx scripts/build-email-assets.mts` | `build-email-assets.mts` | gera as imagens PNG dos e-mails transacionais em `public/email/` (e-mail não exibe SVG). Suba a versão em `src/server/email/templates/invite.ts` ao regerar |
| `pnpm tsx scripts/send-test-email.mts <destinatário>` | `send-test-email.mts` | envia um e-mail de convite de **teste** pelo Resend e mostra o diagnóstico. Não cria usuário |

## Documentação

| Comando | Script | O que faz |
|---|---|---|
| `pnpm docs:screenshots` | `tests/screenshots/` | sobe o app com o seed demonstrativo, fotografa as telas principais e atualiza `docs/assets/screens/` ([product.md](product.md)). Não rode com `pnpm dev` aberto |
