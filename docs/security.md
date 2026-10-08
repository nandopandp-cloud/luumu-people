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
| MFA | **não faz parte do produto** (decisão de 2026-10-07). Tabela/coluna legadas `two_factors`/`two_factor_enabled` serão removidas na próxima release |
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
- **Rate limit da API:** por usuário, mais rígido em rotas sensíveis, **compartilhado entre todas as instâncias**: contador no Postgres (`app.rate_limit_buckets`), acessível somente pela função atômica `app.rate_limit_hit` (`SECURITY DEFINER`); a aplicação não lê nem altera contadores diretamente.
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

`audit_logs` é append-only: a role de runtime só tem `INSERT`/`SELECT`, e um trigger rejeita `UPDATE`, `DELETE` e `TRUNCATE`. A lista de ações é fechada (`AUDIT_ACTIONS`). Hoje registra login, logout, sessão revogada, redefinição de senha, concessão e revogação de papel, edição de perfil, criação/edição/publicação/arquivamento de comunicados e criação/edição/lançamento/encerramento de pesquisas. As ações de pessoas, estrutura, configurações e exportação entram com seus módulos. **Nunca** registra resposta de pesquisa anônima nem o vínculo entre pessoa e resposta.

## Uploads

- Tipo detectado pelos **bytes do arquivo** (PNG, JPEG, WEBP, PDF); SVG, HTML e executáveis recusados.
- Limites por finalidade (máx. 4 MB — corpo de função na Vercel é 4,5 MB); nome exibido saneado, chave de armazenamento gerada no servidor.
- Armazenamento **privado** (Vercel Blob com `access: "private"`); nada é acessível por URL pública. Entrega só por `/api/v1/files/:id` após sessão + tenant, com `X-Content-Type-Options: nosniff`, CSP `sandbox` e `Cache-Control: private`.
- Sem `BLOB_READ_WRITE_TOKEN` em produção, uploads respondem 503 com mensagem clara.
- Vídeos de aulas: só YouTube (domínio *nocookie*) e Vimeo, em iframe com `sandbox`; o CSP `frame-src` libera apenas esses dois.

## LGPD

- Separação entre identidade, dados de RH e dados de desenvolvimento; minimização em cada endpoint.
- O check-in de humor (Fase 2) é **identificado**, por decisão de produto, mas é dado potencialmente de saúde. Ele será visível ao próprio colaborador, agregado com k-anonimato para G&G e **nunca** individualmente para gestores. A tela vai explicar a finalidade.
- Hospedagem atual: Neon `us-east-1` + Vercel `iad1` (transferência internacional, com base no art. 33 da LGPD). Recomendação: migrar para `sa-east-1` + `gru1` antes de dados reais de clientes.

## Riscos conhecidos e próximos passos

- **Plano Hobby da Vercel:** os termos permitem apenas uso não comercial. Migre para o Pro antes de atender clientes.
- SSO (Google Workspace / Microsoft Entra ID): Fase 5.
