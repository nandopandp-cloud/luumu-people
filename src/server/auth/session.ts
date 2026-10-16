import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { loadGrants } from "@/server/authz/grants";
import type { Actor } from "@/server/authz/policy";
import * as schema from "@/server/db/schema";
import { withTenant, type Tx } from "@/server/db/tenant";
import { env } from "@/server/env";
import { getAuth } from "./auth";
import { evictUserSessions, sessionCache, type CachedSession } from "./session-cache";

export type SessionUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  image: string | null;
};

export type AuthenticatedActor = Actor & {
  readonly user: SessionUser;
  readonly sessionId: string;
  /** Senha provisória: precisa criar a própria antes de usar a plataforma. */
  readonly mustChangePassword: boolean;
};

type SessionLookup = NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof getAuth>>["api"]["getSession"]>>>;

/**
 * Cache em memória da INSTÂNCIA (a Vercel reaproveita a instância entre requisições) da consulta
 * de sessão do Better Auth, que custava 1–2 idas ao banco em TODA requisição. Não usamos o
 * `cookieCache` do Better Auth: o servidor não consegue renovar o cookie dentro de Server
 * Components, então ele só valeria nos primeiros minutos depois do login.
 *
 * O que NÃO fica defasado (sempre lido ao vivo, na transação que carrega as permissões): status
 * da pessoa (desativada é barrada na hora), `mustChangePassword` e os papéis/permissões.
 * O que pode ficar defasado: sessão revogada em OUTRA instância (sair em outro aparelho, troca de
 * papel, redefinição de senha) vale por até SESSION_CACHE_SECONDS; na mesma instância é imediato.
 */
const MAX_CACHED_SESSIONS = 5_000;
const SESSION_COOKIES = ["luumu.session_token", "__Secure-luumu.session_token"];

/** Chave do cache: hash do cookie de sessão (o valor assinado nunca fica em memória em claro como chave). */
function sessionCacheKey(headers: Headers): string | null {
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name && SESSION_COOKIES.includes(name) && value.length) return createHash("sha256").update(value.join("=")).digest("hex");
  }
  return null;
}

function forgetSession(key: string | null) {
  if (key) sessionCache.delete(key);
}

async function lookupSession(headers: Headers, key: string | null): Promise<SessionLookup | null> {
  const ttlMs = env().SESSION_CACHE_SECONDS * 1000;
  // Relógio monotônico: Date.now() antes de qualquer E/S é barrado na pré-renderização (Cache Components).
  const now = performance.now();
  if (key && ttlMs > 0) {
    const hit = sessionCache.get(key);
    if (hit && hit.expiresAt > now) return hit.lookup as SessionLookup;
    sessionCache.delete(key);
  }
  const result = await (await getAuth()).api.getSession({ headers });
  if (result && key && ttlMs > 0) {
    if (sessionCache.size >= MAX_CACHED_SESSIONS) {
      for (const [k, v] of sessionCache) if (v.expiresAt <= now) sessionCache.delete(k);
      if (sessionCache.size >= MAX_CACHED_SESSIONS) sessionCache.delete(sessionCache.keys().next().value!);
    }
    sessionCache.set(key, { expiresAt: now + ttlMs, userId: result.user.id, sessionId: result.session.id, lookup: result } as CachedSession<never>);
  }
  return result;
}

/**
 * Resolve a sessão a partir dos cabeçalhos (cookie) e carrega as permissões.
 * Retorna null se não houver sessão válida. Aplica, além da expiração por
 * ociosidade do Better Auth, o limite ABSOLUTO de duração da sessão.
 * `alongside` roda na MESMA transação que carrega as permissões (a API usa para
 * contar o rate limit sem abrir outra transação).
 */
export async function resolveActor(headers: Headers, alongside?: (tx: Tx, userId: string) => Promise<void>): Promise<AuthenticatedActor | null> {
  const key = sessionCacheKey(headers);
  const result = await lookupSession(headers, key);
  if (!result) return null;

  const { session, user } = result;
  const absoluteLimitMs = env().SESSION_ABSOLUTE_HOURS * 60 * 60 * 1000;
  // Mesmo instante de Date.now(), por relógio monotônico: com a sessão vinda do cache não há E/S antes daqui
  // e o Next barra Date.now() nesse ponto da pré-renderização (o valor só decide a sessão, nunca vai à página).
  if (performance.timeOrigin + performance.now() - new Date(session.createdAt).getTime() > absoluteLimitMs) {
    forgetSession(key);
    const ctx = await (await getAuth()).$context;
    await ctx.internalAdapter.deleteSession(session.token);
    return null;
  }

  const tenantId = (user as { tenantId?: unknown }).tenantId;
  if (typeof tenantId !== "string") return null;

  // Status e troca obrigatória de senha: sempre do banco (o cache da sessão pode estar defasado).
  const { grants, live } = await withTenant({ tenantId, userId: user.id }, async (tx) => {
    const [row] = await tx
      .select({ status: schema.users.status, mustChangePassword: schema.users.mustChangePassword })
      .from(schema.users)
      .where(eq(schema.users.id, user.id));
    const loaded = await loadGrants(tx, user.id);
    await alongside?.(tx, user.id);
    return { grants: loaded, live: row };
  });
  if (live?.status !== "active") {
    forgetSession(key);
    return null;
  }

  return {
    userId: user.id,
    tenantId,
    grants,
    sessionId: session.id,
    mustChangePassword: live.mustChangePassword === true,
    user: {
      id: user.id,
      tenantId,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    },
  };
}

/** Revoga todas as sessões de um usuário (troca de papel, desativação, reset). */
export async function revokeUserSessions(userId: string): Promise<void> {
  // Esta instância esquece na hora; as demais, em até SESSION_CACHE_SECONDS.
  evictUserSessions(userId);
  const ctx = await (await getAuth()).$context;
  await ctx.internalAdapter.deleteUserSessions(userId);
}
