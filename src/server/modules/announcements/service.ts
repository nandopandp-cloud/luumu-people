import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { containsText } from "@/server/db/text-search";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import { toEmbedUrl } from "@/server/modules/courses/video";
import { audienceMineSql, audienceVisibleSql } from "./audience";
import type { AnnouncementInput, ManagedFilter } from "./schemas";

/**
 * Comunicados.
 *  - Mural do colaborador: só PUBLICADOS com data de publicação já alcançada
 *    (agendados ficam invisíveis até a data). Fixados primeiro.
 *  - Gestão: `comms.announcement.create` cria e edita rascunhos;
 *    `comms.announcement.publish` publica, agenda, fixa, arquiva e edita o que
 *    já está no ar.
 *  - Público: empresa toda ou uma área (e subáreas) — ver ./audience.ts.
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
  coverFileId: s.announcements.coverFileId,
  publishedAt: s.announcements.publishedAt,
};

const visibleNow = () => and(eq(s.announcements.status, "published"), lte(s.announcements.publishedAt, new Date()));

/** Publicado, já no ar e dirigido à pessoa (empresa toda ou a área dela). */
export const visibleTo = (actor: AuthenticatedActor) => and(visibleNow(), audienceVisibleSql(s.announcements.audienceOrgUnitId, actor.userId));

/**
 * Contadores do mural: curtidas, comentários (não removidos) e anexos por tipo.
 * Colunas qualificadas à mão: o Drizzle omite a tabela no SELECT de uma tabela só,
 * e "id" dentro da subconsulta apontaria para a tabela errada.
 */
const engagementColumns = (actor: AuthenticatedActor) => ({
  likes: sql<number>`(select count(*)::int from announcement_reactions r where r.tenant_id = announcements.tenant_id and r.announcement_id = announcements.id)`,
  likedByMe: sql<boolean>`exists (select 1 from announcement_reactions r where r.tenant_id = announcements.tenant_id and r.announcement_id = announcements.id and r.user_id = ${actor.userId})`,
  comments: sql<number>`(select count(*)::int from announcement_comments c where c.tenant_id = announcements.tenant_id and c.announcement_id = announcements.id and c.deleted_at is null)`,
  files: sql<number>`(select count(*)::int from announcement_attachments x where x.tenant_id = announcements.tenant_id and x.announcement_id = announcements.id and x.kind = 'file')`,
  videos: sql<number>`(select count(*)::int from announcement_attachments x where x.tenant_id = announcements.tenant_id and x.announcement_id = announcements.id and x.kind = 'video')`,
  forMyArea: sql<boolean>`(${s.announcements.audienceOrgUnitId} is not null)`,
});

/** Mural resumido (Início): fixados primeiro, depois os mais recentes. */
export async function listAnnouncementFeed(actor: AuthenticatedActor, limit = 3) {
  return withTenant(actor, (tx) =>
    tx.select(feedColumns).from(s.announcements).where(visibleTo(actor)).orderBy(desc(s.announcements.pinned), desc(s.announcements.publishedAt)).limit(limit),
  );
}

export type AnnouncementCategory = (typeof s.ANNOUNCEMENT_CATEGORIES)[number];

export const FEED_TABS = ["todos", "importantes", "minha-area"] as const;
export type FeedTab = (typeof FEED_TABS)[number];
export const FEED_PERIODS = ["recentes", "7d", "30d", "90d"] as const;
export type FeedPeriod = (typeof FEED_PERIODS)[number];
const PERIOD_DAYS: Record<FeedPeriod, number | null> = { recentes: null, "7d": 7, "30d": 30, "90d": 90 };

export type FeedQuery = { tab?: FeedTab; category?: AnnouncementCategory; period?: FeedPeriod; limit: number; exclude?: string[] };

/** Mural completo: abas (todos, importantes, minha área), categoria, período e "ver mais". */
export async function listAnnouncements(actor: AuthenticatedActor, { tab = "todos", category, period = "recentes", limit, exclude = [] }: FeedQuery) {
  const days = PERIOD_DAYS[period];
  return withTenant(actor, async (tx) => {
    const where = and(
      visibleTo(actor),
      tab === "importantes" ? eq(s.announcements.pinned, true) : undefined,
      tab === "minha-area" ? audienceMineSql(s.announcements.audienceOrgUnitId, actor.userId) : undefined,
      category ? eq(s.announcements.category, category) : undefined,
      days ? gte(s.announcements.publishedAt, new Date(Date.now() - days * 86_400_000)) : undefined,
      exclude.length ? notInArray(s.announcements.id, exclude) : undefined,
    );
    const [items, [total]] = await Promise.all([
      tx
        .select({ ...feedColumns, ...engagementColumns(actor) })
        .from(s.announcements)
        .where(where)
        .orderBy(desc(s.announcements.pinned), desc(s.announcements.publishedAt))
        .limit(limit),
      tx.select({ n: sql<number>`count(*)::int` }).from(s.announcements).where(where),
    ]);
    return { items, total: total?.n ?? 0 };
  });
}

/** Destaques do mural (carrossel): comunicados fixados, do mais recente ao mais antigo. */
export async function listFeaturedAnnouncements(actor: AuthenticatedActor, limit = 5) {
  return withTenant(actor, (tx) =>
    tx
      .select(feedColumns)
      .from(s.announcements)
      .where(and(visibleTo(actor), eq(s.announcements.pinned, true)))
      .orderBy(desc(s.announcements.publishedAt))
      .limit(limit),
  );
}

/**
 * "Comunicado da semana": os mais engajados (curtidas + comentários) publicados
 * nos últimos 7 dias. Semana sem publicações: os mais recentes.
 */
export async function listWeeklyHighlights(actor: AuthenticatedActor, limit = 3) {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  return withTenant(actor, async (tx) => {
    const engagement = engagementColumns(actor);
    const week = await tx
      .select(feedColumns)
      .from(s.announcements)
      .where(and(visibleTo(actor), gte(s.announcements.publishedAt, weekAgo)))
      .orderBy(desc(sql`${engagement.likes} + ${engagement.comments}`), desc(s.announcements.publishedAt))
      .limit(limit);
    if (week.length > 0) return week;
    return tx.select(feedColumns).from(s.announcements).where(visibleTo(actor)).orderBy(desc(s.announcements.publishedAt)).limit(limit);
  });
}

/** Comunicado visível para a pessoa (colaborador). Rascunho, agendado, arquivado ou de outra área → 404. */
export async function getAnnouncement(actor: AuthenticatedActor, id: string) {
  return withTenant(actor, async (tx) => {
    const [row] = await tx
      .select({ ...feedColumns, ...engagementColumns(actor), body: s.announcements.body })
      .from(s.announcements)
      .where(and(eq(s.announcements.id, id), visibleTo(actor)));
    if (!row) throw notFound("Comunicado não encontrado.");
    const attachments = await tx
      .select({ id: s.announcementAttachments.id, kind: s.announcementAttachments.kind, title: s.announcementAttachments.title, fileId: s.announcementAttachments.fileId, videoUrl: s.announcementAttachments.videoUrl, mimeType: s.files.mimeType, sizeBytes: s.files.sizeBytes })
      .from(s.announcementAttachments)
      .leftJoin(s.files, eq(s.files.id, s.announcementAttachments.fileId))
      .where(eq(s.announcementAttachments.announcementId, id))
      .orderBy(asc(s.announcementAttachments.position));
    return { ...row, attachments: attachments.map((a) => ({ ...a, embedUrl: a.kind === "video" ? toEmbedUrl(a.videoUrl) : null })) };
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

export type ManagedQuery = { filter: ManagedFilter; q?: string; category?: AnnouncementCategory; page?: number; pageSize?: number };

/** Lista da gestão: filtro por situação, busca (sem acento/caixa), categoria e paginação. */
export async function listManagedAnnouncements(actor: AuthenticatedActor, query: ManagedQuery) {
  requireComms(actor, "comms.announcement.create");
  const { filter, q, category, page = 1, pageSize = 200 } = query;
  const where = and(
    FILTERS[filter](),
    category ? eq(s.announcements.category, category) : undefined,
    q?.trim() ? or(containsText(sql`${s.announcements.title}`, q), containsText(sql`${s.announcements.summary}`, q)) : undefined,
  );
  return withTenant(actor, async (tx) => {
    const [rows, [total]] = await Promise.all([
      tx
        .select({ ...feedColumns, status: s.announcements.status, updatedAt: s.announcements.updatedAt, author: s.users.name })
        .from(s.announcements)
        .leftJoin(s.users, eq(s.users.id, s.announcements.createdBy))
        .where(where)
        .orderBy(desc(s.announcements.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      tx.select({ n: sql<number>`count(*)::int` }).from(s.announcements).where(where),
    ]);
    return { items: rows.map((r) => ({ ...r, managedStatus: managedStatus(r.status, r.publishedAt) })), total: total?.n ?? 0 };
  });
}

export type StatusTrend = { count: number; thisMonth: number; lastMonth: number };

/**
 * Indicadores da gestão: quantos comunicados há em cada situação e quantos
 * entraram nela neste mês e no anterior (publicação para publicados; última
 * atualização para arquivados; criação para os demais).
 */
export async function managedSummary(actor: AuthenticatedActor) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, async (tx) => {
    const result = await tx.execute(sql`
      with base as (
        select
          case
            when status = 'published' and published_at > now() then 'scheduled'
            when status = 'published' then 'published'
            when status = 'archived' then 'archived'
            else 'draft'
          end as bucket,
          created_at,
          case when status = 'published' and published_at <= now() then published_at when status = 'archived' then updated_at else created_at end as entered_at
        from announcements
      ),
      months as (
        select (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo' as this_month,
               (date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month') at time zone 'America/Sao_Paulo' as last_month
      )
      select bucket,
             count(*)::int as count,
             count(*) filter (where entered_at >= m.this_month)::int as this_month,
             count(*) filter (where entered_at >= m.last_month and entered_at < m.this_month)::int as last_month,
             count(*) filter (where created_at >= m.this_month)::int as created_this_month,
             count(*) filter (where created_at >= m.last_month and created_at < m.this_month)::int as created_last_month
      from base, months m
      group by bucket`);
    const rows = (result as unknown as { rows: { bucket: string; count: number; this_month: number; last_month: number; created_this_month: number; created_last_month: number }[] }).rows;
    const pick = (bucket: string): StatusTrend => {
      const r = rows.find((x) => x.bucket === bucket);
      return { count: r?.count ?? 0, thisMonth: r?.this_month ?? 0, lastMonth: r?.last_month ?? 0 };
    };
    const sum = (key: "count" | "created_this_month" | "created_last_month") => rows.reduce((n, r) => n + r[key], 0);
    return {
      total: { count: sum("count"), thisMonth: sum("created_this_month"), lastMonth: sum("created_last_month") },
      published: pick("published"),
      scheduled: pick("scheduled"),
      draft: pick("draft"),
      archived: pick("archived"),
    };
  });
}

async function loadManaged(tx: Tx, id: string) {
  const [row] = await tx
    .select({ ...feedColumns, body: s.announcements.body, status: s.announcements.status, audienceOrgUnitId: s.announcements.audienceOrgUnitId })
    .from(s.announcements)
    .where(eq(s.announcements.id, id));
  if (!row) throw notFound("Comunicado não encontrado.");
  return { ...row, managedStatus: managedStatus(row.status, row.publishedAt) };
}

async function loadAttachments(tx: Tx, id: string) {
  return tx
    .select({ kind: s.announcementAttachments.kind, title: s.announcementAttachments.title, fileId: s.announcementAttachments.fileId, videoUrl: s.announcementAttachments.videoUrl, mimeType: s.files.mimeType, sizeBytes: s.files.sizeBytes })
    .from(s.announcementAttachments)
    .leftJoin(s.files, eq(s.files.id, s.announcementAttachments.fileId))
    .where(eq(s.announcementAttachments.announcementId, id))
    .orderBy(asc(s.announcementAttachments.position));
}

/** Público: a área precisa existir no tenant e estar ativa. */
async function assertAudience(tx: Tx, orgUnitId: string | null) {
  if (!orgUnitId) return;
  const [unit] = await tx.select({ id: s.orgUnits.id }).from(s.orgUnits).where(and(eq(s.orgUnits.id, orgUnitId), isNull(s.orgUnits.archivedAt)));
  if (!unit) throw badRequest("Área do público não encontrada.");
}

/** Substitui os anexos. Arquivos: só os enviados como anexo de comunicado, no próprio tenant. */
async function replaceAttachments(tx: Tx, tenantId: string, announcementId: string, attachments: AnnouncementInput["attachments"]) {
  const fileIds = attachments.flatMap((a) => (a.kind === "file" ? [a.fileId] : []));
  if (fileIds.length) {
    const found = await tx
      .select({ id: s.files.id })
      .from(s.files)
      .where(and(inArray(s.files.id, fileIds), eq(s.files.purpose, "announcement_attachment"), isNull(s.files.deletedAt)));
    if (found.length !== new Set(fileIds).size) throw badRequest("Um dos anexos não foi encontrado. Envie o arquivo novamente.");
  }
  await tx.delete(s.announcementAttachments).where(eq(s.announcementAttachments.announcementId, announcementId));
  if (attachments.length) {
    await tx.insert(s.announcementAttachments).values(
      attachments.map((a, position) =>
        a.kind === "file"
          ? { tenantId, announcementId, kind: "file" as const, title: a.title, fileId: a.fileId, position }
          : { tenantId, announcementId, kind: "video" as const, title: a.title, videoUrl: a.videoUrl, position },
      ),
    );
  }
}

/** Áreas disponíveis como público de comunicado (nome e hierarquia; sem dados de pessoas). */
export async function listAudienceOptions(actor: AuthenticatedActor) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, (tx) =>
    tx
      .select({ id: s.orgUnits.id, name: s.orgUnits.name, type: s.orgUnits.type, parentId: s.orgUnits.parentId })
      .from(s.orgUnits)
      .where(isNull(s.orgUnits.archivedAt))
      .orderBy(asc(s.orgUnits.name)),
  );
}

export async function getManagedAnnouncement(actor: AuthenticatedActor, id: string) {
  requireComms(actor, "comms.announcement.create");
  return withTenant(actor, async (tx) => {
    const announcement = await loadManaged(tx, id);
    const { likes, comments } = engagementColumns(actor);
    const [counts] = await tx.select({ likes, comments }).from(s.announcements).where(eq(s.announcements.id, id));
    return { ...announcement, likes: counts?.likes ?? 0, comments: counts?.comments ?? 0, attachments: await loadAttachments(tx, id) };
  });
}

/** A capa precisa ser uma imagem de comunicado do próprio tenant (RLS + finalidade). */
async function assertCover(tx: Tx, coverFileId: string | null) {
  if (!coverFileId) return;
  const [file] = await tx
    .select({ id: s.files.id })
    .from(s.files)
    .where(and(eq(s.files.id, coverFileId), eq(s.files.purpose, "announcement_cover"), isNull(s.files.deletedAt)));
  if (!file) throw badRequest("Imagem de capa não encontrada. Envie a imagem novamente.");
}

export async function createAnnouncement(actor: AuthenticatedActor, input: AnnouncementInput, meta: Meta) {
  requireComms(actor, "comms.announcement.create");
  if (input.pinned) requireComms(actor, "comms.announcement.publish");
  return withTenant(actor, async (tx) => {
    const { attachments, ...fields } = input;
    await assertCover(tx, input.coverFileId);
    await assertAudience(tx, input.audienceOrgUnitId);
    const [row] = await tx
      .insert(s.announcements)
      .values({ tenantId: actor.tenantId, ...fields, body: input.body || null, status: "draft", createdBy: actor.userId })
      .returning({ id: s.announcements.id });
    await replaceAttachments(tx, actor.tenantId, row!.id, attachments);
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
    const { attachments, ...fields } = input;
    await assertCover(tx, input.coverFileId);
    await assertAudience(tx, input.audienceOrgUnitId);
    await tx
      .update(s.announcements)
      .set({ ...fields, body: input.body || null })
      .where(eq(s.announcements.id, id));
    await replaceAttachments(tx, actor.tenantId, id, attachments);
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
