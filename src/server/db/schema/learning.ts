import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, integer, pgTable, primaryKey, smallint, text, timestamp, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, tenantId, timestamps } from "./_columns";
import { users } from "./auth";
import { files } from "./files";
import { organizations } from "./tenancy";

/**
 * Experiência do colaborador (Fase 2): comunicados, aprendizagem, biblioteca,
 * check-in de humor e conquistas.
 *
 * Capas: até a chegada do upload de arquivos (storage privado + URL assinada),
 * cada item define um TEMA de cor e uma ILUSTRAÇÃO do design system.
 */

export const CONTENT_STATUSES = ["draft", "in_review", "approved", "published", "archived"] as const;
export const THEMES = ["purple", "green", "orange", "blue", "pink", "yellow"] as const;
export const ILLUSTRATIONS = ["megaphone", "people", "plant", "shield", "heart", "calendar", "trophy", "book", "target", "lightbulb", "chat", "compass"] as const;
export type Theme = (typeof THEMES)[number];
export type Illustration = (typeof ILLUSTRATIONS)[number];

export const ANNOUNCEMENT_CATEGORIES = ["institucional", "gente_gestao", "desenvolvimento", "treinamento", "evento", "cultura", "seguranca", "bem_estar"] as const;

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    body: text("body"),
    category: text("category", { enum: ANNOUNCEMENT_CATEGORIES }).notNull(),
    theme: text("theme", { enum: THEMES }).notNull().default("purple"),
    illustration: text("illustration", { enum: ILLUSTRATIONS }).notNull().default("megaphone"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    /** Fixado no topo do mural. */
    pinned: boolean("pinned").notNull().default(false),
    /** Imagem de capa (arquivo privado, finalidade announcement_cover). Sem ela, tema + ilustração. */
    coverFileId: uuid("cover_file_id"),
    /** Publicação agendada quando no futuro. */
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by"),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "announcements_created_by_fk", columns: [t.tenantId, t.createdBy], foreignColumns: [users.tenantId, users.id] }),
    foreignKey({ name: "announcements_cover_file_fk", columns: [t.tenantId, t.coverFileId], foreignColumns: [files.tenantId, files.id] }),
    index("announcements_feed_idx").on(t.tenantId, t.status, t.publishedAt.desc()),
    check("announcements_published_has_date", sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
  ],
);

export const COURSE_KINDS = ["course", "video", "quiz"] as const;

export const courses = pgTable(
  "courses",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind", { enum: COURSE_KINDS }).notNull().default("course"),
    category: text("category"),
    coverFileId: uuid("cover_file_id"),
    durationMinutes: integer("duration_minutes").notNull(),
    mandatory: boolean("mandatory").notNull().default(false),
    theme: text("theme", { enum: THEMES }).notNull().default("purple"),
    illustration: text("illustration", { enum: ILLUSTRATIONS }).notNull().default("book"),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    ...timestamps(),
  },
  (t) => [
    unique("courses_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "courses_cover_file_fk", columns: [t.tenantId, t.coverFileId], foreignColumns: [files.tenantId, files.id] }),
    index("courses_tenant_status_idx").on(t.tenantId, t.status),
    check("courses_duration_positive", sql`${t.durationMinutes} > 0`),
  ],
);

export const learningPaths = pgTable(
  "learning_paths",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    title: text("title").notNull(),
    description: text("description"),
    category: text("category"),
    theme: text("theme", { enum: THEMES }).notNull().default("purple"),
    illustration: text("illustration", { enum: ILLUSTRATIONS }).notNull().default("compass"),
    featured: boolean("featured").notNull().default(false),
    /** Ordem de exibição definida pela curadoria (menor primeiro). */
    displayOrder: integer("display_order").notNull().default(0),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    ...timestamps(),
  },
  (t) => [unique("learning_paths_tenant_id_id_key").on(t.tenantId, t.id), index("learning_paths_tenant_status_idx").on(t.tenantId, t.status)],
);

/** Cursos de uma trilha, em ordem. */
export const learningPathCourses = pgTable(
  "learning_path_courses",
  {
    tenantId: tenantId(),
    pathId: uuid("path_id").notNull(),
    courseId: uuid("course_id").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    primaryKey({ name: "learning_path_courses_pkey", columns: [t.pathId, t.courseId] }),
    foreignKey({ name: "learning_path_courses_path_fk", columns: [t.tenantId, t.pathId], foreignColumns: [learningPaths.tenantId, learningPaths.id] }).onDelete("cascade"),
    foreignKey({ name: "learning_path_courses_course_fk", columns: [t.tenantId, t.courseId], foreignColumns: [courses.tenantId, courses.id] }).onDelete("cascade"),
    uniqueIndex("learning_path_courses_position_key").on(t.pathId, t.position),
    index("learning_path_courses_course_idx").on(t.courseId),
  ],
);

export const ENROLLMENT_STATUSES = ["not_started", "in_progress", "completed"] as const;
export const ENROLLMENT_SOURCES = ["assigned", "self", "recommended"] as const;

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    courseId: uuid("course_id").notNull(),
    status: text("status", { enum: ENROLLMENT_STATUSES }).notNull().default("not_started"),
    progressPct: smallint("progress_pct").notNull().default(0),
    source: text("source", { enum: ENROLLMENT_SOURCES }).notNull().default("self"),
    dueDate: date("due_date", { mode: "string" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "enrollments_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "enrollments_course_fk", columns: [t.tenantId, t.courseId], foreignColumns: [courses.tenantId, courses.id] }).onDelete("cascade"),
    unique("enrollments_user_course_key").on(t.userId, t.courseId),
    index("enrollments_user_status_idx").on(t.tenantId, t.userId, t.status),
    check("enrollments_progress_range", sql`${t.progressPct} between 0 and 100`),
    check(
      "enrollments_status_progress",
      sql`(${t.status} = 'completed') = (${t.progressPct} = 100) and (${t.status} <> 'not_started' or ${t.progressPct} = 0)`,
    ),
  ],
);

export const LIBRARY_TYPES = ["video", "article", "podcast", "quiz", "pdf", "template", "checklist"] as const;

export const libraryItems = pgTable(
  "library_items",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    type: text("type", { enum: LIBRARY_TYPES }).notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    durationMinutes: integer("duration_minutes"),
    featured: boolean("featured").notNull().default(false),
    status: text("status", { enum: CONTENT_STATUSES }).notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    ...timestamps(),
  },
  (t) => [index("library_items_feed_idx").on(t.tenantId, t.status, t.featured)],
);

/**
 * Check-in de humor — IDENTIFICADO (decisão de produto), mas dado
 * potencialmente de saúde (LGPD art. 11): a RLS só deixa cada pessoa ver e
 * gravar o PRÓPRIO registro. Agregados para G&G virão por função com k-anonimato.
 */
export const moodCheckins = pgTable(
  "mood_checkins",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    checkinDate: date("checkin_date", { mode: "string" }).notNull(),
    mood: smallint("mood").notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({ name: "mood_checkins_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    unique("mood_checkins_user_date_key").on(t.userId, t.checkinDate),
    check("mood_checkins_mood_range", sql`${t.mood} between 1 and 5`),
  ],
);

export const achievements = pgTable(
  "achievements",
  {
    id: id(),
    tenantId: tenantId().references(() => organizations.id),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    theme: text("theme", { enum: THEMES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("achievements_tenant_id_id_key").on(t.tenantId, t.id), unique("achievements_tenant_key_key").on(t.tenantId, t.key)],
);

export const userAchievements = pgTable(
  "user_achievements",
  {
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    achievementId: uuid("achievement_id").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "user_achievements_pkey", columns: [t.userId, t.achievementId] }),
    foreignKey({ name: "user_achievements_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "user_achievements_achievement_fk", columns: [t.tenantId, t.achievementId], foreignColumns: [achievements.tenantId, achievements.id] }).onDelete("cascade"),
  ],
);

/** Módulos de um curso, em ordem. */
export const courseModules = pgTable(
  "course_modules",
  {
    id: id(),
    tenantId: tenantId(),
    courseId: uuid("course_id").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    ...timestamps(),
  },
  (t) => [
    unique("course_modules_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "course_modules_course_fk", columns: [t.tenantId, t.courseId], foreignColumns: [courses.tenantId, courses.id] }).onDelete("cascade"),
    uniqueIndex("course_modules_position_key").on(t.courseId, t.position),
  ],
);

export const LESSON_TYPES = ["article", "video", "pdf", "link"] as const;

/**
 * Aula. Conteúdo conforme o tipo:
 *  - article: texto (renderizado como texto, nunca como HTML)
 *  - video:   URL do YouTube/Vimeo (incorporada em iframe com sandbox)
 *  - pdf:     arquivo privado (files)
 *  - link:    URL externa https
 */
export const lessons = pgTable(
  "lessons",
  {
    id: id(),
    tenantId: tenantId(),
    courseId: uuid("course_id").notNull(),
    moduleId: uuid("module_id").notNull(),
    title: text("title").notNull(),
    type: text("type", { enum: LESSON_TYPES }).notNull(),
    position: integer("position").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    body: text("body"),
    videoUrl: text("video_url"),
    externalUrl: text("external_url"),
    fileId: uuid("file_id"),
    ...timestamps(),
  },
  (t) => [
    unique("lessons_tenant_id_id_key").on(t.tenantId, t.id),
    foreignKey({ name: "lessons_course_fk", columns: [t.tenantId, t.courseId], foreignColumns: [courses.tenantId, courses.id] }).onDelete("cascade"),
    foreignKey({ name: "lessons_module_fk", columns: [t.tenantId, t.moduleId], foreignColumns: [courseModules.tenantId, courseModules.id] }).onDelete("cascade"),
    foreignKey({ name: "lessons_file_fk", columns: [t.tenantId, t.fileId], foreignColumns: [files.tenantId, files.id] }),
    uniqueIndex("lessons_position_key").on(t.courseId, t.position),
    check("lessons_duration_positive", sql`${t.durationMinutes} > 0`),
    check(
      "lessons_content_by_type",
      sql`(${t.type} = 'article' and ${t.body} is not null) or (${t.type} = 'video' and ${t.videoUrl} is not null) or (${t.type} = 'pdf' and ${t.fileId} is not null) or (${t.type} = 'link' and ${t.externalUrl} like 'https://%')`,
    ),
  ],
);

/** Aulas concluídas por pessoa (fonte do progresso das matrículas). */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    lessonId: uuid("lesson_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "lesson_progress_pkey", columns: [t.userId, t.lessonId] }),
    foreignKey({ name: "lesson_progress_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "lesson_progress_lesson_fk", columns: [t.tenantId, t.lessonId], foreignColumns: [lessons.tenantId, lessons.id] }).onDelete("cascade"),
    index("lesson_progress_user_completed_idx").on(t.tenantId, t.userId, t.completedAt),
  ],
);

/** Certificado emitido ao concluir um curso. `code` permite verificação. */
export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id").notNull(),
    courseId: uuid("course_id").notNull(),
    code: text("code").notNull().unique(),
    issuedAt: timestamp("issued_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: "certificates_user_fk", columns: [t.tenantId, t.userId], foreignColumns: [users.tenantId, users.id] }).onDelete("cascade"),
    foreignKey({ name: "certificates_course_fk", columns: [t.tenantId, t.courseId], foreignColumns: [courses.tenantId, courses.id] }).onDelete("cascade"),
    unique("certificates_user_course_key").on(t.userId, t.courseId),
  ],
);
