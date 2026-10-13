import "server-only";
import { sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import { withTenant } from "@/server/db/tenant";
import type { CompetencyRow } from "./service";

/**
 * Sugestões de aprendizagem para as competências que a PRÓPRIA pessoa ainda
 * precisa desenvolver (abaixo do nível esperado). Enquanto o catálogo não tem
 * vínculo explícito com competências, o conteúdo publicado é ligado pela
 * categoria ou pelo título (ex.: trilha "Comunicação Eficaz" → Comunicação).
 * Fica de fora o que a pessoa já concluiu.
 */

export type SuggestionItem = {
  kind: "course" | "path";
  id: string;
  title: string;
  description: string | null;
  minutes: number;
  status: "available" | "in_progress";
};
export type CompetencySuggestions = { competencyId: string; competencyName: string; competencyIcon: string; gap: number; items: SuggestionItem[] };

type Rows<T> = { rows: T[] };
const rows = <T>(r: unknown) => (r as Rows<T>).rows;

/** Sem acento, minúsculas e espaços simples, para comparar nomes. */
export function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type ContentRow = { kind: "course" | "path"; id: string; title: string; description: string | null; category: string | null; minutes: number; done: boolean; started: boolean };

export async function listCompetencySuggestions(actor: AuthenticatedActor, competencies: CompetencyRow[], perCompetency = 3): Promise<CompetencySuggestions[]> {
  const targets = competencies
    .filter((c) => c.level !== "developed")
    .map((c) => ({ c, gap: c.expected - (c.score ?? 0) }))
    .sort((a, b) => b.gap - a.gap);
  if (targets.length === 0) return [];

  const content = await withTenant(actor, async (tx) => {
    const paths = rows<ContentRow>(
      await tx.execute(sql`
        select 'path' as kind, p.id, p.title, p.description, p.category,
               coalesce(sum(c.duration_minutes), 0)::int as minutes,
               bool_and(coalesce(e.status = 'completed', false)) as done,
               bool_or(e.status is not null) as started
        from learning_paths p
        join learning_path_courses lpc on lpc.path_id = p.id
        join courses c on c.id = lpc.course_id and c.status = 'published'
        left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
        where p.status = 'published'
        group by p.id
        order by p.featured desc, p.display_order, p.title`),
    );
    const courses = rows<ContentRow>(
      await tx.execute(sql`
        select 'course' as kind, c.id, c.title, c.description, c.category, c.duration_minutes as minutes,
               coalesce(e.status = 'completed', false) as done, (e.status is not null) as started
        from courses c left join enrollments e on e.course_id = c.id and e.user_id = ${actor.userId}
        where c.status = 'published'
        order by c.mandatory desc, c.title`),
    );
    return [...paths, ...courses];
  });

  const indexed = content.filter((item) => !item.done).map((item) => ({ item, haystack: normalizeText(`${item.category ?? ""} ${item.title}`) }));
  return targets
    .map(({ c, gap }) => {
      const name = normalizeText(c.name);
      const matches = indexed.filter((x) => x.haystack.includes(name)).map((x) => x.item);
      // Uma trilha primeiro (quando houver) e depois cursos avulsos.
      const ordered = [...matches.filter((m) => m.kind === "path").slice(0, 1), ...matches.filter((m) => m.kind === "course")].slice(0, perCompetency);
      return {
        competencyId: c.id,
        competencyName: c.name,
        competencyIcon: c.icon,
        gap,
        items: ordered.map((m) => ({ kind: m.kind, id: m.id, title: m.title, description: m.description, minutes: m.minutes, status: m.started ? ("in_progress" as const) : ("available" as const) })),
      };
    })
    .filter((s) => s.items.length > 0);
}
