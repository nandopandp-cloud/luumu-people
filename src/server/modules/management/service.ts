import "server-only";
import { and, count, eq, gte, isNull, sql } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import { hasPermissionAnywhere, hasTenantWide } from "@/server/authz/policy";
import { accessibleUsersCondition } from "@/server/authz/resolver";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

/**
 * Indicadores do dashboard de gestão. Cada número só é calculado se o ator
 * tiver a permissão correspondente — e sempre dentro do seu escopo.
 */
export async function getManagementOverview(actor: AuthenticatedActor) {
  const canPeople = hasPermissionAnywhere(actor, "people.directory.read");
  const canAudit = hasTenantWide(actor, "audit.read");

  return withTenant(actor, async (tx) => {
    const peopleInScope = canPeople
      ? (
          await tx
            .select({ value: count() })
            .from(s.users)
            .where(and(eq(s.users.status, "active"), accessibleUsersCondition(actor, "people.directory.read", sql`${s.users.id}`)))
        )[0]!.value
      : null;

    const orgUnits = canPeople ? (await tx.select({ value: count() }).from(s.orgUnits).where(isNull(s.orgUnits.archivedAt)))[0]!.value : null;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyLogins = canAudit
      ? (
          await tx
            .select({ value: sql<number>`count(distinct ${s.auditLogs.actorUserId})::int` })
            .from(s.auditLogs)
            .where(and(eq(s.auditLogs.action, "auth.login"), gte(s.auditLogs.createdAt, since)))
        )[0]!.value
      : null;

    const managers = canPeople && hasTenantWide(actor, "people.directory.read")
      ? (
          await tx
            .select({ value: sql<number>`count(distinct ${s.managerRelationships.managerId})::int` })
            .from(s.managerRelationships)
            .where(isNull(s.managerRelationships.validTo))
        )[0]!.value
      : null;

    return { peopleInScope, orgUnits, weeklyLogins, managers };
  });
}
