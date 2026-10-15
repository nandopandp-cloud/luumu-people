import "server-only";
import { sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import type { Permission } from "@/server/authz/permissions";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import type { SurveyKind } from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { forbidden } from "@/server/http/errors";
import { csvCell } from "@/server/modules/reports/development";
import { canReadAllResults, closeExpired, type VaultResults } from "./service";

/**
 * Visão de gestão das pesquisas: lista com abas, filtros e paginação, e os
 * indicadores do topo. Só PARTICIPAÇÃO (convites) e resultados AGREGADOS do
 * cofre (já com supressão por k) — nunca respostas individuais.
 */

type Rows<T> = { rows: T[] };
const rows = <T>(result: unknown) => (result as Rows<T>).rows;
type Meta = { ip: string | null; userAgent: string | null; requestId: string };

const MANAGEMENT_PERMISSIONS: Permission[] = ["survey.design", "survey.launch", "survey.results.read_aggregate"];
const DAY = 24 * 60 * 60 * 1000;
/** Janela dos comparativos "vs. período anterior". */
export const KPI_WINDOW_DAYS = 90;

export type SurveyDisplayStatus = "draft" | "scheduled" | "active" | "paused" | "closed";
export type SurveyTab = "ativas" | "agendadas" | "encerradas" | "rascunhos";
export const TAB_STATUSES: Record<SurveyTab, SurveyDisplayStatus[]> = {
  ativas: ["active", "paused"],
  agendadas: ["scheduled"],
  encerradas: ["closed"],
  rascunhos: ["draft"],
};
export const SURVEY_SORTS = ["pesquisa", "tipo", "publico", "periodo", "participacao", "status"] as const;
export type SurveySort = (typeof SURVEY_SORTS)[number];

export type SurveyRow = {
  id: string;
  title: string;
  description: string | null;
  kind: SurveyKind;
  status: "draft" | "active" | "paused" | "closed";
  displayStatus: SurveyDisplayStatus;
  opensAt: Date | null;
  closesAt: Date | null;
  createdAt: Date;
  anonymityK: number;
  audienceOrgUnitId: string | null;
  audienceName: string | null;
  audienceSize: number;
  invited: number;
  completed: number;
  rate: number | null;
};

export type SurveyListQuery = {
  search?: string;
  kind?: SurveyKind;
  /** "empresa" = público da empresa toda; uuid = público daquela área. */
  audience?: string;
  tab?: SurveyTab;
  opensFrom?: string;
  opensTo?: string;
  sort: SurveySort;
  dir: "asc" | "desc";
  page: number;
  perPage: number;
};

function assertCanManage(actor: AuthenticatedActor) {
  if (!MANAGEMENT_PERMISSIONS.some((p) => hasPermissionAnywhere(actor, p))) throw forbidden();
}

const seesDrafts = (actor: AuthenticatedActor) => hasTenantWide(actor, "survey.design") || hasTenantWide(actor, "survey.launch");

async function loadRows(tx: Tx, actor: AuthenticatedActor): Promise<SurveyRow[]> {
  await closeExpired(tx, actor.tenantId);
  const [{ company }] = rows<{ company: number }>(await tx.execute(sql`select count(*)::int as company from users where status = 'active'`));
  const data = rows<Omit<SurveyRow, "displayStatus" | "audienceSize" | "rate"> & { opensAt: string | null; closesAt: string | null; createdAt: string }>(
    await tx.execute(sql`
      select s.id, s.title, s.description, s.kind, s.status, s.launched_at as "opensAt", s.closes_at as "closesAt", s.created_at as "createdAt",
             s.anonymity_k as "anonymityK", s.audience_org_unit_id as "audienceOrgUnitId", ou.name as "audienceName",
             (select count(*)::int from survey_invitations i where i.survey_id = s.id) as invited,
             (select count(*)::int from survey_invitations i where i.survey_id = s.id and i.status = 'completed') as completed
      from surveys s left join org_units ou on ou.id = s.audience_org_unit_id
      ${seesDrafts(actor) ? sql`` : sql`where s.status <> 'draft'`}`),
  );
  const now = Date.now();
  return data.map((r) => {
    const opensAt = r.opensAt ? new Date(r.opensAt) : null;
    const scheduled = (r.status === "active" || r.status === "paused") && opensAt !== null && opensAt.getTime() > now;
    return {
      ...r,
      opensAt,
      closesAt: r.closesAt ? new Date(r.closesAt) : null,
      createdAt: new Date(r.createdAt),
      displayStatus: scheduled ? "scheduled" : r.status,
      audienceSize: r.status === "draft" ? company : r.invited,
      rate: r.status === "draft" || scheduled || r.invited === 0 ? null : Math.round((r.completed / r.invited) * 100),
    };
  });
}

const STATUS_ORDER: Record<SurveyDisplayStatus, number> = { active: 0, paused: 1, scheduled: 2, draft: 3, closed: 4 };
const normalize = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

function compare(sort: SurveySort, a: SurveyRow, b: SurveyRow) {
  switch (sort) {
    case "pesquisa":
      return a.title.localeCompare(b.title, "pt-BR");
    case "tipo":
      return a.kind.localeCompare(b.kind);
    case "publico":
      return (a.audienceName ?? "").localeCompare(b.audienceName ?? "", "pt-BR") || a.audienceSize - b.audienceSize;
    case "periodo":
      return (a.opensAt?.getTime() ?? Infinity) - (b.opensAt?.getTime() ?? Infinity);
    case "participacao":
      return (a.rate ?? -1) - (b.rate ?? -1);
    case "status":
      return STATUS_ORDER[a.displayStatus] - STATUS_ORDER[b.displayStatus];
  }
}

function applyFilters(all: SurveyRow[], query: Omit<SurveyListQuery, "tab" | "sort" | "dir" | "page" | "perPage">) {
  const term = query.search ? normalize(query.search) : null;
  return all.filter(
    (r) =>
      (!term || normalize(`${r.title} ${r.description ?? ""}`).includes(term)) &&
      (!query.kind || r.kind === query.kind) &&
      (!query.audience || (query.audience === "empresa" ? r.audienceOrgUnitId === null : r.audienceOrgUnitId === query.audience)) &&
      (!query.opensFrom || (r.opensAt !== null && day(r.opensAt) >= query.opensFrom)) &&
      (!query.opensTo || (r.opensAt !== null && day(r.opensAt) <= query.opensTo)),
  );
}

/** Lista da gestão: contagens por aba (com os demais filtros), ordenação e página. */
export async function listSurveyDirectory(actor: AuthenticatedActor, query: SurveyListQuery) {
  assertCanManage(actor);
  return withTenant(actor, async (tx) => {
    const filtered = applyFilters(await loadRows(tx, actor), query);
    const counts = {
      all: filtered.length,
      ativas: filtered.filter((r) => TAB_STATUSES.ativas.includes(r.displayStatus)).length,
      agendadas: filtered.filter((r) => r.displayStatus === "scheduled").length,
      encerradas: filtered.filter((r) => r.displayStatus === "closed").length,
      rascunhos: filtered.filter((r) => r.displayStatus === "draft").length,
    };
    const inTab = query.tab ? filtered.filter((r) => TAB_STATUSES[query.tab!].includes(r.displayStatus)) : filtered;
    // Padrão: em andamento primeiro, depois as mais recentes.
    const sorted = [...inTab].sort((a, b) => {
      const primary = compare(query.sort, a, b) * (query.dir === "desc" ? -1 : 1);
      return primary || STATUS_ORDER[a.displayStatus] - STATUS_ORDER[b.displayStatus] || (b.opensAt ?? b.createdAt).getTime() - (a.opensAt ?? a.createdAt).getTime();
    });
    const last = Math.max(1, Math.ceil(sorted.length / query.perPage));
    const page = Math.min(query.page, last);
    return { items: sorted.slice((page - 1) * query.perPage, page * query.perPage), total: sorted.length, counts, page, perPage: query.perPage };
  });
}

/** Opções do filtro de público: as áreas usadas como público em alguma pesquisa. */
export async function listAudienceAreas(actor: AuthenticatedActor) {
  assertCanManage(actor);
  return withTenant(actor, async (tx) =>
    rows<{ id: string; name: string }>(
      await tx.execute(sql`select distinct ou.id, ou.name from surveys s join org_units ou on ou.id = s.audience_org_unit_id order by ou.name`),
    ),
  );
}

/* ----------------------------------------------------------- indicadores */

const pct = (current: number, previous: number) => (previous > 0 ? Math.round(((current - previous) / previous) * 100) : null);
const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

/** eNPS (−100 a 100) a partir da distribuição AGREGADA de uma pergunta 0–10. */
export function enpsFromDistribution(distribution: Record<string, number>) {
  let promoters = 0;
  let detractors = 0;
  let total = 0;
  for (const [score, count] of Object.entries(distribution)) {
    const n = Number(score);
    if (!Number.isInteger(n) || n < 0 || n > 10) continue;
    total += count;
    if (n >= 9) promoters += count;
    else if (n <= 6) detractors += count;
  }
  return total ? Math.round(((promoters - detractors) / total) * 100) : null;
}

export async function getSurveyKpis(actor: AuthenticatedActor) {
  assertCanManage(actor);
  return withTenant(actor, async (tx) => {
    const all = await loadRows(tx, actor);
    const now = Date.now();
    const window = KPI_WINDOW_DAYS * DAY;
    const inWindow = (d: Date | null, back: number) => d !== null && d.getTime() <= now - back * window && d.getTime() > now - (back + 1) * window;

    const [completions] = rows<{ current: number; previous: number }>(
      await tx.execute(sql`
        select count(*) filter (where completed_on > (now() - ${`${KPI_WINDOW_DAYS} days`}::interval)::date)::int as current,
               count(*) filter (where completed_on <= (now() - ${`${KPI_WINDOW_DAYS} days`}::interval)::date
                                  and completed_on > (now() - ${`${KPI_WINDOW_DAYS * 2} days`}::interval)::date)::int as previous
        from survey_invitations where status = 'completed'`),
    );

    const opened = all.filter((r) => r.rate !== null);
    const rateNow = mean(opened.filter((r) => inWindow(r.opensAt, 0)).map((r) => r.rate!));
    const ratePrev = mean(opened.filter((r) => inWindow(r.opensAt, 1)).map((r) => r.rate!));

    return {
      total: { value: all.length, change: pct(all.filter((r) => inWindow(r.createdAt, 0)).length, all.filter((r) => inWindow(r.createdAt, 1)).length) },
      participations: { value: all.reduce((sum, r) => sum + r.completed, 0), change: pct(completions!.current, completions!.previous) },
      averageRate: {
        value: opened.length ? Math.round(mean(opened.map((r) => r.rate!))!) : null,
        /** Diferença em pontos percentuais. */
        change: rateNow !== null && ratePrev !== null ? Math.round(rateNow - ratePrev) : null,
      },
      enps: canReadAllResults(actor) ? await enpsTrend(tx, all) : null,
    };
  });
}

/**
 * eNPS médio das últimas 3 pesquisas com pergunta de recomendação e resultado
 * liberado (≥ k respostas), comparado às 3 anteriores. Usa só survey_vault.results.
 */
async function enpsTrend(tx: Tx, all: SurveyRow[]) {
  const candidates = all
    .filter((r) => r.opensAt !== null && r.opensAt.getTime() <= Date.now() && r.status !== "draft")
    .sort((a, b) => b.opensAt!.getTime() - a.opensAt!.getTime());
  const enpsQuestions = new Map(
    rows<{ surveyId: string; questionId: string }>(
      await tx.execute(sql`select distinct on (survey_id) survey_id as "surveyId", id as "questionId" from survey_questions where type = 'enps' order by survey_id, position`),
    ).map((q) => [q.surveyId, q.questionId]),
  );
  const scores: number[] = [];
  for (const survey of candidates) {
    if (scores.length >= 6) break;
    const questionId = enpsQuestions.get(survey.id);
    if (!questionId) continue;
    const [result] = rows<{ r: VaultResults }>(await tx.execute(sql`select survey_vault.results(${survey.id}::uuid, null::text, null::text) as r`));
    if (!result || result.r.suppressed) continue;
    const question = result.r.questions.find((q) => q.questionId === questionId);
    const score = question && !question.suppressed && question.distribution ? enpsFromDistribution(question.distribution) : null;
    if (score !== null) scores.push(score);
  }
  const current = mean(scores.slice(0, 3));
  const previous = mean(scores.slice(3, 6));
  return { value: current === null ? null : Math.round(current), change: current !== null && previous !== null ? Math.round(current - previous) : null, surveys: Math.min(3, scores.length) };
}

/* -------------------------------------------------------------- exportação */

const KIND_LABEL: Record<string, string> = { climate: "Clima", enps: "eNPS", pulse: "Pulso", custom: "Personalizada" };
const STATUS_LABEL: Record<SurveyDisplayStatus, string> = { draft: "Rascunho", scheduled: "Agendada", active: "Em andamento", paused: "Pausada", closed: "Encerrada" };

/** CSV de PARTICIPAÇÃO (nunca respostas) das pesquisas selecionadas ou filtradas; auditado. */
export async function exportSurveysCsv(actor: AuthenticatedActor, query: Omit<SurveyListQuery, "page" | "perPage"> & { ids?: string[] }, meta: Meta) {
  assertCanManage(actor);
  if (!hasTenantWide(actor, "reports.export")) throw forbidden();
  return withTenant(actor, async (tx) => {
    let list = applyFilters(await loadRows(tx, actor), query);
    if (query.tab) list = list.filter((r) => TAB_STATUSES[query.tab!].includes(r.displayStatus));
    if (query.ids?.length) list = list.filter((r) => query.ids!.includes(r.id));
    const date = (d: Date | null) => (d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(d) : null);
    const lines = [["Pesquisa", "Tipo", "Público", "Pessoas no público", "Início", "Encerramento", "Situação", "Respostas", "Participação (%)", "k"].map(csvCell).join(";")];
    for (const r of list) {
      lines.push(
        [r.title, KIND_LABEL[r.kind] ?? r.kind, r.audienceName ?? "Toda a empresa", r.audienceSize, date(r.opensAt), date(r.closesAt), STATUS_LABEL[r.displayStatus], r.status === "draft" ? null : r.completed, r.rate, r.anonymityK]
          .map(csvCell)
          .join(";"),
      );
    }
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "data.exported",
      resourceType: "report",
      resourceId: null,
      metadata: { report: "surveys", rows: list.length, selection: Boolean(query.ids?.length) },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
    return `﻿${lines.join("\r\n")}\r\n`;
  });
}
