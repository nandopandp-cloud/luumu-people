import type { Permission } from "@/server/authz/permissions";

/** Ícones referenciados por nome: config serializável entre Server e Client Components. */
export type NavIcon =
  | "home"
  | "courses"
  | "paths"
  | "development"
  | "surveys"
  | "announcements"
  | "library"
  | "profile"
  | "achievements"
  | "dashboard"
  | "users"
  | "content"
  | "assessments"
  | "engagement"
  | "reports"
  | "settings"
  | "audit"
  | "customization";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** Correspondência exata do caminho (para itens "raiz" como /gestao). */
  exact?: boolean;
};

/** Navegação do colaborador — briefing §47 e mockups. */
export const EMPLOYEE_NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: "home" },
  { href: "/meus-cursos", label: "Meus cursos", icon: "courses" },
  { href: "/trilhas", label: "Trilhas", icon: "paths" },
  { href: "/desenvolvimento", label: "Desenvolvimento", icon: "development" },
  { href: "/pesquisas", label: "Pesquisas", icon: "surveys" },
  { href: "/comunicados", label: "Comunicados", icon: "announcements" },
  { href: "/biblioteca", label: "Biblioteca", icon: "library" },
];

export const EMPLOYEE_NAV_SECONDARY: NavItem[] = [
  { href: "/meu-perfil", label: "Meu perfil", icon: "profile" },
  { href: "/minhas-conquistas", label: "Minhas conquistas", icon: "achievements" },
];

/** Barra inferior no mobile (styleguide "Navegação mobile"). */
export const EMPLOYEE_MOBILE_NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: "home" },
  { href: "/meus-cursos", label: "Cursos", icon: "courses" },
  { href: "/trilhas", label: "Trilhas", icon: "paths" },
  { href: "/comunicados", label: "Comunicados", icon: "announcements" },
  { href: "/meu-perfil", label: "Perfil", icon: "profile" },
];

export type ManagementNavItem = NavItem & {
  /** Exibido se o ator tiver QUALQUER uma destas permissões (a página revalida). */
  anyOf: Permission[];
  children?: (NavItem & { anyOf: Permission[] })[];
};

/** Navegação administrativa — briefing §48. Filtrada por permissão no servidor. */
export const MANAGEMENT_NAV: ManagementNavItem[] = [
  { href: "/gestao", label: "Dashboard", icon: "dashboard", exact: true, anyOf: ["management.access"] },
  { href: "/gestao/usuarios", label: "Usuários", icon: "users", anyOf: ["people.directory.read"] },
  {
    href: "/gestao/conteudos",
    label: "Conteúdos",
    icon: "content",
    anyOf: ["content.course.create", "content.path.manage", "content.library.manage", "content.assessment.manage"],
    children: [
      { href: "/gestao/conteudos/cursos", label: "Cursos", icon: "courses", anyOf: ["content.course.create", "content.course.edit"] },
      { href: "/gestao/conteudos/trilhas", label: "Trilhas", icon: "paths", anyOf: ["content.path.manage"] },
      { href: "/gestao/conteudos/biblioteca", label: "Biblioteca", icon: "library", anyOf: ["content.library.manage"] },
      { href: "/gestao/conteudos/avaliacoes", label: "Avaliações", icon: "assessments", anyOf: ["content.assessment.manage"] },
    ],
  },
  { href: "/gestao/engajamento", label: "Engajamento", icon: "engagement", anyOf: ["learning.progress.read", "content.analytics.read"] },
  { href: "/gestao/pesquisas", label: "Pesquisas", icon: "surveys", anyOf: ["survey.design", "survey.results.read_aggregate"] },
  { href: "/gestao/desenvolvimento", label: "Desenvolvimento", icon: "development", anyOf: ["development.read"] },
  { href: "/gestao/relatorios", label: "Relatórios", icon: "reports", anyOf: ["reports.read"] },
  { href: "/gestao/comunicacao", label: "Comunicação", icon: "announcements", anyOf: ["comms.announcement.create"] },
  { href: "/gestao/personalizacao", label: "Personalização", icon: "customization", anyOf: ["tenant.settings.manage"] },
  { href: "/gestao/configuracoes", label: "Configurações", icon: "settings", anyOf: ["tenant.settings.manage", "access.roles.manage", "tenant.feature_flags.manage"] },
  { href: "/gestao/auditoria", label: "Auditoria", icon: "audit", anyOf: ["audit.read"] },
];
