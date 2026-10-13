# Design system

Fontes: o styleguide da Luumu People e os mockups de interface. Código em `src/design-system`; tokens em `src/app/globals.css` (`@theme` do Tailwind v4).

**Regra:** componentes usam apenas tokens, nunca valores soltos (cores hex, tamanhos arbitrários de fonte, sombras próprias).

## Marca

- O SVG oficial fica em `brand/luumu-people.svg`. `pnpm brand:build` gera, sem redesenhar nada, apenas selecionando camadas e recortando:
  - `public/brand/logo.svg`: mascote, balão e wordmark — **logo oficial, usada na sidebar e no login**;
  - `wordmark.svg`: "Luumú people" sem o mascote (usos compactos);
  - `mascot.svg`: estados vazios, ajuda, heros e ícone do app;
  - `symbol.svg`: mascote com balão.
- **A folha existe apenas sobre o "ú" final. Nunca adicione folha junto ao "L".** Alguns mockups antigos mostram essa folha; a logo oficial não tem.
- Componentes: `<Logo />`, `<Wordmark />`, `<Mascot />`. O mascote é decorativo por padrão (`alt=""`).
- As ilustrações temáticas dos mockups (troféu, megafone, lupa, placas) exigem os arquivos originais. Até chegarem, os heros usam o mascote oficial com folhas e formas suaves.
- `illustrations/luumu-plum.tsx` traz o mascote oficial em formas vetoriais (corpo, folha e os rostos sorrindo e piscando, sem redesenho) com uma camada de volume, para compor cenas: `survey-scenes.tsx` (banner "Sua opinião importa!" com o Luumu no notebook e o cartão com as carinhas e a prancheta) e `profile-cover.tsx` (capa padrão do perfil de colegas).

## Tokens

| Grupo | Tokens |
|---|---|
| Cores principais | `purple-500` #7C3AED (primária), `purple-700` #5B21B6 (escura), `purple-100` #EDE9FE (clara), `orange-500` #F59E0B, `green-500` #22C55E |
| Apoio | `pink-100` #FCE7F3, `yellow-100` #FEF3C7, `green-100` #DCFCE7, `blue-100` #DBEAFE |
| Neutros | `neutral-900` #0F172A · 700 #334155 · 500 #64748B · 300 #CBD5E1 · 100 #F1F5F9 · 50 #FAFAFC |
| Semânticas | `success`, `warning`, `error`, `info` |
| Superfícies | `canvas` (fundo), `surface` (cards), `line` (bordas) |
| Tipografia (Inter) | `text-display` 44, `text-h1` 32, `text-h2` 24, `text-h3` 18, `text-h4` 16, `text-body` 16, `text-body-sm` 14, `text-caption` 12 |
| Espaçamento | escala de 4 px do Tailwind (4, 8, 12, 16, 24, 32, 40, 48, 64) |
| Raios | `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `full` |
| Sombras | `sm`, `md`, `lg` (suaves, tingidas de roxo) |

### Contraste (WCAG AA)

- Texto colorido sempre usa o tom **escuro** sobre o fundo claro do mesmo tom: `text-orange-700` sobre `bg-orange-100`, `text-green-700` sobre `bg-green-100`, e assim por diante. `orange-700` foi escurecido (#9A3C06) para passar de 4,5:1.
- `neutral-500` só é usado sobre branco. Sobre o `canvas`, o texto secundário usa `neutral-600`.
- O axe roda nos testes E2E e falha com qualquer violação séria.

## Componentes (Fase 1)

| Componente | Arquivo |
|---|---|
| Button, IconButton | `button.tsx`: primário, secundário, terciário, soft, fantasma, destrutivo; sm/md/lg; `loading`; `asChild`. IconButton: outline, soft, plain e `solid` (roxo cheio) |
| Field, Input, Textarea | `field.tsx`: label associado, dica, erro anunciado (`role=alert`) com ícone |
| Select | `select.tsx` (nativo estilizado) |
| Switch, Checkbox, RadioGroup | `choice.tsx` (Radix) |
| Charts | `charts.tsx`: AreaChart, ColumnChart, DonutChart e `RadarChart` (perfil em várias dimensões, atual x referência; ofereça a tabela equivalente ao lado) |
| Tabs, LinkTabs | `tabs.tsx` (Radix), `link-tabs.tsx` (estado na URL; `variant="soft"`: blocos claros e a aba atual branca, roxa e sublinhada — Desenvolvimento) |
| Badge | `badge.tsx`: tons da paleta |
| Avatar, AvatarGroup | `avatar.tsx`: foto ou iniciais com tom estável |
| Card, CardHeader, SeeAllLink | `card.tsx` |
| Progress, CircularProgress | `progress.tsx`: valor sempre também em texto |
| Skeleton, Alert | `feedback.tsx` |
| EmptyState | `empty-state.tsx` (com mascote) |
| Tooltip, Menu, Modal, Drawer | Radix: foco preso, Esc fecha, ARIA |
| Breadcrumb, CursorPagination | `navigation.tsx` |
| Table (vira lista no mobile) | `table.tsx` |
| Logo, Wordmark, Mascot | `brand.tsx` |

| Combobox (select com busca e multiselect com chips) | `combobox.tsx` — listbox acessível, setas/Enter/Esc |
| DatePicker | `date-picker.tsx` — calendário pt-BR, grade navegável por teclado, mín./máx. |
| FileUpload | `file-upload.tsx` — padrão, com arquivo, enviando, concluído, erro; arrastar e soltar |
| Toast | `toast.tsx` — `useToast()`, provedor no layout raiz |
| AreaChart, ColumnChart, DonutChart | `charts.tsx` — SVG próprio, tooltip, "Ver como tabela" |
| DataTable | `data-table.tsx` — ordenação (`aria-sort`) e paginação no cliente |
| NotificationBell, NotificationList | `notification.tsx` |
| Lightbox | `lightbox.tsx` — imagem ampliada ou cartão do documento, Baixar / Abrir em nova aba, ← → entre arquivos, Esc fecha |

**Vitrine:** `/design-system` (somente fora de produção) mostra todos os componentes e roda no E2E com axe.

### Gráficos

Paleta categórica em ordem fixa, validada para daltonismo: `--color-chart-1..5` = roxo, laranja, azul, verde (#16A34A), rosa. O laranja tem contraste < 3:1 sobre branco, então todo gráfico tem legenda com valores e alternância para tabela. Um único eixo; linha 2px; colunas ≤ 24px com ponta arredondada; área a ~10%; grade recessiva; texto nunca na cor da série.

`cn()` combina classes com um `tailwind-merge` que conhece os tokens do tema. Sem isso, `text-body-sm` e `text-purple-600` se anulariam (há teste em `cn.test.ts`).

## Padrões de tela

- **Hero de página:** título forte, subtítulo acolhedor e mascote com balão de fala (`PageHero`).
- **Duas colunas** em telas largas: conteúdo + coluna lateral de ~380 px.
- **Estados:** toda tela trata carregamento (skeleton no formato final), vazio (mascote + próximo passo), erro (mensagem humana + código), permissão negada (`forbidden.tsx`) e "em breve" (`ComingSoon`, nunca dados falsos).
- **Responsivo:** a sidebar vira barra inferior (colaborador) ou gaveta (gestão); tabelas viram listas.
- **Chat flutuante:** a barra "Conversas" fica no canto inferior direito em toda a plataforma (fora da página /conversas), com janelas de conversa que acompanham a navegação; o fim do conteúdo reserva o espaço dela. "Nova conversa" (na barra, na lista e no topo de /conversas) abre a escolha de uma conexão. O **x** da barra esconde o widget (estado da aba, `sessionStorage`) até a pessoa iniciar uma conversa ou receber uma mensagem nova. Listas com rolagem própria são `relative` (textos `sr-only` absolutos não podem esticar a página).
- **Acessibilidade:** link "Pular para o conteúdo", foco visível, `aria-current` na navegação, `prefers-reduced-motion` respeitado, estado nunca comunicado só por cor.

## Linguagem

Humana, clara, positiva e direta. Prefira *"Ainda não temos respostas suficientes para mostrar este resultado preservando o anonimato."* a *"Dados insuficientes."*
