import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import * as s from "../schema";
import type { Illustration, Theme } from "../schema/learning";

/**
 * Conteúdo de EXEMPLO da experiência do colaborador (comunicados, trilhas,
 * cursos, biblioteca e conquistas) + matrículas de demonstração.
 *
 * Fonte única desse conteúdo: nenhum componente contém estes textos.
 * Idempotente por tenant (não duplica se já houver comunicados).
 */

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const isoDateIn = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

const ANNOUNCEMENTS: { title: string; summary: string; category: (typeof s.ANNOUNCEMENT_CATEGORIES)[number]; theme: Theme; illustration: Illustration; daysAgo: number }[] = [
  { title: "Nova política de trabalho híbrido", summary: "Confira as diretrizes e dúvidas mais frequentes.", category: "institucional", theme: "purple", illustration: "megaphone", daysAgo: 0 },
  { title: "Semana da Diversidade", summary: "Uma semana de conversas, aprendizado e experiências.", category: "gente_gestao", theme: "orange", illustration: "people", daysAgo: 1 },
  { title: "Inscrições abertas para a Escola de Líderes", summary: "Desenvolva suas habilidades de liderança com a gente.", category: "desenvolvimento", theme: "green", illustration: "plant", daysAgo: 2 },
  { title: "Programa de Saúde Mental", summary: "Conheça as iniciativas de apoio emocional e participe.", category: "bem_estar", theme: "pink", illustration: "heart", daysAgo: 5 },
];

type CourseSeed = { key: string; title: string; kind?: "course" | "video" | "quiz"; minutes: number; mandatory?: boolean; theme?: Theme; illustration?: Illustration };

const PATHS: { title: string; category: string; theme: Theme; illustration: Illustration; featured?: boolean; courses: CourseSeed[] }[] = [
  {
    title: "Desenvolvimento de Liderança",
    category: "Liderança",
    theme: "purple",
    illustration: "compass",
    featured: true,
    courses: [
      { key: "lid-fundamentos", title: "Fundamentos da liderança", minutes: 120 },
      { key: "lid-feedback", title: "Feedback que transforma", minutes: 120 },
      { key: "lid-delegacao", title: "Delegação e autonomia", minutes: 120 },
      { key: "lid-remoto", title: "Liderança de times remotos", minutes: 120 },
      { key: "lid-conversas", title: "Conversas difíceis", minutes: 120 },
      { key: "lid-pessoas", title: "Desenvolvendo pessoas", minutes: 120 },
    ],
  },
  {
    title: "Comunicação Eficaz",
    category: "Comunicação",
    theme: "green",
    illustration: "chat",
    featured: true,
    courses: [
      { key: "com-cnv", title: "Comunicação Não Violenta", minutes: 120 },
      { key: "com-escuta", title: "Escuta ativa", minutes: 120 },
      { key: "com-apresentacoes", title: "Apresentações que engajam", minutes: 120 },
      { key: "com-escrita", title: "Escrita clara no trabalho", minutes: 120 },
    ],
  },
  {
    title: "Inteligência Emocional",
    category: "Desenvolvimento pessoal",
    theme: "orange",
    illustration: "heart",
    featured: true,
    courses: [
      { key: "ie-autoconhecimento", title: "Autoconhecimento", minutes: 120 },
      { key: "ie-autorregulacao", title: "Autorregulação", minutes: 120 },
      { key: "ie-empatia", title: "Empatia na prática", minutes: 120 },
      { key: "ie-relacionamentos", title: "Relacionamentos saudáveis", minutes: 120 },
      { key: "ie-resiliencia", title: "Resiliência", minutes: 120 },
    ],
  },
  {
    title: "Gestão de Pessoas",
    category: "Liderança",
    theme: "blue",
    illustration: "people",
    courses: [{ key: "gp-feedback-video", title: "Boas práticas de feedback", kind: "video", minutes: 15, illustration: "chat" }],
  },
];

const STANDALONE: CourseSeed[] = [
  { key: "lgpd", title: "LGPD no dia a dia", kind: "quiz", minutes: 10, mandatory: true, theme: "blue", illustration: "shield" },
  { key: "boas-vindas", title: "Boas-vindas à empresa", minutes: 45, mandatory: true, theme: "yellow", illustration: "lightbulb" },
  { key: "codigo-conduta", title: "Código de Conduta", minutes: 30, mandatory: true, theme: "pink", illustration: "book" },
];

/** Jornada demonstrativa de cada pessoa: progresso em % e prazo (dias a partir de hoje). */
const ENROLLMENTS: { course: string; progress: number; dueInDays?: number; source?: "assigned" | "self" | "recommended" }[] = [
  { course: "lid-fundamentos", progress: 100 },
  { course: "lid-feedback", progress: 50 },
  { course: "com-cnv", progress: 75, dueInDays: 4 },
  { course: "com-escuta", progress: 100 },
  { course: "com-apresentacoes", progress: 25 },
  { course: "gp-feedback-video", progress: 0, dueInDays: 6, source: "recommended" },
  { course: "lgpd", progress: 0, dueInDays: 7, source: "assigned" },
  { course: "boas-vindas", progress: 100, source: "assigned" },
  { course: "codigo-conduta", progress: 100, source: "assigned" },
];

const LIBRARY: { type: (typeof s.LIBRARY_TYPES)[number]; title: string; minutes: number; featured: boolean }[] = [
  { type: "video", title: "A importância do feedback contínuo", minutes: 12, featured: true },
  { type: "article", title: "Como desenvolver hábitos de aprendizado", minutes: 5, featured: true },
  { type: "podcast", title: "Carreira em movimento: histórias reais", minutes: 28, featured: true },
  { type: "quiz", title: "LGPD: teste seus conhecimentos", minutes: 10, featured: true },
  { type: "article", title: "Guia do colaborador", minutes: 8, featured: false },
];

export const ACHIEVEMENTS: { key: string; name: string; description: string; icon: string; theme: Theme }[] = [
  { key: "first_course", name: "Primeiro curso", description: "Concluiu o primeiro curso", icon: "star", theme: "purple" },
  { key: "path_progress", name: "Trilha em andamento", description: "Começou uma trilha de aprendizagem", icon: "leaf", theme: "green" },
  { key: "participation", name: "Participação", description: "Participou de uma iniciativa da empresa", icon: "people", theme: "orange" },
  { key: "continuous_learner", name: "Aprendiz contínuo", description: "Concluiu 4 cursos", icon: "crown", theme: "blue" },
  { key: "communication", name: "Comunicação eficaz", description: "Concluiu a trilha Comunicação Eficaz", icon: "chat", theme: "pink" },
];

/** Conquistas obtidas na jornada demonstrativa (dias atrás). */
const EARNED: { key: string; daysAgo: number }[] = [
  { key: "first_course", daysAgo: 40 },
  { key: "path_progress", daysAgo: 28 },
  { key: "participation", daysAgo: 15 },
  { key: "continuous_learner", daysAgo: 3 },
];

export async function seedContent(db: Database, tenantId: string, userIds: string[]): Promise<boolean> {
  const existing = await db.select({ id: s.announcements.id }).from(s.announcements).where(eq(s.announcements.tenantId, tenantId)).limit(1);
  if (existing.length > 0) return false;

  await db.insert(s.announcements).values(
    ANNOUNCEMENTS.map((a) => ({
      tenantId,
      title: a.title,
      summary: a.summary,
      category: a.category,
      theme: a.theme,
      illustration: a.illustration,
      status: "published" as const,
      publishedAt: daysAgo(a.daysAgo),
    })),
  );

  const courseIds = new Map<string, string>();
  const insertCourse = async (c: CourseSeed, fallbackTheme: Theme) => {
    const id = randomUUID();
    courseIds.set(c.key, id);
    await db.insert(s.courses).values({
      id,
      tenantId,
      title: c.title,
      kind: c.kind ?? "course",
      durationMinutes: c.minutes,
      mandatory: c.mandatory ?? false,
      theme: c.theme ?? fallbackTheme,
      illustration: c.illustration ?? "book",
      status: "published",
    });
    return id;
  };

  for (const [index, path] of PATHS.entries()) {
    const pathId = randomUUID();
    await db.insert(s.learningPaths).values({
      id: pathId,
      tenantId,
      title: path.title,
      category: path.category,
      theme: path.theme,
      illustration: path.illustration,
      featured: path.featured ?? false,
      displayOrder: index,
      status: "published",
    });
    let position = 1;
    for (const course of path.courses) {
      const courseId = await insertCourse(course, path.theme);
      await db.insert(s.learningPathCourses).values({ tenantId, pathId, courseId, position: position++ });
    }
  }
  for (const course of STANDALONE) await insertCourse(course, "purple");

  await db.insert(s.libraryItems).values(
    LIBRARY.map((item, i) => ({ tenantId, type: item.type, title: item.title, durationMinutes: item.minutes, featured: item.featured, status: "published" as const, publishedAt: daysAgo(i) })),
  );

  const achievementIds = new Map<string, string>();
  for (const a of ACHIEVEMENTS) {
    const id = randomUUID();
    achievementIds.set(a.key, id);
    await db.insert(s.achievements).values({ id, tenantId, ...a });
  }

  for (const userId of userIds) {
    await db.insert(s.enrollments).values(
      ENROLLMENTS.map((e) => ({
        tenantId,
        userId,
        courseId: courseIds.get(e.course)!,
        progressPct: e.progress,
        status: e.progress === 100 ? ("completed" as const) : e.progress > 0 ? ("in_progress" as const) : ("not_started" as const),
        source: e.source ?? ("self" as const),
        dueDate: e.dueInDays !== undefined ? isoDateIn(e.dueInDays) : null,
        startedAt: e.progress > 0 ? daysAgo(30) : null,
        completedAt: e.progress === 100 ? daysAgo(10) : null,
      })),
    );
    await db.insert(s.userAchievements).values(EARNED.map((e) => ({ tenantId, userId, achievementId: achievementIds.get(e.key)!, earnedAt: daysAgo(e.daysAgo) })));
  }
  await seedLessons(db, tenantId);
  return true;
}

/** Ids dos usuários ATIVOS de um tenant (para a jornada demonstrativa). */
export async function activeUserIds(db: Database, tenantId: string): Promise<string[]> {
  const rows = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.status, "active")));
  return rows.map((r) => r.id);
}

/* ------------------------------------------------------------- aulas */

const LESSON_PLAN = [
  { module: 0, title: "Boas-vindas e objetivos" },
  { module: 0, title: "Conceitos essenciais" },
  { module: 0, title: "Por que isso importa no dia a dia" },
  { module: 1, title: "Ferramentas práticas" },
  { module: 1, title: "Estudo de caso" },
  { module: 1, title: "Encerramento e próximos passos" },
];
const MODULE_TITLES = ["Módulo 1 · Fundamentos", "Módulo 2 · Na prática"];

function lessonBody(courseTitle: string, lessonTitle: string): string {
  return [
    `Nesta aula de “${courseTitle}”, vamos trabalhar o tema “${lessonTitle.toLowerCase()}”.`,
    "Leia com calma, anote o que fizer sentido para a sua rotina e, ao final, reserve alguns minutos para refletir: o que você pode aplicar ainda esta semana?",
    "Lembre-se: aprendizado é construção. Pequenos passos, repetidos com consistência, geram grandes resultados.",
  ].join("\n\n");
}

function codeFor(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Cria módulos e aulas para os cursos do tenant que ainda não têm aulas, e
 * converte o progresso demonstrativo das matrículas em aulas concluídas
 * (o progresso passa a ser DERIVADO das aulas). Emite certificados dos
 * cursos concluídos. Idempotente.
 */
export async function seedLessons(db: Database, tenantId: string): Promise<number> {
  const courseRows = await db
    .select({ id: s.courses.id, title: s.courses.title, minutes: s.courses.durationMinutes })
    .from(s.courses)
    .where(eq(s.courses.tenantId, tenantId));
  let created = 0;

  for (const course of courseRows) {
    const existing = await db.select({ id: s.lessons.id }).from(s.lessons).where(eq(s.lessons.courseId, course.id)).limit(1);
    if (existing.length > 0) continue;
    created++;

    const plan = course.minutes >= 60 ? LESSON_PLAN : [{ module: 0, title: course.title }];
    const perLesson = Math.max(1, Math.round(course.minutes / plan.length));
    const moduleIds = MODULE_TITLES.slice(0, Math.max(...plan.map((l) => l.module)) + 1).map(() => randomUUID());
    await db.insert(s.courseModules).values(moduleIds.map((id, i) => ({ id, tenantId, courseId: course.id, title: plan.length === 1 ? "Conteúdo" : MODULE_TITLES[i]!, position: i + 1 })));
    const lessonIds = plan.map(() => randomUUID());
    await db.insert(s.lessons).values(
      plan.map((l, i) => ({
        id: lessonIds[i]!,
        tenantId,
        courseId: course.id,
        moduleId: moduleIds[l.module]!,
        title: l.title,
        type: "article" as const,
        position: i + 1,
        durationMinutes: perLesson,
        body: lessonBody(course.title, l.title),
      })),
    );

    const enrolled = await db
      .select({ id: s.enrollments.id, userId: s.enrollments.userId, progress: s.enrollments.progressPct })
      .from(s.enrollments)
      .where(eq(s.enrollments.courseId, course.id));
    for (const e of enrolled) {
      const done = Math.round((e.progress / 100) * plan.length);
      if (done > 0) {
        await db.insert(s.lessonProgress).values(
          lessonIds.slice(0, done).map((lessonId, i) => ({
            tenantId,
            userId: e.userId,
            lessonId,
            // Espalha as conclusões pelos últimos meses (alimenta "Minha evolução").
            completedAt: daysAgo(Math.max(1, 150 - i * 25 - (course.title.length % 20))),
          })),
        );
      }
      const pct = Math.round((done / plan.length) * 100);
      await db
        .update(s.enrollments)
        .set({
          progressPct: pct,
          status: pct === 100 ? "completed" : pct > 0 ? "in_progress" : "not_started",
          completedAt: pct === 100 ? daysAgo(10) : null,
          startedAt: pct > 0 ? daysAgo(150) : null,
        })
        .where(eq(s.enrollments.id, e.id));
      if (pct === 100) {
        await db.insert(s.certificates).values({ tenantId, userId: e.userId, courseId: course.id, code: codeFor(), issuedAt: daysAgo(10) }).onConflictDoNothing();
      }
    }
  }
  return created;
}
