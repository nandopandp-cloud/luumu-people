import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { recordAudit } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { forbidden, notFound } from "@/server/http/errors";
import type { EventInput } from "./schemas";

/**
 * Agenda de eventos da empresa. Colaborador: só eventos PUBLICADOS que ainda
 * não terminaram. Gestão: `comms.event.manage`.
 */

type Meta = { ip: string | null; userAgent: string | null; requestId: string };
const auditMeta = (meta: Meta) => ({ ipAddress: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId });

const columns = {
  id: s.events.id,
  title: s.events.title,
  description: s.events.description,
  kind: s.events.kind,
  mode: s.events.mode,
  location: s.events.location,
  url: s.events.url,
  startsAt: s.events.startsAt,
  endsAt: s.events.endsAt,
  published: s.events.published,
};

export type EventKind = (typeof s.EVENT_KINDS)[number];
export type EventMode = (typeof s.EVENT_MODES)[number];

/** Publicado e ainda não terminou. Sem horário de fim, conta como 2 h de duração. */
const upcoming = (now: Date) => and(eq(s.events.published, true), sql`coalesce(${s.events.endsAt}, ${s.events.startsAt} + interval '2 hours') >= ${now}`);

export async function listUpcomingEvents(actor: AuthenticatedActor, limit = 3) {
  const now = new Date();
  return withTenant(actor, (tx) => tx.select(columns).from(s.events).where(upcoming(now)).orderBy(asc(s.events.startsAt)).limit(limit));
}

/** Evento publicado (colaborador). Rascunho → 404. */
export async function getEvent(actor: AuthenticatedActor, id: string) {
  return withTenant(actor, async (tx) => {
    const [row] = await tx.select(columns).from(s.events).where(and(eq(s.events.id, id), eq(s.events.published, true)));
    if (!row) throw notFound("Evento não encontrado.");
    return row;
  });
}

/* --------------------------------------------------------------- gestão */

function requireManage(actor: AuthenticatedActor) {
  if (!hasTenantWide(actor, "comms.event.manage")) throw forbidden("Gerenciar a agenda exige a permissão de eventos.");
}

export async function listManagedEvents(actor: AuthenticatedActor) {
  requireManage(actor);
  const now = Date.now();
  const rows = await withTenant(actor, (tx) => tx.select(columns).from(s.events).orderBy(desc(s.events.startsAt)).limit(300));
  return rows.map((e) => ({ ...e, ended: (e.endsAt ?? e.startsAt).getTime() < now }));
}

async function load(tx: Tx, id: string) {
  const [row] = await tx.select(columns).from(s.events).where(eq(s.events.id, id));
  if (!row) throw notFound("Evento não encontrado.");
  return row;
}

export async function getManagedEvent(actor: AuthenticatedActor, id: string) {
  requireManage(actor);
  return withTenant(actor, (tx) => load(tx, id));
}

export async function createEvent(actor: AuthenticatedActor, input: EventInput, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const [row] = await tx.insert(s.events).values({ tenantId: actor.tenantId, ...input, createdBy: actor.userId }).returning({ id: s.events.id });
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.event_created", resourceType: "event", resourceId: row!.id, metadata: { title: input.title, published: input.published }, ...auditMeta(meta) });
    return { id: row!.id };
  });
}

export async function updateEvent(actor: AuthenticatedActor, id: string, input: EventInput, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    await load(tx, id);
    await tx.update(s.events).set(input).where(eq(s.events.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.event_updated", resourceType: "event", resourceId: id, metadata: { title: input.title, published: input.published }, ...auditMeta(meta) });
    return { id };
  });
}

export async function deleteEvent(actor: AuthenticatedActor, id: string, meta: Meta) {
  requireManage(actor);
  return withTenant(actor, async (tx) => {
    const event = await load(tx, id);
    await tx.delete(s.events).where(eq(s.events.id, id));
    await recordAudit(tx, { tenantId: actor.tenantId, actorUserId: actor.userId, action: "comms.event_deleted", resourceType: "event", resourceId: id, metadata: { title: event.title }, ...auditMeta(meta) });
  });
}
