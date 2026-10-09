import "server-only";
import { asc, eq } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import type { QuickLinkInput } from "./schemas";

/** Links rápidos do mural de comunicados. Gestão: `comms.quicklink.manage`. */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };
const auditMeta = (meta: Meta) => ({ ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });

const columns = {
  id: s.quickLinks.id,
  label: s.quickLinks.label,
  url: s.quickLinks.url,
  icon: s.quickLinks.icon,
  color: s.quickLinks.color,
  active: s.quickLinks.active,
  position: s.quickLinks.position,
};

export type QuickLinkIcon = (typeof s.QUICK_LINK_ICONS)[number];
export type QuickLinkColor = (typeof s.QUICK_LINK_COLORS)[number];

/** Atalhos ativos, na ordem definida (colaborador). */
export async function listActiveQuickLinks(actor: AuthenticatedActor, limit = 8) {
  return withTenant(actor, (tx) =>
    tx.select(columns).from(s.quickLinks).where(eq(s.quickLinks.active, true)).orderBy(asc(s.quickLinks.position), asc(s.quickLinks.createdAt)).limit(limit),
  );
}

function requireManage(actor: AuthenticatedActor) {
  if (!hasTenantWide(actor, "comms.quicklink.manage")) throw forbidden("Gerenciar links rápidos exige a permissão correspondente.");
}

export async function listManagedQuickLinks(actor: AuthenticatedActor) {
  requireManage(actor);
  return withTenant(actor, (tx) => tx.select(columns).from(s.quickLinks).orderBy(asc(s.quickLinks.position), asc(s.quickLinks.createdAt)));
}

async function load(tx: Tx, id: string) {
  const [row] = await tx.select(columns).from(s.quickLinks).where(eq(s.quickLinks.id, id));
  if (!row) throw notFound("Link não encontrado.");
  return row;
}

export async function createQuickLink(actor: AuthenticatedActor, input: QuickLinkInput, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const existing = await tx.select({ position: s.quickLinks.position }).from(s.quickLinks);
    if (existing.length >= 24) throw badRequest("Use no máximo 24 links rápidos.");
    const position = existing.reduce((max, l) => Math.max(max, l.position + 1), 0);
    const [row] = await tx.insert(s.quickLinks).values({ tenantId: actor.tenantId, ...input, position, createdBy: actor.userId }).returning({ id: s.quickLinks.id });
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.quicklink_created", resourceType: "quick_link", resourceId: row!.id, metadata: { label: input.label }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

export async function updateQuickLink(actor: AuthenticatedActor, id: string, input: QuickLinkInput, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    await load(tx, id);
    await tx.update(s.quickLinks).set(input).where(eq(s.quickLinks.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.quicklink_updated", resourceType: "quick_link", resourceId: id, metadata: { label: input.label, active: input.active }, ...auditMeta(meta) });
    return { id };
  });
}

/** Nova ordem: a lista precisa conter exatamente os links existentes. */
export async function reorderQuickLinks(actor: AuthenticatedActor, ids: string[], meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const existing = await tx.select({ id: s.quickLinks.id }).from(s.quickLinks);
    const known = new Set(existing.map((l) => l.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
      throw badRequest("A lista precisa conter todos os links, uma vez cada.");
    }
    for (const [position, id] of ids.entries()) await tx.update(s.quickLinks).set({ position }).where(eq(s.quickLinks.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.quicklink_updated", resourceType: "quick_link", metadata: { reordered: ids.length }, ...auditMeta(meta) });
  });
}

export async function deleteQuickLink(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const link = await load(tx, id);
    await tx.delete(s.quickLinks).where(eq(s.quickLinks.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.quicklink_deleted", resourceType: "quick_link", resourceId: id, metadata: { label: link.label }, ...auditMeta(meta) });
  });
}
