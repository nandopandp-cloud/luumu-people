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
| POST | `/api/v1/files?purpose=…` | conforme a finalidade | upload privado — `course_cover`/`lesson_material` (`content.course.edit`), `announcement_cover` (`comms.announcement.create`, até 3 MB), `home_banner` (`comms.announcement.publish`, até 3 MB), `library_material` (`content.library.manage`) |
| GET | `/api/v1/files/:id` | autenticado (mesmo tenant) | entrega o arquivo com `nosniff`, CSP `sandbox` e cache privado |
| POST | `/api/v1/courses/:id/enroll` | autenticado | matrícula voluntária em curso publicado; devolve a próxima aula |
| POST | `/api/v1/courses/:id/lessons/:lessonId/complete` | autenticado | conclui a aula (idempotente), recalcula o progresso e emite o certificado ao chegar a 100% |
| GET / PUT | `/api/v1/me/mood` | autenticado | check-in de humor do dia `{ mood: 1..5 }` — somente o próprio registro |
| GET | `/api/v1/audit-logs` | `audit.read` (TENANT) | trilha de auditoria (`action`, `actorUserId`, `cursor`) |
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
| POST | `/api/v1/me/surveys/:id/responses` | autenticado (convidado) | envio anônimo `{ answers }` — sem log de payload/usuário, rate limit só em memória, sem auditoria |

## Criando uma rota nova

1. Schema Zod em `src/server/modules/<domínio>/schemas.ts` (`z.strictObject`).
2. Serviço em `src/server/modules/<domínio>/service.ts`: checa o escopo com `can()`, acessa dados com `withTenant()` e audita ações sensíveis.
3. Route handler com `defineRoute()`.
4. Teste em `tests/integration` cobrindo 401, 403, escopo e o caminho feliz.
