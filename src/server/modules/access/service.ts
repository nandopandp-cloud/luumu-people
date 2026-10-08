import "server-only";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import { revokeUserSessions, type AuthenticatedActor } from "@/server/auth/session";
import { isPermission, PERMISSIONS, type Permission } from "@/server/authz/permissions";
import { canGrantRole } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import type { RoleGrantInput } from "./schemas";

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

const REASON_MESSAGES = {
  self_assignment: "Você não pode alterar os seus próprios papéis.",
  missing_assign_permission: "Você não tem permissão para atribuir papéis.",
  privilege_escalation: "Este papel concede permissões que você não possui.",
} as const;

export async function listRoles(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const roles = await tx
      .select({ id: s.roles.id, key: s.roles.key, name: s.roles.name, description: s.roles.description, isSystem: s.roles.isSystem, defaultScope: s.roles.defaultScope })
      .from(s.roles)
      .orderBy(asc(s.roles.name));
    const perms = await tx.select({ roleId: s.rolePermissions.roleId, key: s.rolePermissions.permissionKey }).from(s.rolePermissions);
    return roles.map((r) => ({ ...r, permissions: perms.filter((p) => p.roleId === r.id).map((p) => p.key) }));
  });
}

async function rolePermissions(tx: Tx, roleId: string): Promise<Permission[]> {
  const rows = await tx.select({ key: s.rolePermissions.permissionKey }).from(s.rolePermissions).where(eq(s.rolePermissions.roleId, roleId));
  return rows.map((r) => r.key).filter(isPermission);
}

export async function listUserRoles(actor: AuthenticatedActor, userId: string) {
  return withTenant(actor, (tx) =>
    tx
      .select({
        id: s.userRoles.id,
        roleId: s.roles.id,
        roleKey: s.roles.key,
        roleName: s.roles.name,
        scopeType: s.userRoles.scopeType,
        scopeOrgUnitId: s.userRoles.scopeOrgUnitId,
        grantedAt: s.userRoles.grantedAt,
      })
      .from(s.userRoles)
      .innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
      .where(and(eq(s.userRoles.userId, userId), isNull(s.userRoles.revokedAt))),
  );
}

export async function grantRole(actor: AuthenticatedActor, targetUserId: string, input: RoleGrantInput, meta: Meta) {
  const result = await withTenant(actor, async (tx) => {
    const [role] = await tx.select({ id: s.roles.id, key: s.roles.key }).from(s.roles).where(eq(s.roles.id, input.roleId));
    if (!role) throw notFound("Papel não encontrado.");
    const [target] = await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, targetUserId));
    if (!target) throw notFound("Pessoa não encontrada.");

    const permissions = await rolePermissions(tx, role.id);
    const invalidScope = permissions.find((p) => !(PERMISSIONS[p].scopes as readonly string[]).includes(input.scopeType));
    if (invalidScope && permissions.length > 0) {
      throw badRequest(`O escopo ${input.scopeType} não se aplica a este papel.`);
    }

    const decision = canGrantRole(actor, {
      targetUserId,
      rolePermissions: permissions,
      scope: input.scopeType,
      scopeOrgUnitId: input.scopeOrgUnitId ?? null,
    });
    if (!decision.ok) throw forbidden(REASON_MESSAGES[decision.reason]);

    const existing = await tx
      .select({ id: s.userRoles.id })
      .from(s.userRoles)
      .where(and(eq(s.userRoles.userId, targetUserId), eq(s.userRoles.roleId, role.id), eq(s.userRoles.scopeType, input.scopeType), isNull(s.userRoles.revokedAt)));
    if (existing.length > 0) throw conflict("Esta pessoa já possui este papel com este escopo.");

    const [created] = await tx
      .insert(s.userRoles)
      .values({
        tenantId: actor.tenantId,
        userId: targetUserId,
        roleId: role.id,
        scopeType: input.scopeType,
        scopeOrgUnitId: input.scopeOrgUnitId ?? null,
        grantedBy: actor.userId,
      })
      .returning({ id: s.userRoles.id });

    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "access.role_granted",
      resourceType: "user",
      resourceId: targetUserId,
      metadata: { role: role.key, scope: input.scopeType, scopeOrgUnitId: input.scopeOrgUnitId ?? null },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
    return { id: created!.id };
  });
  // Novas permissões exigem nova sessão (evita sessões com privilégios defasados).
  await revokeUserSessions(targetUserId);
  return result;
}

export async function revokeRole(actor: AuthenticatedActor, targetUserId: string, assignmentId: string, meta: Meta) {
  await withTenant(actor, async (tx) => {
    const [assignment] = await tx
      .select({ id: s.userRoles.id, roleId: s.userRoles.roleId, roleKey: s.roles.key, scope: s.userRoles.scopeType, scopeOrgUnitId: s.userRoles.scopeOrgUnitId })
      .from(s.userRoles)
      .innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
      .where(and(eq(s.userRoles.id, assignmentId), eq(s.userRoles.userId, targetUserId), isNull(s.userRoles.revokedAt)));
    if (!assignment) throw notFound("Atribuição não encontrada.");

    // Mesma regra da concessão: só revoga quem poderia conceder.
    const decision = canGrantRole(actor, {
      targetUserId,
      rolePermissions: await rolePermissions(tx, assignment.roleId),
      scope: assignment.scope,
      scopeOrgUnitId: assignment.scopeOrgUnitId,
    });
    if (!decision.ok) throw forbidden(REASON_MESSAGES[decision.reason]);

    if (assignment.roleKey === "employee") throw conflict("O papel Colaborador é a base de todo usuário e não pode ser removido.");
    if (assignment.roleKey === "admin") {
      const [{ value }] = await tx
        .select({ value: count() })
        .from(s.userRoles)
        .innerJoin(s.roles, eq(s.roles.id, s.userRoles.roleId))
        .innerJoin(s.users, eq(s.users.id, s.userRoles.userId))
        .where(and(eq(s.roles.key, "admin"), isNull(s.userRoles.revokedAt), inArray(s.users.status, ["active"])));
      if (value <= 1) throw conflict("A empresa precisa de pelo menos um Administrador ativo.");
    }

    await tx.update(s.userRoles).set({ revokedAt: new Date(), revokedBy: actor.userId }).where(eq(s.userRoles.id, assignment.id));
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "access.role_revoked",
      resourceType: "user",
      resourceId: targetUserId,
      metadata: { role: assignment.roleKey, scope: assignment.scope },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  });
  await revokeUserSessions(targetUserId);
}
