# Variáveis de ambiente

Validadas em `src/server/env.ts`: a aplicação falha alto se algo estiver errado. Modelo comentado em [.env.example](../.env.example). Nenhuma variável é exposta ao navegador (não usamos `NEXT_PUBLIC_*`).

| Variável | Onde | Obrigatória | Descrição |
|---|---|---|---|
| `APP_URL` | todos | sim (padrão `http://localhost:3000`) | URL pública; usada em cookies, CSRF e links de e-mail |
| `DATABASE_URL` | todos | sim | dev: `pglite://.data/pglite`; Neon: login `luumu_app_login`, endpoint **pooled** |
| `DATABASE_URL_AUTH` | Vercel | com Postgres | login `luumu_auth_login`, endpoint pooled |
| `DATABASE_URL_MIGRATIONS` | CLI / GitHub Actions | para migrar | role dona do schema, endpoint **direto**. **Nunca na Vercel** |
| `BETTER_AUTH_SECRET` | todos | sim | ≥ 32 caracteres (`openssl rand -base64 48`); um valor diferente por ambiente |
| `SESSION_IDLE_HOURS` | todos | não (8) | expiração por ociosidade |
| `SESSION_ABSOLUTE_HOURS` | todos | não (12) | duração máxima da sessão |
| `EMAIL_FROM` | todos | não | remetente dos e-mails transacionais |
| `RESEND_API_KEY` | produção | sim em produção | sem ela, em dev os e-mails vão para o terminal |
| `SEED_PASSWORD` | CLI | para `db:seed` | senha das contas demonstrativas |
| `LUUMU_APP_LOGIN_PASSWORD`, `LUUMU_AUTH_LOGIN_PASSWORD` | CLI | para `db:provision-roles` | senhas dos logins de runtime (≥ 24 caracteres) |
| `LOG_LEVEL` | todos | não (`info`) | `fatal`…`trace`, `silent` |

Regras:

- PGlite é recusado em produção.
- `BETTER_AUTH_SECRET` diferente em cada ambiente: trocar invalida as sessões.
- Nunca faça commit de `.env.local` (já está no `.gitignore`).
