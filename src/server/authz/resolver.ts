import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { Tx } from "@/server/db/tenant";
import type { Permission } from "./permissions";
import { grantsFor, type Actor, type ScopeResolver } from "./policy";

/**
 * Implementação do ScopeResolver sobre o banco (sempre dentro de withTenant,
 * logo também restrita ao tenant pela RLS).
 */

/** Subconsulta: ids da árvore de subordinados (diretos e indiretos) de um gestor. */
export function teamTreeSql(managerId: string): SQL {
  return sql`(
    with recursive team(user_id) as (
      select mr.user_id from manager_relationships mr where mr.manager_id = ${managerId} and mr.valid_to is null
      union
      select mr.user_id from manager_relationships mr join team t on mr.manager_id = t.user_id where mr.valid_to is null
    ) select user_id from team
  )`;
}

/** Subconsulta: ids dos subordinados diretos. */
export function directReportsSql(managerId: string): SQL {
  return sql`(select mr.user_id from manager_relationships mr where mr.manager_id = ${managerId} and mr.valid_to is null)`;
}

/** Subconsulta: ids das áreas na subárvore de `rootOrgUnitId` (inclusive). */
export function orgSubtreeSql(rootOrgUnitId: string): SQL {
  return sql`(
    with recursive tree(id) as (
      select ou.id from org_units ou where ou.id = ${rootOrgUnitId}
      union
      select ou.id from org_units ou join tree t on ou.parent_id = t.id
    ) select id from tree
  )`;
}

/** Subconsulta: ids de pessoas lotadas (vigente) na subárvore de uma área. */
export function usersInOrgSubtreeSql(rootOrgUnitId: string): SQL {
  return sql`(select ea.user_id from employment_assignments ea where ea.valid_to is null and ea.org_unit_id in ${orgSubtreeSql(rootOrgUnitId)})`;
}

async function exists(tx: Tx, query: SQL): Promise<boolean> {
  const result = await tx.execute(sql`select exists(${query}) as ok`);
  return Boolean((result as unknown as { rows: { ok: boolean }[] }).rows[0]?.ok);
}

export function dbScopeResolver(tx: Tx): ScopeResolver {
  return {
    isDirectReport: (managerId, userId) => exists(tx, sql`select 1 from ${directReportsSql(managerId)} d(user_id) where d.user_id = ${userId}`),
    isInTeamTree: (managerId, userId) => exists(tx, sql`select 1 from ${teamTreeSql(managerId)} t(user_id) where t.user_id = ${userId}`),
    isOrgUnitInTree: (root, unit) => exists(tx, sql`select 1 from ${orgSubtreeSql(root)} t(id) where t.id = ${unit}`),
    isUserInOrgUnitTree: (root, userId) => exists(tx, sql`select 1 from ${usersInOrgSubtreeSql(root)} u(user_id) where u.user_id = ${userId}`),
  };
}

/**
 * Condição SQL "usuário acessível" para listagens, a partir dos escopos do ator
 * para a permissão. Retorna `true` (sem filtro) para escopo TENANT e `false`
 * (nada) quando o ator não tem a permissão.
 */
export function accessibleUsersCondition(actor: Actor, permission: Permission, userIdColumn: SQL): SQL {
  const grants = grantsFor(actor, permission);
  if (grants.some((g) => g.scope === "TENANT")) return sql`true`;
  const parts: SQL[] = [];
  for (const g of grants) {
    switch (g.scope) {
      case "SELF":
        parts.push(sql`${userIdColumn} = ${actor.userId}`);
        break;
      case "TEAM_DIRECT":
        parts.push(sql`${userIdColumn} in ${directReportsSql(actor.userId)}`);
        break;
      case "TEAM_TREE":
        parts.push(sql`${userIdColumn} in ${teamTreeSql(actor.userId)}`);
        break;
      case "ORG_UNIT_TREE":
        if (g.scopeOrgUnitId) parts.push(sql`${userIdColumn} in ${usersInOrgSubtreeSql(g.scopeOrgUnitId)}`);
        break;
    }
  }
  if (parts.length === 0) return sql`false`;
  return sql`(${sql.join(parts, sql` or `)})`;
}
