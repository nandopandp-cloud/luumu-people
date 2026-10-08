import "server-only";
import * as s from "@/server/db/schema";
import type { Tx } from "@/server/db/tenant";

/**
 * Ações auditáveis. Lista fechada: facilita relatórios e evita registrar
 * eventos que não deveriam existir (ex.: envio de resposta anônima).
 */
export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "auth.session_revoked",
  "auth.password_reset_requested",
  "auth.password_reset",
  "auth.account_locked",
  "auth.two_factor_enabled",
  "auth.two_factor_disabled",
  "access.role_granted",
  "access.role_revoked",
  "people.created",
  "people.updated",
  "people.deactivated",
  "people.reactivated",
  "people.transferred",
  "people.manager_changed",
  "people.profile_updated",
  "org.structure_changed",
  "tenant.settings_changed",
  "tenant.feature_flag_changed",
  "data.exported",
  "tenant.seeded",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntry = {
  tenantId: string;
  actorUserId: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  /** Nunca incluir senhas, tokens ou conteúdo de respostas de pesquisa. */
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

const FORBIDDEN_METADATA_KEYS = /password|token|secret|answer|response|cookie|authorization/i;

/** Remove chaves sensíveis por defesa em profundidade. */
export function sanitizeMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !FORBIDDEN_METADATA_KEYS.test(key)));
}

/** Registra na trilha de auditoria dentro da transação do tenant (atomicidade com a ação). */
export async function recordAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.insert(s.auditLogs).values({
    tenantId: entry.tenantId,
    actorUserId: entry.actorUserId,
    actorType: entry.actorUserId ? "user" : "system",
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: sanitizeMetadata(entry.metadata),
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent?.slice(0, 512) ?? null,
    requestId: entry.requestId ?? null,
  });
}
