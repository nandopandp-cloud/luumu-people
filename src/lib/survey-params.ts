/**
 * Parâmetros da lista de pesquisas da gestão (em português na URL) ⇄ consulta.
 * Compartilhado entre página, cliente e exportação (sem dependências de servidor).
 */

export const SURVEY_TABS = ["ativas", "agendadas", "encerradas", "rascunhos"] as const;
export const SURVEY_LIST_SORTS = ["pesquisa", "tipo", "publico", "periodo", "participacao", "status"] as const;
export const SURVEY_KIND_VALUES = ["climate", "enps", "pulse", "custom"] as const;
export const SURVEY_PAGE_SIZES = [10, 25, 50] as const;

export type SurveyParams = {
  q?: string;
  tipo?: (typeof SURVEY_KIND_VALUES)[number];
  area?: string;
  status?: (typeof SURVEY_TABS)[number];
  de?: string;
  ate?: string;
  ordem?: (typeof SURVEY_LIST_SORTS)[number];
  dir?: "asc" | "desc";
  pagina?: number;
  por?: (typeof SURVEY_PAGE_SIZES)[number];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const pick = <T extends string>(v: string | string[] | null | undefined, allowed: readonly T[]) => {
  const value = one(v);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
};

export function parseSurveyParams(sp: Record<string, string | string[] | undefined> | URLSearchParams): SurveyParams {
  const get = (key: string) => (sp instanceof URLSearchParams ? (sp.get(key) ?? undefined) : sp[key]);
  const area = one(get("area"));
  const page = Number(one(get("pagina")));
  const size = Number(one(get("por")));
  const de = one(get("de"));
  const ate = one(get("ate"));
  return {
    q: one(get("q"))?.slice(0, 100),
    tipo: pick(get("tipo"), SURVEY_KIND_VALUES),
    area: area === "empresa" || (area && UUID.test(area)) ? area : undefined,
    status: pick(get("status"), SURVEY_TABS),
    de: de && DATE.test(de) ? de : undefined,
    ate: ate && DATE.test(ate) ? ate : undefined,
    ordem: pick(get("ordem"), SURVEY_LIST_SORTS),
    dir: pick(get("dir"), ["asc", "desc"] as const),
    pagina: Number.isInteger(page) && page > 1 ? Math.min(page, 10_000) : undefined,
    por: (SURVEY_PAGE_SIZES as readonly number[]).includes(size) && size !== SURVEY_PAGE_SIZES[0] ? (size as SurveyParams["por"]) : undefined,
  };
}

/** Consulta do serviço. Sem ordenação escolhida: em andamento primeiro, depois as mais recentes. */
export function toSurveyQuery(p: SurveyParams) {
  return {
    search: p.q,
    kind: p.tipo,
    audience: p.area,
    tab: p.status,
    opensFrom: p.de,
    opensTo: p.ate,
    sort: p.ordem ?? ("status" as const),
    dir: p.dir ?? "asc",
    page: p.pagina ?? 1,
    perPage: p.por ?? SURVEY_PAGE_SIZES[0],
  };
}

export function surveysHref(p: SurveyParams, patch: Partial<SurveyParams> = {}, base = "/gestao/pesquisas") {
  const next = { ...p, ...patch };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === "") continue;
    if (key === "dir" && value === "asc") continue;
    if (key === "pagina" && value === 1) continue;
    if (key === "por" && value === SURVEY_PAGE_SIZES[0]) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

/** Exportação (CSV de participação): mesmos parâmetros + seleção. */
export function surveysExportHref(p: SurveyParams, ids?: string[]) {
  const href = surveysHref(p, { pagina: undefined, por: undefined }, "/api/v1/surveys/export");
  if (!ids?.length) return href;
  return `${href}${href.includes("?") ? "&" : "?"}ids=${ids.join(",")}`;
}
