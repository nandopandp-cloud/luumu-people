import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, timestamps } from "./_columns";
import { users } from "./auth";
import { roles } from "./access";
import { organizations } from "./tenancy";

export const AUDIT_ACTOR_TYPES = ["user", "system"] as const;

/**
 * Trilha de auditoria. Append-only: a role da aplicação só tem INSERT/SELECT
 * e um trigger rejeita UPDATE/DELETE.
 *
 * NUNCA registrar aqui respostas de pesquisas anônimas, nem qualquer evento que
 * associe uma pessoa a uma resposta anônima (ver docs/anonymous-surveys.md).
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid("actor_user_id"),
    actorType: text("actor_type", { enum: AUDIT_ACTOR_TYPES }).notNull().default("user"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "audit_logs_actor_fk", columns: [t.tenantId, t.actorUserId], foreignColumns: [users.tenantId, users.id] }),
    index("audit_logs_tenant_created_idx").on(t.tenantId, t.createdAt.desc()),
    index("audit_logs_tenant_resource_idx").on(t.tenantId, t.resourceType, t.resourceId),
    index("audit_logs_tenant_actor_idx").on(t.tenantId, t.actorUserId),
  ],
);

/** Definição global de feature flags. */
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
  defaultEnabled: boolean("default_enabled").notNull().default(false),
  ...timestamps(),
});

/**
 * Sobrescritas por escopo. Precedência: usuário > papel > tenant > global > padrão.
 * tenant_id nulo = sobrescrita global (somente plataforma).
 */
export const featureFlagOverrides = pgTable(
  "feature_flag_overrides",
  {
    id: id(),
    flagKey: text("flag_key")
      .notNull()
      .references(() => featureFlags.key, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").references(() => organizations.id),
    roleId: uuid("role_id"),
    userId: uuid("user_id"),
    enabled: boolean("enabled").notNull(),
    updatedBy: uuid("updated_by"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "feature_flag_overrides_role_fk", columns: [t.tenantId, t.roleId], foreignColumns: [roles.tenantId, roles.id] }).onDelete("cascade"),
    foreignKey({ name: "feature_flag_overrides_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    check("feature_flag_overrides_single_target", sql`num_nonnulls(${t.roleId}, ${t.userId}) <= 1`),
    check("feature_flag_overrides_target_needs_tenant", sql`${t.tenantId} is not null or num_nonnulls(${t.roleId}, ${t.userId}) = 0`),
    uniqueIndex("feature_flag_overrides_target_key").on(
      t.flagKey,
      sql`coalesce(${t.tenantId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${t.roleId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      sql`coalesce(${t.userId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
  ],
);

/**
 * Uso da plataforma por pessoa e dia (fuso de Brasília), alimentado pelo sinal
 * de presença (a cada minuto, só com a aba visível). Um novo acesso começa
 * depois de 30 minutos sem sinal; o tempo de uso soma os intervalos entre
 * sinais (no máximo 2 minutos cada). O dashboard só mostra agregados.
 */
export const usageDays = pgTable(
  "usage_days",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    visits: integer("visits").notNull().default(1),
    activeSeconds: integer("active_seconds").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "usage_days_pk", columns: [t.tenantId, t.userId, t.day] }),
    foreignKey({ name: "usage_days_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    index("usage_days_tenant_day_idx").on(t.tenantId, t.day),
    check("usage_days_counters", sql`${t.visits} >= 1 and ${t.activeSeconds} >= 0`),
  ],
);
