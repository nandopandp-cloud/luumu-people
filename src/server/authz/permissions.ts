/**
 * Catálogo de permissões — fonte única de verdade do RBAC.
 *
 * Domínios separam CONTEÚDO de DADOS DE PESSOAS: um Editor (content.*) não
 * recebe automaticamente nada de people.*, survey.* ou reports.*.
 *
 * INTENCIONALMENTE AUSENTE: qualquer permissão de leitura de resposta
 * individual de pesquisa anônima. A capacidade não existe no sistema — nenhum
 * papel, nem o Super Admin, pode recebê-la. Ver docs/anonymous-surveys.md.
 */

export const SCOPES = ["SELF", "TEAM_DIRECT", "TEAM_TREE", "ORG_UNIT_TREE", "TENANT"] as const;
export type Scope = (typeof SCOPES)[number];

/** Ordem de abrangência — usada para impedir concessão acima do próprio escopo. */
export const SCOPE_RANK: Record<Scope, number> = {
  SELF: 0,
  TEAM_DIRECT: 1,
  TEAM_TREE: 2,
  ORG_UNIT_TREE: 3,
  TENANT: 4,
};

type PermissionDef = {
  readonly domain: string;
  readonly description: string;
  /** Escopos em que a permissão faz sentido. */
  readonly scopes: readonly Scope[];
};

const people: readonly Scope[] = ["TEAM_DIRECT", "TEAM_TREE", "ORG_UNIT_TREE", "TENANT"];
const tenantOnly: readonly Scope[] = ["TENANT"];

export const PERMISSIONS = {
  // Gestão — acesso ao ambiente /gestao (cada página exige sua própria permissão)
  "management.access": { domain: "management", description: "Acessar o ambiente de gestão", scopes: people },

  // Conteúdo
  "content.course.create": { domain: "content", description: "Criar cursos", scopes: tenantOnly },
  "content.course.edit": { domain: "content", description: "Editar cursos", scopes: tenantOnly },
  "content.course.review": { domain: "content", description: "Revisar e aprovar cursos", scopes: tenantOnly },
  "content.course.publish": { domain: "content", description: "Publicar e arquivar cursos", scopes: tenantOnly },
  "content.path.manage": { domain: "content", description: "Criar, editar e publicar trilhas", scopes: tenantOnly },
  "content.library.manage": { domain: "content", description: "Gerenciar a biblioteca", scopes: tenantOnly },
  "content.assessment.manage": { domain: "content", description: "Gerenciar avaliações e quizzes", scopes: tenantOnly },
  "content.analytics.read": { domain: "content", description: "Ver indicadores de consumo de conteúdo", scopes: tenantOnly },

  // Comunicação
  "comms.announcement.create": { domain: "comms", description: "Criar e editar comunicados", scopes: tenantOnly },
  "comms.announcement.publish": { domain: "comms", description: "Publicar e agendar comunicados", scopes: tenantOnly },
  "comms.comment.moderate": { domain: "comms", description: "Remover comentários de comunicados", scopes: tenantOnly },
  "comms.event.manage": { domain: "comms", description: "Gerenciar a agenda de eventos", scopes: tenantOnly },
  "comms.quicklink.manage": { domain: "comms", description: "Gerenciar os links rápidos do mural", scopes: tenantOnly },

  // Pessoas e organização
  "people.directory.read": { domain: "people", description: "Ver dados profissionais de colaboradores", scopes: people },
  "people.profile.read_full": { domain: "people", description: "Ver dados pessoais completos de colaboradores", scopes: people },
  "people.manage": { domain: "people", description: "Criar, editar, transferir, desativar colaboradores", scopes: tenantOnly },
  "people.import": { domain: "people", description: "Importar colaboradores em lote", scopes: tenantOnly },
  "org.structure.manage": { domain: "people", description: "Gerenciar áreas, unidades, cargos e níveis", scopes: tenantOnly },

  // Aprendizagem e desenvolvimento (dados de pessoas)
  "learning.progress.read": { domain: "learning", description: "Acompanhar cursos e trilhas de colaboradores", scopes: people },
  "learning.assign": { domain: "learning", description: "Atribuir cursos e trilhas", scopes: people },
  "development.read": { domain: "development", description: "Acompanhar PDIs e competências", scopes: people },
  "development.pdi.manage": { domain: "development", description: "Administrar PDIs e competências", scopes: people },

  // Pesquisas
  "survey.design": { domain: "survey", description: "Criar e editar pesquisas em rascunho", scopes: tenantOnly },
  "survey.launch": { domain: "survey", description: "Lançar e encerrar campanhas de pesquisa", scopes: tenantOnly },
  "survey.results.read_aggregate": {
    domain: "survey",
    description: "Ver resultados AGREGADOS de pesquisas (sempre sujeitos ao k-anonimato)",
    scopes: people,
  },
  "survey.identified.read": { domain: "survey", description: "Ver respostas de pesquisas IDENTIFICADAS", scopes: people },

  // Relatórios
  "reports.read": { domain: "reports", description: "Ver relatórios executivos", scopes: people },
  "reports.export": { domain: "reports", description: "Exportar relatórios", scopes: people },

  // Acesso
  "access.roles.manage": { domain: "access", description: "Criar e editar papéis personalizados", scopes: tenantOnly },
  "access.roles.assign": { domain: "access", description: "Atribuir e revogar papéis", scopes: tenantOnly },

  // Empresa
  "tenant.settings.manage": { domain: "tenant", description: "Configurar a empresa e a plataforma", scopes: tenantOnly },
  "tenant.integrations.manage": { domain: "tenant", description: "Configurar SSO e integrações", scopes: tenantOnly },
  "tenant.feature_flags.manage": { domain: "tenant", description: "Ligar e desligar recursos da empresa", scopes: tenantOnly },
  "audit.read": { domain: "tenant", description: "Consultar a trilha de auditoria", scopes: tenantOnly },
} as const satisfies Record<string, PermissionDef>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: string): value is Permission {
  return Object.hasOwn(PERMISSIONS, value);
}

/**
 * Capacidades implícitas de qualquer usuário ativo sobre os PRÓPRIOS dados
 * (perfil, cursos, trilhas, pesquisas a responder, PDI próprio…). Não são
 * atribuíveis — derivam de "ser o titular".
 */
export const SELF_CAPABILITIES = [
  "self.profile.read",
  "self.profile.update_allowed_fields",
  "self.learning",
  "self.surveys.respond",
  "self.development",
  "self.achievements",
] as const;
