import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { forbidden, notFound } from "@/server/http/errors";
import { visibleTo } from "./service";

/**
 * Curtidas e comentários do mural. Só em comunicados que a pessoa pode ver
 * (publicado, no ar e do público dela); fora disso, 404. Curtir e comentar
 * só em nome próprio (também garantido por policy no banco). Comentários não
 * são editados nem apagados fisicamente: o autor ou a moderação
 * (`comms.comment.moderate`) os removem do mural.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

async function assertVisible(tx: Tx, actor: AuthenticatedActor, announcementId: string) {
  const [row] = await tx.select({ id: s.announcements.id }).from(s.announcements).where(and(eq(s.announcements.id, announcementId), visibleTo(actor)));
  if (!row) throw notFound("Comunicado não encontrado.");
}

async function likeSummary(tx: Tx, actor: AuthenticatedActor, announcementId: string) {
  const [row] = await tx
    .select({
      likes: sql<number>`count(*)::int`,
      likedByMe: sql<boolean>`coalesce(bool_or(${s.announcementReactions.userId} = ${actor.userId}), false)`,
    })
    .from(s.announcementReactions)
    .where(eq(s.announcementReactions.announcementId, announcementId));
  return { likes: row?.likes ?? 0, likedByMe: row?.likedByMe ?? false };
}

export async function likeAnnouncement(actor: AuthenticatedActor, announcementId: string) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    await tx.insert(s.announcementReactions).values({ tenantId: actor.tenantId, announcementId, userId: actor.userId }).onConflictDoNothing();
    return likeSummary(tx, actor, announcementId);
  });
}

export async function unlikeAnnouncement(actor: AuthenticatedActor, announcementId: string) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    await tx.delete(s.announcementReactions).where(and(eq(s.announcementReactions.announcementId, announcementId), eq(s.announcementReactions.userId, actor.userId)));
    return likeSummary(tx, actor, announcementId);
  });
}

const canModerate = (actor: AuthenticatedActor) => hasTenantWide(actor, "comms.comment.moderate");

export type CommentView = { id: string; body: string; createdAt: Date; author: { id: string; name: string; image: string | null }; canDelete: boolean };

/** Comentários visíveis, do mais antigo ao mais recente. */
export async function listComments(actor: AuthenticatedActor, announcementId: string): Promise<CommentView[]> {
  const moderator = canModerate(actor);
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    const rows = await tx
      .select({
        id: s.announcementComments.id,
        body: s.announcementComments.body,
        createdAt: s.announcementComments.createdAt,
        authorId: s.users.id,
        name: s.users.name,
        preferredName: s.employeeProfiles.preferredName,
        image: s.users.image,
      })
      .from(s.announcementComments)
      .innerJoin(s.users, eq(s.users.id, s.announcementComments.authorId))
      .leftJoin(s.employeeProfiles, eq(s.employeeProfiles.userId, s.users.id))
      .where(and(eq(s.announcementComments.announcementId, announcementId), isNull(s.announcementComments.deletedAt)))
      .orderBy(asc(s.announcementComments.createdAt))
      .limit(500);
    return rows.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt,
      author: { id: r.authorId, name: r.preferredName || r.name, image: r.image },
      canDelete: moderator || r.authorId === actor.userId,
    }));
  });
}

export async function addComment(actor: AuthenticatedActor, announcementId: string, body: string) {
  return withTenant(actor, async (tx) => {
    await assertVisible(tx, actor, announcementId);
    const [row] = await tx
      .insert(s.announcementComments)
      .values({ tenantId: actor.tenantId, announcementId, authorId: actor.userId, body })
      .returning({ id: s.announcementComments.id });
    return { id: row!.id };
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
