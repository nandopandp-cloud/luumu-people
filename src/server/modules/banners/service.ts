import "server-only";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import type { BannerInput } from "./schemas";

/**
 * Banners da home. Gerenciados por quem PUBLICA comunicados
 * (`comms.announcement.publish`): um banner ativo vai direto para a home de
 * toda a empresa. Leitura: banners ativos dentro do período, em ordem.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };
const auditMeta = (meta: Meta) => ({ ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });

const columns = {
  id: s.homeBanners.id,
  layout: s.homeBanners.layout,
  title: s.homeBanners.title,
  subtitle: s.homeBanners.subtitle,
  ctaLabel: s.homeBanners.ctaLabel,
  ctaUrl: s.homeBanners.ctaUrl,
  theme: s.homeBanners.theme,
  illustration: s.homeBanners.illustration,
  imageFileId: s.homeBanners.imageFileId,
  active: s.homeBanners.active,
  startsAt: s.homeBanners.startsAt,
  endsAt: s.homeBanners.endsAt,
  position: s.homeBanners.position,
};

export type Banner = {
  id: string;
  layout: s.BannerLayout;
  title: string;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  theme: s.Theme;
  illustration: s.Illustration | null;
  imageFileId: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  position: number;
};

/** Banners no ar agora (colaborador). */
export async function listLiveBanners(actor: AuthenticatedActor, limit = 5): Promise<Banner[]> {
  const now = new Date();
  return withTenant(actor, (tx) =>
    tx
      .select(columns)
      .from(s.homeBanners)
      .where(
        and(
          eq(s.homeBanners.active, true),
          or(isNull(s.homeBanners.startsAt), lte(s.homeBanners.startsAt, now)),
          or(isNull(s.homeBanners.endsAt), gt(s.homeBanners.endsAt, now)),
        ),
      )
      .orderBy(asc(s.homeBanners.position), asc(s.homeBanners.createdAt))
      .limit(limit),
  );
}

export type BannerStatus = "live" | "scheduled" | "ended" | "inactive";

export function bannerStatus(b: Pick<Banner, "active" | "startsAt" | "endsAt">, now = new Date()): BannerStatus {
  if (!b.active) return "inactive";
  if (b.startsAt && b.startsAt > now) return "scheduled";
  if (b.endsAt && b.endsAt <= now) return "ended";
  return "live";
}

function requireManage(actor: AuthenticatedActor) {
  if (!hasTenantWide(actor, "comms.announcement.publish")) throw forbidden("Gerenciar banners exige permissão de publicação de comunicados.");
}

export async function listManagedBanners(actor: AuthenticatedActor) {
  requireManage(actor);
  const rows = await withTenant(actor, (tx) => tx.select(columns).from(s.homeBanners).orderBy(asc(s.homeBanners.position), asc(s.homeBanners.createdAt)));
  return rows.map((b) => ({ ...b, status: bannerStatus(b) }));
}

async function load(tx: Tx, id: string) {
  const [row] = await tx.select(columns).from(s.homeBanners).where(eq(s.homeBanners.id, id));
  if (!row) throw notFound("Banner não encontrado.");
  return row;
}

export async function getManagedBanner(actor: AuthenticatedActor, id: string) {
  requireManage(actor);
  return withTenant(actor, (tx) => load(tx, id));
}

/** A imagem precisa ser um arquivo de banner do próprio tenant (RLS + finalidade). */
async function assertImage(tx: Tx, imageFileId: string | null) {
  if (!imageFileId) return;
  const [file] = await tx
    .select({ id: s.files.id })
    .from(s.files)
    .where(and(eq(s.files.id, imageFileId), eq(s.files.purpose, "home_banner"), isNull(s.files.deletedAt)));
  if (!file) throw badRequest("Imagem não encontrada. Envie a imagem novamente.");
}

export async function createBanner(actor: AuthenticatedActor, input: BannerInput, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    await assertImage(tx, input.imageFileId);
    const existing = await tx.select({ position: s.homeBanners.position }).from(s.homeBanners);
    const position = existing.reduce((max, b) => Math.max(max, b.position + 1), 0);
    const [row] = await tx
      .insert(s.homeBanners)
      .values({ tenantId: actor.tenantId, ...input, position, createdBy: actor.userId })
      .returning({ id: s.homeBanners.id });
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.banner_created", resourceType: "home_banner", resourceId: row!.id, metadata: { title: input.title, active: input.active }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

export async function updateBanner(actor: AuthenticatedActor, id: string, input: BannerInput, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    await load(tx, id);
    await assertImage(tx, input.imageFileId);
    await tx.update(s.homeBanners).set(input).where(eq(s.homeBanners.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.banner_updated", resourceType: "home_banner", resourceId: id, metadata: { title: input.title, active: input.active }, ...auditMeta(meta) });
    return { id };
  });
}

/** Nova ordem do carrossel: a lista precisa conter exatamente os banners existentes. */
export async function reorderBanners(actor: AuthenticatedActor, ids: string[], meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const existing = await tx.select({ id: s.homeBanners.id }).from(s.homeBanners);
    const known = new Set(existing.map((b) => b.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw badRequest("A lista precisa conter todos os banners, uma vez cada.");
    }
    for (const [position, id] of ids.entries()) await tx.update(s.homeBanners).set({ position }).where(eq(s.homeBanners.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.banner_updated", resourceType: "home_banner", metadata: { reordered: ids.length }, ...auditMeta(meta) });
  });
}

export async function deleteBanner(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const banner = await load(tx, id);
    await tx.delete(s.homeBanners).where(eq(s.homeBanners.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.banner_deleted", resourceType: "home_banner", resourceId: id, metadata: { title: banner.title }, ...auditMeta(meta) });
  });
}
