import "server-only";
import { and, desc, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { mentionNames } from "@/server/modules/announcements/engagement";
import { visibleTo } from "@/server/modules/announcements/service";
import { mentionsToPlainText } from "@/lib/mentions";

/**
 * Central de notificações da pessoa (ver src/server/db/schema/notifications.ts).
 *
 *  - Calculadas: "Novo comunicado" (comunicados que a pessoa vê, dos últimos
 *    30 dias, exceto os que ela mesma criou), "Nova pesquisa" (convites da
 *    própria pessoa) e "Lembrete de pesquisa" (convite pendente com até 2 dias
 *    para o encerramento). Pesquisa respondida conta como lida.
 *  - Gravadas: menção, resposta e curtidas em comentário (agrupadas por
 *    comentário), só de comunicados que a pessoa ainda vê e comentários não removidos.
 *  - Amizade (calculadas, a partir de `friendships`): pedido recebido ainda
 *    pendente e pedido aceito pela outra pessoa (últimos 30 dias). Pedido
 *    recusado ou cancelado some sozinho.
 *  - Categorias silenciadas nas preferências não aparecem nem contam.
 */

export type NotificationCategory = s.NotificationCategory;
export const NOTIFICATION_TABS = ["todas", "nao-lidas", "mencoes"] as const;
export type NotificationTab = (typeof NOTIFICATION_TABS)[number];

export type NotificationView = {
  /** Chave estável do item: `announcement|survey|reminder|friend|friendok:<id>`, `n:<id>` ou `like:<commentId>`. */
  key: string;
  category: NotificationCategory;
  title: string;
  /** Parte em destaque no início do texto (nome de quem interagiu), quando houver. */
  lead: string | null;
  body: string;
  context: string;
  at: Date;
  ago: string;
  agoShort: string;
  unread: boolean;
  href: string;
  action: string;
  /** Ação principal em destaque (ex.: responder pesquisa pendente). */
  primary: boolean;
  actors: { name: string; image: string | null }[];
  thumbnail: { coverFileId: string } | { survey: true } | null;
};

export type NotificationCounts = {
  all: number;
  unread: number;
  mentions: number;
  groups: { surveys: number; announcements: number; mentions: number; interactions: number };
};

const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;
const REMINDER_DAYS = 2;
const TZ = "America/Sao_Paulo";

const brDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
const daysUntil = (d: Date, now: Date) => Math.max(0, Math.round((Date.parse(brDay(d)) - Date.parse(brDay(now))) / DAY));
const firstName = (name: string) => name.split(" ")[0] ?? name;
const excerpt = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** "agora", "5 min atrás", "1 hora atrás", "3 dias atrás" (e a forma curta do sino). */
export function relativeTime(at: Date, now: Date): { ago: string; agoShort: string } {
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 1) return { ago: "agora", agoShort: "agora" };
  if (minutes < 60) return { ago: `${minutes} min atrás`, agoShort: `${minutes} min atrás` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { ago: `${hours} ${hours === 1 ? "hora" : "horas"} atrás`, agoShort: `${hours} h atrás` };
  const days = Math.floor(hours / 24);
  if (days < 7) return { ago: `${days} ${days === 1 ? "dia" : "dias"} atrás`, agoShort: `${days} d atrás` };
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).format(at);
  return { ago: date, agoShort: date };
}

/** Grupo do resumo (Pesquisas, Comunicados, Menções, Interações). */
export const SUMMARY_GROUP: Record<NotificationCategory, keyof NotificationCounts["groups"]> = {
  surveys: "surveys",
  reminders: "surveys",
  announcements: "announcements",
  mentions: "mentions",
  comments: "interactions",
  likes: "interactions",
  friends: "interactions",
};

async function mutedCategories(tx: Tx, actor: AuthenticatedActor): Promise<Set<NotificationCategory>> {
  const [row] = await tx.select({ muted: s.notificationPreferences.muted }).from(s.notificationPreferences).where(eq(s.notificationPreferences.userId, actor.userId));
  return new Set((row?.muted ?? []) as NotificationCategory[]);
}

type Draft = Omit<NotificationView, "ago" | "agoShort" | "unread"> & { read: boolean };

/** Monta todas as notificações da pessoa (sem filtros de aba), da mais recente para a mais antiga. */
async function collect(tx: Tx, actor: AuthenticatedActor, now: Date): Promise<NotificationView[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
  const muted = await mutedCategories(tx, actor);
  const drafts: Draft[] = [];

  // Novos comunicados (calculados): os que a pessoa vê, exceto os que ela criou.
  if (!muted.has("announcements")) {
    const rows = await tx
      .select({ id: s.announcements.id, title: s.announcements.title, coverFileId: s.announcements.coverFileId, publishedAt: s.announcements.publishedAt })
      .from(s.announcements)
      .where(and(visibleTo(actor), gte(s.announcements.publishedAt, since), or(isNull(s.announcements.createdBy), ne(s.announcements.createdBy, actor.userId))))
      .orderBy(desc(s.announcements.publishedAt))
      .limit(100);
    for (const a of rows) {
      drafts.push({
        key: `announcement:${a.id}`,
        category: "announcements",
        title: "Novo comunicado",
        lead: null,
        body: `O comunicado “${a.title}” foi publicado. Confira todos os detalhes.`,
        context: "Comunicados",
        at: a.publishedAt!,
        href: `/comunicados/${a.id}`,
        action: "Ver comunicado",
        primary: false,
        actors: [],
        thumbnail: a.coverFileId ? { coverFileId: a.coverFileId } : null,
        read: false,
      });
    }
  }

  // Pesquisas (calculadas): só o convite da própria pessoa — nada sobre respostas.
  if (!muted.has("surveys") || !muted.has("reminders")) {
    const rows = await tx
      .select({
        id: s.surveys.id,
        title: s.surveys.title,
        status: s.surveys.status,
        launchedAt: s.surveys.launchedAt,
        closesAt: s.surveys.closesAt,
        invitation: s.surveyInvitations.status,
      })
      .from(s.surveyInvitations)
      .innerJoin(s.surveys, eq(s.surveys.id, s.surveyInvitations.surveyId))
      .where(and(eq(s.surveyInvitations.userId, actor.userId), ne(s.surveys.status, "draft"), or(eq(s.surveys.status, "active"), gte(s.surveys.launchedAt, since))))
      .limit(50);
    for (const v of rows) {
      if (!v.launchedAt) continue;
      const pending = v.invitation !== "completed";
      const open = v.status === "active" && v.closesAt !== null && v.closesAt.getTime() > now.getTime();
      if (!muted.has("surveys") && v.launchedAt.getTime() >= since.getTime()) {
        drafts.push({
          key: `survey:${v.id}`,
          category: "surveys",
          title: "Nova pesquisa disponível",
          lead: null,
          body: `${v.title} já está disponível para você responder. Sua opinião é muito importante!`,
          context: "Luumu People",
          at: v.launchedAt,
          href: `/pesquisas/${v.id}`,
          action: pending && open ? "Responder agora" : "Ver pesquisa",
          primary: pending && open,
          actors: [],
          thumbnail: { survey: true },
          // Respondida = lida.
          read: !pending,
        });
      }
      if (!muted.has("reminders") && pending && open && v.closesAt!.getTime() - now.getTime() <= REMINDER_DAYS * DAY) {
        const days = daysUntil(v.closesAt!, now);
        const at = new Date(Math.max(v.launchedAt.getTime(), v.closesAt!.getTime() - REMINDER_DAYS * DAY));
        drafts.push({
          key: `reminder:${v.id}`,
          category: "reminders",
          title: "Lembrete de pesquisa",
          lead: null,
          body:
            days === 0
              ? `A ${v.title} encerra hoje. Ainda não recebemos sua resposta.`
              : `${days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`} para responder a ${v.title}. Ainda não recebemos sua resposta.`,
          context: v.title,
          at,
          href: `/pesquisas/${v.id}`,
          action: "Responder agora",
          primary: false,
          actors: [],
          thumbnail: null,
          read: false,
        });
      }
    }
  }

  // Interações gravadas: só de comunicados que a pessoa ainda vê e comentários não removidos.
  const wanted = (["mention", "comment_reply", "comment_like"] as const).filter(
    (type) => !muted.has(type === "mention" ? "mentions" : type === "comment_reply" ? "comments" : "likes"),
  );
  if (wanted.length) {
    const actorUser = alias(s.users, "actor_user");
    const actorProfile = alias(s.employeeProfiles, "actor_profile");
    const rows = await tx
      .select({
        id: s.notifications.id,
        type: s.notifications.type,
        announcementId: s.notifications.announcementId,
        commentId: s.notifications.commentId,
        createdAt: s.notifications.createdAt,
        readAt: s.notifications.readAt,
        announcementTitle: s.announcements.title,
        commentBody: s.announcementComments.body,
        actorName: sql<string>`coalesce(nullif(${actorProfile.preferredName}, ''), ${actorUser.name})`,
        actorImage: actorUser.image,
      })
      .from(s.notifications)
      .innerJoin(s.announcements, eq(s.announcements.id, s.notifications.announcementId))
      .innerJoin(s.announcementComments, eq(s.announcementComments.id, s.notifications.commentId))
      .innerJoin(actorUser, eq(actorUser.id, s.notifications.actorId))
      .leftJoin(actorProfile, eq(actorProfile.userId, actorUser.id))
      .where(
        and(
          eq(s.notifications.recipientId, actor.userId),
          inArray(s.notifications.type, wanted),
          gte(s.notifications.createdAt, since),
          isNull(s.announcementComments.deletedAt),
          visibleTo(actor),
        ),
      )
      .orderBy(desc(s.notifications.createdAt))
      .limit(300);

    const names = await mentionNames(
      tx,
      rows.filter((r) => r.type === "mention").map((r) => r.commentBody),
    );
    const likes = new Map<string, typeof rows>();
    for (const r of rows) {
      const link = `/comunicados/${r.announcementId}#comentario-${r.commentId}`;
      if (r.type === "comment_like") {
        likes.set(r.commentId, [...(likes.get(r.commentId) ?? []), r]);
        continue;
      }
      if (r.type === "mention") {
        drafts.push({
          key: `n:${r.id}`,
          category: "mentions",
          title: "Você recebeu uma menção",
          lead: r.actorName,
          body: `comentou: “${excerpt(mentionsToPlainText(r.commentBody, names))}”`,
          context: r.announcementTitle,
          at: r.createdAt,
          href: link,
          action: "Ver comentário",
          primary: false,
          actors: [{ name: r.actorName, image: r.actorImage }],
          thumbnail: null,
          read: r.readAt !== null,
        });
      } else {
        drafts.push({
          key: `n:${r.id}`,
          category: "comments",
          title: `${r.actorName} comentou`,
          lead: firstName(r.actorName),
          body: `respondeu ao seu comentário em “${r.announcementTitle}”.`,
          context: r.announcementTitle,
          at: r.createdAt,
          href: link,
          action: "Ver conversa",
          primary: false,
          actors: [{ name: r.actorName, image: r.actorImage }],
          thumbnail: null,
          read: r.readAt !== null,
        });
      }
    }
    // Curtidas: uma notificação por comentário, com quem curtiu por último primeiro.
    for (const [commentId, group] of likes) {
      const latest = group[0]!;
      const people = group.map((g) => firstName(g.actorName));
      const others = people.length - 2;
      const lead = people.length === 1 ? people[0]! : people.length === 2 ? `${people[0]} e ${people[1]}` : `${people[0]}, ${people[1]}`;
      const verb = people.length === 1 ? "curtiu" : "curtiram";
      drafts.push({
        key: `like:${commentId}`,
        category: "likes",
        title: "Seu comentário recebeu curtidas",
        lead,
        body: `${others > 0 ? `e ${others === 1 ? "outra pessoa" : `outras ${others} pessoas`} ` : ""}${verb} seu comentário no comunicado “${latest.announcementTitle}”.`,
        context: latest.announcementTitle,
        at: latest.createdAt,
        href: `/comunicados/${latest.announcementId}#comentario-${commentId}`,
        action: "Ver comentário",
        primary: false,
        actors: group.slice(0, 3).map((g) => ({ name: g.actorName, image: g.actorImage })),
        thumbnail: null,
        read: group.every((g) => g.readAt !== null),
      });
    }
  }

  // Amizade (calculadas): pedidos recebidos pendentes e pedidos aceitos pela outra pessoa.
  if (!muted.has("friends")) {
    const other = alias(s.users, "friend_user");
    const otherProfile = alias(s.employeeProfiles, "friend_profile");
    const rows = await tx
      .select({
        id: s.friendships.id,
        status: s.friendships.status,
        requesterId: s.friendships.requesterId,
        createdAt: s.friendships.createdAt,
        respondedAt: s.friendships.respondedAt,
        otherId: other.id,
        name: sql<string>`coalesce(nullif(${otherProfile.preferredName}, ''), ${other.name})`,
        image: other.image,
      })
      .from(s.friendships)
      .innerJoin(other, sql`${other.id} = case when ${s.friendships.requesterId} = ${actor.userId} then ${s.friendships.addresseeId} else ${s.friendships.requesterId} end`)
      .leftJoin(otherProfile, eq(otherProfile.userId, other.id))
      .where(
        and(
          eq(other.status, "active"),
          or(
            and(eq(s.friendships.status, "pending"), eq(s.friendships.addresseeId, actor.userId)),
            and(eq(s.friendships.status, "accepted"), eq(s.friendships.requesterId, actor.userId), gte(s.friendships.respondedAt, since)),
          ),
        ),
      )
      .limit(100);
    for (const f of rows) {
      const received = f.status === "pending";
      drafts.push({
        key: `${received ? "friend" : "friendok"}:${f.id}`,
        category: "friends",
        title: received ? "Novo pedido de amizade" : "Pedido de amizade aceito",
        lead: f.name,
        body: received ? "quer ser seu amigo no Luumu People." : "aceitou seu pedido de amizade. Que tal mandar um oi? 👋",
        context: "Amizades",
        at: received ? f.createdAt : f.respondedAt!,
        href: received ? "/conversas?aba=solicitacoes" : `/pessoas/${f.otherId}`,
        action: received ? "Ver solicitação" : "Ver perfil",
        primary: received,
        actors: [{ name: f.name, image: f.image }],
        thumbnail: null,
        read: false,
      });
    }
  }

  // Leitura das calculadas.
  const derivedKeys = drafts.filter((d) => /^(announcement|survey|reminder|friend|friendok):/.test(d.key)).map((d) => d.key);
  const reads = derivedKeys.length
    ? new Set((await tx.select({ key: s.notificationReads.key }).from(s.notificationReads).where(and(eq(s.notificationReads.userId, actor.userId), inArray(s.notificationReads.key, derivedKeys)))).map((r) => r.key))
    : new Set<string>();

  return drafts
    .map(({ read, ...d }) => ({ ...d, ...relativeTime(d.at, now), unread: !(read || reads.has(d.key)) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

function countsOf(items: NotificationView[]): NotificationCounts {
  const groups = { surveys: 0, announcements: 0, mentions: 0, interactions: 0 };
  for (const n of items) groups[SUMMARY_GROUP[n.category]] += 1;
  return { all: items.length, unread: items.filter((n) => n.unread).length, mentions: items.filter((n) => n.category === "mentions").length, groups };
}

export type NotificationQuery = { tab?: NotificationTab; categories?: NotificationCategory[]; limit?: number };

/** Lista da central de notificações, com contadores (os contadores ignoram aba e filtros). */
export async function listNotifications(actor: AuthenticatedActor, { tab = "todas", categories, limit = 50 }: NotificationQuery = {}) {
  return withTenant(actor, async (tx) => {
    const all = await collect(tx, actor, new Date());
    const filtered = all.filter(
      (n) => (tab !== "nao-lidas" || n.unread) && (tab !== "mencoes" || n.category === "mentions") && (!categories || categories.includes(n.category)),
    );
    return { items: filtered.slice(0, limit), total: filtered.length, counts: countsOf(all) };
  });
}

/** Quantas não lidas (sino e menu). */
/** Atalhos da saudação da home: pesquisas e comunicados ainda não lidos. */
export async function unreadHighlights(actor: AuthenticatedActor): Promise<{ surveys: number; announcements: number }> {
  return withTenant(actor, async (tx) => {
    const unread = (await collect(tx, actor, new Date())).filter((n) => n.unread);
    return { surveys: unread.filter((n) => n.category === "surveys").length, announcements: unread.filter((n) => n.category === "announcements").length };
  });
}

export async function countUnread(actor: AuthenticatedActor): Promise<number> {
  return withTenant(actor, async (tx) => (await collect(tx, actor, new Date())).filter((n) => n.unread).length);
}

const DERIVED = /^(announcement|survey|reminder|friend|friendok):[0-9a-f-]{36}$/;

function splitKeys(keys: string[]) {
  return {
    derived: keys.filter((k) => DERIVED.test(k)),
    stored: keys.filter((k) => k.startsWith("n:")).map((k) => k.slice(2)),
    likes: keys.filter((k) => k.startsWith("like:")).map((k) => k.slice(5)),
  };
}

async function setRead(tx: Tx, actor: AuthenticatedActor, keys: string[], read: boolean) {
  const { derived, stored, likes } = splitKeys(keys);
  if (derived.length) {
    if (read) {
      await tx
        .insert(s.notificationReads)
        .values(derived.map((key) => ({ tenantId: actor.tenantId, userId: actor.userId, key })))
        .onConflictDoNothing();
    } else {
      await tx.delete(s.notificationReads).where(and(eq(s.notificationReads.userId, actor.userId), inArray(s.notificationReads.key, derived)));
    }
  }
  const mine = eq(s.notifications.recipientId, actor.userId);
  if (stored.length) await tx.update(s.notifications).set({ readAt: read ? new Date() : null }).where(and(mine, inArray(s.notifications.id, stored)));
  if (likes.length) {
    await tx
      .update(s.notifications)
      .set({ readAt: read ? new Date() : null })
      .where(and(mine, eq(s.notifications.type, "comment_like"), inArray(s.notifications.commentId, likes)));
  }
}

export async function markNotifications(actor: AuthenticatedActor, keys: string[], read: boolean) {
  return withTenant(actor, async (tx) => {
    await setRead(tx, actor, keys, read);
    return { unread: (await collect(tx, actor, new Date())).filter((n) => n.unread).length };
  });
}

/** Marca como lidas todas as notificações atuais. */
export async function markAllNotificationsRead(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const unread = (await collect(tx, actor, new Date())).filter((n) => n.unread).map((n) => n.key);
    if (unread.length) await setRead(tx, actor, unread, true);
    return { unread: 0 };
  });
}

export async function getNotificationPreferences(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => ({ muted: [...(await mutedCategories(tx, actor))] }));
}

export async function setNotificationPreferences(actor: AuthenticatedActor, muted: NotificationCategory[]) {
  const unique = [...new Set(muted)];
  return withTenant(actor, async (tx) => {
    await tx
      .insert(s.notificationPreferences)
      .values({ tenantId: actor.tenantId, userId: actor.userId, muted: unique })
      .onConflictDoUpdate({ target: [s.notificationPreferences.tenantId, s.notificationPreferences.userId], set: { muted: unique, updatedAt: new Date() } });
    return { muted: unique };
  });
}
