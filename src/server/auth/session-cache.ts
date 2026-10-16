import "server-only";

/**
 * Memória da instância com a última consulta de sessão de cada cookie (ver resolveActor).
 * Fica à parte para o Better Auth poder esquecer a sessão ao encerrá-la (sair, revogar),
 * sem import circular com session.ts.
 */
export type CachedSession<T> = { expiresAt: number; userId: string; sessionId: string; lookup: T };

export const sessionCache = new Map<string, CachedSession<never>>();

export function evictUserSessions(userId: string) {
  for (const [key, entry] of sessionCache) if (entry.userId === userId) sessionCache.delete(key);
}

export function evictSession(sessionId: string) {
  for (const [key, entry] of sessionCache) if (entry.sessionId === sessionId) sessionCache.delete(key);
}
