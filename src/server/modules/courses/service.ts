import "server-only";
import { randomInt } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import type { Illustration, Theme } from "@/server/db/schema/learning";
import { withTenant, type Tx } from "@/server/db/tenant";
import { notFound } from "@/server/http/errors";

/**
 * Cursos do PRÓPRIO colaborador. Toda leitura é do tenant (RLS) e, para dados
 * pessoais (matrícula, progresso, certificado), filtrada por actor.userId.
 * Somente cursos PUBLICADOS são visíveis na experiência do colaborador.
 */

type Rows<T> = { rows: T[] };
const rows = <T>(result: unknown) => (result as Rows<T>).rows;

export const MY_COURSE_TABS = ["em-andamento", "nao-iniciados", "concluidos", "obrigatorios"] as const;
export type MyCourseTab = (typeof MY_COURSE_TABS)[number];

export type MyCourse = {
  courseId: string;
  title: string;
  kind: "course" | "video" | "quiz";
  mandatory: boolean;
  theme: Theme;
  illustration: Illustration;
  coverFileId: string | null;
  pathTitle: string | null;
  category: string | null;
  status: "not_started" | "in_progress" | "completed";
  progress: number;
  lessonsTotal: number;
  lessonsDone: number;
  remainingMinutes: number;
  dueDate: string | null;
};

const MY_COURSES_SQL = (userId: string) => sql`
  select c.id as "courseId", c.title, c.kind, c.mandatory, c.theme, c.illustration, c.cover_file_id as "coverFileId", c.category,
         e.status, e.progress_pct as progress, to_char(e.due_date, 'YYYY-MM-DD') as "dueDate",
         (select count(*)::int from lessons l where l.course_id = c.id) as "lessonsTotal",
         (select count(*)::int from lesson_progress lp join lessons l on l.id = lp.lesson_id where l.course_id = c.id and lp.user_id = ${userId}) as "lessonsDone",
         (select coalesce(sum(l.duration_minutes), 0)::int from lessons l where l.course_id = c.id
            and not exists (select 1 from lesson_progress lp where lp.lesson_id = l.id and lp.user_id = ${userId})) as "remainingMinutes",
         (select p.title from learning_path_courses lpc join learning_paths p on p.id = lpc.path_id
            where lpc.course_id = c.id and p.status = 'published' order by p.featured desc, p.display_order limit 1) as "pathTitle"
  from enrollments e join courses c on c.id = e.course_id and c.status = 'published'
  where e.user_id = ${userId}`;

export async function listMyCourses(actor: AuthenticatedActor, tab: MyCourseTab) {
  return withTenant(actor, async (tx) => {
    const all = rows<MyCourse>(await tx.execute(sql`${MY_COURSES_SQL(actor.userId)} order by e.due_date asc nulls last, e.progress_pct desc, c.title`));
    const filters: Record<MyCourseTab, (c: MyCourse) => boolean> = {
      "em-andamento": (c) => c.status === "in_progress",
      "nao-iniciados": (c) => c.status === "not_started",
      concluidos: (c) => c.status === "completed",
      obrigatorios: (c) => c.mandatory,
    };
    const counts = Object.fromEntries(MY_COURSE_TABS.map((t) => [t, all.filter(filters[t]).length])) as Record<MyCourseTab, number>;
    return { items: all.filter(filters[tab]), counts };
  });
}

export type CatalogFilter = "todos" | "trilhas" | "cursos" | "obrigatorios";
export type CatalogItem = {
  kind: "path" | "course";
  id: string;
  title: string;
  theme: Theme;
  illustration: Illustration;
  coverFileId: string | null;
  meta: string;
  minutes: number;
  count: number;
  mandatory: boolean;
  myStatus: "not_started" | "in_progress" | "completed" | "available";
};

/** Catálogo: cursos e trilhas publicados, com o status da pessoa em cada um. */
export async function listCatalog(actor: AuthenticatedActor, filter: CatalogFilter, query?: string) {
  const term = query?.trim() ? `%${query.trim().replace(/[%_\\]/g, "\\$&")}%` : null;
  return withTenant(actor, async (tx) => {
    const courses =
      filter === "trilhas"
        ? []
        : rows<CatalogItem>(
            await tx.execute(sql`
              select 'course' as kind, c.id, c.title, c.theme, c.illustration, c.cover_file_id as "coverFileId",
                     coalesce(c.category, case c.kind when 'video' then 'Vídeo' when 'quiz' then 'Quiz' else 'Curso' end) as meta,
                     c.duration_minutes as minutes, (select count(*)::int from lessons l where l.course_id = c.id) as count, c.mandatory,
                     coalesce(e.status, 'available') as "myStatus"
              from courses c left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
              where c.status = 'published' ${filter === "obrigatorios" ? sql`and c.mandatory` : sql``}
                ${term ? sql`and c.title ilike ${term}` : sql``}
              order by c.mandatory desc, c.title`),
          );
    const paths =
      filter === "cursos" || filter === "obrigatorios"
        ? []
        : rows<CatalogItem>(
            await tx.execute(sql`
              select 'path' as kind, p.id, p.title, p.theme, p.illustration, null as "coverFileId", coalesce(p.category, 'Trilha') as meta,
                     coalesce(sum(c.duration_minutes), 0)::int as minutes, count(c.id)::int as count, false as mandatory,
                     case when coalesce(avg(coalesce(e.progress_pct, 0)), 0) >= 100 then 'completed'
                          when coalesce(max(e.progress_pct), 0) > 0 then 'in_progress' else 'available' end as "myStatus"
              from learning_paths p
              join learning_path_courses lpc on lpc.path_id = p.id
              join courses c on c.id = lpc.course_id and c.status = 'published'
              left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
              where p.status = 'published' ${term ? sql`and p.title ilike ${term}` : sql``}
              group by p.id
              order by p.featured desc, p.display_order, p.title`),
          );
    return [...paths, ...courses];
  });
}

/** Cursos publicados em que a pessoa ainda não está matriculada (recomendações simples). */
export async function listRecommendedCourses(actor: AuthenticatedActor, limit = 3) {
  return withTenant(actor, async (tx) =>
    rows<{ id: string; title: string; theme: Theme; illustration: Illustration; coverFileId: string | null; minutes: number; lessons: number; category: string | null }>(
      await tx.execute(sql`
        select c.id, c.title, c.theme, c.illustration, c.cover_file_id as "coverFileId", c.duration_minutes as minutes, c.category,
               (select count(*)::int from lessons l where l.course_id = c.id) as lessons
        from courses c
        where c.status = 'published' and not exists (select 1 from enrollments e where e.course_id = c.id and e.user_id = ${actor.userId})
        order by c.mandatory desc, c.created_at desc, c.title
        limit ${limit}`),
    ),
  );
}

/** Pendências com prazo nos próximos 14 dias (ou vencidas). */
export async function listReminders(actor: AuthenticatedActor, limit = 4) {
  return withTenant(actor, async (tx) =>
    rows<{ courseId: string; title: string; kind: "course" | "video" | "quiz"; mandatory: boolean; status: string; dueDate: string }>(
      await tx.execute(sql`
        select c.id as "courseId", c.title, c.kind, c.mandatory, e.status, to_char(e.due_date, 'YYYY-MM-DD') as "dueDate"
        from enrollments e join courses c on c.id = e.course_id and c.status = 'published'
        where e.user_id = ${actor.userId} and e.status <> 'completed' and e.due_date is not null
          and e.due_date <= (now() at time zone 'America/Sao_Paulo')::date + 14
        order by e.due_date asc
        limit ${limit}`),
    ),
  );
}

/** Horas de aprendizado por mês (aulas concluídas), últimos N meses — inclusive meses sem atividade. */
export async function learningHoursByMonth(actor: AuthenticatedActor, months = 6) {
  return withTenant(actor, async (tx) =>
    rows<{ month: string; minutes: number }>(
      await tx.execute(sql`
        with series as (
          select generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - make_interval(months => ${months - 1}),
                                 date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') as month
        )
        select to_char(series.month, 'YYYY-MM') as month, coalesce(sum(l.duration_minutes), 0)::int as minutes
        from series
        left join lesson_progress lp on lp.user_id = ${actor.userId}
          and date_trunc('month', lp.completed_at at time zone 'America/Sao_Paulo') = series.month
        left join lessons l on l.id = lp.lesson_id
        group by series.month order by series.month`),
    ),
  );
}

/* ------------------------------------------------------------- curso */

async function loadCourse(tx: Tx, courseId: string) {
  const [course] = await tx
    .select({
      id: s.courses.id,
      title: s.courses.title,
      description: s.courses.description,
      kind: s.courses.kind,
      mandatory: s.courses.mandatory,
      theme: s.courses.theme,
      illustration: s.courses.illustration,
      coverFileId: s.courses.coverFileId,
      category: s.courses.category,
      durationMinutes: s.courses.durationMinutes,
    })
    .from(s.courses)
    .where(and(eq(s.courses.id, courseId), eq(s.courses.status, "published")));
  if (!course) throw notFound("Curso não encontrado ou não disponível.");
  return course;
}

async function loadOutline(tx: Tx, courseId: string, userId: string) {
  const modules = await tx.select({ id: s.courseModules.id, title: s.courseModules.title }).from(s.courseModules).where(eq(s.courseModules.courseId, courseId)).orderBy(asc(s.courseModules.position));
  const lessonRows = rows<{ id: string; moduleId: string; title: string; type: string; durationMinutes: number; done: boolean }>(
    await tx.execute(sql`
      select l.id, l.module_id as "moduleId", l.title, l.type, l.duration_minutes as "durationMinutes",
             exists (select 1 from lesson_progress lp where lp.lesson_id = l.id and lp.user_id = ${userId}) as done
      from lessons l where l.course_id = ${courseId} order by l.position`),
  );
  return { modules: modules.map((m) => ({ ...m, lessons: lessonRows.filter((l) => l.moduleId === m.id) })), lessons: lessonRows };
}

export async function getCourse(actor: AuthenticatedActor, courseId: string) {
  return withTenant(actor, async (tx) => {
    const course = await loadCourse(tx, courseId);
    const { modules, lessons } = await loadOutline(tx, courseId, actor.userId);
    const [enrollment] = await tx
      .select({ status: s.enrollments.status, progress: s.enrollments.progressPct, dueDate: s.enrollments.dueDate })
      .from(s.enrollments)
      .where(and(eq(s.enrollments.courseId, courseId), eq(s.enrollments.userId, actor.userId)));
    const [certificate] = await tx
      .select({ code: s.certificates.code, issuedAt: s.certificates.issuedAt })
      .from(s.certificates)
      .where(and(eq(s.certificates.courseId, courseId), eq(s.certificates.userId, actor.userId)));
    const [path] = rows<{ id: string; title: string }>(
      await tx.execute(sql`select p.id, p.title from learning_path_courses lpc join learning_paths p on p.id = lpc.path_id where lpc.course_id = ${courseId} and p.status = 'published' order by p.featured desc, p.display_order limit 1`),
    );
    const nextLesson = lessons.find((l) => !l.done) ?? lessons[0] ?? null;
    return { course, modules, lessons, enrollment: enrollment ?? null, certificate: certificate ?? null, pathId: path?.id ?? null, pathTitle: path?.title ?? null, nextLessonId: nextLesson?.id ?? null };
  });
}

export async function getLesson(actor: AuthenticatedActor, courseId: string, lessonId: string) {
  return withTenant(actor, async (tx) => {
    const course = await loadCourse(tx, courseId);
    const [lesson] = await tx
      .select({
        id: s.lessons.id,
        title: s.lessons.title,
        type: s.lessons.type,
        durationMinutes: s.lessons.durationMinutes,
        body: s.lessons.body,
        videoUrl: s.lessons.videoUrl,
        externalUrl: s.lessons.externalUrl,
        fileId: s.lessons.fileId,
        moduleTitle: s.courseModules.title,
      })
      .from(s.lessons)
      .innerJoin(s.courseModules, eq(s.courseModules.id, s.lessons.moduleId))
      .where(and(eq(s.lessons.id, lessonId), eq(s.lessons.courseId, courseId)));
    if (!lesson) throw notFound("Aula não encontrada.");
    const { lessons } = await loadOutline(tx, courseId, actor.userId);
    const index = lessons.findIndex((l) => l.id === lessonId);
    return {
      course,
      lesson,
      done: lessons[index]?.done ?? false,
      position: index + 1,
      total: lessons.length,
      previousId: lessons[index - 1]?.id ?? null,
      nextId: lessons[index + 1]?.id ?? null,
      progress: lessons.length ? Math.round((lessons.filter((l) => l.done).length / lessons.length) * 100) : 0,
    };
  });
}

async function ensureEnrollment(tx: Tx, actor: AuthenticatedActor, courseId: string) {
  await tx
    .insert(s.enrollments)
    .values({ tenantId: actor.tenantId, userId: actor.userId, courseId, source: "self" })
    .onConflictDoNothing({ target: [s.enrollments.userId, s.enrollments.courseId] });
}

/** Matrícula voluntária em curso publicado. */
export async function startCourse(actor: AuthenticatedActor, courseId: string) {
  return withTenant(actor, async (tx) => {
    await loadCourse(tx, courseId);
    await ensureEnrollment(tx, actor, courseId);
    const { lessons } = await loadOutline(tx, courseId, actor.userId);
    return { nextLessonId: (lessons.find((l) => !l.done) ?? lessons[0])?.id ?? null };
  });
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function certificateCode(): string {
  return Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/**
 * Conclui uma aula: registra o progresso (idempotente), recalcula a matrícula a
 * partir das aulas e, ao chegar a 100%, emite o certificado.
 */
export async function completeLesson(actor: AuthenticatedActor, courseId: string, lessonId: string) {
  return withTenant(actor, async (tx) => {
    await loadCourse(tx, courseId);
    const [lesson] = await tx.select({ id: s.lessons.id }).from(s.lessons).where(and(eq(s.lessons.id, lessonId), eq(s.lessons.courseId, courseId)));
    if (!lesson) throw notFound("Aula não encontrada.");

    await ensureEnrollment(tx, actor, courseId);
    await tx.insert(s.lessonProgress).values({ tenantId: actor.tenantId, userId: actor.userId, lessonId }).onConflictDoNothing();

    const { lessons } = await loadOutline(tx, courseId, actor.userId);
    const done = lessons.filter((l) => l.done).length;
    const progress = Math.round((done / Math.max(1, lessons.length)) * 100);
    const completed = progress === 100;
    const now = new Date();
    await tx
      .update(s.enrollments)
      .set({
        progressPct: progress,
        status: completed ? "completed" : "in_progress",
        startedAt: sql`coalesce(${s.enrollments.startedAt}, ${now})`,
        completedAt: completed ? sql`coalesce(${s.enrollments.completedAt}, ${now})` : null,
      })
      .where(and(eq(s.enrollments.courseId, courseId), eq(s.enrollments.userId, actor.userId)));

    let certificate: string | null = null;
    if (completed) {
      await tx.insert(s.certificates).values({ tenantId: actor.tenantId, userId: actor.userId, courseId, code: certificateCode() }).onConflictDoNothing();
      const [row] = await tx.select({ code: s.certificates.code }).from(s.certificates).where(and(eq(s.certificates.courseId, courseId), eq(s.certificates.userId, actor.userId)));
      certificate = row?.code ?? null;
    }
    const index = lessons.findIndex((l) => l.id === lessonId);
    return { progress, completed, certificate, nextLessonId: lessons[index + 1]?.id ?? null };
  });
}

/** Certificado da PRÓPRIA pessoa (somente se o curso foi concluído). */
export async function getMyCertificate(actor: AuthenticatedActor, courseId: string) {
  return withTenant(actor, async (tx) => {
    const result = rows<{ code: string; issuedAt: Date; courseTitle: string; minutes: number; personName: string; organization: string }>(
      await tx.execute(sql`
        select ce.code, ce.issued_at as "issuedAt", c.title as "courseTitle", c.duration_minutes as minutes,
               u.name as "personName", o.name as organization
        from certificates ce
        join courses c on c.id = ce.course_id
        join users u on u.id = ce.user_id
        join organizations o on o.id = ce.tenant_id
        where ce.course_id = ${courseId} and ce.user_id = ${actor.userId}`),
    );
    if (!result[0]) throw notFound("Certificado disponível após concluir o curso.");
    return result[0];
  });
}
