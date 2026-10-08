import "server-only";
import type { AuthenticatedActor } from "@/server/auth/session";
import * as s from "@/server/db/schema";
import { withTenant } from "@/server/db/tenant";

export type FlagOverride = {
  flagKey: string;
  tenantId: string | null;
  roleId: string | null;
  userId: string | null;
  enabled: boolean;
};

/**
 * Avaliação de feature flags. Precedência (mais específico vence):
 *   usuário > papel > tenant > global > padrão da flag.
 * Se o usuário tiver vários papéis com sobrescritas conflitantes, `false`
 * vence (fail closed).
 */
export function evaluateFlags(
  flags: { key: string; defaultEnabled: boolean }[],
  overrides: FlagOverride[],
  ctx: { tenantId: string; userId: string; roleIds: readonly string[] },
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const flag of flags) {
    const mine = overrides.filter((o) => o.flagKey === flag.key);
    const user = mine.find((o) => o.userId === ctx.userId && o.tenantId === ctx.tenantId);
    const roles = mine.filter((o) => o.roleId && ctx.roleIds.includes(o.roleId) && o.tenantId === ctx.tenantId);
    const tenant = mine.find((o) => o.tenantId === ctx.tenantId && !o.roleId && !o.userId);
    const global = mine.find((o) => o.tenantId === null);

    if (user) result[flag.key] = user.enabled;
    else if (roles.length > 0) result[flag.key] = roles.every((o) => o.enabled);
    else if (tenant) result[flag.key] = tenant.enabled;
    else if (global) result[flag.key] = global.enabled;
    else result[flag.key] = flag.defaultEnabled;
  }
  return result;
}

export async function effectiveFlags(actor: AuthenticatedActor): Promise<Record<string, boolean>> {
  return withTenant(actor, async (tx) => {
    const flags = await tx.select({ key: s.featureFlags.key, defaultEnabled: s.featureFlags.defaultEnabled }).from(s.featureFlags);
    const overrides = await tx
      .select({
        flagKey: s.featureFlagOverrides.flagKey,
        tenantId: s.featureFlagOverrides.tenantId,
        roleId: s.featureFlagOverrides.roleId,
        userId: s.featureFlagOverrides.userId,
        enabled: s.featureFlagOverrides.enabled,
      })
      .from(s.featureFlagOverrides);
    return evaluateFlags(flags, overrides, { tenantId: actor.tenantId, userId: actor.userId, roleIds: actor.grants.map((g) => g.roleId) });
  });
}
