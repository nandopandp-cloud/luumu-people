/**
 * Parâmetros da página Colaboradores (em português na URL) ⇄ consulta do
 * diretório. Compartilhado entre servidor e cliente (sem dependências de servidor).
 */

export const TAB_TO_STATUS = { ativos: "active", inativos: "inactive", pendentes: "invited" } as const;
export const EMPLOYMENT_TO_STATUS = { ativo: "active", afastado: "on_leave", desligado: "terminated" } as const;
export const SORT_TO_KEY = { nome: "name", cargo: "position", area: "orgUnit", gestor: "manager", situacao: "status", acesso: "lastAccess" } as const;
export const PAGE_SIZES = [10, 25, 50] as const;

export type DirectoryTab = keyof typeof TAB_TO_STATUS | "todos";
export type DirectorySort = keyof typeof SORT_TO_KEY;

export type DirectoryParams = {
  q?: string;
  area?: string;
  cargo?: string;
  situacao?: keyof typeof EMPLOYMENT_TO_STATUS;
  status?: keyof typeof TAB_TO_STATUS;
  unidade?: string;
  nivel?: string;
  gestor?: string;
  ordem?: DirectorySort;
  dir?: "asc" | "desc";
  pagina?: number;
  por?: (typeof PAGE_SIZES)[number];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const uuid = (v: string | string[] | undefined) => {
  const value = one(v);
  return value && UUID.test(value) ? value : undefined;
};
const pick = <T extends string>(v: string | string[] | undefined, allowed: readonly T[]) => {
  const value = one(v);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
};

/** Lê os parâmetros da URL, descartando o que for inválido (nunca quebra a página). */
export function parseDirectoryParams(sp: Record<string, string | string[] | undefined>): DirectoryParams {
  const page = Number(one(sp.pagina));
  const size = Number(one(sp.por));
  return {
    q: one(sp.q)?.slice(0, 100),
    area: uuid(sp.area),
    cargo: uuid(sp.cargo),
    situacao: pick(sp.situacao, Object.keys(EMPLOYMENT_TO_STATUS) as (keyof typeof EMPLOYMENT_TO_STATUS)[]),
    status: pick(sp.status, Object.keys(TAB_TO_STATUS) as (keyof typeof TAB_TO_STATUS)[]),
    unidade: uuid(sp.unidade),
    nivel: uuid(sp.nivel),
    gestor: uuid(sp.gestor),
    ordem: pick(sp.ordem, Object.keys(SORT_TO_KEY) as DirectorySort[]),
    dir: pick(sp.dir, ["asc", "desc"] as const),
    pagina: Number.isInteger(page) && page > 1 ? Math.min(page, 10_000) : undefined,
    por: (PAGE_SIZES as readonly number[]).includes(size) && size !== PAGE_SIZES[0] ? (size as DirectoryParams["por"]) : undefined,
  };
}

/** Consulta do serviço (chaves em inglês) a partir dos parâmetros. */
export function toDirectoryQuery(p: DirectoryParams) {
  return {
    search: p.q,
    orgUnitId: p.area,
    positionId: p.cargo,
    businessUnitId: p.unidade,
    jobLevelId: p.nivel,
    managerId: p.gestor,
    status: p.status ? TAB_TO_STATUS[p.status] : undefined,
    employmentStatus: p.situacao ? EMPLOYMENT_TO_STATUS[p.situacao] : undefined,
    sort: SORT_TO_KEY[p.ordem ?? "nome"],
    dir: p.dir ?? "asc",
    page: p.pagina ?? 1,
    perPage: p.por ?? PAGE_SIZES[0],
  };
}

/** Monta o query string, omitindo padrões. `patch` sobrescreve (undefined remove). */
export function directoryHref(p: DirectoryParams, patch: Partial<DirectoryParams> = {}, base = "/gestao/colaboradores") {
  const next = { ...p, ...patch };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined || value === "") continue;
    if (key === "ordem" && value === "nome") continue;
    if (key === "dir" && value === "asc") continue;
    if (key === "pagina" && value === 1) continue;
    if (key === "por" && value === PAGE_SIZES[0]) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

/** Parâmetros para a exportação (mesmos filtros, chaves da API). */
export function exportQuery(p: DirectoryParams, ids?: string[]) {
  const q = toDirectoryQuery(p);
  const search = new URLSearchParams();
  const entries: [string, string | undefined][] = [
    ["search", q.search],
    ["orgUnitId", q.orgUnitId],
    ["positionId", q.positionId],
    ["businessUnitId", q.businessUnitId],
    ["jobLevelId", q.jobLevelId],
    ["managerId", q.managerId],
    ["status", q.status],
    ["employmentStatus", q.employmentStatus],
    ["sort", q.sort],
    ["dir", q.dir],
    ["ids", ids?.length ? ids.join(",") : undefined],
  ];
  for (const [key, value] of entries) if (value) search.set(key, value);
  return `/api/v1/people/export?${search.toString()}`;
}
