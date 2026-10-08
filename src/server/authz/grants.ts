import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import * as s from "@/server/db/schema";
import type { Tx } from "@/server/db/tenant";
import { isPermission, type Permission } from "./permissions";
import type { Grant } from "./policy";

/** Carrega as atribuições de papel ativas de um usuário, com suas permissões. */
export async function loadGrants(tx: Tx, userId: string): Promise<Grant[]> {
  const rows = await tx
    .select({
      roleId: s.roles.id,
      roleKey: s.roles.key,
      scope: s.userRoles.scopeType,
      scopeOrgUnitId: s.userRoles.scopeOrgUnitId,
      permissionKey: s.rolePermissions.permissionKey,
    })
    .from(s.userRoles)
    .innerJoin(s.roles, and(eq(s.roles.tenantId, s.userRoles.tenantId), eq(s.roles.id, s.userRoles.roleId)))
    .leftJoin(s.rolePermissions, eq(s.rolePermissions.roleId, s.roles.id))
    .where(and(eq(s.userRoles.userId, userId), isNull(s.userRoles.revokedAt)));

  const byAssignment = new Map<string, { roleId: string; roleKey: string; scope: Grant["scope"]; scopeOrgUnitId: string | null; permissions: Set<Permission> }>();
  for (const row of rows) {
    const key = `${row.roleId}:${row.scope}:${row.scopeOrgUnitId ?? ""}`;
    let entry = byAssignment.get(key);
    if (!entry) {
      entry = { roleId: row.roleId, roleKey: row.roleKey, scope: row.scope, scopeOrgUnitId: row.scopeOrgUnitId, permissions: new Set() };
      byAssignment.set(key, entry);
    }
    // Permissões fora do catálogo (ex.: removidas do código) são ignoradas: fail closed.
    if (row.permissionKey && isPermission(row.permissionKey)) entry.permissions.add(row.permissionKey);
  }
  return [...byAssignment.values()];
}
