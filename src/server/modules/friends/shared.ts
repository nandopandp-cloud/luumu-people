import "server-only";
import { and, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import * as s from "@/server/db/schema";
import type { Tx } from "@/server/db/tenant";
import { todayInBrazil } from "@/lib/moods";
import type { MoodView, PersonCard, Relation } from "@/features/friends/types";

/**
 * Peças de SQL compartilhadas pela área "Amigos". Toda consulta roda dentro de
 * withTenant(): a RLS já limita ao tenant, esconde pedidos de terceiros e
 * conversas de que a pessoa não participa.
 */

/** Presença: considerada online quem deu sinal nos últimos 2 minutos. */
export const ONLINE_WINDOW = sql`interval '2 minutes'`;

export const displayName = sql<string>`coalesce(nullif(${s.employeeProfiles.preferredName}, ''), ${s.users.name})`;

/** Ids dos amigos (aceitos) de uma pessoa. */
export const friendIdsOf = (userId: SQL | string) =>
  sql`(select case when f.requester_id = ${userId} then f.addressee_id else f.requester_id end from friendships f where f.status = 'accepted' and (f.requester_id = ${userId} or f.addressee_id = ${userId}))`;

export const relationSql = (me: string, other: SQL) =>
  sql<Relation>`coalesce((select case when f.status = 'accepted' then 'friends' when f.requester_id = ${me} then 'sent' else 'received' end from friendships f where (f.requester_id = ${me} and f.addressee_id = ${other}) or (f.addressee_id = ${me} and f.requester_id = ${other}) limit 1), 'none')`;

export const mutualCountSql = (me: string, other: SQL) => sql<number>`(select count(*)::int from (${friendIdsOf(me)} intersect ${friendIdsOf(other)}) mutual)`;

export const onlineSql = (userId: SQL) => sql<boolean>`exists (select 1 from user_presence p where p.user_id = ${userId} and p.last_seen_at > now() - ${ONLINE_WINDOW})`;

/** "Rio de Janeiro, RJ" (unidades remotas: só "Remoto"). */
export function locationOf(city: string | null, state: string | null): string | null {
  if (!city) return null;
  return state && state !== "BR" ? `${city}, ${state}` : city;
}

/** Colegas ativos com cargo, área e local vigentes, relação com a pessoa atual e amigos em comum. */
export function colleagues(tx: Tx, me: string) {
  return tx
    .select({
      id: s.users.id,
      name: displayName,
      image: s.users.image,
      position: s.positions.name,
      orgUnit: s.orgUnits.name,
      city: s.businessUnits.city,
      state: s.businessUnits.state,
      relation: relationSql(me, sql`${s.users.id}`),
      mutualCount: mutualCountSql(me, sql`${s.users.id}`),
      online: onlineSql(sql`${s.users.id}`),
    })
    .from(s.users)
    .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
    .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
    .leftJoin(s.positions, eq(s.positions.id, s.employmentAssignments.positionId))
    .leftJoin(s.orgUnits, eq(s.orgUnits.id, s.employmentAssignments.orgUnitId))
    .leftJoin(s.businessUnits, eq(s.businessUnits.id, s.employmentAssignments.businessUnitId))
    .$dynamic();
}

export type ColleagueRow = Awaited<ReturnType<ReturnType<typeof colleagues>["execute"]>>[number];

/** Sentimento de hoje (visível para a empresa, decisão de produto) de cada pessoa da lista. */
export async function moodsOf(tx: Tx, ids: string[]): Promise<Map<string, MoodView>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ userId: s.moodCheckins.userId, mood: s.moodCheckins.mood, note: s.moodCheckins.note, at: s.moodCheckins.updatedAt })
    .from(s.moodCheckins)
    .where(and(inArray(s.moodCheckins.userId, [...new Set(ids)]), eq(s.moodCheckins.checkinDate, todayInBrazil())));
  return new Map(rows.map((r) => [r.userId, { mood: r.mood, note: r.note, at: r.at.toISOString() }]));
}

/**
 * Cartão do colega. A presença só aparece para amigos ou quando a pessoa
 * conversa com quem pergunta (`sharesConversation`).
 */
export function toCard(row: ColleagueRow, moods: Map<string, MoodView>, sharesConversation = false): PersonCard {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    position: row.position,
    orgUnit: row.orgUnit,
    location: locationOf(row.city, row.state),
    relation: row.relation,
    mutualCount: row.mutualCount,
    online: (row.relation === "friends" || sharesConversation) && row.online,
    mood: moods.get(row.id) ?? null,
  };
}

/** Pares de ids de forma canônica (conversa privada única por par). */
export const directKeyOf = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
