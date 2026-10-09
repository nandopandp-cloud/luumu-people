import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Público dos comunicados. `audience_org_unit_id` nulo = toda a empresa; com
 * área, o comunicado é visível para quem está lotado (lotação atual) nela ou
 * em qualquer subárea. Equivale a: a área do público está entre a área da
 * pessoa e as áreas ACIMA dela.
 */

/** Subconsulta: a área atual da pessoa e todas as áreas acima dela. */
export function myOrgUnitChainSql(userId: string): SQL {
  return sql`(
    with recursive up(id) as (
      select ea.org_unit_id from employment_assignments ea where ea.user_id = ${userId} and ea.valid_to is null
      union
      select ou.parent_id from org_units ou join up on ou.id = up.id where ou.parent_id is not null
    )
    select id from up
  )`;
}

/** Condição: o comunicado (coluna de público) é visível para a pessoa. */
export function audienceVisibleSql(column: AnyPgColumn | SQL, userId: string): SQL {
  return sql`(${column} is null or ${column} in ${myOrgUnitChainSql(userId)})`;
}

/** Condição: comunicado dirigido à área da pessoa (não à empresa toda) — aba "Minha área". */
export function audienceMineSql(column: AnyPgColumn | SQL, userId: string): SQL {
  return sql`(${column} is not null and ${column} in ${myOrgUnitChainSql(userId)})`;
}
