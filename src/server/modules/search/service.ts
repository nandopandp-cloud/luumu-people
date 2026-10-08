import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { withTenant } from "@/server/db/tenant";
import { EMPLOYEE_NAV, EMPLOYEE_NAV_SECONDARY, MANAGEMENT_NAV, type NavIcon } from "@/features/shell/nav-config";
import { effectiveFlags } from "@/server/modules/flags/service";
import { listPeople } from "@/server/modules/people/service";

/**
 * Busca unificada da paleta (⌘K). Cada grupo respeita exatamente o que a
 * pessoa já poderia ver nas telas: conteúdo publicado no tenant (RLS), as
 * PRÓPRIAS pesquisas, pessoas só com `people.directory.read` e no escopo, e
 * itens de gestão só com a permissão correspondente. Sem acento e sem
 * diferenciar maiúsculas.
 */

export type SearchContext = "employee" | "management";
export type SearchKind = "page" | "course" | "path" | "announcement" | "survey" | "person" | "banner";
export type SearchHit = { kind: SearchKind; id: string; title: string; subtitle: string | null; href: string; icon?: NavIcon };
export type SearchGroup = { kind: SearchKind; label: string; items: SearchHit[] };

const GROUP_LABEL: Record<SearchKind, string> = {
  page: "Páginas",
  course: "Cursos",
  path: "Trilhas",
  announcement: "Comunicados",
  survey: "Pesquisas",
  person: "Pessoas",
  banner: "Banners da home",
};

const PER_GROUP = 5;
const ACCENTS = "áàâãäåéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "aaaaaaeeeeiiiiooooouuuucn";

export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Coluna "contém" o termo, ignorando acentos e caixa (parametrizado). */
function matches(column: SQL, term: string): SQL {
  const escaped = `%${normalize(term).replace(/[%_\\]/g, "\\$&")}%`;
  return sql`translate(lower(coalesce(${column}, '')), ${ACCENTS}, ${PLAIN}) like ${escaped}`;
}

type Rows<T> = { rows: T[] };
const rows = <T>(result: unknown) => (result as Rows<T>).rows;

const SURVEY_STATE: Record<string, string> = { open: "Aberta para responder", answered: "Você já respondeu", closed: "Encerrada" };

/** Atalhos de navegação que a pessoa pode abrir. */
function pages(actor: AuthenticatedActor, context: SearchContext, achievements: boolean) {
  const items =
    context === "employee"
      ? [...EMPLOYEE_NAV, ...EMPLOYEE_NAV_SECONDARY].filter((i) => achievements || i.href !== "/minhas-conquistas").map((i) => ({ ...i, subtitle: "Minha experiência" }))
      : [
          ...MANAGEMENT_NAV.filter((i) => i.anyOf.some((p) => hasPermissionAnywhere(actor, p))).flatMap((i) => [
            { ...i, subtitle: "Gestão" },
            ...(i.children ?? []).filter((c) => c.anyOf.some((p) => hasPermissionAnywhere(actor, p))).map((c) => ({ ...c, subtitle: `Gestão · ${i.label}` })),
          ]),
          ...(hasTenantWide(actor, "comms.announcement.publish") ? [{ href: "/gestao/comunicacao/banners", label: "Banners da home", icon: "announcements" as NavIcon, subtitle: "Gestão · Comunicação" }] : []),
        ];
  return items.map((i) => ({ kind: "page" as const, id: i.href, title: i.label, subtitle: i.subtitle, href: i.href, icon: i.icon }));
}

/** Atalhos sem termo (estado inicial da paleta). */
export async function quickLinks(actor: AuthenticatedActor, context: SearchContext): Promise<SearchHit[]> {
  const flags = await effectiveFlags(actor);
  return pages(actor, context, flags.gamification === true).slice(0, 8);
}

export async function search(actor: AuthenticatedActor, query: string, context: SearchContext): Promise<SearchGroup[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const flags = await effectiveFlags(actor);
  const term = normalize(q);

  const groups = await withTenant(actor, async (tx) => {
    const out: Partial<Record<SearchKind, SearchHit[]>> = {};
    out.page = pages(actor, context, flags.gamification === true)
      .filter((p) => normalize(p.title).includes(term))
      .slice(0, PER_GROUP);

    if (context === "employee") {
      out.course = rows<{ id: string; title: string; category: string | null; kind: string }>(
        await tx.execute(sql`
          select c.id, c.title, c.category, c.kind from courses c
          where c.status = 'published' and (${matches(sql`c.title`, q)} or ${matches(sql`c.description`, q)} or ${matches(sql`c.category`, q)})
          order by (${matches(sql`c.title`, q)}) desc, c.title limit ${PER_GROUP}`),
      ).map((c) => ({ kind: "course", id: c.id, title: c.title, subtitle: c.category ?? (c.kind === "video" ? "Vídeo" : c.kind === "quiz" ? "Quiz" : "Curso"), href: `/meus-cursos/${c.id}` }));

      out.path = rows<{ id: string; title: string; category: string | null; courses: number }>(
        await tx.execute(sql`
          select p.id, p.title, p.category,
                 (select count(*)::int from learning_path_courses lpc join courses c on c.id = lpc.course_id and c.status = 'published' where lpc.path_id = p.id) as courses
          from learning_paths p
          where p.status = 'published' and (${matches(sql`p.title`, q)} or ${matches(sql`p.description`, q)} or ${matches(sql`p.category`, q)})
          order by p.featured desc, p.title limit ${PER_GROUP}`),
      )
        .filter((p) => p.courses > 0)
        .map((p) => ({ kind: "path", id: p.id, title: p.title, subtitle: `${p.category ? `${p.category} · ` : ""}${p.courses} ${p.courses === 1 ? "curso" : "cursos"}`, href: `/trilhas/${p.id}` }));

      out.announcement = rows<{ id: string; title: string; summary: string }>(
        await tx.execute(sql`
          select a.id, a.title, a.summary from announcements a
          where a.status = 'published' and a.published_at <= now() and (${matches(sql`a.title`, q)} or ${matches(sql`a.summary`, q)} or ${matches(sql`a.body`, q)})
          order by a.published_at desc limit ${PER_GROUP}`),
      ).map((a) => ({ kind: "announcement", id: a.id, title: a.title, subtitle: a.summary, href: `/comunicados/${a.id}` }));

      out.survey = rows<{ id: string; title: string; state: string }>(
        await tx.execute(sql`
          select s.id, s.title,
                 case when i.status = 'completed' then 'answered' when s.status = 'active' and s.closes_at > now() then 'open' else 'closed' end as state
          from survey_invitations i join surveys s on s.id = i.survey_id
          where i.user_id = ${actor.userId} and s.status <> 'draft' and ${matches(sql`s.title`, q)}
          order by s.closes_at desc limit ${PER_GROUP}`),
      ).map((s) => ({ kind: "survey", id: s.id, title: s.title, subtitle: SURVEY_STATE[s.state] ?? null, href: `/pesquisas/${s.id}` }));
    } else {
      if (hasTenantWide(actor, "comms.announcement.create")) {
        out.announcement = rows<{ id: string; title: string; status: string }>(
          await tx.execute(sql`
            select a.id, a.title, a.status from announcements a
            where ${matches(sql`a.title`, q)} or ${matches(sql`a.summary`, q)}
            order by a.updated_at desc limit ${PER_GROUP}`),
        ).map((a) => ({ kind: "announcement", id: a.id, title: a.title, subtitle: a.status === "published" ? "Publicado ou agendado" : a.status === "archived" ? "Arquivado" : "Rascunho", href: `/gestao/comunicacao/${a.id}` }));
      }
      if (hasTenantWide(actor, "comms.announcement.publish")) {
        out.banner = rows<{ id: string; title: string; active: boolean }>(
          await tx.execute(sql`select b.id, b.title, b.active from home_banners b where ${matches(sql`b.title`, q)} or ${matches(sql`b.subtitle`, q)} order by b.position limit ${PER_GROUP}`),
        ).map((b) => ({ kind: "banner", id: b.id, title: b.title, subtitle: b.active ? "Ativo" : "Inativo", href: `/gestao/comunicacao/banners/${b.id}` }));
      }
      const seesDrafts = hasTenantWide(actor, "survey.design") || hasTenantWide(actor, "survey.launch");
      if (seesDrafts || hasPermissionAnywhere(actor, "survey.results.read_aggregate")) {
        out.survey = rows<{ id: string; title: string; status: string }>(
          await tx.execute(sql`
            select s.id, s.title, s.status from surveys s
            where ${matches(sql`s.title`, q)} ${seesDrafts ? sql`` : sql`and s.status <> 'draft'`}
            order by s.updated_at desc limit ${PER_GROUP}`),
        ).map((s) => ({ kind: "survey", id: s.id, title: s.title, subtitle: s.status === "draft" ? "Rascunho" : s.status === "active" ? "Em andamento" : "Encerrada", href: `/gestao/pesquisas/${s.id}` }));
      }
    }
    return out;
  });

  // Pessoas: o mesmo diretório de /gestao/usuarios (permissão + escopo do ator).
  if (hasPermissionAnywhere(actor, "people.directory.read")) {
    const { items } = await listPeople(actor, { search: q, limit: PER_GROUP });
    groups.person = items.map((p) => ({
      kind: "person",
      id: p.id,
      title: p.preferredName || p.name,
      subtitle: [p.position, p.orgUnit].filter(Boolean).join(" · ") || null,
      href: `/gestao/usuarios/${p.id}`,
    }));
  }

  const order: SearchKind[] = context === "employee" ? ["page", "course", "path", "announcement", "survey", "person"] : ["page", "person", "announcement", "survey", "banner"];
  return order.filter((k) => groups[k]?.length).map((k) => ({ kind: k, label: GROUP_LABEL[k], items: groups[k]! }));
}
