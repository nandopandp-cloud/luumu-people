import { SCOPE_RANK, type Permission, type Scope } from "./permissions";

/**
 * Motor de autorização — funções puras, sem I/O. O acesso a dados de escopo
 * (hierarquia de gestores, árvore de áreas) é injetado via ScopeResolver, o que
 * permite testar todas as regras sem banco.
 *
 * Regra de ouro: toda decisão acontece no servidor. A UI só esconde o que o
 * servidor já nega.
 */

export type Grant = {
  readonly roleId: string;
  readonly roleKey: string;
  readonly permissions: ReadonlySet<Permission>;
  readonly scope: Scope;
  readonly scopeOrgUnitId: string | null;
};

export type Actor = {
  readonly userId: string;
  readonly tenantId: string;
  readonly grants: readonly Grant[];
};

export type Target =
  /** Recurso de toda a empresa (configurações, relatórios gerais…). */
  | { readonly kind: "tenant" }
  /** Dados de um colaborador específico. */
  | { readonly kind: "user"; readonly userId: string }
  /** Dados agregados de uma área (e subárvore). */
  | { readonly kind: "orgUnit"; readonly orgUnitId: string }
  /** Dados agregados da equipe do próprio ator. */
  | { readonly kind: "ownTeam" };

export interface ScopeResolver {
  isDirectReport(managerId: string, userId: string): Promise<boolean>;
  isInTeamTree(managerId: string, userId: string): Promise<boolean>;
  isUserInOrgUnitTree(rootOrgUnitId: string, userId: string): Promise<boolean>;
  isOrgUnitInTree(rootOrgUnitId: string, orgUnitId: string): Promise<boolean>;
}

export function grantsFor(actor: Actor, permission: Permission): Grant[] {
  return actor.grants.filter((g) => g.permissions.has(permission));
}

/** Tem a permissão em algum escopo? Usado para navegação — nunca como autorização final. */
export function hasPermissionAnywhere(actor: Actor, permission: Permission): boolean {
  return grantsFor(actor, permission).length > 0;
}

export function hasTenantWide(actor: Actor, permission: Permission): boolean {
  return grantsFor(actor, permission).some((g) => g.scope === "TENANT");
}

async function grantCovers(grant: Grant, actor: Actor, target: Target, resolver: ScopeResolver): Promise<boolean> {
  if (grant.scope === "TENANT") return true;

  switch (target.kind) {
    case "tenant":
      return false;
    case "ownTeam":
      return grant.scope === "TEAM_DIRECT" || grant.scope === "TEAM_TREE";
    case "orgUnit":
      return (
        grant.scope === "ORG_UNIT_TREE" &&
        grant.scopeOrgUnitId !== null &&
        resolver.isOrgUnitInTree(grant.scopeOrgUnitId, target.orgUnitId)
      );
    case "user":
      switch (grant.scope) {
        case "SELF":
          return target.userId === actor.userId;
        case "TEAM_DIRECT":
          return resolver.isDirectReport(actor.userId, target.userId);
        case "TEAM_TREE":
          return resolver.isInTeamTree(actor.userId, target.userId);
        case "ORG_UNIT_TREE":
          return grant.scopeOrgUnitId !== null && resolver.isUserInOrgUnitTree(grant.scopeOrgUnitId, target.userId);
      }
  }
}

export async function can(actor: Actor, permission: Permission, target: Target, resolver: ScopeResolver): Promise<boolean> {
  // Ordena do mais amplo para o mais restrito: menos consultas de escopo.
  const grants = grantsFor(actor, permission).sort((a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope]);
  for (const grant of grants) {
    if (await grantCovers(grant, actor, target, resolver)) return true;
  }
  return false;
}

export type GrantRoleRequest = {
  readonly targetUserId: string;
  readonly rolePermissions: readonly Permission[];
  readonly scope: Scope;
  readonly scopeOrgUnitId: string | null;
};

export type GrantRoleDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "self_assignment" | "missing_assign_permission" | "privilege_escalation" };

/**
 * Prevenção de escalonamento de privilégio:
 *  1. ninguém altera os próprios papéis;
 *  2. exige access.roles.assign com escopo TENANT;
 *  3. o ator precisa possuir CADA permissão do papel concedido, em escopo
 *     igual ou mais amplo que o escopo concedido.
 */
export function canGrantRole(actor: Actor, request: GrantRoleRequest): GrantRoleDecision {
  if (request.targetUserId === actor.userId) return { ok: false, reason: "self_assignment" };
  if (!hasTenantWide(actor, "access.roles.assign")) return { ok: false, reason: "missing_assign_permission" };

  for (const permission of request.rolePermissions) {
    const covered = grantsFor(actor, permission).some((g) => {
      if (g.scope === "TENANT") return true;
      if (request.scope === "ORG_UNIT_TREE") {
        return g.scope === "ORG_UNIT_TREE" && g.scopeOrgUnitId === request.scopeOrgUnitId;
      }
      return SCOPE_RANK[g.scope] >= SCOPE_RANK[request.scope] && g.scope !== "ORG_UNIT_TREE";
    });
    if (!covered) return { ok: false, reason: "privilege_escalation" };
  }
  return { ok: true };
}
