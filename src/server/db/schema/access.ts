import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, index, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { orgUnits } from "./organization";
import { organizations } from "./tenancy";

/**
 * RBAC com escopo. O catálogo de permissões vive em código
 * (src/server/authz/permissions.ts) e é espelhado aqui para integridade referencial.
 */

export const SCOPE_TYPES = ["SELF", "TEAM_DIRECT", "TEAM_TREE", "ORG_UNIT_TREE", "TENANT"] as const;

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  domain: text("domain").notNull(),
  description: text("description").notNull(),
});

export const roles = pgTable(
  "roles",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").notNull().default(false),
    defaultScope: text("default_scope", { enum: SCOPE_TYPES }).notNull(),
    ...timestamps(),
  },
  (t) => [unique("roles_tenant_id_id_key").on(t.tenantId, t.id), unique("roles_tenant_key_key").on(t.tenantId, t.key)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    tenantId: tenantId(),
    roleId: uuid("role_id").notNull(),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "role_permissions_pkey", columns: [t.roleId, t.permissionKey] }),
    foreignKey({ name: "role_permissions_role_fk", columns: [t.tenantId, t.roleId], foreignColumns: [roles.tenantId, roles.id] }).onDelete("cascade"),
  ],
);

/**
 * Atribuição de papel a usuário, com escopo. Nunca é apagada: a revogação
 * preenche revoked_at/revoked_by, preservando o histórico de acesso.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
    scopeType: text("scope_type", { enum: SCOPE_TYPES }).notNull(),
    scopeOrgUnitId: uuid("scope_org_unit_id"),
    grantedBy: uuid("granted_by"),
    grantedAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    revokedBy: uuid("revoked_by"),
  },
  (t) => [
    foreignKey({ name: "user_roles_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "user_roles_role_fk", columns: [t.tenantId, t.roleId], foreignColumns: [roles.tenantId, roles.id] }),
    foreignKey({ name: "user_roles_scope_org_unit_fk", columns: [t.tenantId, t.scopeOrgUnitId], foreignColumns: [orgUnits.tenantId, orgUnits.id] }),
    foreignKey({ name: "user_roles_granted_by_fk", columns: [t.tenantId, t.grantedBy], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "user_roles_revoked_by_fk", columns: [t.tenantId, t.revokedBy], foreignColumns: [users.tenantId, users.id] }),
    uniqueIndex("user_roles_active_key")
      .on(t.tenantId, t.userId, t.roleId, t.scopeType, sql`coalesce(${t.scopeOrgUnitId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where(sql`${t.revokedAt} is null`),
    index("user_roles_user_active_idx").on(t.tenantId, t.userId).where(sql`${t.revokedAt} is null`),
    check("user_roles_scope_org_unit", sql`(${t.scopeType} = 'ORG_UNIT_TREE') = (${t.scopeOrgUnitId} is not null)`),
    check("user_roles_no_self_grant", sql`${t.grantedBy} is null or ${t.grantedBy} <> ${t.userId}`),
  ],
);
