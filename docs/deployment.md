# Deploy — Vercel + Neon

## Região e LGPD

As funções da Vercel precisam ficar na **mesma região do banco**: cada página faz várias consultas, e cada viagem entre continentes custa cerca de 120 ms.

| Banco (Neon) | `regions` em `vercel.json` |
|---|---|
| AWS `us-east-1` (configuração atual) | `iad1` |
| AWS `sa-east-1` (São Paulo) — recomendado antes de dados reais de clientes brasileiros | `gru1` |

Para ir para São Paulo: crie um projeto Neon em `sa-east-1`, refaça os passos abaixo e troque `regions` para `gru1`.

## 1. Neon (uma vez por branch: `main` e `preview`)

1. Crie o projeto (Postgres 17, região São Paulo). Crie uma branch `preview` para os deploys de preview.
2. Copie as connection strings do usuário dono (`neondb_owner`): a **direta** (sem `-pooler`) para migrations.
3. Na sua máquina, com `DATABASE_URL_MIGRATIONS` apontando para a branch:
   ```bash
   pnpm db:migrate                     # schema + RLS + catálogo
   LUUMU_APP_LOGIN_PASSWORD=$(openssl rand -base64 32) \
   LUUMU_AUTH_LOGIN_PASSWORD=$(openssl rand -base64 32) \
   pnpm db:provision-roles             # logins de runtime (guarde as senhas)
   SEED_PASSWORD='…' pnpm db:seed      # SOMENTE na branch de preview/dev
   ```
4. ⚠️ Crie os logins **pelo script**, não pelo console do Neon. Roles criadas no console entram em `neon_superuser` e ignorariam a RLS.

## 2. Vercel

No projeto já criado (Settings → Environment Variables), configure **por ambiente** (Production / Preview):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `postgresql://luumu_app_login:<senha>@<host>-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_AUTH` | `postgresql://luumu_auth_login:<senha>@<host>-pooler…/neondb?sslmode=require` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 48` (um por ambiente) |
| `APP_URL` | opcional: sem ela, usa o domínio de produção da Vercel (`VERCEL_PROJECT_PRODUCTION_URL`) e, em previews, a URL da branch/deploy. Defina ao usar domínio próprio. |
| `RESEND_API_KEY`, `EMAIL_FROM` | provedor de e-mail |

**Não** configure `DATABASE_URL_MIGRATIONS` na Vercel.

Deixe ligada a opção "Automatically expose System Environment Variables" (padrão da Vercel): é dela que vêm as URLs de produção e de preview aceitas pelo login.

## 3. Migrations em cada release

Rode manualmente o workflow **Migrations (Neon)** no GitHub Actions, com o secret `DATABASE_URL_MIGRATIONS` no Environment `preview`/`production`, **antes** de promover o deploy. As migrations são aditivas e compatíveis com a versão anterior do código.

## 4. Checklist de produção

- [ ] Plano **Vercel Pro**: o Hobby não permite uso comercial.
- [ ] Domínio próprio com HTTPS e `APP_URL` correto.
- [ ] `RESEND_API_KEY` configurada e domínio de envio verificado (SPF/DKIM).
- [ ] Seed demonstrativo **não** executado no banco de produção.
- [ ] Primeira empresa e primeiro administrador criados: `pnpm tenant:create --slug … --name … --admin-email … --admin-name …` (até a console de plataforma da Fase 5).
- [ ] Backups/PITR do Neon habilitados.


## Importar pessoas reais (substituindo dados de demonstração)

Dados pessoais nunca entram no repositório: CSV, JSON e backup ficam fora dele (os scripts recusam caminhos dentro do repo).

1. `pnpm tsx scripts/org-from-spreadsheet.mts organograma.csv --tenant <slug> --hire-date aaaa-mm-dd --out /fora/estrutura.json` — converte o organograma (NOME, ÁREA, CARGO, GESTOR, E-MAIL).
2. `pnpm tsx scripts/backup-database.mts /fora/backup.json` — backup lógico completo (e, de preferência, um branch no Neon).
3. `IMPORT_PASSWORD='…' pnpm org:import /fora/estrutura.json --dry-run`, depois sem `--dry-run` — cria as contas com senha provisória e troca obrigatória no primeiro acesso; atualiza lotação e gestor de quem já existe.
4. `pnpm tsx scripts/purge-demo-people.mts --tenant <slug> --keep <admin> --keep-from /fora/estrutura.json [--reset-development]` (simulação), depois com `--apply` — remove as pessoas de demonstração e o conteúdo ligado a elas, numa transação, com registro na auditoria.

A troca obrigatória de senha precisa estar **publicada antes** do passo 3.

## Migrations em produção

Aplique sempre com `pnpm db:migrate` (registra em `drizzle.__drizzle_migrations`). Em 15/10/2026 o registro estava parado na 0028 porque as migrations 0011–0016 e 0029–0041 tinham sido aplicadas fora do migrador; as proteções (RLS, permissões, cofre) foram conferidas, as entradas faltantes registradas e a 0042/0043 aplicadas.
