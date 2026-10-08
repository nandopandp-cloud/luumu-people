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
- As ilustrações temáticas dos mockups (mascote com laptop, troféu, megafone, lupa, placas) exigem os arquivos originais. Até chegarem, os heros usam o mascote oficial com folhas e formas suaves.

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
| Button, IconButton | `button.tsx`: primário, secundário, terciário, soft, fantasma, destrutivo; sm/md/lg; `loading`; `asChild` |
| Field, Input, Textarea | `field.tsx`: label associado, dica, erro anunciado (`role=alert`) com ícone |
| Select | `select.tsx` (nativo estilizado) |
| Switch, Checkbox, RadioGroup | `choice.tsx` (Radix) |
| Tabs, LinkTabs | `tabs.tsx` (Radix), `link-tabs.tsx` (estado na URL) |
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

Para os próximos módulos ficam MultiSelect, DatePicker, FileUpload, Toast, Chart, DataTable e Notification.

`cn()` combina classes com um `tailwind-merge` que conhece os tokens do tema. Sem isso, `text-body-sm` e `text-purple-600` se anulariam (há teste em `cn.test.ts`).

## Padrões de tela

- **Hero de página:** título forte, subtítulo acolhedor e mascote com balão de fala (`PageHero`).
- **Duas colunas** em telas largas: conteúdo + coluna lateral de ~380 px.
- **Estados:** toda tela trata carregamento (skeleton no formato final), vazio (mascote + próximo passo), erro (mensagem humana + código), permissão negada (`forbidden.tsx`) e "em breve" (`ComingSoon`, nunca dados falsos).
- **Responsivo:** a sidebar vira barra inferior (colaborador) ou gaveta (gestão); tabelas viram listas.
- **Acessibilidade:** link "Pular para o conteúdo", foco visível, `aria-current` na navegação, `prefers-reduced-motion` respeitado, estado nunca comunicado só por cor.

## Linguagem

Humana, clara, positiva e direta. Prefira *"Ainda não temos respostas suficientes para mostrar este resultado preservando o anonimato."* a *"Dados insuficientes."*
