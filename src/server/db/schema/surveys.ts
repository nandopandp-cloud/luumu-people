import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { organizations } from "./tenancy";

/**
 * Pesquisas (Fase 4) — parte CORE. As respostas anônimas NÃO ficam aqui: vivem
 * no schema `survey_vault` (migration de segurança), sem identidade, sem
 * timestamp e sem FK para estas tabelas. Ver docs/anonymous-surveys.md.
 *
 * Simplificação desta versão: a pesquisa é a própria campanha (uma aplicação
 * por pesquisa). Lançada, ela congela perguntas, k e dimensões.
 */

export const SURVEY_KINDS = ["climate", "enps", "pulse", "custom"] as const;
export const SURVEY_STATUSES = ["draft", "active", "closed"] as const;
export const ANONYMITY_MODES = ["anonymous", "identified"] as const;
export const QUESTION_TYPES = ["scale", "enps", "choice", "text"] as const;
/** Dimensões de segmentação calculadas no envio, já generalizadas. */
export const SURVEY_DIMENSIONS = ["diretoria", "area", "tempo_de_casa"] as const;

export type SurveyKind = (typeof SURVEY_KINDS)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type SurveyDimension = (typeof SURVEY_DIMENSIONS)[number];
/** Valores aprovados no lançamento (≥ k convidados). O resto vira "Outros". */
export type ApprovedDimensions = Partial<Record<SurveyDimension, string[]>>;

export const surveys = pgTable(
  "surveys",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind", { enum: SURVEY_KINDS }).notNull().default("custom"),
    anonymityMode: text("anonymity_mode", { enum: ANONYMITY_MODES }).notNull().default("anonymous"),
    status: text("status", { enum: SURVEY_STATUSES }).notNull().default("draft"),
    /** k-anonimato da pesquisa: nunca menor que o da empresa; congela no lançamento e só pode subir. */
    anonymityK: integer("anonymity_k").notNull().default(5),
    dimensions: jsonb("dimensions").$type<ApprovedDimensions>().notNull().default({}),
    closesAt: timestamp("closes_at", { withTimezone: true, mode: "date" }),
    launchedAt: timestamp("launched_at", { withTimezone: true, mode: "date" }),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by"),
    ...timestamps(),
  },
  (t) => [
    unique("surveys_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "surveys_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    index("surveys_tenant_status_idx").on(t.tenantId, t.status),
    check("surveys_k_check", sql`${t.anonymityK} in (5, 7, 10)`),
    check("surveys_launched_has_dates", sql`${t.status} = 'draft' or (${t.launchedAt} is not null and ${t.closesAt} is not null)`),
    check("surveys_closed_has_date", sql`${t.status} <> 'closed' or ${t.closedAt} is not null`),
  ],
);

export const surveyQuestions = pgTable(
  "survey_questions",
  {
    id: id(),
    tenantId: tenantId(),
    surveyId: uuid("survey_id").notNull(),
    position: integer("position").notNull(),
    type: text("type", { enum: QUESTION_TYPES }).notNull(),
    text: text("text").notNull(),
    /** Opções de múltipla escolha (somente type = 'choice'). */
    options: jsonb("options").$type<string[]>(),
    required: boolean("required").notNull().default(true),
  },
  (t) => [
    unique("survey_questions_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "survey_questions_survey_fk", columns: [t.tenantId, t.surveyId], foreignColumns: [surveys.tenantId, surveys.id] }).onDelete("cascade"),
    uniqueIndex("survey_questions_position_key").on(t.surveyId, t.position),
    check("survey_questions_options_by_type", sql`(${t.type} = 'choice') = (${t.options} is not null)`),
  ],
);

export const INVITATION_STATUSES = ["pending", "completed"] as const;

/**
 * Convite (participação). Guarda só a DATA de conclusão e não tem timestamps:
 * nada aqui permite correlacionar a conclusão com uma resposta no cofre.
 */
export const surveyInvitations = pgTable(
  "survey_invitations",
  {
    id: id(),
    tenantId: tenantId(),
    surveyId: uuid("survey_id").notNull(),
    userId: uuid("user_id").notNull(),
    status: text("status", { enum: INVITATION_STATUSES }).notNull().default("pending"),
    completedOn: date("completed_on", { mode: "string" }),
  },
  (t) => [
    foreignKey({ name: "survey_invitations_survey_fk", columns: [t.tenantId, t.surveyId], foreignColumns: [surveys.tenantId, surveys.id] }).onDelete("cascade"),
    foreignKey({ name: "survey_invitations_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    unique("survey_invitations_survey_user_key").on(t.surveyId, t.userId),
    index("survey_invitations_user_idx").on(t.tenantId, t.userId, t.status),
    check("survey_invitations_completed_has_date", sql`(${t.status} = 'completed') = (${t.completedOn} is not null)`),
  ],
);
