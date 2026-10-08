# RBAC — papéis, permissões e escopos

Fonte da verdade: `src/server/authz/permissions.ts` (catálogo) e `src/server/authz/system-roles.ts` (papéis de sistema). O motor de decisão (`policy.ts`) é puro e coberto por testes.

## Modelo

```
permissão (catálogo em código) ─┐
papel = conjunto de permissões ─┼─ atribuição = usuário + papel + ESCOPO
                                 │
escopo: SELF < TEAM_DIRECT < TEAM_TREE < ORG_UNIT_TREE < TENANT
```

Uma decisão sempre responde a duas perguntas:

1. O ator tem a permissão em algum papel?
2. O recurso está dentro do escopo daquele papel?

```ts
await can(actor, "people.directory.read", { kind: "user", userId }, resolver);
```

Os alvos possíveis são `tenant`, `user`, `orgUnit` e `ownTeam`. O resolvedor consulta a hierarquia de gestores e a árvore de áreas no banco, sempre dentro do tenant.

## Separação de domínios

| Domínio | Exemplos | Observação |
|---|---|---|
| `content.*`, `comms.*` | cursos, trilhas, biblioteca, comunicados | **não** dá acesso a dados de pessoas |
| `people.*`, `org.*` | diretório, dados pessoais, estrutura | dados profissionais ≠ dados pessoais (`people.profile.read_full`) |
| `learning.*`, `development.*` | progresso, PDI | sempre com escopo |
| `survey.*` | criar, lançar, ler resultados **agregados** | não existe leitura individual de pesquisa anônima |
| `reports.*`, `access.*`, `tenant.*`, `audit.read` | relatórios, papéis, configurações | |

No desenvolvimento: **Gestor** lê e gerencia PDIs e avalia competências da própria equipe (`development.read` + `development.pdi.manage` em TEAM_TREE); **G&G** e **Administrador** fazem o mesmo para a empresa e mantêm o catálogo de competências. O **Editor** não tem acesso a desenvolvimento — é um papel de conteúdo, sem dados de pessoas.

Capacidades sobre os **próprios** dados (perfil, cursos, responder pesquisas) não são permissões atribuíveis: derivam de ser o titular dos dados.

## Papéis de sistema

| Papel | Escopo padrão | Resumo |
|---|---|---|
| Colaborador | SELF | nenhum acesso de gestão |
| Gestor | TEAM_TREE | diretório da equipe, aprendizagem, desenvolvimento, resultados agregados |
| Editor | TENANT | `content.*` + `comms.*` |
| G&G / People | TENANT | pessoas, estrutura, aprendizagem, desenvolvimento, pesquisas, relatórios |
| Administrador | TENANT | todas as permissões do catálogo |

**Super Admin não é papel de tenant.** Opera no plano da plataforma (Fase 5), sem acesso a dados de empresas. Papéis de sistema não podem ser alterados pela aplicação: uma policy `RESTRICTIVE` no banco impede.

## Prevenção de escalonamento

`canGrantRole()` exige que:

1. ninguém altere os próprios papéis (regra também garantida por `CHECK` no banco);
2. o ator tenha `access.roles.assign` com escopo TENANT;
3. o ator possua **cada** permissão do papel concedido, em escopo igual ou maior.

A revogação segue a mesma regra. O papel Colaborador não pode ser removido, e a empresa sempre mantém ao menos um Administrador ativo. Conceder ou revogar um papel **encerra as sessões** da pessoa afetada e grava auditoria.

## Na interface

A navegação de gestão é filtrada por permissão (`nav-config.ts`). Isso é só conveniência: toda página chama `requirePermission()` e todo endpoint declara sua permissão em `defineRoute()`. Um recurso fora do escopo responde **404**, para não revelar que ele existe.
