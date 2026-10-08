import "server-only";
import { and, desc, eq, gt, inArray, lte, sql, type SQL } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import type { AnnouncementInput, ManagedFilter } from "./schemas";

/**
 * Comunicados.
 *  - Mural do colaborador: só PUBLICADOS com data de publicação já alcançada
 *    (agendados ficam invisíveis até a data). Fixados primeiro.
 *  - Gestão: `comms.announcement.create` cria e edita rascunhos;
 *    `comms.announcement.publish` publica, agenda, fixa, arquiva e edita o que
 *    já está no ar. Segmentação por público: próxima etapa.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };

const feedColumns = {
  id: s.announcements.id,
  title: s.announcements.title,
  summary: s.announcements.summary,
  category: s.announcements.category,
  theme: s.announcements.theme,
  illustration: s.announcements.illustration,
  pinned: s.announcements.pinned,
  publishedAt: s.announcements.publishedAt,
};

const visibleNow = () => and(eq(s.announcements.status, "published"), lte(s.announcements.publishedAt, new Date()));

/** Mural resumido (Início): fixados primeiro, depois os mais recentes. */
export async function listAnnouncementFeed(actor: AuthenticatedActor, limit = 3) {
  return withTenant(actor, (tx) =>
    tx.select(feedColumns).from(s.announcements).where(visibleNow()).orderBy(desc(s.announcements.pinned), desc(s.announcements.publishedAt)).limit(limit),
  );
}

export type AnnouncementCategory = (typeof s.ANNOUNCEMENT_CATEGORIES)[number];

/** Mural completo, com filtro por categoria e paginação simples ("ver mais"). */
export async function listAnnouncements(actor: AuthenticatedActor, { category, limit }: { category?: AnnouncementCategory; limit: number }) {
  return withTenant(actor, async (tx) => {
    const where = and(visibleNow(), category ? eq(s.announcements.category, category) : undefined);
    const [items, [total]] = await Promise.all([
      tx.select(feedColumns).from(s.announcements).where(where).orderBy(desc(s.announcements.pinned), desc(s.announcements.publishedAt)).limit(limit),
      tx.select({ n: sql<number>`count(*)::int` }).from(s.announcements).where(where),
    ]);
    return { items, total: total?.n ?? 0 };
  });
}

/** Comunicado publicado (colaborador). Rascunho, agendado ou arquivado → 404. */
export async function getAnnouncement(actor: AuthenticatedActor, id: string) {
  return withTenant(actor, async (tx) => {
    const [row] = await tx
      .select({ ...feedColumns, body: s.announcements.body })
      .from(s.announcements)
      .where(and(eq(s.announcements.id, id), visibleNow()));
    if (!row) throw notFound("Comunicado não encontrado.");
    return row;
  });
}

/* --------------------------------------------------------------- gestão */

function requireComms(actor: AuthenticatedActor, permission: "comms.announcement.create" | "comms.announcement.publish") {
  if (!hasTenantWide(actor, permission)) {
    throw forbidden(permission === "comms.announcement.publish" ? "Você pode criar e editar rascunhos, mas publicar exige outra permissão." : undefined);
  }
}

export type ManagedStatus = "draft" | "scheduled" | "published" | "archived";

const managedStatus = (status: string, publishedAt: Date | null): ManagedStatus =>
  status === "published" ? (publishedAt && publishedAt > new Date() ? "scheduled" : "published") : status === "archived" ? "archived" : "draft";

const FILTERS: Record<ManagedFilter, () => SQL | undefined> = {
  todos: () => undefined,
  rascunhos: () => inArray(s.announcements.status, ["draft", "in_review", "approved"]),
  agendados: () => and(eq(s.announcements.status, "published"), gt(s.announcements.publishedAt, new Date())),
  publicados: () => visibleNow(),
  arquivados: () => eq(s.announcements.status, "archived"),
};

export async function listManagedAnnouncements(actor: AuthenticatedActor, filter: ManagedFilter) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, async (tx) => {
    const rows = await tx
      .select({ ...feedColumns, status: s.announcements.status, updatedAt: s.announcements.updatedAt, author: s.users.name })
      .from(s.announcements)
      .leftJoin(s.users, eq(s.users.id, s.announcements.createdBy))
      .where(FILTERS[filter]())
      .orderBy(desc(s.announcements.updatedAt))
      .limit(200);
    return rows.map((r) => ({ ...r, managedStatus: managedStatus(r.status, r.publishedAt) }));
  });
}

async function loadManaged(tx: Tx, id: string) {
  const [row] = await tx
    .select({ ...feedColumns, body: s.announcements.body, status: s.announcements.status })
    .from(s.announcements)
    .where(eq(s.announcements.id, id));
  if (!row) throw notFound("Comunicado não encontrado.");
  return { ...row, managedStatus: managedStatus(row.status, row.publishedAt) };
}

export async function getManagedAnnouncement(actor: AuthenticatedActor, id: string) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, (tx) => loadManaged(tx, id));
}

export async function createAnnouncement(actor: AuthenticatedActor, input: AnnouncementInput, meta: Meta) {
  requireComms(actor, "comms.announcement.create");
  if (input.pinned) requireComms(actor, "comms.announcement.publish");
  return withTenant(actor, async (tx) => {
    const [row] = await tx
      .insert(s.announcements)
      .values({ tenantId: actor.tenantId, ...input, body: input.body || null, status: "draft", createdBy: actor.userId })
      .returning({ id: s.announcements.id });
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.announcement_created", resourceType: "announcement", resourceId: row!.id, metadata: { title: input.title }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

export async function updateAnnouncement(actor: AuthenticatedActor, id: string, input: AnnouncementInput, meta: Meta) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, async (tx) => {
    const current = await loadManaged(tx, id);
    // O que já está no ar (ou agendado) e o destaque só mudam com permissão de publicação.
    if (current.managedStatus !== "draft" || input.pinned !== current.pinned) requireComms(actor, "comms.announcement.publish");
    await tx
      .update(s.announcements)
      .set({ ...input, body: input.body || null })
      .where(eq(s.announcements.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.announcement_updated", resourceType: "announcement", resourceId: id, metadata: { title: input.title }, ...auditMeta(meta) });
    return { id };
  });
}

const MAX_SCHEDULE_MS = 366 * 24 * 60 * 60 * 1000;

export async function publishAnnouncement(actor: AuthenticatedActor, id: string, publishAt: string | null | undefined, meta: Meta) {
  requireComms(actor, "comms.announcement.publish");
  const when = publishAt ? new Date(publishAt) : new Date();
  const now = Date.now();
  if (publishAt && (when.getTime() < now - 60_000 || when.getTime() > now + MAX_SCHEDULE_MS)) {
    throw badRequest("Escolha uma data de publicação entre agora e os próximos 12 meses.");
  }
  return withTenant(actor, async (tx) => {
    const current = await loadManaged(tx, id);
    if (current.managedStatus === "published") throw conflict("Este comunicado já está publicado.");
    await tx.update(s.announcements).set({ status: "published", publishedAt: when }).where(eq(s.announcements.id, id));
    const scheduled = when.getTime() > now + 60_000;
    await recordAudit(tx, {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: "comms.announcement_published",
      resourceType: "announcement",
      resourceId: id,
      metadata: { scheduled, publishAt: when.toISOString() },
      ...auditMeta(meta),
    });
    return { id, status: scheduled ? "scheduled" : "published" };
  });
}

export async function archiveAnnouncement(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireComms(actor, "comms.announcement.publish");
  return withTenant(actor, async (tx) => {
    const current = await loadManaged(tx, id);
    if (current.managedStatus === "archived") return { id };
    await tx.update(s.announcements).set({ status: "archived", pinned: false }).where(eq(s.announcements.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.announcement_archived", resourceType: "announcement", resourceId: id, ...auditMeta(meta) });
    return { id };
  });
}

/** Só rascunhos são excluídos; o que já foi ao ar é arquivado (histórico). */
export async function deleteAnnouncement(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, async (tx) => {
    const current = await loadManaged(tx, id);
    if (current.managedStatus !== "draft") throw conflict("Somente rascunhos podem ser excluídos. Arquive o comunicado.");
    await tx.delete(s.announcements).where(eq(s.announcements.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.announcement_deleted", resourceType: "announcement", resourceId: id, metadata: { title: current.title }, ...auditMeta(meta) });
  });
}

const auditMeta = (meta: Meta) => ({ ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });
