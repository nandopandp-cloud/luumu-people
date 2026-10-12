import "server-only";
import { and, asc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import type { ReactionKind } from "@/server/db/schema";
import { usersInOrgSubtreeSql } from "@/server/authz/resolver";
import { withTenant, type Tx } from "@/server/db/tenant";
import { containsText } from "@/server/db/text-search";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { keepMentions, mentionedIds, mentionsToPlainText, splitMentions, type MentionPart } from "@/lib/mentions";
import { visibleTo } from "./service";

/**
 * Reações e comentários do mural. Só em comunicados que a pessoa pode ver
 * (publicado, no ar e do público dela); fora disso, 404. Curtir e comentar
 * só em nome próprio (também garantido por policy no banco). Comentários não
 * são editados nem apagados fisicamente: o autor ou a moderação
 * (`comms.comment.moderate`) os removem do mural.
 *
 * Respostas têm um nível só. Menções valem apenas para quem pode ver o
 * comunicado (público) e está ativo; as demais viram texto simples. Menção,
 * resposta e curtida em comentário geram notificação para quem recebe, na
 * mesma transação.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

async function assertVisible(tx: Tx, actor: AuthenticatedActor, announcementId: string) {
  const [row] = await tx
    .select({ id: s.announcements.id, audienceOrgUnitId: s.announcements.audienceOrgUnitId })
    .from(s.announcements)
    .where(and(eq(s.announcements.id, announcementId), visibleTo(actor)));
  if (!row) throw notFound("Comunicado não encontrado.");
  return row;
}

/** Pessoas ativas que veem o comunicado (público: empresa toda ou a área e subáreas). */
const audienceCondition = (audienceOrgUnitId: string | null) =>
  and(eq(s.users.status, "active"), audienceOrgUnitId ? sql`${s.users.id} in ${usersInOrgSubtreeSql(audienceOrgUnitId)}` : undefined);

export type ReactionSummary = { counts: Record<ReactionKind, number>; total: number; mine: ReactionKind | null };

async function reactionSummary(tx: Tx, actor: AuthenticatedActor, announcementId: string): Promise<ReactionSummary> {
  const rows = await tx
    .select({
      kind: s.announcementReactions.kind,
      count: sql<number>`count(*)::int`,
      mine: sql<boolean>`coalesce(bool_or(${s.announcementReactions.userId} = ${actor.userId}), false)`,
    })
    .from(s.announcementReactions)
    .where(eq(s.announcementReactions.announcementId, announcementId))
    .groupBy(s.announcementReactions.kind);
  const counts: Record<ReactionKind, number> = { love: 0, cheer: 0, sad: 0 };
  for (const r of rows) counts[r.kind] = r.count;
  return { counts, total: counts.love + counts.cheer + counts.sad, mine: rows.find((r) => r.mine)?.kind ?? null };
}

/** Reage (ou troca de reação) em nome próprio: uma reação por pessoa e comunicado. */
export async function reactToAnnouncement(actor: AuthenticatedActor, announcementId: string, kind: ReactionKind) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    await tx
      .insert(s.announcementReactions)
      .values({ tenantId: actor.tenantId, announcementId, userId: actor.userId, kind })
      .onConflictDoUpdate({ target: [s.announcementReactions.tenantId, s.announcementReactions.announcementId, s.announcementReactions.userId], set: { kind } });
    return reactionSummary(tx, actor, announcementId);
  });
}

export async function removeReaction(actor: AuthenticatedActor, announcementId: string) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    await tx.delete(s.announcementReactions).where(and(eq(s.announcementReactions.announcementId, announcementId), eq(s.announcementReactions.userId, actor.userId)));
    return reactionSummary(tx, actor, announcementId);
  });
}

const canModerate = (actor: AuthenticatedActor) => hasTenantWide(actor, "comms.comment.moderate");

export type CommentView = {
  id: string;
  parentId: string | null;
  /** Texto já com as menções resolvidas para o nome atual de cada pessoa. */
  parts: MentionPart[];
  createdAt: Date;
  author: { id: string; name: string; image: string | null };
  likes: number;
  likedByMe: boolean;
  canDelete: boolean;
};

const displayName = sql<string>`coalesce(nullif(${s.employeeProfiles.preferredName}, ''), ${s.users.name})`;

/** Nome atual das pessoas mencionadas (só do próprio tenant, pela RLS). */
export async function mentionNames(tx: Tx, bodies: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(bodies.flatMap(mentionedIds))];
  if (ids.length === 0) return {};
  const rows = await tx
    .select({ id: s.users.id, name: displayName })
    .from(s.users)
    .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
    .where(inArray(s.users.id, ids));
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/** Comentários visíveis, do mais antigo ao mais recente (respostas de comentário removido saem junto). */
export async function listComments(actor: AuthenticatedActor, announcementId: string): Promise<CommentView[]> {
  const moderator = canModerate(actor);
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    const rows = await tx
      .select({
        id: s.announcementComments.id,
        parentId: s.announcementComments.parentId,
        body: s.announcementComments.body,
        createdAt: s.announcementComments.createdAt,
        authorId: s.users.id,
        name: displayName,
        image: s.users.image,
        likes: sql<number>`(select count(*)::int from comment_reactions r where r.tenant_id = announcement_comments.tenant_id and r.comment_id = announcement_comments.id)`,
        likedByMe: sql<boolean>`exists (select 1 from comment_reactions r where r.tenant_id = announcement_comments.tenant_id and r.comment_id = announcement_comments.id and r.user_id = ${actor.userId})`,
      })
      .from(s.announcementComments)
      .innerJoin(s.users, eq(s.users.id, s.announcementComments.authorId))
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(and(eq(s.announcementComments.announcementId, announcementId), isNull(s.announcementComments.deletedAt)))
      .orderBy(asc(s.announcementComments.createdAt))
      .limit(500);
    const roots = new Set(rows.filter((r) => !r.parentId).map((r) => r.id));
    const visible = rows.filter((r) => !r.parentId || roots.has(r.parentId));
    const names = await mentionNames(tx, visible.map((r) => r.body));
    return visible.map((r) => ({
      id: r.id,
      parentId: r.parentId,
      parts: splitMentions(r.body).map((p) => (p.type === "mention" ? { ...p, name: names[p.userId] ?? p.name } : p)),
      createdAt: r.createdAt,
      author: { id: r.authorId, name: r.name, image: r.image },
      likes: r.likes,
      likedByMe: r.likedByMe,
      canDelete: moderator || r.authorId === actor.userId,
    }));
  });
}

/** Pessoas que podem ser mencionadas no comunicado (nome e foto apenas). */
export async function listMentionable(actor: AuthenticatedActor, announcementId: string, q: string) {
  return withTenant(actor, async (tx) => {
    const announcement = await assertVisible(tx, actor, announcementId);
    return tx
      .select({ id: s.users.id, name: displayName, image: s.users.image })
      .from(s.users)
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(
        and(
          audienceCondition(announcement.audienceOrgUnitId),
          ne(s.users.id, actor.userId),
          or(containsText(sql`${s.users.name}`, q), containsText(sql`${s.employeeProfiles.preferredName}`, q)),
        ),
      )
      .orderBy(asc(displayName))
      .limit(8);
  });
}

const MAX_VISIBLE_CHARS = 1000;

export async function addComment(actor: AuthenticatedActor, announcementId: string, input: { body: string; parentId?: string | null }) {
  return withTenant(actor, async (tx) => {
    const announcement = await assertVisible(tx, actor, announcementId);

    // Resposta: sempre presa a um comentário de primeiro nível do mesmo comunicado.
    let parent: { id: string; authorId: string } | null = null;
    if (input.parentId) {
      const [found] = await tx
        .select({ id: s.announcementComments.id, parentId: s.announcementComments.parentId, authorId: s.announcementComments.authorId })
        .from(s.announcementComments)
        .where(and(eq(s.announcementComments.id, input.parentId), eq(s.announcementComments.announcementId, announcementId), isNull(s.announcementComments.deletedAt)));
      if (!found) throw notFound("Comentário não encontrado.");
      if (found.parentId) {
        const [root] = await tx
          .select({ id: s.announcementComments.id, authorId: s.announcementComments.authorId })
          .from(s.announcementComments)
          .where(and(eq(s.announcementComments.id, found.parentId), isNull(s.announcementComments.deletedAt)));
        if (!root) throw notFound("Comentário não encontrado.");
        parent = root;
      } else parent = { id: found.id, authorId: found.authorId };
    }

    // Menções: só pessoas ativas que veem o comunicado (e nunca a própria pessoa).
    const ids = mentionedIds(input.body).filter((id) => id !== actor.userId);
    const allowed = ids.length
      ? new Set(
          (
            await tx
              .select({ id: s.users.id })
              .from(s.users)
              .where(and(inArray(s.users.id, ids), audienceCondition(announcement.audienceOrgUnitId)))
          ).map((u) => u.id),
        )
      : new Set<string>();
    const body = keepMentions(input.body, allowed).trim();
    if (!body) throw badRequest("Escreva um comentário.");
    if (mentionsToPlainText(body).length > MAX_VISIBLE_CHARS) throw badRequest("Use no máximo 1.000 caracteres.");

    const [row] = await tx
      .insert(s.announcementComments)
      .values({ tenantId: actor.tenantId, announcementId, authorId: actor.userId, parentId: parent?.id ?? null, body })
      .returning({ id: s.announcementComments.id });
    const commentId = row!.id;

    const notifications = [
      ...[...allowed].map((recipientId) => ({ recipientId, type: "mention" as const })),
      ...(parent && parent.authorId !== actor.userId && !allowed.has(parent.authorId) ? [{ recipientId: parent.authorId, type: "comment_reply" as const }] : []),
    ];
    if (notifications.length) {
      await tx
        .insert(s.notifications)
        .values(notifications.map((n) => ({ tenantId: actor.tenantId, actorId: actor.userId, announcementId, commentId, ...n })))
        .onConflictDoNothing();
    }
    return { id: commentId };
  });
}

async function loadComment(tx: Tx, announcementId: string, commentId: string) {
  const [comment] = await tx
    .select({ id: s.announcementComments.id, authorId: s.announcementComments.authorId })
    .from(s.announcementComments)
    .where(and(eq(s.announcementComments.id, commentId), eq(s.announcementComments.announcementId, announcementId), isNull(s.announcementComments.deletedAt)));
  if (!comment) throw notFound("Comentário não encontrado.");
  return comment;
}

async function commentLikeSummary(tx: Tx, actor: AuthenticatedActor, commentId: string) {
  const [row] = await tx
    .select({
      likes: sql<number>`count(*)::int`,
      likedByMe: sql<boolean>`coalesce(bool_or(${s.commentReactions.userId} = ${actor.userId}), false)`,
    })
    .from(s.commentReactions)
    .where(eq(s.commentReactions.commentId, commentId));
  return { likes: row?.likes ?? 0, likedByMe: row?.likedByMe ?? false };
}

/** Curte um comentário; quem escreveu recebe a notificação (agrupada por comentário na leitura). */
export async function likeComment(actor: AuthenticatedActor, announcementId: string, commentId: string) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    const comment = await loadComment(tx, announcementId, commentId);
    const inserted = await tx
      .insert(s.commentReactions)
      .values({ tenantId: actor.tenantId, commentId, userId: actor.userId })
      .onConflictDoNothing()
      .returning({ commentId: s.commentReactions.commentId });
    if (inserted.length && comment.authorId !== actor.userId) {
      await tx
        .insert(s.notifications)
        .values({ tenantId: actor.tenantId, recipientId: comment.authorId, actorId: actor.userId, type: "comment_like", announcementId, commentId })
        .onConflictDoNothing();
    }
    return commentLikeSummary(tx, actor, commentId);
  });
}

/** Desfaz a curtida e a notificação que ela gerou. */
export async function unlikeComment(actor: AuthenticatedActor, announcementId: string, commentId: string) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    await loadComment(tx, announcementId, commentId);
    await tx.delete(s.commentReactions).where(and(eq(s.commentReactions.commentId, commentId), eq(s.commentReactions.userId, actor.userId)));
    await tx
      .delete(s.notifications)
      .where(and(eq(s.notifications.commentId, commentId), eq(s.notifications.actorId, actor.userId), eq(s.notifications.type, "comment_like")));
    return commentLikeSummary(tx, actor, commentId);
  });
}

/** Remove um comentário: o próprio autor ou a moderação (auditado, sem o texto). */
export async function removeComment(actor: AuthenticatedActor, announcementId: string, commentId: string, meta: Meta) {
  const moderator = canModerate(actor);
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    const [comment] = await tx
      .select({ authorId: s.announcementComments.authorId })
      .from(s.announcementComments)
      .where(and(eq(s.announcementComments.id, commentId), eq(s.announcementComments.announcementId, announcementId), isNull(s.announcementComments.deletedAt)));
    if (!comment) throw notFound("Comentário não encontrado.");
    const own = comment.authorId === actor.userId;
    if (!own && !moderator) throw forbidden("Você só pode remover os seus comentários.");
    await tx.update(s.announcementComments).set({ deletedAt: new Date(), deletedBy: actor.userId }).where(eq(s.announcementComments.id, commentId));
    if (!own) {
      await recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "comms.comment_removed",
        resourceType: "announcement",
        resourceId: announcementId,
        metadata: { commentId },
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      });
    }
  });
}
