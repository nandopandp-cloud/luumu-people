# Produto

A Luumu People é a plataforma de experiência, desenvolvimento e inteligência de pessoas de uma empresa: comunicação interna, educação corporativa, desenvolvimento (competências e PDI), pesquisas com anonimato real e indicadores para G&G. Este documento mostra **o que existe hoje**, para quem e onde fica no código. Como cada tela é desenhada está em [design-system.md](design-system.md); o plano de fases, na [RFC 0001](rfc/0001-arquitetura.md#13-roadmap-e-definition-of-done).

> As imagens são do app real com o seed **fictício** (empresa Aurora, domínio `.example`). Para atualizá-las: `pnpm docs:screenshots` ([scripts.md](scripts.md#documentação)).

## Princípios

1. **Segurança → privacidade → anonimato → integridade → autorização → arquitetura → UX → performance → escalabilidade → estética.** Nenhuma conveniência inverte essa ordem.
2. **Anonimato de verdade:** nenhuma tela, permissão, log ou export mostra a resposta individual de uma pesquisa anônima, nem para o Administrador ([anonymous-surveys.md](anonymous-surveys.md)).
3. **Cada pessoa vê só o seu escopo:** a gestora vê a própria equipe; G&G vê a empresa; o editor vê conteúdo, não pessoas ([rbac.md](rbac.md)).
4. **Nada de dado falso na interface:** o que ainda não existe aparece como "em breve", nunca com números inventados.
5. **Linguagem humana, clara e acolhedora**, com o mascote Luumu como guia.

## Dois ambientes

| | Colaborador | Gestão |
|---|---|---|
| Para quem | toda pessoa ativa | quem tem `management.access` (gestores, G&G, editores, administração) |
| Rotas | `/inicio`, `/desenvolvimento`, `/pesquisas`… — `src/app/(colaborador)` | `/gestao/**` — `src/app/gestao` |
| Navegação | sidebar fixa; barra inferior no celular | sidebar filtrada por permissão; gaveta no celular |
| Troca | pelo menu da conta, para quem tem acesso aos dois | |

## Personas (contas demonstrativas)

Senha de todas: `Luumu@Demo2026` (só no seed local e de preview).

| Conta | Papel | Para avaliar |
|---|---|---|
| `fernando.santos@aurora.example` | Colaborador | experiência do colaborador (cursos e trilhas aparecem para quem estiver em `SEED_LEARNING_USERS`, ver [environment.md](environment.md)) |
| `carla.mendes@aurora.example` | Gestora (Produto) | gestão limitada à própria equipe |
| `rafael.lima@aurora.example` | Editor | conteúdo, sem dados de pessoas |
| `juliana.mendes@aurora.example` | G&G / People | pessoas e indicadores da empresa |
| `paula.ribeiro@aurora.example` | Administradora | tudo, incluindo papéis e auditoria |
| `sergio.tavares@horizonte.example` | Admin de **outra empresa** | isolamento entre tenants |

## Módulos e estado

✅ no ar · 🚩 no ar atrás de feature flag (desligada por padrão, ligável por empresa, papel ou pessoa) · 🕒 em breve (tela "em breve", sem dados)

### Colaborador

| Módulo | Estado | Rotas | Código |
|---|---|---|---|
| Entrada e conta (senha, Google, convite, troca obrigatória) | ✅ | `/entrar`, `/convite`, `/recuperar-senha`, `/redefinir-senha`, `/trocar-senha` | `app/(auth)`, `features/auth` |
| Início (saudação, sentimento do dia, PDI, atividades, comunicados, banners) | ✅ | `/inicio` | `features/home`, `features/wellbeing`, `features/banners` |
| Comunicados e agenda (mural, reações, comentários com menções, eventos) | ✅ | `/comunicados`, `/comunicados/eventos` | `features/announcements`, `features/communication` |
| Desenvolvimento (visão geral, PDI, competências, evolução, mentoria) | ✅ | `/desenvolvimento` | `features/development` |
| Pesquisas (clima, eNPS, pulso; anônimas ou identificadas) | ✅ | `/pesquisas`, `/pesquisas/[id]` | `features/surveys` |
| Conexões e amigos (descobrir pessoas, pedidos, interesses) | ✅ | `/amigos`, `/pessoas/[userId]` | `features/friends`, `features/connections` |
| Conversas (diretas e em grupo, chat flutuante) | ✅ | `/conversas` | `features/friends` |
| Notificações | ✅ | `/notificacoes` | `features/notifications` |
| Perfil (dados, capa, foto, certificados, histórico) | ✅ | `/meu-perfil` | `features/profile` |
| Busca global | ✅ | `/busca` | `features/search` |
| Cursos, aulas e certificados | 🚩 `module_learning` | `/meus-cursos`, `/certificados/[courseId]` | `features/courses` |
| Trilhas de aprendizagem | 🚩 `module_learning` | `/trilhas` | `features/paths` |
| Biblioteca | 🕒 `module_library` | `/biblioteca` | — |
| Conquistas | 🕒 | `/minhas-conquistas` | — |

### Gestão

| Módulo | Estado | Rotas | Código |
|---|---|---|---|
| Dashboard (pessoas, uso da plataforma, atenção necessária) | ✅ | `/gestao` | `features/management` |
| Colaboradores (diretório, lotação, convites, papéis) | ✅ | `/gestao/colaboradores` | `features/directory`, `features/access` |
| Comunicação (comunicados, banners da home, eventos, links rápidos) | ✅ | `/gestao/comunicacao/**` | `features/announcements`, `features/banners` |
| Desenvolvimento (PDIs da equipe, catálogo de competências) | ✅ | `/gestao/desenvolvimento/**` | `features/development` |
| Pesquisas (builder, público, agendamento, resultados com k-anonimato) | ✅ | `/gestao/pesquisas/**` | `features/surveys` |
| Relatórios (mapa de competências, export CSV) | ✅ | `/gestao/relatorios` | `features/reports` |
| Auditoria | ✅ | `/gestao/auditoria` | `features/audit` |
| Conteúdos (cursos, trilhas, biblioteca, avaliações) | 🕒 | `/gestao/conteudos/**` | — |
| Engajamento | 🕒 `module_learning` | `/gestao/engajamento` | — |
| Personalização e Configurações | 🕒 | `/gestao/personalizacao`, `/gestao/configuracoes` | — |

Cada tela chama os mesmos serviços da API (`src/server/modules/<domínio>`), com a mesma autorização: a interface nunca é a única barreira ([architecture.md](architecture.md)).

## Tour visual

### Colaborador

| | |
|---|---|
| ![Entrada](assets/screens/01-entrar.jpg) **Entrada** — login por e-mail ou Google | ![Início](assets/screens/02-inicio.jpg) **Início** — o dia da pessoa num só lugar |
| ![Comunicados](assets/screens/03-comunicados.jpg) **Comunicados** — mural, destaques, eventos e links | ![Desenvolvimento](assets/screens/06-desenvolvimento.jpg) **Desenvolvimento** — PDI, objetivos e competências |
| ![Trilhas](assets/screens/04-trilhas.jpg) **Trilhas** — jornadas de aprendizagem | ![Meus cursos](assets/screens/05-meus-cursos.jpg) **Meus cursos** — progresso e pendências |
| ![Pesquisas](assets/screens/07-pesquisas.jpg) **Pesquisas** — anonimato explicado antes de responder | ![Conexões](assets/screens/08-amigos.jpg) **Conexões** — pessoas, pedidos e interesses |
| ![Meu perfil](assets/screens/09-meu-perfil.jpg) **Meu perfil** — dados, sentimento e evolução | |

### Gestão

| | |
|---|---|
| ![Dashboard](assets/screens/10-gestao.jpg) **Dashboard** — pessoas, uso e alertas | ![Colaboradores](assets/screens/11-gestao-colaboradores.jpg) **Colaboradores** — diretório no escopo de quem vê |
| ![Comunicação](assets/screens/12-gestao-comunicacao.jpg) **Comunicação** — publicar, agendar e fixar | ![Pesquisas](assets/screens/15-gestao-pesquisas.jpg) **Pesquisas** — clima, eNPS e pulsos |
| ![Desenvolvimento](assets/screens/14-gestao-desenvolvimento.jpg) **Desenvolvimento** — PDIs da empresa ou da equipe | ![Competências](assets/screens/13-gestao-competencias.jpg) **Competências** — catálogo da empresa |
| ![Relatórios](assets/screens/17-gestao-relatorios.jpg) **Relatórios** — mapa de competências e lacunas | ![Auditoria](assets/screens/16-gestao-auditoria.jpg) **Auditoria** — trilha imutável de ações sensíveis |

### Celular

| | | |
|---|---|---|
| ![Início no celular](assets/screens/20-celular-inicio.jpg) | ![Desenvolvimento no celular](assets/screens/21-celular-desenvolvimento.jpg) | ![Pesquisas no celular](assets/screens/22-celular-pesquisas.jpg) |

### Design system

A vitrine `/design-system` (fora de produção) reúne todos os componentes e roda no E2E com axe. Detalhes em [design-system.md](design-system.md).

![Vitrine do design system](assets/screens/30-design-system.jpg)
