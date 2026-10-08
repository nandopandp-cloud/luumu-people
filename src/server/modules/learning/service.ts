import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import type { Illustration, Theme } from "@/server/db/schema/learning";
import { withTenant } from "@/server/db/tenant";
import { notFound } from "@/server/http/errors";

/**
 * Aprendizagem do PRÓPRIO colaborador. Todas as consultas filtram por
 * actor.userId além do tenant (RLS).
 */

type Rows<T> = { rows: T[] };

export async function getMyLearningProgress(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const result = (await tx.execute(sql`
      select count(*)::int as enrolled,
             count(*) filter (where e.status = 'completed')::int as completed,
             coalesce(round(avg(e.progress_pct)), 0)::int as percent
      from enrollments e join courses c on c.id = e.course_id and c.status = 'published'
      where e.user_id = ${actor.userId}
    `)) as unknown as Rows<{ enrolled: number; completed: number; percent: number }>;
    return result.rows[0] ?? { enrolled: 0, completed: 0, percent: 0 };
  });
}

export type RecommendedPath = {
  id: string;
  title: string;
  category: string | null;
  theme: Theme;
  illustration: Illustration;
  courseCount: number;
  totalMinutes: number;
  progress: number;
};

/** Trilhas publicadas ainda não concluídas pela pessoa — destaques primeiro. */
export async function listRecommendedPaths(actor: AuthenticatedActor, limit = 3): Promise<RecommendedPath[]> {
  return withTenant(actor, async (tx) => {
    const result = (await tx.execute(sql`
      select p.id, p.title, p.category, p.theme, p.illustration,
             count(c.id)::int as "courseCount",
             coalesce(sum(c.duration_minutes), 0)::int as "totalMinutes",
             coalesce(round(avg(coalesce(e.progress_pct, 0))), 0)::int as progress
      from learning_paths p
      join learning_path_courses lpc on lpc.path_id = p.id
      join courses c on c.id = lpc.course_id and c.status = 'published'
      left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
      where p.status = 'published'
      group by p.id
      having coalesce(round(avg(coalesce(e.progress_pct, 0))), 0) < 100
      order by p.featured desc, p.display_order asc, p.title asc
      limit ${limit}
    `)) as unknown as Rows<RecommendedPath>;
    return result.rows;
  });
}

export type NextActivity = {
  enrollmentId: string;
  courseTitle: string;
  kind: "course" | "video" | "quiz";
  progress: number;
  remainingMinutes: number;
  dueDate: string | null;
  mandatory: boolean;
  pathTitle: string | null;
};

/** Próximas atividades: matrículas abertas, por prazo e depois por progresso. */
export async function listNextActivities(actor: AuthenticatedActor, limit = 4): Promise<NextActivity[]> {
  return withTenant(actor, async (tx) => {
    const result = (await tx.execute(sql`
      select e.id as "enrollmentId", c.title as "courseTitle", c.kind, e.progress_pct as progress,
             greatest(1, round(c.duration_minutes * (100 - e.progress_pct) / 100.0))::int as "remainingMinutes",
             to_char(e.due_date, 'YYYY-MM-DD') as "dueDate", c.mandatory,
             (select p.title from learning_path_courses lpc join learning_paths p on p.id = lpc.path_id
               where lpc.course_id = c.id and p.status = 'published' order by p.featured desc limit 1) as "pathTitle"
      from enrollments e join courses c on c.id = e.course_id and c.status = 'published'
      where e.user_id = ${actor.userId} and e.status <> 'completed'
      order by e.due_date asc nulls last, e.progress_pct desc, c.title
      limit ${limit}
    `)) as unknown as Rows<NextActivity>;
    return result.rows;
  });
}

/* ------------------------------------------------------------- trilhas */

export const PATH_TABS = ["todas", "em-andamento", "nao-iniciadas", "concluidas"] as const;
export type PathTab = (typeof PATH_TABS)[number];
export type PathStatus = "not_started" | "in_progress" | "completed";

export type PathSummary = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  theme: Theme;
  illustration: Illustration;
  featured: boolean;
  courseCount: number;
  completedCount: number;
  totalMinutes: number;
  progress: number;
  status: PathStatus;
  /** Primeiro curso da trilha (na ordem) ainda não concluído pela pessoa. */
  nextCourseId: string | null;
};

/** Status e progresso da trilha derivados dos cursos: 100% só com todos concluídos. */
function pathStatus(courseCount: number, completedCount: number, started: boolean, progress: number) {
  const completed = courseCount > 0 && completedCount === courseCount;
  return {
    status: (completed ? "completed" : started ? "in_progress" : "not_started") as PathStatus,
    progress: completed ? 100 : Math.min(99, progress),
  };
}

/** Trilhas publicadas (com ao menos um curso publicado) e a situação da pessoa em cada uma. */
export async function listPaths(actor: AuthenticatedActor, tab: PathTab) {
  return withTenant(actor, async (tx) => {
    const result = (await tx.execute(sql`
      select p.id, p.title, p.description, p.category, p.theme, p.illustration, p.featured,
             count(c.id)::int as "courseCount",
             (count(*) filter (where e.status = 'completed'))::int as "completedCount",
             coalesce(sum(c.duration_minutes), 0)::int as "totalMinutes",
             coalesce(round(avg(coalesce(e.progress_pct, 0))), 0)::int as progress,
             coalesce(bool_or(e.progress_pct > 0), false) as started,
             (array_agg(c.id order by lpc.position) filter (where e.status is distinct from 'completed'))[1] as "nextCourseId"
      from learning_paths p
      join learning_path_courses lpc on lpc.path_id = p.id
      join courses c on c.id = lpc.course_id and c.status = 'published'
      left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
      where p.status = 'published'
      group by p.id
      order by p.featured desc, p.display_order asc, p.title asc
    `)) as unknown as Rows<Omit<PathSummary, "status"> & { started: boolean }>;
    const all: PathSummary[] = result.rows.map(({ started, ...p }) => ({ ...p, ...pathStatus(p.courseCount, p.completedCount, started, p.progress) }));
    const filters: Record<PathTab, (p: PathSummary) => boolean> = {
      todas: () => true,
      "em-andamento": (p) => p.status === "in_progress",
      "nao-iniciadas": (p) => p.status === "not_started",
      concluidas: (p) => p.status === "completed",
    };
    const counts = Object.fromEntries(PATH_TABS.map((t) => [t, all.filter(filters[t]).length])) as Record<PathTab, number>;
    return { items: all.filter(filters[tab]), counts };
  });
}

export type PathCourse = {
  id: string;
  title: string;
  description: string | null;
  kind: "course" | "video" | "quiz";
  mandatory: boolean;
  theme: Theme;
  illustration: Illustration;
  coverFileId: string | null;
  minutes: number;
  lessonsTotal: number;
  status: "available" | "not_started" | "in_progress" | "completed";
  progress: number;
};

/** Trilha publicada com seus cursos publicados, em ordem, e o progresso da PRÓPRIA pessoa. */
export async function getPath(actor: AuthenticatedActor, pathId: string) {
  return withTenant(actor, async (tx) => {
    const [path] = await tx
      .select({
        id: s.learningPaths.id,
        title: s.learningPaths.title,
        description: s.learningPaths.description,
        category: s.learningPaths.category,
        theme: s.learningPaths.theme,
        illustration: s.learningPaths.illustration,
        featured: s.learningPaths.featured,
      })
      .from(s.learningPaths)
      .where(and(eq(s.learningPaths.id, pathId), eq(s.learningPaths.status, "published")));
    if (!path) throw notFound("Trilha não encontrada ou não disponível.");

    const courses = (
      (await tx.execute(sql`
        select c.id, c.title, c.description, c.kind, c.mandatory, c.theme, c.illustration, c.cover_file_id as "coverFileId",
               c.duration_minutes as minutes, (select count(*)::int from lessons l where l.course_id = c.id) as "lessonsTotal",
               coalesce(e.status, 'available') as status, coalesce(e.progress_pct, 0)::int as progress
        from learning_path_courses lpc
        join courses c on c.id = lpc.course_id and c.status = 'published'
        left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
        where lpc.path_id = ${pathId}
        order by lpc.position
      `)) as unknown as Rows<PathCourse>
    ).rows;

    const completedCount = courses.filter((c) => c.status === "completed").length;
    const average = courses.length ? Math.round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length) : 0;
    return {
      path,
      courses,
      completedCount,
      totalMinutes: courses.reduce((sum, c) => sum + c.minutes, 0),
      ...pathStatus(courses.length, completedCount, courses.some((c) => c.progress > 0), average),
      nextCourseId: courses.find((c) => c.status !== "completed")?.id ?? null,
    };
  });
}
