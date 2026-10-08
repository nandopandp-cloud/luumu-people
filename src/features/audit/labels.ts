import type { AuditAction } from "@/server/audit/audit";

/** Rótulos humanos das ações de auditoria. */
export const AUDIT_LABELS: Record<AuditAction, string> = {
  "auth.login": "Entrou na plataforma",
  "auth.login_failed": "Tentativa de acesso sem sucesso",
  "auth.logout": "Saiu da plataforma",
  "auth.session_revoked": "Sessão encerrada",
  "auth.password_reset_requested": "Pediu redefinição de senha",
  "auth.password_reset": "Redefiniu a senha",
  "auth.password_changed": "Alterou a senha",
  "auth.account_locked": "Conta bloqueada temporariamente",
  "access.role_granted": "Papel concedido",
  "access.role_revoked": "Papel revogado",
  "people.created": "Pessoa cadastrada",
  "people.updated": "Dados de pessoa alterados",
  "people.deactivated": "Pessoa desativada",
  "people.reactivated": "Pessoa reativada",
  "people.transferred": "Transferência de área",
  "people.manager_changed": "Troca de gestor(a)",
  "people.profile_updated": "Perfil atualizado",
  "org.structure_changed": "Estrutura organizacional alterada",
  "tenant.settings_changed": "Configurações alteradas",
  "tenant.feature_flag_changed": "Recurso ligado/desligado",
  "data.exported": "Exportação de dados",
  "tenant.seeded": "Empresa criada",
};

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action as AuditAction] ?? action;
}

export const ROLE_LABELS: Record<string, string> = {
  employee: "Colaborador",
  manager: "Gestor",
  editor: "Editor",
  people: "G&G / People",
  admin: "Administrador",
};

export const SCOPE_LABELS: Record<string, string> = {
  SELF: "Somente os próprios dados",
  TEAM_DIRECT: "Equipe direta",
  TEAM_TREE: "Equipe (direta e indireta)",
  ORG_UNIT_TREE: "Área específica",
  TENANT: "Toda a empresa",
};
