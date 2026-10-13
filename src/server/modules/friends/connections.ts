import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { containsText, normalize } from "@/server/db/text-search";
import { badRequest, notFound } from "@/server/http/errors";
import { orgSubtreeSql } from "@/server/authz/resolver";
import { visibleTo } from "@/server/modules/announcements/service";
import { INTERESTS, INTEREST_KEYS, MAX_INTERESTS } from "@/lib/interests";
import type { ConnectionCard, ConnectionsCounts, DiscoverFilter } from "@/features/friends/types";
import { displayName, friendIdsOf, moodsOf, mutualCountSql, onlineSql, relationSql, toCard, type ColleagueRow } from "./shared";
import { countReceivedRequests } from "./service";

/**
 * Conexões (área "Amigos"): descobrir pessoas, sugestões, destaques, quem está
 * online e interesses do perfil.
 *
 *  - O cartão mostra só dados profissionais públicos na empresa (como em
 *    service.ts), os interesses em comum e a capa. "Seguir" (destaques) é o
 *    mesmo pedido de conexão de "Conectar" — não existe vínculo separado.
 *  - Presença ("online agora") só para amigos — mesma regra das conversas.
 *  - Destaques: atividade pública dos últimos 30 dias nos comunicados que a
 *    pessoa atual vê (comunicados publicados, comentários e curtidas recebidas
 *    em comentários). Mensagens privadas nunca entram em nenhum cálculo.
 *  - Sugestões: quem ainda não é amigo nem tem pedido pendente, pontuado por
 *    time, departamento, amigos e interesses em comum; o "x" dispensa.
 */

const WINDOW = sql`interval '30 days'`;

type Me = { orgUnitId: string | null; managerId: string | null; departmentId: string | null };

/** Lotação, gestor e departamento (área de topo) da pessoa atual. */
async function whoAmI(tx: Tx, actor: AuthenticatedActor): Promise<Me> {
  const result = await tx.execute(sql`
    select ea.org_unit_id as org_unit_id,
      (select mr.manager_id from manager_relationships mr where mr.user_id = ${actor.userId} and mr.valid_to is null limit 1) as manager_id,
      (with recursive up(id, parent_id) as (
        select ou.id, ou.parent_id from org_units ou where ou.id = ea.org_unit_id
        union all
        select p.id, p.parent_id from org_units p join up on p.id = up.parent_id
      ) select id from up where parent_id is null limit 1) as department_id
    from employment_assignments ea
    where ea.user_id = ${actor.userId} and ea.valid_to is null
    limit 1
  `);
  const row = (result as unknown as { rows: { org_unit_id: string | null; manager_id: string | null; department_id: string | null }[] }).rows[0];
  return { orgUnitId: row?.org_unit_id ?? null, managerId: row?.manager_id ?? null, departmentId: row?.department_id ?? null };
}

const commonInterestsSql = (me: string, other: SQL) =>
  sql<string[]>`coalesce((select array_agg(o.interest_key order by o.interest_key) from user_interests o where o.user_id = ${other} and o.interest_key in (select m.interest_key from user_interests m where m.user_id = ${me})), '{}')`;

/** Mesmo time: mesma área, mesmo gestor, ou gestor / liderado direto. */
function sameTeamSql(actor: AuthenticatedActor, me: Me, other: SQL): SQL<boolean> {
  const parts: SQL[] = [
    sql`exists (select 1 from manager_relationships r where r.valid_to is null and ((r.user_id = ${other} and r.manager_id = ${actor.userId}) or (r.user_id = ${actor.userId} and r.manager_id = ${other})))`,
  ];
  if (me.orgUnitId) parts.push(sql`exists (select 1 from employment_assignments a where a.user_id = ${other} and a.valid_to is null and a.org_unit_id = ${me.orgUnitId})`);
  if (me.managerId) parts.push(sql`exists (select 1 from manager_relationships r where r.user_id = ${other} and r.valid_to is null and r.manager_id = ${me.managerId})`);
  return sql<boolean>`(${sql.join(parts, sql` or `)})`;
}

function cards(tx: Tx, actor: AuthenticatedActor, me: Me) {
  const other = sql`${s.users.id}`;
  return tx
    .select({
      id: s.users.id,
      name: displayName,
      image: s.users.image,
      cover: s.users.profileCover,
      position: s.positions.name,
      orgUnit: s.orgUnits.name,
      city: s.businessUnits.city,
      state: s.businessUnits.state,
      relation: relationSql(actor.userId, other),
      mutualCount: mutualCountSql(actor.userId, other),
      online: onlineSql(other),
      commonInterests: commonInterestsSql(actor.userId, other),
      sameTeam: sameTeamSql(actor, me, other),
    })
    .from(s.users)
    .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
    .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
    .leftJoin(s.positions, eq(s.positions.id, s.employmentAssignments.positionId))
    .leftJoin(s.orgUnits, eq(s.orgUnits.id, s.employmentAssignments.orgUnitId))
    .leftJoin(s.businessUnits, eq(s.businessUnits.id, s.employmentAssignments.businessUnitId))
    .$dynamic();
}

type CardRow = Awaited<ReturnType<ReturnType<typeof cards>["execute"]>>[number];

async function toCards(tx: Tx, rows: CardRow[]): Promise<ConnectionCard[]> {
  const moods = await moodsOf(
    tx,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...toCard(r as unknown as ColleagueRow, moods),
    commonInterests: r.commonInterests ?? [],
    sameTeam: r.sameTeam,
    cover: r.cover,
  }));
}

const activeOthers = (actor: AuthenticatedActor) => and(eq(s.users.status, "active"), ne(s.users.id, actor.userId));

export type DiscoverQuery = { q: string; filter: DiscoverFilter; area?: string; location?: string; interest?: string; limit: number };

/** Interesses cujo nome combina com o termo da busca ("habilidade"). */
function interestKeysMatching(term: string): string[] {
  const t = normalize(term);
  return t.length < 2 ? [] : INTERESTS.filter((i) => normalize(i.label).includes(t)).map((i) => i.key);
}

/** Descobrir pessoas: busca por nome, cargo, área ou interesse, com filtros. Afinidade primeiro. */
export async function discoverPeople(actor: AuthenticatedActor, query: DiscoverQuery): Promise<{ items: ConnectionCard[]; total: number }> {
  return withTenant(actor, async (tx) => {
    const me = await whoAmI(tx, actor);
    const other = sql`${s.users.id}`;
    const conditions: (SQL | undefined)[] = [activeOthers(actor)];
    if (query.q) {
      const keys = interestKeysMatching(query.q);
      conditions.push(
        or(
          containsText(sql`${s.users.name}`, query.q),
          containsText(sql`${s.employeeProfiles.preferredName}`, query.q),
          containsText(sql`${s.positions.name}`, query.q),
          containsText(sql`${s.orgUnits.name}`, query.q),
          keys.length ? sql`exists (select 1 from user_interests i where i.user_id = ${other} and i.interest_key in ${keys})` : undefined,
        ),
      );
    }
    if (query.filter === "equipe") conditions.push(sameTeamSql(actor, me, other));
    if (query.filter === "departamento") conditions.push(me.departmentId ? sql`${s.employmentAssignments.orgUnitId} in ${orgSubtreeSql(me.departmentId)}` : sql`false`);
    if (query.filter === "interesses") conditions.push(sql`exists (select 1 from user_interests o join user_interests m on m.interest_key = o.interest_key and m.user_id = ${actor.userId} where o.user_id = ${other})`);
    if (query.filter === "conexoes") conditions.push(sql`${other} in ${friendIdsOf(actor.userId)}`);
    if (query.area) conditions.push(sql`${s.employmentAssignments.orgUnitId} in ${orgSubtreeSql(query.area)}`);
    if (query.location) conditions.push(eq(s.employmentAssignments.businessUnitId, query.location));
    if (query.interest) conditions.push(sql`exists (select 1 from user_interests i where i.user_id = ${other} and i.interest_key = ${query.interest})`);
    const where = and(...conditions);

    const affinity = sql`(select count(*) from user_interests o join user_interests m on m.interest_key = o.interest_key and m.user_id = ${actor.userId} where o.user_id = ${other})`;
    const rows = await cards(tx, actor, me)
      .where(where)
      .orderBy(...(query.filter === "conexoes" ? [asc(displayName)] : [desc(affinity), desc(mutualCountSql(actor.userId, other)), asc(displayName)]), asc(s.users.id))
      .limit(query.limit);
    const [total] = await tx
      .select({ n: count() })
      .from(s.users)
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
      .leftJoin(s.positions, eq(s.positions.id, s.employmentAssignments.positionId))
      .leftJoin(s.orgUnits, eq(s.orgUnits.id, s.employmentAssignments.orgUnitId))
      .where(where);
    return { items: await toCards(tx, rows), total: total?.n ?? 0 };
  });
}

/** Pessoas que você talvez conheça: ainda sem vínculo, pontuadas por afinidade (time, departamento, amigos e interesses). */
export async function listSuggestions(actor: AuthenticatedActor, limit: number): Promise<ConnectionCard[]> {
  return withTenant(actor, async (tx) => {
    const me = await whoAmI(tx, actor);
    const other = sql`${s.users.id}`;
    const score = sql`(
      ${mutualCountSql(actor.userId, other)} * 3
      + (select count(*) from user_interests o join user_interests m on m.interest_key = o.interest_key and m.user_id = ${actor.userId} where o.user_id = ${other}) * 2
      + case when ${sameTeamSql(actor, me, other)} then 5 else 0 end
      + case when ${me.departmentId ? sql`${s.employmentAssignments.orgUnitId} in ${orgSubtreeSql(me.departmentId)}` : sql`false`} then 2 else 0 end
    )`;
    const rows = await cards(tx, actor, me)
      .where(
        and(
          activeOthers(actor),
          sql`${relationSql(actor.userId, other)} = 'none'`,
          sql`not exists (select 1 from connection_suggestion_dismissals d where d.user_id = ${actor.userId} and d.dismissed_user_id = ${other})`,
        ),
      )
      .orderBy(desc(score), asc(displayName))
      .limit(limit);
    return toCards(tx, rows);
  });
}

/** O "x" do cartão: a pessoa não volta às sugestões. */
export async function dismissSuggestion(actor: AuthenticatedActor, userId: string) {
  await withTenant(actor, async (tx) => {
    await assertColleague(tx, actor, userId);
    await tx.insert(s.connectionSuggestionDismissals).values({ tenantId: actor.tenantId, userId: actor.userId, dismissedUserId: userId }).onConflictDoNothing();
  });
}

/** Pessoas em destaque: quem ainda não é conexão, com mais atividade pública recente nos comunicados que a pessoa atual vê. */
export async function listFeatured(actor: AuthenticatedActor, limit: number): Promise<ConnectionCard[]> {
  return withTenant(actor, async (tx) => {
    const since = sql`now() - ${WINDOW}`;
    const authored = await tx
      .select({ userId: s.announcements.createdBy, n: count() })
      .from(s.announcements)
      .where(and(visibleTo(actor), isNotNull(s.announcements.createdBy), gte(s.announcements.publishedAt, since)))
      .groupBy(s.announcements.createdBy);
    const comments = await tx
      .select({ userId: s.announcementComments.authorId, n: count() })
      .from(s.announcementComments)
      .innerJoin(s.announcements, eq(s.announcements.id, s.announcementComments.announcementId))
      .where(and(visibleTo(actor), isNull(s.announcementComments.deletedAt), gte(s.announcementComments.createdAt, since)))
      .groupBy(s.announcementComments.authorId);
    const likes = await tx
      .select({ userId: s.announcementComments.authorId, n: count() })
      .from(s.commentReactions)
      .innerJoin(s.announcementComments, eq(s.announcementComments.id, s.commentReactions.commentId))
      .innerJoin(s.announcements, eq(s.announcements.id, s.announcementComments.announcementId))
      .where(and(visibleTo(actor), isNull(s.announcementComments.deletedAt), gte(s.commentReactions.createdAt, since)))
      .groupBy(s.announcementComments.authorId);
    const scores = new Map<string, number>();
    const add = (rows: { userId: string | null; n: number }[], weight: number) => {
      for (const r of rows) if (r.userId && r.userId !== actor.userId) scores.set(r.userId, (scores.get(r.userId) ?? 0) + r.n * weight);
    };
    add(authored, 5);
    add(comments, 3);
    add(likes, 1);
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

    const me = await whoAmI(tx, actor);
    // Quem já é conexão não entra: os destaques servem para descobrir (e "Seguir" = pedir conexão).
    const notFriend = sql`${s.users.id} not in ${friendIdsOf(actor.userId)}`;
    const top = ranked.length ? await cards(tx, actor, me).where(and(activeOthers(actor), notFriend, inArray(s.users.id, ranked.slice(0, limit * 4)))) : [];
    const ordered = top.sort((a, b) => ranked.indexOf(a.id) - ranked.indexOf(b.id)).slice(0, limit);
    // Pouca atividade ainda: completa com quem tem mais amigos em comum.
    if (ordered.length < limit) {
      const extra = await cards(tx, actor, me)
        .where(and(activeOthers(actor), notFriend, ordered.length ? notInArray(s.users.id, ordered.map((r) => r.id)) : undefined))
        .orderBy(desc(mutualCountSql(actor.userId, sql`${s.users.id}`)), asc(displayName))
        .limit(limit - ordered.length);
      ordered.push(...extra);
    }
    return toCards(tx, ordered);
  });
}

/** Amigos online agora (presença só entre amigos). */
export async function listOnlineFriends(actor: AuthenticatedActor, limit: number): Promise<{ items: ConnectionCard[]; total: number }> {
  return withTenant(actor, async (tx) => {
    const me = await whoAmI(tx, actor);
    const where = and(activeOthers(actor), sql`${s.users.id} in ${friendIdsOf(actor.userId)}`, onlineSql(sql`${s.users.id}`));
    const rows = await cards(tx, actor, me).where(where).orderBy(asc(displayName)).limit(limit);
    const [total] = await tx.select({ n: count() }).from(s.users).where(where);
    return { items: await toCards(tx, rows), total: total?.n ?? 0 };
  });
}

/** Contadores das abas e do painel lateral. */
export async function connectionsCounts(actor: AuthenticatedActor): Promise<ConnectionsCounts> {
  return withTenant(actor, async (tx) => {
    const result = await tx.execute(sql`
      select
        (select count(*)::int from users u where u.status = 'active' and u.id in ${friendIdsOf(actor.userId)}) as friends,
        (select count(*)::int from friendships f join users u on u.id = f.addressee_id where f.status = 'pending' and f.requester_id = ${actor.userId} and u.status = 'active') as sent,
        (select count(*)::int from users u where u.status = 'active' and u.id in ${friendIdsOf(actor.userId)}
          and exists (select 1 from user_presence p where p.user_id = u.id and p.last_seen_at > now() - interval '2 minutes')) as online
    `);
    const row = (result as unknown as { rows: { friends: number; sent: number; online: number }[] }).rows[0];
    return { friends: row?.friends ?? 0, sent: row?.sent ?? 0, online: row?.online ?? 0, received: await countReceivedRequests(tx, actor) };
  });
}

async function assertColleague(tx: Tx, actor: AuthenticatedActor, userId: string) {
  if (userId === actor.userId) throw notFound("Pessoa não encontrada.");
  const [row] = await tx
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(eq(s.users.id, userId), eq(s.users.status, "active")));
  if (!row) throw notFound("Pessoa não encontrada.");
}

export async function getMyInterests(actor: AuthenticatedActor): Promise<string[]> {
  return withTenant(actor, async (tx) =>
    (
      await tx
        .select({ key: s.userInterests.interestKey })
        .from(s.userInterests)
        .where(eq(s.userInterests.userId, actor.userId))
    )
      .map((r) => r.key)
      .filter((k) => (INTEREST_KEYS as string[]).includes(k)),
  );
}

/** Troca os interesses do perfil (só chaves do catálogo, até MAX_INTERESTS). */
export async function setMyInterests(actor: AuthenticatedActor, keys: string[]): Promise<string[]> {
  const wanted = [...new Set(keys)];
  if (wanted.some((k) => !(INTEREST_KEYS as string[]).includes(k))) throw badRequest("Interesse desconhecido.");
  if (wanted.length > MAX_INTERESTS) throw badRequest(`Escolha até ${MAX_INTERESTS} interesses.`);
  return withTenant(actor, async (tx) => {
    await tx.delete(s.userInterests).where(and(eq(s.userInterests.userId, actor.userId), wanted.length ? notInArray(s.userInterests.interestKey, wanted) : undefined));
    if (wanted.length) await tx.insert(s.userInterests).values(wanted.map((interestKey) => ({ tenantId: actor.tenantId, userId: actor.userId, interestKey }))).onConflictDoNothing();
    return wanted;
  });
}
