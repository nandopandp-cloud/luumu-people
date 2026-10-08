# Testes

```bash
pnpm test        # unitários + integração + segurança (Vitest, Postgres real via PGlite)
pnpm test:e2e    # E2E + acessibilidade (Playwright + axe), sobe o app com banco próprio
pnpm check       # lint + tipos + testes
```

Não precisa de Docker: cada arquivo de teste recebe um Postgres em memória (PGlite), migrado e semeado com os dados demonstrativos. RLS, roles, grants, triggers e constraints são os mesmos da produção.

## Organização

| Pasta | Conteúdo |
|---|---|
| `src/**/*.test.ts` | testes de unidade próximos ao código (motor de autorização, `cn`) |
| `tests/unit` | helpers de segurança (remoção de tenant, redirect seguro, rate limit, flags, auditoria) |
| `tests/integration` | banco, autenticação e API ponta a ponta (sessões reais, route handlers reais) |
| `tests/e2e` | fluxos no navegador + varredura WCAG 2.2 AA com axe |
| `tests/support` | banco de teste, login, chamada de route handlers |

## Suíte de segurança (briefing §51)

| Teste | Onde |
|---|---|
| 4 — empresa A acessando empresa B | `tenant-isolation.test.ts` (RLS, FKs compostas) e `api-authorization.test.ts` (API: 404, listagem, concessão de papel) |
| 5 — editor acessando dados de G&G | `api-authorization.test.ts` |
| 6 — colaborador em endpoint/tela administrativa | `api-authorization.test.ts`, `foundation.spec.ts` |
| 7 — alterar o próprio papel | `policy.test.ts` (escalonamento), `api-authorization.test.ts` |
| 8 — `tenant_id` forjado | `api-authorization.test.ts`, `security-helpers.test.ts`, `tenant-isolation.test.ts` (coluna imutável) |
| Estrutura do banco | `schema-security.test.ts`: RLS e policy em toda tabela, grants mínimos, roles sem bypass, auditoria imutável, login de produção NOINHERIT |
| Autenticação | `auth.test.ts`: Argon2id, cookie HttpOnly/SameSite, mensagens sem enumeração, bloqueio por conta, usuário inativo, revogação imediata, cadastro desabilitado, auditoria de login/logout |
| 1, 2, 3 e inversão de anonimato | Fase 4 — ver [anonymous-surveys.md](anonymous-surveys.md#testes-obrigatórios-fase-4) |

## E2E local

Não rode `pnpm dev` junto com `pnpm test:e2e`: dois servidores de desenvolvimento no mesmo projeto reescrevem os arquivos gerados um do outro e entram em loop de recarga.

## Regras

- Funcionalidade nova só está pronta com testes de autorização (401/403/escopo) e do caminho feliz.
- Tabela nova sem RLS faz `schema-security.test.ts` falhar. Isso é proposital.
- E2E aguardam a hidratação (`gotoHydrated`) antes de interagir com formulários.
- A varredura do axe falha com qualquer violação **séria** ou **crítica**.

**Artefatos do E2E** (traces, screenshots) ficam em `$TMPDIR/luumu-people-e2e`, fora do projeto: gravá-los em `./test-results` fazia o dev server recompilar e recarregar a página em loop.
