import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { containsText } from "@/server/db/text-search";
import { notFound } from "@/server/http/errors";
import type { FriendRequests, GroupInCommon, PersonCard, PersonLite, PersonProfile, Relation } from "@/features/friends/types";
import { colleagues, displayName, friendIdsOf, interestsOf, moodsOf, relationSql, toCard } from "./shared";
import type { ColleagueQuery } from "./schemas";


/**
 * Amigos: descobrir colegas, pedir, aceitar, recusar e desfazer amizade.
 *
 * O cartão de colega mostra só dados profissionais que a empresa já exibe a
 * todos (nome, foto, cargo, área, local, frase do perfil) — nunca e-mail,
 * telefone, gestor ou dados de RH. Pessoas inativas não aparecem. Pedidos só
 * em nome próprio (policies RESTRICTIVE); aceitar, só quem recebeu.
 */

const pairCondition = (me: string, other: string) =>
  or(and(eq(s.friendships.requesterId, me), eq(s.friendships.addresseeId, other)), and(eq(s.friendships.requesterId, other), eq(s.friendships.addresseeId, me)))!;

async function assertActiveColleague(tx: Tx, actor: AuthenticatedActor, userId: string) {
  if (userId === actor.userId) throw notFound("Pessoa não encontrada.");
  const [row] = await tx
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(eq(s.users.id, userId), eq(s.users.status, "active")));
  if (!row) throw notFound("Pessoa não encontrada.");
}

/** Pessoas da empresa (exceto a própria), com busca por nome, cargo ou área. Pedidos recebidos e amigos primeiro. */
export async function listColleagues(actor: AuthenticatedActor, query: ColleagueQuery): Promise<{ items: PersonCard[]; total: number }> {
  return withTenant(actor, async (tx) => {
    const conditions = and(
      eq(s.users.status, "active"),
      ne(s.users.id, actor.userId),
      query.q
        ? or(
            containsText(sql`${s.users.name}`, query.q),
            containsText(sql`${s.employeeProfiles.preferredName}`, query.q),
            containsText(sql`${s.positions.name}`, query.q),
            containsText(sql`${s.orgUnits.name}`, query.q),
          )
        : undefined,
    );
    const relation = relationSql(actor.userId, sql`${s.users.id}`);
    const rows = await colleagues(tx, actor.userId)
      .where(conditions)
      .orderBy(sql`case ${relation} when 'received' then 0 when 'friends' then 1 when 'sent' then 2 else 3 end`, asc(displayName), asc(s.users.id))
      .limit(query.limit);
    const [count] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(s.users)
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .leftJoin(s.employmentAssignments, and(eq(s.employmentAssignments.userId, s.users.id), isNull(s.employmentAssignments.validTo)))
      .leftJoin(s.positions, eq(s.positions.id, s.employmentAssignments.positionId))
      .leftJoin(s.orgUnits, eq(s.orgUnits.id, s.employmentAssignments.orgUnitId))
      .where(conditions);
    const moods = await moodsOf(
      tx,
      rows.map((r) => r.id),
    );
    return { items: rows.map((r) => toCard(r, moods)), total: count?.total ?? 0 };
  });
}

/** Amigos da pessoa atual (ordem alfabética). */
export async function listFriends(actor: AuthenticatedActor): Promise<PersonCard[]> {
  return withTenant(actor, async (tx) => {
    const rows = await colleagues(tx, actor.userId)
      .where(and(eq(s.users.status, "active"), sql`${s.users.id} in ${friendIdsOf(actor.userId)}`))
      .orderBy(asc(displayName));
    const moods = await moodsOf(
      tx,
      rows.map((r) => r.id),
    );
    return rows.map((r) => toCard(r, moods));
  });
}

/** Pedidos recebidos e enviados, do mais recente ao mais antigo. */
export async function listRequests(actor: AuthenticatedActor): Promise<FriendRequests> {
  return withTenant(actor, async (tx) => {
    const pending = await tx
      .select({ requesterId: s.friendships.requesterId, addresseeId: s.friendships.addresseeId, at: s.friendships.createdAt })
      .from(s.friendships)
      .where(and(eq(s.friendships.status, "pending"), or(eq(s.friendships.requesterId, actor.userId), eq(s.friendships.addresseeId, actor.userId))))
      .orderBy(desc(s.friendships.createdAt));
    const otherOf = (r: (typeof pending)[number]) => (r.requesterId === actor.userId ? r.addresseeId : r.requesterId);
    const ids = pending.map(otherOf);
    if (ids.length === 0) return { received: [], sent: [] };
    const rows = await colleagues(tx, actor.userId).where(and(inArray(s.users.id, ids), eq(s.users.status, "active")));
    const moods = await moodsOf(tx, ids);
    const cards = new Map(rows.map((r) => [r.id, toCard(r, moods)]));
    const result: FriendRequests = { received: [], sent: [] };
    for (const r of pending) {
      const person = cards.get(otherOf(r));
      if (!person) continue;
      (r.requesterId === actor.userId ? result.sent : result.received).push({ person, at: r.at.toISOString() });
    }
    return result;
  });
}

/** Pedidos recebidos pendentes (contador do menu). */
export async function countReceivedRequests(tx: Tx, actor: AuthenticatedActor): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(s.friendships)
    .innerJoin(s.users, eq(s.users.id, s.friendships.requesterId))
    .where(and(eq(s.friendships.addresseeId, actor.userId), eq(s.friendships.status, "pending"), eq(s.users.status, "active")));
  return row?.n ?? 0;
}

/**
 * Pede amizade. Se a outra pessoa já tinha pedido, o pedido dela é aceito.
 * Idempotente: pedir de novo não duplica.
 */
export async function requestFriendship(actor: AuthenticatedActor, userId: string): Promise<{ relation: Relation }> {
  return withTenant(actor, async (tx) => {
    await assertActiveColleague(tx, actor, userId);
    const [existing] = await tx
      .select({ status: s.friendships.status, requesterId: s.friendships.requesterId })
      .from(s.friendships)
      .where(pairCondition(actor.userId, userId));
    if (existing?.status === "accepted") return { relation: "friends" as const };
    if (existing?.requesterId === actor.userId) return { relation: "sent" as const };
    if (existing) {
      await tx
        .update(s.friendships)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(and(eq(s.friendships.requesterId, userId), eq(s.friendships.addresseeId, actor.userId), eq(s.friendships.status, "pending")));
      return { relation: "friends" as const };
    }
    await tx.insert(s.friendships).values({ tenantId: actor.tenantId, requesterId: actor.userId, addresseeId: userId }).onConflictDoNothing();
    return { relation: "sent" as const };
  });
}

/** Aceita o pedido recebido de `userId`. */
export async function acceptFriendship(actor: AuthenticatedActor, userId: string): Promise<{ relation: Relation }> {
  return withTenant(actor, async (tx) => {
    await assertActiveColleague(tx, actor, userId);
    const updated = await tx
      .update(s.friendships)
      .set({ status: "accepted", respondedAt: new Date() })
      .where(and(eq(s.friendships.requesterId, userId), eq(s.friendships.addresseeId, actor.userId), eq(s.friendships.status, "pending")))
      .returning({ id: s.friendships.id });
    if (updated.length === 0) throw notFound("Pedido de amizade não encontrado.");
    return { relation: "friends" as const };
  });
}

/** Recusa (recebido) ou cancela (enviado) um pedido pendente. */
export async function dismissFriendRequest(actor: AuthenticatedActor, userId: string): Promise<{ relation: Relation }> {
  return withTenant(actor, async (tx) => {
    const removed = await tx
      .delete(s.friendships)
      .where(and(pairCondition(actor.userId, userId), eq(s.friendships.status, "pending")))
      .returning({ id: s.friendships.id });
    if (removed.length === 0) throw notFound("Pedido de amizade não encontrado.");
    return { relation: "none" as const };
  });
}

/** Desfaz a amizade. A conversa privada continua no histórico, mas sem novas mensagens. */
export async function removeFriend(actor: AuthenticatedActor, userId: string): Promise<{ relation: Relation }> {
  return withTenant(actor, async (tx) => {
    const removed = await tx
      .delete(s.friendships)
      .where(and(pairCondition(actor.userId, userId), eq(s.friendships.status, "accepted")))
      .returning({ id: s.friendships.id });
    if (removed.length === 0) throw notFound("Vocês não são amigos.");
    return { relation: "none" as const };
  });
}

/** Perfil do colega (painel lateral e "Ver perfil"): cartão, frase, capa, amigos e grupos em comum. */
export async function getColleagueProfile(actor: AuthenticatedActor, userId: string): Promise<PersonProfile> {
  return withTenant(actor, async (tx) => {
    const [row] = await colleagues(tx, actor.userId)
      .where(and(eq(s.users.id, userId), eq(s.users.status, "active"), ne(s.users.id, actor.userId)))
      .limit(1);
    if (!row) throw notFound("Pessoa não encontrada.");

    const [extra] = await tx
      .select({ headline: s.employeeProfiles.headline, cover: s.users.profileCover })
      .from(s.users)
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(eq(s.users.id, userId));

    const mutualFriends: PersonLite[] = await tx
      .select({ id: s.users.id, name: displayName, image: s.users.image })
      .from(s.users)
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(and(eq(s.users.status, "active"), sql`${s.users.id} in ${friendIdsOf(actor.userId)}`, sql`${s.users.id} in ${friendIdsOf(userId)}`))
      .orderBy(asc(displayName))
      .limit(5);

    // Conversas que a pessoa atual vê (RLS) em que o colega também está.
    const shared = await tx.execute(sql`
      select c.id, c.kind, c.title,
        (select count(*)::int from conversation_members x where x.conversation_id = c.id and x.left_at is null) as member_count
      from conversations c
      join conversation_members them on them.conversation_id = c.id and them.user_id = ${userId} and them.left_at is null
      order by c.kind, c.title
    `);
    const sharedRows = (shared as unknown as { rows: { id: string; kind: "direct" | "group"; title: string | null; member_count: number }[] }).rows;
    const groupsInCommon: GroupInCommon[] = sharedRows.filter((c) => c.kind === "group").map((c) => ({ id: c.id, title: c.title ?? "", memberCount: c.member_count }));
    const direct = sharedRows.find((c) => c.kind === "direct");

    const moods = await moodsOf(tx, [userId]);
    const [interests, mine, follow] = await Promise.all([
      interestsOf(tx, userId),
      interestsOf(tx, actor.userId),
      tx.execute(
        sql`select (select count(*)::int from user_follows f where f.followee_id = ${userId}) as followers, exists (select 1 from user_follows f where f.follower_id = ${actor.userId} and f.followee_id = ${userId}) as following`,
      ),
    ]);
    const followRow = (follow as unknown as { rows: { followers: number; following: boolean }[] }).rows[0];
    return {
      ...toCard(row, moods, sharedRows.length > 0),
      headline: extra?.headline ?? null,
      cover: extra?.cover ?? null,
      mutualFriends,
      groupsInCommon,
      directConversationId: direct?.id ?? null,
      interests,
      commonInterests: interests.filter((k) => mine.includes(k)),
      followers: followRow?.followers ?? 0,
      following: Boolean(followRow?.following),
    };
  });
}

