import { ALL_PERMISSIONS, type Permission, type Scope } from "./permissions";

/**
 * Papéis de sistema, criados em todo tenant. Não podem ser alterados pela
 * aplicação (policy RESTRICTIVE no banco). Papéis personalizados: Fase 5.
 *
 * Super Admin NÃO é um papel de tenant: opera no plano da plataforma, sem
 * acesso a dados de empresas (ver docs/rbac.md).
 */
export type SystemRoleKey = "employee" | "manager" | "editor" | "people" | "admin";

export type SystemRole = {
  key: SystemRoleKey;
  name: string;
  description: string;
  defaultScope: Scope;
  permissions: readonly Permission[];
};

const contentPermissions = ALL_PERMISSIONS.filter((p) => p.startsWith("content.") || p.startsWith("comms."));

const peoplePermissions: readonly Permission[] = [
  "management.access",
  ...contentPermissions,
  "people.directory.read",
  "people.profile.read_full",
  "people.manage",
  "people.import",
  "org.structure.manage",
  "learning.progress.read",
  "learning.assign",
  "development.read",
  "development.pdi.manage",
  "survey.design",
  "survey.launch",
  "survey.results.read_aggregate",
  "survey.identified.read",
  "reports.read",
  "reports.export",
];

export const SYSTEM_ROLES: readonly SystemRole[] = [
  {
    key: "employee",
    name: "Colaborador",
    description: "Experiência do colaborador: os próprios cursos, trilhas, pesquisas, desenvolvimento e perfil.",
    defaultScope: "SELF",
    permissions: [],
  },
  {
    key: "manager",
    name: "Gestor",
    description: "Acompanha o desenvolvimento e a aprendizagem da própria equipe. Resultados de pesquisa só agregados.",
    defaultScope: "TEAM_TREE",
    permissions: [
      "management.access",
      "people.directory.read",
      "learning.progress.read",
      "learning.assign",
      "development.read",
      "survey.results.read_aggregate",
      "reports.read",
    ],
  },
  {
    key: "editor",
    name: "Editor",
    description: "Cria e publica cursos, trilhas, biblioteca e comunicados. Sem acesso a dados de pessoas.",
    defaultScope: "TENANT",
    permissions: ["management.access", ...contentPermissions],
  },
  {
    key: "people",
    name: "G&G / People",
    description: "Gente & Gestão: colaboradores, estrutura, pesquisas, desenvolvimento e indicadores.",
    defaultScope: "TENANT",
    permissions: peoplePermissions,
  },
  {
    key: "admin",
    name: "Administrador",
    description: "Acesso administrativo amplo: usuários, papéis, configurações, integrações e auditoria.",
    defaultScope: "TENANT",
    permissions: ALL_PERMISSIONS,
  },
];
