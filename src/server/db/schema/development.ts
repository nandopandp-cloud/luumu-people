import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, integer, pgTable, primaryKey, smallint, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { archivedAt, id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { positions } from "./organization";
import { organizations } from "./tenancy";

/**
 * Desenvolvimento de pessoas (Fase 3): competências, avaliações (histórico),
 * PDI com metas e ações. "Atrasado" é DERIVADO (prazo vencido e ação aberta),
 * nunca gravado — evita status inconsistente.
 */

export const COMPETENCY_CATEGORIES = ["comportamental", "tecnica", "lideranca"] as const;

export const competencies = pgTable(
  "competencies",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category", { enum: COMPETENCY_CATEGORIES }).notNull(),
    icon: text("icon").notNull().default("target"),
    archivedAt: archivedAt(),
    ...timestamps(),
  },
  (t) => [unique("competencies_tenant_id_id_key").on(t.tenantId, t.id), uniqueIndex("competencies_tenant_name_key").on(t.tenantId, t.name)],
);

/** Nível esperado (0–100) de cada competência por cargo. */
export const positionCompetencies = pgTable(
  "position_competencies",
  {
    tenantId: tenantId(),
    positionId: uuid("position_id").notNull(),
    competencyId: uuid("competency_id").notNull(),
    expectedScore: smallint("expected_score").notNull(),
  },
  (t) => [
    primaryKey({ name: "position_competencies_pkey", columns: [t.positionId, t.competencyId] }),
    foreignKey({ name: "position_competencies_position_fk", columns: [t.tenantId, t.positionId], foreignColumns: [positions.tenantId, positions.id] }).onDelete("cascade"),
    foreignKey({ name: "position_competencies_competency_fk", columns: [t.tenantId, t.competencyId], foreignColumns: [competencies.tenantId, competencies.id] }).onDelete("cascade"),
    check("position_competencies_expected_range", sql`${t.expectedScore} between 0 and 100`),
  ],
);

export const ASSESSMENT_SOURCES = ["self", "manager", "people"] as const;

/** Avaliações de competência — append-only (o histórico alimenta a evolução). */
export const competencyAssessments = pgTable(
  "competency_assessments",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    competencyId: uuid("competency_id").notNull(),
    score: smallint("score").notNull(),
    source: text("source", { enum: ASSESSMENT_SOURCES }).notNull(),
    assessedBy: uuid("assessed_by").notNull(),
    note: text("note"),
    assessedAt: timestamp("assessed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "competency_assessments_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "competency_assessments_assessor_fk", columns: [t.tenantId, t.assessedBy], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "competency_assessments_competency_fk", columns: [t.tenantId, t.competencyId], foreignColumns: [competencies.tenantId, competencies.id] }).onDelete("cascade"),
    index("competency_assessments_latest_idx").on(t.tenantId, t.userId, t.competencyId, t.assessedAt.desc()),
    check("competency_assessments_score_range", sql`${t.score} between 0 and 100`),
  ],
);

export const PDI_STATUSES = ["active", "closed"] as const;

/** Plano de Desenvolvimento Individual — no máximo um ATIVO por pessoa. */
export const pdis = pgTable(
  "pdis",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    status: text("status", { enum: PDI_STATUSES }).notNull().default("active"),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("pdis_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "pdis_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "pdis_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    uniqueIndex("pdis_one_active_per_user").on(t.tenantId, t.userId).where(sql`${t.status} = 'active'`),
    check("pdis_period_range", sql`${t.periodEnd} >= ${t.periodStart}`),
  ],
);

export const GOAL_STATUSES = ["active", "achieved", "cancelled"] as const;

export const pdiGoals = pgTable(
  "pdi_goals",
  {
    id: id(),
    tenantId: tenantId(),
    pdiId: uuid("pdi_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    competencyId: uuid("competency_id"),
    targetDate: date("target_date", { mode: "string" }),
    status: text("status", { enum: GOAL_STATUSES }).notNull().default("active"),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    unique("pdi_goals_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "pdi_goals_pdi_fk", columns: [t.tenantId, t.pdiId], foreignColumns: [pdis.tenantId, pdis.id] }).onDelete("cascade"),
    foreignKey({ name: "pdi_goals_competency_fk", columns: [t.tenantId, t.competencyId], foreignColumns: [competencies.tenantId, competencies.id] }),
    index("pdi_goals_pdi_idx").on(t.pdiId),
  ],
);

export const ACTION_TYPES = ["curso", "mentoria", "projeto", "leitura", "pratica", "feedback", "outro"] as const;
export const ACTION_STATUSES = ["not_started", "in_progress", "done", "cancelled"] as const;

export const pdiActions = pgTable(
  "pdi_actions",
  {
    id: id(),
    tenantId: tenantId(),
    pdiId: uuid("pdi_id").notNull(),
    goalId: uuid("goal_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type", { enum: ACTION_TYPES }).notNull().default("pratica"),
    ownerUserId: uuid("owner_user_id").notNull(),
    dueDate: date("due_date", { mode: "string" }),
    status: text("status", { enum: ACTION_STATUSES }).notNull().default("not_started"),
    evidence: text("evidence"),
    evidenceUrl: text("evidence_url"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "pdi_actions_pdi_fk", columns: [t.tenantId, t.pdiId], foreignColumns: [pdis.tenantId, pdis.id] }).onDelete("cascade"),
    foreignKey({ name: "pdi_actions_goal_fk", columns: [t.tenantId, t.goalId], foreignColumns: [pdiGoals.tenantId, pdiGoals.id] }).onDelete("cascade"),
    foreignKey({ name: "pdi_actions_owner_fk", columns: [t.tenantId, t.ownerUserId], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "pdi_actions_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    index("pdi_actions_goal_idx").on(t.goalId),
    index("pdi_actions_open_due_idx").on(t.tenantId, t.dueDate).where(sql`${t.status} in ('not_started', 'in_progress')`),
    check("pdi_actions_done_has_date", sql`(${t.status} = 'done') = (${t.completedAt} is not null)`),
    check("pdi_actions_evidence_url_https", sql`${t.evidenceUrl} is null or ${t.evidenceUrl} like 'https://%'`),
  ],
);
