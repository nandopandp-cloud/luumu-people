import "server-only";
import { loadGrants } from "@/server/authz/grants";
import type { Actor } from "@/server/authz/policy";
import { withTenant } from "@/server/db/tenant";
import { env } from "@/server/env";
import { getAuth } from "./auth";

export type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  image: string | null;
  twoFactorEnabled: boolean;
};

export type AuthenticatedActor = Actor & {
  readonly user: SessionUser;
  readonly sessionId: string;
};

/**
 * Resolve a sessão a partir dos cabeçalhos (cookie) e carrega as permissões.
 * Retorna null se não houver sessão válida. Aplica, além da expiração por
 * ociosidade do Better Auth, o limite ABSOLUTO de duração da sessão.
 */
export async function resolveActor(headers: Headers): Promise<AuthenticatedActor | null> {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers });
  if (!result) return null;

  const { session, user } = result;
  const absoluteLimitMs = env().SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000;
  if (Date.now() - new Date(session.createdAt).getTime() > absoluteLimitMs) {
    const ctx = await auth.$context;
    await ctx.internalAdapter.deleteSession(session.token);
    return null;
  }

  const tenantId = (user as { tenantId?: unknown }).tenantId;
  const status = (user as { status?: unknown }).status;
  if (typeof tenantId !== "string" || status !== "active") return null;

  const grants = await withTenant({ tenantId, userId: user.id }, (tx) => loadGrants(tx, user.id));

  return {
    userId: user.id,
    tenantId,
    grants,
    sessionId: session.id,
    user: {
      id: user.id,
      tenantId,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      twoFactorEnabled: Boolean((user as { twoFactorEnabled?: unknown }).twoFactorEnabled),
    },
  };
}

/** Revoga todas as sessões de um usuário (troca de papel, desativação, reset). */
export async function revokeUserSessions(userId: string): Promise<void> {
  const ctx = await (await getAuth()).$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
}
