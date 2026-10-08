# Segurança

## Autenticação (Better Auth)

| Controle | Implementação |
|---|---|
| Senhas | Argon2id (m=19 MiB, t=2, p=1); mínimo de 10 caracteres |
| Sessão | token opaco em banco; cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, prefixo `__Secure-` |
| Expiração | ociosidade de 8 h (deslizante) + limite **absoluto** de 12 h (`resolveActor`) |
| Revogação | desativar usuário, trocar papel ou redefinir senha encerram as sessões na hora (sem cache de sessão em cookie) |
| Força bruta | rate limit persistente por IP (Better Auth/`rate_limits`) + bloqueio por conta após 5 falhas em 15 min (`login_throttles`, chave HMAC do e-mail) |
| Enumeração | mesma resposta para e-mail inexistente e senha errada; "esqueci a senha" sempre responde igual |
| Recuperação | token de uso único, guardado com **hash**, válido por 30 min |
| MFA | TOTP (plugin two-factor), com bloqueio após tentativas; obrigatoriedade por papel na Fase 5 |
| Cadastro | público desabilitado; endpoints `/sign-up`, `/update-user`, `/change-email`, `/delete-user` desligados |
| SSO | Google Workspace / Microsoft Entra ID via OIDC (Fase 5) |
| Telemetria do Better Auth | desligada |

## Autorização

Toda autorização acontece no servidor (ver [rbac.md](rbac.md)). Esconder um botão não é segurança: a API e o banco negam sozinhos.

## Isolamento entre empresas (3 camadas)

1. **HTTP:** o tenant vem só da sessão. `tenant_id`/`tenantId` enviados pelo cliente são descartados antes da validação.
2. **Serviços:** acesso a dados apenas por `withTenant()` (regra de lint).
3. **Banco:** RLS em todas as tabelas, FKs compostas, roles sem privilégio de dono e grants por coluna.

## Proteções HTTP

- **CSRF:** mutações exigem mesma origem (`Origin` + `Sec-Fetch-Site`); cookie `SameSite=Lax`.
- **Validação:** Zod estrito em toda entrada (campos extras → 400); corpo limitado a 64 KB; somente JSON.
- **Erros:** `application/problem+json` com mensagem humana e `requestId`; nunca stack ou SQL.
- **Rate limit da API:** por usuário, mais rígido em rotas sensíveis. A implementação atual é em memória por instância (melhor esforço na Vercel). Para um limite global, implemente `RateLimitStore` com um store distribuído (ex.: Upstash) ou use o Firewall da Vercel.
- **Cabeçalhos:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP; `Cache-Control: no-store` em `/api`.
- **SQL injection:** queries parametrizadas (Drizzle). `sql.raw` só com constantes do código.
- **XSS:** React escapa a saída; nenhum `dangerouslySetInnerHTML`; e-mails escapam o HTML.
- **Open redirect:** o parâmetro `next` do login aceita somente caminhos internos (`safeNext`).

### CSP: decisão consciente

A CSP é estática e permite `'unsafe-inline'` em scripts. Nonces exigiriam renderização dinâmica em todas as páginas e são incompatíveis com o *static shell* do Cache Components. O que mitiga o risco: **nenhuma origem externa** é permitida (`script-src 'self'`), `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'` e `form-action 'self'`. A evolução prevista é a SRI experimental do Next (CSP por hash) quando estabilizar.

## Dados e logs

- O logger (pino) redige senhas, tokens, códigos, cookies, cabeçalhos de autorização, e-mails, respostas e comentários.
- Os metadados de auditoria passam por `sanitizeMetadata()`.
- Não há analytics de terceiros. As páginas de pesquisa nunca terão nenhum ([anonymous-surveys.md](anonymous-surveys.md)).
- Segredos ficam só em variáveis de ambiente do servidor. Não existe variável `NEXT_PUBLIC_*`.

## Auditoria

`audit_logs` é append-only: a role de runtime só tem `INSERT`/`SELECT`, e um trigger rejeita `UPDATE`, `DELETE` e `TRUNCATE`. A lista de ações é fechada (`AUDIT_ACTIONS`). Hoje registra login, logout, sessão revogada, redefinição de senha, concessão e revogação de papel e edição de perfil. As ações de pessoas, estrutura, configurações e exportação entram com seus módulos. **Nunca** registra resposta de pesquisa anônima nem o vínculo entre pessoa e resposta.

## Uploads (Fase 2)

Previsto: validação por *magic bytes*, limite por tipo, nome gerado no servidor, storage privado e URLs assinadas de curta duração.

## LGPD

- Separação entre identidade, dados de RH e dados de desenvolvimento; minimização em cada endpoint.
- O check-in de humor (Fase 2) é **identificado**, por decisão de produto, mas é dado potencialmente de saúde. Ele será visível ao próprio colaborador, agregado com k-anonimato para G&G e **nunca** individualmente para gestores. A tela vai explicar a finalidade.
- Dados hospedados no Brasil: Vercel `gru1` + Neon `sa-east-1`.

## Riscos conhecidos e próximos passos

- **Plano Hobby da Vercel:** os termos permitem apenas uso não comercial. Migre para o Pro antes de atender clientes.
- Rate limit da API por instância (ver acima).
- Obrigatoriedade de MFA para Admin/G&G e SSO: Fase 5.
