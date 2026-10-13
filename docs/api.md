# API

REST em `/api/v1`, JSON, mesma origem da interface (cookie de sessão). Autenticação em `/api/auth/*` (Better Auth).

## Contrato de toda rota

Rotas são declaradas com `defineRoute()` (`src/server/http/route.ts`):

```ts
export const GET = defineRoute({
  permission: "people.directory.read", // ou "authenticated" para os próprios dados
  query: peopleQuerySchema,             // Zod estrito
  handler: ({ actor, query }) => listPeople(actor, query),
});
```

| Situação | Resposta |
|---|---|
| sem sessão | 401 |
| sem a permissão declarada | 403 |
| recurso fora do escopo ou inexistente | 404 (não revela existência) |
| entrada inválida / campo desconhecido | 400 com `errors[]` |
| mutação de outra origem | 403 |
| excesso de requisições | 429 + `Retry-After` |
| corpo > 64 KB / não-JSON | 413 / 415 |
| erro inesperado | 500 genérico + `requestId` |

Erros seguem a RFC 9457 (`application/problem+json`):

```json
{ "type": "about:blank", "status": 403, "title": "Acesso negado", "detail": "Você não tem permissão para acessar este recurso.", "requestId": "…" }
```

Paginação por cursor: `?cursor=…&limit=…` → `{ items, nextCursor }`.

`tenant_id`/`tenantId`/`tenant` enviados pelo cliente são **descartados** em qualquer nível do JSON e da query: o tenant vem só da sessão.

## Endpoints

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/health` | pública | disponibilidade |
| GET | `/api/v1/me` | autenticado | identidade, empresa, papéis, permissões efetivas, flags |
| GET | `/api/v1/me/profile` | autenticado | perfil próprio (profissional + pessoal + campos editáveis) |
| PATCH | `/api/v1/me/profile` | autenticado | edita `preferredName`, `phone`, `headline` **se** a empresa permitir |
| GET | `/api/v1/people` | `people.directory.read` | diretório no escopo do ator (`search`, `orgUnitId`, `status`, `cursor`, `limit`) |
| GET | `/api/v1/people/:id` | `people.directory.read` | dados profissionais; `personal` só com `people.profile.read_full` no escopo |
| GET | `/api/v1/people/:id/roles` | `access.roles.assign` | papéis ativos |
| POST | `/api/v1/people/:id/roles` | `access.roles.assign` | concede papel `{ roleId, scopeType, scopeOrgUnitId? }` |
| DELETE | `/api/v1/people/:id/roles/:assignmentId` | `access.roles.assign` | revoga papel |
| GET | `/api/v1/roles` | `access.roles.assign` | papéis da empresa e permissões |
| GET | `/api/v1/org-units` | autenticado | estrutura organizacional (não sensível) |
| POST | `/api/v1/me/avatar` | autenticado (se a empresa permitir) | troca a foto do perfil — multipart, campo `file` (PNG/JPG/WEBP até 2 MB) |
| POST | `/api/v1/files?purpose=…` | conforme a finalidade | upload privado — `course_cover`/`lesson_material` (`content.course.edit`), `announcement_cover` (`comms.announcement.create`, até 3 MB), `home_banner` (`comms.announcement.publish`, até 3 MB), `library_material` (`content.library.manage`), `chat_attachment` (autenticado; PDF ou imagem até 4 MB) |
| GET | `/api/v1/files/:id` | autenticado (mesmo tenant) | entrega o arquivo com `nosniff`, CSP `sandbox` e cache privado (`?download=1`: como anexo, para baixar); anexo de conversa só para quem enviou e quem participa da conversa (senão 404) |
| POST | `/api/v1/courses/:id/enroll` | autenticado | matrícula voluntária em curso publicado; devolve a próxima aula |
| POST | `/api/v1/courses/:id/lessons/:lessonId/complete` | autenticado | conclui a aula (idempotente), recalcula o progresso e emite o certificado ao chegar a 100% |
| POST | `/api/v1/development/pdis` | `development.pdi.manage` no escopo (nunca sobre si) | cria o PDI ativo `{ userId, title, periodStart, periodEnd }` (409 se já existir) |
| POST | `/api/v1/development/pdis/:pdiId/goals` | idem | nova meta `{ title, description?, competencyId?, targetDate? }` |
| POST | `/api/v1/development/goals/:goalId/actions` | idem | nova ação `{ title, type, dueDate?, ownerUserId? }` |
| PATCH | `/api/v1/development/actions/:actionId` | liderança; titular só `status` (sem cancelar), `evidence`, `evidenceUrl` | atualiza status, prazo e evidência (`evidenceUrl` só `https://`) |
| POST | `/api/v1/development/assessments` | `development.pdi.manage` no escopo (nunca sobre si) | registra avaliação `{ userId, competencyId, score 0..100, note? }`; a origem (manager/people) é definida pelo servidor |
| GET / POST | `/api/v1/development/competencies` | autenticado / `development.pdi.manage` (TENANT) | catálogo de competências da empresa |
| GET | `/api/v1/reports/development` | `reports.export` | CSV do desenvolvimento (pessoas no escopo de `development.read` ∩ `reports.export`); células neutralizadas contra injeção de fórmulas; auditado |
| POST / DELETE | `/api/v1/me/cover` | autenticado | troca (multipart `file`, imagem até 3 MB) ou remove a capa do próprio perfil |
| GET / PUT | `/api/v1/me/mood` | autenticado | sentimento do dia da própria pessoa: `GET` → `{ mood, note, at, dismissed }`; `PUT { mood: 1..6, note? (≤ 300) }` registra ou muda |
| POST | `/api/v1/me/mood/dismiss` | autenticado | fechou o modal do dia sem responder: não reabre sozinho hoje |
| GET | `/api/v1/audit-logs` | `audit.read` (TENANT) | trilha de auditoria (`action`, `actorUserId`, `cursor`) |
| PUT / DELETE | `/api/v1/announcements/:id/reaction` | autenticado (quem vê o comunicado) | reage `{ kind: love \| cheer \| sad }` (trocar atualiza) ou remove a reação, em nome próprio; devolve `{ counts, total, mine }` |
| GET / POST | `/api/v1/announcements/:id/comments` | autenticado (quem vê o comunicado) | lista / cria comentário `{ body, parentId? }` — resposta de um nível; menções `@[Nome](user:id)` só de quem vê o comunicado (as demais viram texto) |
| POST / DELETE | `/api/v1/announcements/:id/comments/:commentId/like` | autenticado (quem vê o comunicado) | curte/descurte comentário em nome próprio; avisa quem escreveu |
| GET | `/api/v1/announcements/:id/mentionable?q=` | autenticado (quem vê o comunicado) | sugestões de menção: até 8 pessoas do público, só `{ id, name, image }` |
| GET | `/api/v1/me/notifications?aba=&tipos=&limite=` | autenticado | notificações da própria pessoa (`todas`, `nao-lidas`, `mencoes`; categorias) + contadores |
| GET | `/api/v1/me/notifications/unread-count` | autenticado | não lidas (sino) |
| POST | `/api/v1/me/notifications/read` | autenticado | `{ keys[], read? }` marca como lida/não lida (só as próprias) |
| POST | `/api/v1/me/notifications/read-all` | autenticado | marca todas como lidas |
| GET / PUT | `/api/v1/me/notifications/preferences` | autenticado | categorias silenciadas `{ muted[] }` |
| GET | `/api/v1/feature-flags` | autenticado | flags efetivas do usuário |
| POST | `/api/v1/announcements` | `comms.announcement.create` (TENANT) | cria rascunho de comunicado |
| GET / PUT / DELETE | `/api/v1/announcements/:id` | `comms.announcement.create` | lê, edita (no ar ou fixado: exige `comms.announcement.publish`) e exclui (só rascunho) |
| POST | `/api/v1/announcements/:id/publish` | `comms.announcement.publish` | publica agora ou agenda `{ publishAt? }` (até 12 meses) |
| POST | `/api/v1/announcements/:id/archive` | `comms.announcement.publish` | tira do mural (fica no histórico) |
| GET / POST | `/api/v1/surveys` | gestão / `survey.design` | lista pesquisas; cria rascunho (sempre anônima nesta versão) |
| GET / PUT / DELETE | `/api/v1/surveys/:id` | gestão / `survey.design` | lê, edita e exclui — **somente rascunho** |
| POST | `/api/v1/surveys/:id/launch` | `survey.launch` | lança para todas as pessoas ativas `{ closesAt }`; congela k e dimensões |
| POST | `/api/v1/surveys/:id/close` | `survey.launch` | encerra e libera o último lote |
| GET | `/api/v1/surveys/:id/results` | `survey.results.read_aggregate` (TENANT) | **somente agregados** (`dimension`, `bucket`); grupos < k → `suppressed` |
| GET / POST | `/api/v1/banners` | `comms.announcement.publish` (TENANT) | banners da home (lista / cria). Destino do botão: caminho interno ou `https://` |
| GET / PUT / DELETE | `/api/v1/banners/:id` | `comms.announcement.publish` | lê, edita e exclui um banner |
| PUT | `/api/v1/banners/order` | `comms.announcement.publish` | ordem do carrossel `{ ids }` (todos os banners, uma vez cada) |
| GET | `/api/v1/search?q=&context=` | autenticado | busca da paleta ⌘K; cada grupo respeita permissão, escopo e flags. Sem termo: atalhos |
| GET | `/api/v1/friends` | autenticado | amigos da própria pessoa (cartão de colega, sentimento do dia, presença) |
| GET | `/api/v1/friends/people?q=&limit=` | autenticado | colegas ativos da empresa para encontrar amigos — só o cartão profissional (nome, foto, cargo, área, local); amigos e pedidos primeiro |
| GET / POST | `/api/v1/friends/requests` | autenticado | pedidos recebidos e enviados / pede amizade `{ userId }` (se a outra pessoa já tinha pedido, vira amizade) |
| POST | `/api/v1/friends/requests/:userId/accept` | autenticado (quem recebeu) | aceita o pedido |
| DELETE | `/api/v1/friends/requests/:userId` | autenticado (uma das partes) | recusa (recebido) ou cancela (enviado) |
| DELETE | `/api/v1/friends/:userId` | autenticado (uma das partes) | desfaz a amizade (a conversa privada fica no histórico, sem novas mensagens) |
| GET | `/api/v1/friends/:userId/profile` | autenticado | perfil do colega: cartão, frase, capa, amigos e grupos em comum (404 para si, inativos e outras empresas) |
| GET / POST | `/api/v1/conversations` | autenticado | conversas da pessoa / abre a privada com um amigo `{ kind: "direct", userId }` ou cria grupo com amigos `{ kind: "group", title, memberIds }` |
| GET / PATCH | `/api/v1/conversations/:id` | quem participa / administração do grupo | detalhes (participantes, papel, bloqueio) / renomeia o grupo `{ title }` |
| POST | `/api/v1/conversations/:id/members` | administração do grupo | adiciona amigos `{ userIds }` (veem só as mensagens a partir da entrada) |
| DELETE | `/api/v1/conversations/:id/members/:userId` | administração do grupo / a própria pessoa | remove do grupo / sai do grupo |
| GET / POST | `/api/v1/conversations/:id/messages` | quem participa | mensagens (`before`, `after` para atualização periódica: novas, editadas, apagadas e curtidas) + leitura, digitação e presença / envia `{ body, fileId? }` |
| PATCH / DELETE | `/api/v1/conversations/:id/messages/:messageId` | quem enviou | corrige o texto `{ body }` (fica "editada"; não troca anexo) / apaga (texto e anexo descartados) |
| PUT / DELETE | `/api/v1/conversations/:id/messages/:messageId/like` | quem participa | curte / descurte a mensagem em nome próprio; devolve a mensagem com `likes`, `likedByMe`, `likedBy` |
| POST | `/api/v1/conversations/:id/read` · `/typing` | quem participa | marca como lida · sinal de "digitando…" |
| GET | `/api/v1/conversations/:id/media` | quem participa | fotos, arquivos e links compartilhados |
| GET | `/api/v1/connections/people?q=&filtro=&area=&local=&interesse=&limit=` | autenticado | Conexões — descobrir pessoas: busca por nome, cargo, área ou interesse; `filtro` = `todos`, `equipe`, `departamento`, `interesses`, `conexoes`; afinidade primeiro |
| GET | `/api/v1/connections/suggestions?limit=` | autenticado | pessoas que você talvez conheça (sem vínculo, por time, departamento, amigos e interesses em comum) |
| POST | `/api/v1/connections/suggestions/:userId/dismiss` | autenticado | dispensa a sugestão (pessoal) |
| GET | `/api/v1/connections/featured?limit=` | autenticado | pessoas em destaque (atividade pública recente nos comunicados que a pessoa vê) |
| GET | `/api/v1/connections/online?limit=` | autenticado | amigos online agora |
| GET | `/api/v1/connections/counts` | autenticado | amigos, pedidos recebidos/enviados e amigos online |
| GET / PUT | `/api/v1/me/interests` | autenticado | interesses do próprio perfil `{ keys }` (catálogo em `src/lib/interests.ts`, até 12) |
| POST | `/api/v1/me/presence` | autenticado | sinal de atividade ("online agora"), gravado no máximo a cada 30 s |
| POST | `/api/v1/me/surveys/:id/responses` | autenticado (convidado) | envio anônimo `{ answers }` — sem log de payload/usuário, rate limit só em memória, sem auditoria |

## Criando uma rota nova

1. Schema Zod em `src/server/modules/<domínio>/schemas.ts` (`z.strictObject`).
2. Serviço em `src/server/modules/<domínio>/service.ts`: checa o escopo com `can()`, acessa dados com `withTenant()` e audita ações sensíveis.
3. Route handler com `defineRoute()`.
4. Teste em `tests/integration` cobrindo 401, 403, escopo e o caminho feliz.
