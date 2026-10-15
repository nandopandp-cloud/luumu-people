# Segurança

## Autenticação (Better Auth)

| Controle | Implementação |
|---|---|
| Senhas | Argon2id (m=19 MiB, t=2, p=1); mínimo de 10 caracteres |
| Sessão | token opaco em banco; cookie `HttpOnly`, `SameSite=Lax`, `Secure` em produção, prefixo `__Secure-` |
| Expiração | ociosidade de 8 h (deslizante) + limite **absoluto** de 12 h (`resolveActor`) |
| Senha provisória | contas importadas em lote (`scripts/import-structure.mts`, senha em `IMPORT_PASSWORD`) nascem com `must_change_password`: qualquer página leva a `/trocar-senha` e toda a API responde 403 até a pessoa criar a própria senha (diferente da provisória). Trocar ou redefinir a senha libera o acesso |
| Convite de acesso | conta criada pela empresa nasce "convidada" (login bloqueado). O convite usa o mesmo token da redefinição de senha do Better Auth (aleatório, guardado com hash, uso único), com validade de 7 dias; ao criar a senha, `onPasswordReset` ativa só quem estava "convidado" (desativados continuam inativos) e audita `people.activated`. Reenviar gera um novo link |
| Revogação | desativar usuário, trocar papel ou redefinir senha encerram as sessões na hora (sem cache de sessão em cookie) |
| Força bruta | rate limit persistente por IP (Better Auth/`rate_limits`) + bloqueio por conta após 5 falhas em 15 min (`login_throttles`, chave HMAC do e-mail) |
| Enumeração | mesma resposta para e-mail inexistente e senha errada; "esqueci a senha" sempre responde igual |
| Recuperação | token de uso único, guardado com **hash**, válido por 30 min |
| MFA | **não faz parte do produto** (decisão de 2026-10-07). Tabela/coluna legadas `two_factors`/`two_factor_enabled` serão removidas na próxima release |
| Cadastro | público desabilitado; endpoints `/sign-up`, `/update-user`, `/change-email`, `/delete-user` desligados |
| Login com Google | OAuth 2.0/OIDC com PKCE e `state` (Better Auth). **Só entra quem a empresa cadastrou**: nunca cria usuário; no primeiro acesso, vincula a conta Google ao usuário de mesmo e-mail **somente se o Google confirmar o e-mail** (`email_verified`). Nome e foto seguem o cadastro da empresa. Tokens do Google criptografados em `accounts`. Domínio do Workspace opcional (`GOOGLE_HOSTED_DOMAIN`, conferido no `hd`). Usuário/empresa inativos são barrados como no login por senha. Vínculo (`auth.sso_linked`) e login (`auth.login`, `method`) auditados |
| SSO por empresa | Microsoft Entra ID e configuração do Google por tenant: Fase 5 |
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
- **Rate limit da API:** por usuário, mais rígido em rotas sensíveis (a atualização periódica do chat — mensagens, lista, lido, digitando, presença — tem contador próprio de 300/min, para não esgotar a cota do restante da plataforma), **compartilhado entre todas as instâncias**: contador no Postgres (`app.rate_limit_buckets`), acessível somente pela função atômica `app.rate_limit_hit` (`SECURITY DEFINER`); a aplicação não lê nem altera contadores diretamente.
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

## Notificações e menções

- Notificações gravadas só são lidas e marcadas por quem recebe; ninguém cria notificação em nome de outra pessoa (policies `RESTRICTIVE` sobre `app.current_user_id()`). Quem gerou uma curtida enxerga só a notificação dela, para poder desfazê-la.
- "Novo comunicado" e "Nova pesquisa" são calculadas na leitura com as mesmas regras de visibilidade do mural e do convite: público por área, agendamento e arquivamento valem automaticamente. As de pesquisa usam **só o convite da própria pessoa** (nunca respostas).
- Menções: a sugestão de nomes lista só quem vê o comunicado e devolve apenas nome e foto. No envio, o servidor descarta menções a quem não vê o comunicado ou não está ativo; na tela, o nome exibido é sempre o atual da pessoa (o texto gravado no marcador não é confiável).

## Amigos e conversas privadas

- **Quem vê o quê:** o cartão de colega (nome, foto, cargo, área, local, frase do perfil) é visível a todas as pessoas ativas da empresa — sem e-mail, telefone, gestor ou dados de RH. Pedidos de amizade, só as duas pessoas. Amizades aceitas, a empresa (amigos em comum).
- **Conversas são privadas:** só quem participa lê, e só as mensagens enviadas depois da própria entrada. Não há permissão, tela ou endpoint para a gestão ou administradores lerem conversas de outras pessoas; a RLS nega mesmo que a aplicação erre. Fora da conversa, 404.
- **Regras:** qualquer colaborador ativo conversa com outro da mesma empresa, em privado ou em grupo — conexão (amizade) não é exigida; se a outra pessoa for desligada (inativa), o histórico fica e novas mensagens são bloqueadas; grupos só com colaboradores ativos da empresa; tudo em nome próprio (policies `RESTRICTIVE` sobre `app.current_user_id()`).
- **Sem registro do conteúdo:** mensagens não são auditadas nem vão para logs. Apagar descarta texto e anexo (o arquivo deixa de ser entregue). Editar corrige só o texto, só por quem enviou (o banco marca "editada" e recusa editar mensagem apagada ou trocar o anexo); a versão anterior não é guardada.
- **Curtidas:** em nome próprio e só em mensagens que a pessoa vê (RLS sobre a própria visibilidade da mensagem).
- **Sino:** pedido de amizade recebido e pedido aceito aparecem como notificações calculadas a partir de `friendships` — pedido recusado ou cancelado some sozinho.
- **Anexos:** finalidade `chat_attachment` (PDF ou imagem até 4 MB, tipo pelos bytes); entrega só para quem enviou e quem vê a mensagem.
- **Presença:** "online agora" vem de um sinal de atividade gravado no máximo a cada 30 s, enquanto a aba está visível; é mostrado só a amigos e a quem conversa com a pessoa.

## Conexões

- **Interesses** são visíveis na empresa (afinidades); cada pessoa grava e apaga só os próprios (policies `RESTRICTIVE`). "Seguir" nos destaques é o próprio pedido de conexão, não um vínculo à parte. Sugestões dispensadas são estritamente pessoais.
- **Destaques** usam só atividade pública nos comunicados que a pessoa vê (comunicados publicados, comentários e curtidas recebidas em comentários). Mensagens privadas nunca entram em cálculo algum.
- **Presença** continua só entre amigos (o "online" não aparece em cartões de quem não é amigo).

## Auditoria

`audit_logs` é append-only: a role de runtime só tem `INSERT`/`SELECT`, e um trigger rejeita `UPDATE`, `DELETE` e `TRUNCATE`. A lista de ações é fechada (`AUDIT_ACTIONS`). Hoje registra login (com o método: senha ou Google), vínculo de login corporativo, logout, sessão revogada, redefinição de senha, concessão e revogação de papel, edição de perfil, criação/edição/publicação/arquivamento de comunicados, remoção de comentário por moderação (sem o texto), criação/edição/exclusão de eventos e links rápidos e criação/edição/lançamento/encerramento de pesquisas. As ações de pessoas, estrutura, configurações e exportação entram com seus módulos. **Nunca** registra resposta de pesquisa anônima nem o vínculo entre pessoa e resposta.

## Uploads

- Tipo detectado pelos **bytes do arquivo** (PNG, JPEG, WEBP, PDF); SVG, HTML e executáveis recusados.
- Limites por finalidade: imagens de banner e de capa de comunicado até **3 MB**; anexos de comunicado (PDF ou imagem) e demais até 4 MB (corpo de função na Vercel é 4,5 MB); nome exibido saneado, chave de armazenamento gerada no servidor.
- Armazenamento **privado** (Vercel Blob com `access: "private"`); nada é acessível por URL pública. Entrega só por `/api/v1/files/:id` após sessão + tenant, com `X-Content-Type-Options: nosniff`, CSP `sandbox` e `Cache-Control: private`.
- Sem `BLOB_READ_WRITE_TOKEN` em produção, uploads respondem 503 com mensagem clara.
- Vídeos de aulas e de comunicados: só YouTube (domínio *nocookie*) e Vimeo, em iframe com `sandbox`; o CSP `frame-src` libera apenas esses dois. Vídeo nunca é enviado como arquivo.

## LGPD

- Separação entre identidade, dados de RH e dados de desenvolvimento; minimização em cada endpoint.
- O sentimento do dia ("Como você está se sentindo hoje?") é **identificado** e, por decisão de produto (out/2026), **visível para todas as pessoas da empresa** no dia — no perfil, no topo, na home, no menu e na visão "Meu time" do gestor —, com o comentário opcional. O modal avisa isso antes do envio ("Seu sentimento e o comentário ficam visíveis para a empresa hoje"). Gravar e mudar, só o próprio registro (policies `RESTRICTIVE` de insert/update). Atenção LGPD: é dado potencialmente de saúde (art. 11); a exposição ampla deve ser validada com o encarregado (DPO). Fechar o modal sem responder fica em `mood_prompt_dismissals`, visível só à própria pessoa.
- Hospedagem atual: Neon `us-east-1` + Vercel `iad1` (transferência internacional, com base no art. 33 da LGPD). Recomendação: migrar para `sa-east-1` + `gru1` antes de dados reais de clientes.

## Riscos conhecidos e próximos passos

- **Plano Hobby da Vercel:** os termos permitem apenas uso não comercial. Migre para o Pro antes de atender clientes.
- Login com Google configurado por ambiente (não por empresa) e Microsoft Entra ID: a configuração por tenant chega na Fase 5.
