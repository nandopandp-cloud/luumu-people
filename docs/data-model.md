# Modelagem de dados

Entidades e relacionamentos da Luumu People, por domínio, lidos de `src/server/db/schema/*.ts` e do schema `survey_vault` (migrations de segurança). Este documento descreve o **modelo conceitual**: o que existe, como se liga e quais invariantes valem.

Os detalhes físicos (convenções de nomes, roles de banco, RLS, grants, migrations, seed) estão em [database.md](database.md). O cofre de respostas anônimas tem contrato próprio em [anonymous-surveys.md](anonymous-surveys.md), e papéis, permissões e escopos estão em [rbac.md](rbac.md).

**Leitura dos diagramas**

- Quase toda tabela tem `tenant_id NOT NULL` e as FKs entre tabelas de empresa são **compostas** `(tenant_id, id)`. Para não poluir, `tenant_id` só aparece em `organizations`, e as FKs aparecem como a coluna de negócio (`user_id`, `course_id`…).
- `created_at`/`updated_at` existem na maioria das tabelas e foram omitidos, salvo quando têm significado de negócio.
- Só aparecem colunas-chave: PK, FKs e campos que carregam regra. O schema Drizzle é a fonte da verdade para o resto.
- `users` aparece em vários diagramas apenas como ponto de ligação. Os atributos dela estão em [Identidade](#identidade-e-autenticação).

## Mapa de domínios

```mermaid
flowchart LR
  subgraph core["Banco principal — RLS por tenant"]
    T["Tenant<br/>organizations"]
    I["Identidade<br/>users, sessions, accounts"]
    E["Estrutura organizacional<br/>org_units, positions, job_levels"]
    C["Colaborador<br/>employee_profiles, lotação, gestor"]
    A["Acesso<br/>roles, user_roles"]
    P["Plataforma<br/>audit_logs, feature_flags, files, usage_days"]
    COM["Comunicação<br/>announcements, events, banners"]
    L["Aprendizagem<br/>courses, learning_paths, enrollments"]
    D["Desenvolvimento<br/>competencies, pdis"]
    S["Social<br/>friendships, conversations"]
    W["Bem-estar<br/>mood_checkins"]
    N["Notificações<br/>notifications, reads"]
    SV["Pesquisas core<br/>surveys, questions, invitations"]
  end

  subgraph vault["survey_vault — sem identidade, sem timestamp, sem FK"]
    V["Cofre anônimo<br/>anon_response, anon_answer"]
  end

  T --> I
  T --> E
  I --> C
  E --> C
  I --> A
  E --> A
  I --> P
  E --> COM
  I --> COM
  P --> COM
  I --> L
  P --> L
  C --> D
  L -.->|sugestões| D
  I --> S
  I --> W
  COM --> N
  S -.->|calculadas| N
  SV -.->|calculadas| N
  E --> SV
  I --> SV
  SV ==>|"só via funções SECURITY DEFINER<br/>survey_id opaco, nenhuma pessoa"| V
```

O cofre não referencia `users`, `survey_invitations` nem nada que identifique uma pessoa. A única ponte é o `survey_id` (e o `question_id`) gravados como `uuid` solto, sem FK, e só as funções `survey_vault.*` atravessam essa fronteira.

## Tenant

```mermaid
erDiagram
  organizations {
    uuid id PK
    text slug UK "kebab-case"
    text name
    text status "active | suspended"
    int anonymity_k "5, 7 ou 10"
    jsonb settings "configuração livre"
  }
```

- Toda informação de uma empresa pertence a exatamente uma `organization`.
- `anonymity_k ∈ {5, 7, 10}` (CHECK) é o piso de k-anonimato da empresa: nenhuma pesquisa é lançada com k menor.
- `settings` é o único JSON de configuração do tenant (ranking de conquistas, ociosidade de sessão). Nunca guarda relacionamentos.

## Identidade e autenticação

```mermaid
erDiagram
  organizations ||--o{ users : "tem"
  users ||--o{ sessions : "abre"
  users ||--o{ accounts : "credenciais"
  users ||--o{ two_factors : "obsoleta"

  users {
    uuid id PK
    text email UK "minúsculo"
    text name
    text image "avatar"
    text profile_cover
    text status "invited | active | inactive"
    bool must_change_password
    bool two_factor_enabled "obsoleta"
  }
  sessions {
    uuid id PK
    uuid user_id FK
    text token UK
    timestamptz expires_at
  }
  accounts {
    uuid id PK
    uuid user_id FK
    text provider_id "credential | google"
    text account_id
    text password "hash Argon2id"
  }
  verifications {
    uuid id PK
    text identifier
    timestamptz expires_at
  }
  rate_limits {
    uuid id PK
    text key UK
    int count
  }
  login_throttles {
    text key PK "HMAC do e-mail"
    int failed_count
    timestamptz locked_until
  }
  two_factors {
    uuid id PK
    uuid user_id FK
  }
```

- `users` é **só identidade de login** (contrato do Better Auth). Dados de RH ficam em `employee_profiles`, que o Better Auth não enxerga.
- E-mail é único na plataforma e sempre minúsculo (CHECK).
- `must_change_password`: pessoa importada com senha provisória só usa a plataforma depois de criar a própria senha.
- `login_throttles` bloqueia por conta sem guardar o e-mail: a chave é um HMAC do e-mail normalizado. `rate_limits` é o rate limit por IP do Better Auth (serverless não compartilha memória).
- `verifications` guarda tokens de redefinição de senha e afins.

## Estrutura organizacional e colaborador

```mermaid
erDiagram
  org_units |o--o{ org_units : "parent_id"
  users ||--o| employee_profiles : "dados de RH"
  users ||--o{ employment_assignments : "lotação (histórico)"
  org_units ||--o{ employment_assignments : "área"
  business_units |o--o{ employment_assignments : "unidade"
  positions ||--o{ employment_assignments : "cargo"
  job_levels |o--o{ employment_assignments : "nível"
  users ||--o{ manager_relationships : "liderado"
  users ||--o{ manager_relationships : "gestor"
  org_tags ||--o{ user_org_tags : "marca"
  users ||--o{ user_org_tags : "recebe"

  org_units {
    uuid id PK
    uuid parent_id FK "nulo só na diretoria"
    text type "directorate | area | subarea"
    text name
    text code UK
    timestamptz archived_at
  }
  business_units {
    uuid id PK
    text name
    text code UK
    text city
    text state
  }
  positions {
    uuid id PK
    text name UK
    bool is_managerial
  }
  job_levels {
    uuid id PK
    text name UK
    int rank "ordem dos níveis"
  }
  employee_profiles {
    uuid user_id PK, FK
    text employee_code UK
    text preferred_name
    date hire_date
    text contract_type "clt | pj | intern | apprentice | temporary"
    text employment_status "active | on_leave | terminated"
    text headline
  }
  employment_assignments {
    uuid id PK
    uuid user_id FK
    uuid org_unit_id FK
    uuid business_unit_id FK
    uuid position_id FK
    uuid job_level_id FK
    date valid_from
    date valid_to "nulo = atual"
    text reason "hire | transfer | promotion | ..."
  }
  manager_relationships {
    uuid id PK
    uuid user_id FK
    uuid manager_id FK
    date valid_from
    date valid_to "nulo = atual"
  }
  org_tags {
    uuid id PK
    text name UK
  }
  user_org_tags {
    uuid user_id PK, FK
    uuid tag_id PK, FK
  }
  profile_field_policies {
    text field_key PK "preferredName | phone | headline | image"
    bool editable_by_employee
  }
```

- **Hierarquia:** diretoria → área → subárea em `org_units`. A raiz é sempre `directorate` e só ela não tem pai (CHECK); ninguém é pai de si mesmo. `business_units` (localidade/filial) é ortogonal à hierarquia.
- **Vigência, nunca sobrescrita:** lotação e gestor fecham o registro atual (`valid_to`) e abrem outro. Índice único parcial garante **uma** lotação e **um** gestor atuais por pessoa (`valid_to IS NULL`); `valid_to > valid_from`. Sem `DELETE` para o runtime.
- Ninguém é gestor de si mesmo (CHECK).
- `employee_profiles` é 1:1 com `users`; uma pessoa convidada pode ainda não ter perfil de RH.
- `profile_field_policies` define, por empresa, quais campos a própria pessoa pode editar.
- Arquivamento (`archived_at`) em vez de exclusão para áreas, unidades e cargos.

## Acesso (RBAC)

```mermaid
erDiagram
  permissions ||--o{ role_permissions : "concedida em"
  roles ||--o{ role_permissions : "agrupa"
  roles ||--o{ user_roles : "atribuído"
  users ||--o{ user_roles : "recebe"
  org_units |o--o{ user_roles : "escopo ORG_UNIT_TREE"

  permissions {
    text key PK "ex.: people.directory.read"
    text domain
    text description
  }
  roles {
    uuid id PK
    text key UK
    text name
    bool is_system
    text default_scope
  }
  role_permissions {
    uuid role_id PK, FK
    text permission_key PK, FK
  }
  user_roles {
    uuid id PK
    uuid user_id FK
    uuid role_id FK
    text scope_type "SELF | TEAM_DIRECT | TEAM_TREE | ORG_UNIT_TREE | TENANT"
    uuid scope_org_unit_id FK
    uuid granted_by FK
    timestamptz revoked_at "nulo = ativo"
    uuid revoked_by FK
  }
```

- `permissions` é **global** e espelha o catálogo em código (`src/server/authz/permissions.ts`), sincronizado por `syncCatalog()`. `roles` é por empresa; os papéis de sistema têm `is_system`.
- A atribuição carrega o **escopo**. `scope_org_unit_id` é preenchido se, e somente se, o escopo é `ORG_UNIT_TREE` (CHECK).
- Ninguém concede papel a si mesmo (`granted_by <> user_id`, CHECK).
- Revogar preenche `revoked_at`/`revoked_by`: o histórico de acesso nunca é apagado. Índice único parcial impede a mesma atribuição ativa em duplicidade.

## Plataforma

```mermaid
erDiagram
  feature_flags ||--o{ feature_flag_overrides : "sobrescrita"
  roles |o--o{ feature_flag_overrides : "alvo papel"
  users |o--o{ feature_flag_overrides : "alvo pessoa"
  users |o--o{ audit_logs : "ator"
  users ||--o{ files : "envia"
  users ||--o{ usage_days : "uso diário"

  audit_logs {
    uuid id PK
    uuid actor_user_id FK
    text actor_type "user | system"
    text action
    text resource_type
    text resource_id
    jsonb metadata
    text request_id
  }
  feature_flags {
    text key PK "ex.: module_learning"
    bool default_enabled
  }
  feature_flag_overrides {
    uuid id PK
    text flag_key FK
    uuid tenant_id FK "nulo = global"
    uuid role_id FK
    uuid user_id FK
    bool enabled
  }
  files {
    uuid id PK
    uuid owner_user_id FK
    text purpose "avatar | course_cover | chat_attachment | ..."
    text storage_key UK "gerada no servidor"
    text mime_type "png | jpeg | webp | pdf"
    int size_bytes
    text sha256
    timestamptz deleted_at
  }
  usage_days {
    uuid user_id PK, FK
    date day PK "fuso de Brasília"
    int visits
    int active_seconds
  }
```

- `audit_logs` é **append-only**: só `INSERT`/`SELECT` para o runtime e um trigger rejeita `UPDATE`/`DELETE`/`TRUNCATE`. Nunca registra nada que associe pessoa a resposta anônima.
- Feature flags: precedência pessoa > papel > empresa > global > padrão. Cada sobrescrita tem no máximo um alvo (papel **ou** pessoa) e alvo exige empresa (CHECKs); índice único por combinação.
- `files` é o registro de todo upload. O conteúdo fica em storage **privado**; o acesso é sempre por `/api/v1/files/:id`. `purpose` diz quem pode referenciar o arquivo (capa de curso, anexo de conversa…). MIME restrito por CHECK.
- `usage_days`: uma linha por pessoa e dia, alimentada pelo sinal de presença. Cada pessoa grava só a própria linha; os painéis leem apenas agregados.
- Fora do diagrama: o schema interno `app` guarda funções de apoio (`current_tenant_id`, `current_user_id`, `chat_*`) e o rate limit da API (`rate_limit_buckets`), sem acesso direto pelo runtime.

## Comunicação

```mermaid
erDiagram
  announcements ||--o{ announcement_reactions : "reações"
  announcements ||--o{ announcement_comments : "comentários"
  announcement_comments |o--o{ announcement_comments : "resposta (parent_id)"
  announcement_comments ||--o{ comment_reactions : "curtidas"
  announcements ||--o{ announcement_attachments : "anexos"
  org_units |o--o{ announcements : "público"
  files |o--o{ announcements : "capa"
  files |o--o{ announcement_attachments : "arquivo"
  files |o--o{ home_banners : "imagem"
  users ||--o{ announcement_comments : "autor"
  users ||--o{ announcement_reactions : "reage"

  announcements {
    uuid id PK
    text title
    text category "institucional | evento | cultura | ..."
    text status "draft | in_review | approved | published | archived"
    bool pinned
    uuid cover_file_id FK
    uuid audience_org_unit_id FK "nulo = empresa toda"
    timestamptz published_at "futuro = agendado"
  }
  announcement_reactions {
    uuid announcement_id PK, FK
    uuid user_id PK, FK
    text kind "love | cheer | sad"
  }
  announcement_comments {
    uuid id PK
    uuid announcement_id FK
    uuid author_id FK
    uuid parent_id FK "um nível só"
    text body "menções @[Nome](user:id)"
    timestamptz deleted_at
    uuid deleted_by FK
  }
  comment_reactions {
    uuid comment_id PK, FK
    uuid user_id PK, FK
  }
  announcement_attachments {
    uuid id PK
    uuid announcement_id FK
    text kind "file | video"
    uuid file_id FK
    text video_url "YouTube ou Vimeo"
    int position
  }
  events {
    uuid id PK
    text kind "evento | treinamento | workshop | ..."
    text mode "online | presencial | hibrido"
    timestamptz starts_at
    timestamptz ends_at
    bool published
  }
  quick_links {
    uuid id PK
    text label
    text url "caminho interno ou https"
    int position
    bool active
  }
  home_banners {
    uuid id PK
    text layout "composed | image"
    text title
    uuid image_file_id FK
    bool active
    timestamptz starts_at
    timestamptz ends_at
    int position "ordem no carrossel"
  }
```

- **Público:** `audience_org_unit_id` nulo = empresa toda; com área, só quem tem lotação atual nela ou em subárea vê o comunicado e interage com ele (regra em `modules/announcements/audience.ts`).
- **Publicado** exige `published_at` (CHECK). Agendar = `published` com data futura; o mural só mostra `published_at <= now()`.
- Uma reação por pessoa e comunicado (PK composta); trocar de reação atualiza `kind`.
- Comentário removido = `deleted_at` + `deleted_by` (sempre juntos, CHECK), nunca apagado. Respostas têm um nível só.
- Curtir, reagir e comentar só em nome próprio, garantido também por policies `RESTRICTIVE`.
- Anexo é arquivo **ou** vídeo, nunca os dois (CHECK). URLs externas são sempre `https://`; links internos começam com `/`.
- Banner `image` exige imagem e não tem botão; banner `composed` tem botão completo (rótulo + URL) ou nenhum (CHECKs). Vários ativos viram carrossel.

## Aprendizagem

```mermaid
erDiagram
  courses ||--o{ course_modules : "módulos"
  course_modules ||--o{ lessons : "aulas"
  courses ||--o{ lessons : "aulas"
  learning_paths ||--o{ learning_path_courses : "contém"
  courses ||--o{ learning_path_courses : "faz parte"
  users ||--o{ enrollments : "matrícula"
  courses ||--o{ enrollments : "matrícula"
  users ||--o{ lesson_progress : "conclui"
  lessons ||--o{ lesson_progress : "concluída"
  users ||--o{ certificates : "recebe"
  courses ||--o{ certificates : "emite"
  files |o--o{ courses : "capa"
  files |o--o{ lessons : "PDF"
  achievements ||--o{ user_achievements : "conquistada"
  users ||--o{ user_achievements : "conquista"

  courses {
    uuid id PK
    text title
    text kind "course | video | quiz"
    text category
    int duration_minutes
    bool mandatory
    text status "draft ... published | archived"
    uuid cover_file_id FK
  }
  course_modules {
    uuid id PK
    uuid course_id FK
    int position UK
  }
  lessons {
    uuid id PK
    uuid course_id FK
    uuid module_id FK
    text type "article | video | pdf | link"
    int position UK
    uuid file_id FK
  }
  learning_paths {
    uuid id PK
    text title
    bool featured
    int display_order
    text status
  }
  learning_path_courses {
    uuid path_id PK, FK
    uuid course_id PK, FK
    int position UK
  }
  enrollments {
    uuid id PK
    uuid user_id FK
    uuid course_id FK
    text status "not_started | in_progress | completed"
    smallint progress_pct "0 a 100"
    text source "assigned | self | recommended"
    date due_date
  }
  lesson_progress {
    uuid user_id PK, FK
    uuid lesson_id PK, FK
    timestamptz completed_at
  }
  certificates {
    uuid id PK
    uuid user_id FK
    uuid course_id FK
    text code UK "verificação pública"
  }
  library_items {
    uuid id PK
    text type "video | article | podcast | pdf | ..."
    bool featured
    text status
  }
  achievements {
    uuid id PK
    text key UK
    text name
    text theme
  }
  user_achievements {
    uuid user_id PK, FK
    uuid achievement_id PK, FK
    timestamptz earned_at
  }
```

- Conteúdo segue o ciclo editorial `draft → in_review → approved → published → archived`. Sem capa enviada, a capa é `theme` + `illustration` do design system.
- Ordem explícita e única por `position` (módulos e aulas no curso, cursos na trilha).
- Conteúdo da aula conforme o tipo (CHECK): `article` → `body`; `video` → `video_url`; `pdf` → `file_id`; `link` → `external_url` `https://`.
- Uma matrícula e um certificado por pessoa e curso. `status` e `progress_pct` são coerentes por CHECK (`completed` ⇔ 100; `not_started` ⇒ 0).
- `lesson_progress` é a fonte do progresso (ver [derivados](#o-que-é-derivado-não-gravado)).
- Cursos, trilhas e biblioteca ficam atrás das feature flags `module_learning` e `module_library`.

## Desenvolvimento

```mermaid
erDiagram
  positions ||--o{ position_competencies : "espera"
  competencies ||--o{ position_competencies : "esperada"
  competencies ||--o{ competency_assessments : "avaliada"
  users ||--o{ competency_assessments : "avaliada"
  users ||--o{ pdis : "dona"
  users |o--o{ pdis : "mentora"
  pdis ||--o{ pdi_goals : "objetivos"
  competencies |o--o{ pdi_goals : "foco"
  pdi_goals ||--o{ pdi_actions : "ações"
  pdis ||--o{ pdi_actions : "ações"
  users ||--o{ pdi_actions : "responsável"

  competencies {
    uuid id PK
    text name UK
    text category "comportamental | tecnica | lideranca"
    text icon
    timestamptz archived_at
  }
  position_competencies {
    uuid position_id PK, FK
    uuid competency_id PK, FK
    smallint expected_score "0 a 100"
  }
  competency_assessments {
    uuid id PK
    uuid user_id FK
    uuid competency_id FK
    smallint score "0 a 100"
    text source "self | manager | people"
    uuid assessed_by FK
    timestamptz assessed_at
  }
  pdis {
    uuid id PK
    uuid user_id FK
    text status "active | closed"
    date period_start
    date period_end
    uuid mentor_user_id FK
    text mentor_note "até 280"
  }
  pdi_goals {
    uuid id PK
    uuid pdi_id FK
    uuid competency_id FK
    date target_date
    text_array tags "até 5"
    text status "active | achieved | cancelled"
  }
  pdi_actions {
    uuid id PK
    uuid pdi_id FK
    uuid goal_id FK
    text type "curso | mentoria | projeto | ..."
    uuid owner_user_id FK
    date due_date
    text status "not_started | in_progress | done | cancelled"
    text evidence_url "https"
    timestamptz completed_at
  }
```

- **Nível esperado** por cargo e competência (`position_competencies`, 0–100) é a referência contra a qual as avaliações são comparadas.
- `competency_assessments` é **append-only** (runtime só tem `SELECT`/`INSERT`): o histórico alimenta a evolução e nunca é editado.
- No máximo **um PDI ativo** por pessoa (índice único parcial). A mentoria nunca é a própria pessoa (CHECK). `period_end >= period_start`.
- Ação concluída ⇔ `completed_at` preenchido (CHECK); evidência só por link `https://`.

## Social: amigos e conversas

```mermaid
erDiagram
  users ||--o{ friendships : "pede"
  users ||--o{ friendships : "recebe"
  conversations ||--o{ conversation_members : "participantes"
  users ||--o{ conversation_members : "participa"
  conversations ||--o{ chat_messages : "mensagens"
  users ||--o{ chat_messages : "envia"
  files |o--o{ chat_messages : "anexo"
  chat_messages ||--o{ chat_message_likes : "curtidas"
  users ||--o| user_presence : "último sinal"
  users ||--o{ user_interests : "interesses"
  users ||--o{ connection_suggestion_dismissals : "dispensa"

  friendships {
    uuid id PK
    uuid requester_id FK
    uuid addressee_id FK
    text status "pending | accepted"
    timestamptz responded_at
  }
  conversations {
    uuid id PK
    text kind "direct | group"
    text title "só grupo, até 60"
    text direct_key UK "menor id:maior id"
    uuid created_by FK
  }
  conversation_members {
    uuid conversation_id PK, FK
    uuid user_id PK, FK
    text role "admin | member"
    timestamptz joined_at
    timestamptz left_at
    timestamptz last_read_at
    timestamptz typing_at
  }
  chat_messages {
    uuid id PK
    uuid conversation_id FK
    uuid sender_id FK
    text body "até 4000"
    uuid file_id FK
    timestamptz deleted_at
    timestamptz edited_at
    timestamptz updated_at
  }
  chat_message_likes {
    uuid message_id PK, FK
    uuid user_id PK, FK
  }
  user_presence {
    uuid user_id PK, FK
    timestamptz last_seen_at
  }
  user_interests {
    uuid user_id PK, FK
    text interest_key PK "catálogo em src/lib/interests.ts"
  }
  connection_suggestion_dismissals {
    uuid user_id PK, FK
    uuid dismissed_user_id PK, FK
  }
```

- **Um vínculo por par** de pessoas, independentemente de quem pediu (índice único em `least/greatest`). `accepted` ⇔ `responded_at` (CHECK). Recusar, cancelar e desfazer apagam a linha.
- Conversa `direct` tem `direct_key` único e não tem nome; `group` tem nome e não tem chave (CHECK). Uma conversa privada por par.
- Quem entra num grupo só lê mensagens a partir de `joined_at`; `left_at` corta o acesso. Nem gestão nem administração leem conversas.
- Mensagem tem texto ou anexo; apagada fica com texto vazio e sem anexo (CHECK). Edição só do texto, com `edited_at` posto pelo banco. Sem `DELETE` para o runtime em conversas, participantes e mensagens.
- Pedidos pendentes são vistos só pelas duas pessoas; amizades aceitas, interesses e presença são visíveis na empresa. Sugestões dispensadas são estritamente pessoais.

## Bem-estar

```mermaid
erDiagram
  users ||--o{ mood_checkins : "sentimento do dia"
  users ||--o{ mood_prompt_dismissals : "agora não"

  mood_checkins {
    uuid id PK
    uuid user_id FK
    date checkin_date UK "um por pessoa e dia"
    smallint mood "1 muito mal a 6 muito bem"
    text note "1 a 300"
  }
  mood_prompt_dismissals {
    uuid user_id PK, FK
    date prompt_date PK
  }
```

- O check-in de humor é **identificado** e, por decisão de produto, visível para a empresa no dia (o modal avisa). Gravar e alterar, só a própria linha (policy `RESTRICTIVE`).
- `mood_prompt_dismissals` evita reabrir o modal no mesmo dia e é estritamente pessoal.

## Notificações

```mermaid
erDiagram
  users ||--o{ notifications : "recebe"
  users ||--o{ notifications : "provoca"
  announcements ||--o{ notifications : "contexto"
  announcement_comments ||--o{ notifications : "comentário"
  users ||--o{ notification_reads : "leu"
  users ||--o| notification_preferences : "silencia"

  notifications {
    uuid id PK
    uuid recipient_id FK
    uuid actor_id FK
    text type "mention | comment_reply | comment_like"
    uuid announcement_id FK
    uuid comment_id FK
    timestamptz read_at
  }
  notification_reads {
    uuid user_id PK, FK
    text key PK "announcement:id, survey:id, ..."
    timestamptz read_at
  }
  notification_preferences {
    uuid user_id PK, FK
    text_array muted "surveys | reminders | announcements | ..."
  }
```

- **Gravadas** (`notifications`): interações entre pessoas, uma linha por destinatário. Nunca para si mesmo (CHECK) e idempotentes (único por destinatário, tipo, comentário e ator).
- **Calculadas** na leitura (novo comunicado, nova pesquisa, lembrete, pedido de amizade e amizade aceita): vêm das tabelas de origem e só a leitura é gravada, em `notification_reads`, pela chave `<tipo>:<uuid>`.
- Nenhuma notificação envolve resposta de pesquisa: as de pesquisa usam só o convite da própria pessoa.

## Pesquisas (core)

```mermaid
erDiagram
  surveys ||--o{ survey_questions : "perguntas"
  surveys ||--o{ survey_invitations : "convites"
  users ||--o{ survey_invitations : "convidada"
  org_units |o--o{ surveys : "público"

  surveys {
    uuid id PK
    text kind "climate | enps | pulse | custom"
    text anonymity_mode "anonymous | identified"
    text status "draft | active | paused | closed"
    int anonymity_k "5, 7 ou 10"
    jsonb dimensions "valores aprovados no lançamento"
    uuid audience_org_unit_id FK "nulo = empresa toda"
    timestamptz launched_at "futuro = agendada"
    timestamptz closes_at
    timestamptz closed_at
  }
  survey_questions {
    uuid id PK
    uuid survey_id FK
    int position UK
    text type "scale | enps | choice | text"
    jsonb options "só choice"
    bool required
  }
  survey_invitations {
    uuid id PK
    uuid survey_id FK
    uuid user_id FK
    text status "pending | completed"
    date completed_on "só a data"
  }
```

- A pesquisa é a própria campanha (uma aplicação por pesquisa).
- **Ciclo** (trigger): `draft → active ⇄ paused → closed` (e `active → closed`). Pausada não recebe respostas. Lançada exige `launched_at` e `closes_at`; encerrada exige `closed_at` (CHECKs).
- **Congela no lançamento** (trigger): `anonymity_mode`, perguntas, `dimensions` e público. O k nunca é menor que o da empresa e, depois de lançado, só sobe.
- Só rascunho é excluído pelo runtime; pesquisa lançada só sai por `survey_vault.purge`, que leva junto as respostas do cofre.
- `survey_invitations` registra **participação**, nunca resposta: só `status` e a **data** de conclusão, sem timestamps, para não permitir correlação com o cofre.

## Cofre anônimo (`survey_vault`)

```mermaid
erDiagram
  anon_response ||--o{ anon_answer : "respostas"
  anon_response ||--o{ anon_response_dimension : "segmentos"

  anon_submission_buffer {
    uuid id PK
    uuid survey_id "sem FK"
    jsonb dimensions
    jsonb answers
  }
  anon_response {
    uuid id PK "UUIDv4 aleatório"
    uuid survey_id "sem FK"
  }
  anon_answer {
    uuid response_id PK, FK
    uuid question_id PK "sem FK"
    smallint value_num
    text value_text "até 2000"
  }
  anon_response_dimension {
    uuid response_id PK, FK
    text dimension PK "diretoria | area | tempo_de_casa"
    text value "já generalizado"
  }
```

- Sem identidade, sem timestamp e sem FK para o core. As dimensões chegam **já generalizadas**; valores com menos de k convidados viram "Outros".
- Envio entra no `anon_submission_buffer` e é movido em lote, em ordem aleatória, para as tabelas finais (`_flush`), para que a ordem de gravação não revele quem respondeu.
- Cada resposta tem exatamente um valor: numérico **ou** texto (CHECK).
- Nenhuma role de runtime tem grant nas tabelas. O acesso é só por `EXECUTE` em `submit`, `close`, `results`, `breakdown` e `purge` (`SECURITY DEFINER`), e a leitura devolve agregados suprimidos abaixo de k. Detalhes e ameaças em [anonymous-surveys.md](anonymous-surveys.md).

## O que é derivado, não gravado

| Informação | Como é obtida |
|---|---|
| Ação de PDI "atrasada" | prazo vencido (`due_date < hoje`, fuso de Brasília) e status `not_started`/`in_progress` |
| Evolução do PDI, variação das competências | lidas do histórico de `competency_assessments` e das ações |
| Conquistas de desenvolvimento | cada nível de proficiência inédito numa competência, calculado sobre as avaliações |
| Sugestões de conteúdo no desenvolvimento | cursos e trilhas publicados cuja categoria ou título cita uma competência ainda abaixo do esperado, excluindo o que a pessoa já concluiu |
| Progresso da matrícula | calculado de `lesson_progress` a cada aula concluída e materializado em `enrollments.progress_pct`/`status`; ao chegar a 100% é emitido o certificado |
| Notificações de comunicado, pesquisa, lembrete e amizade | calculadas na leitura a partir das tabelas de origem; só a leitura é gravada |
| Lotação e gestor "atuais" | o registro com `valid_to` nulo |
| Público de comunicado e pesquisa | lotação atual na área ou em subárea dela |
| "Online agora" | `user_presence.last_seen_at` recente |
| Resultados de pesquisa | agregados calculados pelo cofre na hora, com supressão abaixo de k |

## Dívidas de modelo

Remoções seguem expand/contract: a coluna ou tabela sai numa migration da **release seguinte**, depois que a versão que deixou de usá-la estiver no ar.

| Item | Situação |
|---|---|
| `two_factors` | 2FA descartado do produto. Sem uso no código |
| `users.two_factor_enabled` | idem |
| `user_follows` | "Seguir" virou o próprio pedido de conexão (out/2026). Sem uso no código |
| `notification_reads.key` aceita o prefixo `follow:` | resto do "seguir"; sai junto com `user_follows` |
| `user_org_tags` | modelada e semeada (`org_tags`), mas ainda sem leitura ou escrita na aplicação |
