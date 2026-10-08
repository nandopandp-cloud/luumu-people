# RFC 0001 — Arquitetura da Luumu People

| | |
|---|---|
| **Status** | Aprovada com alterações em 2026-10-07 — ver [§15](#15-decisões-aprovadas-e-alterações-2026-10-07). Fase 1 entregue. |
| **Data** | 2026-10-07 |
| **Escopo** | Stack, arquitetura, multi-tenancy, autenticação, RBAC, modelo de dados, anonimato de pesquisas, design system, testes e roadmap |

Prioridades que guiam toda decisão abaixo, em ordem: **segurança → privacidade → anonimato → integridade → autorização → arquitetura → UX → performance → escalabilidade → estética.**

---

## 1. Auditoria do repositório

| Item | Encontrado |
|---|---|
| Código | Nenhum. Apenas `README.md` (2 linhas) |
| Histórico | 1 commit (`Initial commit`) |
| Remote | `github.com/nandopandp-cloud/luumu-people` |
| Stack existente | Nenhuma: não há nada a preservar nem a migrar |
| Ambiente local | Node 22.23, pnpm 11.25, npm 10.9. **Sem Docker, sem Postgres** |
| Assets de marca | Só em imagens de referência (mockups e styleguide). Sem SVG/PNG no repo |

**O que pode ser reaproveitado:** a direção visual dos mockups e do styleguide (paleta, tipografia Inter, componentes, mascote, linguagem). Nenhum código.

### Riscos identificados

1. **Anonimato é o requisito mais difícil e o mais fácil de quebrar por acidente.** Timestamps, ordem de inserção, IDs sequenciais, IDs de transação do Postgres, logs, APM e filtros combinados podem reidentificar quem respondeu. Por isso o anonimato fica na arquitetura (seção 9), e não em convenção de código.
2. **Dados sensíveis segundo a LGPD.** Clima, fatores psicossociais (NR-1) e o check-in "Como você está se sentindo hoje?" podem conter dados de saúde, que são dados pessoais sensíveis (art. 11). Exigem base legal, minimização e preferencialmente residência no Brasil.
3. **Escopo muito amplo.** São mais de 15 módulos. Sem fases rígidas, o risco é ter muitas telas bonitas sem backend, autorização ou testes. A Definition of Done (seção 13) é o freio.
4. **Ambiente local sem Docker.** Testes de integração com Postgres real (RLS, roles, grants) são obrigatórios para provar isolamento e anonimato. Isso pede Docker/OrbStack ou um Postgres local.
5. **Inconsistência nos mockups de marca.** Vários mockups mostram uma folha perto do "L". O briefing proíbe isso. A referência correta é a logo final (folha apenas sobre o "u" final).
6. **O mockup do dashboard admin mostra "Distribuição por produto"** (Exploradores, Educadores, GenieX…). São produtos de outro contexto. Seguiremos o briefing: **"Distribuição por perfil"**.

---

## 2. Decisões de stack

| Camada | Escolha | Por quê | Alternativa considerada |
|---|---|---|---|
| Linguagem | **TypeScript** (strict) ponta a ponta | Tipos e schemas compartilhados entre web, API e banco | — |
| Monorepo | **pnpm workspaces + Turborepo** | pnpm já instalado; builds incrementais; fronteiras claras entre pacotes | Nx (mais pesado) |
| Web | **Next.js (App Router) + React 19** | SSR/RSC, code splitting por rota, layouts separados para colaborador e gestão | Remix/React Router |
| API | **NestJS (adapter Fastify)** | Módulos, guards e interceptors encaixam bem em RBAC, tenant context e auditoria; serviço separado do front | Next route handlers (mistura UI e domínio e dificulta isolar o cofre de respostas) |
| Validação / contratos | **Zod** em `packages/contracts` → OpenAPI → client tipado | Uma única fonte de verdade para input da API e formulários do front | class-validator |
| Banco | **PostgreSQL 17** | RLS, roles, grants, `SECURITY DEFINER`, CTEs recursivas para hierarquia | — |
| ORM / migrations | **Drizzle ORM + drizzle-kit** (migrations SQL versionadas) | SQL explícito; controle total de transação para `SET LOCAL` de tenant (RLS); migrations legíveis e revisáveis | Prisma (RLS e roles de banco ficam desajeitados) |
| Auth | **Better Auth** (sessões em DB, 2FA, OIDC/SSO) sobre Drizzle | Biblioteca TS madura; evita escrever primitivas de auth na mão; suporta Google Workspace e Entra ID via OIDC | Auth própria com argon2 + oslo (mais controle, mais risco) |
| Jobs | **pg-boss** (fila no Postgres) | Sem Redis na Fase 1; transacional com o banco | BullMQ + Redis |
| Storage | **S3-compatível** (MinIO local, S3 ou R2 em produção), bucket privado + URLs assinadas | Requisito de arquivos privados | — |
| UI primitives | **Radix UI** + componentes próprios em `packages/ui` | Acessibilidade (foco, ARIA, teclado) pronta; visual 100% nosso | shadcn/ui (pode servir como ponto de partida copiado) |
| Estilo | **Tailwind CSS v4** com tokens em CSS variables | Tokens centralizados; nenhum valor visual solto | CSS Modules |
| Ícones | **Lucide** | É a base indicada no styleguide | — |
| Gráficos | **Recharts** (com wrapper `Chart` do DS) | Suficiente para linhas, barras, donut e heatmap simples | visx |
| Tabelas | **TanStack Table** | DataTable acessível, paginação e ordenação no servidor | — |
| Forms | **react-hook-form + Zod** | Mesmo schema do backend | — |
| i18n | **next-intl**, pt-BR padrão | Copy centralizada; preparado para outros idiomas | — |
| Logs | **pino** com redaction + **OpenTelemetry** | Redaction declarativa; trilhas sem payload | — |
| Testes | **Vitest** (unit/integração), **Playwright + axe** (e2e + a11y) | — | Jest |

**Convenção:** código, tabelas e rotas em inglês. Copy da interface em pt-BR via i18n.

---

## 3. Visão geral da arquitetura

```
                       ┌─────────────────────────────────────────────┐
  Navegador ──HTTPS──▶ │ apps/web (Next.js)                          │
                       │  /(colaborador)/…   /gestao/…               │
                       │  RSC chamam a API no servidor; o browser    │
                       │  chama /api/* (rewrite same-origin)         │
                       └───────────────┬─────────────────────────────┘
                                       │ cookie de sessão encaminhado
                       ┌───────────────▼─────────────────────────────┐
                       │ apps/api (NestJS)                           │
                       │  AuthGuard → TenantContext → PermissionGuard│
                       │  ├─ módulos de domínio (learning, people…)  │
                       │  └─ survey-vault (conexão e role próprias)  │
                       └──────┬───────────────────────────┬──────────┘
            role luumu_app    │                           │  role luumu_vault_writer
            (RLS por tenant)  │                           │  role luumu_vault_reader (só EXECUTE)
                       ┌──────▼──────────┐       ┌────────▼─────────────┐
                       │ schema core     │       │ schema survey_vault  │
                       │ (tudo, exceto   │  ✗    │ respostas anônimas   │
                       │  respostas      │◀─────▶│ SEM FK, SEM identi-  │
                       │  anônimas)      │ sem   │ dade, SEM timestamp  │
                       └─────────────────┘ link  └──────────────────────┘
                       apps/worker (pg-boss): notificações, exportações,
                       flush embaralhado do cofre, análise de comentários (IA)
```

### Estrutura do monorepo

```
apps/
  web/                    Next.js
    app/(auth)/           login, SSO, recuperação, MFA
    app/(colaborador)/    inicio, cursos, trilhas, desenvolvimento, pesquisas,
                          comunicados, biblioteca, perfil, conquistas
    app/gestao/           dashboard, usuarios, conteudos/*, engajamento, pesquisas,
                          desenvolvimento, relatorios, comunicacao, personalizacao,
                          configuracoes, auditoria
    features/<dominio>/   components, hooks, queries, schemas por domínio
  api/
    src/core/             auth, tenant-context, authz, audit, errors, rate-limit, logging
    src/modules/          organization, people, access, learning, library,
                          announcements, development, achievements, surveys,
                          survey-vault, notifications, files, feature-flags, reports, ai
  worker/
packages/
  ui/                     design system (tokens, componentes, ilustrações)
  contracts/              schemas Zod + tipos de DTO + OpenAPI
  db/                     schema Drizzle, migrations SQL, seed, roles/grants/RLS
  authz/                  catálogo de permissões + motor de políticas (puro, 100% testado)
  config/                 tsconfig, eslint, prettier
docs/                     README, architecture, database, security, rbac,
                          anonymous-surveys, api, environment, deployment,
                          testing, design-system, rfc/
```

Cada módulo da API segue `controller → service → repository`. Controllers não acessam o banco. Repositories nunca recebem `tenant_id` do request: recebem o contexto de tenant da sessão.

---

## 4. Multi-tenancy

Defesa em três camadas, cada uma suficiente por si só para bloquear acesso entre tenants:

1. **API:** `tenant_id` vem **somente da sessão**. Qualquer `tenant_id`/`tenantId` em body, query ou header é removido por um pipe global antes da validação (TESTE 8).
2. **Repositories:** todo acesso passa por `withTenant(ctx, tx => …)`, que abre a transação e executa `SET LOCAL app.tenant_id = $1`.
3. **Banco (RLS):** toda tabela com dados de tenant tem `tenant_id NOT NULL` e uma policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`, com `FORCE ROW LEVEL SECURITY`. A role da aplicação **não** é dona das tabelas e não tem `BYPASSRLS`.

Integridade: FKs compostas `(tenant_id, id)` impedem que uma linha do tenant A referencie uma linha do tenant B, mesmo por bug. Um teste de introspecção do schema falha o CI se alguma tabela de domínio não tiver `tenant_id`, RLS habilitada ou policy.

Super Admin opera em um plano separado (`platform_*`), com conexão própria. Não "entra" em tenants pela mesma via dos usuários.

---

## 5. Autenticação

- **Senha:** argon2id. Política de força e checagem contra senhas vazadas (k-anonymity HIBP, opcional por tenant).
- **Sessão:** token opaco aleatório, armazenado **hasheado** no banco. Cookie `__Host-` com `HttpOnly; Secure; SameSite=Lax; Path=/`. Expiração ociosa (ex.: 30 min, configurável) e absoluta (ex.: 12 h). Rotação do token no login e na elevação de privilégio. Revogação imediata ao desativar o usuário ou mudar o papel.
- **CSRF:** SameSite=Lax + checagem de `Origin`/`Sec-Fetch-Site` em toda mutação + token CSRF de duplo envio em formulários.
- **Brute force:** rate limit por IP e por conta, com backoff progressivo e bloqueio temporário. Mensagens de erro genéricas (sem enumeração de e-mail).
- **Recuperação de senha:** token de uso único, hasheado, expira em 30 min e invalida as sessões existentes.
- **MFA:** TOTP na Fase 1, WebAuthn/passkeys depois. Obrigatório para Admin e G&G (configurável) e sempre para Super Admin.
- **SSO:** OIDC para Google Workspace e Microsoft Entra ID por tenant, com provisionamento JIT opcional e SCIM futuro. SAML quando houver demanda.

---

## 6. Autorização: RBAC com escopo

### Modelo

```
permission  (catálogo em código: packages/authz; espelhado no banco para FK)
role        (tenant_id, key, name, is_system)        → papéis de sistema + customizados
role_permission (role_id, permission_key)
user_role   (tenant_id, user_id, role_id, scope_type, scope_ref_id, granted_by, granted_at)
             scope_type ∈ SELF | TEAM_DIRECT | TEAM_TREE | ORG_UNIT_TREE | TENANT
```

A checagem é sempre `can(actor, permission, resource)` **no backend**: (1) o ator tem a permissão em algum papel? (2) o recurso está dentro do escopo daquele papel? A UI só esconde o que o backend já nega.

### Catálogo de permissões por domínio

Os domínios separam explicitamente **conteúdo** de **dados de pessoas**:

| Domínio | Exemplos |
|---|---|
| `self.*` (implícito a todo usuário ativo) | `self.profile.read`, `self.profile.update_allowed_fields`, `self.learning`, `self.surveys.respond`, `self.development.read` |
| `content.*` | `content.course.create\|edit\|review\|publish\|archive`, `content.path.*`, `content.library.manage`, `content.assessment.manage` |
| `comms.*` | `comms.announcement.create\|publish\|schedule` |
| `people.*` | `people.directory.read`, `people.profile.read_full`, `people.manage`, `people.import`, `org.structure.manage` |
| `learning.*` | `learning.progress.read` (escopo), `learning.assign` |
| `development.*` | `development.read` (escopo), `development.pdi.manage` |
| `survey.*` | `survey.design`, `survey.launch`, `survey.results.read_aggregate` (escopo), `survey.identified.read` |
| `reports.*` | `reports.read`, `reports.export` |
| `access.*` | `access.roles.manage`, `access.roles.assign` |
| `tenant.*` | `tenant.settings.manage`, `tenant.integrations.manage`, `audit.read` |
| `platform.*` (fora de tenants) | `platform.tenants.manage`, `platform.flags.manage`, `platform.logs.read`, `platform.admins.manage` |

> **Não existe permissão para ler resposta individual de pesquisa anônima.** Ela não está no catálogo, não há endpoint e não há função de banco que a ofereça. Nenhum papel, nem o Super Admin, pode recebê-la, porque a capacidade não existe.

### Papéis de sistema (seed)

| Papel | Escopo padrão | Resumo |
|---|---|---|
| Colaborador | SELF | `self.*` |
| Gestor | TEAM_TREE | `learning.progress.read`, `development.read`, `survey.results.read_aggregate` (sempre sujeito ao k-anonimato) |
| Editor | TENANT | `content.*`, `comms.*`, opcionalmente `survey.design`. **Sem `people.*`** |
| G&G / People | TENANT | `people.*`, `learning.*`, `development.*`, `survey.*`, `reports.*`, `content.*` |
| Administrador | TENANT | tudo de G&G + `access.*`, `tenant.*` |
| Super Admin | PLATFORM | `platform.*`. Não herda dados de tenants |

Um usuário pode acumular papéis. Exemplo: Fernando é Colaborador + Gestor do time de Produto.

### Prevenção de escalonamento (TESTE 7)

- Só concede um papel quem tem `access.roles.assign`, e só se possuir **todas** as permissões daquele papel em escopo igual ou maior.
- Ninguém altera os próprios papéis.
- O papel nunca vem do payload de endpoints de perfil: os schemas Zod são `strict` e rejeitam campos extras.
- Toda concessão ou revogação gera AuditLog e invalida as sessões afetadas.

Na Fase 5 entram papéis customizados. Escopos baseados em atributos (ABAC, ex.: "unidade = Rio") ficam preparados pelo `scope_type`.

---

## 7. Modelo de dados

Convenções: PK `uuid` (v4 no cofre de pesquisas; v7 no restante), `tenant_id` + RLS em tudo que é de tenant, FKs compostas, `created_at/updated_at`, `deleted_at` (soft delete) só onde faz sentido (conteúdo, usuários), `CHECK` constraints para enums e regras, índices em toda FK e nos filtros de listagem. JSON só para conteúdo realmente livre (corpo de aula em rich text, configuração de pergunta), nunca para relacionamentos.

### Domínios e entidades

**Plataforma e identidade**
`organization` (tenant, settings, `anonymity_k` ∈ {5,7,10}) · `user` · `auth_account` · `session` · `mfa_factor` · `sso_connection` · `platform_admin` · `feature_flag` · `feature_flag_override` (global/tenant/role/user) · `audit_log` · `file_object` · `notification` · `notification_preference`

**Estrutura organizacional (com histórico)**
`org_unit` (type: business_unit | directorate | area | subarea, `parent_id`) · `org_unit_closure` (ancestral/descendente, para consultas de subárvore) · `position` (cargo) · `job_level` · `employee_profile` (dados de RH 1:1 com user: admissão, contrato, status) · `employment_assignment` (**efetivo-datado**: org_unit, position, level, `valid_from`/`valid_to`) · `manager_relationship` (**efetivo-datado**) · `org_tag` + `user_org_tag` · `profile_field_policy` (quais campos o colaborador pode editar)

Transferências, mudanças de cargo e de gestor **fecham** o registro vigente e abrem um novo. Nada crítico é sobrescrito.

**Público-alvo (reutilizável)**
`audience` + `audience_rule` (org_unit, position, level, faixa de tempo de empresa, tag, "é gestor", lista) → usado por cursos, trilhas, comunicados e pesquisas. Evita quatro implementações de segmentação.

**Educação corporativa**
`course` · `course_revision` · `course_module` · `lesson` · `content_asset` (vídeo, áudio, PDF, apresentação, link externo) · `assessment` + `assessment_question` + `assessment_attempt` · `learning_path` · `learning_path_item` (ordem, obrigatório) · `learning_path_prerequisite` · `enrollment` (origem: atribuído | auto | recomendado; prazo) · `lesson_progress` · `certificate_template` · `certificate` · `attendance` (presencial)

Workflow editorial em `course`, `learning_path`, `library_item`, `announcement`: `draft → in_review → approved → published → archived`, com `*_revision` e transições validadas no backend.

**Biblioteca:** `library_category` · `library_item` · `library_favorite` · `library_view` (histórico) · `playlist` + `playlist_item`

**Comunicados:** `announcement` (tipo, `publish_at`, `expires_at`, CTA, `comments_enabled`) · `announcement_attachment` · `announcement_reaction` · `announcement_comment` · `event` · `quick_link`

**Desenvolvimento:** `competency` · `competency_level` · `position_competency` (nível esperado por cargo) · `user_competency_assessment` (histórico) · `pdi` · `pdi_goal` · `pdi_action` (status: not_started | in_progress | done | late | cancelled; responsável, prazo, progresso) · `pdi_evidence` · `mentorship`

**Conquistas:** `achievement` · `user_achievement` · `xp_ledger` (append-only; nível é derivado) · `level_definition` · `challenge` · ranking: configuração por tenant, **desligado por padrão**, opt-in e exibindo só XP

**Pesquisas: schema `core`**
`survey` (tipo, `anonymity_mode`: anonymous | identified) · `survey_version` (imutável após publicação) · `survey_question` · `survey_question_option` · `survey_question_logic` · `survey_campaign` (versão, audiência, período, `k` congelado, dimensões de segmentação aprovadas, recorrência) · `survey_invitation` (campanha, destinatário, status, `completed_on` **apenas data**) · `survey_identified_response` + `survey_identified_answer` (**somente** para pesquisas identificadas, em tabela separada)

**Pesquisas: schema `survey_vault`** (ver seção 8)
`anon_submission_buffer` · `anon_response` · `anon_answer` · `anon_response_dimension` · `spent_submission`

O detalhamento coluna a coluna (DDL) entra em `docs/database.md` junto com a primeira migration da Fase 1.

---

## 8. Arquitetura de anonimato

### Ameaças consideradas

| Vetor de reidentificação | Mitigação |
|---|---|
| `user_id`, e-mail, gestor, área ou cargo na resposta | Não existem colunas de identidade no cofre. Teste de introspecção do schema falha o CI se aparecerem |
| JOIN `invitation ↔ response` | Schemas separados, **sem FK**, sem identificador compartilhado. A role da app não tem privilégio algum em `survey_vault` |
| Correlação por **timestamp** (`completed_at ≈ submitted_at`) | A resposta **não tem timestamp**. O convite guarda só a data de conclusão |
| Correlação por **ordem de inserção** (ctid, sequência, UUIDv7, `xmin`/txid do Postgres) | Respostas entram num buffer e são gravadas na tabela final **em lotes embaralhados** (≥ k por lote ou no encerramento), em transação separada da do convite. IDs são UUIDv4 aleatórios |
| Contador ao vivo ("tinha 11, Fernando respondeu, virou 12") | Resultados só são liberados com ≥ k respostas e atualizados **apenas em lotes**, nunca a cada resposta |
| Grupos pequenos | k-anonimato: k ∈ {5, 7, 10} por tenant, **piso fixo 5 em constraint de banco**. O k da campanha congela no lançamento e só pode subir |
| Ataque de interseção ou diferença (A=6, A∧B=5 ⇒ A∖B=1) | Supressão primária **e complementar**: uma célula só aparece se ela **e** seu complemento dentro do grupo pai forem 0 ou ≥ k. Máximo de 2 dimensões combinadas. Só dimensões aprovadas no lançamento |
| Dimensão rara (único "Head" em Rio) | No lançamento, valores de dimensão com menos de k convidados são generalizados ("Outros") ou a dimensão é descartada para a campanha |
| Logs, APM, Sentry, analytics | Rota de envio sem log de request (nem path com usuário), sem captura de body, spans sem atributos; pino com redaction; páginas de pesquisa com CSP sem scripts de terceiros e sem session replay |
| IP, user-agent, fingerprint | Não são persistidos no cofre. O rate limit da rota de envio usa memória volátil, nunca armazenamento associado à resposta |
| Rascunho salvo no servidor | Pesquisa anônima não tem rascunho no servidor. Só `sessionStorage` local |
| Comentários em texto livre | Exibidos só por grupo com ≥ k, em ordem aleatória, sem data e sem atributos. Aviso na UI. A IA recebe texto com PII redigida (nomes do diretório → `[PESSOA]`) e nenhuma dimensão |
| Auditoria | O AuditLog **não registra** envio de resposta anônima nem vínculo algum. Registra só criação, alteração e lançamento da pesquisa |
| Trocar de anônima para identificada depois do lançamento | Proibido por trigger: `anonymity_mode` é imutável após o lançamento |
| Exportação | Passa pelas mesmas funções de agregação com supressão. Não existe export bruto de pesquisa anônima |

### Fluxo de envio

```
1. Colaborador autenticado abre a pesquisa → API valida o convite (pendente, no prazo, público).
2. POST /surveys/campaigns/:id/submit  (rota sem logging de payload/usuário)
   a) Tx 1 (role luumu_app, schema core):
        UPDATE survey_invitation SET status='completed', completed_on=current_date
        WHERE id=$inv AND status='pending'          -- garante resposta única
   b) Na memória do processo: deriva as dimensões generalizadas aprovadas para a campanha
        (ex.: diretoria='Tecnologia', tempo_de_casa='1-3 anos'), descarta a identidade.
   c) Tx 2 (role luumu_vault_writer, schema survey_vault):
        INSERT INTO anon_submission_buffer (campaign_id, dimensions, answers)
3. Worker (flush): quando o buffer da campanha tem ≥ k itens (ou no encerramento),
   move em ordem aleatória para anon_response/anon_answer/anon_response_dimension
   em uma única transação e apaga do buffer.
```

**Garantia oferecida:** nada **persistido**, seja banco, log, trace, auditoria ou export, liga uma pessoa a uma resposta, e nenhuma role da aplicação consegue ler respostas individuais.

**Risco residual documentado:** durante o processamento do request, o processo da API vê sessão e respostas ao mesmo tempo em memória. Um DBA com acesso físico ao servidor de banco poderia, em teoria, inspecionar o buffer antes do flush. Hardening futuro: tokens com **assinatura cega (RFC 9474)**, em que o servidor emite um token de participação que não consegue reconhecer no envio, e o cofre em instância de banco separada.

### Leitura de resultados

A role `luumu_vault_reader` tem **apenas `EXECUTE`** em funções `SECURITY DEFINER`, como `survey_vault.aggregate(campaign_id, metric, dims[], filters[], k)`. As funções:

- recalculam k a partir da campanha (o parâmetro só pode aumentar o k, nunca reduzir);
- aplicam supressão primária e complementar e o limite de dimensões;
- devolvem só agregados (contagens, médias, distribuições, eNPS, favorabilidade) ou o marcador `suppressed`.

Não há `SELECT` concedido em tabelas do cofre para nenhuma role de aplicação. Um gestor consultando o próprio time passa pelo mesmo caminho: escopo do time **e** k.

Copy na UI quando suprimido: *"Ainda não temos respostas suficientes para mostrar este resultado preservando o anonimato."*

### Pesquisas identificadas

Ficam em tabelas próprias no `core` (`survey_identified_response`), com a UI dizendo claramente *"Esta pesquisa é identificada"*. São lidas só com `survey.identified.read` e escopo. Gestor não vê respostas individuais por padrão.

### Check-in de humor ("Como você está se sentindo hoje?")

Por padrão é tratado como **pulso anônimo**, pelo mesmo cofre: o colaborador não tem histórico próprio e o G&G vê só agregados com k. É dado potencialmente de saúde (LGPD art. 11).

---

## 9. Privacidade, LGPD e observabilidade

- **Privacy by design:** minimização, menor privilégio, limitação de finalidade e anonimato por arquitetura.
- **LGPD:** registro de base legal por finalidade; direitos do titular (acesso, correção, exportação dos próprios dados) via "Meu perfil"; política de retenção configurável; preferência por hospedagem em região Brasil (ex.: `sa-east-1`).
- **AuditLog:** append-only (a role da app só tem `INSERT`), com ator, ação, recurso, diff redigido, IP e horário. Registra login/logout, CRUD, publicação, permissões, estrutura, pesquisas, exportações e configurações. Nunca registra respostas anônimas.
- **Logs:** JSON estruturado, `requestId`, redaction de `password`, `token`, `answers`, `cookie` e `authorization`. A rota de envio de pesquisa tem logger silenciado.
- **Métricas e traces:** OpenTelemetry sem atributos de payload. Erros via Sentry (ou equivalente) com `beforeSend` que remove bodies, desativado nas rotas de pesquisa.
- **Analytics de produto:** nunca nas páginas de pesquisa; eventos sem conteúdo de resposta.
- **Segurança HTTP:** CSP estrita com nonce, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Uploads:** limite por tipo, MIME validado por magic bytes (não pela extensão), nome gerado no servidor, bucket privado, URL assinada de curta duração, hook para antivírus. SVG sanitizado ou rejeitado.
- **Secrets:** só em variáveis de ambiente, com `.env.example` documentado. Nada de secret em `NEXT_PUBLIC_*`.

---

## 10. Frontend e design system

### Dois ambientes separados

- `/(colaborador)`: menu Início, Meus cursos, Trilhas, Desenvolvimento, Pesquisas, Comunicados, Biblioteca │ Meu perfil, Minhas conquistas.
- `/gestao`: menu Dashboard, Usuários, Conteúdos (Cursos, Trilhas, Biblioteca, Avaliações), Engajamento, Pesquisas, Desenvolvimento, Relatórios, Comunicação, Personalização, Configurações, Auditoria. Os itens aparecem conforme as permissões.
- O dashboard da gestão varia por papel: Editor (conteúdo), Gestor (time) e G&G/Admin (executivo).
- Um usuário com papel de gestão alterna entre os ambientes pelo menu do avatar.

### Tokens (`packages/ui/tokens`), extraídos do styleguide

```
color.purple.500  #7C3AED  (primária)     color.neutral.900 #0F172A
color.purple.700  #5B21B6  (escura)       color.neutral.700 #334155
color.purple.50   #EDE9FE  (clara)        color.neutral.500 #64748B
color.orange.500  #F59E0B                 color.neutral.300 #CBD5E1
color.green.500   #22C55E                 color.neutral.100 #F1F5F9
color.yellow.100  #FEF3C7                 color.neutral.50  #FAFAFC
color.blue.100    #DBEAFE                 semantic: success | warning | error | info
color.pink.100    #FCE7F3
font: Inter · H1 32/120% semibold · H2 24 · H3 18 · H4 16 medium · body 16/150% · small 14 · caption 12
space: 4 8 12 16 24 32 40 48 64 · radius: sm 8 · md 12 · lg 16 · xl 24 · full
shadow: sm · md · lg (suaves, tingidas de roxo)
```

**Contraste:** antes de fixar os tokens, cada combinação de texto será validada contra WCAG AA. Exemplo: laranja `#F59E0B` sobre branco não passa para texto pequeno, então ganha uma variante escura para texto.

### Componentes

Todos os listados no briefing, em `packages/ui`, sobre Radix, com estados de loading, empty, error, disabled e permission denied, foco visível, `prefers-reduced-motion` e estado nunca comunicado só por cor.

**Mobile:** a sidebar vira bottom navigation (colaborador) ou drawer (gestão), e tabelas viram listas.

### Marca

São necessários os arquivos originais (SVG da logo, mascote em suas variações: feliz, estudando, conquista, pensativo, ideia, comemoração, megafone, lupa). As ilustrações do mascote não são reproduzíveis em código. Regra registrada: **a folha fica só sobre o "u" final**.

---

## 11. API

- REST em `/api/v1`, com recursos no plural, `problem+json` (RFC 9457) para erros e paginação por cursor.
- Todo endpoint declara `@RequirePermission('…')`. O guard global **nega por padrão**: um endpoint sem declaração não sobe (teste de rota).
- DTOs de saída explícitos (sem serializar entidade inteira) seguindo o menor privilégio: o diretório devolve campos diferentes para Colaborador e G&G.
- Rate limiting global, mais rígido em auth, envio de pesquisa, exportação e upload.
- OpenAPI gerado dos schemas Zod e client tipado consumido pelo web.

---

## 12. Testes

| Camada | Ferramenta | Foco |
|---|---|---|
| `packages/authz` | Vitest | Matriz completa papel × permissão × escopo |
| Integração | Vitest + Postgres real | RLS, grants, funções do cofre, k-anonimato, migrations |
| API | Vitest + supertest | Contratos, 401/403/404, rate limit |
| E2E | Playwright + axe | Fluxos críticos e acessibilidade |

**Suíte de segurança obrigatória** (bloqueia merge):

| # | Cenário | Esperado |
|---|---|---|
| 1 | Admin ou Super Admin tenta ler resposta individual anônima (API, export, SQL com role da app) | 403 / endpoint inexistente / `permission denied` no banco |
| 2 | Gestor consulta pesquisa de time com 3 pessoas | `suppressed` |
| 3 | Gestor combina filtros até um grupo < k, ou faz ataque por diferença | `suppressed` (primária e complementar) |
| 4 | Usuário do tenant A acessa recurso do tenant B | 403/404, e RLS retorna 0 linhas mesmo com bypass da API |
| 5 | Editor acessa `people.*` ou resultados de pesquisa | 403 |
| 6 | Colaborador chama endpoint de `/gestao` | 403 |
| 7 | Usuário altera o próprio papel via API, ou concede papel acima do seu | 403 |
| 8 | Request com `tenant_id` forjado | Campo ignorado; dados do tenant da sessão |
| 9 | **Inversão:** introspecção do cofre (sem colunas de identidade, sem timestamp, sem FK para o `core`); grants (role da app sem acesso ao cofre); ordem física pós-flush não correlaciona com a ordem de conclusão | Passa |
| 10 | **Vazamento em logs:** envia resposta com string sentinela e procura nos logs, traces e audit capturados | Sentinela ausente |
| 11 | `anonymity_mode` ou `k` reduzido após o lançamento | Rejeitado pelo trigger |

Mais testes de auth (sessão, expiração, revogação, brute force, MFA) e de upload (MIME forjado, tamanho, path traversal).

---

## 13. Roadmap e Definition of Done

Uma funcionalidade está pronta quando tem UI, backend, banco, validação, autorização, todos os estados de UI, responsividade, acessibilidade, testes, revisão de segurança e documentação. Tela bonita sem isso não conta.

| Fase | Entrega |
|---|---|
| **1 — Foundation** | Monorepo e CI; `packages/db` (roles, RLS, migrations, seed); auth (senha, sessão, MFA TOTP, recuperação; base para SSO); organização e estrutura com histórico; RBAC + `packages/authz`; auditoria; feature flags; arquivos; design system base (tokens e ~20 componentes); shells de navegação dos dois ambientes; suíte de segurança 4–8 |
| **2 — Employee Experience** | Início, perfil, cursos, trilhas, biblioteca, comunicados, conquistas, notificações |
| **3 — People Development** | Competências, PDI, dashboard de desenvolvimento, visão do gestor |
| **4 — Surveys** | Builder, cofre anônimo, k-anonimato, eNPS, clima, dashboards, suíte 1–3 e 9–11 |
| **5 — Admin** | Gestão de usuários (import/CSV), estrutura, conteúdo com workflow editorial, papéis customizados, configurações |
| **6 — People Intelligence** | Dashboards executivos, tendências, temas e sentimento, relatórios CSV/Excel/PDF, IA |

**Seed de desenvolvimento:** 1 organização fictícia, cerca de 60 colaboradores em 3 diretorias e 8 áreas (incluindo uma área com 3 pessoas, para exercitar o k), cursos, trilhas, biblioteca, comunicados, competências, PDIs, conquistas e 2 campanhas de pesquisa. Os dados vivem em `packages/db/seed`, nunca nos componentes.

---

## 14. Decisões em aberto

1. **Aprovação da stack** (seção 2), em especial NestJS como API separada e Drizzle no lugar de Prisma.
2. **Ambiente local:** instalar Docker Desktop ou OrbStack (recomendado: compose com Postgres, MinIO e Mailpit) ou usar Postgres.app.
3. **Hospedagem-alvo** (impacta deploy e LGPD): por exemplo AWS `sa-east-1` (RDS, S3, ECS) ou Vercel (web) + Fly/Render (api/worker) + Postgres gerenciado.
4. **Assets de marca:** SVG da logo e PNGs/SVGs do mascote.
5. **Check-in de humor** como pulso anônimo (proposto) ou como diário pessoal visível só ao próprio colaborador.
6. **Ranking de conquistas** desligado por padrão (proposto).

---

## 15. Decisões aprovadas e alterações (2026-10-07)

| Tema | Decisão |
|---|---|
| Stack | Aprovada. **Alteração:** a API é feita de route handlers do próprio Next.js (`/api/v1`), não um serviço NestJS separado, porque o produto roda num único projeto na Vercel. O domínio continua independente do framework (`src/server/modules`) e as garantias de isolamento ficam no banco (roles, RLS, grants por coluna, `SECURITY DEFINER` no cofre). |
| Monorepo | Simplificado para um único pacote na raiz (compatível com o projeto já criado na Vercel). Fronteiras garantidas por pastas + regras de ESLint. |
| Banco | Neon (Postgres 17, `sa-east-1`). Desenvolvimento e testes com **PGlite**, o Postgres real em WASM, sem Docker. |
| Hospedagem | Vercel (região `gru1`). O projeto está no plano **Hobby**, que não permite uso comercial: migrar para o Pro antes de atender clientes. |
| Jobs | Sem worker contínuo na Vercel: tarefas assíncronas rodam na própria requisição (`after()`) ou por Vercel Cron. O flush do cofre de pesquisas roda no envio que completa o lote, e um cron diário cobre as campanhas encerradas. |
| Rate limit | Auth: persistente no banco (Better Auth). API: em memória por instância (melhor esforço), com interface para um store distribuído. |
| CSP | Estática sem nonce (nonce é incompatível com o static shell do Cache Components); nenhuma origem externa permitida. Ver `docs/security.md`. |
| IDs | UUID v4 em todas as tabelas (Postgres 17 não tem `uuidv7()` nativo). |
| Check-in de humor | **Identificado** (decisão de produto). Por ser dado potencialmente de saúde: visível ao próprio colaborador, agregado com k-anonimato para G&G e nunca individual para gestores. |
| Ranking de conquistas | Desligado por padrão (flag `achievements_ranking`). |
| Marca | SVG oficial versionado em `brand/`; as variações são geradas por script, sem redesenho. |
