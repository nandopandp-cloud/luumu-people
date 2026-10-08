import "server-only";
import { sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import { withTenant } from "@/server/db/tenant";
import type { Illustration, Theme } from "@/server/db/schema/learning";

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
