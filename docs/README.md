# Documentação da Luumu People

Mapa de tudo que está documentado, por tema. Os documentos são **vivos**: quem muda o comportamento muda o documento no mesmo commit. A RFC é a exceção, um registro da decisão original.

## Comece por aqui

| Você é… | Leia, nesta ordem |
|---|---|
| **Nova pessoa no código** | [Produto](product.md) → [Arquitetura](architecture.md) → [Modelagem de dados](data-model.md) → [Segurança](security.md) → [RBAC](rbac.md) → [Testes](testing.md) |
| **Produto / design** | [Produto](product.md) → [Design system](design-system.md) → [Pesquisas anônimas](anonymous-surveys.md) (o que a interface nunca pode mostrar) |
| **Mexendo em servidor ou banco** | [Arquitetura](architecture.md), [Segurança](security.md) e [RBAC](rbac.md) (obrigatórios, ver `AGENTS.md`) → [Banco de dados](database.md) → [API](api.md) |
| **Operação / deploy** | [Ambiente](environment.md) → [Deploy](deployment.md) → [Scripts e operações](scripts.md) |

## Por tema

### Produto e design

| Documento | Conteúdo |
|---|---|
| [product.md](product.md) | visão, princípios, os dois ambientes, personas, módulos e estado, **tour visual** com telas reais |
| [design-system.md](design-system.md) | marca, tokens, contraste, componentes, gráficos, padrões de tela e linguagem |
| [`/design-system`](../src/app/design-system) | vitrine viva dos componentes (fora de produção) |

### Arquitetura

| Documento | Conteúdo |
|---|---|
| [architecture.md](architecture.md) | visão geral, estrutura de pastas, regras de dependência, fluxo de uma requisição, Cache Components |
| [api.md](api.md) | contrato de toda rota (`defineRoute`), erros, paginação e catálogo de endpoints |

### Dados

| Documento | Conteúdo |
|---|---|
| [data-model.md](data-model.md) | **modelagem**: entidades e relacionamentos por domínio (diagramas), invariantes, o que é derivado, dívidas de modelo |
| [database.md](database.md) | **banco físico**: convenções, roles, RLS, grants, migrations e seed |
| [`src/server/db/schema`](../src/server/db/schema) · [`db/migrations`](../db/migrations) | fonte da verdade: schema Drizzle e SQL versionado |

### Segurança e privacidade

| Documento | Conteúdo |
|---|---|
| [security.md](security.md) | autenticação, isolamento entre empresas, proteções HTTP, logs, uploads, LGPD, riscos conhecidos |
| [rbac.md](rbac.md) | papéis, permissões, escopos, separação de domínios e prevenção de escalonamento |
| [anonymous-surveys.md](anonymous-surveys.md) | contrato de anonimato das pesquisas: cofre, k-anonimato, o que nunca pode existir |

### Operação e qualidade

| Documento | Conteúdo |
|---|---|
| [environment.md](environment.md) | variáveis de ambiente (modelo em [`.env.example`](../.env.example)) |
| [deployment.md](deployment.md) | Vercel + Neon, região e LGPD, migrations por release, checklist de produção, custos |
| [scripts.md](scripts.md) | todos os scripts de CLI: banco, empresas e pessoas, conteúdo, arquivos, marca, e-mail |
| [testing.md](testing.md) | organização dos testes, suíte de segurança, E2E e acessibilidade |

### Decisões

| Documento | Conteúdo |
|---|---|
| [rfc/0001-arquitetura.md](rfc/0001-arquitetura.md) | RFC original: stack, multi-tenancy, anonimato, roadmap por fases e as decisões aprovadas em 2026-10-07 (§15) |

Decisão nova que muda arquitetura, dados ou segurança vira uma RFC numerada em `rfc/` (`0002-<tema>.md`), com status, data e escopo no topo.

## Onde fica cada coisa no repositório

| Pasta | O quê |
|---|---|
| [`docs/`](.) | esta documentação; [`assets/screens/`](assets/screens) são as capturas do tour visual (geradas) |
| [`brand/`](../brand) | arquivos-fonte oficiais da marca (SVG e ilustração do e-mail) |
| [`public/`](../public) | arquivos servidos: variações da marca e imagens de e-mail (geradas a partir de `brand/`) e ilustrações das telas |
| [`src/`](../src) | aplicação: rotas, design system, features, servidor ([architecture.md](architecture.md#estrutura-de-pastas)) |
| [`db/migrations/`](../db/migrations) | SQL versionado. **Migrations já aplicadas não se editam**, nem os comentários |
| [`scripts/`](../scripts) | CLI de operação ([scripts.md](scripts.md)) |
| [`tests/`](../tests) | unitários, integração, E2E e capturas da documentação ([testing.md](testing.md)) |
| [`.github/workflows/`](../.github/workflows) | CI (lint, tipos, testes, build, E2E) e migrations no Neon |

## Convenções desta documentação

- Português do Brasil; nomes de código, tabelas e rotas como estão no código.
- Um assunto, um documento. Os outros apontam para ele em vez de repetir.
- Os caminhos `docs/*.md` são citados no código e em migrations já aplicadas: **não renomeie nem mova** um documento existente. Crie um novo e ligue aqui.
- Diagramas em Mermaid (o GitHub renderiza). Imagens em `docs/assets/`.
- Nada de dados reais de pessoas em exemplos: use o seed fictício (`.example`).
