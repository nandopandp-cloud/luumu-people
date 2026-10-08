import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { archivedAt, createdAt, id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { organizations } from "./tenancy";

/**
 * Estrutura organizacional.
 *
 *   Empresa (organizations)
 *   ├── Unidades (business_units)         — localidade/filial, ortogonal à hierarquia
 *   ├── Diretoria → Área → Subárea         — org_units (hierarquia)
 *   ├── Cargos (positions) e Níveis (job_levels)
 *   └── Colaborador: users + employee_profiles + employment_assignments (histórico)
 *
 * Toda FK entre tabelas de tenant é composta (tenant_id, id): o banco recusa
 * qualquer referência que cruze empresas, mesmo em caso de bug na aplicação.
 */

export const ORG_UNIT_TYPES = ["directorate", "area", "subarea"] as const;
export type OrgUnitType = (typeof ORG_UNIT_TYPES)[number];

export const businessUnits = pgTable(
  "business_units",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    name: text("name").notNull(),
    code: text("code"),
    city: text("city"),
    state: text("state"),
    archivedAt: archivedAt(),
    ...timestamps(),
  },
  (t) => [
    unique("business_units_tenant_id_id_key").on(t.tenantId, t.id),
    uniqueIndex("business_units_tenant_code_key").on(t.tenantId, t.code).where(sql`${t.code} is not null`),
  ],
);

export const orgUnits = pgTable(
  "org_units",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    parentId: uuid("parent_id"),
    type: text("type", { enum: ORG_UNIT_TYPES }).notNull(),
    name: text("name").notNull(),
    code: text("code"),
    archivedAt: archivedAt(),
    ...timestamps(),
  },
  (t) => [
    unique("org_units_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({
      name: "org_units_parent_fk",
      columns: [t.tenantId, t.parentId],
      foreignColumns: [t.tenantId, t.id],
    }),
    index("org_units_tenant_parent_idx").on(t.tenantId, t.parentId),
    uniqueIndex("org_units_tenant_code_key").on(t.tenantId, t.code).where(sql`${t.code} is not null`),
    check("org_units_root_is_directorate", sql`(${t.type} = 'directorate') = (${t.parentId} is null)`),
    check("org_units_not_self_parent", sql`${t.parentId} is distinct from ${t.id}`),
  ],
);

/** Cargo. */
export const positions = pgTable(
  "positions",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    name: text("name").notNull(),
    code: text("code"),
    isManagerial: boolean("is_managerial").notNull().default(false),
    archivedAt: archivedAt(),
    ...timestamps(),
  },
  (t) => [
    unique("positions_tenant_id_id_key").on(t.tenantId, t.id),
    uniqueIndex("positions_tenant_name_key").on(t.tenantId, t.name),
  ],
);

/** Nível (Júnior, Pleno, Sênior…). `rank` ordena os níveis dentro da empresa. */
export const jobLevels = pgTable(
  "job_levels",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    name: text("name").notNull(),
    rank: integer("rank").notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("job_levels_tenant_id_id_key").on(t.tenantId, t.id),
    uniqueIndex("job_levels_tenant_name_key").on(t.tenantId, t.name),
  ],
);

export const CONTRACT_TYPES = ["clt", "pj", "intern", "apprentice", "temporary"] as const;
export const EMPLOYMENT_STATUSES = ["active", "on_leave", "terminated"] as const;

/**
 * Dados pessoais/de RH do colaborador (1:1 com users).
 * Dados de desenvolvimento (competências, PDI…) ficam em tabelas próprias.
 */
export const employeeProfiles = pgTable(
  "employee_profiles",
  {
    userId: uuid("user_id").notNull(),
    tenantId: tenantId(),
    employeeCode: text("employee_code"),
    preferredName: text("preferred_name"),
    hireDate: date("hire_date", { mode: "string" }).notNull(),
    contractType: text("contract_type", { enum: CONTRACT_TYPES }).notNull().default("clt"),
    employmentStatus: text("employment_status", { enum: EMPLOYMENT_STATUSES }).notNull().default("active"),
    phone: text("phone"),
    headline: text("headline"),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: "employee_profiles_pkey", columns: [t.userId] }),
    foreignKey({
      name: "employee_profiles_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }),
    uniqueIndex("employee_profiles_tenant_code_key")
      .on(t.tenantId, t.employeeCode)
      .where(sql`${t.employeeCode} is not null`),
  ],
);

export const ASSIGNMENT_REASONS = ["hire", "transfer", "promotion", "position_change", "correction", "termination"] as const;

/**
 * Lotação do colaborador (área, unidade, cargo, nível) com vigência.
 * Mudanças fecham o registro atual (valid_to) e abrem um novo — nunca sobrescrevem.
 */
export const employmentAssignments = pgTable(
  "employment_assignments",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    orgUnitId: uuid("org_unit_id").notNull(),
    businessUnitId: uuid("business_unit_id"),
    positionId: uuid("position_id").notNull(),
    jobLevelId: uuid("job_level_id"),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    validTo: date("valid_to", { mode: "string" }),
    reason: text("reason", { enum: ASSIGNMENT_REASONS }).notNull(),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "employment_assignments_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "employment_assignments_org_unit_fk", columns: [t.tenantId, t.orgUnitId], foreignColumns: [orgUnits.tenantId, orgUnits.id] }),
    foreignKey({ name: "employment_assignments_business_unit_fk", columns: [t.tenantId, t.businessUnitId], foreignColumns: [businessUnits.tenantId, businessUnits.id] }),
    foreignKey({ name: "employment_assignments_position_fk", columns: [t.tenantId, t.positionId], foreignColumns: [positions.tenantId, positions.id] }),
    foreignKey({ name: "employment_assignments_job_level_fk", columns: [t.tenantId, t.jobLevelId], foreignColumns: [jobLevels.tenantId, jobLevels.id] }),
    foreignKey({ name: "employment_assignments_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    uniqueIndex("employment_assignments_one_current").on(t.tenantId, t.userId).where(sql`${t.validTo} is null`),
    index("employment_assignments_org_unit_idx").on(t.tenantId, t.orgUnitId).where(sql`${t.validTo} is null`),
    check("employment_assignments_valid_range", sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
  ],
);

/** Relação colaborador → gestor, com vigência (mesma regra de histórico). */
export const managerRelationships = pgTable(
  "manager_relationships",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    managerId: uuid("manager_id").notNull(),
    validFrom: date("valid_from", { mode: "string" }).notNull(),
    validTo: date("valid_to", { mode: "string" }),
    createdBy: uuid("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "manager_relationships_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "manager_relationships_manager_fk", columns: [t.tenantId, t.managerId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "manager_relationships_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    uniqueIndex("manager_relationships_one_current").on(t.tenantId, t.userId).where(sql`${t.validTo} is null`),
    index("manager_relationships_manager_idx").on(t.tenantId, t.managerId).where(sql`${t.validTo} is null`),
    check("manager_relationships_not_self", sql`${t.userId} <> ${t.managerId}`),
    check("manager_relationships_valid_range", sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
  ],
);

export const orgTags = pgTable(
  "org_tags",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    name: text("name").notNull(),
    ...timestamps(),
  },
  (t) => [unique("org_tags_tenant_id_id_key").on(t.tenantId, t.id), uniqueIndex("org_tags_tenant_name_key").on(t.tenantId, t.name)],
);

export const userOrgTags = pgTable(
  "user_org_tags",
  {
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: "user_org_tags_pkey", columns: [t.tenantId, t.userId, t.tagId] }),
    foreignKey({ name: "user_org_tags_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "user_org_tags_tag_fk", columns: [t.tenantId, t.tagId], foreignColumns: [orgTags.tenantId, orgTags.id] }).onDelete("cascade"),
  ],
);

/** Quais campos do perfil o próprio colaborador pode editar (configurável por empresa). */
export const PROFILE_FIELDS = ["preferredName", "phone", "headline", "image"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const profileFieldPolicies = pgTable(
  "profile_field_policies",
  {
    tenantId: tenantId().references(() => organizations.id),
    fieldKey: text("field_key", { enum: PROFILE_FIELDS }).notNull(),
    editableByEmployee: boolean("editable_by_employee").notNull().default(false),
    ...timestamps(),
  },
  (t) => [primaryKey({ name: "profile_field_policies_pkey", columns: [t.tenantId, t.fieldKey] })],
);
