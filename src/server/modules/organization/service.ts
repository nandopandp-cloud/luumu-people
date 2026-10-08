import "server-only";
import { asc, isNull } from "drizzle-orm";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

/** Estrutura organizacional (não sensível): usada em filtros e na navegação. */
export async function listOrgUnits(actor: AuthenticatedActor) {
  return withTenant(actor, (tx) =>
    tx
      .select({ id: s.orgUnits.id, parentId: s.orgUnits.parentId, type: s.orgUnits.type, name: s.orgUnits.name })
      .from(s.orgUnits)
      .where(isNull(s.orgUnits.archivedAt))
      .orderBy(asc(s.orgUnits.name)),
  );
}

export async function getOrganization(actor: AuthenticatedActor) {
  return withTenant(actor, async (tx) => {
    const [org] = await tx.select({ id: s.organizations.id, name: s.organizations.name, slug: s.organizations.slug }).from(s.organizations);
    return org!;
  });
}
