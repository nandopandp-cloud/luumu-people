import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, desc, eq, lt, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@/server/audit/audit";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasTenantWide } from "@/server/authz/policy";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";
import { forbidden } from "@/server/http/errors";

export const auditQuerySchema = z.strictObject({
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorUserId: z.uuid().optional(),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

const actor = alias(s.users, "actor");

export async function listAuditLogs(viewer: AuthenticatedActor, query: AuditQuery) {
  if (!hasTenantWide(viewer, "audit.read")) throw forbidden();
  return withTenant(viewer, async (tx) => {
    const conditions: SQL[] = [];
    if (query.action) conditions.push(eq(s.auditLogs.action, query.action));
    if (query.actorUserId) conditions.push(eq(s.auditLogs.actorUserId, query.actorUserId));
    if (query.cursor) {
      const [at, id] = Buffer.from(query.cursor, "base64url").toString("utf8").split("|");
      const date = new Date(at ?? "");
      if (id && !Number.isNaN(date.getTime())) {
        conditions.push(or(lt(s.auditLogs.createdAt, date), and(eq(s.auditLogs.createdAt, date), lt(s.auditLogs.id, id)))!);
      }
    }
    const rows = await tx
      .select({
        id: s.auditLogs.id,
        action: s.auditLogs.action,
        resourceType: s.auditLogs.resourceType,
        resourceId: s.auditLogs.resourceId,
        metadata: s.auditLogs.metadata,
        ipAddress: s.auditLogs.ipAddress,
        createdAt: s.auditLogs.createdAt,
        actorType: s.auditLogs.actorType,
        actorName: actor.name,
      })
      .from(s.auditLogs)
      .leftJoin(actor, eq(actor.id, s.auditLogs.actorUserId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(s.auditLogs.createdAt), desc(s.auditLogs.id))
      .limit(query.limit + 1);
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > query.limit && last ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString("base64url") : null,
    };
  });
}
