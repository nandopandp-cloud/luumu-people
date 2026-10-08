import { sql } from "drizzle-orm";
import { SURVEY_DIMENSIONS, type ApprovedDimensions, type SurveyDimension } from "@/server/db/schema/surveys";

/**
 * Dimensões de segmentação das pesquisas anônimas. Funções puras + a consulta
 * do perfil (diretoria, área, admissão), usadas no lançamento, no envio e no
 * seed. Nada aqui identifica quem respondeu: o cofre recebe só os valores
 * generalizados.
 */

type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };
const rows = <T>(result: unknown) => (result as { rows: T[] }).rows;
const DAY = 24 * 60 * 60 * 1000;
export const OTHERS = "Outros";

export type DimensionProfile = { userId: string; diretoria: string | null; area: string | null; hireDate: string | null };

/** Faixa de tempo de casa (dimensão já generalizada). */
export function tenureBucket(hireDate: string | null, today = new Date()): string | null {
  if (!hireDate) return null;
  const years = (today.getTime() - new Date(`${hireDate}T12:00:00Z`).getTime()) / (365.25 * DAY);
  if (years < 1) return "Menos de 1 ano";
  if (years < 3) return "1 a 3 anos";
  if (years < 5) return "3 a 5 anos";
  return "5 anos ou mais";
}

function dimensionValue(profile: DimensionProfile, dimension: SurveyDimension): string | null {
  if (dimension === "tempo_de_casa") return tenureBucket(profile.hireDate);
  return profile[dimension];
}

/**
 * Dimensões aprovadas no lançamento: só valores com ≥ k convidados; uma
 * dimensão com menos de 2 valores aprovados é descartada (não segmenta nada).
 */
export function approveDimensions(profiles: DimensionProfile[], k: number): ApprovedDimensions {
  const approved: ApprovedDimensions = {};
  for (const dimension of SURVEY_DIMENSIONS) {
    const counts = new Map<string, number>();
    for (const p of profiles) {
      const value = dimensionValue(p, dimension);
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const values = [...counts].filter(([value, n]) => n >= k && value !== OTHERS).map(([value]) => value);
    if (values.length >= 2) approved[dimension] = values.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  return approved;
}

/** Dimensões generalizadas de quem responde: valor fora da lista aprovada → "Outros". */
export function generalizedDimensions(profile: DimensionProfile, approved: ApprovedDimensions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [dimension, values] of Object.entries(approved) as [SurveyDimension, string[]][]) {
    const value = dimensionValue(profile, dimension);
    out[dimension] = value && values.includes(value) ? value : OTHERS;
  }
  return out;
}

/**
 * Diretoria, área (ou a diretoria, se a pessoa estiver nela) e admissão das pessoas ATIVAS. No app a RLS já filtra o tenant;
 * `tenantId` existe para o seed, que roda como dono do schema (sem RLS).
 */
export async function dimensionProfiles(tx: Executor, userId?: string, tenantId?: string): Promise<DimensionProfile[]> {
  return rows<DimensionProfile>(
    await tx.execute(sql`
      with recursive chain as (
        select ea.user_id, ou.id, ou.parent_id, ou.type, ou.name
        from employment_assignments ea join org_units ou on ou.id = ea.org_unit_id
        where ea.valid_to is null ${userId ? sql`and ea.user_id = ${userId}` : sql``}
        union all
        select c.user_id, p.id, p.parent_id, p.type, p.name from chain c join org_units p on p.id = c.parent_id
      )
      select u.id as "userId",
             max(c.name) filter (where c.type = 'directorate') as diretoria,
             coalesce(max(c.name) filter (where c.type = 'area'), max(c.name) filter (where c.type = 'directorate')) as area,
             to_char(ep.hire_date, 'YYYY-MM-DD') as "hireDate"
      from users u
      left join chain c on c.user_id = u.id
      left join employee_profiles ep on ep.user_id = u.id
      where u.status = 'active' ${userId ? sql`and u.id = ${userId}` : sql``} ${tenantId ? sql`and u.tenant_id = ${tenantId}` : sql``}
      group by u.id, ep.hire_date`),
  );
}

