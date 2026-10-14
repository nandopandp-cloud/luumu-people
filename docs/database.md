# Banco de dados

PostgreSQL 17 (Neon em preview/produção; PGlite, o Postgres em WASM, em desenvolvimento e testes). Schema em `src/server/db/schema`, migrations versionadas em `db/migrations`.

## Convenções

- PK `uuid` (`gen_random_uuid()`); tabelas e colunas em `snake_case` e inglês.
- Todo dado de empresa tem `tenant_id NOT NULL` e **RLS**.
- **FKs compostas** `(tenant_id, id)`: o banco recusa referências que cruzem empresas, mesmo que a aplicação erre.
- Históricos não são sobrescritos: lotação e gestor têm vigência (`valid_from`/`valid_to`); papéis revogados recebem `revoked_at`.
- `CHECK` constraints garantem regras de domínio (k ∈ {5, 7, 10}, hierarquia de áreas, e-mail minúsculo, sem autoatribuição de papel…).
- JSON só para configuração livre (`organizations.settings`, `audit_logs.metadata`), nunca para relacionamentos.

## Entidades da Fase 1

| Domínio | Tabelas |
|---|---|
| Tenant | `organizations` |
| Identidade e autenticação | `users`, `sessions`, `accounts`, `verifications`, `two_factors`, `rate_limits`, `login_throttles` |
| Estrutura | `business_units` (unidades/localidades), `org_units` (diretoria → área → subárea), `positions` (cargos), `job_levels` (níveis) |
| Colaborador | `employee_profiles` (dados de RH), `employment_assignments` (lotação com vigência), `manager_relationships` (gestor com vigência), `org_tags`, `user_org_tags`, `profile_field_policies` |
| Acesso | `permissions` (catálogo), `roles`, `role_permissions`, `user_roles` (com escopo) |
| Plataforma | `audit_logs`, `feature_flags`, `feature_flag_overrides`, `usage_days` (uso por pessoa e dia, alimentado pelo sinal de presença: acessos — novo acesso após 30 min sem sinal — e segundos de uso; cada pessoa grava só a própria linha; o dashboard lê apenas agregados) |
| Desenvolvimento (Fase 3) | `competencies`, `position_competencies` (nível esperado por cargo), `competency_assessments` (histórico, append-only), `pdis` (um ATIVO por pessoa — índice único parcial; mentoria do ciclo: `mentor_user_id`, nunca a própria pessoa, e `mentor_note`), `pdi_goals` (`tags`, até 5), `pdi_actions`. "Atrasada", a evolução mensal do PDI, a variação das competências, as conquistas (cada nível de proficiência inédito numa competência) e as sugestões de conteúdo (curso ou trilha publicados cuja categoria ou título cita a competência ainda abaixo do esperado; o que a pessoa já concluiu fica de fora) são **derivadas** na leitura, nada gravado |
| Experiência (Fase 2) | `announcements`, `courses`, `course_modules`, `lessons`, `lesson_progress`, `certificates`, `learning_paths`, `learning_path_courses`, `enrollments`, `library_items`, `mood_checkins`, `achievements`, `user_achievements`, `files` |
| Home | `home_banners` (banners com período, ordem e ativo; imagem opcional em `files` com finalidade `home_banner`) |
| Mural de comunicados | `announcement_reactions` (reação: uma por pessoa, `kind` = love/cheer/sad, trocar atualiza a linha), `announcement_comments` (removido = `deleted_at`, nunca apagado; `parent_id` = resposta de um nível; menções no texto como `@[Nome](user:id)`), `comment_reactions` (curtida em comentário), `announcement_attachments` (arquivo `announcement_attachment` ou vídeo YouTube/Vimeo), `events` (agenda), `quick_links` (atalhos) |
| Notificações | `notifications` (menção, resposta e curtida em comentário, uma linha por destinatário), `notification_reads` (leitura das notificações calculadas), `notification_preferences` (categorias silenciadas). "Novo comunicado", "Nova pesquisa", "Lembrete de pesquisa", "Novo pedido de amizade" e "Pedido de amizade aceito" são **calculadas na leitura** a partir das tabelas de origem: respeitam o público atual e somem com o arquivamento |
| Amigos e conversas | `friendships` (um vínculo por par — índice único em `least/greatest`; `pending` → `accepted`; recusar, cancelar e desfazer apagam a linha), `conversations` (`direct` com `direct_key` único por par, ou `group` com nome), `conversation_members` (papel `admin`/`member`, `joined_at`, `left_at`, `last_read_at`, `typing_at`), `chat_messages` (texto até 4.000 caracteres e/ou anexo `chat_attachment`; editar = texto novo + `edited_at` pelo banco; apagar = `deleted_at` + texto e anexo descartados; `updated_at` muda a cada edição, exclusão ou curtida), `chat_message_likes` (uma curtida por pessoa e mensagem), `user_interests` (interesses do perfil, chaves do catálogo em `src/lib/interests.ts`), `user_follows` (**obsoleta**: sem uso no código; será removida na próxima versão — expand/contract), `connection_suggestion_dismissals` (sugestões dispensadas, pessoal), `user_presence` (último sinal de atividade) |
| Pesquisas (Fase 4) | `surveys`, `survey_questions`, `survey_invitations` (core) + schema `survey_vault` (cofre anônimo) |

No desenvolvimento, "atrasada" é **derivado** (prazo vencido e ação em aberto), nunca gravado; `pdi_actions` garante por `CHECK` que `status = 'done'` ⇔ `completed_at` preenchido e que o link de evidência é `https://`. A role de runtime só tem `SELECT`/`INSERT` em `competency_assessments`: o histórico de avaliações não pode ser editado nem apagado.

O progresso de uma matrícula é **derivado** das aulas concluídas (`lesson_progress`); ao chegar a 100% é emitido um certificado com código de verificação.

`mood_checkins` (sentimento do dia, escala 1 = muito mal a 6 = muito bem, comentário até 300 caracteres) é legível por todas as pessoas do tenant (decisão de produto); policies `RESTRICTIVE` só deixam inserir e alterar a própria linha. `mood_prompt_dismissals` guarda o "agora não" do modal diário e é estritamente pessoal (`own_rows_only`). `withTenant()` define `app.tenant_id` e `app.user_id` numa única ida ao banco.

Capas de comunicados, trilhas e cursos usam `theme` + `illustration` do design system até a chegada do upload de imagens. Comunicados: `pinned` fixa no topo; `cover_file_id` é a capa opcional (arquivo privado com finalidade `announcement_cover`); agendamento = `status = 'published'` com `published_at` futuro (o mural só mostra `published_at <= now()`). **Público:** `audience_org_unit_id` nulo = empresa toda; com área, só quem tem lotação atual nela ou em subárea vê o comunicado (mural, detalhe, busca, curtidas e comentários — regra em `modules/announcements/audience.ts`). Curtir e comentar só em nome próprio também no banco (policies `RESTRICTIVE` sobre `app.current_user_id()`).

**Pesquisas.** No core, a pesquisa é a própria campanha (uma aplicação por pesquisa). `survey_invitations` guarda só `status` e `completed_on` (**data**, sem timestamps). Triggers: `anonymity_mode` imutável após o lançamento (e sem grant de UPDATE para o runtime), k só sobe, dimensões e perguntas congelam, ciclo `draft → active → closed`, só rascunho é excluído. O schema `survey_vault` (`anon_submission_buffer`, `anon_response`, `anon_answer`, `anon_response_dimension`) não tem identidade, timestamp nem FK para o core, e nenhuma role de runtime tem grant nas tabelas: só `EXECUTE` em `submit`, `close`, `results` e `breakdown` (`SECURITY DEFINER`). Ver [anonymous-surveys.md](anonymous-surveys.md).

**Amigos e conversas.** Pedidos pendentes só são vistos pelas duas pessoas; amizades aceitas são legíveis na empresa (amigos em comum). Conversas, participantes e mensagens só são legíveis por quem participa, e mensagens só a partir da própria entrada (`created_at >= app.chat_member_since(...)`). As funções `app.chat_member_since`, `app.chat_is_admin` e `app.chat_is_creator` (`SECURITY DEFINER`, só sobre a própria pessoa) evitam recursão nas policies. Triggers: `conversation_members_guard` (papel, entrada e reentrada só pela administração; leitura e "digitando" só em nome próprio) e `chat_messages_guard` (só o texto é editado; apagada não muda mais; o anexo não é trocado; `edited_at`/`updated_at` pelo banco) e `chat_message_likes_touch` (`SECURITY DEFINER`: curtir marca a mensagem como alterada, para a atualização periódica). Sem `DELETE` para o runtime em conversas, participantes e mensagens.

Schema interno `app`: funções de apoio (`current_tenant_id`, `current_user_id`) e o rate limit da API (`rate_limit_buckets` + `rate_limit_hit`), sem acesso direto pelas roles de runtime.

**Pendência de contrato (expand/contract):** `two_factors` e `users.two_factor_enabled` não são mais usados (2FA descartado). Remover numa migration da PRÓXIMA release, depois que esta versão estiver no ar.

Identidade (`users`) e dados de RH (`employee_profiles`) ficam separados: o Better Auth só enxerga a primeira.

## Roles de banco

| Role | Uso | Acesso |
|---|---|---|
| dona do schema (ex.: `neondb_owner`) | migrations, seed, provisionamento (CLI) | total |
| `luumu_app` | runtime da aplicação | dados de negócio, **sempre** filtrados por `app.current_tenant_id()`; grants por coluna |
| `luumu_auth` | runtime do Better Auth | só tabelas de autenticação + leitura de `users` |
| `luumu_app_login` (NOINHERIT) | login de produção da aplicação | nenhum privilégio próprio; vira `luumu_app` via `SET LOCAL ROLE` dentro de `withTenant()` |
| `luumu_auth_login` | login de produção do Better Auth | herda `luumu_auth` |

Imutáveis para o runtime: `id`, `tenant_id`, `created_at`, `user_id`. Sem `DELETE` em histórico (`employment_assignments`, `manager_relationships`, `user_roles`) e em `audit_logs`, que ainda tem um trigger que rejeita `UPDATE`/`DELETE`/`TRUNCATE`, inclusive para o dono do schema.

## Migrations

```bash
# 1. altere o schema em src/server/db/schema
pnpm db:generate            # gera db/migrations/NNNN_*.sql
# 2. tabela nova? crie uma migration de segurança com RLS + policy + grants:
pnpm drizzle-kit generate --custom --name <nome>_security
# 3. teste: o schema-security.test.ts falha se faltar RLS/policy
pnpm test
```

Toda tabela nova **precisa** de RLS habilitada, policy de isolamento (se tiver `tenant_id`) e grants explícitos. Sem isso a role de runtime não tem acesso algum (fail closed) e os testes de introspecção falham.

- Em desenvolvimento, o PGlite aplica as migrations ao iniciar.
- No Neon, use `pnpm db:migrate` ou o workflow **Migrations (Neon)** no GitHub Actions.
- Nunca altere o banco manualmente. Migrations de uma release precisam ser **retrocompatíveis com a versão anterior do código** (só adicionar); remoções acontecem na release seguinte.

## Seed

`src/server/db/seed/data.ts` é a única fonte de dados demonstrativos: duas empresas fictícias em domínios `.example` (RFC 2606). A Aurora tem cerca de 50 pessoas e uma área de **3 pessoas**, para os testes de k-anonimato. A Horizonte existe para os testes de isolamento. O seed recusa rodar em produção. `syncCatalog()` (permissões e feature flags) roda em todo ambiente, junto com as migrations.
